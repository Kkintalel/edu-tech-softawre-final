const mongoose = require('mongoose');

const analyticsTargetSchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true, index: true },
    metric: { type: String, enum: ['academicMean', 'attendanceRate', 'feeCollectionRate', 'assessmentCompletion', 'enrolment'], required: true },
    label: { type: String, required: true, trim: true },
    targetValue: { type: Number, required: true, min: 0 },
    academicYear: { type: String, required: true, trim: true },
    term: { type: String, default: 'Term 1' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'sclass', default: null },
    stream: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    active: { type: Boolean, default: true },
}, { timestamps: true });

analyticsTargetSchema.index({ school: 1, academicYear: 1, term: 1, active: 1 });

module.exports = mongoose.model('AnalyticsTarget', analyticsTargetSchema);