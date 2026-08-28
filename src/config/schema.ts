import { z } from 'zod';

/**
 * Config schema for the "buddy quiz" activity.
 *
 * This file is the contract between three consumers:
 *   - backend  : validates + runs the engine
 *   - LIFF     : renders from the public subset
 *   - admin UI : builds forms from this schema (phase 3)
 *
 * Rule: nothing user-visible may live outside this schema.
 */

const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'must be #RRGGBB');
const Slug = z.string().regex(/^[a-z0-9_]+$/, 'lowercase, digits and _ only');

/** Personality axes. Declared per-campaign so a client can rename them. */
export const AxisDef = z.object({
  id: Slug,
  label: z.string().max(24),
  label_en: z.string().max(40).optional(),   // e.g. "THE PREPPER"
  body: z.string().max(400).optional(),       // longer description shown on Survivor Card
  short: z.string().max(60).optional(),       // one-liner shown on axis chips
  image_url: z.string().url().optional(),     // character portrait for Survivor Card / solo result
  order: z.string().max(4).optional(),        // e.g. "01" — used for card display
  /** For solo/MBTI mode: two pole labels. positive score = poles[0], negative = poles[1] */
  poles: z.array(z.string().max(24)).length(2).optional(),
  /** Weight used in group score formula. Higher = this axis contributes more to group survival score. */
  group_weight: z.number().min(0).max(100).default(10),
});

/** One selectable answer. `scores` is PRIVATE — never sent to the client. */
export const Option = z.object({
  id: Slug,
  label: z.string().min(1).max(60),
  scores: z.record(Slug, z.number().int().min(-5).max(5)),
});

export const Question = z.object({
  id: Slug,
  kicker: z.string().max(40).optional(),      // e.g. "01 · THE NEWS"
  text: z.string().min(1).max(140),
  options: z.array(Option).min(2).max(8),
});

/**
 * Result rules are evaluated top to bottom; first match wins.
 *
 *  pair     — unordered match on the two players' dominant axes.
 *             ['energy','calm'] matches A=energy/B=calm and A=calm/B=energy.
 *  combined — range check on the summed score of both players.
 *
 * A rule with neither condition always matches (useful as a catch-all).
 */
export const ResultRule = z.object({
  code: Slug,
  rank: z.number().int().min(1).max(50).optional(),  // rank 1-15
  title: z.string().min(1).max(120),
  body: z.string().max(600),
  image_url: z.string().url().optional(),
  pair: z.array(Slug).length(2).optional(),
  combined: z
    .record(Slug, z.object({ min: z.number().optional(), max: z.number().optional() }))
    .optional(),
  /** Points contributed to group score when a member has this archetype (score mode groups) */
  score_contribution: z.number().min(0).max(9999).optional(),
});

export const MessageSpec = z.object({
  template: z.string(),
  slots: z.record(z.string(), z.string()),
});

export const RewardMilestone = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/).max(40),
  trigger_pairs: z.number().int().min(1).max(50),
  reward_pool_id: z.string().uuid(),
  label: z.string().max(80),
  icon: z.string().max(4).optional(),
});

export const RewardConfig = z.object({
  enabled: z.boolean().default(false),
  points_per_pair: z.number().int().min(0).max(1000).default(50),
  milestones: z.array(RewardMilestone).max(5).optional(),
});

/**
 * Condition for matching a group to a GroupArchetype.
 * Rules are: evaluate archetypes top-to-bottom, pick highest min_group_size that matches.
 */
export const GroupCondition = z.object({
  /** Group must contain at least one member with each/any of these axes as dominant */
  has_axes: z.array(Slug).min(1).optional(),
  has_mode: z.enum(['any', 'all']).default('any'),
  /** Group's top-N dominant axes (by member count) must include these */
  top_axes: z.array(Slug).min(1).optional(),
  top_n: z.number().int().min(1).max(5).default(1),
  /** No single axis dominates (each axis < dominant_threshold) */
  is_balanced: z.boolean().optional(),
  /** Threshold for "dominant" checks (0–1). default 0.5 */
  dominant_threshold: z.number().min(0.3).max(0.9).default(0.5),
  /** Require at least N members to share the same axis */
  min_members_with_axis: z.number().int().min(1).optional(),
  /** Max number of distinct top-axes present in the group. 1 = all same axis (clone condition). */
  max_distinct: z.number().int().min(1).max(6).optional(),
});

/**
 * One outcome in the group result system.
 * Evaluated top-to-bottom; the highest-min_group_size matching entry wins.
 */
