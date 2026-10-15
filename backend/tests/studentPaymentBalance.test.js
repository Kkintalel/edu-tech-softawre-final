const { createOrUpdatePaymentEntry, reconcileAmounts } = require('../controllers/student_controller');

describe('student fee payment balance', () => {
    test('counts a new payment in a promoted student active fee period', () => {
        const student = {
            _id: 'student-id',
            admissionNo: 'ADM-1',
            totalFees: 5000,
            amountPaid: 0,
            balance: 5000,
            feePeriodKey: 'promotion-class-2',
            paymentHistory: [],
        };

        createOrUpdatePaymentEntry(student, {
            amount: 1500,
            paymentMethod: 'Cash',
            status: 'Completed',
            receiptNumber: 'RCPT-1',
        });

        reconcileAmounts(student);

        expect(student.amountPaid).toBe(1500);
        expect(student.balance).toBe(3500);
        expect(student.paymentHistory[0].feePeriodKey).toBe('promotion-class-2');
    });
});