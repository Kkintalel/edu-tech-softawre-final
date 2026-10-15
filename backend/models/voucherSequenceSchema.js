const mongoose = require('mongoose');

const voucherSequenceSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: { type: Number, default: 0 },
}, { versionKey: false });

module.exports = mongoose.models.VoucherSequence || mongoose.model('VoucherSequence', voucherSequenceSchema);