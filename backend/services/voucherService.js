const mongoose = require('mongoose');
const Voucher = require('../models/voucherSchema');
const VoucherSequence = require('../models/voucherSequenceSchema');
const { Account, AccountingPeriod, JournalEntry, GeneralLedger, AuditLog } = require('../models/accountingSchema');
const AccountingService = require('./accountingService');

const getPrefix = (voucherType) => ({ PV: 'PV', RV: 'RV', JV: 'JV', CV: 'CV' })[voucherType];
const moneyCents = (value) => Math.round(Number(value || 0) * 100);

const validateVoucherLines = (voucherType, lines) => {
    const normalizedLines = AccountingService.validateJournalLines(lines);
    const debitTotal = normalizedLines.reduce((total, line) => total + line.debitAmount, 0);
    const creditTotal = normalizedLines.reduce((total, line) => total + line.creditAmount, 0);
    if (moneyCents(debitTotal) !== moneyCents(creditTotal)) {
        throw new Error('Voucher debits and credits must balance to the cent');
    }
    if (voucherType === 'PV' && !normalizedLines.some((line) => line.creditAmount > 0)) {
        throw new Error('Payment vouchers must credit a cash or bank account');
    }
    if (voucherType === 'RV' && !normalizedLines.some((line) => line.debitAmount > 0)) {
        throw new Error('Receipt vouchers must debit a cash or bank account');
    }
    if (voucherType === 'CV' && normalizedLines.length < 2) {
        throw new Error('Contra vouchers require at least two account lines');
    }
    if (voucherType === 'CV') {
        const debitAccounts = new Set(normalizedLines.filter((line) => line.debitAmount > 0).map((line) => String(line.accountId)));
        const creditAccounts = new Set(normalizedLines.filter((line) => line.creditAmount > 0).map((line) => String(line.accountId)));
        if (!debitAccounts.size || !creditAccounts.size || [...debitAccounts].some((accountId) => creditAccounts.has(accountId))) {
            throw new Error('Contra vouchers must transfer value between different asset accounts');
        }
    }
    return normalizedLines;
};

const createAuditEntry = async ({ schoolId, voucher, actorId, action, oldValue = null, newValue = null, notes, session }) => {
    const [entry] = await AuditLog.create([{
        schoolId,
        entityType: 'AccountingVoucher',
        entityId: voucher._id,
        action,
        oldValue,
        newValue,
        changedBy: actorId,
        notes,
        source: 'api',
    }], { session });
    return entry;
};

