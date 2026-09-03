import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getConfig } from '../src/config/loader.js';
import type { AppearanceConfig } from '../src/config/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INK = '#1C1A17';
const RED = '#E8354F';
const YELLOW = '#F5E14B';
const BG = '#F7F1E3';

// Legacy landscape OG dimensions
const W = 1200, H = 628;
// Pair hero
const PW = 1024, PH = 678;
// Portrait card (Instagram Story)
const CW = 1080, CH = 1920;

// Axis → which frame PNG to use
const AXIS_FRAME: Record<string, string> = {
  mu: 'solo-1.png',
  live: 'solo-2.png',
  line: 'solo-3.png',
  prep: 'solo-4.png',
  chill: 'solo-5.png',
};

// ── Helpers ───────────────────────────────────────────────────────────

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ── Find bundled file path ─────────────────────────────────────────────

function findFile(...segments: string[]): string | null {
  const bases = [process.cwd(), '/var/task', path.join(__dirname, '..'), path.join(__dirname, '../..')];
  for (const base of bases) {
    const p = path.join(base, ...segments);
    try { fs.accessSync(p); return p; } catch { /* try next */ }
  }
  return null;
}

// ── Font loading (cached) ─────────────────────────────────────────────

let _fontFiles: string[] | null = null;
function getFontFiles(): string[] {
  if (_fontFiles !== null) return _fontFiles;
  const names = ['Bangers-Regular.ttf', 'BaiJamjuree-Bold.ttf', 'BaiJamjuree-Medium.ttf', 'GloriaHallelujah-Regular.ttf'];
  const probe = findFile('api', 'fonts', names[0]);
  if (!probe) { _fontFiles = []; return _fontFiles; }
  const dir = path.dirname(probe);
  _fontFiles = names.map(n => path.join(dir, n)).filter(f => { try { fs.accessSync(f); return true; } catch { return false; } });
  return _fontFiles;
}

// ── Fetch remote image → base64 data URI ─────────────────────────────

async function toDataUri(url: string): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch { return ''; }
}

// ── SVG → PNG (transparent or opaque depending on SVG content) ────────

function svgToPng(svg: string): Buffer {
  const fonts = getFontFiles();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: {
      loadSystemFonts: false,
      ...(fonts.length ? { fontFiles: fonts } : {}),
      defaultFontFamily: 'Bai Jamjuree',
    },
  });
  return Buffer.from(resvg.render().asPng());
}

// ── Text wrap ─────────────────────────────────────────────────────────

function wrapLines(text: string, maxChars: number, maxLines = 3): string[] {
  if (!text) return [];
  // Honor explicit newlines first — each \n segment wraps independently
  const hardLines = text.split('\n');
  if (hardLines.length > 1) {
    const result: string[] = [];
    for (const chunk of hardLines) {
      if (result.length >= maxLines) break;
      const sub = wrapLines(chunk.trim(), maxChars, maxLines - result.length);
      result.push(...sub);
    }
    return result.slice(0, maxLines);
  }
  // Use Thai word segmentation (ICU dictionary) so breaks fall on word boundaries, not mid-syllable
  let words: string[];
  try {
    const wordSeg = new (Intl as any).Segmenter('th', { granularity: 'word' });
    words = [...wordSeg.segment(text)].map((s: any) => s.segment);
  } catch {
    words = text.split('');
  }
  // Count grapheme clusters per token (accurate visual length for Thai)
  const gLen = (s: string): number => {
    try {
      const g = new (Intl as any).Segmenter('th', { granularity: 'grapheme' });
      return [...g.segment(s)].length;
    } catch { return s.length; }
  };
  const lines: string[] = [];
  let line = '';
  let lineLen = 0;
  for (const word of words) {
    const wLen = gLen(word);
    if (lineLen + wLen > maxChars && line !== '') {
      lines.push(line.trim());
      if (lines.length >= maxLines) return lines;
      line = word;
      lineLen = wLen;
    } else {
      line += word;
      lineLen += wLen;
    }
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  return lines;
}

// ══════════════════════════════════════════════════════════════════════
// PORTRAIT CARD GENERATORS — frame (disk) + text overlay (SVG→PNG)
// composited via sharp to avoid huge base64 SVG strings
// Frame measurements (pixel-analysed):
//   solo frames: black border y=1050–1769, content y=1075–1745, x=80–1000
//   pair frame:  black border y=1066–1752, content y=1090–1728, x=80–1000
// ══════════════════════════════════════════════════════════════════════

// ── Fetch remote image, resize, rotate, return buffer + final dimensions ─
async function fetchResizeRotate(
  url: string, targetW: number, targetH: number, angle: number,
): Promise<{ buf: Buffer; rw: number; rh: number } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    const resized = await sharp(raw)
      .resize(targetW, targetH, { fit: 'cover' })
      .png().toBuffer();
    const rotated = await sharp(resized)
      .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    const meta = await sharp(rotated).metadata();
    return { buf: rotated, rw: meta.width!, rh: meta.height! };
  } catch { return null; }
}

