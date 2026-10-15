const normalizePaymentMethod = (method) => {
    const value = (method || '').toString().trim().toLowerCase().replace(/[^a-z]/g, '');
    if (['mpesa', 'mpesastkpush', 'lipanampesa'].includes(value)) return 'm-pesa';
    if (['bank', 'banktransfer', 'onlinetransfer', 'accountnumber'].includes(value)) return 'bank';
    if (value === 'cash') return 'cash';
    if (value === 'card') return 'card';
    if (value === 'cheque') return 'cheque';
    if (value === 'paybill') return 'paybill';
    return value;
};

const normalizeAcademicTerm = (term) => (term || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');

const selectFeeAssessment = (assessments = [], { academicYear, term, toDate } = {}) => {
    if (!academicYear) return null;
    const selectedTerm = normalizeAcademicTerm(term);
    const endOfRange = toDate ? new Date(`${toDate}T23:59:59.999Z`).getTime() : Infinity;
    return (assessments || [])
        .filter((assessment) => {
            if (String(assessment.academicYear || '') !== String(academicYear)) return false;
            if (selectedTerm && normalizeAcademicTerm(assessment.term) !== selectedTerm) return false;
            const effectiveAt = assessment.effectiveAt ? new Date(assessment.effectiveAt).getTime() : 0;
            return Number.isFinite(effectiveAt) && effectiveAt <= endOfRange;
        })
        .sort((left, right) => new Date(right.effectiveAt || 0) - new Date(left.effectiveAt || 0))[0] || null;
};

const getPaymentDateBounds = ({ fromDate, toDate } = {}) => {
    const start = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null;
    const endExclusive = toDate ? new Date(`${toDate}T00:00:00.000Z`) : null;
    if (endExclusive) endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    return { start, endExclusive };
};

const isWithinRange = (date, start, endExclusive) => {
    const timestamp = new Date(date).getTime();
    if (!Number.isFinite(timestamp)) return false;
    return (!start || timestamp >= start.getTime()) && (!endExclusive || timestamp < endExclusive.getTime());
};

const isDateRangeWithinPeriod = (fromDate, toDate, periodStart, periodEnd) => {
    const toUtcDay = (value) => {
        if (!value) return null;
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return NaN;
        return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    };
    const from = toUtcDay(fromDate);
    const to = toUtcDay(toDate);
    const start = toUtcDay(periodStart);
    const end = toUtcDay(periodEnd);

    if ([from, to, start, end].some(Number.isNaN)) return false;
    return (!fromDate || from >= start) && (!toDate || to <= end);
};

const buildFinancialReport = (students = [], filters = {}) => {
    const { start, endExclusive } = getPaymentDateBounds(filters);
    const requestedMethod = normalizePaymentMethod(filters.paymentMethod);
    const availableStreams = [...new Set(students.map((student) => student.stream || student.streamName).filter(Boolean))].sort();
    const rows = students.map((student) => {
        const classRecord = student.sclassName;
        const paymentHistory = (student.paymentHistory || []).filter((payment) => {
            const matchesDate = isWithinRange(payment.date, start, endExclusive);
            const matchesMethod = !requestedMethod || requestedMethod === 'all' || normalizePaymentMethod(payment.paymentMethod) === requestedMethod;
            const matchesYear = !filters.academicYear || !payment.academicYear || String(payment.academicYear) === String(filters.academicYear);
            const matchesTerm = !filters.term || !payment.term || normalizeAcademicTerm(payment.term) === normalizeAcademicTerm(filters.term);
            return matchesDate && matchesMethod && matchesYear && matchesTerm;
        });
        const completedPayments = paymentHistory.filter((payment) => ['Completed', 'Verified'].includes(payment.status));
        const paid = completedPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
        const feeAssessment = filters.academicYear
            ? selectFeeAssessment(student.feeAssessments, filters)
            : null;
        const hasHistoricalAssessment = !filters.academicYear || Boolean(feeAssessment);
        const expectedFees = hasHistoricalAssessment
            ? Number(filters.academicYear ? feeAssessment?.amount : student.totalFees || 0)
            : null;
        const balance = expectedFees === null ? null : Math.max(expectedFees - paid, 0);
        const status = expectedFees === null
            ? 'Unverified'
            : balance === 0 && expectedFees > 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';

        return {
            id: String(student._id || student.id),
            name: student.name || '',
            admissionNo: student.admissionNo || '',
            classId: String(classRecord?._id || classRecord || ''),
            className: classRecord?.sclassName || '',
            stream: student.stream || student.streamName || '',
            expectedFees,
            paid,
            periodAmountPaid: paid,
            balance,
            status,
            feeAssessmentRecorded: expectedFees !== null,
            lastPaymentDate: completedPayments.reduce((latest, payment) => {
                const current = new Date(payment.date);
                return !latest || current > latest ? current : latest;
            }, null),
            paymentHistory,
        };
    }).filter((row) => {
        const matchesStream = !filters.stream || filters.stream === 'all' || row.stream === filters.stream;
        const matchesStatus = !filters.status || filters.status === 'all' || row.status.toLowerCase() === filters.status.toLowerCase();
        return matchesStream && matchesStatus;
    });

    const summarize = (key) => {
        const groups = new Map();
        rows.forEach((row) => {
            const name = row[key] || 'Unassigned';
            const summary = groups.get(name) || { name, students: 0, feeAssessmentMissing: 0, expectedFees: 0, paid: 0, balance: 0 };
            summary.students += 1;
            if (row.expectedFees === null) summary.feeAssessmentMissing += 1;
            else summary.expectedFees += row.expectedFees;
            summary.paid += row.paid;
            summary.balance += row.balance || 0;
            groups.set(name, summary);
        });
        return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
    };

    const paymentByMethod = {};
    rows.forEach((row) => row.paymentHistory
        .filter((payment) => ['Completed', 'Verified'].includes(payment.status))
        .forEach((payment) => {
            const category = normalizePaymentMethod(payment.paymentMethod) || 'other';
            paymentByMethod[category] = (paymentByMethod[category] || 0) + Number(payment.amount || 0);
        }));

    const assessedRows = rows.filter((row) => row.expectedFees !== null);
    const totalFeesExpected = assessedRows.reduce((total, row) => total + row.expectedFees, 0);
    const totalFeesCollected = rows.reduce((total, row) => total + row.paid, 0);
    const totalOutstanding = assessedRows.reduce((total, row) => total + row.balance, 0);

    return {
        totalStudents: rows.length,
        studentsMissingFeeAssessment: rows.filter((row) => !row.feeAssessmentRecorded).length,
        totalFeesExpected,
        totalFeesCollected,
        totalOutstanding,
        collectionRate: totalFeesExpected ? (totalFeesCollected / totalFeesExpected) * 100 : 0,
        studentsPaid: rows.filter((row) => row.status === 'Paid').length,
        studentsPartial: rows.filter((row) => row.status === 'Partial').length,
        studentsUnpaid: rows.filter((row) => row.status === 'Unpaid').length,
        paymentByMethod,
        availableStreams,
        classSummary: summarize('className'),
        streamSummary: summarize('stream'),
        studentDetails: rows,
    };
};

module.exports = { buildFinancialReport, normalizePaymentMethod, isDateRangeWithinPeriod, selectFeeAssessment };
