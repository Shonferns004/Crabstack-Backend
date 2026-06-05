import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (_, res) => {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', authenticate, async (req, res) => {
  const { client_name, project_name, amount, status, file_url, notes } = req.body
  const { data, error } = await supabase.from('invoices').insert({ client_name, project_name, amount, status, file_url, notes }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
  await logActivity(req.user.id, 'create', 'invoice', data.id).catch(() => {})
})

router.put('/:id', authenticate, async (req, res) => {
  const { client_name, project_name, amount, status, file_url, notes } = req.body
  const { data, error } = await supabase.from('invoices').update({ client_name, project_name, amount, status, file_url, notes }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
  await logActivity(req.user.id, 'update', 'invoice', req.params.id).catch(() => {})
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('invoices').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
  await logActivity(req.user.id, 'delete', 'invoice', req.params.id).catch(() => {})
})

async function logActivity(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
