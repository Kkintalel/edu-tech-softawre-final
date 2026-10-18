const base = 'http://127.0.0.1:5000';

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }
  return { status: response.status, ok: response.ok, data };
}

(async () => {
  const checks = [];

  const health = await request(`${base}/health`);
  checks.push({ name: 'GET /health', ...health });

  const login = await request(`${base}/AdminLogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jkoilel@gmail.com', password: '12345' })
  });
  checks.push({ name: 'POST /AdminLogin', ...login });

  const adminId = login.data && (login.data._id || login.data.id || login.data.adminId || login.data.userId);

  if (adminId) {
    const schools = await request(`${base}/SuperAdmin/Schools?status=Active&page=1&limit=5`, {
      headers: { 'x-admin-id': adminId }
    });
    checks.push({ name: 'GET /SuperAdmin/Schools', ...schools });
  }

  const studentLogin = await request(`${base}/StudentLogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'TEST2026001@school.test', password: '12345' })
  });
  checks.push({ name: 'POST /StudentLogin', ...studentLogin });

  const studentList = await request(`${base}/Students/64d000000000000000000001`);
  checks.push({ name: 'GET /Students/:id', ...studentList });

  console.log(JSON.stringify(checks, null, 2));
  process.exit(0);
})();
