const SB = 'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz';

export interface ArchData {
  card: string;
  en: string;
  th: string;
  short: string;
  desc: string;
}

export const ARCH: Record<string, ArchData> = {
  chill: { card: `${SB}/axis-01-chiller-v2.png`, en: 'THE ZEN',        th: 'สายปลง',        short: 'จะเป็นไงก็เป็น',          desc: 'ไม่ตื่นเต้น ไม่บ่น ไม่แย่งใคร รอดมาได้เพราะไม่เคยตัดสินใจอะไรผิด (เพราะไม่เคยตัดสินใจ)' },
  mu:    { card: `${SB}/axis-02-mystic-v2.png`,  en: 'THE MYSTIC',     th: 'สายมู',          short: 'เช็คดวงก่อนตัดสินใจ',    desc: 'ออกเดินทางต้องดูฤกษ์ กินข้าวต้องแบ่งไหว้ ไม่ได้ขี้กลัว แค่ขอความมั่นใจจากจักรวาลหน่อย' },
  live:  { card: `${SB}/axis-03-influencer-v2.png`, en: 'THE STREAMER',th: 'สายไลฟ์สด',    short: 'อัดไว้ก่อน รอดค่อยว่ากัน', desc: 'โลกจะแตกก็ต้องมีคนบันทึก อย่างน้อยคนรุ่นหลังจะได้รู้ว่ามันเกิดอะไรขึ้น (ถ้ามีคนรุ่นหลัง)' },
  prep:  { card: `${SB}/axis-04-prepper-v2.png`, en: 'THE PREPPER',    th: 'สายเตรียมพร้อม', short: 'มีของครบ ยกไม่ไหวเอง',    desc: 'กระเป๋าหนัก 20 กิโล มีทุกอย่างที่ต้องใช้และอีก 40 อย่างที่ไม่ได้ใช้ คนอื่นรอดเพราะคุณ' },
  line:  { card: `${SB}/axis-05-analyst-v2.png`, en: 'THE GROUPCHAT',  th: 'สายไลน์กลุ่ม',  short: 'ส่งต่อทุกอย่างที่อ่านมา', desc: 'หวังดีที่สุดในกลุ่ม ส่งวิธีเอาตัวรอดมาให้ 47 วิธี ถูกอยู่ประมาณ 3 วิธี' },
};

// Default fallback card when axis is unknown
export const DEFAULT_CARD = ARCH.prep.card;

