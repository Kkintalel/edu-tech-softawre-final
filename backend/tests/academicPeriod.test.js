const { resolveTermForDate } = require('../utils/academicPeriod');

describe('Academic period resolution', () => {
  const academicYear = {
    yearName: '2026',
    terms: [
      { termNumber: 1, termName: 'Term 1', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-03-31T23:59:59.999Z' },
      { termNumber: 2, termName: 'Term 2', startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-06-30T23:59:59.999Z' },
    ],
  };

  test('resolves payment dates to the configured term', () => {
    expect(resolveTermForDate(academicYear, '2026-05-14T10:00:00.000Z')).toEqual({
      academicYear: '2026',
      term: 'Term 2',
    });
  });

  test('does not invent a term when the date is outside configured terms', () => {
    expect(resolveTermForDate(academicYear, '2026-07-01T00:00:00.000Z')).toBeNull();
  });
});
