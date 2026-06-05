import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (_, res) => {
  const { data, error } = await supabase.from('subscribers').select('*').order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })
  const { data, error } = await supabase.from('subscribers').insert({ email }).select().single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Already subscribed' })
    return res.status(500).json({ error: error.message })
  }
  res.status(201).json(data)
  await logActivity(null, 'create', 'subscriber', data.id).catch(() => {})
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('subscribers').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
  await logActivity(req.user.id, 'delete', 'subscriber', req.params.id).catch(() => {})
})

async function logActivity(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
