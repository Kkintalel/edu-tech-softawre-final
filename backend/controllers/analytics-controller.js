const mongoose = require('mongoose');
const Admin = require('../models/adminSchema');
const Student = require('../models/studentSchema');
const Sclass = require('../models/sclassSchema');
const Subject = require('../models/subjectSchema');
const Teacher = require('../models/teacherSchema');
const School = require('../models/schoolSchema');
const Assignment = require('../models/assignmentSchema');
const Attendance = require('../models/attendanceSchema');
const Employee = require('../models/employeeSchema');
const AcademicYear = require('../models/academicYearSchema');
const { Account, AccountingPeriod, Budget, GeneralLedger } = require('../models/accountingSchema');
const AuditLogs = require('../models/auditLogsSchema');
const AnalyticsReportHistory = require('../models/analyticsReportHistory');
const AnalyticsTarget = require('../models/analyticsTarget');
const ScheduledAnalyticsReport = require('../models/scheduledAnalyticsReport');
const { getRequestUser } = require('../middleware/schoolAccess');
const { buildAnalyticsCacheKey, getCachedAnalytics } = require('../utils/analyticsCache');
const { sendEmail } = require('../services/emailService');

const isValidId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));
const toObjectId = (value) => isValidId(value) ? new mongoose.Types.ObjectId(String(value)) : null;
const allFilter = (value) => !value || value === 'all' || value === 'All' || value === 'All Classes' || value === 'All Streams';
const normalizeTerm = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeExam = (value) => String(value || '').trim().toUpperCase().replace(/[-\s]+/g, '_');

const getAnalyticsScope = async (req, res, domain, allowPlatformOverview = false) => {
    const identity = await getRequestUser(req);
    if (!identity) {
        res.status(401).json({ message: 'Authenticated analytics access is required' });
        return null;
    }
    if (identity.type !== 'admin') {
        res.status(403).json({ message: 'This analytics view is not available to this account' });
        return null;
    }

    const user = identity.user;
    const roles = new Set([user.role, ...(user.roles || [])]);
    const superAdmin = roles.has('SuperAdmin');
    const requestedSchool = req.query.schoolId || req.params.schoolId || '';
    const roleAccess = {
        academic: ['Admin', 'SuperAdmin', 'HR'],
        staff: ['Admin', 'SuperAdmin', 'HR'],
        finance: ['Admin', 'SuperAdmin', 'Accountant', 'Auditor'],
        overview: ['Admin', 'SuperAdmin', 'HR', 'Accountant', 'Auditor'],
        reports: ['Admin', 'SuperAdmin', 'HR', 'Accountant', 'Auditor'],
    }[domain] || ['Admin', 'SuperAdmin'];
    if (![...roles].some((role) => roleAccess.includes(role))) {
        res.status(403).json({ message: 'Your role is not authorised for this analytics view' });
        return null;
    }
    if (domain === 'academic' && user.role === 'Accountant' && user.permissions?.generateReports !== true) {
        res.status(403).json({ message: 'Academic analytics permission is required' });
        return null;
    }
    if (domain === 'finance' && ['Accountant', 'Auditor'].includes(user.role) && user.permissions?.generateFinancialReports === false) {
        res.status(403).json({ message: 'Financial reporting permission is required' });
        return null;
    }

    if (superAdmin && !requestedSchool && allowPlatformOverview) {
        return { identity, user, role: user.role, schoolId: null, accountingSchoolId: null, platformOverview: true };
    }
    if (superAdmin && !requestedSchool) {
        res.status(400).json({ message: 'Select a school to view this analytics dataset' });
        return null;
    }

    let schoolAdminId = identity.schoolId || user._id;
    let schoolRecord = null;
    if (superAdmin && requestedSchool) {
        const requestedId = toObjectId(requestedSchool);
        if (!requestedId) {
            res.status(400).json({ message: 'A valid schoolId is required' });
            return null;
        }
        schoolRecord = await School.findOne({ $or: [{ _id: requestedId }, { schoolAdmin: requestedId }] }).select('_id schoolAdmin schoolName');
        schoolAdminId = schoolRecord?.schoolAdmin || requestedId;
    } else if (requestedSchool && String(requestedSchool) !== String(schoolAdminId)) {
        res.status(403).json({ message: 'You can only access analytics for your own school' });
        return null;
    }

    if (!schoolAdminId || !isValidId(schoolAdminId)) {
        res.status(400).json({ message: 'A valid school context is required' });
        return null;
    }
    if (!schoolRecord) {
        schoolRecord = await School.findOne({ schoolAdmin: schoolAdminId }).select('_id schoolAdmin schoolName');
    }

    return {
        identity,
        user,
        role: user.role,
        schoolId: toObjectId(schoolAdminId),
        accountingSchoolId: schoolRecord?._id || toObjectId(schoolAdminId),
        schoolName: schoolRecord?.schoolName || '',
        platformOverview: false,
    };
};

const parseAnalyticsFilters = (query = {}) => ({
    academicYear: String(query.academicYear || new Date().getFullYear()).trim(),
    term: query.term || 'Term 1',
    assessment: normalizeExam(query.assessment || query.examType || 'END_TERM'),
    classId: allFilter(query.classId) ? '' : query.classId,
    stream: allFilter(query.stream) ? '' : query.stream,
    subjectId: allFilter(query.subjectId) ? '' : query.subjectId,
    studentId: allFilter(query.studentId) ? '' : query.studentId,
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    pageSize: Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 25)),
});

const cacheFor = (scope, routeKey, filters, load) => {
    const key = buildAnalyticsCacheKey(scope.schoolId || 'platform', { routeKey, ...filters });
    return getCachedAnalytics(key, load, 20000);
};

const studentMatch = (scope, filters = {}) => {
    const match = { school: scope.schoolId };
    if (filters.classId && isValidId(filters.classId)) match.sclassName = toObjectId(filters.classId);
    if (filters.stream) match.stream = filters.stream;
    if (filters.studentId && isValidId(filters.studentId)) match._id = toObjectId(filters.studentId);
    return match;
};

