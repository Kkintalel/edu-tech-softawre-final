const express = require('express');
const request = require('supertest');
const routes = require('../routes/route');
const Student = require('../models/studentSchema');
const Admin = require('../models/adminSchema');
const School = require('../models/schoolSchema');
const AcademicYear = require('../models/academicYearSchema');

const schoolId = '507f1f77bcf86cd799439011';
const adminId = '507f191e810c19729de860ea';
const admin = { _id: adminId, role: 'Admin', school: schoolId };
const app = express();
app.use(express.json());
app.use(routes);

const selectResult = (result) => ({ select: jest.fn().mockResolvedValue(result) });

const createStudentQuery = (students) => {
  const query = {
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(students),
    then: (resolve, reject) => Promise.resolve(students).then(resolve, reject),
  };
  return query;
};

describe('search and filter API requests', () => {
  let studentFind;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Admin, 'findById').mockImplementation(() => selectResult(admin));
    jest.spyOn(School, 'findOne').mockImplementation(() => selectResult(null));
    jest.spyOn(AcademicYear, 'findOne').mockImplementation(() => selectResult(null));
    studentFind = jest.spyOn(Student, 'find').mockImplementation(() => createStudentQuery([]));
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('search endpoint parses a general query and returns matching students', async () => {
    const students = [{ _id: 'student-1', name: 'Amina Otieno', totalFees: 1000, paymentHistory: [] }];
    studentFind.mockImplementation(() => createStudentQuery(students));

    const response = await request(app)
      .get(`/Student/Search/${schoolId}?query=Amina`)
      .set('x-admin-id', adminId);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ count: 1, results: [{ name: 'Amina Otieno' }] });
    expect(studentFind).toHaveBeenCalledWith(expect.objectContaining({
      school: { $in: [schoolId, adminId] },
      $or: expect.arrayContaining([
        { name: { $regex: 'Amina', $options: 'i' } },
        { admissionNo: { $regex: 'Amina', $options: 'i' } },
      ]),
    }));
  });

  test('payment report endpoint applies year and term to historical fees and payment rows', async () => {
    const student = {
      _id: 'student-1',
      name: 'Amina Otieno',
      admissionNo: 'ADM001',
      school: schoolId,
      sclassName: { _id: 'class-1', sclassName: 'Grade 8' },
      totalFees: 10000,
      feeAssessments: [
        { academicYear: '2026', term: 'Term 2', amount: 6000, effectiveAt: '2026-04-01T00:00:00.000Z' },
      ],
      paymentHistory: [
        { amount: 1000, paymentMethod: 'M-Pesa', status: 'Completed', date: '2026-05-05T10:00:00.000Z', academicYear: '2026', term: 'Term 2' },
        { amount: 2500, paymentMethod: 'Cash', status: 'Completed', date: '2026-05-06T10:00:00.000Z', academicYear: '2026', term: 'Term 2' },
        { amount: 3000, paymentMethod: 'M-Pesa', status: 'Completed', date: '2026-05-07T10:00:00.000Z', academicYear: '2026', term: 'Term 1' },
      ],
    };
    studentFind.mockImplementation(() => createStudentQuery([student]));
    jest.spyOn(AcademicYear, 'findOne').mockImplementation(() => selectResult({
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      terms: [{ termNumber: 2, termName: 'Term 2', startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-06-30T00:00:00.000Z' }],
    }));

    const response = await request(app)
      .get(`/Student/PaymentStats/${schoolId}`)
      .query({
        academicYear: '2026',
        term: 'Term 2',
        fromDate: '2026-04-01',
        toDate: '2026-06-30',
        classId: 'class-1',
        paymentMethod: 'Mpesa',
        status: 'Partial',
      })
      .set('x-admin-id', adminId);

    expect(response.status).toBe(200);
    expect(studentFind).toHaveBeenCalledWith({ school: schoolId, sclassName: 'class-1' });
    expect(response.body.studentDetails).toHaveLength(1);
    expect(response.body.studentDetails[0]).toMatchObject({
      expectedFees: 6000,
      paid: 1000,
      balance: 5000,
      status: 'Partial',
    });
    expect(response.body.studentDetails[0].paymentHistory).toHaveLength(1);
  });

  test('search endpoint rejects a missing search term', async () => {
    const response = await request(app)
      .get(`/Student/Search/${schoolId}`)
      .set('x-admin-id', adminId);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Please provide a search query');
    expect(studentFind).not.toHaveBeenCalled();
  });
});