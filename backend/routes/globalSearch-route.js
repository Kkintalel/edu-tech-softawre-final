const router = require('express').Router();
const { globalSearch, listSearchSchools } = require('../controllers/globalSearch-controller');

router.get('/', globalSearch);
router.get('/schools', listSearchSchools);

module.exports = router;