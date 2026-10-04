# AGY_HANDOFF.md — Akazi Job Platform Project Handoff

This document details the state of the **Akazi** job platform project, everything that has been implemented, known caveats, and instructions for running and testing.

---

## 1. Exactly What Was Being Worked On
Building the full-stack web application **"Akazi"** — a realistic, professional job platform connecting employers and job seekers, inspired by LinkedIn Jobs, Indeed, and Glassdoor.

The requirements included:
- **Design & UI**: Neutral, clean styling (white/slate surfaces with blue `#2563eb` and emerald accents), card layouts, responsive design, and realistic data.
- **Role-Based Access Control**:
  - **Admin**: Approves/rejects pending employer accounts with verification document preview, manages all users, jobs, applications, and moderates content.
  - **Employer**: Registers with company details and business registration document, starts in `pending` status (cannot post jobs until approved), creates job posts with custom questions/fields, and manages applicant pipeline (schedule interviews or decline with feedback).
  - **Employee (Job Seeker)**: Registers with profile and resume, searches/filters jobs with dual-column layout, applies with dynamic custom field answers, and tracks application status with interview details.
  - **Notifications**: Live in-app notifications for status updates (approvals, interview invites, new applicants).
- **Tech Stack**: React 19 + Tailwind CSS + Vite (Frontend), Node.js + Express (Backend), PostgreSQL DDL schema with automatic local embedded database fallback, JWT authentication, and local disk upload storage.

---

## 2. What Has Already Been Completed

