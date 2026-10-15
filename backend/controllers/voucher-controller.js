const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Account, AccountingPeriod, AuditLog } = require('../models/accountingSchema');
const Voucher = require('../models/voucherSchema');
const { getRequestUser } = require('../middleware/schoolAccess');
const { privateRoot, validateReceiptFile } = require('../middleware/voucherReceiptUpload');
const VoucherService = require('../services/voucherService');

const getVoucherActor = async (req, res, schoolId, roles = ['Accountant', 'Admin', 'SuperAdmin']) => {
    const requester = await getRequestUser(req);
    if (!requester || requester.type !== 'admin') {
        res.status(401).json({ message: 'Authenticated finance access is required' });
        return null;
    }
    const actorRoles = new Set([requester.user.role, ...(requester.user.roles || [])]);
    if (!actorRoles.has('SuperAdmin') && String(requester.schoolId || '') !== String(schoolId)) {
        res.status(403).json({ message: 'You can only access vouchers for your own school' });
        return null;
    }
    if (!roles.some((role) => actorRoles.has(role))) {
        res.status(403).json({ message: 'Your role cannot perform this voucher action' });
        return null;
    }
    return requester.user;
};

exports.listVouchers = async (req, res) => {
    try {
        const { schoolId } = req.params;
        if (!await getVoucherActor(req, res, schoolId)) return;
        const data = await VoucherService.getVoucherList({
            schoolId,
            periodId: req.query.periodId,
            status: req.query.status,
            voucherType: req.query.voucherType,
        });
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load vouchers' });
    }
};

exports.createVoucher = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const actor = await getVoucherActor(req, res, schoolId);
        if (!actor) return;
        const voucher = await VoucherService.createDraft({ ...req.body, schoolId, actorId: actor._id });
        return res.status(201).json({ message: 'Voucher draft created', data: voucher });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Unable to create voucher' });
    }
};

exports.updateVoucher = async (req, res) => {
    try {
        const { schoolId, voucherId } = req.params;
        const actor = await getVoucherActor(req, res, schoolId);
        if (!actor) return;
        const voucher = await VoucherService.updateDraft({ schoolId, voucherId, actorId: actor._id, updates: req.body });
        return res.status(200).json({ message: 'Voucher draft updated', data: voucher });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Unable to update voucher' });
    }
};

exports.submitVoucher = async (req, res) => {
    try {
        const { schoolId, voucherId } = req.params;
        const actor = await getVoucherActor(req, res, schoolId);
        if (!actor) return;
        const voucher = await VoucherService.submitVoucher({ schoolId, voucherId, actorId: actor._id });
        return res.status(200).json({ message: 'Voucher submitted for approval', data: voucher });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Unable to submit voucher' });
    }
};

exports.approveVoucher = async (req, res) => {
    try {
        const { schoolId, voucherId } = req.params;
        const actor = await getVoucherActor(req, res, schoolId, ['Admin', 'SuperAdmin']);
        if (!actor) return;
        const voucher = await VoucherService.approveAndPostVoucher({ schoolId, voucherId, actorId: actor._id });
        return res.status(200).json({ message: 'Voucher approved and posted to the ledger', data: voucher });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Unable to approve voucher' });
    }
};

exports.rejectVoucher = async (req, res) => {
    try {
        const { schoolId, voucherId } = req.params;
        const actor = await getVoucherActor(req, res, schoolId, ['Admin', 'SuperAdmin']);
        if (!actor) return;
        const voucher = await VoucherService.rejectVoucher({ schoolId, voucherId, actorId: actor._id, reason: req.body?.reason });
        return res.status(200).json({ message: 'Voucher rejected', data: voucher });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Unable to reject voucher' });
    }
};

exports.reverseVoucher = async (req, res) => {
    try {
        const { schoolId, voucherId } = req.params;
        const actor = await getVoucherActor(req, res, schoolId, ['Admin', 'SuperAdmin']);
        if (!actor) return;
        const voucher = await VoucherService.reversePostedVoucher({
            schoolId,
            voucherId,
            actorId: actor._id,
            reason: req.body?.reason,
        });
        return res.status(200).json({ message: 'Voucher reversed with a compensating journal entry', data: voucher });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Unable to reverse voucher' });
    }
};

