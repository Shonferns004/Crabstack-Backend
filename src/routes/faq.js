import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_, res) => {
  const { data, error } = await supabase.from('faq').select('*').order('sort_order')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', authenticate, async (req, res) => {
  const { question, answer, sort_order } = req.body
  const { data, error } = await supabase.from('faq').insert({ question, answer, sort_order }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await log(req.user.id, 'create', 'faq', data.id)
  res.status(201).json(data)
})

router.put('/:id', authenticate, async (req, res) => {
  const { question, answer, sort_order } = req.body
  const { data, error } = await supabase.from('faq').update({ question, answer, sort_order }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await log(req.user.id, 'update', 'faq', req.params.id)
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('faq').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  await log(req.user.id, 'delete', 'faq', req.params.id)
  res.json({ success: true })
})

async function log(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
