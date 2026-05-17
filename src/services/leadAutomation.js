import { randomUUID } from 'crypto'
import { supabase, query } from '../config/supabase.js'
import {
  buildLeadPrimaryDedupKey,
  dedupeLeadRows,
  getLeadKeySet,
} from './leadDedup.js'
import { validateContactInfo } from './contactVerification.js'

let ensureLeadAutomationPromise = null
let autoRunInProgress = false

const DEFAULT_SETTINGS = {
  enabled: false,
  weekly_target: 15,
  location: 'Mumbai, India',
  industry: 'general business',
  product: 'our services',
  lead_types: ['startup', 'local', 'individual'],
  key_id: null,
}

function safeJSON(raw) {
  let s = String(raw || '').trim()
  s = s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim()
  const firstArray = s.indexOf('[')
  if (firstArray !== -1) {
    const end = s.lastIndexOf(']')
    if (end !== -1) s = s.slice(firstArray, end + 1)
  }
  return JSON.parse(s)
}

function weekStartUtc(date = new Date()) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function clampInt(n, min, max, fallback) {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

function normalizeTypes(input) {
  if (!Array.isArray(input)) return DEFAULT_SETTINGS.lead_types
  const out = input.map(x => String(x || '').trim()).filter(Boolean)
  return out.length ? out : DEFAULT_SETTINGS.lead_types
}

function normalizeSettings(raw = {}) {
  return {
    enabled: Boolean(raw.enabled),
    weekly_target: clampInt(raw.weekly_target, 1, 200, DEFAULT_SETTINGS.weekly_target),
    location: String(raw.location || DEFAULT_SETTINGS.location).trim() || DEFAULT_SETTINGS.location,
    industry: String(raw.industry || DEFAULT_SETTINGS.industry).trim() || DEFAULT_SETTINGS.industry,
    product: String(raw.product || DEFAULT_SETTINGS.product).trim() || DEFAULT_SETTINGS.product,
    lead_types: normalizeTypes(raw.lead_types),
    key_id: raw.key_id ? String(raw.key_id).trim() : null,
  }
}

async function normalizeLead(lead = {}, context = {}) {
  const arr = (value) => Array.isArray(value) ? value.map(x => String(x || '').trim()).filter(Boolean) : null
  const txt = (value) => {
    const t = String(value || '').trim()
    return t || null
  }
  const num = (value) => {
    const n = Number(value)
    return Number.isFinite(n) ? Math.round(n) : null
  }

  const row = {
    batch_id: randomUUID(),
    name: txt(lead.name),
    type: txt(lead.type),
    industry: txt(lead.industry),
    location: txt(lead.location),
    email: txt(lead.email),
    phone: txt(lead.phone),
    website: txt(lead.website),
    linkedin: txt(lead.linkedin),
    size: txt(lead.size),
    founded: txt(lead.founded),
    revenue_estimate: txt(lead.revenue_estimate),
    decision_maker: txt(lead.decision_maker),
    social_presence: txt(lead.social_presence),
    description: txt(lead.description),
    pain_points: arr(lead.pain_points),
    tech_stack: arr(lead.tech_stack),
    fit_score: num(lead.fit_score),
    intent_score: num(lead.intent_score),
    reach_score: num(lead.reach_score),
    priority: txt(lead.priority),
    reason: txt(lead.reason),
    outreach_subject: txt(lead.outreach_subject),
    outreach_body: txt(lead.outreach_body),
    context,
    created_by: 'auto-leads',
    source: 'auto',
    status: 'new',
    deleted: false,
    deleted_at: null,
  }
  const verification = await validateContactInfo({
    email: row.email,
    phone: row.phone,
    location: row.location || context?.location,
  })
  Object.assign(row, verification)
  row.dedup_key = buildLeadPrimaryDedupKey(row)
  return row
}

async function ensureLeadColumns() {
  await query(`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
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
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date DATE;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_normalized TEXT;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_format_valid BOOLEAN DEFAULT false;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_domain_exists BOOLEAN DEFAULT false;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_mx_valid BOOLEAN DEFAULT false;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_e164_valid BOOLEAN DEFAULT false;
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_status TEXT DEFAULT 'unverified';
  `)
  await query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS dedup_key TEXT;
  `)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS leads_dedup_key_unique ON leads (dedup_key);
  `)
}

async function fetchExistingLeadKeys() {
  const pageSize = 1000
  let from = 0
  const keySet = new Set()

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('leads')
      .select('email, name, website, phone, location, linkedin, dedup_key')
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new Error(error.message)
    const chunk = Array.isArray(data) ? data : []
    for (const row of chunk) {
      if (row?.dedup_key) keySet.add(String(row.dedup_key))
    }
    const generatedSet = getLeadKeySet(chunk)
    for (const key of generatedSet) keySet.add(key)

    if (chunk.length < pageSize) break
    from += pageSize
  }

  return keySet
}

