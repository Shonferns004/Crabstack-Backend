import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (_, res) => {
  const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', async (req, res) => {
  const { name, email, phone, date, time, service_type, message } = req.body
  const { data, error } = await supabase.from('bookings').insert({ name, email, phone, date, time, service_type, message }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.patch('/:id', authenticate, async (req, res) => {
  const { status } = req.body
  const { data, error } = await supabase.from('bookings').update({ status }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('bookings').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