// ── Build transparent text-overlay SVG (1080×1920) ───────────────────
// Solo: white box interior y=1258–1700, x=75–1004 (w=929, h=442)
// Text x starts at 148 (73px inside border), max right ~932
interface SoloZones { text_x?: number; title_y?: number; label_y?: number; body_y_start?: number }
function buildSoloTextSvg(titleEn: string, labelTh: string, bodyLines: string[], z?: SoloZones): string {
  const TX    = z?.text_x      ?? 148;
  const titleY = z?.title_y    ?? 1345;
  const labelY = z?.label_y    ?? 1437;
  const sepY   = labelY + 36;
  const bodyY  = z?.body_y_start ?? 1515;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
  <text x="${TX}" y="${titleY}" font-family="Bangers" font-size="64" letter-spacing="2" fill="${RED}">${titleEn}</text>
  <text x="${TX}" y="${labelY}" font-family="Bai Jamjuree" font-weight="700" font-size="80" fill="${INK}">${labelTh}</text>
  <line x1="${TX}" y1="${sepY}" x2="${CW - TX}" y2="${sepY}" stroke="rgba(28,26,23,0.12)" stroke-width="1.5"/>
  ${bodyLines.map((l, i) => `<text x="${TX}" y="${bodyY + i * 44}" font-family="Bai Jamjuree" font-weight="500" font-size="32" fill="rgba(28,26,23,0.65)">${esc(l)}</text>`).join('\n  ')}
</svg>`;
}

// Group frame (group.png) pixel-measured coordinates (new TEAM QUIZ frame):
//   Yellow circle: cx=540, cy=576, r≈148  (center of frame, measured via pixel scan)
//     → circle top=428, bottom=724
//   Labels zone: teamName y=775, archetypeLabel y=855 (below circle bottom at 724)
//   Cards zone: cy=1050, cx=[140,340,540,740,940], w=175, h=250 (sky/blue area)
//   Result box white interior: y≈1350–1750 (black border at y=1330)
interface GroupZones { badge_x?: number; badge_y?: number; body_y_start?: number }
function buildGroupTextSvg(p: {
  badge: string; survival: string; groupTitle: string; bodyLines: string[];
  teamName?: string; archetypeLabel?: string; zones?: GroupZones;
}): string {
  const { badge, survival, bodyLines, teamName, archetypeLabel, zones } = p;
  // Strip parenthetical from survival (e.g. "3-5 ปี (รอดแบบ...)" → "3-5 ปี")
  const survShort = survival.includes('(') ? survival.slice(0, survival.indexOf('(')).trim() : survival;
  const survLen = survShort.length;
  const survSize = survLen > 10 ? 64 : survLen > 6 ? 76 : 90;
  const BX      = zones?.badge_x    ?? 175;
  const BADGE_W = Math.min(badge.length * 16 + 28, 230);
  const BADGE_Y = zones?.badge_y    ?? 1370;
  const SURV_Y  = BADGE_Y + 55;  // baseline so Bangers cap-height centers on badge rect
  const SEP_Y   = BADGE_Y + 99;
  const BODY_Y  = zones?.body_y_start ?? 1503;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
  <!-- Team name + archetype label (below circle at y=724, above cards) -->
  ${teamName ? `<text x="540" y="775" text-anchor="middle" font-family="Bai Jamjuree" font-weight="700" font-size="36" fill="${RED}">ทีม ${esc(truncate(teamName, 16))}</text>` : ''}
  ${archetypeLabel ? `<text y="855" text-anchor="middle" x="540"><tspan font-family="Bai Jamjuree" font-weight="400" font-size="30" fill="${INK}">ทีมสาย </tspan><tspan font-family="Bai Jamjuree" font-weight="700" font-size="48" fill="${INK}">${esc(truncate(archetypeLabel, 20))}</tspan></text>` : ''}
  <!-- Result box: badge + survival inline -->
  <rect x="${BX}" y="${BADGE_Y}" width="${BADGE_W}" height="52" fill="${YELLOW}"/>
  <text x="${BX + 14}" y="${BADGE_Y + 37}" font-family="Bai Jamjuree" font-weight="700" font-size="28" fill="${INK}">${esc(badge)}</text>
  <text x="${BX + BADGE_W + 18}" y="${SURV_Y}" font-family="Bangers" font-size="${survSize}" fill="${INK}">${esc(survShort)}</text>
  <!-- Separator -->
  <line x1="${BX}" y1="${SEP_Y}" x2="${CW - BX}" y2="${SEP_Y}" stroke="rgba(28,26,23,0.15)" stroke-width="1.5"/>
  <!-- Body lines -->
  ${bodyLines.slice(0, 4).map((l, i) => `<text x="${BX}" y="${BODY_Y + i * 36}" font-family="Bai Jamjuree" font-weight="500" font-size="24" fill="rgba(28,26,23,0.68)">${esc(l)}</text>`).join('\n  ')}
</svg>`;
}

