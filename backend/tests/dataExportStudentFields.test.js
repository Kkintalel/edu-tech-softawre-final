const mockAdminFindById = jest.fn();
const mockStudentFind = jest.fn();
const mockTeacherFind = jest.fn();
const mockTeacherFindById = jest.fn();
const mockEmployeeFind = jest.fn();

jest.mock('../models/adminSchema.js', () => ({ findById: mockAdminFindById }));
jest.mock('../models/studentSchema.js', () => ({ find: mockStudentFind }));
jest.mock('../models/teacherSchema.js', () => ({ find: mockTeacherFind, findById: mockTeacherFindById }));
jest.mock('../models/employeeSchema.js', () => ({ find: mockEmployeeFind }));
jest.mock('../utils/auditLogger.js', () => ({ logAuditAction: jest.fn().mockResolvedValue(undefined) }));

const { exportSchoolData, exportTeacherStudents, exportAccountantData } = require('../controllers/dataExport-controller.js');

const makeResponse = () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    attachment: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return response;
};

const makeStudentQuery = (students) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(students) }),
});

const student = {
  _id: 'student-1',
  name: 'Amina Otieno',
  email: 'amina@example.com',
  admissionNo: 'ADM001',
  school: 'school-1',
  paymentHistory: [{ amount: 500, status: 'Completed' }],
};

describe('student data exports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminFindById.mockReturnValue({ select: jest.fn().mockResolvedValue({
      _id: 'admin-1', role: 'Admin', school: 'school-1',
    }) });
    mockStudentFind.mockReturnValue(makeStudentQuery([student]));
    mockTeacherFind.mockReturnValue(makeStudentQuery([]));
    mockEmployeeFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
  });

  test.each([
    ['school export', exportSchoolData, { get: (key) => key === 'x-admin-id' ? 'admin-1' : '' }, true],
    ['accountant export', exportAccountantData, { get: (key) => key === 'x-admin-id' ? 'admin-1' : '' }, true],
    ['assigned class export', exportTeacherStudents, { get: (key) => key === 'x-user-id' ? 'teacher-1' : '' }, false],
  ])('%s includes student name, email, and admission number', async (_label, handler, req, isAdminExport) => {
    if (isAdminExport && handler === exportAccountantData) {
      mockAdminFindById.mockReturnValue({ select: jest.fn().mockResolvedValue({
        _id: 'admin-1', role: 'Accountant', school: 'school-1',
      }) });
    }
    if (handler === exportTeacherStudents) {
      mockTeacherFindById.mockReturnValue({ select: jest.fn().mockResolvedValue({
        _id: 'teacher-1', name: 'Teacher', role: 'Teacher', school: 'school-1', teachSclass: 'class-1',
      }) });
    }
    const res = makeResponse();

    await handler({ get: req.get, query: {}, clientIP: '127.0.0.1' }, res);

    const csv = res.send.mock.calls[0][0];
    expect(csv).toContain('student_name');
    expect(csv).toContain('student_email');
    expect(csv).toContain('admission_no');
    expect(csv).toContain('Amina Otieno');
    expect(csv).toContain('amina@example.com');
    expect(csv).toContain('ADM001');
  });
});