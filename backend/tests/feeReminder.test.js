const { createPaymentReminderMessage } = require('../services/smsService');

describe('Fee reminder message', () => {
  test('includes the student, outstanding amount, total fees, and school paybill', () => {
    const message = createPaymentReminderMessage('Amina Otieno', 'ADM-50000', 50000, 37500, 12500, '123456');

    expect(message).toContain('Amina Otieno');
    expect(message).toContain('KES 12500');
    expect(message).toContain('KES 50000');
    expect(message).toContain('Paybill: 123456');
  });
});
