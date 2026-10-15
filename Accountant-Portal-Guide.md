# Accountant Portal Guide

## Welcome
This guide explains the Accountant / Finance Officer portal and the actions available in each section. Menu items appear across the top of the Accountant portal. The data shown is for the school assigned to your account.

---

## 1. Log in
1. Open the school website and choose the staff login option.
2. Select **Accountant Login** (or open `/Accountantlogin`).
3. Enter the email address and password registered for your Accountant account.
4. Complete any verification or legal-acceptance steps shown.
5. After login, the portal opens at **Home**.

If you cannot sign in, use **Forgot password** on the Accountant login page or ask an administrator to check that your account is active and assigned to the correct school.

---

## 2. Portal navigation
The navigation provides these sections:

- **Home**: overview and shortcuts to the main finance workflows.
- **Students**: student fee balances, fee payments, fee updates, and payment verification.
- **Payments**: school collection totals, reconciliation review, bank settings, and statement import.
- **Finance**: class fee settings, cheque register, and supplier payments.
- **Finance Report**: fee and cheque summaries, ledger statements, budget status, and audit notes.
- **Pledges & Orders**: fee pledges, purchase/service orders, and payment vouchers for approval.
- **Budget**: financial year setup, budget drafts, allocations, and budget-versus-actual status.
- **Petty Cash**: cash funding, expenses, cash-count reconciliation, and movement history.
- **Journals**: prepare and post balanced manual journal entries.
- **Vouchers**: prepare, submit, review, print, and audit accounting vouchers.
- **Invoices**: review student fees, paid amounts, and balances.
- **Receipts**: find recorded fee payments and generate printable receipts.
- **Payroll**: prepare payroll, verify employee account details, and submit salary payments.
- **Communication**: exchange messages with HR and other finance staff.
- **Reports**: view school fee collection totals and export a CSV.
- **Download Finance Data**: download the accountant data export as a CSV file.
- **Global Search**: search school records available to your role.
- **Logout**: end your portal session.

---

## 3. Home
Use Home as the starting point. It directs you to student fee balances, payment reconciliation, and financial reports. Use the navigation buttons to open the detailed tools.

## 4. Students and school fees
The Students page lists student name, admission number, class, total fees, paid amount, balance, and payment status.

### Find a student or record
1. Choose the search type: **Student**, **Teacher**, **Assignment**, or **Cheque number**.
2. Enter a name, admission/roll number, email, assignment title, or cheque number as applicable.
3. Select **Search**. Student results show fee balance and may show pending payments; cheque results show the student, amount, receipt, and status.
4. Use **View** in the student list to review the student's fee and contact details.

### Record a fee payment
1. Select **Pay Fee** beside a student or on a student search result.
2. Enter a positive payment amount and choose **Cash**, **Lipa Na Mpesa**, **Bank Transfer**, or **Cheque**.
3. Enter the M-Pesa/bank transaction reference for electronic payments, or the cheque number for a cheque.
4. Add an optional note and select **Submit Payment**.
5. Check the confirmation for the receipt number and updated balance. The payment will then be available in payment history and Receipts.

### Update a student's total fees
1. Select **Update Fee** beside the student.
2. Enter the new total fee amount and select **Save Fee**.
3. Confirm the updated student record and balance.

Only update fees when authorized; check the amount with school policy before saving.

### Verify a pending payment
1. Search for the student.
2. Review the pending amount, method, and reference displayed under the result.
3. Compare it with the bank, M-Pesa, or cash evidence.
4. Select **Verify Payment** only after confirming that the payment is genuine.

---

## 5. Payments and reconciliation
The Summary shows student count, total collected, total outstanding, school account balance, and (when configured) the school's bank name and account number. **Refresh Settings** reloads the bank settings and account balance.

### Apply system reconciliation
1. Review the totals and any duplicate transaction or student mismatch rows.
2. Select **Apply Reconciliation** to run the system reconciliation.
3. Review the refreshed summary and student reconciliation table. Investigate differences or pending payments before treating the books as reconciled.

