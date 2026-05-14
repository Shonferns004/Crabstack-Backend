import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', async (req, res) => {
  let query = supabase.from('blog_posts').select('*, blog_categories(name)').order('created_at', { ascending: false })
  if (req.query.published === 'true') query = query.eq('published', true)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/categories', async (_, res) => {
  const { data, error } = await supabase.from('blog_categories').select('*').order('name')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('blog_posts').select('*, blog_categories(name)').eq('id', req.params.id).single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', authenticate, async (req, res) => {
  const { title, slug, content, excerpt, image_url, category_id, author, published } = req.body
  const { data, error } = await supabase.from('blog_posts').insert({ title, slug, content, excerpt, image_url, category_id, author, published }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await log(req.user.id, 'create', 'blog_post', data.id)
  res.status(201).json(data)
})

router.put('/:id', authenticate, async (req, res) => {
  const { title, slug, content, excerpt, image_url, category_id, author, published } = req.body
  const { data, error } = await supabase.from('blog_posts').update({ title, slug, content, excerpt, image_url, category_id, author, published, updated_at: new Date() }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await log(req.user.id, 'update', 'blog_post', req.params.id)
  res.json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('blog_posts').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  await log(req.user.id, 'delete', 'blog_post', req.params.id)
  res.json({ success: true })
})

router.post('/categories', authenticate, async (req, res) => {
  const { name, slug } = req.body
  const { data, error } = await supabase.from('blog_categories').insert({ name, slug }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.put('/categories/:id', authenticate, async (req, res) => {
  const { name, slug } = req.body
  const { data, error } = await supabase.from('blog_categories').update({ name, slug }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/categories/:id', authenticate, async (req, res) => {
  const { error } = await supabase.from('blog_categories').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

async function log(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
