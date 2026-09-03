// ── screenConfig.ts ──────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';

// Shared helper for reading admin-configured screen layout (order / show / geo /
// floating position / data-source binding) out of appearance.screen_config, and
// falling back to each screen's original hardcoded behavior when absent.
//
// Mirrors the same block model as admin/src/components/sections/LiffSection.tsx
// (BlockItem) and LayoutEditor.tsx — keep in sync when the block schema changes.

export interface ScreenBlockPos { x: number; y: number; w: number }

export interface ScreenBlockSrc {
  mode: string;
  field?: string;
  idx?: number;
  key?: string;
  count?: number;
  fallback?: string;
}

export interface ScreenBlock {
  id: string;
  uid: string;
  show: boolean;
  geo: Record<string, string | number>;
  pos?: ScreenBlockPos;
  pat?: Record<string, string>;
  src?: Record<string, ScreenBlockSrc>;
}

export interface ScreenConfigAppearance {
  screen_config?: Record<string, { blocks: ScreenBlock[] }>;
}

export interface ScreenBlocksApi {
  /** Raw blocks from config, or undefined if this screen has never been configured. */
  configBlocks: ScreenBlock[] | undefined;
  /** Block ids to render, in order — filtered to show!==false, or the default order if unconfigured. */
  blockOrder: string[];
  /** Geometry overrides for a block id (empty object if none/unconfigured). */
  geo: (id: string) => Record<string, string | number>;
  /** Whether a block id should render at all. */
  blockVisible: (id: string) => boolean;
  /** Floating position override for a block id, if the admin dragged it off the normal flow. */
  pos: (id: string) => ScreenBlockPos | undefined;
  /** Layout-variant pattern for a block id + family (e.g. pair 'tilt'|'side'|'overlap'), falling back if unset. */
  pat: (id: string, family: string, fallback: string) => string;
  /** Raw src setting for a block id + channel ('text'|'image'|'list'), if the admin bound it to campaign data. */
  src: (id: string, channel: string) => ScreenBlockSrc | undefined;
}

/**
 * Read the configured layout for one screen. `defaultOrder` is the screen's
 * original hardcoded block order — used whenever the admin has never touched
 * this screen's layout, so unconfigured campaigns render exactly as before.
 */
export function getScreenBlocks(
  appearance: ScreenConfigAppearance | undefined,
  screenKey: string,
  defaultOrder: string[],
): ScreenBlocksApi {
  const configBlocks = appearance?.screen_config?.[screenKey]?.blocks;
  const find = (id: string) => configBlocks?.find(b => b.id === id || b.uid === id);

  return {
    configBlocks,
    blockOrder: configBlocks ? configBlocks.filter(b => b.show !== false).map(b => b.id) : defaultOrder,
    geo: id => find(id)?.geo ?? {},
    blockVisible: id => (configBlocks ? find(id)?.show !== false : true),
    pos: id => find(id)?.pos,
    pat: (id, family, fallback) => find(id)?.pat?.[family] ?? fallback,
    src: (id, channel) => find(id)?.src?.[channel],
  };
}

/**
 * Resolve a bound text value against the REAL, already-computed values for this
 * user's session (not an arbitrary sample index like the admin preview uses —
 * at runtime there's no "pick axes[2]", there's just "the axis this user got").
 *
 * `axes` is the one exception: the campaign's axes[] list is static config, not
 * a per-user computed value, so `src.idx` genuinely means something at runtime
 * ("always show axes[N]'s label") — it's resolved by index into the real list.
 * `results`/`group` resolve against whatever THIS screen already computed for
 * the current user (only screens that compute one can supply it); there is no
 * meaningful "index" for those at runtime.
 */
export interface SrcTextContext {
  axes?: Array<{ label?: string; label_en?: string; body?: string; image_url?: string }>;
  results?: Record<string, string | undefined>;
  group?: Record<string, string | undefined>;
}

export function resolveSrcText(
  src: ScreenBlockSrc | undefined,
  ctx: SrcTextContext,
  copy: Record<string, string>,
): string | undefined {
  if (!src || src.mode === 'manual') return undefined;
  if (src.mode === 'copy') return src.key ? copy[src.key] : undefined;
  if (!src.field) return undefined;
  if (src.mode === 'axes') {
    const row = ctx.axes?.[src.idx ?? 0];
    return row ? (row as Record<string, string | undefined>)[src.field] : undefined;
  }
  if (src.mode === 'results') return ctx.results?.[src.field];
  if (src.mode === 'group') return ctx.group?.[src.field];
  return undefined;
}

export interface SrcImageContext {
  axes?: Array<{ image_url?: string }>;
  results?: string;
  group?: string;
  grpImage?: string;
  grpSymbol?: string;
}

/** Same idea as resolveSrcText, for image URLs. */
export function resolveSrcImage(
  src: ScreenBlockSrc | undefined,
  ctx: SrcImageContext,
): string | undefined {
  if (!src || src.mode === 'fixed' || src.mode === 'slot') return undefined;
  if (src.mode === 'axes') return ctx.axes?.[src.idx ?? 0]?.image_url;
  if (src.mode === 'results') return ctx.results;
  if (src.mode === 'grpImage') return ctx.grpImage;
  if (src.mode === 'grpSymbol') return ctx.grpSymbol;
  return undefined;
}

