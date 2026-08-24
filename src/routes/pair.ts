import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getPairStatus } from '../services/pair.js';

export const pairRouter = Router();

pairRouter.get('/:pairId', auth, async (req, res, next) => {
  try {
    const view = await getPairStatus(req.userId!, req.params.pairId as string);
    res.json(view);
  } catch (err) {
    next(err);
  }
});
