const { getSchoolScopeFilter } = require('../controllers/admin-controller.js');

test('scopes stats to the current school for non-superadmin admins', () => {
  const admin = { role: 'Admin', school: 'school123', _id: 'admin456' };
  expect(getSchoolScopeFilter(admin)).toEqual({ school: 'school123' });
});

test('keeps superadmin stats global', () => {
  const admin = { role: 'SuperAdmin', _id: 'admin456' };
  expect(getSchoolScopeFilter(admin)).toEqual({});
});