### Import a bank statement
1. Bank reconciliation must first be enabled in School Settings by an authorized administrator.
2. Select **Upload CSV** and choose a bank statement CSV file.
3. Select **Preview Matches** to see a preview of up to the first ten imported rows. Positive amounts are labeled **Pending Match** and negative amounts **Needs Review**.

The CSV feature currently previews rows; it does not complete matching or post imported transactions. Do not treat the preview as a completed bank reconciliation. The Duplicate Transactions section identifies repeated transaction IDs; Student Reconciliation Review shows student payment mismatches and pending payments.

---

## 6. Finance Management

### School finance settings and class fees
1. Enter or update the school's currency, PayBill code, and payment terms.
2. Enter the fee amount for each listed class.
3. Select **Save Finance Settings** to save the settings. The page notes that saving class fees updates all students in that class; confirm the amounts before saving.

### Cheque register
1. Select **Incoming** or **Outgoing** and complete cheque number, date, bank, amount, account, payer/payee, purpose, and any reference or related student/staff/supplier.
2. Choose a status: Pending, Deposited, Cleared, Bounced, Cancelled, or Returned. Add a clearance date and note when relevant.
3. Select **Add Cheque**. The entry is added to the finance settings on the page.
4. Select **Save Finance Settings** to persist the cheque entry. The Finance Report displays saved cheque entries and totals.

### Supplier payments
1. Enter the supplier, item, and amount.
2. Choose Cash, Cheque, Bank Transfer, or M-Pesa. Enter the required M-Pesa phone number or bank account number for those methods.
3. Add an optional payment reference and note, then select **Pay Supplier**.
4. Review the success message and the supplier payment/account summary.

Supplier payments are recorded when **Pay Supplier** succeeds; they are not saved by the separate finance-settings button.

---

## 7. Finance Report
This page combines the available legacy finance summary with current-period ledger reports.

- Fee and cheque summary: expected fees, collections, outstanding balance, class fee budget, incoming/outgoing/pending cheques, and supplier payments.
- **Trial Balance**: total debit and credit and whether they balance.
- **Budget vs Actual**: budget, actual expenditure, variance, and status.
- **Balance Sheet**: assets, liabilities, equity, and balance status.
- **Income Statement**: revenue, expenses, net income, and status.
- **Auto-generated audit notes**: recent financial changes; select **Download CSV** to export the audit notes.

If the page says no accounting period exists, ask an authorized user to initialize the school's accounting period. A report marked unavailable may not have data for the selected/current period yet.

---

## 8. Pledges and procurement orders
This page has two tabs and a **Refresh** action.

### Fee pledges
1. Select **Fee pledges**.
2. Choose the student and enter who promised to pay, the promised amount, due date, and optional note.
3. Select **Record pledge**. The pledge is a promise, not a collected payment, and does not reduce the student's outstanding balance.
4. When payment is verified and appears in the available receipt list, select **Link verified payment** beside the pledge. Choose the receipt and optionally enter the amount to allocate, then select **Link payment**.

The list shows promised and fulfilled amounts, due date, status, and linked receipts. Completed or cancelled pledges cannot be fulfilled again.

### LPOs, LSOs, and payment vouchers
1. Select **LPOs, LSOs & vouchers**.
2. Choose Local Purchase Order (LPO), Local Service Order (LSO), or Payment Voucher.
3. Enter supplier/payee, description, amount, and optional transaction reference and note.
4. Select **Create for approval**. The record is created as pending approval.
5. Use **Print** to print a record. Admin/SuperAdmin users approve pending records and mark approved records paid with a bank or M-Pesa reference.

Accountants can create and print these records; approval and marking paid are restricted to Admin/SuperAdmin roles.

---

## 9. Budget Management