exports.uploadReceipts = async (req, res) => {
    const files = req.files || [];
    try {
        const { schoolId, voucherId } = req.params;
        const actor = await getVoucherActor(req, res, schoolId);
        if (!actor) {
            files.forEach((file) => fs.promises.unlink(file.path).catch(() => {}));
            return;
        }
        if (!mongoose.Types.ObjectId.isValid(voucherId)) throw new Error('Invalid voucher ID');
        const voucher = await Voucher.findOne({ _id: voucherId, schoolId });
        if (!voucher) throw new Error('Voucher not found for this school');
        if (String(voucher.preparedBy) !== String(actor._id)) throw new Error('Only the voucher preparer can attach receipts');
        if (!files.length) return res.status(400).json({ message: 'Choose at least one receipt file' });
        await Promise.all(files.map(validateReceiptFile));
        const updated = await VoucherService.attachReceipts({ schoolId, voucherId, actorId: actor._id, files });
        return res.status(200).json({ message: 'Receipt files attached securely', data: updated });
    } catch (error) {
        await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));
        return res.status(400).json({ message: error.message || 'Unable to upload voucher receipts' });
    }
};

exports.downloadReceipt = async (req, res) => {
    try {
        const { schoolId, voucherId, receiptId } = req.params;
        if (!await getVoucherActor(req, res, schoolId)) return;
        const voucher = await Voucher.findOne({ _id: voucherId, schoolId }).select('receipts').lean();
        const receipt = voucher?.receipts?.find((item) => String(item._id) === String(receiptId));
        if (!receipt) return res.status(404).json({ message: 'Receipt not found' });
        if (!/^[a-f0-9-]+\.(jpg|png|webp|pdf)$/i.test(receipt.storedName)) {
            return res.status(400).json({ message: 'Invalid receipt file reference' });
        }

        const receiptPath = path.resolve(privateRoot, schoolId, voucherId, receipt.storedName);
        if (!receiptPath.startsWith(`${path.resolve(privateRoot)}${path.sep}`)) return res.status(400).json({ message: 'Invalid receipt path' });
        res.setHeader('Content-Type', receipt.mimeType);
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(receipt.originalName)}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.sendFile(receiptPath, (error) => {
            if (error && !res.headersSent) res.status(error.statusCode || 404).json({ message: 'Receipt file is unavailable' });
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Unable to retrieve receipt' });
    }
};

exports.removeReceipt = async (req, res) => {
    try {
        const { schoolId, voucherId, receiptId } = req.params;
        const actor = await getVoucherActor(req, res, schoolId);
        if (!actor) return;
        const removed = await VoucherService.removeReceiptMetadata({ schoolId, voucherId, receiptId, actorId: actor._id });
        return res.status(200).json({ message: 'Receipt detached from draft; retained file was not deleted', data: removed });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Unable to remove receipt' });
    }
};

exports.getVoucherAccounts = async (req, res) => {
    try {
        const { schoolId } = req.params;
        if (!await getVoucherActor(req, res, schoolId)) return;
        const accounts = await Account.find({ schoolId, active: true })
            .select('code name type category normalBalance')
            .sort({ code: 1 })
            .lean();
        return res.status(200).json({ data: accounts });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load voucher accounts' });
    }
};

exports.getVoucherPeriods = async (req, res) => {
    try {
        const { schoolId } = req.params;
        if (!await getVoucherActor(req, res, schoolId)) return;
        const periods = await AccountingPeriod.find({ schoolId }).sort({ startDate: -1 }).limit(20).lean();
        return res.status(200).json({ data: periods });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load voucher periods' });
    }
};

exports.getVoucherAudit = async (req, res) => {
    try {
        const { schoolId, voucherId } = req.params;
        if (!await getVoucherActor(req, res, schoolId)) return;
        const voucher = await Voucher.findOne({ _id: voucherId, schoolId }).select('_id');
        if (!voucher) return res.status(404).json({ message: 'Voucher not found' });
        const audit = await AuditLog.find({ schoolId, entityType: 'AccountingVoucher', entityId: voucherId }).sort({ changedAt: 1 }).lean();
        return res.status(200).json({ data: audit });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load voucher audit history' });
    }
};