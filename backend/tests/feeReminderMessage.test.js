const { createPaymentReminderMessage } = require('../services/smsService');

describe('fee reminder message', () => {
  test('uses student admission, fee, paid, and balance details in the message', () => {
    expect(createPaymentReminderMessage(
      'Amina Otieno',
      'ADM-2026-0042',
      50000,
      32000,
      18000,
      '123456'
    )).toBe(
      'Fee reminder for Amina Otieno (Admission No: ADM-2026-0042). Total fees: KES 50000. Paid: KES 32000. Outstanding balance: KES 18000. Paybill: 123456. Account: ADM-2026-0042.'
    );
  });
});
