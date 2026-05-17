import { randomUUID } from 'crypto'
import { supabase, query } from '../config/supabase.js'
import { runLeadAutomationNow } from './leadAutomation.js'

let ensureTablesPromise = null
let schedulerTimer = null
let schedulerRunning = false

const FIELD_SPECS = [
  { key: 'minute', min: 0, max: 59 },
  { key: 'hour', min: 0, max: 23 },
  { key: 'day', min: 1, max: 31 },
  { key: 'month', min: 1, max: 12 },
  { key: 'weekday', min: 0, max: 6 },
]

function parseNumber(value, min, max, label) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return n
}

function expandPart(part, spec) {
  const token = String(part || '').trim()
  if (!token) throw new Error(`Invalid ${spec.key} token`)

  const set = new Set()
  if (token === '*') {
    for (let i = spec.min; i <= spec.max; i++) set.add(i)
    return { set, wildcard: true }
  }

  const chunks = token.split(',').map(x => x.trim()).filter(Boolean)
  if (chunks.length === 0) throw new Error(`Invalid ${spec.key} token`)

  for (const chunk of chunks) {
    let rangePart = chunk
    let step = 1
    if (chunk.includes('/')) {
      const [left, right] = chunk.split('/')
      if (!left || !right) throw new Error(`Invalid ${spec.key} step token: ${chunk}`)
      rangePart = left
      step = parseNumber(right, 1, spec.max, `${spec.key} step`)
    }

    let from
    let to
    if (rangePart === '*') {
      from = spec.min
      to = spec.max
    } else if (rangePart.includes('-')) {
      const [startRaw, endRaw] = rangePart.split('-')
      from = parseNumber(startRaw, spec.min, spec.max, `${spec.key} range start`)
      to = parseNumber(endRaw, spec.min, spec.max, `${spec.key} range end`)
      if (to < from) throw new Error(`Invalid ${spec.key} range: ${chunk}`)
    } else {
      from = parseNumber(rangePart, spec.min, spec.max, spec.key)
      to = from
    }

    for (let i = from; i <= to; i += step) set.add(i)
  }

  return { set, wildcard: false }
}

function compileCron(expression) {
  const parts = String(expression || '').trim().split(/\s+/)
  if (parts.length !== 5) throw new Error('Cron expression must have 5 fields')

  const compiled = parts.map((part, idx) => expandPart(part, FIELD_SPECS[idx]))
  return {
    fields: compiled,
    matches(date) {
      const minute = date.getMinutes()
      const hour = date.getHours()
      const day = date.getDate()
      const month = date.getMonth() + 1
      const weekday = date.getDay()

      const minuteOk = compiled[0].set.has(minute)
      const hourOk = compiled[1].set.has(hour)
      const monthOk = compiled[3].set.has(month)
      const dayOk = compiled[2].set.has(day)
      const weekdayOk = compiled[4].set.has(weekday)

      const dayWildcard = compiled[2].wildcard
      const weekdayWildcard = compiled[4].wildcard
      const domDowOk = dayWildcard || weekdayWildcard
        ? dayOk && weekdayOk
        : dayOk || weekdayOk

      return minuteOk && hourOk && monthOk && domDowOk
    },
  }
}

export function isValidCronExpression(expression) {
  try {
    compileCron(expression)
    return true
  } catch {
    return false
  }
}

export function getNextRunAtISO(expression, fromDate = new Date()) {
  const compiled = compileCron(expression)
  const start = new Date(fromDate.getTime())
  start.setSeconds(0, 0)
  start.setMinutes(start.getMinutes() + 1)

  const maxChecks = 60 * 24 * 366
  for (let i = 0; i < maxChecks; i++) {
    if (compiled.matches(start)) return start.toISOString()
    start.setMinutes(start.getMinutes() + 1)
  }
  throw new Error('Could not compute next run for cron expression')
}

