const mongoose = require('mongoose');

const demoRequestSchema = new mongoose.Schema({
    school: { type: String, required: true, trim: true, maxlength: 160 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    message: { type: String, trim: true, maxlength: 2000, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('DemoRequest', demoRequestSchema);