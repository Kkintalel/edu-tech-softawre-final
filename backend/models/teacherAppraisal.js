const mongoose = require("mongoose");

const teacherAppraisalSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "School",
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

  lessonObserved: String,
  strengths: String,
  improvementNeeds: String,
  recommendation: String,

  appraisalDate: Date,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("TeacherAppraisal", teacherAppraisalSchema);
