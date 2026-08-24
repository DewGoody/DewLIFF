import crypto from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (req, _res, next) => {
  req.requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
  next();
};
