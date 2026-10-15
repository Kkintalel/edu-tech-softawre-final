const mongoose = require('mongoose');

const analyticsReportHistorySchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
    reportType: { type: String, required: true, trim: true },
    format: { type: String, enum: ['pdf', 'excel', 'scheduled-snapshot'], default: 'pdf' },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    generatedByName: { type: String, default: '' },
    recordCount: { type: Number, default: 0 },
    generatedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

analyticsReportHistorySchema.index({ school: 1, generatedAt: -1 });

module.exports = mongoose.model('AnalyticsReportHistory', analyticsReportHistorySchema);