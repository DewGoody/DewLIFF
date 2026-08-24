import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/client.js';
import { env } from '../env.js';

export const uploadRouter = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// POST /api/admin/upload — upload image to Supabase Storage, return public URL
uploadRouter.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No file uploaded' } });
      return;
    }

    const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const bucket = 'campaign-assets';
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadErr } = await db()
      .storage
      .from(bucket)
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[upload] storage error:', uploadErr);
      res.status(500).json({ error: { code: 'UPLOAD_ERROR', message: uploadErr.message } });
      return;
    }

    const { data } = db().storage.from(bucket).getPublicUrl(path);

    res.json({ ok: true, url: data.publicUrl });
  } catch (err) {
    next(err);
  }
});
