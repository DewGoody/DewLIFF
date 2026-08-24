import type { RequestHandler } from 'express';
import { verifyIdToken } from '../services/line.js';
import { UnauthorizedError } from '../errors/index.js';
import { db } from '../db/client.js';

export const auth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    console.error('[auth debug] no Authorization header on', req.path);
    next(new UnauthorizedError());
    return;
  }

  const idToken = header.slice(7);

  try {
    const profile = await verifyIdToken(idToken);
    req.userId = profile.sub;
    console.error('[auth debug] verified ok, sub:', profile.sub);

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
    console.error('[auth debug] verifyIdToken failed:', err instanceof Error ? err.message : err);
    next(err instanceof UnauthorizedError ? err : new UnauthorizedError());
  }
};
