# Copilot instructions for Akazi

## Build, run, and lint

Run commands from the repository root:

```sh
npm run install:all
npm run dev:server
npm run dev:client
npm run build
npm start
npm run seed
npm --prefix client run lint
```

The client runs on Vite at `http://localhost:5173` and proxies `/api` and `/uploads` to the Express server on port 5000. `npm start` serves the API and, when present, the production build in `client/dist`. Before starting the server, copy `server/.env.example` to `server/.env` and configure environment values as described in the root README.

To lint one client file, for example:

```sh
npm --prefix client run lint -- src/pages/JobsPage.jsx
```

There is currently no test script or test suite in the package manifests. The server package also has no lint script.

## Architecture

- `client/` is a React 19 single-page app built with Vite and Tailwind. `src/App.jsx` defines React Router routes and role guards; the providers for authentication, language, notifications, and chat wrap the route tree. Pages compose shared UI from `src/components/`.
- `client/src/services/api.js` is the shared API client. It attaches the saved auth token, supports JSON and `FormData`, and normalizes HTTP errors. Use it for API calls so auth and multipart behavior remain consistent.
- `server/src/index.js` configures Express security/middleware, mounts route modules under `/api`, serves uploaded files, and serves the built SPA. Each feature's endpoints live in `server/src/routes/`; authentication, role checks, and approved-employer checks are shared from `server/src/middleware/auth.js`.
- `server/src/db/index.js` exposes `initDb()` and `query()`. It uses PostgreSQL when available and otherwise falls back to the JSON store in `server/data/db.json`. Chat messages are separately stored in `server/data/chat.json`, regardless of which database is active.
- `server/src/db/schema.sql` defines the PostgreSQL relational schema. The database initializer applies it only when the `users` table is absent; the script begins with `DROP TABLE IF EXISTS`, so do not run it manually against an existing database.
- `server/src/db/seed.js` provides demo data; startup also seeds automatically when the database is empty. Uploads are stored under `server/uploads/` and handled through the shared upload middleware.

## Repository-specific conventions

- The server uses CommonJS (`require`/`module.exports`); the Vite client uses ES modules and JSX.
- Database calls go through `query()` and use PostgreSQL-style `$1`, `$2` parameter placeholders. Keep statements compatible with the JSON fallback's lightweight SQL interpreter as well as PostgreSQL; its supported query patterns are deliberately limited.
- Enforce authorization on the server with `authenticateToken`, `requireRole`, and/or `requireApprovedEmployer`; client-side route guards are navigation UX, not authorization. The application roles are `admin`, `employer`, and `employee`.
- Use the upload middleware for file endpoints. It applies the 10 MB limit, extension allow-list, and signature validation; preserve the expected upload field names (`resume`, `logo`, `registration_doc`, and `attachments`) and generated `/uploads/...` paths.
- Visible text supports English (`en`) and Kinyarwanda (`rw`). Use `useLanguage()` from `LanguageContext` (`t` for translation keys, `tr` for inline English/Kinyarwanda text) and keep corresponding entries in `client/src/i18n/translations.js`.
- Chat is intentionally polling-based: the client contexts poll conversations and active threads, while the server derives presence from chat API activity. Preserve the current polling and conversation access rules when changing chat behavior.
