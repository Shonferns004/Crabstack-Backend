import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_, res) => {
  const { data, error } = await supabase.from('projects').select('*').order('sort_order')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('projects').select('*').eq('id', req.params.id).single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', authenticate, async (req, res) => {
  const { title, description, image_url, tags, client_name, sort_order } = req.body
  const { data, error } = await supabase.from('projects').insert({ title, description, image_url, tags, client_name, sort_order }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'create', 'project', data.id)
  res.status(201).json(data)
})

router.put('/:id', authenticate, async (req, res) => {
  const { title, description, image_url, tags, client_name, sort_order } = req.body
  const { data, error } = await supabase.from('projects').update({ title, description, image_url, tags, client_name, sort_order }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'update', 'project', req.params.id)
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('projects').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'delete', 'project', req.params.id)
  res.json({ success: true })
})

async function logActivity(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
