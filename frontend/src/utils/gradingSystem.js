/**
 * Grading System Utility
 * Converts marks to grades based on the achievement level system
 */

export const GRADING_SYSTEMS = {
    achievement: {
        label: 'Achievement Levels (EE/ME/AE/BE)',
        entries: [
    { min: 90, max: 100, grade: 'EE1', level: 'AL8', points: 8, remark: 'Exceeding Expectation' },
    { min: 75, max: 89, grade: 'EE2', level: 'AL7', points: 7, remark: 'Exceeding Expectation' },
    { min: 58, max: 74, grade: 'ME1', level: 'AL6', points: 6, remark: 'Meeting Expectation' },
    { min: 41, max: 57, grade: 'ME2', level: 'AL5', points: 5, remark: 'Meeting Expectation' },
    { min: 31, max: 40, grade: 'AE1', level: 'AL4', points: 4, remark: 'Approaching Expectation' },
    { min: 21, max: 30, grade: 'AE2', level: 'AL3', points: 3, remark: 'Approaching Expectation' },
    { min: 11, max: 20, grade: 'BE1', level: 'AL2', points: 2, remark: 'Below Expectation' },
    { min: 0, max: 10, grade: 'BE2', level: 'AL1', points: 1, remark: 'Below Expectation' },
        ],
    },
    cdacc: {
        label: 'CDACC Competency Levels',
        entries: [
            { min: 80, max: 100, grade: 'M', level: 'Mastery', points: 4, remark: 'Mastery' },
            { min: 65, max: 79, grade: 'P', level: 'Proficient', points: 3, remark: 'Proficient' },
            { min: 50, max: 64, grade: 'C', level: 'Competent', points: 2, remark: 'Competent' },
            { min: 0, max: 49, grade: 'NYC', level: 'Not Yet Competent', points: 1, remark: 'Not Yet Competent' },
        ],
    },
    knec: {
        label: 'KNEC / KCSE Grades',
        entries: [
            { min: 80, max: 100, grade: 'A', level: 'Excellent', points: 12, remark: 'Excellent' },
            { min: 75, max: 79, grade: 'A-', level: 'Excellent', points: 11, remark: 'Excellent' },
            { min: 70, max: 74, grade: 'B+', level: 'Very Good', points: 10, remark: 'Very Good' },
            { min: 65, max: 69, grade: 'B', level: 'Very Good', points: 9, remark: 'Very Good' },
            { min: 60, max: 64, grade: 'B-', level: 'Good', points: 8, remark: 'Good' },
            { min: 55, max: 59, grade: 'C+', level: 'Good', points: 7, remark: 'Good' },
            { min: 50, max: 54, grade: 'C', level: 'Average', points: 6, remark: 'Average' },
            { min: 45, max: 49, grade: 'C-', level: 'Average', points: 5, remark: 'Average' },
            { min: 40, max: 44, grade: 'D+', level: 'Below Average', points: 4, remark: 'Below Average' },
            { min: 35, max: 39, grade: 'D', level: 'Below Average', points: 3, remark: 'Below Average' },
            { min: 30, max: 34, grade: 'D-', level: 'Needs Improvement', points: 2, remark: 'Needs Improvement' },
            { min: 0, max: 29, grade: 'E', level: 'Needs Improvement', points: 1, remark: 'Needs Improvement' },
        ],
    },
};

const KNEC_GRADES_BY_POINTS = {
    12: 'A',
    11: 'A-',
    10: 'B+',
    9: 'B',
    8: 'B-',
    7: 'C+',
    6: 'C',
    5: 'C-',
    4: 'D+',
    3: 'D',
    2: 'D-',
    1: 'E',
};

export const calculateKnecMean = (results = []) => {
    const knecResults = results.filter((result) => result?.gradingSystem === 'knec');
    if (!knecResults.length) return null;

    const totalPoints = knecResults.reduce((total, result) => {
        const points = Number(result.points);
        return total + (Number.isFinite(points) ? points : 0);
    }, 0);
    const meanPoints = totalPoints / knecResults.length;
    const roundedPoints = Math.min(12, Math.max(1, Math.round(meanPoints)));

    return {
        totalPoints,
        meanPoints,
        meanGrade: KNEC_GRADES_BY_POINTS[roundedPoints],
    };
};

export const getGradingSystemType = (type) => (
    Object.prototype.hasOwnProperty.call(GRADING_SYSTEMS, type) ? type : 'achievement'
);

/**
 * Calculate grade information from marks
 * @param {number} marks - The marks obtained (0-100)
 * @returns {object|null} Grade object or null if marks are invalid
 */
export const calculateGrade = (marks, systemType = 'achievement') => {
    if (marks === null || marks === undefined || marks === '') {
        return null;
    }

    const numMarks = parseFloat(marks);

    if (isNaN(numMarks) || numMarks < 0 || numMarks > 100) {
        return null;
    }

    const gradingTable = GRADING_SYSTEMS[getGradingSystemType(systemType)].entries;
    const gradeInfo = gradingTable.find(
        (entry) => numMarks >= entry.min && numMarks <= entry.max
    );

    return gradeInfo || null;
};

/**
 * Get grade color based on achievement level for UI purposes
 * @param {string} grade - The grade code (EE1, EE2, ME1, etc.)
 * @returns {string} Color code for the grade
 */
export const getGradeColor = (grade) => {
    if (!grade) return '#9E9E9E'; // grey for unknown

    if (grade.startsWith('EE')) return '#4CAF50'; // green - Exceeding
    if (grade.startsWith('ME')) return '#2196F3'; // blue - Meeting
    if (grade.startsWith('AE')) return '#FF9800'; // orange - Approaching
    if (grade.startsWith('BE')) return '#F44336'; // red - Below
    if (grade === 'M') return '#2E7D32';
    if (grade === 'P') return '#1565C0';
    if (grade === 'C') return '#EF6C00';
    if (grade === 'NYC') return '#C62828';
    if (grade === 'A' || grade === 'A-' || grade === 'B+') return '#2E7D32';
    if (grade === 'B' || grade === 'B-' || grade === 'C+') return '#1565C0';
    if (grade === 'C' || grade === 'C-' || grade === 'D+') return '#EF6C00';
    if (grade === 'D' || grade === 'D-' || grade === 'E') return '#C62828';
    if (grade === '1' || grade === '2') return '#2E7D32';
    if (grade === '3' || grade === '4') return '#1565C0';
    if (grade === '5' || grade === '6') return '#EF6C00';
    if (grade === '7') return '#C62828';

    return '#9E9E9E'; // default grey
};

/**
 * Format grade information for display
 * @param {object} gradeInfo - Grade information object from calculateGrade
 * @returns {string} Formatted grade string
 */
export const formatGrade = (gradeInfo) => {
    if (!gradeInfo) return 'N/A';
    return `${gradeInfo.grade} (${gradeInfo.level}) - ${gradeInfo.remark}`;
};

export default { calculateGrade, calculateKnecMean, getGradeColor, formatGrade, getGradingSystemType, GRADING_SYSTEMS };
