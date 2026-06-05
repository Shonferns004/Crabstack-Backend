import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50))
  const offset = (page - 1) * limit
  const action = req.query.action
  const entity = req.query.entity_type

  let query = supabase
    .from('activity_log')
    .select('*, users!activity_log_user_id_fkey(username, role)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) query = query.eq('action', action)
  if (entity) query = query.eq('entity_type', entity)

  const { data, error, count } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ data, total: count, page, limit })
})

export default router
