// ── Group Config ─────────────────────────────────────────────────────────────

export interface GroupCondition {
  has_axes?: string[];
  has_mode?: 'any' | 'all';
  top_axes?: string[];
  top_n?: number;
  is_balanced?: boolean;
  dominant_threshold?: number;
  min_members_with_axis?: number;
  max_distinct?: number;
}

export interface GroupArchetype {
  code: string;
  title: string;
  /** Pre-set main display text shown on group result screen (e.g. "รอดได้ 40 วัน") */
  primary_text?: string;
  /** Small eyebrow text shown above title on result card */
  eyebrow?: string;
  body: string;
  image_url?: string;
  /** OG share image, ideally 1200×630 */
  og_image_url?: string;
  /** Share message text */
  share_text?: string;
  /** Small symbol/icon shown in F-08 unlock push */
  symbol_url?: string;
  min_group_size: number;
  max_group_size?: number;
  condition?: GroupCondition;
  fallback?: boolean;
  reward_pool_id?: string;
  min_score?: number;
  max_score?: number;
}

export interface GroupFormula {
  base: number;
  per_axis_coverage: number;
  balance_bonus: number;
  per_member: number;
  per_member_cap: number;
  unit: string;
}

export interface GroupConfig {
  enabled: boolean;
  result_mode: 'score' | 'match' | 'manual';
  min_members: number;
  reward_members: number;
  max_members: number;
  overflow_mode: 'hard_cap' | 'rolling' | 'creator_pick';
  batch_size?: number;
  result_locks_at: number;
  formula?: GroupFormula;
  archetypes: GroupArchetype[];
  fallback_archetype: string;
}

export interface AppearanceConfig {
  accent?: string;
  theme?: 'dark' | 'light';
  font?: 'editorial' | 'friendly' | 'system';
  texture?: string;
  kv_treatment?: 'illustration' | 'photo' | 'flat';
  radius?: number;
  intro_layout?: 'kv55' | 'fullbleed' | 'compact';
  question_layout?: 'card' | 'list' | 'swipe';
  summary_layout?: 'idcard' | 'logbook';
  pair_layout?: 'fullbleed' | 'card';
  show_dots?: boolean;
  show_progress_pct?: boolean;
  show_reward?: boolean;
  sticky_cta?: boolean;
  loading_style?: 'ring' | 'pulse' | 'bar' | 'skeleton';
  loading_copy?: string;
  min_ms?: number;
  timeout_s?: number;
  match_ms?: number;
  transition?: 'fade' | 'slide' | 'rise' | 'none';
  easing?: 'soft' | 'snappy' | 'linear';
  images?: Record<string, string>;
  og_frames?: {
    solo?: Record<string, string>;
    pair?: string;
    group?: string;
  };
  og_zones?: {
    solo?: { text_x?: number; title_y?: number; label_y?: number; body_y_start?: number };
    pair?: { badge_x?: number; badge_y?: number; body_y_start?: number };
    group?: { badge_x?: number; badge_y?: number; body_y_start?: number };
  };
  // Full theme token system
  colors?: {
    primary?: string; on_primary?: string; surface?: string; on_surface?: string;
    muted?: string; accent?: string; success?: string; danger?: string;
    overlay?: string; background?: string; highlight?: string;
  };
  font_display?: string;
  font_body?: string;
  font_accent?: string;
  font_display_url?: string;
  font_body_url?: string;
  font_scale?: number;
  border_width?: number;
  shadow?: 'none' | 'soft' | 'hard';
  shadow_offset?: number;
  tilt?: 'off' | 'subtle' | 'playful';
  logo_url?: string;
  logo_position?: 'top-left' | 'top-center' | 'hidden';
  logo_height?: number;
  // Holds both legacy style-preset strings and Layout Editor block arrays per screen key
  screen_config?: Record<string, unknown>;
  custom_css?: string;
  notes?: string;
  liff_id?: string;
  oa_id?: string;
  share_mode?: 'picker' | 'url';
  flex_title?: string;
  flex_sub?: string;
  flex_cta?: string;
}

export interface Brand {
  name: string;
  logo_url?: string;
  kv_image_url?: string;
  primary: string;
  surface: string;
  on_surface: string;
}

export interface Axis {
  id: string;
  label: string;
  poles?: string[];
  group_weight?: number;
  /** UI-only — not sent to backend */
  color?: string;
}

export interface Option {
  id: string;
  label: string;
  scores: Record<string, number>;
}

export interface Question {
  id: string;
  text: string;
  options: Option[];
}

export interface ResultRule {
  code: string;
  title: string;
  body: string;
  image_url?: string;
  pair?: string[];
  combined?: Record<string, { min?: number; max?: number }>;
}

export interface Rules {
  invite_ttl_hours: number;
  require_friend: boolean;
  max_pairs_per_user_per_day: number;
  allow_self_pair: boolean;
}

export interface MessageSpec {
  template: string;
  slots: Record<string, string>;
}

export interface RewardMilestone {
  key: string;
  trigger_pairs: number;
  reward_pool_id: string;
  label: string;
  icon?: string;
}

export interface RewardConfig {
  enabled: boolean;
  points_per_pair: number;
  milestones?: RewardMilestone[];
}

export interface CampaignConfig {
  id: string;
  type: 'buddy_quiz' | 'group';
  mode: 'pair' | 'solo' | 'mbti' | 'group';
  version: number;
  brand: Brand;
  copy: Record<string, string>;
  axes: Axis[];
  questions: Question[];
  results: ResultRule[];
  fallback_result: string;
  rules: Rules;
  messages: Record<string, MessageSpec>;
  rewards?: RewardConfig;
  group?: GroupConfig;
  appearance?: AppearanceConfig;
}

export interface CampaignMeta {
  id: string;
  type: string;
  status: 'draft' | 'live' | 'ended';
  currentVersion: number;
  draftVersion?: number | null;
  mode: string;
  brandName: string;
  createdAt?: string;
}

/** Editor-friendly intermediate state */
export interface EditorAxis {
  id: string;
  label: string;
  label_en?: string;
  body?: string;
  short?: string;
  image_url?: string;
  order?: string;
  color: string;
  poles?: string[];
  group_weight?: number;
}

export interface EditorOption {
  id: string;
  label: string;
  scores: Record<string, number>;
}

export interface EditorQuestion {
  id: string;
  text: string;
  options: EditorOption[];
}

export interface ResultEntry {
  title: string;
  body: string;
  eyebrow?: string;
  image_url?: string;
  og_image_url?: string;
  share_text?: string;
  score_contribution?: number;
}

/** Full editor state */
export interface EditorState {
  axes: EditorAxis[];
  questions: EditorQuestion[];
  results: Record<string, ResultEntry>; // key = pairKey(a,b) for pair/solo, type code for mbti
  fallback: ResultEntry;
  fallbackCode?: string; // mbti mode only: which result code is the fallback
  brand: Brand;
  copy: Record<string, string>;
  rules: Rules;
  messages: {
    invite_title: string;
    invite_cta: string;
    partner_done_title: string;
  };
  mode: 'pair' | 'solo' | 'mbti' | 'group';
  rewards?: RewardConfig;
  group?: GroupConfig;
  appearance?: AppearanceConfig;
}
