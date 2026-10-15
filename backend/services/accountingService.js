const { Account, AccountingPeriod, JournalEntry, GeneralLedger, Budget, AuditLog } = require('../models/accountingSchema');

class AccountingService {
    static generateAuditNote({ entityType, action, record = {}, details = {} }) {
        const label = record.entryNo || record.name || record.code || record._id || entityType;

        if (entityType === 'JournalEntry') {
            if (action === 'post') {
                return `Journal entry ${label} was posted for the financial period with ${details.lineCount || 0} journal line(s). Total debit ${Number(details.totalDebit || 0).toFixed(2)} and total credit ${Number(details.totalCredit || 0).toFixed(2)} were recorded.`;
            }

            if (action === 'reverse') {
                return `Journal entry ${label} was reversed due to ${details.reason || 'manual correction'} and the opposing ledger entries were created automatically.`;
            }
        }

        if (entityType === 'Budget') {
            return `Budget for account ${details.accountName || label} was set to ${Number(details.amount || 0).toFixed(2)} for the active accounting period.`;
        }

        if (entityType === 'AccountingPeriod') {
            return `Accounting period ${label} was ${action === 'lock' ? 'locked' : action} to preserve the financial close.`;
        }

        return `${entityType} ${action} was completed and recorded for financial audit review.`;
    }

    static calculateBudgetVariance({ budgetAmount, actualAmount, accountType = 'expense' }) {
        const budget = Number(budgetAmount || 0);
        const actual = Number(actualAmount || 0);
        const isRevenue = accountType === 'revenue';
        const variance = isRevenue ? actual - budget : budget - actual;

        if ((isRevenue && variance > 0) || (!isRevenue && variance < 0)) {
            return {
                budgetAmount: budget,
                actualAmount: actual,
                variance,
                status: isRevenue ? 'above_target' : 'over_budget',
                percentUsed: budget ? (actual / budget) * 100 : actual ? Infinity : 0,
            };
        }

        if ((isRevenue && variance < 0) || (!isRevenue && variance > 0)) {
            return {
                budgetAmount: budget,
                actualAmount: actual,
                variance,
                status: isRevenue ? 'below_target' : 'under_budget',
                percentUsed: budget ? (actual / budget) * 100 : actual ? Infinity : 0,
            };
        }

        return {
            budgetAmount: budget,
            actualAmount: actual,
            variance: 0,
            status: 'on_track',
            percentUsed: budget ? (actual / budget) * 100 : 0,
        };
    }

    static getBudgetPeriodOptions(period, periodization = 'annual') {
        const start = new Date(period?.startDate);
        const end = new Date(period?.endDate);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
            throw new Error('A valid accounting period is required for budget allocations');
        }
        if (periodization === 'annual') return [{ periodKey: 'annual', label: 'Annual', startDate: start, endDate: end }];

