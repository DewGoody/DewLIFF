import { getAxisCard, ARCH, getPairResult, findAxisId } from '../data';

interface Props {
  config: {
    brand?: { primary?: string };
    copy?: Record<string, string>;
    axes?: Array<{ id: string; image_url?: string }>;
    results?: Array<unknown>;
  };
  partnerName: string; title: string; body: string;
  imageUrl?: string; axisMe?: string; axisBuddy?: string;
  axisMeShort?: string; axisBuddyShort?: string;
  rank?: number;
  pairUrl?: string; myName?: string; onBack: () => void;
}

export default function PairResult({ config, partnerName, title, body, imageUrl, axisMe, axisBuddy, rank, pairUrl, myName, onBack }: Props) {
  const copy = config.copy || {};
  const totalPairs = (config.results as Array<unknown> | undefined)?.length ?? 15;
  const axisMeId = axisMe ? (findAxisId(axisMe) || axisMe) : undefined;
  const axisBuddyId = axisBuddy ? (findAxisId(axisBuddy) || axisBuddy) : undefined;
  const hardcoded = (axisMeId && axisBuddyId) ? getPairResult(axisMeId, axisBuddyId) : null;
  const eyebrowPrefix = copy.result_eyebrow || 'เรารอดได้';
  const survival = title.replace(new RegExp(`^${eyebrowPrefix}\\s*`), '') || hardcoded?.survival || title;
  const rankNum = rank ?? hardcoded?.rank;
  const reason = body.replace(/^อันดับที่\s*\d+\s*จาก\s*\d+\s*คู่\s*\n\n?/, '') || hardcoded?.reason;

  const myCard = axisMeId ? getAxisCard(axisMeId, config.axes) : undefined;
  const buddyCard = axisBuddyId ? getAxisCard(axisBuddyId, config.axes) : undefined;
  const myArchName = axisMe ? (ARCH[axisMeId || '']?.th || axisMe) : '';
  const buddyArchName = axisBuddy ? (ARCH[axisBuddyId || '']?.th || axisBuddy) : '';

  const handleShare = async () => {
    const url = pairUrl || window.location.href;
    // DewLIFF is its own separate Vercel deployment from KimLIFF's — same-origin,
    // never a hardcoded domain (see App.tsx's identical OG_BASE fix).
    const base = `${window.location.origin}/api/og`;
    const ogParams = new URLSearchParams({
      type: 'pair',
      survival,
      partnerName,
      ...(rankNum !== undefined ? { rank: String(rankNum), total: String(totalPairs) } : {}),
      ...(reason ? { body: reason } : {}),
      ...(myArchName ? { axisMeLabel: myArchName } : {}),
      ...(buddyArchName ? { axisBuddyLabel: buddyArchName } : {}),
      ...(myCard ? { cardMeUrl: myCard } : {}),
      ...(buddyCard ? { cardBuddyUrl: buddyCard } : {}),
    });
    const ogUrl = imageUrl || `${base}?${ogParams.toString()}`;
    try {
      await liff.shareTargetPicker([{
        type: 'flex',
        altText: `คู่นี้รอดได้ ${survival}`,
        contents: {
          type: 'bubble',
          hero: { type: 'image', url: ogUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' },
          body: {
            type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
            contents: [
              {
                type: 'box', layout: 'vertical', paddingAll: '4px', backgroundColor: '#F5E14B', cornerRadius: '4px', width: '90px',
                contents: [{ type: 'text', text: copy.pair_result_badge || 'คู่นี้รอดได้', size: 'xs', weight: 'bold', color: '#1C1A17', align: 'center' }],
              },
              { type: 'text', text: survival, weight: 'bold', size: 'xxl', color: '#1C1A17', margin: 'sm' },
              ...(rankNum !== undefined ? [{ type: 'text' as const, text: `อันดับที่ ${rankNum} จาก ${totalPairs} คู่`, size: 'xs' as const, color: '#888888' }] : []),
              { type: 'text', text: reason || '', size: 'sm', color: '#555555', wrap: true, margin: 'md' },
              { type: 'separator', margin: 'md' },
              {
                type: 'box', layout: 'horizontal', margin: 'md', spacing: 'sm',
                contents: [
                  ...(axisBuddy ? [{
                    type: 'box' as const, layout: 'vertical' as const, flex: 1, borderWidth: '1px', borderColor: '#1C1A17', cornerRadius: '8px', paddingAll: '8px', backgroundColor: '#E6F1F5',
                    contents: [
                      { type: 'text' as const, text: partnerName, size: 'xs' as const, color: '#888888' },
                      { type: 'text' as const, text: buddyArchName, size: 'sm' as const, weight: 'bold' as const, color: '#1C1A17', wrap: true },
                    ],
                  }] : []),
                  ...(axisMe ? [{
                    type: 'box' as const, layout: 'vertical' as const, flex: 1, borderWidth: '1px', borderColor: '#1C1A17', cornerRadius: '8px', paddingAll: '8px', backgroundColor: '#F5E14B',
                    contents: [
                      { type: 'text' as const, text: myName || copy.me || 'คุณ', size: 'xs' as const, color: '#888888' },
                      { type: 'text' as const, text: myArchName, size: 'sm' as const, weight: 'bold' as const, color: '#1C1A17', wrap: true },
                    ],
                  }] : []),
                ],
              },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical',
            contents: [{ type: 'button', action: { type: 'uri', label: copy.pair_invite_cta || 'ตอบคำถาม', uri: url }, style: 'primary', color: '#E8354F' }],
          },
        },
      }]);
    } catch { /* cancelled */ }
  };

  return (
    <div className="screen fade-enter" style={{ background:'#F7F1E3', overflowY:'auto' }}>
      {/* Hero — 280px fixed, two tilted cards */}
      <div style={{ height:280, flexShrink:0, position:'relative', overflow:'hidden', background:'linear-gradient(#FCEFE0,#F7F1E3)' }}>
        <div style={{ position:'absolute', left:0, right:0, top:10, bottom:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {buddyCard && (
            <div style={{ backgroundImage:`url('${buddyCard}')`, backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:160, height:'100%', transform:'rotate(-8deg)', marginRight:-34, filter:'drop-shadow(3px 4px 0 rgba(28,26,23,.22))' }} />
          )}
          {myCard && (
            <div style={{ backgroundImage:`url('${myCard}')`, backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:160, height:'100%', transform:'rotate(8deg)', marginLeft:-34, filter:'drop-shadow(3px 4px 0 rgba(28,26,23,.22))' }} />
          )}
        </div>
      </div>

      {/* Result card — overlaps hero by 24px, 20px L/R, 28px bottom */}
      <div style={{ padding:'0 20px 28px', marginTop:-24, position:'relative' }}>
        <div style={{ background:'#FFFDF6', border:'2.5px solid #1C1A17', borderRadius:16, padding:16, boxShadow:'4px 5px 0 #1C1A17' }}>
          {/* Badge */}
          <div style={{ display:'inline-block', background:'#F5E14B', border:'2px solid #1C1A17', padding:'3px 10px', font:"700 11px/1.5 'Bai Jamjuree',sans-serif" }}>{copy.pair_result_badge || 'คู่นี้รอดได้'}</div>
          {/* Survival — 38px Bangers spec */}
          <div style={{ fontFamily:'Bangers,cursive', fontSize:38, lineHeight:1.1, marginTop:10, color:'#1C1A17', letterSpacing:'.02em' }}>{survival}</div>
          {rankNum !== undefined && (
            <div style={{ font:"600 11px/1.5 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.45)', marginTop:6 }}>อันดับที่ {rankNum} จาก {totalPairs} คู่</div>
          )}
          <div style={{ font:"500 14px/1.7 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.68)', marginTop:12 }}>{reason}</div>

          {/* Axis chips */}
          {(axisBuddy || axisMe) && (
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              {axisBuddy && (
                <div style={{ flex:1, border:'2px solid #1C1A17', borderRadius:11, padding:9, background:'#E6F1F5', display:'flex', alignItems:'center', gap:8 }}>
                  {buddyCard && <div style={{ backgroundImage:`url('${buddyCard}')`, backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:38, height:52, flexShrink:0 }} />}
                  <div style={{ minWidth:0 }}>
                    <div style={{ font:"600 9.5px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.5)' }}>{partnerName}</div>
                    <div style={{ font:"700 12px 'Bai Jamjuree',sans-serif", marginTop:2, whiteSpace:'nowrap' }}>{buddyArchName}</div>
                  </div>
                </div>
              )}
              {axisMe && (
                <div style={{ flex:1, border:'2px solid #1C1A17', borderRadius:11, padding:9, background:'#F5E14B', display:'flex', alignItems:'center', gap:8 }}>
                  {myCard && <div style={{ backgroundImage:`url('${myCard}')`, backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:38, height:52, flexShrink:0 }} />}
                  <div style={{ minWidth:0 }}>
                    <div style={{ font:"600 9.5px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.5)' }}>{myName || 'คุณ'}</div>
                    <div style={{ font:"700 12px 'Bai Jamjuree',sans-serif", marginTop:2, whiteSpace:'nowrap' }}>{myArchName}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CTAs — 24px gap, 52px primary, 44px secondary */}
        <div style={{ display:'flex', gap:8, marginTop:24 }}>
          <button
            onClick={handleShare}
            style={{ flex:1, padding:'15px 20px', background:'#F5E14B', color:'#1C1A17', border:'2.5px solid #1C1A17', borderRadius:13, font:"700 17px/1 'Bai Jamjuree',sans-serif", cursor:'pointer', boxShadow:'4px 5px 0 #1C1A17' }}
          >{copy.pair_share_cta || 'แชร์การ์ดคู่นี้'}</button>
          <button
            onClick={onBack}
            style={{ flexShrink:0, padding:'13px 16px', background:'#FFFDF6', border:'2px solid #1C1A17', borderRadius:13, font:"600 14px/1 'Bai Jamjuree',sans-serif", cursor:'pointer' }}
          >ดูผลของฉัน</button>
        </div>
      </div>
    </div>
  );
}
