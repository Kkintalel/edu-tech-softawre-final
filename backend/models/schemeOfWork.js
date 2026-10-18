const mongoose = require("mongoose");

const schemeOfWorkSchema = new mongoose.Schema({
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
  week: Number,

  strand: String,
  subStrand: String,
  learningOutcome: String,

  plannedActivities: [String],
  assessmentTask: String,
  completed: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("SchemeOfWork", schemeOfWorkSchema);
