/**
 * Visual renderer for LINE Flex Message bubbles.
 * Phase 4: pixel-accurate bubble width per size, full box/button/image/filler rendering.
 */

type FC = Record<string, unknown>;

// LINE bubble widths (dp) per size token
const BUBBLE_W: Record<string, number> = { kilo: 260, mega: 300, giga: 386 };

const SZ: Record<string, number> = {
  xxs: 9, xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, '3xl': 28, '4xl': 32, '5xl': 40,
};
const SP: Record<string, number> = {
  none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
};

function px(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  return 0;
}

function spPx(v: unknown): number {
  if (typeof v === 'string' && v in SP) return SP[v as string];
  return px(v);
}

function renderComp(comp: FC, primary: string, key: number | string): React.ReactNode {
  const t = comp.type as string;

  // ── text ────────────────────────────────────────────────────────────────────
  if (t === 'text') {
    const size   = SZ[comp.size as string] ?? 14;
    const mt     = spPx(comp.margin);
    const flexV  = typeof comp.flex === 'number' ? comp.flex : undefined;
    const align  = (comp.align as React.CSSProperties['textAlign']) || undefined;
    return (
      <div key={key} style={{
        fontSize: size, lineHeight: 1.5,
        fontWeight: comp.weight === 'bold' ? 700 : 400,
        color: (comp.color as string) || '#1C1A17',
        marginTop: mt || undefined,
        whiteSpace: comp.wrap ? 'normal' : 'nowrap',
        overflow: 'hidden',
        textOverflow: comp.wrap ? undefined : 'ellipsis',
        flex: flexV,
        textAlign: align,
        maxLines: comp.maxLines ? Number(comp.maxLines) : undefined,
      } as React.CSSProperties}>
        {comp.text as string}
      </div>
    );
  }

  // ── image ───────────────────────────────────────────────────────────────────
  if (t === 'image') {
    const ratio  = (comp.aspectRatio as string) || '20:13';
    const [rw, rh] = ratio.split(':').map(Number);
    const pb     = `${((rh || 1) / (rw || 1)) * 100}%`;
    const bg     = (comp.backgroundColor as string) || '#F0F0F0';
    const fit: React.CSSProperties['objectFit'] = comp.aspectMode === 'fit' ? 'contain' : 'cover';
    const flexV  = typeof comp.flex === 'number' ? comp.flex : undefined;
    const radius = comp.cornerRadius ? px(comp.cornerRadius) : undefined;
    const mt     = spPx(comp.margin);

    // 'sm' size = fixed small image (for f04 inline thumbnail)
    if (comp.size === 'sm' || comp.size === 'xs' || comp.size === 'xxs') {
      const dim = comp.size === 'xxs' ? 28 : comp.size === 'xs' ? 40 : 60;
      return (
        <div key={key} style={{ width: dim, height: dim, flexShrink: 0, flex: flexV, borderRadius: radius, overflow: 'hidden', background: bg, marginTop: mt || undefined, position: 'relative' }}>
          <img src={comp.url as string} alt="" style={{ width: '100%', height: '100%', objectFit: fit }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      );
    }

    return (
      <div key={key} style={{ position: 'relative', width: '100%', paddingBottom: pb, background: bg, overflow: 'hidden', flexShrink: 0, flex: flexV, borderRadius: radius, marginTop: mt || undefined }}>
        <img src={comp.url as string} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    );
  }

  // ── button ──────────────────────────────────────────────────────────────────
  if (t === 'button') {
    const action = (comp.action as FC) || {};
    const label  = (action.label as string) || '';
    const st     = comp.style as string;
    const col    = (comp.color as string) || primary;
    const h      = comp.height === 'sm' ? 32 : 40;
    const mt     = spPx(comp.margin);
    const flexV  = typeof comp.flex === 'number' ? comp.flex : 1;

    let bg     = 'transparent';
    let border = '1.5px solid #DADADA';
    let tc     = '#1C1A17';
    if (st === 'primary')   { bg = col; border = 'none'; tc = '#fff'; }
    else if (st === 'secondary') { bg = 'transparent'; border = `1.5px solid ${col}`; tc = col; }
    else if (st === 'link') { bg = 'transparent'; border = 'none'; tc = col; }

    return (
      <div key={key} style={{
        height: h, minHeight: h, background: bg, border, borderRadius: 6, flex: flexV,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: tc, fontSize: 13, fontWeight: 700, marginTop: mt || undefined,
        cursor: 'default', flexShrink: 0,
      }}>
        {label}
      </div>
    );
  }

  // ── separator ───────────────────────────────────────────────────────────────
  if (t === 'separator') {
    const mt = spPx(comp.margin);
    return <hr key={key} style={{ border: 'none', borderTop: '1px solid #E8E8E8', marginTop: mt || 6, marginBottom: 0 }} />;
  }

  // ── filler ──────────────────────────────────────────────────────────────────
  if (t === 'filler') {
    const flexV = typeof comp.flex === 'number' ? comp.flex : 1;
    return <div key={key} style={{ flex: flexV }} />;
  }

  // ── box ─────────────────────────────────────────────────────────────────────
  if (t === 'box') {
    const layout   = (comp.layout as string) || 'vertical';
    const dir: React.CSSProperties['flexDirection'] = layout === 'vertical' ? 'column' : 'row';
    const gap      = spPx(comp.spacing);
    const padAll   = px(comp.paddingAll);
    const pt       = px(comp.paddingTop)    || padAll;
    const pb2      = px(comp.paddingBottom) || padAll;
    const pl       = px(comp.paddingStart)  || px(comp.paddingLeft)  || padAll;
    const pr2      = px(comp.paddingEnd)    || px(comp.paddingRight) || padAll;
    const mt       = spPx(comp.margin);
    const bg       = comp.backgroundColor as string | undefined;
    const radius   = comp.cornerRadius ? px(comp.cornerRadius) : undefined;
    const contents = (comp.contents as FC[]) ?? [];
    const flexV    = typeof comp.flex === 'number' ? comp.flex : undefined;
    const w        = comp.width  as string | undefined;
    const h2       = comp.height as string | undefined;
    const overflow = (comp.overflow as string) === 'hidden' ? 'hidden' : undefined;

    const baseAlign = layout === 'baseline' ? 'baseline'
      : layout === 'horizontal'            ? 'center'
      : 'stretch';
    const alignItems = (comp.alignItems as React.CSSProperties['alignItems']) || baseAlign;

    return (
      <div key={key} style={{
        display: 'flex', flexDirection: dir, gap,
        paddingTop: pt || undefined, paddingBottom: pb2 || undefined,
        paddingLeft: pl || undefined, paddingRight: pr2 || undefined,
        alignItems: alignItems !== 'stretch' ? alignItems : undefined,
        justifyContent: (comp.justifyContent as React.CSSProperties['justifyContent']) || undefined,
        background: bg, borderRadius: radius,
        marginTop: mt || undefined, flex: flexV, width: w, height: h2,
        overflow, boxSizing: 'border-box', minWidth: 0,
      }}>
        {contents.map((c, i) => renderComp(c, primary, i))}
      </div>
    );
  }

  return null;
}

// Brand name → 2-letter initials
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  flexJson: Record<string, unknown> | null;
  brand: { primary: string; name: string };
  size?: string;   // 'kilo' | 'mega' | 'giga' — from layoutOpts
}

