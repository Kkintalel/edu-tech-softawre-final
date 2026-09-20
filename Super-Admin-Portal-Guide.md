# Super Admin Portal Guide

This guide explains how the Super Admin uses the school management system to manage schools, school administrators, subscriptions, academic years, system activity, backups, and reports.

## 1. Super Admin Responsibilities

The Super Admin has system-wide access. This role can:

- Manage all schools in the system
- Register and manage school administrators
- Create and manage subscriptions
- Manage academic year templates
- View system statistics and audit logs
- Create and verify backups
- Generate system reports
- Suspend or activate schools

Use this account only for system-level administration. School Admin accounts should be used for normal school operations.

## 2. Sign In

1. Open the school portal website.
2. Select Super Admin or Admin Login.
3. Enter the Super Admin email.
4. Enter the password.
5. Click Login.
6. Open the Super Admin Dashboard.

If access is denied, confirm that the account has the `SuperAdmin` role and that the account is approved.

## 3. Super Admin Dashboard

The dashboard provides access to:

- School management
- Admin management
- Subscription management
- Academic year management
- System statistics
- System logs
- Backup management
- Reports

Use the dashboard navigation to open the section required for the task.

## 4. Manage Schools

### View schools

1. Open School Management.
2. Review the school list.
3. Search or filter the list when needed.
4. Open a school to view its details, status, and subscription information.

### Create a school

1. Open School Management.
2. Select Create School.
3. Enter the school name.
4. Enter the school email and phone number.
5. Select or enter the school administrator.
6. Save the school.

### Suspend a school

1. Open the school record.
2. Confirm that you have selected the correct school.
3. Select Suspend.
4. Confirm the action.

Suspension should be used only when authorized. Record the reason for the action according to school policy.

### Activate a school

1. Open the suspended school record.
2. Select Activate.
3. Confirm the action.
4. Check that the school status is active.

## 5. Manage School Administrators

### Register an administrator

1. Open Admin Management.
2. Select Register Admin.
3. Enter the administrator name, email, password, and school.
4. Review the details.
5. Save the account.

### View administrators

1. Open Admin Management.
2. Search or filter administrators.
3. Open an administrator to review the account and assigned school.

### Reset an administrator password

1. Open the administrator record.
2. Select Reset Password.
3. Confirm the action.
4. Give the new temporary password to the administrator securely.
5. Ask the administrator to change it after signing in.

Never send passwords through public messages or share them with unauthorized people.

## 6. Manage Subscriptions

### Subscription terms

- Available plans are Free, Basic, Professional, and Enterprise.
- Billing cycles are Monthly, Quarterly, and Annually.
- Each subscription has a price, currency, student limit, teacher limit, class limit, feature list, start date, and end date.
- Subscription statuses are Active, Expired, Suspended, and Cancelled.
- Payment statuses are Paid, Pending, Failed, and Overdue.
- Auto-renewal is available and must be confirmed by the authorized administrator.
- Supported payment methods are M-Pesa, Bank Transfer, Credit Card, and Cheque.
- Confirm the plan, price, dates, limits, and payment method with the school before saving.

### Create a subscription

1. Open Subscription Management.
2. Select Create Subscription.
3. Select the school.
4. Choose the plan name.
5. Enter the plan price and billing cycle.
6. Enter the start and end dates.
7. Set student and teacher limits if required.
8. Save the subscription.

### Update a subscription

1. Open the subscription record.
2. Select Edit or Update.
3. Change the plan, dates, limits, or status.
4. Save the changes.

### Cancel a subscription

1. Open the correct subscription.
2. Review its school and billing details.
3. Select Cancel.
4. Confirm the action.

Always confirm the correct school before changing or cancelling a subscription.

### Subscription and payment support

The Super Admin or authorized finance team handles subscription questions, payment confirmation, plan changes, renewals, and cancellation requests. When requesting support, provide the school name, subscription ID or plan, payment method, payment date, transaction reference, and the error message. Never request or share a user's password, M-Pesa PIN, card number, or other private credentials.

## 7. Manage Academic Years

1. Open Academic Year Management.
2. Select Create Academic Year.
3. Enter the year name and dates.
4. Add term or period information when required.
5. Save the academic year.
6. Review the list to confirm it was created correctly.

Academic year templates help schools keep academic periods consistent.

## 8. System Statistics and Logs

### View system statistics

1. Open System Statistics.
2. Review school, administrator, subscription, and user totals.
3. Use the information to monitor the system.

### View audit logs

1. Open System Logs or Audit Logs.
2. Search by user, action, school, or date when available.
3. Review important changes and administrative actions.
4. Report suspicious activity to the system owner.

Audit logs should not be deleted or changed without authorization.

## 9. Backups

### Create a backup

1. Open Backup Management.
2. Select Create Backup.
3. Confirm the backup scope and destination.
4. Start the backup.
5. Wait for the success message.

### Review backups

1. Open the backup list.
2. Check the date, status, and backup details.
3. Keep important backups in a secure location.

### Verify a backup

1. Select a completed backup.
2. Click Verify Backup.
3. Review the verification result.
4. Report failed verification immediately.

Create backups before major system changes or maintenance.

## 10. Generate Reports

1. Open Reports.
2. Select the report type.
3. Enter filters such as school, status, or date.
4. Generate the report.
5. Review the information.
6. Print the report or save it as PDF if required.

Use reports for system monitoring, planning, and authorized reviews.

## 11. Security Rules

- Keep Super Admin credentials private.
- Use a strong, unique password.
- Log out after every session.
- Do not share the `x-admin-id` or other authentication information.
- Do not reverse engineer, decompile, disassemble, copy, or modify the portal software without written authorization.
- Do not bypass role permissions, authentication, payment controls, security settings, or audit logs.
- Do not scan, probe, or test the system offensively without written authorization.
- Do not copy private APIs, database structures, credentials, or confidential school data.
- Report suspected security weaknesses to the authorized technical support team.
- Check the selected school before making changes.
- Give users only the access they need.
- Review audit logs regularly.
- Create backups before major changes.

## 12. Troubleshooting

### Access denied
- Confirm the account is a Super Admin account.
- Check that the account is approved.
- Confirm the request uses the correct authentication details.

### School is not found
- Check the school ID or search term.
- Confirm that the school has not been deleted.
- Refresh the school list.

### Administrator cannot be registered
- Confirm the email is not already in use.
- Check that the school exists.
- Confirm all required fields are complete.

### MongoDB or server connection error
- Confirm MongoDB is running.
- Confirm the backend server is running.
- Check the backend connection settings.
- Contact technical support if the problem continues.

### Backup fails
- Check available storage.
- Review the system error message.
- Try again after resolving the server problem.
- Report repeated failures to the system administrator.

## 13. Recommended Super Admin Workflow

Sign in → Review Dashboard → Check System Status → Manage Schools/Admins → Review Subscriptions → Check Logs → Create Backups → Generate Reports → Log out

## 14. Support Information

When reporting a problem, include:

- Your Super Admin email
- The section where the problem occurred
- The school or administrator involved
- The error message
- The date and time
- A screenshot if available

## 15. Final Checklist

Before finishing a Super Admin session:

- Confirm all changes were saved.
- Verify the correct school or user was selected.
- Check important actions in the audit log.
- Create a backup after major changes.
- Log out of the portal.

The Super Admin account controls the whole platform. Use it carefully and keep all system information confidential.
