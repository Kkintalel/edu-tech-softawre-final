const AccountingService = require('../services/accountingService');
const { Account, AccountingPeriod, GeneralLedger, JournalEntry, Budget, AuditLog } = require('../models/accountingSchema');
const { getRequestUser } = require('../middleware/schoolAccess');
const { initializeSchoolAccounting } = require('../utils/schoolAccountingSetup');

const authorizeBudgetRequest = async (req, res, schoolId, allowedRoles) => {
    const requester = await getRequestUser(req);
    if (!requester || requester.type !== 'admin') {
        res.status(401).json({ message: 'Authenticated school finance access is required' });
        return null;
    }

    const actor = requester.user;
    const roles = new Set([actor.role, ...(actor.roles || [])]);
    const isSuperAdmin = roles.has('SuperAdmin');
    if (!isSuperAdmin && String(requester.schoolId || '') !== String(schoolId)) {
        res.status(403).json({ message: 'You can only access budgets for your own school' });
        return null;
    }
    if (!allowedRoles.some((role) => roles.has(role))) {
        res.status(403).json({ message: 'Your role cannot perform this budget action' });
        return null;
    }
    return { actorId: actor._id, role: actor.role };
};

exports.getBudgetAccounts = async (req, res) => {
    try {
        const { schoolId } = req.params;
        if (!await authorizeBudgetRequest(req, res, schoolId, ['Accountant', 'Admin', 'SuperAdmin'])) return;
        const accounts = await Account.find({ schoolId, active: true, type: { $in: ['revenue', 'expense', 'asset'] } })
            .select('code name type category normalBalance')
            .sort({ code: 1 })
            .lean();
        return res.status(200).json({ data: accounts });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load budget accounts' });
    }
};

exports.getBudgets = async (req, res) => {
    try {
        const { schoolId, periodId } = req.params;
        if (!await authorizeBudgetRequest(req, res, schoolId, ['Accountant', 'Admin', 'SuperAdmin'])) return;
        const period = await AccountingPeriod.findOne({ _id: periodId, schoolId }).lean();
        if (!period) return res.status(404).json({ message: 'Accounting period not found for this school' });
        const rows = await AccountingService.getBudgetSummary(schoolId, periodId);
        return res.status(200).json({ data: rows, period });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load budgets' });
    }
};

exports.createJournalEntry = async (req, res) => {
    try {
        const { schoolId, periodId, description, sourceModule, lines } = req.body;
        const postedBy = req.userId || req.user?._id || req.admin?._id;
        if (!postedBy) return res.status(401).json({ message: 'Authenticated finance user is required to post a journal' });

        const result = await AccountingService.createJournalEntry({
            schoolId,
            periodId,
            description,
            sourceModule,
            lines,
            postedBy,
        });

        return res.status(201).json({
            message: 'Journal entry created successfully',
            data: result,
        });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to create journal entry' });
    }
};

exports.getJournalAccounts = async (req, res) => {
    try {
        const { schoolId } = req.params;
        if (!await authorizeBudgetRequest(req, res, schoolId, ['Accountant', 'Admin', 'SuperAdmin'])) return;
        const accounts = await Account.find({ schoolId, active: true })
            .select('code name type category normalBalance')
            .sort({ code: 1 })
            .lean();
        return res.status(200).json({ data: accounts });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load journal accounts' });
    }
};

exports.getJournalEntries = async (req, res) => {
    try {
        const { schoolId, periodId } = req.params;
        if (!await authorizeBudgetRequest(req, res, schoolId, ['Accountant', 'Admin', 'SuperAdmin'])) return;
        const period = await AccountingPeriod.findOne({ _id: periodId, schoolId }).select('_id');
        if (!period) return res.status(404).json({ message: 'Accounting period not found for this school' });

        const entries = await JournalEntry.find({ schoolId, periodId })
            .populate('lines.accountId', 'code name type')
            .sort({ entryDate: -1, createdAt: -1 })
            .limit(100)
            .lean();
        return res.status(200).json({ data: entries });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load journal entries' });
    }
};

exports.reverseJournalEntry = async (req, res) => {
    try {
        const { journalId } = req.params;
        const { reason, reversedBy } = req.body;

        const result = await AccountingService.reverseJournalEntry(journalId, reason || 'Manual reversal', reversedBy);

        return res.status(200).json({
            message: 'Journal entry reversed successfully',
            data: result,
        });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to reverse journal entry' });
    }
};

exports.getAccountLedger = async (req, res) => {
    try {
        const { accountId } = req.params;
        const { schoolId, periodId } = req.query;

        const entries = await GeneralLedger.find({
            schoolId,
            accountId,
            periodId,
        }).sort({ entryDate: 1, createdAt: 1 });

        return res.status(200).json({ data: entries });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load account ledger' });
    }
};

exports.getTrialBalance = async (req, res) => {
    try {
        const { schoolId, periodId } = req.params;

        const rows = await GeneralLedger.aggregate([
            {
                $match: {
                    schoolId: new (require('mongoose')).Types.ObjectId(schoolId),
                    periodId: new (require('mongoose')).Types.ObjectId(periodId),
                },
            },
            {
                $group: {
                    _id: '$accountId',
                    totalDebit: { $sum: '$debitAmount' },
                    totalCredit: { $sum: '$creditAmount' },
                    entries: { $push: '$$ROOT' },
                },
            },
        ]);

        return res.status(200).json({ data: rows });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load trial balance' });
    }
};

