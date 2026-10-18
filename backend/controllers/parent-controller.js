const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Parent = require('../models/parentSchema');
const Student = require('../models/studentSchema');
const Settings = require('../models/settingsSchema');
const School = require('../models/schoolSchema');
const { getRequestUser, enforceSubscriptionStatus } = require('../middleware/schoolAccess');
const { issueAdminToken } = require('../utils/authToken');
const { initiateStkPush, queryStkPushStatus } = require('../services/mpesaService');
const { tagPaymentWithAcademicPeriod } = require('../utils/academicPeriod');

const GRADING_TABLES = {
    achievement: [
        { min: 90, grade: 'EE1', level: 'AL8', points: 8, remark: 'Exceeding Expectation' },
        { min: 75, grade: 'EE2', level: 'AL7', points: 7, remark: 'Exceeding Expectation' },
        { min: 58, grade: 'ME1', level: 'AL6', points: 6, remark: 'Meeting Expectation' },
        { min: 41, grade: 'ME2', level: 'AL5', points: 5, remark: 'Meeting Expectation' },
        { min: 31, grade: 'AE1', level: 'AL4', points: 4, remark: 'Approaching Expectation' },
        { min: 21, grade: 'AE2', level: 'AL3', points: 3, remark: 'Approaching Expectation' },
        { min: 11, grade: 'BE1', level: 'AL2', points: 2, remark: 'Below Expectation' },
        { min: 0, grade: 'BE2', level: 'AL1', points: 1, remark: 'Below Expectation' },
    ],
};

const calculateResultGrade = (marks, gradingSystem = 'achievement') => {
    const numericMarks = Number(marks);
    const table = GRADING_TABLES[gradingSystem] || GRADING_TABLES.achievement;
    return table.find((entry, index) => numericMarks >= entry.min && (index === 0 || numericMarks < table[index - 1].min)) || table[table.length - 1];
};

const getComputedResult = (result = {}) => {
    const gradingSystem = GRADING_TABLES[result.gradingSystem] ? result.gradingSystem : 'achievement';
    const grade = calculateResultGrade(result.marksObtained, gradingSystem);
    return { ...result, gradingSystem, ...grade };
};

const normalizeParentPhone = (value) => {
    const digits = (value || '').toString().replace(/\D/g, '');
    return digits.startsWith('254') && digits.length === 12
        ? `0${digits.slice(3)}`
        : digits;
};

const getParentContactByIdentifier = (student, identifierType, identifier) => {
    const contacts = [
        { email: student.parentEmail, phone: student.parentPhone, name: student.parentName },
        { email: student.guardianEmail, phone: student.guardianPhone, name: student.guardianName },
    ].map((contact) => ({
        email: (contact.email || '').trim().toLowerCase(),
        phone: (contact.phone || '').trim(),
        name: contact.name || '',
    }));

    if (identifierType === 'phone') {
        const normalizedPhone = normalizeParentPhone(identifier);
        return contacts.find((contact) => contact.phone && normalizeParentPhone(contact.phone) === normalizedPhone) || null;
    }

    const normalizedEmail = (identifier || '').trim().toLowerCase();
    return contacts.find((contact) => contact.email && contact.email === normalizedEmail) || null;
};

const getParentOwnedStudent = async (req, res, studentId) => {
    const requestUser = await getRequestUser(req);
    if (!requestUser) {
        res.status(401).send({ message: 'Parent login is required' });
        return null;
    }
    if (requestUser.type !== 'parent') {
        res.status(403).send({ message: 'Parent access is required' });
        return null;
    }

    const ownStudentId = String(requestUser.user.studentId || '');
    if (!ownStudentId || (studentId && String(studentId) !== ownStudentId)) {
        res.status(403).send({ message: 'Parents can only access their linked student' });
        return null;
    }

    const student = await Student.findById(ownStudentId);
    if (!student) {
        res.status(404).send({ message: 'Student not found' });
        return null;
    }
    if (String(student.school) !== String(requestUser.schoolId)) {
        res.status(403).send({ message: 'Student belongs to a different school' });
        return null;
    }
    return student;
};

const getStudentSchoolBranding = async (student) => {
    const schoolAdminId = student.school?._id || student.school;
    const school = await School.findOne({ $or: [{ _id: schoolAdminId }, { schoolAdmin: schoolAdminId }] }).select('_id');
    return Settings.findOne({ school: school?._id || schoolAdminId }).select('branding schoolProfile receiptSettings');
};