### Set up the financial year
If no accounting period exists, enter a financial-year name, start date, and end date, then select **Create financial year**. This initializes the period and accounting accounts. Check dates carefully before creating it.

### Create and submit a budget
1. Select an account and enter the annual budget amount. Programme, activity, and notes are optional.
2. Choose annual, monthly, or quarterly periodization. For monthly or quarterly budgets, enter each allocation; their sum must equal the annual budget.
3. Select **Save Draft**. The budget appears in **Budget Lines and Approvals** as a draft.
4. Select **Submit** on the draft when it is ready for review.

The dashboard shows revenue/expenditure budgets and actuals, expenditure utilization, overruns, and (where applicable) periodized actuals and variance. Admin/SuperAdmin users review submitted budgets, return them for revision with a reason, approve reviewed budgets, and lock approved budgets. An Accountant submits drafts but does not approve or lock budgets.

---

## 10. Petty Cash
An open accounting period is required to record cash movements or reconcile the cash count.

### Record a movement
1. Select **Add / replenish cash from bank** to record funds entering petty cash, or **Pay petty-cash expense** for a disbursement.
2. Enter the amount and reference/note for a top-up. For an expense, select an expense account and enter the payee and purpose.
3. Select **Record top-up** or **Record expense**. Review the new cash balance.

### Reconcile the physical cash
1. Count the cash physically in the petty-cash box.
2. Enter the count and an optional reconciliation note, then select **Reconcile**.
3. Review the counted amount and variance. The reconciliation is journaled and audited.

The page also lists cash movements (date, description, journal, inflow, outflow, and running balance) and recent reconciliation records. If no period is open, ask an authorized user to configure one before entering transactions.

---

## 11. Manual Journals
1. Confirm that the displayed accounting period is open.
2. Enter a journal description and at least two accounting lines.
3. For each line, choose an account and enter either a debit or a credit amount; add a line description if needed. Use **Add line** for additional entries or remove extras while keeping at least two lines.
4. Check that total debits equal total credits and that the page shows **Balanced**.
5. Select **Post journal**. The entry is posted to the ledger and appears under Recent posted entries.

Journals cannot be posted when there is no open period or when the entry is unbalanced. Posted entries are shown with their account lines and status.

---

## 12. Accounting Vouchers
Vouchers are prepared in an accounting period and use balanced debit/credit lines. Types are Payment Voucher (PV), Receipt Voucher (RV), Journal Voucher (JV), and Contra Voucher (CV).

### Prepare and submit
1. Select **New voucher** if you are not already preparing a new one.
2. Choose an open accounting period, voucher type, date, payment method, payee/payer, and description.
3. Enter at least two accounting lines. Select accounts and enter debit or credit values; make sure total debit equals total credit.
4. For a Payment Voucher, scan or upload the supplier receipt/invoice. Supported files include JPEG, PNG, WebP, and PDF. Preview attached receipts or detach them while the voucher is still editable.
5. Select **Save draft**, then **Submit for approval** when the draft is complete.

Receipt vouchers for student fee revenue are blocked here to prevent duplicate ledger entries; record student fee payments through Students instead. Payment vouchers require supporting evidence before submission.

### Review, print, and audit
- Drafts and rejected vouchers can be edited by their preparer. Correct rejected vouchers using the rejection reason, then resubmit.
- Admin/SuperAdmin users can approve and post submitted vouchers, or reject them with a reason. Posting cannot be edited afterward.
- Use **Print / Save PDF** or **Print** to produce a paper/PDF copy. Allow pop-ups if the browser blocks the print window.
- Select **Audit** to view the voucher's action history. Supporting receipt files can be previewed from the voucher.
- Admin/SuperAdmin users can reverse a posted voucher. Reversal requires a reason and creates a compensating journal; the original remains in the audit trail.
- Use **List period** to filter vouchers by accounting period or show all periods.

---

## 13. Invoices
Invoices provides a read-only student fee summary: student name, total/expected fees, amount paid, and balance. It is based on school payment statistics. Use Students to record payments or update a student's total fees.

