const mockAdminFindById = jest.fn();
const mockSchoolFindOne = jest.fn();

jest.mock('../models/adminSchema.js', () => ({
  findById: mockAdminFindById,
}));

jest.mock('../models/teacherSchema.js', () => ({ findById: jest.fn() }));
jest.mock('../models/studentSchema.js', () => ({ findById: jest.fn() }));
jest.mock('../models/parentSchema.js', () => ({ findById: jest.fn() }));
jest.mock('../models/schoolSchema.js', () => ({ findOne: mockSchoolFindOne }));
jest.mock('../models/subscriptionSchema.js', () => ({ findById: jest.fn(), findOne: jest.fn() }));

const { verifyEntityBelongsToAdminSchool } = require('../middleware/schoolAccess.js');

const makeRequest = (adminId) => ({
  get: (header) => header === 'x-admin-id' ? adminId : null,
  body: {},
  query: {},
  params: {},
});

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
});

describe('school-admin password reset access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSchoolFindOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
  });

  test('denies a school admin access to a user in another school', async () => {
    const adminId = '507f191e810c19729de860ea';
    const schoolA = '507f1f77bcf86cd799439011';
    const schoolB = '507f191e810c19729de860eb';
    mockAdminFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: adminId, role: 'Admin', school: schoolA }),
    });
    const res = makeResponse();

    const allowed = await verifyEntityBelongsToAdminSchool(
      makeRequest(adminId),
      res,
      { school: schoolB }
    );

    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('allows a school admin to reset a user in their own school', async () => {
    const adminId = '507f191e810c19729de860ea';
    const schoolId = '507f1f77bcf86cd799439011';
    mockAdminFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: adminId, role: 'Admin', school: schoolId }),
    });

    const allowed = await verifyEntityBelongsToAdminSchool(
      makeRequest(adminId),
      makeResponse(),
      { school: schoolId }
    );

    expect(allowed).toBe(true);
  });
});