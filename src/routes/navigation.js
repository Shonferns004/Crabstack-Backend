import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_, res) => {
  const { data, error } = await supabase.from('navigation').select('*').order('sort_order')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.put('/', authenticate, async (req, res) => {
  const { items } = req.body
  await supabase.from('navigation').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { data, error } = await supabase.from('navigation').insert(items.map((item, i) => ({ ...item, sort_order: i }))).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('navigation').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
