import type { RequestHandler } from 'express';
import { verifyIdToken } from '../services/line.js';
import { UnauthorizedError } from '../errors/index.js';
import { db } from '../db/client.js';

/** Requires a valid LINE ID token. Rejects with 401 if missing or invalid. */
export const auth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError());
    return;
  }

  const idToken = header.slice(7);

  try {
    const profile = await verifyIdToken(idToken);
    req.userId = profile.sub;

    // Upsert user — fire and forget
    db()
      .from('users')
      .upsert(
        {
          line_user_id: profile.sub,
          display_name: profile.name,
        },
        { onConflict: 'line_user_id' },
      )
      .then(({ error }) => {
        if (error) console.error('User upsert failed:', error.message);
      });

    next();
  } catch (err) {
    next(err instanceof UnauthorizedError ? err : new UnauthorizedError());
  }
};

/** Optional auth — sets req.userId if a valid token is present, but never rejects the request. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const idToken = header.slice(7);
  try {
    const profile = await verifyIdToken(idToken);
    req.userId = profile.sub;
  } catch {
    // Token invalid — continue without userId
  }
  next();
};
