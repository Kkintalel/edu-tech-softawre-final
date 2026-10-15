const Assignment = require('../models/assignmentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Student = require('../models/studentSchema.js');
const Sclass = require('../models/sclassSchema.js');
const Subject = require('../models/subjectSchema.js');
const { getAdminIdFromReq, getRequestUser, verifySchoolId, verifyEntityBelongsToAdminSchool } = require('../middleware/schoolAccess.js');
const { getAuthenticatedSubject, hasBearerToken } = require('../utils/authToken.js');

const path = require('path');

const getAssignmentActor = async (req, res) => {
    const subject = getAuthenticatedSubject(req);
    if (!hasBearerToken(req) || !subject) {
        res.status(401).json({ message: 'A valid signed-in session is required' });
        return null;
    }
    const identity = await getRequestUser(req);
    if (!identity || String(identity.user._id) !== String(subject)) {
        res.status(401).json({ message: 'Assignment session identity could not be verified' });
        return null;
    }
    return identity;
};

const canAccessAssignment = async (identity, assignment, res) => {
    if (identity.type === 'admin') {
        if (!['Admin', 'SuperAdmin'].includes(identity.user.role)) {
            res.status(403).json({ message: 'Your role cannot access assignment records' });
            return false;
        }
        if (identity.user.role !== 'SuperAdmin' && String(identity.schoolId) !== String(assignment.school)) {
            res.status(403).json({ message: 'Assignment belongs to another school' });
            return false;
        }
        return true;
    }
    if (identity.type === 'teacher') {
        const assignedClasses = [identity.user.teachSclass, ...(identity.user.teachSclasses || [])].filter(Boolean).map((id) => String(id?._id || id));
        const assignedSubjects = [identity.user.teachSubject, ...(identity.user.teachSubjects || [])].filter(Boolean).map((id) => String(id?._id || id));
        const teacherId = assignment.teacher?._id || assignment.teacher;
        const classId = assignment.class?._id || assignment.class;
        const subjectId = assignment.subject?._id || assignment.subject;
        if (String(identity.user._id) !== String(teacherId) || !assignedClasses.includes(String(classId)) || !assignedSubjects.includes(String(subjectId))) {
            res.status(403).json({ message: 'Teachers can only access their own assigned class and subject work' });
            return false;
        }
        return true;
    }
    if (identity.type === 'student' || identity.type === 'parent') {
        const studentId = identity.type === 'student' ? identity.user._id : identity.user.studentId;
        const student = await Student.findOne({ _id: studentId, school: assignment.school }).select('sclassName');
        if (!student || String(student.sclassName) !== String(assignment.class)) {
            res.status(403).json({ message: 'Assignment is outside the linked student class' });
            return false;
        }
        return true;
    }
    res.status(403).json({ message: 'Your role cannot access assignments' });
    return false;
};

const createAssignment = async (req, res) => {
    try {
        // support both JSON body and multipart/form-data with files
        const { title, description, subject, teacher, classId, dueDate } = req.body;
        const identity = await getAssignmentActor(req, res);
        if (!identity) return;
        if (!['teacher', 'admin'].includes(identity.type) || (identity.type === 'admin' && !['Admin', 'SuperAdmin'].includes(identity.user.role))) {
            return res.status(403).json({ message: 'Only assigned teachers and administrators can create assignments' });
        }
        let school = identity.schoolId || (identity.type === 'teacher' ? identity.user.school : identity.user._id);
        let teacherId = identity.type === 'teacher' ? identity.user._id : teacher;
        if (!school && teacherId) school = (await Teacher.findById(teacherId).select('school'))?.school;
        const sclass = await Sclass.findOne({ _id: classId, school });
        const subjectRecord = await Subject.findOne({ _id: subject, school, sclassName: classId }).select('_id teacher');
        if (!sclass || !subjectRecord) return res.status(400).json({ message: 'Select a class and subject belonging to this school' });
        if (identity.type === 'teacher') {
            const classIds = [identity.user.teachSclass, ...(identity.user.teachSclasses || [])].filter(Boolean).map((id) => String(id?._id || id));
            const subjectIds = [identity.user.teachSubject, ...(identity.user.teachSubjects || [])].filter(Boolean).map((id) => String(id?._id || id));
            if (!classIds.includes(String(classId)) || !subjectIds.includes(String(subject))) return res.status(403).json({ message: 'You can only create assignments for assigned classes and subjects' });
            teacherId = identity.user._id;
        }

        // collect attachments from body (could be JSON string) and from uploaded files
        let bodyAttachments = [];
        if (req.body.attachments) {
            try {
                bodyAttachments = typeof req.body.attachments === 'string' ? JSON.parse(req.body.attachments) : req.body.attachments;
            } catch (e) {
                // not JSON, treat as single string
                bodyAttachments = Array.isArray(req.body.attachments) ? req.body.attachments : [req.body.attachments];
            }
        }

        const fileAttachments = (req.files || []).map(f => {
            // store URL path relative to server
            return `/uploads/assignments/${path.basename(f.path)}`;
        });

        const attachments = [...(bodyAttachments || []), ...fileAttachments];

        const assignment = new Assignment({
            title,
            description,
            subject,
            school,
            teacher: teacherId,
            class: classId,
            dueDate,
            attachments: attachments
        });
        const result = await assignment.save();
        res.send({ message: 'Assignment created', assignment: result });
    } catch (error) {
        res.status(500).json(error);
    }
};

const getAssignmentsBySchool = async (req, res) => {
    try {
        if (!(await verifySchoolId(req, res, req.params.schoolId))) return;
        const assignments = await Assignment.find({ school: req.params.schoolId })
            .populate('subject', 'subName')
            .populate('teacher', 'name email')
            .populate('class', 'sclassName');
        res.send(assignments);
    } catch (error) {
        res.status(500).json(error);
    }
};

const getAssignmentsByClass = async (req, res) => {
    try {
        const identity = await getAssignmentActor(req, res);
        if (!identity) return;
        const classRecord = await Sclass.findById(req.params.classId).select('school');
        if (!classRecord) return res.status(404).json({ message: 'Class not found' });
        const classId = String(req.params.classId);
        if (identity.type === 'student' || identity.type === 'parent') {
            const studentId = identity.type === 'student' ? identity.user._id : identity.user.studentId;
            const student = await Student.findById(studentId).select('school sclassName');
            if (!student || String(student.sclassName) !== classId || String(student.school) !== String(classRecord.school)) return res.status(403).json({ message: 'Class is outside the linked student account' });
        } else if (identity.type === 'teacher') {
            const assignedClasses = [identity.user.teachSclass, ...(identity.user.teachSclasses || [])].filter(Boolean).map((id) => String(id?._id || id));
            if (!assignedClasses.includes(classId) || String(identity.schoolId) !== String(classRecord.school)) return res.status(403).json({ message: 'Class is outside your teaching assignment' });
        } else if (!['Admin', 'SuperAdmin'].includes(identity.user.role) || (identity.user.role !== 'SuperAdmin' && String(identity.schoolId) !== String(classRecord.school))) {
            return res.status(403).json({ message: 'Class is outside your school access' });
        }
        const query = { class: req.params.classId, school: classRecord.school };
        if (identity.type === 'teacher') query.teacher = identity.user._id;
        const assignments = await Assignment.find(query)
            .populate('subject', 'subName')
            .populate('teacher', 'name email');
        if (identity.type === 'student' || identity.type === 'parent') {
            const studentId = identity.type === 'student' ? identity.user._id : identity.user.studentId;
            return res.send(assignments.map((assignment) => {
                const data = assignment.toObject();
                data.submissions = (data.submissions || []).filter((submission) => String(submission.student) === String(studentId));
                return data;
            }));
        }
        res.send(assignments);
    } catch (error) {
        res.status(500).json(error);
    }
};

const getAssignmentDetail = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('subject', 'subName')
            .populate('teacher', 'name email')
            .populate('class', 'sclassName')
            .populate('submissions.student', 'name rollNum');
        if (!assignment) {
            return res.status(404).send({ message: 'Assignment not found' });
        }
        const identity = await getAssignmentActor(req, res);
        if (!identity || !(await canAccessAssignment(identity, assignment, res))) return;
        if (identity.type === 'student' || identity.type === 'parent') {
            const data = assignment.toObject();
            const studentId = identity.type === 'student' ? identity.user._id : identity.user.studentId;
            data.submissions = (data.submissions || []).filter((submission) => String(submission.student) === String(studentId));
            return res.send(data);
        }
        res.send(assignment);
    } catch (error) {
        res.status(500).json(error);
    }
};