interface ResultRow { a: string; b: string; rank: number; survival: string; reason: string }
const RESULTS_RAW: ResultRow[] = [
  { a:'chill',b:'prep', rank:1,  survival:'1 ปี 2 เดือน', reason:'คนนึงทำทุกอย่าง อีกคนไม่บ่นสักคำ ตลอดทั้งปีไม่มีใครทะเลาะกันเลย' },
  { a:'mu',   b:'prep', rank:2,  survival:'8 เดือน',      reason:'คนนึงเตรียมของ คนนึงเตรียมใจ ไปได้ไกลมาก เสียแค่ทุกการตัดสินใจต้องรอเช็คดวงก่อน' },
  { a:'live', b:'prep', rank:3,  survival:'6 เดือน',      reason:'คนนึงหาของ คนนึงหากล้อง แต่บันทึกไว้ครบทุกวัน อย่างน้อยโลกจะได้รู้ว่าเกิดอะไรขึ้น' },
  { a:'chill',b:'chill',rank:4,  survival:'6 เดือน',      reason:'ไม่หาอะไรกิน ไม่หาที่หลบ ไม่ทะเลาะ นอนอยู่เฉยๆ จนมีคนมาเจอพอดี รอดแบบไม่ได้ตั้งใจ' },
  { a:'chill',b:'mu',   rank:5,  survival:'3 สัปดาห์',   reason:'ไม่มีใครทำอะไรเลย แต่ก็ไม่มีใครทำอะไรผิดเหมือนกัน' },
  { a:'line', b:'prep', rank:6,  survival:'11 วัน',       reason:'เตรียมของมาครบ แล้วโดนเกลี้ยกล่อมให้ทิ้งหมดเพราะอ่านมาว่ามีสารตกค้าง' },
  { a:'chill',b:'live', rank:7,  survival:'9 วัน',        reason:'คนนึงถ่าย คนนึงไม่สนกล้องเลย ได้คอนเทนต์ดีที่สุดในบรรดาทุกคู่ แต่ก็แค่นั้น' },
  { a:'live', b:'mu',   rank:8,  survival:'5 วัน',        reason:'ไลฟ์พิธีขอฝน คนดู 12 คน ฝนไม่ตก แต่ยอดวิวขึ้น' },
  { a:'chill',b:'line', rank:9,  survival:'5 วัน',        reason:'คนนึงส่งวิธีเอาตัวรอดมาให้ 47 วิธี อีกคนไม่ได้อ่านสักอัน' },
  { a:'prep', b:'prep', rank:10, survival:'4 วัน',        reason:'กระเป๋าสองใบหนักรวม 40 กิโล เดินไม่ไหวทั้งคู่ นั่งอยู่ข้างกระเป๋าที่มีทุกอย่าง' },
  { a:'mu',   b:'mu',   rank:11, survival:'2 วัน',        reason:'เสียเวลาวันครึ่งไปกับการหาฤกษ์ออกเดินทาง ฤกษ์ดีที่สุดคือวันที่น้ำหมดพอดี' },
  { a:'line', b:'live', rank:12, survival:'40 ชั่วโมง',  reason:'ทำคลิปสอนวิธีเอาตัวรอดจากข้อมูลที่ผิดทั้งหมด มีคนทำตาม 200 คน' },
  { a:'line', b:'mu',   rank:13, survival:'30 ชั่วโมง',  reason:'เชื่อว่าน้ำต้มใบไม้แก้ได้ทุกอย่าง ใบไม้นั้นไม่ควรต้ม' },
  { a:'live', b:'live', rank:14, survival:'19 ชั่วโมง',  reason:'แย่งกันเป็นคนถ่าย ไม่มีใครยอมเป็นคนหาน้ำ แบตหมดพร้อมกันตอนเที่ยงคืน' },
  { a:'line', b:'line', rank:15, survival:'12 ชั่วโมง',  reason:'ส่งข้อมูลผิดให้กันไปมาจนมั่นใจว่าถูก แล้วเดินไปทางตรงข้ามกับทางออกพอดี' },
];

export interface PairResultData { rank: number; survival: string; reason: string }

export function getPairResult(a: string, b: string): PairResultData {
  const row = RESULTS_RAW.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  return row ? { rank: row.rank, survival: row.survival, reason: row.reason }
             : { rank: 15, survival: '12 ชั่วโมง', reason: '' };
}

export function getBestWorstFor(axisId: string): { bestTh: string; bestSurvival: string; worstTh: string; worstSurvival: string } {
  const mine = RESULTS_RAW
    .filter(r => r.a === axisId || r.b === axisId)
    .map(r => ({ partner: r.a === axisId ? r.b : r.a, rank: r.rank, survival: r.survival }))
    .sort((a, b) => a.rank - b.rank);
  const best  = mine[0];
  const worst = mine[mine.length - 1];
  return {
    bestTh:      ARCH[best?.partner]?.th      || '',
    bestSurvival: best?.survival  || '',
    worstTh:     ARCH[worst?.partner]?.th     || '',
    worstSurvival: worst?.survival || '',
  };
}

// Get axis card image: prefer config axes image_url, fall back to ARCH default
export function getAxisCard(
  axisId: string,
  configAxes?: Array<{ id: string; image_url?: string }>,
): string {
  const fromCfg = configAxes?.find(a => a.id === axisId)?.image_url;
  return fromCfg || ARCH[axisId]?.card || DEFAULT_CARD;
}

// Fuzzy-find axis id from Thai label or EN name
export function findAxisId(label: string): string | undefined {
  return Object.keys(ARCH).find(id =>
    ARCH[id].th === label || ARCH[id].en === label || ARCH[id].en.toLowerCase() === label?.toLowerCase()
  );
}
