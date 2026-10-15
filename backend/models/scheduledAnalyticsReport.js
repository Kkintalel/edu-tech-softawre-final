const mongoose = require('mongoose');

const scheduledAnalyticsReportSchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
    reportType: { type: String, enum: ['overview', 'academics', 'teachers'], required: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    frequency: { type: String, enum: ['weekly', 'monthly'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    createdByEmail: { type: String, required: true, lowercase: true, trim: true },
    nextRunAt: { type: Date, required: true, index: true },
    lastRunAt: { type: Date, default: null },
    enabled: { type: Boolean, default: true },
}, { timestamps: true });

scheduledAnalyticsReportSchema.index({ enabled: 1, nextRunAt: 1 });

module.exports = mongoose.model('ScheduledAnalyticsReport', scheduledAnalyticsReportSchema);