const Timetable = require('../models/timetableSchema.js');
const Sclass = require('../models/sclassSchema.js');
const Subject = require('../models/subjectSchema.js');
const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Admin = require('../models/adminSchema.js');
const { verifyEntityBelongsToAdminSchool, getAdminIdFromReq, getRequestUser } = require('../middleware/schoolAccess.js');
const { logAuditAction } = require('../utils/auditLogger.js');
const { sendEmail } = require('../services/emailService.js');
const { sendSMS } = require('../services/smsService.js');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIMETABLE_SLOTS = [
    { period: 1, startTime: '08:00', endTime: '08:45', slotType: 'lesson', label: '' },
    { period: 2, startTime: '08:45', endTime: '09:30', slotType: 'lesson', label: '' },
    { period: 3, startTime: '09:30', endTime: '09:50', slotType: 'break', label: 'Break' },
    { period: 4, startTime: '09:50', endTime: '10:35', slotType: 'lesson', label: '' },
    { period: 5, startTime: '10:35', endTime: '11:20', slotType: 'lesson', label: '' },
    { period: 6, startTime: '11:20', endTime: '12:05', slotType: 'lesson', label: '' },
    { period: 7, startTime: '12:05', endTime: '13:00', slotType: 'lunch', label: 'Lunch' },
    { period: 8, startTime: '13:00', endTime: '13:45', slotType: 'lesson', label: '' },
    { period: 9, startTime: '13:45', endTime: '14:30', slotType: 'lesson', label: '' },
    { period: 10, startTime: '14:30', endTime: '15:15', slotType: 'lesson', label: '' },
    { period: 11, startTime: '15:15', endTime: '16:00', slotType: 'lesson', label: '' },
];
const PERIODS = TIMETABLE_SLOTS.map((slot) => slot.period);
const MAX_SLOTS = TIMETABLE_SLOTS.length;
const teachingSlots = TIMETABLE_SLOTS.filter((slot) => slot.slotType === 'lesson');

const slotKey = (day, period) => `${day}-${period}`;
const subjectKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

const buildOccupiedSlots = (timetables = [], excludeClassId = null) => {
    const occupiedTeachers = new Set();
    const occupiedSubjects = new Set();

    timetables.forEach((timetable) => {
        if (excludeClassId && timetable.sclass?.toString() === excludeClassId.toString()) return;
        (timetable.schedule || []).forEach((entry) => {
            const key = slotKey(entry.day, entry.period);
            if (entry.teacher) occupiedTeachers.add(`${key}-${entry.teacher.toString()}`);
            if (entry.subjectName && entry.subjectName !== 'Free Period') {
                occupiedSubjects.add(`${key}-${subjectKey(entry.subjectName)}`);
            }
        });
    });

    return { occupiedTeachers, occupiedSubjects };
};

const buildBalancedSchedule = (subjects, occupiedSlots = {}) => {
    const normalizedSubjects = subjects.map((subject) => ({
        subject,
        remaining: Math.max(0, Math.round(subject.sessions || 0)),
        teacherId: subject.teacher?._id?.toString() || null,
        teacherName: subject.teacher?.name || 'Unassigned',
    })).filter((item) => item.remaining > 0);

    const totalSessions = normalizedSubjects.reduce((sum, item) => sum + item.remaining, 0);
    const weeklyTeachingSlots = DAYS.length * teachingSlots.length;
    if (totalSessions > weeklyTeachingSlots) {
        throw new Error(`Requested subject sessions exceed available weekly lesson slots (${totalSessions} > ${weeklyTeachingSlots})`);
    }

    const schedule = [];
    for (const day of DAYS) {
        for (const slot of TIMETABLE_SLOTS) {
            const { period, startTime, endTime, slotType, label } = slot;
            if (slotType !== 'lesson') {
                schedule.push({ day, period, startTime, endTime, slotType, subject: null, teacher: null, subjectName: label, teacherName: label });
                continue;
            }
            const available = normalizedSubjects
                .filter((item) => item.remaining > 0)
                .filter((item) => !item.teacherId || !occupiedSlots.occupiedTeachers?.has(`${slotKey(day, period)}-${item.teacherId}`))
                .filter((item) => !occupiedSlots.occupiedSubjects?.has(`${slotKey(day, period)}-${subjectKey(item.subject.subName)}`));

            const candidates = available;

            if (candidates.length === 0) {
                if (normalizedSubjects.some((item) => item.remaining > 0)) {
                    throw new Error(`Unable to schedule all subjects without a teacher or subject collision at ${day}, period ${period}.`);
                }
                schedule.push({
                    day,
                    period,
                    startTime,
                    endTime,
                    slotType,
                    subject: null,
                    teacher: null,
                    subjectName: 'Free Period',
                    teacherName: 'Free Period',
                });
                continue;
            }

            candidates.sort((a, b) => {
                const loadA = a.subject.sessions - a.remaining;
                const loadB = b.subject.sessions - b.remaining;
                if (loadA !== loadB) return loadA - loadB;
                if (a.remaining !== b.remaining) return b.remaining - a.remaining;
                return a.subject.subName.localeCompare(b.subject.subName);
            });

            const chosen = candidates[0];
            chosen.remaining -= 1;

            schedule.push({
                day,
                period,
                startTime,
                endTime,
                slotType,
                subject: chosen.subject._id,
                teacher: chosen.teacherId,
                subjectName: chosen.subject.subName,
                teacherName: chosen.teacherName,
            });
        }
    }

    return schedule;
};

