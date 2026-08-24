import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { startSolo, submitSoloAnswers } from '../services/solo.js';

export const soloRouter = Router();

const StartBody = z.object({
  campaignId: z.string().min(1),
});

soloRouter.post('/start', auth, async (req, res, next) => {
  try {
    const { campaignId } = StartBody.parse(req.body);
    const result = await startSolo(req.userId!, campaignId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const AnswerBody = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      optionId: z.string().min(1),
    }),
  ),
});

soloRouter.post('/answer', auth, async (req, res, next) => {
  try {
    const { sessionId, answers } = AnswerBody.parse(req.body);
    const result = await submitSoloAnswers(req.userId!, sessionId, answers);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
