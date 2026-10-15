const router = require('express').Router();
const { verifyAdmin, verifyFinanceReader, verifyFinanceWriter } = require('../middleware/superadminAuth');
const pettyCashController = require('../controllers/pettyCash-controller');
const voucherController = require('../controllers/voucher-controller');
const { uploadVoucherReceipts } = require('../middleware/voucherReceiptUpload');
const {
    createJournalEntry,
    getAccountLedger,
    getTrialBalance,
    closePeriod,
    reverseJournalEntry,
    getJournalById,
    getJournalAccounts,
    getJournalEntries,
    createBudget,
    getBudgetSummary,
    getBudgetVariance,
    getAuditLogs,
    getTrialBalanceReport,
    getBudgetDashboard,
    getBalanceSheetReport,
    getIncomeStatementReport,
    getCurrentAccountingPeriod,
    createAccountingPeriod,
    getBudgetAccounts,
    getBudgets,
    transitionBudget,
} = require('../controllers/accountingController');

router.post('/Accounting/Journal', verifyAdmin, verifyFinanceWriter, createJournalEntry);
router.get('/Accounting/Journal/Accounts/:schoolId', verifyFinanceReader, getJournalAccounts);
router.get('/Accounting/Journals/:schoolId/:periodId', verifyFinanceReader, getJournalEntries);
router.get('/Accounting/Journal/:id', verifyFinanceReader, getJournalById);
router.post('/Accounting/Journal/Reverse/:journalId', verifyAdmin, verifyFinanceWriter, reverseJournalEntry);
router.get('/Accounting/Ledger/:accountId', verifyFinanceReader, getAccountLedger);
router.get('/Accounting/Period/:schoolId', verifyFinanceReader, getCurrentAccountingPeriod);
router.post('/Accounting/Period/:schoolId', verifyAdmin, verifyFinanceWriter, createAccountingPeriod);
router.get('/Accounting/PettyCash/:schoolId', verifyFinanceReader, pettyCashController.getPettyCashSummary);
router.post('/Accounting/PettyCash/:schoolId/transactions', verifyAdmin, verifyFinanceWriter, pettyCashController.createPettyCashTransaction);
router.post('/Accounting/PettyCash/:schoolId/reconcile', verifyAdmin, verifyFinanceWriter, pettyCashController.reconcilePettyCash);
router.get('/Accounting/VoucherAccounts/:schoolId', verifyFinanceReader, voucherController.getVoucherAccounts);
router.get('/Accounting/VoucherPeriods/:schoolId', verifyFinanceReader, voucherController.getVoucherPeriods);
router.get('/Accounting/Vouchers/:schoolId', verifyFinanceReader, voucherController.listVouchers);
router.post('/Accounting/Vouchers/:schoolId', verifyAdmin, verifyFinanceWriter, voucherController.createVoucher);
router.put('/Accounting/Vouchers/:schoolId/:voucherId', verifyAdmin, verifyFinanceWriter, voucherController.updateVoucher);
router.post('/Accounting/Vouchers/:schoolId/:voucherId/receipts', verifyAdmin, verifyFinanceWriter, uploadVoucherReceipts, voucherController.uploadReceipts);
router.get('/Accounting/Vouchers/:schoolId/:voucherId/receipts/:receiptId', verifyFinanceReader, voucherController.downloadReceipt);
router.delete('/Accounting/Vouchers/:schoolId/:voucherId/receipts/:receiptId', verifyAdmin, verifyFinanceWriter, voucherController.removeReceipt);
router.get('/Accounting/Vouchers/:schoolId/:voucherId/Audit', verifyFinanceReader, voucherController.getVoucherAudit);
router.post('/Accounting/Vouchers/:schoolId/:voucherId/Submit', verifyAdmin, verifyFinanceWriter, voucherController.submitVoucher);
router.post('/Accounting/Vouchers/:schoolId/:voucherId/Approve', verifyAdmin, verifyFinanceWriter, voucherController.approveVoucher);
router.post('/Accounting/Vouchers/:schoolId/:voucherId/Reject', verifyAdmin, verifyFinanceWriter, voucherController.rejectVoucher);
router.post('/Accounting/Vouchers/:schoolId/:voucherId/Reverse', verifyAdmin, verifyFinanceWriter, voucherController.reverseVoucher);
router.get('/Accounting/TrialBalance/:schoolId/:periodId', verifyFinanceReader, getTrialBalanceReport || getTrialBalance);
router.get('/Accounting/Reports/TrialBalance/:schoolId/:periodId', verifyFinanceReader, getTrialBalanceReport);
router.get('/Accounting/Reports/BudgetVsActual/:schoolId/:periodId', verifyFinanceReader, getBudgetDashboard);
router.get('/Accounting/Reports/BalanceSheet/:schoolId/:periodId', verifyFinanceReader, getBalanceSheetReport);
router.get('/Accounting/Reports/IncomeStatement/:schoolId/:periodId', verifyFinanceReader, getIncomeStatementReport);
router.post('/Accounting/ClosePeriod/:periodId', verifyAdmin, verifyFinanceWriter, closePeriod);
router.get('/Accounting/Budget/Accounts/:schoolId', verifyFinanceReader, getBudgetAccounts);
router.get('/Accounting/Budgets/:schoolId/:periodId', verifyFinanceReader, getBudgets);
router.post('/Accounting/Budget', verifyAdmin, verifyFinanceWriter, createBudget);
router.post('/Accounting/Budget/:budgetId/:action', verifyAdmin, verifyFinanceWriter, transitionBudget);
router.get('/Accounting/Budget/:schoolId/:periodId', verifyFinanceReader, getBudgetSummary);
router.get('/Accounting/Budget/:schoolId/:periodId/:accountId', verifyFinanceReader, getBudgetVariance);
router.get('/Accounting/Audit/:schoolId', verifyFinanceReader, getAuditLogs);

module.exports = router;
