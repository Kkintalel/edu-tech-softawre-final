const crypto = require('crypto');
const Student = require('../models/studentSchema');
const { FeePledge, ProcurementOrder } = require('../models/financeCommitmentSchema');
const { getRequestUser } = require('../middleware/schoolAccess');
const { decryptText } = require('../utils/encryption');

const getFinanceActor = async (req, res, { write = false } = {}) => {
    const identity = await getRequestUser(req);
    if (!identity || identity.type !== 'admin') {
        res.status(identity ? 403 : 401).json({ message: 'Finance staff login is required' });
        return null;
    }
    const roles = new Set([identity.user.role, ...(identity.user.roles || [])]);
    if (write && roles.has('Auditor') && !roles.has('Admin') && !roles.has('SuperAdmin')) {
        res.status(403).json({ message: 'Auditors have read-only access to financial records' });
        return null;
    }
    const allowed = write ? ['Admin', 'SuperAdmin', 'Accountant'] : ['Admin', 'SuperAdmin', 'Accountant', 'Auditor'];
    if (![...roles].some((role) => allowed.includes(role))) {
        res.status(403).json({ message: write ? 'Your role cannot change finance records' : 'Your role cannot view finance records' });
        return null;
    }
    const schoolId = identity.schoolId || identity.user._id;
    return { identity, user: identity.user, schoolId, role: identity.user.role };
};

const listPledges = async (req, res) => {
    const actor = await getFinanceActor(req, res);
    if (!actor) return;
    try {
        const query = { school: actor.schoolId };
        if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
        if (req.query.studentId) query.student = req.query.studentId;
        const pledges = await FeePledge.find(query)
            .populate('student', 'name admissionNo sclassName')
            .sort({ promisedDate: 1, createdAt: -1 })
            .limit(Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 100)))
            .lean();
        return res.json({
            pledges: pledges.map((pledge) => ({
                ...pledge,
                student: pledge.student && typeof pledge.student === 'object'
                    ? { ...pledge.student, name: decryptText(pledge.student.name) }
                    : pledge.student,
                promisedBy: decryptText(pledge.promisedBy),
            })),
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load fee pledges' });
    }
};

const createPledge = async (req, res) => {
    const actor = await getFinanceActor(req, res, { write: true });
    if (!actor) return;
    const { studentId, promisedBy, promisedAmount, promisedDate, note } = req.body;
    const amount = Number(promisedAmount);
    if (!studentId || !promisedBy?.trim() || !Number.isFinite(amount) || amount <= 0 || !promisedDate) {
        return res.status(400).json({ message: 'Student, payer name, positive amount, and promised date are required' });
    }
    try {
        const student = await Student.findOne({ _id: studentId, school: actor.schoolId }).select('_id');
        if (!student) return res.status(404).json({ message: 'Student not found in this school' });
        const pledge = await FeePledge.create({
            school: actor.schoolId,
            student: student._id,
            promisedBy: promisedBy.trim(),
            promisedAmount: amount,
            promisedDate: new Date(promisedDate),
            note: note || '',
            createdBy: actor.user._id,
        });
        return res.status(201).json({ pledge });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to record pledge' });
    }
};

const fulfillPledgeFromPayment = async (req, res) => {
    const actor = await getFinanceActor(req, res, { write: true });
    if (!actor) return;
    const { paymentRecordId, amount } = req.body;
    if (!paymentRecordId) return res.status(400).json({ message: 'A verified payment record is required' });
    try {
        const pledge = await FeePledge.findOne({ _id: req.params.id, school: actor.schoolId });
        if (!pledge) return res.status(404).json({ message: 'Pledge not found' });
        const student = await Student.findOne({ _id: pledge.student, school: actor.schoolId });
        if (!student) return res.status(404).json({ message: 'Pledged student not found' });
        const payment = student.paymentHistory.id(paymentRecordId);
        if (!payment || !['Verified', 'Completed'].includes(payment.status)) {
            return res.status(409).json({ message: 'Only a verified or completed student payment can fulfil a pledge' });
        }
        const usedPayment = await FeePledge.exists({ school: actor.schoolId, 'fulfillments.paymentRecordId': paymentRecordId });
        if (usedPayment) return res.status(409).json({ message: 'This payment is already linked to a pledge' });
        const allocatedAmount = Number(amount || payment.amount);
        if (!Number.isFinite(allocatedAmount) || allocatedAmount <= 0 || allocatedAmount > Number(payment.amount)) {
            return res.status(400).json({ message: 'Fulfilment amount must be positive and no greater than the linked payment' });
        }
        if (pledge.fulfilledAmount + allocatedAmount > pledge.promisedAmount) {
            return res.status(400).json({ message: 'Fulfilment would exceed the promised amount' });
        }
        pledge.fulfillments.push({
            paymentRecordId: payment._id,
            receiptNumber: payment.receiptNumber || '',
            externalReference: payment.mpesaReceiptNumber || payment.transactionId || payment.reference || payment.paymentReference || '',
            amount: allocatedAmount,
            linkedBy: actor.user._id,
        });
        pledge.fulfilledAmount += allocatedAmount;
        pledge.status = pledge.fulfilledAmount >= pledge.promisedAmount ? 'Fulfilled' : 'Partially Fulfilled';
        await pledge.save();
        return res.json({ pledge, linkedPayment: { id: payment._id, receiptNumber: payment.receiptNumber, amount: payment.amount, status: payment.status } });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to allocate payment to pledge' });
    }
};

