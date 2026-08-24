#!/usr/bin/env tsx
/**
 * Local demo — runs the full buddy quiz flow in the terminal.
 * No database, no LINE API, no server needed.
 * Uses the Phase 1 engine directly.
 */
import { getConfig } from '../src/config/loader.js';
import { toPublicConfig, toPublicResult } from '../src/config/public.js';
import {
  validateAnswers,
  scoreAnswers,
  dominantAxis,
  resolvePair,
} from '../src/engine/buddyQuiz.js';
import { generateInviteToken } from '../src/services/invite.js';
import { getDemoBuddyAnswers, DEMO_BUDDY_USER_ID } from '../src/services/demoBuddy.js';
import type { Answer } from '../src/config/schema.js';
import readline from 'node:readline';

const cliMode = process.argv[2]; // '1', '2', or '3'

const rl = cliMode ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => {
  if (cliMode) return Promise.resolve(cliMode);
  return new Promise<string>(resolve => rl!.question(q, resolve));
};

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function banner(text: string) {
  console.log(`\n${CYAN}${'─'.repeat(60)}${RESET}`);
  console.log(`${CYAN}${BOLD}  ${text}${RESET}`);
  console.log(`${CYAN}${'─'.repeat(60)}${RESET}\n`);
}

function step(n: number, text: string) {
  console.log(`\n${YELLOW}[Step ${n}]${RESET} ${BOLD}${text}${RESET}`);
}

function info(label: string, value: string) {
  console.log(`  ${DIM}${label}:${RESET} ${value}`);
}

function json(obj: unknown) {
  console.log(`  ${DIM}${JSON.stringify(obj, null, 2).split('\n').join('\n  ')}${RESET}`);
}

async function answerQuiz(
  playerName: string,
  color: string,
  publicConfig: ReturnType<typeof toPublicConfig>,
  auto?: Answer[],
): Promise<Answer[]> {
  const answers: Answer[] = [];

  for (let i = 0; i < publicConfig.questions.length; i++) {
    const q = publicConfig.questions[i];
    console.log(`\n  ${color}${playerName}${RESET} — ${DIM}ข้อ ${i + 1}/${publicConfig.questions.length}${RESET}`);
    console.log(`  ${BOLD}${q.text}${RESET}`);

    if (auto) {
      const a = auto[i];
      const picked = q.options.find(o => o.id === a.optionId)!;
      console.log(`  ${DIM}→ auto-pick: ${picked.label}${RESET}`);
      answers.push(a);
      continue;
    }

    for (let j = 0; j < q.options.length; j++) {
      console.log(`    ${j + 1}) ${q.options[j].label}`);
    }

    let choice = -1;
    if (cliMode) {
      // In auto mode, pick option based on question index
      choice = (i % q.options.length) + 1;
      console.log(`  ${DIM}→ auto-pick: ${choice}) ${q.options[choice - 1].label}${RESET}`);
    } else {
      while (choice < 1 || choice > q.options.length) {
        const input = await ask(`  ${color}เลือก (1-${q.options.length}): ${RESET}`);
        choice = parseInt(input);
      }
    }

    answers.push({ questionId: q.id, optionId: q.options[choice - 1].id });
  }

  return answers;
}

