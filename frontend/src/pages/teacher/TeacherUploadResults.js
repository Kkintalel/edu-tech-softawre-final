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
    const [academicConfig, setAcademicConfig] = useState({
        gradingMode: 'mixed',
        cbcEnabled: true,
        performanceLevels: ['BE', 'AE', 'ME', 'EE']
    });
    const [assessmentType, setAssessmentType] = useState('Written task');
    const [competencyLevel, setCompetencyLevel] = useState('ME');
    const [teacherComment, setTeacherComment] = useState('');
    const [evidence, setEvidence] = useState('');
    const [term, setTerm] = useState('Term 1');
    const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
    const schoolId = currentUser?.school?._id || currentUser?.school;
    const [lessonPlanForm, setLessonPlanForm] = useState({
        learningArea: '',
        strand: '',
        subStrand: '',
        learningOutcome: '',
        lessonObjective: '',
        teachingMethods: '',
        activities: '',
        resources: '',
        assessmentMethod: '',
        lessonDate: new Date().toISOString().slice(0, 10)
    });
    const [schemeOfWorkForm, setSchemeOfWorkForm] = useState({
        learningArea: '',
        week: 1,
        strand: '',
        subStrand: '',
        learningOutcome: '',
        plannedActivities: '',
        assessmentTask: '',
        completed: false
    });
    const [appraisalForm, setAppraisalForm] = useState({
        learningArea: '',
        lessonObserved: '',
        strengths: '',
        improvementNeeds: '',
        recommendation: '',
        appraisalDate: new Date().toISOString().slice(0, 10)
    });
    const [savedRecords, setSavedRecords] = useState({
        lessonPlans: [],
        schemeOfWork: [],
        appraisals: [],
        studentAssessments: []
    });

    useEffect(() => {
        const schoolId = currentUser?.school?._id || currentUser?.school;
        if (!schoolId || !currentUser?._id) return;
        axios.get(`${API_BASE_URL}/Admin/Settings/${schoolId}`, {
            headers: { 'x-admin-id': currentUser._id }
        }).then(({ data }) => {
            setGradingSystem(data.settings?.gradingSystem?.type || 'achievement');
        }).catch(() => setError('Unable to load the school grading system'));

        axios.get(`${API_BASE_URL}/School/${schoolId}/AcademicConfig`).then(({ data }) => {
            if (data) {
                setAcademicConfig({
                    gradingMode: data.gradingMode || 'mixed',
                    cbcEnabled: data.cbcEnabled !== false,
                    performanceLevels: data.performanceLevels || ['BE', 'AE', 'ME', 'EE']
                });
                if (data.gradingMode) {
                    setCompetencyLevel((data.performanceLevels || ['BE', 'AE', 'ME', 'EE'])[2] || 'ME');
                }
            }
        }).catch(() => setAcademicConfig({ gradingMode: 'mixed', cbcEnabled: true, performanceLevels: ['BE', 'AE', 'ME', 'EE'] }));
    }, [currentUser]);

    useEffect(() => {
        if (!schoolId || !classID || !currentUser?._id) return;

        const fetchSavedRecords = async () => {
            try {
                const [lessonPlans, schemeOfWork, appraisals, assessments] = await Promise.all([
                    axios.get(`${API_BASE_URL}/School/${schoolId}/LessonPlans`),
                    axios.get(`${API_BASE_URL}/School/${schoolId}/SchemeOfWork`),
                    axios.get(`${API_BASE_URL}/School/${schoolId}/Appraisals`),
                    axios.get(`${API_BASE_URL}/School/${schoolId}/StudentAssessments`)
                ]);

                setSavedRecords({
                    lessonPlans: lessonPlans.data || [],
                    schemeOfWork: schemeOfWork.data || [],
                    appraisals: appraisals.data || [],
                    studentAssessments: assessments.data || []
                });
            } catch (err) {
                console.error('Failed to load saved KICD records', err);
            }
        };

        fetchSavedRecords();
    }, [schoolId, classID, currentUser]);

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

    const saveStudentAssessment = async (studentId) => {
        if (!schoolId || !studentId || !classID) return;

        if (!academicConfig.cbcEnabled && academicConfig.gradingMode !== 'mixed') return;

        const payload = {
            learnerId: studentId,
            teacherId: currentUser?._id,
            classId: classID,
            schoolId,
            academicYear,
            term,
            learningArea: subjectName || lessonPlanForm.learningArea || 'General',
            strand: lessonPlanForm.strand || schemeOfWorkForm.strand || '',
            subStrand: lessonPlanForm.subStrand || schemeOfWorkForm.subStrand || '',
            learningOutcome: lessonPlanForm.learningOutcome || schemeOfWorkForm.learningOutcome || '',
            assessmentType,
            competencyLevel,
            teacherComment,
            evidence,
            marks: parseFloat(marks.CAT?.[studentId] ?? marks.END_TERM?.[studentId] ?? 0) || 0
        };

        try {
            await axios.post(`${API_BASE_URL}/School/${schoolId}/StudentAssessments`, payload, {
                headers: { 'x-admin-id': currentUser?._id || currentUser?.id }
            });
        } catch (err) {
            console.error('Student assessment save failed:', err);
        }
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
                assessmentType: (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') ? assessmentType : undefined,
                competencyLevel: (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') ? competencyLevel : undefined,
                teacherComment: (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') ? teacherComment : undefined,
                evidence: (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') ? evidence : undefined,
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

            if (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') {
                await saveStudentAssessment(studentId);
            }

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
                        assessmentType: (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') ? assessmentType : undefined,
                        competencyLevel: (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') ? competencyLevel : undefined,
                        teacherComment: (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') ? teacherComment : undefined,
                        evidence: (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') ? evidence : undefined,
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

                    if (academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') {
                        await saveStudentAssessment(studentId);
                    }

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

    const saveLessonPlan = async () => {
        if (!schoolId || !classID || !currentUser?._id) return;

        const payload = {
            teacherId: currentUser._id,
            classId: classID,
            academicYear,
            term,
            learningArea: lessonPlanForm.learningArea || subjectName || 'General',
            strand: lessonPlanForm.strand,
            subStrand: lessonPlanForm.subStrand,
            learningOutcome: lessonPlanForm.learningOutcome,
            lessonObjective: lessonPlanForm.lessonObjective,
            teachingMethods: lessonPlanForm.teachingMethods.split(',').map((item) => item.trim()).filter(Boolean),
            activities: lessonPlanForm.activities.split(',').map((item) => item.trim()).filter(Boolean),
            resources: lessonPlanForm.resources.split(',').map((item) => item.trim()).filter(Boolean),
            assessmentMethod: lessonPlanForm.assessmentMethod,
            lessonDate: lessonPlanForm.lessonDate
        };

        try {
            await axios.post(`${API_BASE_URL}/School/${schoolId}/LessonPlans`, payload, {
                headers: { 'x-admin-id': currentUser._id }
            });
            setSuccess('Lesson plan saved successfully');
            setLessonPlanForm({ ...lessonPlanForm, strand: '', subStrand: '', learningOutcome: '', lessonObjective: '', teachingMethods: '', activities: '', resources: '', assessmentMethod: '' });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save lesson plan');
        }
    };

    const saveSchemeOfWork = async () => {
        if (!schoolId || !classID || !currentUser?._id) return;

        const payload = {
            teacherId: currentUser._id,
            classId: classID,
            academicYear,
            term,
            learningArea: schemeOfWorkForm.learningArea || subjectName || 'General',
            week: Number(schemeOfWorkForm.week || 1),
            strand: schemeOfWorkForm.strand,
            subStrand: schemeOfWorkForm.subStrand,
            learningOutcome: schemeOfWorkForm.learningOutcome,
            plannedActivities: schemeOfWorkForm.plannedActivities.split(',').map((item) => item.trim()).filter(Boolean),
            assessmentTask: schemeOfWorkForm.assessmentTask,
            completed: schemeOfWorkForm.completed
        };

        try {
            await axios.post(`${API_BASE_URL}/School/${schoolId}/SchemeOfWork`, payload, {
                headers: { 'x-admin-id': currentUser._id }
            });
            setSuccess('Scheme of work saved successfully');
            setSchemeOfWorkForm({ ...schemeOfWorkForm, strand: '', subStrand: '', learningOutcome: '', plannedActivities: '', assessmentTask: '', completed: false });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save scheme of work');
        }
    };

    const saveAppraisal = async () => {
        if (!schoolId || !classID || !currentUser?._id) return;

        const payload = {
            teacherId: currentUser._id,
            classId: classID,
            academicYear,
            term,
            learningArea: appraisalForm.learningArea || subjectName || 'General',
            lessonObserved: appraisalForm.lessonObserved,
            strengths: appraisalForm.strengths,
            improvementNeeds: appraisalForm.improvementNeeds,
            recommendation: appraisalForm.recommendation,
            appraisalDate: appraisalForm.appraisalDate
        };

        try {
            await axios.post(`${API_BASE_URL}/School/${schoolId}/Appraisals`, payload, {
                headers: { 'x-admin-id': currentUser._id }
            });
            setSuccess('Teacher appraisal saved successfully');
            setAppraisalForm({ ...appraisalForm, lessonObserved: '', strengths: '', improvementNeeds: '', recommendation: '' });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save appraisal');
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

            {(academicConfig.gradingMode === 'cbc' || academicConfig.gradingMode === 'mixed') && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(220px, 1fr))' }, gap: 2, mb: 2 }}>
                    <TextField
                        select
                        label="Assessment Type"
                        value={assessmentType}
                        onChange={(event) => setAssessmentType(event.target.value)}
                    >
                        <MenuItem value="Written task">Written task</MenuItem>
                        <MenuItem value="Project">Project</MenuItem>
                        <MenuItem value="Practical work">Practical work</MenuItem>
                        <MenuItem value="Observation">Observation</MenuItem>
                        <MenuItem value="Oral work">Oral work</MenuItem>
                    </TextField>

                    <TextField
                        select
                        label="CBC Level"
                        value={competencyLevel}
                        onChange={(event) => setCompetencyLevel(event.target.value)}
                    >
                        {(academicConfig.performanceLevels || ['BE', 'AE', 'ME', 'EE']).map((level) => (
                            <MenuItem key={level} value={level}>{level}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label="Teacher Comment"
                        value={teacherComment}
                        onChange={(event) => setTeacherComment(event.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }}
                    />

                    <TextField
                        label="Evidence / Notes"
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                        fullWidth
                        sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }}
                    />
                </Box>
            )}

            <Box sx={{ display: 'grid', gap: 2, mb: 4 }}>
                <Typography variant="h6">KICD / CBC Records</Typography>

                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(220px, 1fr))' } }}>
                    <TextField label="Lesson Area" value={lessonPlanForm.learningArea} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, learningArea: event.target.value })} />
                    <TextField label="Strand" value={lessonPlanForm.strand} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, strand: event.target.value })} />
                    <TextField label="Sub Strand" value={lessonPlanForm.subStrand} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, subStrand: event.target.value })} />
                    <TextField label="Learning Outcome" value={lessonPlanForm.learningOutcome} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, learningOutcome: event.target.value })} />
                    <TextField label="Lesson Objective" value={lessonPlanForm.lessonObjective} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, lessonObjective: event.target.value })} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <TextField label="Teaching Methods (comma separated)" value={lessonPlanForm.teachingMethods} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, teachingMethods: event.target.value })} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <TextField label="Activities (comma separated)" value={lessonPlanForm.activities} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, activities: event.target.value })} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <TextField label="Resources (comma separated)" value={lessonPlanForm.resources} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, resources: event.target.value })} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <TextField label="Assessment Method" value={lessonPlanForm.assessmentMethod} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, assessmentMethod: event.target.value })} />
                    <TextField type="date" label="Lesson Date" value={lessonPlanForm.lessonDate} onChange={(event) => setLessonPlanForm({ ...lessonPlanForm, lessonDate: event.target.value })} InputLabelProps={{ shrink: true }} />
                    <Button variant="contained" onClick={saveLessonPlan} sx={{ alignSelf: 'center' }}>Save Lesson Plan</Button>
                </Box>

                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(220px, 1fr))' } }}>
                    <TextField label="Learning Area" value={schemeOfWorkForm.learningArea} onChange={(event) => setSchemeOfWorkForm({ ...schemeOfWorkForm, learningArea: event.target.value })} />
                    <TextField type="number" label="Week" value={schemeOfWorkForm.week} onChange={(event) => setSchemeOfWorkForm({ ...schemeOfWorkForm, week: event.target.value })} />
                    <TextField label="Strand" value={schemeOfWorkForm.strand} onChange={(event) => setSchemeOfWorkForm({ ...schemeOfWorkForm, strand: event.target.value })} />
                    <TextField label="Sub Strand" value={schemeOfWorkForm.subStrand} onChange={(event) => setSchemeOfWorkForm({ ...schemeOfWorkForm, subStrand: event.target.value })} />
                    <TextField label="Learning Outcome" value={schemeOfWorkForm.learningOutcome} onChange={(event) => setSchemeOfWorkForm({ ...schemeOfWorkForm, learningOutcome: event.target.value })} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <TextField label="Planned Activities (comma separated)" value={schemeOfWorkForm.plannedActivities} onChange={(event) => setSchemeOfWorkForm({ ...schemeOfWorkForm, plannedActivities: event.target.value })} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <TextField label="Assessment Task" value={schemeOfWorkForm.assessmentTask} onChange={(event) => setSchemeOfWorkForm({ ...schemeOfWorkForm, assessmentTask: event.target.value })} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <Button variant="contained" color="secondary" onClick={saveSchemeOfWork} sx={{ alignSelf: 'center' }}>Save Scheme of Work</Button>
                </Box>

                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(220px, 1fr))' } }}>
                    <TextField label="Learning Area" value={appraisalForm.learningArea} onChange={(event) => setAppraisalForm({ ...appraisalForm, learningArea: event.target.value })} />
                    <TextField type="date" label="Appraisal Date" value={appraisalForm.appraisalDate} onChange={(event) => setAppraisalForm({ ...appraisalForm, appraisalDate: event.target.value })} InputLabelProps={{ shrink: true }} />
                    <TextField label="Lesson Observed" value={appraisalForm.lessonObserved} onChange={(event) => setAppraisalForm({ ...appraisalForm, lessonObserved: event.target.value })} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <TextField label="Strengths" value={appraisalForm.strengths} onChange={(event) => setAppraisalForm({ ...appraisalForm, strengths: event.target.value })} multiline rows={3} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <TextField label="Improvement Needs" value={appraisalForm.improvementNeeds} onChange={(event) => setAppraisalForm({ ...appraisalForm, improvementNeeds: event.target.value })} multiline rows={3} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <TextField label="Recommendation" value={appraisalForm.recommendation} onChange={(event) => setAppraisalForm({ ...appraisalForm, recommendation: event.target.value })} multiline rows={3} fullWidth sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }} />
                    <Button variant="contained" color="success" onClick={saveAppraisal} sx={{ alignSelf: 'center' }}>Save Appraisal</Button>
                </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 2, mb: 4 }}>
                <Typography variant="h6">Saved KICD / CBC Records</Typography>

                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(220px, 1fr))' } }}>
                    <Box>
                        <Typography variant="subtitle2">Lesson Plans</Typography>
                        {savedRecords.lessonPlans.length ? savedRecords.lessonPlans.slice(0, 3).map((item) => (
                            <Alert key={item._id} severity="info" sx={{ mb: 1 }}>
                                {item.learningArea || 'Lesson'} • {item.term || 'Term'} • {item.academicYear || ''}
                            </Alert>
                        )) : <Alert severity="info">No lesson plans saved yet.</Alert>}
                    </Box>

                    <Box>
                        <Typography variant="subtitle2">Scheme of Work</Typography>
                        {savedRecords.schemeOfWork.length ? savedRecords.schemeOfWork.slice(0, 3).map((item) => (
                            <Alert key={item._id} severity="info" sx={{ mb: 1 }}>
                                {item.learningArea || 'Scheme'} • Week {item.week || 1}
                            </Alert>
                        )) : <Alert severity="info">No schemes of work saved yet.</Alert>}
                    </Box>

                    <Box>
                        <Typography variant="subtitle2">Appraisals</Typography>
                        {savedRecords.appraisals.length ? savedRecords.appraisals.slice(0, 3).map((item) => (
                            <Alert key={item._id} severity="info" sx={{ mb: 1 }}>
                                {item.learningArea || 'Appraisal'} • {item.term || 'Term'}
                            </Alert>
                        )) : <Alert severity="info">No appraisals saved yet.</Alert>}
                    </Box>

                    <Box>
                        <Typography variant="subtitle2">Student Assessments</Typography>
                        {savedRecords.studentAssessments.length ? savedRecords.studentAssessments.slice(0, 3).map((item) => (
                            <Alert key={item._id} severity="info" sx={{ mb: 1 }}>
                                {item.learningArea || 'Assessment'} • {item.competencyLevel || 'Level'}
                            </Alert>
                        )) : <Alert severity="info">No student assessments saved yet.</Alert>}
                    </Box>
                </Box>
            </Box>

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