const markPipeline = (scope, filters = {}, dimensions = {}) => {
    const pipeline = [
        { $match: studentMatch(scope, { ...filters, ...(dimensions.ignoreStudent ? { studentId: '' } : {}) }) },
        { $unwind: '$examResult' },
        {
            $match: {
                'examResult.marksObtained': { $type: 'number', $gte: 0, $lte: 100 },
                ...(filters.subjectId && isValidId(filters.subjectId) ? { 'examResult.subName': toObjectId(filters.subjectId) } : {}),
                ...(dimensions.includeTerm === false ? {} : { 'examResult.term': filters.term }),
                ...(dimensions.includeAssessment === false || filters.assessment === 'ALL' ? {} : { 'examResult.examType': filters.assessment }),
                $expr: {
                    $eq: [
                        { $toString: { $ifNull: ['$examResult.academicYear', { $year: '$createdAt' }] } },
                        filters.academicYear,
                    ],
                },
            },
        },
        {
            $lookup: {
                from: Subject.collection.name,
                localField: 'examResult.subName',
                foreignField: '_id',
                as: 'matchedSubject',
            },
        },
        { $unwind: { path: '$matchedSubject', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                studentId: '$_id',
                classId: '$sclassName',
                stream: { $ifNull: ['$stream', '$streamName'] },
                subjectId: '$examResult.subName',
                subject: '$matchedSubject.subName',
                marks: '$examResult.marksObtained',
                points: { $ifNull: ['$examResult.points', 0] },
                grade: {
                    $cond: [
                        { $ne: [{ $ifNull: ['$examResult.grade', ''] }, ''] },
                        '$examResult.grade',
                        { $switch: {
                            branches: [
                                { case: { $gte: ['$examResult.marksObtained', 90] }, then: 'EE1' },
                                { case: { $gte: ['$examResult.marksObtained', 75] }, then: 'EE2' },
                                { case: { $gte: ['$examResult.marksObtained', 58] }, then: 'ME1' },
                                { case: { $gte: ['$examResult.marksObtained', 41] }, then: 'ME2' },
                                { case: { $gte: ['$examResult.marksObtained', 31] }, then: 'AE1' },
                                { case: { $gte: ['$examResult.marksObtained', 21] }, then: 'AE2' },
                                { case: { $gte: ['$examResult.marksObtained', 11] }, then: 'BE1' },
                            ],
                            default: 'BE2',
                        } },
                    ],
                },
                term: '$examResult.term',
                assessment: '$examResult.examType',
            },
        },
    ];
    if (dimensions.classId) pipeline.unshift({ $match: { sclassName: toObjectId(dimensions.classId) } });
    return pipeline;
};

const studentSummaryPipeline = (scope, filters, dimensions = {}) => [
    ...markPipeline(scope, filters, dimensions),
    {
        $group: {
            _id: { studentId: '$studentId', classId: '$classId', stream: '$stream' },
            totalMarks: { $sum: '$marks' },
            meanScore: { $avg: '$marks' },
            totalPoints: { $sum: '$points' },
            validMarks: { $sum: 1 },
            scores: { $push: { subjectId: '$subjectId', subject: '$subject', marks: '$marks', grade: '$grade', points: '$points' } },
        },
    },
    { $project: { _id: 0, studentId: '$_id.studentId', classId: '$_id.classId', stream: '$_id.stream', totalMarks: 1, meanScore: 1, totalPoints: 1, validMarks: 1, scores: 1 } },
];

const makeTermDateRange = async (academicYear, term) => {
    const calendar = await AcademicYear.findOne({ yearName: String(academicYear) }).select('startDate endDate terms').lean();
    if (!calendar) {
        const year = Number(academicYear);
        if (!Number.isInteger(year)) return null;
        return { startDate: new Date(year, 0, 1), endDate: new Date(year + 1, 0, 1) };
    }
    const normalized = normalizeTerm(term);
    const period = (calendar.terms || []).find((item) => normalizeTerm(item.termName) === normalized);
    return period?.startDate && period?.endDate
        ? { startDate: new Date(period.startDate), endDate: new Date(new Date(period.endDate).getTime() + 86400000) }
        : { startDate: new Date(calendar.startDate), endDate: new Date(new Date(calendar.endDate).getTime() + 86400000) };
};

