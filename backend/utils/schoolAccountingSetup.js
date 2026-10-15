const { Account, AccountingPeriod } = require('../models/accountingSchema');

const chartOfAccounts = [
    { code: '1000', name: 'Cash in Bank', type: 'asset', category: 'bank', normalBalance: 'debit' },
    { code: '1010', name: 'Cash in Hand', type: 'asset', category: 'cash', normalBalance: 'debit' },
    { code: '1100', name: 'Student Fees Receivable', type: 'asset', category: 'receivables', normalBalance: 'debit' },
    { code: '1110', name: 'Other Receivables', type: 'asset', category: 'receivables', normalBalance: 'debit' },
    { code: '1200', name: 'School Supplies Inventory', type: 'asset', category: 'operating_expense', normalBalance: 'debit' },
    { code: '1300', name: 'Fixed Assets', type: 'asset', category: 'fixed_asset', normalBalance: 'debit' },
    { code: '2000', name: 'Accounts Payable', type: 'liability', category: 'payables', normalBalance: 'credit' },
    { code: '2100', name: 'Payroll Liabilities', type: 'liability', category: 'payroll', normalBalance: 'credit' },
    { code: '2200', name: 'Accrued Expenses', type: 'liability', category: 'payables', normalBalance: 'credit' },
    { code: '3000', name: 'Retained Earnings', type: 'equity', category: 'operating_expense', normalBalance: 'credit' },
    { code: '3100', name: 'Capital Contributions', type: 'equity', category: 'operating_expense', normalBalance: 'credit' },
    { code: '4000', name: 'School Fees Revenue', type: 'revenue', category: 'fees', normalBalance: 'credit' },
    { code: '4010', name: 'Transport Fees Revenue', type: 'revenue', category: 'fees', normalBalance: 'credit' },
    { code: '4020', name: 'Boarding Fees Revenue', type: 'revenue', category: 'fees', normalBalance: 'credit' },
    { code: '4030', name: 'Other School Income', type: 'revenue', category: 'fees', normalBalance: 'credit' },
    { code: '5000', name: 'Salaries and Wages', type: 'expense', category: 'payroll', normalBalance: 'debit' },
    { code: '5010', name: 'Teacher Allowances', type: 'expense', category: 'payroll', normalBalance: 'debit' },
    { code: '5020', name: 'Staff Benefits', type: 'expense', category: 'payroll', normalBalance: 'debit' },
    { code: '5100', name: 'School Supplies Expense', type: 'expense', category: 'operating_expense', normalBalance: 'debit' },
    { code: '5200', name: 'Utilities Expense', type: 'expense', category: 'operating_expense', normalBalance: 'debit' },
    { code: '5300', name: 'Maintenance Expense', type: 'expense', category: 'operating_expense', normalBalance: 'debit' },
    { code: '5400', name: 'Transport Expense', type: 'expense', category: 'operating_expense', normalBalance: 'debit' },
    { code: '5500', name: 'IT and Communication', type: 'expense', category: 'operating_expense', normalBalance: 'debit' },
    { code: '5600', name: 'Depreciation Expense', type: 'expense', category: 'fixed_asset', normalBalance: 'debit' },
    { code: '5700', name: 'Bank Charges', type: 'expense', category: 'operating_expense', normalBalance: 'debit' },
    { code: '5800', name: 'Administrative Expenses', type: 'expense', category: 'operating_expense', normalBalance: 'debit' },
];

const initializeSchoolAccounting = async ({ schoolId, name, startDate, endDate }) => {
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    const periodName = String(name || '').trim();

    if (!schoolId || !periodName || !Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime())) {
        throw new Error('School, financial year name, start date, and end date are required');
    }
    if (periodStart > periodEnd) {
        throw new Error('The financial year start date must be before its end date');
    }

    const overlappingPeriod = await AccountingPeriod.findOne({
        schoolId,
        startDate: { $lte: periodEnd },
        endDate: { $gte: periodStart },
    }).select('name');
    if (overlappingPeriod) {
        throw new Error(`These dates overlap the existing accounting period "${overlappingPeriod.name}"`);
    }

    const existingAccounts = await Account.find({ schoolId }).select('code').lean();
    const existingCodes = new Set(existingAccounts.map((account) => account.code));
    const missingAccounts = chartOfAccounts.filter((account) => !existingCodes.has(account.code));

    if (missingAccounts.length) {
        await Account.insertMany(missingAccounts.map((account) => ({
            ...account,
            schoolId,
            active: true,
            parentAccountId: null,
        })));
    }

    const period = await AccountingPeriod.create({
        schoolId,
        name: periodName,
        startDate: periodStart,
        endDate: periodEnd,
        status: 'open',
    });

    return { period, accountsCreated: missingAccounts.length };
};

module.exports = { initializeSchoolAccounting };