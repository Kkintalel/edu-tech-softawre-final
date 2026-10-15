import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    MenuItem,
    Paper,
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
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '';

const getAllocationPeriods = (period, periodization) => {
    if (!period?.startDate || !period?.endDate || periodization === 'annual') return [];
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    const periods = [];
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    let quarter = 1;

    while (cursor <= end) {
        const months = periodization === 'quarterly' ? 3 : 1;
        const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + months, 1));
        const periodKey = periodization === 'quarterly'
            ? `Q${quarter}`
            : `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
        periods.push({ periodKey, label: periodization === 'quarterly' ? `Quarter ${quarter}` : periodKey });
        cursor = next;
        quarter += 1;
    }
    return periods;
};

const BudgetManagement = () => {
    const { currentUser } = useSelector((state) => state.user);
    const schoolId = useMemo(() => {
        const value = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId || currentUser?._id || currentUser?.id;
        return value && typeof value === 'object' ? value._id || value.id || '' : value || '';
    }, [currentUser]);
    const adminId = currentUser?._id || currentUser?.id;
    const role = currentUser?.role || '';
    const [period, setPeriod] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [dashboard, setDashboard] = useState(null);
    const [periodization, setPeriodization] = useState('annual');
    const [allocations, setAllocations] = useState({});
    const [form, setForm] = useState({ accountId: '', amount: '', programme: '', activity: '', notes: '' });
    const [periodForm, setPeriodForm] = useState({ name: '', startDate: '', endDate: '' });
    const [creatingPeriod, setCreatingPeriod] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const allocationPeriods = getAllocationPeriods(period, periodization);
    const headers = { 'x-admin-id': adminId };

    const loadBudgetData = async () => {
        if (!schoolId || !adminId) {
            setError('School context is unavailable. Please sign in again.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const periodResponse = await axios.get(`${API_BASE_URL}/Accounting/Period/${schoolId}`, { headers });
            const currentPeriod = periodResponse.data?.data;
            if (!currentPeriod?._id) {
                setPeriod(null);
                setBudgets([]);
                setDashboard(null);
                setLoading(false);
                return;
            }
            setPeriod(currentPeriod);
            const [accountsResponse, budgetsResponse, dashboardResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/Accounting/Budget/Accounts/${schoolId}`, { headers }),
                axios.get(`${API_BASE_URL}/Accounting/Budgets/${schoolId}/${currentPeriod._id}`, { headers }),
                axios.get(`${API_BASE_URL}/Accounting/Reports/BudgetVsActual/${schoolId}/${currentPeriod._id}`, { headers }),
            ]);
            setAccounts(accountsResponse.data?.data || []);
            setBudgets(budgetsResponse.data?.data || []);
            setDashboard(dashboardResponse.data?.data || null);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to load budget data.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePeriod = async (event) => {
        event.preventDefault();
        setCreatingPeriod(true);
        setError('');
        setMessage('');
        try {
            await axios.post(`${API_BASE_URL}/Accounting/Period/${schoolId}`, periodForm, { headers });
            setMessage('Financial year created and accounting accounts initialized.');
            await loadBudgetData();
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to create the financial year.');
        } finally {
            setCreatingPeriod(false);
        }
    };

    useEffect(() => {
        loadBudgetData();
    }, [schoolId, adminId]);

    const handlePeriodizationChange = (event) => {
        setPeriodization(event.target.value);
        setAllocations({});
    };

    const updateAllocation = (periodKey, value) => {
        setAllocations((current) => ({ ...current, [periodKey]: value }));
    };

    const handleSaveDraft = async (event) => {
        event.preventDefault();
        if (!period?._id) return setError('Create an accounting period before drafting a budget.');
        const amount = Number(form.amount);
        const normalizedAllocations = allocationPeriods.map(({ periodKey }) => ({
            periodKey,
            amount: Number(allocations[periodKey] || 0),
        }));
        if (periodization !== 'annual' && Math.abs(normalizedAllocations.reduce((total, line) => total + line.amount, 0) - amount) > 0.01) {
            return setError('Monthly or quarterly allocations must add up to the annual budget amount.');
        }

        setSaving(true);
        setError('');
        setMessage('');
        try {
            await axios.post(`${API_BASE_URL}/Accounting/Budget`, {
                schoolId,
                periodId: period._id,
                accountId: form.accountId,
                amount,
                programme: form.programme,
                activity: form.activity,
                notes: form.notes,
                periodization,
                allocations: normalizedAllocations,
            }, { headers });
            setMessage('Budget saved as draft. Submit it for review when ready.');
            setAllocations({});
            setForm({ accountId: '', amount: '', programme: '', activity: '', notes: '' });
            await loadBudgetData();
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to save budget draft.');
        } finally {
            setSaving(false);
        }
    };

    const runAction = async (budget, action) => {
        setError('');
        setMessage('');
        const reason = action === 'RequestRevision' ? window.prompt('Reason for returning this budget for revision:') : '';
        if (action === 'RequestRevision' && !reason?.trim()) return;
        try {
            await axios.post(`${API_BASE_URL}/Accounting/Budget/${budget._id}/${action}`, { reason }, { headers });
            setMessage(`Budget ${action === 'RequestRevision' ? 'returned for revision' : action.toLowerCase() + 'ed'}.`);
            await loadBudgetData();
        } catch (requestError) {
            setError(requestError.response?.data?.message || `Unable to ${action.toLowerCase()} budget.`);
        }
    };

    const getActions = (budget) => {
        if (budget.status === 'draft' && (role === 'Accountant' || role === 'Admin')) {
            return <Button size="small" onClick={() => runAction(budget, 'Submit')}>Submit</Button>;
        }
        if (budget.status === 'submitted' && (role === 'Admin' || role === 'SuperAdmin')) {
            return <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Button size="small" onClick={() => runAction(budget, 'Review')}>Review</Button>
                <Button size="small" color="warning" onClick={() => runAction(budget, 'RequestRevision')}>Return</Button>
            </Box>;
        }
        if (budget.status === 'reviewed' && (role === 'Admin' || role === 'SuperAdmin')) {
            return <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Button size="small" variant="contained" onClick={() => runAction(budget, 'Approve')}>Approve</Button>
                <Button size="small" color="warning" onClick={() => runAction(budget, 'RequestRevision')}>Return</Button>
            </Box>;
        }
        if (budget.status === 'approved' && (role === 'Admin' || role === 'SuperAdmin')) {
            return <Button size="small" onClick={() => runAction(budget, 'Lock')}>Lock</Button>;
        }
        return '—';
    };

    if (loading) return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h4" sx={{ mb: 2 }}>Budget Management</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
            {!period ? <>
                <Alert severity="warning" sx={{ mb: 2 }}>No accounting period is configured for this school. Create the financial year before budgeting.</Alert>
                {(role === 'Accountant' || role === 'Admin' || role === 'SuperAdmin') && <Paper component="form" onSubmit={handleCreatePeriod} sx={{ p: 2, maxWidth: 760 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Set up financial year</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 2 }}>
                        <TextField required label="Financial year name" placeholder="e.g. FY 2026" value={periodForm.name} onChange={(event) => setPeriodForm((current) => ({ ...current, name: event.target.value }))} />
                        <TextField required type="date" label="Start date" value={periodForm.startDate} InputLabelProps={{ shrink: true }} onChange={(event) => setPeriodForm((current) => ({ ...current, startDate: event.target.value }))} />
                        <TextField required type="date" label="End date" value={periodForm.endDate} InputLabelProps={{ shrink: true }} onChange={(event) => setPeriodForm((current) => ({ ...current, endDate: event.target.value }))} />
                    </Box>
                    <Button type="submit" variant="contained" disabled={creatingPeriod} sx={{ mt: 2 }}>
                        {creatingPeriod ? <CircularProgress size={20} color="inherit" /> : 'Create financial year'}
                    </Button>
                </Paper>}
            </> : <>
                <Paper sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6">Financial year: {period.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{formatDate(period.startDate)} to {formatDate(period.endDate)} · Status: {period.status}</Typography>
                </Paper>

                {dashboard && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5, mb: 2 }}>
                    {[
                        ['Revenue Budget', money(dashboard.revenueBudget)],
                        ['Revenue Actual', money(dashboard.revenueActual)],
                        ['Expenditure Budget', money(dashboard.expenditureBudget)],
                        ['Expenditure Actual', money(dashboard.expenditureActual)],
                        ['Expenditure Utilization', `${Number(dashboard.budgetUtilization || 0).toFixed(1)}%`],
                    ].map(([label, value]) => <Paper key={label} sx={{ p: 2 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h6">{value}</Typography></Paper>)}
                </Box>}

                {dashboard?.expenditureOverruns?.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>
                    Over budget: {dashboard.expenditureOverruns.map((item) => item.accountName).join(', ')}
                </Alert>}

                {(role === 'Accountant' || role === 'Admin') && <Paper component="form" onSubmit={handleSaveDraft} sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Create budget draft</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 2 }}>
                        <TextField select required label="Account" value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}>
                            {accounts.map((account) => <MenuItem key={account._id} value={account._id}>{account.code} · {account.name} ({account.type})</MenuItem>)}
                        </TextField>
                        <TextField required type="number" label="Annual Budget (KES)" value={form.amount} inputProps={{ min: 0.01, step: 0.01 }} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
                        <TextField label="Programme" value={form.programme} onChange={(event) => setForm((current) => ({ ...current, programme: event.target.value }))} />
                        <TextField label="Activity" value={form.activity} onChange={(event) => setForm((current) => ({ ...current, activity: event.target.value }))} />
                        <TextField select label="Budget periodization" value={periodization} onChange={handlePeriodizationChange}>
                            <MenuItem value="annual">Annual</MenuItem><MenuItem value="monthly">Monthly</MenuItem><MenuItem value="quarterly">Quarterly</MenuItem>
                        </TextField>
                        <TextField label="Notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                    </Box>
                    {allocationPeriods.length > 0 && <>
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Period allocations</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 1.5 }}>
                            {allocationPeriods.map(({ periodKey, label }) => <TextField key={periodKey} type="number" label={label} value={allocations[periodKey] || ''} inputProps={{ min: 0, step: 0.01 }} onChange={(event) => updateAllocation(periodKey, event.target.value)} />)}
                        </Box>
                    </>}
                    <Box sx={{ mt: 2 }}><Button type="submit" variant="contained" disabled={saving}>{saving ? <CircularProgress size={20} color="inherit" /> : 'Save Draft'}</Button></Box>
                </Paper>}

                <Paper sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ p: 2, pb: 0 }}>Budget Lines and Approvals</Typography>
                    <TableContainer>
                        <Table size="small">
                            <TableHead><TableRow><TableCell>Account</TableCell><TableCell>Programme / Activity</TableCell><TableCell>Annual Budget</TableCell><TableCell>Periodization</TableCell><TableCell>Status</TableCell><TableCell>Actual</TableCell><TableCell>Variance</TableCell><TableCell>Used</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
                            <TableBody>
                                {budgets.map((budget) => {
                                    const variance = budget.variance;
                                    return <TableRow key={budget._id}>
                                        <TableCell>{budget.accountCode} · {budget.accountName}</TableCell>
                                        <TableCell>{[budget.programme, budget.activity].filter(Boolean).join(' / ') || '—'}</TableCell>
                                        <TableCell>{money(budget.amount)}</TableCell>
                                        <TableCell>{budget.periodization || 'annual'}{budget.allocations?.length ? ` (${budget.allocations.length})` : ''}</TableCell>
                                        <TableCell>{budget.status}</TableCell>
                                        <TableCell>{variance ? money(variance.actualAmount) : '—'}</TableCell>
                                        <TableCell>{variance ? money(variance.variance) : '—'}</TableCell>
                                        <TableCell>{variance ? `${Number(variance.percentUsed || 0).toFixed(1)}%` : '—'}</TableCell>
                                        <TableCell>{getActions(budget)}</TableCell>
                                    </TableRow>;
                                })}
                                {!budgets.length && <TableRow><TableCell colSpan={9} align="center">No budgets entered for this financial year.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {dashboard?.items?.length > 0 && <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Periodized Actuals</Typography>
                    {dashboard.items.map((item) => <Box key={item._id} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2">{item.accountCode} · {item.accountName} · {item.periodization}</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1 }}>
                            {item.allocations?.map((allocation) => <Paper key={allocation.periodKey} variant="outlined" sx={{ p: 1 }}>
                                <Typography variant="caption">{allocation.label}</Typography>
                                <Typography variant="body2">Budget: {money(allocation.budgetAmount)}</Typography>
                                <Typography variant="body2">Actual: {money(allocation.actualAmount)}</Typography>
                                <Typography variant="body2">Variance: {money(allocation.variance.variance)}</Typography>
                            </Paper>)}
                        </Box>
                    </Box>)}
                </Paper>}
            </>}
        </Box>
    );
};

export default BudgetManagement;
