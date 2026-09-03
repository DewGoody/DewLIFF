import { getScreenBlocks, resolveSrcText, floatStyle, scaleFont } from '../screenConfig';

interface AxisConfig { label?: string; label_en?: string; body?: string; image_url?: string }

interface Props {
  title: string;
  body: string;
  onRetry?: () => void;
  copy?: Record<string, string>;
  cardUrl?: string;
  // NOTE: App.tsx's <ErrorScreen> call site does not currently pass these — it only
  // forwards title/body/onRetry/copy/cardUrl. Until that call site is updated to also
  // pass config.appearance / config.axes (same as Loading/Intro already receive), these
  // default to empty and the screen_config wiring below is inert / falls back to the
  // original hardcoded order+content, so today's rendering is unaffected.
  axes?: AxisConfig[];
  appearance?: { images?: Record<string, string>; screen_config?: Record<string, { blocks: any[] }>; font_scale?: number };
}

const DEFAULT_ORDER = ['errArt', 'errCopy', 'errRetry'];

export default function ErrorScreen({ title, body, onRetry, copy = {}, cardUrl, axes = [], appearance = {} }: Props) {
  const card = cardUrl || undefined;
  const fontScale = appearance.font_scale;
  const handleClose = () => { try { liff.closeWindow(); } catch { window.close(); } };

  // ── screen_config wiring: order / show / geo / float position / data source ──
  const { blockOrder, blockVisible, geo: geoOf, pos, src } = getScreenBlocks(appearance, 'Error', DEFAULT_ORDER);
  const geo = (id: string): Record<string, string | number> => geoOf(id);

  const artSize = Number(geo('errArt').h) || 150;
  const copyAlign = (geo('errCopy').align as string) || 'center';

  // errCopy's primary field is the heading (copy.error_heading today) — if the admin
  // bound it to real campaign data instead of typing it manually, resolve against that.
  const headingSrc = resolveSrcText(src('errCopy', 'text'), { axes }, copy);
  const heading = copy.error_heading || headingSrc || 'อ๊ะ! สัญญาณหลุด';

  // errRetry's only field is the button label.
  const retryLabelSrc = resolveSrcText(src('errRetry', 'text'), { axes }, copy);
  const retryLabel = copy.error_retry_btn || retryLabelSrc || 'ลองอีกครั้ง';

  // ── Block renderers ────────────────────────────────────────────────────────

  const renderErrArt = () => (
    <div key="errArt" style={{ width: artSize, height: artSize, position: 'relative', animation: 'v2Shake 2s ease-in-out infinite' }}>
      {card ? <img src={card} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
    </div>
  );

  const renderErrCopy = () => (
    <div key="errCopy" style={{ textAlign: copyAlign as React.CSSProperties['textAlign'] }}>
      <div style={{ font: `700 ${scaleFont(26, fontScale)}px/1.3 'Bai Jamjuree',sans-serif`, marginTop: 24 }}>{heading}</div>
      <div style={{ font: `500 ${scaleFont(14, fontScale)}px/1.7 'Bai Jamjuree',sans-serif`, color: 'rgba(28,26,23,.6)', marginTop: 8 }}>{body || copy.error_body_default || 'โลกกำลังจะแตกก็แบบนี้แหละ ลองอีกทีนะ'}</div>
      {title && <div style={{ font: `600 ${scaleFont(11, fontScale)}px/1.5 'Bai Jamjuree',sans-serif`, color: 'rgba(28,26,23,.35)', marginTop: 12 }}>{title}</div>}
    </div>
  );

  const renderErrRetry = () => onRetry ? (
    <button
      key="errRetry"
      onClick={onRetry}
      style={{ marginTop: 24, background: '#E8354F', color: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 13, padding: '14px 32px', font: `700 ${scaleFont(17, fontScale)}px/1 'Bai Jamjuree',sans-serif`, cursor: 'pointer', boxShadow: '4px 5px 0 #1C1A17' }}
    >{retryLabel}</button>
  ) : null;

  const RENDERERS: Record<string, () => React.ReactNode> = {
    errArt: renderErrArt,
    errCopy: renderErrCopy,
    errRetry: renderErrRetry,
  };

  // ── Build output ──────────────────────────────────────────────────────────

  const visible = blockOrder.filter(blockVisible);
  const flowIds = visible.filter(id => !pos(id));
  const floatIds = visible.filter(id => pos(id));

  return (
    <div className="screen" style={{ background: '#F7F1E3', alignItems: 'center', justifyContent: 'center', padding: '0 20px', textAlign: 'center', position: floatIds.length ? 'relative' : undefined }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--texture-bg)', pointerEvents: 'none' }} />
      {flowIds.map(id => RENDERERS[id]?.())}
      {floatIds.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}
      {/* Close button — not an admin-configurable slot (not in SCREENS_V3's Error entry), always rendered */}
      <button
        onClick={handleClose}
        style={{ marginTop: 12, background: 'none', border: 'none', color: 'rgba(28,26,23,.45)', font: `600 ${scaleFont(11, fontScale)}px/1.5 'Bai Jamjuree',sans-serif`, cursor: 'pointer', padding: 4 }}
      >{copy.error_close_btn || 'กลับหน้าแรก'}</button>
    </div>
  );
}
