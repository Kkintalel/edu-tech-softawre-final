const dotenv = require('dotenv');
const { connectToMongo } = require('../utils/db');
const { Account, AccountingPeriod, JournalEntry, GeneralLedger } = require('../models/accountingSchema');

dotenv.config();

const schoolId = process.env.SCHOOL_ID || '64f2d9af9c1d2b0001abcd12';
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/schoolManagementSystem';

const chartOfAccounts = [
  { schoolId, code: '1000', name: 'Cash in Bank', type: 'asset', category: 'bank', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '1010', name: 'Cash in Hand', type: 'asset', category: 'cash', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '1100', name: 'Student Fees Receivable', type: 'asset', category: 'receivables', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '1200', name: 'School Supplies Inventory', type: 'asset', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '1300', name: 'Fixed Assets', type: 'asset', category: 'fixed_asset', parentAccountId: null, normalBalance: 'debit', active: true },

  { schoolId, code: '2000', name: 'Accounts Payable', type: 'liability', category: 'payables', parentAccountId: null, normalBalance: 'credit', active: true },
  { schoolId, code: '2100', name: 'Payroll Liabilities', type: 'liability', category: 'payroll', parentAccountId: null, normalBalance: 'credit', active: true },

  { schoolId, code: '3000', name: 'Retained Earnings', type: 'equity', category: 'operating_expense', parentAccountId: null, normalBalance: 'credit', active: true },

  { schoolId, code: '4000', name: 'School Fees Revenue', type: 'revenue', category: 'fees', parentAccountId: null, normalBalance: 'credit', active: true },
  { schoolId, code: '4010', name: 'Other School Income', type: 'revenue', category: 'fees', parentAccountId: null, normalBalance: 'credit', active: true },

  { schoolId, code: '5000', name: 'Salaries and Wages', type: 'expense', category: 'payroll', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5100', name: 'School Supplies Expense', type: 'expense', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5200', name: 'Utilities Expense', type: 'expense', category: 'operating_expense', parentAccountId: null, normalBalance: 'debit', active: true },
  { schoolId, code: '5600', name: 'Depreciation Expense', type: 'expense', category: 'fixed_asset', parentAccountId: null, normalBalance: 'debit', active: true },
];

const seedDemo = async () => {
  await connectToMongo(MONGO_URI);

  const period = await AccountingPeriod.findOneAndUpdate(
    { schoolId, name: '2026-09' },
    {
      schoolId,
      name: '2026-09',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-30'),
      status: 'open',
      closedBy: null,
      closedAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const existingAccounts = await Account.find({ schoolId }).lean();
  const existingMap = new Map(existingAccounts.map((item) => [item.code, item]));

  for (const account of chartOfAccounts) {
    if (!existingMap.has(account.code)) {
      await Account.create(account);
    }
  }

  const accounts = await Account.find({ schoolId });
  const lookup = Object.fromEntries(accounts.map((account) => [account.code, account._id]));

  const existingJournal = await JournalEntry.findOne({ schoolId, description: 'Demo fee collection for September 2026' });
  if (!existingJournal) {
    const journal = await JournalEntry.create({
      schoolId,
      periodId: period._id,
      entryNo: 'JE-2026-0001',
      entryDate: new Date('2026-09-15'),
      description: 'Demo fee collection for September 2026',
      sourceModule: 'fees',
      status: 'posted',
      postedBy: null,
      postedAt: new Date('2026-09-15T10:00:00Z'),
      lines: [
        {
          accountId: lookup['1000'],
          debitAmount: 25000,
          creditAmount: 0,
          description: 'Cash received from student fees',
          referenceType: 'feePayment',
        },
        {
          accountId: lookup['4000'],
          debitAmount: 0,
          creditAmount: 25000,
          description: 'Recognized fee income',
          referenceType: 'feePayment',
        },
      ],
    });

    const accountMap = new Map(accounts.map((account) => [account._id.toString(), account]));

    for (const line of journal.lines) {
      const account = accountMap.get(line.accountId.toString());
      const previousLedger = await GeneralLedger.findOne({ schoolId, accountId: account._id, periodId: period._id }).sort({ createdAt: -1 });
      const previousBalance = previousLedger ? previousLedger.balanceAfter : 0;
      const delta = account.normalBalance === 'debit'
        ? (Number(line.debitAmount || 0) - Number(line.creditAmount || 0))
        : (Number(line.creditAmount || 0) - Number(line.debitAmount || 0));

      await GeneralLedger.create({
        schoolId,
        periodId: period._id,
        accountId: account._id,
        journalEntryId: journal._id,
        journalLineId: line._id,
        entryDate: journal.entryDate,
        description: line.description,
        debitAmount: Number(line.debitAmount || 0),
        creditAmount: Number(line.creditAmount || 0),
        balanceAfter: previousBalance + delta,
        referenceType: line.referenceType || 'manual',
      });
    }

    console.log('Demo accounting period and sample journal created successfully');
  } else {
    console.log('Demo accounting data already exists');
  }

  process.exit(0);
};

seedDemo().catch((error) => {
  console.error('Seed failed:', error.message || error);
  process.exit(1);
});
