const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const { isProd, CLIENT_URL, PROXY_SECRET } = require('./lib/env');
const { query } = require('./db');
const storage = require('./lib/storage');
const { TZ } = require('./lib/time');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === undefined ? 1 : (isNaN(Number(process.env.TRUST_PROXY)) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY)));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(compression());

// The real visitor address. Only trusted when the request carries the secret that our Cloudflare Worker adds,
// so nobody can fake it by calling the API directly.
const safeEqual = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
app.use((req, res, next) => {
  const sent = req.headers['x-proxy-secret'];
  const ip = req.headers['x-real-client-ip'];
  req.clientIp = (PROXY_SECRET && typeof sent === 'string' && typeof ip === 'string' && safeEqual(sent, PROXY_SECRET)) ? ip.slice(0, 64) : req.ip;
  next();
});

// Safety net for every JSON response: password hashes never leave the server, and stored logo keys become public URLs
const SECRET_KEYS = new Set(['password_hash', 'password', 'failed_logins', 'locked_until', 'raw_payload']);
const LOGO_KEYS = new Set(['logo_url', 'company_logo']);
const scrub = (v) => {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (SECRET_KEYS.has(k)) continue;
      if (LOGO_KEYS.has(k) && typeof val === 'string' && val && !/^https?:/i.test(val)) {
        const key = storage.normalizeKey(val);
        out[k] = key ? `/api/files/public/${key}` : null;
      } else out[k] = scrub(val);
    }
    return out;
  }
  return v;
};
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => json(scrub(body));
  next();
});

const apiKey = (req) => req.clientIp || req.ip;
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 3000, standardHeaders: true, legacyHeaders: false, keyGenerator: apiKey });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, keyGenerator: apiKey, message: { message: 'Too many attempts. Please try again in a few minutes.' } });
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register-employee', authLimiter);
app.use('/api/auth/register-employer', authLimiter);

app.use(cors({
  origin: isProd ? CLIENT_URL : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Keep the raw body so PayPack webhook signatures can be verified
app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API answers are never cached by browsers or proxies
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Akazi Backend API' }));

// The server's clock in Rwanda time: the browser uses it instead of the device clock
app.get('/api/time', (req, res) => res.json({ now: new Date().toISOString(), timezone: TZ }));

app.get('/api/stats', async (req, res) => {
  try {
    const [jobsRes, employersRes] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM jobs j JOIN employers e ON e.id = j.employer_id JOIN users u ON u.id = e.user_id
             WHERE j.status = 'active' AND u.status = 'approved' AND (j.deadline IS NULL OR j.deadline >= (NOW() AT TIME ZONE 'Africa/Kigali')::date)`),
      query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'employer' AND status = 'approved'"),
    ]);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ stats: { activeJobs: jobsRes.rows[0].count, approvedEmployers: employersRes.rows[0].count } });
  } catch (err) {
    console.error('Platform stats error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve platform stats.' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/employers', require('./routes/employers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/files', require('./routes/files'));
app.use('/api/v1', require('./routes/apiV1'));
app.use('/api/developer', require('./routes/developer'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

// Serve the built React site (client/dist) with SPA fallback
const distPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// Central error handler: clients get short 4xx messages, everything else is hidden
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const clientErr = err.type === 'entity.parse.failed' ? 'Invalid request body.'
    : err.type === 'entity.too.large' ? 'Request is too large.'
    : err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 10 MB.'
    : err.name === 'MulterError' ? 'Invalid file upload.'
    : err.status && err.status < 500 ? err.message : null;
  if (clientErr) return res.status(err.status && err.status < 500 ? err.status : 400).json({ message: clientErr });
  console.error('[Error]', err.stack || err.message);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

module.exports = app;