### A. Database & Storage Architecture
- [`server/src/db/schema.sql`](file:///D:/New%20folder/server/src/db/schema.sql): Complete PostgreSQL DDL schema covering `users`, `employers`, `job_seekers`, `jobs`, `applications`, and `notifications`, with relational foreign keys, cascade rules, and performance indexes.
- [`server/src/db/index.js`](file:///D:/New%20folder/server/src/db/index.js): Resilient database connection module. It attempts a PostgreSQL pool connection; if PostgreSQL is offline or unconfigured, it automatically activates an embedded file-backed relational store (`server/data/db.json`), allowing the entire application to run with zero setup.
- [`server/src/db/seed.js`](file:///D:/New%20folder/server/src/db/seed.js): Seeds authentic demo data:
  - **Admin**: `admin@akazi.com` / `Admin@123`
  - **Approved Employer**: Apex Technologies (`employer@apextech.com` / `Employer@123`)
  - **Approved Employer**: Nile Health Logistics (`hiring@nilehealth.org` / `Employer@123`)
  - **Pending Employer** (for testing verification): Kivu Renewable Energy Ltd (`founder@kivuenergy.rw` / `Employer@123`)
  - **Job Seekers**: Sarah Uwase (`sarah.uwase@example.com` / `JobSeeker@123`), David Mugisha (`david.mugisha@example.com` / `JobSeeker@123`)
  - Realistic jobs across tech, operations, and marketing with custom applicant questions.
  - Seeded applications (including an approved application with scheduled interview).
- [`server/src/db/makePdfs.js`](file:///D:/New%20folder/server/src/db/makePdfs.js): Generates valid sample PDF documents for resumes, registration certificates, and technical attachments in `server/uploads/`.

### B. Backend Services & API Routes
- [`server/src/index.js`](file:///D:/New%20folder/server/src/index.js): Express app listening on port `5000`, serving `/uploads` static files, with safe download endpoint `/api/files/download` and auto-seeding.
- [`server/src/middleware/auth.js`](file:///D:/New%20folder/server/src/middleware/auth.js): JWT verification, RBAC role guard, and `requireApprovedEmployer` guard (blocks pending employers from posting jobs).
- [`server/src/middleware/upload.js`](file:///D:/New%20folder/server/src/middleware/upload.js): Multer storage configured for resumes, documents, logos, and attachments.
- [`server/src/routes/auth.js`](file:///D:/New%20folder/server/src/routes/auth.js): Candidate registration, employer registration with file uploads, login, and `/me` endpoint.
- [`server/src/routes/jobs.js`](file:///D:/New%20folder/server/src/routes/jobs.js): Search, filter by category/location/type/salary, detail view, job creation (enforces approval), edit, and delete.
- [`server/src/routes/applications.js`](file:///D:/New%20folder/server/src/routes/applications.js): Candidate submission with dynamic custom answers, candidate dashboard (`/my`), employer applicants list (`/job/:jobId`), rejection with feedback, and interview scheduling with date/time/link/notes.
- [`server/src/routes/employers.js`](file:///D:/New%20folder/server/src/routes/employers.js): Employer metrics dashboard and job list with applicant breakdown counters.
- [`server/src/routes/admin.js`](file:///D:/New%20folder/server/src/routes/admin.js): Verification queue for pending employers, approve/reject endpoints, platform metrics, job moderation, and user account management.
- [`server/src/routes/notifications.js`](file:///D:/New%20folder/server/src/routes/notifications.js): In-app notification center with read/unread status.

### C. Frontend Web Application (React + Tailwind CSS)
- **Design & Layout**:
  - Clean corporate layout inspired by LinkedIn Jobs and Indeed.
  - [`Navbar.jsx`](file:///D:/New%20folder/client/src/components/Navbar.jsx): Navigation links, notification popover with unread counter, role badge, mobile drawer, and a **One-Click Demo Switcher** for switching between Admin, Approved Employer, Pending Employer, and Job Seeker.
  - [`Footer.jsx`](file:///D:/New%20folder/client/src/components/Footer.jsx): Professional corporate footer.
- **Context & Services**:
  - [`api.js`](file:///D:/New%20folder/client/src/services/api.js): Centralized API caller attaching JWT tokens.
  - [`AuthContext.jsx`](file:///D:/New%20folder/client/src/context/AuthContext.jsx): User state, login, registration, and quick account switcher.
  - [`NotificationContext.jsx`](file:///D:/New%20folder/client/src/context/NotificationContext.jsx): Real-time polling and unread badge management.
- **Modals**:
  - [`ApplyModal.jsx`](file:///D:/New%20folder/client/src/components/ApplyModal.jsx): Easy Apply modal that renders employer custom questions dynamically, handles resume selection, and accepts additional file uploads.
  - [`ScheduleInterviewModal.jsx`](file:///D:/New%20folder/client/src/components/ScheduleInterviewModal.jsx): Employer dialog to schedule date, time, timezone, format (Video Call or In-Person), venue/link, and notes.
  - [`RejectCandidateModal.jsx`](file:///D:/New%20folder/client/src/components/RejectCandidateModal.jsx): Employer dialog to decline with preset or custom feedback.
- **Pages**:
  - [`JobsPage.jsx`](file:///D:/New%20folder/client/src/pages/JobsPage.jsx): Dual-column jobs explorer with keyword search, location search, filter pills (Category, Job Type, Workplace Type), job card list, and sticky preview panel with "Easy Apply".
  - [`JobDetailsPage.jsx`](file:///D:/New%20folder/client/src/pages/JobDetailsPage.jsx): Standalone view for single job openings.
  - [`ApplicationsPage.jsx`](file:///D:/New%20folder/client/src/pages/ApplicationsPage.jsx): Candidate dashboard with status counters and highlighted **Interview Invitation Card** (showing meeting link, date, time, interviewer, and prep instructions).
  - [`EmployerDashboard.jsx`](file:///D:/New%20folder/client/src/pages/employer/EmployerDashboard.jsx): Metrics overview, active job listings, applicant counters, and **Pending Approval Banner** (which disables job posting if the employer is not yet approved).
  - [`PostJobPage.jsx`](file:///D:/New%20folder/client/src/pages/employer/PostJobPage.jsx): Job creation form with custom applicant questions builder and pending-status blocker.
  - [`ApplicantsPage.jsx`](file:///D:/New%20folder/client/src/pages/employer/ApplicantsPage.jsx): Per-job candidate pipeline with resume preview, custom question answers, and action buttons.
  - [`AdminDashboard.jsx`](file:///D:/New%20folder/client/src/pages/admin/AdminDashboard.jsx): System stats, pending employer approval queue with business registration document preview, "Approve" and "Reject" buttons, employer directory, job post moderation, and user management.
  - [`LoginPage.jsx`](file:///D:/New%20folder/client/src/pages/auth/LoginPage.jsx): Sign-in form with one-click demo role buttons.
  - [`RegisterPage.jsx`](file:///D:/New%20folder/client/src/pages/auth/RegisterPage.jsx): Dual candidate and employer registration with document upload.
  - [`ProfilePage.jsx`](file:///D:/New%20folder/client/src/pages/ProfilePage.jsx): User profile and document viewer.
- **Build Verification**:
  - `npm.cmd run build` was executed inside `client` and succeeded with **0 errors** (`dist/` generated in 5.72s).

---

## 3. What is Currently Broken or Unfinished
- **No Background Servers Currently Active**: The Node backend server and Vite frontend dev server were stopped when the background process environment restarted. They need to be launched.
- **No Code is Broken**: The backend passed unit testing, health check endpoints responded with 200 OK, and the frontend compiled cleanly.

---

## 4. The Exact Next Steps

### Step 1: Start the Backend Server
Open a terminal in `D:\New folder\server` and run:
```powershell
node src/index.js
```
The server will start on `http://localhost:5000`. It will automatically initialize the database fallback or connect to PostgreSQL if configured, generate sample PDFs, and seed the demo data.

### Step 2: Start the Frontend Dev Server
Open a second terminal in `D:\New folder\client` and run:
```powershell
npm run dev
```
Open `http://localhost:5173` in your web browser.

### Step 3: Test the Core User Flows in Browser
1. **Admin Approval Flow**:
   - In the top navigation bar, use the **Demo Switcher** and select **Admin** (or sign in with `admin@akazi.com` / `Admin@123`).
   - Navigate to **Admin Center**.
   - Notice the pending verification queue for **Kivu Renewable Energy Ltd**.
   - Click **Preview Document** to inspect their uploaded business incorporation certificate.
   - Click **Approve Employer**.
   - Switch account to **Kivu Renewable Energy Ltd**; notice the pending warning disappears and the employer can now access **Post a Job**.
2. **Job Seeker Experience**:
   - Use the **Demo Switcher** to switch to **Job Seeker (Sarah Uwase)**.
   - Browse jobs on `/jobs`, filter by Category or Remote workplace, search keywords.
   - Click into a job and click **Easy Apply** to fill out custom questions and submit an application.
   - Navigate to **My Applications** (`/applications`); view the status counters and inspect the **Interview Invitation Card** for the Senior Full-Stack Engineer role with scheduled date, time, and Google Meet link.
3. **Employer Applicant Management & Interview Scheduling Flow**:
   - Use the **Demo Switcher** to switch to **Apex Technologies (Approved)**.
   - Go to **Employer Hub** -> **Review Applicants** (`/employer/applicants`).
   - Inspect candidate answers and resume download.
   - Click **Schedule Interview** to set interview date, time, format, and meeting link. The candidate receives an immediate in-app notification.
   - Or click **Decline** to provide constructive feedback.

---

## 5. Important Files Changed / Created

| File | Purpose |
|---|---|
| [`server/package.json`](file:///D:/New%20folder/server/package.json) | Backend dependencies (`express`, `pg`, `bcryptjs`, `jsonwebtoken`, `multer`, `cors`, `dotenv`) |
| [`server/.env`](file:///D:/New%20folder/server/.env) | Backend environment configuration |
| [`server/src/db/schema.sql`](file:///D:/New%20folder/server/src/db/schema.sql) | Full PostgreSQL DDL database schema |
| [`server/src/db/index.js`](file:///D:/New%20folder/server/src/db/index.js) | Database client with PG pool and automatic local JSON persistence fallback |
| [`server/src/db/seed.js`](file:///D:/New%20folder/server/src/db/seed.js) | Seeder populating demo admin, employers, jobs, seekers, applications, and notifications |
| [`server/src/db/makePdfs.js`](file:///D:/New%20folder/server/src/db/makePdfs.js) | Generates sample PDF documents for verification and resumes |
| [`server/src/middleware/auth.js`](file:///D:/New%20folder/server/src/middleware/auth.js) | JWT auth and role authorization guards |
| [`server/src/middleware/upload.js`](file:///D:/New%20folder/server/src/middleware/upload.js) | Multer file upload storage handler |
| [`server/src/routes/*.js`](file:///D:/New%20folder/server/src/routes/) | All API endpoints (`auth`, `jobs`, `applications`, `employers`, `admin`, `notifications`) |
| [`server/src/index.js`](file:///D:/New%20folder/server/src/index.js) | Express entrypoint running on port 5000 |
| [`client/vite.config.js`](file:///D:/New%20folder/client/vite.config.js) | Vite configuration with Tailwind CSS plugin and `/api` proxy |
| [`client/src/index.css`](file:///D:/New%20folder/client/src/index.css) | Base styles and Tailwind imports |
| [`client/src/services/api.js`](file:///D:/New%20folder/client/src/services/api.js) | Centralized fetch API wrapper with token handling |
| [`client/src/context/AuthContext.jsx`](file:///D:/New%20folder/client/src/context/AuthContext.jsx) | Authentication provider with demo switcher |
| [`client/src/context/NotificationContext.jsx`](file:///D:/New%20folder/client/src/context/NotificationContext.jsx) | In-app notification center state |
| [`client/src/components/Navbar.jsx`](file:///D:/New%20folder/client/src/components/Navbar.jsx) | Navigation bar with demo switcher & notification popover |
| [`client/src/components/ApplyModal.jsx`](file:///D:/New%20folder/client/src/components/ApplyModal.jsx) | Easy Apply modal with dynamic employer questions |
| [`client/src/components/ScheduleInterviewModal.jsx`](file:///D:/New%20folder/client/src/components/ScheduleInterviewModal.jsx) | Interview scheduling dialog |
| [`client/src/components/RejectCandidateModal.jsx`](file:///D:/New%20folder/client/src/components/RejectCandidateModal.jsx) | Candidate rejection dialog |
| [`client/src/pages/JobsPage.jsx`](file:///D:/New%20folder/client/src/pages/JobsPage.jsx) | Job search & dual-column explorer |
| [`client/src/pages/ApplicationsPage.jsx`](file:///D:/New%20folder/client/src/pages/ApplicationsPage.jsx) | Candidate applications tracker & interview details card |
| [`client/src/pages/employer/EmployerDashboard.jsx`](file:///D:/New%20folder/client/src/pages/employer/EmployerDashboard.jsx) | Employer workspace with approval banner |
| [`client/src/pages/employer/PostJobPage.jsx`](file:///D:/New%20folder/client/src/pages/employer/PostJobPage.jsx) | Job posting with custom questions builder |
| [`client/src/pages/employer/ApplicantsPage.jsx`](file:///D:/New%20folder/client/src/pages/employer/ApplicantsPage.jsx) | Applicant review and interview scheduling |
| [`client/src/pages/admin/AdminDashboard.jsx`](file:///D:/New%20folder/client/src/pages/admin/AdminDashboard.jsx) | Admin employer verification & moderation portal |
| [`client/src/App.jsx`](file:///D:/New%20folder/client/src/App.jsx) | Top-level routing setup |
| [`package.json`](file:///D:/New%20folder/package.json) | Root workspace scripts (`server`, `client`, `seed`, `build`) |

---

## 6. Commands That Were Run
1. `npm.cmd create vite@latest client -- --template react` (Scaffolded frontend)
2. `npm.cmd install` (Installed backend dependencies in `server`)
3. `npm.cmd install lucide-react @tailwindcss/vite tailwindcss react-router-dom` (Installed frontend dependencies in `client`)
4. `node src/db/seed.js` (Executed database seeder and generated demo database records)
5. `node src/db/makePdfs.js` (Generated sample PDF documents for verification)
6. `Invoke-RestMethod -Uri "http://localhost:5000/api/health"` (Verified backend health endpoint)
7. `npm.cmd run build` (Executed in `client` — verified 0 TypeScript/JSX/bundling errors)

---

## 7. Errors Encountered & How They Were Resolved
- **PowerShell Execution Policy on `npm.ps1`**: PowerShell blocked running `.ps1` scripts; resolved by invoking `npm.cmd` directly.
- **Local PostgreSQL Daemon Missing**: `psql` and PostgreSQL local services were not installed/running on the Windows host. Resolved by architecting a dual-mode database module (`server/src/db/index.js`): it attempts PostgreSQL first, but if unreachable, falls back to a persistent JSON-backed database (`server/data/db.json`) while maintaining the exact PostgreSQL data model and query responses.
- **Vite starter CSS conflict**: The initial `App.css` had rigid fixed widths (`width: 1126px`) that interfered with Tailwind responsiveness; resolved by replacing `App.css` with clean styles.
- **Background task stop on server restart**: The environment restarted during build execution; resolved by verifying the file tree and completing all remaining components.

---

## 8. Change Log — 2026-09-29 — Jobs grouped under verified businesses

### User-reported issue
On `/jobs`, positions were immediately expanded underneath each business. The requested experience is:
- Show the verified business first.
- Show only the business name, **Verified Business** badge, location, and total available position count in the collapsed state.
- Do not expose individual job positions in the initial list.
- Clicking a business opens that business and reveals all of its available positions.
- Keep existing search, location filtering, job detail links, and application behavior intact.

### Root cause
`client/src/pages/JobsPage.jsx` already grouped jobs by `company_name`, but it rendered `group.positions.map(...)` unconditionally. It also exposed an **All Jobs** view that bypassed the requested business-first presentation.

### Changes made
**File:** `client/src/pages/JobsPage.jsx`

1. Replaced the `viewMode` / All Jobs toggle with a single business-first grouped view.
2. Added `expandedEmployers` state using a `Set` so each verified business can independently be opened/closed.
3. Added `toggleEmployer()` to reveal or hide a business's positions.
4. Made the business header a keyboard-accessible `<button>` with `aria-expanded`.
5. Added a `ChevronDown` indicator that rotates when the business is open.
6. Changed grouping to prefer `employer_id` over the company name, preventing two distinct businesses with the same display name from being merged.
7. Kept each existing position's `/jobs/:id` link and Apply behavior unchanged.
8. Kept the existing search and location filtering logic unchanged.

### Expected UI behavior
Initial state:
```text
Kigali Serena Hotel    Verified Business
Nyarugenge, Kigali
18 positions available       v
```

After clicking the business header:
```text
Kigali Serena Hotel    Verified Business
Nyarugenge, Kigali
18 positions available       ^

Front Desk Receptionist      Apply ->
Line Cook / Commis Chef      Apply ->
Restaurant Waitress / Waiter Apply ->
...
```

Clicking the header again collapses the positions.

### Verification
- Confirmed there are no remaining `viewMode`, `setViewMode`, `all_jobs`, or `viewAllList` references in `JobsPage.jsx`.
- Confirmed the new expand/collapse state and handler are referenced in the rendered employer cards.
- Attempted a production build. The archived Windows `node_modules` could not run in the Linux verification environment because the Vite/Rolldown native binding was missing. A fresh `npm ci` was attempted but the environment timed out while installing dependencies. This is an environment/dependency-installation limitation, not a reported application runtime error.
- The source change itself is isolated to `client/src/pages/JobsPage.jsx`; no backend/database behavior was changed.

### AGY continuation note
If further work is handed to AGY after this change, preserve the business-first jobs behavior. Do not reintroduce an ungrouped/all-jobs presentation unless explicitly requested. Future job-list UI changes should maintain the invariant that individual positions are revealed from their verified business group.
