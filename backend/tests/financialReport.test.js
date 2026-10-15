const { buildFinancialReport, isDateRangeWithinPeriod } = require('../utils/financialReport');

describe('Financial report calculations', () => {
  const students = [
    {
      _id: 'student-1',
      name: 'Student One',
      admissionNo: 'ADM001',
      totalFees: 50000,
      stream: '8A',
      sclassName: { _id: 'class-8', sclassName: 'Grade 8' },
      paymentHistory: [
        { amount: 40000, paymentMethod: 'M-Pesa STK Push', status: 'Completed', date: '2026-05-14T10:00:00.000Z' },
        { amount: 5000, paymentMethod: 'Cash', status: 'Pending', date: '2026-05-20T10:00:00.000Z' },
        { amount: 2000, paymentMethod: 'Cash', status: 'Completed', date: '2026-07-02T10:00:00.000Z' },
      ],
    },
    {
      _id: 'student-2',
      name: 'Student Two',
      admissionNo: 'ADM002',
      totalFees: 50000,
      stream: '8B',
      sclassName: { _id: 'class-8', sclassName: 'Grade 8' },
      paymentHistory: [
        { amount: 50000, paymentMethod: 'Bank Transfer', status: 'Verified', date: '2026-06-01T10:00:00.000Z' },
      ],
    },
  ];

  test('filters payments inclusively by date and method and computes fee summaries', () => {
    const report = buildFinancialReport(students, {
      fromDate: '2026-04-01',
      toDate: '2026-06-30',
      paymentMethod: 'm-pesa',
      stream: '8A',
    });

    expect(report.totalStudents).toBe(1);
    expect(report.totalFeesExpected).toBe(50000);
    expect(report.totalFeesCollected).toBe(40000);
    expect(report.totalOutstanding).toBe(10000);
    expect(report.collectionRate).toBe(80);
    expect(report.studentDetails[0]).toMatchObject({
      admissionNo: 'ADM001',
      className: 'Grade 8',
      stream: '8A',
      status: 'Partial',
    });
    expect(report.paymentByMethod['m-pesa']).toBe(40000);
  });

  test('builds class and stream summaries from the filtered student set', () => {
    const report = buildFinancialReport(students, {
      fromDate: '2026-04-01',
      toDate: '2026-06-30',
    });

    expect(report.classSummary).toEqual([
      { name: 'Grade 8', students: 2, feeAssessmentMissing: 0, expectedFees: 100000, paid: 90000, balance: 10000 },
    ]);
    expect(report.streamSummary.map(({ name, students }) => ({ name, students }))).toEqual([
      { name: '8A', students: 1 },
      { name: '8B', students: 1 },
    ]);
  });

  test('keeps custom report dates within the selected academic term', () => {
    const termStart = '2026-04-01T00:00:00.000Z';
    const termEnd = '2026-06-30T00:00:00.000Z';

    expect(isDateRangeWithinPeriod('2026-04-01', '2026-06-30', termStart, termEnd)).toBe(true);
    expect(isDateRangeWithinPeriod('2026-03-31', '2026-06-30', termStart, termEnd)).toBe(false);
    expect(isDateRangeWithinPeriod('2026-04-01', '2026-07-01', termStart, termEnd)).toBe(false);
  });

  test('uses the selected historical fee assessment rather than current fees', () => {
    const [student] = students;
    const report = buildFinancialReport([{
      ...student,
      totalFees: 70000,
      feeAssessments: [
        { academicYear: '2025', term: 'Term 2', amount: 45000, effectiveAt: '2025-04-01T00:00:00.000Z' },
        { academicYear: '2026', term: 'Term 2', amount: 50000, effectiveAt: '2026-04-01T00:00:00.000Z' },
      ],
    }], {
      academicYear: '2026',
      term: 'Term 2',
      fromDate: '2026-04-01',
      toDate: '2026-06-30',
    });

    expect(report.studentDetails[0]).toMatchObject({ expectedFees: 50000, paid: 40000, balance: 10000, status: 'Partial' });
  });

  test('does not substitute current fees when the requested historical assessment is missing', () => {
    const report = buildFinancialReport([{ ...students[0], totalFees: 70000 }], {
      academicYear: '2024',
      term: 'Term 2',
      fromDate: '2024-04-01',
      toDate: '2024-06-30',
    });

    expect(report.studentDetails[0]).toMatchObject({ expectedFees: null, balance: null, status: 'Unverified' });
    expect(report.studentsMissingFeeAssessment).toBe(1);
    expect(report.totalFeesExpected).toBe(0);
  });
});
