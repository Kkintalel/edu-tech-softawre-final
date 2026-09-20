const jwt = require('jsonwebtoken');

const getJwtSecret = () => process.env.JWT_SECRET || process.env.SECRET_KEY;

const issueAdminToken = (admin) => {
    const secret = getJwtSecret();
    if (!secret) throw new Error('JWT_SECRET or SECRET_KEY must be configured');

    return jwt.sign(
        { role: admin.role, email: admin.email },
        secret,
        { subject: String(admin._id), expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
};

const verifyAdminToken = (token) => {
    const secret = getJwtSecret();
    if (!secret) throw new Error('JWT_SECRET or SECRET_KEY must be configured');
    return jwt.verify(token, secret);
};

const getBearerToken = (req) => {
    const authorization = req.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return null;
    return authorization.slice(7).trim() || null;
};

const hasBearerToken = (req) => Boolean(req.get('authorization'));

const getAuthenticatedSubject = (req) => {
    const token = getBearerToken(req);
    if (!token) return null;
    try {
        const payload = verifyAdminToken(token);
        return payload.sub ? String(payload.sub) : null;
    } catch (error) {
        return null;
    }
};

module.exports = { issueAdminToken, verifyAdminToken, getBearerToken, hasBearerToken, getAuthenticatedSubject };