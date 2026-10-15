import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import PrintIcon from '@mui/icons-material/Print';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { buildPrintBrandingHtml, printBrandingStyles } from '../../utils/printBranding';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
const voucherTypes = [
  { value: 'PV', label: 'Payment Voucher' },
  { value: 'RV', label: 'Receipt Voucher' },
  { value: 'JV', label: 'Journal Voucher' },
  { value: 'CV', label: 'Contra Voucher' },
];
const blankLine = () => ({ accountId: '', debitAmount: '', creditAmount: '', description: '' });
const cents = (value) => Math.round(Number(value || 0) * 100);
const money = (value) => `KES ${Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => value ? new Date(value).toLocaleDateString() : '-';
const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const VouchersPage = () => {
  const { currentUser } = useSelector((state) => state.user);
  const schoolValue = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId;
  const schoolId = schoolValue && typeof schoolValue === 'object' ? schoolValue._id || schoolValue.id : schoolValue;
  const adminId = currentUser?._id || currentUser?.id;
  const role = currentUser?.role || '';
  const headers = { 'x-admin-id': adminId };

  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [voucherType, setVoucherType] = useState('PV');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [payeePayer, setPayeePayer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([blankLine(), blankLine()]);
  const [receiptFiles, setReceiptFiles] = useState([]);
  const [receiptPreviews, setReceiptPreviews] = useState([]);
  const [activeVoucher, setActiveVoucher] = useState(null);
  const [auditVoucher, setAuditVoucher] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actioningVoucherId, setActioningVoucherId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debitAmount) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.creditAmount) || 0), 0);
  const linesValid = lines.length >= 2 && lines.every((line) => {
    const debit = Number(line.debitAmount) || 0;
    const credit = Number(line.creditAmount) || 0;
    return Boolean(line.accountId) && debit >= 0 && credit >= 0 && ((debit > 0) !== (credit > 0));
  });
  const balanced = linesValid && cents(totalDebit) === cents(totalCredit);
  const canApprove = ['Admin', 'SuperAdmin'].includes(role);
  const currentPeriod = useMemo(() => periods.find((period) => String(period._id) === String(selectedPeriodId)), [periods, selectedPeriodId]);

  useEffect(() => {
    const previews = receiptFiles.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setReceiptPreviews(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [receiptFiles]);

  const loadVouchers = async (periodId = selectedPeriodId) => {
    if (!schoolId || !adminId) return;
    const params = periodId ? { params: { periodId }, headers } : { headers };
    const response = await axios.get(`${API_BASE_URL}/Accounting/Vouchers/${schoolId}`, params);
    setVouchers(response.data?.data || []);
  };

  const loadReferenceData = async () => {
    if (!schoolId || !adminId) {
      setError('School context is unavailable. Please sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [periodResponse, accountResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/Accounting/VoucherPeriods/${schoolId}`, { headers }),
        axios.get(`${API_BASE_URL}/Accounting/VoucherAccounts/${schoolId}`, { headers }),
      ]);
      const nextPeriods = periodResponse.data?.data || [];
      setPeriods(nextPeriods);
      setAccounts(accountResponse.data?.data || []);
      const preferredPeriod = nextPeriods.find((period) => period.status === 'open') || nextPeriods[0];
      const periodId = selectedPeriodId || preferredPeriod?._id || '';
      if (periodId) setSelectedPeriodId(String(periodId));
      await loadVouchers(periodId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load voucher data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, [schoolId, adminId]);

  useEffect(() => {
    if (!schoolId || !adminId || !periods.length) return;
    loadVouchers(selectedPeriodId).catch((requestError) => {
      setError(requestError.response?.data?.message || 'Unable to load vouchers.');
    });
  }, [selectedPeriodId]);

  const resetForm = () => {
    setActiveVoucher(null);
    setVoucherType('PV');
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setPayeePayer('');
    setPaymentMethod('Bank Transfer');
    setDescription('');
    setLines([blankLine(), blankLine()]);
    setReceiptFiles([]);
  };

  const editVoucher = (voucher) => {
    if (!['draft', 'rejected'].includes(voucher.status)) return;
    setActiveVoucher(voucher);
    setSelectedPeriodId(String(voucher.periodId));
    setVoucherType(voucher.voucherType);
    setVoucherDate(new Date(voucher.voucherDate).toISOString().slice(0, 10));
    setPayeePayer(voucher.payeePayer || '');
    setPaymentMethod(voucher.paymentMethod || 'Other');
    setDescription(voucher.description || '');
    setLines((voucher.lines || []).map((line) => ({
      accountId: line.accountId?._id || line.accountId || '',
      debitAmount: line.debitAmount ? String(line.debitAmount) : '',
      creditAmount: line.creditAmount ? String(line.creditAmount) : '',
      description: line.description || '',
    })) || [blankLine(), blankLine()]);
    setReceiptFiles([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      if (field === 'debitAmount' && Number(value) > 0) return { ...line, debitAmount: value, creditAmount: '' };
      if (field === 'creditAmount' && Number(value) > 0) return { ...line, creditAmount: value, debitAmount: '' };
      return { ...line, [field]: value };
    }));
  };

  const saveDraft = async (event) => {
    event.preventDefault();
    if (!selectedPeriodId || currentPeriod?.status !== 'open') return setError('Select an open accounting period to save a voucher.');
    if (!description.trim()) return setError('Enter a transaction description.');
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        voucherType,
        periodId: selectedPeriodId,
        voucherDate,
        payeePayer,
        paymentMethod,
        description,
        lines: lines.map((line) => ({
          accountId: line.accountId,
          debitAmount: Number(line.debitAmount) || 0,
          creditAmount: Number(line.creditAmount) || 0,
          description: line.description,
        })),
      };
      const response = activeVoucher
        ? await axios.put(`${API_BASE_URL}/Accounting/Vouchers/${schoolId}/${activeVoucher._id}`, payload, { headers })
        : await axios.post(`${API_BASE_URL}/Accounting/Vouchers/${schoolId}`, payload, { headers });
      let savedVoucher = response.data?.data;

      if (receiptFiles.length) {
        const formData = new FormData();
        receiptFiles.forEach((file) => formData.append('receipts', file));
        const uploadResponse = await axios.post(
          `${API_BASE_URL}/Accounting/Vouchers/${schoolId}/${savedVoucher._id}/receipts`,
          formData,
          { headers: { 'x-admin-id': adminId } }
        );
        savedVoucher = uploadResponse.data?.data || savedVoucher;
        setReceiptFiles([]);
      }

      setActiveVoucher(savedVoucher);
      setMessage(`${savedVoucher.voucherNo} saved as a draft.`);
      await loadVouchers(selectedPeriodId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save voucher draft.');
    } finally {
      setSaving(false);
    }
  };

  const runVoucherAction = async (voucher, action) => {
    const reason = action === 'Reject' ? window.prompt('Enter the reason for rejecting this voucher:') : '';
    if (action === 'Reject' && !reason?.trim()) return;
    const confirmed = action === 'Approve' && !window.confirm(`Approve and post ${voucher.voucherNo} to the ledger? This cannot be edited after posting.`);
    if (confirmed) return;
    setActioningVoucherId(voucher._id);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/Accounting/Vouchers/${schoolId}/${voucher._id}/${action}`,
        action === 'Reject' ? { reason } : {},
        { headers }
      );
      setMessage(response.data?.message || `${voucher.voucherNo} ${action.toLowerCase()}ed.`);
      if (activeVoucher?._id === voucher._id) setActiveVoucher(response.data?.data || null);
      await loadVouchers(selectedPeriodId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to ${action.toLowerCase()} voucher.`);
    } finally {
      setActioningVoucherId('');
    }
  };

  const reverseVoucher = async (voucher) => {
    const reason = window.prompt(`Reason for reversing ${voucher.voucherNo}:`);
    if (!reason?.trim()) return;
    if (!window.confirm(`Post a compensating journal for ${voucher.voucherNo}? The original voucher will remain in the audit trail.`)) return;
    setActioningVoucherId(voucher._id);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(`${API_BASE_URL}/Accounting/Vouchers/${schoolId}/${voucher._id}/Reverse`, { reason }, { headers });
      setMessage(response.data?.message || `${voucher.voucherNo} reversed.`);
      if (activeVoucher?._id === voucher._id) setActiveVoucher(response.data?.data || null);
      await loadVouchers(selectedPeriodId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reverse voucher.');
    } finally {
      setActioningVoucherId('');
    }
  };

  const openReceipt = async (voucher, receipt) => {
    try {
      const response = await fetch(`${API_BASE_URL}/Accounting/Vouchers/${schoolId}/${voucher._id}/receipts/${receipt._id}`, {
        headers: { 'x-admin-id': adminId },
      });
      if (!response.ok) throw new Error('Unable to open this receipt file.');
      const fileUrl = URL.createObjectURL(await response.blob());
      const opened = window.open(fileUrl, '_blank', 'noopener');
      if (!opened) URL.revokeObjectURL(fileUrl);
      else window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
    } catch (openError) {
      setError(openError.message || 'Unable to open receipt.');
    }
  };

  const removeReceipt = async (voucher, receipt) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/Accounting/Vouchers/${schoolId}/${voucher._id}/receipts/${receipt._id}`, { headers });
      setMessage(response.data?.message || 'Receipt detached from draft.');
      await loadVouchers(selectedPeriodId);
      if (activeVoucher?._id === voucher._id) {
        const refreshed = await axios.get(`${API_BASE_URL}/Accounting/Vouchers/${schoolId}`, { headers, params: { periodId: selectedPeriodId } });
        setActiveVoucher((refreshed.data?.data || []).find((item) => item._id === voucher._id) || null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to remove receipt.');
    }
  };

  const openAudit = async (voucher) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/Accounting/Vouchers/${schoolId}/${voucher._id}/Audit`, { headers });
      setAuditRows(response.data?.data || []);
      setAuditVoucher(voucher);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load voucher audit history.');
    }
  };

  const printVoucher = (voucher) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return setError('Allow pop-ups to print this voucher.');
    const linesHtml = (voucher.lines || []).map((line) => {
      const lineAccount = line.accountId && typeof line.accountId === 'object'
        ? line.accountId
        : accounts.find((account) => String(account._id) === String(line.accountId));
      return `<tr><td>${escapeHtml(`${lineAccount?.code || ''} ${lineAccount?.name || ''}`)}</td><td>${escapeHtml(line.description || '')}</td><td class="amount">${line.debitAmount ? money(line.debitAmount) : '-'}</td><td class="amount">${line.creditAmount ? money(line.creditAmount) : '-'}</td></tr>`;
    }).join('');
    const receiptsHtml = (voucher.receipts || []).map((receipt) => `<li>${escapeHtml(receipt.originalName)} (${escapeHtml(receipt.mimeType)})</li>`).join('');
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(voucher.voucherNo)}</title><style>body{font:13px Arial,sans-serif;padding:24px;color:#222}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #bbb;padding:8px;text-align:left}.amount{text-align:right}.meta{margin:5px 0}.signatures{display:flex;gap:60px;margin-top:55px}.signatures div{flex:1;border-top:1px solid #333;padding-top:8px}${printBrandingStyles}</style></head><body>${buildPrintBrandingHtml(currentUser)}<h2>${escapeHtml(voucherTypes.find((item) => item.value === voucher.voucherType)?.label || voucher.voucherType)}</h2><p class="meta"><strong>Voucher:</strong> ${escapeHtml(voucher.voucherNo)} &nbsp; <strong>Date:</strong> ${escapeHtml(dateLabel(voucher.voucherDate))}</p><p class="meta"><strong>Status:</strong> ${escapeHtml(voucher.status)} &nbsp; <strong>Payment method:</strong> ${escapeHtml(voucher.paymentMethod)}</p><p class="meta"><strong>Payee / Payer:</strong> ${escapeHtml(voucher.payeePayer || '-')}</p><p class="meta"><strong>Description:</strong> ${escapeHtml(voucher.description)}</p><table><thead><tr><th>Account</th><th>Description</th><th class="amount">Debit</th><th class="amount">Credit</th></tr></thead><tbody>${linesHtml}</tbody></table><h3>Supporting receipts</h3><ul>${receiptsHtml || '<li>No receipt attached</li>'}</ul><div class="signatures"><div>Prepared by: ${escapeHtml(voucher.preparedBy?.name || '')}</div><div>Approved by: ${escapeHtml(voucher.approvedBy?.name || '')}</div></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  if (loading) return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  const editable = !activeVoucher || ['draft', 'rejected'].includes(activeVoucher.status);
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h4">Accounting Vouchers</Typography>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={resetForm}>New voucher</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}

      <Paper component="form" onSubmit={saveDraft} sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h6">{activeVoucher ? `Edit ${activeVoucher.voucherNo}` : 'Prepare voucher'}</Typography>
          {activeVoucher && <Typography variant="body2" color="text.secondary">Status: {activeVoucher.status}</Typography>}
        </Stack>
        {activeVoucher?.status === 'rejected' && <Alert severity="warning" sx={{ mb: 2 }}>Returned for correction: {activeVoucher.rejectionReason}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 2, mb: 2 }}>
          <TextField select label="Voucher type" value={voucherType} onChange={(event) => setVoucherType(event.target.value)} disabled={!editable}>
            {voucherTypes.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
          </TextField>
          <TextField required select label="Accounting period" value={selectedPeriodId} onChange={(event) => setSelectedPeriodId(event.target.value)} disabled={!editable}>
            {periods.map((period) => <MenuItem key={period._id} value={period._id}>{period.name} · {period.status}</MenuItem>)}
          </TextField>
          <TextField required type="date" label="Voucher date" value={voucherDate} InputLabelProps={{ shrink: true }} onChange={(event) => setVoucherDate(event.target.value)} disabled={!editable} />
          <TextField select label="Payment method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={!editable}>
            {['Cash', 'Bank Transfer', 'M-Pesa', 'Cheque', 'Other'].map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
          </TextField>
          <TextField label="Payee / Payer / Supplier" value={payeePayer} onChange={(event) => setPayeePayer(event.target.value)} disabled={!editable} />
          <TextField required label="Description / purpose" value={description} onChange={(event) => setDescription(event.target.value)} disabled={!editable} />
        </Box>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>Accounting lines</Typography>
        <TableContainer sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Account</TableCell><TableCell>Description</TableCell><TableCell align="right">Debit (KES)</TableCell><TableCell align="right">Credit (KES)</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell sx={{ minWidth: 210 }}><TextField required select fullWidth size="small" label="Account" value={line.accountId} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, accountId: event.target.value } : item))} disabled={!editable}>
                    {accounts.map((account) => <MenuItem key={account._id} value={account._id}>{account.code} · {account.name}</MenuItem>)}
                  </TextField></TableCell>
                  <TableCell sx={{ minWidth: 170 }}><TextField fullWidth size="small" label="Line description" value={line.description} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} disabled={!editable} /></TableCell>
                  <TableCell sx={{ minWidth: 135 }}><TextField fullWidth size="small" type="number" label="Debit" value={line.debitAmount} inputProps={{ min: 0, step: 0.01 }} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, debitAmount: event.target.value, creditAmount: Number(event.target.value) > 0 ? '' : item.creditAmount } : item))} disabled={!editable} /></TableCell>
                  <TableCell sx={{ minWidth: 135 }}><TextField fullWidth size="small" type="number" label="Credit" value={line.creditAmount} inputProps={{ min: 0, step: 0.01 }} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, creditAmount: event.target.value, debitAmount: Number(event.target.value) > 0 ? '' : item.debitAmount } : item))} disabled={!editable} /></TableCell>
                  <TableCell><Button aria-label={`Remove line ${index + 1}`} disabled={!editable || lines.length <= 2} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>Remove</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
          <Button startIcon={<AddIcon />} onClick={() => setLines((current) => [...current, blankLine()])} disabled={!editable}>Add line</Button>
          <Typography color={balanced ? 'success.main' : 'text.secondary'}>Debit {money(totalDebit)} · Credit {money(totalCredit)} · {balanced ? 'Balanced' : 'Not balanced'}</Typography>
        </Stack>

        <Stack spacing={1} sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Supporting receipts</Typography>
          <Button component="label" variant="outlined" disabled={!editable} sx={{ alignSelf: 'flex-start' }}>
            Scan or upload receipt
            <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={(event) => setReceiptFiles(Array.from(event.target.files || []))} />
          </Button>
          {receiptPreviews.map(({ file, url }, index) => (
            <Stack key={`${file.name}-${index}`} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              {file.type.startsWith('image/') && <Box component="img" src={url} alt={file.name} sx={{ width: 88, height: 68, objectFit: 'cover', border: '1px solid #ddd', borderRadius: 1 }} />}
              <Typography variant="body2">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</Typography>
            </Stack>
          ))}
          {(activeVoucher?.receipts || []).map((receipt) => (
            <Stack key={receipt._id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Typography variant="body2">{receipt.originalName}</Typography>
              <Button size="small" startIcon={<VisibilityIcon />} onClick={() => openReceipt(activeVoucher, receipt)}>Preview</Button>
              {editable && <Button size="small" color="error" onClick={() => removeReceipt(activeVoucher, receipt)}>Detach</Button>}
            </Stack>
          ))}
        </Stack>

        {voucherType === 'RV' && <Alert severity="info" sx={{ mb: 2 }}>Record student fee payments through the existing Student Payments workflow. Fee-revenue receipt vouchers are blocked to prevent duplicate ledger entries.</Alert>}
        {voucherType === 'PV' && !activeVoucher?.receipts?.length && !receiptFiles.length && <Alert severity="warning" sx={{ mb: 2 }}>Payment vouchers require a scanned supplier receipt or invoice before submission.</Alert>}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {editable && <Button type="submit" variant="contained" disabled={saving || !currentPeriod || currentPeriod.status !== 'open'}>{saving ? 'Saving...' : 'Save draft'}</Button>}
          {activeVoucher && editable && <Button variant="outlined" onClick={() => runVoucherAction(activeVoucher, 'Submit')} disabled={actioningVoucherId === activeVoucher._id || !balanced || (activeVoucher.voucherType === 'PV' && !(activeVoucher.receipts || []).length && !receiptFiles.length)}>Submit for approval</Button>}
          {activeVoucher?.status === 'submitted' && canApprove && <>
            <Button variant="contained" color="success" onClick={() => runVoucherAction(activeVoucher, 'Approve')} disabled={actioningVoucherId === activeVoucher._id}>Approve and post</Button>
            <Button variant="outlined" color="error" onClick={() => runVoucherAction(activeVoucher, 'Reject')} disabled={actioningVoucherId === activeVoucher._id}>Reject</Button>
          </>}
          {activeVoucher && <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => printVoucher(activeVoucher)}>Print / Save PDF</Button>}
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h6">Vouchers</Typography>
        <TextField select size="small" label="List period" value={selectedPeriodId} onChange={(event) => setSelectedPeriodId(event.target.value)} sx={{ minWidth: 220 }}>
          <MenuItem value="">All periods</MenuItem>
          {periods.map((period) => <MenuItem key={period._id} value={period._id}>{period.name}</MenuItem>)}
        </TextField>
      </Stack>
      <Stack spacing={1.5}>
        {vouchers.map((voucher) => (
          <Paper key={voucher._id} sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="subtitle1">{voucher.voucherNo} · {voucherTypes.find((type) => type.value === voucher.voucherType)?.label || voucher.voucherType}</Typography>
                <Typography variant="body2">{voucher.description} · {voucher.payeePayer || 'No payee / payer'}</Typography>
                <Typography variant="caption" color="text.secondary">{dateLabel(voucher.voucherDate)} · {voucher.status} · Prepared by {voucher.preparedBy?.name || 'Staff'}</Typography>
              </Box>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {['draft', 'rejected'].includes(voucher.status) && String(voucher.preparedBy?._id || voucher.preparedBy) === String(adminId) && <Button size="small" onClick={() => editVoucher(voucher)}>Edit</Button>}
                {voucher.status === 'submitted' && canApprove && <>
                  <Button size="small" onClick={() => runVoucherAction(voucher, 'Approve')}>Approve &amp; post</Button>
                  <Button size="small" color="error" onClick={() => runVoucherAction(voucher, 'Reject')}>Reject</Button>
                </>}
                {voucher.status === 'posted' && canApprove && <Button size="small" color="error" disabled={actioningVoucherId === voucher._id} onClick={() => reverseVoucher(voucher)}>Reverse</Button>}
                <Button size="small" onClick={() => openAudit(voucher)}>Audit</Button>
                <Button size="small" startIcon={<PrintIcon />} onClick={() => printVoucher(voucher)}>Print</Button>
              </Stack>
            </Stack>
            <TableContainer sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Account</TableCell><TableCell>Description</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell></TableRow></TableHead>
                <TableBody>
                  {(voucher.lines || []).map((line) => <TableRow key={line._id}>
                    <TableCell>{line.accountId?.code} · {line.accountId?.name}</TableCell><TableCell>{line.description || '-'}</TableCell>
                    <TableCell align="right">{line.debitAmount ? money(line.debitAmount) : '-'}</TableCell><TableCell align="right">{line.creditAmount ? money(line.creditAmount) : '-'}</TableCell>
                  </TableRow>)}
                  {!voucher.lines?.length && <TableRow><TableCell colSpan={4}>No lines entered yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            {(voucher.receipts || []).length > 0 && <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {(voucher.receipts || []).map((receipt) => <Button key={receipt._id} size="small" startIcon={<VisibilityIcon />} onClick={() => openReceipt(voucher, receipt)}>{receipt.originalName}</Button>)}
            </Stack>}
            {voucher.rejectionReason && <Alert severity="warning" sx={{ mt: 1 }}>Rejection reason: {voucher.rejectionReason}</Alert>}
          </Paper>
        ))}
        {!vouchers.length && <Typography color="text.secondary">No vouchers found for this period.</Typography>}
      </Stack>

      <Dialog open={Boolean(auditVoucher)} onClose={() => setAuditVoucher(null)} fullWidth maxWidth="md">
        <DialogTitle>Audit history · {auditVoucher?.voucherNo}</DialogTitle>
        <DialogContent dividers>
          {auditRows.length ? auditRows.map((row) => <Paper key={row._id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
            <Typography variant="subtitle2">{row.action} · {new Date(row.changedAt).toLocaleString()}</Typography>
            <Typography variant="body2">{row.notes}</Typography>
          </Paper>) : <Typography color="text.secondary">No audit actions recorded.</Typography>}
        </DialogContent>
        <DialogActions><Button onClick={() => setAuditVoucher(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default VouchersPage;