/** CSS for rendering a block at its floating position — % of the 375px reference canvas so it holds up on any real viewport width. */
export function floatStyle(p: ScreenBlockPos): CSSProperties {
  const REF_W = 375;
  return {
    position: 'absolute',
    left: `${(p.x / REF_W) * 100}%`,
    top: p.y,
    width: `${(p.w / REF_W) * 100}%`,
  };
}

// ── Freeform decorative blocks ("เพิ่มบล็อก" library) ───────────────────────
//
// xImage/xText/xSpacer/xDivider/xBox have no fixed slot in any screen's own
// RENDERERS map — the admin lets you drop them onto ANY screen (LiffSection.tsx
// SLOTS, kind:'extra'). This is the one shared renderer every screen's
// RENDERERS falls back to for those ids, mirroring the admin canvas preview's
// own rendering (LiffSection.tsx renderBlockRows, cases 'xImage'..'xBox').
//
// xCard/xRow/xChip (the other 3 "extra" types) bind to real campaign data
// (axes/results/group) and are intentionally NOT handled here yet — they need
// a resolveSrcList() equivalent to resolveSrcText/resolveSrcImage above.
export function renderExtraBlock(
  id: string,
  g: Record<string, unknown>,
  copy: Record<string, string>,
  images: Record<string, string> | undefined,
  fontScale?: number,
): React.ReactNode {
  switch (id) {
    case 'xImage': {
      const src = images?.['x_image'];
      if (!src) return null;
      const h = Number(g['h']) || 160;
      const fit = (g['fit'] as CSSProperties['objectFit']) || 'cover';
      return <img key={id} src={src} alt="" style={{ display: 'block', width: '100%', height: h, objectFit: fit, borderRadius: 'var(--card-radius)' }} />;
    }
    case 'xText': {
      const text = copy['x_text'];
      if (!text) return null;
      const size = Number(g['size']) || 14;
      const align = (g['align'] as CSSProperties['textAlign']) || 'center';
      return (
        <div key={id} style={{ display: 'block', textAlign: align, font: `600 ${scaleFont(size, fontScale)}px/1.6 var(--font-body,'Bai Jamjuree'),sans-serif`, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
          {text}
        </div>
      );
    }
    case 'xSpacer':
      return <div key={id} style={{ display: 'block', height: Number(g['h']) || 16 }} />;
    case 'xDivider':
      return <div key={id} style={{ display: 'block', height: 2, background: 'rgba(28,26,23,.15)' }} />;
    case 'xBox': {
      const color = g['xbgColor'];
      const bg = color === 'primary' ? 'var(--ac)' : color === 'soft' ? 'var(--accent-soft)' : color === 'surface' ? 'var(--card)' : 'var(--hl)';
      return <div key={id} style={{ display: 'block', height: Number(g['h']) || 80, borderRadius: Number(g['xRadius']) || 12, background: bg }} />;
    }
    default:
      return null;
  }
}

// ── Font scale (03 Typography) ──────────────────────────────────────────────

/**
 * Scale a literal px font-size by the campaign's Font Scale setting.
 * Mirrors the admin builder's own `px()` preview helper exactly, so a
 * campaign that sets Font Scale sees the same result in both places.
 */
export function scaleFont(px: number, fontScale?: number): number {
  return Math.round(px * (fontScale ?? 1));
}

// ── Global Art Style / Shape & Feel → per-block pattern defaults (05) ──────
//
// Per-block pattern pickers (pat.survivorCard.solo, pat.hero2.pair, pat.grpHero.group,
// pat.axisChips.chip, ...) are independent state from the global "05 Art Style" tab.
// This resolves what a block's pattern should default to when the admin hasn't set
// an explicit per-block override — i.e. global sets the fallback, per-block `pat`
// (already persisted via screen_config) wins whenever it's actually set.
//
// Mirrors admin/src/components/sections/LiffSection.tsx's DEFAULT_ART exactly, so a
// campaign that never touches Art Style renders identically to before this wiring.

export interface ArtStyleAppearance {
  art_shape?: 'card' | 'circle' | 'square' | 'wide' | 'none';
  art_frame?: 'outline' | 'soft' | 'flat';
  art_hero?: 'pair' | 'single' | 'band';
  group_hero_pattern?: 'fan' | 'grid';
}

export interface PatternDefaults {
  /** survivorCard's solo shape family (portrait/square/circle) */
  solo: string;
  /** hero2/matArt's two-card arrangement (tilt/side/overlap) — no global equivalent, always 'tilt' */
  pair: string;
  /** grpHero's arrangement (fan/stack/grid) */
  group: string;
  /** axisChips/axisCounts/xChip's chip shape (pill/soft/cut) — no global equivalent, always 'pill' */
  chip: string;
  /** hero2's overall structure: 'pair' = two tilted cards, 'single' = one image, 'band' = color bar, no image */
  artHero: 'pair' | 'single' | 'band';
}

export function getPatternDefaults(appearance?: ArtStyleAppearance): PatternDefaults {
  const artShape = appearance?.art_shape ?? 'card';
  // pat.survivorCard.solo only has portrait/square/circle — map the closer global
  // options onto it and fall back to 'portrait' (the original hardcoded default)
  // for shapes (wide/none/card) that don't have a direct solo equivalent.
  const solo = artShape === 'circle' ? 'circle' : artShape === 'square' ? 'square' : 'portrait';
  return {
    solo,
    pair: 'tilt',
    group: appearance?.group_hero_pattern ?? 'fan',
    chip: 'pill',
    artHero: appearance?.art_hero ?? 'pair',
  };
}
