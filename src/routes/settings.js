import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_, res) => {
  const { data, error } = await supabase.from('settings').select('*')
  if (error) return res.status(500).json({ error: error.message })
  const obj = {}
  data.forEach(s => { obj[s.key] = s.value })
  res.json(obj)
})

router.put('/', authenticate, async (req, res) => {
  const entries = Object.entries(req.body)
  for (const [key, value] of entries) {
    const { data: existing } = await supabase.from('settings').select('id').eq('key', key).maybeSingle()
    if (existing) {
      await supabase.from('settings').update({ value: String(value) }).eq('id', existing.id)
    } else {
      await supabase.from('settings').insert({ key, value: String(value) })
    }
  }
  await supabase.from('activity_log').insert({ user_id: req.user.id, action: 'update', entity_type: 'settings' })
  res.json({ success: true })
})

export default router
