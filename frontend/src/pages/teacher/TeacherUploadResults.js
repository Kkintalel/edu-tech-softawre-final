import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Alert,
    Stack,
    Chip,
    MenuItem,
} from '@mui/material';
import axios from 'axios';
import { getClassStudents } from '../../redux/sclassRelated/sclassHandle';
import { calculateGrade, getGradeColor, GRADING_SYSTEMS } from '../../utils/gradingSystem';
import { useTeacherClass } from './TeacherClassContext';
import { useAssignedTeaching } from './useAssignedTeaching';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const TeacherUploadResults = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { sclassStudents, loading } = useSelector((state) => state.sclass);
    const { currentUser } = useSelector((state) => state.user);
    const { selectedClassId } = useTeacherClass();
    const { classes, classId, setClassId, subjects, subjectId, setSubjectId } = useAssignedTeaching(currentUser, selectedClassId);
    const classID = classId || selectedClassId || currentUser.teachSclass?._id;
    const subjectID = subjectId || currentUser.teachSubject?._id;
    const subjectName = subjects.find((item) => String(item._id || item.id) === String(subjectId))?.subName || currentUser.teachSubject?.subName;

    const [marks, setMarks] = useState({ CAT: {}, END_TERM: {} });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [gradingSystem, setGradingSystem] = useState('achievement');
    const [term, setTerm] = useState('Term 1');
    const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));

    useEffect(() => {
        const schoolId = currentUser?.school?._id || currentUser?.school;
        if (!schoolId || !currentUser?._id) return;
        axios.get(`${API_BASE_URL}/Admin/Settings/${schoolId}`, {
            headers: { 'x-admin-id': currentUser._id }
        }).then(({ data }) => {
            setGradingSystem(data.settings?.gradingSystem?.type || 'achievement');
        }).catch(() => setError('Unable to load the school grading system'));
    }, [currentUser]);

    const examTypes = [
        { key: 'CAT', label: 'CAT' },
        { key: 'END_TERM', label: 'End Term' }
    ];

    useEffect(() => {
        if (classID) {
            dispatch(getClassStudents(classID));
        }
    }, [dispatch, classID]);

    const handleMarksChange = (studentId, examType, value) => {
        setMarks((prev) => ({
            ...prev,
            [examType]: {
                ...prev[examType],
                [studentId]: value,
            }
        }));
    };

    const handleSubmit = async (studentId, examType) => {
        const studentMarks = marks[examType]?.[studentId];
        if (studentMarks === undefined || studentMarks === '') {
            setError('Please enter marks for this student');
            return;
        }

        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const marksValue = parseFloat(studentMarks);
            const gradeInfo = calculateGrade(marksValue, gradingSystem);

            const payload = {
                subName: subjectID,
                marksObtained: marksValue,
                examType,
                term,
                academicYear,
            };

            if (gradeInfo) {
                payload.grade = gradeInfo.grade;
                payload.level = gradeInfo.level;
                payload.points = gradeInfo.points;
                payload.remark = gradeInfo.remark;
                payload.gradingSystem = gradingSystem;
            }

            const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
            const requesterId = currentUser?._id || currentUser?.id || null;
            const headers = { 'Content-Type': 'application/json' };
            if (requesterId) {
                headers['x-admin-id'] = requesterId;
                headers['x-user-id'] = requesterId;
            }

            const response = await axios.put(
                `${API_BASE_URL}/UpdateExamResult/${studentId}`,
                payload,
                { headers }
            );

            setSuccess(`Marks uploaded for student ${response.data.name || 'successfully'}`);
            setMarks((prev) => ({
                ...prev,
                [examType]: {
                    ...prev[examType],
                    [studentId]: ''
                }
            }));
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload marks');
            console.error('Upload error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitAll = async (examType) => {
        const examMarks = marks[examType] || {};
        const studentIds = Object.keys(examMarks).filter(
            (id) => examMarks[id] !== '' && examMarks[id] !== undefined && examMarks[id] !== null
        );

        if (studentIds.length === 0) {
            setError('Please enter marks for at least one student');
            return;
        }

        setSubmitting(true);
        setError('');
        setSuccess('');
        let successCount = 0;
        let errorCount = 0;

        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
            const requesterId = currentUser?._id || currentUser?.id || null;
            const headers = { 'Content-Type': 'application/json' };
            if (requesterId) {
                headers['x-admin-id'] = requesterId;
                headers['x-user-id'] = requesterId;
            }

            const updatePromises = studentIds.map(async (studentId) => {
            try {
                const marksValue = parseFloat(examMarks[studentId]);
                const gradeInfo = calculateGrade(marksValue, gradingSystem);

                const payload = {
                    subName: subjectID,
                    marksObtained: marksValue,
                    examType,
                    term,
                    academicYear,
                };

                if (gradeInfo) {
                    payload.grade = gradeInfo.grade;
                    payload.level = gradeInfo.level;
                    payload.points = gradeInfo.points;
                    payload.remark = gradeInfo.remark;
                    payload.gradingSystem = gradingSystem;
                }

                await axios.put(
                    `${API_BASE_URL}/UpdateExamResult/${studentId}`,
                    payload,
                    { headers }
                );
                return { studentId, success: true };
            } catch (err) {
                console.error(`Error for student ${studentId}:`, err);
                return { studentId, success: false, message: err.response?.data?.message || err.message };
            }
        });

        const results = await Promise.allSettled(updatePromises);
        const successCount = results.filter((item) => item.status === 'fulfilled' && item.value?.success).length;
        const errorResults = results
            .filter((item) => item.status === 'fulfilled' && !item.value?.success)
            .map((item) => item.value?.message || 'Failed');
        const rejectedCount = results.filter((item) => item.status === 'rejected').length;
        const errorCount = errorResults.length + rejectedCount;

        if (successCount > 0) {
            setSuccess(`Marks uploaded for ${successCount} student(s)${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
            setMarks((prev) => ({
                ...prev,
                [examType]: {}
            }));
        }
        if (errorCount > 0) {
            setError(`Failed to upload marks for ${errorCount} student(s)`);
        }
        } finally {
            setSubmitting(false);
        }
    };

    if (!classID) {
        return (
            <Box sx={{ p: 4 }}>
                <Typography variant="h5" color="error">
                    Teacher class information is missing
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom>
                Upload Exam Results
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField select label="Assigned class" value={classId} onChange={(event) => setClassId(event.target.value)} sx={{ minWidth: 220 }}>
                    {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                </TextField>
                <TextField select label="Assigned subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} sx={{ minWidth: 220 }} disabled={!subjects.length}>
                    {subjects.map((item) => <MenuItem key={item._id || item.id} value={item._id || item.id}>{item.subName}</MenuItem>)}
                </TextField>
            </Stack>
            {!subjects.length && <Alert severity="warning" sx={{ mb: 2 }}>No subjects are assigned to this class. Ask an administrator to assign your subject before uploading results.</Alert>}
            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Subject: <strong>{subjectName}</strong> | Class: <strong>{classes.find((item) => item.id === String(classId))?.name || currentUser.teachSclass?.sclassName}</strong>
            </Typography>
            <TextField
                select
                label="Grading System"
                value={gradingSystem}
                onChange={(event) => setGradingSystem(event.target.value)}
                sx={{ mb: 2, minWidth: 280 }}
            >
                {Object.entries(GRADING_SYSTEMS).map(([type, system]) => (
                    <MenuItem key={type} value={type}>{system.label}</MenuItem>
                ))}
            </TextField>
            <TextField
                select
                label="Academic Year"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
                sx={{ mb: 2, ml: { sm: 2 }, minWidth: 150 }}
            >
                {Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - index).map((year) => (
                    <MenuItem key={year} value={String(year)}>{year}</MenuItem>
                ))}
            </TextField>
            <TextField
                select
                label="Term"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                sx={{ mb: 2, ml: { sm: 2 }, minWidth: 150 }}
            >
                {['Term 1', 'Term 2', 'Term 3'].map((termOption) => (
                    <MenuItem key={termOption} value={termOption}>{termOption}</MenuItem>
                ))}
            </TextField>

            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Stack spacing={2}>
                    {examTypes.map((examType) => {
                        const examMarks = marks[examType.key] || {};
                        const hasMarks = Object.values(examMarks).some(
                            (value) => value !== '' && value !== undefined && value !== null
                        );

                        return (
                            <Box key={examType.key} sx={{ mb: 4 }}>
                                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                                    {examType.label} Results
                                </Typography>
                                <TableContainer component={Paper}>
                                    <Table>
                                        <TableHead>
                                            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                                <TableCell><strong>Name</strong></TableCell>
                                                <TableCell><strong>Roll Number</strong></TableCell>
                                                <TableCell><strong>Marks</strong></TableCell>
                                                <TableCell><strong>Grade Preview</strong></TableCell>
                                                <TableCell align="center"><strong>Action</strong></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {sclassStudents && sclassStudents.length > 0 ? (
                                                sclassStudents.map((student) => {
                                                    const studentMarks = examMarks[student._id];
                                                    const gradeInfo = studentMarks !== undefined && studentMarks !== ''
                                                        ? calculateGrade(parseFloat(studentMarks), gradingSystem)
                                                        : null;
                                                    const gradeColor = gradeInfo ? getGradeColor(gradeInfo.grade) : '#ccc';

                                                    return (
                                                        <TableRow key={`${examType.key}-${student._id}`} hover>
                                                            <TableCell>{student.name}</TableCell>
                                                            <TableCell>{student.rollNum}</TableCell>
                                                            <TableCell>
                                                                <TextField
                                                                    type="number"
                                                                    size="small"
                                                                    placeholder="Enter marks"
                                                                    value={studentMarks || ''}
                                                                    onChange={(e) => handleMarksChange(student._id, examType.key, e.target.value)}
                                                                    inputProps={{ step: 0.5, min: 0, max: 100 }}
                                                                    sx={{ width: 120 }}
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                {gradeInfo ? (
                                                                    <Chip
                                                                        label={`${gradeInfo.grade} (${gradeInfo.points})`}
                                                                        size="small"
                                                                        sx={{ backgroundColor: gradeColor, color: 'white' }}
                                                                    />
                                                                ) : (
                                                                    <Typography variant="caption" color="textSecondary">—</Typography>
                                                                )}
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                <Button
                                                                    variant="contained"
                                                                    size="small"
                                                                    color="primary"
                                                                    onClick={() => handleSubmit(student._id, examType.key)}
                                                                    disabled={!subjectID || submitting || studentMarks === undefined || studentMarks === ''}
                                                                >
                                                                    Upload
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} align="center">
                                                        No students found in this class
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                {sclassStudents && sclassStudents.length > 0 && (
                                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                                        <Button
                                            variant="contained"
                                            color="success"
                                            onClick={() => handleSubmitAll(examType.key)}
                                            disabled={!subjectID || submitting || !hasMarks}
                                        >
                                            {submitting ? <CircularProgress size={24} color="inherit" /> : `Upload All ${examType.label}`}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            onClick={() => setMarks((prev) => ({ ...prev, [examType.key]: {} }))}
                                            disabled={submitting}
                                        >
                                            Clear {examType.label}
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
};

export default TeacherUploadResults;
