const Admin = require('../models/adminSchema.js');
const { getAuthenticatedSubject, hasBearerToken } = require('../utils/authToken.js');

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

module.exports = { verifySuperAdmin, verifyAdmin };