const validateTimetableSchedule = async (schedule, classId, schoolId) => {
    if (!Array.isArray(schedule) || schedule.length !== MAX_SLOTS) {
        return { valid: false, message: `Schedule must have exactly ${MAX_SLOTS} slots.` };
    }

    const subjects = await Subject.find({ sclassName: classId }).populate('teacher', 'name');
    const subjectMap = subjects.reduce((map, subject) => {
        map[subject._id.toString()] = subject;
        return map;
    }, {});

    const subjectCounts = {};
    const slotKeys = new Set();
    const existingTimetables = await Timetable.find({ school: schoolId, sclass: { $ne: classId } }).lean();
    const occupiedSlots = buildOccupiedSlots(existingTimetables);

    for (const entry of schedule) {
        if (!entry || typeof entry !== 'object') {
            return { valid: false, message: 'Each schedule entry must be an object.' };
        }

        const { day, period, subject, teacher } = entry;
        if (!DAYS.includes(day)) {
            return { valid: false, message: `Invalid day ${day}.` };
        }
        if (!PERIODS.includes(period)) {
            return { valid: false, message: `Invalid period ${period}.` };
        }

        const slot = TIMETABLE_SLOTS.find((item) => item.period === period);
        if (slot.slotType !== 'lesson') {
            if (subject || teacher) return { valid: false, message: `${slot.label} cannot have a subject or teacher.` };
            continue;
        }

        const slotKey = `${day}-${period}`;
        if (slotKeys.has(slotKey)) {
            return { valid: false, message: `Duplicate slot detected for ${slotKey}.` };
        }
        slotKeys.add(slotKey);

        if (subject) {
            const subjectId = subject.toString();
            const existing = subjectMap[subjectId];
            if (!existing) {
                return { valid: false, message: `Subject ${subjectId} does not belong to this class.` };
            }

            subjectCounts[subjectId] = (subjectCounts[subjectId] || 0) + 1;
            const maxSessions = Math.max(0, Math.round(existing.sessions || 0));
            if (subjectCounts[subjectId] > maxSessions) {
                return { valid: false, message: `Subject ${existing.subName} exceeds allowed sessions (${maxSessions}).` };
            }

            const expectedTeacherId = existing.teacher?._id ? existing.teacher._id.toString() : null;
            if (teacher && expectedTeacherId && teacher.toString() !== expectedTeacherId) {
                return { valid: false, message: `Teacher assignment does not match owner of subject ${existing.subName}.` };
            }

            if (teacher) {
                const teacherId = teacher.toString();
                if (occupiedSlots.occupiedTeachers.has(`${slotKey(day, period)}-${teacherId}`)) {
                    return { valid: false, message: `Teacher is already assigned at ${day}, period ${period} in another class.` };
                }
            }

            const subjectNameKey = subjectKey(existing.subName);
            if (occupiedSlots.occupiedSubjects.has(`${slotKey(day, period)}-${subjectNameKey}`)) {
                return { valid: false, message: `Subject ${existing.subName} is already scheduled at ${day}, period ${period} in another class.` };
            }
        }
    }

    return { valid: true, subjectMap };
};

const buildHistoryEntry = (action, adminId, adminRole, changesBefore, changesAfter, comment = '') => ({
    action,
    performedBy: adminId,
    performedByRole: adminRole,
    performedAt: new Date(),
    comment,
    changesBefore,
    changesAfter,
});

