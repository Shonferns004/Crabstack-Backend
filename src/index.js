import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
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
import groqKeyRoutes from './routes/groqKeys.js'
import leadRoutes from './routes/leads.js'
import campaignRoutes from './routes/campaigns.js'
import { startCampaignScheduler } from './services/campaignScheduler.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))
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
app.use('/api/groq-keys', groqKeyRoutes)
app.use('/api/leads', leadRoutes)
app.use('/api/campaigns', campaignRoutes)

app.get('/api/health', (_, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`Crabstack backend running on http://localhost:${PORT}`)
  startCampaignScheduler()
})
