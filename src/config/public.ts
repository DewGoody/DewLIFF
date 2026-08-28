import type { CampaignConfig, ResultRule, RewardConfig, AppearanceConfig, GroupConfig } from './schema.js';

/**
 * Everything the LIFF app is allowed to see BEFORE the quiz is finished.
 *
 * Deliberately omitted:
 *   - option.scores   : would let anyone reverse-engineer the outcome
 *   - results         : the answer key
 *   - rules           : limits are enforced server-side; publishing them helps attackers
 *   - messages        : push templates are a server concern
 *
 * When you add a field to CampaignConfig, TypeScript will not force you to
 * update this function — so make the decision here consciously every time.
 */
/** Public GroupConfig strips reward_pool_id from archetypes (admin concern only) */
export type PublicGroupArchetype = Omit<GroupConfig['archetypes'][number], 'reward_pool_id'>;
export type PublicGroupConfig = Omit<GroupConfig, 'archetypes'> & {
  archetypes: PublicGroupArchetype[];
};

export type PublicConfig = {
  id: string;
  version: number;
  mode: string;
  brand: CampaignConfig['brand'];
  copy: Record<string, string>;
  axes: { id: string; label: string; label_en?: string; order?: string; short?: string; image_url?: string; poles?: string[]; group_weight?: number }[];
  questions: { id: string; kicker?: string; text: string; options: { id: string; label: string }[] }[];
  rewards?: RewardConfig;
  group?: PublicGroupConfig;
  appearance?: AppearanceConfig;
};

export function toPublicConfig(cfg: CampaignConfig): PublicConfig {
  return {
    id: cfg.id,
    version: cfg.version,
    mode: cfg.mode,
    brand: cfg.brand,
    copy: cfg.copy,
    axes: cfg.axes.map((a) => ({ id: a.id, label: a.label, label_en: a.label_en, order: a.order, short: a.short, body: a.body, image_url: a.image_url, poles: a.poles, group_weight: a.group_weight })),
    questions: cfg.questions.map((q) => ({
      id: q.id,
      kicker: q.kicker,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, label: o.label })),
    })),
    rewards: cfg.rewards,
    group: cfg.group ? {
      ...cfg.group,
      archetypes: cfg.group.archetypes.map(({ reward_pool_id: _rp, ...rest }) => rest),
    } : undefined,
    appearance: cfg.appearance,
  };
}

/** Result revealed only after both players have answered. */
export type PublicResult = {
  code: string;
  title: string;
  body: string;
  image_url?: string;
  rank?: number;
};

export function toPublicResult(r: ResultRule): PublicResult {
  return { code: r.code, title: r.title, body: r.body, image_url: r.image_url, rank: r.rank };
}