## 14. Receipts
Receipts lists payments recorded in student payment history, including receipt number, student, amount, date, and a **Generate Receipt** action.

1. Find the payment in the list and select **Generate Receipt**.
2. Review the printable receipt details: student/admission number, purpose, payment method, transaction ID, status, amount, total fees, and balances.
3. Use the browser print dialog to print or save as PDF. The generated receipt is also downloaded as an HTML file.

Receipts represent recorded student payments; this page does not create a new payment.

---

## 15. Payroll
Payroll shows teacher and HR employee records, payroll history/status, and actions available to an Accountant.

### Prepare a payroll run
1. Choose a payroll month in **Payroll Period**.
2. Select **Generate Payroll**. Review the resulting period, employee count, net total, and status.
3. Admin/SuperAdmin users can approve payrolls awaiting approval. Ask the principal/administrator to complete approval when required.

### Pay teachers
1. Review teacher salary, last payment, and whether a payment is already pending.
2. Select **Pay Salary** for one teacher, or select teachers and choose **Pay Selected** for a bulk submission. Teachers with pending payments cannot be selected.
3. Confirm the salary amount pulled from HR records. Add/update the payment method, bank details if needed, reference, and note; select **Submit Payment**.
4. Teacher salary payments are submitted for principal approval before they are finalized. The Accountant cannot change salary amounts; HR maintains salary and employee details.

### Verify and pay other employees
1. In **Payroll Employees**, select **View Payroll Details** to review employee number, department, salary, payment details, deductions, payroll period, and verification checks.
2. Select **Verify Employee** after checking the displayed account details. The employee must have **Verified** account status before salary payment is enabled.
3. Select **Pay Salary**, confirm payment details, add a reference/note, and submit.

If a salary is missing or incorrect, or an employee account is not ready for verification, contact HR. Do not use guessed salary or bank details.

---

## 16. Communication
The Communication page is for messages with HR and Accountant staff. It displays unread-message, query, and payment-alert counts. Unread counts refresh periodically.

### Read and respond
1. Use the **Message Type** and **Status** filters to narrow the inbox.
2. Select a message to read its sender, role, date, type, priority, and conversation responses. Opening an unread message marks it read.
3. Enter a response and select **Add Response**. For an unresolved message, select **Resolve** when the issue is complete.

### Send a message
1. Select **New Message**.
2. Choose a recipient, enter a subject and message, and choose message type (General, Query, Notification, or Payment Alert) and priority (Low, Medium, or High).
3. Select **Send**. Required fields must be completed.

---

## 17. Reports, exports, and search

### Reports
The Reports page summarizes total students, total collected, and total outstanding. Select **Export CSV** to download student-level total fees, amount paid, and balance.

### Download Finance Data
Select **Download Finance Data** in the navigation to download the accountant finance-data CSV. Store exported files securely because they contain school financial information.

### Global Search
Select the magnifying-glass search button. Enter at least two characters to search school records such as students, staff, classes, fee balances, payments/receipts, attendance, and finance records. Search results are limited to records your role may view; select a result to open it.

---

## 18. Good practice and troubleshooting
- Confirm the student, accounting period, amount, payment method, and reference before saving or posting.
- Keep bank/M-Pesa evidence and supplier receipts; attach supporting evidence to Payment Vouchers.
- Treat a pledge as a promise, a draft as unposted, and a statement preview as unmatched until the relevant verified payment/reconciliation is complete.
- Do not share login details or exported finance files. Select **Logout** when finished on a shared computer.
- If data fails to load, confirm your internet connection and school assignment, then refresh the page or sign in again.
- If an action is unavailable, check the accounting period and record status. Approval, locking, and some payment actions are limited to Admin/SuperAdmin; salary details are maintained by HR.
- If an amount, receipt, or transaction status looks wrong, stop and confirm the source records with the administrator before posting corrections.