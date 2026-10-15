import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Link } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
const groupLabels = {
    students: 'Students',
    teachers: 'Teachers',
    employees: 'Staff',
    classes: 'Classes and streams',
    subjects: 'Subjects',
    assessments: 'Exams and reports',
    attendance: 'Attendance',
    fees: 'Fee balances',
    payments: 'Payments and receipts',
    parents: 'Parents and guardians',
    finance: 'Expenses and finance',
};

const GlobalSearch = ({ currentUser, currentRole }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [schools, setSchools] = useState([]);
    const [groups, setGroups] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const token = currentUser?.token;
    const canSearch = ['Admin', 'SuperAdmin', 'Teacher', 'Accountant', 'Auditor', 'HR'].includes(currentRole);

    const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : {}, [token]);

    useEffect(() => {
        if (!open || currentRole !== 'SuperAdmin' || !token) return;
        fetch(`${API_BASE_URL}/api/search/schools`, { headers })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Unable to load schools');
                setSchools(data.schools || []);
            })
            .catch((requestError) => setError(requestError.message));
    }, [open, currentRole, token, headers]);

    useEffect(() => {
        if (!open || query.trim().length < 2 || !token || (currentRole === 'SuperAdmin' && !schoolId)) {
            setGroups({});
            setLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams({ q: query.trim() });
                if (currentRole === 'SuperAdmin') params.set('schoolId', schoolId);
                const response = await fetch(`${API_BASE_URL}/api/search?${params}`, { headers, signal: controller.signal });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Search failed');
                setGroups(data.groups || {});
            } catch (requestError) {
                if (requestError.name !== 'AbortError') {
                    setError(requestError.message);
                    setGroups({});
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [open, query, schoolId, currentRole, token, headers]);

    if (!canSearch) return null;

    const close = () => {
        setOpen(false);
        setQuery('');
        setGroups({});
        setError('');
    };

    return (
        <>
            <Tooltip title="Global search">
                <IconButton color="inherit" aria-label="Global search" onClick={() => setOpen(true)}>
                    <SearchIcon />
                </IconButton>
            </Tooltip>
            <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
                <DialogTitle sx={{ pb: 1 }}>Search school records</DialogTitle>
                <DialogContent sx={{ px: 2, pb: 2 }}>
                    {currentRole === 'SuperAdmin' && (
                        <TextField
                            select
                            fullWidth
                            label="School"
                            value={schoolId}
                            onChange={(event) => setSchoolId(event.target.value)}
                            sx={{ mb: 1.5 }}
                        >
                            <MenuItem value="">Select a school</MenuItem>
                            {schools.map((school) => <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>)}
                        </TextField>
                    )}
                    <TextField
                        autoFocus
                        fullWidth
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Student, admission no., receipt, class, staff..."
                        inputProps={{ maxLength: 80, 'aria-label': 'Search records' }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: 38 }}>
                        {loading && <CircularProgress size={18} />}
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            Results are limited to records you are allowed to view.
                        </Typography>
                    </Box>
                    {error && <Typography color="error" role="alert" sx={{ py: 1 }}>{error}</Typography>}
                    {!error && query.trim().length < 2 && <Typography color="text.secondary" sx={{ py: 2 }}>Enter at least 2 characters.</Typography>}
                    {!error && query.trim().length >= 2 && !loading && Object.keys(groups).length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>No matching records.</Typography>}
                    <Box sx={{ maxHeight: '55vh', overflowY: 'auto' }}>
                        {Object.entries(groups).map(([group, results]) => (
                            <List key={group} dense disablePadding sx={{ mb: 1 }}>
                                <Typography variant="overline" color="text.secondary" sx={{ px: 1, fontWeight: 700 }}>
                                    {groupLabels[group] || group}
                                </Typography>
                                {results.map((result) => (
                                    <ListItemButton key={`${group}-${result.id}`} component={Link} to={result.href} onClick={close} sx={{ borderRadius: 1 }}>
                                        <ListItemText primary={result.label} secondary={result.detail} primaryTypographyProps={{ noWrap: true }} secondaryTypographyProps={{ noWrap: true }} />
                                    </ListItemButton>
                                ))}
                            </List>
                        ))}
                    </Box>
                    <Button onClick={close} sx={{ mt: 1 }}>Close</Button>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default GlobalSearch;