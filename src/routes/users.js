import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (_, res) => {
  const { data, error } = await supabase.from('users').select('id, username, role, created_at').order('created_at')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', authenticate, async (req, res) => {
  const { username, password, role } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  const hash = await bcrypt.hash(password, 10)
  const { data, error } = await supabase.from('users').insert({ username, password_hash: hash, role: role || 'admin' }).select('id, username, role, created_at').single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Username already exists' })
    return res.status(500).json({ error: error.message })
  }
  await logActivity(req.user.id, 'create', 'user', data.id)
  res.status(201).json(data)
})

router.put('/:id', authenticate, async (req, res) => {
  const updates = {}
  if (req.body.username) updates.username = req.body.username
  if (req.body.role) updates.role = req.body.role
  if (req.body.password) updates.password_hash = await bcrypt.hash(req.body.password, 10)

  const { data, error } = await supabase.from('users').update(updates).eq('id', req.params.id).select('id, username, role, created_at').single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'update', 'user', req.params.id)
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('users').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'delete', 'user', req.params.id)
  res.json({ success: true })
})

async function logActivity(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
