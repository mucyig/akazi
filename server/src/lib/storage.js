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
// All files download as attachment for safety
const dispositionFor = () => 'attachment';

const bucket = process.env.B2_BUCKET || process.env.STORAGE_BUCKET || process.env.R2_BUCKET;
const accessKeyId = process.env.B2_KEY_ID || process.env.B2_APPLICATION_KEY_ID || process.env.STORAGE_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.B2_APPLICATION_KEY || process.env.STORAGE_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
let endpoint = process.env.B2_ENDPOINT || process.env.STORAGE_ENDPOINT || process.env.R2_ENDPOINT;

if (!endpoint && process.env.R2_ACCOUNT_ID) {
  endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

if (endpoint && !/^https?:\/\//i.test(endpoint)) {
  endpoint = `https://${endpoint}`;
}

let region = process.env.B2_REGION || process.env.STORAGE_REGION || 'auto';
if (endpoint && region === 'auto') {
  const match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  if (match) region = match[1];
}

const useCloud = Boolean(bucket && accessKeyId && secretAccessKey && endpoint);
const providerName = process.env.B2_BUCKET || process.env.B2_APPLICATION_KEY ? 'Backblaze B2' : (process.env.R2_BUCKET ? 'Cloudflare R2' : 'S3 Storage');

let s3 = null; let S3 = null; let presigner = null;
if (useCloud) {
  S3 = require('@aws-sdk/client-s3');
  presigner = require('@aws-sdk/s3-request-presigner');
  s3 = new S3.S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  console.log(`[Storage] Connected to ${providerName} (bucket: ${bucket}, endpoint: ${endpoint}).`);
} else {
  FOLDERS.forEach((d) => fs.mkdirSync(path.join(LOCAL_ROOT, d), { recursive: true }));
  console.log('[Storage] Cloud storage not configured: using private local folder server/uploads' + (isProd ? ' (files will be ephemeral on Render until Backblaze B2 is added).' : '.'));
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
  if (useCloud) {
    await s3.send(new S3.PutObjectCommand({
      Bucket: bucket, Key: key, Body: buffer, ContentType: contentTypeFor(key), CacheControl: 'private, max-age=0',
    }));
  } else {
    fs.writeFileSync(localPath(key), buffer);
  }
}

async function remove(keys) {
  for (const key of [].concat(keys)) {
    if (!KEY_RE.test(key)) continue;
    try {
      if (useCloud) await s3.send(new S3.DeleteObjectCommand({ Bucket: bucket, Key: key }));
      else fs.rmSync(localPath(key), { force: true });
    } catch (e) { console.warn('[Storage] delete failed for', key, e.message); }
  }
}

async function getStream(key) {
  if (useCloud) {
    try {
      const out = await s3.send(new S3.GetObjectCommand({ Bucket: bucket, Key: key }));
      return { stream: out.Body instanceof Readable ? out.Body : Readable.fromWeb(out.Body), size: out.ContentLength };
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }
  const p = localPath(key);
  if (!fs.existsSync(p)) return null;
  return { stream: fs.createReadStream(p), size: fs.statSync(p).size };
}

// Short-lived link to one file. Presigned URL from Backblaze B2 / R2. Local: a signed link to this server.
const LOCAL_SIG = crypto.createHash('sha256').update('file-link:' + JWT_SECRET).digest();
const signLocal = (key, exp) => crypto.createHmac('sha256', LOCAL_SIG).update(`${key}|${exp}`).digest('hex');
function verifyLocalSignature(key, exp, sig) {
  if (!KEY_RE.test(key) || !/^\d+$/.test(String(exp)) || Number(exp) < Date.now()) return false;
  const a = Buffer.from(signLocal(key, exp)); const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function getDownloadUrl(key, { expiresIn = 300 } = {}) {
  const filename = key.split('/').pop();
  if (useCloud) {
    try {
      await s3.send(new S3.HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        // If file exists locally on disk (e.g. from seed data), upload it to bucket on the fly
        const p = path.join(LOCAL_ROOT, key);
        if (fs.existsSync(p)) {
          try {
            await put(key, fs.readFileSync(p));
            console.log(`[Storage] Auto-synced local file to B2: ${key}`);
          } catch (uploadErr) {
            console.warn('[Storage] Auto-upload to B2 failed:', uploadErr.message);
            return null;
          }
        } else {
          return null; // Object does not exist in bucket or disk
        }
      } else {
        console.warn('[Storage] HeadObject check warning:', err.message);
      }
    }

    const url = await presigner.getSignedUrl(
      s3,
      new S3.GetObjectCommand({
        Bucket: bucket, Key: key,
        ResponseContentType: contentTypeFor(key),
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
      { expiresIn }
    );
    return url;
  }
  const exp = Date.now() + expiresIn * 1000;
  return `/api/files/local?${new URLSearchParams({ key, exp: String(exp), sig: signLocal(key, exp) })}`;
}

module.exports = { mode: useCloud ? 's3' : 'local', FOLDERS, LOCAL_ROOT, KEY_RE, normalizeKey, keyVariants, newKey, put, remove, getStream, getDownloadUrl, verifyLocalSignature, contentTypeFor, dispositionFor, extOf };
