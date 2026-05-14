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
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('subscribers').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
