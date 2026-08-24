const mongoose = require('mongoose');
const Settings = require('../models/settingsSchema');
const SecuritySettings = require('../models/securitySettingsSchema');
const ReportSettings = require('../models/reportSettingsSchema');
const SystemHealth = require('../models/systemHealthSchema');
const AuditLogs = require('../models/auditLogsSchema');
const Admin = require('../models/adminSchema');
const School = require('../models/schoolSchema');
const Student = require('../models/studentSchema');
const Sclass = require('../models/sclassSchema');
const { 
    logSettingsChange, 
    logAuditAction, 
    getClientIP 
} = require('../utils/auditLogger');
const {
    createDatabaseBackup,
    verifyBackup,
    restoreFromBackup,
    getAllBackups,
    deleteOldBackups,
    getBackupStatistics,
} = require('../utils/backupService');
const { applyClassFeeToStudent, summarizeFinanceReport } = require('../utils/financeUtils');

// Branding upload handler will be used to accept logo uploads
const uploadSchoolLogo = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');

        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Build URL accessible by frontend
        const logoPath = `/uploads/branding/${req.file.filename}`;

        let settings = await Settings.findOne({ school: schoolId });
        if (!settings) settings = new Settings({ school: schoolId });

        const before = { ...settings.branding };
        settings.branding = settings.branding || {};
        settings.branding.schoolLogo = logoPath;
        settings.updatedAt = new Date();
        settings.updatedBy = adminId;
        await settings.save();

        // Log audit
        await logAuditAction({
            school: schoolId,
            user: adminId,
            userName: (await Admin.findById(adminId)).name,
            userRole: (await Admin.findById(adminId)).role,
            action: 'UPLOAD_LOGO',
            entityType: 'branding',
            entityId: schoolId,
            entityName: 'School Logo Upload',
            ipAddress: getClientIP(req),
            userAgent: req.get('user-agent'),
            resultMessage: 'Logo uploaded and settings updated',
        });

        res.status(200).json({ message: 'Logo uploaded successfully', logoUrl: logoPath, settings });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading logo', error: error.message });
    }
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Verify user authorization - SuperAdmin or school's Admin
 */
const normalizeSchoolRef = (value) => {
    if (!value) return null;
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (value instanceof mongoose.Types.ObjectId || value?._id) return String(value._id || value.toString());
    if (typeof value.toString === 'function') return String(value.toString());
    return null;
};

const verifyAuthorization = async (userId, userRole, schoolId, isSuperAdminOnly = false) => {
    const admin = await Admin.findById(userId);
    
    if (!admin) {
        return { authorized: false, message: 'Admin not found' };
    }

    if (isSuperAdminOnly) {
        if (admin.role !== 'SuperAdmin') {
            return { authorized: false, message: 'Only SuperAdmin can perform this action' };
        }
    } else {
        if (admin.role === 'SuperAdmin') {
            return { authorized: true };
        }
        
        const allowedRoles = ['Admin', 'Accountant', 'HR'];
        if (!allowedRoles.includes(admin.role)) {
            return { authorized: false, message: 'Only SuperAdmin, Admin, Accountant, or HR can perform this action' };
        }

        const adminSchoolId = normalizeSchoolRef(admin.school) || normalizeSchoolRef(admin.schoolId);
        if (adminSchoolId && adminSchoolId !== String(schoolId)) {
            const relatedSchool = await School.findOne({
                _id: schoolId,
                schoolAdmin: adminSchoolId,
            }).select('_id');
            if (!relatedSchool) {
                return { authorized: false, message: 'Admin can only modify their school settings' };
            }
        }
    }

    return { authorized: true };
};

