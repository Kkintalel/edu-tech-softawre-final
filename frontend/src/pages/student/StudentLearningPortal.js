import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, Paper, Typography, List, ListItem, ListItemText, Link as MuiLink, Divider, CircularProgress, Alert, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, FormControlLabel, Radio, RadioGroup, Stack, TextField, MenuItem } from '@mui/material';
import { useTeacherClass } from '../teacher/TeacherClassContext';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const StudentLearningPortal = () => {
    const { currentUser } = useSelector((state) => state.user);
    const [materials, setMaterials] = useState([]);
    const [classes, setClasses] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [progress, setProgress] = useState(null);
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [quizAnswers, setQuizAnswers] = useState([]);
    const [quizResult, setQuizResult] = useState(null);
    const [submittingQuiz, setSubmittingQuiz] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState('all');
    const [selectedTopic, setSelectedTopic] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [attendanceMessage, setAttendanceMessage] = useState('');

    const { selectedClassId } = useTeacherClass();
    const classValue = currentUser?.sclassName || currentUser?.teachSclass || (selectedClassId ? { _id: selectedClassId } : null);
    const classId = typeof classValue === 'object' ? classValue?._id || classValue?.id : classValue;
    const schoolValue = currentUser?.school;
    const schoolId = typeof schoolValue === 'object'
        ? schoolValue?._id || schoolValue?.id
        : schoolValue || currentUser?.schoolId;
    const headers = useMemo(() => ({
        ...(schoolId ? { 'x-admin-id': schoolId } : {}),
        ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
    }), [schoolId, currentUser?.token]);

    const getMaterialLink = (item) => {
        const url = item.fileUrl || item.file_url || item.fileUrl || item.file_url;
        if (!url) return null;
        return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    };

    const getMeetingLink = (item) => {
        if (!item?.meetingLink && !item?.meeting_url) return null;
        const link = item.meetingLink || item.meeting_url;
        return link.startsWith('http') ? link : `https://${link}`;
    };

    const subjects = [...new Set(materials.map((item) => item.subject?.subName).filter(Boolean))].sort();
    const topics = [...new Set(materials.filter((item) => selectedSubject === 'all' || item.subject?.subName === selectedSubject).map((item) => item.topic).filter(Boolean))].sort();
    const visibleMaterials = materials.filter((item) =>
        (selectedSubject === 'all' || item.subject?.subName === selectedSubject) &&
        (selectedTopic === 'all' || item.topic === selectedTopic)
    );

    const joinLiveClass = async (item) => {
        const studentId = currentUser?._id || currentUser?.id;
        const link = getMeetingLink(item);
        if (!studentId || !link) return;

        try {
            const response = await fetch(`${API_BASE_URL}/LiveClasses/${item._id}/Join`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json', 'x-user-id': studentId },
                body: JSON.stringify({ studentId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to join live class');
            setAttendanceMessage(data.alreadyMarked
                ? 'Attendance was already recorded for this subject today.'
                : 'Online class attendance recorded successfully.');
            window.open(data.meetingLink || link, '_blank', 'noopener,noreferrer');
        } catch (joinError) {
            setError(joinError.message);
        }
    };

    const refreshProgress = async () => {
        const studentId = currentUser?._id || currentUser?.id;
        if (!studentId) return;
        const response = await fetch(`${API_BASE_URL}/LearningProgress/${studentId}`, { headers });
        const data = await response.json();
        if (response.ok) setProgress(data);
    };

    const markMaterialComplete = async (materialId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/LearningMaterials/${materialId}/Complete`, { method: 'POST', headers });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to save lesson progress');
            setAttendanceMessage(data.message);
            await refreshProgress();
        } catch (progressError) {
            setError(progressError.message);
        }
    };

    const openQuiz = (quiz) => {
        setActiveQuiz(quiz);
        setQuizAnswers(Array(quiz.questions?.length || 0).fill(''));
        setQuizResult(null);
    };

    const submitQuiz = async () => {
        if (!activeQuiz || quizAnswers.some((answer) => !answer)) return;
        setSubmittingQuiz(true);
        try {
            const response = await fetch(`${API_BASE_URL}/Quiz/${activeQuiz._id}/Attempts`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: quizAnswers }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to submit quiz');
            setQuizResult(data.result);
            await refreshProgress();
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setSubmittingQuiz(false);
        }
    };

    useEffect(() => {
        const fetchMaterials = async () => {
            if (!classId) {
                setError('Class information is not available for this student.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');

            try {
                const studentId = currentUser?._id || currentUser?.id;
                const [materialsRes, classesRes, quizzesRes, progressRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/LearningMaterials/${classId}`, { headers }),
                    fetch(`${API_BASE_URL}/LiveClasses/${classId}`, { headers }),
                    fetch(`${API_BASE_URL}/Quizzes/${classId}`, { headers }),
                    fetch(`${API_BASE_URL}/LearningProgress/${studentId}`, { headers }),
                ]);

                if (!materialsRes.ok || !classesRes.ok || !quizzesRes.ok || !progressRes.ok) {
                    const errText = await materialsRes.text();
                    throw new Error(`Unable to load learning content: ${errText}`);
                }

                const materialsData = await materialsRes.json();
                const classesData = await classesRes.json();
                const quizzesData = await quizzesRes.json();
                const progressData = await progressRes.json();

                setMaterials(Array.isArray(materialsData) ? materialsData : []);
                setClasses(Array.isArray(classesData) ? classesData : []);
                setQuizzes(Array.isArray(quizzesData) ? quizzesData : []);
                setProgress(progressData);
            } catch (fetchError) {
                console.error(fetchError);
                setError('Failed to load student learning resources. Please refresh or contact your school administrator.');
            } finally {
                setLoading(false);
            }
        };

        fetchMaterials();
    }, [classId, headers]);

    if (loading) {
        return (
            <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 4, display: 'grid', gap: 2 }}>
            {attendanceMessage && <Alert severity="success">{attendanceMessage}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}

            <Paper sx={{ p: 3 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                    <Box>
                        <Typography variant="h6">Lessons and materials</Typography>
                        <Typography variant="body2" color="text.secondary">{currentUser?.sclassName?.sclassName || 'Your class'} · {progress?.lessons?.completed || 0} of {progress?.lessons?.total || 0} lessons complete</Typography>
                    </Box>
                    <Chip label={`${Number(progress?.lessons?.completionRate || 0).toFixed(0)}% complete`} color="primary" variant="outlined" />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
                    <TextField select size="small" label="Subject" value={selectedSubject} onChange={(event) => { setSelectedSubject(event.target.value); setSelectedTopic('all'); }} sx={{ minWidth: 180 }}>
                        <MenuItem value="all">All subjects</MenuItem>
                        {subjects.map((subject) => <MenuItem key={subject} value={subject}>{subject}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Topic" value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)} sx={{ minWidth: 180 }}>
                        <MenuItem value="all">All topics</MenuItem>
                        {topics.map((topic) => <MenuItem key={topic} value={topic}>{topic}</MenuItem>)}
                    </TextField>
                </Stack>
                <List>
                    {visibleMaterials.length === 0 && (
                        <ListItem>
                            <ListItemText primary="No learning materials available yet." />
                        </ListItem>
                    )}
                    {visibleMaterials.map((item) => {
                        const link = getMaterialLink(item);
                        const isComplete = (progress?.lessons?.records || []).some((record) => String(record.material?._id || record.material) === String(item._id));
                        const isVideo = String(item.material_type || item.type || '').toLowerCase() === 'video';
                        return (
                            <React.Fragment key={item._id || item.id}>
                                <ListItem alignItems="flex-start" secondaryAction={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {link && <MuiLink href={link} target="_blank" rel="noreferrer" download={!isVideo}>Open</MuiLink>}
                                        <Button size="small" variant={isComplete ? 'text' : 'outlined'} disabled={isComplete} onClick={() => markMaterialComplete(item._id)}>
                                            {isComplete ? 'Completed' : 'Mark complete'}
                                        </Button>
                                    </Stack>
                                }>
                                    <ListItemText
                                        primary={item.title || item.topic || 'Untitled Material'}
                                        secondary={[item.topic, item.description || item.material_type || 'No description', item.subject?.subName, item.teacher?.name]
                                            .filter(Boolean)
                                            .join(' • ')}
                                    />
                                </ListItem>
                                {isVideo && link && <Box component="video" controls src={link} sx={{ display: 'block', width: '100%', maxHeight: 360, bgcolor: 'black', mb: 2 }} />}
                                <Divider />
                            </React.Fragment>
                        );
                    })}
                </List>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Live Classes</Typography>
                <List>
                    {classes.length === 0 && (
                        <ListItem>
                            <ListItemText primary="No live classes scheduled for your class." />
                        </ListItem>
                    )}
                    {classes.map((item) => {
                        const link = getMeetingLink(item);
                        return (
                            <React.Fragment key={item._id || item.id}>
                                <ListItem secondaryAction={link ? <MuiLink component="button" onClick={() => joinLiveClass(item)}>Join</MuiLink> : null}>
                                    <ListItemText
                                        primary={item.topic || item.title || 'Live class session'}
                                        secondary={[
                                            item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : null,
                                            item.meetingLink || item.meeting_url,
                                        ].filter(Boolean).join(' • ')}
                                    />
                                </ListItem>
                                <Divider />
                            </React.Fragment>
                        );
                    })}
                </List>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Quizzes</Typography>
                <List>
                    {quizzes.length === 0 && (
                        <ListItem>
                            <ListItemText primary="No quizzes are available for your class right now." />
                        </ListItem>
                    )}
                    {quizzes.map((item) => (
                        <React.Fragment key={item._id || item.id}>
                            <ListItem secondaryAction={<Button variant="contained" size="small" onClick={() => openQuiz(item)}>Start quiz</Button>}>
                                <ListItemText primary={item.title || 'Untitled Quiz'} secondary={[item.description, item.subject?.subName, item.attempts?.length ? `Latest result: ${item.attempts[item.attempts.length - 1].score}/${item.attempts[item.attempts.length - 1].maxScore}` : 'Not attempted'].filter(Boolean).join(' · ')} />
                            </ListItem>
                            <Divider />
                        </React.Fragment>
                    ))}
                </List>
            </Paper>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Outstanding work</Typography>
                {(progress?.outstandingTasks || []).length ? (
                    <List dense>{progress.outstandingTasks.map((task) => <ListItem key={task.id}><ListItemText primary={task.title} secondary={`${task.subject || ''} · Due ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'not set'}`} /></ListItem>)}</List>
                ) : <Typography color="text.secondary">No outstanding assignments.</Typography>}
                {(progress?.assignments || []).filter((item) => item.submitted).map((item) => <Typography key={item.id} variant="body2" sx={{ mt: 1 }}>{item.title}: {item.grade || 'Submitted'}{item.feedback ? ` · ${item.feedback}` : ''}</Typography>)}
                {(progress?.quizzes || []).map((item) => <Typography key={`${item.quizId}-${item.submittedAt}`} variant="body2" sx={{ mt: 1 }}>{item.title}: {item.score}/{item.maxScore}</Typography>)}
            </Paper>
            <Dialog open={Boolean(activeQuiz)} onClose={() => !submittingQuiz && setActiveQuiz(null)} fullWidth maxWidth="md">
                <DialogTitle>{activeQuiz?.title || 'Quiz'}</DialogTitle>
                <DialogContent dividers>
                    {quizResult ? (
                        <Alert severity="success">Score: {quizResult.score}/{quizResult.maxScore} ({Number(quizResult.percentage).toFixed(0)}%)</Alert>
                    ) : (activeQuiz?.questions || []).map((question, index) => (
                        <FormControl key={index} component="fieldset" sx={{ display: 'block', mb: 3 }}>
                            <Typography variant="subtitle1">{index + 1}. {question.question}</Typography>
                            <RadioGroup value={quizAnswers[index] || ''} onChange={(event) => setQuizAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))}>
                                {(question.options || []).map((option) => <FormControlLabel key={option} value={option} control={<Radio />} label={option} />)}
                            </RadioGroup>
                        </FormControl>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActiveQuiz(null)} disabled={submittingQuiz}>{quizResult ? 'Done' : 'Cancel'}</Button>
                    {!quizResult && <Button variant="contained" onClick={submitQuiz} disabled={submittingQuiz || quizAnswers.some((answer) => !answer)}>{submittingQuiz ? 'Submitting…' : 'Submit answers'}</Button>}
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StudentLearningPortal;
