const {
  buildAcademicReportQuery,
  filterResultsForReport,
} = require('../controllers/student_controller');

describe('Academic report filters', () => {
  test('builds a strict year-term-assessment-class-stream-student filter set', () => {
    const query = buildAcademicReportQuery({
      schoolId: 'school-1',
      academicYear: '2026',
      term: 'Term 2',
      assessment: 'END_TERM',
      classId: 'class-7',
      stream: 'All Streams',
      studentId: 'student-13',
    });

    expect(query).toMatchObject({
      school: 'school-1',
      sclassName: 'class-7',
      _id: 'student-13',
    });
    expect(query).not.toHaveProperty('stream');
  });

  test('prevents results from different terms or assessments from being mixed', () => {
    const results = [
      { term: 'Term 1', examType: 'END_TERM', marksObtained: 70 },
      { term: 'Term 2', examType: 'CAT', marksObtained: 90 },
      { term: 'Term 2', examType: 'END_TERM', marksObtained: 82 },
      { term: 'Term 3', examType: 'END_TERM', marksObtained: 75 },
    ];

    const filtered = filterResultsForReport(results, 'Term 2', 'END_TERM');
    expect(filtered).toEqual([{ term: 'Term 2', examType: 'END_TERM', marksObtained: 82 }]);
  });
});