const withTransaction = async (callback) => {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await callback(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};

const issueVoucherNumber = async ({ schoolId, period, voucherType, session }) => {
    const year = new Date(period.startDate).getUTCFullYear();
    const sequenceKey = `${schoolId}:${period._id}:${voucherType}`;
    const sequence = await VoucherSequence.findOneAndUpdate(
        { _id: sequenceKey },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );
    return `${getPrefix(voucherType)}-${year}-${String(sequence.value).padStart(6, '0')}`;
};

const findVoucher = (schoolId, voucherId, session) => {
    let query = Voucher.findOne({ _id: voucherId, schoolId });
    if (session) query = query.session(session);
    return query;
};

const validateAccounts = async ({ voucher, session }) => {
    const lines = validateVoucherLines(voucher.voucherType, voucher.lines);
    const accounts = await Account.find({
        _id: { $in: lines.map((line) => line.accountId) },
        schoolId: voucher.schoolId,
        active: true,
    }).session(session);
    if (accounts.length !== new Set(lines.map((line) => String(line.accountId))).size) {
        throw new Error('One or more voucher accounts are inactive or belong to another school');
    }

    const accountById = new Map(accounts.map((account) => [String(account._id), account]));
    const cashBankAccount = (accountId) => {
        const account = accountById.get(String(accountId));
        return account?.type === 'asset' && ['cash', 'bank'].includes(account.category);
    };

    if (voucher.voucherType === 'PV' && !lines.some((line) => line.creditAmount > 0 && cashBankAccount(line.accountId))) {
        throw new Error('Payment vouchers must credit a cash or bank account');
    }
    if (voucher.voucherType === 'RV' && !lines.some((line) => line.debitAmount > 0 && cashBankAccount(line.accountId))) {
        throw new Error('Receipt vouchers must debit a cash or bank account');
    }
    if (voucher.voucherType === 'RV' && lines.some((line) => {
        const account = accountById.get(String(line.accountId));
        return line.creditAmount > 0 && account?.category === 'fees';
    })) {
        throw new Error('School fee receipts must use the existing student payment workflow to avoid duplicate ledger entries');
    }
    if (voucher.voucherType === 'CV' && accounts.some((account) => account.type !== 'asset')) {
        throw new Error('Contra vouchers may only transfer between asset accounts');
    }
    if (voucher.voucherType === 'CV' && accounts.some((account) => !['cash', 'bank'].includes(account.category))) {
        throw new Error('Contra vouchers may only transfer between cash and bank accounts');
    }
    return { lines, accounts, accountById };
};

exports.validateVoucherLines = validateVoucherLines;

exports.createDraft = async ({ schoolId, actorId, voucherType, periodId, voucherDate, payeePayer, paymentMethod, description, lines }) => {
    if (!['PV', 'RV', 'JV', 'CV'].includes(voucherType)) throw new Error('Choose a valid voucher type');
    if (!description || !String(description).trim()) throw new Error('Voucher description is required');
    const date = new Date(voucherDate || Date.now());
    if (!Number.isFinite(date.getTime())) throw new Error('Voucher date is invalid');

    return withTransaction(async (session) => {
        const period = await AccountingPeriod.findOne({ _id: periodId, schoolId, status: 'open' }).session(session);
        if (!period) throw new Error('An open accounting period for this school is required');
        if (date < period.startDate || date > period.endDate) throw new Error('Voucher date must be within the selected accounting period');

        const voucherNo = await issueVoucherNumber({ schoolId, period, voucherType, session });
        const [voucher] = await Voucher.create([{
            schoolId,
            periodId,
            voucherNo,
            voucherType,
            voucherDate: date,
            payeePayer: String(payeePayer || '').trim(),
            paymentMethod: paymentMethod || 'Other',
            description: String(description).trim(),
            lines: Array.isArray(lines) ? lines : [],
            preparedBy: actorId,
            status: 'draft',
        }], { session });

        await createAuditEntry({
            schoolId,
            voucher,
            actorId,
            action: 'create_draft',
            newValue: { voucherNo, voucherType, description: voucher.description },
            notes: `${voucherType} voucher ${voucherNo} created as a draft.`,
            session,
        });
        return voucher;
    });
};

exports.updateDraft = async ({ schoolId, voucherId, actorId, updates }) => withTransaction(async (session) => {
    const voucher = await findVoucher(schoolId, voucherId, session);
    if (!voucher) throw new Error('Voucher not found for this school');
    if (!['draft', 'rejected'].includes(voucher.status)) throw new Error('Only draft or rejected vouchers can be edited');
    if (String(voucher.preparedBy) !== String(actorId)) throw new Error('Only the voucher preparer can edit this draft');

    const before = { description: voucher.description, payeePayer: voucher.payeePayer, paymentMethod: voucher.paymentMethod, lines: voucher.lines };
    if (updates.description !== undefined) voucher.description = String(updates.description).trim();
    if (updates.payeePayer !== undefined) voucher.payeePayer = String(updates.payeePayer).trim();
    if (updates.paymentMethod !== undefined) voucher.paymentMethod = updates.paymentMethod;
    if (updates.voucherDate !== undefined) voucher.voucherDate = new Date(updates.voucherDate);
    if (updates.lines !== undefined) voucher.lines = updates.lines;
    voucher.status = 'draft';
    voucher.rejectionReason = '';

    const period = await AccountingPeriod.findOne({ _id: voucher.periodId, schoolId, status: 'open' }).session(session);
    if (!period) throw new Error('The accounting period is not open');
    if (voucher.voucherDate < period.startDate || voucher.voucherDate > period.endDate) throw new Error('Voucher date must be within the selected accounting period');
    await voucher.save({ session });
    await createAuditEntry({ schoolId, voucher, actorId, action: 'update_draft', oldValue: before, newValue: updates, notes: `Draft ${voucher.voucherNo} updated.`, session });
    return voucher;
});

exports.attachReceipts = async ({ schoolId, voucherId, actorId, files }) => withTransaction(async (session) => {
    const voucher = await findVoucher(schoolId, voucherId, session);
    if (!voucher) throw new Error('Voucher not found for this school');
    if (!['draft', 'rejected'].includes(voucher.status)) throw new Error('Receipts can only be attached to draft or rejected vouchers');

    const receipts = files.map((file) => ({
        storedName: file.filename,
        originalName: pathSafeOriginalName(file.originalname),
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: actorId,
        uploadedAt: new Date(),
    }));
    voucher.receipts.push(...receipts);
    await voucher.save({ session });
    await createAuditEntry({
        schoolId,
        voucher,
        actorId,
        action: 'upload_receipts',
        newValue: receipts.map(({ originalName, size, mimeType }) => ({ originalName, size, mimeType })),
        notes: `${receipts.length} receipt file(s) attached to ${voucher.voucherNo}.`,
        session,
    });
    return voucher;
});

const pathSafeOriginalName = (name) => require('path').basename(String(name || 'receipt')).slice(0, 180);

exports.submitVoucher = async ({ schoolId, voucherId, actorId }) => withTransaction(async (session) => {
    const voucher = await findVoucher(schoolId, voucherId, session);
    if (!voucher) throw new Error('Voucher not found for this school');
    if (!['draft', 'rejected'].includes(voucher.status)) throw new Error('Only draft or rejected vouchers can be submitted');
    if (String(voucher.preparedBy) !== String(actorId)) throw new Error('Only the voucher preparer can submit it');
    await validateAccounts({ voucher, session });
    if (voucher.voucherType === 'PV' && !voucher.receipts.length) throw new Error('Attach a supplier receipt or invoice before submitting a payment voucher');

    const previousStatus = voucher.status;
    voucher.status = 'submitted';
    voucher.submittedBy = actorId;
    voucher.submittedAt = new Date();
    voucher.rejectionReason = '';
    await voucher.save({ session });
    await createAuditEntry({ schoolId, voucher, actorId, action: 'submit', oldValue: previousStatus, newValue: 'submitted', notes: `${voucher.voucherNo} submitted for approval.`, session });
    return voucher;
});

exports.rejectVoucher = async ({ schoolId, voucherId, actorId, reason }) => withTransaction(async (session) => {
    const voucher = await findVoucher(schoolId, voucherId, session);
    if (!voucher) throw new Error('Voucher not found for this school');
    if (voucher.status !== 'submitted') throw new Error('Only submitted vouchers can be rejected');
    if (!String(reason || '').trim()) throw new Error('A rejection reason is required');
    voucher.status = 'rejected';
    voucher.rejectionReason = String(reason).trim();
    await voucher.save({ session });
    await createAuditEntry({ schoolId, voucher, actorId, action: 'reject', newValue: { status: 'rejected', reason: voucher.rejectionReason }, notes: `${voucher.voucherNo} rejected: ${voucher.rejectionReason}`, session });
    return voucher;
});

exports.approveAndPostVoucher = async ({ schoolId, voucherId, actorId }) => withTransaction(async (session) => {
    const voucher = await findVoucher(schoolId, voucherId, session);
    if (!voucher) throw new Error('Voucher not found for this school');
    if (voucher.status === 'posted' && voucher.journalEntryId) return voucher;
    if (voucher.status !== 'submitted') throw new Error('Only submitted vouchers can be approved');
    if (String(voucher.preparedBy) === String(actorId)) throw new Error('The voucher preparer cannot approve their own voucher');

    const period = await AccountingPeriod.findOne({ _id: voucher.periodId, schoolId, status: 'open' }).session(session);
    if (!period) throw new Error('The voucher accounting period is not open');
    const { lines, accounts, accountById } = await validateAccounts({ voucher, session });
    const existingEntry = await JournalEntry.findOne({ schoolId, sourceVoucherId: voucher._id }).session(session);
    if (existingEntry) {
        voucher.status = 'posted';
        voucher.approvedBy = actorId;
        voucher.approvedAt = new Date();
        voucher.postedBy = actorId;
        voucher.postedAt = existingEntry.postedAt || new Date();
        voucher.journalEntryId = existingEntry._id;
        await voucher.save({ session });
        return voucher;
    }

    const entryNo = `JE-${voucher.voucherNo}-${String(voucher._id).slice(-6)}`;
    const [journalEntry] = await JournalEntry.create([{
        schoolId,
        periodId: voucher.periodId,
        entryNo,
        entryDate: voucher.voucherDate,
        description: `${voucher.voucherNo}: ${voucher.description}`,
        sourceModule: voucher.voucherType === 'PV' ? 'procurement' : voucher.voucherType === 'RV' ? 'fees' : voucher.voucherType === 'CV' ? 'bank' : 'manual',
        status: 'posted',
        postedBy: actorId,
        postedAt: new Date(),
        sourceVoucherId: voucher._id,
        lines,
    }], { session });

    const runningBalances = new Map();
    const ledgerEntries = [];
    for (const line of journalEntry.lines) {
        const account = accountById.get(String(line.accountId));
        if (!runningBalances.has(String(account._id))) {
            const previous = await GeneralLedger.findOne({ schoolId, periodId: voucher.periodId, accountId: account._id })
                .sort({ createdAt: -1 })
                .session(session)
                .lean();
            runningBalances.set(String(account._id), Number(previous?.balanceAfter || 0));
        }
        const key = String(account._id);
        const delta = account.normalBalance === 'debit'
            ? line.debitAmount - line.creditAmount
            : line.creditAmount - line.debitAmount;
        const balanceAfter = runningBalances.get(key) + delta;
        runningBalances.set(key, balanceAfter);
        ledgerEntries.push({
            schoolId,
            periodId: voucher.periodId,
            accountId: account._id,
            journalEntryId: journalEntry._id,
            journalLineId: line._id,
            entryDate: voucher.voucherDate,
            description: line.description || voucher.description,
            debitAmount: Number(line.debitAmount || 0),
            creditAmount: Number(line.creditAmount || 0),
            balanceAfter,
            referenceId: voucher._id,
            referenceType: 'voucher',
        });
    }
    await GeneralLedger.insertMany(ledgerEntries, { session });

    voucher.status = 'posted';
    voucher.approvedBy = actorId;
    voucher.approvedAt = new Date();
    voucher.postedBy = actorId;
    voucher.postedAt = new Date();
    voucher.journalEntryId = journalEntry._id;
    await voucher.save({ session });

    await createAuditEntry({ schoolId, voucher, actorId, action: 'approve_and_post', oldValue: 'submitted', newValue: 'posted', notes: `${voucher.voucherNo} approved and posted as journal ${entryNo}.`, session });
    await AuditLog.create([{
        schoolId,
        entityType: 'JournalEntry',
        entityId: journalEntry._id,
        action: 'post',
        fieldName: 'status',
        oldValue: 'draft',
        newValue: 'posted',
        changedBy: actorId,
        notes: `Journal ${entryNo} posted from approved voucher ${voucher.voucherNo}.`,
        source: 'api',
    }], { session });

    return voucher;
});

exports.reversePostedVoucher = async ({ schoolId, voucherId, actorId, reason }) => withTransaction(async (session) => {
    const voucher = await findVoucher(schoolId, voucherId, session);
    if (!voucher) throw new Error('Voucher not found for this school');
    if (voucher.status === 'reversed' && voucher.reversalJournalEntryId) return voucher;
    if (voucher.status !== 'posted' || !voucher.journalEntryId) throw new Error('Only posted vouchers can be reversed');
    if (!String(reason || '').trim()) throw new Error('A reversal reason is required');

    const openPeriod = await AccountingPeriod.findOne({ schoolId, status: 'open' }).sort({ startDate: -1 }).session(session);
    if (!openPeriod) throw new Error('An open accounting period is required to post a reversal');
    const original = await JournalEntry.findOne({ _id: voucher.journalEntryId, schoolId }).session(session);
    if (!original || original.status !== 'posted') throw new Error('The original posted journal could not be found');

    const accountIds = original.lines.map((line) => line.accountId);
    const accounts = await Account.find({ _id: { $in: accountIds }, schoolId, active: true }).session(session);
    if (accounts.length !== new Set(accountIds.map(String)).size) throw new Error('Original journal accounts are unavailable for reversal');
    const accountById = new Map(accounts.map((account) => [String(account._id), account]));
    const reversedLines = original.lines.map((line) => ({
        accountId: line.accountId,
        debitAmount: Number(line.creditAmount || 0),
        creditAmount: Number(line.debitAmount || 0),
        description: `Reversal: ${line.description || original.description}`,
        referenceId: voucher._id,
        referenceType: 'voucher',
    }));
    const reversalJournalNo = `JE-REV-${voucher.voucherNo}-${String(voucher._id).slice(-6)}`;
    const reversedAt = new Date();
    const [reversalJournal] = await JournalEntry.create([{
        schoolId,
        periodId: openPeriod._id,
        entryNo: reversalJournalNo,
        entryDate: reversedAt,
        description: `Reversal of ${voucher.voucherNo}: ${String(reason).trim()}`,
        sourceModule: original.sourceModule,
        status: 'posted',
        postedBy: actorId,
        postedAt: reversedAt,
        reversalOfVoucherId: voucher._id,
        lines: reversedLines,
    }], { session });

    const runningBalances = new Map();
    const ledgerEntries = [];
    for (const line of reversalJournal.lines) {
        const account = accountById.get(String(line.accountId));
        const key = String(account._id);
        if (!runningBalances.has(key)) {
            const previous = await GeneralLedger.findOne({ schoolId, periodId: openPeriod._id, accountId: account._id })
                .sort({ createdAt: -1 })
                .session(session)
                .lean();
            runningBalances.set(key, Number(previous?.balanceAfter || 0));
        }
        const delta = account.normalBalance === 'debit'
            ? Number(line.debitAmount || 0) - Number(line.creditAmount || 0)
            : Number(line.creditAmount || 0) - Number(line.debitAmount || 0);
        const balanceAfter = runningBalances.get(key) + delta;
        runningBalances.set(key, balanceAfter);
        ledgerEntries.push({
            schoolId,
            periodId: openPeriod._id,
            accountId: account._id,
            journalEntryId: reversalJournal._id,
            journalLineId: line._id,
            entryDate: reversedAt,
            description: line.description,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            balanceAfter,
            referenceId: voucher._id,
            referenceType: 'voucher',
        });
    }
    await GeneralLedger.insertMany(ledgerEntries, { session });

    const previousStatus = voucher.status;
    voucher.status = 'reversed';
    voucher.reversedBy = actorId;
    voucher.reversedAt = reversedAt;
    voucher.reversalReason = String(reason).trim();
    voucher.reversalJournalEntryId = reversalJournal._id;
    await voucher.save({ session });
    await createAuditEntry({ schoolId, voucher, actorId, action: 'reverse', oldValue: previousStatus, newValue: 'reversed', notes: `${voucher.voucherNo} reversed by ${reversalJournalNo}: ${voucher.reversalReason}`, session });
    await AuditLog.create([{
        schoolId,
        entityType: 'JournalEntry',
        entityId: reversalJournal._id,
        action: 'post_reversal',
        oldValue: original._id,
        newValue: reversalJournal._id,
        changedBy: actorId,
        notes: `${reversalJournalNo} reverses ${original.entryNo} for ${voucher.voucherNo}. Reason: ${voucher.reversalReason}`,
        source: 'api',
    }], { session });
    return voucher;
});

exports.getVoucherList = async ({ schoolId, periodId, status, voucherType }) => {
    const query = { schoolId };
    if (periodId) query.periodId = periodId;
    if (status) query.status = status;
    if (voucherType) query.voucherType = voucherType;
    return Voucher.find(query)
        .populate('preparedBy', 'name email role')
        .populate('approvedBy', 'name email role')
        .populate('journalEntryId', 'entryNo')
        .populate('lines.accountId', 'code name type category')
        .sort({ voucherDate: -1, createdAt: -1 })
        .limit(200)
        .lean();
};

exports.getVoucher = (schoolId, voucherId) => Voucher.findOne({ _id: voucherId, schoolId })
    .populate('preparedBy', 'name email role')
    .populate('submittedBy', 'name email role')
    .populate('approvedBy', 'name email role')
    .populate('postedBy', 'name email role')
    .populate('journalEntryId', 'entryNo')
    .populate('lines.accountId', 'code name type category');

exports.removeReceiptMetadata = async ({ schoolId, voucherId, receiptId, actorId }) => withTransaction(async (session) => {
    const voucher = await findVoucher(schoolId, voucherId, session);
    if (!voucher) throw new Error('Voucher not found for this school');
    if (!['draft', 'rejected'].includes(voucher.status)) throw new Error('Receipts can only be changed on draft or rejected vouchers');
    const receipt = voucher.receipts.id(receiptId);
    if (!receipt) throw new Error('Receipt not found on this voucher');
    const removed = { storedName: receipt.storedName, originalName: receipt.originalName };
    receipt.deleteOne();
    await voucher.save({ session });
    await createAuditEntry({ schoolId, voucher, actorId, action: 'remove_receipt', oldValue: removed, notes: `${removed.originalName} removed from ${voucher.voucherNo}; the retained original is not automatically deleted.`, session });
    return removed;
});