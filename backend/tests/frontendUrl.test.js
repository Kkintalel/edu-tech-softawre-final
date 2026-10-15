const { getFrontendBaseUrl } = require('../utils/frontendUrl');

describe('frontend reset-link URL', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  });

  test('uses the configured frontend origin when available', () => {
    process.env.FRONTEND_URL = 'https://school.example.com/';
    expect(getFrontendBaseUrl({ get: () => 'http://localhost:3002' })).toBe('https://school.example.com');
  });

  test('uses the local request origin when no deployment URL is configured', () => {
    delete process.env.FRONTEND_URL;
    expect(getFrontendBaseUrl({ get: () => 'http://localhost:3002' })).toBe('http://localhost:3002');
  });

  test('does not trust an arbitrary request origin', () => {
    delete process.env.FRONTEND_URL;
    expect(getFrontendBaseUrl({ get: () => 'https://attacker.example' })).toBe('http://localhost:3000');
  });
});
