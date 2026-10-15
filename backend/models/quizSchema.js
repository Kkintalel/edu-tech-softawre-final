const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
    },
    options: {
        type: [String],
        required: true,
    },
    correctAnswer: {
        type: String,
        required: true,
    },
}, { _id: false });

const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teacher',
        required: true,
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'subject',
        required: true,
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'sclass',
        required: true,
    },
    questions: [questionSchema],
    attempts: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true },
        answers: { type: [String], default: [] },
        score: { type: Number, required: true, min: 0 },
        maxScore: { type: Number, required: true, min: 0 },
        submittedAt: { type: Date, default: Date.now },
    }],
    published: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

quizSchema.index({ school: 1, class: 1, subject: 1, published: 1, createdAt: -1 });
quizSchema.index({ school: 1, 'attempts.student': 1, createdAt: -1 });

module.exports = mongoose.model('quiz', quizSchema);