// Parent Login - authenticate with admission number, parent email or phone, and password
const parentLogIn = async (req, res) => {
    try {
        const phoneIdentifier = req.body.phone || (req.body.identifierType === 'phone' ? req.body.identifier : '');
        if (phoneIdentifier && !req.body.admissionNo) {
            const normalizedPhone = normalizeParentPhone(phoneIdentifier);
            const matchingStudent = await Student.findOne({ admissionNo: req.body.password });
            if (!matchingStudent) {
                return res.status(401).send({ message: 'Phone number and student admission number do not match' });
            }
            const contact = getParentContactByIdentifier(matchingStudent, 'phone', phoneIdentifier);
            if (!contact) {
                return res.status(401).send({ message: 'Phone number and student admission number do not match' });
            }

            await matchingStudent.populate('school', 'schoolName');
            await matchingStudent.populate('sclassName', 'sclassName');
            const existingParent = await Parent.findOne({ studentId: matchingStudent._id, school: matchingStudent.school?._id || matchingStudent.school });
            const studentData = matchingStudent.toObject({ getters: true });
            const schoolSettings = await getStudentSchoolBranding(matchingStudent);
            let parent = existingParent;
            if (!parent) {
                parent = new Parent({
                    email: contact.email || `parent-${matchingStudent._id}@portal.local`,
                    password: await bcrypt.hash(matchingStudent.admissionNo, 10),
                    name: contact.name || `${studentData.name} Parent`,
                    phone: contact.phone || phoneIdentifier,
                    studentId: matchingStudent._id,
                    school: studentData.school?._id || studentData.school,
                    role: 'Parent',
                });
                await parent.save();
            }
            const parentData = parent.toObject({ getters: true });
            delete parentData.password;
            parentData.token = issueAdminToken(parentData);

            return res.send({
                ...parentData,
                student: {
                    id: studentData._id,
                    name: studentData.name,
                    admissionNo: studentData.admissionNo,
                    rollNum: studentData.rollNum,
                    classId: studentData.sclassName?._id || null,
                    className: studentData.sclassName?.sclassName || null,
                    totalFees: studentData.totalFees,
                    amountPaid: studentData.amountPaid,
                    balance: studentData.balance,
                    paymentStatus: studentData.paymentStatus,
                },
                school: studentData.school,
                settings: schoolSettings,
            });
        }

        const { admissionNo, parentEmail, guardianEmail, identifier, identifierType, password } = req.body;
        const loginIdentifier = identifier || parentEmail || guardianEmail;
        const loginIdentifierType = identifierType || (loginIdentifier?.includes('@') ? 'email' : 'phone');
        const normalizedAdmissionNo = admissionNo?.toString().trim();

        if (!loginIdentifier || !normalizedAdmissionNo || !password) {
            return res.status(400).send({ message: 'Parent or guardian email or phone number, student admission number, and password are required' });
        }

        const student = await Student.findOne({ admissionNo: normalizedAdmissionNo })
            .populate('school', 'schoolName')
            .populate('sclassName', 'sclassName');

        if (!student) {
            return res.status(404).send({ message: 'Student not found with the provided identifier' });
        }

        if (!['email', 'phone'].includes(loginIdentifierType)) {
            return res.status(400).send({ message: 'Choose email or phone number as the login method' });
        }

        const matchedContact = getParentContactByIdentifier(student, loginIdentifierType, loginIdentifier);
        if (!matchedContact) {
            const message = loginIdentifierType === 'phone'
                ? 'Parent or guardian phone number does not match this student'
                : 'Parent or guardian email does not match this student';
            return res.status(401).send({ message });
        }

        if (!matchedContact.email) {
            return res.status(400).send({ message: 'A parent or guardian email must also be saved for this student before portal access can be set up' });
        }

        const normalizedParentEmail = matchedContact.email;

        const schoolId = student.school?._id || student.school;
        let parent = await Parent.findOne({ email: normalizedParentEmail, school: schoolId });

        const createParent = async () => {
            const hashedPassword = await bcrypt.hash(student.admissionNo, 10);
            parent = new Parent({
                email: normalizedParentEmail,
                password: hashedPassword,
                name: matchedContact.name || student.name || 'Parent/Guardian',
                phone: matchedContact.phone,
                studentId: student._id,
                school: schoolId,
                role: 'Parent'
            });
            await parent.save();
        };

        if (!parent) {
            if (password !== student.admissionNo) {
                return res.status(401).send({ message: 'Invalid password', role: 'Parent' });
            }

            await createParent();
        } else {
            const validated = await bcrypt.compare(password, parent.password);
            if (!validated) {
                return res.status(401).send({ message: 'Invalid password', role: 'Parent' });
            }
        }

        if (!parent.studentId.equals(student._id)) {
            parent.studentId = student._id;
            await parent.save();
        }

        const parentData = parent.toObject({ getters: true });
        delete parentData.password;
        const studentObj = student.toObject({ getters: true });
        const schoolSettings = await getStudentSchoolBranding(student);

        res.send({
            ...parentData,
            token: issueAdminToken(parentData),
            settings: schoolSettings,
            student: {
                id: studentObj._id,
                name: studentObj.name,
                admissionNo: studentObj.admissionNo,
                rollNum: studentObj.rollNum,
                classId: studentObj.sclassName?._id || null,
                className: studentObj.sclassName?.sclassName || null,
                totalFees: studentObj.totalFees,
                amountPaid: studentObj.amountPaid,
                balance: studentObj.balance,
                paymentStatus: studentObj.paymentStatus,
            },
            school: studentObj.school
        });
    } catch (error) {
        console.error('Parent login error:', error);
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
};

const communityPortalLogin = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const parentAccounts = await Parent.find({ email }).limit(20);
        for (const parent of parentAccounts) {
            if (!(await bcrypt.compare(password, parent.password))) continue;
            const student = await Student.findById(parent.studentId)
                .populate('school', 'schoolName')
                .populate('sclassName', 'sclassName');
            if (!student) continue;

            const school = await enforceSubscriptionStatus(student.school?._id || student.school);
            if (school?.status === 'Suspended') {
                return res.status(403).json({ message: 'Portal access is unavailable while the school account is suspended' });
            }

            const parentData = parent.toObject({ getters: true });
            delete parentData.password;
            return res.json({
                ...parentData,
                role: 'Parent',
                token: issueAdminToken(parentData),
                settings: await getStudentSchoolBranding(student),
                student: {
                    id: student._id,
                    name: student.name,
                    admissionNo: student.admissionNo,
                    rollNum: student.rollNum,
                    classId: student.sclassName?._id || null,
                    className: student.sclassName?.sclassName || null,
                    totalFees: student.totalFees,
                    amountPaid: student.amountPaid,
                    balance: student.balance,
                    paymentStatus: student.paymentStatus,
                },
                school: student.school,
            });
        }

        const parentStudents = await Student.find({ $or: [{ parentEmail: email }, { guardianEmail: email }] })
            .populate('school', 'schoolName')
            .populate('sclassName', 'sclassName');
        const initialParentStudent = parentStudents.find((student) => student.admissionNo === password);
        if (initialParentStudent) {
            const contact = getParentContactByIdentifier(initialParentStudent, 'email', email);
            if (contact) {
                let parent = await Parent.findOne({ email, school: initialParentStudent.school });
                if (!parent) {
                    parent = await Parent.create({
                        email,
                        password: await bcrypt.hash(initialParentStudent.admissionNo, 10),
                        name: contact.name || `${initialParentStudent.name} Parent`,
                        phone: contact.phone || '',
                        studentId: initialParentStudent._id,
                        school: initialParentStudent.school,
                        role: 'Parent',
                    });
                }
                const parentData = parent.toObject({ getters: true });
                delete parentData.password;
                return res.json({
                    ...parentData,
                    role: 'Parent',
                    token: issueAdminToken(parentData),
                    settings: await getStudentSchoolBranding(initialParentStudent),
                    student: {
                        id: initialParentStudent._id,
                        name: initialParentStudent.name,
                        admissionNo: initialParentStudent.admissionNo,
                        rollNum: initialParentStudent.rollNum,
                        classId: initialParentStudent.sclassName?._id || initialParentStudent.sclassName || null,
                        className: initialParentStudent.sclassName?.sclassName || '',
                        totalFees: initialParentStudent.totalFees,
                        amountPaid: initialParentStudent.amountPaid,
                        balance: initialParentStudent.balance,
                        paymentStatus: initialParentStudent.paymentStatus,
                    },
                    school: initialParentStudent.school,
                });
            }
        }

        const student = await Student.findOne({ email })
            .populate('school', 'schoolName')
            .populate('sclassName', 'sclassName')
            .populate('examResult.subName', 'subName')
            .populate('attendance.subName', 'subName');
        if (!student || !(await bcrypt.compare(password, student.password))) {
            return res.status(401).json({ message: 'Email or password is incorrect' });
        }

        const school = await enforceSubscriptionStatus(student.school?._id || student.school);
        if (school?.status === 'Suspended') {
            return res.status(403).json({ message: 'Portal access is unavailable while the school account is suspended' });
        }

        const studentData = student.toObject({ getters: true });
        delete studentData.password;
        studentData.role = 'Student';
        studentData.forcePasswordChange = Boolean(studentData.forcePasswordChange);
        const linkedSchool = await School.findOne({ $or: [{ _id: studentData.school?._id || studentData.school }, { schoolAdmin: studentData.school?._id || studentData.school }] }).select('_id');
        studentData.settings = await Settings.findOne({ school: linkedSchool?._id || studentData.school?._id || studentData.school }).select('branding schoolProfile receiptSettings');
        studentData.token = issueAdminToken(studentData);
        return res.json(studentData);
    } catch (error) {
        console.error('Community portal login error:', error);
        return res.status(500).json({ message: 'Unable to sign in right now' });
    }
};

