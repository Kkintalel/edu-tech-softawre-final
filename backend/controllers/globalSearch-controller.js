const mongoose = require('mongoose');
const Admin = require('../models/adminSchema');
const Student = require('../models/studentSchema');
const Sclass = require('../models/sclassSchema');
const Subject = require('../models/subjectSchema');
const Teacher = require('../models/teacherSchema');
const Parent = require('../models/parentSchema');
const School = require('../models/schoolSchema');
const Assignment = require('../models/assignmentSchema');
const Attendance = require('../models/attendanceSchema');
const Employee = require('../models/employeeSchema');
const ExpenseClaim = require('../models/expenseClaimSchema');
const { FeePledge, ProcurementOrder } = require('../models/financeCommitmentSchema');
const { getRequestUser } = require('../middleware/schoolAccess');
const { createSearchTokens } = require('../utils/searchTokens');
const { hasBearerToken, getAuthenticatedSubject } = require('../utils/authToken');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const objectId = (value) => mongoose.Types.ObjectId.isValid(String(value || '')) ? new mongoose.Types.ObjectId(String(value)) : null;
const cap = 5;
const prefixRegex = (value) => new RegExp(`^${escapeRegex(value)}`, 'i');

const getScope = async (req, res) => {
    const authenticatedSubject = getAuthenticatedSubject(req);
    if (!hasBearerToken(req) || !authenticatedSubject) {
        res.status(401).json({ message: 'A valid signed-in session is required for global search' });
        return null;
    }
    const identity = await getRequestUser(req);
    if (!identity || !['admin', 'teacher'].includes(identity.type)) {
        res.status(403).json({ message: 'Global search is not available to this account' });
        return null;
    }
    if (String(identity.user._id) !== String(authenticatedSubject)) {
        res.status(401).json({ message: 'Search session identity could not be verified' });
        return null;
    }
    let schoolAdminId = identity.schoolId;
    if (identity.type === 'admin') {
        const roles = new Set([identity.user.role, ...(identity.user.roles || [])]);
        if (!['Admin', 'SuperAdmin', 'HR', 'Accountant', 'Auditor'].some((role) => roles.has(role))) {
            res.status(403).json({ message: 'Your role cannot search school records' });
            return null;
        }
        if (roles.has('SuperAdmin')) {
            const requestedSchoolId = req.query.schoolId;
            const requestedId = objectId(requestedSchoolId);
            if (!requestedId) {
                res.status(400).json({ message: 'Select a school before searching' });
                return null;
            }
            const schoolRecord = await School.findOne({ $or: [{ _id: requestedId }, { schoolAdmin: requestedId }] }).select('_id schoolAdmin');
            schoolAdminId = schoolRecord?.schoolAdmin || requestedId;
        } else if (req.query.schoolId && String(req.query.schoolId) !== String(identity.schoolId)) {
            res.status(403).json({ message: 'You can only search records in your own school' });
            return null;
        }
    }
    const schoolObjectId = objectId(schoolAdminId);
    if (!schoolObjectId) {
        res.status(400).json({ message: 'A valid school context is required' });
        return null;
    }
    const schoolRecord = await School.findOne({ schoolAdmin: schoolObjectId }).select('_id schoolAdmin');
    return {
        identity,
        schoolId: schoolObjectId,
        accountingSchoolId: schoolRecord?._id || schoolObjectId,
        role: identity.user.role,
        isTeacher: identity.type === 'teacher',
    };
};

