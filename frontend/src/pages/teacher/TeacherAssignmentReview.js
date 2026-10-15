import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useTeacherClass } from './TeacherClassContext';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const TeacherAssignmentReview = () => {
    const { currentUser } = useSelector((state) => state.user);
    const { selectedClassId, classes } = useTeacherClass();
    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeAssignment, setActiveAssignment] = useState('');
    const [savingStudent, setSavingStudent] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const classIds = useMemo(() => [...new Set([
        currentUser?.teachSclass?._id || currentUser?.teachSclass,
        ...(currentUser?.teachSclasses || []).map((item) => item?._id || item),
    ].filter(Boolean).map(String))], [currentUser]);
    const headers = useMemo(() => ({
        ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        'Content-Type': 'application/json',
    }), [currentUser?.token]);

    const loadAssignments = async () => {
        setLoading(true);
        setError('');
        try {
            const results = await Promise.all(classIds.map(async (classId) => {
                const response = await axios.get(`${API_BASE_URL}/Assignments/Class/${classId}`, { headers });
                return Array.isArray(response.data) ? response.data : [];
            }));
            const ownAssignments = results.flat().filter((assignment) => String(assignment.teacher?._id || assignment.teacher) === String(currentUser?._id));
            const assignedClassAssignments = selectedClassId ? ownAssignments.filter((assignment) => String(assignment.class?._id || assignment.class) === String(selectedClassId)) : ownAssignments;
            setAssignments(assignedClassAssignments);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to load assignments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (classIds.length) loadAssignments();
        else setLoading(false);
    }, [classIds.join('|'), currentUser?._id]);

    const loadSubmissions = async (assignmentId) => {
        setActiveAssignment(assignmentId);
        setError('');
        try {
            const response = await axios.get(`${API_BASE_URL}/Assignment/${assignmentId}/Submissions`, { headers });
            setSubmissions((current) => ({ ...current, [assignmentId]: response.data || [] }));
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to load student submissions');
        }
    };

    const updateSubmission = (assignmentId, studentId, field, value) => {
        setSubmissions((current) => ({
            ...current,
            [assignmentId]: (current[assignmentId] || []).map((submission) => String(submission.student?._id || submission.student) === String(studentId)
                ? { ...submission, [field]: value }
                : submission),
        }));
    };

    const saveReview = async (assignmentId, submission) => {
        const studentId = submission.student?._id || submission.student;
        setSavingStudent(String(studentId));
        setMessage('');
        setError('');
        try {
            await axios.put(`${API_BASE_URL}/Assignment/${assignmentId}/Submission/${studentId}`, {
                grade: submission.grade,
                feedback: submission.feedback,
            }, { headers });
            setMessage('Grade and feedback saved.');
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to save review');
        } finally {
            setSavingStudent('');
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
                <Typography variant="h5">Assignment submissions</Typography>
                {classes.length > 1 && (
                    <TextField select size="small" value={selectedClassId} onChange={(event) => window.dispatchEvent(new CustomEvent('teacher-class-change', { detail: event.target.value }))} sx={{ minWidth: 180 }}>
                        {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                    </TextField>
                )}
            </Stack>
            {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {loading ? <CircularProgress /> : assignments.length === 0 ? (
                <Typography color="text.secondary">No assignments have been created for your assigned classes.</Typography>
            ) : (
                <Stack spacing={1.5}>
                    {assignments.map((assignment) => (
                        <Paper key={assignment._id} sx={{ p: 2 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight={700}>{assignment.title}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {assignment.class?.sclassName || 'Class'} · {assignment.subject?.subName || 'Subject'} · Due {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No deadline'}
                                    </Typography>
                                </Box>
                                <Button variant="outlined" onClick={() => loadSubmissions(assignment._id)}>Review submissions</Button>
                            </Stack>
                            {activeAssignment === assignment._id && (
                                <Stack spacing={1.5} sx={{ mt: 2 }}>
                                    {(submissions[assignment._id] || []).length ? submissions[assignment._id].map((submission) => {
                                        const student = submission.student || {};
                                        const studentId = student._id || student;
                                        return (
                                            <Paper key={String(studentId)} variant="outlined" sx={{ p: 1.5 }}>
                                                <Typography fontWeight={600}>{student.name || 'Student'} {student.admissionNo ? `· ${student.admissionNo}` : ''}</Typography>
                                                <Typography variant="body2" sx={{ my: 1 }}>{submission.submissionText || 'No written response.'}</Typography>
                                                {submission.fileUrl && <Button size="small" href={submission.fileUrl} target="_blank" rel="noreferrer">Open submitted file</Button>}
                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                                                    <TextField size="small" label="Grade" value={submission.grade || ''} onChange={(event) => updateSubmission(assignment._id, studentId, 'grade', event.target.value)} />
                                                    <TextField size="small" fullWidth label="Feedback" value={submission.feedback || ''} onChange={(event) => updateSubmission(assignment._id, studentId, 'feedback', event.target.value)} />
                                                    <Button variant="contained" disabled={savingStudent === String(studentId)} onClick={() => saveReview(assignment._id, submission)}>{savingStudent === String(studentId) ? 'Saving…' : 'Save review'}</Button>
                                                </Stack>
                                            </Paper>
                                        );
                                    }) : <Typography color="text.secondary">No submissions yet.</Typography>}
                                </Stack>
                            )}
                        </Paper>
                    ))}
                </Stack>
            )}
        </Box>
    );
};

export default TeacherAssignmentReview;