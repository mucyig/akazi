// File storage. Production: Cloudflare R2 (S3-compatible, private bucket). Local development: a private folder on disk.
// Nothing is ever served publicly by path: files are handed out only through authorised, short-lived links.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { JWT_SECRET, isProd } = require('./env');

const LOCAL_ROOT = path.join(__dirname, '../../uploads');
const FOLDERS = ['resumes', 'documents', 'logos', 'attachments'];
const KEY_RE = /^(resumes|documents|logos|attachments)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/;

const MIME = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const extOf = (key) => path.extname(key).toLowerCase().replace('.', '');
const contentTypeFor = (key) => MIME[extOf(key)] || 'application/octet-stream';
// PDFs and images open in the browser tab, everything else downloads
const dispositionFor = (key) => (['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(extOf(key)) ? 'inline' : 'attachment');

const useR2 = Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
if (!useR2 && isProd) { console.error('[Fatal] Cloudflare R2 is not configured.'); process.exit(1); }

let s3 = null; let S3 = null; let presigner = null;
if (useR2) {
  S3 = require('@aws-sdk/client-s3');
  presigner = require('@aws-sdk/s3-request-presigner');
  s3 = new S3.S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
} else {
  FOLDERS.forEach((d) => fs.mkdirSync(path.join(LOCAL_ROOT, d), { recursive: true }));
  console.log('[Storage] Cloudflare R2 not configured: using the private local folder server/uploads (development only).');
}

// Old records store '/uploads/resumes/x.pdf'. Turn that (or a bare key) into a valid key, or null.
function normalizeKey(v) {
  if (typeof v !== 'string') return null;
  const k = v.trim().replace(/^\/?uploads\//, '').replace(/^\//, '');
  return KEY_RE.test(k) ? k : null;
}
const keyVariants = (key) => [key, `/uploads/${key}`, `uploads/${key}`];

const newKey = (folder, ext) => `${folder}/${crypto.randomBytes(16).toString('hex')}${ext ? '.' + ext : ''}`;

const localPath = (key) => {
  const p = path.join(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error('Bad key');
  return p;
};

async function put(key, buffer) {
  if (!KEY_RE.test(key)) throw new Error('Bad key');
  if (useR2) {
    await s3.send(new S3.PutObjectCommand({
      Bucket: process.env.R2_BUCKET, Key: key, Body: buffer, ContentType: contentTypeFor(key), CacheControl: 'private, max-age=0',
    }));
  } else {
    fs.writeFileSync(localPath(key), buffer);
  }
}

async function remove(keys) {
  for (const key of [].concat(keys)) {
    if (!KEY_RE.test(key)) continue;
    try {
      if (useR2) await s3.send(new S3.DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
      else fs.rmSync(localPath(key), { force: true });
    } catch (e) { console.warn('[Storage] delete failed for', key, e.message); }
  }
}

async function getStream(key) {
  if (useR2) {
    const out = await s3.send(new S3.GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return { stream: out.Body instanceof Readable ? out.Body : Readable.fromWeb(out.Body), size: out.ContentLength };
  }
  const p = localPath(key);
  if (!fs.existsSync(p)) return null;
  return { stream: fs.createReadStream(p), size: fs.statSync(p).size };
}

// Short-lived link to one file. R2: a presigned URL straight from Cloudflare. Local: a signed link to this server.
const LOCAL_SIG = crypto.createHash('sha256').update('file-link:' + JWT_SECRET).digest();
const signLocal = (key, exp) => crypto.createHmac('sha256', LOCAL_SIG).update(`${key}|${exp}`).digest('hex');
function verifyLocalSignature(key, exp, sig) {
  if (!KEY_RE.test(key) || !/^\d+$/.test(String(exp)) || Number(exp) < Date.now()) return false;
  const a = Buffer.from(signLocal(key, exp)); const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function getDownloadUrl(key, { expiresIn = 300 } = {}) {
  const filename = key.split('/').pop();
  if (useR2) {
    const url = await presigner.getSignedUrl(
      s3,
      new S3.GetObjectCommand({
        Bucket: process.env.R2_BUCKET, Key: key,
        ResponseContentType: contentTypeFor(key),
        ResponseContentDisposition: `${dispositionFor(key)}; filename="${filename}"`,
      }),
      { expiresIn }
    );
    return url;
  }
  const exp = Date.now() + expiresIn * 1000;
  return `/api/files/local?${new URLSearchParams({ key, exp: String(exp), sig: signLocal(key, exp) })}`;
}

module.exports = { mode: useR2 ? 'r2' : 'local', FOLDERS, LOCAL_ROOT, KEY_RE, normalizeKey, keyVariants, newKey, put, remove, getStream, getDownloadUrl, verifyLocalSignature, contentTypeFor, dispositionFor, extOf };
