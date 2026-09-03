import { useState } from 'react';
import type { EditorAxis, EditorQuestion } from '../../types';
import { PALETTE } from '../../utils';
import ImageUploader from '../ImageUploader';

interface Props {
  axes: EditorAxis[];
  questions: EditorQuestion[];
  onChange: (axes: EditorAxis[], questions: EditorQuestion[]) => void;
  mode?: string;
}

const MONO: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace",
  fontSize: 10.5,
  letterSpacing: '.08em',
  color: '#A0A5AA',
  marginBottom: 5,
  textTransform: 'uppercase' as const,
};

export default function AxesSection({ axes, questions, onChange, mode }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const set = (i: number, patch: Partial<EditorAxis>) => {
    onChange(axes.map((a, idx) => idx === i ? { ...a, ...patch } : a), questions);
  };

  const addAxis = () => {
    if (axes.length >= PALETTE.length) return;
    const id = 'axis_' + Date.now();
    onChange([...axes, { id, label: 'แกนใหม่', color: PALETTE[axes.length] }], questions);
  };

  const deleteAxis = (i: number) => {
    const removed = axes[i];
    const nextAxes = axes.filter((_, idx) => idx !== i);
    const nextQuestions = questions.map(q => ({
      ...q,
      options: q.options.map(o => {
        const scores = { ...o.scores };
        delete scores[removed.id];
        return { ...o, scores };
      }),
    }));
    onChange(nextAxes, nextQuestions);
  };

  return (
    <div className="section" id="sec-axes">
      <div className="section-head">
        <span className="section-num">Step 1</span>
        <span className="section-title">ตั้งแกนบุคลิก</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {axes.map((ax, i) => {
          const isExpanded = expanded[ax.id] ?? false;
          return (
            <div key={ax.id} style={{ border: '1px solid #E5E5E3', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
              {/* Header row: color + label + id + expand toggle + delete */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: isExpanded ? '1px solid #F0F0EE' : 'none' }}>
                <input
                  type="color"
                  value={ax.color}
                  onChange={e => set(i, { color: e.target.value })}
                  style={{ width: 26, height: 26, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    value={ax.label}
                    onChange={e => set(i, { label: e.target.value })}
                    placeholder="ชื่อแกน"
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600, background: 'transparent', padding: 0 }}
                  />
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#9B9B98', marginTop: 2 }}>{ax.id}</div>
                </div>
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [ax.id]: !isExpanded }))}
                  style={{ padding: '4px 10px', border: '1px solid #E5E5E3', background: '#F7F7F5', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#5C5C58', flexShrink: 0, fontFamily: "'JetBrains Mono',monospace" }}
                >{isExpanded ? '▴ ย่อ' : '▾ แก้ไข'}</button>
                <button
                  onClick={() => deleteAxis(i)}
                  style={{ width: 26, height: 26, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#E63B2E', flexShrink: 0 }}
                >×</button>
              </div>

              {/* Expanded: all axis fields */}
              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {mode !== 'mbti' && (
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Row: EN Title + Short + Order */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
                        <div>
                          <div style={MONO}>EN Title <span style={{ color: '#C5C5C2' }}>· ชื่อภาษาอังกฤษ (e.g. THE PREPPER)</span></div>
                          <input
                            value={ax.label_en ?? ''}
                            onChange={e => set(i, { label_en: e.target.value || undefined })}
                            placeholder="THE PREPPER"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 13, outline: 'none' }}
                          />
                        </div>
                        <div>
                          <div style={MONO}>Short <span style={{ color: '#C5C5C2' }}>· คำอธิบายสั้น บน axis chip</span></div>
                          <input
                            value={ax.short ?? ''}
                            onChange={e => set(i, { short: e.target.value || undefined })}
                            placeholder="เตรียมมากกว่าทุกคน"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 13, outline: 'none' }}
                          />
                        </div>
                        <div style={{ minWidth: 80 }}>
                          <div style={MONO}>Order <span style={{ color: '#C5C5C2' }}>· ลำดับ</span></div>
                          <input
                            value={ax.order ?? ''}
                            onChange={e => set(i, { order: e.target.value || undefined })}
                            placeholder="01"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", outline: 'none' }}
                          />
                        </div>
                      </div>

                      {/* Body */}
                      <div>
                        <div style={MONO}>Body <span style={{ color: '#C5C5C2' }}>· คำอธิบายยาว บน Survivor Card</span></div>
                        <textarea
                          value={ax.body ?? ''}
                          onChange={e => set(i, { body: e.target.value || undefined })}
                          placeholder="กระเป๋าหนัก 20 กิโล มีทุกอย่างที่ต้องใช้..."
                          rows={3}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 12.5, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                        />
                      </div>

                      {/* Image */}
                      <div>
                        <div style={MONO}>Image <span style={{ color: '#C5C5C2' }}>· ภาพตัวละครประจำ archetype</span></div>
                        <ImageUploader
                          value={ax.image_url}
                          onChange={url => set(i, { image_url: url })}
                          aspectRatio="1:1"
                          hint="ภาพตัวละครหรือ archetype"
                          maxHeight={140}
                        />
                      </div>
                    </div>
                  )}

                  {/* Poles row (mbti mode only) */}
                  {mode === 'mbti' && (
                    <div style={{ padding: '10px 14px', borderTop: '1px solid #F0F0EE', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ ...MONO, marginBottom: 0, flexShrink: 0 }}>Pole+ / Pole−</div>
                      <input
                        value={ax.poles?.[0] ?? ''}
                        onChange={e => set(i, { poles: [e.target.value, ax.poles?.[1] ?? ''] })}
                        placeholder="e.g. K"
                        style={{ width: 64, boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: 'none', textAlign: 'center' }}
                      />
                      <span style={{ color: '#C5C5C2', fontSize: 12 }}>/</span>
                      <input
                        value={ax.poles?.[1] ?? ''}
                        onChange={e => set(i, { poles: [ax.poles?.[0] ?? '', e.target.value] })}
                        placeholder="e.g. F"
                        style={{ width: 64, boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: 'none', textAlign: 'center' }}
                      />
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })}

        {axes.length < PALETTE.length && (
          <button className="add-btn" onClick={addAxis}>+ เพิ่มแกน</button>
        )}
      </div>
    </div>
  );
}
