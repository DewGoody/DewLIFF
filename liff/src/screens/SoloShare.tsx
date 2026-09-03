import { useState } from 'react';
import AddFriendNudge, { nudgeSeen } from './AddFriendNudge';
import { shareOrCopy } from '../shareUtils';
import { getScreenBlocks, resolveSrcText, floatStyle, scaleFont, getPatternDefaults, type ArtStyleAppearance } from '../screenConfig';

interface Props {
  config: {
    brand?: { name?: string; primary?: string };
    copy?: Record<string, string>;
    appearance?: ArtStyleAppearance & {
      oa_id?: string; og_base_url?: string; screen_config?: Record<string, { blocks: any[] }>;
      font_scale?: number; card_radius?: number; badge_radius?: number; shadow?: string; tilt?: string;
    };
  };
  campaignId: string;
  liffId: string;
  archTitle: string;
  archTitleEn?: string;
  archBody: string;
  axisId?: string;
  cardImageUrl?: string;
  myUserId?: string;
  isFriend?: boolean;
  onBack: () => void;
  onPlayAgain: () => void;
}

const DEFAULT_ORDER = ['survivorCard', 'shareRow'];

// survivorCard's 'solo' pattern family (portrait/square/circle) — mirrors admin
// LayoutEditor.tsx's ART_SHAPES, except 'card' (the 'portrait' variant) uses the
// exact ratio/radius this screen always shipped with (172/130, radius 10) so the
// unconfigured default stays pixel-identical instead of the admin's ~4/3 approximation.
const ART_R: Record<string, { r: number; radius: number }> = {
  card:   { r: 172 / 130, radius: 10 },
  square: { r: 1,         radius: 10 },
  circle: { r: 1,         radius: 999 },
};

