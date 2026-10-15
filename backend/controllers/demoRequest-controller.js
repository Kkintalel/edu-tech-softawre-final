const DemoRequest = require('../models/demoRequestSchema.js');

const createDemoRequest = async (req, res) => {
    try {
        const { school, name, email, phone = '', message = '' } = req.body || {};
        if (typeof school !== 'string' || typeof name !== 'string' || typeof email !== 'string') {
            return res.status(400).json({ message: 'School, name, and email are required.' });
        }

        const cleanSchool = school.trim();
        const cleanName = name.trim();
        const cleanEmail = email.trim();
        const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
        const cleanMessage = typeof message === 'string' ? message.trim() : '';
        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);

        if (!cleanSchool || !cleanName || !validEmail || cleanSchool.length > 160 || cleanName.length > 120 || cleanEmail.length > 254 || cleanPhone.length > 40 || cleanMessage.length > 2000) {
            return res.status(400).json({ message: 'Enter valid contact details and keep each field within its size limit.' });
        }

        const demoRequest = await DemoRequest.create({
            school: cleanSchool,
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            message: cleanMessage,
        });
        return res.status(201).json({ message: 'Demo request received.', requestId: demoRequest._id });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to submit demo request.' });
    }
};

const listDemoRequests = async (req, res) => {
    try {
        const requests = await DemoRequest.find().sort({ createdAt: -1 }).lean();
        return res.status(200).json(requests);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load demo requests.' });
    }
};

module.exports = { createDemoRequest, listDemoRequests };