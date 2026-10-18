const mongoose = require("mongoose");

const lessonPlanSchema = new mongoose.Schema({
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
  strand: String,
  subStrand: String,
  learningOutcome: String,

  lessonObjective: String,
  teachingMethods: [String],
  activities: [String],
  resources: [String],
  assessmentMethod: String,
  lessonDate: Date,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("LessonPlan", lessonPlanSchema);
