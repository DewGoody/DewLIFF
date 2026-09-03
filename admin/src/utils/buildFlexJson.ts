/**
 * Build actual LINE Flex Message JSON for each card event.
 * Uses real image URLs from axes/results/group config when available.
 *
 * Configurable (from copy):  titles, bodies, CTA labels, eyebrows, badge text
 * Locked (sample values):    CTA URLs (LIFF), user names, axis labels, result data
 */

export interface BuildAxis { id: string; label: string; image_url?: string; color?: string }
export interface BuildResult { title: string; body: string; image_url?: string }
export interface BuildArchetype { code: string; title: string; body: string; image_url?: string; symbol_url?: string; primary_text?: string }

export interface CardLayoutOpts {
  size?:      'kilo' | 'mega' | 'giga';
  heroShow?:  boolean;
  heroRatio?: string;
  heroMode?:  'cover' | 'fit';
  badge?:     boolean;
  sep?:       boolean;
  btnDir?:    'vertical' | 'horizontal';
  btnStyle?:  'primary+secondary' | 'primary+link' | 'all-primary';
  pad?:       number;
}

export interface BuildInput {
  copy: Record<string, string>;
  images?: Record<string, string>;   // locally-uploaded image blob URLs per image key
  brand: { name: string; primary: string; kv_image_url?: string };
  mode: string;
  axes?: BuildAxis[];
  results?: Record<string, BuildResult>;
  group?: {
    max_members?: number;
    archetypes?: BuildArchetype[];
  };
  layoutOpts?: CardLayoutOpts;
  liffId?: string;   // LIFF ID from appearance.liff_id — used in button URIs
  appearance?: { colors?: { primary?: string; on_primary?: string } };
}

// Resolve layout opts with per-card defaults
function L(opts: CardLayoutOpts | undefined, defaults: Partial<CardLayoutOpts> = {}): Required<CardLayoutOpts> {
  return {
    size:      opts?.size      ?? defaults.size      ?? 'mega',
    heroShow:  opts?.heroShow  ?? defaults.heroShow  ?? true,
    heroRatio: opts?.heroRatio ?? defaults.heroRatio ?? '20:13',
    heroMode:  opts?.heroMode  ?? defaults.heroMode  ?? 'cover',
    badge:     opts?.badge     ?? defaults.badge     ?? true,
    sep:       opts?.sep       ?? defaults.sep       ?? false,
    btnDir:    opts?.btnDir    ?? defaults.btnDir    ?? 'vertical',
    btnStyle:  opts?.btnStyle  ?? defaults.btnStyle  ?? 'primary+secondary',
    pad:       opts?.pad       ?? defaults.pad       ?? 16,
  };
}

function btnStyleFor(btnStyle: string, i: number, primary: string) {
  if (btnStyle === 'all-primary')   return { style: 'primary', color: primary };
  if (btnStyle === 'primary+link')  return i === 0 ? { style: 'primary', color: primary } : { style: 'link', color: primary };
  return i === 0 ? { style: 'primary', color: primary } : { style: 'secondary' };
}

function sepComp() {
  return { type: 'separator', margin: 'md' };
}

const LIFF_PLACEHOLDER = 'https://liff.line.me/xxxx-xxxxxxxx';

/** Returns the LIFF base URL using configured liffId if available */
function liffUrl(liffId?: string): string {
  return liffId ? `https://liff.line.me/${liffId}` : LIFF_PLACEHOLDER;
}

const SAMPLE = {
  userName: 'สมชาย',
  partnerName: 'สาวิตรี',
  groupScore: '40',
  heroImageUrl: 'https://placehold.co/1200x780/1C1A17/F5E14B?text=KV',
  cardImageUrl: 'https://placehold.co/400x520/F5E14B/1C1A17?text=CARD',
  symbolImageUrl: 'https://placehold.co/200x200/FF3D8B/fff?text=★',
  memberImageUrl: 'https://placehold.co/160x200/E5E5E3/888?text=?',
};

// ── helpers ───────────────────────────────────────────────────────────────────

function firstResultImage(results?: Record<string, BuildResult>): string | null {
  if (!results) return null;
  for (const r of Object.values(results)) {
    if (r.image_url) return r.image_url;
  }
  return null;
}

