import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.post('/', async (req, res) => {
  const { name, email, message } = req.body
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' })
  }
  const { data, error } = await supabase.from('contacts').insert({ name, email, message }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(null, 'create', 'contact', data.id)
  res.status(201).json(data)
})

router.get('/', authenticate, async (req, res) => {
  let query = supabase.from('contacts').select('*').order('created_at', { ascending: false })
  if (req.query.unread === 'true') query = query.eq('is_read', false)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.patch('/:id', authenticate, async (req, res) => {
  const { is_read, assigned_to, reply } = req.body
  const { data, error } = await supabase.from('contacts').update({ is_read, assigned_to, reply }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'update', 'contact', req.params.id)
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('contacts').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'delete', 'contact', req.params.id)
  res.json({ success: true })
})

async function logActivity(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
