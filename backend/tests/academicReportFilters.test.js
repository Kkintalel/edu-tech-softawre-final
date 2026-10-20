const {
  buildAcademicReportQuery,
  filterResultsForReport,
  getComputedResult,
  getKnecMean,
} = require('../controllers/student_controller');
const mongoose = require('mongoose');
const Student = require('../models/studentSchema');

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

  test('preserves marks and assessment fields from Mongoose result subdocuments', () => {
    const student = new Student({
      examResult: [{
        subName: new mongoose.Types.ObjectId(),
        examType: 'END_TERM',
        term: 'Term 1',
        academicYear: '2026',
        marksObtained: 84,
      }],
    });

    const result = getComputedResult(student.examResult[0]);

    expect(result).toMatchObject({
      examType: 'END_TERM',
      term: 'Term 1',
      academicYear: '2026',
      marksObtained: 84,
    });
  });

  test('uses KNEC letter grades and calculates mean points from the example scores', () => {
    const scores = [76, 82, 68, 57, 62, 73, 51, 65];
    const results = scores.map((marksObtained) => getComputedResult({ marksObtained, gradingSystem: 'knec' }));

    expect(results.map(({ grade, points }) => [grade, points])).toEqual([
      ['A-', 11],
      ['A', 12],
      ['B', 9],
      ['C+', 7],
      ['B-', 8],
      ['B+', 10],
      ['C', 6],
      ['B', 9],
    ]);
    expect(getKnecMean(results)).toEqual({ totalPoints: 72, meanPoints: 9, meanGrade: 'B' });
  });
});