const globalSearch = async (req, res) => {
    const query = String(req.query.q || req.query.query || '').trim().slice(0, 80);
    if (query.length < 2) return res.status(400).json({ message: 'Enter at least 2 characters to search' });

    const scope = await getScope(req, res);
    if (!scope) return;

    const tokenValues = createSearchTokens(query);
    const queryRegex = prefixRegex(query);
    const role = scope.role;
    const isAdmin = ['Admin', 'SuperAdmin'].includes(role);
    const canViewFinance = ['Admin', 'SuperAdmin', 'Accountant', 'Auditor'].includes(role);
    const canViewPeople = ['Admin', 'SuperAdmin', 'HR'].includes(role);
    const baseStudentMatch = { school: scope.schoolId };
    const teacherClassIds = scope.isTeacher
        ? [...new Set([scope.identity.user.teachSclass, ...(scope.identity.user.teachSclasses || [])].filter(Boolean).map((value) => String(value?._id || value)))]
        : [];
    const teacherSubjectIds = scope.isTeacher
        ? [...new Set([scope.identity.user.teachSubject, ...(scope.identity.user.teachSubjects || [])].filter(Boolean).map((value) => String(value?._id || value)))]
        : [];
    if (scope.isTeacher) baseStudentMatch.sclassName = { $in: teacherClassIds.filter((id) => objectId(id)).map(objectId) };

    try {
        const [studentDocs, classDocs, subjectDocs, teacherDocs, employeeDocs] = await Promise.all([
            Student.find({
                ...baseStudentMatch,
                $or: [
                    { admissionNo: queryRegex },
                    { rollNum: /^\d+$/.test(query) ? Number(query) : -1 },
                    { balance: /^\d+(?:\.\d{1,2})?$/.test(query) ? Number(query) : -1 },
                    { searchTokens: { $in: tokenValues } },
                ],
            }).select('name admissionNo rollNum sclassName').populate('sclassName', 'sclassName').limit(cap),
            Sclass.find({
                school: scope.schoolId,
                ...(scope.isTeacher ? { _id: { $in: teacherClassIds.filter((id) => objectId(id)).map(objectId) } } : {}),
                $or: [{ sclassName: queryRegex }, { searchTokens: { $in: tokenValues } }],
            }).select('sclassName').limit(cap),
            Subject.find({
                school: scope.schoolId,
                ...(scope.isTeacher ? { _id: { $in: teacherSubjectIds.filter((id) => objectId(id)).map(objectId) } } : {}),
                $or: [{ subName: queryRegex }, { subCode: queryRegex }],
            }).select('subName subCode sclassName').populate('sclassName', 'sclassName').limit(cap),
            !scope.isTeacher && canViewPeople
                ? Teacher.find({ school: scope.schoolId, $or: [{ email: queryRegex }, { employeeId: queryRegex }, { searchTokens: { $in: tokenValues } }, { emailSearchTokens: { $in: tokenValues } }, { employeeIdSearchTokens: { $in: tokenValues } }] }).select('name email employeeId teachSclass').populate('teachSclass', 'sclassName').limit(cap)
                : Promise.resolve([]),
            !scope.isTeacher && canViewPeople
                ? Employee.find({ school: scope.accountingSchoolId, $or: [{ employeeId: queryRegex }, { searchTokens: { $in: tokenValues } }, { email: queryRegex }] }).select('firstName lastName employeeId department position').limit(cap)
                : Promise.resolve([]),
        ]);

        const students = studentDocs.map((student) => ({
            id: String(student._id),
            label: student.name,
            detail: `${student.admissionNo || 'No admission number'} · ${student.sclassName?.sclassName || 'No class'}${student.rollNum ? ` · Roll ${student.rollNum}` : ''}`,
            href: `/Admin/students/student/${student._id}`,
        }));
        const classes = classDocs.map((item) => ({ id: String(item._id), label: item.sclassName, detail: 'Class / stream', href: `/Admin/classes/class/${item._id}` }));
        const subjects = subjectDocs.map((item) => ({ id: String(item._id), label: item.subName, detail: `${item.subCode} · ${item.sclassName?.sclassName || 'Class'}`, href: `/Admin/subjects/subject/${item.sclassName?._id}/${item._id}` }));
        const teachers = teacherDocs.map((item) => ({ id: String(item._id), label: item.name, detail: `${item.email} · ${item.teachSclass?.sclassName || 'Teacher'}`, href: `/Admin/teachers/teacher/${item._id}` }));
        const employees = employeeDocs.map((item) => ({ id: String(item._id), label: `${item.firstName} ${item.lastName}`, detail: `${item.employeeId} · ${item.position}`, href: `/HR/employees/${item._id}` }));

        const groups = { students, classes, subjects, teachers, employees, assessments: [], attendance: [], fees: [], payments: [], parents: [], finance: [] };

        if (!scope.isTeacher && canViewFinance) {
            const paymentStudents = await Student.aggregate([
                { $match: { school: scope.schoolId } },
                { $unwind: { path: '$paymentHistory', includeArrayIndex: 'paymentIndex' } },
                { $match: { $or: [
                    { 'paymentHistory.receiptNumber': queryRegex },
                    { 'paymentHistory.transactionId': queryRegex },
                    { 'paymentHistory.mpesaReceiptNumber': queryRegex },
                    { 'paymentHistory.reference': queryRegex },
                    { 'paymentHistory.paymentReference': queryRegex },
                    { 'paymentHistory.chequeNumber': queryRegex },
                ] } },
                { $project: { studentId: '$_id', admissionNo: 1, classId: '$sclassName', payment: '$paymentHistory', paymentIndex: 1 } },
                { $limit: cap },
            ]);
            groups.payments = paymentStudents.map((record) => ({
                id: `${record.studentId}:${record.paymentIndex}`,
                label: record.payment.receiptNumber || record.payment.mpesaReceiptNumber || record.payment.transactionId || record.payment.chequeNumber || 'Payment',
                detail: `${record.admissionNo} · ${record.payment.status} · ${record.payment.amount}`,
                href: `/Accountant/students/${record.studentId}`,
            }));

            const feeStudents = await Student.find({
                school: scope.schoolId,
                $or: [{ admissionNo: queryRegex }, { searchTokens: { $in: tokenValues } }],
            }).select('name admissionNo balance sclassName').populate('sclassName', 'sclassName').limit(cap);
            groups.fees = feeStudents.map((student) => ({
                id: String(student._id),
                label: student.name,
                detail: `${student.admissionNo} · Balance ${Number(student.balance || 0).toFixed(2)} · ${student.sclassName?.sclassName || ''}`,
                href: `/Accountant/students/${student._id}`,
            }));

            if (canViewPeople) {
                const parentStudents = await Student.find({
                    school: scope.schoolId,
                    $or: [
                        { parentNameSearchTokens: { $in: tokenValues } },
                        { parentPhoneSearchTokens: { $in: tokenValues } },
                        { parentEmailSearchTokens: { $in: tokenValues } },
                        { guardianNameSearchTokens: { $in: tokenValues } },
                        { guardianPhoneSearchTokens: { $in: tokenValues } },
                        { guardianEmailSearchTokens: { $in: tokenValues } },
                    ],
                }).select('parentName parentPhone parentEmail guardianName guardianPhone guardianEmail name admissionNo').limit(cap);
                groups.parents = parentStudents.map((student) => ({
                    id: String(student._id),
                    label: student.parentName || student.guardianName || 'Parent / guardian',
                    detail: `Linked student: ${student.name} · ${student.admissionNo}`,
                    href: `/Admin/students/student/${student._id}`,
                }));
            }

            const [pledges, orders, expenses] = await Promise.all([
                FeePledge.find({ school: scope.schoolId, $or: [{ promisedBy: queryRegex }, { note: queryRegex }] }).select('student promisedAmount status promisedDate').populate('student', 'name admissionNo').limit(cap),
                ProcurementOrder.find({ school: scope.schoolId, $or: [{ reference: queryRegex }, { transactionReference: queryRegex }, { supplier: queryRegex }, { description: queryRegex }] }).select('type reference supplier amount status transactionReference').limit(cap),
                ExpenseClaim.find({ schoolId: scope.accountingSchoolId, $or: [{ description: queryRegex }, { reference: queryRegex }] }).select('claimType description amount status reference').limit(cap),
            ]);
            groups.finance = [
                ...pledges.map((pledge) => ({ id: String(pledge._id), label: `Fee pledge · ${pledge.student?.name || ''}`, detail: `${pledge.student?.admissionNo || ''} · ${pledge.status} · ${pledge.promisedAmount}`, href: '/Accountant/commitments' })),
                ...orders.map((order) => ({ id: String(order._id), label: `${order.type} ${order.reference}`, detail: `${order.supplier} · ${order.status} · ${order.transactionReference || 'Unpaid'}`, href: '/Accountant/commitments' })),
                ...expenses.map((expense) => ({ id: String(expense._id), label: expense.description, detail: `${expense.claimType} · ${expense.status} · ${expense.amount}`, href: '/Accountant/expenses' })),
            ].slice(0, cap);
        }

        const subjectIds = scope.isTeacher ? teacherSubjectIds.filter((id) => objectId(id)).map(objectId) : subjectDocs.map((item) => item._id);
        if (subjectIds.length) {
            const assessmentMatch = {
                school: scope.schoolId,
                ...(scope.isTeacher ? { sclassName: { $in: teacherClassIds.map(objectId).filter(Boolean) } } : {}),
                $or: [{ admissionNo: queryRegex }, { searchTokens: { $in: tokenValues } }],
            };
            const assessmentStudents = await Student.find(assessmentMatch).select('name admissionNo examResult').limit(cap);
            const assessmentResults = assessmentStudents.flatMap((student) => {
                const matches = (student.examResult || [])
                    .filter((result) => subjectIds.some((id) => String(id) === String(result.subName)))
                    .filter((result) => result.term && prefixRegex(result.term).test(query));
                return matches.slice(0, cap).map((result) => ({
                    id: `${student._id}:${result.subName}:${result.term}:${result.examType}`,
                    label: `${result.term} ${result.examType} report`,
                    detail: `${student.name} · ${student.admissionNo} · ${result.marksObtained ?? 'Missing'} marks`,
                    href: `/Admin/students/student/${student._id}`,
                }));
            });
            groups.assessments = assessmentResults.slice(0, cap);
        }

        if (isAdmin || scope.isTeacher) {
            const studentScope = {
                school: scope.schoolId,
                ...(scope.isTeacher ? { sclassName: { $in: teacherClassIds.map(objectId).filter(Boolean) } } : {}),
                $or: [{ admissionNo: queryRegex }, { searchTokens: { $in: tokenValues } }],
            };
            const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(query);
            if (dateMatch) {
                const startDate = new Date(`${query}T00:00:00.000Z`);
                const endDate = new Date(startDate.getTime() + 86400000);
                const attendanceRows = await Student.aggregate([
                    { $match: studentScope },
                    { $unwind: '$attendance' },
                    { $match: { 'attendance.date': { $gte: startDate, $lt: endDate } } },
                    { $project: { studentId: '$_id', admissionNo: 1, date: '$attendance.date', status: '$attendance.status' } },
                    { $limit: cap },
                ]);
                const rowIds = attendanceRows.map((item) => item.studentId);
                const attendanceNames = await Student.find({ _id: { $in: rowIds } }).select('name').lean();
                const nameById = new Map(attendanceNames.map((item) => [String(item._id), item.name]));
                groups.attendance = attendanceRows.map((record) => ({ id: `${record.studentId}:${record.date}`, label: `Attendance · ${new Date(record.date).toLocaleDateString()}`, detail: `${nameById.get(String(record.studentId)) || record.admissionNo} · ${record.admissionNo} · ${record.status}`, href: `/Admin/students/student/attendance/${record.studentId}` }));
            }
            const streamNames = await Student.distinct('stream', { school: scope.schoolId, stream: queryRegex, ...(scope.isTeacher ? { sclassName: studentScope.sclassName } : {}) });
            groups.classes.push(...streamNames.filter(Boolean).slice(0, cap).map((stream) => ({ id: `stream:${stream}`, label: stream, detail: 'Stream', href: `/Admin/students?stream=${encodeURIComponent(stream)}` })));
        }

        const compactGroups = Object.fromEntries(Object.entries(groups).filter(([, results]) => results.length).map(([key, results]) => [key, results.slice(0, cap)]));
        return res.json({ query, groups: compactGroups, resultCount: Object.values(compactGroups).reduce((sum, results) => sum + results.length, 0) });
    } catch (error) {
        console.error('Global search failed:', error);
        return res.status(500).json({ message: 'Global search failed' });
    }
};

const listSearchSchools = async (req, res) => {
    const identity = await getRequestUser(req);
    if (identity?.type !== 'admin' || identity.user.role !== 'SuperAdmin') {
        return res.status(403).json({ message: 'Only platform administrators can select a school' });
    }
    const schools = await School.find({ status: { $ne: 'Inactive' } }).select('_id schoolAdmin schoolName').sort({ schoolName: 1 }).limit(500).lean();
    return res.json({ schools: schools.map((school) => ({ id: String(school.schoolAdmin), name: school.schoolName })) });
};

module.exports = { globalSearch, listSearchSchools, getScope };