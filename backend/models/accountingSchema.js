const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'school',
        required: true,
        index: true,
    },
    code: {
        type: String,
        required: true,
        trim: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ['asset', 'liability', 'equity', 'revenue', 'expense', 'contra'],
        required: true,
    },
    category: {
        type: String,
        enum: ['cash', 'bank', 'receivables', 'payables', 'fees', 'payroll', 'fixed_asset', 'donor', 'restricted_fund', 'operating_expense'],
        default: 'operating_expense',
    },
    parentAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        default: null,
    },
    normalBalance: {
        type: String,
        enum: ['debit', 'credit'],
        required: true,
    },
    active: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

const accountingPeriodSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'school',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['open', 'closed', 'locked'],
        default: 'open',
    },
    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        default: null,
    },
    closedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

const journalLineSchema = new mongoose.Schema({
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: true,
    },
    debitAmount: {
        type: Number,
        default: 0,
    },
    creditAmount: {
        type: Number,
        default: 0,
    },
    description: {
        type: String,
        default: '',
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    referenceType: {
        type: String,
        enum: ['feePayment', 'salaryPayment', 'supplierInvoice', 'bankTransaction', 'assetPurchase', 'voucher', 'manual'],
        default: 'manual',
    },
}, { _id: true });

const journalEntrySchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'school',
        required: true,
        index: true,
    },
    periodId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AccountingPeriod',
        required: true,
    },
    entryNo: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    entryDate: {
        type: Date,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    sourceModule: {
        type: String,
        enum: ['fees', 'payroll', 'procurement', 'bank', 'asset', 'manual'],
        required: true,
    },
    status: {
        type: String,
        enum: ['draft', 'posted', 'reversed', 'voided'],
        default: 'draft',
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        default: null,
    },
    postedAt: {
        type: Date,
        default: null,
    },
    sourceVoucherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AccountingVoucher',
        default: null,
    },
    reversalOfVoucherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AccountingVoucher',
        default: null,
    },
    lines: [journalLineSchema],
}, { timestamps: true });
journalEntrySchema.index(
    { schoolId: 1, sourceVoucherId: 1 },
    { unique: true, partialFilterExpression: { sourceVoucherId: { $type: 'objectId' } } }
);
journalEntrySchema.index(
    { schoolId: 1, reversalOfVoucherId: 1 },
    { unique: true, partialFilterExpression: { reversalOfVoucherId: { $type: 'objectId' } } }
);

const generalLedgerSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'school',
        required: true,
        index: true,
    },
    periodId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AccountingPeriod',
        required: true,
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: true,
    },
    journalEntryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JournalEntry',
        required: true,
    },
    journalLineId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    entryDate: {
        type: Date,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    debitAmount: {
        type: Number,
        default: 0,
    },
    creditAmount: {
        type: Number,
        default: 0,
    },
    balanceAfter: {
        type: Number,
        default: 0,
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    referenceType: {
        type: String,
        default: 'manual',
    },
}, { timestamps: true });

const budgetAllocationSchema = new mongoose.Schema({
    periodKey: {
        type: String,
        required: true,
        trim: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
}, { _id: false });

const budgetSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'school',
        required: true,
        index: true,
    },
    periodId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AccountingPeriod',
        required: true,
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    programme: {
        type: String,
        trim: true,
        default: '',
    },
    activity: {
        type: String,
        trim: true,
        default: '',
    },
    periodization: {
        type: String,
        enum: ['annual', 'monthly', 'quarterly'],
        default: 'annual',
    },
    allocations: {
        type: [budgetAllocationSchema],
        default: [],
    },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'reviewed', 'approved', 'locked', 'revision_requested'],
        default: 'draft',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        default: null,
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        default: null,
    },
    submittedAt: {
        type: Date,
        default: null,
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        default: null,
    },
    reviewedAt: {
        type: Date,
        default: null,
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        default: null,
    },
    approvedAt: {
        type: Date,
        default: null,
    },
    lockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        default: null,
    },
    lockedAt: {
        type: Date,
        default: null,
    },
    revision: {
        type: Number,
        default: 1,
        min: 1,
    },
    revisionReason: {
        type: String,
        default: '',
    },
    notes: {
        type: String,
        default: '',
    },
}, { timestamps: true });

budgetSchema.index({ schoolId: 1, periodId: 1, accountId: 1 }, { unique: true });

const auditLogSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'school',
        required: true,
        index: true,
    },
    entityType: {
        type: String,
        required: true,
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    action: {
        type: String,
        required: true,
    },
    fieldName: {
        type: String,
        default: null,
    },
    oldValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    newValue: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
    },
    changedAt: {
        type: Date,
        default: Date.now,
    },
    notes: {
        type: String,
        default: '',
    },
    source: {
        type: String,
        enum: ['admin_panel', 'api', 'batch_import'],
        default: 'api',
    },
}, { timestamps: false });

const Account = mongoose.model('Account', accountSchema);
const AccountingPeriod = mongoose.model('AccountingPeriod', accountingPeriodSchema);
const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);
const GeneralLedger = mongoose.model('GeneralLedger', generalLedgerSchema);
const Budget = mongoose.model('Budget', budgetSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = {
    Account,
    AccountingPeriod,
    JournalEntry,
    GeneralLedger,
    Budget,
    AuditLog,
};
