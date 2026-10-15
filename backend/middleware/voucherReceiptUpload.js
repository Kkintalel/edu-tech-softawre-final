const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');

const privateRoot = path.resolve(__dirname, '../private-uploads/vouchers');
const allowedTypes = new Map([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
    ['application/pdf', '.pdf'],
]);

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        const { schoolId, voucherId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(voucherId)) {
            return callback(new Error('Invalid school or voucher ID'));
        }
        const destination = path.join(privateRoot, String(schoolId), String(voucherId));
        try {
            fs.mkdirSync(destination, { recursive: true });
            callback(null, destination);
        } catch (error) {
            callback(error);
        }
    },
    filename: (req, file, callback) => {
        const extension = allowedTypes.get(file.mimetype);
        if (!extension) return callback(new Error('Only PDF, JPEG, PNG, or WebP receipts are allowed'));
        callback(null, `${crypto.randomUUID()}${extension}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 12 * 1024 * 1024, files: 10 },
    fileFilter: (req, file, callback) => {
        if (!allowedTypes.has(file.mimetype)) {
            return callback(new Error('Only PDF, JPEG, PNG, or WebP receipts are allowed'));
        }
        return callback(null, true);
    },
});

const uploadVoucherReceipts = (req, res, next) => {
    upload.array('receipts', 10)(req, res, (error) => {
        if (error) return res.status(400).json({ message: error.message || 'Receipt upload failed' });
        next();
    });
};

const validateReceiptFile = async (file) => {
    const handle = await fs.promises.open(file.path, 'r');
    try {
        const header = Buffer.alloc(12);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        const bytes = header.subarray(0, bytesRead);
        const valid = file.mimetype === 'application/pdf'
            ? bytes.subarray(0, 5).toString('ascii') === '%PDF-'
            : file.mimetype === 'image/jpeg'
                ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
                : file.mimetype === 'image/png'
                    ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
                    : file.mimetype === 'image/webp'
                        ? bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
                        : false;
        if (!valid) throw new Error('Receipt file content does not match its declared type');
    } finally {
        await handle.close();
    }
};

module.exports = { privateRoot, uploadVoucherReceipts, validateReceiptFile };