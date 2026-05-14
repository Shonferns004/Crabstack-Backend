# Crabstack Backend

Express API server with Supabase, session-based auth, file uploads, and a health cron job.

## Tech Stack

- **Runtime:** Node.js (ESM)
- **Framework:** Express
- **Database:** Supabase (PostgreSQL)
- **Auth:** Express-session (cookie-based)
- **File Upload:** Multer → Supabase Storage
- **Cron:** node-cron

## Setup

```bash
cp .env.example .env
npm install
```

Edit `.env` with your Supabase credentials and admin password.

### Database

Run `setup.sql` in your Supabase SQL Editor to create all tables and seed default settings.

```bash
npm run migrate
```

## Run

```bash
npm run dev     # node src/index.js
npm run start   # nodemon src/index.js
```

Server starts on `http://localhost:3001`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | — | Supabase service role key |
| `SUPABASE_STORAGE_BUCKET` | `crabstack-media` | Storage bucket for uploads |
| `ADMIN_USERNAME` | `admin` | Admin panel login username |
| `ADMIN_PASSWORD` | — | Admin panel login password |
| `SESSION_SECRET` | — | Secret for signing session cookies |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin for CORS |
| `PORT` | `3001` | Server port |

## Public API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects |
| `GET` | `/api/services` | List all services |
| `GET` | `/api/testimonials` | List all testimonials |
| `GET` | `/api/faq` | List FAQ entries |
| `GET` | `/api/blog` | List blog posts |
| `GET` | `/api/clients` | List clients |
| `GET` | `/api/pages` | List custom pages |
| `GET` | `/api/navigation` | Get navigation |
| `GET` | `/api/seo` | Get SEO settings |
| `GET` | `/api/settings` | Get site settings |
| `GET` | `/api/media` | List media files |
| `POST` | `/api/contacts` | Submit contact form |
| `POST` | `/api/subscribers` | Subscribe email |
| `POST` | `/api/bookings` | Submit booking |
| `GET` | `/api/health` | Health check — project count + timestamp |

## Health Cron

A cron job runs every **9 minutes** (`*/9 * * * *`) and pings the `/api/health` endpoint, logging the result to console.

## Project Structure

```
backend/
├── src/
│   ├── index.js              # Express app + cron
│   ├── migrate.js             # Database setup instructions
│   ├── config/supabase.js     # Supabase client
│   ├── middleware/auth.js     # Session auth middleware
│   └── routes/                # API route handlers
├── .env.example
├── schema.sql                 # Full database schema
├── setup.sql                  # Run this in Supabase SQL Editor
└── package.json
```