const listPledgePaymentOptions = async (req, res) => {
    const actor = await getFinanceActor(req, res);
    if (!actor) return;
    try {
        const pledge = await FeePledge.findOne({ _id: req.params.id, school: actor.schoolId }).select('student');
        if (!pledge) return res.status(404).json({ message: 'Pledge not found' });
        const student = await Student.findOne({ _id: pledge.student, school: actor.schoolId }).select('paymentHistory');
        if (!student) return res.status(404).json({ message: 'Pledged student not found' });
        const allocated = await FeePledge.distinct('fulfillments.paymentRecordId', { school: actor.schoolId });
        const allocatedIds = new Set(allocated.map(String));
        const payments = (student.paymentHistory || [])
            .filter((payment) => ['Verified', 'Completed'].includes(payment.status) && !allocatedIds.has(String(payment._id)))
            .map((payment) => ({
                id: String(payment._id),
                receiptNumber: payment.receiptNumber,
                reference: payment.mpesaReceiptNumber || payment.transactionId || payment.reference || payment.paymentReference || '',
                amount: Number(payment.amount || 0),
                date: payment.verifiedDate || payment.date,
                method: payment.paymentMethod,
            }));
        return res.json({ payments });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load pledge payment options' });
    }
};

const listProcurementOrders = async (req, res) => {
    const actor = await getFinanceActor(req, res);
    if (!actor) return;
    try {
        const query = { school: actor.schoolId };
        if (['LPO', 'LSO', 'Payment Voucher'].includes(req.query.type)) query.type = req.query.type;
        if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
        const orders = await ProcurementOrder.find(query).sort({ createdAt: -1 }).limit(200).lean();
        return res.json({ orders });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load finance orders' });
    }
};

const createProcurementOrder = async (req, res) => {
    const actor = await getFinanceActor(req, res, { write: true });
    if (!actor) return;
    const { type, supplier, description, amount, currency, transactionReference, note } = req.body;
    const numericAmount = Number(amount);
    if (!['LPO', 'LSO', 'Payment Voucher'].includes(type) || !supplier?.trim() || !description?.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: 'Choose an order type and provide supplier, description, and positive amount' });
    }
    try {
        const reference = req.body.reference?.trim() || `${type === 'Payment Voucher' ? 'PV' : type}-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const order = await ProcurementOrder.create({
            school: actor.schoolId,
            type,
            reference,
            supplier: supplier.trim(),
            description: description.trim(),
            amount: numericAmount,
            currency: currency || 'KES',
            transactionReference: transactionReference || '',
            note: note || '',
            requestedBy: actor.user._id,
        });
        return res.status(201).json({ order });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to create finance order' });
    }
};

const updateProcurementOrderStatus = async (req, res) => {
    const actor = await getFinanceActor(req, res, { write: true });
    if (!actor) return;
    const { status, transactionReference } = req.body;
    if (!['Approved', 'Rejected', 'Paid', 'Cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid finance order status' });
    if (['Approved', 'Paid'].includes(status) && !['Admin', 'SuperAdmin'].includes(actor.role)) {
        return res.status(403).json({ message: 'Only school administrators can approve or mark an order paid' });
    }
    try {
        const order = await ProcurementOrder.findOne({ _id: req.params.id, school: actor.schoolId });
        if (!order) return res.status(404).json({ message: 'Finance order not found' });
        if (status === 'Paid' && !transactionReference?.trim()) return res.status(400).json({ message: 'A payment transaction reference is required' });
        order.status = status;
        if (status === 'Approved') {
            order.approvedBy = actor.user._id;
            order.approvedAt = new Date();
        }
        if (transactionReference !== undefined) order.transactionReference = transactionReference.trim();
        await order.save();
        return res.json({ order });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to update finance order' });
    }
};

module.exports = { listPledges, createPledge, fulfillPledgeFromPayment, listPledgePaymentOptions, listProcurementOrders, createProcurementOrder, updateProcurementOrderStatus };