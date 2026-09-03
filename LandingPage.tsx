import { useState } from 'react'

// ── Config ────────────────────────────────────────────────────────────────────
const LINE_ID = '@747xtauy'
const LINE_ADD_APP = `line://ti/p/${LINE_ID}`            // deep link → เปิด LINE app
const LINE_ADD_URL = 'https://line.me/R/ti/p/@747xtauy'  // fallback web
const LIFF_ID = '2011037337-KlqFK4LM'
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`  // fallback web LIFF

// ── Assets ────────────────────────────────────────────────────────────────────
const CDN = 'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets'
const CARDS = {
  chiller:    `${CDN}/duo-quiz/axis-01-chiller-v2.png`,
  mystic:     `${CDN}/duo-quiz/axis-02-mystic-v2.png`,
  influencer: `${CDN}/duo-quiz/axis-03-influencer-v2.png`,
  prepper:    `${CDN}/duo-quiz/axis-04-prepper-v2.png`,
  analyst:    `${CDN}/duo-quiz/axis-05-analyst-v2.png`,
  kvTeam:     `${CDN}/duo-quiz/kv-hero.png`,
  kvIntro:    `${CDN}/buddy_demo/kv-intro.png`,
  logo:       `${CDN}/brand/logo.png`,
}

// ── Data ──────────────────────────────────────────────────────────────────────
const QUIZ_TIERS = [
  {
    level: 'ระดับ 1', name: 'แชร์ผลตัวเอง',
    campaign: 39_000, first: 55_000,
    desc: 'ทุกคนเล่นแยกกัน ผลไม่เชื่อมกัน แชร์ต่อให้เพื่อนเล่นได้',
    suits: 'แคมเปญสั้น เปิดตัวสินค้า หรือครั้งแรกที่อยากรู้ว่าคนที่ตามอยู่เป็นใคร',
    prepare: 'ธีม คำถาม และผลลัพธ์ 5 สาย',
    cards: [CARDS.influencer],
  },
  {
    level: 'ระดับ 2', name: 'จับคู่ดูผล',
    campaign: 64_000, first: 80_000,
    desc: 'ผลของสองคนเชื่อมกัน เกิดผลใหม่ที่มีแค่คู่นี้เท่านั้น',
    suits: 'ต้องการยอดผู้ติดตามจริงในเวลาจำกัด สินค้าที่คนชวนกันใช้',
    prepare: 'ธีม คำถาม ผลลัพธ์ 5 สาย และผลคู่ 15 แบบ',
    cards: [CARDS.chiller, CARDS.analyst],
  },
  {
    level: 'ระดับ 3', name: 'ผลรวมของทีม',
    campaign: 104_000, first: 120_000,
    desc: 'สร้างลิงก์ทีม ผลของทุกคนรวมเป็นผลเดียวของกลุ่ม',
    suits: 'แคมเปญยาวหนึ่งเดือนขึ้นไป แบรนด์ที่ลูกค้าใช้กันเป็นกลุ่ม',
    prepare: 'ธีม คำถาม ผลลัพธ์ 5 สาย ผลคู่ 15 และผลกลุ่ม 9 แบบ',
    cards: [CARDS.chiller, CARDS.mystic, CARDS.influencer, CARDS.prepper, CARDS.analyst],
  },
]

// รายการกิจกรรมที่พร้อมใช้ — ออกแบบเป็น array เพื่อรองรับกิจกรรมใหม่ที่จะเพิ่มเข้ามาในอนาคต
const ACTIVITIES = [
  { key: 'quiz', label: 'ควิซบุคลิก' },
  { key: 'draw', label: 'สุ่มรับรางวัล' },
] as const

// ปิด "สุ่มรับรางวัล" ไว้ก่อน (โชว์เป็น Coming Soon) — จะกลับมาเปิดในอนาคต ห้ามลบโค้ด/ข้อมูลราคาที่เกี่ยวข้อง แค่ตั้งเป็น true เพื่อเปิดกลับ
const DRAW_ENABLED = false
const ENABLED_ACTIVITIES = ACTIVITIES.filter(a => a.key !== 'draw' || DRAW_ENABLED)

// ผู้เข้าร่วมฟรีต่อระดับ (ตรงกับ QUIZ_TIERS index) — เกินจากนี้คิดเพิ่มทุก 10,000 คน ละ 5,000 บาท
const QUIZ_ADDON_DEFAULT_PARTICIPANTS = [20_000, 30_000, 50_000]

// ผู้เข้าร่วมฟรีต่อปลายทาง (ตรงกับ DRAW_DESTINATIONS index) — เกินจากนี้คิดเพิ่มทุก 10,000 คน ละ 5,000 บาท
const DRAW_ADDON_DEFAULT_PARTICIPANTS = [20_000, 30_000, 50_000]

const DRAW_DESTINATIONS = [
  {
    dest: 'ปลายทาง 1', name: 'โค้ด / คูปอง',
    campaign: 69_000, first: 85_000, prefix: '',
    desc: 'สุ่มแล้วส่งโค้ดเข้าแชททันที ไม่มีของต้องส่ง ปิดแคมเปญได้ในวันเดียว',
    suits: 'แคมเปญที่ปิดจบเร็ว ไม่มีของต้องส่ง · ร้านอาหาร ค้าปลีก อีคอมเมิร์ซ',
    prepare: 'ชุดโค้ด และจำนวนต่อรางวัล',
  },
  {
    dest: 'ปลายทาง 2', name: 'ของรางวัลจริง',
    campaign: 89_000, first: 105_000, prefix: '',
    desc: 'ผู้ชนะกรอกที่อยู่ในไลน์ เราส่งรายชื่อพร้อมที่อยู่ให้คุณเป็นไฟล์ การจัดส่งอยู่ฝั่งคุณ',
    suits: 'แคมเปญที่รางวัลเป็นสินค้าจริง แบรนด์ดูแลการจัดส่งเอง',
    prepare: 'ของรางวัล จำนวน และเงื่อนไขการรับ',
  },
  {
    dest: 'ปลายทาง 3', name: 'ส่งเข้าระบบของแบรนด์',
    campaign: 119_000, first: 135_000, prefix: 'เริ่ม',
    desc: 'ผลการสุ่มยิงออกไปที่ระบบปลายทาง เช่น แต้มหรือสิทธิ์ในแอปของแบรนด์ ต้องมี API ให้ต่อ',
    suits: 'แบรนด์ที่มีแอปหรือระบบสมาชิกอยู่แล้ว อยากต่อแต้มหรือสิทธิ์โดยตรง',
    prepare: 'เอกสาร API sandbox และผู้รับผิดชอบฝั่งแบรนด์ที่ตอบได้ภายใน 1 วันทำการ',
  },
]

const DRAW_RULES = [
  { key: 'คลังรางวัล',    title: 'ตั้งรางวัลได้หลายชั้น',               body: 'ที่ 1 · ที่ 2 · ของชมเชย กำหนดจำนวนต่อรางวัลได้ ระบบตัดสต็อกทันทีที่มีผู้ชนะ รางวัลที่หมดแล้วจะไม่ถูกสุ่มออกอีก' },
  { key: 'รูปแบบการสุ่ม', title: 'สุ่มทันที หรือสุ่มตอนปิดแคมเปญ',      body: 'สุ่มทันทีที่เล่นจบ รู้ผลในแชทเลย หรือเก็บรายชื่อไว้แล้วสุ่มรอบเดียวตอนจบ เลือกได้ตอนตั้งแคมเปญ' },
  { key: 'อัตราการสุ่ม',  title: 'ตั้งน้ำหนักต่อรางวัล และเพดานต่อวัน',  body: 'กำหนดโอกาสออกเป็นเปอร์เซ็นต์ต่อรางวัล และจำกัดจำนวนที่ปล่อยต่อวันหรือต่อชั่วโมง กันของหมดในวันแรก' },
  { key: 'สิทธิ์ผู้เล่น', title: '1 บัญชีไลน์ = 1 สิทธิ์ ตามรอบที่ตั้ง', body: 'ตั้งได้ว่าเล่นซ้ำได้ต่อวันหรือครั้งเดียวต่อแคมเปญ และบังคับเป็นเพื่อน OA ก่อนรับรางวัลได้', dim: true },
  { key: 'ตรวจย้อนหลัง', title: 'ทุกครั้งที่สุ่ม มีบันทึก',              body: 'เวลา ผู้เล่น รางวัลที่ออก และอัตราที่ใช้ตอนนั้น ดึงออกเป็นไฟล์ได้ ใช้ตอบแบรนด์เวลามีคนทักว่าไม่ยุติธรรม', dim: true },
  { key: 'การรับรางวัล',  title: 'มีวันหมดอายุการกดรับ',                 body: 'ผู้ชนะต้องกดรับและกรอกข้อมูลภายในเวลาที่ตั้งไว้ ถ้าไม่กดรับ สิทธิ์คืนเข้าคลังหรือปล่อยว่างก็ได้', dim: true },
]

const DRAW_LIMITS = [
  'ถ้าคนเล่นน้อยกว่าจำนวนรางวัล รางวัลจะเหลือ ระบบไม่บังคับแจกให้หมด',
  'โค้ดหรือของรางวัลต้องเป็นชุดที่คุณเตรียมมา เราไม่ได้ออกโค้ดหรือจัดหาของให้',
  'ไม่รวมการจัดส่ง ภาษีของรางวัล และการหักภาษี ณ ที่จ่าย',
  'ไม่มีระบบยืนยันตัวตน กันคนสมัครหลายบัญชีได้เท่าที่ไลน์ให้ข้อมูล',
  'แก้อัตราหรือคลังรางวัลระหว่างแคมเปญได้ แจ้งล่วงหน้า 1 วันทำการ และมีบันทึกไว้ทุกครั้ง',
  'การจัดกิจกรรมชิงโชคที่ต้องขออนุญาตตามกฎหมาย เป็นหน้าที่ของแบรนด์หรือเอเจนซี่',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString()

function isMobile() {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod|line\//i.test(navigator.userAgent) || window.innerWidth < 720
}

function buildLiffUrl(src: string) {
  const sep = LIFF_URL.includes('?') ? '&' : '?'
  return `${LIFF_URL}${sep}src=${src}`
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background: #fff; color: #111;
    font-family: 'Noto Sans Thai', 'DM Sans', sans-serif;
    font-size: 15px; line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  a { color: #111; text-decoration: none; }
  a:hover { color: #E63B2E; }
  img { display: block; max-width: 100%; }

  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(22,163,74,.5); }
    70%  { box-shadow: 0 0 0 9px rgba(22,163,74,0); }
    100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
  }

  /* ── Layout ─────────────────────────────── */
  .lp-wrap {
    max-width: 1120px; margin: 0 auto;
    border-left: 1px solid #E5E5E3;
    border-right: 1px solid #E5E5E3;
    overflow: hidden;
  }

  /* ── Nav ────────────────────────────────── */
  .lp-nav {
    position: sticky; top: 0; z-index: 40;
    background: rgba(255,255,255,.94);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #E5E5E3;
  }
  .lp-nav-inner {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 24px;
  }
  .lp-nav-logo { height: 28px; width: auto; flex-shrink: 0; }
  .lp-nav-name { font-weight: 600; font-size: 15px; letter-spacing: -.01em; }
  .lp-nav-cta {
    margin-left: auto;
    background: #16A34A; color: #fff;
    border-radius: 9px; padding: 8px 16px;
    font-size: 13px; font-weight: 600;
    white-space: nowrap; text-decoration: none;
    display: inline-flex; align-items: center;
    min-height: 36px; border: 0; font-family: inherit;
    cursor: pointer;
  }
  .lp-nav-cta:hover { color: #fff; filter: brightness(1.1); }

  /* ── Section label ──────────────────────── */
  .lp-section-label {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 12px; padding: 26px 20px 12px;
    border-bottom: 1px solid #E5E5E3;
    font-family: 'DM Mono', monospace;
    font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
    color: #9B9B98;
  }
  .lp-section-label-left { color: #111; font-weight: 500; }

  /* ── Hero ───────────────────────────────── */
  .lp-hero {
    position: relative; padding: 64px 20px 100px;
    overflow: hidden;
  }
  .lp-hero-grid {
    position: absolute; inset: 0;
    background-image: linear-gradient(#E5E5E3 1px, transparent 1px),
                      linear-gradient(90deg, #E5E5E3 1px, transparent 1px);
    background-size: 46px 46px; opacity: .5;
    mask-image: radial-gradient(60% 65% at 50% 30%, #000, transparent);
  }
  .lp-hero-inner {
    position: relative; z-index: 1;
    max-width: 700px; margin: 0 auto;
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
  }
  /* Floating card cluster, referenced from paypers.ai — tilted product shots that
     bleed off the screen edges instead of the hero reading as flat centered text.
     Only shown from 1200px up, where there's enough side margin for cards this size. */
  .lp-hero-decor { position: absolute; inset: 0; z-index: 0; pointer-events: none; display: none; }
  .lp-hero-decor-card img {
    width: 100%; height: auto; display: block;
    filter: drop-shadow(0 22px 30px rgba(17,17,17,.28));
  }
  .lp-hero-decor-card {
    position: absolute;
  }
  .lp-hero-decor-left-back {
    width: 190px; left: 150px; top: 4%;
    animation: heroFloatLeftBack 7.5s ease-in-out infinite;
  }
  .lp-hero-decor-left-front {
    width: 280px; left: 180px; top: 38%;
    animation: heroFloatLeftFront 6s ease-in-out infinite;
  }
  .lp-hero-decor-right-back {
    width: 190px; right: 150px; top: 8%;
    animation: heroFloatRightBack 8s ease-in-out infinite;
  }
  .lp-hero-decor-right-front {
    width: 280px; right: 180px; top: 40%;
    animation: heroFloatRightFront 6.5s ease-in-out infinite;
  }
  @keyframes heroFloatLeftBack {
    0%, 100% { transform: rotate(-19deg) translateY(0); }
    50%      { transform: rotate(-19deg) translateY(-16px); }
  }
  @keyframes heroFloatLeftFront {
    0%, 100% { transform: rotate(-8deg) translateY(0); }
    50%      { transform: rotate(-8deg) translateY(-22px); }
  }
  @keyframes heroFloatRightBack {
    0%, 100% { transform: rotate(17deg) translateY(0); }
    50%      { transform: rotate(17deg) translateY(14px); }
  }
  @keyframes heroFloatRightFront {
    0%, 100% { transform: rotate(9deg) translateY(0); }
    50%      { transform: rotate(9deg) translateY(20px); }
  }
  @media (min-width: 1280px) {
    .lp-hero-decor { display: block; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lp-hero-decor-left-back, .lp-hero-decor-left-front,
    .lp-hero-decor-right-back, .lp-hero-decor-right-front { animation: none; }
    .lp-hero-decor-left-back { transform: rotate(-19deg); }
    .lp-hero-decor-left-front { transform: rotate(-8deg); }
    .lp-hero-decor-right-back { transform: rotate(17deg); }
    .lp-hero-decor-right-front { transform: rotate(9deg); }
  }
  .lp-live-badge {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: 'DM Mono', monospace;
    font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
    color: #9B9B98; border: 1px solid #E5E5E3;
    border-radius: 99px; padding: 6px 12px;
  }
  .lp-live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #16A34A; animation: pulse 1.8s infinite;
    display: inline-block; flex-shrink: 0;
  }
  .lp-hero h1 {
    font-size: clamp(32px, 6.2vw, 60px);
    font-weight: 700; line-height: 1.18;
    margin-top: 20px;
  }
  .lp-hero-accent { color: #E63B2E; }
  .lp-hero p {
    font-size: clamp(15px, 2.1vw, 19px);
    font-weight: 300; margin-top: 18px;
  }
  .lp-hero-p-lead { display: block; font-weight: 600; }
  .lp-hero-p-desc { display: block; margin-top: 4px; }
  .lp-hero-cta { display: flex; flex-direction: column; gap: 10px; align-items: center; margin-top: 30px; }
  .lp-hero-note {
    font-family: 'DM Mono', monospace;
    font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #9B9B98;
  }

  /* ── Buttons ────────────────────────────── */
  .lp-btn {
    border-radius: 9px; font-size: 15px; font-weight: 600;
    font-family: inherit; cursor: pointer; border: 1px solid;
    padding: 14px 24px; min-height: 48px;
    transition: filter .15s, transform .12s;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .lp-btn:active { transform: scale(.97); }
  .lp-btn-dark { background: #111; color: #fff; border-color: #111; }
  .lp-btn-dark:hover { filter: brightness(1.6); }
  .lp-btn-green { background: #16A34A; color: #fff; border-color: #16A34A; }
  .lp-btn-green:hover { filter: brightness(1.1); }
  .lp-btn-outline { background: #fff; color: #111; border-color: #E5E5E3; }
  .lp-btn-outline:hover { border-color: #111; }
  .lp-btn-full { width: 100%; }

  /* ── Demo section ───────────────────────── */
  .lp-demo-section { padding: 4px 20px 40px; }
  .lp-demo-grid-wrap { max-width: 1120px; margin: 0 auto; }
  .lp-demo-heading { text-align: center; margin: 0 auto; max-width: 620px; }
  .lp-demo-heading .lp-h2 { display: block; }
  .lp-demo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: 28px; margin-top: 24px; align-items: center;
  }
  .lp-demo-visual {
    min-width: 0;
    display: flex; flex-direction: column; gap: 12px;
    justify-content: center; align-items: center;
  }
  .lp-demo-visual img { filter: drop-shadow(0 14px 24px rgba(17,17,17,.14)); }
  .lp-demo-content {
    min-width: 0;
    display: flex; flex-direction: column; gap: 14px;
  }
  .lp-demo-title { font-size: 19px; font-weight: 600; margin-top: 6px; }
  .lp-demo-checklist { display: flex; flex-direction: column; gap: 10px; }
  .lp-demo-check-item { display: flex; align-items: flex-start; gap: 10px; }
  .lp-demo-check-icon {
    width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; margin-top: 1px;
    background: #16A34A; color: #fff; font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .lp-demo-footer { font-size: 13px; color: #9B9B98; }

  /* ── Platform section ───────────────────── */
  .lp-platform-section { background: #111; color: #fff; padding: 56px 20px; }
  .lp-platform-inner { max-width: 640px; margin: 0 auto; text-align: center; }
  .lp-platform-lead {
    margin-top: 14px; font-size: 15px; font-weight: 300;
    color: rgba(255,255,255,.72); line-height: 1.75;
  }
  .lp-platform-diagram { max-width: 420px; margin: 40px auto 0; }
  .lp-one-time {
    background: rgba(245,184,0,.12); border-radius: 8px;
    padding: 18px; text-align: center;
  }
  /* Trunk-and-branch connector: one line down from the one-time box, forking out
     to each slot. The branch leading to the active slot turns solid; the rest
     of the tree stays dashed. */
  .lp-connector-tree { position: relative; height: 40px; }
  .lp-ct-trunk {
    position: absolute; top: 0; left: 50%; width: 2px; height: 18px;
    transform: translateX(-50%);
    background: #F5B800;
  }
  .lp-ct-spine-left, .lp-ct-spine-right {
    position: absolute; top: 18px; height: 2px;
    background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.55) 0 6px, transparent 6px 13px);
    background-size: 13px 2px;
    animation: connectorFlowX 1s linear infinite;
  }
  .lp-ct-spine-left { left: 16%; right: 50%; }
  .lp-ct-spine-right { left: 50%; right: 16%; }
  .lp-ct-spine-left.is-solid, .lp-ct-spine-right.is-solid {
    background-image: none; background-color: #F5B800; animation: none;
  }
  .lp-ct-branch {
    position: absolute; top: 18px; width: 2px; height: 22px;
    background-image: repeating-linear-gradient(180deg, rgba(255,255,255,.55) 0 6px, transparent 6px 13px);
    background-size: 2px 13px;
    animation: connectorFlow 1s linear infinite;
  }
  .lp-ct-branch.is-solid {
    background-image: none; background-color: #F5B800; animation: none;
  }
  .lp-ct-branch-1 { left: 16%; transform: translateX(-50%); }
  .lp-ct-branch-2 { left: 50%; transform: translateX(-50%); }
  .lp-ct-branch-3 { left: 84%; transform: translateX(-50%); }
  @keyframes connectorFlow {
    from { background-position: 0 0; }
    to   { background-position: 0 13px; }
  }
  @keyframes connectorFlowX {
    from { background-position: 0 0; }
    to   { background-position: 13px 0; }
  }
  /* Traveling light along the solid (active) path — trunk, then the horizontal
     spine when the path bends toward the quiz slot, then the branch down into
     whichever box is selected. Each segment's dot is timed to hand off to the next. */
  .lp-ct-trunk, .lp-ct-spine-left, .lp-ct-spine-right, .lp-ct-branch { overflow: visible; }
  .lp-ct-trunk::after, .lp-ct-spine-left::after, .lp-ct-spine-right::after, .lp-ct-branch::after {
    content: ''; position: absolute; width: 6px; height: 6px; border-radius: 50%;
    background: #F5B800; box-shadow: 0 0 8px 2px rgba(245,184,0,.9); opacity: 0;
  }
  .lp-ct-trunk::after { left: 50%; top: 0; margin-left: -3px; }
  .lp-ct-trunk.to-quiz::after { animation: runTrunkQuiz 1.8s linear infinite; }
  .lp-ct-trunk.to-draw::after { animation: runTrunkDraw 1.8s linear infinite; }
  @keyframes runTrunkQuiz {
    0%      { top: 0; opacity: 1; }
    24%     { top: calc(100% - 6px); opacity: 1; }
    25%, 100% { opacity: 0; }
  }
  @keyframes runTrunkDraw {
    0%      { top: 0; opacity: 1; }
    39%     { top: calc(100% - 6px); opacity: 1; }
    40%, 100% { opacity: 0; }
  }
  .lp-ct-spine-left::after { top: 50%; right: 0; margin-top: -3px; }
  .lp-ct-spine-left.is-solid::after { animation: runSpineLeft 1.8s linear infinite; }
  @keyframes runSpineLeft {
    0%, 24%   { opacity: 0; right: 0; }
    25%       { opacity: 1; }
    64%       { right: calc(100% - 6px); opacity: 1; }
    65%, 100% { opacity: 0; }
  }
  .lp-ct-branch::after { left: 50%; top: 0; margin-left: -3px; }
  .lp-ct-branch-1.is-solid::after { animation: runBranch1 1.8s linear infinite; }
  @keyframes runBranch1 {
    0%, 64%   { opacity: 0; top: 0; }
    65%       { opacity: 1; }
    99%       { top: calc(100% - 6px); opacity: 1; }
    100%      { opacity: 0; }
  }
  .lp-ct-branch-2.is-solid::after { animation: runBranch2 1.8s linear infinite; }
  @keyframes runBranch2 {
    0%, 39%   { opacity: 0; top: 0; }
    40%       { opacity: 1; }
    99%       { top: calc(100% - 6px); opacity: 1; }
    100%      { opacity: 0; }
  }
  .lp-slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .lp-slot {
    background: rgba(255,255,255,.06); border-radius: 8px;
    color: #fff; text-align: left; font: inherit; border: 0;
    padding: 12px 10px; min-height: 100px;
    display: flex; flex-direction: column; gap: 6px; cursor: pointer;
    transition: background .15s, transform .15s;
  }
  .lp-slot:hover { background: rgba(255,255,255,.1); transform: translateY(-2px); }
  .lp-slot-active { background: rgba(245,184,0,.18); }
  .lp-slot-name { font-weight: 600; font-size: 13px; line-height: 1.35; }
  .lp-slot-hint { font-size: 10px; opacity: .6; margin-top: auto; }
  .lp-slot-coming {
    background: rgba(255,255,255,.03); border-radius: 8px; padding: 12px 10px;
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 100px; color: rgba(255,255,255,.42);
  }
  .lp-slots-hint {
    font-family: 'DM Mono', monospace; font-size: 9px;
    letter-spacing: .06em; text-transform: uppercase;
    color: rgba(255,255,255,.45); margin-top: 10px; text-align: center;
  }
  @media (prefers-reduced-motion: reduce) {
    .lp-ct-spine-left, .lp-ct-spine-right, .lp-ct-branch { animation: none; }
  }

  /* ── Tier section ───────────────────────── */
  .lp-tiers-section { padding: 30px 20px; }
  .lp-tiers-inner { max-width: 1120px; margin: 0 auto; }
  .lp-tier-pager {
    display: inline-flex; align-items: stretch; border: 1px solid #E5E5E3;
    border-radius: 5px; overflow: hidden; margin-bottom: 18px;
  }
  .lp-tier-pager-arrow {
    border: 0; background: #fff; cursor: pointer; font-size: 14px; color: #111;
    font-family: inherit; width: 40px; min-height: 44px;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s;
  }
  .lp-tier-pager-arrow:hover { background: #F7F7F5; }
  .lp-tier-pager-arrow:active { background: #E5E5E3; }
  .lp-tier-pager-label {
    display: flex; align-items: center; justify-content: center;
    min-width: 140px; padding: 10px 16px; font-size: 13px; font-weight: 600;
    border-left: 1px solid #E5E5E3; border-right: 1px solid #E5E5E3;
    white-space: nowrap;
  }

  .lp-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    margin-top: 22px; border: 1px solid #E5E5E3;
  }
  .lp-card {
    border-right: 1px solid #E5E5E3; border-bottom: 1px solid #E5E5E3;
    padding: 20px; display: flex; flex-direction: column; gap: 14px;
  }
  .lp-card-header { display: flex; align-items: baseline; gap: 9px; }
  .lp-card-preview {
    background: #F7F7F5; padding: 14px;
    display: flex; justify-content: center; align-items: center;
    min-height: 160px; overflow: hidden;
  }
  .lp-card-desc { font-size: 14px; line-height: 1.6; }
  .lp-card-suits {
    border-top: 1px solid #E5E5E3; padding-top: 12px;
    font-size: 13px; color: #9B9B98; min-height: 68px;
  }
  .lp-card-price {
    margin-top: auto; padding-top: 12px; padding-right: 24px; border-top: 1px solid #E5E5E3;
    display: flex; align-items: baseline; justify-content: space-between;
  }
  .lp-card-price .label-sm { font-size: 11px; }
  .lp-price-num { font-family: 'DM Mono', monospace; font-size: 24px; font-weight: 500; letter-spacing: -.02em; }

  /* ── Rules accordion ─────────────────────── */
  .lp-rules-btn {
    width: 100%; margin-top: 22px;
    border: 1px solid #E5E5E3;
    font: inherit; color: #111;
    padding: 16px 18px; min-height: 56px;
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    cursor: pointer; background: #fff;
    transition: background .15s;
  }
  .lp-rules-btn-open { background: #F7F7F5; border-bottom: 0; }
  .lp-rules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    border-top: 1px solid #E5E5E3; border-left: 1px solid #E5E5E3;
  }
  .lp-rule-cell {
    border-right: 1px solid #E5E5E3; border-bottom: 1px solid #E5E5E3;
    padding: 20px; display: flex; flex-direction: column; gap: 8px;
  }
  .lp-rule-cell-dim { background: #F7F7F5; }
  .lp-limits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: 10px; margin-top: 12px;
  }
  .lp-limit-item { border: 1px dashed #9B9B98; padding: 14px 16px; font-size: 13px; line-height: 1.6; }
  .lp-output-badges { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 20px; }
  .lp-badge {
    border: 1px solid #E5E5E3; border-radius: 99px;
    padding: 5px 11px; font-family: 'DM Mono', monospace;
    font-size: 10px; letter-spacing: .06em; text-transform: uppercase;
  }

  /* ── Pricing ─────────────────────────────── */
  .lp-pricing-section { padding: 30px 20px; }
  .lp-pricing-inner { max-width: 1120px; margin: 0 auto; }
  .lp-pricing-split {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 24px; align-items: start; margin-top: 22px;
  }
  /* Collapsed: stretch the right column so its button matches the yellow card's
     height. Expanded: back to align-items:start so the taller panel doesn't
     force the short yellow card to stretch with it. */
  .lp-pricing-split-collapsed { align-items: stretch; }
  .lp-pricing-right { display: flex; flex-direction: column; }
  .lp-pricing-right .lp-rules-btn { flex: 1; margin-top: 0; }
  .lp-pricing-cell {
    padding: 24px; border: 1px solid #E5E5E3; font-size: 15px;
  }
  .lp-pricing-cell-yellow { background: #F5B800; }
  .lp-pricing-cell-yellow .label { color: rgba(17,17,17,.65); }
  .lp-pricing-panel {
    border: 1px solid #E5E5E3; border-top: 0; padding: 24px;
  }
  .lp-pricing-panel .lp-tier-pager { margin-bottom: 18px; }
  .lp-pricing-setup-num { font-family: 'DM Mono', monospace; font-size: 44px; font-weight: 500; letter-spacing: -.03em; margin-top: 8px; }
  .lp-pricing-rows { display: flex; flex-direction: column; }
  .lp-pricing-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 9px 0; border-bottom: 1px solid #E5E5E3;
  }
  .lp-pricing-row:last-child { border-bottom: 0; }
  .lp-pricing-row-num { font-family: 'DM Mono', monospace; font-size: 18px; }
  .lp-pricing-row-unit { font-family: 'Noto Sans Thai', sans-serif; font-size: 13px; font-weight: 400; margin-left: 3px; }
  .lp-pricing-note { border-top: 1px solid #111; padding-top: 12px; margin-top: 6px; font-size: 14px; line-height: 1.7; }
  .lp-scope-chips { display: flex; flex-wrap: wrap; gap: 16px 40px; margin-top: 8px; }
  .lp-scope-chip { display: flex; flex-direction: column; gap: 2px; }
  .lp-scope-key { font-size: 12px; color: #9B9B98; }
  .lp-scope-val { font-size: 15px; font-weight: 500; line-height: 1.4; }
  .lp-scope-note { font-size: 11px; color: #9B9B98; margin-top: 2px; }
  .lp-condition-box { border: 1px solid #E63B2E; padding: 18px; margin-top: 16px; display: flex; flex-direction: column; gap: 6px; }

  /* ── Pricing add-on calculator ────────────── */
  .lp-addon-section { border-top: 1px solid #E5E5E3; margin-top: 20px; padding-top: 18px; }
  .lp-addon-tier-select { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .lp-addon-tier-btn {
    border: 1px solid #E5E5E3; background: #fff; color: #9B9B98;
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    padding: 8px 14px; min-height: 38px; border-radius: 6px;
    transition: background .15s, color .15s, border-color .15s;
  }
  .lp-addon-tier-btn:hover { border-color: #111; color: #111; }
  .lp-addon-tier-btn-active { background: #111; border-color: #111; color: #fff; }
  .lp-addon-tier-btn-active:hover { color: #fff; }
  .lp-addon-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding: 14px 0; border-bottom: 1px solid #E5E5E3;
  }
  .lp-addon-label { font-size: 14px; font-weight: 600; }
  .lp-addon-hint { font-size: 12px; color: #9B9B98; margin-top: 2px; }
  .lp-addon-stepper {
    display: flex; align-items: center; gap: 12px; flex-shrink: 0;
  }
  .lp-addon-stepper button {
    width: 30px; height: 30px; border-radius: 50%; border: 1px solid #E5E5E3;
    background: #fff; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center; line-height: 1;
    transition: background .15s, border-color .15s;
  }
  .lp-addon-stepper button:hover { border-color: #111; background: #F7F7F5; }
  .lp-addon-stepper span {
    font-family: 'DM Mono', monospace; font-size: 14px; min-width: 64px; text-align: center;
  }
  .lp-addon-sum { margin-top: 16px; background: #F7F7F5; padding: 16px; }
  .lp-addon-sum-row {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 13px; color: #9B9B98; padding: 4px 0;
  }
  .lp-addon-sum-total {
    border-top: 1px solid #E5E5E3; margin-top: 6px; padding-top: 10px;
    font-size: 16px; font-weight: 700; color: #111;
  }

  /* ── Footer ──────────────────────────────── */
  .lp-footer { background: #111; padding: 40px 20px 20px; }
  .lp-footer-top {
    max-width: 1120px; margin: 0 auto; padding-bottom: 24px;
    display: flex; flex-wrap: wrap; justify-content: space-between;
    align-items: flex-start; gap: 40px;
  }
  .lp-footer-brand-col { max-width: 420px; }
  .lp-footer-brand-col p {
    margin-top: 16px; font-size: 14px; line-height: 1.7; font-weight: 300;
    color: rgba(255,255,255,.55);
  }
  .lp-footer-col-title {
    font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .06em;
    text-transform: uppercase; font-weight: 600; color: #fff;
  }
  .lp-footer-contact-col { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
  .lp-footer-contact-col .mono { color: #fff; font-size: 14px; font-weight: 600; margin-top: 6px; }
  .lp-footer-contact-hours { font-size: 13px; color: rgba(255,255,255,.45); }
  .lp-footer-contact-col .lp-footer-email { margin-top: 2px; }
  .lp-footer-contact-col .lp-btn { margin-top: 10px; }
  .lp-footer-inner {
    max-width: 1120px; margin: 0 auto;
    display: flex; flex-wrap: wrap; justify-content: flex-end;
    align-items: flex-start; gap: 28px;
  }
  .lp-footer-company { color: #fff; font-weight: 600; font-size: 14px; }
  .lp-footer-company-en {
    font-family: 'DM Mono', monospace; font-size: 10px;
    letter-spacing: .06em; text-transform: uppercase;
    color: rgba(255,255,255,.4); margin-top: 4px;
  }
  .lp-footer-address {
    font-size: 13px; line-height: 1.7; color: rgba(255,255,255,.55);
    margin-top: 10px; max-width: 360px;
  }
  .lp-footer-email {
    display: inline-block; margin-top: 4px;
    font-size: 13px; color: rgba(255,255,255,.7);
  }
  .lp-footer-email:hover { color: #fff; }
  .lp-footer-links {
    display: flex; gap: 20px; flex-wrap: wrap;
    font-family: 'DM Mono', monospace; font-size: 10px;
    letter-spacing: .08em; text-transform: uppercase;
  }
  .lp-footer-links a { color: rgba(255,255,255,.5); }
  .lp-footer-links a:hover { color: #fff; }

  /* ── QR Modal ────────────────────────────── */
  .lp-modal-bg {
    position: fixed; inset: 0; z-index: 90;
    background: rgba(17,17,17,.62);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .lp-modal {
    background: #fff; border: 1px solid #111;
    max-width: 360px; width: 100%; padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
    align-items: center; text-align: center;
  }
  .lp-modal-title { font-size: 18px; font-weight: 600; }
  .lp-qr-box {
    width: 200px; height: 200px;
    border: 1px solid #E5E5E3; background: #F7F7F5;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── Utility ─────────────────────────────── */
  .mono { font-family: 'DM Mono', monospace; }
  .text-muted { color: #9B9B98; }
  .text-red { color: #E63B2E; }
  .text-green { color: #16A34A; }
  .text-yellow { color: #F5B800; }
  .label {
    font-family: 'DM Mono', monospace; font-size: 10px;
    letter-spacing: .08em; text-transform: uppercase; color: #9B9B98;
  }
  .label-sm {
    font-family: 'DM Mono', monospace; font-size: 9px;
    letter-spacing: .06em; text-transform: uppercase; color: #9B9B98;
  }

  /* ── Section wrapper ─────────────────────── */
  .lp-section { padding: 30px 20px; border-bottom: 1px solid #E5E5E3; }
  .lp-section-dark { padding: 30px 20px; border-bottom: 1px solid #E5E5E3; background: #111; color: #fff; }
  .lp-h2 { font-size: clamp(22px, 3.6vw, 34px); font-weight: 600; line-height: 1.3; }

  /* ══════════════════════════════════════════
     RESPONSIVE — Mobile first
  ══════════════════════════════════════════ */

  /* < 480px — small phones */
  @media (max-width: 479px) {
    .lp-nav-name { display: none; }
    .lp-hero { padding: 36px 16px 0; }
    .lp-section, .lp-section-dark, .lp-demo-section, .lp-platform-section, .lp-tiers-section, .lp-pricing-section, .lp-footer { padding-left: 16px; padding-right: 16px; }
    .lp-section-label { padding-left: 16px; padding-right: 16px; }
    .lp-hero-cta .lp-btn { width: 100%; }
    .lp-slot { padding: 10px 8px; min-height: 90px; }
    .lp-slot-name { font-size: 12px; }
    .lp-footer-contact-col .lp-btn { width: 100%; }
    .lp-modal-bg { padding: 0; align-items: flex-end; }
    .lp-modal { max-width: 100%; border-radius: 16px 16px 0 0; }
    .lp-pricing-setup-num { font-size: 36px; }
  }

  /* 480–767px — large phones */
  @media (min-width: 480px) and (max-width: 767px) {
    .lp-hero { padding: 44px 20px 0; }
  }

  /* < 640px — hide nav name */
  @media (max-width: 639px) {
    .lp-nav-name { display: none; }
  }


  /* >= 768px — show name */
  @media (min-width: 768px) {
    .lp-nav-name { display: block; }
  }
`

