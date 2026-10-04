require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const { initDb, query } = require('./db');
const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const applicationsRoutes = require('./routes/applications');
const employersRoutes = require('./routes/employers');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');
const paymentsRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 5000;

const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('akazi_super_secure'))) {
  console.error('[Fatal] Set a strong, unique JWT_SECRET in server/.env before running in production.');
  process.exit(1);
}
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      frameSrc: ["'self'"],
      objectSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

// Safety net: password hashes can never leave the server, whatever a route returns
const SECRET_KEYS = new Set(['password_hash', 'password']);
const scrub = (v) => {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out = {};
    for (const [k, val] of Object.entries(v)) if (!SECRET_KEYS.has(k)) out[k] = scrub(val);
    return out;
  }
  return v;
};
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => json(scrub(body));
  next();
});
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 3000, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Please try again in a few minutes.' } });
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register-employee', authLimiter);
app.use('/api/auth/register-employer', authLimiter);

// Enable CORS (locked to CLIENT_URL in production; the built site is same-origin anyway)
app.use(cors({
  origin: isProd ? (process.env.CLIENT_URL || false) : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Capture the raw body so PayPack webhook signatures (HMAC of the raw payload) can be verified
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static file serving for uploads (resumes, documents, logos)
const uploadsPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    // If it's a PDF, allow inline viewing or download
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
  }
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Akazi Backend API'
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const [jobsRes, employersRes] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM jobs WHERE status = $1', ['active']),
      query('SELECT COUNT(*)::int AS count FROM users WHERE role = $1 AND status = $2', ['employer', 'approved'])
    ]);

    res.json({
      stats: {
        activeJobs: Number(jobsRes.rows[0]?.count || 0),
        approvedEmployers: Number(employersRes.rows[0]?.count || 0),
      }
    });
  } catch (err) {
    console.error('Platform stats error:', err);
    res.status(500).json({ message: 'Failed to retrieve platform stats.', error: err.message });
  }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/employers', employersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentsRoutes);

// Safe secure file downloader endpoint
app.get('/api/files/download', (req, res) => {
  try {
    const rawPath = req.query.file;
    if (!rawPath) return res.status(400).json({ message: 'File query parameter is required.' });

    // Sanitize path to prevent directory traversal
    const cleanRelative = rawPath.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
    const safePath = path.normalize(cleanRelative).replace(/^(\.\.[\/\\])+/, '');
    const absolutePath = path.join(uploadsPath, safePath);

    if (!absolutePath.startsWith(uploadsPath) || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Requested file not found or access restricted.' });
    }

    res.download(absolutePath);
  } catch (e) {
    res.status(500).json({ message: 'Error retrieving file.' });
  }
});

// Serve the built React site (client/dist) with SPA fallback
const distPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// Central Error Handler
app.use((err, req, res, next) => {
  // Client mistakes (bad JSON, too-large or rejected uploads) get a short 4xx; everything else is hidden.
  const clientErr = err.type === 'entity.parse.failed' ? 'Invalid request body.'
    : err.type === 'entity.too.large' ? 'Request is too large.'
    : err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 10 MB.'
    : err.name === 'MulterError' ? 'Invalid file upload.'
    : err.status && err.status < 500 ? err.message : null;
  if (clientErr) return res.status(err.status || 400).json({ message: clientErr });
  console.error('[Server Error]', err);
  res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
});

// Start Server & Initialize Database
async function startServer() {
  await initDb();

  // Run PDF generator to make sure sample files are present
  try {
    require('./db/makePdfs');
  } catch (e) {
    console.warn('PDF generator notice:', e.message);
  }

  // Check if DB is empty, if so, auto-seed
  try {
    const userCheck = await query('SELECT count(*) as count FROM users');
    const count = parseInt(userCheck.rows[0]?.count || 0, 10);
    if (count === 0) {
      console.log('[Startup] Database is empty. Running automatic seed...');
      const { seed } = require('./db/seed');
      await seed();
    }
  } catch (e) {
    console.warn('[Startup] Could not check users count, running seed if needed', e.message);
    try {
      const { seed } = require('./db/seed');
      await seed();
    } catch (seedErr) {
      console.error('[Startup] Seed error:', seedErr);
    }
  }

  app.listen(PORT, () => {
    console.log(`[Akazi Server] Running on http://localhost:${PORT}`);
    console.log(`[Akazi Server] API endpoints available at http://localhost:${PORT}/api`);
  });
}

startServer().catch(err => {
  console.error('[Startup Error]', err);
});
