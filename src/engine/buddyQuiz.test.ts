import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getConfig, validateAll } from '../config/loader.js';
import { toPublicConfig } from '../config/public.js';
import {
  InvalidAnswerError,
  dominantAxis,
  resolvePair,
  scoreAnswers,
  validateAnswers,
} from './buddyQuiz.js';
import type { Answer } from '../config/schema.js';

const cfg = await getConfig('buddy_demo');

/** Pick the option at `idx` for every question — a valid full answer set. */
const pick = (idx: number): Answer[] =>
  cfg.questions.map((q) => ({
    questionId: q.id,
    optionId: q.options[Math.min(idx, q.options.length - 1)].id,
  }));

const ENERGY = pick(0);
const CALM = pick(1);
const PRECISE = pick(2);

test('every campaign file passes schema validation', async () => {
  const found = await validateAll();
  assert.ok(found.length > 0);
});

test('scoreAnswers sums the private per-option scores', () => {
  const s = scoreAnswers(cfg, ENERGY);
  assert.equal(s.energy, 10); // 5 questions x 2 points
  assert.equal(s.calm, 0);
  assert.equal(s.precision, 0);
});

test('dominantAxis breaks ties by declared axis order, not object key order', () => {
  const tied = { precision: 4, calm: 4, energy: 4 };
  assert.equal(dominantAxis(cfg, tied), cfg.axes[0].id);
});

test('missing an answer is rejected', () => {
  assert.throws(() => validateAnswers(cfg, ENERGY.slice(1)), InvalidAnswerError);
});

test('an option id from the wrong question is rejected', () => {
  const bad: Answer[] = [...ENERGY.slice(1), { questionId: cfg.questions[0].id, optionId: 'o_nope' }];
  assert.throws(() => validateAnswers(cfg, bad), InvalidAnswerError);
});

test('answering the same question twice is rejected', () => {
  const dup = [ENERGY[0], ENERGY[0], ...ENERGY.slice(1)];
  assert.throws(() => validateAnswers(cfg, dup), InvalidAnswerError);
});

test('matching axes resolve to the same-pair result', () => {
  assert.equal(resolvePair(cfg, ENERGY, ENERGY).result.code, 'fire_fire');
  assert.equal(resolvePair(cfg, CALM, CALM).result.code, 'calm_calm');
  assert.equal(resolvePair(cfg, PRECISE, PRECISE).result.code, 'precise_precise');
});

test('pair rules are unordered — A/B and B/A give the same result', () => {
  const ab = resolvePair(cfg, ENERGY, CALM).result.code;
  const ba = resolvePair(cfg, CALM, ENERGY).result.code;
  assert.equal(ab, ba);
  assert.equal(ab, 'fire_calm');
});

test('resolvePair reports both dominant axes and the combined score', () => {
  const out = resolvePair(cfg, ENERGY, PRECISE);
  assert.equal(out.axisA, 'energy');
  assert.equal(out.axisB, 'precision');
  assert.equal(out.combined.energy, 10);
  assert.equal(out.combined.precision, 10);
  assert.equal(out.usedFallback, false);
});

test('fallback fires when no rule matches', () => {
  const narrow = {
    ...cfg,
    results: [
      { code: 'never', pair: ['calm', 'calm'] as [string, string], title: 'x', body: '' },
      { code: 'balanced', pair: ['precision', 'precision'] as [string, string], title: 'y', body: '' },
    ],
  };
  const out = resolvePair(narrow as typeof cfg, ENERGY, ENERGY);
  assert.equal(out.result.code, 'balanced');
  assert.equal(out.usedFallback, true);
});

test('a rule with no conditions is a real match, not the fallback', () => {
  const out = resolvePair(cfg, ENERGY, ENERGY);
  assert.equal(out.usedFallback, false);
});

test('public config leaks neither scores nor results', () => {
  const pub = toPublicConfig(cfg);
  const json = JSON.stringify(pub);
  assert.ok(!json.includes('scores'));
  assert.ok(!json.includes('fire_fire'));
  assert.equal((pub as Record<string, unknown>).results, undefined);
  assert.equal((pub as Record<string, unknown>).rules, undefined);
  for (const q of pub.questions) {
    for (const o of q.options) assert.deepEqual(Object.keys(o).sort(), ['id', 'label']);
  }
});
