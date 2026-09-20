import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
} from '@mui/material';
import { Print } from '@mui/icons-material';
import { buildPrintBrandingHtml, getSchoolBranding, printBrandingStyles } from '../../utils/printBranding';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const formatGrade = (result) => {
  if (!result) return 'N/A';
  const grade = result.grade || result.level || result.remark || 'N/A';
  return grade;
};

const getPerformanceColor = (remark = '') => {
  const normalized = remark.toLowerCase();
  if (normalized.includes('exceed')) return '#2e7d32';
  if (normalized.includes('meeting')) return '#1976d2';
  if (normalized.includes('approach')) return '#ed6c02';
  if (normalized.includes('below') || normalized.includes('fail')) return '#d32f2f';
  return '#616161';
};

const ParentProgress = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialStudent = location.state?.student;
  const [currentUser, setCurrentUser] = useState(null);
  const [student, setStudent] = useState(initialStudent || null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem('currentUser') || localStorage.getItem('user');
    if (!user) {
      navigate('/Parent/login', { replace: true });
      return;
    }

    const parsedUser = JSON.parse(user);
    setCurrentUser(parsedUser);
    const selectedStudent = initialStudent || parsedUser.student;
    setStudent(selectedStudent);

    if (!selectedStudent?.id && !selectedStudent?._id) {
      setLoading(false);
      return;
    }

    const studentId = selectedStudent.id || selectedStudent._id;
    axios.get(`${API_BASE_URL}/Parent/StudentProgress/${studentId}`, {
      params: { parentEmail: parsedUser.email }
    })
      .then((response) => {
        setReport(response.data);
      })
      .catch((err) => {
        console.error('Failed to fetch parent student progress', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [initialStudent, navigate]);

  const schoolBranding = useMemo(() => getSchoolBranding(currentUser, report?.school || currentUser?.school), [currentUser, report]);

  const handlePrint = () => {
    const content = document.getElementById('parent-progress-print');
    if (!content) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Parent Progress Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d0d0d0; padding: 8px; }
            th { background: #f5f5f5; text-align: left; }
            .summary { display: grid; grid-template-columns: repeat(3, minmax(120px, 1fr)); gap: 12px; margin: 16px 0; }
            .summary div { border: 1px solid #e4e4e4; padding: 8px; border-radius: 8px; }
            ${printBrandingStyles}
          </style>
        </head>
        <body>
          ${buildPrintBrandingHtml(currentUser, report?.school || currentUser?.school)}
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!report) {
    return (
      <Container sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant='h5' gutterBottom>Progress report unavailable</Typography>
          <Typography color='text.secondary'>No academic information is available for this student yet.</Typography>
          <Button sx={{ mt: 2 }} variant='contained' onClick={() => navigate('/Parent/dashboard')}>Back to dashboard</Button>
        </Paper>
      </Container>
    );
  }

  const examRows = Array.isArray(report.examResult) ? report.examResult : [];

  return (
    <Container maxWidth='lg' sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant='h4' sx={{ fontWeight: 'bold' }}>Student Progress Report</Typography>
          <Typography color='text.secondary'>Parent portal</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant='outlined' onClick={() => navigate('/Parent/dashboard')}>Back</Button>
          <Button variant='contained' startIcon={<Print />} onClick={handlePrint}>Print</Button>
        </Box>
      </Box>

      <Box id='parent-progress-print'>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            {schoolBranding.logo && (
              <Box component='img' src={schoolBranding.logo} alt={`${schoolBranding.name} logo`} sx={{ maxWidth: 140, maxHeight: 90, objectFit: 'contain', mb: 1 }} />
            )}
            <Typography variant='h5' sx={{ fontWeight: 700 }}>{schoolBranding.name}</Typography>
            <Typography variant='h6'>Academic Report</Typography>
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}><Typography><strong>Student:</strong> {report.name}</Typography></Grid>
            <Grid item xs={12} sm={6} md={3}><Typography><strong>Admission:</strong> {report.admissionNo}</Typography></Grid>
            <Grid item xs={12} sm={6} md={3}><Typography><strong>Class:</strong> {report.className}</Typography></Grid>
            <Grid item xs={12} sm={6} md={3}><Typography><strong>Term:</strong> {report.term}</Typography></Grid>
          </Grid>

          <Box className='summary'>
            <Box>
              <Typography variant='subtitle2' color='textSecondary'>Average</Typography>
              <Typography variant='h6'>{Number(report.reportSummary?.average || 0).toFixed(1)}%</Typography>
            </Box>
            <Box>
              <Typography variant='subtitle2' color='textSecondary'>Total Marks</Typography>
              <Typography variant='h6'>{report.reportSummary?.totalMarks ?? 0}</Typography>
            </Box>
            <Box>
              <Typography variant='subtitle2' color='textSecondary'>Total Points</Typography>
              <Typography variant='h6'>{report.reportSummary?.totalPoints ?? 0}</Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant='h6' sx={{ mb: 2 }}>Subject Results</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Subject</TableCell>
                  <TableCell>Exam Type</TableCell>
                  <TableCell>Marks</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell>Points</TableCell>
                  <TableCell>Performance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {examRows.length > 0 ? examRows.map((result, index) => (
                  <TableRow key={`${result.subjectId || index}-${result.examType}`}>
                    <TableCell>{result.subject}</TableCell>
                    <TableCell>{result.examType || 'CAT'}</TableCell>
                    <TableCell>{result.marksObtained ?? 'N/A'}</TableCell>
                    <TableCell>{formatGrade(result)}</TableCell>
                    <TableCell>{result.points ?? 0}</TableCell>
                    <TableCell>
                      <Chip
                        label={result.remark || 'N/A'}
                        size='small'
                        sx={{ backgroundColor: getPerformanceColor(result.remark || ''), color: '#fff' }}
                      />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} align='center'>No results have been recorded yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Grid container spacing={3} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant='h6' sx={{ mb: 2 }}>Class Teacher Comment</Typography>
                <Typography>{report.classTeacherRemarks || 'No comment available yet.'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant='h6' sx={{ mb: 2 }}>Principal Comment</Typography>
                <Typography>{report.principalRemarks || 'No principal comment available yet.'}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default ParentProgress;
