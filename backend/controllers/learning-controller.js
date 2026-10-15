const LearningMaterial = require('../models/learningMaterialSchema.js');
const LiveClass = require('../models/liveClassSchema.js');
const Quiz = require('../models/quizSchema.js');
const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Sclass = require('../models/sclassSchema.js');
const Subject = require('../models/subjectSchema.js');
const LearningProgress = require('../models/learningProgressSchema.js');
const Assignment = require('../models/assignmentSchema.js');
const path = require('path');
const { getAdminIdFromReq, getRequestUser, verifySchoolId, verifyEntityBelongsToAdminSchool } = require('../middleware/schoolAccess.js');
const { getAuthenticatedSubject, hasBearerToken } = require('../utils/authToken.js');

const learningAccess = async (req, res, classId, subjectId) => {
    const authenticatedSubject = getAuthenticatedSubject(req);
    if (!hasBearerToken(req) || !authenticatedSubject) {
        res.status(401).json({ message: 'A valid signed-in session is required' });
        return null;
    }
    const identity = await getRequestUser(req);
    if (!identity || String(identity.user._id) !== String(authenticatedSubject)) {
        res.status(401).json({ message: 'Learning session identity could not be verified' });
        return null;
    }

    let student = null;
    if (identity.type === 'student') student = await Student.findById(identity.user._id).select('school sclassName');
    if (identity.type === 'parent') student = await Student.findById(identity.user.studentId).select('school sclassName');
    if (['student', 'parent'].includes(identity.type) && !student) {
        res.status(404).json({ message: 'Linked student record was not found' });
        return null;
    }

    let schoolId = identity.schoolId;
    if (student) schoolId = student.school;
    if (!schoolId) {
        res.status(403).json({ message: 'School scope is missing from this account' });
        return null;
    }

    const role = identity.user.role;
    const classIdValue = String(classId || student?.sclassName || '');
    if (identity.type === 'student' || identity.type === 'parent') {
        if (classIdValue !== String(student.sclassName)) {
            res.status(403).json({ message: 'Learning content is outside the linked student class' });
            return null;
        }
    } else if (identity.type === 'teacher') {
        const assignedClasses = [identity.user.teachSclass, ...(identity.user.teachSclasses || [])].filter(Boolean).map((value) => String(value?._id || value));
        const assignedSubjects = [identity.user.teachSubject, ...(identity.user.teachSubjects || [])].filter(Boolean).map((value) => String(value?._id || value));
        if (!assignedClasses.includes(classIdValue) || (subjectId && !assignedSubjects.includes(String(subjectId)))) {
            res.status(403).json({ message: 'Learning content is outside your assigned class or subject' });
            return null;
        }
    } else if (identity.type !== 'admin' || !['Admin', 'SuperAdmin'].includes(role)) {
        res.status(403).json({ message: 'Your role cannot access learning content' });
        return null;
    }

    const schoolClass = await Sclass.findOne({ _id: classIdValue, school: schoolId }).select('_id');
    if (!schoolClass) {
        res.status(404).json({ message: 'Class was not found in this school' });
        return null;
    }
    if (subjectId) {
        const subject = await Subject.findOne({ _id: subjectId, school: schoolId, sclassName: schoolClass._id }).select('_id teacher');
        if (!subject) {
            res.status(404).json({ message: 'Subject was not found in this class' });
            return null;
        }
        if (identity.type === 'teacher' && subject.teacher && String(subject.teacher) !== String(identity.user._id)) {
            res.status(403).json({ message: 'You are not assigned to this subject' });
            return null;
        }
    }

    return { identity, student, schoolId, classId: schoolClass._id, role };
};

const createLearningMaterial = async (req, res) => {
    try {
        const { title, description, type, subject, classId, topic } = req.body;
        const subjectId = req.body.subject_id || subject;
        const classIdValue = req.body.class_id || classId;
        const access = await learningAccess(req, res, classIdValue, subjectId);
        if (!access) return;
        if (!title || !subjectId) return res.status(400).json({ message: 'Title and subject are required' });
        const school = access.schoolId;
        const teacher = access.identity.type === 'teacher' ? access.identity.user._id : (req.body.teacher_id || req.body.teacher || req.body.teacherId);
        const materialType = req.body.material_type || type;
        const uploadedFiles = (req.files || []).map((file) => `/uploads/learning/${path.basename(file.path)}`);
        const fileUrl = req.body.file_url || req.body.fileUrl || uploadedFiles[0] || '';

        const material = new LearningMaterial({
            title,
            description,
            topic: topic || '',
            material_type: materialType,
            file_url: fileUrl,
            school_id: school,
            teacher_id: teacher,
            subject_id: subjectId,
            class_id: classIdValue,
            school,
            teacher,
            subject: subjectId,
            class: classIdValue,
            type: materialType,
            fileUrl,
        });

        const saved = await material.save();
        res.status(201).send({ message: 'Learning material uploaded', material: saved });
    } catch (error) {
        res.status(500).json(error);
    }
};

