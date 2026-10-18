const router = require('express').Router();
const { verifyAdmin, verifyFinanceWriter } = require('../middleware/superadminAuth');
const SchoolAcademicConfig = require('../models/schoolAcademicConfig');
const LessonPlan = require('../models/lessonPlan');
const SchemeOfWork = require('../models/schemeOfWork');
const TeacherAppraisal = require('../models/teacherAppraisal');
const StudentAssessment = require('../models/studentAssessment');
const {
    // System Settings
    getSystemSettings,
    getFinanceReport,
    updateSystemSettings,
    previewTermTransition,
    activateNextTerm,
    paySupplier,
    
    // Security Settings
    getSecuritySettings,
    updateSecuritySettings,
    
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
    
    // Audit & Monitoring
    getAuditLogsForSchool,
    getSystemHealthStatus,
    uploadSchoolLogo,
} = require('../controllers/settings-controller.js');

// ==================== SYSTEM SETTINGS ====================
// Available to: SuperAdmin, Admin
router.get('/School/:schoolId/SystemSettings', getSystemSettings);
router.put('/School/:schoolId/SystemSettings', updateSystemSettings);
router.get('/Settings/School/:schoolId/SystemSettings', getSystemSettings);
router.put('/Settings/School/:schoolId/SystemSettings', updateSystemSettings);
router.post('/School/:schoolId/TermTransition/Preview', previewTermTransition);
router.post('/School/:schoolId/TermTransition/Activate', activateNextTerm);
router.post('/Settings/School/:schoolId/SupplierPayment', verifyAdmin, verifyFinanceWriter, paySupplier);
router.get('/Settings/School/:schoolId/FinanceReport', getFinanceReport);

// ==================== SECURITY SETTINGS ====================
// Available to: SuperAdmin, Admin
router.get('/School/:schoolId/SecuritySettings', getSecuritySettings);
router.put('/School/:schoolId/SecuritySettings', updateSecuritySettings);

// ==================== REPORT SETTINGS ====================
// Available to: SuperAdmin, Admin
router.get('/School/:schoolId/ReportSettings', getReportSettings);
router.put('/School/:schoolId/ReportSettings', updateReportSettings);
router.post('/School/:schoolId/ReportTemplate/Create', createReportTemplate);

// ==================== BACKUP & RECOVERY ====================
// Available to: SuperAdmin, Admin

// Create manual backup
router.post('/School/:schoolId/Backup/Create', createManualBackup);

// Get all backups
router.get('/School/:schoolId/Backups', getSchoolBackups);

// Verify backup integrity
router.post('/School/:schoolId/Backup/:backupId/Verify', verifyBackupIntegrity);

// Restore from backup (SuperAdmin only)
router.post('/School/:schoolId/Backup/:backupId/Restore', restoreBackup);

// Get backup statistics
router.get('/School/:schoolId/Backup/Statistics', getBackupStats);

// ==================== BRANDING UPLOAD ====================
// Upload school logo (Available to Admin & SuperAdmin)
const brandingUpload = require('../middleware/brandingUpload');
const { fileUploadLimiter } = require('../middleware/rateLimiter');
router.post('/School/:schoolId/Branding/UploadLogo', fileUploadLimiter, brandingUpload.single('logo'), uploadSchoolLogo);

// ==================== AUDIT & MONITORING ====================
// Available to: SuperAdmin, Admin

// Get audit logs
router.get('/School/:schoolId/AuditLogs', getAuditLogsForSchool);

// Get system health status
router.get('/School/:schoolId/SystemHealth', getSystemHealthStatus);

// ==================== KICD / CBC ACADEMIC CONFIG ====================
router.get('/School/:schoolId/AcademicConfig', async (req, res) => {
    try {
        const config = await SchoolAcademicConfig.findOne({ schoolId: req.params.schoolId }).lean();
        res.json(config || null);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/School/:schoolId/AcademicConfig', async (req, res) => {
    try {
        const config = await SchoolAcademicConfig.findOneAndUpdate(
            { schoolId: req.params.schoolId },
            {
                schoolId: req.params.schoolId,
                ...req.body,
                updatedAt: new Date()
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== LESSON PLANS ====================
router.post('/School/:schoolId/LessonPlans', async (req, res) => {
    try {
        const payload = {
            ...req.body,
            schoolId: req.params.schoolId
        };

        const lessonPlan = await LessonPlan.create(payload);
        res.status(201).json(lessonPlan);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/School/:schoolId/LessonPlans', async (req, res) => {
    try {
        const items = await LessonPlan.find({ schoolId: req.params.schoolId }).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== SCHEME OF WORK ====================
router.post('/School/:schoolId/SchemeOfWork', async (req, res) => {
    try {
        const payload = {
            ...req.body,
            schoolId: req.params.schoolId
        };

        const record = await SchemeOfWork.create(payload);
        res.status(201).json(record);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/School/:schoolId/SchemeOfWork', async (req, res) => {
    try {
        const items = await SchemeOfWork.find({ schoolId: req.params.schoolId }).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== TEACHER APPRAISAL ====================
router.post('/School/:schoolId/Appraisals', async (req, res) => {
    try {
        const payload = {
            ...req.body,
            schoolId: req.params.schoolId
        };

        const record = await TeacherAppraisal.create(payload);
        res.status(201).json(record);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/School/:schoolId/Appraisals', async (req, res) => {
    try {
        const items = await TeacherAppraisal.find({ schoolId: req.params.schoolId }).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== STUDENT ASSESSMENTS (CBC / MIXED) ====================
router.post('/School/:schoolId/StudentAssessments', async (req, res) => {
    try {
        const payload = {
            ...req.body,
            schoolId: req.params.schoolId
        };

        const record = await StudentAssessment.create(payload);
        res.status(201).json(record);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/School/:schoolId/StudentAssessments', async (req, res) => {
    try {
        const items = await StudentAssessment.find({ schoolId: req.params.schoolId }).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// SuperAdmin only routes
// ==================== SUPERADMIN ADVANCED SETTINGS ====================

// Note: SuperAdmin can also access all school settings by providing schoolId in query
// Example: GET /SuperAdmin/SystemSettings?page=1&limit=10

module.exports = router;
