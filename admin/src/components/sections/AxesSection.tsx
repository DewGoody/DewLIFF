import { useState } from 'react';
import type { EditorAxis, EditorQuestion } from '../../types';
import { PALETTE } from '../../utils';

interface Props {
  axes: EditorAxis[];
  questions: EditorQuestion[];
  onChange: (axes: EditorAxis[], questions: EditorQuestion[]) => void;
}

type OptField = 'label_en' | 'body' | 'short' | 'image_url' | 'order';

const OPT_FIELDS: { key: OptField; label: string; hint: string; placeholder: string }[] = [
  { key: 'label_en',  label: 'EN Title',   hint: 'ชื่อภาษาอังกฤษ (e.g. THE PREPPER)',    placeholder: 'THE PREPPER' },
  { key: 'body',      label: 'Body',       hint: 'คำอธิบายยาว บน Survivor Card',          placeholder: 'กระเป๋าหนัก 20 กิโล มีทุกอย่างที่ต้องใช้...' },
  { key: 'short',     label: 'Short',      hint: 'คำอธิบายสั้น บน axis chip',             placeholder: 'เตรียมมากกว่าทุกคน' },
  { key: 'image_url', label: 'Image URL',  hint: 'ภาพตัวละครประจำ archetype',             placeholder: 'https://...' },
  { key: 'order',     label: 'Order',      hint: 'เลขลำดับ (e.g. 01) สำหรับ card',       placeholder: '01' },
];

const MONO: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 10,
  letterSpacing: '.08em',
  color: '#9B9B98',
  marginBottom: 5,
  textTransform: 'uppercase' as const,
};

export default function AxesSection({ axes, questions, onChange }: Props) {
  // Detect which optional fields are already in use (have any value across axes)
  const initialActive = OPT_FIELDS
    .filter(f => axes.some(a => !!a[f.key]))
    .map(f => f.key);
  const [activeFields, setActiveFields] = useState<OptField[]>(initialActive);

  const set = (i: number, patch: Partial<EditorAxis>) => {
    onChange(axes.map((a, idx) => idx === i ? { ...a, ...patch } : a), questions);
  };

  const toggleField = (key: OptField) => {
    setActiveFields(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
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

  const hasOptional = activeFields.length > 0;

  return (
    <div className="section" id="sec-axes">
      <div className="section-head">
        <span className="section-num">Step 1</span>
        <span className="section-title">ตั้งแกนบุคลิก</span>
      </div>

      {/* Optional field toggles */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...MONO, marginBottom: 8 }}>ฟิลด์เพิ่มเติมที่จะส่งไป LIFF</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {OPT_FIELDS.map(f => {
            const on = activeFields.includes(f.key);
            return (
              <button
                key={f.key}
                onClick={() => toggleField(f.key)}
                title={f.hint}
                style={{
                  padding: '5px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                  border: on ? '1px solid #111' : '1px solid #E5E5E3',
                  background: on ? '#111' : '#F7F7F5',
                  color: on ? '#fff' : '#5C5C58',
                  fontFamily: "'DM Mono',monospace",
                  transition: 'all .12s',
                }}
              >
                {on ? '✓ ' : '+ '}{f.label}
              </button>
            );
          })}
        </div>
        {hasOptional && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#9B9B98', fontFamily: "'DM Mono',monospace" }}>
            ฟิลด์ที่เปิดอยู่จะถูกส่งไป LIFF ทุกครั้งที่ Save — ปิดฟิลด์ไม่ได้ลบค่า แค่ไม่ส่ง
          </div>
        )}
      </div>

      {/* Axis cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {axes.map((ax, i) => (
          <div key={ax.id} style={{ border: '1px solid #E5E5E3', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
            {/* Row 1: color + label + id + delete */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: hasOptional ? '1px solid #F0F0EE' : 'none' }}>
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
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#9B9B98', marginTop: 2 }}>{ax.id}</div>
              </div>
              <button
                onClick={() => deleteAxis(i)}
                style={{ width: 26, height: 26, padding: 0, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#E63B2E', flexShrink: 0 }}
              >×</button>
            </div>

            {/* Optional fields */}
            {hasOptional && (
              <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {activeFields.map(key => {
                  const f = OPT_FIELDS.find(x => x.key === key)!;
                  const val = (ax[key] as string) ?? '';
                  const isLong = key === 'body';
                  return (
                    <div key={key} style={isLong ? { gridColumn: '1 / -1' } : {}}>
                      <div style={MONO}>{f.label} <span style={{ color: '#C5C5C2' }}>· {f.hint}</span></div>
                      {isLong ? (
                        <textarea
                          value={val}
                          onChange={e => set(i, { [key]: e.target.value || undefined })}
                          placeholder={f.placeholder}
                          rows={3}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E3', borderRadius: 7, fontSize: 12.5, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <input
                          value={val}
                          onChange={e => set(i, { [key]: e.target.value || undefined })}
                          placeholder={f.placeholder}
                          style={{
                            width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                            border: '1px solid #E5E5E3', borderRadius: 7,
                            fontSize: key === 'image_url' || key === 'order' ? 11.5 : 13,
                            fontFamily: key === 'image_url' || key === 'order' ? "'DM Mono',monospace" : 'inherit',
                            outline: 'none',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {axes.length < PALETTE.length && (
          <button className="add-btn" onClick={addAxis}>+ เพิ่มแกน</button>
        )}
      </div>
    </div>
  );
}