const notifyTimetableChange = async ({ sclass, subjects, admin, changeType }) => {
    try {
        const students = await Student.find({ sclassName: sclass._id, school: sclass.school }).select('name parentEmail parentPhone guardianEmail guardianPhone');
        const teacherEmails = new Set();
        const parentEmails = new Set();
        const parentPhones = new Set();

        subjects.forEach((subject) => {
            if (subject.teacher?.email) {
                teacherEmails.add(subject.teacher.email);
            }
        });

        students.forEach((student) => {
            if (student.parentEmail) parentEmails.add(student.parentEmail);
            if (student.parentPhone) parentPhones.add(student.parentPhone);
            if (student.guardianEmail) parentEmails.add(student.guardianEmail);
            if (student.guardianPhone) parentPhones.add(student.guardianPhone);
        });

        const className = sclass.sclassName;
        const adminName = admin?.name || 'Administrator';
        const subject = `Timetable updated for ${className}`;
        const html = `<p>Dear team,</p><p>The timetable for <strong>${className}</strong> has been ${changeType.toLowerCase()} by <strong>${adminName}</strong>.</p><p>Please review your assigned periods and notify the school administration if there are any questions.</p><p>Thank you.</p>`;
        const message = `Timetable for ${className} was ${changeType.toLowerCase()} by ${adminName}. Please review the schedule.`;

        await Promise.allSettled([
            ...[...teacherEmails].map((email) => sendEmail(email, subject, html)),
            ...[...parentEmails].map((email) => sendEmail(email, subject, html)),
            ...[...parentPhones].map((phone) => sendSMS(phone, message)),
        ]);
    } catch (notifyError) {
        console.warn('Timetable notification failed', notifyError.message || notifyError);
    }
};

const generateTimetableForClass = async (req, res) => {
    try {
        const adminId = getAdminIdFromReq(req);
        const classId = req.params.id;

        if (!adminId) {
            return res.status(401).send({ message: 'Admin credentials are required' });
        }

        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(403).send({ message: 'Unauthorized admin' });
        }

        if (!admin.permissions?.manageTimetables) {
            return res.status(403).send({ message: 'Admin does not have timetable permissions' });
        }

        const sclass = await Sclass.findById(classId);
        if (!sclass) {
            return res.status(404).send({ message: 'Class not found' });
        }

        if (!(await verifyEntityBelongsToAdminSchool(req, res, sclass))) return;

        const subjects = await Subject.find({ sclassName: classId }).populate('teacher', 'name email');
        if (!subjects.length) {
            return res.status(400).send({ message: 'No subjects found for this class' });
        }

        const existingTimetables = await Timetable.find({ school: sclass.school, sclass: { $ne: classId } }).lean();
        const schedule = buildBalancedSchedule(subjects, buildOccupiedSlots(existingTimetables, classId));

        let timetable = await Timetable.findOne({ sclass: classId, school: sclass.school });
        const historyEntry = buildHistoryEntry('GENERATED', admin._id, admin.role, timetable ? timetable.toObject() : null, schedule, 'Auto-generated timetable');

        if (timetable) {
            timetable.schedule = schedule;
            timetable.generatedAt = new Date();
            timetable.generatedBy = admin._id;
            timetable.updatedAt = new Date();
            timetable.updatedBy = admin._id;
            timetable.history.push(historyEntry);
            await timetable.save();
        } else {
            timetable = new Timetable({
                school: sclass.school,
                sclass: classId,
                generatedAt: new Date(),
                generatedBy: admin._id,
                updatedAt: new Date(),
                updatedBy: admin._id,
                schedule,
                history: [historyEntry],
            });
            await timetable.save();
        }

        await logAuditAction({
            school: sclass.school,
            user: admin._id,
            userName: admin.name,
            userRole: admin.role,
            action: 'CREATE',
            entityType: 'timetable',
            entityId: timetable._id,
            entityName: `${sclass.sclassName} timetable`,
            changesAfter: { scheduleLength: schedule.length },
            resultMessage: 'Timetable generated successfully',
            context: { endpoint: '/Timetable/Generate/:id', method: 'POST' },
        });

        notifyTimetableChange({ sclass, subjects, admin, changeType: 'Generated' });

        return res.send({ message: 'Timetable generated successfully', timetable });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to generate timetable', error: err.message });
    }
};

