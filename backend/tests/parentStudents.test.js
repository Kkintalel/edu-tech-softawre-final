const mockStudentFind = jest.fn();
const mockStudentFindById = jest.fn();

jest.mock('../models/parentSchema', () => ({}));
jest.mock('../models/studentSchema', () => ({
  find: mockStudentFind,
  findById: mockStudentFindById,
}));
jest.mock('../middleware/schoolAccess', () => ({
  verifyEntityBelongsToAdminSchool: jest.fn(),
}));
jest.mock('../services/mpesaService', () => ({
  initiateStkPush: jest.fn(),
  queryStkPushStatus: jest.fn(),
}));

const { getParentStudents, getParentStudentProgress } = require('../controllers/parent-controller');

describe('getParentStudents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns children with an id field for the portal UI', async () => {
    const student = {
      _id: 'student-1',
      name: 'Amina',
      admissionNo: 'ADM-001',
    };
    mockStudentFind.mockReturnValue({
      select: jest.fn().mockResolvedValue([student]),
    });

    const req = { params: { parentEmail: 'parent@example.com' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    await getParentStudents(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'student-1' })
      ])
    );
  });

  test('returns child academic progress to the parent portal', async () => {
    const student = {
      _id: 'student-1',
      name: 'Amina',
      admissionNo: 'ADM-001',
      rollNum: '12',
      parentEmail: 'parent@example.com',
      guardianEmail: '',
      email: '',
      school: 'school-1',
      sclassName: { _id: 'class-1', sclassName: 'Grade 1' },
      term: 'Term 1',
      examResult: [
        {
          subName: { _id: 'subject-1', subName: 'Mathematics', teacher: { name: 'Mr. Kim' } },
          examType: 'CAT',
          marksObtained: 78,
          gradingSystem: 'achievement',
          term: 'Term 1',
          points: 7,
        }
      ],
      classTeacherRemarks: 'Good progress',
      principalRemarks: 'Keep up the good work',
      nextSchoolOpeningDate: '2026-01-15',
      toObject: () => ({
        _id: 'student-1',
        name: 'Amina',
        admissionNo: 'ADM-001',
        rollNum: '12',
        parentEmail: 'parent@example.com',
        guardianEmail: '',
        email: '',
        school: 'school-1',
        sclassName: { _id: 'class-1', sclassName: 'Grade 1' },
        term: 'Term 1',
        examResult: [{
          subName: { _id: 'subject-1', subName: 'Mathematics', teacher: { name: 'Mr. Kim' } },
          examType: 'CAT',
          marksObtained: 78,
          gradingSystem: 'achievement',
          term: 'Term 1',
          points: 7,
        }],
        classTeacherRemarks: 'Good progress',
        principalRemarks: 'Keep up the good work',
        nextSchoolOpeningDate: '2026-01-15',
      })
    };

    mockStudentFindById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(student),
    });
    mockStudentFind.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });

    const req = { params: { studentId: 'student-1' }, query: { parentEmail: 'parent@example.com' } };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() };

    await getParentStudentProgress(req, res);

    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      id: 'student-1',
      name: 'Amina',
      reportSummary: expect.objectContaining({ average: expect.any(Number) }),
      examResult: expect.arrayContaining([
        expect.objectContaining({ marksObtained: 78 })
      ])
    }));
  });
});
