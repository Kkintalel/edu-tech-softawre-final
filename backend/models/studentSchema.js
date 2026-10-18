const mongoose = require('mongoose');
const { encryptText, decryptText } = require('../utils/encryption');
const { createSearchTokens } = require('../utils/searchTokens');

const normalizeEmailValue = (value) => {
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    if (!trimmed) return undefined;
    return trimmed.toLowerCase();
};

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        set: encryptText,
        get: decryptText
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        default: '',
    },
    dateOfBirth: {
        type: Date,
        default: null,
    },
    searchTokens: { type: [String], default: [], select: false },
    admissionNo: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        default: null,
        set: normalizeEmailValue,
        get: (value) => normalizeEmailValue(value),
    },
    rollNum: {
        type: Number,
        default: undefined
    },
    photo: {
        type: String,
        default: ''
    },
    parentName: {
        type: String,
        default: '',
        set: encryptText,
        get: decryptText
    },
    parentNameSearchTokens: { type: [String], default: [], select: false },
    parentPhone: {
        type: String,
        default: '',
        set: encryptText,
        get: decryptText
    },
    parentPhoneSearchTokens: { type: [String], default: [], select: false },
    parentEmail: {
        type: String,
        default: ''
    },
    parentEmailSearchTokens: { type: [String], default: [], select: false },
    guardianName: {
        type: String,
        default: '',
        set: encryptText,
        get: decryptText
    },
    guardianNameSearchTokens: { type: [String], default: [], select: false },
    guardianPhone: {
        type: String,
        default: '',
        set: encryptText,
        get: decryptText
    },
    guardianPhoneSearchTokens: { type: [String], default: [], select: false },
    guardianEmail: {
        type: String,
        default: '',
        lowercase: true,
        trim: true
    },
    guardianEmailSearchTokens: { type: [String], default: [], select: false },
    guardianRelation: {
        type: String,
        default: ''
    },
    // Additional identification fields
    nationalId: {
        type: String,
        default: ''
    },
    birthCertificateNumber: {
        type: String,
        default: ''
    },
    nemisNumber: {
        type: String,
        default: ''
    },
    // Previous level information (optional)
    previousLevelGrade: {
        type: String,
        default: ''
    },
    password: {
        type: String,
        required: true
    },
    forcePasswordChange: {
        type: Boolean,
        default: false
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
    sclassName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'sclass',
        required: true,
    },
    individualSubjects: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'subject' }],
        default: null,
    },
    stream: {
        type: String,
        trim: true,
        default: ''
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
    },
    biometricId: {
        type: String,
        trim: true,
        sparse: true,
        unique: true,
    },
    role: {
        type: String,
        default: "Student"
    },
    totalFees: {
        type: Number,
        default: 0
    },
    feeAssessments: {
        type: [{
            academicYear: { type: String, required: true, trim: true },
            term: { type: String, required: true, trim: true },
            amount: { type: Number, required: true, min: 0 },
            newCharges: { type: Number, min: 0 },
            carriedForwardBalance: { type: Number, default: 0 },
            transitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TermTransition', default: null },
            effectiveAt: { type: Date, required: true, default: Date.now },
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null },
        }],
        default: [],
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    balance: {
        type: Number,
        default: 0
    },
    classTeacherRemarks: {
        type: String,
        default: ''
    },
    principalRemarks: {
        type: String,
        default: ''
    },
    reportCardStatus: {
        type: String,
        enum: ['Draft', 'Published', 'Amended'],
        default: 'Draft'
    },
    reportCardPublishedAt: {
        type: Date,
        default: null
    },
    reportCardPublishedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        default: null
    },
    reportCardHistory: [{
        academicYear: { type: String, trim: true, default: '' },
        term: { type: String, trim: true, default: '' },
        status: { type: String, enum: ['Draft', 'Published', 'Amended'], default: 'Draft' },
        publishedAt: { type: Date, default: null },
        publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null },
    }],
    nextSchoolOpeningDate: {
        type: Date,
        default: null
    },
    feePeriodKey: {
        type: String,
        default: 'initial'
    },
    carriedForwardBalance: {
        type: Number,
        default: 0,
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Verified'],
        default: 'Pending'
    },
    paymentHistory: {
        type: [{
            amount: { type: Number, required: true },
            paymentMethod: { type: String, enum: ['Paybill', 'Card', 'Bank Transfer', 'Cash', 'Account Number', 'Online Transfer', 'Mpesa', 'M-Pesa STK Push', 'Cheque', 'Lipa Na Mpesa'], default: 'Paybill' },
            date: { type: Date, default: Date.now },
            receiptNumber: { type: String, required: true },
            status: { type: String, enum: ['Pending', 'Completed', 'Failed', 'Verified'], default: 'Pending' },
            transactionId: { type: String, default: '' },
            checkoutRequestId: { type: String, default: '' },
            mpesaReceiptNumber: { type: String, default: '' },
            transactionDate: { type: String, default: '' },
            phoneNumber: { type: String, default: '' },
            balanceAfter: { type: Number, required: true, default: 0 },
            feePeriodKey: { type: String, default: 'initial' },
            academicYear: { type: String, default: '' },
            term: { type: String, default: '' },
            verifiedBy: { type: String, default: '' },
            verifiedDate: { type: Date, default: null },
            provider: { type: String, default: '' },
            reference: { type: String, default: '' },
            paymentReference: { type: String, default: '' },
            chequeNumber: { type: String, default: '' },
            paymentNote: { type: String, default: '' }
        }],
        default: []
    },
    resetPasswordToken: {
        type: String,
        default: ''
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },
    examResult: [
        {
            subName: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'subject',
            },
            examType: {
                type: String,
                enum: ['CAT', 'END_TERM'],
                default: 'CAT'
            },
            term: {
                type: String,
                trim: true,
                default: 'Term 1'
            },
            academicYear: {
                type: String,
                trim: true,
                default: () => String(new Date().getFullYear()),
            },
            marksObtained: {
                type: Number,
                default: 0
            },
            grade: {
                type: String,
                default: ''
            },
            level: {
                type: String,
                default: ''
            },
            points: {
                type: Number,
                default: 0
            },
            remark: {
                type: String,
                default: ''
            },
            gradingSystem: {
                type: String,
                enum: ['achievement', 'cdacc', 'knec'],
                default: 'achievement'
            }
        }
    ],
    attendance: [{
        date: {
            type: Date,
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ['Present', 'Absent'],
            required: true
        },
        checkInMethod: {
            type: String,
            enum: ['Manual', 'Biometric', 'Online Class'],
            default: 'Manual'
        },
        subName: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'subject',
            required: true,
            index: true
        },
        academicYear: { type: String, trim: true, default: '' },
        term: { type: String, trim: true, default: '' }
    }]
});
studentSchema.set('toJSON', { getters: true });
studentSchema.set('toObject', { getters: true });