const applyFinanceSettingsToStudents = async (schoolId, financeSettings = {}) => {
    const classFees = Array.isArray(financeSettings.classFees) ? financeSettings.classFees : [];
    if (!classFees.length) return { appliedClasses: 0, updatedStudents: 0 };

    const appliedClasses = [];
    let updatedStudents = 0;

    for (const classFee of classFees) {
        const classId = classFee?.classId;
        if (!classId) continue;

        const classDoc = await Sclass.findOne({ _id: classId, school: schoolId }).select('_id sclassName');
        if (!classDoc) continue;

        const students = await Student.find({ school: schoolId, sclassName: classId });
        for (const student of students) {
            const updatedStudent = applyClassFeeToStudent(student.toObject ? student.toObject() : student, Number(classFee.feeAmount || 0));
            await Student.findByIdAndUpdate(student._id, {
                $set: {
                    totalFees: updatedStudent.totalFees,
                    amountPaid: updatedStudent.amountPaid,
                    balance: updatedStudent.balance,
                    paymentStatus: updatedStudent.paymentStatus,
                },
            });
            updatedStudents += 1;
        }

        appliedClasses.push(classDoc.sclassName || classId);
    }

    return { appliedClasses: appliedClasses.length, updatedStudents };
};

// ==================== SYSTEM SETTINGS ====================

/**
 * Get system settings for a school
 */
const getSystemSettings = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');

        // Verify authorization
        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        let settings = await Settings.findOne({ school: schoolId });

        if (!settings) {
            settings = await initializeSettings(schoolId);
        }

        const school = await School.findById(schoolId).select('accountBalance paymentSettings.bankDetails schoolName');

        res.status(200).json({
            message: 'Settings retrieved successfully',
            schoolName: school?.schoolName || '',
            schoolAccountBalance: Number(school?.accountBalance || 0),
            bankDetails: school?.paymentSettings?.bankDetails || null,
            settings,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving settings', error: error.message });
    }
};

/**
 * Update system settings
 */
const getFinanceReport = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');

        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const settings = await Settings.findOne({ school: schoolId }) || await initializeSettings(schoolId);
        const students = await Student.find({ school: schoolId }).select('totalFees amountPaid balance paymentStatus');
        const report = summarizeFinanceReport({ students, financeSettings: settings.financeSettings || {} });

        res.status(200).json({ message: 'Finance report retrieved successfully', report, settings });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving finance report', error: error.message });
    }
};

const updateSystemSettings = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');
        const updates = req.body;

        // Verify authorization
        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const admin = await Admin.findById(adminId);
        let settings = await Settings.findOne({ school: schoolId });

        if (!settings) {
            settings = new Settings({ school: schoolId });
        }

        const changesBefore = { ...settings.toObject() };

        if (updates.financeSettings) {
            settings.financeSettings = {
                ...(settings.financeSettings || {}),
                ...updates.financeSettings,
            };
            delete updates.financeSettings;
        }

        // Update fields
        Object.keys(updates).forEach(key => {
            if (key !== 'school' && key !== '_id') {
                settings[key] = updates[key];
            }
        });

        settings.updatedAt = new Date();
        settings.updatedBy = adminId;
        await settings.save();

        if (settings.financeSettings?.classFees?.length) {
            await applyFinanceSettingsToStudents(schoolId, settings.financeSettings);
        }

        // Log the change
        await logSettingsChange(
            schoolId,
            adminId,
            admin.name,
            admin.role,
            'settings',
            'System Settings',
            changesBefore,
            settings.toObject(),
            getClientIP(req),
            req.get('user-agent')
        );

        res.status(200).json({
            message: 'Settings updated successfully',
            settings,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating settings', error: error.message });
    }
};

