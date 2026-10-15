import React from 'react'
import styled from 'styled-components';
import { Card, CardContent, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { useTeacherClass } from './TeacherClassContext';

const TeacherProfile = () => {
  const { currentUser, response, error } = useSelector((state) => state.user);
  const { selectedClass } = useTeacherClass();

  if (response) { console.log(response) }
  else if (error) { console.log(error) }

  const assignedClassNames = [currentUser?.teachSclass, ...(currentUser?.teachSclasses || [])]
    .map((item) => item?.sclassName || item?.name || '')
    .filter(Boolean);
  const assignedSubjectNames = [currentUser?.teachSubject, ...(currentUser?.teachSubjects || [])]
    .map((item) => item?.subName || '')
    .filter(Boolean);
  const teachSchool = currentUser.school

  return (
    <>
      <ProfileCard>
        <ProfileCardContent>
          <ProfileText>Name: {currentUser.name}</ProfileText>
          <ProfileText>Email: {currentUser.email}</ProfileText>
          <ProfileText>Classes: {assignedClassNames.join(', ') || 'Not assigned'}</ProfileText>
          <ProfileText>Selected class: {selectedClass?.name || currentUser.teachSclass?.sclassName || 'Not selected'}</ProfileText>
          <ProfileText>Subjects: {assignedSubjectNames.join(', ') || 'Not assigned'}</ProfileText>
          <ProfileText>School: {teachSchool?.schoolName || 'N/A'}</ProfileText>
        </ProfileCardContent>
      </ProfileCard>
    </>
  )
}

export default TeacherProfile

const ProfileCard = styled(Card)`
  margin: 20px;
  width: 400px;
  border-radius: 10px;
`;

const ProfileCardContent = styled(CardContent)`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ProfileText = styled(Typography)`
  margin: 10px;
`;