studentSchema.pre('validate', function assignPaymentPeriod(next) {
    this.email = normalizeEmailValue(this.email);
    this.searchTokens = createSearchTokens(this.name);
    this.parentNameSearchTokens = createSearchTokens(this.parentName);
    this.parentPhoneSearchTokens = createSearchTokens(String(this.parentPhone || '').replace(/\D/g, ''));
    this.parentEmailSearchTokens = createSearchTokens(this.parentEmail);
    this.guardianNameSearchTokens = createSearchTokens(this.guardianName);
    this.guardianPhoneSearchTokens = createSearchTokens(String(this.guardianPhone || '').replace(/\D/g, ''));
    this.guardianEmailSearchTokens = createSearchTokens(this.guardianEmail);
    const currentPeriod = this.feePeriodKey || 'initial';
    if (Array.isArray(this.paymentHistory)) {
        this.paymentHistory.forEach((payment) => {
            if (!payment.feePeriodKey) payment.feePeriodKey = currentPeriod;
            if (payment.balanceAfter === undefined || payment.balanceAfter === null || Number.isNaN(Number(payment.balanceAfter))) {
                payment.balanceAfter = Number(this.balance || 0);
            }
        });
    }
    next();
});

studentSchema.index({ school: 1, admissionNo: 1 }, { unique: true });
studentSchema.index({ school: 1, sclassName: 1, rollNum: 1 }, { unique: true });
studentSchema.index({ school: 1, email: 1 }, {
    unique: true,
    sparse: true,
    partialFilterExpression: { email: { $type: 'string' } }
});
studentSchema.index({ school: 1, sclassName: 1, stream: 1, createdAt: -1 });
studentSchema.index({ school: 1, searchTokens: 1 });
studentSchema.index({ school: 1, parentNameSearchTokens: 1 });
studentSchema.index({ school: 1, parentPhoneSearchTokens: 1 });
studentSchema.index({ school: 1, parentEmailSearchTokens: 1 });
studentSchema.index({ school: 1, guardianNameSearchTokens: 1 });
studentSchema.index({ school: 1, guardianPhoneSearchTokens: 1 });
studentSchema.index({ school: 1, guardianEmailSearchTokens: 1 });
studentSchema.index({ school: 1, 'examResult.academicYear': 1, 'examResult.term': 1, 'examResult.examType': 1, 'examResult.subName': 1 });
studentSchema.index({ school: 1, 'paymentHistory.academicYear': 1, 'paymentHistory.term': 1, 'paymentHistory.status': 1, 'paymentHistory.date': -1 });
studentSchema.index({ 'attendance.subName': 1, 'attendance.date': 1 });
module.exports = mongoose.model("student", studentSchema);
