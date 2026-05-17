-- ===================================================
-- CRABSTACK FULL SETUP
-- Paste this entire file in your Supabase SQL Editor
-- ===================================================

-- 1. Create the exec_sql function (needed by the backend migration)
CREATE OR REPLACE FUNCTION exec_sql(query_text TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE query_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create all tables
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  tags TEXT[],
  client_name TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  excerpt TEXT,
  image_url TEXT,
  category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  author TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  website TEXT,
  project_history TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  project_name TEXT,
  amount DECIMAL(12,2),
  status TEXT DEFAULT 'draft',
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date DATE,
  time TEXT,
  service_type TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  assigned_to TEXT,
  reply TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  meta_title TEXT,
  meta_description TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS navigation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  parent_id UUID REFERENCES navigation(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS seo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  og_image TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  alt TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS groq_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  name TEXT,
  type TEXT,
  industry TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  linkedin TEXT,
  size TEXT,
  founded TEXT,
  revenue_estimate TEXT,
  decision_maker TEXT,
  social_presence TEXT,
  description TEXT,
  pain_points TEXT[],
  tech_stack TEXT[],
  fit_score INT,
  intent_score INT,
  reach_score INT,
  priority TEXT,
  reason TEXT,
  outreach_subject TEXT,
  outreach_body TEXT,
  context JSONB,
  created_by TEXT,
  status TEXT DEFAULT 'new',
  follow_up_date DATE,
  deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual',
  email_normalized TEXT,
  email_verified BOOLEAN DEFAULT false,
  email_format_valid BOOLEAN DEFAULT false,
  email_domain_exists BOOLEAN DEFAULT false,
  email_mx_valid BOOLEAN DEFAULT false,
  phone_e164 TEXT,
  phone_verified BOOLEAN DEFAULT false,
  phone_e164_valid BOOLEAN DEFAULT false,
  contact_status TEXT DEFAULT 'unverified',
  dedup_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS leads_dedup_key_unique ON leads (dedup_key);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cron_expression TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  payload JSONB DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_status TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  trigger_source TEXT,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  output JSONB,
  error TEXT
);

CREATE TABLE IF NOT EXISTS lead_automation_settings (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  weekly_target INT DEFAULT 15,
  location TEXT,
  industry TEXT,
  product TEXT,
  lead_types JSONB DEFAULT '["startup","local","individual"]'::jsonb,
  key_id UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO lead_automation_settings (id, enabled, weekly_target, location, industry, product, lead_types)
VALUES ('default', false, 15, 'Mumbai, India', 'general business', 'our services', '["startup","local","individual"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 3. Seed data (admin user is auto-created on app startup from ADMIN_PASSWORD env var)

INSERT INTO settings (key, value) VALUES
  ('site_title', 'Crabstack'),
  ('site_email', 'hello@crabstack.com'),
  ('site_phone', ''),
  ('site_address', ''),
  ('footer_text', '© Crabstack. All rights reserved.'),
  ('copyright', '© Crabstack'),
  ('social_facebook', ''),
  ('social_instagram', ''),
  ('social_twitter', ''),
  ('social_linkedin', ''),
  ('maintenance_mode', 'false'),
  ('maintenance_message', 'Site under maintenance.')
ON CONFLICT (key) DO NOTHING;
