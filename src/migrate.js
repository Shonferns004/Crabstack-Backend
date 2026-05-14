import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

async function migrate() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
    process.exit(1)
  }

  console.log(`
╔══════════════════════════════════════════════════╗
║            CRABSTACK DATABASE SETUP              ║
╚══════════════════════════════════════════════════╝

1. Go to your Supabase Dashboard → SQL Editor
2. Open backend/setup.sql and paste the ENTIRE contents
3. Click "Run" to create all tables + seed data

Done? Come back and start the backend with:
  npm run dev

Default login: admin / (set via ADMIN_PASSWORD env var)
`)
  process.exit(0)
}

migrate()
