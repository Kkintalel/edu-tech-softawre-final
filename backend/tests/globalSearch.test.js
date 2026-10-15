jest.mock('../middleware/schoolAccess', () => ({ getRequestUser: jest.fn() }));
jest.mock('../utils/authToken', () => ({ hasBearerToken: jest.fn(), getAuthenticatedSubject: jest.fn() }));

const { getRequestUser } = require('../middleware/schoolAccess');
const { hasBearerToken, getAuthenticatedSubject } = require('../utils/authToken');
const { getScope } = require('../controllers/globalSearch-controller');
const { createSearchTokens } = require('../utils/searchTokens');

const response = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

describe('global search access', () => {
    beforeEach(() => jest.clearAllMocks());

    test('rejects caller-supplied identity headers without a valid bearer token', async () => {
        hasBearerToken.mockReturnValue(false);
        const res = response();

        const scope = await getScope({ query: {}, params: {} }, res);

        expect(scope).toBeNull();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(getRequestUser).not.toHaveBeenCalled();
    });

    test('denies a school admin requesting another school', async () => {
        hasBearerToken.mockReturnValue(true);
        getAuthenticatedSubject.mockReturnValue('admin-1');
        getRequestUser.mockResolvedValue({ type: 'admin', schoolId: 'school-1', user: { _id: 'admin-1', role: 'Admin' } });
        const res = response();

        const scope = await getScope({ query: { schoolId: 'school-2' }, params: {} }, res);

        expect(scope).toBeNull();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('requires SuperAdmin to select exactly one school outside platform overview', async () => {
        hasBearerToken.mockReturnValue(true);
        getAuthenticatedSubject.mockReturnValue('admin-1');
        getRequestUser.mockResolvedValue({ type: 'admin', schoolId: null, user: { _id: 'admin-1', role: 'SuperAdmin' } });
        const res = response();

        const scope = await getScope({ query: {}, params: {} }, res, 'academic');

        expect(scope).toBeNull();
        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('search token privacy', () => {
    test('supports partial name lookup without storing searchable plaintext', () => {
        const fullNameTokens = createSearchTokens('James Koikai');
        const prefixToken = createSearchTokens('Jam')[0];

        expect(fullNameTokens).toContain(prefixToken);
        expect(fullNameTokens).not.toContain('James');
        expect(fullNameTokens.every((token) => /^[a-f0-9]{64}$/.test(token))).toBe(true);
    });
});