import { getConfig } from '../config/loader.js';
import { pushMessage } from './line.js';
import { env } from '../env.js';
import type { LineMessage } from './line.js';
import type { CampaignConfig, ResultRule } from '../config/schema.js';

function liffUrl(campaignId: string, params?: Record<string, string>): string {
  const base = `${env().LIFF_URL}/quiz/${campaignId}`;
  if (!params) return base;
  return base + '?' + new URLSearchParams(params).toString();
}

/** Flex card สำหรับแจ้ง partner ว่า "คู่หูตอบแล้ว มาดูผล" */
export function buildPartnerDoneMessages(
  cfg: CampaignConfig,
  campaignId: string,
  pairId: string,
): LineMessage[] {
  const msg = cfg.messages['partner_done'];
  if (!msg) return [];

  return [
    {
      type: 'flex',
      altText: msg.slots['title'] ?? 'คู่หูตอบแล้ว',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: msg.slots['title'] ?? 'คู่หูตอบแล้ว', weight: 'bold', size: 'lg' },
            { type: 'text', text: msg.slots['body'] ?? '', wrap: true, margin: 'md', color: '#888888', size: 'sm' },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: { type: 'uri', label: msg.slots['cta'] ?? 'ดูผลลัพธ์', uri: liffUrl(campaignId, { pairId }) },
              style: 'primary',
              color: cfg.brand.primary,
            },
          ],
        },
      },
    },
  ];
}

/** Rich Flex card ผลลัพธ์ — push เข้า chat ให้ user เก็บไว้ + forward ได้ */
export function buildResultCardMessages(
  cfg: CampaignConfig,
  campaignId: string,
  result: ResultRule,
  opts: {
    pairId?: string;
    typeCode?: string;
    axisMe?: string;
    axisBuddy?: string;
  },
): LineMessage[] {
  const isSolo = cfg.mode === 'solo';
  const eyebrow = cfg.copy?.['result_eyebrow'] || (isSolo ? 'คุณคือ' : 'คุณสองคนคือ');

  // Axis labels
  const axLabels: string[] = [];
  if (opts.typeCode) {
    axLabels.push(opts.typeCode);
  }
  if (opts.axisMe) {
    const ax = cfg.axes.find(a => a.id === opts.axisMe);
    if (ax) axLabels.push('คุณ · ' + ax.label);
  }
  if (opts.axisBuddy) {
    const ax = cfg.axes.find(a => a.id === opts.axisBuddy);
    if (ax) axLabels.push('คู่หู · ' + ax.label);
  }

  // Build body contents
  const bodyContents: Record<string, unknown>[] = [];

  // Hero image
  if (result.image_url) {
    bodyContents.push({
      type: 'image',
      url: result.image_url,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    });
  }

  // Eyebrow
  bodyContents.push({
    type: 'text',
    text: eyebrow,
    size: 'xs',
    color: '#888888',
    ...(result.image_url ? { margin: 'md' } : {}),
  });

  // Title
  bodyContents.push({
    type: 'text',
    text: result.title,
    weight: 'bold',
    size: 'xl',
    color: cfg.brand.primary,
    margin: 'sm',
  });

  // Body
  if (result.body) {
    bodyContents.push({
      type: 'text',
      text: result.body,
      wrap: true,
      margin: 'md',
      size: 'sm',
      color: '#666666',
    });
  }

  // Axis tags
  if (axLabels.length > 0) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'lg',
      spacing: 'sm',
      contents: axLabels.map(label => ({
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: label, size: 'xs', color: cfg.brand.primary, align: 'center' }],
        paddingAll: '6px',
        borderWidth: '1px',
        borderColor: cfg.brand.primary,
        cornerRadius: '99px',
      })),
    });
  }

  // Footer buttons
  const footerContents: Record<string, unknown>[] = [
    {
      type: 'button',
      action: {
        type: 'uri',
        label: cfg.copy?.['result_share_cta'] || 'ชวนเพื่อนเล่น',
        uri: liffUrl(campaignId),
      },
      style: 'primary',
      color: cfg.brand.primary,
    },
  ];

  // "ดูผลอีกครั้ง" button for pair mode
  if (opts.pairId) {
    footerContents.push({
      type: 'button',
      action: {
        type: 'uri',
        label: 'ดูผลอีกครั้ง',
        uri: liffUrl(campaignId, { pairId: opts.pairId }),
      },
      style: 'secondary',
    });
  }

  return [
    {
      type: 'flex',
      altText: `${eyebrow} ${result.title}`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: bodyContents,
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: footerContents,
        },
      },
    },
  ];
}

/** Push partner done notification (นับ quota) */
export async function sendPartnerDonePush(
  userId: string,
  campaignId: string,
  pairId: string,
): Promise<void> {
  const cfg = await getConfig(campaignId);
  const messages = buildPartnerDoneMessages(cfg, campaignId, pairId);
  if (messages.length > 0) {
    await pushMessage(userId, messages);
  }
}

/** Push result card เข้า chat ของ user (นับ quota) */
export async function sendResultCard(
  userId: string,
  campaignId: string,
  result: ResultRule,
  opts: {
    pairId?: string;
    typeCode?: string;
    axisMe?: string;
    axisBuddy?: string;
  },
): Promise<void> {
  const cfg = await getConfig(campaignId);
  const messages = buildResultCardMessages(cfg, campaignId, result, opts);
  if (messages.length > 0) {
    await pushMessage(userId, messages);
  }
}