// Get student fee information for parent
const getStudentFeeInfo = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.query.studentId || req.body.studentId;
        const student = await getParentOwnedStudent(req, res, studentId);
        if (!student) return;
        await student.populate('sclassName', 'sclassName');

        res.send({
            id: student._id || student.id,
            studentId: student._id || student.id,
            name: student.name,
            admissionNo: student.admissionNo,
            rollNum: student.rollNum,
            className: student.sclassName?.sclassName || 'N/A',
            totalFees: student.totalFees,
            amountPaid: student.amountPaid,
            balance: student.balance,
            paymentStatus: student.paymentStatus,
            paymentHistory: student.paymentHistory || [],
        });
    } catch (error) {
        console.error('Get fee info error:', error);
        res.status(500).json({ message: 'Failed to fetch fee information', error: error.message });
    }
};

// Parent pays student fees
const parentPayFee = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.body.studentId || req.query.studentId;
        const { amount, paymentMethod, transactionId } = req.body;
        const normalizedTransactionId = transactionId?.trim();

        if (!amount || Number(amount) <= 0) {
            return res.status(400).send({ message: 'Please enter a valid payment amount' });
        }

        const student = await getParentOwnedStudent(req, res, studentId);
        if (!student) return;

        // Generate receipt number
        const receiptNumber = `RCPT-${student.admissionNo || student.rollNum}-${Date.now()}`;

        // Add to payment history (status depends on paymentCompleted)
        // Validate paymentMethod is in allowed enum
        const validPaymentMethods = ['Paybill', 'Card', 'Bank Transfer', 'Cash', 'Account Number', 'Online Transfer', 'Mpesa', 'M-Pesa STK Push'];
        const finalPaymentMethod = paymentMethod && validPaymentMethods.includes(paymentMethod) ? paymentMethod : 'Paybill';

        if (normalizedTransactionId) {
            const duplicatePayment = (student.paymentHistory || []).some((payment) =>
                payment.transactionId?.trim().toLowerCase() === normalizedTransactionId.toLowerCase() ||
                payment.reference?.trim().toLowerCase() === normalizedTransactionId.toLowerCase() ||
                payment.paymentReference?.trim().toLowerCase() === normalizedTransactionId.toLowerCase()
            );
            if (duplicatePayment) {
                return res.status(409).send({ message: 'This transaction reference has already been submitted.' });
            }
        }
        
        student.paymentHistory.push({
            amount: Number(amount),
            paymentMethod: finalPaymentMethod,
            receiptNumber,
            status: 'Pending',
            transactionId: normalizedTransactionId || '',
            date: new Date(),
            balanceAfter: 0
        });
        await tagPaymentWithAcademicPeriod(student, student.paymentHistory[student.paymentHistory.length - 1]);

        const history = Array.isArray(student.paymentHistory) ? student.paymentHistory : [];
        const currentPeriod = student.feePeriodKey || 'initial';
        const completedPayments = history.filter(p => p.feePeriodKey === currentPeriod && ['Completed', 'Verified'].includes(p.status));
        const computedAmountPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        student.amountPaid = computedAmountPaid;
        const totalFeesValue = Number(student.totalFees) || 0;
        student.balance = totalFeesValue - computedAmountPaid;
        student.paymentStatus = completedPayments.length > 0 ? 'Completed' : (history.some(p => p.status === 'Pending') ? 'Pending' : 'Pending');

        if (history.length > 0) {
            history[history.length - 1].balanceAfter = student.balance;
        }

        const result = await student.save();
        
        // Re-fetch to ensure we have fresh data
        const updatedStudent = await Student.findById(studentId);

        res.send({
            message: 'Payment submitted for verification. The school must confirm the payment before it is added to the balance.',
            receiptNumber,
            studentId: updatedStudent._id,
            studentName: updatedStudent.name,
            amountPaid: updatedStudent.amountPaid,
            balance: updatedStudent.balance,
            paymentStatus: updatedStudent.paymentStatus,
            totalFees: updatedStudent.totalFees,
        });
    } catch (error) {
        console.error('Parent payment error:', error);
        res.status(500).json({ message: 'Payment processing failed', error: error.message });
    }
};