const paySupplier = async (req, res) => {
    try {
        const adminId = req.get('x-admin-id');
        const { supplier, item, amount, paymentMethod = 'Cash', mpesaNumber = '', bankAccount = '', reference = '', note = '' } = req.body;
        const numericAmount = Number(amount);
        if (!supplier || !item || !numericAmount || numericAmount <= 0) {
            return res.status(400).json({ message: 'Supplier, item, and a positive amount are required' });
        }
        if (paymentMethod === 'Mpesa' && !String(mpesaNumber).trim()) {
            return res.status(400).json({ message: 'M-Pesa number is required' });
        }
        if (paymentMethod === 'Bank Transfer' && !String(bankAccount).trim()) {
            return res.status(400).json({ message: 'Bank account number is required' });
        }

        const auth = await verifyAuthorization(adminId, null, req.params.schoolId);
        if (!auth.authorized) return res.status(403).json({ message: auth.message });

        const payment = { supplier, item, amount: numericAmount, paymentMethod, mpesaNumber, bankAccount, reference, note, status: 'Paid', paidBy: adminId, date: new Date() };
        let settings = await Settings.findOne({ school: req.params.schoolId });
        if (!settings) settings = new Settings({ school: req.params.schoolId });
        settings.financeSettings = settings.financeSettings || {};
        settings.financeSettings.supplies = [...(settings.financeSettings.supplies || []), payment];
        settings.updatedAt = new Date();
        settings.updatedBy = adminId;

        const school = await School.findById(req.params.schoolId) || await School.findOne({ schoolAdmin: req.params.schoolId });
        if (school) {
            school.accountBalance = Number(school.accountBalance || 0) - numericAmount;
            school.accountLedger = school.accountLedger || [];
            school.accountLedger.push({ type: 'Debit', amount: numericAmount, reference: reference || `SUPPLY-${Date.now()}`, description: `Supplier payment to ${supplier} via ${paymentMethod}`, relatedEntity: 'Supplier', createdBy: adminId });
            await school.save();
        }
        await settings.save();
        return res.status(201).json({ message: 'Supplier paid successfully', payment, schoolBalance: school?.accountBalance ?? null });
    } catch (error) {
        return res.status(500).json({ message: 'Supplier payment failed', error: error.message });
    }
};

/**
 * Initialize default settings for a new school
 */
const initializeSettings = async (schoolId) => {
    try {
        const existingSettings = await Settings.findOne({ school: schoolId });
        if (existingSettings) {
            return existingSettings;
        }

        const settings = new Settings({ school: schoolId });
        await settings.save();

        return settings;
    } catch (error) {
        console.error('Error initializing settings:', error);
        throw error;
    }
};

// ==================== SECURITY SETTINGS ====================

/**
 * Get security settings
 */
const getSecuritySettings = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');

        // Verify authorization
        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        let securitySettings = await SecuritySettings.findOne({ school: schoolId });

        if (!securitySettings) {
            securitySettings = await initializeSecuritySettings(schoolId);
        }

        res.status(200).json({
            message: 'Security settings retrieved successfully',
            securitySettings,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving security settings', error: error.message });
    }
};

/**
 * Update security settings
 */
const updateSecuritySettings = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');
        const updates = req.body;

        // Verify authorization - only SuperAdmin or Admin can change security settings
        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const admin = await Admin.findById(adminId);
        let securitySettings = await SecuritySettings.findOne({ school: schoolId });

        if (!securitySettings) {
            securitySettings = new SecuritySettings({ school: schoolId });
        }

        const changesBefore = { ...securitySettings.toObject() };
        const changedFields = [];

        // Update security fields
        Object.keys(updates).forEach(key => {
            if (key !== 'school' && key !== '_id') {
                if (JSON.stringify(securitySettings[key]) !== JSON.stringify(updates[key])) {
                    changedFields.push(key);
                }
                securitySettings[key] = updates[key];
            }
        });

        securitySettings.updatedAt = new Date();
        securitySettings.updatedBy = adminId;
        await securitySettings.save();

        // Log the change with sensitivity
        await logSettingsChange(
            schoolId,
            adminId,
            admin.name,
            admin.role,
            'settings_security',
            'Security Settings',
            changesBefore,
            securitySettings.toObject(),
            getClientIP(req),
            req.get('user-agent')
        );

        res.status(200).json({
            message: 'Security settings updated successfully',
            securitySettings,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating security settings', error: error.message });
    }
};

/**
 * Initialize default security settings
 */
const initializeSecuritySettings = async (schoolId) => {
    try {
        const existingSettings = await SecuritySettings.findOne({ school: schoolId });
        if (existingSettings) {
            return existingSettings;
        }

        const securitySettings = new SecuritySettings({ school: schoolId });
        await securitySettings.save();

        return securitySettings;
    } catch (error) {
        console.error('Error initializing security settings:', error);
        throw error;
    }
};

// ==================== REPORT SETTINGS ====================

/**
 * Get report settings
 */
