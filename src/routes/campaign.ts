import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getConfig } from '../config/loader.js';
import { toPublicConfig } from '../config/public.js';
import { logEvent } from '../services/events.js';

export const campaignRouter = Router();

campaignRouter.get('/:id', auth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const cfg = await getConfig(id);
    logEvent({ userId: req.userId, type: 'open', campaignId: id });
    res.json(toPublicConfig(cfg));
  } catch (err) {
    next(err);
  }
});
