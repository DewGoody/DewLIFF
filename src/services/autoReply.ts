import { db } from '../db/client.js';
import { replyMessage } from './line.js';
import { env } from '../env.js';
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

/**
 * Handle incoming text message — match keywords from DB and reply.
 * Uses replyToken (FREE).
 */
export async function handleTextMessage(replyToken: string, text: string): Promise<boolean> {
  const normalised = text.trim().toLowerCase();
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