// Get parent's children/students
const getParentStudents = async (req, res) => {
    try {
        const student = await getParentOwnedStudent(req, res);
        if (!student) return;
        const students = [student];

        const studentData = students.map((s) => {
            const studentObj = s && typeof s.toObject === 'function' ? s.toObject({ getters: true }) : s;
            const resolvedId = studentObj?._id || studentObj?.id || studentObj?.studentId;
            return {
                id: resolvedId,
                studentId: resolvedId,
                name: studentObj?.name,
                admissionNo: studentObj?.admissionNo,
                rollNum: studentObj?.rollNum,
                totalFees: studentObj?.totalFees,
                amountPaid: studentObj?.amountPaid,
                balance: studentObj?.balance,
                paymentStatus: studentObj?.paymentStatus,
            };
        });

        res.send(studentData);
    } catch (error) {
        console.error('Get parent students error:', error);
        res.status(500).json({ message: 'Failed to fetch students', error: error.message });
    }
};

const getParentStudentProgress = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.query.studentId || req.body.studentId;
        const student = await getParentOwnedStudent(req, res, studentId);
        if (!student) return;
        await student.populate('sclassName', 'sclassName');
        await student.populate({ path: 'examResult.subName', select: 'subName teacher', populate: { path: 'teacher', select: 'name' } });
        await student.select?.('-password');

        if (!student) {
            return res.status(404).send({ message: 'Student not found' });
        }

        const examResult = (student.examResult || []).map((result) => ({
            ...getComputedResult(result),
            subjectTeacher: result.subName?.teacher?.name || 'Not assigned',
            subject: result.subName?.subName || 'Unknown Subject',
            subjectId: String(result.subName?._id || result.subName || ''),
        }));

        const totalMarks = examResult.reduce((sum, result) => sum + Number(result.marksObtained || 0), 0);
        const totalPoints = examResult.reduce((sum, result) => sum + Number(result.points || 0), 0);
        const average = examResult.length ? totalMarks / examResult.length : 0;

        const resultPayload = {
            id: student._id || student.id,
            studentId: student._id || student.id,
            name: student.name,
            admissionNo: student.admissionNo,
            rollNum: student.rollNum,
            className: student.sclassName?.sclassName || 'N/A',
            stream: student.stream || student.streamName || null,
            term: student.term || student.session || 'Not set',
            school: student.school || null,
            classTeacherRemarks: student.classTeacherRemarks || student.teacherRemarks || '',
            principalRemarks: student.principalRemarks || student.headTeacherRemarks || '',
            nextSchoolOpeningDate: student.nextSchoolOpeningDate || student.nextOpeningDate || null,
            reportSummary: {
                totalMarks,
                totalPoints,
                average,
                totalMarksPossible: examResult.length * 100,
                overallRank: null,
                overallOutOf: null,
                subjectRanks: {},
            },
            examResult,
        };

        res.send(resultPayload);
    } catch (error) {
        console.error('Get parent progress error:', error);
        res.status(500).json({ message: 'Failed to fetch student progress report', error: error.message });
    }
};

