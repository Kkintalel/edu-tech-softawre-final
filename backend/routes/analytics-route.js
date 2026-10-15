const router = require('express').Router();
const {
    managementOverview,
    academicAnalytics,
    subjectAnalytics,
    classAnalytics,
    studentAnalytics,
    feeAnalytics,
    attendanceAnalytics,
    enrolmentAnalytics,
    reconciliationAnalytics,
    analyticsReports,
    teacherAnalytics,
    budgetAnalytics,
    createAnalyticsReport,
    getAnalyticsTargets,
    createAnalyticsTarget,
    getScheduledAnalyticsReports,
    createScheduledAnalyticsReport,
    deleteScheduledAnalyticsReport,
} = require('../controllers/analytics-controller');

router.get('/overview', managementOverview);
router.get('/academics', academicAnalytics);
router.get('/subjects', subjectAnalytics);
router.get('/classes', classAnalytics);
router.get('/students/:id', studentAnalytics);
router.get('/fees', feeAnalytics);
router.get('/attendance', attendanceAnalytics);
router.get('/enrolment', enrolmentAnalytics);
router.get('/reconciliation', reconciliationAnalytics);
router.get('/budget', budgetAnalytics);
router.get('/reports', analyticsReports);
router.post('/reports', createAnalyticsReport);
router.get('/teachers', teacherAnalytics);
router.get('/targets', getAnalyticsTargets);
router.post('/targets', createAnalyticsTarget);
router.get('/schedules', getScheduledAnalyticsReports);
router.post('/schedules', createScheduledAnalyticsReport);
router.delete('/schedules/:id', deleteScheduledAnalyticsReport);

module.exports = router;