const getAcademicSnapshot = async (scope, filters) => {
    const baseFilters = { ...filters, studentId: '' };
    const [peerRows, comparisonRows, classRows, subjectRows, schoolClasses, schoolSubjects] = await Promise.all([
        Student.aggregate(studentSummaryPipeline(scope, baseFilters)),
        Student.aggregate([
            ...markPipeline(scope, baseFilters, { includeTerm: false, includeAssessment: false }),
            { $group: { _id: { term: '$term', assessment: '$assessment' }, totalMarks: { $sum: '$marks' }, count: { $sum: 1 } } },
            { $project: { _id: 0, term: '$_id.term', assessment: '$_id.assessment', meanScore: { $divide: ['$totalMarks', '$count'] }, count: 1 } },
        ]),
        Student.aggregate([
            ...studentSummaryPipeline(scope, baseFilters),
            { $group: { _id: { classId: '$classId', stream: '$stream' }, meanTotal: { $avg: '$meanScore' }, studentCount: { $sum: 1 }, totalPoints: { $sum: '$totalPoints' } } },
            { $project: { _id: 0, classId: '$_id.classId', stream: '$_id.stream', meanScore: '$meanTotal', studentCount: 1, totalPoints: 1 } },
        ]),
        Student.aggregate([
            ...markPipeline(scope, baseFilters),
            { $group: { _id: { classId: '$classId', stream: '$stream', subjectId: '$subjectId', subject: '$subject' }, meanScore: { $avg: '$marks' }, assessedCount: { $sum: 1 }, gradeCounts: { $push: '$grade' } } },
            { $project: { _id: 0, classId: '$_id.classId', stream: '$_id.stream', subjectId: '$_id.subjectId', subject: '$_id.subject', meanScore: 1, assessedCount: 1, gradeCounts: 1 } },
        ]),
        Sclass.find({ school: scope.schoolId }).select('_id sclassName').lean(),
        Subject.find({ school: scope.schoolId }).select('_id subName sclassName').lean(),
    ]);
    const studentRows = filters.studentId
        ? peerRows.filter((row) => String(row.studentId) === String(filters.studentId))
        : peerRows;

    const rosterCounts = await Student.aggregate([
        { $match: studentMatch(scope, baseFilters) },
        { $group: { _id: { classId: '$sclassName', stream: { $ifNull: ['$stream', '$streamName'] } }, students: { $sum: 1 } } },
    ]);
    const rosterMap = new Map(rosterCounts.map((item) => [`${item._id.classId}:${item._id.stream || ''}`, item.students]));
    const subjectCountByClass = new Map();
    schoolSubjects.forEach((subject) => {
        const classId = String(subject.sclassName || '');
        subjectCountByClass.set(classId, (subjectCountByClass.get(classId) || 0) + 1);
    });
    const expectedMarks = rosterCounts.reduce((total, roster) => {
        const subjectCount = filters.subjectId ? 1 : (subjectCountByClass.get(String(roster._id.classId)) || 0);
        return total + roster.students * subjectCount;
    }, 0);
    const submittedMarks = await Student.aggregate([
        ...markPipeline(scope, baseFilters),
        { $group: { _id: { studentId: '$studentId', subjectId: '$subjectId' } } },
        { $count: 'count' },
    ]);
    const submittedCount = submittedMarks[0]?.count || 0;
    const gradeMap = new Map();
    subjectRows.forEach((row) => (row.gradeCounts || []).forEach((grade) => gradeMap.set(grade, (gradeMap.get(grade) || 0) + 1)));
    const gradeDistribution = [...gradeMap.entries()].map(([grade, count]) => ({ grade, count })).sort((a, b) => a.grade.localeCompare(b.grade));
    const means = peerRows.map((row) => Number(row.meanScore)).filter(Number.isFinite);
    const schoolMean = means.length ? means.reduce((total, score) => total + score, 0) / means.length : 0;
    const pagedRows = filters.studentId ? studentRows : studentRows.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize);
    const pagedIds = pagedRows.map((row) => row.studentId).filter(Boolean);
    const profiles = pagedIds.length ? await Student.find({ _id: { $in: pagedIds } }).select('name admissionNo rollNum') : [];
    const profileMap = new Map(profiles.map((profile) => [String(profile._id), {
        name: profile.name,
        admissionNo: profile.admissionNo,
        rollNum: profile.rollNum,
    }]));
    const studentRowsWithNames = pagedRows.map((row) => ({
        ...row,
        ...profileMap.get(String(row.studentId)),
        className: schoolClasses.find((item) => String(item._id) === String(row.classId))?.sclassName || 'N/A',
    })).sort((a, b) => Number(b.meanScore) - Number(a.meanScore));

    return {
        summary: {
            meanScore: schoolMean,
            assessedStudents: peerRows.length,
            validMarks: peerRows.reduce((total, row) => total + row.validMarks, 0),
            totalPoints: peerRows.reduce((total, row) => total + row.totalPoints, 0),
            assessmentCompletion: expectedMarks ? (submittedCount / expectedMarks) * 100 : 0,
            requiredMarks: expectedMarks,
            submittedMarks: submittedCount,
        },
        students: studentRowsWithNames.map((student, index) => ({
            ...student,
            schoolRank: 1 + peerRows.filter((peer) => peer.meanScore > student.meanScore).length,
            classRank: 1 + peerRows.filter((peer) => String(peer.classId) === String(student.classId) && peer.meanScore > student.meanScore).length,
            streamRank: student.stream ? 1 + peerRows.filter((peer) => String(peer.classId) === String(student.classId) && peer.stream === student.stream && peer.meanScore > student.meanScore).length : null,
        })),
        totalStudentRows: studentRows.length,
        page: filters.page,
        pageSize: filters.pageSize,
        gradeDistribution,
        classResults: classRows.map((row) => ({
            classId: String(row.classId || ''),
            className: schoolClasses.find((item) => String(item._id) === String(row.classId))?.sclassName || 'N/A',
            stream: row.stream || '',
            averageMarks: row.meanScore,
            studentCount: row.studentCount,
            totalPoints: row.totalPoints,
        })).sort((a, b) => b.averageMarks - a.averageMarks),
        subjectResults: subjectRows.map((row) => ({
            classId: String(row.classId || ''),
            className: schoolClasses.find((item) => String(item._id) === String(row.classId))?.sclassName || 'N/A',
            stream: row.stream || '',
            subjectId: String(row.subjectId || ''),
            subject: row.subject || 'Unknown',
            averageMarks: row.meanScore,
            assessedCount: row.assessedCount,
            expectedStudents: rosterMap.get(`${row.classId}:${row.stream || ''}`) || 0,
        })).sort((a, b) => b.averageMarks - a.averageMarks),
        comparisons: comparisonRows.sort((a, b) => String(a.term).localeCompare(String(b.term)) || String(a.assessment).localeCompare(String(b.assessment))),
        filterOptions: {
            classes: schoolClasses.map((item) => ({ id: String(item._id), name: item.sclassName })),
            streams: [...new Set(rosterCounts.map((item) => item._id.stream).filter(Boolean))].sort(),
            subjects: schoolSubjects.map((item) => ({ id: String(item._id), name: item.subName, classId: String(item.sclassName) })),
        },
    };
};

const academicAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'academic');
    if (!scope) return;
    const filters = parseAnalyticsFilters(req.query);
    try {
        const data = await cacheFor(scope, 'academics', filters, () => getAcademicSnapshot(scope, filters));
        const academicYear = await AcademicYear.findOne({ yearName: filters.academicYear }).select('terms').lean();
        const term = (academicYear?.terms || []).find((entry) => normalizeTerm(entry.termName) === normalizeTerm(filters.term));
        const comparison = ['Term 1', 'Term 2', 'Term 3'].map((termName) => ({
            term: termName,
            CAT: data.comparisons.find((entry) => normalizeTerm(entry.term) === normalizeTerm(termName) && normalizeExam(entry.assessment) === 'CAT')?.meanScore ?? null,
            END_TERM: data.comparisons.find((entry) => normalizeTerm(entry.term) === normalizeTerm(termName) && normalizeExam(entry.assessment) === 'END_TERM')?.meanScore ?? null,
        }));
        return res.json({ ...data, comparison, academicYear: filters.academicYear, term: filters.term, termDates: term ? { startDate: term.startDate, endDate: term.endDate } : null });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate academic analytics' });
    }
};

const subjectAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'academic');
    if (!scope) return;
    try {
        const filters = parseAnalyticsFilters(req.query);
        const data = await cacheFor(scope, 'subjects', filters, async () => {
            const snapshot = await getAcademicSnapshot(scope, { ...filters, page: 1, pageSize: 1 });
            const values = snapshot.subjectResults;
            return {
                subjectResults: values,
                highestAverage: values[0] || null,
                lowestAverage: values.length ? values[values.length - 1] : null,
            };
        });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate subject analytics' });
    }
};

const classAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'academic');
    if (!scope) return;
    try {
        const filters = parseAnalyticsFilters(req.query);
        const data = await cacheFor(scope, 'classes', filters, async () => {
            const snapshot = await getAcademicSnapshot(scope, { ...filters, page: 1, pageSize: 1 });
            return { classResults: snapshot.classResults, streamResults: snapshot.classResults.filter((item) => item.stream) };
        });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate class analytics' });
    }
};

const studentAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'academic');
    if (!scope) return;
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'A valid student id is required' });
    try {
        const filters = { ...parseAnalyticsFilters(req.query), studentId: req.params.id, page: 1, pageSize: 1 };
        const snapshot = await getAcademicSnapshot(scope, filters);
        const student = snapshot.students[0];
        if (!student) return res.status(404).json({ message: 'No marks found for this student and period' });
        const record = await Student.findOne({ _id: req.params.id, school: scope.schoolId }).select('classTeacherRemarks principalRemarks reportCardStatus').lean();
        return res.json({
            student,
            summary: snapshot.summary,
            comments: {
                teacher: record?.classTeacherRemarks || '',
                principal: record?.principalRemarks || '',
            },
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate student analytics' });
    }
};

const feeAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'finance');
    if (!scope) return;
    const filters = parseAnalyticsFilters(req.query);
    try {
        const result = await cacheFor(scope, 'fees', filters, async () => {
            const [feeRows, classRows] = await Promise.all([
                Student.aggregate([
                    { $match: studentMatch(scope, filters) },
                    { $unwind: '$paymentHistory' },
                    {
                        $match: {
                            'paymentHistory.status': { $in: ['Verified', 'Completed'] },
                            $expr: { $eq: [{ $toString: { $ifNull: ['$paymentHistory.academicYear', { $year: '$paymentHistory.date' }] } }, filters.academicYear] },
                            ...(filters.term ? { 'paymentHistory.term': filters.term } : {}),
                        },
                    },
                    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paymentHistory.date' } }, collections: { $sum: '$paymentHistory.amount' }, verifiedCount: { $sum: 1 } } },
                    { $sort: { _id: 1 } },
                ]),
                Student.aggregate([
                    { $match: studentMatch(scope, filters) },
                    { $group: { _id: '$sclassName', studentCount: { $sum: 1 }, outstandingBalance: { $sum: { $max: ['$balance', 0] } }, currentCharges: { $sum: '$totalFees' } } },
                ]),
            ]);
            const expectedRows = await Student.aggregate([
                { $match: studentMatch(scope, filters) },
                { $unwind: '$feeAssessments' },
                { $match: { 'feeAssessments.academicYear': filters.academicYear, 'feeAssessments.term': filters.term } },
                { $group: { _id: null, expectedFees: { $sum: '$feeAssessments.amount' } } },
            ]);
            const collected = feeRows.reduce((sum, row) => sum + Number(row.collections || 0), 0);
            const expectedFees = expectedRows[0]?.expectedFees || 0;
            const classes = await Sclass.find({ school: scope.schoolId }).select('_id sclassName').lean();
            return {
                collectionsByMonth: feeRows.map((row) => ({ month: row._id, collections: row.collections, verifiedCount: row.verifiedCount })),
                balanceByClass: classRows.map((row) => ({ classId: String(row._id), className: classes.find((item) => String(item._id) === String(row._id))?.sclassName || 'N/A', outstandingBalance: row.outstandingBalance, studentCount: row.studentCount })),
                summary: {
                    expectedFees,
                    verifiedCollections: collected,
                    collectionRate: expectedFees ? (collected / expectedFees) * 100 : null,
                    outstandingFees: classRows.reduce((sum, row) => sum + Number(row.outstandingBalance || 0), 0),
                    expectedFeeSource: expectedFees ? 'feeAssessments' : 'No matching fee assessments recorded',
                },
            };
        });
        return res.json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate fee analytics' });
    }
};

const attendanceAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'overview');
    if (!scope) return;
    const filters = parseAnalyticsFilters(req.query);
    try {
        const result = await cacheFor(scope, 'attendance', filters, async () => {
            const range = await makeTermDateRange(filters.academicYear, filters.term);
            const studentMatchQuery = studentMatch(scope, filters);
            const [studentRows, staffRows, expectedStudents] = await Promise.all([
                Student.aggregate([
                    { $match: studentMatchQuery },
                    { $unwind: { path: '$attendance', preserveNullAndEmptyArrays: false } },
                    ...(range ? [{ $match: { 'attendance.date': { $gte: range.startDate, $lt: range.endDate } } }] : []),
                    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$attendance.date' } }, sessions: { $sum: 1 }, attended: { $sum: { $cond: [{ $in: ['$attendance.status', ['Present', 'Late', 'Half Day']] }, 1, 0] } } } },
                    { $sort: { _id: 1 } },
                ]),
                Attendance.aggregate([
                    { $match: { schoolId: scope.accountingSchoolId, date: { $gte: range.startDate, $lt: range.endDate } } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, sessions: { $sum: 1 }, attended: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late', 'Half Day']] }, 1, 0] } } } },
                    { $sort: { _id: 1 } },
                ]),
                Student.countDocuments(studentMatchQuery),
            ]);
            const studentSessions = studentRows.reduce((sum, row) => sum + row.sessions, 0);
            const studentAttended = studentRows.reduce((sum, row) => sum + row.attended, 0);
            const roster = await Student.find(studentMatchQuery).select('_id attendance').lean();
            const studentsWithRecords = new Set();
            roster.forEach((student) => {
                if ((student.attendance || []).some((record) => new Date(record.date) >= range.startDate && new Date(record.date) < range.endDate)) studentsWithRecords.add(String(student._id));
            });
            return {
                studentTrend: studentRows.map((row) => ({ month: row._id, sessions: row.sessions, attended: row.attended, rate: row.sessions ? (row.attended / row.sessions) * 100 : null })),
                staffTrend: staffRows.map((row) => ({ month: row._id, sessions: row.sessions, attended: row.attended, rate: row.sessions ? (row.attended / row.sessions) * 100 : null })),
                summary: {
                    studentSessions,
                    studentAttended,
                    studentAttendanceRate: studentSessions ? (studentAttended / studentSessions) * 100 : null,
                    staffSessions: staffRows.reduce((sum, row) => sum + row.sessions, 0),
                    studentsMissingRecords: Math.max(0, expectedStudents - studentsWithRecords.size),
                    expectedStudents,
                },
            };
        });
        return res.json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate attendance analytics' });
    }
};

const enrolmentAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'academic');
    if (!scope) return;
    const filters = parseAnalyticsFilters(req.query);
    try {
        const range = await makeTermDateRange(filters.academicYear, filters.term);
        const [trend, total] = await Promise.all([
            Student.aggregate([
                { $match: { ...studentMatch(scope, filters), createdAt: { $gte: range.startDate, $lt: range.endDate } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, enrolments: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
            Student.countDocuments(studentMatch(scope, filters)),
        ]);
        return res.json({ recordedEnrolmentsByMonth: trend.map((row) => ({ month: row._id, count: row.enrolments })), currentPopulation: total, dateBasis: 'student record createdAt' });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate enrolment analytics' });
    }
};

const reconciliationAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'finance');
    if (!scope) return;
    const filters = parseAnalyticsFilters(req.query);
    try {
        const rows = await Student.aggregate([
            { $match: studentMatch(scope, filters) },
            { $unwind: { path: '$paymentHistory', includeArrayIndex: 'paymentIndex' } },
            { $match: { $expr: { $eq: [{ $toString: { $ifNull: ['$paymentHistory.academicYear', { $year: '$paymentHistory.date' }] } }, filters.academicYear] }, ...(filters.term ? { 'paymentHistory.term': filters.term } : {}) } },
            { $project: {
                transactionId: '$paymentHistory.transactionId',
                receiptNumber: '$paymentHistory.receiptNumber',
                reference: { $ifNull: ['$paymentHistory.reference', '$paymentHistory.paymentReference'] },
                amount: '$paymentHistory.amount',
                paymentMethod: '$paymentHistory.paymentMethod',
                status: '$paymentHistory.status',
                date: '$paymentHistory.date',
                studentId: '$_id',
                paymentIndex: 1,
            } },
            { $sort: { date: -1 } },
        ]);
        const summary = { matched: 0, unmatched: 0, pending: 0, totalAmount: 0 };
        rows.forEach((payment) => {
            const hasReference = Boolean(payment.transactionId || payment.reference || payment.receiptNumber);
            if (['Pending'].includes(payment.status)) summary.pending += 1;
            else if (['Verified', 'Completed'].includes(payment.status) && hasReference) summary.matched += 1;
            else summary.unmatched += 1;
            if (['Verified', 'Completed'].includes(payment.status)) summary.totalAmount += Number(payment.amount || 0);
        });
        return res.json({ summary, transactions: ['Accountant', 'Admin', 'SuperAdmin'].includes(scope.role) ? rows.slice(0, 100) : [] });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate reconciliation analytics' });
    }
};

const teacherAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'staff');
    if (!scope) return;
    const filters = parseAnalyticsFilters(req.query);
    try {
        const data = await cacheFor(scope, 'teachers', filters, async () => {
            const [teachers, schoolSubjects, assignments, students] = await Promise.all([
                Teacher.find({ school: scope.schoolId }).select('name email teachSubject teachSubjects teachSclass teachSclasses attendance role').populate('teachSubject', 'subName sclassName').populate('teachSubjects', 'subName sclassName').populate('teachSclass', 'sclassName').populate('teachSclasses', 'sclassName'),
                Subject.find({ school: scope.schoolId }).select('_id subName sclassName teacher').lean(),
                Assignment.find({ school: scope.schoolId, status: 'Open' }).select('title teacher subject class dueDate submissions createdAt').populate('subject', 'subName').populate('class', 'sclassName').lean(),
                Student.aggregate([{ $match: studentMatch(scope, filters) }, { $group: { _id: '$sclassName', count: { $sum: 1 } } }]),
            ]);
            const classCounts = new Map(students.map((row) => [String(row._id), row.count]));
            const assignmentByTeacher = new Map();
            assignments.forEach((assignment) => {
                const key = String(assignment.teacher);
                if (!assignmentByTeacher.has(key)) assignmentByTeacher.set(key, []);
                const expected = classCounts.get(String(assignment.class?._id || assignment.class)) || 0;
                assignmentByTeacher.get(key).push({
                    id: String(assignment._id),
                    title: assignment.title,
                    subject: assignment.subject?.subName || 'N/A',
                    className: assignment.class?.sclassName || 'N/A',
                    dueDate: assignment.dueDate,
                    submissions: assignment.submissions?.length || 0,
                    expectedSubmissions: expected,
                    completionRate: expected ? ((assignment.submissions?.length || 0) / expected) * 100 : null,
                    overdue: Boolean(assignment.dueDate && new Date(assignment.dueDate) < new Date()),
                });
            });
            const [markRows, staffCounts] = await Promise.all([
                Student.aggregate([
                    ...markPipeline(scope, filters),
                    { $group: { _id: { subjectId: '$subjectId', classId: '$classId', assessment: '$assessment' }, submittedMarks: { $sum: 1 } } },
                ]),
                Attendance.aggregate([
                    { $match: { schoolId: scope.accountingSchoolId } },
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                ]),
            ]);
            const teachersData = teachers.map((teacher) => {
                const subjectIds = [...new Set([teacher.teachSubject, ...(teacher.teachSubjects || [])].filter(Boolean).map((subject) => String(subject._id || subject)))];
                const classIds = [...new Set([teacher.teachSclass, ...(teacher.teachSclasses || [])].filter(Boolean).map((item) => String(item._id || item)))];
                const subjects = schoolSubjects.filter((subject) => subjectIds.includes(String(subject._id)) || String(subject.teacher) === String(teacher._id));
                const assignedClassIds = [...new Set([...classIds, ...subjects.map((subject) => String(subject.sclassName))])];
                const completion = subjects.map((subject) => {
                    const expected = classCounts.get(String(subject.sclassName)) || 0;
                    const submitted = markRows.find((row) => String(row._id.subjectId) === String(subject._id) && normalizeExam(row._id.assessment) === filters.assessment)?.submittedMarks || 0;
                    return { subject: subject.subName, subjectId: String(subject._id), classId: String(subject.sclassName), expectedMarks: expected, submittedMarks: submitted, completionRate: expected ? (submitted / expected) * 100 : 0 };
                });
                const attendanceRows = teacher.attendance || [];
                const attendanceSessions = attendanceRows.length;
                const attendancePresent = attendanceRows.reduce((sum, row) => sum + (Number(row.presentCount) || 0), 0);
                const name = teacher.name || 'Teacher';
                return {
                    id: String(teacher._id),
                    name,
                    classes: assignedClassIds.map((id) => ({ id, name: teacher.teachSclasses?.find((item) => String(item._id) === id)?.sclassName || teacher.teachSclass?.sclassName || '' })),
                    subjects: subjects.map((subject) => ({ id: String(subject._id), name: subject.subName, classId: String(subject.sclassName) })),
                    teachingLoad: { classes: assignedClassIds.length, subjects: subjects.length },
                    marksEntry: completion,
                    assignmentProgress: assignmentByTeacher.get(String(teacher._id)) || [],
                    teacherAttendance: { sessions: attendanceSessions, present: attendancePresent, rate: attendanceSessions ? (attendancePresent / attendanceSessions) * 100 : null },
                };
            });
            return {
                teachers: teachersData,
                classTeachingLoad: [...new Set(teachersData.flatMap((teacher) => teacher.classes.map((item) => item.id)))].map((classId) => ({ classId, assignedTeachers: teachersData.filter((teacher) => teacher.classes.some((item) => item.id === classId)).length, subjects: [...new Set(teachersData.flatMap((teacher) => teacher.subjects.filter((subject) => subject.classId === classId).map((subject) => subject.name)))] })),
                staffAttendance: staffCounts,
                summary: { teacherCount: teachersData.length, overdueAssignments: teachersData.reduce((sum, teacher) => sum + teacher.assignmentProgress.filter((assignment) => assignment.overdue).length, 0), incompleteMarkSubjects: teachersData.reduce((sum, teacher) => sum + teacher.marksEntry.filter((item) => item.completionRate < 100).length, 0) },
            };
        });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate teacher analytics' });
    }
};