const getLearningMaterialsByClass = async (req, res) => {
    try {
        const access = await learningAccess(req, res, req.params.classId);
        if (!access) return;
        const query = {
            $and: [
                { $or: [{ class: access.classId }, { class_id: access.classId }] },
                { $or: [{ school: access.schoolId }, { school_id: access.schoolId }] },
            ],
        };
        const materials = await LearningMaterial.find(query)
            .populate('subject', 'subName')
            .populate('teacher', 'name email')
            .sort({ createdAt: -1 });
        res.send(materials);
    } catch (error) {
        res.status(500).json(error);
    }
};

const getLearningMaterialsBySchool = async (req, res) => {
    try {
        if (!(await verifySchoolId(req, res, req.params.schoolId))) return;
        const materials = await LearningMaterial.find({ school: req.params.schoolId })
            .populate('subject', 'subName')
            .populate('teacher', 'name email')
            .sort({ createdAt: -1 });
        res.send(materials);
    } catch (error) {
        res.status(500).json(error);
    }
};

const createLiveClass = async (req, res) => {
    try {
        const { title, description, scheduledAt, meetingLink, subject, classId, topic, meeting_url, start_time, end_time } = req.body;
        const subjectId = req.body.subject_id || subject;
        const classIdValue = req.body.class_id || classId;
        const access = await learningAccess(req, res, classIdValue, subjectId);
        if (!access) return;
        const school = access.schoolId;
        const teacher = access.identity.type === 'teacher' ? access.identity.user._id : (req.body.teacher_id || req.body.teacher || req.body.teacherId);
        const liveTopic = topic || title;
        const meetingUrl = meeting_url || meetingLink;
        const startTime = start_time || scheduledAt;
        const endTime = end_time || null;

        const liveClass = new LiveClass({
            topic: liveTopic,
            title: liveTopic,
            description,
            meeting_url: meetingUrl,
            start_time: startTime,
            end_time: endTime,
            school_id: school,
            teacher_id: teacher,
            subject_id: subjectId,
            class_id: classIdValue,
            scheduledAt: startTime,
            meetingLink: meetingUrl,
            school,
            teacher,
            subject: subjectId,
            class: classIdValue,
        });

        const saved = await liveClass.save();
        res.status(201).send({ message: 'Live class scheduled', liveClass: saved });
    } catch (error) {
        res.status(500).json(error);
    }
};

const getLiveClassesByClass = async (req, res) => {
    try {
        const access = await learningAccess(req, res, req.params.classId);
        if (!access) return;
        const query = {
            $and: [
                { $or: [{ class: access.classId }, { class_id: access.classId }] },
                { $or: [{ school: access.schoolId }, { school_id: access.schoolId }] },
            ],
        };
        const liveClasses = await LiveClass.find(query)
            .populate('subject', 'subName')
            .populate('teacher', 'name email')
            .sort({ scheduledAt: 1 });
        res.send(liveClasses);
    } catch (error) {
        res.status(500).json(error);
    }
};

const joinLiveClass = async (req, res) => {
    try {
        const identity = await getRequestUser(req);
        const authenticatedSubject = getAuthenticatedSubject(req);
        if (!hasBearerToken(req) || !authenticatedSubject || identity?.type !== 'student' || String(identity.user._id) !== String(authenticatedSubject)) {
            return res.status(403).json({ message: 'Student login is required to join a live class' });
        }
        const studentId = identity.user._id;
        const [liveClass, student] = await Promise.all([LiveClass.findById(req.params.liveClassId), Student.findById(studentId)]);
        if (!liveClass) return res.status(404).json({ message: 'Live class not found' });
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const classId = liveClass.class || liveClass.class_id;
        const schoolId = liveClass.school || liveClass.school_id;
        const subjectId = liveClass.subject || liveClass.subject_id;
        if (String(student.sclassName) !== String(classId) || String(student.school) !== String(schoolId)) {
            return res.status(403).json({ message: 'Student is not enrolled in this class' });
        }
        if (!subjectId) return res.status(400).json({ message: 'Live class subject is missing' });

        const today = new Date();
        const alreadyMarked = student.attendance.some((record) => {
            return String(record.subName) === String(subjectId)
                && new Date(record.date).toDateString() === today.toDateString();
        });
        if (!alreadyMarked) {
            student.attendance.push({ date: today, status: 'Present', checkInMethod: 'Online Class', subName: subjectId });
            await student.save();
        }

        res.json({ message: 'Attendance recorded', alreadyMarked, meetingLink: liveClass.meetingLink || liveClass.meeting_url });
    } catch (error) {
        console.error('Live class join error:', error);
        res.status(500).json({ message: 'Unable to record attendance', error: error.message });
    }
};

