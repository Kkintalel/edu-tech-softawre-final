const { buildStudentSearchSchoolFilter, buildStudentSearchConditions } = require('../controllers/student_controller');
const { createSearchToken } = require('../utils/searchTokens');

describe('Student search school scope', () => {
  test('includes school, admin, and requester school ids for legacy student records', () => {
    const filter = buildStudentSearchSchoolFilter({
      schoolId: 'school-doc-id',
      requesterId: 'school-admin-id',
      requesterRole: 'Admin',
      requesterSchool: 'school-doc-id',
    });

    expect(filter).toEqual({
      school: { $in: ['school-doc-id', 'school-admin-id'] },
    });
  });

  test('keeps Super Admin search restricted to the selected school', () => {
    expect(buildStudentSearchSchoolFilter({
      schoolId: 'school-doc-id',
      requesterId: 'super-admin-id',
      requesterRole: 'SuperAdmin',
    })).toEqual({ school: 'school-doc-id' });
  });

  test('searches encrypted student and parent names using indexed tokens', () => {
    expect(buildStudentSearchConditions({ query: 'Maya Kim' })).toContainEqual({
      $or: [
        { $and: [{ searchTokens: createSearchToken('maya') }, { searchTokens: createSearchToken('kim') }] },
        { $and: [{ parentNameSearchTokens: createSearchToken('maya') }, { parentNameSearchTokens: createSearchToken('kim') }] },
      ],
    });
  });

  test('still supports admission number and numeric roll number searches', () => {
    expect(buildStudentSearchConditions({ query: 'ADM-204' })).toContainEqual({
      admissionNo: { $regex: 'ADM-204', $options: 'i' },
    });
    expect(buildStudentSearchConditions({ query: '204' })).toContainEqual({ rollNum: 204 });
  });
});
