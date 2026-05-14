import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (_, res) => {
  const { data, error } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(100)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
