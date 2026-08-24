import { useState, useEffect, useRef, useCallback } from 'react';
import type { EditorState } from '../types';

interface Props {
  state: EditorState;
  onChange: (state: EditorState) => void;
}

// Convert EditorState → AppConfig subset for LIFF preview
function toPreviewConfig(state: EditorState) {
  return {
    brand: state.brand,
    copy: state.copy,
    mode: state.mode,
    rewards: state.rewards,
    axes: state.axes.map(({ id, label }) => ({ id, label })),
    questions: state.questions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options.map(o => ({ id: o.id, label: o.label })),
    })),
  };
}

const SCREENS: Record<string, string> = {
  loading: 'กำลังโหลด',
  intro: 'หน้าแรก',
  question: 'คำถาม',
  share: 'แชร์',
  summary: 'สรุป',
  rewards: 'รางวัล',
  'pair-result': 'ผลคู่',
  invited: 'รับเชิญ',
  error: 'Error',
};

// Minimal color picker
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <input
        type="color"
        value={value || '#000000'}
        onChange={e => onChange(e.target.value)}
        style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 4, cursor: 'pointer', background: 'none' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{ width: '100%', fontSize: 12, fontFamily: 'monospace', border: '1px solid #e5e5e5', borderRadius: 4, padding: '3px 6px', outline: 'none' }}
        />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const style = { width: '100%', fontSize: 12, border: '1px solid #e5e5e5', borderRadius: 4, padding: '5px 7px', outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.5 };
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{label}</div>
      {multiline
        ? <textarea rows={2} value={value || ''} onChange={e => onChange(e.target.value)} style={style} />
        : <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} style={style} />
      }
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#aaa', textTransform: 'uppercase', margin: '14px 0 8px', borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
      {label}
    </div>
  );
}

export default function PlayPreview({ state, onChange }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<string>('loading');
  const [key, setKey] = useState(0);

  // Listen for messages from LIFF iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'preview_ready') {
        setReady(true);
        setCurrentScreen('intro');
      }
      if (e.data?.type === 'preview_screen') {
        setCurrentScreen(e.data.screen || '');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Send config to iframe when ready or when state changes
  useEffect(() => {
    if (!ready || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: 'preview_config', config: toPreviewConfig(state) },
      '*'
    );
  }, [ready, state]);

  const handleReset = useCallback(() => {
    setReady(false);
    setCurrentScreen('loading');
    setKey(k => k + 1);
  }, []);

  // Helpers to update nested state
  const setBrand = useCallback((key: string, value: string) => {
    onChange({ ...state, brand: { ...state.brand, [key]: value } });
  }, [state, onChange]);

  const setCopy = useCallback((key: string, value: string) => {
    onChange({ ...state, copy: { ...state.copy, [key]: value } });
  }, [state, onChange]);

  const screenLabel = SCREENS[currentScreen] || currentScreen;
  const { brand, copy } = state;

  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', padding: '4px 0' }}>
      {/* Phone frame — scaled to fit viewport */}
      <div style={{
        position: 'relative', width: 320, height: 580, borderRadius: 30, overflow: 'hidden',
        boxShadow: '0 0 0 2px #d4d4d4, 0 6px 24px rgba(0,0,0,.14)', flexShrink: 0, background: '#0C0B0A',
      }}>
        {!ready && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column', gap: 12,
            background: '#0C0B0A', color: '#666', fontSize: 13, zIndex: 2,
          }}>
            <div>กำลังโหลด LIFF preview...</div>
          </div>
        )}
        <iframe
          key={key}
          ref={iframeRef}
          src="/liff-app/?preview=1"
          style={{ width: 375, height: 700, border: 'none', display: 'block', transformOrigin: 'top left', transform: 'scale(0.853)' }}
          title="LIFF Preview"
        />
      </div>

      {/* Visual config panel */}
      <div style={{ flex: 1, maxWidth: 280, maxHeight: 580, overflowY: 'auto', paddingRight: 4 }}>
        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: ready ? '#22c55e' : '#f59e0b' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{ready ? screenLabel : 'กำลังเชื่อมต่อ...'}</span>
          </div>
          <button
            onClick={handleReset}
            style={{ fontSize: 12, color: '#888', background: 'none', border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          >
            ↺ รีเซ็ต
          </button>
        </div>

        {/* === COLORS === */}
        <SectionHeader label="สี" />
        <ColorField label="Primary (ปุ่ม / accent)" value={brand.primary} onChange={v => setBrand('primary', v)} />
        <ColorField label="Surface (พื้นหลัง)" value={brand.surface} onChange={v => setBrand('surface', v)} />
        <ColorField label="On Surface (ข้อความ)" value={brand.on_surface} onChange={v => setBrand('on_surface', v)} />

        {/* === IMAGES === */}
        <SectionHeader label="รูปภาพ" />
        <TextField label="KV Image URL (หน้าแรก)" value={brand.kv_image_url || ''} onChange={v => setBrand('kv_image_url', v)} />
        <TextField label="Logo URL" value={brand.logo_url || ''} onChange={v => setBrand('logo_url', v)} />
        {brand.kv_image_url && (
          <img src={brand.kv_image_url} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 8, maxHeight: 100, objectFit: 'cover' }} onError={e => (e.currentTarget.style.display = 'none')} />
        )}

        {/* === INTRO COPY === */}
        <SectionHeader label="หน้าแรก (Intro)" />
        <TextField label="Eyebrow (บรรทัดเล็กบน)" value={copy.intro_eyebrow || ''} onChange={v => setCopy('intro_eyebrow', v)} />
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>
            Title (ใช้ \n แบ่งบรรทัด — บรรทัด 2 = สี primary)
          </div>
          <textarea
            rows={2}
            value={copy.intro_title || ''}
            onChange={e => setCopy('intro_title', e.target.value)}
            style={{ width: '100%', fontSize: 12, border: '1px solid #e5e5e5', borderRadius: 4, padding: '5px 7px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            placeholder={'โลกแตกพรุ่งนี้\nเรารอดกี่วัน'}
          />
        </div>
        <TextField label="Body (เนื้อหา, **bold** ได้)" value={copy.intro_body || ''} onChange={v => setCopy('intro_body', v)} multiline />
        <TextField label="CTA หลัก" value={copy.intro_cta || ''} onChange={v => setCopy('intro_cta', v)} />
        <TextField label="Demo CTA" value={copy.demo_cta || ''} onChange={v => setCopy('demo_cta', v)} />

        {/* === QUESTION COPY === */}
        <SectionHeader label="คำถาม" />
        <TextField label="Counter format ({current}/{total})" value={copy.question_counter || ''} onChange={v => setCopy('question_counter', v)} />

        {/* === SHARE / RESULT === */}
        <SectionHeader label="แชร์ / ผลลัพธ์" />
        <TextField label="Share title" value={copy.share_title || ''} onChange={v => setCopy('share_title', v)} />
        <TextField label="Share CTA" value={copy.share_cta || ''} onChange={v => setCopy('share_cta', v)} />
        <TextField label="Result eyebrow" value={copy.result_eyebrow || ''} onChange={v => setCopy('result_eyebrow', v)} />

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