const managementOverview = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'overview', true);
    if (!scope) return;
    if (scope.platformOverview) {
        try {
            const [schools, students, teachers] = await Promise.all([
                School.find({}).select('_id schoolAdmin schoolName status').lean(),
                Student.aggregate([{ $group: { _id: '$school', count: { $sum: 1 } } }]),
                Teacher.aggregate([{ $group: { _id: '$school', count: { $sum: 1 } } }]),
            ]);
            return res.json({ platform: true, schools: schools.map((school) => ({
                schoolId: String(school.schoolAdmin),
                name: school.schoolName,
                status: school.status,
                students: students.find((row) => String(row._id) === String(school.schoolAdmin))?.count || 0,
                teachers: teachers.find((row) => String(row._id) === String(school.schoolAdmin))?.count || 0,
            })) });
        } catch (error) {
            return res.status(500).json({ message: error.message || 'Failed to load platform overview' });
        }
    }
    const filters = parseAnalyticsFilters(req.query);
    try {
        const [academic, fees, attendance, enrolment, teachers] = await Promise.all([
            getAcademicSnapshot(scope, filters),
            getFinanceSummary(scope, filters),
            getAttendanceSummary(scope, filters),
            getEnrolmentSummary(scope, filters),
            Teacher.countDocuments({ school: scope.schoolId }),
        ]);
        const alerts = [];
        if (academic.summary.requiredMarks > academic.summary.submittedMarks) alerts.push({ type: 'academic', severity: 'warning', count: academic.summary.requiredMarks - academic.summary.submittedMarks, message: 'Required marks are missing' });
        if (attendance.summary.studentsMissingRecords > 0) alerts.push({ type: 'attendance', severity: 'warning', count: attendance.summary.studentsMissingRecords, message: 'Students have no attendance records in the selected period' });
        if (fees.summary.outstandingFees > 0) alerts.push({ type: 'finance', severity: 'info', amount: fees.summary.outstandingFees, message: 'Verified outstanding fee balance' });
        return res.json({
            school: { id: String(scope.schoolId), name: scope.schoolName },
            filters,
            academic: academic.summary,
            finance: fees.summary,
            attendance: attendance.summary,
            enrolment: enrolment.summary,
            staff: { teacherCount: teachers },
            alerts,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load management overview' });
    }
};

const getFinanceSummary = async (scope, filters) => {
    const [students, expectedRows, paymentRows] = await Promise.all([
        Student.aggregate([{ $match: studentMatch(scope, filters) }, { $group: { _id: null, outstanding: { $sum: { $max: ['$balance', 0] } }, charges: { $sum: '$totalFees' } } }]),
        Student.aggregate([{ $match: studentMatch(scope, filters) }, { $unwind: '$feeAssessments' }, { $match: { 'feeAssessments.academicYear': filters.academicYear, 'feeAssessments.term': filters.term } }, { $group: { _id: null, expected: { $sum: '$feeAssessments.amount' } } }]),
        Student.aggregate([{ $match: studentMatch(scope, filters) }, { $unwind: '$paymentHistory' }, { $match: { 'paymentHistory.status': { $in: ['Verified', 'Completed'] }, 'paymentHistory.academicYear': filters.academicYear, 'paymentHistory.term': filters.term } }, { $group: { _id: null, collected: { $sum: '$paymentHistory.amount' } } }]),
    ]);
    const expected = expectedRows[0]?.expected || 0;
    const collected = paymentRows[0]?.collected || 0;
    return { summary: { expectedFees: expected, verifiedCollections: collected, collectionRate: expected ? (collected / expected) * 100 : null, outstandingFees: students[0]?.outstanding || 0 } };
};

const getAttendanceSummary = async (scope, filters) => {
    const range = await makeTermDateRange(filters.academicYear, filters.term);
    const [rows, missingCount, totalStudents] = await Promise.all([
        Student.aggregate([{ $match: studentMatch(scope, filters) }, { $unwind: '$attendance' }, { $match: { 'attendance.date': { $gte: range.startDate, $lt: range.endDate } } }, { $group: { _id: null, expected: { $sum: 1 }, attended: { $sum: { $cond: [{ $in: ['$attendance.status', ['Present', 'Late', 'Half Day']] }, 1, 0] } } } }]),
        Student.aggregate([{ $match: studentMatch(scope, filters) }, { $project: { hasAttendance: { $gt: [{ $size: { $filter: { input: '$attendance', as: 'record', cond: { $and: [{ $gte: ['$$record.date', range.startDate] }, { $lt: ['$$record.date', range.endDate] }] } } } }, 0] } } }, { $match: { hasAttendance: false } }, { $count: 'count' }]),
        Student.countDocuments(studentMatch(scope, filters)),
    ]);
    const expected = rows[0]?.expected || 0;
    const attended = rows[0]?.attended || 0;
    return { summary: { expectedSessions: expected, attendedSessions: attended, attendanceRate: expected ? (attended / expected) * 100 : null, studentsMissingRecords: missingCount[0]?.count || 0, totalStudents } };
};

const getEnrolmentSummary = async (scope, filters) => {
    const range = await makeTermDateRange(filters.academicYear, filters.term);
    const [total, trend] = await Promise.all([
        Student.countDocuments(studentMatch(scope, filters)),
        Student.aggregate([{ $match: { ...studentMatch(scope, filters), createdAt: { $gte: range.startDate, $lt: range.endDate } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    return { summary: { currentPopulation: total, newEnrolments: trend.reduce((sum, row) => sum + row.count, 0) }, trend };
};

const budgetAnalytics = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'finance');
    if (!scope) return;
    const filters = parseAnalyticsFilters(req.query);
    try {
        const range = await makeTermDateRange(filters.academicYear, filters.term);
        const periods = await AccountingPeriod.find({
            schoolId: scope.accountingSchoolId,
            startDate: { $lt: range.endDate },
            endDate: { $gte: range.startDate },
        }).select('_id name startDate endDate').lean();
        const periodIds = periods.map((period) => period._id);
        const [budgetRows, actualRows] = await Promise.all([
            Budget.aggregate([
                { $match: { schoolId: scope.accountingSchoolId, periodId: { $in: periodIds }, status: 'approved' } },
                { $lookup: { from: Account.collection.name, localField: 'accountId', foreignField: '_id', as: 'account' } },
                { $unwind: '$account' },
                { $match: { 'account.type': 'expense' } },
                { $group: { _id: '$accountId', account: { $first: '$account.name' }, budget: { $sum: '$amount' } } },
            ]),
            GeneralLedger.aggregate([
                { $match: { schoolId: scope.accountingSchoolId, periodId: { $in: periodIds }, entryDate: { $gte: range.startDate, $lt: range.endDate } } },
                { $lookup: { from: Account.collection.name, localField: 'accountId', foreignField: '_id', as: 'account' } },
                { $unwind: '$account' },
                { $match: { 'account.type': 'expense' } },
                { $group: { _id: '$accountId', account: { $first: '$account.name' }, actual: { $sum: { $subtract: ['$debitAmount', '$creditAmount'] } } } },
            ]),
        ]);
        const combined = new Map();
        budgetRows.forEach((row) => combined.set(String(row._id), { accountId: String(row._id), account: row.account, approvedBudget: row.budget, actualExpenditure: 0 }));
        actualRows.forEach((row) => {
            if (!combined.has(String(row._id))) combined.set(String(row._id), { accountId: String(row._id), account: row.account, approvedBudget: 0, actualExpenditure: 0 });
            combined.get(String(row._id)).actualExpenditure = row.actual;
        });
        const budgetVsActual = [...combined.values()].map((row) => ({
            ...row,
            variance: row.actualExpenditure - row.approvedBudget,
            interpretation: row.actualExpenditure <= row.approvedBudget ? 'favourable' : 'unfavourable',
        }));
        return res.json({
            budgetVsActual,
            periods: periods.map((period) => ({ name: period.name, startDate: period.startDate, endDate: period.endDate })),
            summary: {
                approvedBudget: budgetVsActual.reduce((sum, row) => sum + row.approvedBudget, 0),
                actualExpenditure: budgetVsActual.reduce((sum, row) => sum + row.actualExpenditure, 0),
                variance: budgetVsActual.reduce((sum, row) => sum + row.variance, 0),
            },
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate budget analytics' });
    }
};

const analyticsReports = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'reports');
    if (!scope) return;
    try {
        const [history, changes] = await Promise.all([
            AnalyticsReportHistory.find({ school: scope.schoolId }).sort({ generatedAt: -1 }).limit(50).lean(),
            AuditLogs.find({ school: scope.schoolId, timestamp: { $gte: new Date(Date.now() - 90 * 86400000) } })
                .select('userName userRole action entityType entityName timestamp status resultMessage')
                .sort({ timestamp: -1 }).limit(50).lean(),
        ]);
        return res.json({ history, administrativeChanges: changes });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load report history' });
    }
};

const createAnalyticsReport = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'reports');
    if (!scope) return;
    const reportType = ['academics', 'overview', 'teachers', 'fees', 'attendance'].includes(req.body.reportType) ? req.body.reportType : 'academics';
    const format = ['pdf', 'excel'].includes(req.body.format) ? req.body.format : 'pdf';
    try {
        const filters = parseAnalyticsFilters(req.body.filters || {});
        const academic = await getAcademicSnapshot(scope, filters);
        const report = await AnalyticsReportHistory.create({
            school: scope.schoolId,
            reportType,
            format,
            filters,
            generatedBy: scope.user._id,
            generatedByName: scope.user.name || scope.user.email,
            recordCount: academic.totalStudentRows,
        });
        return res.status(201).json({ message: 'Report generated and recorded', reportId: report._id, recordCount: report.recordCount });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to record generated report' });
    }
};

const getAnalyticsTargets = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'academic');
    if (!scope) return;
    try {
        const filters = parseAnalyticsFilters(req.query);
        const [targets, academic, fees, attendance, enrolment] = await Promise.all([
            AnalyticsTarget.find({ school: scope.schoolId, active: true, academicYear: filters.academicYear, term: filters.term }).sort({ createdAt: -1 }).lean(),
            getAcademicSnapshot(scope, filters),
            getFinanceSummary(scope, filters),
            getAttendanceSummary(scope, filters),
            getEnrolmentSummary(scope, filters),
        ]);
        const currentValues = {
            academicMean: academic.summary.meanScore,
            attendanceRate: attendance.summary.attendanceRate,
            feeCollectionRate: fees.summary.collectionRate,
            assessmentCompletion: academic.summary.assessmentCompletion,
            enrolment: enrolment.summary.newEnrolments,
        };
        return res.json({ targets: targets.map((target) => ({ ...target, currentValue: currentValues[target.metric] ?? null, progress: target.targetValue ? ((currentValues[target.metric] || 0) / target.targetValue) * 100 : null })) });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load school targets' });
    }
};

const createAnalyticsTarget = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'academic');
    if (!scope) return;
    if (!['Admin', 'SuperAdmin'].includes(scope.role)) return res.status(403).json({ message: 'Only school administrators can set improvement targets' });
    const { metric, label, targetValue, academicYear, term, classId, stream } = req.body;
    if (!metric || !label || !Number.isFinite(Number(targetValue)) || Number(targetValue) < 0 || !academicYear) {
        return res.status(400).json({ message: 'Metric, label, non-negative targetValue, and academicYear are required' });
    }
    try {
        const target = await AnalyticsTarget.create({ school: scope.schoolId, metric, label, targetValue: Number(targetValue), academicYear, term: term || 'Term 1', classId: isValidId(classId) ? classId : null, stream: stream || '', createdBy: scope.user._id });
        return res.status(201).json({ target });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to save improvement target' });
    }
};