const submitAssignment = async (req, res) => {
    try {
        const { submissionText, fileUrl } = req.body;
        const identity = await getAssignmentActor(req, res);
        if (!identity || identity.type !== 'student') return res.status(403).json({ message: 'Student login is required to submit work' });
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) {
            return res.status(404).send({ message: 'Assignment not found' });
        }
        if (!(await canAccessAssignment(identity, assignment, res))) return;
        if (assignment.status !== 'Open') return res.status(409).json({ message: 'This assignment is closed' });
        if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) return res.status(409).json({ message: 'The assignment deadline has passed' });
        const existing = assignment.submissions.find((submission) => String(submission.student) === String(identity.user._id));
        if (existing) {
            existing.submissionText = submissionText || '';
            existing.fileUrl = fileUrl || '';
            existing.submittedAt = new Date();
        } else {
            assignment.submissions.push({ student: identity.user._id, submissionText: submissionText || '', fileUrl: fileUrl || '' });
        }
        const result = await assignment.save();
        res.send({ message: 'Assignment submitted', assignment: result });
    } catch (error) {
        res.status(500).json(error);
    }
};

const getAssignmentSubmissions = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('submissions.student', 'name rollNum');
        if (!assignment) {
            return res.status(404).send({ message: 'Assignment not found' });
        }
        const identity = await getAssignmentActor(req, res);
        if (!identity || !(await canAccessAssignment(identity, assignment, res))) return;
        if (['student', 'parent'].includes(identity.type)) return res.status(403).json({ message: 'Only the assigned teacher and administrators can review submissions' });
        res.send(assignment.submissions);
    } catch (error) {
        res.status(500).json(error);
    }
};

