const Admin = require('../models/adminSchema.js');
const { getAuthenticatedSubject, hasBearerToken } = require('../utils/authToken.js');
const { getRequestUser } = require('./schoolAccess.js');

const resolveSchoolAdminId = async (schoolId) => {
    if (!schoolId) return null;
    const School = require('../models/schoolSchema.js');
    const school = await School.findOne({ $or: [{ _id: schoolId }, { schoolAdmin: schoolId }] }).select('schoolAdmin').lean();
    return String(school?.schoolAdmin || schoolId);
};

const resolveFinanceResourceSchool = async (req) => {
    let schoolId = req.body?.schoolId || req.params?.schoolId || req.query?.schoolId;
    const path = req.path || '';
    if (!schoolId && req.params?.periodId) {
        const { AccountingPeriod } = require('../models/accountingSchema');
        schoolId = (await AccountingPeriod.findById(req.params.periodId).select('schoolId').lean())?.schoolId;
    }
    if (!schoolId && req.params?.accountId) {
        const { Account } = require('../models/accountingSchema');
        schoolId = (await Account.findById(req.params.accountId).select('schoolId').lean())?.schoolId;
    }
    if (!schoolId && (req.params?.journalId || (path.includes('/Accounting/Journal/') && req.params?.id))) {
        const { JournalEntry } = require('../models/accountingSchema');
        schoolId = (await JournalEntry.findById(req.params.journalId || req.params.id).select('schoolId').lean())?.schoolId;
    }
    if (!schoolId && req.params?.budgetId) {
        const { Budget } = require('../models/accountingSchema');
        schoolId = (await Budget.findById(req.params.budgetId).select('schoolId').lean())?.schoolId;
    }
    if (!schoolId && path.includes('/ExpenseClaim/') && req.params?.id) {
        const ExpenseClaim = require('../models/expenseClaimSchema');
        schoolId = (await ExpenseClaim.findById(req.params.id).select('schoolId').lean())?.schoolId;
    }
    if (!schoolId && path.startsWith('/StudentPayment/') && req.params?.id) {
        const Student = require('../models/studentSchema');
        schoolId = (await Student.findById(req.params.id).select('school').lean())?.school;
    }
    if (!schoolId && path.startsWith('/Teacher/SalaryPayment/') && req.params?.id) {
        const Teacher = require('../models/teacherSchema');
        schoolId = (await Teacher.findById(req.params.id).select('school').lean())?.school;
    }
    return schoolId ? resolveSchoolAdminId(schoolId) : null;
};

const verifyFinanceAccess = (write = false) => async (req, res, next) => {
    try {
        const identity = await getRequestUser(req);
        if (!identity || identity.type !== 'admin') {
            return res.status(identity ? 403 : 401).json({ message: 'Finance staff authentication is required' });
        }
        const roles = new Set([identity.user.role, ...(identity.user.roles || [])]);
        if (write && roles.has('Auditor') && !roles.has('Admin') && !roles.has('SuperAdmin')) {
            return res.status(403).json({ message: 'Auditors have read-only access to financial records' });
        }
        const allowedRoles = write
            ? ['Admin', 'SuperAdmin', 'Accountant']
            : ['Admin', 'SuperAdmin', 'Accountant', 'Auditor'];
        if (![...roles].some((role) => allowedRoles.includes(role))) {
            return res.status(403).json({ message: write ? 'This role is read-only for financial transactions' : 'This role cannot view financial records' });
        }

        const requestedSchoolAdminId = await resolveFinanceResourceSchool(req)
            || (write ? await resolveSchoolAdminId(identity.schoolId || identity.user._id) : null);
        if (!requestedSchoolAdminId) {
            return res.status(400).json({ message: 'School scope could not be resolved for this finance record' });
        }
        const requesterSchoolAdminId = await resolveSchoolAdminId(identity.schoolId || identity.user._id);
        if (!roles.has('SuperAdmin') && String(requestedSchoolAdminId) !== String(requesterSchoolAdminId)) {
            return res.status(403).json({ message: 'Access denied: financial record belongs to another school' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Unable to verify finance access', error: error.message });
    }
};

// Middleware to verify SuperAdmin role
const verifySuperAdmin = async (req, res, next) => {
    try {
        const authenticatedSubject = getAuthenticatedSubject(req);
        if (hasBearerToken(req) && !authenticatedSubject) {
            return res.status(401).send({ message: 'Invalid or expired authentication token' });
        }
        const superAdminId = authenticatedSubject || req.get('x-admin-id') || req.body.adminID || req.query.adminID;
        
        if (!superAdminId) {
            return res.status(401).send({ message: 'No admin ID provided' });
        }

        let admin = null;
        try {
            admin = await Admin.findById(superAdminId);
        } catch (err) {
            admin = null;
        }

        if (!admin) {
            const { testDB } = require('../testdb');
            const fallbackAdmin = testDB.admins.find((item) => String(item._id).toLowerCase() === String(superAdminId).toLowerCase());
            if (!fallbackAdmin) {
                return res.status(404).send({ message: 'Admin not found' });
            }
            admin = { ...fallbackAdmin, _id: fallbackAdmin._id, isFallback: true };
        }

        if (admin.role !== 'SuperAdmin') {
            return res.status(403).send({ message: 'Forbidden: Only SuperAdmin can access this resource' });
        }

        req.superAdmin = admin;
        req.user = admin;
        req.userId = admin._id;
        next();
    } catch (err) {
        res.status(500).send({ message: 'Error verifying SuperAdmin', error: err.message });
    }
};

// Middleware to verify Admin role (School Admin or SuperAdmin)
const verifyAdmin = async (req, res, next) => {
    try {
        const authenticatedSubject = getAuthenticatedSubject(req);
        if (hasBearerToken(req) && !authenticatedSubject) {
            return res.status(401).send({ message: 'Invalid or expired authentication token' });
        }
        const adminId = authenticatedSubject || req.get('x-admin-id') || req.body.adminID || req.query.adminID;
        
        if (!adminId) {
            return res.status(401).send({ message: 'No admin ID provided' });
        }

        let admin = null;
        try {
            admin = await Admin.findById(adminId);
        } catch (err) {
            admin = null;
        }

        if (!admin) {
            const { testDB } = require('../testdb');
            const fallbackAdmin = testDB.admins.find((item) => String(item._id).toLowerCase() === String(adminId).toLowerCase());
            if (!fallbackAdmin) {
                return res.status(404).send({ message: 'Admin not found' });
            }
            admin = { ...fallbackAdmin, _id: fallbackAdmin._id, isFallback: true };
        }

        if (admin.approved === false) {
            return res.status(403).send({ message: 'Admin not approved' });
        }

        req.admin = admin;
        req.user = admin;
        req.userId = admin._id;
        next();
    } catch (err) {
        res.status(500).send({ message: 'Error verifying Admin', error: err.message });
    }
};

const verifyFinanceWriter = (req, res, next) => {
    return verifyFinanceAccess(true)(req, res, next);
};

const verifyFinanceReader = (req, res, next) => verifyFinanceAccess(false)(req, res, next);

module.exports = { verifySuperAdmin, verifyAdmin, verifyFinanceWriter, verifyFinanceReader };
