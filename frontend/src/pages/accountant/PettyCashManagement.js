import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
const money = (value) => `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
const dateLabel = (value) => value ? new Date(value).toLocaleString() : '-';

const PettyCashManagement = () => {
  const { currentUser } = useSelector((state) => state.user);
  const schoolValue = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId;
  const schoolId = schoolValue && typeof schoolValue === 'object' ? schoolValue._id || schoolValue.id : schoolValue;
  const adminId = currentUser?._id || currentUser?.id;
  const headers = { 'x-admin-id': adminId };

  const [summary, setSummary] = useState(null);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [transaction, setTransaction] = useState({ type: 'fund', amount: '', description: '', expenseAccountId: '' });
  const [physicalBalance, setPhysicalBalance] = useState('');
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [savingReconciliation, setSavingReconciliation] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = async () => {
    if (!schoolId || !adminId) {
      setError('School context is unavailable. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [summaryResponse, accountsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/Accounting/PettyCash/${schoolId}`, { headers }),
        axios.get(`${API_BASE_URL}/Accounting/Budget/Accounts/${schoolId}`, { headers }),
      ]);
      setSummary(summaryResponse.data?.data || null);
      setExpenseAccounts((accountsResponse.data?.data || []).filter((account) => account.type === 'expense'));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load petty cash.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolId, adminId]);

  const handleTransactionSubmit = async (event) => {
    event.preventDefault();
    setSavingTransaction(true);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/Accounting/PettyCash/${schoolId}/transactions`,
        transaction,
        { headers }
      );
      setMessage(`${response.data.message}. New balance: ${money(response.data.balance)}.`);
      setTransaction((current) => ({ ...current, amount: '', description: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to record petty-cash transaction.');
    } finally {
      setSavingTransaction(false);
    }
  };

  const handleReconcile = async (event) => {
    event.preventDefault();
    setSavingReconciliation(true);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/Accounting/PettyCash/${schoolId}/reconcile`,
        { physicalBalance: Number(physicalBalance), notes: reconciliationNotes },
        { headers }
      );
      setMessage(`${response.data.message}. Counted: ${money(response.data.physicalBalance)}; variance: ${money(response.data.variance)}.`);
      setPhysicalBalance('');
      setReconciliationNotes('');
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reconcile petty cash.');
    } finally {
      setSavingReconciliation(false);
    }
  };

  const getTransactionRows = () => {
    let runningBalance = Number(summary?.balance || 0);
    return (summary?.transactions || []).map((item) => {
      const row = { ...item, balanceAfter: runningBalance };
      runningBalance -= Number(item.movement || 0);
      return row;
    });
  };

  if (loading) return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Petty Cash</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}

      {!summary?.openPeriod && <Alert severity="warning" sx={{ mb: 2 }}>An open accounting period is required to record petty-cash transactions.</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Cash in Hand · Account {summary?.account?.code || '1010'}</Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>{money(summary?.balance)}</Typography>
        <Typography variant="body2" color="text.secondary">
          {summary?.openPeriod ? `Open period: ${summary.openPeriod.name}` : 'No open accounting period'}
        </Typography>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 2 }}>
        <Paper component="form" onSubmit={handleTransactionSubmit} sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Record movement</Typography>
          <Stack spacing={2}>
            <TextField
              select
              label="Movement"
              value={transaction.type}
              onChange={(event) => setTransaction((current) => ({ ...current, type: event.target.value }))}
              disabled={!summary?.openPeriod}
            >
              <MenuItem value="fund">Add / replenish cash from bank</MenuItem>
              <MenuItem value="expense">Pay petty-cash expense</MenuItem>
            </TextField>
            {transaction.type === 'expense' && (
              <TextField
                required
                select
                label="Expense account"
                value={transaction.expenseAccountId}
                onChange={(event) => setTransaction((current) => ({ ...current, expenseAccountId: event.target.value }))}
                disabled={!summary?.openPeriod}
              >
                {expenseAccounts.map((account) => <MenuItem key={account._id} value={account._id}>{account.code} · {account.name}</MenuItem>)}
              </TextField>
            )}
            <TextField
              required
              type="number"
              label="Amount (KES)"
              value={transaction.amount}
              inputProps={{ min: 0.01, step: 0.01 }}
              onChange={(event) => setTransaction((current) => ({ ...current, amount: event.target.value }))}
              disabled={!summary?.openPeriod}
            />
            <TextField
              required
              label={transaction.type === 'fund' ? 'Funding reference / note' : 'Payee and purpose'}
              value={transaction.description}
              onChange={(event) => setTransaction((current) => ({ ...current, description: event.target.value }))}
              disabled={!summary?.openPeriod}
            />
            <Button type="submit" variant="contained" disabled={savingTransaction || !summary?.openPeriod}>
              {savingTransaction ? 'Saving...' : transaction.type === 'fund' ? 'Record top-up' : 'Record expense'}
            </Button>
          </Stack>
        </Paper>

        <Paper component="form" onSubmit={handleReconcile} sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Reconcile cash count</Typography>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">Count the physical cash and compare it with the ledger. Any difference will be journaled and audited.</Typography>
            <TextField
              required
              type="number"
              label="Physical cash counted (KES)"
              value={physicalBalance}
              inputProps={{ min: 0, step: 0.01 }}
              onChange={(event) => setPhysicalBalance(event.target.value)}
              disabled={!summary?.openPeriod}
            />
            <TextField
              label="Reconciliation note"
              multiline
              minRows={2}
              value={reconciliationNotes}
              onChange={(event) => setReconciliationNotes(event.target.value)}
              disabled={!summary?.openPeriod}
            />
            <Button type="submit" variant="outlined" disabled={savingReconciliation || !summary?.openPeriod}>
              {savingReconciliation ? 'Reconciling...' : 'Reconcile'}
            </Button>
          </Stack>
        </Paper>
      </Box>

      <Paper sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ p: 2, pb: 0 }}>Cash movements</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Description</TableCell><TableCell>Journal</TableCell><TableCell align="right">In</TableCell><TableCell align="right">Out</TableCell><TableCell align="right">Balance after</TableCell></TableRow></TableHead>
            <TableBody>
              {getTransactionRows().map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{dateLabel(item.date)}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.entryNo || '-'}</TableCell>
                  <TableCell align="right">{item.movement > 0 ? money(item.movement) : '-'}</TableCell>
                  <TableCell align="right">{item.movement < 0 ? money(Math.abs(item.movement)) : '-'}</TableCell>
                  <TableCell align="right">{money(item.balanceAfter)}</TableCell>
                </TableRow>
              ))}
              {!summary?.transactions?.length && <TableRow><TableCell colSpan={6} align="center">No petty-cash movements recorded.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper>
        <Typography variant="h6" sx={{ p: 2, pb: 0 }}>Recent reconciliations</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>Counted at</TableCell><TableCell align="right">System balance</TableCell><TableCell align="right">Physical count</TableCell><TableCell align="right">Difference</TableCell><TableCell>Audit note</TableCell></TableRow></TableHead>
            <TableBody>
              {(summary?.reconciliations || []).map((item) => {
                const systemBalance = Number(item.oldValue?.systemBalance || 0);
                const physicalCount = Number(item.newValue?.physicalBalance || 0);
                return <TableRow key={item._id}>
                  <TableCell>{dateLabel(item.changedAt)}</TableCell>
                  <TableCell align="right">{money(systemBalance)}</TableCell>
                  <TableCell align="right">{money(physicalCount)}</TableCell>
                  <TableCell align="right">{money(physicalCount - systemBalance)}</TableCell>
                  <TableCell>{item.notes || '-'}</TableCell>
                </TableRow>;
              })}
              {!summary?.reconciliations?.length && <TableRow><TableCell colSpan={5} align="center">No reconciliations recorded.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default PettyCashManagement;