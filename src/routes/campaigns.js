import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import {
  ensureCampaignTables,
  getNextRunAtISO,
  isValidCronExpression,
  runCampaignNow,
} from '../services/campaignScheduler.js'

const router = Router()

function toText(value) {
  if (value === undefined || value === null) return null
  const out = String(value).trim()
  return out || null
}

function normalizeCampaignInput(body = {}, isUpdate = false) {
  const out = {}

  if (!isUpdate || body.name !== undefined) {
    const name = toText(body.name)
    if (!name) throw new Error('Campaign name is required')
    out.name = name
  }

  if (!isUpdate || body.cron_expression !== undefined) {
    const cron = toText(body.cron_expression)
    if (!cron) throw new Error('cron_expression is required')
    if (!isValidCronExpression(cron)) throw new Error('Invalid cron_expression')
    out.cron_expression = cron
  }

  if (body.description !== undefined || !isUpdate) {
    out.description = toText(body.description)
  }

  if (body.is_active !== undefined || !isUpdate) {
    out.is_active = body.is_active === undefined ? true : Boolean(body.is_active)
  }

  if (body.payload !== undefined || !isUpdate) {
    out.payload = body.payload && typeof body.payload === 'object' ? body.payload : {}
  }

  out.updated_at = new Date().toISOString()
  return out
}

router.get('/', authenticate, async (_req, res) => {
  try {
    await ensureCampaignTables()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data || [])
})

router.get('/:id/runs', authenticate, async (req, res) => {
  try {
    await ensureCampaignTables()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const { data, error } = await supabase
    .from('campaign_runs')
    .select('*')
    .eq('campaign_id', req.params.id)
    .order('started_at', { ascending: false })
    .limit(100)

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data || [])
})

router.post('/', authenticate, async (req, res) => {
  try {
    await ensureCampaignTables()
    const input = normalizeCampaignInput(req.body, false)
    const nowIso = new Date().toISOString()
    input.created_at = nowIso
    input.created_by = req.user?.id || req.user?.username || 'admin'
    input.next_run_at = input.is_active ? getNextRunAtISO(input.cron_expression, new Date()) : null

    const { data, error } = await supabase
      .from('campaigns')
      .insert(input)
      .select('*')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
})

router.put('/:id', authenticate, async (req, res) => {
  try {
    await ensureCampaignTables()
    const input = normalizeCampaignInput(req.body, true)

    const { data: current, error: currentErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (currentErr) return res.status(500).json({ error: currentErr.message })
    if (!current) return res.status(404).json({ error: 'Campaign not found' })

    const cronValue = input.cron_expression || current.cron_expression
    const isActive = input.is_active === undefined ? current.is_active : input.is_active
    input.next_run_at = isActive ? getNextRunAtISO(cronValue, new Date()) : null

    const { data, error } = await supabase
      .from('campaigns')
      .update(input)
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
})

router.post('/:id/run', authenticate, async (req, res) => {
  try {
    const output = await runCampaignNow(req.params.id, 'manual')
    return res.json({ success: true, output })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await ensureCampaignTables()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true })
})

export default router