// ── Components ────────────────────────────────────────────────────────────────

function SectionLabel({ left, right }: { left: string; right: string }) {
  return (
    <div className="lp-section-label">
      <span className="lp-section-label-left">{left}</span>
      <span>{right}</span>
    </div>
  )
}

function QuizCardPreview({ cards }: { cards: string[] }) {
  const heights = 105
  return (
    <div className="lp-card-preview">
      {cards.map((src, i) => (
        <img
          key={src} src={src} alt="ผลลัพธ์"
          style={{
            height: heights, width: 'auto', flexShrink: 0,
            marginLeft: i === 0 ? 0 : cards.length === 2 ? -20 : -122,
            filter: i === 0 ? undefined : 'drop-shadow(-3px 0 0 rgba(255,255,255,.9))',
          }}
        />
      ))}
    </div>
  )
}

function QRModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="lp-modal-bg" onClick={onClose}>
      <div className="lp-modal" onClick={e => e.stopPropagation()}>
        <span className="label">สแกนด้วยไลน์</span>
        <p className="lp-modal-title">เปิดกล้องในแอปไลน์ แล้วสแกนโค้ดนี้</p>
        <div className="lp-qr-box">
          {/* Replace with actual QR: <img src="..." width={200} height={200} alt="LINE QR" /> */}
          <span className="label text-muted">LINE OA QR</span>
        </div>
        <span className="mono" style={{ fontSize: 12, letterSpacing: '.06em' }}>{LINE_ID}</span>
        <button className="lp-btn lp-btn-outline lp-btn-full" onClick={onClose}>ปิด</button>
      </div>
    </div>
  )
}