// Initiate M-Pesa STK Push for fee payment
const initiateStk = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { amount, phoneNumber } = req.body;

        if (!amount || Number(amount) <= 0) {
            return res.status(400).send({ message: 'Please enter a valid payment amount' });
        }

        if (!phoneNumber) {
            return res.status(400).send({ message: 'Phone number is required' });
        }

        const student = await getParentOwnedStudent(req, res, studentId);
        if (!student) return;

        const schoolSettings = await Settings.findOne({ school: student.school }).select('mpesaSettings');
        const mpesaSettings = schoolSettings?.mpesaSettings;
        if (mpesaSettings?.enabled && (!mpesaSettings.consumerKey || !mpesaSettings.consumerSecret || !mpesaSettings.businessShortCode || !mpesaSettings.passkey)) {
            return res.status(400).send({ message: 'M-Pesa is enabled but its school credentials are incomplete.' });
        }
        // Initiate STK Push
        const stkResult = await initiateStkPush(
            phoneNumber,
            amount,
            `${student.admissionNo}-${studentId}`,
            `School Fee Payment - ${student.name}`,
            mpesaSettings?.enabled ? mpesaSettings.toObject() : undefined
        );

        if (!stkResult.success) {
            return res.status(500).send({ message: 'Failed to initiate payment: ' + stkResult.error });
        }

        // Create pending payment record
        const receiptNumber = `STK-${student.admissionNo}-${Date.now()}`;

        student.paymentHistory.push({
            amount: Number(amount),
            paymentMethod: 'M-Pesa STK Push',
            receiptNumber,
            status: 'Pending',
            transactionId: stkResult.checkoutRequestId,
            date: new Date(),
            balanceAfter: student.balance
        });
        await tagPaymentWithAcademicPeriod(student, student.paymentHistory[student.paymentHistory.length - 1]);

        await student.save();

        res.send({
            message: 'STK push initiated successfully. Enter PIN on your phone to complete payment',
            receiptNumber,
            checkoutRequestId: stkResult.checkoutRequestId,
            requestId: stkResult.requestId,
            responseCode: stkResult.responseCode,
            studentId: student._id
        });
    } catch (error) {
        console.error('STK Push initiation error:', error);
        res.status(500).json({ message: 'Failed to initiate payment', error: error.message });
    }
};

