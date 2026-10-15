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
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
const money = (value) => `KES ${Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const blankLine = () => ({ accountId: '', debitAmount: '', creditAmount: '', description: '' });
const cents = (value) => Math.round(Number(value || 0) * 100);

const JournalManagement = () => {
  const { currentUser } = useSelector((state) => state.user);
  const schoolValue = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId;
  const schoolId = schoolValue && typeof schoolValue === 'object' ? schoolValue._id || schoolValue.id : schoolValue;
  const adminId = currentUser?._id || currentUser?.id;
  const headers = { 'x-admin-id': adminId };

  const [period, setPeriod] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([blankLine(), blankLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debitAmount) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.creditAmount) || 0), 0);
  const linesValid = lines.length >= 2 && lines.every((line) => {
    const debit = Number(line.debitAmount) || 0;
    const credit = Number(line.creditAmount) || 0;
    return Boolean(line.accountId) && debit >= 0 && credit >= 0 && ((debit > 0) !== (credit > 0));
  });
  const isBalanced = linesValid && cents(totalDebit) === cents(totalCredit);

  const loadData = async () => {
    if (!schoolId || !adminId) {
      setError('School context is unavailable. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [periodResponse, accountsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/Accounting/Period/${schoolId}`, { headers }),
        axios.get(`${API_BASE_URL}/Accounting/Journal/Accounts/${schoolId}`, { headers }),
      ]);
      const currentPeriod = periodResponse.data?.data || null;
      setPeriod(currentPeriod);
      setAccounts(accountsResponse.data?.data || []);
      if (currentPeriod?._id) {
        const entriesResponse = await axios.get(`${API_BASE_URL}/Accounting/Journals/${schoolId}/${currentPeriod._id}`, { headers });
        setEntries(entriesResponse.data?.data || []);
      } else {
        setEntries([]);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load journal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolId, adminId]);

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      if (field === 'debitAmount' && Number(value) > 0) return { ...line, debitAmount: value, creditAmount: '' };
      if (field === 'creditAmount' && Number(value) > 0) return { ...line, creditAmount: value, debitAmount: '' };
      return { ...line, [field]: value };
    }));
  };

  const addLine = () => setLines((current) => [...current, blankLine()]);
  const removeLine = (index) => setLines((current) => current.length > 2 ? current.filter((_, lineIndex) => lineIndex !== index) : current);

  const postJournal = async (event) => {
    event.preventDefault();
    if (!period?._id || period.status !== 'open') return setError('An open accounting period is required to post a journal.');
    if (!description.trim()) return setError('Enter a journal description.');
    if (!isBalanced) return setError('Add at least two valid lines and make total debits equal total credits.');

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(`${API_BASE_URL}/Accounting/Journal`, {
        schoolId,
        periodId: period._id,
        description: description.trim(),
        sourceModule: 'manual',
        lines: lines.map((line) => ({
          accountId: line.accountId,
          debitAmount: Number(line.debitAmount) || 0,
          creditAmount: Number(line.creditAmount) || 0,
          description: line.description.trim() || description.trim(),
          referenceType: 'manual',
        })),
      }, { headers });
      setMessage(`Journal ${response.data?.data?.journalEntry?.entryNo || ''} posted to the ledger.`);
      setDescription('');
      setLines([blankLine(), blankLine()]);
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to post journal entry.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Manual Journals</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}

      {period ? (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6">Financial period: {period.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date(period.startDate).toLocaleDateString()} to {new Date(period.endDate).toLocaleDateString()} · Status: {period.status}
          </Typography>
          {period.status !== 'open' && <Alert severity="warning" sx={{ mt: 1 }}>This period is closed. New journals cannot be posted.</Alert>}
        </Paper>
      ) : <Alert severity="warning" sx={{ mb: 2 }}>Create an accounting period before posting manual journals.</Alert>}

      <Paper component="form" onSubmit={postJournal} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>New journal entry</Typography>
        <Stack spacing={2}>
          <TextField required fullWidth label="Description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={period?.status !== 'open'} />
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Account</TableCell><TableCell>Description</TableCell><TableCell align="right">Debit (KES)</TableCell><TableCell align="right">Credit (KES)</TableCell><TableCell aria-label="Remove line" /></TableRow></TableHead>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ minWidth: 220 }}>
                      <TextField select fullWidth size="small" label="Account" value={line.accountId} onChange={(event) => updateLine(index, 'accountId', event.target.value)} disabled={period?.status !== 'open'}>
                        {accounts.map((account) => <MenuItem key={account._id} value={account._id}>{account.code} · {account.name}</MenuItem>)}
                      </TextField>
                    </TableCell>
                    <TableCell sx={{ minWidth: 170 }}><TextField fullWidth size="small" label="Line description" value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} disabled={period?.status !== 'open'} /></TableCell>
                    <TableCell sx={{ minWidth: 140 }}><TextField fullWidth size="small" type="number" label="Debit" value={line.debitAmount} inputProps={{ min: 0, step: 0.01 }} onChange={(event) => updateLine(index, 'debitAmount', event.target.value)} disabled={period?.status !== 'open'} /></TableCell>
                    <TableCell sx={{ minWidth: 140 }}><TextField fullWidth size="small" type="number" label="Credit" value={line.creditAmount} inputProps={{ min: 0, step: 0.01 }} onChange={(event) => updateLine(index, 'creditAmount', event.target.value)} disabled={period?.status !== 'open'} /></TableCell>
                    <TableCell><Button aria-label={`Remove journal line ${index + 1}`} title="Remove line" onClick={() => removeLine(index)} disabled={lines.length <= 2 || period?.status !== 'open'}><DeleteOutlineIcon /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
            <Button startIcon={<AddIcon />} onClick={addLine} disabled={period?.status !== 'open'}>Add line</Button>
            <Typography color={isBalanced ? 'success.main' : 'text.secondary'}>
              Debits: {money(totalDebit)} · Credits: {money(totalCredit)} · {isBalanced ? 'Balanced' : 'Not balanced'}
            </Typography>
            <Button type="submit" variant="contained" disabled={saving || period?.status !== 'open' || !isBalanced}>
              {saving ? 'Posting...' : 'Post journal'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>Recent posted entries</Typography>
      <Stack spacing={1.5}>
        {entries.map((entry) => (
          <Paper key={entry._id} sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5} sx={{ mb: 1 }}>
              <Box>
                <Typography variant="subtitle1">{entry.entryNo} · {entry.description}</Typography>
                <Typography variant="body2" color="text.secondary">{new Date(entry.entryDate).toLocaleString()} · {entry.status}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">{entry.sourceModule}</Typography>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow><TableCell>Account</TableCell><TableCell>Description</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell></TableRow></TableHead>
                <TableBody>
                  {(entry.lines || []).map((line) => (
                    <TableRow key={line._id}>
                      <TableCell>{line.accountId?.code} · {line.accountId?.name}</TableCell>
                      <TableCell>{line.description || '-'}</TableCell>
                      <TableCell align="right">{line.debitAmount ? money(line.debitAmount) : '-'}</TableCell>
                      <TableCell align="right">{line.creditAmount ? money(line.creditAmount) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ))}
        {!entries.length && <Typography color="text.secondary">No journal entries are posted in this period.</Typography>}
      </Stack>
    </Box>
  );
};

export default JournalManagement;