export function ensureCampaignTables() {
  if (!ensureTablesPromise) {
    ensureTablesPromise = query(`
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
    `)
      .then(() => query(`
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
      `))
      .catch((err) => {
        ensureTablesPromise = null
        throw err
      })
  }
  return ensureTablesPromise
}

async function logCampaignRunStart(campaignId, source) {
  const runId = randomUUID()
  const { error } = await supabase
    .from('campaign_runs')
    .insert({
      id: runId,
      campaign_id: campaignId,
      trigger_source: source,
      status: 'running',
      started_at: new Date().toISOString(),
    })
  if (error) throw new Error(error.message)
  return runId
}

async function finishCampaignRun(runId, status, details = {}) {
  const patch = {
    status,
    finished_at: new Date().toISOString(),
  }
  if (details.output !== undefined) patch.output = details.output
  if (details.error !== undefined) patch.error = details.error

  const { error } = await supabase
    .from('campaign_runs')
    .update(patch)
    .eq('id', runId)
  if (error) throw new Error(error.message)
}

async function updateCampaignAfterRun(campaign, status) {
  const nowIso = new Date().toISOString()
  let nextRunAt = null
  if (campaign.is_active) {
    try {
      nextRunAt = getNextRunAtISO(campaign.cron_expression, new Date())
    } catch {
      nextRunAt = null
    }
  }

  const { error } = await supabase
    .from('campaigns')
    .update({
      last_run_at: nowIso,
      next_run_at: nextRunAt,
      last_status: status,
      updated_at: nowIso,
    })
    .eq('id', campaign.id)

  if (error) throw new Error(error.message)
}

async function executeCampaign(campaign, source = 'cron') {
  const runId = await logCampaignRunStart(campaign.id, source)
  try {
    const output = {
      message: `Campaign executed by ${source}`,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      payload: campaign.payload || {},
      executed_at: new Date().toISOString(),
    }

    await updateCampaignAfterRun(campaign, 'success')
    await finishCampaignRun(runId, 'success', { output })
    return output
  } catch (err) {
    await finishCampaignRun(runId, 'failed', { error: err.message })
    await updateCampaignAfterRun(campaign, 'failed')
    throw err
  }
}

export async function runCampaignNow(campaignId, source = 'manual') {
  await ensureCampaignTables()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Campaign not found')
  return executeCampaign(data, source)
}

async function schedulerTick() {
  if (schedulerRunning) return
  schedulerRunning = true

  try {
    await ensureCampaignTables()
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .or(`next_run_at.is.null,next_run_at.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(25)

    if (error) {
      console.error('[campaign-scheduler] query failed:', error.message)
      return
    }

    const list = Array.isArray(data) ? data : []
    for (const campaign of list) {
      try {
        await executeCampaign(campaign, 'cron')
        console.log(`[campaign-scheduler] executed: ${campaign.name} (${campaign.id})`)
      } catch (err) {
        console.error(`[campaign-scheduler] failed: ${campaign.name} (${campaign.id}) - ${err.message}`)
      }
    }

    try {
      const autoOut = await runLeadAutomationNow('cron')
      if (!autoOut?.skipped) {
        console.log(`[auto-leads] saved ${autoOut.saved || 0} leads (requested ${autoOut.requested || 0})`)
      }
    } catch (err) {
      console.error('[auto-leads] cron run failed:', err.message)
    }
  } catch (err) {
    console.error('[campaign-scheduler] tick failed:', err.message)
  } finally {
    schedulerRunning = false
  }
}

export function startCampaignScheduler() {
  if (process.env.CAMPAIGN_SCHEDULER === 'false') return null
  if (schedulerTimer) return schedulerTimer

  const intervalMs = Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || 30000)
  schedulerTimer = setInterval(schedulerTick, Math.max(5000, intervalMs))
  schedulerTick().catch(() => {})
  console.log(`[campaign-scheduler] started (interval ${Math.max(5000, intervalMs)}ms)`)
  return schedulerTimer
}

export function stopCampaignScheduler() {
  if (!schedulerTimer) return
  clearInterval(schedulerTimer)
  schedulerTimer = null
}
