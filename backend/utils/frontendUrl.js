const getFrontendBaseUrl = (req) => {
    const configuredUrl = (process.env.FRONTEND_URL || '').split(',')[0].trim();
    if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

    const requestOrigin = req?.get?.('origin') || '';
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)) {
        return requestOrigin.replace(/\/+$/, '');
    }

    return 'http://localhost:3000';
};

module.exports = { getFrontendBaseUrl };
