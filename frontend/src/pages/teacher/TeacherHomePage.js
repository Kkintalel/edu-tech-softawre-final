import { Container, Grid, Paper } from '@mui/material'
import SeeNotice from '../../components/SeeNotice';
import styled from 'styled-components';
import Students from "../../assets/img1.png";
import Lessons from "../../assets/subjects.svg";
import Tests from "../../assets/assignment.svg";
import Time from "../../assets/time.svg";
import { getClassStudents, getSubjectDetails } from '../../redux/sclassRelated/sclassHandle';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { useTeacherClass } from './TeacherClassContext';

const TeacherHomePage = () => {
    const dispatch = useDispatch();

    const { currentUser } = useSelector((state) => state.user);
    const { subjectDetails, sclassStudents } = useSelector((state) => state.sclass);
    const { selectedClassId, classes: assignedClasses } = useTeacherClass();

    const classID = selectedClassId || currentUser.teachSclass?._id;
    const classSubjects = (currentUser.teachSubjects || []).filter((subject) => String(subject.sclassName?._id || subject.sclassName || '') === String(classID));
    const subjectID = classSubjects[0]?._id || currentUser.teachSubject?._id;

    useEffect(() => {
        dispatch(getSubjectDetails(subjectID, "Subject"));
        dispatch(getClassStudents(classID));
    }, [dispatch, subjectID, classID]);

    const numberOfStudents = sclassStudents && sclassStudents.length;
    const numberOfSessions = subjectDetails && subjectDetails.sessions

    return (
        <>
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={3} lg={3}>
                        <StyledPaper>
                            <img src={Students} alt="Students" />
                            <Title>
                                Class Students
                            </Title>
                            <Data>{numberOfStudents ?? 0}</Data>
                        </StyledPaper>
                    </Grid>
                    <Grid item xs={12} md={3} lg={3}>
                        <StyledPaper>
                            <img src={Lessons} alt="Lessons" />
                            <Title>
                                Total Lessons
                            </Title>
                            <Data>{numberOfSessions ?? 0}</Data>
                        </StyledPaper>
                    </Grid>
                    <Grid item xs={12} md={3} lg={3}>
                        <StyledPaper>
                            <img src={Tests} alt="Tests" />
                            <Title>
                                Tests Taken
                            </Title>
                            <Data>24</Data>
                        </StyledPaper>
                    </Grid>
                    <Grid item xs={12} md={3} lg={3}>
                        <StyledPaper>
                            <img src={Time} alt="Time" />
                            <Title>
                                Total Hours
                            </Title>
                            <Data>30 hrs</Data>
                        </StyledPaper>
                    </Grid>
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                            <SeeNotice />
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </>
    )
}

const StyledPaper = styled(Paper)`
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 200px;
  justify-content: space-between;
  align-items: center;
  text-align: center;
`;

const Title = styled.p`
  font-size: 1.25rem;
`;

const Data = styled.span`
  font-size: calc(1.3rem + .6vw);
  color: green;
`;

export default TeacherHomePage