export default function LandingPage() {
  const [activity, setActivity] = useState<typeof ACTIVITIES[number]['key']>('quiz')
  const [qrOpen, setQrOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [isFirstTime, setIsFirstTime] = useState(true)
  const [addonTierIdx, setAddonTierIdx] = useState(0)
  const [addonQuestions, setAddonQuestions] = useState(10)
  const [addonTracks, setAddonTracks] = useState(5)
  const [addonGroups, setAddonGroups] = useState(9)
  const [addonParticipants, setAddonParticipants] = useState(QUIZ_ADDON_DEFAULT_PARTICIPANTS[0])
  const addonDefaultParticipants = QUIZ_ADDON_DEFAULT_PARTICIPANTS[addonTierIdx]
  function selectAddonTier(i: number) {
    setAddonTierIdx(i)
    setAddonParticipants(QUIZ_ADDON_DEFAULT_PARTICIPANTS[i])
  }
  const addonQuestionCost = Math.ceil(Math.max(0, addonQuestions - 10) / 5) * 2_000
  const addonTrackCost = Math.max(0, addonTracks - 5) * 10_000
  const addonGroupCost = Math.max(0, addonGroups - 9) * 5_000
  const addonParticipantCost = Math.max(0, Math.round((addonParticipants - addonDefaultParticipants) / 10_000)) * 5_000
  const addonTotalCost = addonQuestionCost + addonTrackCost + addonGroupCost + addonParticipantCost
  const addonTierPrice = isFirstTime ? QUIZ_TIERS[addonTierIdx].first : QUIZ_TIERS[addonTierIdx].campaign
  const addonGrandTotal = addonTierPrice + addonTotalCost

  const [addonDestIdx, setAddonDestIdx] = useState(0)
  const [addonCodes, setAddonCodes] = useState(DRAW_ADDON_DEFAULT_PARTICIPANTS[0])
  const [addonDestParticipants, setAddonDestParticipants] = useState(DRAW_ADDON_DEFAULT_PARTICIPANTS[0])
  const addonDestDefaultCodes = DRAW_ADDON_DEFAULT_PARTICIPANTS[addonDestIdx]
  const addonDestDefaultParticipants = DRAW_ADDON_DEFAULT_PARTICIPANTS[addonDestIdx]
  function selectAddonDest(i: number) {
    setAddonDestIdx(i)
    setAddonCodes(DRAW_ADDON_DEFAULT_PARTICIPANTS[i])
    setAddonDestParticipants(DRAW_ADDON_DEFAULT_PARTICIPANTS[i])
  }
  const addonCodeCost = Math.max(0, Math.round((addonCodes - addonDestDefaultCodes) / 10_000)) * 5_000
  const addonDestParticipantCost = Math.max(0, Math.round((addonDestParticipants - addonDestDefaultParticipants) / 10_000)) * 5_000
  const addonDest = DRAW_DESTINATIONS[addonDestIdx]
  const addonDestPrice = isFirstTime ? addonDest.first : addonDest.campaign
  const addonDestTotalCost = addonCodeCost + addonDestParticipantCost
  const addonDestGrandTotal = addonDestPrice + addonDestTotalCost

  const activityIndex = ACTIVITIES.findIndex(a => a.key === activity)
  function stepActivity(dir: 1 | -1) {
    const idx = ENABLED_ACTIVITIES.findIndex(a => a.key === activity)
    const next = (idx + dir + ENABLED_ACTIVITIES.length) % ENABLED_ACTIVITIES.length
    setActivity(ENABLED_ACTIVITIES[next].key)
  }

  function openLineAdd() {
    window.location.href = LINE_ADD_APP
    setTimeout(() => { window.location.href = LINE_ADD_URL }, 1500)
  }

  function openLiff(src: string) {
    if (isMobile()) {
      // ลอง deep link เปิด LINE app ก่อน — ถ้าไม่มี LINE ค่อย fallback ไป web LIFF
      const appUrl = `line://app/${LIFF_ID}?src=${src}`
      const webUrl = buildLiffUrl(src)
      window.location.href = appUrl
      setTimeout(() => { window.location.href = webUrl }, 1500)
    } else {
      setQrOpen(true)
    }
  }

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Nav (outside .lp-wrap so its background can span the full width) ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <img src={CARDS.logo} alt="Codera Solutions" className="lp-nav-logo" />
          <span className="lp-nav-name">Codera Solutions</span>
          <button onClick={openLineAdd} className="lp-nav-cta">
            ทักเราในไลน์
          </button>
        </div>
      </nav>

      {/* ── Hero (outside .lp-wrap so the floating cards can bleed to the true screen edge) ── */}
      <header className="lp-hero">
        <div className="lp-hero-grid" />
        <div className="lp-hero-decor" aria-hidden="true">
          <div className="lp-hero-decor-card lp-hero-decor-left-back">
            <img src={CARDS.mystic} alt="" />
          </div>
          <div className="lp-hero-decor-card lp-hero-decor-left-front">
            <img src={CARDS.chiller} alt="" />
          </div>
          <div className="lp-hero-decor-card lp-hero-decor-right-back">
            <img src={CARDS.prepper} alt="" />
          </div>
          <div className="lp-hero-decor-card lp-hero-decor-right-front">
            <img src={CARDS.analyst} alt="" />
          </div>
        </div>
        <div className="lp-hero-inner">
          <span className="lp-live-badge">
            <span className="lp-live-dot" />
            เปิดเล่นได้จริงตอนนี้
          </span>
          <h1>
            กิจกรรมที่เล่นจบได้ในไลน์<br />
            <span className="lp-hero-accent">ให้แบรนด์ของคุณ</span>
          </h1>
          <p>
            <span className="lp-hero-p-lead">ติดตั้งครั้งเดียวต่อ OA</span>
            <span className="lp-hero-p-desc">กิจกรรมใหม่ที่ออกมา ใช้ได้ทันทีโดยไม่ต้องจ่ายค่าติดตั้งใหม่ จ่ายแค่ค่าแคมเปญ</span>
          </p>
          <div className="lp-hero-cta">
            <button className="lp-btn lp-btn-dark" onClick={() => openLiff('lp_hero')}>
              เล่นของจริง 1 นาที
            </button>
            <span className="lp-hero-note">ไม่ใช่วิดีโอเดโม เปิดเล่นได้เลยตอนนี้</span>
          </div>
        </div>
      </header>

      {/* ── 01 Demo (outside .lp-wrap so it has no boxed border) ── */}
      <section className="lp-demo-section">
        <div className="lp-demo-grid-wrap">
          <div className="lp-demo-heading">
            <h2 className="lp-h2">ลองเองก่อน</h2>
            <h2 className="lp-h2"><span className="lp-hero-accent">เข้าใจเร็วกว่าอ่าน</span></h2>
          </div>
          <div className="lp-demo-grid">
            <div className="lp-demo-visual">
              <img src={CARDS.kvTeam} alt="Apocalypse Squad Duo Quiz" style={{ width: '100%' }} />
              <span className="label-sm">การ์ดผลจริงจากกิจกรรม · 5 สาย</span>
            </div>
            <div className="lp-demo-content">
              <div>
                <div className="label text-red">Apocalypse Squad</div>
                <div className="lp-demo-title">โลกแตกพรุ่งนี้ คุณจะเป็นสายไหน</div>
              </div>
              <div className="lp-demo-checklist">
                {['ตอบ 6 ข้อ ได้การ์ดของตัวเอง', 'ชวนเพื่อนตอบ เห็นว่ารอดด้วยกันได้กี่วัน', 'ตั้งทีม ผลของทุกคนรวมเป็นผลทีมเดียว'].map((t, i) => (
                  <div key={i} className="lp-demo-check-item">
                    <span className="lp-demo-check-icon">✓</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              <div className="lp-demo-footer">สามจังหวะนี้คือสามระดับที่เราขายพอดี</div>
              <button onClick={openLineAdd} className="lp-btn lp-btn-green" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>
                เปิดเล่นในไลน์
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 Platform (outside .lp-wrap so it can span the full width, no boxed lines) ── */}
      <section className="lp-platform-section">
        <div className="lp-platform-inner">
          <h2 className="lp-h2">ติดตั้งครั้งเดียว<br />ใช้ได้กับทุกกิจกรรมที่เราปล่อยออกมา</h2>
          <p className="lp-platform-lead">ค่าติดตั้งผูกกับ LINE OA ของแบรนด์ ไม่ได้ผูกกับกิจกรรม ไม่ต้องต่อระบบใหม่ จ่ายแค่ค่าแคมเปญ</p>
          <div className="lp-platform-diagram">
            <div className="lp-one-time">
              <div className="label text-yellow">One-time</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>ติดตั้ง OA ครั้งเดียว</div>
            </div>
            <div className="lp-connector-tree">
              <div className={`lp-ct-trunk ${activity === 'quiz' ? 'to-quiz' : 'to-draw'}`} />
              <div className={`lp-ct-spine-left ${activity === 'quiz' ? 'is-solid' : ''}`} />
              <div className={`lp-ct-spine-right`} />
              <div className={`lp-ct-branch lp-ct-branch-1 ${activity === 'quiz' ? 'is-solid' : ''}`} />
              <div className={`lp-ct-branch lp-ct-branch-2 ${activity === 'draw' ? 'is-solid' : ''}`} />
              <div className="lp-ct-branch lp-ct-branch-3" />
            </div>
            <div className="lp-slots">
              {([
                { key: 'quiz', label: 'ควิซบุคลิก\n3 ระดับ' },
                { key: 'draw', label: 'สุ่มรับรางวัล\nเลือกของรางวัล' },
              ] as const).map(({ key, label }) =>
                key === 'draw' && !DRAW_ENABLED ? (
                  <div key={key} className="lp-slot-coming">
                    <span className="mono" style={{ fontSize: 20 }}>?</span>
                    <span style={{ fontSize: 11 }}>Coming Soon</span>
                  </div>
                ) : (
                  <button
                    key={key}
                    onClick={() => {
                      setActivity(key)
                      document.getElementById('tiers-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className={`lp-slot ${activity === key ? 'lp-slot-active' : ''}`}
                  >
                    <span className="label-sm text-green">Ready</span>
                    <span className="lp-slot-name">{label.replace('\\n', '\n')}</span>
                    <span className="lp-slot-hint">แตะดูราคา</span>
                  </button>
                )
              )}
              <div className="lp-slot-coming">
                <span className="mono" style={{ fontSize: 20 }}>?</span>
                <span style={{ fontSize: 11 }}>Coming Soon</span>
              </div>
            </div>
            <div className="lp-slots-hint">แตะช่องที่พร้อมแล้ว เพื่อดูรายละเอียดและราคาด้านล่าง ↓</div>
          </div>
        </div>
      </section>

      {/* ── 03 Tiers (outside .lp-wrap so it has no boxed border) ── */}
      <section className="lp-tiers-section" id="tiers-section">
        <div className="lp-tiers-inner">
          <div className="lp-tier-pager">
            <button className="lp-tier-pager-arrow" onClick={() => stepActivity(-1)} aria-label="กิจกรรมก่อนหน้า" disabled={ENABLED_ACTIVITIES.length <= 1} style={ENABLED_ACTIVITIES.length <= 1 ? { opacity: .35, cursor: 'default' } : undefined}>←</button>
            <span className="lp-tier-pager-label">{ACTIVITIES[activityIndex].label}</span>
            <button className="lp-tier-pager-arrow" onClick={() => stepActivity(1)} aria-label="กิจกรรมถัดไป" disabled={ENABLED_ACTIVITIES.length <= 1} style={ENABLED_ACTIVITIES.length <= 1 ? { opacity: .35, cursor: 'default' } : undefined}>→</button>
          </div>

          {activity === 'quiz' && (
            <>
              <h2 className="lp-h2">ควิซบุคลิก ทำได้ 3 ระดับ</h2>
              <p style={{ color: '#9B9B98', marginTop: 10, maxWidth: '48ch' }}>ต่างกันเรื่องเดียว คือผลของแต่ละคนเชื่อมกันแค่ไหน</p>
              <div className="lp-cards-grid">
                {QUIZ_TIERS.map(tier => (
                  <div key={tier.level} className="lp-card">
                    <div className="lp-card-header">
                      <span className="label">{tier.level}</span>
                      <span style={{ fontSize: 19, fontWeight: 600 }}>{tier.name}</span>
                    </div>
                    <QuizCardPreview cards={tier.cards} />
                    <p className="lp-card-desc">{tier.desc}</p>
                    <div className="lp-card-suits">
                      <span className="label-sm" style={{ display: 'block', marginBottom: 3 }}>เหมาะกับ</span>
                      {tier.suits}
                    </div>
                    <div className="lp-card-suits">
                      <span className="label-sm" style={{ display: 'block', marginBottom: 3 }}>คุณต้องเตรียม</span>
                      {tier.prepare}
                    </div>
                    <div className="lp-card-price">
                      <span className="label-sm">ครั้งแรก</span>
                      <span className="lp-price-num">
                        {fmt(tier.first)}
                        <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>บาท</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activity === 'draw' && (
            <>
              <h2 className="lp-h2">สุ่มรับรางวัล เลือกได้ว่าแจกผลเป็นอะไร</h2>
              <p style={{ color: '#9B9B98', marginTop: 10, maxWidth: '48ch' }}>กลไกสุ่มชุดเดียวกัน ต่างกันที่ปลายทางของรางวัล — ปลายทางเป็นตัวกำหนดราคา</p>
              <div className="lp-cards-grid">
                {DRAW_DESTINATIONS.map(dest => (
                  <div key={dest.dest} className="lp-card">
                    <div className="lp-card-header">
                      <span className="label">{dest.dest}</span>
                      <span style={{ fontSize: 19, fontWeight: 600 }}>{dest.name}</span>
                    </div>
                    <p className="lp-card-desc">{dest.desc}</p>
                    <div className="lp-card-suits">
                      <span className="label-sm" style={{ display: 'block', marginBottom: 3 }}>เหมาะกับ</span>
                      {dest.suits}
                    </div>
                    <div className="lp-card-suits">
                      <span className="label-sm" style={{ display: 'block', marginBottom: 3 }}>คุณต้องเตรียม</span>
                      {dest.prepare}
                    </div>
                    <div className="lp-card-price">
                      <span className="label-sm">ครั้งแรก</span>
                      <span className="lp-price-num">
                        {dest.prefix && <span style={{ fontSize: 13, marginRight: 4 }}>{dest.prefix}</span>}
                        {fmt(dest.first)}
                        <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>บาท</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rules accordion */}
              <button
                className={`lp-rules-btn ${rulesOpen ? 'lp-rules-btn-open' : ''}`}
                onClick={() => setRulesOpen(v => !v)}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left' }}>
                  <span className="label">การจัดการรางวัล</span>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>คลังรางวัล อัตราการสุ่ม และเงื่อนไข</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span className="label-sm">{rulesOpen ? 'ย่อ' : 'ดูรายละเอียด'}</span>
                  <span className="mono" style={{ fontSize: 16 }}>{rulesOpen ? '–' : '+'}</span>
                </span>
              </button>

              {rulesOpen && (
                <div>
                  <div className="lp-rules-grid">
                    {DRAW_RULES.map(r => (
                      <div key={r.key} className={`lp-rule-cell ${r.dim ? 'lp-rule-cell-dim' : ''}`}>
                        <span className="label">{r.key}</span>
                        <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{r.title}</span>
                        <span style={{ fontSize: 13, color: '#9B9B98', lineHeight: 1.6 }}>{r.body}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <span className="label text-red">เงื่อนไขและข้อจำกัดที่ต้องบอกแบรนด์ก่อน</span>
                    <div className="lp-limits-grid">
                      {DRAW_LIMITS.map((t, i) => <div key={i} className="lp-limit-item">{t}</div>)}
                    </div>
                  </div>
                  <div className="lp-output-badges">
                    <span className="label-sm">ส่งผลออกไปที่ไหนได้</span>
                    {['ไฟล์ CSV', 'Google Sheet', 'Webhook'].map(tag => (
                      <span key={tag} className="lp-badge">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── 04 Pricing (outside .lp-wrap so it has no boxed border) ── */}
      <section className="lp-pricing-section">
        <div className="lp-pricing-inner">
          <h2 className="lp-h2">ราคาสำหรับเอเจนซี่และพาร์ทเนอร์</h2>
          <div className={`lp-pricing-split ${!pricingOpen ? 'lp-pricing-split-collapsed' : ''}`}>
            {/* Setup — always visible on the left */}
            <div className="lp-pricing-cell lp-pricing-cell-yellow">
              <div className="label">ค่าติดตั้งระบบ · ต่อ 1 OA</div>
              <div className="lp-pricing-setup-num">16,000<span className="lp-pricing-row-unit" style={{ fontSize: 18 }}>บาท</span></div>
              <div style={{ fontSize: 14, marginTop: 10, lineHeight: 1.7 }}>
                จ่ายครั้งเดียว · ใช้ได้กับทุกกิจกรรมบนแพลตฟอร์ม<br />
                ครั้งต่อไปบน OA เดิม ไม่ต้องจ่ายอีก
              </div>
            </div>

            {/* Campaign pricing + scope — right column, collapsed by default (the
                click is a natural interest signal, worth wiring to analytics once
                a tool is picked); once open, tabs switch which activity is shown. */}
            <div className="lp-pricing-right">
              <button
                className={`lp-rules-btn ${pricingOpen ? 'lp-rules-btn-open' : ''}`}
                onClick={() => setPricingOpen(v => !v)}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left' }}>
                  <span className="label">ค่าแคมเปญและขอบเขต</span>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>ดูราคาควิซบุคลิก และขอบเขตมาตรฐาน</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span className="label-sm">{pricingOpen ? 'ย่อ' : 'ดูรายละเอียด'}</span>
                  <span className="mono" style={{ fontSize: 16 }}>{pricingOpen ? '–' : '+'}</span>
                </span>
              </button>

              {pricingOpen && (
                <div className="lp-pricing-panel">
                  <div className="lp-tier-pager">
                    <button className="lp-tier-pager-arrow" onClick={() => stepActivity(-1)} aria-label="กิจกรรมก่อนหน้า">←</button>
                    <span className="lp-tier-pager-label">{ACTIVITIES[activityIndex].label}</span>
                    <button className="lp-tier-pager-arrow" onClick={() => stepActivity(1)} aria-label="กิจกรรมถัดไป">→</button>
                  </div>

                  {/* ครั้งแรก vs ครั้งที่ 2 — ใช้ร่วมกันทั้งควิซและสุ่มรับรางวัล เพราะราคาคิดต่างกันตั้งแต่แถวราคา */}
                  <div className="lp-addon-tier-select" style={{ marginBottom: 18 }}>
                    <button
                      className={`lp-addon-tier-btn ${isFirstTime ? 'lp-addon-tier-btn-active' : ''}`}
                      onClick={() => setIsFirstTime(true)}
                    >
                      ครั้งแรก (รวมค่าติดตั้ง)
                    </button>
                    <button
                      className={`lp-addon-tier-btn ${!isFirstTime ? 'lp-addon-tier-btn-active' : ''}`}
                      onClick={() => setIsFirstTime(false)}
                    >
                      ไม่ใช่ครั้งแรก
                    </button>
                  </div>

                  {activity === 'quiz' ? (
                    <>
                      <div className="lp-pricing-rows">
                        {QUIZ_TIERS.map(t => (
                          <div key={t.level} className="lp-pricing-row">
                            <span>{t.name}</span>
                            <span className="lp-pricing-row-num">{fmt(isFirstTime ? t.first : t.campaign)}<span className="lp-pricing-row-unit">บาท</span></span>
                          </div>
                        ))}
                      </div>
                      {isFirstTime && (
                        <div className="lp-pricing-note">
                          ครั้งแรกรวมค่าติดตั้งระบบ 16,000 บาท ครั้งต่อไปบน OA เดิม จ่ายแค่ค่าแคมเปญ
                        </div>
                      )}
                      <div className="label" style={{ marginTop: 20 }}>ขอบเขตมาตรฐาน · ควิซบุคลิก</div>
                      <div className="lp-scope-chips">
                        {[
                          { k: 'ระยะเวลาแคมเปญ', v: 'ไม่เกิน 90 วัน' },
                          { k: 'ผลคู่', v: '15 แบบ' },
                          { k: 'แก้ไขเนื้อหา', v: '2 รอบ' },
                        ].map(row => (
                          <div key={row.k} className="lp-scope-chip">
                            <span className="lp-scope-key">{row.k}</span>
                            <span className="lp-scope-val">{row.v}</span>
                            {row.k === 'ระยะเวลาแคมเปญ' && (
                              <span className="lp-scope-note">อยากได้นานกว่านี้ ทักเราในไลน์เพิ่มได้</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add-ons — คำถาม / ผลลัพธ์สาย / ผลกลุ่ม เกินจากที่รวมไว้ในแพ็กเกจ คิดเพิ่มตามจริง */}
                      <div className="lp-addon-section">
                        <div className="label">เลือกแผนและ add-on เพิ่มเติม</div>
                        <div className="lp-addon-tier-select">
                          {QUIZ_TIERS.map((t, i) => (
                            <button
                              key={t.level}
                              className={`lp-addon-tier-btn ${addonTierIdx === i ? 'lp-addon-tier-btn-active' : ''}`}
                              onClick={() => selectAddonTier(i)}
                            >
                              {t.name}
                            </button>
                          ))}
                        </div>

                        <div className="lp-addon-row">
                          <div>
                            <div className="lp-addon-label">ผู้เข้าร่วม</div>
                            <div className="lp-addon-hint">ฟรี {fmt(addonDefaultParticipants)} คนแรก จากนั้น +5,000 บาท ทุก 10,000 คน</div>
                          </div>
                          <div className="lp-addon-stepper">
                            <button onClick={() => setAddonParticipants(v => Math.max(addonDefaultParticipants, v - 10_000))} aria-label="ลดจำนวนผู้เข้าร่วม">–</button>
                            <span>{fmt(addonParticipants)} คน</span>
                            <button onClick={() => setAddonParticipants(v => v + 10_000)} aria-label="เพิ่มจำนวนผู้เข้าร่วม">+</button>
                          </div>
                        </div>
                        <div className="lp-addon-row">
                          <div>
                            <div className="lp-addon-label">จำนวนคำถาม</div>
                            <div className="lp-addon-hint">ฟรี 10 ข้อแรก จากนั้น +2,000 บาท ทุก 5 ข้อ</div>
                          </div>
                          <div className="lp-addon-stepper">
                            <button onClick={() => setAddonQuestions(v => Math.max(10, v - 1))} aria-label="ลดจำนวนคำถาม">–</button>
                            <span>{addonQuestions} ข้อ</span>
                            <button onClick={() => setAddonQuestions(v => v + 1)} aria-label="เพิ่มจำนวนคำถาม">+</button>
                          </div>
                        </div>
                        <div className="lp-addon-row">
                          <div>
                            <div className="lp-addon-label">ผลลัพธ์ (สาย)</div>
                            <div className="lp-addon-hint">ฟรี 5 สายแรก จากนั้น +10,000 บาท ต่อสาย</div>
                          </div>
                          <div className="lp-addon-stepper">
                            <button onClick={() => setAddonTracks(v => Math.max(5, v - 1))} aria-label="ลดจำนวนสาย">–</button>
                            <span>{addonTracks} สาย</span>
                            <button onClick={() => setAddonTracks(v => v + 1)} aria-label="เพิ่มจำนวนสาย">+</button>
                          </div>
                        </div>
                        <div className="lp-addon-row">
                          <div>
                            <div className="lp-addon-label">ผลกลุ่ม</div>
                            <div className="lp-addon-hint">ฟรี 9 กลุ่มแรก จากนั้น +5,000 บาท ต่อกลุ่ม</div>
                          </div>
                          <div className="lp-addon-stepper">
                            <button onClick={() => setAddonGroups(v => Math.max(9, v - 1))} aria-label="ลดจำนวนกลุ่ม">–</button>
                            <span>{addonGroups} กลุ่ม</span>
                            <button onClick={() => setAddonGroups(v => v + 1)} aria-label="เพิ่มจำนวนกลุ่ม">+</button>
                          </div>
                        </div>

                        <div className="lp-addon-sum">
                          <div className="lp-addon-sum-row">
                            <span>ค่าแคมเปญ · {QUIZ_TIERS[addonTierIdx].name} · {isFirstTime ? 'ครั้งแรก' : 'ไม่ใช่ครั้งแรก'}</span>
                            <span>{fmt(addonTierPrice)} บาท</span>
                          </div>
                          {addonTotalCost > 0 && (
                            <div className="lp-addon-sum-row">
                              <span>ส่วนเพิ่มเติม (add-on)</span>
                              <span>+{fmt(addonTotalCost)} บาท</span>
                            </div>
                          )}
                          <div className="lp-addon-sum-row lp-addon-sum-total">
                            <span>รวมค่าแคมเปญโดยประมาณ</span>
                            <span>{fmt(addonGrandTotal)} บาท</span>
                          </div>
                        </div>
                      </div>

                      <div className="lp-condition-box">
                        <div className="label text-red">เงื่อนไข</div>
                        <div style={{ fontWeight: 600 }}>ราคานี้อยู่บนเงื่อนไขว่าคุณดูแลเนื้อหาเอง</div>
                        <div style={{ fontSize: 13.5 }}>ผู้ว่าจ้างต้องจัดเตรียมและดูแลธีม / คำถาม / ผลลัพธ์ / ถ้อยคำ เอง</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="lp-pricing-rows">
                        {DRAW_DESTINATIONS.map(d => (
                          <div key={d.dest} className="lp-pricing-row">
                            <span>{d.name}</span>
                            <span className="lp-pricing-row-num">
                              {d.prefix && <span style={{ fontSize: 11, marginRight: 3 }}>{d.prefix} </span>}
                              {fmt(isFirstTime ? d.first : d.campaign)}
                              <span className="lp-pricing-row-unit">บาท</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="lp-pricing-note">
                        {isFirstTime && 'ครั้งแรกรวมค่าติดตั้งระบบ 16,000 บาท '}ต่างกันที่ปลายทาง delivery ไม่ใช่ความสามารถ
                      </div>
                      <div className="label" style={{ marginTop: 20 }}>ขอบเขตมาตรฐาน · สุ่มรับรางวัล</div>
                      <div className="lp-scope-chips">
                        {[
                          { k: 'ระยะเวลาแคมเปญ', v: 'ไม่เกิน 90 วัน', note: 'อยากได้นานกว่านี้ ทักเราในไลน์เพิ่มได้' },
                          { k: 'ชั้นรางวัล', v: 'ไม่เกิน 5 ชั้น', note: 'อยากได้มากกว่านี้ ทักเราในไลน์เพิ่มได้' },
                          { k: 'Audit log', v: 'เก็บย้อนหลัง 12 เดือน' },
                          { k: 'เอกสารประกอบ', v: 'สรุปกลไกสำหรับยื่นกฎหมาย' },
                        ].map(row => (
                          <div key={row.k} className="lp-scope-chip">
                            <span className="lp-scope-key">{row.k}</span>
                            <span className="lp-scope-val">{row.v}</span>
                            {row.note && <span className="lp-scope-note">{row.note}</span>}
                          </div>
                        ))}
                      </div>

                      {/* Add-on — คลังโค้ด เกินจากที่รวมไว้ในแพ็กเกจ คิดเพิ่มตามจริง */}
                      <div className="lp-addon-section">
                        <div className="label">เลือกปลายทางและ add-on เพิ่มเติม</div>
                        <div className="lp-addon-tier-select">
                          {DRAW_DESTINATIONS.map((d, i) => (
                            <button
                              key={d.dest}
                              className={`lp-addon-tier-btn ${addonDestIdx === i ? 'lp-addon-tier-btn-active' : ''}`}
                              onClick={() => selectAddonDest(i)}
                            >
                              {d.name}
                            </button>
                          ))}
                        </div>

                        <div className="lp-addon-row">
                          <div>
                            <div className="lp-addon-label">ผู้เข้าร่วม</div>
                            <div className="lp-addon-hint">ฟรี {fmt(addonDestDefaultParticipants)} คนแรก จากนั้น +5,000 บาท ทุก 10,000 คน</div>
                          </div>
                          <div className="lp-addon-stepper">
                            <button onClick={() => setAddonDestParticipants(v => Math.max(addonDestDefaultParticipants, v - 10_000))} aria-label="ลดจำนวนผู้เข้าร่วม">–</button>
                            <span>{fmt(addonDestParticipants)} คน</span>
                            <button onClick={() => setAddonDestParticipants(v => v + 10_000)} aria-label="เพิ่มจำนวนผู้เข้าร่วม">+</button>
                          </div>
                        </div>
                        <div className="lp-addon-row">
                          <div>
                            <div className="lp-addon-label">คลังโค้ด</div>
                            <div className="lp-addon-hint">ฟรี {fmt(addonDestDefaultCodes)} โค้ดแรก จากนั้น +5,000 บาท ทุก 10,000 โค้ด</div>
                          </div>
                          <div className="lp-addon-stepper">
                            <button onClick={() => setAddonCodes(v => Math.max(addonDestDefaultCodes, v - 10_000))} aria-label="ลดคลังโค้ด">–</button>
                            <span>{fmt(addonCodes)} โค้ด</span>
                            <button onClick={() => setAddonCodes(v => v + 10_000)} aria-label="เพิ่มคลังโค้ด">+</button>
                          </div>
                        </div>

                        <div className="lp-addon-sum">
                          <div className="lp-addon-sum-row">
                            <span>ค่าแคมเปญ · {addonDest.name} · {isFirstTime ? 'ครั้งแรก' : 'ไม่ใช่ครั้งแรก'}</span>
                            <span>{addonDest.prefix && `${addonDest.prefix} `}{fmt(addonDestPrice)} บาท</span>
                          </div>
                          {addonDestTotalCost > 0 && (
                            <div className="lp-addon-sum-row">
                              <span>ส่วนเพิ่มเติม (add-on)</span>
                              <span>+{fmt(addonDestTotalCost)} บาท</span>
                            </div>
                          )}
                          <div className="lp-addon-sum-row lp-addon-sum-total">
                            <span>รวมค่าแคมเปญโดยประมาณ</span>
                            <span>{addonDest.prefix && `${addonDest.prefix} `}{fmt(addonDestGrandTotal)} บาท</span>
                          </div>
                        </div>
                      </div>

                      <div className="lp-condition-box">
                        <div className="label text-red">เงื่อนไข</div>
                        <div style={{ fontWeight: 600 }}>ราคานี้อยู่บนเงื่อนไขว่าคุณดูแลเนื้อหาเอง</div>
                        <div style={{ fontSize: 13.5 }}>ผู้ว่าจ้างต้องจัดเตรียมและดูแล โค้ด / คูปอง / ของรางวัลจริง เอง</div>
                      </div>
                    </>
                  )}
                  <div className="text-muted" style={{ marginTop: 16, fontSize: 13 }}>
                    ในระหว่างระยะเวลากิจกรรมหากมีการใช้งานเกินระดับมาตรฐานที่กำหนด ระบบจะมีการแจ้งเตือนก่อนเสมอ เพื่อให้ระบบทำงานได้ต่อไป
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer (intentionally outside .lp-wrap so it can span the full width) ── */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-brand-col">
            <div className="lp-footer-company">บริษัท โคเดรา โซลูชันส์ จำกัด</div>
            <div className="lp-footer-company-en">Codera Solutions Company Limited</div>
            <div className="lp-footer-address">2823/3 ถนนเจริญกรุง แขวงบางคอแหลม เขตบางคอแหลม กรุงเทพมหานคร 10120</div>
            <p>ปรึกษาก่อนได้ ไม่คิดค่าใช้จ่าย ทุกโจทย์เราตีราคาให้ พร้อมบอกว่าใช้เวลาเท่าไร</p>
          </div>
          <div className="lp-footer-contact-col">
            <span className="lp-footer-col-title">ติดต่อเรา</span>
            <span className="mono"><span className="text-muted">LINE ID:</span> {LINE_ID}</span>
            <a href="mailto:codracorp@gmail.com" className="lp-footer-email"><span className="text-muted">Email:</span> codracorp@gmail.com</a>
            <button onClick={openLineAdd} className="lp-btn lp-btn-green">ทักเราในไลน์</button>
            <span className="lp-footer-contact-hours">จันทร์-ศุกร์ 10:00-19:00 · ตอบภายใน 1 ชั่วโมง</span>
          </div>
        </div>
        <div className="lp-footer-inner">
          <div className="lp-footer-links">
            <a href="privacy.html">นโยบายความเป็นส่วนตัว</a>
            <a href="terms.html">ข้อกำหนดการใช้งาน</a>
          </div>
        </div>
      </footer>

      {qrOpen && <QRModal onClose={() => setQrOpen(false)} />}
    </>
  )
}
