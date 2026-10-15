import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Alert,
    Box,
    CircularProgress,
    Container,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { getTimetableTime } from '../../utils/timetableSlots';
import { useTeacherClass } from './TeacherClassContext';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TeacherTimetable = () => {
    const { currentUser } = useSelector((state) => state.user);
    const { selectedClassId } = useTeacherClass();
    const [viewMode, setViewMode] = useState('teacher');
    const [teacherSchedule, setTeacherSchedule] = useState([]);
    const [classSchedule, setClassSchedule] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const classID = selectedClassId || currentUser?.teachSclass?._id || currentUser?.teachSclass;

    useEffect(() => {
        let isMounted = true;

        const fetchTeacherSchedule = async () => {
            if (!currentUser?._id) return;
            try {
                const response = await axios.get(`${API_BASE_URL}/Timetable/Teacher/${currentUser._id}`);
                if (isMounted) {
                    setTeacherSchedule(response.data?.schedule || []);
                }
            } catch (err) {
                if (isMounted) {
                    setTeacherSchedule([]);
                }
            }
        };

        fetchTeacherSchedule();
        return () => {
            isMounted = false;
        };
    }, [currentUser?._id]);

    useEffect(() => {
        let isMounted = true;

        const fetchClassSchedule = async () => {
            if (!classID || !currentUser?._id) return;
            setError('');
            setLoading(true);

            try {
                const response = await axios.get(`${API_BASE_URL}/Timetable/Class/${classID}`, {
                    params: { userID: currentUser._id },
                });
                if (isMounted) {
                    setClassSchedule(response.data?.schedule || []);
                }
            } catch (err) {
                if (isMounted) {
                    setClassSchedule([]);
                    if (err.response?.status !== 404) {
                        setError(err.response?.data?.message || 'Unable to load timetable');
                    }
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchClassSchedule();
        return () => {
            isMounted = false;
        };
    }, [classID, currentUser?._id]);

    const schedule = useMemo(() => {
        const source = viewMode === 'teacher' ? teacherSchedule : classSchedule;
        return source
            .slice()
            .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.period - b.period);
    }, [viewMode, teacherSchedule, classSchedule]);

    const emptyMessage = viewMode === 'teacher'
        ? 'No teaching timetable has been created for this teacher yet.'
        : 'No timetable has been created yet for this class.';

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="h4">
                    Timetable
                </Typography>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="teacher-timetable-view-label">View</InputLabel>
                    <Select
                        labelId="teacher-timetable-view-label"
                        label="View"
                        value={viewMode}
                        onChange={(event) => setViewMode(event.target.value)}
                    >
                        <MenuItem value="teacher">My teaching timetable</MenuItem>
                        <MenuItem value="class">Selected class timetable</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {loading && <CircularProgress />}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!loading && !error && !schedule.length && (
                <Alert severity="info">{emptyMessage}</Alert>
            )}

            {schedule.length > 0 && (
                <TableContainer component={Paper} sx={{ mt: 2, boxShadow: 2 }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Day</TableCell>
                                <TableCell>Time</TableCell>
                                <TableCell>Period</TableCell>
                                {viewMode === 'teacher' && <TableCell>Class</TableCell>}
                                <TableCell>Subject</TableCell>
                                <TableCell>Teacher</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {schedule.map((entry) => (
                                <TableRow key={`${entry.day}-${entry.period}-${entry.classId || 'class'}-${entry.subject || 'free'}`}>
                                    <TableCell>{entry.day}</TableCell>
                                    <TableCell>{getTimetableTime(entry)}</TableCell>
                                    <TableCell>{entry.period}</TableCell>
                                    {viewMode === 'teacher' && <TableCell>{entry.className || 'Class'}</TableCell>}
                                    <TableCell>{entry.subjectName || 'Free Period'}</TableCell>
                                    <TableCell>{entry.teacherName || 'Unassigned'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default TeacherTimetable;