// Create a pending STK payment without calling external M-Pesa (for local testing)
const mockInitiateStk = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { amount, phoneNumber } = req.body;

        if (!amount || Number(amount) <= 0) {
            return res.status(400).send({ message: 'Please enter a valid payment amount' });
        }

        const student = await getParentOwnedStudent(req, res, studentId);
        if (!student) return;

        const checkoutRequestId = `MOCK_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const receiptNumber = `MOCK-STK-${student.admissionNo || student.rollNum}-${Date.now()}`;

        student.paymentHistory.push({
            amount: Number(amount),
            paymentMethod: 'M-Pesa STK Push',
            receiptNumber,
            status: 'Pending',
            transactionId: checkoutRequestId,
            checkoutRequestId,
            date: new Date(),
            balanceAfter: student.balance,
            phoneNumber: phoneNumber || ''
        });
        await tagPaymentWithAcademicPeriod(student, student.paymentHistory[student.paymentHistory.length - 1]);

        await student.save();

        return res.send({ message: 'Mock STK pending payment created', checkoutRequestId, receiptNumber, studentId: student._id });
    } catch (error) {
        console.error('Mock STK initiation error:', error);
        res.status(500).json({ message: 'Failed to create mock STK payment', error: error.message });
    }
};

// Check M-Pesa STK Push Status
const checkStkStatus = async (req, res) => {
    try {
        const { checkoutRequestId, studentId } = req.body;

        if (!checkoutRequestId) {
            return res.status(400).send({ message: 'Checkout request ID is required' });
        }

        const student = await getParentOwnedStudent(req, res, studentId);
        if (!student) return;

        const schoolSettings = await Settings.findOne({ school: student.school }).select('mpesaSettings');
        const mpesaSettings = schoolSettings?.mpesaSettings;
        const statusResult = await queryStkPushStatus(
            checkoutRequestId,
            mpesaSettings?.enabled ? mpesaSettings.toObject() : undefined
        );

        if (!statusResult.success) {
            return res.status(500).send({ message: 'Failed to check payment status' });
        }

        // Find payment record
        const paymentIndex = student.paymentHistory.findIndex(
            p => p.checkoutRequestId === checkoutRequestId
        );

        if (paymentIndex === -1) {
            return res.status(404).send({ message: 'Payment record not found' });
        }

        // Result Code: 0 = Success, 1032 = User Cancelled
        const isSuccess = statusResult.resultCode === '0';
        
        if (isSuccess) {
            // Payment successful - update payment record and recompute totals from paymentHistory
            const paymentRecord = student.paymentHistory[paymentIndex];
            paymentRecord.status = 'Completed';

            const currentPeriod = student.feePeriodKey || 'initial';
            const completedPayments = (student.paymentHistory || []).filter(p => p.feePeriodKey === currentPeriod && ['Completed', 'Verified'].includes(p.status));
            const computedAmountPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            student.amountPaid = computedAmountPaid;
            
            // Ensure totalFees is a number
            const totalFeesValue = Number(student.totalFees) || 0;
            student.balance = totalFeesValue - computedAmountPaid;
            student.paymentStatus = 'Completed';

            paymentRecord.balanceAfter = student.balance;

            await student.save();
            
            // Re-fetch to ensure fresh data
            const updatedStudent = await Student.findById(studentId);

            return res.send({
                message: 'Payment successful',
                paymentStatus: 'Completed',
                amountPaid: updatedStudent.amountPaid,
                balance: updatedStudent.balance,
                receiptNumber: paymentRecord.receiptNumber
            });
        } else if (statusResult.resultCode === '1032') {
            // User cancelled
            student.paymentHistory[paymentIndex].status = 'Cancelled';
            await student.save();

            return res.send({
                message: 'Payment cancelled by user',
                paymentStatus: 'Cancelled'
            });
        } else {
            // Still pending or other status
            return res.send({
                message: 'Payment status: ' + statusResult.resultDescription,
                paymentStatus: 'Pending',
                resultCode: statusResult.resultCode
            });
        }
    } catch (error) {
        console.error('STK Status check error:', error);
        res.status(500).json({ message: 'Failed to check payment status', error: error.message });
    }
};

// Handle M-Pesa Callback
const mpesaCallback = async (req, res) => {
    try {
        const body = req.body;
        const result = body.Result;

        if (!result) {
            return res.status(400).send({ message: 'Invalid callback data' });
        }

        const resultCode = result.ResultCode;
        const checkoutRequestId = result.CheckoutRequestID;

        // Find student with this payment
        // Try to find student payment first
        const student = await Student.findOne({
            'paymentHistory.checkoutRequestId': checkoutRequestId
        });

        if (student) {
            const paymentIndex = student.paymentHistory.findIndex(
                p => p.checkoutRequestId === checkoutRequestId
            );

            if (resultCode === '0') {
                const paymentRecord = student.paymentHistory[paymentIndex];
                const schoolSettings = await Settings.findOne({ school: student.school }).select('mpesaSettings');
                const mpesaSettings = schoolSettings?.mpesaSettings;
                const providerStatus = await queryStkPushStatus(
                    checkoutRequestId,
                    mpesaSettings?.enabled ? mpesaSettings.toObject() : undefined
                );
                const metadataItems = result.CallbackMetadata?.Item || [];
                const metadata = metadataItems.reduce((values, item) => {
                    values[item.Name] = item.Value;
                    return values;
                }, {});
                const callbackAmount = Number(metadata.Amount);
                const receiptNumber = metadata.MpesaReceiptNumber || result.MpesaReceiptNumber;

                if (!providerStatus.success || String(providerStatus.resultCode) !== '0') {
                    console.warn(`Rejected unverified M-Pesa callback for checkout ${checkoutRequestId}`);
                    return res.status(202).send({ message: 'Payment callback received; awaiting provider verification' });
                }
                if (!receiptNumber || (Number.isFinite(callbackAmount) && callbackAmount !== Number(paymentRecord.amount))) {
                    console.warn(`Rejected mismatched M-Pesa callback for checkout ${checkoutRequestId}`);
                    return res.status(400).send({ message: 'Payment callback does not match the pending payment' });
                }

                paymentRecord.status = 'Completed';

                const currentPeriod = student.feePeriodKey || 'initial';
                const completedPayments = (student.paymentHistory || []).filter(p => p.feePeriodKey === currentPeriod && ['Completed', 'Verified'].includes(p.status));
                const computedAmountPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                student.amountPaid = computedAmountPaid;
                const totalFeesValue = Number(student.totalFees) || 0;
                student.balance = totalFeesValue - computedAmountPaid;
                student.paymentStatus = 'Completed';

                paymentRecord.balanceAfter = student.balance;
                paymentRecord.mpesaReceiptNumber = receiptNumber;
                paymentRecord.transactionDate = metadata.TransactionDate || result.TransactionDate;

                await student.save();
                console.log(`Payment successful for student: ${student.name}, Balance: ${student.balance}`);
            } else {
                // Payment failed or cancelled
                student.paymentHistory[paymentIndex].status = 'Failed';
                await student.save();
                console.log(`Payment failed for student: ${student.name}, Code: ${resultCode}`);
            }

            return res.send({ message: 'OK' }); // Return OK to M-Pesa
        }

        // If not a student payment, attempt to reconcile against teacher salary payments
        const teacher = await require('../models/teacherSchema').findOne({
            'salaryHistory.checkoutRequestId': checkoutRequestId
        });

        if (!teacher) {
            console.log('Payment record not found for student or teacher:', checkoutRequestId);
            return res.send({ message: 'OK' }); // Return OK to M-Pesa
        }

        const salaryIndex = teacher.salaryHistory.findIndex(
            s => s.checkoutRequestId === checkoutRequestId
        );

        if (salaryIndex === -1) {
            console.log('Salary payment record not found for checkoutRequestId:', checkoutRequestId);
            return res.send({ message: 'OK' });
        }

        if (resultCode === '0') {
            const salaryRecord = teacher.salaryHistory[salaryIndex];
            salaryRecord.status = 'Paid';
            salaryRecord.approvalStatus = 'Approved';
            salaryRecord.approvedBy = salaryRecord.approvedBy || null;
            salaryRecord.approvalDate = salaryRecord.approvalDate || new Date();
            salaryRecord.mpesaReceiptNumber = result.MpesaReceiptNumber;
            salaryRecord.transactionDate = result.TransactionDate;

            await teacher.save();
            console.log(`Salary payment successful for teacher: ${teacher.name}, amount: ${salaryRecord.amount}`);
        } else {
            teacher.salaryHistory[salaryIndex].status = 'Failed';
            await teacher.save();
            console.log(`Salary payment failed for teacher: ${teacher.name}, Code: ${resultCode}`);
        }

        return res.send({ message: 'OK' });

        if (resultCode === '0') {
            // Payment successful
            const paymentRecord = student.paymentHistory[paymentIndex];
            paymentRecord.status = 'Completed';

            const currentPeriod = student.feePeriodKey || 'initial';
            const completedPayments = (student.paymentHistory || []).filter(p => p.feePeriodKey === currentPeriod && ['Completed', 'Verified'].includes(p.status));
            const computedAmountPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            student.amountPaid = computedAmountPaid;
            
            // Ensure totalFees is a number
            const totalFeesValue = Number(student.totalFees) || 0;
            student.balance = totalFeesValue - computedAmountPaid;
            student.paymentStatus = 'Completed';

            paymentRecord.balanceAfter = student.balance;
            paymentRecord.mpesaReceiptNumber = result.MpesaReceiptNumber;
            paymentRecord.transactionDate = result.TransactionDate;

            await student.save();
            console.log(`Payment successful for student: ${student.name}, Balance: ${student.balance}`);
        } else {
            // Payment failed or cancelled
            student.paymentHistory[paymentIndex].status = 'Failed';
            await student.save();
            console.log(`Payment failed for student: ${student.name}, Code: ${resultCode}`);
        }

        res.send({ message: 'OK' });
    } catch (error) {
        console.error('M-Pesa callback error:', error);
        res.status(500).json({ message: 'Callback processing error' });
    }
};

module.exports = {
    getParentContactByIdentifier,
    parentLogIn,
    communityPortalLogin,
    getStudentFeeInfo,
    parentPayFee,
    getParentStudents,
    getParentStudentProgress,
    initiateStk,
    // For testing without real M-Pesa integration
    mockInitiateStk,
    checkStkStatus,
    mpesaCallback,
};
