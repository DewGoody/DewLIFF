import { useState, useEffect } from 'react';
import { api } from '../api';
import { getScreenBlocks, floatStyle, scaleFont } from '../screenConfig';

interface Archetype {
  code: string;
  title: string;
  body?: string;
  image_url?: string;
  symbol_url?: string;
  fallback?: boolean;
}

interface Props {
  config: {
    group?: { archetypes?: Archetype[] };
    copy?: Record<string, string>;
    brand?: { primary?: string };
    appearance?: { screen_config?: Record<string, { blocks: any[] }>; font_scale?: number; [key: string]: unknown };
  };
  campaignId: string;
  onBack: () => void;
}

const DEFAULT_ORDER = ['topNav', 'symGrid'];

export default function SymbolCollection({ config, campaignId, onBack }: Props) {
  const [unlockedCodes, setUnlockedCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Archetype | null>(null);

  const copy = config.copy || {};
  const primary = config.brand?.primary || '#E8354F';
  const appearance = config.appearance || {};

  // All archetypes with a symbol are collectible (including fallback-role archetypes)
  const all: Archetype[] = (config.group?.archetypes || []).filter(a => a.symbol_url || a.image_url);
  const total = all.length;
  const unlocked = unlockedCodes.length;

  useEffect(() => {
    api<{ unlockedSymbols: string[] }>('GET', `/api/quiz/my-symbols?campaignId=${campaignId}`)
      .then(d => setUnlockedCodes(d.unlockedSymbols))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  // ── screen_config wiring: order / show / geo / float position ──────────────
  // topNav and symGrid have no data-source channel in the admin builder
  // (CH_OF doesn't list them), so there's no src() binding to resolve here.
  const { blockOrder, blockVisible, geo, pos } = getScreenBlocks(appearance, 'Symbols', DEFAULT_ORDER);

  const symGridCols = (geo('symGrid').cols as string) === '4' ? 4 : 3;

  // ── Block renderers ────────────────────────────────────────────────────────

  const renderTopNav = () => (
    <div key="topNav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', borderBottom: '1.5px solid rgba(28,26,23,.1)', background: '#F7F1E3', position: 'sticky', top: 0, zIndex: 10 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', font: "600 15px 'Bai Jamjuree',sans-serif", color: '#1C1A17', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: scaleFont(17, config.appearance?.font_scale), lineHeight: 1 }}>✕</span>
        <span style={{ font: "700 14px 'Bai Jamjuree',sans-serif" }}>{copy.symbols_title || 'สะสมสัญลักษณ์'}</span>
      </button>
      <span style={{ fontFamily: 'Bangers, cursive', fontSize: scaleFont(17, config.appearance?.font_scale), letterSpacing: '.06em', color: loading ? 'rgba(28,26,23,.3)' : primary }}>
        {loading ? '...' : `${unlocked} / ${total} ดวง`}
      </span>
    </div>
  );

  const renderSymGrid = () => (
    <div key="symGrid">
      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(28,26,23,.08)' }}>
        {!loading && total > 0 && (
          <div style={{ height: '100%', width: `${Math.round((unlocked / total) * 100)}%`, background: primary, transition: 'width .5s' }} />
        )}
      </div>

      {/* Grid */}
      <div style={{ padding: '16px 14px 32px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(28,26,23,.12)', borderTopColor: primary, borderRadius: '50%', animation: 'v2Spin .8s linear infinite' }} />
          </div>
        ) : all.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(28,26,23,.4)', font: "500 13px 'Bai Jamjuree',sans-serif" }}>
            {copy.symbols_empty || 'ยังไม่มีสัญลักษณ์ในแคมเปญนี้'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${symGridCols}, 1fr)`, gap: 10 }}>
            {all.map(arch => {
              const isUnlocked = unlockedCodes.includes(arch.code);
              const imgUrl = arch.symbol_url || arch.image_url;
              return (
                <div
                  key={arch.code}
                  onClick={() => isUnlocked && setSelected(arch)}
                  style={{
                    background: '#FFFDF6',
                    border: `2px solid ${isUnlocked ? '#1C1A17' : 'rgba(28,26,23,.2)'}`,
                    borderRadius: 'var(--card-radius)',
                    overflow: 'hidden',
                    cursor: isUnlocked ? 'pointer' : 'default',
                    boxShadow: isUnlocked ? '3px 3px 0 #1C1A17' : 'none',
                    opacity: isUnlocked ? 1 : 0.7,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Image area */}
                  <div style={{
                    background: isUnlocked ? 'var(--hl)' : '#DDD8CC',
                    aspectRatio: '1 / 1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt=""
                        style={{
                          width: '80%',
                          height: '80%',
                          objectFit: 'contain',
                          filter: isUnlocked ? 'none' : 'brightness(0)',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: scaleFont(32, config.appearance?.font_scale), filter: isUnlocked ? 'none' : 'grayscale(1) brightness(0.3)' }}>?</span>
                    )}
                    {isUnlocked && (
                      <div style={{
                        position: 'absolute', top: 5, right: 5,
                        width: 18, height: 18,
                        background: primary, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1.5px solid #1C1A17',
                      }}>
                        <span style={{ color: '#fff', fontSize: scaleFont(10, config.appearance?.font_scale), fontWeight: 800, lineHeight: 1 }}>✓</span>
                      </div>
                    )}
                  </div>
                  {/* Label */}
                  <div style={{ padding: '7px 8px 8px', flex: 1 }}>
                    <div style={{
                      font: "700 11px/1.3 'Bai Jamjuree',sans-serif",
                      color: isUnlocked ? '#1C1A17' : 'rgba(28,26,23,.35)',
                      textAlign: 'center',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {isUnlocked ? arch.title : '???'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom hint */}
        {!loading && total > 0 && unlocked < total && (
          <div style={{ marginTop: 20, textAlign: 'center', font: "500 12px/1.6 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.4)' }}>
            {copy.symbols_hint || `สร้างทีมครบ 5 คน แล้วแชร์ผล เพื่อปลดล็อกสัญลักษณ์ใหม่`}
          </div>
        )}
        {!loading && unlocked === total && total > 0 && (
          <div style={{ marginTop: 20, textAlign: 'center', font: "700 13px/1.6 'Bai Jamjuree',sans-serif", color: primary }}>
            {copy.symbols_complete || '🎉 สะสมครบทุกดวงแล้ว!'}
          </div>
        )}
      </div>
    </div>
  );

  const RENDERERS: Record<string, () => React.ReactNode> = {
    topNav: renderTopNav,
    symGrid: renderSymGrid,
  };

  // ── Build output ──────────────────────────────────────────────────────────

  const visible = blockOrder.filter(blockVisible);
  const flowIds = visible.filter(id => !pos(id));
  const floatIds = visible.filter(id => pos(id));

  return (
    <div className="screen fade-enter" style={{ background: '#F7F1E3', overflowY: 'auto', position: floatIds.length ? 'relative' : undefined }}>
      {flowIds.map(id => RENDERERS[id]?.())}
      {floatIds.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}

      {/* Detail popup — tap unlocked card (always available, not a slot) */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,26,23,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 320, background: '#FFFDF6', border: '2.5px solid #1C1A17', borderRadius: 16, overflow: 'hidden', boxShadow: '4px 5px 0 #1C1A17' }}
          >
            <div style={{ background: '#F5E14B', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(selected.symbol_url || selected.image_url) && (
                <img src={selected.symbol_url || selected.image_url} alt="" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
              )}
            </div>
            <div style={{ padding: '16px 18px 20px' }}>
              <div style={{ font: "700 18px/1.3 'Bai Jamjuree',sans-serif", color: '#1C1A17' }}>{selected.title}</div>
              {selected.body && <div style={{ font: "500 13px/1.6 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.65)', marginTop: 8 }}>{selected.body}</div>}
              <button
                onClick={() => setSelected(null)}
                style={{ marginTop: 16, width: '100%', padding: '12px', background: 'none', border: '2px solid rgba(28,26,23,.2)', borderRadius: 10, font: "600 13px 'Bai Jamjuree',sans-serif", color: 'rgba(28,26,23,.5)', cursor: 'pointer' }}
              >ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
