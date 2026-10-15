const mongoose = require('mongoose');

const voucherLineSchema = new mongoose.Schema({
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    debitAmount: { type: Number, default: 0, min: 0 },
    creditAmount: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '', trim: true },
}, { _id: true });

const voucherReceiptSchema = new mongoose.Schema({
    storedName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const voucherSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingPeriod', required: true },
    voucherNo: { type: String, required: true, trim: true },
    voucherType: { type: String, enum: ['PV', 'RV', 'JV', 'CV'], required: true },
    voucherDate: { type: Date, required: true },
    payeePayer: { type: String, default: '', trim: true },
    paymentMethod: { type: String, enum: ['Cash', 'Bank Transfer', 'M-Pesa', 'Cheque', 'Other'], default: 'Other' },
    description: { type: String, required: true, trim: true },
    lines: { type: [voucherLineSchema], default: [] },
    receipts: { type: [voucherReceiptSchema], default: [] },
    status: { type: String, enum: ['draft', 'submitted', 'rejected', 'posted', 'reversed'], default: 'draft', index: true },
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null },
    approvedAt: { type: Date, default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null },
    postedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    reversalJournalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, default: '' },
}, { timestamps: true });

voucherSchema.index({ schoolId: 1, voucherNo: 1 }, { unique: true });
voucherSchema.index({ schoolId: 1, periodId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.AccountingVoucher || mongoose.model('AccountingVoucher', voucherSchema);