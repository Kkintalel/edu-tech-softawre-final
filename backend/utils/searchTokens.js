const crypto = require('crypto');

const getSearchKey = () => process.env.SEARCH_TOKEN_KEY || process.env.ENCRYPTION_KEY || 'school-search-token-key';

const normalizeSearchValue = (value) => (value || '').toString().trim().toLowerCase().normalize('NFKC');
const getSearchTerms = (value) => normalizeSearchValue(value).match(/[\p{L}\p{N}]+(?:[._%+-][\p{L}\p{N}]+)*/gu) || [];
const createSearchToken = (value) => crypto.createHmac('sha256', getSearchKey()).update(normalizeSearchValue(value)).digest('hex');

const createSearchTokens = (...values) => {
    const tokens = new Set();
    values.forEach((value) => {
        getSearchTerms(value).forEach((part) => {
            const maxPrefixLength = Math.min(part.length, 20);
            for (let length = 2; length <= maxPrefixLength; length += 1) {
                const prefix = part.slice(0, length);
                tokens.add(createSearchToken(prefix));
            }
        });
    });
    return [...tokens];
};

module.exports = { createSearchToken, createSearchTokens, getSearchTerms, normalizeSearchValue };