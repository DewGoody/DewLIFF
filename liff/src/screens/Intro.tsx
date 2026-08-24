import { useState } from 'react';

interface Props {
  config: {
    brand?: { logo_url?: string; kv_image_url?: string; primary?: string; surface?: string; on_surface?: string };
    copy?: Record<string, string>;
    mode?: string;
    questions?: unknown[];
    axes?: unknown[];
    appearance?: { intro_layout?: string; images?: Record<string, string> };
  };
  onStart: (demo: boolean) => void;
}

export default function Intro({ config, onStart }: Props) {
  const [starting, setStarting] = useState(false);
  const isSolo = config.mode === 'solo';
  const copy = config.copy || {};
  const brand = config.brand || {};

  const titleRaw = copy.intro_title || 'โลกแตกพรุ่งนี้\nเรารอดกี่วัน';
  const titleLines = titleRaw.split('\n');
  const titleLine1 = titleLines[0] || '';
  const titleLine2 = titleLines[1] || '';

  const eyebrow = copy.intro_eyebrow || 'APOCALYPSE DUO · PAIR QUIZ';
  const bodyText = copy.intro_body || '';
  const ctaText = copy.intro_cta || 'เริ่มเอาตัวรอด →';
  const demoCta = copy.demo_cta || 'ลองกับคู่หูตัวอย่าง';
  const appearance = config.appearance || {};
  const introLayout = appearance.intro_layout || 'kv55';
  // kv-intro from appearance.images takes priority, then brand.kv_image_url
  const kvUrl = appearance.images?.['kv-intro'] || brand.kv_image_url;
  const primary = brand.primary || '#D95F2B';
  const surface = brand.surface || '#0C0B0A';
  const onSurface = brand.on_surface || '#EDE7DF';

  // Layout-driven KV height
  const kvHeight = introLayout === 'fullbleed' ? '80%' : introLayout === 'compact' ? '32%' : '55%';

  const qCount = config.questions?.length ?? 6;
  const axCount = config.axes?.length ?? 5;

  const handleStart = (demo: boolean) => {
    if (starting) return;
    setStarting(true);
    onStart(demo);
  };

  return (
    <div className="screen fade-enter" style={{ background: surface }}>
      {/* KV area */}
      <div style={{ height: kvHeight, flexShrink: 0, position: 'relative', background: '#100E0C', overflow: 'hidden' }}>
        <div className="tex" />
        {kvUrl ? (
          <img
            src={kvUrl}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            position: 'absolute', left: 18, top: 18,
            font: "500 9.5px 'IBM Plex Mono',monospace", letterSpacing: '.12em',
            color: 'rgba(237,231,223,.34)', border: '1px dashed rgba(237,231,223,.22)',
            padding: '5px 8px', borderRadius: 3,
          }}>
            KV IMAGE — ตั้งค่า kv_image_url
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%', background: `linear-gradient(to top,rgba(${hexToRgb(primary)},.34),transparent)` }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, background: `linear-gradient(to top,${surface},transparent)` }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 52, textAlign: 'center',
          font: "700 40px/1.18 'IBM Plex Sans Thai',sans-serif",
          color: onSurface, textShadow: '0 4px 30px rgba(0,0,0,.9)',
        }}>
          {titleLine1}
          {titleLine2 && <><br /><span style={{ color: primary }}>{titleLine2}</span></>}
        </div>
      </div>

      {/* Content bottom */}
      <div style={{ flex: 1, padding: '26px 26px 30px', display: 'flex', flexDirection: 'column' }}>
        {eyebrow && (
          <div style={{ font: "500 10px 'IBM Plex Mono',monospace", letterSpacing: '.2em', color: primary, marginBottom: 12 }}>
            {eyebrow}
          </div>
        )}
        {bodyText && (
          <div
            style={{ font: "300 15px/1.85 'IBM Plex Sans Thai',sans-serif", color: `${onSurface}b3` }}
            dangerouslySetInnerHTML={{ __html: bodyText.replace(/\*\*(.*?)\*\*/g, `<b style="font-weight:600;color:${onSurface}">$1</b>`) }}
          />
        )}
        <div style={{ display: 'flex', gap: 18, marginTop: 20, font: "400 11px/1.5 'IBM Plex Mono',monospace", color: `${onSurface}61` }}>
          <span>{qCount} ข้อ</span><span>·</span><span>1 นาที</span><span>·</span><span>{axCount} สาย</span>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <button className="btn-primary" onClick={() => handleStart(false)} disabled={starting}>
            {starting ? 'กำลังโหลด...' : ctaText}
          </button>
          {!isSolo && (
            <button className="btn-outline" onClick={() => handleStart(true)} disabled={starting}>
              {demoCta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r)) return '217,95,43';
  return `${r},${g},${b}`;
}
