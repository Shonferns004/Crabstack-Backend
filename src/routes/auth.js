import { Router } from 'express'

const router = Router()

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

    req.session.user = { id: 'admin', username: adminUser, role: 'admin' }
    res.json({ user: { id: 'admin', username: adminUser, role: 'admin' } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true })
  })
})

router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json({ user: req.session.user })
})

export default router
