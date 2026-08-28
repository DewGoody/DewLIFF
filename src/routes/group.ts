import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { createGroup, joinGroup, getGroup, claimGroupReward, shareGroup, addPairsToGroup, getMyGroups, leaveGroup, renameGroup } from '../services/group.js';

export const groupRouter = Router();

// All group routes require LINE auth
groupRouter.use(auth);

// GET /api/group/my-groups?campaignId=xxx
groupRouter.get('/my-groups', async (req, res, next) => {
  try {
    const { campaignId } = z.object({ campaignId: z.string().min(1) }).parse(req.query);
    const result = await getMyGroups(req.userId!, campaignId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

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

// POST /api/group/:id/add-pairs — add selected pair-partners as members (creator only)
groupRouter.post('/:id/add-pairs', async (req, res, next) => {
  try {
    const { pairIds } = z.object({ pairIds: z.array(z.string().uuid()).min(1) }).parse(req.body);
    const result = await addPairsToGroup(req.userId!, req.params.id, pairIds);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/group/:id/leave
groupRouter.delete('/:id/leave', async (req, res, next) => {
  try {
    await leaveGroup(req.userId!, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/group/:id/name
groupRouter.patch('/:id/name', async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(50) }).parse(req.body);
    await renameGroup(req.userId!, req.params.id, name);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/group/:id/share — lock archetype + unlock symbol for member
groupRouter.post('/:id/share', async (req, res, next) => {
  try {
    const result = await shareGroup(req.userId!, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
