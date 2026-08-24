import type { Answer, CampaignConfig, ResultRule, Scores } from '../config/schema.js';

/**
 * Pure scoring engine. No DB, no network, no LINE.
 * Everything here is deterministic and unit-testable in milliseconds.
 */

export class InvalidAnswerError extends Error {}

/** Answers must cover every question exactly once, with option ids that exist. */
export function validateAnswers(cfg: CampaignConfig, answers: Answer[]): void {
  const seen = new Set<string>();

  for (const a of answers) {
    const q = cfg.questions.find((x) => x.id === a.questionId);
    if (!q) throw new InvalidAnswerError(`unknown question: ${a.questionId}`);
    if (seen.has(a.questionId)) throw new InvalidAnswerError(`duplicate answer: ${a.questionId}`);
    if (!q.options.some((o) => o.id === a.optionId))
      throw new InvalidAnswerError(`unknown option ${a.optionId} for ${a.questionId}`);
    seen.add(a.questionId);
  }

  const missing = cfg.questions.filter((q) => !seen.has(q.id)).map((q) => q.id);
  if (missing.length) throw new InvalidAnswerError(`missing answers: ${missing.join(', ')}`);
}

/** Sum the private per-option scores into a per-axis total. */
export function scoreAnswers(cfg: CampaignConfig, answers: Answer[]): Scores {
  validateAnswers(cfg, answers);

  const totals: Scores = {};
  for (const axis of cfg.axes) totals[axis.id] = 0;

  for (const a of answers) {
    const q = cfg.questions.find((x) => x.id === a.questionId)!;
    const o = q.options.find((x) => x.id === a.optionId)!;
    for (const [axis, pts] of Object.entries(o.scores)) {
      totals[axis] = (totals[axis] ?? 0) + pts;
    }
  }
  return totals;
}

/**
 * Highest-scoring axis. Ties break by the order axes are declared in config,
 * so the outcome is stable rather than dependent on object key ordering.
 */
export function dominantAxis(cfg: CampaignConfig, scores: Scores): string {
  let best = cfg.axes[0].id;
  for (const axis of cfg.axes) {
    if ((scores[axis.id] ?? 0) > (scores[best] ?? 0)) best = axis.id;
  }
  return best;
}

export function mergeScores(a: Scores, b: Scores): Scores {
  const out: Scores = { ...a };
  for (const [axis, pts] of Object.entries(b)) out[axis] = (out[axis] ?? 0) + pts;
  return out;
}

function matchesPair(rule: ResultRule, axisA: string, axisB: string): boolean {
  if (!rule.pair) return true;
  const [x, y] = rule.pair;
  return (axisA === x && axisB === y) || (axisA === y && axisB === x);
}

function matchesCombined(rule: ResultRule, combined: Scores): boolean {
  if (!rule.combined) return true;
  return Object.entries(rule.combined).every(([axis, range]) => {
    const v = combined[axis] ?? 0;
    if (range.min !== undefined && v < range.min) return false;
    if (range.max !== undefined && v > range.max) return false;
    return true;
  });
}

export type PairOutcome = {
  result: ResultRule;
  axisA: string;
  axisB: string;
  scoresA: Scores;
  scoresB: Scores;
  combined: Scores;
  usedFallback: boolean;
};

// ── Solo mode (MBTI-style) ──────────────────────────────

export type SoloOutcome = {
  result: ResultRule;
  typeCode: string;
  scores: Scores;
  poles: Record<string, string>;
  usedFallback: boolean;
};

/**
 * Solo mode: each axis has two poles. Positive score = poles[0], negative = poles[1].
 * Combine first letter of each pole into a type code (e.g. "ENTP"),
 * then look up the matching result by code.
 */
export function resolveSolo(cfg: CampaignConfig, answers: Answer[]): SoloOutcome {
  const scores = scoreAnswers(cfg, answers);

  const poles: Record<string, string> = {};
  let typeCode = '';

  for (const axis of cfg.axes) {
    const v = scores[axis.id] ?? 0;
    const p = axis.poles ?? [axis.id, axis.id];
    const pole = v >= 0 ? p[0] : p[1];
    poles[axis.id] = pole;
    typeCode += pole[0].toUpperCase();
  }

  // Match by code (exact match on type code, case-insensitive)
  const typeLower = typeCode.toLowerCase();
  const hit = cfg.results.find((r) => r.code.toLowerCase() === typeLower);
  const fallback = cfg.results.find((r) => r.code === cfg.fallback_result);

  if (!hit && !fallback) throw new Error('config has no matching result and no fallback');

  return {
    result: hit ?? fallback!,
    typeCode,
    scores,
    poles,
    usedFallback: !hit,
  };
}

// ── Pair mode ───────────────────────────────────────────

/** Rules are evaluated in config order; first match wins. Order = priority. */
export function resolvePair(
  cfg: CampaignConfig,
  answersA: Answer[],
  answersB: Answer[],
): PairOutcome {
  const scoresA = scoreAnswers(cfg, answersA);
  const scoresB = scoreAnswers(cfg, answersB);
  const combined = mergeScores(scoresA, scoresB);
  const axisA = dominantAxis(cfg, scoresA);
  const axisB = dominantAxis(cfg, scoresB);

  const hit = cfg.results.find(
    (r) => matchesPair(r, axisA, axisB) && matchesCombined(r, combined),
  );

  const fallback = cfg.results.find((r) => r.code === cfg.fallback_result);
  if (!hit && !fallback) throw new Error('config has no matching result and no fallback');

  return {
    result: hit ?? fallback!,
    axisA,
    axisB,
    scoresA,
    scoresB,
    combined,
    usedFallback: !hit,
  };
}
