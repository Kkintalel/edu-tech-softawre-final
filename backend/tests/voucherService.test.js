const { validateVoucherLines } = require('../services/voucherService');

describe('Voucher validation', () => {
    test('accepts balanced payment voucher lines', () => {
        expect(() => validateVoucherLines('PV', [
            { accountId: 'expense', debitAmount: 15000, creditAmount: 0 },
            { accountId: 'bank', debitAmount: 0, creditAmount: 15000 },
        ])).not.toThrow();
    });

    test('accepts balanced receipt voucher lines', () => {
        expect(() => validateVoucherLines('RV', [
            { accountId: 'cash', debitAmount: 5000, creditAmount: 0 },
            { accountId: 'other-income', debitAmount: 0, creditAmount: 5000 },
        ])).not.toThrow();
    });

    test('rejects unbalanced voucher lines', () => {
        expect(() => validateVoucherLines('JV', [
            { accountId: 'expense', debitAmount: 15000, creditAmount: 0 },
            { accountId: 'bank', debitAmount: 0, creditAmount: 14999 },
        ])).toThrow('Journal entry is not balanced');
    });
});