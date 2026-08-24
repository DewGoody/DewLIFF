import type { Answer, CampaignConfig } from '../config/schema.js';

export const DEMO_BUDDY_USER_ID = '__demo_buddy__';

/**
 * Pick the second option for every question — gives the demo buddy
 * a different personality from anyone who picks the first option.
 */
export function getDemoBuddyAnswers(cfg: CampaignConfig): Answer[] {
  return cfg.questions.map((q) => ({
    questionId: q.id,
    optionId: q.options[Math.min(1, q.options.length - 1)].id,
  }));
}
