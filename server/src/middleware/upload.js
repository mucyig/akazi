// Uploads are received in memory, checked, and only then written to storage (R2 or the private local folder).
// Nothing touches disk or the bucket until the request has passed validation.
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const storage = require('../lib/storage');
const { query } = require('../db');
const { audit } = require('../lib/audit');
const { inspectFile } = require('../lib/filescan');
const { scanBuffer } = require('../lib/scanner');

const ALLOWED = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'];
const MAX_BYTES = 10 * 1024 * 1024;

const rawUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 6, fields: 60, fieldSize: 200 * 1024, parts: 80 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (ALLOWED.includes(ext)) return cb(null, true);
    const e = new Error('File type is not supported. Upload a PDF, Word document (.docx), or image (PNG, JPG, WEBP).');
    e.status = 400;
    cb(e);
  },
});

const startsWith = (buf, bytes, offset = 0) => buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const SIGNATURES = {
  pdf: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]),
  png: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  jpeg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  webp: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  docx: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) && b.includes(Buffer.from('word/')),
};

const filesOf = (req) => (req.file ? [req.file] : Object.values(req.files || {}).flat());

// The real file content must match the claimed type, so a renamed file cannot slip through.
// inspectFile runs immediately after signature check for content safety.
async function verifyUploads(req, res, next) {
  try {
    for (const f of filesOf(req)) {
      const ext = path.extname(f.originalname).toLowerCase().replace('.', '');
      if (!f.buffer || f.buffer.length < 8 || !(SIGNATURES[ext] && SIGNATURES[ext](f.buffer))) {
        return res.status(400).json({ message: 'One of the files is not a valid document or image.' });
      }
      const inspection = await inspectFile(f.buffer, ext);
      if (!inspection.ok) {
        return res.status(400).json({
          message: 'The uploaded file failed security validation: ' + (inspection.reason || 'unsupported or unsafe content.'),
        });
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

const upload = {
  single: (...a) => [rawUpload.single(...a), verifyUploads],
  fields: (...a) => [rawUpload.fields(...a), verifyUploads],
};

// Writes one validated upload to storage, records file_scans, runs the scanner,
// and fails with 400 if infected. Returns its key (e.g. "resumes/ab12....pdf").
async function storeUpload(file, folder, req = null) {
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  file.sha256 = sha256;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const key = storage.newKey(folder, ext);

  await storage.put(key, file.buffer);
  await query('INSERT INTO file_scans (key, sha256, status) VALUES ($1, $2, $3)', [key, sha256, 'pending']);

  const scanResult = await scanBuffer(file.buffer);
  const scanStatus = scanResult.status || 'error';
  await query(
    'UPDATE file_scans SET status = $1, scanned_at = NOW(), detail = $2 WHERE key = $3',
    [scanStatus, scanResult.detail || null, key]
  );

  if (scanStatus === 'infected') {
    await storage.remove(key);
    await audit(req, 'file.infected', 'file', key, { sha256, detail: scanResult.detail });
    const err = new Error('The uploaded file was flagged as infected or unsafe.');
    err.status = 400;
    throw err;
  }

  return key;
}

module.exports = { upload, storeUpload, MAX_BYTES, ALLOWED, SIGNATURES };