export default function FlexBubblePreview({ flexJson, brand, size }: Props) {
  if (!flexJson) return null;
  const contents = flexJson.contents as FC | undefined;
  if (!contents || contents.type !== 'bubble') return null;

  const primary    = brand.primary || '#E8354F';
  const bubbleSize = size || (contents.size as string) || 'mega';
  const bubbleW    = BUBBLE_W[bubbleSize] ?? 300;

  const hero    = contents.hero   as FC | undefined;
  const body    = contents.body   as FC | undefined;
  const footer  = contents.footer as FC | undefined;

  const bodyContents   = (body?.contents   as FC[]) ?? [];
  const footerContents = (footer?.contents as FC[]) ?? [];

  const bodyPad  = px(body?.paddingAll)  || 16;
  const bodyGap  = spPx(body?.spacing)   || 4;
  const footPad  = px(footer?.paddingAll) || 0;
  const footGap  = spPx(footer?.spacing)  || 6;
  const footDir: React.CSSProperties['flexDirection'] =
    (footer?.layout as string) === 'horizontal' ? 'row' : 'column';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      padding: '28px 16px 48px', background: '#E5DDD5', minHeight: '100%',
      fontFamily: "'Bai Jamjuree','Noto Sans Thai',sans-serif",
    }}>
      {/* Date chip */}
      <div style={{
        alignSelf: 'center', background: 'rgba(0,0,0,.22)', color: '#fff',
        fontSize: 11, padding: '3px 12px', borderRadius: 10, marginBottom: 20,
      }}>วันนี้</div>

      {/* OA row */}
      <div style={{ display: 'flex', gap: 8, maxWidth: bubbleW + 52 }}>
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: '#06C755',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>
          {initials(brand.name || 'OA')}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* OA name */}
          <div style={{ fontSize: 11, color: '#666', marginBottom: 5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {brand.name || 'Official Account'}
          </div>

          {/* Bubble */}
          <div style={{
            background: '#fff', borderRadius: '0 16px 16px 16px',
            overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.15)',
            width: bubbleW,
          }}>
            {/* Hero */}
            {hero && renderComp(hero, primary, 'hero')}

            {/* Body */}
            {bodyContents.length > 0 && (
              <div style={{ padding: bodyPad, display: 'flex', flexDirection: 'column', gap: bodyGap }}>
                {bodyContents.map((c, i) => renderComp(c, primary, i))}
              </div>
            )}

            {/* Footer */}
            {footerContents.length > 0 && (
              <div style={{
                padding: footPad || '0 12px 12px',
                display: 'flex', flexDirection: footDir, gap: footGap,
              }}>
                {footerContents.map((c, i) => renderComp(c, primary, i))}
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>12:00</div>
        </div>
      </div>
    </div>
  );
}