const getScheduledAnalyticsReports = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'reports');
    if (!scope) return;
    const schedules = await ScheduledAnalyticsReport.find({ school: scope.schoolId }).sort({ nextRunAt: 1 }).select('-createdByEmail').lean();
    return res.json({ schedules });
};

const createScheduledAnalyticsReport = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'reports');
    if (!scope) return;
    if (!['Admin', 'SuperAdmin', 'HR'].includes(scope.role)) return res.status(403).json({ message: 'Only authorised administrators and HR staff can schedule reports' });
    if (!['overview', 'academics', 'teachers'].includes(req.body.reportType) || !['weekly', 'monthly'].includes(req.body.frequency)) {
        return res.status(400).json({ message: 'Choose an overview, academics, or teachers report and a weekly or monthly frequency' });
    }
    if (!scope.user.email) return res.status(400).json({ message: 'A staff email is required for scheduled delivery' });
    try {
        const schedule = await ScheduledAnalyticsReport.create({
            school: scope.schoolId,
            reportType: req.body.reportType,
            filters: req.body.filters || {},
            frequency: req.body.frequency,
            createdBy: scope.user._id,
            createdByEmail: scope.user.email,
            nextRunAt: new Date(Date.now() + (req.body.frequency === 'weekly' ? 7 : 30) * 86400000),
        });
        return res.status(201).json({ schedule: { id: schedule._id, reportType: schedule.reportType, frequency: schedule.frequency, nextRunAt: schedule.nextRunAt } });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to schedule report' });
    }
};

