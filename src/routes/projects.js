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
  const { title, description, image_url, tags, client_name, preview_link, github_repo, sort_order } = req.body
  const { data, error } = await supabase.from('projects').insert({ title, description, image_url, tags, client_name, preview_link, github_repo, sort_order }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'create', 'project', data.id)
  res.status(201).json(data)
})

router.put('/:id', authenticate, async (req, res) => {
  const { title, description, image_url, tags, client_name, preview_link, github_repo, sort_order } = req.body
  const { data, error } = await supabase.from('projects').update({ title, description, image_url, tags, client_name, preview_link, github_repo, sort_order }).eq('id', req.params.id).select().single()
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

router.get('/:id/images', async (req, res) => {
  const { data, error } = await supabase.from('project_images').select('*').eq('project_id', req.params.id).order('sort_order')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/:id/images', authenticate, async (req, res) => {
  const { image_url, device_type, sort_order } = req.body
  const { data, error } = await supabase.from('project_images').insert({ project_id: req.params.id, image_url, device_type, sort_order }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'create', 'project_image', data.id)
  res.status(201).json(data)
})

router.put('/:id/images/:imageId', authenticate, async (req, res) => {
  const { device_type, sort_order } = req.body
  const { data, error } = await supabase.from('project_images').update({ device_type, sort_order }).eq('id', req.params.imageId).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'update', 'project_image', req.params.imageId)
  res.json(data)
})

router.delete('/:id/images/:imageId', authenticate, async (req, res) => {
  const { error } = await supabase.from('project_images').delete().eq('id', req.params.imageId)
  if (error) return res.status(500).json({ error: error.message })
  await logActivity(req.user.id, 'delete', 'project_image', req.params.imageId)
  res.json({ success: true })
})

async function logActivity(userId, action, entityType, entityId) {
  await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId })
}

export default router
