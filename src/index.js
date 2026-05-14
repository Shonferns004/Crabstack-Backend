import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import session from 'express-session'
import cron from 'node-cron'
import { supabase } from './config/supabase.js'
dotenv.config()

import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import serviceRoutes from './routes/services.js'
import testimonialRoutes from './routes/testimonials.js'
import faqRoutes from './routes/faq.js'
import blogRoutes from './routes/blog.js'
import contactRoutes from './routes/contacts.js'
import subscriberRoutes from './routes/subscribers.js'
import bookingRoutes from './routes/bookings.js'
import clientRoutes from './routes/clients.js'
import invoiceRoutes from './routes/invoices.js'
import pageRoutes from './routes/pages.js'
import navigationRoutes from './routes/navigation.js'
import seoRoutes from './routes/seo.js'
import mediaRoutes from './routes/media.js'
import settingsRoutes from './routes/settings.js'
import activityRoutes from './routes/activity.js'
import userRoutes from './routes/users.js'
import uploadRoutes from './routes/upload.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(session({
  secret: process.env.SESSION_SECRET || 'crabstack-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}))
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' })
  }
  next()
})

app.use('/api', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/testimonials', testimonialRoutes)
app.use('/api/faq', faqRoutes)
app.use('/api/blog', blogRoutes)
app.use('/api/contacts', contactRoutes)
app.use('/api/subscribers', subscriberRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/clients', clientRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api/pages', pageRoutes)
app.use('/api/navigation', navigationRoutes)
app.use('/api/seo', seoRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/users', userRoutes)
app.use('/api/upload', uploadRoutes)

app.get('/api/health', async (_, res) => {
  try {
    const { count, error } = await supabase.from('projects').select('*', { count: 'exact', head: true })
    res.json({ status: 'ok', projects: count || 0, timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message })
  }
})

cron.schedule('*/9 * * * *', async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/health`)
    const data = await res.json()
    console.log(`[Health Cron] ${data.status} — ${data.projects} projects — ${data.timestamp}`)
  } catch (err) {
    console.error('[Health Cron] Failed:', err.message)
  }
})

app.listen(PORT, () => {
  console.log(`Crabstack backend running on http://localhost:${PORT}`)
})
