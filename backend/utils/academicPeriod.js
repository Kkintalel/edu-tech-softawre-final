const AcademicYear = require('../models/academicYearSchema');

const resolveTermForDate = (academicYear, date = new Date()) => {
    if (!academicYear) return null;
    const timestamp = new Date(date).getTime();
    if (!Number.isFinite(timestamp)) return null;

    const term = (academicYear.terms || []).find((entry) => {
        const start = entry.startDate ? new Date(entry.startDate).getTime() : NaN;
        const end = entry.endDate ? new Date(entry.endDate).getTime() : NaN;
        return Number.isFinite(start) && Number.isFinite(end) && timestamp >= start && timestamp <= end;
    });

    if (!term) return null;
    const termName = term.termName || (term.termNumber ? `Term ${term.termNumber}` : '');
    if (!termName) return null;

    return {
        academicYear: String(academicYear.yearName),
        term: termName,
    };
};

const resolveAcademicPeriod = async (date = new Date(), schoolId) => {
    const timestamp = new Date(date);
    if (!Number.isFinite(timestamp.getTime())) return null;

    const query = {
        startDate: { $lte: timestamp },
        endDate: { $gte: timestamp },
    };
    if (schoolId) {
        query.$or = [
            { schools: schoolId },
            { schools: { $exists: false } },
            { schools: { $size: 0 } },
        ];
    }

    const academicYear = await AcademicYear.findOne(query).sort({ isActive: -1, startDate: -1 });
    return resolveTermForDate(academicYear, timestamp);
};

const recordFeeAssessment = async (student, amount, effectiveAt = new Date(), changedBy = null, resolvedPeriod = null) => {
    const period = resolvedPeriod || await resolveAcademicPeriod(effectiveAt, student.school);
    if (!period || !student.feeAssessments) return null;

    const existing = student.feeAssessments.find((assessment) =>
        assessment.academicYear === period.academicYear && assessment.term === period.term
    );
    if (existing && Number(existing.amount) === Number(amount)) return existing;

    const assessment = {
        ...period,
        amount: Number(amount),
        effectiveAt,
        changedBy: changedBy && require('mongoose').Types.ObjectId.isValid(changedBy) ? changedBy : null,
    };
    student.feeAssessments.push(assessment);
    return assessment;
};

const tagPaymentWithAcademicPeriod = async (student, payment, date = payment.date || new Date()) => {
    if (payment.academicYear && payment.term) return payment;
    const period = await resolveAcademicPeriod(date, student.school);
    if (period) {
        payment.academicYear = period.academicYear;
        payment.term = period.term;
    }
    return payment;
};

module.exports = {
    resolveTermForDate,
    resolveAcademicPeriod,
    recordFeeAssessment,
    tagPaymentWithAcademicPeriod,
};
