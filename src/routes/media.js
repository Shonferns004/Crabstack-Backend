import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_, res) => {
  const { data, error } = await supabase.from('media').select('*').order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', authenticate, async (req, res) => {
  const { filename, url, alt } = req.body
  const { data, error } = await supabase.from('media').insert({ filename, url, alt }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.delete('/:id', authenticate, async (req, res) => {
  const { data: media, error: fetchError } = await supabase.from('media').select('url').eq('id', req.params.id).single()
  if (fetchError) return res.status(500).json({ error: fetchError.message })

  const fileName = media.url.split('/').pop()
  const { error: storageError } = await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'crabstack-media').remove([fileName])
  if (storageError) console.error('Storage delete error:', storageError)

  const { error } = await supabase.from('media').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
