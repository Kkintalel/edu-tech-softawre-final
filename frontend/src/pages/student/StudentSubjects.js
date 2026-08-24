import React, { useEffect, useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { getSubjectList } from '../../redux/sclassRelated/sclassHandle';
import { BottomNavigation, BottomNavigationAction, Container, Paper, Table, TableBody, TableHead, Typography, Box, Chip, Button } from '@mui/material';
import { getUserDetails } from '../../redux/userRelated/userHandle';
import CustomBarChart from '../../components/CustomBarChart'
import { calculateGrade, getGradeColor, formatGrade } from '../../utils/gradingSystem';
import { calculateOverallAttendancePercentage } from '../../components/attendanceCalculator';
import { buildPrintBrandingHtml, printBrandingStyles } from '../../utils/printBranding';

import InsertChartIcon from '@mui/icons-material/InsertChart';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import TableChartIcon from '@mui/icons-material/TableChart';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { StyledTableCell, StyledTableRow } from '../../components/styles';

const StudentSubjects = () => {

    const dispatch = useDispatch();
    const { subjectsList, sclassDetails } = useSelector((state) => state.sclass);
    const { userDetails, currentUser, loading, response, error } = useSelector((state) => state.user);

    useEffect(() => {
        dispatch(getUserDetails(currentUser._id, "Student"));
    }, [dispatch, currentUser._id])

    if (response) { console.log(response) }
    else if (error) { console.log(error) }

    const [subjectMarks, setSubjectMarks] = useState([]);
    const [selectedSection, setSelectedSection] = useState('table');

    useEffect(() => {
        if (userDetails) {
            setSubjectMarks(userDetails.examResult || []);
        }
    }, [userDetails]);

    useEffect(() => {
        if ((!subjectMarks || subjectMarks.length === 0) && currentUser?.sclassName?._id) {
            dispatch(getSubjectList(currentUser.sclassName._id, 'ClassSubjects'));
        }
    }, [subjectMarks, dispatch, currentUser?.sclassName?._id]);

    const catResults = useMemo(
        () => subjectMarks.filter((result) => result.examType === 'CAT'),
        [subjectMarks]
    );

    const endTermResults = useMemo(
        () => subjectMarks.filter((result) => result.examType === 'END_TERM'),
        [subjectMarks]
    );

    const feePercentage = useMemo(() => {
        const totalFees = Number(userDetails?.totalFees ?? currentUser?.totalFees ?? 0);
        const amountPaid = Number(userDetails?.amountPaid ?? currentUser?.amountPaid ?? 0);
        if (totalFees <= 0) return 0;
        return (amountPaid / totalFees) * 100;
    }, [userDetails, currentUser]);

    const attendancePercentage = useMemo(() => {
        return calculateOverallAttendancePercentage(userDetails?.attendance || []);
    }, [userDetails]);

    const hasPassedEligibility = useMemo(() => {
        const hasCatResults = Array.isArray(catResults) && catResults.length > 0;
        return feePercentage >= 75 && attendancePercentage >= 75 && hasCatResults;
    }, [feePercentage, attendancePercentage, catResults]);

    const handlePrintReportCard = () => {
        const content = document.getElementById('report-card-print');
        if (!content) return;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Student Academic Report Card</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        ${printBrandingStyles}
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ccc; padding: 8px; }
                        th { background: #f0f0f0; }
                    </style>
                </head>
                <body>
                    ${buildPrintBrandingHtml(currentUser, userDetails?.school)}
                    ${content.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    const summaryCounts = useMemo(() => {
        const counts = {
            'Exceeding Expectation': 0,
            'Meeting Expectation': 0,
            'Approaching Expectation': 0,
            'Below Expectation': 0,
            Unknown: 0,
        };

        return (subjectMarks || []).reduce((acc, result) => {
            if (!result || result.marksObtained === undefined || result.marksObtained === null) {
                acc.Unknown += 1;
                return acc;
            }

            const gradeInfo = calculateGrade(result.marksObtained, result.gradingSystem) || result;
            const remark = gradeInfo?.remark || 'Unknown';

            if (acc[remark] !== undefined) {
                acc[remark] += 1;
            } else {
                acc.Unknown += 1;
            }
            return acc;
        }, counts);
    }, [subjectMarks]);

    const getPerformanceChip = (result) => {
        const gradeInfo = calculateGrade(result.marksObtained, result.gradingSystem) || result;
        const remark = gradeInfo?.remark || 'Unknown';
        const color = gradeInfo?.grade ? getGradeColor(gradeInfo.grade) : '#9E9E9E';

        return (
            <Chip
                label={remark}
                size="small"
                sx={{ backgroundColor: color, color: '#fff' }}
            />
        );
    };

    const renderExamTable = (title, results) => {
        return (
            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" gutterBottom>
                    {title}
                </Typography>
                <Table>
                    <TableHead>
                        <StyledTableRow>
                            <StyledTableCell>Subject</StyledTableCell>
                            <StyledTableCell>Marks</StyledTableCell>
                            <StyledTableCell>Grade</StyledTableCell>
                            <StyledTableCell>Performance</StyledTableCell>
                        </StyledTableRow>
                    </TableHead>
                    <TableBody>
                        {results.length > 0 ? (
                            results.map((result, index) => {
                                if (!result.subName) return null;
                                const subjectLabel = typeof result.subName === 'string'
                                    ? result.subName
                                    : result.subName?.subName || 'Unknown Subject';
                                const gradeInfo = calculateGrade(result.marksObtained, result.gradingSystem) || result;
                                return (
                                    <StyledTableRow key={`${title}-${index}`}>
                                        <StyledTableCell>{subjectLabel}</StyledTableCell>
                                        <StyledTableCell>{result.marksObtained ?? 'N/A'}</StyledTableCell>
                                        <StyledTableCell>{formatGrade(gradeInfo)}</StyledTableCell>
                                        <StyledTableCell>{getPerformanceChip(result)}</StyledTableCell>
                                    </StyledTableRow>
                                );
                            })
                        ) : (
                            <StyledTableRow>
                                <StyledTableCell colSpan={4} align="center">
                                    No {title.toLowerCase()} available yet.
                                </StyledTableCell>
                            </StyledTableRow>
                        )}
                    </TableBody>
                </Table>
            </Box>
        );
    };

    const renderTableSection = () => {
        const totalFees = userDetails?.totalFees ?? currentUser?.totalFees ?? 0;
        const amountPaid = userDetails?.amountPaid ?? currentUser?.amountPaid ?? 0;
        const balance = userDetails?.balance ?? currentUser?.balance ?? 0;

        return (
            <Box id="report-card-print">
                <Typography variant="h4" align="center" gutterBottom>
                    Exam Performance
                </Typography>
                <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="subtitle2" color="textSecondary">
                            Total Fees
                        </Typography>
                        <Typography variant="h6">KES {totalFees}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" color="textSecondary">
                            Paid
                        </Typography>
                        <Typography variant="h6">KES {amountPaid}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" color="textSecondary">
                            Balance
                        </Typography>
                        <Typography variant="h6">KES {balance}</Typography>
                    </Box>
                </Box>
                {renderExamTable('CAT Results', catResults)}
                {renderExamTable('End Term Results', endTermResults)}

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                    <Typography variant="h6" sx={{ alignSelf: 'center' }}>
                        Performance summary:
                    </Typography>
                    <Chip label={`Exceeding: ${summaryCounts['Exceeding Expectation']}`} color="success" />
                    <Chip label={`Meeting: ${summaryCounts['Meeting Expectation']}`} color="info" />
                    <Chip label={`Approaching: ${summaryCounts['Approaching Expectation']}`} sx={{ backgroundColor: '#FF9800', color: '#fff' }} />
                    <Chip label={`Below: ${summaryCounts['Below Expectation']}`} color="error" />
                    <Chip label={`Unknown: ${summaryCounts.Unknown}`} />
                </Box>
            </Box>
        );
    };

    const renderChartSection = () => {
        return (
            <Box>
                <Typography variant="h4" align="center" gutterBottom>
                    Exam Marks Chart
                </Typography>
                <CustomBarChart chartData={subjectMarks} dataKey="marksObtained" />
            </Box>
        );
    };

    const renderClassDetailsSection = () => {
        return (
            <Container>
                <Typography variant="h4" align="center" gutterBottom>
                    Class Details
                </Typography>
                <Typography variant="h5" gutterBottom>
                    You are currently in Class {sclassDetails && sclassDetails.sclassName}
                </Typography>
                <Typography variant="h6" gutterBottom>
                    And these are the subjects:
                </Typography>
                {subjectsList &&
                    subjectsList.map((subject, index) => (
                        <div key={index}>
                            <Typography variant="subtitle1">
                                {subject.subName} ({subject.subCode})
                            </Typography>
                        </div>
                    ))}
            </Container>
        );
    };

    const handleSectionChange = (event, newValue) => {
        setSelectedSection(newValue);
    };

    return (
        <>
            {loading ? (
                <div>Loading...</div>
            ) : (
                <div>
                    {subjectMarks && Array.isArray(subjectMarks) && subjectMarks.length > 0
                        ?
                        (<>
                            {selectedSection === 'table' && renderTableSection()}
                            {selectedSection === 'chart' && renderChartSection()}

                            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={handlePrintReportCard}
                                    disabled={!hasPassedEligibility}
                                >
                                    Print / Download Report Card
                                </Button>
                                {!hasPassedEligibility && (
                                    <Typography color="error" sx={{ mt: 1 }}>
                                        You need at least 75% fee payment, 75% attendance, and CAT exam results to download the report card.
                                    </Typography>
                                )}
                            </Box>

                            <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
                                <BottomNavigation value={selectedSection} onChange={handleSectionChange} showLabels>
                                    <BottomNavigationAction
                                        label="Table"
                                        value="table"
                                        icon={selectedSection === 'table' ? <TableChartIcon /> : <TableChartOutlinedIcon />}
                                    />
                                    <BottomNavigationAction
                                        label="Chart"
                                        value="chart"
                                        icon={selectedSection === 'chart' ? <InsertChartIcon /> : <InsertChartOutlinedIcon />}
                                    />
                                </BottomNavigation>
                            </Paper>
                        </>)
                        :
                        (<>
                            {renderClassDetailsSection()}
                        </>)
                    }
                </div>
            )}
        </>
    );
};

export default StudentSubjects;