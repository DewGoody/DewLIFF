/**
 * GET /join?campaignId=...&groupId=...
 *
 * Serves an HTML page with proper OG meta tags so LINE / social previews
 * show a rich card instead of a raw URL.  Immediately JS-redirects the
 * visitor into the LIFF app.
 */

import { Router } from 'express';
import { getConfig } from '../config/loader.js';

export const joinRouter = Router();

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

joinRouter.get('/', async (req, res) => {
  const campaignId = String(req.query.campaignId ?? '');
  const groupId    = String(req.query.groupId    ?? '');

  // Defaults used when campaign config can't be fetched
  let brandName    = 'APOCALYPSE SQUAD';
  let liffId       = '';
  let ogImageUrl   = '';
  let pageTitle    = 'เข้าร่วมทีมวันสิ้นโลก';
  let pageDesc     = 'มาตอบคำถาม 6 ข้อ แล้วดูว่าทีมของคุณมีโอกาสรอดโลกหรือเปล่า';
  const origin     = `${req.protocol}://${req.get('host')}`;

  try {
    if (campaignId) {
      const cfg = await getConfig(campaignId);
      brandName  = cfg.brand?.name || brandName;
      liffId     = cfg.appearance?.liff_id || '';
      ogImageUrl = cfg.brand?.kv_image_url || '';
      pageTitle  = `เข้าร่วมทีม ${brandName}`;
      pageDesc   = cfg.copy?.join_og_desc || pageDesc;
    }
  } catch { /* use defaults */ }

  // Build redirect URL:
  // 1. LIFF_URL env var (set on dev to override to dev endpoint)
  // 2. liff_id from campaign config → liff.line.me deep-link (prod)
  // 3. fallback to same-origin /liff-app/
  const envLiffUrl = process.env.LIFF_URL?.trim();
  const liffBase   = envLiffUrl || (liffId ? `https://liff.line.me/${liffId}` : `${origin}/liff-app/`);
  const params     = new URLSearchParams({ campaignId, ...(groupId ? { groupId } : {}) });
  const redirectTo = `${liffBase}?${params.toString()}`;

  const ogImage = ogImageUrl || `${origin}/og-frames/pair.png`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(pageTitle)}</title>

  <!-- Open Graph -->
  <meta property="og:type"        content="website"/>
  <meta property="og:url"         content="${esc(`${origin}/join?campaignId=${campaignId}&groupId=${groupId}`)}"/>
  <meta property="og:title"       content="${esc(pageTitle)}"/>
  <meta property="og:description" content="${esc(pageDesc)}"/>
  <meta property="og:image"       content="${esc(ogImage)}"/>
  <meta property="og:image:width" content="1080"/>
  <meta property="og:image:height" content="1080"/>
  <meta property="og:site_name"   content="${esc(brandName)}"/>

  <!-- Twitter / fallback -->
  <meta name="twitter:card"        content="summary_large_image"/>
  <meta name="twitter:title"       content="${esc(pageTitle)}"/>
  <meta name="twitter:description" content="${esc(pageDesc)}"/>
  <meta name="twitter:image"       content="${esc(ogImage)}"/>

  <!-- LINE LIFF redirect -->
  <script>window.location.replace(${JSON.stringify(redirectTo)});</script>
  <noscript><meta http-equiv="refresh" content="0;url=${esc(redirectTo)}"/></noscript>
</head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#F7F1E3;">
  <p style="color:#1C1A17;font-size:16px;">กำลังพาคุณเข้าสู่กิจกรรม…</p>
</body>
</html>`);
});
