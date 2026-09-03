/**
 * Unit tests for resolveSolo (MBTI-style scoring).
 * No DB, no network — pure function only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSolo } from './buddyQuiz.js';
import type { CampaignConfig } from '../config/schema.js';

/** Minimal solo config: 2 dimensions (EI, TF), 2 questions, 4 results */
const soloCfg = {
  id: 'solo_test',
  mode: 'solo',
  version: 1,
  type: 'buddy_quiz',
  brand: { name: 'Test', primary: '#000000', surface: '#ffffff', on_surface: '#000000' },
  copy: {},
  messages: {},
  rules: { invite_ttl_hours: 48, require_friend: false, max_pairs_per_user_per_day: 5, allow_self_pair: false },
  axes: [
    { id: 'ei', label: 'EI', poles: ['I', 'E'], group_weight: 10 },
    { id: 'tf', label: 'TF', poles: ['T', 'F'], group_weight: 10 },
  ],
  questions: [
    {
      id: 'q1',
      text: 'Q1',
      options: [
        { id: 'q1_i', label: 'Introvert', scores: { ei: 2, tf: 0 } },  // ei positive → poles[0] = 'I'
        { id: 'q1_e', label: 'Extravert', scores: { ei: -2, tf: 0 } }, // ei negative → poles[1] = 'E'
      ],
    },
    {
      id: 'q2',
      text: 'Q2',
      options: [
        { id: 'q2_t', label: 'Thinking', scores: { ei: 0, tf: 2 } },  // tf positive → poles[0] = 'T'
        { id: 'q2_f', label: 'Feeling',  scores: { ei: 0, tf: -2 } }, // tf negative → poles[1] = 'F'
      ],
    },
  ],
  results: [
    { code: 'it', title: 'IT type', body: '' },
    { code: 'if', title: 'IF type', body: '' },
    { code: 'et', title: 'ET type', body: '' },
    { code: 'ef', title: 'EF type', body: '' },
  ],
  fallback_result: 'it',
} as unknown as CampaignConfig;

const ans = (q1: string, q2: string) => [
  { questionId: 'q1', optionId: q1 },
  { questionId: 'q2', optionId: q2 },
];

test('resolveSolo: positive scores → first poles (I, T) → code "IT"', () => {
  const out = resolveSolo(soloCfg, ans('q1_i', 'q2_t'));
  assert.equal(out.typeCode, 'IT');
  assert.equal(out.result.code, 'it');
  assert.equal(out.usedFallback, false);
});

test('resolveSolo: negative scores → second poles (E, F) → code "EF"', () => {
  const out = resolveSolo(soloCfg, ans('q1_e', 'q2_f'));
  assert.equal(out.typeCode, 'EF');
  assert.equal(out.result.code, 'ef');
  assert.equal(out.usedFallback, false);
});

test('resolveSolo: mixed → "IF"', () => {
  const out = resolveSolo(soloCfg, ans('q1_i', 'q2_f'));
  assert.equal(out.typeCode, 'IF');
  assert.equal(out.result.code, 'if');
  assert.equal(out.usedFallback, false);
});

test('resolveSolo: mixed → "ET"', () => {
  const out = resolveSolo(soloCfg, ans('q1_e', 'q2_t'));
  assert.equal(out.typeCode, 'ET');
  assert.equal(out.result.code, 'et');
});

test('resolveSolo: zero score (tie) → first pole wins (ei=0 → "I")', () => {
  // Create config where q1 options cancel each other — easier to just use a neutral option
  const cfgWithZero = {
    ...soloCfg,
    questions: [
      {
        id: 'q1',
        text: 'Q1',
        options: [
          { id: 'q1_z', label: 'Neutral', scores: { ei: 0, tf: 0 } }, // ei=0 → poles[0]='I'
        ],
      },
      {
        id: 'q2',
        text: 'Q2',
        options: [
          { id: 'q2_z', label: 'Neutral', scores: { ei: 0, tf: 0 } }, // tf=0 → poles[0]='T'
        ],
      },
    ],
  } as unknown as CampaignConfig;

  const out = resolveSolo(cfgWithZero, [
    { questionId: 'q1', optionId: 'q1_z' },
    { questionId: 'q2', optionId: 'q2_z' },
  ]);
  assert.equal(out.typeCode, 'IT'); // both >= 0 → first poles
});

test('resolveSolo: usedFallback true when no result matches code', () => {
  const cfgNoMatch = {
    ...soloCfg,
    results: [{ code: 'it', title: 'IT', body: '' }], // only "it" exists
    fallback_result: 'it',
  } as unknown as CampaignConfig;

  const out = resolveSolo(cfgNoMatch, ans('q1_e', 'q2_f')); // → code "EF", no match
  assert.equal(out.usedFallback, true);
  assert.equal(out.result.code, 'it'); // falls back
});

test('resolveSolo: raw scores are returned correctly', () => {
  const out = resolveSolo(soloCfg, ans('q1_i', 'q2_t'));
  assert.equal(out.scores.ei, 2);
  assert.equal(out.scores.tf, 2);
});

test('resolveSolo: poles record maps each axis to winning pole string', () => {
  const out = resolveSolo(soloCfg, ans('q1_e', 'q2_t'));
  assert.equal(out.poles.ei, 'E');
  assert.equal(out.poles.tf, 'T');
});