export const GroupArchetype = z.object({
  code: Slug,
  title: z.string().min(1).max(120),
  /** Pre-set main display text shown prominently on group result screen (e.g. "รอดได้ 40 วัน") */
  primary_text: z.string().max(120).optional(),
  body: z.string().max(600),
  image_url: z.string().url().optional(),
  /** Small symbol/icon shown in F-08 unlock push (distinct from the hero image_url) */
  symbol_url: z.string().url().optional(),
  /** Minimum group size for this entry to be eligible. Default 2. */
  min_group_size: z.number().int().min(2).max(200).default(2),
  /** If set, this entry is only eligible when group size ≤ this value. */
  max_group_size: z.number().int().min(2).max(200).optional(),
  condition: GroupCondition.nullable().optional(),
  /** Catch-all: used when no other archetype at this size matches. Must have one per min_group_size tier. */
  fallback: z.boolean().optional(),
  /** Reward pool to unlock when this archetype is confirmed (group >= reward_members) */
  reward_pool_id: z.string().uuid().optional(),
  /** Score-mode: archetype applies when group score >= min_score */
  min_score: z.number().min(0).optional(),
  /** Score-mode: archetype applies when group score <= max_score */
  max_score: z.number().min(0).optional(),
});

/**
 * Optional formula for score-mode groups (e.g. "survival days").
 * Not needed for match-mode (destination / archetype name only).
 */
export const GroupFormula = z.object({
  base: z.number().int().min(0).max(1000).default(10),
  /** Bonus per axis that has at least one representative in the group */
  per_axis_coverage: z.number().int().min(0).max(50).default(8),
  /** Bonus when no axis exceeds dominant_threshold */
  balance_bonus: z.number().int().min(0).max(100).default(14),
  /** Bonus per member (capped at per_member_cap) */
  per_member: z.number().int().min(0).max(20).default(2),
  per_member_cap: z.number().int().min(0).max(100).default(10),
  /** Display unit appended to score, e.g. "วัน", "คะแนน", "%" */
  unit: z.string().max(20).default('วัน'),
});

export const GroupConfig = z.object({
  enabled: z.boolean().default(false),

  /** Result display mode */
  result_mode: z.enum(['score', 'match']).default('match'),

  /** Minimum members to show any group result */
  min_members: z.number().int().min(2).max(200).default(2),
  /** Members needed to unlock reward (code / claim) */
  reward_members: z.number().int().min(2).max(200).default(5),
  /** Hard cap on group size (for rolling: max per batch × max batches) */
  max_members: z.number().int().min(2).max(200).default(5),

  /**
   * What happens when group reaches max_members / reward_members:
   *   hard_cap      — group locks, newcomers see "create your own group"
   *   rolling       — every batch_size members unlock a reward batch
   *   creator_pick  — group creator selects reward_members recipients
   */
  overflow_mode: z.enum(['hard_cap', 'rolling', 'creator_pick']).default('rolling'),
  /** For rolling mode: how many members per reward batch */
  batch_size: z.number().int().min(2).max(200).optional(),

  /** Group result (axes composition) locks after this many members. 0 = never lock. */
  result_locks_at: z.number().int().min(0).max(200).default(0),

  /** Score formula — only used when result_mode = 'score' */
  formula: GroupFormula.optional(),

  /** Ordered list of possible outcomes. Evaluated top-to-bottom. */
  archetypes: z.array(GroupArchetype).min(1),

  /** code of the GroupArchetype used when nothing matches */
  fallback_archetype: Slug,
})
.superRefine((cfg, ctx) => {
  if (cfg.reward_members < cfg.min_members) {
    ctx.addIssue({ code: 'custom', message: 'reward_members must be >= min_members', path: ['reward_members'] });
  }
  if (cfg.max_members < cfg.reward_members) {
    ctx.addIssue({ code: 'custom', message: 'max_members must be >= reward_members', path: ['max_members'] });
  }
  if (cfg.overflow_mode === 'rolling' && !cfg.batch_size) {
    ctx.addIssue({ code: 'custom', message: 'batch_size is required when overflow_mode is rolling', path: ['batch_size'] });
  }
  if (!cfg.archetypes.some(a => a.code === cfg.fallback_archetype)) {
    ctx.addIssue({ code: 'custom', message: `fallback_archetype "${cfg.fallback_archetype}" not found in archetypes`, path: ['fallback_archetype'] });
  }
  // Every min_group_size tier must have a fallback
  const tiers = [...new Set(cfg.archetypes.map(a => a.min_group_size))];
  for (const tier of tiers) {
    const hasFallback = cfg.archetypes.some(a => a.min_group_size === tier && a.fallback);
    if (!hasFallback) {
      ctx.addIssue({ code: 'custom', message: `No fallback archetype for min_group_size=${tier}`, path: ['archetypes'] });
    }
  }
});

export type GroupCondition = z.infer<typeof GroupCondition>;
export type GroupArchetype = z.infer<typeof GroupArchetype>;
export type GroupFormula = z.infer<typeof GroupFormula>;
export type GroupConfig = z.infer<typeof GroupConfig>;