const getReportSettings = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');

        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const reportSettings = await ReportSettings.findOne({ school: schoolId });

        if (!reportSettings) {
            return res.status(404).json({ message: 'Report settings not found' });
        }

        res.status(200).json({
            message: 'Report settings retrieved successfully',
            reportSettings,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving report settings', error: error.message });
    }
};

/**
 * Update report settings
 */
const updateReportSettings = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');
        const updates = req.body;

        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const admin = await Admin.findById(adminId);
        let reportSettings = await ReportSettings.findOne({ school: schoolId });

        if (!reportSettings) {
            reportSettings = new ReportSettings({ school: schoolId });
        }

        const changesBefore = { ...reportSettings.toObject() };

        Object.keys(updates).forEach(key => {
            if (key !== 'school' && key !== '_id') {
                reportSettings[key] = updates[key];
            }
        });

        reportSettings.updatedAt = new Date();
        reportSettings.updatedBy = adminId;
        await reportSettings.save();

        await logSettingsChange(
            schoolId,
            adminId,
            admin.name,
            admin.role,
            'settings',
            'Report Settings',
            changesBefore,
            reportSettings.toObject(),
            getClientIP(req),
            req.get('user-agent')
        );

        res.status(200).json({
            message: 'Report settings updated successfully',
            reportSettings,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating report settings', error: error.message });
    }
};

/**
 * Create report template
 */
const createReportTemplate = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');
        const { name, description, type, fields, format } = req.body;

        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const admin = await Admin.findById(adminId);
        let reportSettings = await ReportSettings.findOne({ school: schoolId });

        if (!reportSettings) {
            reportSettings = new ReportSettings({ school: schoolId });
        }

        const template = {
            id: `template_${Date.now()}`,
            name,
            description,
            type,
            fields: fields || [],
            format: format || 'pdf',
            isDefault: false,
            createdAt: new Date(),
        };

        reportSettings.reportTemplates.push(template);
        await reportSettings.save();

        res.status(201).json({
            message: 'Report template created successfully',
            template,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating report template', error: error.message });
    }
};

// ==================== BACKUP & RECOVERY ====================

const resolveBackupSchool = async (schoolId) => {
    if (!schoolId) return null;
    return School.findOne({
        $or: [{ _id: schoolId }, { schoolAdmin: schoolId }]
    }).select('_id schoolAdmin');
};

const getBackupSchoolIds = (school) => [school?._id, school?.schoolAdmin]
    .filter(Boolean)
    .map((id) => id.toString());

/**
 * Create manual backup
 */
const createManualBackup = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');
        const { backupMode = 'full', storageLocation = 'local' } = req.body;

        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const admin = await Admin.findById(adminId);

        const result = await createDatabaseBackup(
            schoolId,
            'manual',
            backupMode,
            adminId,
            storageLocation
        );

        if (result.success) {
            await logAuditAction({
                school: schoolId,
                user: adminId,
                userName: admin.name,
                userRole: admin.role,
                action: 'BACKUP_START',
                entityType: 'backup',
                entityId: schoolId,
                entityName: `Manual Backup - ${backupMode}`,
                ipAddress: getClientIP(req),
                userAgent: req.get('user-agent'),
                resultMessage: 'Manual backup initiated successfully',
            });

            res.status(201).json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ message: 'Error creating backup', error: error.message });
    }
};

/**
 * Get all backups for a school
 */