const updateTimetableForClass = async (req, res) => {
    try {
        const adminId = getAdminIdFromReq(req);
        const classId = req.params.id;

        if (!adminId) {
            return res.status(401).send({ message: 'Admin credentials are required' });
        }

        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(403).send({ message: 'Unauthorized admin' });
        }

        if (!admin.permissions?.manageTimetables) {
            return res.status(403).send({ message: 'Admin does not have timetable permissions' });
        }

        const sclass = await Sclass.findById(classId);
        if (!sclass) {
            return res.status(404).send({ message: 'Class not found' });
        }

        if (!(await verifyEntityBelongsToAdminSchool(req, res, sclass))) return;

        const schedule = req.body.schedule;
        const validationResult = await validateTimetableSchedule(schedule, classId, sclass.school);
        if (!validationResult.valid) {
            return res.status(400).send({ message: validationResult.message });
        }

        const subjects = await Subject.find({ sclassName: classId }).populate('teacher', 'name email');
        const timetable = await Timetable.findOne({ sclass: classId, school: sclass.school });
        const before = timetable ? timetable.toObject() : null;

        const historyEntry = buildHistoryEntry('MANUAL_EDIT', admin._id, admin.role, before, schedule, 'Manual timetable adjustment');

        if (timetable) {
            timetable.schedule = schedule.map((entry) => {
                const slot = TIMETABLE_SLOTS.find((item) => item.period === entry.period);
                if (slot.slotType !== 'lesson' || !entry.subject) {
                    return {
                        day: entry.day,
                        period: entry.period,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        slotType: slot.slotType,
                        subject: null,
                        teacher: null,
                        subjectName: slot.label || 'Free Period',
                        teacherName: slot.label || 'Free Period',
                    };
                }
                const subjectId = entry.subject.toString();
                const sub = validationResult.subjectMap[subjectId];
                return {
                    day: entry.day,
                    period: entry.period,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    slotType: slot.slotType,
                    subject: sub._id,
                    teacher: sub.teacher?._id || null,
                    subjectName: sub.subName,
                    teacherName: sub.teacher?.name || 'Unassigned',
                };
            });
            timetable.updatedAt = new Date();
            timetable.updatedBy = admin._id;
            timetable.history.push(historyEntry);
            await timetable.save();
        } else {
            const mappedSchedule = schedule.map((entry) => {
                const slot = TIMETABLE_SLOTS.find((item) => item.period === entry.period);
                if (slot.slotType !== 'lesson' || !entry.subject) {
                    return {
                        day: entry.day,
                        period: entry.period,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        slotType: slot.slotType,
                        subject: null,
                        teacher: null,
                        subjectName: slot.label || 'Free Period',
                        teacherName: slot.label || 'Free Period',
                    };
                }
                const sub = validationResult.subjectMap[entry.subject.toString()];
                return {
                    day: entry.day,
                    period: entry.period,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    slotType: slot.slotType,
                    subject: sub._id,
                    teacher: sub.teacher?._id || null,
                    subjectName: sub.subName,
                    teacherName: sub.teacher?.name || 'Unassigned',
                };
            });
            const newTimetable = new Timetable({
                school: sclass.school,
                sclass: classId,
                generatedAt: new Date(),
                generatedBy: admin._id,
                updatedAt: new Date(),
                updatedBy: admin._id,
                schedule: mappedSchedule,
                history: [historyEntry],
            });
            await newTimetable.save();
        }

        const savedTimetable = await Timetable.findOne({ sclass: classId, school: sclass.school });
        await logAuditAction({
            school: sclass.school,
            user: admin._id,
            userName: admin.name,
            userRole: admin.role,
            action: 'UPDATE',
            entityType: 'timetable',
            entityId: savedTimetable._id,
            entityName: `${sclass.sclassName} timetable`,
            changesBefore: before ? { scheduleCount: before.schedule?.length } : null,
            changesAfter: { scheduleCount: savedTimetable.schedule.length },
            resultMessage: 'Timetable updated successfully',
            context: { endpoint: '/Timetable/Update/:id', method: 'PUT' },
        });

        notifyTimetableChange({ sclass, subjects, admin, changeType: 'Updated' });

        return res.send({ message: 'Timetable updated successfully', timetable: savedTimetable });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to update timetable', error: err.message });
    }
};

const getTimetableForClass = async (req, res) => {
    try {
        const classId = req.params.id;
        const sclass = await Sclass.findById(classId);
        if (!sclass) {
            return res.status(404).send({ message: 'Class not found' });
        }

        if (!(await verifyEntityBelongsToAdminSchool(req, res, sclass))) return;

        const timetable = await Timetable.findOne({ sclass: classId })
            .populate('sclass', 'sclassName')
            .populate('school', 'schoolName');

        if (!timetable) {
            return res.status(404).send({ message: 'No timetable found for this class' });
        }

        return res.send(timetable);
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load timetable', error: err.message });
    }
};

module.exports = { generateTimetableForClass, updateTimetableForClass, getTimetableForClass };
