import { useState } from 'react';
import type { AppearanceConfig } from '../../types';
import ImageUploader from '../ImageUploader';

type SoloZones  = NonNullable<NonNullable<AppearanceConfig['og_zones']>['solo']>;
type PairZones  = NonNullable<NonNullable<AppearanceConfig['og_zones']>['pair']>;
type GroupZones = NonNullable<NonNullable<AppearanceConfig['og_zones']>['group']>;

interface Axis { id: string; label: string }

interface Props {
  mode: string;
  axes: Axis[];
  appearance: AppearanceConfig;
  onChange: (appearance: AppearanceConfig) => void;
}

const ROW = { display: 'flex', flexDirection: 'column' as const, gap: 6 };
const LABEL: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#333' };
const NUM_INPUT: React.CSSProperties = {
  width: 80, padding: '5px 8px', border: '1.5px solid #E5E5E3', borderRadius: 6,
  fontFamily: "'JetBrains Mono',monospace", fontSize: 12, outline: 'none', boxSizing: 'border-box' as const,
};
const SEC_TITLE: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#111',
  padding: '14px 20px 10px', borderBottom: '1.5px solid #E5E5E3',
};

export default function ShareFrameSection({ axes, appearance, onChange }: Props) {
  const [zonesOpen, setZonesOpen] = useState(false);

  const frames = appearance.og_frames ?? {};
  const zones  = appearance.og_zones  ?? {};

  const setFrames = (patch: Partial<NonNullable<AppearanceConfig['og_frames']>>) =>
    onChange({ ...appearance, og_frames: { ...frames, ...patch } });

  const setSoloZone = (patch: Partial<SoloZones>) =>
    onChange({ ...appearance, og_zones: { ...zones, solo: { ...(zones.solo ?? {}), ...patch } } });
  const setPairZone = (patch: Partial<PairZones>) =>
    onChange({ ...appearance, og_zones: { ...zones, pair: { ...(zones.pair ?? {}), ...patch } } });
  const setGroupZone = (patch: Partial<GroupZones>) =>
    onChange({ ...appearance, og_zones: { ...zones, group: { ...(zones.group ?? {}), ...patch } } });

  const setSoloFrame = (axisId: string, url: string | null) => {
    const solo = { ...(frames.solo ?? {}) };
    if (url) solo[axisId] = url;
    else delete solo[axisId];
    setFrames({ solo });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* ── Solo Frames ── */}
      <div style={SEC_TITLE}>Solo / MBTI — frame per archetype</div>
      <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {axes.length === 0 && (
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#aaa' }}>
            ยังไม่มี axis — เพิ่มใน Data tab ก่อน
          </span>
        )}
        {axes.map(ax => (
          <div key={ax.id} style={{ width: 200 }}>
            <div style={{ ...LABEL, marginBottom: 6 }}>{ax.label} <span style={{ color: '#aaa', fontWeight: 400 }}>({ax.id})</span></div>
            <ImageUploader
              value={frames.solo?.[ax.id] ?? null}
              onChange={url => setSoloFrame(ax.id, url)}
              aspectRatio="9:16"
              hint="1080×1920 px"
            />
          </div>
        ))}
      </div>

      {/* ── Pair Frame ── */}
      <div style={SEC_TITLE}>Pair — frame เดียว</div>
      <div style={{ padding: '16px 20px', display: 'flex', gap: 20 }}>
        <div style={{ width: 200 }}>
          <div style={{ ...LABEL, marginBottom: 6 }}>Pair Frame</div>
          <ImageUploader
            value={frames.pair ?? null}
            onChange={url => setFrames({ pair: url ?? undefined })}
            aspectRatio="9:16"
            hint="1080×1920 px"
          />
        </div>
      </div>

      {/* ── Group Frame ── */}
      <div style={SEC_TITLE}>Group — frame เดียว</div>
      <div style={{ padding: '16px 20px', display: 'flex', gap: 20 }}>
        <div style={{ width: 200 }}>
          <div style={{ ...LABEL, marginBottom: 6 }}>Group Frame</div>
          <ImageUploader
            value={frames.group ?? null}
            onChange={url => setFrames({ group: url ?? undefined })}
            aspectRatio="9:16"
            hint="1080×1920 px"
          />
        </div>
      </div>

      {/* ── Zone Coordinates (advanced) ── */}
      <div
        onClick={() => setZonesOpen(v => !v)}
        style={{ ...SEC_TITLE, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
      >
        <span>Zone Coordinates (advanced)</span>
        <span style={{ fontSize: 10, color: '#888' }}>{zonesOpen ? '▲' : '▼'}</span>
      </div>

      {zonesOpen && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#aaa', maxWidth: 520, lineHeight: 1.6 }}>
            ตำแหน่ง pixel ของ text overlay — ปรับเมื่อ custom frame มี text zone ต่างจาก default ·
            เว้นว่างเพื่อใช้ default (solo: text_x=148, label_y=1437 · pair: badge_x=96, badge_y=1295 · group: badge_x=175, badge_y=1370)
          </div>

          {/* Solo zones */}
          <div>
            <div style={{ ...LABEL, marginBottom: 10 }}>Solo zones</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {([['text_x', 'Text X', '148'], ['title_y', 'Title Y', '1345'], ['label_y', 'Label Y', '1437'], ['body_y_start', 'Body Y start', '1515']] as const).map(([k, lbl, ph]) => (
                <div key={k} style={ROW}>
                  <label style={LABEL}>{lbl}</label>
                  <input type="number" style={NUM_INPUT} placeholder={ph} value={zones.solo?.[k] ?? ''}
                    onChange={e => setSoloZone({ [k]: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
              ))}
            </div>
          </div>

          {/* Pair zones */}
          <div>
            <div style={{ ...LABEL, marginBottom: 10 }}>Pair zones</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {([['badge_x', 'Badge X', '96'], ['badge_y', 'Badge Y', '1295'], ['body_y_start', 'Body Y start', '1500']] as const).map(([k, lbl, ph]) => (
                <div key={k} style={ROW}>
                  <label style={LABEL}>{lbl}</label>
                  <input type="number" style={NUM_INPUT} placeholder={ph} value={zones.pair?.[k] ?? ''}
                    onChange={e => setPairZone({ [k]: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
              ))}
            </div>
          </div>

          {/* Group zones */}
          <div>
            <div style={{ ...LABEL, marginBottom: 10 }}>Group zones</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {([['badge_x', 'Badge X', '175'], ['badge_y', 'Badge Y', '1370'], ['body_y_start', 'Body Y start', '1503']] as const).map(([k, lbl, ph]) => (
                <div key={k} style={ROW}>
                  <label style={LABEL}>{lbl}</label>
                  <input type="number" style={NUM_INPUT} placeholder={ph} value={zones.group?.[k] ?? ''}
                    onChange={e => setGroupZone({ [k]: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
