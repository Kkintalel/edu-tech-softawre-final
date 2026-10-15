import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Alert,
    Box,
    CircularProgress,
    Link,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import EventNoteIcon from '@mui/icons-material/EventNote';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const DemoRequestsPage = () => {
    const { currentUser } = useSelector((state) => state.user);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadRequests = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/SuperAdmin/DemoRequests`, {
                    headers: { 'x-admin-id': currentUser?._id },
                });
                setRequests(response.data || []);
            } catch (requestError) {
                setError(requestError.response?.data?.message || 'Could not load demo requests.');
            } finally {
                setLoading(false);
            }
        };

        if (currentUser?._id) loadRequests();
        else {
            setError('Sign in as SuperAdmin to view demo requests.');
            setLoading(false);
        }
    }, [currentUser]);

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                <EventNoteIcon color="primary" />
                <Typography variant="h5">Demo Requests</Typography>
            </Stack>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Paper variant="outlined">
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
                ) : requests.length === 0 && !error ? (
                    <Typography color="text.secondary" sx={{ p: 3 }}>No demo requests yet.</Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Received</TableCell>
                                    <TableCell>School</TableCell>
                                    <TableCell>Contact</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Phone</TableCell>
                                    <TableCell>Request</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {requests.map((request) => (
                                    <TableRow key={request._id} hover>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(request.createdAt).toLocaleString()}</TableCell>
                                        <TableCell>{request.school}</TableCell>
                                        <TableCell>{request.name}</TableCell>
                                        <TableCell><Link href={`mailto:${request.email}`}>{request.email}</Link></TableCell>
                                        <TableCell>{request.phone || '—'}</TableCell>
                                        <TableCell sx={{ minWidth: 220, whiteSpace: 'pre-wrap' }}>{request.message || '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
};

export default DemoRequestsPage;