import { Router } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' })

    const ext = req.file.originalname.split('.').pop()
    const fileName = `${uuidv4()}.${ext}`
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'crabstack-media'

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false })

    if (uploadError) return res.status(500).json({ error: uploadError.message })

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName)

    const { data: mediaRecord, error: dbError } = await supabase.from('media').insert({
      filename: req.file.originalname,
      url: publicUrl,
      alt: req.body.alt || ''
    }).select().single()

    if (dbError) return res.status(500).json({ error: dbError.message })

    res.status(201).json(mediaRecord)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