const deleteScheduledAnalyticsReport = async (req, res) => {
    const scope = await getAnalyticsScope(req, res, 'reports');
    if (!scope) return;
    const schedule = await ScheduledAnalyticsReport.findOneAndDelete({ _id: req.params.id, school: scope.schoolId });
    if (!schedule) return res.status(404).json({ message: 'Scheduled report not found' });
    return res.json({ message: 'Scheduled report deleted' });
};

const runDueScheduledAnalyticsReports = async () => {
    if (mongoose.connection.readyState !== 1) return;
    const dueSchedules = await ScheduledAnalyticsReport.find({ enabled: true, nextRunAt: { $lte: new Date() } }).limit(20);
    for (const schedule of dueSchedules) {
        try {
            const user = await Admin.findById(schedule.createdBy).select('name email role school');
            if (!user?.email || !['Admin', 'SuperAdmin', 'HR'].includes(user.role) || (user.role !== 'SuperAdmin' && String(user.school || user._id) !== String(schedule.school))) {
                schedule.enabled = false;
                await schedule.save();
                continue;
            }
            const schoolRecord = await School.findOne({ schoolAdmin: schedule.school }).select('_id schoolAdmin schoolName');
            const scope = {
                user,
                role: user.role,
                schoolId: schedule.school,
                accountingSchoolId: schoolRecord?._id || schedule.school,
                schoolName: schoolRecord?.schoolName || '',
            };
            const filters = parseAnalyticsFilters(schedule.filters || {});
            let payload;
            if (schedule.reportType === 'teachers') {
                const teacherCount = await Teacher.countDocuments({ school: schedule.school });
                payload = { teacherCount, filters };
            } else {
                const academic = await getAcademicSnapshot(scope, filters);
                payload = { academic: academic.summary, topClasses: academic.classResults.slice(0, 5), filters };
                if (schedule.reportType === 'overview') {
                    payload.finance = (await getFinanceSummary(scope, filters)).summary;
                    payload.attendance = (await getAttendanceSummary(scope, filters)).summary;
                }
            }
            await sendEmail(user.email, `${schedule.reportType} analytics report`, `<pre>${JSON.stringify(payload, null, 2)}</pre>`);
            await AnalyticsReportHistory.create({
                school: schedule.school,
                reportType: schedule.reportType,
                format: 'scheduled-snapshot',
                filters,
                generatedBy: user._id,
                generatedByName: user.name || user.email,
                recordCount: payload.academic?.assessedStudents || 0,
            });
            schedule.lastRunAt = new Date();
            schedule.nextRunAt = new Date(Date.now() + (schedule.frequency === 'weekly' ? 7 : 30) * 86400000);
            await schedule.save();
        } catch (error) {
            console.error('Scheduled analytics report failed:', error.message);
        }
    }
};

module.exports = {
    managementOverview,
    academicAnalytics,
    subjectAnalytics,
    classAnalytics,
    studentAnalytics,
    feeAnalytics,
    attendanceAnalytics,
    enrolmentAnalytics,
    reconciliationAnalytics,
    analyticsReports,
    teacherAnalytics,
    budgetAnalytics,
    createAnalyticsReport,
    getAnalyticsTargets,
    createAnalyticsTarget,
    getScheduledAnalyticsReports,
    createScheduledAnalyticsReport,
    deleteScheduledAnalyticsReport,
    runDueScheduledAnalyticsReports,
    getAnalyticsScope,
    parseAnalyticsFilters,
};