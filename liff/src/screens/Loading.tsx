import { getScreenBlocks, floatStyle, scaleFont, renderExtraBlock } from '../screenConfig';

interface Props {
  config?: {
    copy?: Record<string, string>;
    brand?: { primary?: string };
    appearance?: {
      images?: Record<string, string>;
      screen_config?: Record<string, { blocks: any[] }>;
      font_scale?: number;
      progress_style_loading?: 'default' | 'compact' | 'bar';
    };
  };
}

const DEFAULT_ORDER = ['loadArt', 'loadCopy', 'loadBar'];

export default function Loading({ config }: Props) {
  const copy = config?.copy || {};
  const appearance = config?.appearance || {};
  const loadingImage = appearance.images?.['loading'];
  const title = copy.loading_title || 'LOADING';
  const body = copy.loading_body || 'กำลังโหลด...';
  const fontScale = appearance.font_scale;
  const progressStyleLoading = appearance.progress_style_loading || 'default';

  // Loading shows before any user-specific data exists, so there's no real
  // axes/results/group context to bind a "แหล่งข้อมูล" src to here — order/show/geo/pos still apply.
  const { blockOrder, blockVisible, geo, pos } = getScreenBlocks(appearance, 'Loading', DEFAULT_ORDER);

  const artH = Number(geo('loadArt').h) || 150;
  const copyAlign = (geo('loadCopy').align as string) || 'center';

  const RENDERERS: Record<string, () => React.ReactNode> = {
    loadArt: () => loadingImage ? (
      <div key="loadArt" style={{ position:'relative', width:artH, height:artH, animation:'v2Bob 2.4s ease-in-out infinite' }}>
        <img src={loadingImage} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
      </div>
    ) : null,
    loadCopy: () => (
      <div key="loadCopy" style={{ position:'relative', textAlign: copyAlign as React.CSSProperties['textAlign'] }}>
        <div style={{ fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:scaleFont(28, fontScale), letterSpacing:'.06em', color:'var(--ink)' }}>{title}</div>
        <div style={{ font:`500 ${scaleFont(13, fontScale)}px var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:8 }}>{body}</div>
      </div>
    ),
    loadBar: () => (
      <div key="loadBar" style={{ position:'relative', width:190, height:12, border:'2px solid var(--ink)', borderRadius:'var(--progress-radius)', overflow:'hidden', background:'var(--card)' }}>
        {progressStyleLoading === 'default' ? (
          <div className="pbar-loading" />
        ) : (
          <div
            className="pbar-stripe"
            style={{
              width: progressStyleLoading === 'compact' ? '45%' : '82%',
              ...(progressStyleLoading === 'bar' ? { background: 'var(--ac)' } : {}),
            }}
          />
        )}
      </div>
    ),
  };
  // No axes/results/group context exists yet at Loading time (see the note on
  // getScreenBlocks above) — xCard/xRow/xChip render here but always as "unbound".
  for (const xid of ['xImage', 'xText', 'xSpacer', 'xDivider', 'xBox', 'xCard', 'xRow', 'xChip']) {
    RENDERERS[xid] = () => renderExtraBlock(xid, { geo: geo(xid), copy, images: appearance?.images, fontScale: appearance?.font_scale });
  }

  const visible = blockOrder.filter(blockVisible);
  const flowBlocks  = visible.filter(id => !pos(id));
  const floatBlocks = visible.filter(id => pos(id));

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, background:'var(--bg)', position:'relative' }}>
      <div style={{ position:'absolute', inset:0, opacity:.5, background:'radial-gradient(circle at 30% 20%,rgba(122,196,214,.3),transparent 45%),radial-gradient(circle at 75% 75%,rgba(245,225,75,.35),transparent 45%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, background:'var(--texture-bg)', pointerEvents:'none' }} />
      {flowBlocks.map(id => RENDERERS[id]?.())}
      {floatBlocks.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}
    </div>
  );
}