const gradeAssignmentSubmission = async (req, res) => {
    try {
        const identity = await getAssignmentActor(req, res);
        if (!identity || !['teacher', 'admin'].includes(identity.type)) return res.status(403).json({ message: 'Teacher or administrator access is required' });
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
        if (!(await canAccessAssignment(identity, assignment, res))) return;
        const submission = assignment.submissions.find((item) => String(item.student) === String(req.params.studentId));
        if (!submission) return res.status(404).json({ message: 'Student submission not found' });
        submission.grade = String(req.body.grade || '').trim().slice(0, 40) || 'Ungraded';
        submission.feedback = String(req.body.feedback || '').trim().slice(0, 2000);
        await assignment.save();
        return res.json({ message: 'Submission reviewed', submission: { student: submission.student, grade: submission.grade, feedback: submission.feedback, submittedAt: submission.submittedAt } });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to review submission' });
    }
};

const searchAssignments = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { query, title, teacherEmail } = req.query;
        if (!(await verifySchoolId(req, res, schoolId))) return;

        const searchQuery = { school: schoolId };
        const conditions = [];
        if (title) {
            conditions.push({ title: { $regex: title, $options: 'i' } });
        }
        if (teacherEmail) {
            // join via teacher email
            const teachers = await Teacher.find({ email: { $regex: teacherEmail, $options: 'i' } }).select('_id');
            const teacherIds = teachers.map(t => t._id);
            if (teacherIds.length > 0) conditions.push({ teacher: { $in: teacherIds } });
        }
        if (query) {
            conditions.push({ title: { $regex: query, $options: 'i' } });
            conditions.push({ description: { $regex: query, $options: 'i' } });
        }

        if (conditions.length === 0) return res.status(400).send({ message: 'Please provide a search query (title, teacherEmail or query)' });

        searchQuery.$or = conditions;

        const assignments = await Assignment.find(searchQuery)
            .populate('subject', 'subName')
            .populate('teacher', 'name email')
            .populate('class', 'sclassName');

        if (!assignments || assignments.length === 0) return res.send({ message: 'No assignments found', results: [] });
        res.send({ message: `Found ${assignments.length} assignment(s)`, count: assignments.length, results: assignments });
    } catch (err) {
        res.status(500).json(err);
    }
};

module.exports = {
    createAssignment,
    getAssignmentsBySchool,
    getAssignmentsByClass,
    getAssignmentDetail,
    submitAssignment,
    getAssignmentSubmissions,
    gradeAssignmentSubmission,
    searchAssignments
};
