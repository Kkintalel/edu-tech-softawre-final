const mockStudentFindOne = jest.fn();
const mockCreatePledge = jest.fn();
const mockCreateOrder = jest.fn();
const mockGetRequestUser = jest.fn();
const mockFeePledgeFind = jest.fn();

jest.mock('../models/studentSchema', () => ({ findOne: mockStudentFindOne }));
jest.mock('../models/financeCommitmentSchema', () => ({
    FeePledge: { create: mockCreatePledge, find: mockFeePledgeFind },
    ProcurementOrder: { create: mockCreateOrder },
}));
jest.mock('../middleware/schoolAccess', () => ({ getRequestUser: mockGetRequestUser }));

const { listPledges, createPledge, createProcurementOrder } = require('../controllers/financeCommitment-controller');
const { encryptText } = require('../utils/encryption');

const makeResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

describe('finance commitment write permissions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetRequestUser.mockResolvedValue({
            type: 'admin',
            schoolId: 'school-1',
            user: {
                _id: 'accountant-1',
                role: 'Accountant',
                permissions: { recordExpenses: false },
            },
        });
    });

    test('allows an accountant to record a fee pledge without expense permission', async () => {
        const pledge = { _id: 'pledge-1' };
        mockStudentFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'student-1' }) });
        mockCreatePledge.mockResolvedValue(pledge);
        const req = {
            body: {
                studentId: 'student-1',
                promisedBy: 'Parent',
                promisedAmount: 1200,
                promisedDate: '2026-10-20',
            },
        };
        const res = makeResponse();

        await createPledge(req, res);

        expect(mockCreatePledge).toHaveBeenCalledWith(expect.objectContaining({
            school: 'school-1',
            student: 'student-1',
            promisedAmount: 1200,
        }));
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ pledge });
    });

    test('allows accountants to create procurement records for approval without expense permission', async () => {
        const order = { _id: 'order-1', status: 'Pending Approval' };
        mockCreateOrder.mockResolvedValue(order);
        const req = { body: { type: 'LPO', supplier: 'Supplier', description: 'Books', amount: 1200 } };
        const res = makeResponse();

        await createProcurementOrder(req, res);

        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
            school: 'school-1',
            type: 'LPO',
            supplier: 'Supplier',
            description: 'Books',
            amount: 1200,
            requestedBy: 'accountant-1',
        }));
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ order });
    });

    test('returns readable promised-by names for encrypted and plain-text pledge records', async () => {
        mockFeePledgeFind.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([
                {
                    _id: 'pledge-1',
                    promisedBy: encryptText('Jane Parent'),
                    student: { _id: 'student-1', name: encryptText('Amina Student') },
                },
                {
                    _id: 'pledge-2',
                    promisedBy: 'Legacy Parent',
                    student: { _id: 'student-2', name: 'Legacy Student' },
                },
            ]),
        });
        const res = makeResponse();

        await listPledges({ query: {} }, res);

        expect(res.json).toHaveBeenCalledWith({ pledges: [
            {
                _id: 'pledge-1',
                promisedBy: 'Jane Parent',
                student: { _id: 'student-1', name: 'Amina Student' },
            },
            {
                _id: 'pledge-2',
                promisedBy: 'Legacy Parent',
                student: { _id: 'student-2', name: 'Legacy Student' },
            },
        ] });
    });
});