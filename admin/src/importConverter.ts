/**
 * Converts the "schema_version: 1.0" campaign format (archetypes / weights / pair_key / survival_display)
 * into the internal CampaignConfig format that the editor understands.
 */
import type { CampaignConfig } from './types';

interface SchemaV1Option {
  id: string;
  label: string;
  weights: Record<string, number>;
}

interface SchemaV1Question {
  id: string;
  order: number;
  text: string;
  options: SchemaV1Option[];
}

interface SchemaV1Archetype {
  id: string;
  order: number;
  name: string;
  tagline?: string;
  description?: string;
}

interface SchemaV1Result {
  pair_key: string;
  rank: number;
  survival_display: string;
  survival_hours?: number;
  reason: string;
}

interface SchemaV1Campaign {
  id?: string;
  name?: string;
  mode?: string;
  brand?: string;
}

interface SchemaV1 {
  schema_version: string;
  campaign?: SchemaV1Campaign;
  archetypes?: SchemaV1Archetype[];
  questions?: SchemaV1Question[];
  results?: SchemaV1Result[];
}

export function isSchemaV1(data: unknown): data is SchemaV1 {
  return (
    typeof data === 'object' &&
    data !== null &&
    'schema_version' in data &&
    (data as Record<string, unknown>).schema_version === '1.0'
  );
}

export function convertSchemaV1ToCampaignConfig(raw: SchemaV1, campaignId: string): CampaignConfig {
  const totalPairs = raw.results?.length ?? 0;

  // ── axes (from archetypes) ──────────────────────────────
  const axes = (raw.archetypes ?? [])
    .sort((a, b) => a.order - b.order)
    .map((arch) => ({
      id: arch.id,
      label: arch.name,
    }));

  // ── questions (rename weights → scores) ────────────────
  const questions = (raw.questions ?? [])
    .sort((a, b) => a.order - b.order)
    .map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        scores: { ...o.weights },
      })),
    }));

  // ── results (pair_key + survival_display + rank → title/body) ──
  const results: CampaignConfig['results'] = (raw.results ?? []).map((r) => {
    const parts = r.pair_key.split('|');
    const pair: [string, string] | undefined =
      parts.length === 2 ? [parts[0], parts[1]] : undefined;

    const title = `เรารอดได้ ${r.survival_display}`;
    const rankLine = `อันดับที่ ${r.rank} จาก ${totalPairs} คู่`;
    const body = `${rankLine}\n\n${r.reason}`;

    return {
      code: r.pair_key,
      ...(pair ? { pair } : {}),
      title,
      body,
    };
  });

  // Fallback = last result (lowest rank = easiest to get / most generic)
  const fallbackCode = results[results.length - 1]?.code ?? 'balanced';

  // ── brand ───────────────────────────────────────────────
  const brandName =
    raw.campaign?.name || raw.campaign?.brand || 'แคมเปญ';

  return {
    id: campaignId,
    type: 'buddy_quiz',
    mode: (raw.campaign?.mode as 'pair' | 'solo') ?? 'pair',
    version: 1,
    brand: {
      name: brandName,
      primary: '#E63B2E',
      surface: '#1B1B1B',
      on_surface: '#FFFFFF',
    },
    copy: {
      intro_title: brandName,
      intro_body: 'ตอบ ' + questions.length + ' ข้อ แล้วชวนเพื่อนมาตอบ จะได้รู้ว่าเรารอดกี่วัน',
      intro_cta: 'เริ่มตอบ',
      demo_cta: 'ลองกับคู่หูตัวอย่าง',
      question_counter: 'ข้อ {current} จาก {total}',
      invited_title: '{inviter} ชวนคุณมาตอบ',
      invited_cta: 'ตอบเลย',
      share_title: 'ส่งให้เพื่อนตอบ',
      share_cta: 'เลือกเพื่อนแล้วส่ง',
      waiting_title: 'รอเพื่อนตอบอยู่',
      waiting_close: 'ปิดหน้าต่าง',
      result_eyebrow: 'เรารอดได้',
      result_share_cta: 'อวดผลให้คนอื่น',
      friend_gate_title: 'เพิ่มเพื่อนก่อนดูผล',
      expired_title: 'คำเชิญหมดอายุแล้ว',
      limit_title: 'วันนี้ครบโควตาแล้ว',
    },
    axes,
    questions,
    results,
    fallback_result: fallbackCode,
    rules: {
      invite_ttl_hours: 48,
      require_friend: true,
      max_pairs_per_user_per_day: 10,
      allow_self_pair: false,
    },
    messages: {
      invite: {
        template: 'invite_v1',
        slots: {
          title: '{inviter} ชวนคุณเอาตัวรอด',
          body: 'มาดูกันว่าเราสองคนจะรอดกี่วัน',
          cta: 'ตอบเลย',
        },
      },
      partner_done: {
        template: 'notify_v1',
        slots: {
          title: '{partner} ตอบแล้ว ดูผลกัน',
          body: '',
          cta: 'ดูผลลัพธ์',
        },
      },
      welcome: {
        template: 'notify_v1',
        slots: { title: 'ยินดีต้อนรับ', body: '', cta: 'เริ่มเลย' },
      },
    },
  };
}
