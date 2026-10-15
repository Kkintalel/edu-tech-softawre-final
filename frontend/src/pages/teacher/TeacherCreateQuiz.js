import React, { useState } from 'react';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Box, Button, Paper, TextField, Typography, Alert, Stack, Divider, MenuItem } from '@mui/material';
import { useAssignedTeaching } from './useAssignedTeaching';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const TeacherCreateQuiz = () => {
    const { currentUser } = useSelector((state) => state.user);
    const { classes, classId, setClassId, subjects, subjectId, setSubjectId } = useAssignedTeaching(currentUser);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState([
        { question: '', options: ['', '', '', ''], correctAnswer: '' },
    ]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [quizzes, setQuizzes] = useState([]);
    const [quizResults, setQuizResults] = useState({});

    const headers = {
        ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        ...(currentUser?._id ? { 'x-admin-id': currentUser._id } : {}),
    };

    const loadQuizzes = async () => {
        if (!classId) return;
        try {
            const response = await fetch(`${API_BASE_URL}/Quizzes/${classId}`, { headers });
            const data = await response.json();
            if (response.ok) setQuizzes(Array.isArray(data) ? data : []);
        } catch (error) {
            setMessage('Unable to load existing quizzes.');
        }
    };

    useEffect(() => { loadQuizzes(); }, [classId, currentUser?.token]);

    const loadQuizResults = async (quizId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/Quiz/${quizId}/Results`, { headers });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to load quiz results');
            setQuizResults((current) => ({ ...current, [quizId]: data.results || [] }));
        } catch (error) {
            setMessage(error.message);
        }
    };

    const updateQuestion = (index, field, value) => {
        const nextQuestions = [...questions];
        nextQuestions[index][field] = value;
        setQuestions(nextQuestions);
    };

    const updateOption = (questionIndex, optionIndex, value) => {
        const nextQuestions = [...questions];
        nextQuestions[questionIndex].options[optionIndex] = value;
        setQuestions(nextQuestions);
    };

    const addQuestion = () => {
        setQuestions([...questions, { question: '', options: ['', '', '', ''], correctAnswer: '' }]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            const response = await fetch(`${API_BASE_URL}/Quiz`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-id': currentUser?._id || '',
                    ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
                },
                body: JSON.stringify({
                    title,
                    description,
                    subject: subjectId,
                    classId,
                    teacher: currentUser?._id,
                    school: currentUser?.school?._id || currentUser?.school,
                    questions,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                setMessage('Quiz created successfully.');
                setTitle('');
                setDescription('');
                setQuestions([{ question: '', options: ['', '', '', ''], correctAnswer: '' }]);
                await loadQuizzes();
            } else {
                setMessage(data.message || 'Failed to create quiz.');
            }
        } catch (error) {
            setMessage('Network error while creating quiz.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4 }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Create Quiz</Typography>
                <form onSubmit={handleSubmit}>
                    <TextField select label="Assigned class" fullWidth value={classId} onChange={(event) => setClassId(event.target.value)} required sx={{ mb: 2 }}>
                        {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                    </TextField>
                    <TextField select label="Assigned subject" fullWidth value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required sx={{ mb: 2 }}>
                        {subjects.map((item) => <MenuItem key={item._id || item.id} value={item._id || item.id}>{item.subName}</MenuItem>)}
                    </TextField>
                    <TextField label="Quiz Title" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} required sx={{ mb: 2 }} />
                    <TextField label="Description" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} sx={{ mb: 3 }} />

                    {questions.map((question, index) => (
                        <Paper key={index} sx={{ p: 2, mb: 2 }} variant="outlined">
                            <Typography variant="subtitle1">Question {index + 1}</Typography>
                            <TextField
                                label="Question"
                                fullWidth
                                value={question.question}
                                onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                                required
                                sx={{ mb: 2 }}
                            />
                            <Stack spacing={2}>
                                {question.options.map((option, optionIndex) => (
                                    <TextField
                                        key={optionIndex}
                                        label={`Option ${optionIndex + 1}`}
                                        fullWidth
                                        value={option}
                                        onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                                        required
                                    />
                                ))}
                            </Stack>
                            <TextField
                                label="Correct Answer"
                                fullWidth
                                value={question.correctAnswer}
                                onChange={(e) => updateQuestion(index, 'correctAnswer', e.target.value)}
                                required
                                sx={{ mt: 2 }}
                            />
                        </Paper>
                    ))}

                    <Button variant="outlined" onClick={addQuestion} sx={{ mb: 2 }}>
                        Add Question
                    </Button>
                    <Button type="submit" variant="contained" disabled={loading} fullWidth>
                        {loading ? 'Creating...' : 'Create Quiz'}
                    </Button>
                </form>
                {message && <Alert severity={message.includes('success') ? 'success' : 'error'} sx={{ mt: 2 }}>{message}</Alert>}
            </Paper>
            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>Quiz results</Typography>
                {quizzes.length === 0 ? <Typography color="text.secondary">No quizzes have been created for this class.</Typography> : (
                    <Stack spacing={1.5}>
                        {quizzes.map((quiz) => (
                            <Paper key={quiz._id} variant="outlined" sx={{ p: 1.5 }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                                    <Box><Typography fontWeight={700}>{quiz.title}</Typography><Typography variant="body2" color="text.secondary">{quiz.subject?.subName || 'Subject'}</Typography></Box>
                                    <Button size="small" onClick={() => loadQuizResults(quiz._id)}>Load results</Button>
                                </Stack>
                                {(quizResults[quiz._id] || []).map((result, index) => (
                                    <React.Fragment key={`${result.student?.id || index}-${index}`}>
                                        <Divider sx={{ my: 1 }} />
                                        <Typography variant="body2">{result.student?.name || result.student?.admissionNo || 'Student'} · {result.score}/{result.maxScore} · {result.submittedAt ? new Date(result.submittedAt).toLocaleString() : ''}</Typography>
                                    </React.Fragment>
                                ))}
                            </Paper>
                        ))}
                    </Stack>
                )}
            </Paper>
        </Box>
    );
};

export default TeacherCreateQuiz;
