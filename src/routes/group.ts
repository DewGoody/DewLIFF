import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { createGroup, joinGroup, getGroup, claimGroupReward } from '../services/group.js';

export const groupRouter = Router();

// All group routes require LINE auth
groupRouter.use(auth);

// POST /api/group/create
// Body: { campaignId }
groupRouter.post('/create', async (req, res, next) => {
  try {
    const { campaignId } = z.object({ campaignId: z.string().min(1) }).parse(req.body);
    const result = await createGroup(req.userId!, campaignId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/group/:id/join
groupRouter.post('/:id/join', async (req, res, next) => {
  try {
    const result = await joinGroup(req.userId!, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/group/:id
groupRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await getGroup(req.userId!, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/group/:id/claim
groupRouter.post('/:id/claim', async (req, res, next) => {
  try {
    const result = await claimGroupReward(req.userId!, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
