const mockSave = jest.fn();

jest.mock('../models/auditLogsSchema', () => jest.fn().mockImplementation((entry) => ({
    ...entry,
    save: mockSave,
})));

const AuditLogs = require('../models/auditLogsSchema');
const { logAuditAction } = require('../utils/auditLogger');

describe('audit note generation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSave.mockResolvedValue(true);
    });

    test('generates an update note with the entity and changed field names', async () => {
        await logAuditAction({
            action: 'UPDATE',
            entityType: 'student',
            entityName: 'Amina Otieno',
            changedFields: ['balance', 'paymentStatus'],
            userRole: 'Admin',
        });

        expect(AuditLogs).toHaveBeenCalledWith(expect.objectContaining({
            resultMessage: 'Updated student "Amina Otieno". Changed fields: balance, paymentStatus.',
        }));
        expect(mockSave).toHaveBeenCalledTimes(1);
    });

    test('preserves a caller-provided audit message', async () => {
        await logAuditAction({
            action: 'EXPORT',
            entityType: 'report',
            entityName: 'Term 2 fees',
            resultMessage: 'Finance report exported successfully',
            userRole: 'Accountant',
        });

        expect(AuditLogs).toHaveBeenCalledWith(expect.objectContaining({
            resultMessage: 'Finance report exported successfully',
        }));
    });
});