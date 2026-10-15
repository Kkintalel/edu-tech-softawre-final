import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Alert, Box, Button, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const escapeCsvValue = (value) => {
  const text = String(value ?? '');
  const safeText = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const FinanceReport = () => {
  const { currentUser } = useSelector((state) => state.user);
  const [report, setReport] = useState(null);
  const [accounting, setAccounting] = useState({
    period: null,
    trialBalance: null,
    budgetDashboard: null,
    balanceSheet: null,
    incomeStatement: null,
    auditLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const schoolId = useMemo(() => currentUser?.school?._id || currentUser?.school || currentUser?.schoolId, [currentUser]);
  const adminId = currentUser?._id;

  useEffect(() => {
    const loadReport = async () => {
      if (!schoolId) {
        setLoading(false);
        setMessage('Missing school context');
        return;
      }

      try {
        const legacyPromise = axios.get(`${API_BASE_URL}/Settings/School/${schoolId}/FinanceReport`, {
          headers: { 'x-admin-id': adminId },
        }).then((response) => response.data.report || null).catch(() => null);

        const periodPromise = axios.get(`${API_BASE_URL}/Accounting/Period/${schoolId}`, {
          headers: { 'x-admin-id': adminId },
        }).then((response) => response.data?.data || null).catch(() => null);

        const legacyReport = await legacyPromise;
        const currentPeriod = await periodPromise;
        setReport(legacyReport);
        setAccounting((prev) => ({ ...prev, period: currentPeriod }));

        if (currentPeriod?._id) {
          const [trialBalance, budgetDashboard, balanceSheet, incomeStatement, auditLogs] = await Promise.all([
            axios.get(`${API_BASE_URL}/Accounting/Reports/TrialBalance/${schoolId}/${currentPeriod._id}`, {
              headers: { 'x-admin-id': adminId },
            }).then((response) => response.data?.data || null).catch(() => null),
            axios.get(`${API_BASE_URL}/Accounting/Reports/BudgetVsActual/${schoolId}/${currentPeriod._id}`, {
              headers: { 'x-admin-id': adminId },
            }).then((response) => response.data?.data || null).catch(() => null),
            axios.get(`${API_BASE_URL}/Accounting/Reports/BalanceSheet/${schoolId}/${currentPeriod._id}`, {
              headers: { 'x-admin-id': adminId },
            }).then((response) => response.data?.data || null).catch(() => null),
            axios.get(`${API_BASE_URL}/Accounting/Reports/IncomeStatement/${schoolId}/${currentPeriod._id}`, {
              headers: { 'x-admin-id': adminId },
            }).then((response) => response.data?.data || null).catch(() => null),
            axios.get(`${API_BASE_URL}/Accounting/Audit/${schoolId}`, {
              headers: { 'x-admin-id': adminId },
            }).then((response) => response.data?.data || []).catch(() => []),
          ]);

          setAccounting({
            period: currentPeriod,
            trialBalance,
            budgetDashboard,
            balanceSheet,
            incomeStatement,
            auditLogs,
          });
        }
      } catch (error) {
        setMessage(error.response?.data?.message || error.message || 'Unable to load finance report');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [schoolId, adminId]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  const ledgerCards = [
    { label: 'Trial Balance', value: accounting.trialBalance ? `${formatMoney(accounting.trialBalance.totalDebit)} / ${formatMoney(accounting.trialBalance.totalCredit)}` : 'Not available' },
    { label: 'Budget Variance', value: accounting.budgetDashboard ? `${formatMoney(accounting.budgetDashboard.totalVariance)}` : 'Not available' },
    { label: 'Balance Sheet Total', value: accounting.balanceSheet ? `${formatMoney(accounting.balanceSheet.totalLiabilitiesAndEquity)}` : 'Not available' },
    { label: 'Net Income', value: accounting.incomeStatement ? `${formatMoney(accounting.incomeStatement.netIncome)}` : 'Not available' },
  ];

  const downloadAuditNotes = () => {
    const rows = [
      ['Date', 'Entity', 'Action', 'Audit note', 'Changed by', 'Source', 'Record ID'],
      ...accounting.auditLogs.map((log) => [
        log.changedAt || log.createdAt || '',
        log.entityType || '',
        log.action || '',
        log.notes || log.fieldName || 'Financial audit event recorded.',
        log.changedBy?._id || log.changedBy || '',
        log.source || '',
        log.entityId || '',
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-notes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Finance Report</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Review fees collected, outstanding balances, and the live ledger-based financial statements for the current period.
      </Typography>

      {message ? <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert> : null}

      {report ? (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { label: 'Total Expected Fees', value: report.totalExpectedFees ?? 0 },
            { label: 'Total Collected', value: report.totalCollected ?? 0 },
            { label: 'Outstanding Balance', value: report.outstandingBalance ?? 0 },
            { label: 'Class Fee Budget', value: report.classFeeBudget ?? 0 },
            { label: 'Incoming Cheques', value: report.incomingCheques ?? 0 },
            { label: 'Outgoing Cheques', value: report.outgoingCheques ?? 0 },
            { label: 'Supply Payments', value: report.supplyPayments ?? 0 },
            { label: 'Pending Cheques', value: report.pendingCheques ?? 0 },
          ].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item.label}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">{item.label}</Typography>
                <Typography variant="h5">{formatMoney(item.value)}</Typography>
              </Paper>
            </Grid>
          ))}

          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Cheque Register</Typography>
              {Array.isArray(report.chequeEntries) && report.chequeEntries.length > 0 ? (
                <Stack spacing={1.5}>
                  {report.chequeEntries.map((cheque, index) => (
                    <Box key={`${cheque.chequeNumber || 'entry'}-${index}`} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1.5 }}>
                      <Typography variant="subtitle2">{cheque.transactionType || 'Cheque'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {cheque.chequeNumber || '-'} • {cheque.bankName || cheque.bank || '-'} • {formatMoney(cheque.amount ?? 0)} • {cheque.status || 'Pending'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Payee/Payer: {cheque.payeePayer || cheque.payerPayee || '-'}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No cheque entries recorded yet.</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Alert severity="info" sx={{ mb: 4 }}>No legacy report data is available yet.</Alert>
      )}

      {accounting.period ? (
        <Box>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Ledger report: {accounting.period.name} ({accounting.period.status})
          </Typography>

          <Grid container spacing={2} sx={{ mb: 4 }}>
            {ledgerCards.map((item) => (
              <Grid item xs={12} sm={6} md={3} key={item.label}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h5">{item.value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Trial Balance</Typography>
                {accounting.trialBalance ? (
                  <Stack spacing={1}>
                    <Typography>Total debit: {formatMoney(accounting.trialBalance.totalDebit)}</Typography>
                    <Typography>Total credit: {formatMoney(accounting.trialBalance.totalCredit)}</Typography>
                    <Typography>Balanced: {accounting.trialBalance.balanced ? 'Yes' : 'No'}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {accounting.trialBalance.rows?.length ?? 0} accounts included
                    </Typography>
                  </Stack>
                ) : (
                  <Typography color="text.secondary">Trial balance data is not available for this period.</Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Budget vs Actual</Typography>
                {accounting.budgetDashboard ? (
                  <Stack spacing={1}>
                    <Typography>Total budget: {formatMoney(accounting.budgetDashboard.totalBudget)}</Typography>
                    <Typography>Total actual: {formatMoney(accounting.budgetDashboard.totalActual)}</Typography>
                    <Typography>Variance: {formatMoney(accounting.budgetDashboard.totalVariance)}</Typography>
                    <Typography>Status: {accounting.budgetDashboard.status}</Typography>
                  </Stack>
                ) : (
                  <Typography color="text.secondary">Budget data is not available for this period.</Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Balance Sheet</Typography>
                {accounting.balanceSheet ? (
                  <Stack spacing={1}>
                    <Typography>Assets: {formatMoney(accounting.balanceSheet.assets?.total ?? 0)}</Typography>
                    <Typography>Liabilities: {formatMoney(accounting.balanceSheet.liabilities?.total ?? 0)}</Typography>
                    <Typography>Equity: {formatMoney(accounting.balanceSheet.equity?.total ?? 0)}</Typography>
                    <Typography>Balanced: {accounting.balanceSheet.balanced ? 'Yes' : 'No'}</Typography>
                  </Stack>
                ) : (
                  <Typography color="text.secondary">Balance sheet data is not available for this period.</Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Income Statement</Typography>
                {accounting.incomeStatement ? (
                  <Stack spacing={1}>
                    <Typography>Revenue: {formatMoney(accounting.incomeStatement.revenue?.total ?? 0)}</Typography>
                    <Typography>Expenses: {formatMoney(accounting.incomeStatement.expenses?.total ?? 0)}</Typography>
                    <Typography>Net income: {formatMoney(accounting.incomeStatement.netIncome ?? 0)}</Typography>
                    <Typography>Status: {accounting.incomeStatement.status}</Typography>
                  </Stack>
                ) : (
                  <Typography color="text.secondary">Income statement data is not available for this period.</Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="h6">Auto-generated audit notes</Typography>
                  <Button size="small" startIcon={<DownloadIcon />} onClick={downloadAuditNotes} disabled={!accounting.auditLogs.length}>
                    Download CSV
                  </Button>
                </Stack>
                {accounting.auditLogs && accounting.auditLogs.length > 0 ? (
                  <Stack spacing={1}>
                    {accounting.auditLogs.slice(0, 6).map((log) => (
                      <Box key={log._id || `${log.entityType}-${log.createdAt}`} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1.5 }}>
                        <Typography variant="subtitle2">{log.entityType} • {log.action}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {log.notes || log.fieldName || 'Financial audit event recorded.'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">No audit notes are available yet.</Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Alert severity="info">No open accounting period has been created for this school yet. Initialize school accounting to generate the ledger reports.</Alert>
      )}
    </Box>
  );
};

export default FinanceReport;