        const options = [];
        let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
        let quarter = 1;
        while (current <= end) {
            const monthsPerPeriod = periodization === 'quarterly' ? 3 : 1;
            const periodStart = new Date(current);
            const next = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + monthsPerPeriod, 1));
            const periodEnd = new Date(Math.min(next.getTime() - 1, end.getTime()));
            const periodKey = periodization === 'quarterly'
                ? `Q${quarter}`
                : `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`;
            options.push({
                periodKey,
                label: periodization === 'quarterly' ? `Quarter ${quarter}` : periodKey,
                startDate: periodStart < start ? start : periodStart,
                endDate: periodEnd,
            });
            current = next;
            quarter += 1;
        }
        return options;
    }

    static validateBudgetAllocations({ amount, periodization = 'annual', allocations = [], period }) {
        const budgetAmount = Number(amount);
        if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
            throw new Error('Budget amount must be greater than zero');
        }

        const periods = this.getBudgetPeriodOptions(period, periodization);
        if (periodization === 'annual') return [];
        if (!['monthly', 'quarterly'].includes(periodization)) {
            throw new Error('Periodization must be annual, monthly, or quarterly');
        }

        const normalized = (allocations || []).map((allocation) => ({
            periodKey: String(allocation.periodKey || '').trim(),
            amount: Number(allocation.amount),
        }));
        if (normalized.length !== periods.length || normalized.some((allocation) => !Number.isFinite(allocation.amount) || allocation.amount < 0)) {
            throw new Error(`Provide a non-negative allocation for each ${periodization} period`);
        }
        if (new Set(normalized.map((allocation) => allocation.periodKey)).size !== periods.length ||
            periods.some((periodOption) => !normalized.some((allocation) => allocation.periodKey === periodOption.periodKey))) {
            throw new Error('Budget allocations must match every period in the accounting year exactly once');
        }

        const allocatedAmount = normalized.reduce((total, allocation) => total + allocation.amount, 0);
        if (Math.abs(allocatedAmount - budgetAmount) > 0.01) {
            throw new Error('Period allocations must equal the annual budget amount');
        }
        return normalized;
    }

    static validateJournalLines(lines) {
        if (!Array.isArray(lines) || lines.length === 0) {
            throw new Error('Journal lines are required');
        }

        const normalized = lines.map((line) => ({
            ...line,
            accountId: line.accountId,
            debitAmount: Number(line.debitAmount || 0),
            creditAmount: Number(line.creditAmount || 0),
            description: line.description || 'Accounting entry',
            referenceId: line.referenceId || null,
            referenceType: line.referenceType || 'manual',
        }));

        normalized.forEach((line) => {
            if (!line.accountId) {
                throw new Error('Each journal line must include an accountId');
            }
            if (!Number.isFinite(line.debitAmount) || !Number.isFinite(line.creditAmount) || line.debitAmount < 0 || line.creditAmount < 0) {
                throw new Error('Journal debit and credit amounts must be non-negative numbers');
            }
            if ((line.debitAmount > 0) === (line.creditAmount > 0)) {
                throw new Error('Each journal line must contain either a debit or a credit amount');
            }
        });

        const totalDebit = normalized.reduce((sum, line) => sum + line.debitAmount, 0);
        const totalCredit = normalized.reduce((sum, line) => sum + line.creditAmount, 0);

        if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
            throw new Error('Journal entry is not balanced');
        }

        return normalized;
    }

    static async createBudget({ schoolId, periodId, accountId, amount, notes = '', programme = '', activity = '', periodization = 'annual', allocations = [], createdBy }) {
        if (!schoolId || !periodId || !accountId || !createdBy) {
            throw new Error('schoolId, periodId, accountId, and amount are required');
        }

        const period = await AccountingPeriod.findById(periodId);
        if (!period || period.schoolId.toString() !== schoolId.toString()) {
            throw new Error('Accounting period is invalid for this school');
        }

        const account = await Account.findById(accountId);
        if (!account || account.schoolId.toString() !== schoolId.toString() || !['revenue', 'expense', 'asset'].includes(account.type)) {
            throw new Error('Budget account is invalid for this school');
        }

        const normalizedAllocations = this.validateBudgetAllocations({ amount, periodization, allocations, period });
        let budget = await Budget.findOne({ schoolId, periodId, accountId });
        if (budget && !['draft', 'revision_requested'].includes(budget.status)) {
            throw new Error('Only draft budgets or budgets returned for revision may be changed');
        }

        const isRevision = budget?.status === 'revision_requested';
        if (!budget) budget = new Budget({ schoolId, periodId, accountId, createdBy });
        budget.amount = Number(amount);
        budget.notes = notes;
        budget.programme = programme;
        budget.activity = activity;
        budget.periodization = periodization;
        budget.allocations = normalizedAllocations;
        budget.status = 'draft';
        budget.createdBy = isRevision ? budget.createdBy : createdBy;
        if (isRevision) {
            budget.revision += 1;
            budget.submittedBy = null;
            budget.submittedAt = null;
            budget.reviewedBy = null;
            budget.reviewedAt = null;
            budget.approvedBy = null;
            budget.approvedAt = null;
        }
        await budget.save();

        const auditNote = this.generateAuditNote({
            entityType: 'Budget',
            action: isRevision ? 'revise' : 'draft',
            record: budget,
            details: {
                amount: Number(amount),
                accountName: account.name,
                periodization,
                revision: budget.revision,
            },
        });

        await AuditLog.create({
            schoolId,
            entityType: 'Budget',
            entityId: budget._id,
            action: isRevision ? 'revise' : 'draft',
            fieldName: 'amount',
            oldValue: null,
            newValue: Number(amount),
            changedBy: createdBy,
            notes: auditNote,
            source: 'api',
        });

        return budget;
    }

    static async transitionBudget({ budgetId, action, actorId, reason = '' }) {
        const budget = await Budget.findById(budgetId);
        if (!budget) throw new Error('Budget not found');
        const actor = actorId?.toString();
        const creator = budget.createdBy?.toString();

        if (action === 'submit') {
            if (!['draft'].includes(budget.status)) throw new Error('Only draft budgets can be submitted');
            budget.status = 'submitted';
            budget.submittedBy = actorId;
            budget.submittedAt = new Date();
        } else if (action === 'review') {
            if (budget.status !== 'submitted') throw new Error('Only submitted budgets can be reviewed');
            if (actor === creator) throw new Error('The budget preparer cannot review their own budget');
            budget.status = 'reviewed';
            budget.reviewedBy = actorId;
            budget.reviewedAt = new Date();
        } else if (action === 'approve') {
            if (budget.status !== 'reviewed') throw new Error('Only reviewed budgets can be approved');
            if (actor === creator) throw new Error('The budget preparer cannot approve their own budget');
            budget.status = 'approved';
            budget.approvedBy = actorId;
            budget.approvedAt = new Date();
        } else if (action === 'lock') {
            if (budget.status !== 'approved') throw new Error('Only approved budgets can be locked');
            budget.status = 'locked';
            budget.lockedBy = actorId;
            budget.lockedAt = new Date();
        } else if (action === 'request_revision') {
            if (!['submitted', 'reviewed'].includes(budget.status)) throw new Error('Only submitted or reviewed budgets can be returned for revision');
            if (!reason.trim()) throw new Error('A revision reason is required');
            budget.status = 'revision_requested';
            budget.revisionReason = reason.trim();
        } else {
            throw new Error('Unsupported budget action');
        }

        await budget.save();
        await AuditLog.create({
            schoolId: budget.schoolId,
            entityType: 'Budget',
            entityId: budget._id,
            action,
            fieldName: 'status',
            oldValue: action === 'submit' ? 'draft' : undefined,
            newValue: budget.status,
            changedBy: actorId,
            notes: action === 'request_revision' ? reason.trim() : this.generateAuditNote({ entityType: 'Budget', action, record: budget }),
            source: 'api',
        });
        return budget;
    }

    static async getBudgetVariance({ schoolId, periodId, accountId }) {
        const budget = await Budget.findOne({ schoolId, periodId, accountId }).populate('accountId');
        if (!budget || !['approved', 'locked'].includes(budget.status)) {
            return null;
        }

        const account = budget.accountId;
        const ledgerRows = await GeneralLedger.find({ schoolId, periodId, accountId });
        const actualAmount = ledgerRows.reduce((sum, row) => {
            const debit = Number(row.debitAmount || 0);
            const credit = Number(row.creditAmount || 0);
            const delta = account.type === 'revenue' || account.normalBalance === 'credit' ? (credit - debit) : (debit - credit);
            return sum + delta;
        }, 0);

        return this.calculateBudgetVariance({
            budgetAmount: budget.amount,
            actualAmount,
            accountType: account.type,
        });
    }

    static async getBudgetSummary(schoolId, periodId) {
        const budgets = await Budget.find({ schoolId, periodId }).populate('accountId');

        const items = await Promise.all(budgets.map(async (budget) => {
            const variance = await this.getBudgetVariance({ schoolId, periodId, accountId: budget.accountId._id });
            return {
                _id: budget._id,
                accountId: budget.accountId._id,
                accountCode: budget.accountId.code,
                accountName: budget.accountId.name,
                amount: budget.amount,
                status: budget.status,
                programme: budget.programme,
                activity: budget.activity,
                periodization: budget.periodization,
                allocations: budget.allocations,
                revision: budget.revision,
                variance,
            };
        }));

        return items;
    }

    static async getProjectedBudgetStatus({ schoolId, periodId, accountId, amount }) {
        if (!schoolId || !periodId || !accountId || Number(amount || 0) <= 0) {
            return { status: 'not_applicable', message: 'No actionable budget projection' };
        }

        const budget = await Budget.findOne({ schoolId, periodId, accountId }).populate('accountId');
        if (!budget) {
            return { status: 'no_budget', message: 'No budget set for this account in the current period' };
        }

        const account = budget.accountId;
        const ledgerRows = await GeneralLedger.find({ schoolId, periodId, accountId });
        const actualAmount = ledgerRows.reduce((sum, row) => {
            const debit = Number(row.debitAmount || 0);
            const credit = Number(row.creditAmount || 0);
            const delta = account.normalBalance === 'debit' ? (debit - credit) : (credit - debit);
            return sum + delta;
        }, 0);

        const projected = actualAmount + Number(amount);
        const variance = this.calculateBudgetVariance({
            budgetAmount: budget.amount,
            actualAmount: projected,
            accountType: account.type,
        });

        return {
            ...variance,
            accountCode: account.code,
            accountName: account.name,
            projectedAmount: projected,
            message: variance.status === 'over_budget'
                ? `Projected spending exceeds the assigned budget by ${Math.abs(variance.variance)}.`
                : 'Budget remains within limit.',
        };
    }

    static calculateClosingBalance({ normalBalance, totalDebit = 0, totalCredit = 0 }) {
        const debit = Number(totalDebit || 0);
        const credit = Number(totalCredit || 0);

        if (normalBalance === 'debit') {
            return debit - credit;
        }

        return credit - debit;
    }

    static async getTrialBalance(schoolId, periodId) {
        const accounts = await Account.find({ schoolId, active: true }).lean();
        const ledgerRows = await GeneralLedger.find({ schoolId, periodId }).lean();
        const totalsByAccount = new Map();

        for (const row of ledgerRows) {
            const key = row.accountId.toString();
            const current = totalsByAccount.get(key) || { totalDebit: 0, totalCredit: 0 };
            current.totalDebit += Number(row.debitAmount || 0);
            current.totalCredit += Number(row.creditAmount || 0);
            totalsByAccount.set(key, current);
        }

        const rows = accounts.map((account) => {
            const totals = totalsByAccount.get(account._id.toString()) || { totalDebit: 0, totalCredit: 0 };
            const closingBalance = this.calculateClosingBalance({
                normalBalance: account.normalBalance,
                totalDebit: totals.totalDebit,
                totalCredit: totals.totalCredit,
            });

            return {
                accountId: account._id,
                code: account.code,
                name: account.name,
                type: account.type,
                normalBalance: account.normalBalance,
                totalDebit: Number(totals.totalDebit || 0),
                totalCredit: Number(totals.totalCredit || 0),
                closingBalance,
            };
        });

        const totalDebit = rows.reduce((sum, row) => sum + Math.max(row.totalDebit, 0), 0);
        const totalCredit = rows.reduce((sum, row) => sum + Math.max(row.totalCredit, 0), 0);

        return {
            schoolId,
            periodId,
            totalDebit,
            totalCredit,
            rows,
            balanced: totalDebit === totalCredit,
        };
    }

    static async getBudgetVsActualDashboard(schoolId, periodId) {
        const budgets = await Budget.find({ schoolId, periodId, status: { $in: ['approved', 'locked'] } }).populate('accountId');

        const items = await Promise.all(budgets.map(async (budget) => {
            const account = budget.accountId;
            const ledgerRows = await GeneralLedger.find({ schoolId, periodId, accountId: account._id });
            const actualAmount = ledgerRows.reduce((sum, row) => {
                const debit = Number(row.debitAmount || 0);
                const credit = Number(row.creditAmount || 0);
                const delta = account.type === 'revenue' || account.normalBalance === 'credit' ? (credit - debit) : (debit - credit);
                return sum + delta;
            }, 0);

            const variance = this.calculateBudgetVariance({
                budgetAmount: budget.amount,
                actualAmount,
                accountType: account.type,
            });

            const period = await AccountingPeriod.findById(periodId).lean();
            const allocationOptions = this.getBudgetPeriodOptions(period, budget.periodization || 'annual');
            const periodActuals = allocationOptions.map((allocationPeriod) => {
                const periodActual = ledgerRows.reduce((sum, row) => {
                    const entryDate = new Date(row.entryDate).getTime();
                    if (!Number.isFinite(entryDate) || entryDate < allocationPeriod.startDate.getTime() || entryDate > allocationPeriod.endDate.getTime()) return sum;
                    const debit = Number(row.debitAmount || 0);
                    const credit = Number(row.creditAmount || 0);
                    const delta = account.type === 'revenue' || account.normalBalance === 'credit' ? (credit - debit) : (debit - credit);
                    return sum + delta;
                }, 0);
                const allocated = budget.allocations?.find((item) => item.periodKey === allocationPeriod.periodKey)?.amount
                    ?? (budget.periodization === 'annual' ? budget.amount : 0);
                return {
                    periodKey: allocationPeriod.periodKey,
                    label: allocationPeriod.label,
                    budgetAmount: Number(allocated || 0),
                    actualAmount: periodActual,
                    variance: this.calculateBudgetVariance({ budgetAmount: allocated, actualAmount: periodActual, accountType: account.type }),
                };
            });

            return {
                _id: budget._id,
                accountId: account._id,
                accountCode: account.code,
                accountName: account.name,
                accountType: account.type,
                programme: budget.programme,
                activity: budget.activity,
                periodization: budget.periodization,
                budgetAmount: budget.amount,
                actualAmount,
                variance: variance.variance,
                status: variance.status,
                percentUsed: variance.percentUsed,
                isOverBudget: account.type !== 'revenue' && variance.variance < 0,
                allocations: periodActuals,
            };
        }));

        const totalBudget = items.reduce((sum, item) => sum + Number(item.budgetAmount || 0), 0);
        const totalActual = items.reduce((sum, item) => sum + Number(item.actualAmount || 0), 0);
        const expenditureItems = items.filter((item) => item.accountType !== 'revenue');
        const revenueItems = items.filter((item) => item.accountType === 'revenue');
        const totalVariance = items.reduce((sum, item) => sum + Number(item.variance || 0), 0);
        const expenditureOverruns = expenditureItems.filter((item) => item.isOverBudget);
        const revenueShortfalls = revenueItems.filter((item) => item.status === 'below_target');

        return {
            schoolId,
            periodId,
            totalBudget,
            totalActual,
            totalVariance,
            revenueBudget: revenueItems.reduce((sum, item) => sum + Number(item.budgetAmount || 0), 0),
            revenueActual: revenueItems.reduce((sum, item) => sum + Number(item.actualAmount || 0), 0),
            expenditureBudget: expenditureItems.reduce((sum, item) => sum + Number(item.budgetAmount || 0), 0),
            expenditureActual: expenditureItems.reduce((sum, item) => sum + Number(item.actualAmount || 0), 0),
            budgetUtilization: expenditureItems.reduce((sum, item) => sum + Number(item.budgetAmount || 0), 0)
                ? (expenditureItems.reduce((sum, item) => sum + Number(item.actualAmount || 0), 0) /
                    expenditureItems.reduce((sum, item) => sum + Number(item.budgetAmount || 0), 0)) * 100
                : 0,
            status: expenditureOverruns.length ? 'over_budget' : revenueShortfalls.length ? 'revenue_below_target' : 'on_track',
            expenditureOverruns,
            revenueShortfalls,
            items,
        };
    }

    static async getBalanceSheet(schoolId, periodId) {
        const trialBalance = await this.getTrialBalance(schoolId, periodId);
        const assetRows = trialBalance.rows.filter((row) => row.type === 'asset');
        const liabilityRows = trialBalance.rows.filter((row) => row.type === 'liability');
        const equityRows = trialBalance.rows.filter((row) => row.type === 'equity');

        const assets = assetRows.reduce((sum, row) => sum + Math.abs(row.closingBalance || 0), 0);
        const liabilities = liabilityRows.reduce((sum, row) => sum + Math.abs(row.closingBalance || 0), 0);
        const equity = equityRows.reduce((sum, row) => sum + Math.abs(row.closingBalance || 0), 0);

        return {
            schoolId,
            periodId,
            assets: {
                total: assets,
                rows: assetRows,
            },
            liabilities: {
                total: liabilities,
                rows: liabilityRows,
            },
            equity: {
                total: equity,
                rows: equityRows,
            },
            totalLiabilitiesAndEquity: liabilities + equity,
            balanced: Math.abs((liabilities + equity) - assets) < 0.01,
        };
    }

    static async getIncomeStatement(schoolId, periodId) {
        const trialBalance = await this.getTrialBalance(schoolId, periodId);
        const revenueRows = trialBalance.rows.filter((row) => row.type === 'revenue');
        const expenseRows = trialBalance.rows.filter((row) => row.type === 'expense');

        const revenue = revenueRows.reduce((sum, row) => sum + Math.abs(row.closingBalance || 0), 0);
        const expenses = expenseRows.reduce((sum, row) => sum + Math.abs(row.closingBalance || 0), 0);
        const netIncome = revenue - expenses;

        return {
            schoolId,
            periodId,
            revenue: {
                total: revenue,
                rows: revenueRows,
            },
            expenses: {
                total: expenses,
                rows: expenseRows,
            },
            netIncome,
            status: netIncome >= 0 ? 'profit' : 'loss',
        };
    }

    static async generateEntryNumber(schoolId) {
        const year = new Date().getFullYear();
        const count = await JournalEntry.countDocuments({ schoolId });
        return `JE-${year}-${String(count + 1).padStart(6, '0')}`;
    }

    static async createJournalEntry({ schoolId, periodId, description, sourceModule, lines, postedBy }) {
        if (!schoolId || !periodId || !description || !sourceModule) {
            throw new Error('schoolId, periodId, description, and sourceModule are required');
        }

        const period = await AccountingPeriod.findById(periodId);
        if (!period) {
            throw new Error('Accounting period not found');
        }

        if (period.schoolId.toString() !== schoolId.toString()) {
            throw new Error('Accounting period does not belong to this school');
        }

        if (period.status !== 'open') {
            throw new Error('Accounting period is closed or locked');
        }

        const validatedLines = this.validateJournalLines(lines);

        const accountIds = validatedLines.map((line) => line.accountId);
        const accounts = await Account.find({ _id: { $in: accountIds }, schoolId, active: true });

        if (accounts.length !== accountIds.length) {
            throw new Error('One or more accounts are invalid or inactive');
        }

        const entryNo = await this.generateEntryNumber(schoolId);
        const journalEntry = await JournalEntry.create({
            schoolId,
            periodId,
            entryNo,
            entryDate: new Date(),
            description,
            sourceModule,
            status: 'posted',
            postedBy,
            postedAt: new Date(),
            lines: validatedLines,
        });

        const ledgerEntries = [];
        const accountMap = new Map(accounts.map((account) => [account._id.toString(), account]));

        for (const line of journalEntry.lines) {
            const account = accountMap.get(line.accountId.toString());
            const previousLedger = await GeneralLedger.findOne({
                schoolId,
                accountId: account._id,
                periodId,
            }).sort({ createdAt: -1 }).lean();

            const previousBalance = previousLedger ? previousLedger.balanceAfter : 0;
            const delta = account.normalBalance === 'debit'
                ? (Number(line.debitAmount || 0) - Number(line.creditAmount || 0))
                : (Number(line.creditAmount || 0) - Number(line.debitAmount || 0));

            const balanceAfter = previousBalance + delta;

            const ledgerEntry = await GeneralLedger.create({
                schoolId,
                periodId,
                accountId: account._id,
                journalEntryId: journalEntry._id,
                journalLineId: line._id,
                entryDate: journalEntry.entryDate,
                description: line.description || journalEntry.description,
                debitAmount: Number(line.debitAmount || 0),
                creditAmount: Number(line.creditAmount || 0),
                balanceAfter,
                referenceId: line.referenceId || null,
                referenceType: line.referenceType || 'manual',
            });

            ledgerEntries.push(ledgerEntry);
        }

        const journalAuditNote = this.generateAuditNote({
            entityType: 'JournalEntry',
            action: 'post',
            record: journalEntry,
            details: {
                lineCount: journalEntry.lines.length,
                totalDebit: validatedLines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0),
                totalCredit: validatedLines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0),
            },
        });

        await AuditLog.create({
            schoolId,
            entityType: 'JournalEntry',
            entityId: journalEntry._id,
            action: 'post',
            fieldName: 'status',
            oldValue: 'draft',
            newValue: 'posted',
            changedBy: postedBy,
            notes: journalAuditNote,
            source: 'api',
        });

        return { journalEntry, ledgerEntries };
    }

    static async reverseJournalEntry(journalId, reason, reversedBy) {
        const original = await JournalEntry.findById(journalId);
        if (!original) {
            throw new Error('Journal entry not found');
        }

        if (['reversed', 'voided'].includes(original.status)) {
            throw new Error('Journal entry has already been reversed or voided');
        }

        const reversals = original.lines.map((line) => ({
            accountId: line.accountId,
            debitAmount: Number(line.creditAmount || 0),
            creditAmount: Number(line.debitAmount || 0),
            description: `${line.description || 'Reversal'} - ${reason}`,
            referenceId: line.referenceId || null,
            referenceType: 'manual',
        }));

        const reversal = await this.createJournalEntry({
            schoolId: original.schoolId,
            periodId: original.periodId,
            description: `Reversal of ${original.entryNo}: ${reason}`,
            sourceModule: 'manual',
            postedBy: reversedBy,
            lines: reversals,
        });

        original.status = 'reversed';
        await original.save();

        const reversalAuditNote = this.generateAuditNote({
            entityType: 'JournalEntry',
            action: 'reverse',
            record: original,
            details: {
                reason,
            },
        });

        await AuditLog.create({
            schoolId: original.schoolId,
            entityType: 'JournalEntry',
            entityId: original._id,
            action: 'reverse',
            fieldName: 'status',
            oldValue: 'posted',
            newValue: 'reversed',
            changedBy: reversedBy,
            notes: reversalAuditNote,
            source: 'api',
        });

        return reversal;
    }
}

module.exports = AccountingService;
