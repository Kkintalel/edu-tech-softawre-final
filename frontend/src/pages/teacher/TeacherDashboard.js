import { useEffect, useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import {
    CssBaseline,
    Box,
    Toolbar,
    List,
    Typography,
    Divider,
    IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import TeacherSideBar from './TeacherSideBar';
import { Navigate, Route, Routes } from 'react-router-dom';
import Logout from '../Logout'
import DataExportButton from '../../components/DataExportButton';
import AccountMenu from '../../components/AccountMenu';
import { AppBar, Drawer } from '../../components/styles';
import StudentAttendance from '../admin/studentRelated/StudentAttendance';

import TeacherClassDetails from './TeacherClassDetails';
import TeacherComplain from './TeacherComplain';
import TeacherHomePage from './TeacherHomePage';
import TeacherProfile from './TeacherProfile';
import TeacherTimetable from './TeacherTimetable';
import TeacherViewStudent from './TeacherViewStudent';
import StudentExamMarks from '../admin/studentRelated/StudentExamMarks';
import TeacherUploadAssignment from './TeacherUploadAssignment';
import TeacherUploadResults from './TeacherUploadResults';
import TeacherUploadMaterials from './TeacherUploadMaterials';
import TeacherScheduleLiveClass from './TeacherScheduleLiveClass';
import TeacherCreateQuiz from './TeacherCreateQuiz';
import TeacherAssignmentReview from './TeacherAssignmentReview';
import { TeacherClassProvider, TeacherClassSwitcher } from './TeacherClassContext';
import { authSuccess } from '../../redux/userRelated/userSlice';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const TeacherDashboard = () => {
    const [open, setOpen] = useState(false);
    const dispatch = useDispatch();
    const { currentUser } = useSelector((state) => state.user);
    const isTeacher = currentUser?.role === 'Teacher' || currentUser?.roles?.includes('Teacher');

    useEffect(() => {
        if (!isTeacher || !currentUser?._id) return;

        let active = true;
        const headers = {
            'x-admin-id': currentUser._id,
            'x-user-id': currentUser._id,
            ...(currentUser.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        };

        axios.get(`${API_BASE_URL}/Teacher/${currentUser._id}`, { headers })
            .then((response) => {
                if (active && response.data?._id) {
                    dispatch(authSuccess({ ...response.data, token: currentUser.token, role: 'Teacher' }));
                }
            })
            .catch((error) => {
                console.error('Unable to refresh teacher assignments:', error);
            });

        return () => { active = false; };
    }, [currentUser?._id, currentUser?.token, dispatch, isTeacher]);

    if (!isTeacher) return <Navigate to="/Teacherlogin" replace />;

    const classValues = [currentUser?.teachSclass, ...(currentUser?.teachSclasses || []), ...(currentUser?.teachSubjects || []).map((subject) => subject.sclassName)].filter(Boolean);
    const assignedClasses = [...new Map(classValues.map((value) => {
        const id = String(value?._id || value?.id || value);
        return [id, { id, name: value?.sclassName || `Class ${id}` }];
    })).values()];
    const initialClassId = String(currentUser?.teachSclass?._id || currentUser?.teachSclass || assignedClasses[0]?.id || '');
    const toggleDrawer = () => {
        setOpen(!open);
    };

        return (
            <TeacherClassProvider classes={assignedClasses} initialClassId={initialClassId}>
        <>
            <Box sx={{ display: 'flex' }}>
                <CssBaseline />
                <AppBar open={open} position='absolute'>
                    <Toolbar sx={{ pr: '24px' }}>
                        <IconButton
                            edge="start"
                            color="inherit"
                            aria-label="open drawer"
                            onClick={toggleDrawer}
                            sx={{
                                marginRight: '36px',
                                ...(open && { display: 'none' }),
                            }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Typography
                            component="h1"
                            variant="h6"
                            color="inherit"
                            noWrap
                            sx={{ flexGrow: 1 }}
                        >
                            Teacher Dashboard
                        </Typography>
                        <TeacherClassSwitcher />
                        <AccountMenu />
                    </Toolbar>
                </AppBar>
                <Drawer variant="permanent" open={open} sx={open ? styles.drawerStyled : styles.hideDrawer}>
                    <Toolbar sx={styles.toolBarStyled}>
                        <IconButton onClick={toggleDrawer}>
                            <ChevronLeftIcon />
                        </IconButton>
                    </Toolbar>
                    <Divider />
                    <List component="nav">
                        <TeacherSideBar />
                    </List>
                </Drawer>
                <Box component="main" sx={styles.boxStyled}>
                    <Toolbar />
                    <DataExportButton endpoint="/Exports/TeacherStudents" filename="assigned-students.csv" label="Download Student Data" />
                    <Routes>
                        <Route path="/" element={<TeacherHomePage />} />
                        <Route path="dashboard" element={<TeacherHomePage />} />
                        <Route path="profile" element={<TeacherProfile />} />

                        <Route path="complain" element={<TeacherComplain />} />

                        <Route path="class" element={<TeacherClassDetails />} />
                        <Route path="class/student/:id" element={<TeacherViewStudent />} />
                        <Route path="timetable" element={<TeacherTimetable />} />

                        <Route path="class/student/attendance/:studentID/:subjectID" element={<StudentAttendance situation="Subject" />} />
                        <Route path="class/student/marks/:studentID/:subjectID" element={<StudentExamMarks situation="Subject" />} />

                        <Route path="upload-assignment" element={<TeacherUploadAssignment />} />
                        <Route path="assignment-review" element={<TeacherAssignmentReview />} />
                        <Route path="upload-results" element={<TeacherUploadResults />} />
                        <Route path="upload-materials" element={<TeacherUploadMaterials />} />
                        <Route path="schedule-live-class" element={<TeacherScheduleLiveClass />} />
                        <Route path="create-quiz" element={<TeacherCreateQuiz />} />
                        <Route path="logout" element={<Logout />} />
                    </Routes>
                </Box>
            </Box>
        </>
            </TeacherClassProvider>
    );
}

export default TeacherDashboard

const styles = {
    boxStyled: {
        backgroundColor: (theme) =>
            theme.palette.mode === 'light'
                ? theme.palette.grey[100]
                : theme.palette.grey[900],
        flexGrow: 1,
        height: '100vh',
        overflow: 'auto',
    },
    toolBarStyled: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        px: [1],
    },
    drawerStyled: {
        display: "flex"
    },
    hideDrawer: {
        display: 'flex',
        '@media (max-width: 600px)': {
            display: 'none',
        },
    },
}