export function ensureLeadAutomationTables() {
  if (!ensureLeadAutomationPromise) {
    ensureLeadAutomationPromise = query(`
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
    `)
      .then(() => ensureLeadColumns())
      .then(() => query(`
        INSERT INTO lead_automation_settings (id, enabled, weekly_target, location, industry, product, lead_types)
        VALUES ('default', false, 15, 'Mumbai, India', 'general business', 'our services', '["startup","local","individual"]'::jsonb)
        ON CONFLICT (id) DO NOTHING;
      `))
      .catch((err) => {
        ensureLeadAutomationPromise = null
        throw err
      })
  }
  return ensureLeadAutomationPromise
}

export async function getLeadAutomationSettings() {
  await ensureLeadAutomationTables()
  const { data, error } = await supabase
    .from('lead_automation_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return normalizeSettings(data || DEFAULT_SETTINGS)
}

export async function updateLeadAutomationSettings(input = {}) {
  const current = await getLeadAutomationSettings()
  const merged = normalizeSettings({ ...current, ...input })
  const payload = {
    id: 'default',
    enabled: merged.enabled,
    weekly_target: merged.weekly_target,
    location: merged.location,
    industry: merged.industry,
    product: merged.product,
    lead_types: merged.lead_types,
    key_id: merged.key_id,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('lead_automation_settings')
    .upsert(payload)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return normalizeSettings(data || payload)
}

async function fetchGroqKey(settings) {
  let q = supabase.from('groq_keys').select('id, api_key').limit(1)
  if (settings.key_id) q = q.eq('id', settings.key_id)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.api_key) throw new Error('No Groq key configured for auto leads')
  return String(data.api_key).trim()
}

async function callGroq(apiKey, prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1800,
      messages: [
        { role: 'system', content: 'Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Groq API error ${res.status}`)
  }

  const payload = await res.json()
  return payload?.choices?.[0]?.message?.content || '[]'
}

async function countLeadsThisWeek() {
  await ensureLeadAutomationTables()
  const start = weekStartUtc(new Date()).toISOString()
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('deleted', false)
    .gte('created_at', start)
  if (error) throw new Error(error.message)
  return count || 0
}

async function generateAutoLeads(missingCount, settings, apiKey) {
  const prompt = `Generate exactly ${missingCount} realistic business leads for ${settings.location} in ${settings.industry}.
Lead types should mix from: ${settings.lead_types.join(', ')}.
For each lead return object with keys:
name, type, industry, location, email, phone, website, linkedin, size, founded, revenue_estimate, decision_maker, social_presence, description, pain_points (array), tech_stack (array), fit_score (1-100), intent_score (1-100), reach_score (1-100), priority (hot/warm/cold), reason, outreach_subject, outreach_body.
Return only valid JSON array.`

  const raw = await callGroq(apiKey, prompt)
  const parsed = safeJSON(raw)
  if (!Array.isArray(parsed)) throw new Error('Auto leads response was not an array')
  return parsed.slice(0, missingCount)
}

async function saveGeneratedLeads(leads, settings) {
  if (!Array.isArray(leads) || leads.length === 0) return 0
  const context = {
    auto: true,
    location: settings.location,
    industry: settings.industry,
    product: settings.product,
    lead_types: settings.lead_types,
  }
  const rows = await Promise.all(leads.map(lead => normalizeLead(lead, context)))
  const existingKeys = await fetchExistingLeadKeys()
  const { dedupedRows } = dedupeLeadRows(rows, existingKeys)
  if (dedupedRows.length === 0) return 0

  const { error } = await supabase
    .from('leads')
    .upsert(dedupedRows, { onConflict: 'dedup_key', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
  return dedupedRows.length
}

export async function runLeadAutomationNow(trigger = 'cron') {
  if (autoRunInProgress) return { skipped: true, reason: 'already-running' }
  autoRunInProgress = true

  try {
    const settings = await getLeadAutomationSettings()
    if (!settings.enabled) return { skipped: true, reason: 'disabled', weekly_target: settings.weekly_target }

    const currentCount = await countLeadsThisWeek()
    const missing = Math.max(0, settings.weekly_target - currentCount)
    if (missing <= 0) {
      return { skipped: true, reason: 'target-met', weekly_target: settings.weekly_target, current_count: currentCount }
    }

    const apiKey = await fetchGroqKey(settings)
    const generated = await generateAutoLeads(missing, settings, apiKey)
    const saved = await saveGeneratedLeads(generated, settings)
    return {
      trigger,
      weekly_target: settings.weekly_target,
      current_count: currentCount,
      requested: missing,
      generated: generated.length,
      saved,
    }
  } finally {
    autoRunInProgress = false
  }
}
