# Akazi

Job platform for Rwanda connecting verified employers and job seekers. React + Vite client, Express + PostgreSQL API, Cloudflare Worker in front, Cloudflare R2 for private documents, Resend for email, PayPack for mobile-money verification payments.

## Run it locally

```sh
npm run install:all
cp server/.env.example server/.env      # then fill in the values below
npm run dev:server                       # API on :5000
npm run dev:client                       # site on :5173
```

Minimum `.env` for local work:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/akazi
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
```

The server refuses to start without a real `JWT_SECRET` and a reachable PostgreSQL. There is no fallback database.

- **First admin:** `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-password-1' npm run create-admin`
- **Demo data (local only):** `npm run seed -- --reset` (deletes everything; prints a random password for the demo accounts; refuses to run in production)
- **Tests:** `TEST_DATABASE_URL=postgresql://postgres:pw@localhost:5432/akazi_test npm test`

With no `RESEND_API_KEY`, emails (password reset, confirmation) are printed in the server terminal, so you can click the link yourself. With no R2 settings, files are kept in the private folder `server/uploads/` (development only).

## Email with Resend

1. Create an API key at resend.com and put it in `server/.env` as `RESEND_API_KEY` (never commit it, never paste it in chat or issues).
2. Until you verify your own domain in Resend, use `MAIL_FROM=Akazi <onboarding@resend.dev>`. That sender can only deliver to your own Resend account address.
3. Verify your domain (SPF and DKIM records), then set `MAIL_FROM=Akazi <no-reply@yourdomain.rw>`.
4. Set `CLIENT_URL` to your public site address: it is used inside email links.
5. Optional: `REQUIRE_EMAIL_VERIFICATION=true` makes people confirm their email before applying or posting jobs. Turn it on once your domain is verified.

## Private documents with Cloudflare R2

1. Cloudflare dashboard > R2 > create a bucket (for example `akazi-private`). Keep it **private**: do not enable the public `r2.dev` address or a custom public domain.
2. R2 > Manage API tokens > create a token with **Object Read & Write** limited to that bucket.
3. Put `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` in the server environment (Render).
4. Move existing local files: `npm run migrate-uploads` (dry run), then `npm run migrate-uploads -- --apply`.

How it works: the database stores only keys like `resumes/ab12.pdf`. When someone clicks a document, the site asks `GET /api/files/url`. The server checks that this person may see that file (the candidate, the employer the candidate applied to, or an admin; business documents only the owner and admins), then returns a link that expires after 5 minutes. Nothing is publicly browsable. Only company logos are public.

## Rwanda time

All dates and times use Rwanda time (`Africa/Kigali`, UTC+2, no daylight saving), never the visitor's device clock.

- The database stores exact instants (UTC). The server decides what "now" and "today" are.
- The browser reads the server clock from `GET /api/time` and formats everything with `client/src/utils/time.js` (always shows CAT).
- Interviews are scheduled with a date and a 24-hour time interpreted as Rwanda time; they must be in the future.
- Job deadlines are plain dates, valid through the end of that day in Rwanda. Expired jobs disappear from search and cannot be applied to.
- The 18+ age check uses today's date in Rwanda.

## Deploying behind the Cloudflare Worker

`worker.js` proxies `/api/*` to the API. To make rate limiting see each visitor's real address:

```sh
wrangler secret put PROXY_SECRET       # a long random value
```

and set the **same** value as `PROXY_SECRET` on the API (Render). Without it the API still works, but rate limits are shared by everyone coming through Cloudflare.

Production environment checklist (the server refuses to start without `DATABASE_URL` and `JWT_SECRET`; missing cloud storage (B2 or R2), `RESEND_API_KEY` or `PAYPACK_WEBHOOK_SECRET` only logs a warning, so set them before going live):
`NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL` (https), `R2_*`, `RESEND_API_KEY`, and `PAYPACK_WEBHOOK_SECRET` if PayPack is used. Also set `PAYPACK_CLIENT_ID`, `PAYPACK_CLIENT_SECRET`, `PROXY_SECRET`, `DATABASE_SSL=true` if your database requires it.

## Document safety and virus scanning

Uploads undergo multi-layer inspection before and after storage:

- **Type allowlist:** Only `.pdf`, `.docx`, `.png`, `.jpg`, `.jpeg`, and `.webp` are supported (legacy `.doc` is rejected).
- **Format inspection (`server/src/lib/filescan.js`):**
  - PDF: rejects embedded scripts, actions, and files (`/JavaScript`, `/JS`, `/Launch`, `/OpenAction`, `/EmbeddedFile`, `/RichMedia`).
  - DOCX: zip archive inspection; rejects macros (`vbaProject.bin`), embedded objects (`embeddings/`), scripts/executables (`.exe`, `.dll`, `.js`, etc.), external relationships (`TargetMode="External"`), path traversal (`..`, `/`), and zip bombs (>50MB uncompressed, >500 entries, or compression ratio >100:1).
  - Images: verifies headers and rejects files with trailing injected payloads.
- **Antivirus integration (`server/src/lib/scanner.js`):**
  - Connects to ClamAV daemon via TCP INSTREAM protocol (`CLAMAV_HOST`, `CLAMAV_PORT`).
  - In production, unscanned uploads remain quarantined unless `ALLOW_UNSCANNED_UPLOADS=true` is set.
  - In development, scans default to clean if ClamAV is not configured.
- **Quarantine & status (`file_scans` table):**
  - Stored files record SHA-256 and status (`pending`, `clean`, `infected`, `error`).
  - Downloads fail closed (`409 Conflict`) unless the file is explicitly marked `clean`.
  - Infected uploads are deleted, logged to `audit_log`, and rejected with 400.
  - Backfill existing files: `npm --prefix server run backfill-scans`.
- **Duplicate registration document detection:**
  - SHA-256 hashes of employer registration documents are checked to log `duplicate_registration_doc` in `audit_log` without blocking registration.
- **Safe delivery:**
  - Storage keys are cryptographically random.
  - Signed URLs and downloads enforce safe MIME types, inline viewing for PDFs/images, and attachment downloads for others, with `X-Content-Type-Options: nosniff`.

## Security summary

- No secrets in the repository; configuration is validated at startup; no default JWT secret.
- Passwords: bcrypt, 8 to 72 characters with a letter and a number, common passwords refused. Five wrong attempts lock the account for 15 minutes. Changing or resetting a password signs out every other session.
- Password reset and email confirmation use single-use, expiring tokens; only a hash is stored. The reset form never reveals whether an email is registered.
- PayPack webhooks need a valid HMAC signature, are confirmed against PayPack's API, must match the amount, and can only move a payment out of `pending` once.
- Shared transactional settlement (`lib/settle-payment.js`) prevents race conditions, synchronizes payments and employers tables atomically, and self-heals desynced records.
- Payment reconciliation (`lib/reconcile-payments.js`) can run via cron (`npm --prefix server run reconcile-payments`) or automatically via `RECONCILE_PAYMENTS_INTERVAL_MIN` protected by Postgres advisory locks.
- Employers need admin approval and payment before posting or reviewing applicants. Admin actions are written to `audit_log` (`GET /api/admin/audit`).
- Uploads are checked by real content, held in memory until validation passes, and stored privately.
- API errors never include internal messages; responses are not cached.

## Not included yet (good next steps)

- Two-factor authentication for admins.
- Session in an httpOnly cookie instead of `localStorage` (needs CSRF protection).
- Chat presence ("online now") is in server memory, so it resets on restart and assumes a single server.