function firstAxisImage(axes?: BuildAxis[]): string | null {
  if (!axes) return null;
  for (const a of axes) {
    if (a.image_url) return a.image_url;
  }
  return null;
}

function firstArchetypeImage(archetypes?: BuildArchetype[]): string | null {
  if (!archetypes) return null;
  for (const a of archetypes) {
    if (a.image_url) return a.image_url;
    if (a.symbol_url) return a.symbol_url;
  }
  return null;
}

// ── F-01 — ชวนจับคู่ (shareTargetPicker → แชทเพื่อน) ─────────────────────────

export function buildF01Flex(input: BuildInput): object {
  const { copy, images, brand, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts);
  const heroUrl = images?.['f01_hero'] || brand.kv_image_url || SAMPLE.heroImageUrl;
  const btns = [copy['F01_cta1'] || 'เริ่มตอบ · 1 นาที', copy['F01_cta2'] || 'ดูผลคู่กับฉัน'];
  return {
    type: 'flex',
    altText: (copy['F01_alt'] || '{name} ชวนคุณเล่น Duo Quiz').replace('{name}', SAMPLE.userName),
    contents: {
      type: 'bubble', size: l.size,
      ...(l.heroShow && { hero: { type: 'image', url: heroUrl, size: 'full', aspectRatio: l.heroRatio, aspectMode: l.heroMode } }),
      body: {
        type: 'box', layout: 'vertical', paddingAll: `${l.pad}px`, spacing: 'sm',
        contents: [
          ...(l.badge ? [{ type: 'text', text: copy['F01_eyebrow'] || 'DUO QUIZ · 6 ข้อ', size: 'xs', color: '#888888' }] : []),
          { type: 'text', text: copy['F01_title'] || 'มาดูว่าถ้าโลกแตกพรุ่งนี้ เราสองคนจะรอดกี่วัน!', weight: 'bold', size: 'xl', wrap: true, color: '#1C1A17' },
          { type: 'text', text: (copy['F01_body'] || '{name} ชวนคุณมาตอบ 6 ข้อ ไม่ถึงนาที').replace('{name}', SAMPLE.userName), size: 'sm', wrap: true, color: '#666666', margin: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: l.btnDir, spacing: 'sm',
        contents: [
          ...(l.sep ? [sepComp()] : []),
          ...btns.map((label, i) => ({ type: 'button', action: { type: 'uri', label, uri: liffUrl(input.liffId) }, ...btnStyleFor(l.btnStyle, i, primary) })),
        ],
      },
    },
  };
}

// ── F-05 — เตือนกลับมาจัดทีม (cron auto-push 48h · OA 1:1) ─────────────────
// Layout ตาม HTML spec F-06: kilo, no hero
// body = eyebrow + title + body text + 5 flat rectangular slots; footer = 1 button

export function buildF05Flex(input: BuildInput): object {
  const { copy, brand, group, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts, { size: 'kilo', heroShow: false });
  const maxMembers = group?.max_members ?? 5;
  const filledCount = 4; // sample: 4 members joined, 1 missing
  const remaining = maxMembers - filledCount;

  const headline = (copy['F10_remind_headline'] || `มี ${filledCount} คนรออยู่ในรายชื่อ`).replace('{n}', String(filledCount));

  // 5 flat rectangular slot boxes: filled = light #F7F1E3, missing slot = dark #1C1A17 "?"
  const slots = Array.from({ length: Math.min(maxMembers, 5) }).map((_, i) => {
    const isMissing = i === filledCount;
    return {
      type: 'box', layout: 'vertical', flex: 1, height: '34px',
      cornerRadius: '8px', borderWidth: '2px', borderColor: '#1C1A17',
      backgroundColor: isMissing ? '#1C1A17' : '#F7F1E3',
      justifyContent: 'center', alignItems: 'center',
      contents: isMissing
        ? [{ type: 'text', text: '?', size: 'md', color: '#FFFDF6', align: 'center', weight: 'bold', gravity: 'center' }]
        : [],
    };
  });

  return {
    type: 'flex',
    altText: copy['F10_remind_headline'] || `มีเพื่อน ${filledCount} คนรอเข้าทีมคุณอยู่`,
    contents: {
      type: 'bubble', size: l.size,
      body: {
        type: 'box', layout: 'vertical', paddingAll: `${l.pad}px`, spacing: 'sm',
        contents: [
          { type: 'text', text: copy['F10_remind_badge'] || 'ทีมของคุณยังไม่ครบ', size: 'xs', color: primary, weight: 'bold' },
          { type: 'text', text: headline, weight: 'bold', size: 'lg', wrap: true, color: '#1C1A17', margin: 'sm' },
          { type: 'text', text: copy['F10_remind_sub'] || `ครบ ${maxMembers} สายจะได้ผลทีมพร้อมกัน ตอนนี้ยังขาดอีกหนึ่งสาย`, size: 'sm', wrap: true, color: '#666666', margin: 'sm' },
          { type: 'box', layout: 'horizontal', spacing: 'xs', margin: 'md', contents: slots },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [
          { type: 'button', style: 'primary', color: primary,
            action: { type: 'uri', label: copy['F10_remind_cta'] || 'กลับไปจัดทีม', uri: liffUrl(input.liffId) },
          },
        ],
      },
    },
  };
}

// ── F-10 — ชวนเข้าทีม (shareTargetPicker → ส่งลงกลุ่ม LINE) ────────────────
// Layout ตาม HTML spec F-10: hero = box (#F7F1E3) count header + 5 member slots
// body = locked result dark box + progress bar + body text; footer = 2 buttons

export function buildF10Flex(input: BuildInput): object {
  const { copy, brand, axes, group, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts, { heroShow: true, size: 'mega' });
  const maxMembers = group?.max_members ?? 5;
  const filledCount = 1; // sample: 1 member (the inviter)
  const remaining = maxMembers - filledCount;

  const headerText = (copy['F10_header'] || 'อีก {n} คน ผลทีมจะเปิด').replace('{n}', String(remaining));
  const countText = `${filledCount} / ${maxMembers} คน`;

  // 5 member slot cards: 1 filled (axis image + name), rest empty "?"
  const memberSlots = Array.from({ length: Math.min(maxMembers, 5) }).map((_, i) => {
    const axis = axes?.[i];
    if (i < filledCount) {
      return {
        type: 'box', layout: 'vertical', flex: 1, cornerRadius: '9px',
        borderWidth: '2px', borderColor: '#1C1A17',
        backgroundColor: '#FFFDF6',
        paddingAll: '6px', spacing: 'none',
        contents: [
          { type: 'image', url: axis?.image_url || SAMPLE.cardImageUrl, size: 'full', aspectRatio: '3:4', aspectMode: 'contain' },
          { type: 'text', text: SAMPLE.userName, size: 'xxs', color: '#1C1A17', align: 'center', weight: 'bold', margin: 'xs' },
        ],
      };
    } else {
      return {
        type: 'box', layout: 'vertical', flex: 1, cornerRadius: '9px',
        borderWidth: '2px', borderColor: '#9E9890',
        backgroundColor: '#EFE9DC',
        justifyContent: 'center', alignItems: 'center',
        contents: [
          { type: 'text', text: '?', size: 'lg', color: '#9E9890', align: 'center', weight: 'bold', gravity: 'center' },
        ],
      };
    }
  });

  // Hero: colored box component with header row + member slots
  const heroBox = {
    type: 'box', layout: 'vertical',
    backgroundColor: '#F7F1E3',
    paddingAll: '12px', spacing: 'sm',
    contents: [
      {
        type: 'box', layout: 'horizontal', alignItems: 'center',
        contents: [
          { type: 'text', text: headerText, size: 'xs', weight: 'bold', color: primary, flex: 1 },
          { type: 'text', text: countText, size: 'sm', weight: 'bold', color: '#1C1A17', align: 'end', flex: 0 },
        ],
      },
      { type: 'box', layout: 'horizontal', spacing: 'xs', margin: 'sm', contents: memberSlots },
    ],
  };

  return {
    type: 'flex',
    altText: copy['group_invite_title'] || `ทีมนี้ ${filledCount}/${maxMembers} คน — ตอบ 6 ข้อแล้วมาเติมทีม`,
    contents: {
      type: 'bubble', size: l.size,
      ...(l.heroShow && { hero: heroBox }),
      body: {
        type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'sm',
        contents: [
          // Dark locked result box
          {
            type: 'box', layout: 'horizontal', backgroundColor: '#1C1A17', cornerRadius: '12px',
            paddingAll: '13px', spacing: 'md', alignItems: 'center',
            contents: [
              { type: 'box', layout: 'vertical', flex: 0, width: '40px', height: '40px', cornerRadius: '10px',
                backgroundColor: '#333333', alignItems: 'center', justifyContent: 'center',
                contents: [{ type: 'text', text: '?', size: 'md', color: '#F5E14B', align: 'center', gravity: 'center' }],
              },
              { type: 'box', layout: 'vertical', flex: 1, spacing: 'xs', contents: [
                { type: 'text', text: copy['F10_locked_title'] || 'ผลของทีมนี้ยังไม่เปิด', size: 'sm', weight: 'bold', color: '#FFFDF6', wrap: true },
                { type: 'text', text: (copy['F10_locked_body'] || `ครบ ${maxMembers} คนแล้วเปิดพร้อมกันทุกคน`).replace('{n}', String(maxMembers)), size: 'xs', color: '#B8B2A8', wrap: true },
              ]},
            ],
          },
          // Progress bar + remaining count
          {
            type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm', margin: 'sm',
            contents: [
              {
                type: 'box', layout: 'horizontal', flex: 1, height: '12px',
                cornerRadius: '8px', borderWidth: '2px', borderColor: '#1C1A17',
                backgroundColor: '#F7F1E3', overflow: 'hidden',
                contents: [
                  { type: 'box', layout: 'vertical', flex: filledCount, backgroundColor: primary, contents: [] },
                  { type: 'box', layout: 'vertical', flex: remaining, backgroundColor: '#F7F1E3', contents: [] },
                ],
              },
              { type: 'text', text: `เหลือ ${remaining} ที่`, size: 'xxs', color: '#888888', flex: 0 },
            ],
          },
          // Body text
          { type: 'text', text: copy['F10_body'] || 'ชื่อก๊วน จำนวนวันที่รอด และผลคู่กับทุกคนในทีม จะโผล่ทีเดียวเมื่อสายที่ 5 เข้ามา', size: 'sm', wrap: true, color: '#6E6A62', margin: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
        contents: [
          { type: 'button', style: 'primary', color: primary,
            action: { type: 'uri', label: copy['F10_cta1'] || 'ตอบ 6 ข้อ แล้วเข้าทีมนี้', uri: liffUrl(input.liffId) },
          },
          { type: 'button', style: 'secondary',
            action: { type: 'uri', label: copy['F10_cta2'] || `ชวนเพื่อนอีก ${remaining} คน`, uri: liffUrl(input.liffId) },
          },
        ],
      },
    },
  };
}

// ── F-02 — แชร์ผลตัวเอง (shareTargetPicker → ปลายทาง) ─────────────────────────

export function buildF02Flex(input: BuildInput): object {
  const { copy, brand, mode, axes, results, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts, { heroRatio: '9:13', heroMode: 'fit' });
  const isSolo = mode === 'solo' || mode === 'mbti';
  const cardImageUrl = firstResultImage(results) || firstAxisImage(axes) || SAMPLE.cardImageUrl;
  const firstResult = results ? Object.values(results)[0] : null;
  const axisLabel = axes?.[0]?.label || 'สายมู';
  const resultBody = firstResult?.body || 'กลุ่มที่หาคอนเนคชั่นดีมากๆ ชวนกันเที่ยวอยู่ตลอด';
  const btns = [
    copy['F02_cta1'] || 'เล่นดูว่าคุณสายไหน',
    ...(!isSolo ? [copy['F02_cta2'] || 'ดูผลคู่กับฉัน'] : []),
  ];

  return {
    type: 'flex',
    altText: `ผลลัพธ์ของ ${SAMPLE.userName}: ${axisLabel}`,
    contents: {
      type: 'bubble', size: l.size,
      ...(l.heroShow && { hero: { type: 'image', url: cardImageUrl, size: 'full', aspectRatio: l.heroRatio, aspectMode: l.heroMode, backgroundColor: '#F5E14B' } }),
      body: {
        type: 'box', layout: 'vertical', paddingAll: `${l.pad}px`, spacing: 'sm',
        contents: [
          ...(l.badge ? [{ type: 'text', text: copy['F02_eyebrow'] || 'สายของฉันคือ', size: 'xs', color: '#888888' }] : []),
          { type: 'text', text: axisLabel, weight: 'bold', size: 'xxl', color: '#1C1A17' },
          { type: 'text', text: resultBody, size: 'sm', wrap: true, color: '#555555', margin: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: l.btnDir, spacing: 'sm',
        contents: [
          ...(l.sep ? [sepComp()] : []),
          ...btns.map((label, i) => ({ type: 'button', action: { type: 'uri', label, uri: liffUrl(input.liffId) }, ...btnStyleFor(l.btnStyle, i, primary) })),
        ],
      },
    },
  };
}

// ── F-PAIR — แชร์ผลคู่ (shareTargetPicker → ปลายทาง) ─────────────────────────

export function buildFPairFlex(input: BuildInput): object {
  const { copy, images, brand, axes, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts);
  const heroUrl = images?.['fpair_hero'] || brand.kv_image_url || SAMPLE.heroImageUrl;
  const axisA = axes?.[0]?.label || 'สายมู';
  const axisB = axes?.[1]?.label || 'สายชิล';
  const titleText = (copy['FPAIR_title'] || 'เราสองคนรอดได้ {n} วัน!').replace('{n}', SAMPLE.groupScore);
  const btns = [copy['FPAIR_cta1'] || 'ดูผลของเรา', copy['FPAIR_cta2'] || 'เชิญเพื่อนคนอื่น'];

  return {
    type: 'flex',
    altText: titleText,
    contents: {
      type: 'bubble', size: l.size,
      ...(l.heroShow && { hero: { type: 'image', url: heroUrl, size: 'full', aspectRatio: l.heroRatio, aspectMode: l.heroMode } }),
      body: {
        type: 'box', layout: 'vertical', paddingAll: `${l.pad}px`, spacing: 'sm',
        contents: [
          ...(l.badge ? [{ type: 'text', text: copy['FPAIR_eyebrow'] || 'ผลคู่ของเรา', size: 'xs', color: '#888888' }] : []),
          { type: 'text', text: titleText, weight: 'bold', size: 'xxl', wrap: true, color: '#1C1A17' },
          {
            type: 'box', layout: 'horizontal', margin: 'sm', spacing: 'sm',
            contents: [axisA, axisB].map(label => ({
              type: 'box', layout: 'vertical', flex: 1, paddingAll: '10px',
              backgroundColor: 'rgba(28,26,23,.07)', cornerRadius: '8px',
              contents: [{ type: 'text', text: label, weight: 'bold', size: 'sm', color: '#1C1A17', align: 'center' }],
            })),
          },
        ],
      },
      footer: {
        type: 'box', layout: l.btnDir, spacing: 'sm',
        contents: [
          ...(l.sep ? [sepComp()] : []),
          ...btns.map((label, i) => ({ type: 'button', action: { type: 'uri', label, uri: liffUrl(input.liffId) }, ...btnStyleFor(l.btnStyle, i, primary) })),
        ],
      },
    },
  };
}

// ── F-03 — ผลคู่ push ไปหา A เมื่อ B ตอบครบ ─────────────────────────────────

export function buildF03Flex(input: BuildInput): object {
  const { copy, brand, axes, results, images, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts);
  const axisA = axes?.[0];
  const axisB = axes?.[1];
  const axisALabel = axisA?.label || 'สายมู';
  const axisBLabel = axisB?.label || 'สายชิล';
  const axisAImg = axisA?.image_url || SAMPLE.cardImageUrl;
  const axisBImg = axisB?.image_url || SAMPLE.cardImageUrl;
  const resultTitle = (results ? Object.values(results)[0] : null)?.title || '14 วัน';

  // Hero: custom upload OR yellow background with 2 axis card images side-by-side
  const customHeroImg = images?.['f03_hero'];
  const heroBox = {
    type: 'box', layout: 'horizontal', backgroundColor: '#F5E14B',
    paddingAll: '16px', paddingTop: '20px', paddingBottom: '20px', spacing: 'md',
    contents: [
      { type: 'image', url: axisBImg, flex: 1, aspectRatio: '3:4', aspectMode: 'fit', cornerRadius: '8px' },
      { type: 'image', url: axisAImg, flex: 1, aspectRatio: '3:4', aspectMode: 'fit', cornerRadius: '8px' },
    ],
  };
  const heroComponent = customHeroImg
    ? { type: 'image', url: customHeroImg, size: 'full', aspectRatio: l.heroRatio, aspectMode: l.heroMode }
    : heroBox;

  return {
    type: 'flex',
    altText: `${SAMPLE.partnerName} ตอบแล้ว มาดูผลกัน!`,
    contents: {
      type: 'bubble', size: l.size,
      ...(l.heroShow && { hero: heroComponent }),
      body: {
        type: 'box', layout: 'vertical', paddingAll: `${l.pad}px`, spacing: 'sm',
        contents: [
          // Badge pill (yellow)
          { type: 'box', layout: 'vertical', paddingAll: '4px', backgroundColor: '#F5E14B', cornerRadius: '4px', width: '96px',
            contents: [{ type: 'text', text: copy['F03_eyebrow'] || 'คู่นี้รอดได้', size: 'xs', weight: 'bold', color: '#1C1A17', align: 'center' }] },
          // Score / result title in primary
          { type: 'text', text: resultTitle, weight: 'bold', size: 'xxl', color: primary, margin: 'sm' },
          { type: 'text', text: copy['F03_title'] || `${SAMPLE.partnerName} ตอบแล้ว! มาดูผลกัน`, size: 'sm', wrap: true, color: '#666666', margin: 'xs' },
          { type: 'text', text: copy['F03_body'] || 'คุณสองคนเข้ากันได้แค่ไหน?', size: 'sm', wrap: true, color: '#666666' },
          // Axis chips
          {
            type: 'box', layout: 'horizontal', margin: 'sm', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', flex: 1, paddingAll: '10px', backgroundColor: 'rgba(28,26,23,.07)', cornerRadius: '8px',
                contents: [
                  { type: 'text', text: SAMPLE.partnerName, size: 'xxs', color: '#888888' },
                  { type: 'text', text: axisBLabel, weight: 'bold', size: 'sm', color: '#1C1A17', margin: 'xs' },
                ],
              },
              { type: 'box', layout: 'vertical', flex: 1, paddingAll: '10px', backgroundColor: '#F5E14B', cornerRadius: '8px',
                contents: [
                  { type: 'text', text: 'คุณ', size: 'xxs', color: '#888888' },
                  { type: 'text', text: axisALabel, weight: 'bold', size: 'sm', color: '#1C1A17', margin: 'xs' },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: l.btnDir,
        contents: [
          ...(l.sep ? [sepComp()] : []),
          { type: 'button', action: { type: 'uri', label: copy['F03_cta'] || 'ดูผลคู่แบบเต็ม', uri: liffUrl(input.liffId) }, ...btnStyleFor(l.btnStyle, 0, primary) },
        ],
      },
    },
  };
}

// ── F-04 — partner done push notification ─────────────────────────────────────

export function buildF04Flex(input: BuildInput): object {
  const { copy, brand, axes, results, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts, { size: 'kilo', heroShow: false });
  const cardImageUrl = firstResultImage(results) || firstAxisImage(axes) || SAMPLE.cardImageUrl;

  return {
    type: 'flex',
    altText: copy['F04_title'] || 'คู่หูตอบแล้ว มาดูผลกัน',
    contents: {
      type: 'bubble', size: l.size,
      body: {
        type: 'box', layout: 'horizontal', paddingAll: `${l.pad}px`, spacing: 'md', alignItems: 'center',
        contents: [
          { type: 'image', url: cardImageUrl, size: 'sm', aspectRatio: '3:4', aspectMode: 'fit', flex: 0 },
          { type: 'box', layout: 'vertical', flex: 1, spacing: 'xs',
            contents: [
              { type: 'text', text: copy['F04_title'] || 'คู่หูตอบแล้ว มาดูผลกัน', weight: 'bold', size: 'md', wrap: true, color: '#1C1A17' },
              { type: 'text', text: copy['F04_body'] || 'กดเพื่อดูว่าคุณสองคนเข้ากันแค่ไหน', size: 'xs', wrap: true, color: '#888888', margin: 'xs' },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: l.btnDir,
        contents: [
          ...(l.sep ? [sepComp()] : []),
          { type: 'button', action: { type: 'uri', label: copy['F04_cta'] || 'ดูผลลัพธ์', uri: liffUrl(input.liffId) }, ...btnStyleFor(l.btnStyle, 0, primary) },
        ],
      },
    },
  };
}

// ── F-GRP — group result push ไปหาทุกสมาชิกเมื่อทีมครบ ──────────────────────
// Layout ตาม real LINE card (image #134):
// hero = archetype symbol (dark bg), body = eyebrow + big survival title + body text + archetype grid (3+2)

export function buildFGrpFlex(input: BuildInput): object {
  const { copy, images, brand, group, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts, { heroRatio: '20:13', heroMode: 'fit' });
  const archetypes = group?.archetypes ?? [];
  const maxMembers = group?.max_members ?? 5;
  const heroUrl = images?.['fgrp_hero'] || firstArchetypeImage(archetypes) || SAMPLE.symbolImageUrl;

  const score = SAMPLE.groupScore;
  const winnerArchetype = archetypes[0];
  const bodyText = winnerArchetype?.body || copy['FGRP_body'] || 'มีคนคอยดึงสติตอนกลุ่มกำลังจะบ้า ทำงานได้ทุกสภาพ';
  // Title: "ทีมนี้รอดได้ N วัน!" — ใช้ FGRP_title ถ้ามี หรือ fallback
  const titleText = (copy['FGRP_title'] || 'ทีมนี้รอดได้ {days} วัน!').replace('{days}', score);

  // Archetype cards grid: 3+2 layout (wrap in two horizontal rows)
  const SLOT_COUNT = Math.min(archetypes.length || maxMembers, 5);
  const makeArchCard = (i: number) => {
    const arch = archetypes[i];
    const imgUrl = arch?.image_url || arch?.symbol_url || SAMPLE.symbolImageUrl;
    const label = arch?.title || `archetype ${i + 1}`;
    return {
      type: 'box', layout: 'vertical', flex: 1, cornerRadius: '8px',
      backgroundColor: '#F7F1E3',
      paddingAll: '8px', spacing: 'none',
      contents: [
        { type: 'image', url: imgUrl, size: 'full', aspectRatio: '1:1', aspectMode: 'fit' },
        { type: 'text', text: label, size: 'xxs', color: '#555555', align: 'center', margin: 'xs', wrap: true, maxLines: 2 },
      ],
    };
  };

  // Row 1: first 3 archetypes; Row 2: next 2 archetypes (padded with empty flex to center)
  const row1 = Array.from({ length: Math.min(3, SLOT_COUNT) }).map((_, i) => makeArchCard(i));
  const row2Items = Array.from({ length: Math.max(0, SLOT_COUNT - 3) }).map((_, i) => makeArchCard(3 + i));
  // Pad row 2 to maintain alignment: if 2 items, add empty flex spacer for 3-column width
  const row2: object[] = row2Items.length > 0 && row2Items.length < 3
    ? [...row2Items, { type: 'box', layout: 'vertical', flex: 3 - row2Items.length, contents: [] }]
    : row2Items;

  const archetypeGrid = [
    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: row1 },
    ...(row2.length > 0 ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm', contents: row2 }] : []),
  ];

  return {
    type: 'flex',
    altText: copy['FGRP_alt'] || 'ผลทีมของคุณพร้อมแล้ว!',
    contents: {
      type: 'bubble', size: l.size,
      ...(l.heroShow && { hero: { type: 'image', url: heroUrl, size: 'full', aspectRatio: l.heroRatio, aspectMode: l.heroMode, backgroundColor: '#1C1A17' } }),
      body: {
        type: 'box', layout: 'vertical', paddingAll: `${l.pad}px`, spacing: 'sm',
        contents: [
          // Eyebrow: "ผลทีมของคุณ" — grey small text
          { type: 'text', text: copy['FGRP_eyebrow'] || 'ผลทีมของคุณ', size: 'xs', color: '#888888' },
          // Big survival title
          { type: 'text', text: titleText, weight: 'bold', size: 'xxl', color: '#1C1A17', wrap: true, margin: 'sm' },
          // Body text (archetype description)
          { type: 'text', text: bodyText, size: 'sm', wrap: true, color: '#555555', margin: 'sm' },
          // Archetype cards grid (3+2)
          { type: 'box', layout: 'vertical', spacing: 'none', margin: 'md', contents: archetypeGrid },
        ],
      },
      footer: {
        type: 'box', layout: l.btnDir,
        contents: [
          ...(l.sep ? [sepComp()] : []),
          { type: 'button', action: { type: 'uri', label: copy['FGRP_cta'] || 'ดูผลทีม', uri: liffUrl(input.liffId) }, ...btnStyleFor(l.btnStyle, 0, primary) },
        ],
      },
    },
  };
}

// ── F-08 — ปลดล็อกสัญลักษณ์ ──────────────────────────────────────────────────

export function buildF08Flex(input: BuildInput): object {
  const { copy, images, brand, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts, { size: 'kilo', heroRatio: '1:1', heroMode: 'fit' });
  const heroUrl = images?.['f08_symbol'] || SAMPLE.symbolImageUrl;
  return {
    type: 'flex',
    altText: copy['F08_title'] || 'ปลดล็อกสัญลักษณ์ใหม่แล้ว!',
    contents: {
      type: 'bubble', size: l.size,
      ...(l.heroShow && { hero: { type: 'image', url: heroUrl, size: 'full', aspectRatio: l.heroRatio, aspectMode: l.heroMode, backgroundColor: '#1C1A17' } }),
      body: {
        type: 'box', layout: 'vertical', paddingAll: `${l.pad}px`, spacing: 'sm',
        contents: [
          { type: 'text', text: copy['F08_title'] || 'ปลดล็อกสัญลักษณ์ใหม่แล้ว!', weight: 'bold', size: 'lg', wrap: true, color: '#1C1A17' },
          { type: 'text', text: copy['F08_body'] || 'สะสมให้ครบเพื่อดูความหมายซ่อน', size: 'sm', wrap: true, color: '#666666', margin: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: l.btnDir,
        contents: [
          ...(l.sep ? [sepComp()] : []),
          { type: 'button', action: { type: 'uri', label: copy['F08_cta'] || 'ดูสัญลักษณ์ทั้งหมด', uri: liffUrl(input.liffId) }, ...btnStyleFor(l.btnStyle, 0, primary) },
        ],
      },
    },
  };
}

// ── F-09 — รางวัล / milestone ─────────────────────────────────────────────────

export function buildF09Flex(input: BuildInput): object {
  const { copy, images, brand, layoutOpts } = input;
  const primary = input.appearance?.colors?.primary || brand.primary || '#E8354F';
  const l = L(layoutOpts);
  const heroUrl = images?.['f09_reward'] || SAMPLE.heroImageUrl;
  return {
    type: 'flex',
    altText: copy['F09_title'] || 'รางวัลพิเศษรอคุณอยู่!',
    contents: {
      type: 'bubble', size: l.size,
      ...(l.heroShow && { hero: { type: 'image', url: heroUrl, size: 'full', aspectRatio: l.heroRatio, aspectMode: l.heroMode } }),
      body: {
        type: 'box', layout: 'vertical', paddingAll: `${l.pad}px`, spacing: 'sm',
        contents: [
          { type: 'text', text: copy['F09_title'] || 'รางวัลพิเศษรอคุณอยู่!', weight: 'bold', size: 'xl', wrap: true, color: '#1C1A17' },
          { type: 'text', text: copy['F09_body'] || 'ขอบคุณที่ร่วมกิจกรรม ของรางวัลพร้อมส่งแล้ว', size: 'sm', wrap: true, color: '#666666', margin: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: l.btnDir,
        contents: [
          ...(l.sep ? [sepComp()] : []),
          { type: 'button', action: { type: 'uri', label: copy['F09_cta'] || 'รับรางวัล', uri: liffUrl(input.liffId) }, ...btnStyleFor(l.btnStyle, 0, primary) },
        ],
      },
    },
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export type FlexEventId = 'f01' | 'f05' | 'f10' | 'f02' | 'fpair' | 'f03' | 'f04' | 'fgrp' | 'f08' | 'f09';

export function buildFlexJson(eventId: FlexEventId, input: BuildInput): object {
  switch (eventId) {
    case 'f01':   return buildF01Flex(input);
    case 'f05':   return buildF05Flex(input);
    case 'f10':   return buildF10Flex(input);
    case 'f02':   return buildF02Flex(input);
    case 'fpair': return buildFPairFlex(input);
    case 'f03':   return buildF03Flex(input);
    case 'f04':   return buildF04Flex(input);
    case 'fgrp':  return buildFGrpFlex(input);
    case 'f08':   return buildF08Flex(input);
    case 'f09':   return buildF09Flex(input);
  }
}
