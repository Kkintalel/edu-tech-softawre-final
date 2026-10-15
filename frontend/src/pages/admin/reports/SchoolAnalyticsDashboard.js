import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { addSchoolBrandingToPdf } from '../../../utils/printBranding';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
const COLORS = ['#126b68', '#c46a3a', '#416a9a', '#a74255', '#6b8532', '#805690', '#cb9a24'];
const EMPTY_FILTERS = {
  academicYear: String(new Date().getFullYear()),
  term: 'Term 1',
  assessment: 'END_TERM',
  classId: 'all',
  stream: 'all',
  subjectId: 'all',
  studentId: 'all',
  page: 1,
  pageSize: 25,
};
const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(value) || 0);
const mean = (value) => value === null || value === undefined ? 'No records' : `${Number(value).toFixed(1)}%`;

const Metric = ({ label, value, detail, color = '#126b68' }) => (
  <Paper sx={{ p: 2, borderTop: `3px solid ${color}`, minHeight: 98 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h5" sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
  </Paper>
);

const EmptyChart = ({ children }) => (
  <Box sx={{ height: 240, display: 'grid', placeItems: 'center', color: 'text.secondary', textAlign: 'center', px: 2 }}>
    <Typography variant="body2">{children}</Typography>
  </Box>
);

const ChartPanel = ({ title, children }) => (
  <Paper sx={{ p: 2, minWidth: 0 }}>
    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>{title}</Typography>
    {children}
  </Paper>
);

const SchoolAnalyticsDashboard = () => {
  const { currentUser, currentRole } = useSelector((state) => state.user);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [filterOptions, setFilterOptions] = useState({ classes: [], streams: [], subjects: [] });
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [academics, setAcademics] = useState(null);
  const [subjects, setSubjects] = useState(null);
  const [classes, setClasses] = useState(null);
  const [fees, setFees] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [enrolment, setEnrolment] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [budget, setBudget] = useState(null);
  const [teachers, setTeachers] = useState(null);
  const [targets, setTargets] = useState([]);
  const [reports, setReports] = useState({ history: [], administrativeChanges: [] });
  const [targetForm, setTargetForm] = useState({ metric: 'academicMean', label: '', targetValue: '', academicYear: EMPTY_FILTERS.academicYear, term: EMPTY_FILTERS.term });
  const [scheduleForm, setScheduleForm] = useState({ reportType: 'overview', frequency: 'monthly' });
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const ownSchoolId = useMemo(() => {
    const candidate = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId || currentUser?._id || currentUser?.id;
    return candidate && typeof candidate === 'object' ? candidate._id || candidate.id || '' : String(candidate || '');
  }, [currentUser]);
  const scopeSchoolId = currentRole === 'SuperAdmin' ? selectedSchool : ownSchoolId;
  const headers = useMemo(() => {
    const userId = currentUser?._id || currentUser?.id;
    return userId ? { 'x-admin-id': userId, 'x-user-id': userId } : {};
  }, [currentUser]);

  const buildQuery = useCallback((pageOverride) => {
    const query = new URLSearchParams();
    Object.entries({ ...filters, ...(pageOverride ? { page: pageOverride } : {}) }).forEach(([key, value]) => {
      if (value !== '' && value !== 'all' && value !== undefined && value !== null) query.set(key, String(value));
    });
    if (currentRole === 'SuperAdmin' && selectedSchool) query.set('schoolId', selectedSchool);
    return query.toString();
  }, [currentRole, filters, selectedSchool]);

  const loadAll = useCallback(async (nextFilters = filters) => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    if (currentRole === 'SuperAdmin' && !selectedSchool) {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/analytics/overview`, { headers });
        setOverview(response.data);
        setSchoolOptions(response.data.schools || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Could not load platform school overview');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!scopeSchoolId) {
      setError('School scope is unavailable for this account.');
      setLoading(false);
      return;
    }

    setRefreshing(true);
    setError('');
    const query = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value !== '' && value !== 'all' && value !== undefined && value !== null) query.set(key, String(value));
    });
    if (currentRole === 'SuperAdmin') query.set('schoolId', selectedSchool);
    const queryString = query.toString();
    try {
      const endpoints = [
        'overview', 'academics', 'subjects', 'classes', 'fees', 'attendance', 'enrolment', 'reconciliation', 'budget', 'teachers', 'targets', 'reports',
      ];
      const responses = await Promise.all(endpoints.map((endpoint) => axios.get(`${API_BASE_URL}/api/analytics/${endpoint}${queryString ? `?${queryString}` : ''}`, { headers })));
      const [overviewResponse, academicResponse, subjectResponse, classResponse, feeResponse, attendanceResponse, enrolmentResponse, reconciliationResponse, budgetResponse, teacherResponse, targetResponse, reportResponse] = responses;
      setOverview(overviewResponse.data);
      setAcademics(academicResponse.data);
      setSubjects(subjectResponse.data);
      setClasses(classResponse.data);
      setFees(feeResponse.data);
      setAttendance(attendanceResponse.data);
      setEnrolment(enrolmentResponse.data);
      setReconciliation(reconciliationResponse.data);
      setBudget(budgetResponse.data);
      setTeachers(teacherResponse.data);
      setTargets(targetResponse.data.targets || []);
      setReports(reportResponse.data || { history: [], administrativeChanges: [] });
      setFilterOptions(academicResponse.data.filterOptions || { classes: [], streams: [], subjects: [] });
      setFilters(nextFilters);
      setTargetForm((form) => ({ ...form, academicYear: nextFilters.academicYear, term: nextFilters.term }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not load analytics for the selected filters');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentRole, currentUser, filters, headers, scopeSchoolId, selectedSchool]);

  useEffect(() => {
    if (currentUser) loadAll(EMPTY_FILTERS);
  }, [currentUser, currentRole, selectedSchool]);

  const updateFilter = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));
  };

  const recordExport = async (format, count) => {
    try {
      await axios.post(`${API_BASE_URL}/api/analytics/reports`, { reportType: 'academics', format, filters: { ...filters, schoolId: scopeSchoolId }, recordCount: count }, { headers });
      const response = await axios.get(`${API_BASE_URL}/api/analytics/reports?${buildQuery()}`, { headers });
      setReports(response.data);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'The export was created, but its history could not be saved.');
    }
  };

  const exportExcel = async () => {
    if (!academics) return;
    const workbook = XLSX.utils.book_new();
    const studentRows = academics.students || [];
    const addSheet = (name, rows) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ information: 'No records for the selected filters' }]), name.slice(0, 31));
    const branding = currentUser?.schoolSettings || currentUser?.settings || {};
    addSheet('School branding', [{ school: branding.branding?.schoolName || overview?.school?.name || 'Selected school', physicalAddress: branding.schoolProfile?.physicalAddress || branding.schoolProfile?.address || '', postalAddress: branding.schoolProfile?.postalAddress || '', phone: branding.schoolProfile?.phone || '', email: branding.schoolProfile?.email || '', website: branding.schoolProfile?.website || '' }]);
    addSheet('Academic summary', [{ school: overview?.school?.name || 'Selected school', year: filters.academicYear, term: filters.term, assessment: filters.assessment, meanScore: academics.summary?.meanScore, points: academics.summary?.totalPoints, assessmentCompletion: academics.summary?.assessmentCompletion }]);
    addSheet('Student results', studentRows.map((row) => ({ rank: row.schoolRank, student: row.name, admissionNo: row.admissionNo, class: row.className, stream: row.stream, average: row.meanScore, points: row.totalPoints, marksEntered: row.validMarks })));
    addSheet('Subjects', subjects?.subjectResults || []);
    addSheet('Classes and streams', classes?.classResults || []);
    addSheet('Fees', fees?.collectionsByMonth || []);
    addSheet('Fee balances', fees?.balanceByClass || []);
    addSheet('Attendance', attendance?.studentTrend || []);
    addSheet('Enrolment', enrolment?.recordedEnrolmentsByMonth || []);
    addSheet('Budget', budget?.budgetVsActual || []);
    addSheet('Reconciliation', reconciliation?.transactions || []);
    XLSX.writeFile(workbook, `school-analytics-${filters.academicYear}-${filters.term.replace(/\s+/g, '-')}.xlsx`);
    setActionMessage('Excel report downloaded from records matching the active filters.');
    await recordExport('excel', studentRows.length);
  };

  const exportPdf = async () => {
    if (!academics) return;
    const document = new jsPDF({ orientation: 'landscape' });
    const brandingY = await addSchoolBrandingToPdf(document, currentUser);
    document.setFontSize(16);
    document.text('School Analytics Report', 14, brandingY);
    document.setFontSize(9);
    document.text(`${overview?.school?.name || 'Selected school'} · ${filters.academicYear} · ${filters.term} · ${filters.assessment}`, 14, brandingY + 6);
    autoTable(document, {
      startY: brandingY + 12,
      head: [['Metric', 'Value'], ['Mean score', mean(academics.summary?.meanScore)], ['Assessment completion', mean(academics.summary?.assessmentCompletion)], ['Verified collections', money(fees?.summary?.verifiedCollections)], ['Outstanding fees', money(fees?.summary?.outstandingFees)], ['Attendance', mean(attendance?.summary?.studentAttendanceRate)]],
      body: [],
      theme: 'grid',
    });
    autoTable(document, {
      startY: brandingY + 38,
      head: [['Rank', 'Student', 'Admission No.', 'Class', 'Stream', 'Mean score', 'Points', 'Marks entered']],
      body: (academics.students || []).map((row) => [row.schoolRank, row.name, row.admissionNo || '', row.className, row.stream || '', Number(row.meanScore).toFixed(1), row.totalPoints, row.validMarks]),
      styles: { fontSize: 8 },
    });
    document.save(`school-analytics-${filters.academicYear}-${filters.term.replace(/\s+/g, '-')}.pdf`);
    setActionMessage('PDF report downloaded from records matching the active filters.');
    await recordExport('pdf', academics.students?.length || 0);
  };

  const createTarget = async (event) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    try {
      await axios.post(`${API_BASE_URL}/api/analytics/targets`, { ...targetForm, targetValue: Number(targetForm.targetValue), ...(currentRole === 'SuperAdmin' ? { schoolId: selectedSchool } : {}) }, { headers });
      setActionMessage('School improvement target saved.');
      await loadAll(filters);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Could not save target');
    }
  };

  const createSchedule = async (event) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    try {
      await axios.post(`${API_BASE_URL}/api/analytics/schedules`, { ...scheduleForm, filters }, { headers });
      const response = await axios.get(`${API_BASE_URL}/api/analytics/reports?${buildQuery()}`, { headers });
      setReports(response.data);
      setActionMessage('Scheduled report saved for the authorised account email.');
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Could not schedule report');
    }
  };

  const loadPage = (page) => loadAll({ ...filters, page });

  if (loading && currentRole !== 'SuperAdmin') return <Box sx={{ p: 3 }}><CircularProgress /></Box>;

  if (currentRole === 'SuperAdmin' && !selectedSchool) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Platform school overview</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Paper sx={{ overflowX: 'auto' }}>
          <Table size="small"><TableHead><TableRow><TableCell>School</TableCell><TableCell>Status</TableCell><TableCell>Students</TableCell><TableCell>Teachers</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>{schoolOptions.map((school) => <TableRow key={school.schoolId}><TableCell>{school.name}</TableCell><TableCell>{school.status}</TableCell><TableCell>{school.students}</TableCell><TableCell>{school.teachers}</TableCell><TableCell><Button onClick={() => setSelectedSchool(school.schoolId)}>Open analytics</Button></TableCell></TableRow>)}
              {!schoolOptions.length && <TableRow><TableCell colSpan={5} align="center">No school records available.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">School analytics</Typography>
          <Typography variant="body2" color="text.secondary">{overview?.school?.name || currentUser?.schoolName || 'Selected school'} · filtered operational records</Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {currentRole === 'SuperAdmin' && <Button onClick={() => setSelectedSchool('')}>All schools</Button>}
          <Button variant="outlined" onClick={exportExcel} disabled={!academics}>Export Excel</Button>
          <Button variant="contained" onClick={exportPdf} disabled={!academics}>Export PDF</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert>}
      {actionMessage && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionMessage('')}>{actionMessage}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>Active filters</Typography>
          <Button onClick={() => loadAll(filters)} disabled={refreshing}>{refreshing ? 'Updating...' : 'Update analytics'}</Button>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 1.5 }}>
          <TextField select size="small" label="Academic year" name="academicYear" value={filters.academicYear} onChange={updateFilter}>
            {Array.from({ length: 8 }, (_, index) => String(new Date().getFullYear() - index)).map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Term" name="term" value={filters.term} onChange={updateFilter}>{['Term 1', 'Term 2', 'Term 3'].map((term) => <MenuItem key={term} value={term}>{term}</MenuItem>)}</TextField>
          <TextField select size="small" label="Assessment" name="assessment" value={filters.assessment} onChange={updateFilter}><MenuItem value="ALL">All assessments</MenuItem><MenuItem value="CAT">CAT</MenuItem><MenuItem value="END_TERM">End term</MenuItem></TextField>
          <TextField select size="small" label="Class" name="classId" value={filters.classId} onChange={updateFilter}><MenuItem value="all">All classes</MenuItem>{filterOptions.classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
          <TextField select size="small" label="Stream" name="stream" value={filters.stream} onChange={updateFilter}><MenuItem value="all">All streams</MenuItem>{filterOptions.streams.map((stream) => <MenuItem key={stream} value={stream}>{stream}</MenuItem>)}</TextField>
          <TextField select size="small" label="Subject" name="subjectId" value={filters.subjectId} onChange={updateFilter}><MenuItem value="all">All subjects</MenuItem>{filterOptions.subjects.filter((item) => filters.classId === 'all' || item.classId === filters.classId).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
          <TextField select size="small" label="Student" name="studentId" value={filters.studentId} onChange={updateFilter}><MenuItem value="all">All students</MenuItem>{(academics?.students || []).map((item) => <MenuItem key={item.studentId} value={item.studentId}>{item.name}</MenuItem>)}</TextField>
        </Box>
      </Paper>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto" aria-label="analytics sections">
          <Tab label="Overview" /><Tab label="Academics" /><Tab label="Finance" /><Tab label="Attendance & enrolment" /><Tab label="Teachers & staff" /><Tab label="Actions & history" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 1.5, mb: 2 }}>
            <Metric label="Academic mean" value={mean(overview?.academic?.meanScore)} detail={`${overview?.academic?.assessedStudents || 0} assessed students`} />
            <Metric label="Marks complete" value={mean(overview?.academic?.assessmentCompletion)} detail={`${overview?.academic?.submittedMarks || 0} of ${overview?.academic?.requiredMarks || 0} required marks`} color="#416a9a" />
            <Metric label="Verified collections" value={money(overview?.finance?.verifiedCollections)} detail={`Expected ${money(overview?.finance?.expectedFees)}`} color="#6b8532" />
            <Metric label="Outstanding balance" value={money(overview?.finance?.outstandingFees)} detail="Based on student account balances" color="#c46a3a" />
            <Metric label="Attendance rate" value={mean(overview?.attendance?.attendanceRate)} detail={`${overview?.attendance?.studentsMissingRecords || 0} missing student records`} color="#a74255" />
            <Metric label="Recorded enrolments" value={overview?.enrolment?.currentPopulation ?? 0} detail={`${overview?.staff?.teacherCount ?? 0} teachers`} color="#805690" />
          </Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Action alerts</Typography>
            <Stack spacing={1}>{(overview?.alerts || []).map((alert, index) => <Alert key={`${alert.type}-${index}`} severity={alert.severity}>{alert.message}{alert.count !== undefined ? ` · ${alert.count}` : ''}{alert.amount !== undefined ? ` · ${money(alert.amount)}` : ''}</Alert>)}{!overview?.alerts?.length && <Typography color="text.secondary">No outstanding analytics alerts for these filters.</Typography>}</Stack>
          </Paper>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.3fr 1fr' }, gap: 1.5 }}>
            <ChartPanel title="Academic performance across terms and exams">
              {academics?.comparison?.some((row) => row.CAT !== null || row.END_TERM !== null) ? <ResponsiveContainer width="100%" height={250}><LineChart data={academics.comparison}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="term" /><YAxis domain={[0, 100]} /><Tooltip /><Legend /><Line type="monotone" dataKey="CAT" name="CAT mean" stroke="#126b68" connectNulls /><Line type="monotone" dataKey="END_TERM" name="End-term mean" stroke="#c46a3a" connectNulls /></LineChart></ResponsiveContainer> : <EmptyChart>No examination marks for the selected school, year, term, and filters.</EmptyChart>}
            </ChartPanel>
            <ChartPanel title="Fee collections against expected fees">
              {fees?.collectionsByMonth?.length ? <ResponsiveContainer width="100%" height={250}><LineChart data={fees.collectionsByMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value) => money(value)} /><Legend /><Line type="monotone" dataKey="collections" name="Verified collections" stroke="#6b8532" /></LineChart></ResponsiveContainer> : <EmptyChart>No verified payment records in this period.</EmptyChart>}
            </ChartPanel>
          </Box>
        </>
      )}

      {activeTab === 1 && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
            <ChartPanel title="Subject performance mean">
              {subjects?.subjectResults?.length ? <ResponsiveContainer width="100%" height={290}><BarChart data={subjects.subjectResults.slice(0, 12)} margin={{ bottom: 38 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="subject" interval={0} angle={-25} textAnchor="end" height={70} /><YAxis domain={[0, 100]} /><Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} /><Bar dataKey="averageMarks" name="Subject mean" fill="#126b68">{subjects.subjectResults.slice(0, 12).map((entry, index) => <Cell key={entry.subjectId} fill={COLORS[index % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer> : <EmptyChart>No valid subject scores for the selected filters.</EmptyChart>}
            </ChartPanel>
            <ChartPanel title="Grade distribution">
              {academics?.gradeDistribution?.length ? <ResponsiveContainer width="100%" height={290}><PieChart><Pie data={academics.gradeDistribution} dataKey="count" nameKey="grade" outerRadius={95} label>{academics.gradeDistribution.map((entry, index) => <Cell key={entry.grade} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <EmptyChart>No assessed students for the selected filters.</EmptyChart>}
            </ChartPanel>
            <ChartPanel title="Class and stream comparison">
              {classes?.classResults?.length ? <ResponsiveContainer width="100%" height={290}><BarChart data={classes.classResults}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="stream" tickFormatter={(stream, index) => `${classes.classResults[index]?.className || ''} ${stream || ''}`} /><YAxis domain={[0, 100]} /><Tooltip /><Legend /><Bar dataKey="averageMarks" name="Mean score" fill="#416a9a" /></BarChart></ResponsiveContainer> : <EmptyChart>No class or stream marks are available for these filters.</EmptyChart>}
            </ChartPanel>
            <Paper sx={{ p: 2, overflowX: 'auto' }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Student and class rankings</Typography>
              <Table size="small"><TableHead><TableRow><TableCell>Rank</TableCell><TableCell>Student</TableCell><TableCell>Class</TableCell><TableCell>Stream</TableCell><TableCell>Mean</TableCell><TableCell>Points</TableCell></TableRow></TableHead><TableBody>{(academics?.students || []).map((student) => <TableRow key={student.studentId}><TableCell>{student.schoolRank}</TableCell><TableCell>{student.name}</TableCell><TableCell>{student.className}</TableCell><TableCell>{student.stream || '—'}</TableCell><TableCell>{Number(student.meanScore).toFixed(1)}</TableCell><TableCell>{student.totalPoints}</TableCell></TableRow>)}{!academics?.students?.length && <TableRow><TableCell colSpan={6} align="center">No student assessment records.</TableCell></TableRow>}</TableBody></Table>
              {academics?.totalStudentRows > academics?.pageSize && <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}><Typography variant="caption">Page {academics.page} of {Math.ceil(academics.totalStudentRows / academics.pageSize)} · {academics.totalStudentRows} students</Typography><Stack direction="row"><Button disabled={academics.page <= 1 || refreshing} onClick={() => loadPage(academics.page - 1)}>Previous</Button><Button disabled={academics.page >= Math.ceil(academics.totalStudentRows / academics.pageSize) || refreshing} onClick={() => loadPage(academics.page + 1)}>Next</Button></Stack></Stack>}
            </Paper>
          </Box>
        </>
      )}

      {activeTab === 2 && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 1.5, mb: 2 }}>
            <Metric label="Expected fees" value={money(fees?.summary?.expectedFees)} detail={fees?.summary?.expectedFeeSource} />
            <Metric label="Verified collections" value={money(fees?.summary?.verifiedCollections)} color="#6b8532" />
            <Metric label="Collection rate" value={mean(fees?.summary?.collectionRate)} color="#416a9a" />
            <Metric label="Outstanding fees" value={money(fees?.summary?.outstandingFees)} color="#c46a3a" />
            <Metric label="Approved budget" value={money(budget?.summary?.approvedBudget)} color="#805690" />
            <Metric label="Actual expenditure" value={money(budget?.summary?.actualExpenditure)} color="#a74255" />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
            <ChartPanel title="Verified collections by month">
              {fees?.collectionsByMonth?.length ? <ResponsiveContainer width="100%" height={270}><LineChart data={fees.collectionsByMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value) => money(value)} /><Line type="monotone" dataKey="collections" name="Collections" stroke="#6b8532" strokeWidth={2} /></LineChart></ResponsiveContainer> : <EmptyChart>No verified collections for this period.</EmptyChart>}
            </ChartPanel>
            <ChartPanel title="Outstanding balances by class">
              {fees?.balanceByClass?.length ? <ResponsiveContainer width="100%" height={270}><BarChart data={fees.balanceByClass}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="className" /><YAxis /><Tooltip formatter={(value) => money(value)} /><Bar dataKey="outstandingBalance" name="Outstanding" fill="#c46a3a" /></BarChart></ResponsiveContainer> : <EmptyChart>No class balances recorded for this selection.</EmptyChart>}
            </ChartPanel>
            <ChartPanel title="Budget versus actual expenditure">
              {budget?.budgetVsActual?.length ? <ResponsiveContainer width="100%" height={270}><BarChart data={budget.budgetVsActual}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="account" /><YAxis /><Tooltip formatter={(value) => money(value)} /><Legend /><Bar dataKey="approvedBudget" name="Approved budget" fill="#416a9a" /><Bar dataKey="actualExpenditure" name="Actual expenditure" fill="#c46a3a" /></BarChart></ResponsiveContainer> : <EmptyChart>No approved budgets or posted expenditure in the selected period.</EmptyChart>}
            </ChartPanel>
            <Paper sx={{ p: 2, overflowX: 'auto' }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Payment reconciliation</Typography>
              <Stack direction="row" spacing={2} sx={{ mb: 1 }}><Typography>Matched: {reconciliation?.summary?.matched ?? 0}</Typography><Typography>Unmatched: {reconciliation?.summary?.unmatched ?? 0}</Typography><Typography>Pending: {reconciliation?.summary?.pending ?? 0}</Typography></Stack>
              <Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Receipt</TableCell><TableCell>Reference</TableCell><TableCell>Amount</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{(reconciliation?.transactions || []).slice(0, 8).map((item) => <TableRow key={`${item.studentId}-${item.paymentIndex}`}><TableCell>{item.date ? new Date(item.date).toLocaleDateString() : '—'}</TableCell><TableCell>{item.receiptNumber}</TableCell><TableCell>{item.reference || item.transactionId || '—'}</TableCell><TableCell>{money(item.amount)}</TableCell><TableCell>{item.status}</TableCell></TableRow>)}{!reconciliation?.transactions?.length && <TableRow><TableCell colSpan={5} align="center">No payment records for the selected period.</TableCell></TableRow>}</TableBody></Table>
            </Paper>
          </Box>
        </>
      )}

      {activeTab === 3 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5 }}>
          <ChartPanel title="Student attendance trend">
            {attendance?.studentTrend?.length ? <ResponsiveContainer width="100%" height={290}><LineChart data={attendance.studentTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 100]} /><Tooltip /><Line dataKey="rate" name="Recorded-session attendance rate" stroke="#a74255" /></LineChart></ResponsiveContainer> : <EmptyChart>No student attendance records in the selected academic period.</EmptyChart>}
          </ChartPanel>
          <ChartPanel title="Staff attendance trend">
            {attendance?.staffTrend?.length ? <ResponsiveContainer width="100%" height={290}><LineChart data={attendance.staffTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 100]} /><Tooltip /><Line dataKey="rate" name="Staff attendance rate" stroke="#416a9a" /></LineChart></ResponsiveContainer> : <EmptyChart>No staff attendance records in the selected period.</EmptyChart>}
          </ChartPanel>
          <ChartPanel title="Recorded student enrolments">
            {enrolment?.recordedEnrolmentsByMonth?.length ? <ResponsiveContainer width="100%" height={290}><BarChart data={enrolment.recordedEnrolmentsByMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Recorded enrolments" fill="#126b68" /></BarChart></ResponsiveContainer> : <EmptyChart>No student records were created in this academic period. This trend uses student record creation dates.</EmptyChart>}
          </ChartPanel>
          <Paper sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={700}>Attendance coverage</Typography><Typography sx={{ mt: 1 }}>Student sessions attended / recorded sessions expected: {attendance?.summary?.studentAttended ?? 0} / {attendance?.summary?.studentSessions ?? 0}</Typography><Typography sx={{ mt: 1 }}>Students without attendance records: {attendance?.summary?.studentsMissingRecords ?? 0} of {attendance?.summary?.expectedStudents ?? 0}</Typography><Typography variant="caption" color="text.secondary">Attendance rates use recorded sessions; class timetable sessions are not treated as attended or absent unless a record exists.</Typography></Paper>
        </Box>
      )}

      {activeTab === 4 && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 1.5, mb: 2 }}><Metric label="Teachers" value={teachers?.summary?.teacherCount ?? 0} /><Metric label="Incomplete subject mark sets" value={teachers?.summary?.incompleteMarkSubjects ?? 0} color="#c46a3a" /><Metric label="Overdue assignments" value={teachers?.summary?.overdueAssignments ?? 0} color="#a74255" /></Box>
          <Paper sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>Teacher</TableCell><TableCell>Classes</TableCell><TableCell>Subjects</TableCell><TableCell>Subject and assessment completion</TableCell><TableCell>Pending assignments</TableCell><TableCell>Attendance</TableCell></TableRow></TableHead><TableBody>{(teachers?.teachers || []).map((teacher) => <TableRow key={teacher.id}><TableCell>{teacher.name}</TableCell><TableCell>{teacher.classes.map((item) => item.name).filter(Boolean).join(', ') || teacher.teachingLoad.classes}</TableCell><TableCell>{teacher.subjects.map((item) => item.name).join(', ') || '—'}</TableCell><TableCell>{teacher.marksEntry.map((item) => `${item.classId.slice(-4)} · ${item.subject}: ${item.submittedMarks}/${item.expectedMarks}`).join(' | ') || 'No assigned subjects'}</TableCell><TableCell>{teacher.assignmentProgress.filter((item) => item.overdue || item.completionRate < 100).map((item) => `${item.title} (${item.submissions}/${item.expectedSubmissions})`).join(', ') || 'None'}</TableCell><TableCell>{mean(teacher.teacherAttendance.rate)}</TableCell></TableRow>)}{!teachers?.teachers?.length && <TableRow><TableCell colSpan={6} align="center">No teacher records found.</TableCell></TableRow>}</TableBody></Table></Paper>
        </>
      )}

      {activeTab === 5 && (
        <Stack spacing={2}>
          <Paper component="form" onSubmit={createTarget} sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>School improvement target</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 1.5 }}>
              <TextField select label="Metric" value={targetForm.metric} onChange={(event) => setTargetForm((form) => ({ ...form, metric: event.target.value }))}><MenuItem value="academicMean">Academic mean (%)</MenuItem><MenuItem value="attendanceRate">Attendance rate (%)</MenuItem><MenuItem value="feeCollectionRate">Fee collection rate (%)</MenuItem><MenuItem value="assessmentCompletion">Assessment completion (%)</MenuItem><MenuItem value="enrolment">New enrolments</MenuItem></TextField>
              <TextField required label="Target name" value={targetForm.label} onChange={(event) => setTargetForm((form) => ({ ...form, label: event.target.value }))} />
              <TextField required type="number" label="Target value" value={targetForm.targetValue} onChange={(event) => setTargetForm((form) => ({ ...form, targetValue: event.target.value }))} />
              <Button type="submit" variant="contained" sx={{ minHeight: 56 }}>Save target</Button>
            </Box>
            <Stack spacing={1} sx={{ mt: 2 }}>{targets.map((target) => <Box key={target._id}><Stack direction="row" justifyContent="space-between"><Typography>{target.label}</Typography><Typography>{target.currentValue === null ? 'No current data' : `${Number(target.currentValue).toFixed(1)} / ${target.targetValue}`}</Typography></Stack><Box sx={{ mt: 0.5, height: 7, bgcolor: '#e4e9e8', borderRadius: 1 }}><Box sx={{ height: '100%', width: `${Math.min(100, Math.max(0, target.progress || 0))}%`, bgcolor: '#126b68' }} /></Box></Box>)}</Stack>
          </Paper>
          <Paper component="form" onSubmit={createSchedule} sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Schedule a report</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField select label="Report" value={scheduleForm.reportType} onChange={(event) => setScheduleForm((form) => ({ ...form, reportType: event.target.value }))}><MenuItem value="overview">Management overview</MenuItem><MenuItem value="academics">Academic report</MenuItem><MenuItem value="teachers">Teacher analytics</MenuItem></TextField>
              <TextField select label="Frequency" value={scheduleForm.frequency} onChange={(event) => setScheduleForm((form) => ({ ...form, frequency: event.target.value }))}><MenuItem value="weekly">Weekly</MenuItem><MenuItem value="monthly">Monthly</MenuItem></TextField>
              <Button type="submit" variant="contained">Schedule to my account email</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Only authorised administrators/HR receive scheduled summaries. Delivery requires configured school email.</Typography>
          </Paper>
          <Paper sx={{ p: 2, overflowX: 'auto' }}><Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Generated reports</Typography><Table size="small"><TableHead><TableRow><TableCell>Created</TableCell><TableCell>Report</TableCell><TableCell>Format</TableCell><TableCell>Rows</TableCell><TableCell>Filters</TableCell></TableRow></TableHead><TableBody>{(reports.history || []).map((item) => <TableRow key={item._id}><TableCell>{new Date(item.generatedAt).toLocaleString()}</TableCell><TableCell>{item.reportType}</TableCell><TableCell>{item.format}</TableCell><TableCell>{item.recordCount}</TableCell><TableCell>{item.filters?.academicYear} · {item.filters?.term}</TableCell></TableRow>)}{!reports.history?.length && <TableRow><TableCell colSpan={5} align="center">No reports generated yet.</TableCell></TableRow>}</TableBody></Table></Paper>
          <Paper sx={{ p: 2, overflowX: 'auto' }}><Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Administrative changes</Typography><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>User</TableCell><TableCell>Role</TableCell><TableCell>Action</TableCell><TableCell>Record</TableCell><TableCell>Result</TableCell></TableRow></TableHead><TableBody>{(reports.administrativeChanges || []).map((item, index) => <TableRow key={`${item.timestamp}-${index}`}><TableCell>{new Date(item.timestamp).toLocaleString()}</TableCell><TableCell>{item.userName || '—'}</TableCell><TableCell>{item.userRole}</TableCell><TableCell>{item.action}</TableCell><TableCell>{item.entityName || item.entityType}</TableCell><TableCell>{item.resultMessage || item.status}</TableCell></TableRow>)}{!reports.administrativeChanges?.length && <TableRow><TableCell colSpan={6} align="center">No administrative changes recorded in the last 90 days.</TableCell></TableRow>}</TableBody></Table></Paper>
        </Stack>
      )}
      <Divider sx={{ mt: 2 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>All values are derived from school records. Missing or unconfigured data is shown as empty; it is never replaced with sample data.</Typography>
    </Box>
  );
};

export default SchoolAnalyticsDashboard;