# Changelog & System Modifications

This document tracks all architectural, functional, security, and schema changes applied to the Akazi platform.

---

## 1. Identity & Privacy Overhaul (National ID Removal & Gender/Sex Addition)

### Rationale
To comply with modern data privacy regulations, minimize identity theft risks, and reduce candidate friction, all requirements for National Identity Numbers (`national_id`) were completely removed from the system for both job seekers, employers, and administrators. It was replaced with gender/sex collection to support demographic matching, employer preferences, and reporting.

### Details of Changes:
- **Database Schema**:
  - Removed `national_id` column from `job_seekers` table.
  - Added `gender` column (`VARCHAR(20) NOT NULL DEFAULT 'male'`) with values: `'male'`, `'female'`, `'other'`.
  - Removed `national_id` from default seed files and demo datasets.
- **Job Seeker Registration ([`client/src/pages/Register.jsx`](file:///D:/akazi-main/client/src/pages/Register.jsx))**:
  - Removed National ID input field.
  - Added Gender / Sex selection radio/dropdown buttons (`Male`, `Female`, `Other / Prefer not to say`).
- **Backend Auth Endpoints ([`server/src/routes/auth.js`](file:///D:/akazi-main/server/src/routes/auth.js))**:
  - Removed all `national_id` validation logic in `/api/auth/register-employee`.
  - Stored `gender` in both `users` and `job_seekers` database records.
- **Employer Job Posting ([`client/src/pages/EmployerDashboard.jsx`](file:///D:/akazi-main/client/src/pages/EmployerDashboard.jsx))**:
  - Removed "Require National ID" requirement checkbox from custom application fields.
- **Candidate Profiles & Job Seeker Dashboard ([`client/src/pages/SeekerDashboard.jsx`](file:///D:/akazi-main/client/src/pages/SeekerDashboard.jsx))**:
  - Removed National ID display badges and cards.
  - Replaced with candidate Gender / Sex tag.
- **Admin Management ([`client/src/pages/AdminDashboard.jsx`](file:///D:/akazi-main/client/src/pages/AdminDashboard.jsx))**:
  - Removed National ID columns and search filters from employee lists.
  - Replaced with candidate Gender badge (`Male` / `Female` / `Other`).

---

## 2. Gender Immutability on Job Application

### Rationale
To prevent identity spoofing, duplicate applications under altered demographics, or inconsistent applicant records, candidates cannot change their gender during the application process. The gender chosen at registration is authoritative and permanent for all job submissions.

### Details of Changes:
- **Easy Apply Modal ([`client/src/components/ApplyModal.jsx`](file:///D:/akazi-main/client/src/components/ApplyModal.jsx))**:
  - **Step 1 (Candidate Information)**: Replaced the editable `<select>` dropdown with a read-only, locked input showing the registered profile gender (`profile.gender` or `user.gender`).
  - Added visual locked indicator and badge (`From profile (locked)`).
  - Added explanatory helper text notifying users that gender is tied to their registration profile.
  - **Step 3 (Review & Confirm)**: Updated application summary to display the locked profile gender.
  - Automatically bound `gender: userGender` into the submission payload.
- **Backend API Enforcement ([`server/src/routes/applications.js`](file:///D:/akazi-main/server/src/routes/applications.js))**:
  - `POST /api/applications` queries `job_seekers` by `user_id` upon submission.
  - Explicitly overrides any incoming `submitted_data.gender` with `seekerProfile.gender` from the database.
  - Guarantees server-side immutability even if client requests are altered via external tools (curl/Postman).

---

## 3. Bilingual Localization (English & Kinyarwanda)

### Details of Changes:
- Updated [`client/src/i18n/translations.js`](file:///D:/akazi-main/client/src/i18n/translations.js):
  - Added gender labels: `male`, `female`, `otherGender`.
  - Added gender locked notices: `genderLocked` ("From profile (locked)" / "Ku mwirondoro (nticyahindurwa)").
  - Added guidance text: `genderLockedHelp` ("Gender is set from your registration profile and cannot be changed here." / "Igitsina cyashyizweho igihe wiyandikishaga kandi ntigishobora guhindurwa hano.").
  - Maintained consistent translations across both English (`en`) and Kinyarwanda (`rw`).

---

## 4. Security & Environment Configuration

### Details of Changes:
- **Environment Configuration ([`server/.env`](file:///D:/akazi-main/server/.env))**:
  - Configured `NODE_ENV=development` for local workflow.
  - Generated and installed a cryptographic 48-byte hexadecimal `JWT_SECRET`.
  - Configured `CLIENT_URL=http://localhost:5173` to match Vite development server.
- **Backend Server Availability**:
  - Resolved `ECONNREFUSED` Vite proxy issues by ensuring the backend Express API runs on port 5000 and connects to PostgreSQL.
- **Sensitive Data Scrubbing ([`server/src/index.js`](file:///D:/akazi-main/server/src/index.js))**:
  - Implemented automatic JSON response scrubbing to guarantee `password` and `password_hash` fields can never leak through any API response.
- **Rate Limiting**:
  - Configured rate limiters on `/api` (3,000 requests/15m) and authentication routes (40 requests/15m).
- **Upload Hardening ([`server/src/middleware/upload.js`](file:///D:/akazi-main/server/src/middleware/upload.js))**:
  - Implemented magic-byte header verification (PDF, PNG, JPG, WEBP, DOC, DOCX) to block extension spoofing.
  - Enforced unguessable 32-character hexadecimal filenames.


---

## Security, storage, email and Rwanda-time overhaul

- **Config:** server refuses to start without a strong `JWT_SECRET` and PostgreSQL; JSON fallback database and startup auto-seed (which could wipe data) removed; seed is local-only and needs `--reset`.
- **Auth:** forgot/reset password, change password, email confirmation (Resend), per-account lockout, timing-safe login, sessions end on password change, 3-day tokens.
- **Files:** private storage (Cloudflare R2, local folder in development), keys in the database, permission-checked 5-minute links, uploads validated in memory before saving. Public `/uploads` and `/api/files/download` removed.
- **Payments:** mandatory webhook secret, API re-verification, amount check, replay and downgrade protection, one pending payment at a time.
- **Results alert:** red dot on "My applications" when an employer's decision or interview arrives (plus a short email).
- **Time:** everything in Rwanda time from the server clock; interviews use a 24-hour time input; deadlines enforced.
- **Other:** chat moved to the database with rate limiting; jobs filtering and pagination in SQL; ownership checks (notifications, jobs, applications); admin action audit log; no internal error text leaks; worker passes the real visitor IP using a shared secret.
- **Reporting:** community job reporting (`reports` table, rate-limited `POST /api/jobs/:id/report`, anti-duplicate protection, bilingual modal with reason selection, and admin moderation dashboard to review, dismiss, or take down fraudulent listings).

## Bug-fix round (full end-to-end review)

Server-only changes. No client/UI files were modified.

- **Moderation take-down** now hides the job (`status = 'removed'`) instead of deleting it, so the report, candidates' applications and chats are kept. Employers cannot re-open a removed job.
- **Suspend/reactivate** can no longer be used to approve a pending or rejected employer (they only change through the verification review).
- **Late payments:** a provider-confirmed "successful" payment now activates the employer even if we had already expired it; reconciliation re-checks payments expired in the last 24h.
- **Double charge guard:** before sending a new payment prompt, earlier pending prompts are checked with PayPack (paid -> activate, still pending -> ask to wait).
- **Payment amount** must be present and equal to the expected fee before a payment is accepted as paid.
- **Required custom questions** of a job are enforced by the server when applying.
- **No orphan uploads:** contact person and logo type are validated before files are stored; failed requests remove their files and `file_scans` rows.
- `/api/auth/me` returns `created_at`; job list `total` is correct past the last page; `has_reported` uses the trusted client IP with the same 24h window as reporting and guest job pages are no longer publicly cacheable.
- Date of birth older than 120 years is rejected; password reset also rejects a password equal to the email; company logo must be PNG/JPG/WEBP.
- Editing/deleting a job now needs an active, paid employer (like creating one); a job edit cannot set a past deadline.
- Files whose virus scan could not run show a clearer message.
- Tests: `payment-reliability` and `upload-security` only use `TEST_DATABASE_URL` (never the `.env` database); new `test/e2e-full.test.js` journeys + bug regression tests.
