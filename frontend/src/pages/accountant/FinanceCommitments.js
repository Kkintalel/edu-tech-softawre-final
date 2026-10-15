import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { buildPrintBrandingHtml, printBrandingStyles } from '../../utils/printBranding';
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
const money = (amount, currency = 'KES') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount) || 0);

const FinanceCommitments = () => {
  const { currentUser, currentRole } = useSelector((state) => state.user);
  const schoolId = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId || currentUser?._id;
  const userId = currentUser?._id || currentUser?.id;
  const headers = useMemo(() => userId ? { 'x-admin-id': userId, 'x-user-id': userId } : {}, [userId]);
  const [tab, setTab] = useState(0);
  const [students, setStudents] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pledgeForm, setPledgeForm] = useState({ studentId: '', promisedBy: '', promisedAmount: '', promisedDate: '', note: '' });
  const [orderForm, setOrderForm] = useState({ type: 'LPO', supplier: '', description: '', amount: '', transactionReference: '', note: '' });
  const [fulfillPledge, setFulfillPledge] = useState(null);
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [paymentRecordId, setPaymentRecordId] = useState('');
  const [fulfillmentAmount, setFulfillmentAmount] = useState('');
  const [orderToPay, setOrderToPay] = useState(null);
  const [orderPaymentReference, setOrderPaymentReference] = useState('');

  const loadRecords = useCallback(async () => {
    if (!schoolId || !userId) {
      setError('School finance access is unavailable for this account.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [studentsResponse, pledgesResponse, ordersResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/Students/${schoolId}`, { headers }),
        axios.get(`${API_BASE_URL}/api/finance/pledges`, { headers }),
        axios.get(`${API_BASE_URL}/api/finance/orders`, { headers }),
      ]);
      setStudents(Array.isArray(studentsResponse.data) ? studentsResponse.data : studentsResponse.data?.students || []);
      setPledges(pledgesResponse.data.pledges || []);
      setOrders(ordersResponse.data.orders || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not load finance records');
    } finally {
      setLoading(false);
    }
  }, [headers, schoolId, userId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const submitPledge = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await axios.post(`${API_BASE_URL}/api/finance/pledges`, pledgeForm, { headers });
      setPledgeForm({ studentId: '', promisedBy: '', promisedAmount: '', promisedDate: '', note: '' });
      setMessage('Fee pledge recorded. It remains separate from collected fees until matched to a verified payment.');
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not save pledge');
    } finally {
      setSaving(false);
    }
  };

  const openFulfillment = async (pledge) => {
    setError('');
    setMessage('');
    setFulfillPledge(pledge);
    setPaymentOptions([]);
    setPaymentRecordId('');
    setFulfillmentAmount('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/finance/pledges/${pledge._id}/payments`, { headers });
      setPaymentOptions(response.data.payments || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load verified receipts');
    }
  };

  const linkPayment = async () => {
    if (!fulfillPledge || !paymentRecordId) return;
    setSaving(true);
    try {
      await axios.post(`${API_BASE_URL}/api/finance/pledges/${fulfillPledge._id}/fulfill`, {
        paymentRecordId,
        ...(fulfillmentAmount ? { amount: Number(fulfillmentAmount) } : {}),
      }, { headers });
      setFulfillPledge(null);
      setMessage('Verified payment linked to the pledge.');
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not link payment to pledge');
    } finally {
      setSaving(false);
    }
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await axios.post(`${API_BASE_URL}/api/finance/orders`, orderForm, { headers });
      setOrderForm({ type: 'LPO', supplier: '', description: '', amount: '', transactionReference: '', note: '' });
      setMessage('Finance record created and sent for approval.');
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save finance record');
    } finally {
      setSaving(false);
    }
  };

  const updateOrderStatus = async (order, status, transactionReference = '') => {
    setSaving(true);
    try {
      await axios.patch(`${API_BASE_URL}/api/finance/orders/${order._id}/status`, { status, transactionReference }, { headers });
      setOrderToPay(null);
      setMessage(`Record ${status.toLowerCase()}.`);
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update finance record');
    } finally {
      setSaving(false);
    }
  };

  const printOrder = (order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>${order.type} ${order.reference}</title><style>body{font:14px Arial;padding:36px;color:#172026}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:24px}td{border-bottom:1px solid #ccd3d7;padding:10px}td:first-child{font-weight:bold;width:32%}${printBrandingStyles}</style></head><body>${buildPrintBrandingHtml(currentUser)}<h1>${order.type}</h1><table><tr><td>Reference</td><td>${order.reference}</td></tr><tr><td>Supplier</td><td>${order.supplier}</td></tr><tr><td>Description</td><td>${order.description}</td></tr><tr><td>Amount</td><td>${money(order.amount, order.currency || 'KES')}</td></tr><tr><td>Status</td><td>${order.status}</td></tr><tr><td>Transaction reference</td><td>${order.transactionReference || 'Not paid'}</td></tr></table></body></html>`);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  if (loading) return <Box sx={{ p: 3 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Pledges & procurement</Typography>
          <Typography variant="body2" color="text.secondary">Pledged amounts remain separate from verified collections.</Typography>
        </Box>
        <Button onClick={loadRecords} disabled={loading}>Refresh</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="finance commitments">
          <Tab label="Fee pledges" />
          <Tab label="LPOs, LSOs & vouchers" />
        </Tabs>
      </Paper>

      {tab === 0 ? (
        <>
          <Paper component="form" onSubmit={submitPledge} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Record a promise to pay</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 2 }}>
              <TextField select required label="Student" value={pledgeForm.studentId} onChange={(event) => setPledgeForm((form) => ({ ...form, studentId: event.target.value }))}>
                {students.map((student) => <MenuItem key={student._id} value={student._id}>{student.name} · {student.admissionNo}</MenuItem>)}
              </TextField>
              <TextField required label="Promised by" value={pledgeForm.promisedBy} onChange={(event) => setPledgeForm((form) => ({ ...form, promisedBy: event.target.value }))} />
              <TextField required type="number" label="Promised amount" inputProps={{ min: 0.01, step: '0.01' }} value={pledgeForm.promisedAmount} onChange={(event) => setPledgeForm((form) => ({ ...form, promisedAmount: event.target.value }))} />
              <TextField required type="date" label="Promise date" InputLabelProps={{ shrink: true }} value={pledgeForm.promisedDate} onChange={(event) => setPledgeForm((form) => ({ ...form, promisedDate: event.target.value }))} />
              <TextField label="Note" value={pledgeForm.note} onChange={(event) => setPledgeForm((form) => ({ ...form, note: event.target.value }))} />
            </Box>
            <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={saving}>{saving ? 'Saving...' : 'Record pledge'}</Button>
          </Paper>
          <Paper sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Student</TableCell><TableCell>Promised by</TableCell><TableCell>Due</TableCell><TableCell>Promised</TableCell><TableCell>Fulfilled</TableCell><TableCell>Status</TableCell><TableCell>Receipts</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
              <TableBody>
                {pledges.map((pledge) => <TableRow key={pledge._id}>
                  <TableCell>{pledge.student?.name || 'Student'}</TableCell>
                  <TableCell>{pledge.promisedBy}</TableCell>
                  <TableCell>{pledge.promisedDate ? new Date(pledge.promisedDate).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell>{money(pledge.promisedAmount)}</TableCell>
                  <TableCell>{money(pledge.fulfilledAmount)}</TableCell>
                  <TableCell>{pledge.status}</TableCell>
                  <TableCell>{(pledge.fulfillments || []).map((item) => item.receiptNumber).filter(Boolean).join(', ') || '—'}</TableCell>
                  <TableCell><Button size="small" disabled={pledge.status === 'Fulfilled' || pledge.status === 'Cancelled'} onClick={() => openFulfillment(pledge)}>Link verified payment</Button></TableCell>
                </TableRow>)}
                {!pledges.length && <TableRow><TableCell colSpan={8} align="center">No fee pledges recorded.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>
        </>
      ) : (
        <>
          <Paper component="form" onSubmit={submitOrder} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Create procurement record or payment voucher</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 2 }}>
              <TextField select label="Record type" value={orderForm.type} onChange={(event) => setOrderForm((form) => ({ ...form, type: event.target.value }))}>
                <MenuItem value="LPO">Local Purchase Order (LPO)</MenuItem>
                <MenuItem value="LSO">Local Service Order (LSO)</MenuItem>
                <MenuItem value="Payment Voucher">Payment Voucher</MenuItem>
              </TextField>
              <TextField required label="Supplier / payee" value={orderForm.supplier} onChange={(event) => setOrderForm((form) => ({ ...form, supplier: event.target.value }))} />
              <TextField required label="Description" value={orderForm.description} onChange={(event) => setOrderForm((form) => ({ ...form, description: event.target.value }))} />
              <TextField required type="number" label="Amount" inputProps={{ min: 0.01, step: '0.01' }} value={orderForm.amount} onChange={(event) => setOrderForm((form) => ({ ...form, amount: event.target.value }))} />
              <TextField label="Existing transaction reference" value={orderForm.transactionReference} onChange={(event) => setOrderForm((form) => ({ ...form, transactionReference: event.target.value }))} />
              <TextField label="Note" value={orderForm.note} onChange={(event) => setOrderForm((form) => ({ ...form, note: event.target.value }))} />
            </Box>
            <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={saving}>{saving ? 'Saving...' : 'Create for approval'}</Button>
          </Paper>
          <Paper sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Type</TableCell><TableCell>Reference</TableCell><TableCell>Supplier</TableCell><TableCell>Description</TableCell><TableCell>Amount</TableCell><TableCell>Status</TableCell><TableCell>Transaction</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {orders.map((order) => <TableRow key={order._id}>
                  <TableCell>{order.type}</TableCell><TableCell>{order.reference}</TableCell><TableCell>{order.supplier}</TableCell><TableCell>{order.description}</TableCell><TableCell>{money(order.amount, order.currency || 'KES')}</TableCell><TableCell>{order.status}</TableCell><TableCell>{order.transactionReference || '—'}</TableCell>
                  <TableCell><Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => printOrder(order)}>Print</Button>
                    {['Admin', 'SuperAdmin'].includes(currentRole) && order.status === 'Pending Approval' && <Button size="small" onClick={() => updateOrderStatus(order, 'Approved')} disabled={saving}>Approve</Button>}
                    {['Admin', 'SuperAdmin'].includes(currentRole) && order.status === 'Approved' && <Button size="small" onClick={() => { setOrderToPay(order); setOrderPaymentReference(''); }}>Mark paid</Button>}
                  </Stack></TableCell>
                </TableRow>)}
                {!orders.length && <TableRow><TableCell colSpan={8} align="center">No procurement or voucher records.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      <Dialog open={Boolean(fulfillPledge)} onClose={() => setFulfillPledge(null)} fullWidth maxWidth="sm">
        <DialogTitle>Link a verified payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Only recorded verified/completed student payments can fulfil this pledge.</Typography>
          <TextField select fullWidth label="Payment receipt" value={paymentRecordId} onChange={(event) => setPaymentRecordId(event.target.value)} sx={{ mb: 2 }}>
            {paymentOptions.map((payment) => <MenuItem key={payment.id} value={payment.id}>{payment.receiptNumber} · {payment.reference || payment.method} · {money(payment.amount)}</MenuItem>)}
            {!paymentOptions.length && <MenuItem disabled value="">No eligible verified payments</MenuItem>}
          </TextField>
          <TextField fullWidth type="number" label="Allocated amount (optional)" helperText="Leave blank to allocate the full payment." inputProps={{ min: 0.01, step: '0.01' }} value={fulfillmentAmount} onChange={(event) => setFulfillmentAmount(event.target.value)} />
        </DialogContent>
        <DialogActions><Button onClick={() => setFulfillPledge(null)}>Cancel</Button><Button onClick={linkPayment} variant="contained" disabled={saving || !paymentRecordId}>{saving ? 'Linking...' : 'Link payment'}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(orderToPay)} onClose={() => setOrderToPay(null)} fullWidth maxWidth="sm">
        <DialogTitle>Record payment reference</DialogTitle>
        <DialogContent><TextField autoFocus fullWidth label="Bank or M-Pesa reference" value={orderPaymentReference} onChange={(event) => setOrderPaymentReference(event.target.value)} sx={{ mt: 1 }} /></DialogContent>
        <DialogActions><Button onClick={() => setOrderToPay(null)}>Cancel</Button><Button variant="contained" disabled={!orderPaymentReference.trim() || saving} onClick={() => updateOrderStatus(orderToPay, 'Paid', orderPaymentReference)}>Confirm paid</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default FinanceCommitments;