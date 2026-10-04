const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

// Base uploads directory
const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const DIRS = ['resumes', 'documents', 'logos', 'attachments'];

DIRS.forEach(dir => {
  const dirPath = path.join(UPLOAD_ROOT, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subfolder = 'attachments';
    if (file.fieldname === 'resume') {
      subfolder = 'resumes';
    } else if (file.fieldname === 'logo') {
      subfolder = 'logos';
    } else if (file.fieldname === 'registration_doc') {
      subfolder = 'documents';
    }
    cb(null, path.join(UPLOAD_ROOT, subfolder));
  },
  filename: (req, file, cb) => {
    // Unguessable name; extension is limited to the allow-list below
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `${file.fieldname}-${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    cb(null, true);
  } else {
    const e = new Error('File type is not supported. Upload a PDF, Word document, or image (PNG, JPG, WEBP).');
    e.status = 400;
    cb(e);
  }
};

const rawUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

// Check the real file signature so a renamed file cannot slip through
const SIGNATURES = {
  pdf: [Buffer.from('%PDF')],
  png: [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  jpg: [Buffer.from([0xff, 0xd8, 0xff])],
  jpeg: [Buffer.from([0xff, 0xd8, 0xff])],
  webp: [Buffer.from('RIFF')],
  doc: [Buffer.from([0xd0, 0xcf, 0x11, 0xe0])],
  docx: [Buffer.from('PK')],
};
function verifyUploads(req, res, next) {
  const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
  for (const f of files) {
    const ext = path.extname(f.filename).toLowerCase().replace('.', '');
    let ok = false;
    try {
      const fd = fs.openSync(f.path, 'r');
      const head = Buffer.alloc(8);
      fs.readSync(fd, head, 0, 8, 0);
      fs.closeSync(fd);
      ok = (SIGNATURES[ext] || []).some((sig) => head.subarray(0, sig.length).equals(sig));
    } catch (e) { ok = false; }
    if (!ok) {
      files.forEach((x) => fs.unlink(x.path, () => {}));
      return res.status(400).json({ message: 'One of the files is not a valid document or image.' });
    }
  }
  next();
}
const upload = {
  single: (...a) => [rawUpload.single(...a), verifyUploads],
  fields: (...a) => [rawUpload.fields(...a), verifyUploads],
  array: (...a) => [rawUpload.array(...a), verifyUploads],
};

// Helper to convert filename to public URL path
function getPublicUrl(req, filename, subfolder) {
  if (!filename) return null;
  // If already absolute or URL, return as is
  if (filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('/uploads/')) {
    return filename;
  }
  return `/uploads/${subfolder}/${filename}`;
}

module.exports = {
  upload,
  UPLOAD_ROOT,
  getPublicUrl
};
