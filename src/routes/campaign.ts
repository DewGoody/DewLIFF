import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { getConfig } from '../config/loader.js';
import { toPublicConfig } from '../config/public.js';
import { logEvent } from '../services/events.js';
import { logAnalyticsEvent } from '../services/analytics.js';
import { getCampaignRewards } from './rewards.js';

export const campaignRouter = Router();

// GET /api/campaign/:id/rewards — active reward triggers + user claim status
campaignRouter.get('/:id/rewards', optionalAuth, (req, res) =>
  getCampaignRewards(req as unknown as Parameters<typeof getCampaignRewards>[0], res as unknown as Parameters<typeof getCampaignRewards>[1])
);

// Public config endpoint — returns only the stripped public subset of config (no scores, no results).
// Auth is optional: userId logged if present, but a valid token is not required to read public config.
campaignRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const cfg = await getConfig(id);
    if (req.userId) {
      logEvent({ userId: req.userId, type: 'open', campaignId: id });
      logAnalyticsEvent({ userId: req.userId, campaignId: id, type: 'open', source: 'organic' }).catch(() => {});
    }

    const pub = toPublicConfig(cfg);

    // Inject LIFF ID from LIFF_URL env var so each deployment env (dev/prod) points
    // clients to the correct LIFF endpoint regardless of what's stored in campaign config.
    const envLiffUrl = process.env.LIFF_URL?.trim();
    if (envLiffUrl) {
      // Extract liff_id from https://liff.line.me/<id> or use the whole URL as liff_base_url
      const liffIdMatch = envLiffUrl.match(/liff\.line\.me\/([^/?#]+)/);
      if (liffIdMatch) {
        pub.appearance = { ...(pub.appearance ?? {}), liff_id: liffIdMatch[1] };
      }
    }

    res.json(pub);
  } catch (err) {
    next(err);
  }
});
