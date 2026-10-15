const { getParentContactByIdentifier } = require('../controllers/parent-controller');

describe('Parent login identifier', () => {
  const student = {
    parentEmail: 'parent@example.com',
    parentPhone: '0712 345 678',
    parentName: 'Parent One',
    guardianEmail: 'guardian@example.com',
    guardianPhone: '+254 700 111 222',
    guardianName: 'Guardian One',
  };

  test('matches an email to its saved parent contact', () => {
    expect(getParentContactByIdentifier(student, 'email', 'PARENT@example.com')).toMatchObject({
      email: 'parent@example.com',
      name: 'Parent One',
    });
  });

  test('matches equivalent local and international phone formats', () => {
    expect(getParentContactByIdentifier(student, 'phone', '+254712345678')).toMatchObject({
      email: 'parent@example.com',
      name: 'Parent One',
    });
  });

  test('does not match an unrelated phone number', () => {
    expect(getParentContactByIdentifier(student, 'phone', '0799000000')).toBeNull();
  });
});
