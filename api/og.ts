import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resvg } from '@resvg/resvg-js';

const BG = '#F7F1E3';
const INK = '#1C1A17';
const RED = '#E8354F';
const YELLOW = '#F5E14B';
const W = 1200;
const H = 628;

// Pair hero uses 3:2 canvas, cards only — text lives in Flex body
const PW = 1024;
const PH = 678;

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** Fetch a URL and return a base64 data URI, or empty string on failure */
async function toDataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

/** Render an SVG string to PNG buffer via resvg */
function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: false },
  });
  return Buffer.from(resvg.render().asPng());
}

// ── Pair hero: yellow bg + 2 axis cards tilted ±8° (no text) ──────────

async function pairHeroPng(cardMeUrl?: string, cardBuddyUrl?: string): Promise<Buffer> {
  const [meDataUri, buddyDataUri] = await Promise.all([
    cardMeUrl ? toDataUri(cardMeUrl) : Promise.resolve(''),
    cardBuddyUrl ? toDataUri(cardBuddyUrl) : Promise.resolve(''),
  ]);

  const cardW = 360, cardH = 504;
  const overlap = 60; // px overlap between the two cards
  const pairW = cardW * 2 - overlap;
  // Center the pair horizontally and vertically
  const startX = (PW - pairW) / 2;
  const startY = (PH - cardH) / 2 + 10;

  const buddyX = startX;
  const buddyY = startY;
  const buddyCx = buddyX + cardW / 2;
  const buddyCy = buddyY + cardH / 2;

  const meX = startX + cardW - overlap;
  const meY = startY;
  const meCx = meX + cardW / 2;
  const meCy = meY + cardH / 2;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}">
  <rect width="${PW}" height="${PH}" fill="${YELLOW}"/>
  ${buddyDataUri
    ? `<image href="${buddyDataUri}" x="${buddyX}" y="${buddyY}" width="${cardW}" height="${cardH}"
         transform="rotate(-8,${buddyCx},${buddyCy})" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${buddyX}" y="${buddyY}" width="${cardW}" height="${cardH}" fill="rgba(28,26,23,.12)" rx="12" transform="rotate(-8,${buddyCx},${buddyCy})"/>`
  }
  ${meDataUri
    ? `<image href="${meDataUri}" x="${meX}" y="${meY}" width="${cardW}" height="${cardH}"
         transform="rotate(8,${meCx},${meCy})" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${meX}" y="${meY}" width="${cardW}" height="${cardH}" fill="rgba(28,26,23,.2)" rx="12" transform="rotate(8,${meCx},${meCy})"/>`
  }
</svg>`;

  return svgToPng(svg);
}

// ── Solo OG (solo share from Summary) ────────────────────────────────

async function soloHeroPng(axisLabel: string, cardUrl?: string, inviteLabel?: string): Promise<Buffer> {
  const cardDataUri = cardUrl ? await toDataUri(cardUrl) : '';
  const label = esc(inviteLabel ?? 'ชวนมาดูผลด้วยกัน');
  const axis = esc(axisLabel);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="0" y="0" width="360" height="${H}" fill="#FCEFE0"/>
  ${cardDataUri
    ? `<image href="${cardDataUri}" x="90" y="188" width="180" height="252"
         transform="rotate(-5,180,314)" preserveAspectRatio="xMidYMid meet"/>`
    : ''}
  <rect x="360" y="0" width="${W - 360}" height="${H}" fill="${BG}"/>
  <rect x="404" y="160" width="${label.length * 11 + 28}" height="40" fill="${YELLOW}" stroke="${INK}" stroke-width="2"/>
  <text x="418" y="186" font-family="sans-serif" font-size="20" font-weight="700" fill="${INK}">${label}</text>
  <text x="404" y="300" font-family="sans-serif" font-size="80" font-weight="900" fill="${INK}">${axis}</text>
  <text x="404" y="350" font-family="sans-serif" font-size="24" font-weight="500" fill="rgba(28,26,23,0.55)">ตอบแบบทดสอบ · ดูผลคู่ด้วยกัน</text>
</svg>`;

  return svgToPng(svg);
}

// ── Group OG ─────────────────────────────────────────────────────────

async function groupHeroPng(archTitle: string, survival?: string, memberCount?: string, cardUrls?: string[]): Promise<Buffer> {
  const cards = (cardUrls ?? []).slice(0, 4);
  const dataUris = await Promise.all(cards.map(url => toDataUri(url)));

  const offsets = [{ x: 80, y: 180 }, { x: 130, y: 200 }, { x: 60, y: 210 }, { x: 110, y: 190 }];
  const angles = cards.length === 1 ? [0] : cards.map((_, i) => (i - (cards.length - 1) / 2) * 14);

  const cardImgs = dataUris.map((uri, i) => {
    const { x, y } = offsets[i] ?? { x: 80 + i * 40, y: 180 };
    const cx = x + 65; const cy = y + 91;
    return uri
      ? `<image href="${uri}" x="${x}" y="${y}" width="130" height="182" transform="rotate(${angles[i]},${cx},${cy})" preserveAspectRatio="xMidYMid meet"/>`
      : '';
  }).join('\n');

  const hasCards = cards.length > 0;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${hasCards ? `<rect x="0" y="0" width="360" height="${H}" fill="#FCEFE0"/>` : ''}
  ${cardImgs}
  <rect x="${hasCards ? 360 : 0}" y="0" width="${hasCards ? W - 360 : W}" height="${H}" fill="${BG}"/>
  <rect x="404" y="120" width="140" height="40" fill="${YELLOW}" stroke="${INK}" stroke-width="2"/>
  <text x="418" y="146" font-family="sans-serif" font-size="20" font-weight="700" fill="${INK}">ผลกลุ่ม</text>
  <text x="404" y="250" font-family="sans-serif" font-size="58" font-weight="700" fill="${INK}">${esc(archTitle)}</text>
  ${survival ? `
    <line x1="404" y1="290" x2="${W - 60}" y2="290" stroke="rgba(28,26,23,0.2)" stroke-width="2" stroke-dasharray="8,6"/>
    <text x="404" y="330" font-family="sans-serif" font-size="20" font-weight="600" fill="rgba(28,26,23,.45)">กลุ่มนี้อยู่รอดได้</text>
    <text x="404" y="420" font-family="sans-serif" font-size="72" font-weight="900" fill="${RED}">${esc(survival)}</text>
  ` : ''}
  ${memberCount ? `
    <rect x="${W - 200}" y="310" width="145" height="50" fill="${YELLOW}" stroke="${INK}" stroke-width="2"/>
    <text x="${W - 190}" y="344" font-family="sans-serif" font-size="26" font-weight="700" fill="${INK}">${esc(memberCount)} คน</text>
  ` : ''}
</svg>`;

  return svgToPng(svg);
}

// ── Handler ───────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const q = req.query as Record<string, string>;
    const type = q.type ?? 'pair';

    let png: Buffer;

    if (type === 'solo') {
      png = await soloHeroPng(q.axisLabel ?? '', q.cardUrl, q.inviteLabel);
    } else if (type === 'group') {
      png = await groupHeroPng(
        q.archTitle ?? 'ผลกลุ่ม', q.survival, q.memberCount,
        q.cardUrls ? q.cardUrls.split(',').filter(Boolean) : undefined,
      );
    } else {
      // pair — hero only shows cards, no text (text lives in Flex body)
      png = await pairHeroPng(q.cardMeUrl, q.cardBuddyUrl);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (err) {
    console.error('[og]', err);
    res.status(500).json({ error: String(err) });
  }
}