const getSchoolBackups = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');
        const { page = 1, limit = 20, backupType, status } = req.query;
        const school = await resolveBackupSchool(schoolId);
        const canonicalSchoolId = school?._id || schoolId;

        const auth = await verifyAuthorization(adminId, null, canonicalSchoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const result = await getAllBackups(getBackupSchoolIds(school) || canonicalSchoolId, parseInt(page), parseInt(limit), {
            backupType,
            status,
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving backups', error: error.message });
    }
};

/**
 * Verify backup
 */
const verifyBackupIntegrity = async (req, res) => {
    try {
        const { schoolId, backupId } = req.params;
        const adminId = req.get('x-admin-id');

        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const result = await verifyBackup(backupId, adminId);

        if (result.success) {
            await logAuditAction({
                school: schoolId,
                user: adminId,
                userName: (await Admin.findById(adminId)).name,
                userRole: (await Admin.findById(adminId)).role,
                action: 'BACKUP_START',
                entityType: 'backup',
                entityId: backupId,
                entityName: `Backup Verification - ${backupId}`,
                ipAddress: getClientIP(req),
                userAgent: req.get('user-agent'),
                resultMessage: `Backup ${result.isValid ? 'verified' : 'verification failed'}`,
            });
        }

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error verifying backup', error: error.message });
    }
};

/**
 * Restore from backup
 */
const restoreBackup = async (req, res) => {
    try {
        const { schoolId, backupId } = req.params;
        const adminId = req.get('x-admin-id');

        // Only SuperAdmin can restore backups
        const auth = await verifyAuthorization(adminId, null, schoolId, true);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const result = await restoreFromBackup(backupId, adminId);

        if (result.success) {
            const admin = await Admin.findById(adminId);
            await logAuditAction({
                school: schoolId,
                user: adminId,
                userName: admin.name,
                userRole: admin.role,
                action: 'RESTORE_COMPLETE',
                entityType: 'backup',
                entityId: backupId,
                entityName: `Backup Restore - ${backupId}`,
                ipAddress: getClientIP(req),
                userAgent: req.get('user-agent'),
                resultMessage: 'Backup restored successfully',
                sensitivity: 'sensitive',
            });
        }

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error restoring backup', error: error.message });
    }
};

/**
 * Get backup statistics
 */
const getBackupStats = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');
        const school = await resolveBackupSchool(schoolId);
        const canonicalSchoolId = school?._id || schoolId;

        const auth = await verifyAuthorization(adminId, null, canonicalSchoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const result = await getBackupStatistics(getBackupSchoolIds(school) || canonicalSchoolId);

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving backup statistics', error: error.message });
    }
};

// ==================== AUDIT & MONITORING ====================

/**
 * Get audit logs
 */
const getAuditLogsForSchool = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');
        const { page = 1, limit = 50, action, entityType, status } = req.query;

        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        const { getAuditLogs } = require('../utils/auditLogger');
        const result = await getAuditLogs(
            {
                school: schoolId,
                action,
                entityType,
                status,
            },
            parseInt(page),
            parseInt(limit)
        );

        res.status(200).json({
            message: 'Audit logs retrieved successfully',
            ...result,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving audit logs', error: error.message });
    }
};

/**
 * Get system health status
 */
const getSystemHealthStatus = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const adminId = req.get('x-admin-id');

        const auth = await verifyAuthorization(adminId, null, schoolId);
        if (!auth.authorized) {
            return res.status(403).json({ message: auth.message });
        }

        let health = await SystemHealth.findOne({ school: schoolId });

        if (!health) {
            health = new SystemHealth({ school: schoolId });
            await health.save();
        }

        res.status(200).json({
            message: 'System health status retrieved successfully',
            health,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving system health', error: error.message });
    }
};

/**
 * Update system health (called periodically by system)
 */
const updateSystemHealth = async (schoolId, healthData) => {
    try {
        let health = await SystemHealth.findOne({ school: schoolId });

        if (!health) {
            health = new SystemHealth({ school: schoolId });
        }

        Object.assign(health, healthData);
        health.updatedAt = new Date();

        await health.save();
        return health;
    } catch (error) {
        console.error('Error updating system health:', error);
    }
};

module.exports = {
    // System Settings
    getSystemSettings,
    getFinanceReport,
    updateSystemSettings,
    paySupplier,
    initializeSettings,
    
    // Security Settings
    getSecuritySettings,
    updateSecuritySettings,
    initializeSecuritySettings,
    
    // Report Settings
    getReportSettings,
    updateReportSettings,
    createReportTemplate,
    
    // Backup & Recovery
    createManualBackup,
    getSchoolBackups,
    verifyBackupIntegrity,
    restoreBackup,
    getBackupStats,
    // Branding
    uploadSchoolLogo,
    
    // Audit & Monitoring
    getAuditLogsForSchool,
    getSystemHealthStatus,
    updateSystemHealth,
};
