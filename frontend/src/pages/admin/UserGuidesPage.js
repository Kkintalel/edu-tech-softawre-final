import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Button, Grid, Paper, Stack, Typography } from '@mui/material';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { buildPrintBrandingHtml, printBrandingStyles } from '../../utils/printBranding';

const guides = [
    {
        key: 'admin',
        title: 'Admin Guide',
        audience: 'School administrators',
        sections: [
            ['Log in', ['Open the school portal, choose Admin Login, and enter your email and password.']],
            ['What admins can do', ['Manage students, teachers, classes, subjects, notices, communication, fees, reports, and school settings.']],
            ['Manage records', ['Open the dashboard, choose Students or Teachers, then add, edit, view, or manage records as authorized.']],
            ['View and print reports', ['Open Reports, choose the required academic or financial report, review the data, and select Print.']],
            ['Important notes', ['Keep administrator credentials confidential, update only authorized records, and log out after completing your work.']],
        ],
    },
    {
        key: 'teacher',
        title: 'Teacher Guide',
        audience: 'Teachers',
        sections: [
            ['Log in', ['Choose Teacher Login and enter your teacher email or username and password.']],
            ['Daily work', ['View assigned classes, students, assignments, timetable, attendance, marks, and communications.']],
            ['Update student records', ['Open a class, select a student, review marks or attendance, and save accurate updates.']],
            ['Print report cards', ['Open a student academic report and select Print Report Card. Save as PDF or print on A4 paper.']],
            ['Important notes', ['Protect your login details, verify entries before saving, and log out when finished.']],
        ],
    },
    {
        key: 'parent',
        title: 'Parent Guide',
        audience: 'Parents and guardians',
        sections: [
            ['Log in', ['Choose Parent Login and enter your email, student admission number, and password.']],
            ['Child dashboard', ['Select a child to view fees, payment history, timetable, and academic progress.']],
            ['Progress reports', ['Open View Progress Report to review marks, grades, remarks, and comments.']],
            ['Print or save', ['Select Print on a report or payment history page, then choose a printer or Save as PDF.']],
            ['Fees and timetable', ['Use Pay School Fees to submit a payment and View Timetable to see the child schedule.']],
        ],
    },
    {
        key: 'hr',
        title: 'HR Guide',
        audience: 'Human resources staff',
        sections: [
            ['Log in', ['Choose HR Login and enter your authorized HR credentials.']],
            ['Manage staff', ['Use the HR dashboard to review employee information, leave, payroll, and staff-related records.']],
            ['Documents', ['Open document management to review employee documents and confirm document details before processing.']],
            ['Communication', ['Use available HR communication tools to send clear, authorized updates to employees and management.']],
            ['Important notes', ['Keep employee information confidential and follow school approval procedures for HR changes.']],
        ],
    },
    {
        key: 'accountant',
        title: 'Accountant Guide',
        audience: 'Accountants and finance staff',
        sections: [
            ['Log in', ['Choose Accountant Login and enter your authorized finance credentials.']],
            ['Fees and payments', ['Review payment records, balances, payment methods, and transaction references from the finance dashboard.']],
            ['Receipts', ['Open Receipts, choose a payment, and select Generate Receipt to print or save the branded receipt.']],
            ['Reports', ['Review financial summaries and use the available print controls for school records.']],
            ['Important notes', ['Verify amounts and references carefully, protect financial information, and follow approval controls.']],
        ],
    },
    {
        key: 'student',
        title: 'Student Guide',
        audience: 'Students',
        sections: [
            ['Log in', ['Choose Student Login and enter your student credentials.']],
            ['Use the portal', ['View your dashboard, assignments, learning materials, timetable, attendance, subjects, and academic results.']],
            ['Fees', ['Open your profile to review the fee structure, amount paid, and balance.']],
            ['Print reports', ['Open Subjects or your academic report card and select Print or Download Report Card.']],
            ['Important notes', ['Keep your password private, submit work on time, and log out after using the portal.']],
        ],
    },
];

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const guideHtml = (guide) => `
    <article class="guide">
        <h2>${escapeHtml(guide.title)}</h2>
        <p class="audience">For ${escapeHtml(guide.audience)}</p>
        ${guide.sections.map(([heading, items]) => `
            <section>
                <h3>${escapeHtml(heading)}</h3>
                <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </section>
        `).join('')}
    </article>
`;

const UserGuidesPage = () => {
    const { currentUser } = useSelector((state) => state.user);

    const printGuides = (selectedGuide = null) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const selectedGuides = selectedGuide ? [selectedGuide] : guides;
        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <title>${selectedGuide ? selectedGuide.title : 'School User Guides'}</title>
                    <style>
                        @page { size: A4; margin: 16mm; }
                        body { font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5; }
                        ${printBrandingStyles}
                        .guide { page-break-after: always; }
                        .guide:last-child { page-break-after: auto; }
                        .guide h2 { margin: 0 0 4px; font-size: 24px; }
                        .audience { color: #4b5563; margin: 0 0 22px; }
                        section { margin: 18px 0; }
                        section h3 { font-size: 16px; margin: 0 0 6px; }
                        ul { margin: 0; padding-left: 22px; }
                        li { margin: 5px 0; }
                    </style>
                </head>
                <body>
                    ${selectedGuides.map((guide) => `${buildPrintBrandingHtml(currentUser)}${guideHtml(guide)}`).join('')}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>User Guides</Typography>
                    <Typography color="text.secondary">Print branded guides for every school portal role.</Typography>
                </Box>
                <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => printGuides()}>
                    Print All Guides
                </Button>
            </Stack>
            <Grid container spacing={2}>
                {guides.map((guide) => (
                    <Grid item xs={12} sm={6} md={4} key={guide.key}>
                        <Paper sx={{ p: 2.5, height: '100%' }}>
                            <Stack spacing={2} height="100%">
                                <MenuBookOutlinedIcon color="primary" />
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="h6">{guide.title}</Typography>
                                    <Typography color="text.secondary">{guide.audience}</Typography>
                                </Box>
                                <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printGuides(guide)}>
                                    Print Guide
                                </Button>
                            </Stack>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default UserGuidesPage;