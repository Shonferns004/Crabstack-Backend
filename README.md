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

## API Endpoints

### Auth (no auth required)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/login` | Login with username/password, returns session cookie |
| `POST` | `/api/logout` | Destroy session |
| `GET` | `/api/me` | Check if session is valid |

### Content (public GET, admin POST/PUT/DELETE)
| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/projects` | List / Create project |
| `GET/PUT/DELETE` | `/api/projects/:id` | Read / Update / Delete project |
| `GET/POST` | `/api/services` | List / Create service |
| `GET/PUT/DELETE` | `/api/services/:id` | Read / Update / Delete service |
| `GET/POST` | `/api/testimonials` | List / Create testimonial |
| `GET/PUT/DELETE` | `/api/testimonials/:id` | Read / Update / Delete testimonial |
| `GET/POST` | `/api/faq` | List / Create FAQ |
| `GET/PUT/DELETE` | `/api/faq/:id` | Read / Update / Delete FAQ |
| `GET/POST` | `/api/blog` | List / Create blog post |
| `GET/PUT/DELETE` | `/api/blog/:id` | Read / Update / Delete blog post |
| `GET` | `/api/clients` | List clients |
| `POST/PUT/DELETE` | `/api/clients/:id` | Create / Update / Delete client |
| `GET` | `/api/pages` | List custom pages |
| `POST/PUT/DELETE` | `/api/pages/:id` | Create / Update / Delete page |
| `GET` | `/api/navigation` | Get navigation items |
| `PUT/DELETE` | `/api/navigation/:id` | Update / Delete nav item |
| `GET` | `/api/seo` | Get SEO settings |
| `PUT` | `/api/seo` | Update SEO settings |

### Inbox (auth required for admin, public POST)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/contacts` | Submit contact form (public) |
| `GET/PATCH/DELETE` | `/api/contacts` | Admin: list / update / delete messages |
| `POST` | `/api/subscribers` | Subscribe email (public) |
| `GET/DELETE` | `/api/subscribers` | Admin: list / delete subscribers |
| `POST` | `/api/bookings` | Submit booking (public) |
| `GET/PATCH/DELETE` | `/api/bookings` | Admin: list / update / delete bookings |

### Admin (auth required)
| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/invoices` | List / Create invoice |
| `PUT/DELETE` | `/api/invoices/:id` | Update / Delete invoice |
| `GET/POST` | `/api/users` | List / Create admin user |
| `PUT/DELETE` | `/api/users/:id` | Update / Delete admin user |
| `GET` | `/api/activity` | Activity log |
| `GET/PUT` | `/api/settings` | Get / Update site settings |
| `POST` | `/api/upload` | Upload file to Supabase Storage |

### Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check — returns project count and timestamp |

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
