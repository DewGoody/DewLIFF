import { useState } from 'react';

interface Props {
  config: {
    brand?: { name?: string; primary?: string };
    copy?: Record<string, string>;
  };
  campaignId: string;
  liffId: string;
  archTitle: string;
  archBody: string;
  cardImageUrl?: string;
  myUserId?: string;
  onBack: () => void;
  onPlayAgain: () => void;
}

export default function SoloShare({ config, campaignId, liffId, archTitle, archBody, cardImageUrl, myUserId, onBack }: Props) {
  const copy = config.copy || {};
  const brandName = config.brand?.name || 'APOCALYPSE SQUAD';
  const liffBase = `https://liff.line.me/${liffId}`;
  const inviteUrl = myUserId
    ? `${liffBase}?campaignId=${campaignId}&inviterId=${myUserId}`
    : `${liffBase}?campaignId=${campaignId}`;

  const [lineSending, setLineSending] = useState(false);
  const [igStatus, setIgStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done'>('idle');

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

  const handleSend = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liffAny = liff as any;
    if (!liff.isInClient() || !liffAny.isApiAvailable?.('shareTargetPicker')) {
      try { await navigator.clipboard.writeText(inviteUrl); } catch {}
      onBack();
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
              { type: 'button', action: { type: 'uri', label: copy.F02_cta1 || 'เล่นดูว่าคุณสายไหน', uri: `${liffBase}?campaignId=${campaignId}` }, style: 'primary', color: '#E8354F' },
              { type: 'button', action: { type: 'uri', label: copy.F02_cta2 || 'ดูผลคู่กับฉัน', uri: inviteUrl }, style: 'secondary' },
            ],
          },
        },
      }]);
      onBack();
    } catch { /* cancelled */ }
    finally { setLineSending(false); }
  };

  const handleShareIG = async () => {
    setIgStatus('loading');
    try {
      const blob = await fetchImageBlob();
      if (!blob) { setIgStatus('error'); return; }
      const file = new File([blob], `${archTitle || 'result'}.png`, { type: blob.type || 'image/png' });
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: archTitle });
        setIgStatus('idle');
      } else {
        // Fallback: download
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

  const handleSaveImage = async () => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      const blob = await fetchImageBlob();
      if (!blob) { setSaveStatus('idle'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${archTitle || 'result'}.png`; a.click();
      URL.revokeObjectURL(url);
      setSaveStatus('done');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
    }
  };

  return (
    <div className="screen fade-enter" style={{ background: '#F7F1E3', overflowY: 'auto' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ font: "700 11px 'Bai Jamjuree',sans-serif", letterSpacing: '.1em', color: '#E8354F' }}>{copy.solo_share_eyebrow || 'แชร์ผลของคุณ'}</div>
        <div style={{ font: "700 22px/1.3 'Bai Jamjuree',sans-serif", marginTop: 6 }}>{copy.solo_share_title || 'การ์ดนี้จะถูกส่งเข้าแชท'}</div>
      </div>

      {/* Card preview */}
      <div style={{ margin: '16px 20px 0', background: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 16, boxShadow: '4px 5px 0 #1C1A17', overflow: 'hidden' }}>
        {/* Card image area */}
        <div style={{ background: '#F7F1E3', borderBottom: '2.5px solid #1C1A17', padding: '18px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cardImageUrl ? (
            <div style={{ width: 176, height: 228, border: '2.5px solid #1C1A17', borderRadius: 12, background: '#F5E14B', boxShadow: '3px 4px 0 #1C1A17', overflow: 'hidden' }}>
              <img src={cardImageUrl} alt={archTitle} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ width: 176, height: 228, border: '2.5px solid #1C1A17', borderRadius: 12, background: '#F5E14B', boxShadow: '3px 4px 0 #1C1A17', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ font: "700 18px 'Bai Jamjuree',sans-serif", color: '#1C1A17', textAlign: 'center', padding: '0 16px' }}>{archTitle}</div>
            </div>
          )}
        </div>
        {/* Card details */}
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ fontFamily: 'Bangers,cursive', fontSize: 13, letterSpacing: '.05em', color: 'rgba(28,26,23,.4)' }}>{brandName}</div>
          <div style={{ font: "700 22px/1.25 'Bai Jamjuree',sans-serif", marginTop: 4 }}>{archTitle}</div>
          <div style={{ font: "500 13px/1.65 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.62)', marginTop: 6 }}>{archBody}</div>
        </div>
      </div>

      {/* CTAs */}
      <div style={{ padding: '20px 20px 32px' }}>
        {/* LINE share */}
        <button
          onClick={handleSend}
          disabled={lineSending}
          style={{ width: '100%', height: 52, background: '#E8354F', color: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 13, font: "700 17px 'Bai Jamjuree',sans-serif", cursor: lineSending ? 'default' : 'pointer', boxShadow: '4px 4px 0 #1C1A17', opacity: lineSending ? .7 : 1 }}
        >{lineSending ? 'กำลังส่ง...' : (copy.solo_share_send || 'ส่งผ่าน LINE')}</button>
        <div style={{ font: "600 11px 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.45)', marginTop: 8, textAlign: 'center' }}>{copy.solo_share_hint || 'เลือกเพื่อนหรือกลุ่มปลายทางในหน้าต่อไป'}</div>

        {/* Go to summary */}
        <button
          onClick={onBack}
          style={{ width: '100%', height: 44, marginTop: 10, background: '#FFFDF6', color: '#1C1A17', border: '2px solid #1C1A17', borderRadius: 13, font: "600 14px 'Bai Jamjuree',sans-serif", cursor: 'pointer' }}
        >{copy.solo_share_back || 'ไปหน้าสรุปผลรวม'}</button>

        {/* Other platforms */}
        <div style={{ marginTop: 24, borderTop: '2px dashed rgba(28,26,23,.15)', paddingTop: 18 }}>
          <div style={{ font: "700 11px 'Bai Jamjuree',sans-serif", letterSpacing: '.1em', color: 'rgba(28,26,23,.4)', marginBottom: 12 }}>แชร์ไปที่อื่น</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* IG Story */}
            <button
              onClick={handleShareIG}
              disabled={igStatus === 'loading'}
              style={{
                flex: 1, padding: '13px 10px',
                background: igStatus === 'error' ? 'rgba(232,53,79,.08)' : '#FFFDF6',
                color: igStatus === 'error' ? '#E8354F' : '#1C1A17',
                border: `2px solid ${igStatus === 'error' ? '#E8354F' : '#1C1A17'}`,
                borderRadius: 12, font: "600 13px/1.2 'Bai Jamjuree',sans-serif",
                cursor: igStatus === 'loading' ? 'default' : 'pointer',
                opacity: igStatus === 'loading' ? .6 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: 22 }}>📸</span>
              <span>{igStatus === 'loading' ? 'กำลังโหลด...' : igStatus === 'error' ? 'ลองใหม่' : (copy.ig_story_btn || 'สตอรี่ IG')}</span>
            </button>
            {/* Save image */}
            <button
              onClick={handleSaveImage}
              disabled={saveStatus === 'saving'}
              style={{
                flex: 1, padding: '13px 10px',
                background: saveStatus === 'done' ? 'rgba(34,197,94,.1)' : '#FFFDF6',
                color: saveStatus === 'done' ? '#16a34a' : '#1C1A17',
                border: `2px solid ${saveStatus === 'done' ? '#22c55e' : '#1C1A17'}`,
                borderRadius: 12, font: "600 13px/1.2 'Bai Jamjuree',sans-serif",
                cursor: saveStatus === 'saving' ? 'default' : 'pointer',
                opacity: saveStatus === 'saving' ? .6 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: 22 }}>{saveStatus === 'done' ? '✓' : '💾'}</span>
              <span>{saveStatus === 'saving' ? 'กำลังโหลด...' : saveStatus === 'done' ? 'บันทึกแล้ว!' : (copy.save_image_btn || 'บันทึกภาพ')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