exports.closePeriod = async (req, res) => {
    try {
        const { periodId } = req.params;
        const { closedBy } = req.body;

        const period = await AccountingPeriod.findById(periodId);
        if (!period) {
            return res.status(404).json({ message: 'Accounting period not found' });
        }

        period.status = 'locked';
        await period.save();

        const auditNote = require('../services/accountingService').generateAuditNote({
            entityType: 'AccountingPeriod',
            action: 'lock',
            record: period,
            details: {
                action: 'lock',
            },
        });

        await require('../models/accountingSchema').AuditLog.create({
            schoolId: period.schoolId,
            entityType: 'AccountingPeriod',
            entityId: period._id,
            action: 'lock',
            oldValue: 'open',
            newValue: 'locked',
            changedBy: closedBy,
            notes: auditNote,
            source: 'api',
        });

        return res.status(200).json({ message: 'Accounting period locked successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to close accounting period' });
    }
};

exports.createBudget = async (req, res) => {
    try {
        const { schoolId, periodId, accountId, amount, notes, programme, activity, periodization, allocations } = req.body;
        const requester = await authorizeBudgetRequest(req, res, schoolId, ['Accountant', 'Admin', 'SuperAdmin']);
        if (!requester) return;

        const budget = await AccountingService.createBudget({
            schoolId,
            periodId,
            accountId,
            amount,
            notes,
            programme,
            activity,
            periodization,
            allocations,
            createdBy: requester.actorId,
        });

        return res.status(201).json({
            message: 'Budget set successfully',
            data: budget,
        });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to set budget' });
    }
};

exports.transitionBudget = async (req, res) => {
    try {
        const { budgetId } = req.params;
        const action = ({ Submit: 'submit', Review: 'review', Approve: 'approve', Lock: 'lock', RequestRevision: 'request_revision' })[req.params.action];
        if (!action) return res.status(400).json({ message: 'Unknown budget action' });
        const budget = await Budget.findById(budgetId).select('schoolId');
        if (!budget) return res.status(404).json({ message: 'Budget not found' });
        const allowedRoles = action === 'submit'
            ? ['Accountant', 'Admin', 'SuperAdmin']
            : ['Admin', 'SuperAdmin'];
        const requester = await authorizeBudgetRequest(req, res, budget.schoolId, allowedRoles);
        if (!requester) return;

        const updated = await AccountingService.transitionBudget({
            budgetId,
            action,
            actorId: requester.actorId,
            reason: req.body?.reason || '',
        });
        return res.status(200).json({ message: `Budget ${action.replace('_', ' ')} successful`, data: updated });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to update budget status' });
    }
};

exports.getBudgetSummary = async (req, res) => {
    try {
        const { schoolId, periodId } = req.params;
        const data = await AccountingService.getBudgetSummary(schoolId, periodId);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load budget summary' });
    }
};

exports.getBudgetVariance = async (req, res) => {
    try {
        const { schoolId, periodId, accountId } = req.params;
        const data = await AccountingService.getBudgetVariance({ schoolId, periodId, accountId });
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to calculate budget variance' });
    }
};

exports.getAuditLogs = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const logs = await AuditLog.find({ schoolId }).sort({ createdAt: -1 }).limit(100);
        return res.status(200).json({ data: logs });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load audit logs' });
    }
};

exports.getCurrentAccountingPeriod = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const period = await AccountingPeriod.findOne({ schoolId }).sort({ startDate: -1 }).lean();
        return res.status(200).json({ data: period });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load current accounting period' });
    }
};

exports.createAccountingPeriod = async (req, res) => {
    try {
        const requester = await getRequestUser(req);
        if (!requester || requester.type !== 'admin') {
            return res.status(401).json({ message: 'Authenticated school finance access is required' });
        }

        const { schoolId } = req.params;
        const { name, startDate, endDate } = req.body;
        const result = await initializeSchoolAccounting({ schoolId, name, startDate, endDate });

        await AuditLog.create({
            schoolId,
            entityType: 'AccountingPeriod',
            entityId: result.period._id,
            action: 'create',
            newValue: result.period.name,
            changedBy: requester.user._id,
            notes: `Accounting period ${result.period.name} was created and the standard chart of accounts was initialized.`,
            source: 'api',
        });

        return res.status(201).json({
            message: 'Accounting period created successfully',
            data: result.period,
            accountsCreated: result.accountsCreated,
        });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to create accounting period' });
    }
};

exports.getTrialBalanceReport = async (req, res) => {
    try {
        const { schoolId, periodId } = req.params;
        const data = await AccountingService.getTrialBalance(schoolId, periodId);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load trial balance report' });
    }
};

exports.getBudgetDashboard = async (req, res) => {
    try {
        const { schoolId, periodId } = req.params;
        const data = await AccountingService.getBudgetVsActualDashboard(schoolId, periodId);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load budget dashboard' });
    }
};

exports.getBalanceSheetReport = async (req, res) => {
    try {
        const { schoolId, periodId } = req.params;
        const data = await AccountingService.getBalanceSheet(schoolId, periodId);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load balance sheet' });
    }
};

exports.getIncomeStatementReport = async (req, res) => {
    try {
        const { schoolId, periodId } = req.params;
        const data = await AccountingService.getIncomeStatement(schoolId, periodId);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load income statement' });
    }
};

exports.getJournalById = async (req, res) => {
    try {
        const { id } = req.params;
        const journal = await JournalEntry.findById(id);
        if (!journal) {
            return res.status(404).json({ message: 'Journal entry not found' });
        }
        return res.status(200).json({ data: journal });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load journal entry' });
    }
};
