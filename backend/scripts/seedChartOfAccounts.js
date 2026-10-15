const dotenv = require('dotenv');
const { connectToMongo } = require('../utils/db');
const { Account } = require('../models/accountingSchema');

dotenv.config();

const schoolId = process.env.SCHOOL_ID || '64f2d9af9c1d2b0001abcd12';
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/schoolManagementSystem';

const chartOfAccounts = [
  { schoolId, code: '1000', name: 'Cash in Bank', type: 'asset', category: 'bank', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '1010', name: 'Cash in Hand', type: 'asset', category: 'cash', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '1100', name: 'Student Fees Receivable', type: 'asset', category: 'receivables', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '1110', name: 'Other Receivables', type: 'asset', category: 'receivables', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '1200', name: 'School Supplies Inventory', type: 'asset', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '1300', name: 'Fixed Assets', type: 'asset', category: 'fixed_asset', parentAccountId: null, normalBalance: 'debit', active: true },

  { schoolId, code: '2000', name: 'Accounts Payable', type: 'liability', category: 'payables', parentAccountId: null, normalBalance: 'credit', active: true },
  { schoolId, code: '2100', name: 'Payroll Liabilities', type: 'liability', category: 'payroll', parentAccountId: null, normalBalance: 'credit', active: true },
  { schoolId, code: '2200', name: 'Accrued Expenses', type: 'liability', category: 'payables', parentAccountId: null, normalBalance: 'credit', active: true },

  { schoolId, code: '3000', name: 'Retained Earnings', type: 'equity', category: 'operating_expense', parentAccountId: null, normalBalance: 'credit', active: true },
  { schoolId, code: '3100', name: 'Capital Contributions', type: 'equity', category: 'operating_expense', parentAccountId: null, normalBalance: 'credit', active: true },

  { schoolId, code: '4000', name: 'School Fees Revenue', type: 'revenue', category: 'fees', parentAccountId: null, normalBalance: 'credit', active: true },
  { schoolId, code: '4010', name: 'Transport Fees Revenue', type: 'revenue', category: 'fees', parentAccountId: null, normalBalance: 'credit', active: true },
  { schoolId, code: '4020', name: 'Boarding Fees Revenue', type: 'revenue', category: 'fees', parentAccountId: null, normalBalance: 'credit', active: true },
  { schoolId, code: '4030', name: 'Other School Income', type: 'revenue', category: 'fees', parentAccountId: null, normalBalance: 'credit', active: true },

  { schoolId, code: '5000', name: 'Salaries and Wages', type: 'expense', category: 'payroll', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5010', name: 'Teacher Allowances', type: 'expense', category: 'payroll', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5020', name: 'Staff Benefits', type: 'expense', category: 'payroll', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5100', name: 'School Supplies Expense', type: 'expense', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5200', name: 'Utilities Expense', type: 'expense', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5300', name: 'Maintenance Expense', type: 'expense', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5400', name: 'Transport Expense', type: 'expense', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5500', name: 'IT and Communication', type: 'expense', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5600', name: 'Depreciation Expense', type: 'expense', category: 'fixed_asset', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5700', name: 'Bank Charges', type: 'expense', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5800', name: 'Administrative Expenses', type: 'expense', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
];

const seedChartOfAccounts = async () => {
  await connectToMongo(MONGO_URI);

  const existing = await Account.find({ schoolId }).lean();
  const existingCodes = new Set(existing.map((entry) => entry.code));

  const toInsert = chartOfAccounts.filter((entry) => !existingCodes.has(entry.code));

  if (toInsert.length === 0) {
    console.log(`Chart of accounts already seeded for school ${schoolId}`);
    return;
  }

  const inserted = await Account.insertMany(toInsert);
  console.log(`Inserted ${inserted.length} accounts for school ${schoolId}`);
  process.exit(0);
};

seedChartOfAccounts().catch((error) => {
  console.error('Failed to seed chart of accounts:', error.message || error);
  process.exit(1);
});
