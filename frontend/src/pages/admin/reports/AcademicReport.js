import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Box,
    Button,
    CircularProgress,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { buildPrintBrandingHtml, printBrandingStyles } from '../../../utils/printBranding';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
const termOptions = ['Term 1', 'Term 2', 'Term 3'];
const assessmentOptions = [
    { label: 'CAT', value: 'CAT' },
    { label: 'End Term', value: 'END_TERM' },
];

const AcademicReport = () => {
    const { currentUser } = useSelector((state) => state.user);
    const [report, setReport] = useState([]);
    const [classResults, setClassResults] = useState([]);
    const [totalStudents, setTotalStudents] = useState(0);
    const [schoolId, setSchoolId] = useState('');
    const [selectedFilters, setSelectedFilters] = useState({
        academicYear: String(new Date().getFullYear()),
        term: 'Term 1',
        assessment: 'END_TERM',
        classId: 'all',
        stream: 'all',
        studentId: 'all',
    });
    const [classOptions, setClassOptions] = useState([]);
    const [studentOptions, setStudentOptions] = useState([]);
    const [streamOptions, setStreamOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);

    const resolveSchoolId = () => {
        const values = [currentUser?.school?._id, currentUser?.school, currentUser?.schoolId, currentUser?._id, currentUser?.id];
        const resolved = values.map((value) => {
            if (value && typeof value === 'object') return value._id || value.id || null;
            return value && value !== '[object Object]' ? String(value).trim() : null;
        }).find(Boolean);

        return resolved || '';
    };

    const buildReportUrl = (nextFilters = selectedFilters, resolvedSchoolId = schoolId) => {
        const params = new URLSearchParams();

        if (nextFilters.academicYear) params.set('academicYear', nextFilters.academicYear);
        if (nextFilters.term) params.set('term', nextFilters.term);
        if (nextFilters.assessment) params.set('assessment', nextFilters.assessment);
        if (nextFilters.classId && nextFilters.classId !== 'all') params.set('classId', nextFilters.classId);
        if (nextFilters.stream && nextFilters.stream !== 'all') params.set('stream', nextFilters.stream);
        if (nextFilters.studentId && nextFilters.studentId !== 'all') params.set('studentId', nextFilters.studentId);

        return `${API_BASE_URL}/Student/AcademicReport/${resolvedSchoolId}?${params.toString()}`;
    };

    const fetchAcademicReport = async (nextFilters = selectedFilters) => {
        const resolvedSchoolId = resolveSchoolId();
        if (!resolvedSchoolId) {
            setError('Admin school not available. Please sign in again.');
            setLoading(false);
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const adminId = currentUser?._id || currentUser?.id;
            const response = await fetch(buildReportUrl(nextFilters, resolvedSchoolId), {
                headers: {
                    'x-admin-id': adminId,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || `Failed to load academic report (${response.status})`);
            }

            const academicReport = data.academicReport || [];
            const classes = Array.isArray(data.filterOptions?.classes)
                ? data.filterOptions.classes
                : Array.from(new Map(academicReport
                    .filter((item) => item.classId)
                    .map((item) => [String(item.classId), { id: String(item.classId), name: item.class }]))
                    .values())
                    .sort((a, b) => a.name.localeCompare(b.name));
            const streams = data.filterOptions?.streams || [...new Set(academicReport.map((item) => item.stream).filter(Boolean))].sort();
            const students = (data.filterOptions?.students || Array.from(new Map(
                academicReport.map((item) => [String(item.id || item._id || item.name), {
                    id: String(item.id || item._id || item.name),
                    name: item.name,
                }])
            ).values()))
                .filter((student) => student && student.name)
                .sort((a, b) => a.name.localeCompare(b.name));

            setReport(academicReport);
            setClassResults(data.classResults || []);
            setTotalStudents(data.totalStudents || academicReport.length || 0);
            setClassOptions(classes);
            setStreamOptions(streams);
            setStudentOptions(students);
            setSchoolId(resolvedSchoolId);
            setSelectedFilters(nextFilters);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const adminId = currentUser?._id || currentUser?.id;
        if (!adminId) {
            setError('Admin not signed in');
            setLoading(false);
            return;
        }

        fetchAcademicReport(selectedFilters);
    }, [currentUser]);

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setSelectedFilters((current) => ({ ...current, [name]: value }));
    };

    const handleGenerate = () => {
        fetchAcademicReport(selectedFilters);
    };

    const printReport = () => {
        const content = document.getElementById('academic-report');
        if (!content) return;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Academic Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        ${printBrandingStyles}
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ccc; padding: 8px; }
                        th { background: #f0f0f0; }
                    </style>
                </head>
                <body>
                    ${buildPrintBrandingHtml(currentUser)}
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
        return <Box sx={{ p: 3 }}><CircularProgress /></Box>;
    }

    if (error) {
        return <Box sx={{ p: 3 }}><Typography color="error">{error}</Typography></Box>;
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h5">Academic Report</Typography>
                <Button variant="contained" onClick={printReport}>Print Academic Report</Button>
            </Box>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Generate report</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
                    <TextField
                        select
                        label="Academic Year"
                        name="academicYear"
                        value={selectedFilters.academicYear}
                        onChange={handleFilterChange}
                    >
                        {Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - index).map((year) => (
                            <MenuItem key={year} value={String(year)}>{year}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Term"
                        name="term"
                        value={selectedFilters.term}
                        onChange={handleFilterChange}
                        required
                    >
                        {termOptions.map((term) => (
                            <MenuItem key={term} value={term}>{term}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Assessment"
                        name="assessment"
                        value={selectedFilters.assessment}
                        onChange={handleFilterChange}
                        required
                    >
                        {assessmentOptions.map((item) => (
                            <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Class"
                        name="classId"
                        value={selectedFilters.classId}
                        onChange={handleFilterChange}
                    >
                        <MenuItem value="all">All Classes</MenuItem>
                        {classOptions.map((classOption) => (
                            <MenuItem key={classOption.id} value={classOption.id}>{classOption.name}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Stream"
                        name="stream"
                        value={selectedFilters.stream}
                        onChange={handleFilterChange}
                    >
                        <MenuItem value="all">All Streams</MenuItem>
                        {streamOptions.map((stream) => (
                            <MenuItem key={stream} value={stream}>{stream}</MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Student"
                        name="studentId"
                        value={selectedFilters.studentId}
                        onChange={handleFilterChange}
                    >
                        <MenuItem value="all">All Students</MenuItem>
                        {studentOptions.map((student) => (
                            <MenuItem key={student.id} value={student.id}>{student.name}</MenuItem>
                        ))}
                    </TextField>
                </Box>

                <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button variant="contained" onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? 'Generating...' : 'Generate Report'}
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                        Selected: {selectedFilters.term} / {selectedFilters.assessment} / {selectedFilters.academicYear}
                    </Typography>
                </Box>
            </Paper>

            {classResults.length > 0 && (
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Results per Class</Typography>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Class</TableCell>
                                    <TableCell>Students</TableCell>
                                    <TableCell>Average Marks</TableCell>
                                    <TableCell>Top Student</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {classResults.map((entry) => (
                                    <TableRow key={entry.className}>
                                        <TableCell>{entry.className}</TableCell>
                                        <TableCell>{entry.studentCount}</TableCell>
                                        <TableCell>{Number(entry.averageMarks || 0).toFixed(1)}</TableCell>
                                        <TableCell>{entry.topStudent ? `${entry.topStudent.name} (${entry.topStudent.totalMarks})` : 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            <Paper id="academic-report" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>Total Students: {totalStudents}</Typography>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>Student</TableCell>
                                <TableCell>Roll No</TableCell>
                                <TableCell>Class</TableCell>
                                <TableCell>Marks</TableCell>
                                <TableCell>Average</TableCell>
                                <TableCell>Overall Rank</TableCell>
                                <TableCell>Results</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {report.map((student, index) => (
                                <TableRow key={student.id || student._id || index}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{student.name}</TableCell>
                                    <TableCell>{student.rollNum || 'N/A'}</TableCell>
                                    <TableCell>{typeof student.class === 'object' ? student.class?.sclassName || 'N/A' : student.class || 'N/A'}</TableCell>
                                    <TableCell>{student.reportSummary?.totalMarks ?? 0}</TableCell>
                                    <TableCell>{student.reportSummary?.average ? Number(student.reportSummary.average).toFixed(1) : '0.0'}</TableCell>
                                    <TableCell>{student.reportSummary?.overallRank ? `${student.reportSummary.overallRank}/${student.reportSummary.overallOutOf || 1}` : 'N/A'}</TableCell>
                                    <TableCell>
                                        {student.results?.length > 0 ? (
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                {student.results.map((result, rindex) => (
                                                    <li key={rindex}>{result.subject}: {result.marksObtained} ({result.grade})</li>
                                                ))}
                                            </ul>
                                        ) : 'No results'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default AcademicReport;
