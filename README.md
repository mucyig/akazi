# Akazi — production guide

## Run (single server serves the site + API)
1. `npm run install:all`
2. `npm run build`
3. Copy `server/.env.example` to `server/.env` and fill it in (see below)
4. `npm start`  → http://localhost:5000

Development: `npm run dev:server` and `npm run dev:client` (http://localhost:5173).

## Required before going live
- `NODE_ENV=production`
- `JWT_SECRET`: long random string. The server refuses to start in production with the default one.
  Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `DATABASE_URL`: your PostgreSQL connection string. Without it the app uses a local JSON file (demo only).
- `CLIENT_URL`: your public https address.
- Serve behind HTTPS (Nginx, Caddy or your host).
- **Delete or change the demo accounts** created by `server/src/db/seed.js`
  (admin@akazi.com / Admin@123, employer@apextech.com / Employer@123, job seekers / JobSeeker@123).
- Back up `server/data` (chat) and `server/uploads` (CVs and business documents).

## Security built in
- Passwords: bcrypt, 8–72 characters. Password hashes are stripped from every API response.
- JWT pinned to HS256, 7-day expiry; suspended users are blocked immediately.
- Role + ownership checks on every employer/admin/application/chat route.
- Rate limits (login/signup 40 per 15 min per IP, API 3000 per 15 min), helmet headers, strict CSP, CORS locked to CLIENT_URL.
- Uploads: PDF/Word/PNG/JPG/WEBP only, real file-signature check, random filenames, 10 MB cap.
- Chat: only the two people on an approved application; employer writes first; closed when declined.

## Known limits (be aware)
- Uploaded CVs and business documents are served from /uploads by unguessable URL (not login-gated).
- Chat updates by polling every 3–5 seconds, and "online" means active in the last 25 seconds.
- Kinyarwanda text was written by AI: have a native speaker review it.
