import { randomUUID } from 'crypto'
import { Router } from 'express'
import { supabase, query } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { validateContactInfo } from '../services/contactVerification.js'
import {
  buildLeadPrimaryDedupKey,
  dedupeLeadRows,
  getLeadKeySet,
} from '../services/leadDedup.js'
import {
  getLeadAutomationSettings,
  runLeadAutomationNow,
  updateLeadAutomationSettings,
} from '../services/leadAutomation.js'

const router = Router()
let ensureTablePromise = null

function ensureLeadsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = query(`
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
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `)
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date DATE;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_normalized TEXT;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_format_valid BOOLEAN DEFAULT false;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_domain_exists BOOLEAN DEFAULT false;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_mx_valid BOOLEAN DEFAULT false;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_e164 TEXT;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_e164_valid BOOLEAN DEFAULT false;`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_status TEXT DEFAULT 'unverified';`))
      .then(() => query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS dedup_key TEXT;`))
      .then(() => query(`CREATE UNIQUE INDEX IF NOT EXISTS leads_dedup_key_unique ON leads (dedup_key);`))
      .catch((err) => {
      ensureTablePromise = null
      throw err
    })
  }
  return ensureTablePromise
}

function toText(value) {
  if (value === undefined || value === null) return null
  const out = String(value).trim()
  return out || null
}

function toInt(value) {
  if (value === undefined || value === null || value === '') return null
  const out = Number(value)
  return Number.isFinite(out) ? Math.round(out) : null
}

function toTextArray(value) {
  if (!Array.isArray(value)) return null
  const out = value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  return out.length ? out : null
}

async function normalizeLead(lead, context, createdBy, batchId, source = 'manual') {
  const row = {
    batch_id: batchId,
    name: toText(lead?.name),
    type: toText(lead?.type),
    industry: toText(lead?.industry),
    location: toText(lead?.location),
    email: toText(lead?.email),
    phone: toText(lead?.phone),
    website: toText(lead?.website),
    linkedin: toText(lead?.linkedin),
    size: toText(lead?.size),
    founded: toText(lead?.founded),
    revenue_estimate: toText(lead?.revenue_estimate),
    decision_maker: toText(lead?.decision_maker),
    social_presence: toText(lead?.social_presence),
    description: toText(lead?.description),
    pain_points: toTextArray(lead?.pain_points),
    tech_stack: toTextArray(lead?.tech_stack),
    fit_score: toInt(lead?.fit_score),
    intent_score: toInt(lead?.intent_score),
    reach_score: toInt(lead?.reach_score),
    priority: toText(lead?.priority),
    reason: toText(lead?.reason),
    outreach_subject: toText(lead?.outreach_subject),
    outreach_body: toText(lead?.outreach_body),
    context: context || {},
    created_by: toText(createdBy) || 'admin',
    status: 'new',
    follow_up_date: null,
    deleted: false,
    deleted_at: null,
    source: toText(source) || 'manual',
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

    if (error) throw error
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

router.get('/automation', authenticate, async (_req, res) => {
  try {
    const settings = await getLeadAutomationSettings()
    return res.json(settings)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

router.put('/automation', authenticate, async (req, res) => {
  try {
    const settings = await updateLeadAutomationSettings(req.body || {})
    return res.json(settings)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
})

router.post('/automation/run', authenticate, async (_req, res) => {
  try {
    const out = await runLeadAutomationNow('manual')
    return res.json(out)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

router.post('/bulk', authenticate, async (req, res) => {
  try {
    await ensureLeadsTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const leads = Array.isArray(req.body?.leads) ? req.body.leads : []
  if (leads.length === 0) {
    return res.status(400).json({ error: 'Leads array is required' })
  }

  const batchId = randomUUID()
  const context = req.body?.context || {}
  const createdBy = req.user?.id || req.user?.username || 'admin'
  const source = toText(req.body?.source) || 'manual'
  const rows = await Promise.all(
    leads.map((lead) => normalizeLead(lead, context, createdBy, batchId, source)),
  )

  let existingKeys
  try {
    existingKeys = await fetchExistingLeadKeys()
  } catch (existingErr) {
    return res.status(500).json({ error: existingErr.message })
  }
  const { dedupedRows, skippedDuplicates } = dedupeLeadRows(rows, existingKeys)

  if (dedupedRows.length === 0) {
    return res.status(201).json({
      batch_id: batchId,
      saved: 0,
      skipped_duplicates: skippedDuplicates,
    })
  }

  const { data, error } = await supabase
    .from('leads')
    .upsert(dedupedRows, { onConflict: 'dedup_key', ignoreDuplicates: true })
    .select('id')

  if (error) return res.status(500).json({ error: error.message })

  await logActivity(req.user.id || 'admin', 'create', 'lead', 'bulk-' + batchId)

  return res.status(201).json({
    batch_id: batchId,
    saved: Array.isArray(data) ? data.length : dedupedRows.length,
    skipped_duplicates: skippedDuplicates,
  })
})

router.post('/', authenticate, async (req, res) => {
  try {
    await ensureLeadsTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  const { name, email, phone, type, industry, location, website, linkedin, size, description, status } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })
  const batchId = randomUUID()
  const { data, error } = await supabase.from('leads').insert({
    batch_id: batchId, name, email, phone, type, industry, location, website, linkedin, size, description,
    status: status || 'new', source: 'manual', created_by: req.user?.id || 'admin',
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'create', 'lead', data.id)
  res.status(201).json(data)
})

router.get('/', authenticate, async (_req, res) => {
  try {
    await ensureLeadsTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const includeDeleted = _req.query.include_deleted === 'true'
  const limit = Math.min(1000, Math.max(1, Number(_req.query.limit) || 500))
  let q = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!includeDeleted) q = q.eq('deleted', false)

  const { data, error } = await q

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data || [])
})

router.patch('/:id', authenticate, async (req, res) => {
  try {
    await ensureLeadsTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const fields = ['name', 'email', 'phone', 'type', 'industry', 'location', 'website', 'linkedin', 'size', 'description', 'status', 'follow_up_date']
  const updates = {}
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f]
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', req.params.id)
    .select('*')
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Lead not found' })
  await logActivity(req.user.id, 'update', 'lead', req.params.id)
  return res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await ensureLeadsTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const { error } = await supabase
    .from('leads')
    .update({ deleted: true, deleted_at: new Date().toISOString(), status: 'deleted' })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'delete', 'lead', req.params.id)
  return res.json({ success: true })
})

async function logActivity(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
