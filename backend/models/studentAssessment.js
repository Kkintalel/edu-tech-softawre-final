const mongoose = require("mongoose");

const studentAssessmentSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "School",
    required: true
  },

  learnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },

  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true
  },

  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true
  },

  academicYear: String,
  term: String,

  learningArea: String,
  strand: String,
  subStrand: String,
  learningOutcome: String,

  assessmentType: String,
  competencyLevel: {
    type: String,
    enum: ["BE", "AE", "ME", "EE"]
  },

  teacherComment: String,
  marks: Number,
  evidence: String,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("StudentAssessment", studentAssessmentSchema);
