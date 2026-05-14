import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_, res) => {
  let query = supabase.from('custom_pages').select('*').order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('custom_pages').select('*').eq('id', req.params.id).single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', authenticate, async (req, res) => {
  const { title, slug, content, meta_title, meta_description, published } = req.body
  const { data, error } = await supabase.from('custom_pages').insert({ title, slug, content, meta_title, meta_description, published }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.put('/:id', authenticate, async (req, res) => {
  const { title, slug, content, meta_title, meta_description, published } = req.body
  const { data, error } = await supabase.from('custom_pages').update({ title, slug, content, meta_title, meta_description, published }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('custom_pages').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
