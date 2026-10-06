const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/akazi',
  connectionTimeoutMillis: 10000,
});

let isPgConnected = false;
let fallbackStore = null;
const FALLBACK_DIR = path.join(__dirname, '../../data');
const FALLBACK_FILE = path.join(FALLBACK_DIR, 'db.json');

// Initialize fallback JSON store if needed
function getFallbackStore() {
  if (fallbackStore) return fallbackStore;
  if (!fs.existsSync(FALLBACK_DIR)) {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
  }
  if (fs.existsSync(FALLBACK_FILE)) {
    try {
      fallbackStore = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8'));
      return fallbackStore;
    } catch (e) {
      console.error('[Database] Failed to read fallback store, re-initializing', e);
    }
  }
  fallbackStore = {
    users: [],
    employers: [],
    job_seekers: [],
    jobs: [],
    applications: [],
    notifications: [],
    payments: [],
    _sequences: { users: 0, employers: 0, job_seekers: 0, jobs: 0, applications: 0, notifications: 0, payments: 0 }
  };
  saveFallbackStore();
  return fallbackStore;
}

function saveFallbackStore() {
  if (!fallbackStore) return;
  if (!fs.existsSync(FALLBACK_DIR)) {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
  }
  fs.writeFileSync(FALLBACK_FILE, JSON.stringify(fallbackStore, null, 2), 'utf8');
}

// Check PG connection at startup
async function initDb() {
  try {
    const client = await pool.connect();
    isPgConnected = true;
    console.log('[Database] Successfully connected to PostgreSQL database.');
    
    // Check if schema exists, if not execute schema.sql
    const checkTable = await client.query("SELECT to_regclass('public.users') as exists");
    if (!checkTable.rows[0].exists) {
      console.log('[Database] Initializing PostgreSQL schema...');
      const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      await client.query(schemaSql);
      console.log('[Database] PostgreSQL schema initialized.');
    }

    // Idempotent migration so existing databases gain payment support too
    await client.query(`ALTER TABLE employers ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid';`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        employer_id INTEGER REFERENCES employers(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ref VARCHAR(100) UNIQUE,
        amount INTEGER NOT NULL DEFAULT 5000,
        currency VARCHAR(10) DEFAULT 'RWF',
        phone VARCHAR(50),
        provider VARCHAR(20),
        provider_status VARCHAR(30),
        kind VARCHAR(20) DEFAULT 'CASHIN',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        raw_payload TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_status VARCHAR(30);`);
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS raw_payload TEXT;`);
    client.release();
  } catch (err) {
    isPgConnected = false;
    console.warn(`[Database] PostgreSQL connection failed (${err.message}). Activating local embedded JSON database fallback.`);
    getFallbackStore();
  }
}

// SQL query helper
async function query(text, params = []) {
  if (isPgConnected) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error('[Database] PostgreSQL query error:', err.message, 'SQL:', text);
      throw err;
    }
  }

  // Fallback engine for local zero-config execution
  return executeFallbackQuery(text, params);
}

