-- Akazi schema (PostgreSQL). Idempotent: safe to run on every start. It never drops anything.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','employer','employee')),
  status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected','suspended')),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  terms_accepted BOOLEAN DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  website VARCHAR(255),
  location VARCHAR(255),
  contact_person VARCHAR(255),
  description TEXT,
  logo_url TEXT,
  registration_doc_url TEXT,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending','paid','failed')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

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
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  raw_payload TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_seekers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gender VARCHAR(20) DEFAULT 'other',
  date_of_birth VARCHAR(50),
  education_level VARCHAR(100),
  location VARCHAR(255),
  headline VARCHAR(255),
  bio TEXT,
  skills TEXT,
  resume_url TEXT,
  portfolio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  workplace_type VARCHAR(50) DEFAULT 'On-site',
  location VARCHAR(255) NOT NULL,
  salary_range VARCHAR(100),
  working_conditions TEXT,
  responsibilities TEXT,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  benefits TEXT,
  custom_fields JSONB DEFAULT '[]'::jsonb,
  deadline DATE,
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','closed','removed')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_data JSONB DEFAULT '{}'::jsonb,
  uploaded_files JSONB DEFAULT '[]'::jsonb,
  resume_url TEXT,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  interview_details JSONB DEFAULT NULL,
  interview_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ,
  result_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_job_employee UNIQUE (job_id, employee_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  link VARCHAR(255),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Single-use, expiring tokens for password reset and email verification (only the SHA-256 hash is stored)
CREATE TABLE IF NOT EXISTS auth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('reset','verify')),
  token_hash CHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER,
  action VARCHAR(60) NOT NULL,
  target_type VARCHAR(40),
  target_id VARCHAR(255),
  meta JSONB DEFAULT '{}'::jsonb,
  ip VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_active_created ON jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_employee ON applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_status ON applications(job_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_emp_status ON applications(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_employer ON payments(employer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_chat_app ON chat_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_chat_app_created ON chat_messages(application_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
