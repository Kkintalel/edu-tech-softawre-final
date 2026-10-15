const mongoose = require('mongoose');

const learningProgressSchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true },
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'learningmaterial', required: true },
    completedAt: { type: Date, default: Date.now },
}, { timestamps: true });

learningProgressSchema.index({ school: 1, student: 1, material: 1 }, { unique: true });
learningProgressSchema.index({ school: 1, student: 1, completedAt: -1 });

module.exports = mongoose.model('LearningProgress', learningProgressSchema);