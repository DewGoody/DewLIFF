import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../env.js';
import { UnauthorizedError } from '../errors/index.js';

export const webhookSignature: RequestHandler = (req, _res, next) => {
  const signature = req.headers['x-line-signature'] as string | undefined;
  if (!signature) {
    next(new UnauthorizedError('Missing x-line-signature'));
    return;
  }

  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    next(new UnauthorizedError('Missing raw body'));
    return;
  }

  const expected = crypto
    .createHmac('sha256', env().LINE_CHANNEL_SECRET)
    .update(rawBody)
    .digest('base64');

  // timingSafeEqual requires same length buffers
  const sigBuf = Buffer.from(signature, 'base64');
  const expBuf = Buffer.from(expected, 'base64');

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    next(new UnauthorizedError('Invalid signature'));
    return;
  }

  next();
};