const createQuiz = async (req, res) => {
    try {
        const { title, description, subject, classId, questions } = req.body;
        const access = await learningAccess(req, res, classId, subject);
        if (!access) return;
        if (!title || !Array.isArray(questions) || questions.length === 0) return res.status(400).json({ message: 'Quiz title and questions are required' });
        const school = access.schoolId;
        const teacher = access.identity.type === 'teacher' ? access.identity.user._id : (req.body.teacher || req.body.teacherId);

        const quiz = new Quiz({
            title,
            description,
            school,
            teacher,
            subject,
            class: classId,
            questions,
        });

        const saved = await quiz.save();
        res.status(201).send({ message: 'Quiz created', quiz: saved });
    } catch (error) {
        res.status(500).json(error);
    }
};

const getQuizzesByClass = async (req, res) => {
    try {
        const access = await learningAccess(req, res, req.params.classId);
        if (!access) return;
        const query = { school: access.schoolId, class: access.classId };
        if (['student', 'parent'].includes(access.identity.type)) query.published = true;
        if (access.identity.type === 'teacher') query.teacher = access.identity.user._id;
        const quizzes = await Quiz.find(query)
            .populate('subject', 'subName')
            .populate('teacher', 'name email')
            .sort({ createdAt: -1 });
        if (['student', 'parent'].includes(access.identity.type)) {
            const studentId = access.student?._id || access.identity.user._id;
            const safeQuizzes = quizzes.map((quiz) => {
                const quizData = quiz.toObject({ getters: true });
                quizData.questions = (quizData.questions || []).map(({ correctAnswer, ...question }) => question);
                const attempts = (quiz.attempts || []).filter((attempt) => String(attempt.student) === String(studentId));
                quizData.attempts = attempts.map((attempt) => ({ score: attempt.score, maxScore: attempt.maxScore, submittedAt: attempt.submittedAt }));
                return quizData;
            });
            return res.send(safeQuizzes);
        }
        res.send(quizzes);
    } catch (error) {
        res.status(500).json(error);
    }
};

const completeLearningMaterial = async (req, res) => {
    try {
        const material = await LearningMaterial.findById(req.params.materialId).select('school class class_id subject subject_id');
        if (!material) return res.status(404).json({ message: 'Learning material not found' });
        const classId = material.class || material.class_id;
        const subjectId = material.subject || material.subject_id;
        const access = await learningAccess(req, res, classId, subjectId);
        if (!access) return;
        if (access.identity.type !== 'student') return res.status(403).json({ message: 'Only the signed-in student can mark a lesson complete' });
        if (String(material.school || material.school_id) !== String(access.schoolId)) return res.status(403).json({ message: 'Learning material belongs to another school' });

        const progress = await LearningProgress.findOneAndUpdate(
            { school: access.schoolId, student: access.identity.user._id, material: material._id },
            { $setOnInsert: { completedAt: new Date() } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ message: 'Lesson marked complete', progress });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Unable to save lesson progress' });
    }
};

const submitQuizAttempt = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.quizId);
        if (!quiz || !quiz.published) return res.status(404).json({ message: 'Published quiz not found' });
        const access = await learningAccess(req, res, quiz.class, quiz.subject);
        if (!access) return;
        if (access.identity.type !== 'student') return res.status(403).json({ message: 'Only the enrolled student can submit a quiz' });
        const answers = req.body.answers;
        if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
            return res.status(400).json({ message: 'Submit one answer for each quiz question' });
        }

        const correctCount = quiz.questions.reduce((count, question, index) =>
            count + (String(answers[index] || '').trim() === String(question.correctAnswer || '').trim() ? 1 : 0), 0);
        const attempt = {
            student: access.identity.user._id,
            answers: answers.map((answer) => String(answer || '')),
            score: correctCount,
            maxScore: quiz.questions.length,
            submittedAt: new Date(),
        };
        quiz.attempts.push(attempt);
        await quiz.save();
        return res.status(201).json({
            message: 'Quiz submitted',
            result: { score: correctCount, maxScore: quiz.questions.length, percentage: quiz.questions.length ? (correctCount / quiz.questions.length) * 100 : 0, submittedAt: attempt.submittedAt },
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Unable to submit quiz' });
    }
};

