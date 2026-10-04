-- Akazi Job Platform Database Schema (PostgreSQL)

DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS job_seekers CASCADE;
DROP TABLE IF EXISTS employers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employer', 'employee')),
    status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    terms_accepted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Employers Table
CREATE TABLE employers (
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
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2b. Payments Table (PayPack mobile money transactions - verification fee)
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    employer_id INTEGER REFERENCES employers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ref VARCHAR(100) UNIQUE,
    amount INTEGER NOT NULL DEFAULT 5000,
    currency VARCHAR(10) DEFAULT 'RWF',
    phone VARCHAR(50),
    provider VARCHAR(20),
    kind VARCHAR(20) DEFAULT 'CASHIN',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    raw_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Job Seekers Table
CREATE TABLE job_seekers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    national_id VARCHAR(50),
    date_of_birth VARCHAR(50),
    education_level VARCHAR(100),
    location VARCHAR(255),
    headline VARCHAR(255),
    bio TEXT,
    skills TEXT,
    resume_url TEXT,
    portfolio_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Jobs Table
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    job_type VARCHAR(50) NOT NULL, -- full-time, part-time, contract, temporary
    workplace_type VARCHAR(50) DEFAULT 'On-site',
    location VARCHAR(255) NOT NULL,
    salary_range VARCHAR(100),
    working_conditions TEXT,
    responsibilities TEXT,
    description TEXT NOT NULL,
    requirements TEXT NOT NULL,
    benefits TEXT,
    custom_fields JSONB DEFAULT '[]'::jsonb, -- custom questions/extra uploads needed
    deadline DATE,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'removed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Applications Table
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submitted_data JSONB DEFAULT '{}'::jsonb, -- answers to custom fields, cover letter, etc.
    uploaded_files JSONB DEFAULT '[]'::jsonb, -- extra files [{name, url, type, size}]
    resume_url TEXT,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    interview_details JSONB DEFAULT NULL, -- {date, time, timezone, format, location_or_link, interviewer, notes}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_job_employee UNIQUE (job_id, employee_id)
);

-- 6. Notifications Table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_category ON jobs(category);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_employee ON applications(employee_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_payments_employer ON payments(employer_id);
CREATE INDEX idx_payments_ref ON payments(ref);
CREATE INDEX idx_payments_status ON payments(status);
