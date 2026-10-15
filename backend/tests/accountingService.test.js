const AccountingService = require('../services/accountingService');

describe('AccountingService validation', () => {
  test('accepts balanced journal entries', () => {
    const lines = [
      { accountId: 'acct-1', debitAmount: 5000, creditAmount: 0 },
      { accountId: 'acct-2', debitAmount: 0, creditAmount: 5000 }
    ];

    expect(() => AccountingService.validateJournalLines(lines)).not.toThrow();
  });

  test('rejects unbalanced journal entries', () => {
    const lines = [
      { accountId: 'acct-1', debitAmount: 5000, creditAmount: 0 },
      { accountId: 'acct-2', debitAmount: 0, creditAmount: 4000 }
    ];

    expect(() => AccountingService.validateJournalLines(lines)).toThrow('Journal entry is not balanced');
  });

  test('rejects missing ledger line details', () => {
    expect(() => AccountingService.validateJournalLines([])).toThrow('Journal lines are required');
  });

  test('accepts balanced journal lines within cent precision', () => {
    const lines = [
      { accountId: 'acct-1', debitAmount: 0.1 + 0.2, creditAmount: 0 },
      { accountId: 'acct-2', debitAmount: 0, creditAmount: 0.3 },
    ];
    expect(() => AccountingService.validateJournalLines(lines)).not.toThrow();
  });

  test('rejects negative or double-sided journal lines', () => {
    expect(() => AccountingService.validateJournalLines([
      { accountId: 'acct-1', debitAmount: -1, creditAmount: 0 },
      { accountId: 'acct-2', debitAmount: 0, creditAmount: -1 },
    ])).toThrow('Journal debit and credit amounts must be non-negative numbers');
    expect(() => AccountingService.validateJournalLines([
      { accountId: 'acct-1', debitAmount: 5, creditAmount: 5 },
      { accountId: 'acct-2', debitAmount: 0, creditAmount: 10 },
    ])).toThrow('Each journal line must contain either a debit or a credit amount');
  });

  test('calculates variance against the budget for an account', () => {
    const result = AccountingService.calculateBudgetVariance({
      budgetAmount: 10000,
      actualAmount: 8200,
      accountType: 'expense',
    });

    expect(result).toEqual({
      budgetAmount: 10000,
      actualAmount: 8200,
      variance: 1800,
      status: 'under_budget',
      percentUsed: 82,
    });
  });

  test('flags expenditure overruns with a negative variance', () => {
    const result = AccountingService.calculateBudgetVariance({
      budgetAmount: 800000,
      actualAmount: 900000,
      accountType: 'expense',
    });

    expect(result).toMatchObject({ variance: -100000, status: 'over_budget', percentUsed: 112.5 });
  });

  test('validates quarterly allocations against the annual budget', () => {
    const period = { startDate: '2026-01-01', endDate: '2026-12-31' };
    const allocations = [
      { periodKey: 'Q1', amount: 100 },
      { periodKey: 'Q2', amount: 200 },
      { periodKey: 'Q3', amount: 300 },
      { periodKey: 'Q4', amount: 400 },
    ];

    expect(AccountingService.validateBudgetAllocations({ amount: 1000, periodization: 'quarterly', allocations, period })).toHaveLength(4);
    expect(() => AccountingService.validateBudgetAllocations({ amount: 1100, periodization: 'quarterly', allocations, period }))
      .toThrow('Period allocations must equal the annual budget amount');
  });

  test('calculates the closing balance for debit and credit normal-balance accounts', () => {
    expect(AccountingService.calculateClosingBalance({ normalBalance: 'debit', totalDebit: 5000, totalCredit: 2000 })).toBe(3000);
    expect(AccountingService.calculateClosingBalance({ normalBalance: 'credit', totalDebit: 1000, totalCredit: 4800 })).toBe(3800);
  });
});
