import { useState } from 'react';
import { getAxisCard, findAxisId } from '../data';
import AddFriendNudge, { nudgeSeen } from './AddFriendNudge';
import { shareOrCopy } from '../shareUtils';
import { getScreenBlocks, resolveSrcText, floatStyle, scaleFont, getPatternDefaults, renderExtraBlock } from '../screenConfig';

interface Props {
  config: {
    brand?: { primary?: string };
    copy?: Record<string, string>;
    axes?: Array<{ id: string; label?: string; image_url?: string }>;
    results?: Array<unknown>;
    appearance?: { oa_id?: string; og_base_url?: string; font_scale?: number; art_hero?: 'pair' | 'single' | 'band'; screen_config?: Record<string, { blocks: any[] }> };
  };
  partnerName: string; title: string; body: string;
  imageUrl?: string; axisMe?: string; axisBuddy?: string;
  axisMeId?: string; axisBuddyId?: string;
  axisMeShort?: string; axisBuddyShort?: string;
  pairUrl?: string; inviteUrl?: string; myName?: string; isFriend?: boolean; onBack: () => void;
}

const DEFAULT_ORDER = ['hero2', 'resultCard', 'axisChips', 'shareRow'];

export default function PairResult({ config, partnerName, title, body, imageUrl, axisMe, axisBuddy, axisMeId: axisMeIdProp, axisBuddyId: axisBuddyIdProp, pairUrl, inviteUrl, myName, isFriend, onBack }: Props) {
  const copy = config.copy || {};
  const primary = config.brand?.primary || '#E8354F';
  const appearance = config.appearance || {};
  const [showNudge, setShowNudge] = useState(false);
  const [pendingShare, setPendingShare] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [shareStatus, setShareStatus] = useState<'idle' | 'sending' | 'error'>('idle');

  const handleCopyLink = async () => {
    const url = pairUrl || inviteUrl || window.location.href;
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };
  // Use server-provided axis IDs directly; fallback to label resolution only if missing
  const resolveAxisId = (label: string | undefined) => {
    if (!label) return undefined;
    return config.axes?.find((a: any) => a.id === label || a.label === label)?.id || findAxisId(label, config.axes) || label;
  };
  const axisMeId = axisMeIdProp || resolveAxisId(axisMe);
  const axisBuddyId = axisBuddyIdProp || resolveAxisId(axisBuddy);
  const eyebrowPrefix = copy.result_eyebrow || 'เรารอดได้';
  const survival = title.replace(new RegExp(`^${eyebrowPrefix}\\s*`), '') || title;
  // Strip any rank prefix from body (various formats)
  const reason = body.replace(/^อันดับที่\s*\d+\s*จาก\s*\d+\s*คู่[\s\S]*?\n\n?/, '').trim();

  const myCard = axisMeId ? getAxisCard(axisMeId, config.axes) : undefined;
  const buddyCard = axisBuddyId ? getAxisCard(axisBuddyId, config.axes) : undefined;
  const myArchName = axisMe ? (config.axes?.find(a => a.id === axisMeId)?.label || axisMe) : '';
  const buddyArchName = axisBuddy ? (config.axes?.find(a => a.id === axisBuddyId)?.label || axisBuddy) : '';

  // ── screen_config wiring: order / show / geo / float position / data source ──
  const { blockOrder, blockVisible, geo, pos, pat, src } = getScreenBlocks(appearance, 'PairResult', DEFAULT_ORDER);

  // resultCard/shareRow's primary text field can be bound to a real axis/result
  // value instead of typed manually — resolve against what THIS screen already
  // computed for this user (survival title, reason body), same idea as Intro.tsx.
  const srcCtx = { axes: config.axes, results: { title: survival, body: reason } };
  const badgeText = copy.pair_result_badge || resolveSrcText(src('resultCard', 'text'), srcCtx, copy) || 'คู่นี้รอดได้';
  const shareCtaText = copy.pair_share_cta || resolveSrcText(src('shareRow', 'text'), srcCtx, copy) || 'แชร์ผลไปไลน์';

  // 05 Art Style / 04 Shape & Feel global defaults — resolved once, fed into the
  // per-block pat() calls below as their fallback (instead of a hardcoded literal),
  // and into hero2's structural switch (pair/single/band).
  const artDefaults = getPatternDefaults(appearance);

  // hero2: h/tilt geometry + pair variant (tilt/side/overlap) — 'tilt' is today's
  // hardcoded arrangement (±8deg rotate, -34px overlap), so that's the fallback.
  const hero2Geo = geo('hero2');
  const heroH = Number(hero2Geo.h) || 280;
  const heroTiltDeg = Number(hero2Geo.tilt) || 8;
  const heroPat = pat('hero2', 'pair', artDefaults.pair);
  const artHero = artDefaults.artHero;

  // resultCard: pad/overlap geometry — today's hardcoded padding:16, marginTop:-24.
  const resultCardGeo = geo('resultCard');
  const resultPad = Number(resultCardGeo.pad) || 16;
  const resultOverlap = Number(resultCardGeo.overlap) || 24;

  // axisChips: dir geometry + chip variant (pill/soft/cut). Falls back to the
  // Art Style global's chip default — 'pill' (20px), matching the admin
  // builder's own per-block picker default (LiffSection.tsx's { chip:'pill' }
  // fallback) — so a campaign that never overrides axisChips' own pattern now
  // matches what the admin preview already shows. The 'soft' variant (only
  // reachable via an explicit per-block override) sources its radius straight
  // from the global Shape & Feel --axis-chip-radius CSS var (App.tsx always
  // sets it, defaulting to 11px — today's original hardcoded look).
  const axisChipsGeo = geo('axisChips');
  const axisChipsDir = (axisChipsGeo.dir as string) || 'row';
  const chipPat = pat('axisChips', 'chip', artDefaults.chip);
  const chipRadius: number | string = chipPat === 'pill' ? 20 : chipPat === 'cut' ? 2 : 'var(--axis-chip-radius)';

  // shareRow: dir geometry — today's hardcoded arrangement is a stacked column of buttons.
  const shareRowGeo = geo('shareRow');
  const shareRowDir = (shareRowGeo.dir as string) || 'column';

  const handleNativeShare = async () => {
    const ogBase = config.appearance?.og_base_url || (window.location.origin + '/api/og');
    const ogParams = new URLSearchParams({
      type: 'pair_card',
      survival,
      partnerName,
      myName: myName || copy.me || 'คุณ',
      ...(reason ? { body: reason } : {}),
      ...(myArchName ? { axisMeLabel: myArchName } : {}),
      ...(buddyArchName ? { axisBuddyLabel: buddyArchName } : {}),
      ...(myCard ? { cardMeUrl: myCard } : {}),
      ...(buddyCard ? { cardBuddyUrl: buddyCard } : {}),
      v: '3',
      t: String(Date.now()),
    });
    const imgUrl = `${ogBase}?${ogParams.toString()}`;
    try {
      const res = await fetch(imgUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const file = new File([blob], 'pair-result.png', { type: 'image/png' });
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: survival });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'pair-result.png'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* cancelled or unavailable */ }
  };

  const handleShareClick = () => {
    if (!isFriend && !nudgeSeen()) {
      setPendingShare(true);
      setShowNudge(true);
      return;
    }
    handleShare();
  };

  const handleNudgeDismiss = () => {
    setShowNudge(false);
    if (pendingShare) { setPendingShare(false); handleShare(); }
  };

  const handleShare = async () => {
    const url = pairUrl || window.location.href;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = liff as any;

    // Non-LINE browser fallback
    if (!liff.isInClient()) {
      const result = await shareOrCopy(url, survival);
      if (result !== 'failed') { setCopyStatus('copied'); setTimeout(() => setCopyStatus('idle'), 2000); }
      return;
    }

    // shareTargetPicker permission check
    if (typeof liffAny.isApiAvailable === 'function' && !liffAny.isApiAvailable('shareTargetPicker')) {
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 3000);
      return;
    }

    // Build OG hero image URL
    // Note: window.location.origin inside LINE LIFF = liff.line.me, so og_base_url must be set
    const base = config.appearance?.og_base_url;
    const ogParams = base ? new URLSearchParams({
      type: 'pair',
      survival,
      partnerName,
      ...(reason ? { body: reason } : {}),
      ...(myArchName ? { axisMeLabel: myArchName } : {}),
      ...(buddyArchName ? { axisBuddyLabel: buddyArchName } : {}),
      ...(myCard ? { cardMeUrl: myCard } : {}),
      ...(buddyCard ? { cardBuddyUrl: buddyCard } : {}),
    }) : null;
    const heroUrl = imageUrl || (base && ogParams ? `${base}?${ogParams.toString()}` : null);

    // Copy keys: FPAIR_* (from FlexCardSection admin) with legacy fallbacks
    const badge  = copy['FPAIR_eyebrow'] || copy.pair_result_badge || 'ผลคู่ของเรา';
    const cta1   = copy['FPAIR_cta1']    || copy.pair_result_cta   || 'ดูผลคู่แบบเต็ม';
    const cta2   = copy['FPAIR_cta2']    || copy.pair_invite_cta   || 'จับคู่กับฉันดู · ตอบ 1 นาที';

    // Chip rows — only include if data exists
    const chipContents: unknown[] = [];
    if (axisBuddy) chipContents.push({
      type: 'box', layout: 'vertical', flex: 1, borderWidth: '1px', borderColor: '#1C1A17', cornerRadius: '8px', paddingAll: '8px', backgroundColor: '#E6F1F5',
      contents: [
        { type: 'text', text: partnerName || ' ', size: 'xs', color: '#888888' },
        { type: 'text', text: buddyArchName || ' ', size: 'sm', weight: 'bold', color: '#1C1A17', wrap: true },
      ],
    });
    if (axisMe) chipContents.push({
      type: 'box', layout: 'vertical', flex: 1, borderWidth: '1px', borderColor: '#1C1A17', cornerRadius: '8px', paddingAll: '8px', backgroundColor: '#F5E14B',
      contents: [
        { type: 'text', text: myName || copy.me || 'คุณ', size: 'xs', color: '#888888' },
        { type: 'text', text: myArchName || ' ', size: 'sm', weight: 'bold', color: '#1C1A17', wrap: true },
      ],
    });

    // Body contents — skip empty text nodes (LINE rejects empty text)
    const bodyContents: unknown[] = [
      { type: 'box', layout: 'vertical', paddingAll: '4px', backgroundColor: '#F5E14B', cornerRadius: '4px', width: '90px',
        contents: [{ type: 'text', text: badge, size: 'xs', weight: 'bold', color: '#1C1A17', align: 'center' }] },
      { type: 'text', text: survival, weight: 'bold', size: 'xxl', color: '#1C1A17', margin: 'sm' },
      ...(reason ? [{ type: 'text', text: reason, size: 'sm', color: '#555555', wrap: true, margin: 'md' }] : []),
      ...(chipContents.length ? [{ type: 'separator', margin: 'md' }, { type: 'box', layout: 'horizontal', margin: 'md', spacing: 'sm', contents: chipContents }] : []),
    ];

    setShareStatus('sending');
    try {
      await liffAny.shareTargetPicker([{
        type: 'flex',
        altText: `${badge} ${survival}`.slice(0, 400),
        contents: {
          type: 'bubble',
          ...(heroUrl ? { hero: { type: 'image', url: heroUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } } : {}),
          body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px', contents: bodyContents },
          footer: {
            type: 'box', layout: 'vertical', spacing: 'sm',
            contents: [
              { type: 'button', action: { type: 'uri', label: cta1, uri: url }, style: 'primary', color: primary },
              ...(inviteUrl ? [{ type: 'button', action: { type: 'uri', label: cta2, uri: inviteUrl }, style: 'secondary' }] : []),
            ],
          },
        },
      }]);
      setShareStatus('idle');
    } catch (e) {
      console.error('[PairResult] shareTargetPicker error:', e);
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 3000);
    }
  };

  // ── Block renderers ────────────────────────────────────────────────────────

  // hero2's overall structure is gated on the global "05 Art Style" → Hero Style
  // field (art_hero): 'band' = plain color bar, no image at all; 'single' = one
  // centered image; 'pair' (default, no config) = today's two tilted cards.
  // Mirrors admin/src/components/sections/LiffSection.tsx renderBlockRows's
  // case 'hero2' (hero === 'band' ? ... : hero === 'single' ? ... : /* pair */).
  const renderHero2 = () => {
    if (artHero === 'band') {
      return (
        <div key="hero2" style={{ height: heroH, flexShrink: 0, position: 'relative', overflow: 'hidden', background: 'linear-gradient(#FCEFE0,#F7F1E3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '78%', height: 46, borderRadius: 'var(--radius)', background: primary }} />
        </div>
      );
    }
    if (artHero === 'single') {
      const singleCard = imageUrl || myCard || buddyCard;
      return (
        <div key="hero2" style={{ height: heroH, flexShrink: 0, position: 'relative', overflow: 'hidden', background: 'linear-gradient(#FCEFE0,#F7F1E3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {singleCard && (
            <div style={{ backgroundImage: `url('${singleCard}')`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', width: 200, height: '84%', filter: 'drop-shadow(3px 4px 0 rgba(28,26,23,.22))' }} />
          )}
        </div>
      );
    }
    // pair (default) — today's two tilted/side/overlap cards, per the hero2 'pair' variant
    const cardStyleBase = { backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', width: 160, height: '100%', filter: 'drop-shadow(3px 4px 0 rgba(28,26,23,.22))' } as React.CSSProperties;
    let buddyStyle: React.CSSProperties = { ...cardStyleBase, backgroundImage: `url('${buddyCard}')` };
    let myStyle: React.CSSProperties = { ...cardStyleBase, backgroundImage: `url('${myCard}')` };
    if (heroPat === 'side') {
      buddyStyle = { ...buddyStyle, marginRight: 8 };
    } else if (heroPat === 'overlap') {
      buddyStyle = { ...buddyStyle, marginRight: -60 };
    } else {
      // tilt (default) — cards lean toward each other
      buddyStyle = { ...buddyStyle, transform: `rotate(-${heroTiltDeg}deg)`, marginRight: -34 };
      myStyle = { ...myStyle, transform: `rotate(${heroTiltDeg}deg)`, marginLeft: -34 };
    }
    return (
      <div key="hero2" style={{ height: heroH, flexShrink: 0, position: 'relative', overflow: 'hidden', background: 'linear-gradient(#FCEFE0,#F7F1E3)' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 10, bottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {buddyCard && <div style={buddyStyle} />}
          {myCard && <div style={myStyle} />}
        </div>
      </div>
    );
  };

  // resultCard + axisChips share one physical card box today (chips sit inside
  // the card, flush with its padding) — so they're rendered together here to
  // stay pixel-identical by default, while each still respects its own
  // blockVisible/geo/pat independently. Whichever id comes first in blockOrder
  // "owns" the shared card's flow position.
  const cardOwnerId = blockOrder.find(id => id === 'resultCard' || id === 'axisChips');

  const renderCardGroup = () => {
    const showResultText = blockVisible('resultCard');
    const showChips = blockVisible('axisChips') && (axisBuddy || axisMe);
    if (!showResultText && !showChips) return null;
    return (
      <div key="resultCard" style={{ background: 'var(--card)', backgroundImage: 'var(--texture-bg)', border: 'var(--border)', borderRadius: 'var(--card-radius)', padding: resultPad, boxShadow: 'var(--shadow)', transform: 'rotate(calc(var(--tilt-deg, 0) * -1deg))' }}>
        {showResultText && (
          <>
            {/* Badge */}
            <div style={{ display: 'inline-block', background: 'var(--hl)', border: '2px solid var(--ink)', padding: '3px 10px', font: "700 11px/1.5 var(--font-body,'Bai Jamjuree'),sans-serif" }}>{badgeText}</div>
            {/* Survival — 38px Bangers spec */}
            <div style={{ fontFamily: "var(--font-display,'Bangers'),cursive", fontSize: scaleFont(38, config.appearance?.font_scale), lineHeight: 1.1, marginTop: 10, color: 'var(--ink)', letterSpacing: '.02em' }}>{survival}</div>
            <div style={{ font: "500 14px/1.7 var(--font-body,'Bai Jamjuree'),sans-serif", color: 'var(--ink2)', marginTop: 12 }}>{reason}</div>
          </>
        )}
        {showChips && (
          <div style={{ display: 'flex', flexDirection: axisChipsDir === 'column' ? 'column' : 'row', gap: 8, marginTop: showResultText ? 16 : 0 }}>
            {axisBuddy && (
              <div style={{ flex: 1, border: '2px solid var(--ink)', borderRadius: chipRadius, padding: 9, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {buddyCard && <div style={{ backgroundImage: `url('${buddyCard}')`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', width: 38, height: 52, flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "600 9.5px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'var(--ink2)' }}>{partnerName}</div>
                  <div style={{ font: "700 12px var(--font-body,'Bai Jamjuree'),sans-serif", marginTop: 2, whiteSpace: 'nowrap' }}>{buddyArchName}</div>
                </div>
              </div>
            )}
            {axisMe && (
              <div style={{ flex: 1, border: '2px solid var(--ink)', borderRadius: chipRadius, padding: 9, background: 'var(--hl)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {myCard && <div style={{ backgroundImage: `url('${myCard}')`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', width: 38, height: 52, flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "600 9.5px var(--font-body,'Bai Jamjuree'),sans-serif", color: 'var(--ink2)' }}>{myName || copy.me || 'คุณ'}</div>
                  <div style={{ font: "700 12px var(--font-body,'Bai Jamjuree'),sans-serif", marginTop: 2, whiteSpace: 'nowrap' }}>{myArchName}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderShareRow = () => {
    if (!blockVisible('shareRow')) return null;
    const isRow = shareRowDir === 'row';
    return (
      <div key="shareRow" style={{ marginTop: 24, display: 'flex', flexDirection: isRow ? 'row' : 'column', flexWrap: isRow ? 'wrap' : 'nowrap', gap: isRow ? 10 : 0 }}>
        <button
          onClick={handleShareClick}
          disabled={shareStatus === 'sending'}
          style={{ width: isRow ? undefined : '100%', flex: isRow ? '1 1 45%' : undefined, padding: '15px 20px', background: shareStatus === 'error' ? 'var(--danger)' : 'var(--line)', color: '#fff', border: 'var(--border)', borderRadius: 'var(--radius)', font: "700 17px/1 var(--font-body,'Bai Jamjuree'),sans-serif", cursor: shareStatus === 'sending' ? 'default' : 'pointer', boxShadow: 'var(--shadow)', opacity: shareStatus === 'sending' ? .7 : 1 }}
        >{shareStatus === 'sending' ? (copy.pair_share_sending || 'กำลังส่ง...') : shareStatus === 'error' ? (copy.pair_share_error || 'ส่งไม่ได้ ลองใหม่') : shareCtaText}</button>
        <button
          onClick={handleNativeShare}
          style={{ width: isRow ? undefined : '100%', flex: isRow ? '1 1 45%' : undefined, padding: '13px 20px', background: 'var(--card)', color: 'var(--ink)', border: 'var(--border)', borderRadius: 'var(--radius)', font: "700 15px/1 var(--font-body,'Bai Jamjuree'),sans-serif", cursor: 'pointer', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: isRow ? 0 : 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          {copy.pair_native_share_btn || 'แชร์ผลคู่นี้'}
        </button>
        <button
          onClick={handleCopyLink}
          style={{ width: isRow ? undefined : '100%', flex: isRow ? '1 1 45%' : undefined, padding: '13px 20px', background: 'var(--card)', color: copyStatus === 'copied' ? 'var(--line)' : 'var(--ink)', border: 'var(--border)', borderRadius: 'var(--radius)', font: "700 15px/1 var(--font-body,'Bai Jamjuree'),sans-serif", cursor: 'pointer', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: isRow ? 0 : 10 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {copyStatus === 'copied' ? (copy.copy_link_done || '✓ คัดลอกแล้ว') : (copy.copy_link_btn || 'คัดลอกลิงก์เชิญ')}
        </button>
        <button
          onClick={onBack}
          style={{ width: isRow ? undefined : '100%', flex: isRow ? '1 1 100%' : undefined, padding: '11px 16px', background: 'transparent', border: 'none', color: 'var(--ink2)', font: "600 13px/1 var(--font-body,'Bai Jamjuree'),sans-serif", cursor: 'pointer', marginTop: isRow ? 0 : 6 }}
        >{copy.pair_back_btn || 'ดูผลของฉัน'}</button>
      </div>
    );
  };

  const RENDERERS: Record<string, () => React.ReactNode> = {
    hero2: renderHero2,
    resultCard: cardOwnerId === 'resultCard' ? renderCardGroup : () => null,
    axisChips: cardOwnerId === 'axisChips' ? renderCardGroup : () => null,
    shareRow: renderShareRow,
  };
  for (const xid of ['xImage', 'xText', 'xSpacer', 'xDivider', 'xBox', 'xCard', 'xRow', 'xChip']) {
    RENDERERS[xid] = () => renderExtraBlock(xid, {
      geo: geo(xid), copy, images: (appearance as { images?: Record<string, string> })?.images, fontScale: appearance?.font_scale,
      srcText: src(xid, 'text'), textCtx: srcCtx,
      srcList: src(xid, 'list'), listCtx: { axes: config.axes },
    });
  }

  // ── Build output ──────────────────────────────────────────────────────────

  const visible = blockOrder.filter(blockVisible);
  const flowIds = visible.filter(id => !pos(id));
  const floatIds = visible.filter(id => pos(id));

  // hero2 is always full-bleed outside the padded wrapper; the rest live inside it.
  const topIds = flowIds.filter(id => id === 'hero2');
  const bodyIds = flowIds.filter(id => id !== 'hero2');

  return (
    <div className="screen fade-enter" style={{ background: 'var(--bg)', overflowY: 'auto', position: floatIds.length ? 'relative' : undefined }}>
      {showNudge && <AddFriendNudge oaId={config.appearance?.oa_id} onDismiss={handleNudgeDismiss} dismissLabel={config.copy?.nudge_skip_share || 'ข้ามไป แชร์เลย'} copy={config.copy} />}
      {topIds.map(id => RENDERERS[id]?.())}
      <div style={{ padding: '0 20px 28px', marginTop: -resultOverlap, position: 'relative' }}>
        {bodyIds.map(id => RENDERERS[id]?.())}
      </div>
      {floatIds.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}
    </div>
  );
}
