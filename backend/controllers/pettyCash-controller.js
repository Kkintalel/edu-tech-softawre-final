const { Account, AccountingPeriod, GeneralLedger, AuditLog } = require('../models/accountingSchema');
const AccountingService = require('../services/accountingService');
const { getRequestUser } = require('../middleware/schoolAccess');

const authorizePettyCashRequest = async (req, res, schoolId) => {
    const requester = await getRequestUser(req);
    if (!requester || requester.type !== 'admin') {
        res.status(401).json({ message: 'Authenticated finance access is required' });
        return null;
    }

    const roles = new Set([requester.user.role, ...(requester.user.roles || [])]);
    if (!roles.has('SuperAdmin') && String(requester.schoolId || '') !== String(schoolId)) {
        res.status(403).json({ message: 'You can only access petty cash for your own school' });
        return null;
    }
    if (!['Accountant', 'Admin', 'SuperAdmin'].some((role) => roles.has(role))) {
        res.status(403).json({ message: 'Your role cannot manage petty cash' });
        return null;
    }

    return { actorId: requester.user._id };
};

const getCashAccount = (schoolId) => Account.findOne({ schoolId, code: '1010', type: 'asset', active: true });

const getPettyCashBalance = async (schoolId, accountId) => {
    const rows = await GeneralLedger.find({ schoolId, accountId }).select('debitAmount creditAmount').lean();
    return rows.reduce((balance, row) => balance + Number(row.debitAmount || 0) - Number(row.creditAmount || 0), 0);
};

