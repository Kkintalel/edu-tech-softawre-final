const mongoose = require("mongoose");
const { createSearchTokens } = require('../utils/searchTokens');

const sclassSchema = new mongoose.Schema({
    sclassName: {
        type: String,
        required: true,
    },
    searchTokens: { type: [String], default: [], select: false },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true
    },
}, { timestamps: true });

sclassSchema.index({ school: 1, sclassName: 1 }, { unique: true });
sclassSchema.pre('validate', function setClassSearchTokens(next) {
    this.searchTokens = createSearchTokens(this.sclassName);
    next();
});
sclassSchema.index({ school: 1, searchTokens: 1 });

module.exports = mongoose.model("sclass", sclassSchema);


