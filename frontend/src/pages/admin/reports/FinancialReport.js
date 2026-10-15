import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addSchoolBrandingToPdf, buildPrintBrandingHtml, printBrandingStyles } from '../../../utils/printBranding';
import * as XLSX from 'xlsx';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
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

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
const initialFilters = {
    academicYear: String(new Date().getFullYear()),
    term: 'Term 2',
    classId: 'all',
    stream: 'all',
    paymentMethod: 'all',
    status: 'all',
    fromDate: `${new Date().getFullYear()}-04-01`,
    toDate: `${new Date().getFullYear()}-06-30`,
};
const money = (value) => `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
const assessedMoney = (value) => value === null || value === undefined ? 'Not recorded' : money(value);
const dateLabel = (value) => value ? new Date(value).toLocaleDateString() : '-';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const formatInputDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const getTermLabel = (term) => term?.termName || (term?.termNumber ? `Term ${term.termNumber}` : '');
const getTermForCalendar = (calendar, label) => calendar?.terms?.find((term) => getTermLabel(term).toLowerCase() === (label || '').toLowerCase());
const getCalendarDateRange = (calendar, termLabel) => {
    const selectedTerm = getTermForCalendar(calendar, termLabel);
    return {
        fromDate: formatInputDate(selectedTerm?.startDate || calendar?.startDate),
        toDate: formatInputDate(selectedTerm?.endDate || calendar?.endDate),
    };
};

const FinancialReport = () => {
    const { currentUser } = useSelector((state) => state.user);
    const [filters, setFilters] = useState(initialFilters);
    const [report, setReport] = useState(null);
    const [classes, setClasses] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [calendarLoaded, setCalendarLoaded] = useState(false);
    const [error, setError] = useState('');
    const [statementStudent, setStatementStudent] = useState(null);
    const [remindingStudentId, setRemindingStudentId] = useState('');
    const [reminderFeedback, setReminderFeedback] = useState(null);

    const schoolId = useMemo(() => {
        const value = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId || currentUser?._id || currentUser?.id;
        return value && typeof value === 'object' ? value._id || value.id || '' : value || '';
    }, [currentUser]);
    const adminId = currentUser?._id || currentUser?.id;
    const fallbackYears = Array.from({ length: 8 }, (_, index) => String(new Date().getFullYear() - index));
    const yearOptions = academicYears.length ? academicYears.map((year) => year.yearName) : fallbackYears;
    const selectedCalendar = academicYears.find((year) => year.yearName === filters.academicYear);
    const termOptions = selectedCalendar?.terms?.length
        ? selectedCalendar.terms.map(getTermLabel).filter(Boolean)
        : ['Term 1', 'Term 2', 'Term 3'];
    const selectedTerm = getTermForCalendar(selectedCalendar, filters.term);
    const streamOptions = report?.availableStreams || [];

    useEffect(() => {
        if (!schoolId || !adminId) {
            setLoadingClasses(false);
            setCalendarLoaded(true);
            return;
        }

        const loadReportOptions = async () => {
            const [classesResult, yearsResult] = await Promise.allSettled([
                axios.get(`${API_BASE_URL}/SclassList/${schoolId}`, { headers: { 'x-admin-id': adminId } }),
                axios.get(`${API_BASE_URL}/SuperAdmin/AcademicYears`, { headers: { 'x-admin-id': adminId } }),
            ]);

            if (classesResult.status === 'fulfilled') {
                const classData = classesResult.value.data;
                setClasses(Array.isArray(classData) ? classData : []);
            } else {
                setError(classesResult.reason.response?.data?.message || 'Could not load classes');
            }

            if (yearsResult.status === 'fulfilled') {
                const years = yearsResult.value.data?.academicYears || [];
                setAcademicYears(years);
                const preferredYear = years.find((year) => year.yearName === initialFilters.academicYear)
                    || years.find((year) => year.isActive)
                    || years[0];
                if (preferredYear) {
                    const preferredTerm = preferredYear.terms?.find((term) => term.termNumber === 2 || getTermLabel(term).toLowerCase() === 'term 2')
                        || preferredYear.terms?.[0];
                    const termLabel = getTermLabel(preferredTerm) || initialFilters.term;
                    const dateRange = getCalendarDateRange(preferredYear, termLabel);
                    setFilters((current) => ({
                        ...current,
                        academicYear: preferredYear.yearName,
                        term: termLabel,
                        fromDate: dateRange.fromDate || current.fromDate,
                        toDate: dateRange.toDate || current.toDate,
                    }));
                }
            }

            setLoadingClasses(false);
            setCalendarLoaded(true);
        };

        loadReportOptions();
    }, [schoolId, adminId]);

    const generateReport = async (nextFilters = filters) => {
        if (!schoolId || !adminId) {
            setError('School account is not available. Please sign in again.');
            return;
        }
        if (!nextFilters.term || !nextFilters.academicYear || !nextFilters.fromDate || !nextFilters.toDate) {
            setError('Academic year, term, from date, and to date are required.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const { data } = await axios.get(`${API_BASE_URL}/Student/PaymentStats/${schoolId}`, {
                headers: { 'x-admin-id': adminId },
                params: nextFilters,
            });
            setReport(data);
            setFilters(nextFilters);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Unable to generate financial report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (schoolId && adminId && calendarLoaded) generateReport(filters);
    }, [schoolId, adminId, calendarLoaded]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        if (name === 'academicYear') {
            const nextCalendar = academicYears.find((year) => year.yearName === value);
            const nextTerm = nextCalendar?.terms?.find((term) => term.termNumber === 2 || getTermLabel(term).toLowerCase() === 'term 2')
                || nextCalendar?.terms?.[0];
            const nextTermLabel = getTermLabel(nextTerm) || 'Term 2';
            const dateRange = getCalendarDateRange(nextCalendar, nextTermLabel);
            setFilters((current) => ({
                ...current,
                academicYear: value,
                term: nextTermLabel,
                fromDate: dateRange.fromDate || current.fromDate,
                toDate: dateRange.toDate || current.toDate,
            }));
            return;
        }
        if (name === 'term') {
            const dateRange = getCalendarDateRange(selectedCalendar, value);
            setFilters((current) => ({
                ...current,
                term: value,
                fromDate: dateRange.fromDate || current.fromDate,
                toDate: dateRange.toDate || current.toDate,
            }));
            return;
        }
        setFilters((current) => ({ ...current, [name]: value, ...(name === 'classId' ? { stream: 'all' } : {}) }));
    };

    const resetFilters = () => {
        const dateRange = getCalendarDateRange(selectedCalendar, filters.term);
        const defaultFilters = {
            ...initialFilters,
            academicYear: filters.academicYear,
            term: filters.term,
            fromDate: dateRange.fromDate || initialFilters.fromDate,
            toDate: dateRange.toDate || initialFilters.toDate,
        };
        setFilters(defaultFilters);
        generateReport(defaultFilters);
    };

    const sendFeeReminder = async (student) => {
        setReminderFeedback(null);
        setRemindingStudentId(student.id);
        try {
            const { data } = await axios.post(
                `${API_BASE_URL}/Student/SendFeeReminder/${student.id}`,
                {},
                { headers: { 'x-admin-id': adminId } }
            );
            setReminderFeedback({
                severity: data.result?.demo ? 'info' : 'success',
                message: data.result?.demo
                    ? `Reminder for ${data.reminder.studentName} (${data.reminder.admissionNo}), balance ${money(data.reminder.balance)}, was generated in demo mode. Configure school SMS settings to deliver it.`
                    : `Fee reminder sent for ${data.reminder.studentName} (${data.reminder.admissionNo}); current balance ${money(data.reminder.balance)}.`,
            });
        } catch (requestError) {
            setReminderFeedback({
                severity: 'error',
                message: requestError.response?.data?.message || 'Could not send fee reminder.',
            });
        } finally {
            setRemindingStudentId('');
        }
    };

    const reportRows = report?.studentDetails || [];
    const paymentMethodRows = Object.entries(report?.paymentByMethod || {})
        .map(([method, amount]) => ({ method, amount: Number(amount) || 0 }))
        .sort((left, right) => right.amount - left.amount);
    const classFeeRows = [...(report?.classSummary || [])]
        .sort((left, right) => Number(right.expectedFees || 0) - Number(left.expectedFees || 0));
    const totalBilled = Number(report?.totalFeesExpected) || 0;
    const totalCollected = Number(report?.totalFeesCollected) || 0;
    const totalOutstanding = Number(report?.totalOutstanding) || 0;
    const collectionRate = totalBilled ? (totalCollected / totalBilled) * 100 : 0;
    const outstandingRate = totalBilled ? (totalOutstanding / totalBilled) * 100 : 0;
    const largestMethodCollection = Math.max(0, ...paymentMethodRows.map(({ amount }) => amount));

    const paymentMethodLabel = (method) => ({
        'm-pesa': 'M-Pesa',
        bank: 'Bank',
        cash: 'Cash',
        card: 'Card',
        cheque: 'Cheque',
        paybill: 'Paybill',
    }[method] || method);

    const handlePrint = () => {
        if (!report) return;
        const rows = reportRows.map((student) => `<tr>
            <td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.admissionNo)}</td>
            <td>${escapeHtml(student.className)}</td><td>${escapeHtml(student.stream || '-')}</td>
            <td>${assessedMoney(student.expectedFees)}</td><td>${money(student.paid)}</td><td>${assessedMoney(student.balance)}</td><td>${escapeHtml(student.status)}</td>
        </tr>`).join('');
        const summaryTable = (title, entries, label) => `<h2>${title}</h2><table><thead><tr><th>${label}</th><th>Students</th><th>Fee Assessments Missing</th><th>Expected Fees</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${entries.map((entry) => `<tr><td>${escapeHtml(entry.name)}</td><td>${entry.students}</td><td>${entry.feeAssessmentMissing || 0}</td><td>${money(entry.expectedFees)}</td><td>${money(entry.paid)}</td><td>${money(entry.balance)}</td></tr>`).join('')}</tbody></table>`;
        const paymentMethodTable = `<h2>Collections by Payment Method</h2><table><thead><tr><th>Method</th><th>Collected</th></tr></thead><tbody>${paymentMethodRows.map(({ method, amount }) => `<tr><td>${escapeHtml(method)}</td><td>${money(amount)}</td></tr>`).join('')}</tbody></table>`;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`<html><head><title>Financial Report</title><style>
            body{font:12px Arial,sans-serif;padding:24px;color:#20252b}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #bbb;padding:7px;text-align:left}th{background:#eef2f5}.summary{display:flex;gap:20px;flex-wrap:wrap}
            ${printBrandingStyles}
        </style></head><body>${buildPrintBrandingHtml(currentUser)}<h1>Financial Report</h1><p>Academic Year ${escapeHtml(filters.academicYear)} · ${escapeHtml(filters.term)} · ${escapeHtml(filters.fromDate)} to ${escapeHtml(filters.toDate)}</p><div class="summary"><span>Students: ${report.totalStudents}</span><span>Total Fees Billed: ${money(report.totalFeesExpected)}</span><span>Total Collected: ${money(report.totalFeesCollected)}</span><span>Outstanding: ${money(report.totalOutstanding)}</span><span>Collection Rate: ${Number(report.collectionRate || 0).toFixed(2)}%</span><span>Missing Fee Assessments: ${report.studentsMissingFeeAssessment || 0}</span></div><table><thead><tr><th>Student</th><th>Admission No.</th><th>Class</th><th>Stream</th><th>Expected Fees</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>${summaryTable('Class Summary', report.classSummary || [], 'Class')}${summaryTable('Stream Summary', report.streamSummary || [], 'Stream')}${paymentMethodTable}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    const exportPdf = async () => {
        if (!report) return;
        const document = new jsPDF({ orientation: 'landscape' });
        let nextY = await addSchoolBrandingToPdf(document, currentUser);
        document.setFontSize(16);
        document.text('Financial Report', 14, nextY);
        document.setFontSize(10);
        document.text(`Academic Year ${filters.academicYear} | ${filters.term} | ${filters.fromDate} to ${filters.toDate}`, 14, nextY + 6);
        nextY += 14;
        const addPdfTable = (title, head, body) => {
            if (nextY > document.internal.pageSize.getHeight() - 35) {
                document.addPage();
                nextY = 16;
            }
            document.setFontSize(11);
            document.text(title, 14, nextY);
            autoTable(document, { startY: nextY + 3, head: [head], body, styles: { fontSize: 8 } });
            nextY = (document.lastAutoTable?.finalY || nextY + 10) + 8;
        };
        addPdfTable('Class Summary', ['Class', 'Students', 'Fee Assessments Missing', 'Expected Fees', 'Paid', 'Balance'], (report.classSummary || []).map((entry) => [entry.name, entry.students, entry.feeAssessmentMissing || 0, money(entry.expectedFees), money(entry.paid), money(entry.balance)]));
        addPdfTable('Stream Summary', ['Stream', 'Students', 'Fee Assessments Missing', 'Expected Fees', 'Paid', 'Balance'], (report.streamSummary || []).map((entry) => [entry.name, entry.students, entry.feeAssessmentMissing || 0, money(entry.expectedFees), money(entry.paid), money(entry.balance)]));
        addPdfTable('Collections by Payment Method', ['Payment Method', 'Collected'], paymentMethodRows.map(({ method, amount }) => [method, money(amount)]));
        if (nextY > document.internal.pageSize.getHeight() - 20) {
            document.addPage();
            nextY = 16;
        }
        document.setFontSize(9);
        document.text(`Students: ${report.totalStudents} | Fees assessed: ${money(report.totalFeesExpected)} | Collected: ${money(report.totalFeesCollected)} | Outstanding: ${money(report.totalOutstanding)} | Collection: ${Number(report.collectionRate || 0).toFixed(2)}% | Missing fee assessments: ${report.studentsMissingFeeAssessment || 0}`, 14, nextY);
        addPdfTable('Student Fee Details', ['Student', 'Admission No.', 'Class', 'Stream', 'Expected Fees', 'Paid', 'Balance', 'Status'], reportRows.map((student) => [student.name, student.admissionNo, student.className, student.stream || '-', assessedMoney(student.expectedFees), money(student.paid), assessedMoney(student.balance), student.status]));
        document.save(`financial-report-${filters.academicYear}-${filters.term.replace(/\s+/g, '-')}.pdf`);
    };

    const exportExcel = () => {
        if (!report) return;
        const workbook = XLSX.utils.book_new();
        const summary = [
            ['School', currentUser?.settings?.branding?.schoolName || currentUser?.school?.schoolName || currentUser?.schoolName || 'School'],
            ['Physical Address', currentUser?.settings?.schoolProfile?.physicalAddress || currentUser?.settings?.schoolProfile?.address || ''],
            ['Postal Address', currentUser?.settings?.schoolProfile?.postalAddress || ''],
            ['Phone', currentUser?.settings?.schoolProfile?.phone || ''],
            ['Email', currentUser?.settings?.schoolProfile?.email || ''],
            ['Website', currentUser?.settings?.schoolProfile?.website || ''],
            ['Financial Report'],
            ['Academic Year', filters.academicYear],
            ['Term', filters.term],
            ['From Date', filters.fromDate],
            ['To Date', filters.toDate],
            ['Students', report.totalStudents],
            ['Total Fees Billed', report.totalFeesExpected],
            ['Total Collected', report.totalFeesCollected],
            ['Outstanding Balance', report.totalOutstanding],
            ['Collection Rate (%)', Number(report.collectionRate || 0).toFixed(2)],
            ['Missing Fee Assessments', report.studentsMissingFeeAssessment || 0],
        ];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), 'Summary');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportRows.map((student) => ({
            Student: student.name,
            'Admission No.': student.admissionNo,
            Class: student.className,
            Stream: student.stream,
            'Expected Fees': student.expectedFees ?? 'Not recorded',
            Paid: student.paid,
            Balance: student.balance ?? 'Not recorded',
            Status: student.status,
        }))), 'Students');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.classSummary || []), 'Class Summary');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.streamSummary || []), 'Stream Summary');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(paymentMethodRows), 'Payment Methods');
        XLSX.writeFile(workbook, `financial-report-${filters.academicYear}-${filters.term.replace(/\s+/g, '-')}.xlsx`);
    };

    const printStatement = () => {
        if (!statementStudent) return;
        const payments = (statementStudent.paymentHistory || []).map((payment) => `<tr><td>${dateLabel(payment.date)}</td><td>${escapeHtml(payment.paymentMethod)}</td><td>${escapeHtml(payment.receiptNumber || payment.transactionId || '-')}</td><td>${escapeHtml(payment.status)}</td><td>${money(payment.amount)}</td></tr>`).join('');
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`<html><head><title>Student Fee Statement</title><style>body{font:13px Arial;padding:24px}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #bbb;padding:8px;text-align:left}${printBrandingStyles}</style></head><body>${buildPrintBrandingHtml(currentUser)}<h1>Student Fee Statement</h1><h2>${escapeHtml(statementStudent.name)}</h2><p>Admission No.: ${escapeHtml(statementStudent.admissionNo)} | Class: ${escapeHtml(statementStudent.className)} | Stream: ${escapeHtml(statementStudent.stream || '-')}</p><p>Expected: ${money(statementStudent.expectedFees)} | Paid: ${money(statementStudent.paid)} | Balance: ${money(statementStudent.balance)} | Status: ${escapeHtml(statementStudent.status)}</p><p>Period: ${escapeHtml(filters.fromDate)} to ${escapeHtml(filters.toDate)}</p><table><thead><tr><th>Date</th><th>Method</th><th>Receipt / Reference</th><th>Status</th><th>Amount</th></tr></thead><tbody>${payments || '<tr><td colspan="5">No payments in this report period</td></tr>'}</tbody></table></body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    if (loadingClasses && !report) {
        return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, mx: 'auto' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Financial Report</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {reminderFeedback && <Alert severity={reminderFeedback.severity} sx={{ mb: 2 }} onClose={() => setReminderFeedback(null)}>{reminderFeedback.message}</Alert>}

            <Paper component="form" onSubmit={(event) => { event.preventDefault(); generateReport(); }} sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 2 }}>
                    <TextField select label="Academic Year" name="academicYear" value={filters.academicYear} onChange={handleChange} required>
                        {yearOptions.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                    </TextField>
                    <TextField select label="Term" name="term" value={filters.term} onChange={handleChange} required>
                        {termOptions.map((term) => <MenuItem key={term} value={term}>{term}</MenuItem>)}
                    </TextField>
                    <TextField select label="Class" name="classId" value={filters.classId} onChange={handleChange}>
                        <MenuItem value="all">All Classes</MenuItem>
                        {classes.map((classItem) => <MenuItem key={classItem._id} value={classItem._id}>{classItem.sclassName}</MenuItem>)}
                    </TextField>
                    <TextField select label="Stream" name="stream" value={filters.stream} onChange={handleChange}>
                        <MenuItem value="all">All Streams</MenuItem>
                        {streamOptions.map((stream) => <MenuItem key={stream} value={stream}>{stream}</MenuItem>)}
                    </TextField>
                    <TextField select label="Payment Method" name="paymentMethod" value={filters.paymentMethod} onChange={handleChange}>
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="m-pesa">M-Pesa</MenuItem>
                        <MenuItem value="bank">Bank</MenuItem>
                        <MenuItem value="cash">Cash</MenuItem>
                        <MenuItem value="card">Card</MenuItem>
                        <MenuItem value="cheque">Cheque</MenuItem>
                        <MenuItem value="paybill">Paybill</MenuItem>
                    </TextField>
                    <TextField select label="Status" name="status" value={filters.status} onChange={handleChange}>
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="paid">Paid</MenuItem>
                        <MenuItem value="partial">Partial</MenuItem>
                        <MenuItem value="unpaid">Unpaid</MenuItem>
                        <MenuItem value="unverified">Unverified</MenuItem>
                    </TextField>
                    <TextField label="From Date" name="fromDate" type="date" value={filters.fromDate} onChange={handleChange} required inputProps={{ min: formatInputDate(selectedTerm?.startDate || selectedCalendar?.startDate), max: formatInputDate(selectedTerm?.endDate || selectedCalendar?.endDate) }} InputLabelProps={{ shrink: true }} />
                    <TextField label="To Date" name="toDate" type="date" value={filters.toDate} onChange={handleChange} required inputProps={{ min: formatInputDate(selectedTerm?.startDate || selectedCalendar?.startDate), max: formatInputDate(selectedTerm?.endDate || selectedCalendar?.endDate) }} InputLabelProps={{ shrink: true }} />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                    <Button type="submit" variant="contained" disabled={loading}>{loading ? <CircularProgress size={20} color="inherit" /> : 'View Report'}</Button>
                    <Button type="button" onClick={resetFilters} disabled={loading}>Reset</Button>
                    <Button type="button" onClick={handlePrint} disabled={!report}>Print</Button>
                    <Button type="button" onClick={exportPdf} disabled={!report}>Export PDF</Button>
                    <Button type="button" onClick={exportExcel} disabled={!report}>Export Excel</Button>
                </Box>
            </Paper>

            {report && (
                <>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>Financial Analytics</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5, mt: 0.5 }}>
                            {[
                                { label: 'Total Billed', amount: totalBilled, detail: `${report.totalStudents || 0} students`, accent: '#356b5b' },
                                { label: 'Collected', amount: totalCollected, detail: `${collectionRate.toFixed(1)}% of billed`, accent: '#287a70' },
                                { label: 'Outstanding', amount: totalOutstanding, detail: `${outstandingRate.toFixed(1)}% of billed`, accent: '#a65c37' },
                            ].map(({ label, amount, detail, accent }) => (
                                <Paper key={label} sx={{ p: 2, borderTop: `3px solid ${accent}` }}>
                                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700, my: 0.5 }}>{money(amount)}</Typography>
                                    <Typography variant="body2" color="text.secondary">{detail}</Typography>
                                </Paper>
                            ))}
                        </Box>
                    </Box>

                    {!!report.studentsMissingFeeAssessment && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {report.studentsMissingFeeAssessment} student(s) do not have a recorded fee assessment for {filters.academicYear}, {filters.term}. Historical billed totals exclude them; current fees are not substituted.
                        </Alert>
                    )}

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 1.5, mb: 2 }}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>Payment Methods</Typography>
                            {paymentMethodRows.length ? paymentMethodRows.map(({ method, amount }) => (
                                <Box key={method} sx={{ mb: 1.75 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                                        <Typography>{paymentMethodLabel(method)}</Typography>
                                        <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{money(amount)}</Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={largestMethodCollection ? (amount / largestMethodCollection) * 100 : 0}
                                        aria-label={`${paymentMethodLabel(method)} collections`}
                                        sx={{ height: 8, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { borderRadius: 1 } }}
                                    />
                                </Box>
                            )) : <Typography color="text.secondary">No collections in this period</Typography>}
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>Fees by Class</Typography>
                            {classFeeRows.length ? classFeeRows.map((entry, index) => (
                                <Box key={entry.name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1, borderBottom: index < classFeeRows.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                                    <Typography>{entry.name}</Typography>
                                    <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{money(entry.expectedFees)}</Typography>
                                </Box>
                            )) : <Typography color="text.secondary">No class fee data for this period</Typography>}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                                {filters.academicYear} · {filters.term} · {dateLabel(filters.fromDate)} to {dateLabel(filters.toDate)}
                            </Typography>
                        </Paper>
                    </Box>

                    <Paper sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ p: 2, pb: 0 }}>Student Fee Details</Typography>
                        <TableContainer sx={{ maxHeight: 560 }}>
                            <Table stickyHeader size="small">
                                <TableHead><TableRow>
                                    <TableCell>Student</TableCell><TableCell>Admission No.</TableCell><TableCell>Class</TableCell><TableCell>Stream</TableCell>
                                    <TableCell align="right">Expected Fees</TableCell><TableCell align="right">Paid</TableCell><TableCell align="right">Balance</TableCell><TableCell>Status</TableCell><TableCell>Actions</TableCell>
                                </TableRow></TableHead>
                                <TableBody>
                                    {reportRows.map((student) => (
                                        <TableRow key={student.id} hover>
                                            <TableCell>{student.name}</TableCell><TableCell>{student.admissionNo}</TableCell><TableCell>{student.className || '-'}</TableCell><TableCell>{student.stream || '-'}</TableCell>
                                            <TableCell align="right">{assessedMoney(student.expectedFees)}</TableCell><TableCell align="right">{money(student.paid)}</TableCell><TableCell align="right">{assessedMoney(student.balance)}</TableCell><TableCell>{student.status}</TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    <Button size="small" onClick={() => setStatementStudent(student)}>Statement</Button>
                                                    <Button size="small" onClick={() => sendFeeReminder(student)} disabled={Boolean(remindingStudentId) || student.status === 'Paid'}>
                                                        {remindingStudentId === student.id ? 'Sending...' : 'Send Fee Reminder'}
                                                    </Button>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {!reportRows.length && <TableRow><TableCell colSpan={9} align="center">No students match these filters.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 2 }}>
                        {[
                            { title: 'Class Summary', rows: report.classSummary || [] },
                            { title: 'Stream Summary', rows: report.streamSummary || [] },
                        ].map(({ title, rows }) => (
                            <Paper key={title}>
                                <Typography variant="h6" sx={{ p: 2, pb: 0 }}>{title}</Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead><TableRow><TableCell>{title.startsWith('Class') ? 'Class' : 'Stream'}</TableCell><TableCell align="right">Students</TableCell><TableCell align="right">Expected</TableCell><TableCell align="right">Paid</TableCell><TableCell align="right">Balance</TableCell></TableRow></TableHead>
                                        <TableBody>
                                            {rows.map((entry) => <TableRow key={entry.name}><TableCell>{entry.name}</TableCell><TableCell align="right">{entry.students}</TableCell><TableCell align="right">{money(entry.expectedFees)}</TableCell><TableCell align="right">{money(entry.paid)}</TableCell><TableCell align="right">{money(entry.balance)}</TableCell></TableRow>)}
                                            {!rows.length && <TableRow><TableCell colSpan={5} align="center">No summary data</TableCell></TableRow>}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        ))}
                    </Box>
                </>
            )}

            <Dialog open={Boolean(statementStudent)} onClose={() => setStatementStudent(null)} maxWidth="md" fullWidth>
                <DialogTitle>Student Fee Statement</DialogTitle>
                <DialogContent>
                    {statementStudent && <>
                        <Typography variant="h6">{statementStudent.name}</Typography>
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                            {statementStudent.admissionNo} · {statementStudent.className || 'No class'} · {statementStudent.stream || 'No stream'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 2 }}>
                            <Typography>Expected: {assessedMoney(statementStudent.expectedFees)}</Typography><Typography>Paid: {money(statementStudent.paid)}</Typography>
                            <Typography>Balance: {assessedMoney(statementStudent.balance)}</Typography><Typography>Status: {statementStudent.status}</Typography>
                        </Box>
                        <TableContainer>
                            <Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Method</TableCell><TableCell>Receipt / Reference</TableCell><TableCell>Status</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                                <TableBody>
                                    {(statementStudent.paymentHistory || []).map((payment, index) => <TableRow key={`${payment.receiptNumber || payment.transactionId || 'payment'}-${index}`}>
                                        <TableCell>{dateLabel(payment.date)}</TableCell><TableCell>{payment.paymentMethod}</TableCell><TableCell>{payment.receiptNumber || payment.transactionId || '-'}</TableCell><TableCell>{payment.status}</TableCell><TableCell align="right">{money(payment.amount)}</TableCell>
                                    </TableRow>)}
                                    {!(statementStudent.paymentHistory || []).length && <TableRow><TableCell colSpan={5} align="center">No payments in the selected report period.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setStatementStudent(null)}>Close</Button>
                    <Button variant="contained" onClick={printStatement}>Print Statement</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default FinancialReport;
