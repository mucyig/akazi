// Uploads are received in memory, checked, and only then written to storage (R2 or the private local folder).
// Nothing touches disk or the bucket until the request has passed validation.
const path = require('path');
const multer = require('multer');
const storage = require('../lib/storage');

const ALLOWED = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp'];
const MAX_BYTES = 10 * 1024 * 1024;

const rawUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 6, fields: 60, fieldSize: 200 * 1024, parts: 80 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (ALLOWED.includes(ext)) return cb(null, true);
    const e = new Error('File type is not supported. Upload a PDF, Word document, or image (PNG, JPG, WEBP).');
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
  doc: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  docx: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) && b.includes(Buffer.from('word/')),
};

const filesOf = (req) => (req.file ? [req.file] : Object.values(req.files || {}).flat());

// The real file content must match the claimed type, so a renamed file cannot slip through
function verifyUploads(req, res, next) {
  for (const f of filesOf(req)) {
    const ext = path.extname(f.originalname).toLowerCase().replace('.', '');
    if (!f.buffer || f.buffer.length < 8 || !(SIGNATURES[ext] && SIGNATURES[ext](f.buffer))) {
      return res.status(400).json({ message: 'One of the files is not a valid document or image.' });
    }
  }
  next();
}

const upload = {
  single: (...a) => [rawUpload.single(...a), verifyUploads],
  fields: (...a) => [rawUpload.fields(...a), verifyUploads],
};

// Writes one validated upload to storage and returns its key (e.g. "resumes/ab12....pdf")
async function storeUpload(file, folder) {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const key = storage.newKey(folder, ext);
  await storage.put(key, file.buffer);
  return key;
}

module.exports = { upload, storeUpload, MAX_BYTES };