// ── Fetch a remote frame PNG → Buffer ────────────────────────────────

async function fetchFramePng(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

// ── Solo card (frame + text overlay) ─────────────────────────────────

async function soloCardPng(params: {
  axisId: string;
  titleEn: string;
  labelTh: string;
  body: string;
  frameUrl?: string;
  zones?: SoloZones;
}): Promise<Buffer> {
  const bodyLines = wrapLines(params.body, 38, 4);
  const textSvg = buildSoloTextSvg(
    esc(truncate(params.titleEn, 32)),
    esc(truncate(params.labelTh, 20)),
    bodyLines,
    params.zones,
  );
  const textPng = svgToPng(textSvg);

  // Frame: prefer config URL, then fall back to disk
  const frameInput: Buffer | string | null = params.frameUrl
    ? await fetchFramePng(params.frameUrl)
    : (() => { const frameFile = AXIS_FRAME[params.axisId] || 'solo-1.png'; return findFile('public', 'og-frames', frameFile); })();

  if (frameInput) {
    return await sharp(frameInput)
      .composite([{ input: textPng, top: 0, left: 0 }])
      .png({ quality: 90 })
      .toBuffer();
  }
  // Fallback: plain background + text
  const fallbackSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">
  <rect width="${CW}" height="${CH}" fill="${BG}"/>
  ${buildSoloTextSvg(esc(truncate(params.titleEn, 32)), esc(truncate(params.labelTh, 20)), bodyLines, params.zones).replace(/<\?xml[^?]*\?>\n?<svg[^>]*>/, '').replace('</svg>', '')}
</svg>`;
  return svgToPng(fallbackSvg);
}

// ── Group card (frame + 5 rotated cards + text overlay) ──────────────

// 5-card upright row (new frame): w=175 h=250, spacing=200 between centers
// cx: 140,340,540,740,940 → left edge=52, right edge=1028  cy=1050 (sky area y=724–1330)
const GROUP_CARD_LAYOUT = [
  { cx: 140, cy: 1050, angle: 0, w: 175, h: 250 },
  { cx: 340, cy: 1050, angle: 0, w: 175, h: 250 },
  { cx: 540, cy: 1050, angle: 0, w: 175, h: 250 },
  { cx: 740, cy: 1050, angle: 0, w: 175, h: 250 },
  { cx: 940, cy: 1050, angle: 0, w: 175, h: 250 },
];

async function groupCardPng(params: {
  groupTitle: string;
  survival: string;
  body: string;
  badgeLabel?: string;
  cardUrls?: string[];
  symbolUrl?: string;
  teamName?: string;
  archetypeLabel?: string;
  frameUrl?: string;
  zones?: GroupZones;
}): Promise<Buffer> {
  const frameInput: Buffer | string | null = params.frameUrl
    ? await fetchFramePng(params.frameUrl)
    : findFile('public', 'og-frames', 'group.png');
  const badge = params.badgeLabel || 'กลุ่มนี้รอดได้';
  const bodyLines = wrapLines(params.body, 36, 4);

  // Fetch and composite up to 5 cards (upright row)
  const cardSlots = (params.cardUrls || []).slice(0, 5);
  const cards = await Promise.all(
    GROUP_CARD_LAYOUT.slice(0, Math.max(cardSlots.length, 1)).map((layout, i) => {
      const url = cardSlots[i];
      return url ? fetchResizeRotate(url, layout.w, layout.h, layout.angle) : Promise.resolve(null);
    })
  );

  const textSvg = buildGroupTextSvg({
    badge,
    survival: truncate(params.survival, 20),
    groupTitle: truncate(params.groupTitle, 26),
    bodyLines,
    teamName: params.teamName,
    archetypeLabel: params.archetypeLabel,
    zones: params.zones,
  });
  const textPng = svgToPng(textSvg);

  // Fetch symbol image for circle slot (cx=540, cy=575, r≈145 → trim transparency + contain 270×270)
  const symbol = params.symbolUrl ? await (async () => {
    try {
      const res = await fetch(params.symbolUrl!, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const raw = Buffer.from(await res.arrayBuffer());
      // trim() removes transparent edges, then contain into 270×270 with transparent padding
      const trimmed = await sharp(raw).trim().toBuffer();
      const resized = await sharp(trimmed)
        .resize(270, 270, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer();
      return { buf: resized, rw: 270, rh: 270 };
    } catch { return null; }
  })() : null;

  if (frameInput) {
    const compositeOps: sharp.OverlayOptions[] = [];

    // Symbol in yellow circle (new frame: cx=540, cy=576, r≈148)
    if (symbol) {
      compositeOps.push({
        input: symbol.buf,
        left: Math.max(0, 540 - Math.floor(symbol.rw / 2)),
        top:  Math.max(0, 576 - Math.floor(symbol.rh / 2)),
      });
    }

    // Member axis cards (fan layout)
    cards.forEach((card, i) => {
      if (!card) return;
      const layout = GROUP_CARD_LAYOUT[i];
      compositeOps.push({
        input: card.buf,
        left: Math.max(0, layout.cx - Math.floor(card.rw / 2)),
        top:  Math.max(0, layout.cy - Math.floor(card.rh / 2)),
      });
    });

    compositeOps.push({ input: textPng, top: 0, left: 0 });

    return await sharp(frameInput)
      .composite(compositeOps)
      .png({ quality: 90 })
      .toBuffer();
  }
  return textPng;
}

// ── Pair text overlay SVG (1080×1920, transparent background) ────────
// Pair frame (25.png) pixel measurements:
//   Result box black border: y=1260–1274 (top), y=1740–1754 (bottom), x=59–72 (left), x=1007–1020 (right)
//   Result box interior: y=1275–1739, x=73–1006
//   Baked-in "รอดได้" badge: y=1335–1360, x=125–251 → blanked by white rect
//   Name labels placed in open sky area next to each card
interface PairZones { badge_x?: number; badge_y?: number; body_y_start?: number }
function buildPairTextSvg(p: {
  partnerName: string; myName: string;
  buddyAxisEn: string; meAxisEn: string;
  badgeLabel: string; survival: string; bodyLines: string[];
  // card centers for name placement
  buddyCx?: number; buddyCardBottom?: number;
  meCx?: number; meCardBottom?: number;
  zones?: PairZones;
}): string {
  const BADGE_X = p.zones?.badge_x ?? 96;
  const BADGE_Y = p.zones?.badge_y ?? 1295;
  const BADGE_W = 172;
  const survX   = BADGE_X + BADGE_W + 20;
  const blankY  = BADGE_Y - 20;
  const axisY   = BADGE_Y + 135;
  const bodyY   = p.zones?.body_y_start ?? (BADGE_Y + 205);
  const axisLine = `${esc(truncate(p.buddyAxisEn, 14))} × ${esc(truncate(p.meAxisEn, 14))}`;
  const axisSize = axisLine.length > 30 ? 40 : axisLine.length > 22 ? 48 : 56;
  const buddyNameX = p.buddyCx        ?? 240;
  const meNameX    = p.meCx           ?? 760;
  // Names sit just below each card — offset negative to account for transparent rotation padding
  const buddyNameY = (p.buddyCardBottom ?? 1143) - 25;
  const meNameY    = (p.meCardBottom    ?? 988)  - 25;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
  <!-- Name labels — handwritten style close below each card -->
  <text x="${buddyNameX}" y="${buddyNameY}" text-anchor="middle" font-family="Gloria Hallelujah" font-size="26" fill="${INK}">${esc(truncate(p.partnerName, 12))}</text>
  <text x="${meNameX}" y="${meNameY}" text-anchor="middle" font-family="Gloria Hallelujah" font-size="26" fill="${INK}">${esc(truncate(p.myName, 12))}</text>
  <!-- Blank the interior of the result box (covers baked-in content) -->
  <rect x="73" y="${blankY}" width="933" height="464" fill="white"/>
  <!-- Result box content: badge + survival inline -->
  <rect x="${BADGE_X}" y="${BADGE_Y}" width="${BADGE_W}" height="52" fill="${YELLOW}"/>
  <text x="${BADGE_X + 18}" y="${BADGE_Y + 38}" font-family="Bai Jamjuree" font-weight="700" font-size="36" fill="${INK}">${esc(p.badgeLabel)}</text>
  <text x="${survX}" y="${BADGE_Y + 50}" font-family="Bangers" font-size="78" fill="${INK}">${esc(truncate(p.survival, 16))}</text>
  <!-- Axis line in Bangers red -->
  <text x="${BADGE_X}" y="${axisY}" font-family="Bangers" font-size="${axisSize}" fill="${RED}">${axisLine}</text>
  <!-- Body text (5 lines, 26px font) -->
  ${p.bodyLines.map((l, i) => `<text x="${BADGE_X}" y="${bodyY + i * 38}" font-family="Bai Jamjuree" font-weight="500" font-size="26" fill="rgba(28,26,23,0.65)">${esc(l)}</text>`).join('\n  ')}
</svg>`;
}

// ── Pair card (frame + rotated card images + text overlay) ────────────

async function pairCardPng(params: {
  cardMeUrl?: string;
  cardBuddyUrl?: string;
  myName: string;
  partnerName: string;
  survival: string;
  axisMeLabel: string;
  axisBuddyLabel: string;
  body: string;
  brandName?: string;
  frameUrl?: string;
  zones?: PairZones;
}): Promise<Buffer> {
  const frameInput: Buffer | string | null = params.frameUrl
    ? await fetchFramePng(params.frameUrl)
    : findFile('public', 'og-frames', 'pair.png');
  const bodyLines = wrapLines(params.body, 40, 5);

  // Fetch and rotate card images in parallel
  // Sized to fill 24.png illustrated card slots (cover mode fills the slot completely)
  const [buddy, me] = await Promise.all([
    params.cardBuddyUrl ? fetchResizeRotate(params.cardBuddyUrl, 390, 546, -12) : Promise.resolve(null),
    params.cardMeUrl    ? fetchResizeRotate(params.cardMeUrl,    440, 616,  +8) : Promise.resolve(null),
  ]);

  if (frameInput) {
    // Card centers in 25.png sky area (y=300–1250):
    // buddy (partner) lower-left, me (self) upper-right
    const buddyCx = 250, buddyCy = 870;
    const meCx   = 720, meCy   = 680;

    const compositeOps: sharp.OverlayOptions[] = [];
    if (buddy) {
      compositeOps.push({
        input: buddy.buf,
        left: Math.max(0, buddyCx - Math.floor(buddy.rw / 2)),
        top:  Math.max(0, buddyCy - Math.floor(buddy.rh / 2)),
      });
    }
    if (me) {
      compositeOps.push({
        input: me.buf,
        left: Math.max(0, meCx - Math.floor(me.rw / 2)),
        top:  Math.max(0, meCy - Math.floor(me.rh / 2)),
      });
    }

    // Build text overlay with actual card positions so name labels land below each card
    const textSvgPositioned = buildPairTextSvg({
      partnerName: params.partnerName,
      myName: params.myName,
      buddyAxisEn: params.axisBuddyLabel,
      meAxisEn: params.axisMeLabel,
      badgeLabel: 'รอดได้',
      survival: truncate(params.survival, 18),
      bodyLines,
      buddyCx,
      buddyCardBottom: buddyCy + Math.floor((buddy?.rh ?? 570) / 2) + 8,
      meCx,
      meCardBottom: meCy + Math.floor((me?.rh ?? 630) / 2) + 8,
      zones: params.zones,
    });
    const textPngPositioned = svgToPng(textSvgPositioned);
    compositeOps.push({ input: textPngPositioned, top: 0, left: 0 });

    return await sharp(frameInput)
      .composite(compositeOps)
      .png({ quality: 90 })
      .toBuffer();
  }

  // Fallback: plain background SVG (no frame file)
  const axisLine = `${esc(params.axisBuddyLabel)} × ${esc(params.axisMeLabel)}`;
  const survivalEsc = esc(truncate(params.survival, 18));
  const fallbackSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
  <rect width="${CW}" height="${CH}" fill="${BG}"/>
  <rect width="${CW}" height="200" fill="${INK}"/>
  <text x="60" y="130" font-family="Bangers" font-size="72" fill="#FFFDF6">APOCALYPSE SQUAD</text>
  <rect x="60" y="1090" width="900" height="580" fill="#FFFDF6" rx="20" stroke="${INK}" stroke-width="5"/>
  <rect x="90" y="1115" width="160" height="52" fill="${YELLOW}"/>
  <text x="108" y="1153" font-family="Bai Jamjuree" font-weight="700" font-size="38" fill="${INK}">รอดได้</text>
  <text x="270" y="1163" font-family="Bangers" font-size="68" fill="${INK}">${survivalEsc}</text>
  <text x="90" y="1258" font-family="Bangers" font-size="58" fill="${RED}">${axisLine}</text>
  ${bodyLines.map((l, i) => `<text x="90" y="${1336 + i * 50}" font-family="Bai Jamjuree" font-weight="500" font-size="34" fill="rgba(28,26,23,0.65)">${esc(l)}</text>`).join('\n  ')}
</svg>`;
  return svgToPng(fallbackSvg);
}

// ══════════════════════════════════════════════════════════════════════
// LEGACY LANDSCAPE OG GENERATORS (unchanged)
// ══════════════════════════════════════════════════════════════════════

async function pairHeroPng(cardMeUrl?: string, cardBuddyUrl?: string): Promise<Buffer> {
  const [me, buddy] = await Promise.all([
    cardMeUrl ? toDataUri(cardMeUrl) : Promise.resolve(''),
    cardBuddyUrl ? toDataUri(cardBuddyUrl) : Promise.resolve(''),
  ]);
  const cW = 360, cH = 504, ov = 60;
  const sx = (PW - (cW * 2 - ov)) / 2, sy = (PH - cH) / 2 + 10;
  const bX = sx, bY = sy, bCx = bX + cW / 2, bCy = bY + cH / 2;
  const mX = sx + cW - ov, mY = sy, mCx = mX + cW / 2, mCy = mY + cH / 2;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}">
  <rect width="${PW}" height="${PH}" fill="${YELLOW}"/>
  ${buddy ? `<image href="${buddy}" x="${bX}" y="${bY}" width="${cW}" height="${cH}" transform="rotate(-8,${bCx},${bCy})" preserveAspectRatio="xMidYMid meet"/>` : `<rect x="${bX}" y="${bY}" width="${cW}" height="${cH}" fill="rgba(28,26,23,.12)" rx="12" transform="rotate(-8,${bCx},${bCy})"/>`}
  ${me ? `<image href="${me}" x="${mX}" y="${mY}" width="${cW}" height="${cH}" transform="rotate(8,${mCx},${mCy})" preserveAspectRatio="xMidYMid meet"/>` : `<rect x="${mX}" y="${mY}" width="${cW}" height="${cH}" fill="rgba(28,26,23,.2)" rx="12" transform="rotate(8,${mCx},${mCy})"/>`}
</svg>`;
  return svgToPng(svg);
}

async function soloHeroPng(axisLabel: string, cardUrl?: string, inviteLabel?: string): Promise<Buffer> {
  const cardUri = cardUrl ? await toDataUri(cardUrl) : '';
  const label = esc(inviteLabel ?? 'ชวนมาดูผลด้วยกัน');
  const axis = esc(axisLabel);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="0" y="0" width="360" height="${H}" fill="#FCEFE0"/>
  ${cardUri ? `<image href="${cardUri}" x="90" y="188" width="180" height="252" transform="rotate(-5,180,314)" preserveAspectRatio="xMidYMid meet"/>` : ''}
  <rect x="404" y="160" width="${label.length * 11 + 28}" height="40" fill="${YELLOW}" stroke="${INK}" stroke-width="2"/>
  <text x="418" y="186" font-family="sans-serif" font-size="20" font-weight="700" fill="${INK}">${label}</text>
  <text x="404" y="300" font-family="sans-serif" font-size="80" font-weight="900" fill="${INK}">${axis}</text>
  <text x="404" y="350" font-family="sans-serif" font-size="24" font-weight="500" fill="rgba(28,26,23,0.55)">ตอบแบบทดสอบ · ดูผลคู่ด้วยกัน</text>
</svg>`;
  return svgToPng(svg);
}

async function groupHeroPng(archTitle: string, survival?: string, memberCount?: string, cardUrls?: string[]): Promise<Buffer> {
  const cards = (cardUrls ?? []).slice(0, 4);
  const uris = await Promise.all(cards.map(u => toDataUri(u)));
  const offsets = [{ x: 80, y: 180 }, { x: 130, y: 200 }, { x: 60, y: 210 }, { x: 110, y: 190 }];
  const angles = cards.length === 1 ? [0] : cards.map((_, i) => (i - (cards.length - 1) / 2) * 14);
  const imgs = uris.map((u, i) => {
    const { x, y } = offsets[i] ?? { x: 80 + i * 40, y: 180 };
    const cx = x + 65, cy = y + 91;
    return u ? `<image href="${u}" x="${x}" y="${y}" width="130" height="182" transform="rotate(${angles[i]},${cx},${cy})" preserveAspectRatio="xMidYMid meet"/>` : '';
  }).join('\n');
  const hc = cards.length > 0;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${hc ? `<rect x="0" y="0" width="360" height="${H}" fill="#FCEFE0"/>` : ''}
  ${imgs}
  <rect x="${hc ? 360 : 0}" y="0" width="${hc ? W - 360 : W}" height="${H}" fill="${BG}"/>
  <rect x="404" y="120" width="140" height="40" fill="${YELLOW}" stroke="${INK}" stroke-width="2"/>
  <text x="418" y="146" font-family="sans-serif" font-size="20" font-weight="700" fill="${INK}">ผลกลุ่ม</text>
  <text x="404" y="250" font-family="sans-serif" font-size="58" font-weight="700" fill="${INK}">${esc(archTitle)}</text>
  ${survival ? `<line x1="404" y1="290" x2="${W - 60}" y2="290" stroke="rgba(28,26,23,0.2)" stroke-width="2" stroke-dasharray="8,6"/>
  <text x="404" y="330" font-family="sans-serif" font-size="20" font-weight="600" fill="rgba(28,26,23,.45)">กลุ่มนี้อยู่รอดได้</text>
  <text x="404" y="420" font-family="sans-serif" font-size="72" font-weight="900" fill="${RED}">${esc(survival)}</text>` : ''}
  ${memberCount ? `<rect x="${W - 200}" y="310" width="145" height="50" fill="${YELLOW}" stroke="${INK}" stroke-width="2"/>
  <text x="${W - 190}" y="344" font-family="sans-serif" font-size="26" font-weight="700" fill="${INK}">${esc(memberCount)} คน</text>` : ''}
</svg>`;
  return svgToPng(svg);
}

// ══════════════════════════════════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════════════════════════════════

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const q = req.query as Record<string, string>;
    const type = q.type ?? 'pair';
    let png: Buffer;

    // Load per-campaign frame URLs and zone overrides when campaignId is provided
    let ogFrames: AppearanceConfig['og_frames'];
    let ogZones:  AppearanceConfig['og_zones'];
    if (q.campaignId) {
      try {
        const cfg = await getConfig(q.campaignId);
        ogFrames = cfg.appearance?.og_frames;
        ogZones  = cfg.appearance?.og_zones;
      } catch (e) {
        console.warn('[og] could not load config for', q.campaignId, e instanceof Error ? e.message : e);
      }
    }

    if (type === 'solo_card') {
      png = await soloCardPng({
        axisId: q.axisId || 'prep',
        titleEn: q.titleEn || '',
        labelTh: q.labelTh || '',
        body: q.body || '',
        frameUrl: ogFrames?.solo?.[q.axisId || ''] ?? ogFrames?.solo?.['*'],
        zones: ogZones?.solo,
      });
    } else if (type === 'pair_card') {
      png = await pairCardPng({
        cardMeUrl: q.cardMeUrl,
        cardBuddyUrl: q.cardBuddyUrl,
        myName: q.myName || 'คุณ',
        partnerName: q.partnerName || 'เพื่อน',
        survival: q.survival || '',
        axisMeLabel: q.axisMeLabel || '',
        axisBuddyLabel: q.axisBuddyLabel || '',
        body: q.body || '',
        brandName: q.brandName,
        frameUrl: ogFrames?.pair,
        zones: ogZones?.pair,
      });
    } else if (type === 'group_card') {
      png = await groupCardPng({
        groupTitle: q.groupTitle || '',
        survival: q.survival || '',
        body: q.body || '',
        badgeLabel: q.badgeLabel,
        cardUrls: q.cardUrls ? q.cardUrls.split(',').filter(Boolean) : undefined,
        symbolUrl: q.symbolUrl,
        teamName: q.teamName,
        archetypeLabel: q.archetypeLabel,
        frameUrl: ogFrames?.group,
        zones: ogZones?.group,
      });
    } else if (type === 'solo') {
      png = await soloHeroPng(q.axisLabel ?? '', q.cardUrl, q.inviteLabel);
    } else if (type === 'group') {
      png = await groupHeroPng(
        q.archTitle ?? 'ผลกลุ่ม', q.survival, q.memberCount,
        q.cardUrls ? q.cardUrls.split(',').filter(Boolean) : undefined,
      );
    } else {
      png = await pairHeroPng(q.cardMeUrl, q.cardBuddyUrl);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
  } catch (err) {
    console.error('[og]', err);
    res.status(500).json({ error: String(err) });
  }
}
