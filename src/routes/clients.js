import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_, res) => {
  const { data, error } = await supabase.from('clients').select('*').order('sort_order')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', authenticate, async (req, res) => {
  const { name, logo_url, description, website, project_history, sort_order } = req.body
  const { data, error } = await supabase.from('clients').insert({ name, logo_url, description, website, project_history, sort_order }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'create', 'client', data.id)
  res.status(201).json(data)
})

router.put('/:id', authenticate, async (req, res) => {
  const { name, logo_url, description, website, project_history, sort_order } = req.body
  const { data, error } = await supabase.from('clients').update({ name, logo_url, description, website, project_history, sort_order }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'update', 'client', req.params.id)
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('clients').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'delete', 'client', req.params.id)
  res.json({ success: true })
})

async function logActivity(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
