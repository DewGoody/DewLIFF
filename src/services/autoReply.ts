import { db } from '../db/client.js';
import { replyMessage } from './line.js';
import { env, getAppBaseUrl } from '../env.js';
import type { LineMessage } from './line.js';

/**
 * Build Flex card that opens a LIFF campaign.
 */
function campaignCard(
  campaignId: string,
  brandName: string,
  introBody: string,
  introCta: string,
  primary: string,
): LineMessage {
  const liffUrl = `${env().LIFF_URL}/quiz/${campaignId}`;
  return {
    type: 'flex',
    altText: brandName,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: brandName, weight: 'bold', size: 'xl' },
          { type: 'text', text: introBody, wrap: true, margin: 'md', size: 'sm', color: '#888888' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: introCta, uri: liffUrl },
            style: 'primary',
            color: primary || '#FF3D8B',
          },
        ],
      },
    },
  };
}

type CachedRule = {
  keyword: string;
  reply_type: string;
  reply_text: string | null;
  reply_flex: unknown | null;
  campaign_id: string | null;
};

type CachedCampaign = {
  brandName: string;
  introBody: string;
  introCta: string;
  primary: string;
};

let cachedRules: CachedRule[] | null = null;
let cachedCampaigns: Map<string, CachedCampaign> = new Map();
let cachedAt = 0;

async function loadRules(): Promise<void> {
  // Load keyword rules from DB
  const { data: rules } = await db()
    .from('keyword_rules')
    .select('keyword, campaign_id, reply_type, reply_text, reply_flex')
    .eq('enabled', true)
    .order('priority', { ascending: false });

  cachedRules = rules || [];

  // Load campaign info for flex_campaign rules
  const campaignIds = [...new Set(cachedRules.filter(r => r.campaign_id).map(r => r.campaign_id!))];
  cachedCampaigns = new Map();

  for (const cid of campaignIds) {
    try {
      const { data: camp } = await db()
        .from('campaigns')
        .select('current_version')
        .eq('id', cid)
        .single();

      if (!camp) continue;

      const { data: ver } = await db()
        .from('campaign_versions')
        .select('config')
        .eq('campaign_id', cid)
        .eq('version', camp.current_version)
        .single();

      if (!ver?.config) continue;

      const cfg = ver.config as Record<string, unknown>;
      const brand = cfg.brand as Record<string, string> | undefined;
      const copy = cfg.copy as Record<string, string> | undefined;

      cachedCampaigns.set(cid, {
        brandName: brand?.name || cid,
        introBody: copy?.intro_body || 'มาเล่นกัน!',
        introCta: copy?.intro_cta || 'เริ่มเลย',
        primary: brand?.primary || '#FF3D8B',
      });
    } catch (e) {
      // skip
    }
  }

  cachedAt = Date.now();
}

async function getRules(): Promise<CachedRule[]> {
  if (!cachedRules || Date.now() - cachedAt > 60_000) {
    await loadRules();
  }
  return cachedRules || [];
}

/** Clear cache — call after admin updates keywords */
export function clearAutoReplyCache(): void {
  cachedRules = null;
  cachedAt = 0;
}

/**
 * Build reply message for a matched rule.
 */
function buildReply(rule: CachedRule): LineMessage | null {
  switch (rule.reply_type) {
    case 'text':
      if (!rule.reply_text) return null;
      return { type: 'text', text: rule.reply_text };

    case 'flex_campaign': {
      if (!rule.campaign_id) return null;
      const camp = cachedCampaigns.get(rule.campaign_id);
      if (!camp) return null;
      return campaignCard(rule.campaign_id, camp.brandName, camp.introBody, camp.introCta, camp.primary);
    }

    case 'flex_custom':
      if (!rule.reply_flex) return null;
      return { type: 'flex', altText: 'ข้อความ', contents: rule.reply_flex } as LineMessage;

    default:
      return null;
  }
}

// DewLIFF is its own separate Vercel deployment from KimLIFF's — never hardcode
// KimLIFF's own domain here. getAppBaseUrl() self-configures (see src/env.ts).
const DEMO_URL = `${getAppBaseUrl()}/demo`;

