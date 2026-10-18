const mongoose = require('mongoose');

const termTransitionSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    sourceAcademicYear: { type: String, required: true, trim: true },
    sourceTerm: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true, trim: true },
    term: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Activated'], default: 'Activated' },
    studentCount: { type: Number, default: 0 },
    totalNewCharges: { type: Number, default: 0 },
    totalCarriedForward: { type: Number, default: 0 },
    activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    activatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

termTransitionSchema.index({ schoolId: 1, academicYear: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('TermTransition', termTransitionSchema);