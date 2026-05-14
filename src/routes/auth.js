import { Router } from 'express'
import jwt from 'jsonwebtoken'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    const adminUser = process.env.ADMIN_USERNAME || 'admin'
    const adminPass = process.env.ADMIN_PASSWORD

    if (!adminPass) {
      return res.status(500).json({ error: 'Admin password not configured' })
    }

    if (username !== adminUser || password !== adminPass) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: 'admin', username: adminUser, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({ token, user: { id: 'admin', username: adminUser, role: 'admin' } })
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
