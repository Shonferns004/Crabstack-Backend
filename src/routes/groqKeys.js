import { Router } from 'express'
import { supabase, query } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
let ensureTablePromise = null

function ensureGroqKeysTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = query(`
      CREATE TABLE IF NOT EXISTS groq_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT UNIQUE NOT NULL,
        api_key TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `).catch((err) => {
      ensureTablePromise = null
      throw err
    })
  }
  return ensureTablePromise
}

function maskKey(value = '') {
  const clean = String(value)
  if (clean.length <= 8) return '••••'
  return `${clean.slice(0, 4)}${'•'.repeat(Math.max(4, clean.length - 8))}${clean.slice(-4)}`
}

router.get('/', authenticate, async (_req, res) => {
  try {
    await ensureGroqKeysTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const { data, error } = await supabase
    .from('groq_keys')
    .select('id, name, api_key, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const list = (data || []).map(item => ({
    id: item.id,
    name: item.name,
    masked_key: maskKey(item.api_key),
    created_at: item.created_at,
    updated_at: item.updated_at,
  }))
  return res.json(list)
})

router.get('/:id/raw', authenticate, async (req, res) => {
  try {
    await ensureGroqKeysTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const { data, error } = await supabase
    .from('groq_keys')
    .select('id, name, api_key')
    .eq('id', req.params.id)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Groq key not found' })
  return res.json(data)
})

router.post('/', authenticate, async (req, res) => {
  try {
    await ensureGroqKeysTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const name = String(req.body?.name || '').trim()
  const apiKey = String(req.body?.api_key || '').trim()

  if (!name || !apiKey) {
    return res.status(400).json({ error: 'Name and API key are required' })
  }

  const { data, error } = await supabase
    .from('groq_keys')
    .insert({ name, api_key: apiKey })
    .select('id, name, api_key, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A key with this name already exists' })
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json({
    id: data.id,
    name: data.name,
    masked_key: maskKey(data.api_key),
    created_at: data.created_at,
    updated_at: data.updated_at,
  })
})

router.put('/:id', authenticate, async (req, res) => {
  try {
    await ensureGroqKeysTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const updates = {}
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim()
    if (!name) return res.status(400).json({ error: 'Name cannot be empty' })
    updates.name = name
  }
  if (req.body?.api_key !== undefined) {
    const apiKey = String(req.body.api_key).trim()
    if (!apiKey) return res.status(400).json({ error: 'API key cannot be empty' })
    updates.api_key = apiKey
  }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('groq_keys')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, name, api_key, created_at, updated_at')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A key with this name already exists' })
    return res.status(500).json({ error: error.message })
  }
  if (!data) return res.status(404).json({ error: 'Groq key not found' })

  return res.json({
    id: data.id,
    name: data.name,
    masked_key: maskKey(data.api_key),
    created_at: data.created_at,
    updated_at: data.updated_at,
  })
})

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await ensureGroqKeysTable()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const { error } = await supabase.from('groq_keys').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true })
})

export default router
