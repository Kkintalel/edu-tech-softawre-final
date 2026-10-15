const mongoose = require('mongoose');

const pledgeSchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true, index: true },
    promisedBy: { type: String, required: true, trim: true },
    promisedAmount: { type: Number, required: true, min: 0.01 },
    promisedDate: { type: Date, required: true, index: true },
    note: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Partially Fulfilled', 'Fulfilled', 'Overdue', 'Cancelled'], default: 'Pending', index: true },
    fulfilledAmount: { type: Number, default: 0, min: 0 },
    fulfillments: [{
        paymentRecordId: { type: mongoose.Schema.Types.ObjectId, required: true },
        receiptNumber: { type: String, default: '' },
        externalReference: { type: String, default: '' },
        amount: { type: Number, required: true, min: 0.01 },
        linkedAt: { type: Date, default: Date.now },
        linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
}, { timestamps: true });

pledgeSchema.index({ school: 1, status: 1, promisedDate: 1 });

const procurementOrderSchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
    type: { type: String, enum: ['LPO', 'LSO', 'Payment Voucher'], required: true },
    reference: { type: String, required: true, trim: true },
    supplier: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'KES' },
    status: { type: String, enum: ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Paid', 'Cancelled'], default: 'Pending Approval', index: true },
    transactionReference: { type: String, default: '' },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', default: null },
    approvedAt: { type: Date, default: null },
    note: { type: String, default: '' },
}, { timestamps: true });

procurementOrderSchema.index({ school: 1, type: 1, status: 1, createdAt: -1 });
procurementOrderSchema.index({ school: 1, reference: 1 }, { unique: true });

module.exports = {
    FeePledge: mongoose.model('FeePledge', pledgeSchema),
    ProcurementOrder: mongoose.model('ProcurementOrder', procurementOrderSchema),
};