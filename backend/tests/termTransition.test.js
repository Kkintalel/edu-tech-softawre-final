const { calculateStudentTermTransition } = require('../utils/termTransition');

describe('student term transition calculations', () => {
    test('carries the unpaid amount and adds the new term fee without copying payments', () => {
        const student = {
            totalFees: 15000,
            feePeriodKey: '2026-Term 1',
            paymentHistory: [
                { amount: 10000, status: 'Completed', feePeriodKey: '2026-Term 1' },
                { amount: 4000, status: 'Pending', feePeriodKey: '2026-Term 1' },
                { amount: 3000, status: 'Completed', feePeriodKey: '2025-Term 3' },
            ],
        };

        expect(calculateStudentTermTransition(student, 12000)).toEqual({
            feePeriodKey: '2026-Term 1',
            paidThisPeriod: 10000,
            pendingPaymentCount: 1,
            carriedForwardBalance: 5000,
            termFeeAmount: 12000,
            projectedBalance: 17000,
            requiresCreditReview: false,
        });
        expect(student.paymentHistory).toHaveLength(3);
    });

    test('flags a credit that exceeds the incoming term fee', () => {
        const transition = calculateStudentTermTransition({
            totalFees: 0,
            feePeriodKey: '2026-Term 1',
            paymentHistory: [{ amount: 6000, status: 'Verified', feePeriodKey: '2026-Term 1' }],
        }, 5000);

        expect(transition.carriedForwardBalance).toBe(-6000);
        expect(transition.projectedBalance).toBe(-1000);
        expect(transition.requiresCreditReview).toBe(true);
    });
});