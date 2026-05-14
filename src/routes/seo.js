import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_, res) => {
  const { data, error } = await supabase.from('seo_settings').select('*')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.put('/', authenticate, async (req, res) => {
  const settings = req.body
  for (const s of settings) {
    const { data: existing } = await supabase.from('seo_settings').select('id').eq('page', s.page).maybeSingle()
    if (existing) {
      await supabase.from('seo_settings').update({ title: s.title, description: s.description, og_image: s.og_image }).eq('id', existing.id)
    } else {
      await supabase.from('seo_settings').insert({ page: s.page, title: s.title, description: s.description, og_image: s.og_image })
    }
  }
  res.json({ success: true })
})

export default router