export const AppearanceConfig = z.object({
  // Theme & Brand
  accent: HexColor.optional(),
  theme: z.enum(['dark', 'light']).optional(),
  font: z.enum(['editorial', 'friendly', 'system']).optional(),
  texture: z.boolean().optional(),
  kv_treatment: z.enum(['illustration', 'photo', 'flat']).optional(),
  radius: z.number().int().min(0).max(20).optional(),
  // Layout
  intro_layout: z.enum(['kv55', 'fullbleed', 'compact']).optional(),
  question_layout: z.enum(['card', 'list', 'swipe']).optional(),
  summary_layout: z.enum(['idcard', 'logbook']).optional(),
  pair_layout: z.enum(['fullbleed', 'card']).optional(),
  show_dots: z.boolean().optional(),
  show_progress_pct: z.boolean().optional(),
  show_reward: z.boolean().optional(),
  sticky_cta: z.boolean().optional(),
  // Loading & Motion
  loading_style: z.enum(['ring', 'pulse', 'bar', 'skeleton']).optional(),
  loading_copy: z.string().max(60).optional(),
  min_ms: z.number().int().min(0).max(5000).optional(),
  timeout_s: z.number().int().min(3).max(30).optional(),
  match_ms: z.number().int().min(0).max(5000).optional(),
  transition: z.enum(['fade', 'slide', 'rise', 'none']).optional(),
  easing: z.enum(['soft', 'snappy', 'linear']).optional(),
  // Key Visuals
  images: z.record(z.string().url()).optional(),
  // Integration
  liff_id: z.string().max(40).optional(),
  oa_id: z.string().max(60).optional(),
  share_mode: z.enum(['picker', 'url']).optional(),
  flex_title: z.string().max(120).optional(),
  flex_sub: z.string().max(200).optional(),
  flex_cta: z.string().max(40).optional(),
});

export type AppearanceConfig = z.infer<typeof AppearanceConfig>;

export const CampaignConfig = z
  .object({
    id: Slug,
    type: z.literal('buddy_quiz'),
    mode: z.enum(['pair', 'solo']).default('pair'),
    version: z.number().int().positive(),

    brand: z.object({
      name: z.string().max(60),
      logo_url: z.string().url().optional(),
      kv_image_url: z.string().url().optional(),
      primary: HexColor,
      surface: HexColor,
      on_surface: HexColor,
    }),

    /** Every piece of user-facing text. Open record so new screens need no schema change. */
    copy: z.record(z.string(), z.string()),

    axes: z.array(AxisDef).min(2).max(6),
    questions: z.array(Question).min(3).max(8),
    results: z.array(ResultRule).min(2),
    fallback_result: Slug,

    rules: z.object({
      invite_ttl_hours: z.number().int().min(1).max(168).default(48),
      require_friend: z.boolean().default(true),
      max_pairs_per_user_per_day: z.number().int().min(1).max(50).default(5),
      allow_self_pair: z.boolean().default(false),
    }),

    /** Keys used by the backend: 'invite' | 'partner_done' | 'welcome' */
    messages: z.record(z.string(), MessageSpec),

    /** Optional reward system config */
    rewards: RewardConfig.optional(),

    /** Optional group result config */
    group: GroupConfig.optional(),

    /** Visual appearance config for the LIFF app */
    appearance: AppearanceConfig.optional(),
  })
  /* ---- cross-field checks: these catch the mistakes an admin UI will make ---- */
  .superRefine((cfg, ctx) => {
    const axisIds = new Set(cfg.axes.map((a) => a.id));

    const dup = (arr: string[]) => arr.filter((v, i) => arr.indexOf(v) !== i);

    for (const d of dup(cfg.questions.map((q) => q.id)))
      ctx.addIssue({ code: 'custom', message: `duplicate question id: ${d}`, path: ['questions'] });

    cfg.questions.forEach((q, qi) => {
      for (const d of dup(q.options.map((o) => o.id)))
        ctx.addIssue({
          code: 'custom',
          message: `duplicate option id: ${d}`,
          path: ['questions', qi, 'options'],
        });

      q.options.forEach((o, oi) => {
        for (const axis of Object.keys(o.scores)) {
          if (!axisIds.has(axis))
            ctx.addIssue({
              code: 'custom',
              message: `unknown axis "${axis}"`,
              path: ['questions', qi, 'options', oi, 'scores'],
            });
        }
      });
    });

    cfg.results.forEach((r, ri) => {
      for (const axis of r.pair ?? []) {
        if (!axisIds.has(axis))
          ctx.addIssue({
            code: 'custom',
            message: `unknown axis "${axis}"`,
            path: ['results', ri, 'pair'],
          });
      }
    });

    if (!cfg.results.some((r) => r.code === cfg.fallback_result))
      ctx.addIssue({
        code: 'custom',
        message: `fallback_result "${cfg.fallback_result}" is not in results`,
        path: ['fallback_result'],
      });

    if (cfg.mode !== 'solo') {
      for (const key of ['invite', 'partner_done'] as const) {
        if (!cfg.messages[key])
          ctx.addIssue({ code: 'custom', message: `messages.${key} is required`, path: ['messages'] });
      }
    }
  });

export type CampaignConfig = z.infer<typeof CampaignConfig>;
export type Question = z.infer<typeof Question>;
export type Option = z.infer<typeof Option>;
export type ResultRule = z.infer<typeof ResultRule>;
export type RewardMilestone = z.infer<typeof RewardMilestone>;
export type RewardConfig = z.infer<typeof RewardConfig>;

/** Axis id -> points. */
export type Scores = Record<string, number>;

export type Answer = { questionId: string; optionId: string };
