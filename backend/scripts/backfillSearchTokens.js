require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/studentSchema');
const Teacher = require('../models/teacherSchema');
const Parent = require('../models/parentSchema');
const Sclass = require('../models/sclassSchema');
const Employee = require('../models/employeeSchema');
const { createSearchTokens } = require('../utils/searchTokens');

const backfill = async (Model, buildFields) => {
    let updated = 0;
    const cursor = Model.find({}).cursor();
    for await (const document of cursor) {
        await Model.updateOne({ _id: document._id }, { $set: buildFields(document) });
        updated += 1;
    }
    return updated;
};

const main = async () => {
    await mongoose.connect(process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/schoolManagementSystem');
    const results = await Promise.all([
        backfill(Student, (doc) => ({
            searchTokens: createSearchTokens(doc.name),
            parentNameSearchTokens: createSearchTokens(doc.parentName),
            parentPhoneSearchTokens: createSearchTokens(String(doc.parentPhone || '').replace(/\D/g, '')),
            parentEmailSearchTokens: createSearchTokens(doc.parentEmail),
            guardianNameSearchTokens: createSearchTokens(doc.guardianName),
            guardianPhoneSearchTokens: createSearchTokens(String(doc.guardianPhone || '').replace(/\D/g, '')),
            guardianEmailSearchTokens: createSearchTokens(doc.guardianEmail),
        })),
        backfill(Teacher, (doc) => ({
            searchTokens: createSearchTokens(doc.name),
            emailSearchTokens: createSearchTokens(doc.email),
            phoneSearchTokens: createSearchTokens(String(doc.phone || '').replace(/\D/g, '')),
            employeeIdSearchTokens: createSearchTokens(doc.employeeId),
        })),
        backfill(Parent, (doc) => ({
            nameSearchTokens: createSearchTokens(doc.name),
            emailSearchTokens: createSearchTokens(doc.email),
            phoneSearchTokens: createSearchTokens(String(doc.phone || '').replace(/\D/g, '')),
        })),
        backfill(Sclass, (doc) => ({ searchTokens: createSearchTokens(doc.sclassName) })),
        backfill(Employee, (doc) => ({
            searchTokens: createSearchTokens(doc.firstName, doc.lastName, `${doc.firstName || ''} ${doc.lastName || ''}`),
            employeeIdSearchTokens: createSearchTokens(doc.employeeId),
        })),
    ]);
    console.log(`Search tokens backfilled: ${results.reduce((sum, count) => sum + count, 0)} records`);
};

main()
    .catch((error) => {
        console.error('Search-token backfill failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => mongoose.disconnect());