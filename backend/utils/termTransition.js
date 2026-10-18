const toMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const calculateStudentTermTransition = (student, termFeeAmount) => {
    const feeAmount = Number(termFeeAmount);
    if (!Number.isFinite(feeAmount) || feeAmount < 0) {
        throw new Error('Term fee amount must be a non-negative number');
    }

    const feePeriodKey = student.feePeriodKey || 'initial';
    const storedFees = Number(student.totalFees || 0);
    const totalFees = storedFees === 0 ? Number(student.carriedForwardBalance || 0) : storedFees;
    const paidThisPeriod = (student.paymentHistory || [])
        .filter((payment) => {
            const paymentPeriod = payment.feePeriodKey || feePeriodKey;
            const status = String(payment.status || 'Completed').toLowerCase();
            return paymentPeriod === feePeriodKey && ['completed', 'verified', 'success'].includes(status);
        })
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const pendingPaymentCount = (student.paymentHistory || []).filter((payment) =>
        (payment.feePeriodKey || feePeriodKey) === feePeriodKey &&
        String(payment.status || 'Completed').toLowerCase() === 'pending'
    ).length;
    const carriedForwardBalance = toMoney(totalFees - paidThisPeriod);
    const projectedBalance = toMoney(carriedForwardBalance + feeAmount);

    return {
        feePeriodKey,
        paidThisPeriod: toMoney(paidThisPeriod),
        pendingPaymentCount,
        carriedForwardBalance,
        termFeeAmount: toMoney(feeAmount),
        projectedBalance,
        requiresCreditReview: projectedBalance < 0,
    };
};

module.exports = { calculateStudentTermTransition };