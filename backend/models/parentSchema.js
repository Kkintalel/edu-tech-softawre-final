const mongoose = require('mongoose');
const { encryptText, decryptText } = require('../utils/encryption');
const { createSearchTokens } = require('../utils/searchTokens');

const parentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        set: encryptText,
        get: decryptText
    },
    nameSearchTokens: { type: [String], default: [], select: false },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    emailSearchTokens: { type: [String], default: [], select: false },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        default: '',
        set: encryptText,
        get: decryptText
    },
    phoneSearchTokens: { type: [String], default: [], select: false },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'student',
        required: true
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true
    },
    role: {
        type: String,
        default: 'Parent'
    },
    acceptedTerms: {
        type: Boolean,
        default: false
    },
    acceptedPrivacyPolicy: {
        type: Boolean,
        default: false
    },
    acceptedTermsAt: {
        type: Date,
        default: null
    },
    acceptedPrivacyPolicyAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

parentSchema.set('toJSON', { getters: true });
parentSchema.set('toObject', { getters: true });
parentSchema.pre('validate', function setParentSearchTokens(next) {
    this.nameSearchTokens = createSearchTokens(this.name);
    this.emailSearchTokens = createSearchTokens(this.email);
    this.phoneSearchTokens = createSearchTokens(String(this.phone || '').replace(/\D/g, ''));
    next();
});

parentSchema.index({ school: 1, email: 1 }, { unique: true });
parentSchema.index({ school: 1, nameSearchTokens: 1 });
parentSchema.index({ school: 1, emailSearchTokens: 1 });
parentSchema.index({ school: 1, phoneSearchTokens: 1 });

module.exports = mongoose.model('parent', parentSchema);
