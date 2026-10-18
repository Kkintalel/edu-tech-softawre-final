const mongoose = require("mongoose");

const schoolAcademicConfigSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "School",
    required: true,
    index: true
  },

  gradingMode: {
    type: String,
    enum: ["traditional", "cbc", "mixed"],
    default: "mixed"
  },

  curriculumPathway: {
    type: String,
    enum: ["pre-primary", "primary", "junior-school"],
    default: "primary"
  },

  cbcEnabled: {
    type: Boolean,
    default: true
  },

  lessonPlanEnabled: {
    type: Boolean,
    default: true
  },

  schemeOfWorkEnabled: {
    type: Boolean,
    default: true
  },

  appraisalEnabled: {
    type: Boolean,
    default: true
  },

  performanceLevels: {
    type: [String],
    default: ["BE", "AE", "ME", "EE"]
  },

  learningAreas: {
    type: [String],
    default: ["Mathematics", "English", "Science"]
  },

  academicYear: String,
  term: String,

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("SchoolAcademicConfig", schoolAcademicConfigSchema);