const getQuizResults = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.quizId).select('school class subject teacher attempts title');
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        const access = await learningAccess(req, res, quiz.class, quiz.subject);
        if (!access) return;
        if (access.identity.type === 'teacher' && String(quiz.teacher) !== String(access.identity.user._id)) {
            return res.status(403).json({ message: 'Teachers can only review their own quiz results' });
        }
        if (!['teacher', 'admin'].includes(access.identity.type)) return res.status(403).json({ message: 'Quiz results are for the assigned teacher or school administrator' });
        const results = await Quiz.findById(quiz._id).populate('attempts.student', 'name admissionNo rollNum').select('attempts').lean();
        return res.json({ quizId: String(quiz._id), title: quiz.title, results: (results?.attempts || []).map((attempt) => ({
            student: attempt.student ? { id: String(attempt.student._id), name: attempt.student.name, admissionNo: attempt.student.admissionNo, rollNum: attempt.student.rollNum } : null,
            score: attempt.score,
            maxScore: attempt.maxScore,
            submittedAt: attempt.submittedAt,
        })) });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Unable to load quiz results' });
    }
};

const getStudentLearningProgress = async (req, res) => {
    try {
        const identity = await getRequestUser(req);
        const authenticatedSubject = getAuthenticatedSubject(req);
        if (!hasBearerToken(req) || !authenticatedSubject || !identity || String(identity.user._id) !== String(authenticatedSubject)) {
            return res.status(401).json({ message: 'A valid signed-in session is required' });
        }
        const requestedStudentId = req.params.studentId;
        let studentId;
        if (identity.type === 'student') {
            if (requestedStudentId && String(requestedStudentId) !== String(identity.user._id)) return res.status(403).json({ message: 'Students can only view their own learning progress' });
            studentId = identity.user._id;
        } else if (identity.type === 'parent') {
            if (requestedStudentId && String(requestedStudentId) !== String(identity.user.studentId)) return res.status(403).json({ message: 'Parents can only view their linked student' });
            studentId = identity.user.studentId;
        } else {
            studentId = requestedStudentId;
        }
        if (!studentId) return res.status(400).json({ message: 'Student ID is required' });
        const student = await Student.findOne({ _id: studentId, school: identity.schoolId }).select('_id school sclassName');
        if (!student) return res.status(404).json({ message: 'Student not found in this school' });
        const access = await learningAccess(req, res, student.sclassName);
        if (!access) return;
        const [completed, assignments, quizzes] = await Promise.all([
            LearningProgress.find({ school: student.school, student: student._id }).populate({ path: 'material', select: 'title topic subject', populate: { path: 'subject', select: 'subName' } }).sort({ completedAt: -1 }).lean(),
            Assignment.find({ school: student.school, class: student.sclassName }).select('title dueDate subject submissions status').populate('subject', 'subName').lean(),
            Quiz.find({ school: student.school, class: student.sclassName, published: true }).select('title subject attempts').populate('subject', 'subName').lean(),
        ]);
        const assignmentsForStudent = assignments.map((assignment) => {
            const submission = assignment.submissions.find((item) => String(item.student) === String(student._id));
            return { id: String(assignment._id), title: assignment.title, subject: assignment.subject?.subName || '', dueDate: assignment.dueDate, submitted: Boolean(submission), submittedAt: submission?.submittedAt || null, grade: submission?.grade || '', feedback: submission?.feedback || '', status: assignment.status };
        });
        const quizResults = quizzes.flatMap((quiz) => (quiz.attempts || []).filter((attempt) => String(attempt.student) === String(student._id)).map((attempt) => ({ quizId: String(quiz._id), title: quiz.title, subject: quiz.subject?.subName || '', score: attempt.score, maxScore: attempt.maxScore, submittedAt: attempt.submittedAt })));
        const totalLessons = await LearningMaterial.countDocuments({ school: student.school, class: student.sclassName });
        return res.json({
            studentId: String(student._id),
            lessons: { completed: completed.length, total: totalLessons, completionRate: totalLessons ? (completed.length / totalLessons) * 100 : 0, records: completed },
            assignments: assignmentsForStudent,
            quizzes: quizResults,
            outstandingTasks: assignmentsForStudent.filter((item) => !item.submitted && item.status === 'Open'),
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Unable to load learning progress' });
    }
};

module.exports = {
    createLearningMaterial,
    getLearningMaterialsByClass,
    getLearningMaterialsBySchool,
    createLiveClass,
    getLiveClassesByClass,
    joinLiveClass,
    createQuiz,
    getQuizzesByClass,
    completeLearningMaterial,
    submitQuizAttempt,
    getQuizResults,
    getStudentLearningProgress,
};