function buildDemoCard(): LineMessage {
  return {
    type: 'flex',
    altText: 'ดู Demo LINE Quiz 3 ระดับ — Solo / Duo / Team',
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md',
        backgroundColor: '#FFFDF6',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center',
            contents: [
              { type: 'text', text: 'B2B DEMO', size: 'xxs', weight: 'bold', color: '#E8354F', flex: 0 },
              { type: 'text', text: '· 3 TIERS', size: 'xxs', color: '#8A857B', flex: 0, margin: 'sm' },
            ],
          },
          { type: 'text', text: 'ระบบ LINE Quiz', weight: 'bold', size: 'xl', color: '#1C1A17', wrap: true },
          { type: 'text', text: 'ที่ผู้ใช้อยากแชร์ต่อเอง', size: 'sm', color: '#6E6A62', wrap: true },
          { type: 'separator', margin: 'sm', color: 'rgba(28,26,23,.12)' },
          {
            type: 'box', layout: 'vertical', spacing: 'sm',
            contents: [
              {
                type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center',
                contents: [
                  { type: 'box', layout: 'vertical', flex: 0, width: '36px', height: '36px', backgroundColor: '#F5E14B', cornerRadius: '8px', justifyContent: 'center', alignItems: 'center', contents: [{ type: 'text', text: '01', size: 'xxs', weight: 'bold', align: 'center', color: '#1C1A17' }] },
                  { type: 'box', layout: 'vertical', flex: 1, contents: [
                    { type: 'text', text: 'Solo Quiz', weight: 'bold', size: 'sm', color: '#1C1A17' },
                    { type: 'text', text: 'รู้จักตัวเอง · แชร์ผล · organic reach', size: 'xxs', color: '#8A857B', wrap: true },
                  ]},
                ],
              },
              {
                type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center',
                contents: [
                  { type: 'box', layout: 'vertical', flex: 0, width: '36px', height: '36px', backgroundColor: '#F5E14B', cornerRadius: '8px', justifyContent: 'center', alignItems: 'center', contents: [{ type: 'text', text: '02', size: 'xxs', weight: 'bold', align: 'center', color: '#1C1A17' }] },
                  { type: 'box', layout: 'vertical', flex: 1, contents: [
                    { type: 'text', text: 'Duo Quiz', weight: 'bold', size: 'sm', color: '#1C1A17' },
                    { type: 'text', text: 'จับคู่เพื่อน · viral loop · ผลที่แชร์ได้', size: 'xxs', color: '#8A857B', wrap: true },
                  ]},
                ],
              },
              {
                type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center',
                contents: [
                  { type: 'box', layout: 'vertical', flex: 0, width: '36px', height: '36px', backgroundColor: '#F5E14B', cornerRadius: '8px', justifyContent: 'center', alignItems: 'center', contents: [{ type: 'text', text: '03', size: 'xxs', weight: 'bold', align: 'center', color: '#1C1A17' }] },
                  { type: 'box', layout: 'vertical', flex: 1, contents: [
                    { type: 'text', text: 'Team Quiz', weight: 'bold', size: 'sm', color: '#1C1A17' },
                    { type: 'text', text: 'สร้างทีม · retention · community moment', size: 'xxs', color: '#8A857B', wrap: true },
                  ]},
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: '#FFFDF6',
        contents: [{
          type: 'button',
          action: { type: 'uri', label: 'ดู Demo ทั้ง 3 ระดับ →', uri: DEMO_URL },
          style: 'primary', color: '#E8354F', height: 'sm',
        }],
      },
    },
  } as LineMessage;
}

/**
 * Handle incoming text message — match keywords from DB and reply.
 * Uses replyToken (FREE).
 */
export async function handleTextMessage(replyToken: string, text: string): Promise<boolean> {
  const normalised = text.trim().toLowerCase();

  // Hardcoded "demo" keyword — always available without DB entry
  if (normalised === 'demo' || normalised.startsWith('demo ')) {
    await replyMessage(replyToken, [buildDemoCard()]);
    return true;
  }

  const rules = await getRules();

  for (const rule of rules) {
    if (normalised.includes(rule.keyword)) {
      const msg = buildReply(rule);
      if (msg) {
        await replyMessage(replyToken, [msg]);
        return true;
      }
    }
  }

  return false;
}

/**
 * Get welcome message from settings.
 */
export async function getWelcomeMessage(): Promise<string> {
  try {
    const { data } = await db()
      .from('oa_settings')
      .select('value')
      .eq('key', 'welcome_message')
      .single();

    if (data?.value?.text) return data.value.text;
  } catch (e) {
    // fallback
  }
  return 'ยินดีต้อนรับ! 🎯\nพิมพ์ "ควิซ" เพื่อเริ่มเล่น';
}