export default function SoloShare({ config, campaignId, liffId, archTitle, archTitleEn, archBody: archBodyProp, axisId, cardImageUrl, myUserId, isFriend, onBack }: Props) {
  const archBody = archBodyProp || '';
  const copy = config.copy || {};
  const appearance = config.appearance || {};
  // ── Typography (03) font scale — every literal px font-size below is run through this ──
  const fs = (px: number) => scaleFont(px, appearance.font_scale);
  const brandName = config.brand?.name || '';
  const primary = config.brand?.primary || '#E8354F';
  // When running in browser (not inside LINE), use the current web origin so dev links
  // stay on dev and prod links stay on prod. Flex cards are only sent when isInClient()
  // is true, at which point liffBase is correctly set to the LINE URL.
  const lineBase = `https://liff.line.me/${liffId}`;
  const webBase = window.location.origin + window.location.pathname;
  const liffBase = liff.isInClient() ? lineBase : webBase;
  const inviteUrl = myUserId
    ? `${liffBase}?campaignId=${campaignId}&inviterId=${myUserId}`
    : `${liffBase}?campaignId=${campaignId}`;

  const [lineSending, setLineSending] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [pendingShare, setPendingShare] = useState(false);
  const [igStatus, setIgStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); } catch {}
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  // Fetch card image as blob (shared by IG share and save image)
  const fetchImageBlob = async (): Promise<Blob | null> => {
    if (!cardImageUrl) return null;
    try {
      const res = await fetch(cardImageUrl);
      return await res.blob();
    } catch {
      return null;
    }
  };

  const handleSendClick = () => {
    if (!isFriend && !nudgeSeen()) {
      setPendingShare(true);
      setShowNudge(true);
      return;
    }
    handleSend();
  };

  const handleNudgeDismiss = () => {
    setShowNudge(false);
    if (pendingShare) { setPendingShare(false); handleSend(); }
  };

  const handleSend = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = liff as any;
    if (!liff.isInClient() || !liffAny.isApiAvailable?.('shareTargetPicker')) {
      setLineSending(true);
      await shareOrCopy(inviteUrl, archTitle);
      setLineSending(false);
      return;
    }
    setLineSending(true);
    try {
      await liffAny.shareTargetPicker([{
        type: 'flex',
        altText: `${copy.F02_eyebrow || 'สายของฉันคือ'} ${archTitle} — มาดูว่าคุณสายไหน`.slice(0, 400),
        contents: {
          type: 'bubble',
          size: 'mega',
          hero: cardImageUrl
            ? { type: 'image', url: cardImageUrl, size: 'full', aspectRatio: '20:21', aspectMode: 'fit', backgroundColor: '#F5E14B' }
            : undefined,
          body: {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', paddingAll: '4px', backgroundColor: '#F5E14B', cornerRadius: '4px', width: '96px', contents: [{ type: 'text', text: copy.F02_eyebrow || 'สายของฉันคือ', size: 'xs', weight: 'bold', color: '#1C1A17', align: 'center' }] },
              { type: 'text', text: archTitle, weight: 'bold', size: 'xxl', color: '#1C1A17', wrap: true, margin: 'sm' },
              { type: 'text', text: archBody, size: 'sm', color: '#555555', wrap: true, margin: 'sm' },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical', spacing: 'sm',
            contents: [
              { type: 'button', action: { type: 'uri', label: copy.F02_cta1 || 'เล่นดูว่าคุณสายไหน', uri: `${liffBase}?campaignId=${campaignId}` }, style: 'primary', color: primary },
              { type: 'button', action: { type: 'uri', label: copy.F02_cta2 || 'ดูผลคู่กับฉัน', uri: inviteUrl }, style: 'secondary' },
            ],
          },
        },
      }]);
      onBack();
    } catch { /* cancelled */ }
    finally { setLineSending(false); }
  };

  const buildSoloCardUrl = () => {
    const ogBase = config.appearance?.og_base_url || (window.location.origin + '/api/og');
    const p = new URLSearchParams({
      type: 'solo_card',
      axisId: axisId || '',
      titleEn: archTitleEn || archTitle || '',
      labelTh: archTitle || '',
      body: archBody || '',
      v: '2',
    });
    return `${ogBase}?${p.toString()}`;
  };

  const handleShareIG = async () => {
    setIgStatus('loading');
    try {
      const cardUrl = buildSoloCardUrl();
      const res = await fetch(cardUrl);
      if (!res.ok) { setIgStatus('error'); return; }
      const blob = await res.blob();
      const file = new File([blob], `${archTitle || 'result'}.png`, { type: 'image/png' });
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: archTitle });
        setIgStatus('idle');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${archTitle || 'result'}.png`; a.click();
        URL.revokeObjectURL(url);
        setIgStatus('idle');
      }
    } catch {
      setIgStatus('error');
      setTimeout(() => setIgStatus('idle'), 2500);
    }
  };

  // ── screen_config wiring: order / show / geo / float position / pattern / data source ──
  const { blockOrder, blockVisible, geo, pos, pat, src } = getScreenBlocks(appearance, 'SoloShare', DEFAULT_ORDER);

  const cardGeo = geo('survivorCard');
  const cardPad = Number(cardGeo.pad) || 16;
  const artW = Number(cardGeo.artW) || 130;
  const cardDir = (cardGeo.dir as string) === 'row' ? 'row' : 'column';

  // 05 Art Style / 04 Shape & Feel global defaults, fed into pat() as the fallback
  // instead of a hardcoded literal (same idea as PairResult.tsx / Intro.tsx).
  const artDefaults = getPatternDefaults(appearance);
  const soloPat = pat('survivorCard', 'solo', artDefaults.solo);
  const soloShape = soloPat === 'circle' ? 'circle' : soloPat === 'square' ? 'square' : 'card';
  const artShape = ART_R[soloShape];
  const artH = Math.round(artW * artShape.r);
  const artRadius = Math.min(artShape.radius, artW);

  // survivorCard's admin-mockup "eyebrow" field has no home in this screen's real design
  // today (no copy.summary_card_eyebrow is used here) — only show it when the admin has
  // actually bound/typed one, so the unconfigured default renders with nothing extra.
  const eyebrowSrc = resolveSrcText(src('survivorCard', 'text'), {}, copy);
  const eyebrowText = copy.summary_card_eyebrow || eyebrowSrc;

  const shareGeo = geo('shareRow');
  const shareDir = (shareGeo.dir as string) === 'row' ? 'row' : 'column';

  // shareRow's primary bound field maps to the real LINE-share button label.
  const sendLabelSrc = resolveSrcText(src('shareRow', 'text'), {}, copy);
  const sendLabel = copy.solo_share_send || sendLabelSrc || 'ส่งผ่าน LINE';

  // ── Block renderers ────────────────────────────────────────────────────────

  const renderSurvivorCard = () => {
    if (!blockVisible('survivorCard')) return null;
    return (
      <div key="survivorCard" style={{ margin: '16px 20px 0', background: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 'var(--card-radius)', boxShadow: '4px 5px 0 #1C1A17', overflow: 'hidden', display: 'flex', flexDirection: cardDir as React.CSSProperties['flexDirection'], backgroundImage: 'var(--texture-bg)', transform: 'rotate(calc(var(--tilt-deg) * -1deg))' }}>
        {/* Card image area — cream background, yellow portrait card centered */}
        <div style={{ background: '#F0EBE0', borderBottom: cardDir === 'row' ? 'none' : '2.5px solid #1C1A17', borderRight: cardDir === 'row' ? '2.5px solid #1C1A17' : 'none', padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cardImageUrl ? (
            <div style={{ width: artW, height: artH, border: '2.5px solid #1C1A17', borderRadius: artRadius, background: '#F5E14B', boxShadow: '3px 4px 0 #1C1A17', overflow: 'hidden' }}>
              <img src={cardImageUrl} alt={archTitle} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ width: artW, height: artH, border: '2.5px solid #1C1A17', borderRadius: artRadius, background: '#F5E14B', boxShadow: '3px 4px 0 #1C1A17', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ font: `700 ${fs(15)}px 'Bai Jamjuree',sans-serif`, color: '#1C1A17', textAlign: 'center', padding: '0 12px' }}>{archTitle}</div>
            </div>
          )}
        </div>
        {/* Card details */}
        <div style={{ padding: `14px ${cardPad}px ${cardPad}px` }}>
          {eyebrowText && (
            <div style={{ font: `700 ${fs(10)}px 'Bai Jamjuree',sans-serif`, letterSpacing: '.1em', color: 'rgba(28,26,23,.4)', marginBottom: 4 }}>{eyebrowText}</div>
          )}
          <div style={{ fontFamily: 'Bangers,cursive', fontSize: fs(13), letterSpacing: '.05em', color: 'rgba(28,26,23,.4)' }}>{brandName}</div>
          <div style={{ font: `700 ${fs(22)}px/1.25 'Bai Jamjuree',sans-serif`, marginTop: 4 }}>{archTitle}</div>
          <div style={{ font: `500 ${fs(13)}px/1.65 'Bai Jamjuree',sans-serif`, color: 'rgba(28,26,23,.62)', marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>{archBody}</div>
        </div>
      </div>
    );
  };

  const renderShareRow = () => {
    if (!blockVisible('shareRow')) return null;
    return (
      <div key="shareRow" style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: shareDir as React.CSSProperties['flexDirection'] }}>
        {/* LINE share */}
        <button
          onClick={handleSendClick}
          disabled={lineSending}
          style={{ width: '100%', height: 52, background: 'var(--line)', color: '#fff', border: '2.5px solid #1C1A17', borderRadius: 13, font: `700 ${fs(17)}px 'Bai Jamjuree',sans-serif`, cursor: lineSending ? 'default' : 'pointer', boxShadow: '4px 4px 0 #1C1A17', opacity: lineSending ? .7 : 1 }}
        >{lineSending ? (copy.solo_share_sending || 'กำลังส่ง...') : sendLabel}</button>

        {/* Copy invite link */}
        <button
          onClick={handleCopyLink}
          style={{ width: '100%', marginTop: shareDir === 'row' ? 0 : 10, marginLeft: shareDir === 'row' ? 10 : 0, padding: '13px 20px', background: '#FFFDF6', color: copyStatus === 'copied' ? 'var(--line)' : '#1C1A17', border: '2.5px solid #1C1A17', borderRadius: 13, font: `700 ${fs(15)}px/1 'Bai Jamjuree',sans-serif`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '4px 5px 0 #1C1A17' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>{copyStatus === 'copied' ? (copy.copy_link_done || '✓ คัดลอกแล้ว') : (copy.copy_link_btn || 'คัดลอกลิงก์เชิญ')}</span>
        </button>

        {/* Share solo result (IG / native share) */}
        <button
          onClick={handleShareIG}
          disabled={igStatus === 'loading'}
          style={{
            width: '100%', marginTop: shareDir === 'row' ? 0 : 10, marginLeft: shareDir === 'row' ? 10 : 0, padding: '13px 20px',
            background: igStatus === 'error' ? 'rgba(232,53,79,.08)' : '#FFFDF6',
            color: igStatus === 'error' ? '#E8354F' : '#1C1A17',
            border: `2.5px solid ${igStatus === 'error' ? '#E8354F' : '#1C1A17'}`,
            borderRadius: 13, font: `700 ${fs(15)}px/1 'Bai Jamjuree',sans-serif`,
            cursor: igStatus === 'loading' ? 'default' : 'pointer',
            opacity: igStatus === 'loading' ? .6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: igStatus === 'error' ? 'none' : '4px 5px 0 #1C1A17',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span>{igStatus === 'loading' ? (copy.ig_story_loading || 'กำลังโหลด...') : igStatus === 'error' ? (copy.ig_story_retry || 'ลองใหม่') : (copy.ig_story_btn || 'แชร์ผลเดี่ยว')}</span>
        </button>

        {/* Go to summary — ghost text button */}
        <button
          onClick={onBack}
          style={{ width: '100%', padding: '11px 16px', background: 'transparent', border: 'none', color: 'rgba(28,26,23,.45)', font: `600 ${fs(13)}px/1 'Bai Jamjuree',sans-serif`, cursor: 'pointer', marginTop: shareDir === 'row' ? 0 : 6, marginLeft: shareDir === 'row' ? 10 : 0 }}
        >{copy.solo_share_back || 'ไปหน้าสรุปผลรวม'}</button>
      </div>
    );
  };

  const RENDERERS: Record<string, () => React.ReactNode> = {
    survivorCard: renderSurvivorCard,
    shareRow:     renderShareRow,
  };

  // ── Build output ──────────────────────────────────────────────────────────

  const visible = blockOrder.filter(blockVisible);
  const flowIds  = visible.filter(id => !pos(id));
  const floatIds = visible.filter(id => pos(id));

  return (
    <div className="screen fade-enter" style={{ background: '#F7F1E3', backgroundImage: 'var(--texture-bg)', overflowY: 'auto', position: floatIds.length ? 'relative' : undefined }}>
      {showNudge && <AddFriendNudge oaId={appearance.oa_id} onDismiss={handleNudgeDismiss} dismissLabel={copy.nudge_skip_share || 'ข้ามไป แชร์เลย'} copy={config.copy} />}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ font: `700 ${fs(11)}px 'Bai Jamjuree',sans-serif`, letterSpacing: '.1em', color: '#E8354F' }}>{copy.solo_share_eyebrow || 'แชร์ผลของคุณ'}</div>
        <div style={{ font: `700 ${fs(22)}px/1.3 'Bai Jamjuree',sans-serif`, marginTop: 6 }}>{copy.solo_share_title || 'การ์ดนี้จะถูกส่งเข้าแชท'}</div>
      </div>

      {flowIds.map(id => RENDERERS[id]?.())}
      {floatIds.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}
    </div>
  );
}
