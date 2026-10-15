const mockCreate = jest.fn();
const mockFind = jest.fn();
const mockFindById = jest.fn();

jest.mock('../models/demoRequestSchema.js', () => ({
  create: mockCreate,
  find: mockFind,
}));

jest.mock('../models/adminSchema.js', () => ({
  findById: mockFindById,
}));

const { createDemoRequest, listDemoRequests } = require('../controllers/demoRequest-controller.js');
const { verifySuperAdmin } = require('../middleware/superadminAuth.js');

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  send: jest.fn(),
});

describe('demo request inbox', () => {
  beforeEach(() => jest.clearAllMocks());

  test('accepts a complete public demo request', async () => {
    mockCreate.mockResolvedValue({ _id: 'request-1' });
    const res = createResponse();

    await createDemoRequest({
      body: { school: 'North School', name: 'Sam', email: 'sam@example.com' },
    }, res);

    expect(mockCreate).toHaveBeenCalledWith({
      school: 'North School', name: 'Sam', email: 'sam@example.com', phone: '', message: '',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rejects a request missing required contact fields', async () => {
    const res = createResponse();

    await createDemoRequest({ body: { school: 'North School' } }, res);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects malformed email addresses', async () => {
    const res = createResponse();

    await createDemoRequest({
      body: { school: 'North School', name: 'Sam', email: 'not-an-email' },
    }, res);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('blocks school admins from the global demo inbox', async () => {
    mockFindById.mockResolvedValue({ _id: 'admin-1', role: 'Admin' });
    const req = {
      get: (header) => header === 'x-admin-id' ? 'admin-1' : null,
      body: {},
      query: {},
    };
    const res = createResponse();
    const next = jest.fn();

    await verifySuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns requests newest first for the protected inbox', async () => {
    const requests = [{ _id: 'request-1' }];
    const sort = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(requests) });
    mockFind.mockReturnValue({ sort });
    const res = createResponse();

    await listDemoRequests({}, res);

    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.json).toHaveBeenCalledWith(requests);
  });
});