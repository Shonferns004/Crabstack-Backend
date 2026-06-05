import dotenv from 'dotenv'
dotenv.config()

import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

const admins = [
  { username: process.env.ADMIN1_USERNAME || process.env.ADMIN_USERNAME || 'admin1', password: process.env.ADMIN1_PASSWORD || process.env.ADMIN_PASSWORD },
  { username: process.env.ADMIN2_USERNAME, password: process.env.ADMIN2_PASSWORD },
  { username: process.env.ADMIN3_USERNAME, password: process.env.ADMIN3_PASSWORD },
].filter(a => a.username && a.password)

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    const admin = admins.find(a => a.username === username && a.password === password)
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign(
      { id: admin.username, username: admin.username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    supabase.from('activity_log').insert({
      user_id: admin.username, action: 'login', entity_type: 'auth', entity_id: admin.username
    }).then().catch(() => {})

    res.json({ token, user: { id: admin.username, username: admin.username, role: 'admin' } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/logout', (_, res) => {
  res.json({ success: true })
})

router.get('/me', (req, res) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET)
    res.json({ user: { id: decoded.id, username: decoded.username, role: decoded.role } })
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
})

export default router
