import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { getPairStatus, getPairWithPartner } from '../services/pair.js';

export const pairRouter = Router();

// GET /api/pair/with-user?partnerId=xxx&campaignId=xxx
pairRouter.get('/with-user', auth, async (req, res, next) => {
  try {
    const { partnerId, campaignId } = z.object({
      partnerId: z.string().min(1),
      campaignId: z.string().min(1),
    }).parse(req.query);
    const result = await getPairWithPartner(req.userId!, partnerId, campaignId);
    res.json(result ?? { status: 'not_found' });
  } catch (err) {
    next(err);
  }
});

pairRouter.get('/:pairId', auth, async (req, res, next) => {
  try {
    const view = await getPairStatus(req.userId!, req.params.pairId as string);
    res.json(view);
  } catch (err) {
    next(err);
  }
});