exports.getPettyCashSummary = async (req, res) => {
    try {
        const { schoolId } = req.params;
        if (!await authorizePettyCashRequest(req, res, schoolId)) return;

        const pettyCashAccount = await getCashAccount(schoolId);
        if (!pettyCashAccount) {
            return res.status(404).json({ message: 'Cash in Hand account 1010 is not set up for this school' });
        }

        const [rows, reconciliations, openPeriod] = await Promise.all([
            GeneralLedger.find({ schoolId, accountId: pettyCashAccount._id })
                .populate('journalEntryId', 'entryNo sourceModule description')
                .sort({ entryDate: -1, createdAt: -1 })
                .limit(100)
                .lean(),
            AuditLog.find({ schoolId, entityType: 'PettyCashReconciliation' })
                .sort({ changedAt: -1 })
                .limit(20)
                .lean(),
            AccountingPeriod.findOne({ schoolId, status: 'open' }).sort({ startDate: -1 }).lean(),
        ]);

        const balance = await getPettyCashBalance(schoolId, pettyCashAccount._id);
        return res.status(200).json({
            data: {
                account: { id: pettyCashAccount._id, code: pettyCashAccount.code, name: pettyCashAccount.name },
                balance,
                openPeriod,
                transactions: rows.map((row) => ({
                    id: row._id,
                    date: row.entryDate,
                    description: row.description || row.journalEntryId?.description || 'Petty cash movement',
                    entryNo: row.journalEntryId?.entryNo || '',
                    sourceModule: row.journalEntryId?.sourceModule || '',
                    debit: Number(row.debitAmount || 0),
                    credit: Number(row.creditAmount || 0),
                    movement: Number(row.debitAmount || 0) - Number(row.creditAmount || 0),
                })),
                reconciliations,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load petty cash' });
    }
};

exports.createPettyCashTransaction = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const requester = await authorizePettyCashRequest(req, res, schoolId);
        if (!requester) return;

        const { type, amount, description, expenseAccountId } = req.body;
        const numericAmount = Number(amount);
        if (!['fund', 'expense'].includes(type) || !Number.isFinite(numericAmount) || numericAmount <= 0 || !String(description || '').trim()) {
            return res.status(400).json({ message: 'Choose a valid transaction type and enter a description and positive amount' });
        }

        const period = await AccountingPeriod.findOne({ schoolId, status: 'open' }).sort({ startDate: -1 });
        if (!period) return res.status(400).json({ message: 'Create or open an accounting period before recording petty cash' });

        const pettyCashAccount = await getCashAccount(schoolId);
        if (!pettyCashAccount) return res.status(400).json({ message: 'Cash in Hand account 1010 is not set up for this school' });

        let lines;
        let sourceModule;
        if (type === 'fund') {
            const bankAccount = await Account.findOne({ schoolId, code: '1000', type: 'asset', active: true });
            if (!bankAccount) return res.status(400).json({ message: 'Cash in Bank account 1000 is not set up for this school' });
            lines = [
                { accountId: pettyCashAccount._id, debitAmount: numericAmount, creditAmount: 0, description: `Petty cash funded: ${description}`, referenceType: 'manual' },
                { accountId: bankAccount._id, debitAmount: 0, creditAmount: numericAmount, description: `Bank transfer to petty cash: ${description}`, referenceType: 'manual' },
            ];
            sourceModule = 'bank';
        } else {
            const expenseAccount = await Account.findOne({ _id: expenseAccountId, schoolId, type: 'expense', active: true });
            if (!expenseAccount) return res.status(400).json({ message: 'Select an active expense account for this petty-cash payment' });

            const currentBalance = await getPettyCashBalance(schoolId, pettyCashAccount._id);
            if (numericAmount > currentBalance) {
                return res.status(400).json({ message: `Insufficient petty cash. Available balance: ${currentBalance.toFixed(2)}` });
            }

            const projection = await AccountingService.getProjectedBudgetStatus({
                schoolId,
                periodId: period._id,
                accountId: expenseAccount._id,
                amount: numericAmount,
            });
            if (projection.status === 'over_budget') {
                return res.status(400).json({ message: 'Petty-cash expense blocked: projected spending exceeds the budget.', budgetCheck: projection });
            }

            lines = [
                { accountId: expenseAccount._id, debitAmount: numericAmount, creditAmount: 0, description: `Petty cash expense: ${description}`, referenceType: 'manual' },
                { accountId: pettyCashAccount._id, debitAmount: 0, creditAmount: numericAmount, description: `Petty cash paid: ${description}`, referenceType: 'manual' },
            ];
            sourceModule = 'procurement';
        }

        const result = await AccountingService.createJournalEntry({
            schoolId,
            periodId: period._id,
            description: `Petty cash ${type === 'fund' ? 'funding' : 'expense'}: ${String(description).trim()}`,
            sourceModule,
            postedBy: requester.actorId,
            lines,
        });

        return res.status(201).json({
            message: `Petty cash ${type === 'fund' ? 'funding' : 'expense'} recorded`,
            data: result,
            balance: await getPettyCashBalance(schoolId, pettyCashAccount._id),
        });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to record petty cash transaction' });
    }
};

exports.reconcilePettyCash = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const requester = await authorizePettyCashRequest(req, res, schoolId);
        if (!requester) return;

        const physicalBalance = Number(req.body.physicalBalance);
        if (!Number.isFinite(physicalBalance) || physicalBalance < 0) {
            return res.status(400).json({ message: 'Enter a valid non-negative physical cash count' });
        }

        const period = await AccountingPeriod.findOne({ schoolId, status: 'open' }).sort({ startDate: -1 });
        if (!period) return res.status(400).json({ message: 'Create or open an accounting period before reconciling petty cash' });

        const pettyCashAccount = await getCashAccount(schoolId);
        const shortageAccount = await Account.findOne({ schoolId, code: '5800', type: 'expense', active: true });
        const otherIncomeAccount = await Account.findOne({ schoolId, code: '4030', type: 'revenue', active: true });
        if (!pettyCashAccount || !shortageAccount || !otherIncomeAccount) {
            return res.status(400).json({ message: 'Petty cash, administrative expense, and other income accounts must be configured before reconciliation' });
        }

        const systemBalance = await getPettyCashBalance(schoolId, pettyCashAccount._id);
        const variance = Number((physicalBalance - systemBalance).toFixed(2));
        let journal = null;

        if (variance > 0) {
            journal = await AccountingService.createJournalEntry({
                schoolId,
                periodId: period._id,
                description: `Petty cash reconciliation surplus${req.body.notes ? `: ${req.body.notes}` : ''}`,
                sourceModule: 'manual',
                postedBy: requester.actorId,
                lines: [
                    { accountId: pettyCashAccount._id, debitAmount: variance, creditAmount: 0, description: 'Record physical petty cash surplus', referenceType: 'manual' },
                    { accountId: otherIncomeAccount._id, debitAmount: 0, creditAmount: variance, description: 'Petty cash reconciliation surplus', referenceType: 'manual' },
                ],
            });
        } else if (variance < 0) {
            const shortage = Math.abs(variance);
            journal = await AccountingService.createJournalEntry({
                schoolId,
                periodId: period._id,
                description: `Petty cash reconciliation shortage${req.body.notes ? `: ${req.body.notes}` : ''}`,
                sourceModule: 'manual',
                postedBy: requester.actorId,
                lines: [
                    { accountId: shortageAccount._id, debitAmount: shortage, creditAmount: 0, description: 'Record petty cash shortage', referenceType: 'manual' },
                    { accountId: pettyCashAccount._id, debitAmount: 0, creditAmount: shortage, description: 'Adjust petty cash to physical count', referenceType: 'manual' },
                ],
            });
        }

        await AuditLog.create({
            schoolId,
            entityType: 'PettyCashReconciliation',
            entityId: pettyCashAccount._id,
            action: 'reconcile',
            oldValue: { systemBalance },
            newValue: { physicalBalance },
            changedBy: requester.actorId,
            notes: `System balance ${systemBalance.toFixed(2)}; counted cash ${physicalBalance.toFixed(2)}; variance ${variance.toFixed(2)}.${req.body.notes ? ` ${String(req.body.notes).trim()}` : ''}`,
            source: 'api',
        });

        return res.status(200).json({
            message: variance ? 'Petty cash reconciled and the difference was journaled' : 'Petty cash reconciled; no adjustment was needed',
            systemBalance,
            physicalBalance,
            variance,
            balance: await getPettyCashBalance(schoolId, pettyCashAccount._id),
            journal: journal?.journalEntry || null,
        });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to reconcile petty cash' });
    }
};