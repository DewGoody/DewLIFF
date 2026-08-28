import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { getConfig } from '../config/loader.js';
import { toPublicConfig } from '../config/public.js';
import { logEvent } from '../services/events.js';

export const campaignRouter = Router();

// Public config endpoint — returns only the stripped public subset of config (no scores, no results).
// Auth is optional: userId logged if present, but a valid token is not required to read public config.
campaignRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const cfg = await getConfig(id);
    if (req.userId) logEvent({ userId: req.userId, type: 'open', campaignId: id });
    res.json(toPublicConfig(cfg));
  } catch (err) {
    next(err);
  }
});