// Lightweight fallback query handler implementing SQL operations
function executeFallbackQuery(sql, params = []) {
  const store = getFallbackStore();
  const trimmed = sql.trim();
  const lower = trimmed.toLowerCase();

  // 1. SELECT queries
  if (lower.startsWith('select')) {
    let rows = [];

    // Helper to evaluate joins and tables
    if (lower.includes('from users u') || lower.includes('from users left join employers') || (lower.includes('from users') && lower.includes('join employers'))) {
      rows = store.users.map(u => {
        const emp = store.employers.find(e => e.user_id === u.id) || {};
        const js = store.job_seekers.find(j => j.user_id === u.id) || {};
        return {
          ...u,
          company_name: emp.company_name,
          industry: emp.industry,
          website: emp.website,
          employer_location: emp.location,
          contact_person: emp.contact_person,
          description: emp.description,
          logo_url: emp.logo_url,
          registration_doc_url: emp.registration_doc_url,
          national_id: js.national_id,
          date_of_birth: js.date_of_birth,
          education_level: js.education_level,
          seeker_location: js.location,
          headline: js.headline,
          bio: js.bio,
          skills: js.skills,
          resume_url: js.resume_url
        };
      });
    } else if (lower.includes('from users')) {
      rows = [...store.users];
    } else if (lower.includes('from employers e join users u on e.user_id = u.id') || lower.includes('from employers e') || lower.includes('from employers')) {
      rows = store.employers.map(e => {
        const u = store.users.find(user => user.id === e.user_id) || {};
        const jobCount = store.jobs.filter(j => j.employer_id === e.id).length;
        return {
          ...e,
          payment_status: e.payment_status || 'unpaid',
          name: u.name,
          email: u.email,
          phone: u.phone,
          status: u.status,
          role: u.role,
          job_count: jobCount
        };
      });
    } else if (lower.includes('from jobs j') || lower.includes('from jobs')) {
      rows = store.jobs.map(j => {
        const emp = store.employers.find(e => e.id === j.employer_id) || {};
        const u = store.users.find(user => user.id === emp.user_id) || {};
        const appCount = store.applications.filter(a => a.job_id === j.id).length;
        return {
          ...j,
          company_name: emp.company_name,
          logo_url: emp.logo_url,
          employer_description: emp.description,
          employer_website: emp.website,
          employer_location: emp.location,
          employer_user_id: emp.user_id,
          employer_status: u.status,
          applicant_count: appCount
        };
      });
    } else if (lower.includes('from applications a') || lower.includes('from applications')) {
      rows = store.applications.map(a => {
        const j = store.jobs.find(job => job.id === a.job_id) || {};
        const emp = store.employers.find(e => e.id === j.employer_id) || {};
        const u = store.users.find(user => user.id === a.employee_id) || {};
        const js = store.job_seekers.find(seeker => seeker.user_id === a.employee_id) || {};
        return {
          ...a,
          job_title: j.title,
          job_location: j.location,
          job_type: j.job_type,
          salary_range: j.salary_range,
          working_conditions: j.working_conditions,
          company_name: emp.company_name,
          company_logo: emp.logo_url,
          applicant_name: u.name,
          applicant_email: u.email,
          applicant_phone: u.phone,
          applicant_national_id: js.national_id,
          applicant_education: js.education_level,
          applicant_skills: js.skills,
          applicant_headline: js.headline,
          applicant_resume_url: js.resume_url || a.resume_url,
          employer_id: j.employer_id,
          employer_user_id: emp.user_id
        };
      });
    } else if (lower.includes('from notifications')) {
      rows = [...store.notifications];
    } else if (lower.includes('from job_seekers')) {
      rows = [...store.job_seekers];
    } else if (lower.includes('from payments')) {
      rows = store.payments.map(p => ({ ...p }));
    }

    // WHERE filters
    if (lower.includes('where')) {
      if (lower.includes('where id = $1') && (lower.includes('from users') || !lower.includes('from '))) {
        rows = rows.filter(r => r.id === parseInt(params[0], 10));
      } else if (lower.includes('where email = $1') || lower.includes('where lower(email) = lower($1)')) {
        rows = rows.filter(r => (r.email || '').toLowerCase() === String(params[0]).toLowerCase());
      } else if (lower.includes('where u.id = $1')) {
        rows = rows.filter(r => (r.user_id === parseInt(params[0], 10)) || (r.id === parseInt(params[0], 10)));
      } else if (lower.includes('where e.user_id = $1') || lower.includes('where user_id = $1')) {
        rows = rows.filter(r => r.user_id === parseInt(params[0], 10));
      } else if (lower.includes('where j.id = $1') || (lower.includes('where id = $1') && lower.includes('jobs'))) {
        rows = rows.filter(r => r.id === parseInt(params[0], 10));
      } else if (lower.includes('where j.employer_id = $1') || lower.includes('where employer_id = $1')) {
        rows = rows.filter(r => r.employer_id === parseInt(params[0], 10));
      } else if (lower.includes('where a.job_id = $1') || lower.includes('where job_id = $1')) {
        if (lower.includes('employee_id = $2') || lower.includes('a.employee_id = $2')) {
          rows = rows.filter(r => r.job_id === parseInt(params[0], 10) && r.employee_id === parseInt(params[1], 10));
        } else {
          rows = rows.filter(r => r.job_id === parseInt(params[0], 10));
        }
      } else if (lower.includes('where a.employee_id = $1') || lower.includes('where employee_id = $1')) {
        rows = rows.filter(r => r.employee_id === parseInt(params[0], 10));
      } else if (lower.includes('where a.id = $1') || (lower.includes('where id = $1') && lower.includes('applications'))) {
        rows = rows.filter(r => r.id === parseInt(params[0], 10));
      } else if (lower.includes('where n.user_id = $1') || (lower.includes('where user_id = $1') && lower.includes('notifications'))) {
        rows = rows.filter(r => r.user_id === parseInt(params[0], 10));
      } else if (lower.includes('where ref = $1')) {
        rows = rows.filter(r => r.ref === params[0]);
      } else if (lower.includes('where status = $1')) {
        rows = rows.filter(r => r.status === params[0]);
      } else if (lower.includes('where u.status = $1') || lower.includes('where u.role = $1')) {
        if (params.length === 1) {
          rows = rows.filter(r => r.status === params[0] || r.role === params[0]);
        }
      }
    }

    // ORDER BY created_at DESC
    if (lower.includes('order by')) {
      rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    // LIMIT
    const limitMatch = lower.match(/limit\s+(\d+)/);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      rows = rows.slice(0, limit);
    }

    return { rows, rowCount: rows.length };
  }

  // 2. INSERT queries
  if (lower.startsWith('insert into')) {
    const now = new Date().toISOString();
    let tableName = '';
    if (lower.includes('insert into users')) tableName = 'users';
    else if (lower.includes('insert into employers')) tableName = 'employers';
    else if (lower.includes('insert into job_seekers')) tableName = 'job_seekers';
    else if (lower.includes('insert into jobs')) tableName = 'jobs';
    else if (lower.includes('insert into applications')) tableName = 'applications';
    else if (lower.includes('insert into notifications')) tableName = 'notifications';
    else if (lower.includes('insert into payments')) tableName = 'payments';

    if (!tableName) throw new Error(`Unknown table in fallback INSERT: ${sql}`);

    store._sequences[tableName] = (store._sequences[tableName] || 0) + 1;
    const newId = store._sequences[tableName];
    let newRecord = { id: newId, created_at: now, updated_at: now };

    if (tableName === 'users') {
      // (role, status, name, email, password_hash, phone, terms_accepted)
      newRecord = {
        id: newId,
        role: params[0],
        status: params[1],
        name: params[2],
        email: params[3],
        password_hash: params[4],
        phone: params[5] || '',
        terms_accepted: params[6] !== undefined ? !!params[6] : true,
        created_at: now,
        updated_at: now
      };
    } else if (tableName === 'employers') {
      // (user_id, company_name, industry, website, location, contact_person, description, logo_url, registration_doc_url)
      newRecord = {
        id: newId,
        user_id: parseInt(params[0], 10),
        company_name: params[1],
        industry: params[2] || '',
        website: params[3] || '',
        location: params[4] || '',
        contact_person: params[5] || '',
        description: params[6] || '',
        logo_url: params[7] || '',
        registration_doc_url: params[8] || '',
        payment_status: params[9] || 'unpaid',
        created_at: now
      };
    } else if (tableName === 'job_seekers') {
      // (user_id, national_id, date_of_birth, education_level, location, headline, bio, skills, resume_url, portfolio_url)
      newRecord = {
        id: newId,
        user_id: parseInt(params[0], 10),
        national_id: params[1] || '',
        date_of_birth: params[2] || '',
        education_level: params[3] || '',
        location: params[4] || '',
        headline: params[5] || '',
        bio: params[6] || '',
        skills: params[7] || '',
        resume_url: params[8] || '',
        portfolio_url: params[9] || '',
        created_at: now
      };
    } else if (tableName === 'jobs') {
      // (employer_id, title, category, job_type, workplace_type, location, salary_range, working_conditions, responsibilities, description, requirements, benefits, custom_fields, deadline, status)
      newRecord = {
        id: newId,
        employer_id: parseInt(params[0], 10),
        title: params[1],
        category: params[2] || 'Hospitality & Services',
        job_type: params[3] || 'full-time',
        workplace_type: params[4] || 'On-site',
        location: params[5],
        salary_range: params[6] || '',
        working_conditions: params[7] || '',
        responsibilities: params[8] || '',
        description: params[9] || '',
        requirements: params[10] || '',
        benefits: params[11] || '',
        custom_fields: typeof params[12] === 'string' ? JSON.parse(params[12] || '[]') : (params[12] || []),
        deadline: params[13] || null,
        status: params[14] || 'active',
        created_at: now,
        updated_at: now
      };
    } else if (tableName === 'applications') {
      // (job_id, employee_id, submitted_data, uploaded_files, resume_url, status)
      newRecord = {
        id: newId,
        job_id: parseInt(params[0], 10),
        employee_id: parseInt(params[1], 10),
        submitted_data: typeof params[2] === 'string' ? JSON.parse(params[2] || '{}') : (params[2] || {}),
        uploaded_files: typeof params[3] === 'string' ? JSON.parse(params[3] || '[]') : (params[3] || []),
        resume_url: params[4] || '',
        status: params[5] || 'pending',
        rejection_reason: null,
        interview_details: null,
        created_at: now,
        updated_at: now
      };
    } else if (tableName === 'notifications') {
      // (user_id, title, message, type, link)
      newRecord = {
        id: newId,
        user_id: parseInt(params[0], 10),
        title: params[1],
        message: params[2],
        type: params[3],
        link: params[4] || null,
        is_read: false,
        created_at: now
      };
    } else if (tableName === 'payments') {
      // (employer_id, user_id, ref, amount, phone, kind, status)
      newRecord = {
        id: newId,
        employer_id: parseInt(params[0], 10),
        user_id: parseInt(params[1], 10),
        ref: params[2] || null,
        amount: parseInt(params[3], 10),
        currency: 'RWF',
        phone: params[4] || '',
        provider: null,
        kind: params[5] || 'CASHIN',
        status: params[6] || 'pending',
        raw_payload: null,
        created_at: now,
        updated_at: now
      };
    }

    store[tableName].push(newRecord);
    saveFallbackStore();
    return { rows: [newRecord], rowCount: 1 };
  }

  // 3. UPDATE queries
  if (lower.startsWith('update')) {
    let updatedRows = [];
    const now = new Date().toISOString();

    if (lower.includes('update users set status = $1')) {
      const status = params[0];
      const id = parseInt(params[1], 10);
      const user = store.users.find(u => u.id === id);
      if (user) {
        user.status = status;
        user.updated_at = now;
        updatedRows.push(user);
      }
    } else if (lower.includes('update jobs set status = $1')) {
      const status = params[0];
      const id = parseInt(params[1], 10);
      const job = store.jobs.find(j => j.id === id);
      if (job) {
        job.status = status;
        job.updated_at = now;
        updatedRows.push(job);
      }
    } else if (lower.includes('update applications set status = $1, rejection_reason = $2')) {
      const status = params[0];
      const reason = params[1];
      const id = parseInt(params[2], 10);
      const app = store.applications.find(a => a.id === id);
      if (app) {
        app.status = status;
        app.rejection_reason = reason;
        app.updated_at = now;
        updatedRows.push(app);
      }
    } else if (lower.includes('update applications set status = $1, interview_details = $2')) {
      const status = params[0];
      const interview = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
      const id = parseInt(params[2], 10);
      const app = store.applications.find(a => a.id === id);
      if (app) {
        app.status = status;
        app.interview_details = interview;
        app.updated_at = now;
        updatedRows.push(app);
      }
    } else if (lower.includes('update notifications set is_read = true where user_id = $1')) {
      const userId = parseInt(params[0], 10);
      store.notifications.forEach(n => {
        if (n.user_id === userId) n.is_read = true;
      });
      return { rows: [], rowCount: 1 };
    } else if (lower.includes('update notifications set is_read = true where id = $1')) {
      const id = parseInt(params[0], 10);
      const n = store.notifications.find(item => item.id === id);
      if (n) n.is_read = true;
      return { rows: [], rowCount: 1 };
    } else if (lower.includes('update employers set payment_status = $1')) {
      const status = params[0];
      const id = parseInt(params[1], 10);
      const emp = store.employers.find(e => e.id === id);
      if (emp) {
        emp.payment_status = status;
        emp.updated_at = now;
        updatedRows.push(emp);
      }
    } else if (lower.includes('update payments set status = $1, provider = $2, provider_status = $3, raw_payload = $4 where ref = $5')) {
      const status = params[0];
      const provider = params[1];
      const providerStatus = params[2];
      const rawPayload = params[3];
      const ref = params[4];
      const payment = store.payments.find(p => p.ref === ref);
      if (payment) {
        payment.status = status;
        payment.provider = provider || null;
        payment.provider_status = providerStatus || null;
        payment.raw_payload = rawPayload || null;
        payment.updated_at = now;
        updatedRows.push(payment);
      }
    } else if (lower.includes('update payments set status = $1, provider = $2')) {
      const status = params[0];
      const provider = params[1];
      const ref = params[2];
      const payment = store.payments.find(p => p.ref === ref);
      if (payment) {
        payment.status = status;
        payment.provider = provider || null;
        payment.updated_at = now;
        updatedRows.push(payment);
      }
    }

    saveFallbackStore();
    return { rows: updatedRows, rowCount: updatedRows.length };
  }

  // 4. DELETE queries
  if (lower.startsWith('delete from')) {
    let deletedCount = 0;
    if (lower.includes('delete from jobs where id = $1')) {
      const id = parseInt(params[0], 10);
      const initLen = store.jobs.length;
      store.jobs = store.jobs.filter(j => j.id !== id);
      store.applications = store.applications.filter(a => a.job_id !== id);
      deletedCount = initLen - store.jobs.length;
    } else if (lower.includes('delete from users where id = $1')) {
      const id = parseInt(params[0], 10);
      store.users = store.users.filter(u => u.id !== id);
      store.employers = store.employers.filter(e => e.user_id !== id);
      store.job_seekers = store.job_seekers.filter(j => j.user_id !== id);
      deletedCount = 1;
    }
    saveFallbackStore();
    return { rows: [], rowCount: deletedCount };
  }

  return { rows: [], rowCount: 0 };
}

module.exports = {
  pool,
  query,
  initDb,
  getFallbackStore,
  saveFallbackStore
};
