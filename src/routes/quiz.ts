import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { startQuiz, joinPair, submitAnswers } from '../services/pair.js';
import { logEvent } from '../services/events.js';
import { saveUserAnswers, getMyAnswers, getInviterProfile, matchAndCompute, getMySummary, setDisplayName, getMySymbols } from '../services/match.js';

export const quizRouter = Router();

const AnswerItems = z.array(
  z.object({ questionId: z.string().min(1), optionId: z.string().min(1) }),
);

// ── Legacy pair flow (kept for demo mode & backward compat) ──

const StartBody = z.object({
  campaignId: z.string().min(1),
  demo: z.boolean().optional().default(false),
});

quizRouter.post('/start', auth, async (req, res, next) => {
  try {
    const { campaignId, demo } = StartBody.parse(req.body);
    const result = await startQuiz(req.userId!, campaignId, demo);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

quizRouter.post('/join', auth, async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const result = await joinPair(req.userId!, token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

quizRouter.post('/answer', auth, async (req, res, next) => {
  try {
    const { pairId, answers } = z.object({ pairId: z.string().uuid(), answers: AnswerItems }).parse(req.body);
    const result = await submitAnswers(req.userId!, pairId, answers);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── New 1-answer-N-pairs flow ──

// POST /api/quiz/save-answers — A answers once, stores permanently, gets share link
quizRouter.post('/save-answers', auth, async (req, res, next) => {
  try {
    const { campaignId, answers } = z.object({
      campaignId: z.string().min(1),
      answers: AnswerItems,
    }).parse(req.body);
    console.log('[save-answers] userId:', req.userId, 'campaignId:', campaignId, 'answers:', answers.length);
    const result = await saveUserAnswers(req.userId!, campaignId, answers);
    res.json(result);
  } catch (err) {
    console.error('[save-answers] ERROR:', err instanceof Error ? err.message : err);
    next(err);
  }
});

// GET /api/quiz/my-summary?campaignId=xxx — summary screen data (archetype + pairs list)
quizRouter.get('/my-summary', auth, async (req, res, next) => {
  try {
    const campaignId = z.string().min(1).parse(req.query.campaignId);
    const result = await getMySummary(req.userId!, campaignId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/quiz/my-answers?campaignId=xxx — check if A already has saved answers
quizRouter.get('/my-answers', auth, async (req, res, next) => {
  try {
    const campaignId = z.string().min(1).parse(req.query.campaignId);
    const result = await getMyAnswers(req.userId!, campaignId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/quiz/inviter/:userId — get inviter display name + pic (no auth needed)
quizRouter.get('/inviter/:userId', async (req, res, next) => {
  try {
    const inviterId = z.string().min(1).parse(req.params.userId);
    const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
    const profile = await getInviterProfile(inviterId, campaignId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// POST /api/quiz/match — B answers, creates pair, computes result, pushes both
quizRouter.post('/match', auth, async (req, res, next) => {
  try {
    const { inviterId, campaignId, answers, fromGroup } = z.object({
      inviterId: z.string().min(1),
      campaignId: z.string().min(1),
      answers: AnswerItems.optional(),
      fromGroup: z.boolean().optional(),
    }).parse(req.body);
    const result = await matchAndCompute(req.userId!, inviterId, campaignId, answers, { fromGroup });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/quiz/set-name — upsert user display_name from LIFF profile (no OA friendship needed)
quizRouter.post('/set-name', auth, async (req, res, next) => {
  try {
    const { displayName } = z.object({
      displayName: z.string().min(1).max(100),
      pictureUrl: z.string().url().optional(),
    }).parse(req.body);
    await setDisplayName(req.userId!, displayName);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/quiz/my-symbols — unlocked group archetype codes for TeamBuilder
quizRouter.get('/my-symbols', auth, async (req, res, next) => {
  try {
    const { campaignId } = z.object({ campaignId: z.string().min(1) }).parse(req.query);
    const unlockedSymbols = await getMySymbols(req.userId!, campaignId);
    res.json({ unlockedSymbols });
  } catch (err) {
    next(err);
  }
});

// LIFF reports share success
quizRouter.post('/share', auth, async (req, res, next) => {
  try {
    const { pairId, campaignId } = z
      .object({ pairId: z.string().uuid().optional(), campaignId: z.string().min(1) })
      .parse(req.body);
    logEvent({ userId: req.userId, type: 'share_click', pairId, campaignId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
