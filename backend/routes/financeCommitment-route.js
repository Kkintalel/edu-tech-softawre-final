const router = require('express').Router();
const {
    listPledges,
    createPledge,
    fulfillPledgeFromPayment,
    listPledgePaymentOptions,
    listProcurementOrders,
    createProcurementOrder,
    updateProcurementOrderStatus,
} = require('../controllers/financeCommitment-controller');

router.get('/pledges', listPledges);
router.post('/pledges', createPledge);
router.post('/pledges/:id/fulfill', fulfillPledgeFromPayment);
router.get('/pledges/:id/payments', listPledgePaymentOptions);
router.get('/orders', listProcurementOrders);
router.post('/orders', createProcurementOrder);
router.patch('/orders/:id/status', updateProcurementOrderStatus);

module.exports = router;