const cache = new Map();

const normalizeKeyPart = (value) => {
    if (value && typeof value === 'object' && value.toString) return value.toString();
    return value === undefined || value === null ? '' : String(value);
};

const buildAnalyticsCacheKey = (scope, filters = {}) => {
    const filterKey = Object.keys(filters).sort().map((key) => `${key}=${normalizeKeyPart(filters[key])}`).join('&');
    return `${normalizeKeyPart(scope)}|${filterKey}`;
};

const getCachedAnalytics = async (key, load, ttlMs = 20000) => {
    const current = cache.get(key);
    if (current && current.expiresAt > Date.now()) return current.value;

    const value = await load();
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
};

const invalidateAnalyticsCache = (schoolId) => {
    const normalizedSchoolId = normalizeKeyPart(schoolId);
    for (const key of cache.keys()) {
        if (!normalizedSchoolId || key.startsWith(`${normalizedSchoolId}|`)) cache.delete(key);
    }
};

module.exports = { buildAnalyticsCacheKey, getCachedAnalytics, invalidateAnalyticsCache };