async function main() {
  banner('ลานกิจกรรม — Buddy Quiz Local Demo');

  // ─── Step 1: Load config ─────────────────────────
  step(1, 'โหลด campaign config');
  const cfg = await getConfig('buddy_demo');
  info('Campaign', `${cfg.id} v${cfg.version}`);
  info('Brand', cfg.brand.name);
  info('Axes', cfg.axes.map(a => `${a.label} (${a.id})`).join(', '));
  info('Questions', `${cfg.questions.length} ข้อ`);
  info('Results', `${cfg.results.length} แบบ`);

  // ─── Step 2: Public config (what LIFF sees) ──────
  step(2, 'สร้าง public config (สิ่งที่ LIFF เห็น)');
  const publicCfg = toPublicConfig(cfg);
  console.log(`  ${DIM}✓ scores ถูกตัดออก — ไม่มีเฉลยหลุดไป browser${RESET}`);
  console.log(`  ${DIM}✓ results ถูกตัดออก — ไม่มี answer key หลุด${RESET}`);
  console.log(`  ${DIM}✓ rules ถูกตัดออก — limits บังคับฝั่ง server เท่านั้น${RESET}`);

  // ─── Step 3: Choose mode ─────────────────────────
  step(3, 'เลือกโหมด');
  console.log('  1) ตอบเอง 2 คน (A แล้ว B)');
  console.log('  2) ตอบเป็น A + demo buddy ตอบอัตโนมัติ');
  console.log('  3) ดู demo buddy ตอบทั้งคู่ (auto ทั้งหมด)');
  const modeInput = await ask(`\n  ${YELLOW}เลือก (1/2/3): ${RESET}`);
  const mode = parseInt(modeInput) || 2;

  // ─── Step 4: Create pair ─────────────────────────
  step(4, 'สร้าง pair');
  const pairId = crypto.randomUUID();
  const configVersion = cfg.version;
  info('pair_id', pairId);
  info('config_version', String(configVersion));
  info('status', 'waiting');

  if (mode !== 3) {
    const { raw, hash } = generateInviteToken();
    info('invite_token (raw)', raw.slice(0, 20) + '...');
    info('invite_token (hash)', hash.slice(0, 20) + '...');
    console.log(`  ${DIM}→ เก็บแค่ hash ในฐานข้อมูล token จริงส่งให้ B ผ่าน LINE${RESET}`);

    const expiresAt = new Date(Date.now() + cfg.rules.invite_ttl_hours * 3600000);
    info('expires_at', expiresAt.toISOString());
  }

  console.log(`  ${DIM}→ event logged: quiz_start${RESET}`);

  // ─── Step 5: Player A answers ────────────────────
  step(5, 'Player A ตอบคำถาม');

  let answersA: Answer[];
  if (mode === 3) {
    // Auto A — pick first option
    answersA = cfg.questions.map(q => ({ questionId: q.id, optionId: q.options[0].id }));
    console.log(`  ${DIM}→ auto-pick: ตัวเลือกแรกทุกข้อ${RESET}`);
  } else {
    answersA = await answerQuiz('A', MAGENTA, publicCfg);
  }

  validateAnswers(cfg, answersA);
  console.log(`\n  ${GREEN}✓ คำตอบ valid — ครบทุกข้อ ไม่มี id ผิด${RESET}`);

  const scoresA = scoreAnswers(cfg, answersA);
  const axisA = dominantAxis(cfg, scoresA);
  console.log(`  ${BOLD}Scores A:${RESET}`);
  for (const axis of cfg.axes) {
    const bar = '█'.repeat(Math.max(0, scoresA[axis.id] || 0)) + '░'.repeat(Math.max(0, 10 - (scoresA[axis.id] || 0)));
    console.log(`    ${axis.label.padEnd(10)} ${bar} ${scoresA[axis.id] || 0}`);
  }
  console.log(`  ${BOLD}แกนเด่น A: ${cfg.axes.find(a => a.id === axisA)!.label}${RESET}`);
  console.log(`  ${DIM}→ event logged: quiz_done (A)${RESET}`);

  // ─── Step 6: Player B answers ────────────────────
  step(6, mode === 1 ? 'Player B ตอบคำถาม' : 'Demo buddy ตอบอัตโนมัติ');

  let answersB: Answer[];
  if (mode === 1) {
    console.log(`\n  ${DIM}(จำลอง: B กดลิงก์ → verify token → token ถูกใช้ → B เข้า pair)${RESET}`);
    console.log(`  ${DIM}→ event logged: invite_open${RESET}\n`);
    answersB = await answerQuiz('B', CYAN, publicCfg);
  } else {
    answersB = getDemoBuddyAnswers(cfg);
    console.log(`  ${DIM}→ demo buddy เลือกตัวเลือกที่ 2 ทุกข้อ${RESET}`);
  }

  validateAnswers(cfg, answersB);
  console.log(`\n  ${GREEN}✓ คำตอบ valid${RESET}`);

  const scoresB = scoreAnswers(cfg, answersB);
  const axisB = dominantAxis(cfg, scoresB);
  console.log(`  ${BOLD}Scores B:${RESET}`);
  for (const axis of cfg.axes) {
    const bar = '█'.repeat(Math.max(0, scoresB[axis.id] || 0)) + '░'.repeat(Math.max(0, 10 - (scoresB[axis.id] || 0)));
    console.log(`    ${axis.label.padEnd(10)} ${bar} ${scoresB[axis.id] || 0}`);
  }
  console.log(`  ${BOLD}แกนเด่น B: ${cfg.axes.find(a => a.id === axisB)!.label}${RESET}`);
  console.log(`  ${DIM}→ event logged: quiz_done (B)${RESET}`);

  // ─── Step 7: Resolve pair ────────────────────────
  step(7, 'คำนวณผลลัพธ์ (resolvePair)');
  const outcome = resolvePair(cfg, answersA, answersB);

  info('axisA', `${axisA} (${cfg.axes.find(a => a.id === axisA)!.label})`);
  info('axisB', `${axisB} (${cfg.axes.find(a => a.id === axisB)!.label})`);
  info('result_code', outcome.result.code);
  info('usedFallback', String(outcome.usedFallback));

  console.log(`  ${DIM}Combined scores:${RESET}`);
  for (const axis of cfg.axes) {
    info(`  ${axis.label}`, String(outcome.combined[axis.id] || 0));
  }

  console.log(`\n  ${DIM}→ UPDATE pairs SET status='completed', result_code='${outcome.result.code}'${RESET}`);
  console.log(`  ${DIM}→ event logged: pair_done${RESET}`);

  if (mode !== 1 || true) {
    console.log(`  ${DIM}→ enqueue push-notification to A${RESET}`);
    console.log(`  ${DIM}→ (queue handler) POST /v2/bot/message/push → "คู่หูตอบแล้ว"${RESET}`);
    console.log(`  ${DIM}→ event logged: push_sent${RESET}`);
  }

  // ─── Step 8: Result (what LIFF shows) ────────────
  step(8, 'ผลลัพธ์ที่แสดงบน LIFF');
  const publicResult = toPublicResult(outcome.result);

  banner(`${publicCfg.copy.result_eyebrow || 'คุณสองคนคือ'}`);

  console.log(`  ${BOLD}${publicResult.title}${RESET}`);
  console.log(`  ${publicResult.body}\n`);
  console.log(`  🏷️  คุณ: ${cfg.axes.find(a => a.id === outcome.axisA)!.label}`);
  console.log(`  🏷️  คู่หู: ${cfg.axes.find(a => a.id === outcome.axisB)!.label}`);

  if (publicResult.image_url) {
    console.log(`  🖼️  ${publicResult.image_url}`);
  }

  // ─── Summary ────────────────────────────────────
  banner('สรุป events ที่ถูก log');

  const events = [
    { type: 'quiz_start', user: 'A', detail: `campaign=${cfg.id}` },
    { type: 'quiz_done', user: 'A', detail: `axis=${axisA}` },
    ...(mode === 1 ? [{ type: 'invite_open', user: 'B', detail: 'token verified' }] : []),
    { type: 'quiz_done', user: 'B', detail: `axis=${axisB}` },
    { type: 'pair_done', user: 'system', detail: `result=${outcome.result.code}` },
    { type: 'push_sent', user: 'A', detail: '"คู่หูตอบแล้ว"' },
  ];

  for (const e of events) {
    console.log(`  ${DIM}${e.type.padEnd(14)}${RESET} ${e.user.padEnd(8)} ${e.detail}`);
  }

  console.log(`\n${GREEN}${BOLD}  ✓ Flow สมบูรณ์ — pair จบ ผลลัพธ์ออก push ถูกส่ง events ถูก log${RESET}\n`);

  rl?.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
