import { useState, useEffect } from 'react';
import type { EditorAxis, ResultEntry } from '../../types';
import { pairKey } from '../../utils';
import ImageUploader from '../ImageUploader';

interface Props {
  axes: EditorAxis[];
  results: Record<string, ResultEntry>;
  fallback: ResultEntry;
  onChange: (results: Record<string, ResultEntry>) => void;
  onFallbackChange: (fallback: ResultEntry) => void;
  groupScoreMode?: boolean;
  showGroupExtras?: boolean;
  mode?: string;
  fallbackCode?: string;
  onFallbackCodeChange?: (code: string) => void;
  /** Extra content rendered below the matrix in the left column (group archetypes) */
  leftSlot?: React.ReactNode;
}

function generateMbtiCodes(axes: EditorAxis[]): string[] {
  let codes = [''];
  for (const axis of axes) {
    const p0 = (axis.poles?.[0] ?? axis.id[0] ?? 'A').toUpperCase();
    const p1 = (axis.poles?.[1] ?? axis.id[1] ?? 'B').toUpperCase();
    codes = codes.flatMap(prefix => [prefix + p0, prefix + p1]);
  }
  return codes.map(c => c.toLowerCase());
}

/* ── Shared editor panel ─────────────────────────────────────────────────── */
function ResultEditor({
  kind, title, result, fallbackActive, groupScoreMode, showGroupExtras,
  onTitle, onBody, onImage, onScore, onMarkFallback, onPatch, hint,
}: {
  kind: string; title: string;
  result: ResultEntry;
  fallbackActive?: boolean;
  groupScoreMode?: boolean;
  showGroupExtras?: boolean;
  onTitle: (v: string) => void;
  onBody: (v: string) => void;
  onImage: (url: string) => void;
  onScore?: (v: number | undefined) => void;
  onMarkFallback?: () => void;
  onPatch?: (patch: Partial<ResultEntry>) => void;
  hint?: string;
}) {
  return (
    <div style={{
      flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 12,
      border: '1px solid #E7E7E3', borderRadius: 12, background: '#FFFFFF',
      padding: '14px 15px', alignSelf: 'flex-start', position: 'sticky', top: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
          padding: '2px 7px', borderRadius: 4, background: '#F4F4F2', color: '#5F6469',
          letterSpacing: '.06em',
        }}>{kind}</span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: '#16181A',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</span>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>หัวข้อผล</span>
        </div>
        <input
          value={result.title}
          onChange={e => onTitle(e.target.value)}
          placeholder="เช่น คู่หูสายบุกเบิก"
          style={{
            width: '100%', boxSizing: 'border-box', border: '1px solid #DEDEDA',
            borderRadius: 8, padding: '8px 10px',
            fontSize: 12.5, fontFamily: "'Noto Sans Thai',sans-serif", outline: 'none',
          }}
        />
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>คำอธิบาย</span>
        <textarea
          value={result.body}
          onChange={e => onBody(e.target.value)}
          rows={4}
          placeholder="อธิบายผลลัพธ์ 2–3 บรรทัด"
          style={{
            width: '100%', boxSizing: 'border-box', border: '1px solid #DEDEDA',
            borderRadius: 8, padding: '8px 10px',
            fontSize: 12, fontFamily: "'Noto Sans Thai',sans-serif", lineHeight: 1.7,
            resize: 'vertical', outline: 'none',
          }}
        />
      </div>

      {/* Image */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>ภาพผลลัพธ์</span>
        <ImageUploader value={result.image_url} onChange={onImage} aspectRatio="2:1" hint="แนะนำ 1040×520 px" />
      </div>

      {/* Group extras: eyebrow, OG image, share text */}
      {showGroupExtras && onPatch && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>eyebrow (บรรทัดเล็กบนหัวข้อ)</span>
              <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: '#C9CCCE' }}>result.eyebrow</span>
            </div>
            <input
              value={result.eyebrow ?? ''}
              onChange={e => onPatch({ eyebrow: e.target.value || undefined })}
              placeholder="เช่น คู่หูที่ลงตัว"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #DEDEDA', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, fontFamily: "'Noto Sans Thai',sans-serif", outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>ภาพ OG 1200×630</span>
              <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: '#C9CCCE' }}>result.og_image_url</span>
            </div>
            <ImageUploader value={result.og_image_url} onChange={url => onPatch({ og_image_url: url || undefined })} aspectRatio="1200:630" hint="PNG / JPG · OG 1200×630" maxHeight={80} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>ข้อความแชร์</span>
              <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: '#C9CCCE' }}>result.share_text</span>
            </div>
            <input
              value={result.share_text ?? ''}
              onChange={e => onPatch({ share_text: e.target.value || undefined })}
              placeholder="เช่น เราสองคนเป็นคู่หูสายบุกเบิก!"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #DEDEDA', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, fontFamily: "'Noto Sans Thai',sans-serif", outline: 'none' }}
            />
          </div>
        </>
      )}

      {/* Score (group score mode) */}
      {groupScoreMode && onScore && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 10, borderTop: '1px dashed #EFEFEC' }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>คะแนนที่ให้กลุ่ม</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="range" min={0} max={50} step={1}
              value={result.score_contribution ?? 0}
              onChange={e => onScore(parseInt(e.target.value) || 0)}
              style={{ flex: 1, minWidth: 0, accentColor: '#1F7A6F' }}
            />
            <span style={{
              flexShrink: 0, border: '1px solid #DEDEDA', borderRadius: 6,
              background: '#F4F4F2', padding: '3px 8px',
              fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
            }}>{result.score_contribution ?? 0}</span>
          </div>
        </div>
      )}

      {/* Fallback button */}
      {onMarkFallback && (
        <button
          onClick={onMarkFallback}
          style={{
            border: `1px solid ${fallbackActive ? '#1F7A6F' : '#DEDEDA'}`,
            borderRadius: 8, background: fallbackActive ? '#ECF6F3' : '#FFFFFF',
            padding: '7px 12px',
            fontSize: 11.5, fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 600,
            color: fallbackActive ? '#1F7A6F' : '#5F6469', cursor: 'pointer',
          }}
        >
          {fallbackActive ? '✓ Fallback อยู่' : 'ตั้งเป็น Fallback'}
        </button>
      )}

      {hint && (
        <span style={{ fontSize: 10.5, lineHeight: 1.6, color: '#A0A5AA', fontFamily: "'Noto Sans Thai',sans-serif" }}>{hint}</span>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function ResultsSection({
  axes, results, fallback, onChange, onFallbackChange,
  groupScoreMode, showGroupExtras, mode, fallbackCode, onFallbackCodeChange, leftSlot,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editingFallback, setEditingFallback] = useState(false);

  // In group mode, auto-select the first pair so the result editor shows immediately
  useEffect(() => {
    if (mode === 'group' && selected === null && axes.length >= 2) {
      const firstKey = pairKey(axes[0].id, axes[0].id);
      setSelected(firstKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const select = (key: string) => { setEditingFallback(false); setSelected(s => s === key ? null : key); };
  const pickFallback = () => { setSelected(null); setEditingFallback(true); };

  const update = (key: string, patch: Partial<ResultEntry>) => {
    const cur = results[key] ?? { title: '', body: '' };
    onChange({ ...results, [key]: { ...cur, ...patch } });
  };

  /* ── MBTI ─────────────────────────────────────────────────────────── */
  if (mode === 'mbti') {
    const hasPoles = axes.every(ax => ax.poles?.[0] && ax.poles?.[1]);
    const codes = generateMbtiCodes(axes);
    const filled = codes.filter(c => results[c]?.title).length;
    const warn = !hasPoles ? 'ยังกรอกขั้วไม่ครบ — code จะเปลี่ยนเมื่อตั้งขั้วแล้ว'
      : codes.length > 0 && filled < codes.length ? `ยังขาด ${codes.length - filled} ชนิด` : '';

    const selResult = selected ? (results[selected] ?? { title: '', body: '' }) : null;

    return (
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Left: type grid */}
        <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {!hasPoles && (
            <div style={{
              border: '1px solid #F4CFD5', borderRadius: 8, background: '#FEF2F4',
              padding: '8px 12px', fontSize: 11.5, color: '#B02A3F',
              fontFamily: "'Noto Sans Thai',sans-serif",
            }}>
              ⚠ ยังไม่ได้กรอก Pole+ / Pole− ในขั้นตอน "สาย + ขั้ว" — code ชนิดอาจเปลี่ยนภายหลัง
            </div>
          )}
          {(
            <div style={{ border: '1px solid #E7E7E3', borderRadius: 11, background: '#FFFFFF', padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: '#A0A5AA' }}>
                  {codes.length} ชนิด · {filled}/{codes.length} กรอกแล้ว
                </span>
                {warn && (
                  <span style={{
                    fontSize: 10, fontFamily: "'JetBrains Mono',monospace",
                    padding: '2px 7px', borderRadius: 4,
                    background: '#FEF2F4', color: '#B02A3F', border: '1px solid #F4CFD5',
                  }}>{warn}</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 7 }}>
                {codes.map(code => {
                  const has = !!results[code]?.title;
                  const on = selected === code && !editingFallback;
                  const isFallback = fallbackCode === code;
                  return (
                    <button
                      key={code}
                      onClick={() => select(code)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        border: `1.5px solid ${on ? '#3A6EA5' : has ? '#CBDCEF' : '#E7E7E3'}`,
                        borderRadius: 9, background: on ? '#EFF5FC' : has ? '#F7FAFD' : '#FBFBF9',
                        padding: '9px 6px', cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        fontSize: 12, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
                        letterSpacing: '.06em', textTransform: 'uppercase',
                        color: on ? '#3A6EA5' : has ? '#3A6EA5' : '#C0C4C8',
                      }}>{code.toUpperCase()}</span>
                      <span style={{
                        fontSize: 9, color: has ? '#5F6469' : '#D0D4D8',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '100%', fontFamily: "'Noto Sans Thai',sans-serif",
                      }}>{results[code]?.title || '—'}</span>
                      {isFallback && (
                        <span style={{ fontSize: 8.5, fontFamily: "'JetBrains Mono',monospace", color: '#1F7A6F' }}>fallback</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: editor */}
        <div style={{ flex: '0 0 320px' }}>
          {selected && selResult ? (
            <ResultEditor
              kind="MBTI"
              title={selected.toUpperCase()}
              result={selResult}
              fallbackActive={fallbackCode === selected}
              onTitle={v => update(selected, { title: v })}
              onBody={v => update(selected, { body: v })}
              onImage={url => update(selected, { image_url: url })}
              onMarkFallback={() => onFallbackCodeChange?.(selected)}
            />
          ) : (
            <div style={{
              border: '1px dashed #DEDEDA', borderRadius: 12, background: '#FBFBF9',
              padding: '40px 20px', textAlign: 'center',
              fontSize: 12, color: '#A0A5AA', fontFamily: "'Noto Sans Thai',sans-serif",
            }}>
              เลือกชนิดด้านซ้ายเพื่อเขียนผล
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Pair / Group ─────────────────────────────────────────────────── */
  const allPairKeys = axes.flatMap((r, i) => axes.slice(i).map(c => pairKey(r.id, c.id)));
  const filledPairs = allPairKeys.filter(k => results[k]?.title).length;

  const selResult = selected ? (results[selected] ?? { title: '', body: '' }) : null;
  const parts = selected ? selected.split('|') : null;
  const ax1 = parts ? axes.find(a => a.id === parts[0]) : null;
  const ax2 = parts ? axes.find(a => a.id === parts[1]) : null;
  const editorTitle = editingFallback ? 'Fallback' : ax1 && ax2 ? `${ax1.label} + ${ax2.label}` : '';
  const editorResult = editingFallback ? fallback : (selResult ?? { title: '', body: '' });

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      {/* Left: matrix + fallback */}
      <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ border: '1px solid #E7E7E3', borderRadius: 11, background: '#FFFFFF', padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: '#A0A5AA' }}>
              เมทริกซ์คู่ · {filledPairs}/{allPairKeys.length} ช่อง
            </span>
          </div>

          <div style={{ overflowX: 'auto', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 'max-content' }}>
              {/* Column headers */}
              <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end' }}>
                <span style={{ flexShrink: 0, width: 90 }} />
                {axes.map(ax => (
                  <span key={ax.id} style={{
                    width: 90, flexShrink: 0, textAlign: 'center',
                    fontSize: 10, fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 700,
                    color: ax.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{ax.label}</span>
                ))}
              </div>

              {/* Rows */}
              {axes.map((rowAxis, i) => (
                <div key={rowAxis.id} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{
                    flexShrink: 0, width: 90, textAlign: 'right',
                    fontSize: 10, fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 700,
                    color: rowAxis.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 4,
                  }}>{rowAxis.label}</span>
                  {axes.map((colAxis, j) => {
                    if (j < i) return <span key={colAxis.id} style={{ width: 90, flexShrink: 0 }} />;
                    const key = pairKey(rowAxis.id, colAxis.id);
                    const has = !!results[key]?.title;
                    const on = selected === key && !editingFallback;
                    return (
                      <button
                        key={colAxis.id}
                        onClick={() => select(key)}
                        style={{
                          width: 90, flexShrink: 0, height: 40,
                          border: `1.5px solid ${on ? '#E8354F' : has ? '#F4CFD5' : '#E7E7E3'}`,
                          borderRadius: 8, background: on ? '#FEF2F4' : has ? '#FFF8F9' : '#FBFBF9',
                          cursor: 'pointer',
                          fontSize: 9.5, fontFamily: "'Noto Sans Thai',sans-serif",
                          color: on ? '#B02A3F' : has ? '#5F6469' : '#C0C4C8',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          padding: '0 5px',
                        }}
                      >
                        {results[key]?.title ? results[key].title.substring(0, 10) : '+'}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Fallback row */}
          <button
            onClick={pickFallback}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              border: `1.5px solid ${editingFallback ? '#E8354F' : '#E7E7E3'}`,
              borderRadius: 9, background: editingFallback ? '#FEF2F4' : '#FBFBF9',
              padding: '8px 11px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: '#A0A5AA' }}>fallback</span>
            <span style={{ flex: 1, fontSize: 11.5, fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: 600, color: '#16181A' }}>
              {fallback.title || '(ยังไม่ตั้ง)'}
            </span>
            <span style={{ fontSize: 10, color: '#A0A5AA' }}>ไม่ตรงเลย →</span>
          </button>
        </div>

        {/* Left slot: extra content below matrix (e.g. group archetypes) */}
        {leftSlot}
      </div>

      {/* Right: editor */}
      <div style={{ flex: '0 0 320px' }}>
        {(selected || editingFallback) ? (
          <ResultEditor
            kind={editingFallback ? 'fallback' : 'คู่'}
            title={editorTitle}
            result={editorResult}
            groupScoreMode={groupScoreMode && !editingFallback}
            showGroupExtras={showGroupExtras && !editingFallback}
            onTitle={v => editingFallback ? onFallbackChange({ ...fallback, title: v }) : update(selected!, { title: v })}
            onBody={v => editingFallback ? onFallbackChange({ ...fallback, body: v }) : update(selected!, { body: v })}
            onImage={url => editingFallback ? onFallbackChange({ ...fallback, image_url: url }) : update(selected!, { image_url: url })}
            onPatch={selected && !editingFallback ? patch => update(selected, patch) : undefined}
            onScore={groupScoreMode && !editingFallback && selected ? v => update(selected, { score_contribution: v }) : undefined}
            hint={editingFallback ? 'ใช้เมื่อคะแนนหรือคู่ไม่ตรงกับผลลัพธ์ใดเลย' : groupScoreMode && !editingFallback ? 'ผลคู่ใช้ได้ใน Pair Result และคะแนนนี้จะเข้าบวกเป็นคะแนนกลุ่ม' : undefined}
          />
        ) : (
          <div style={{
            border: '1px dashed #DEDEDA', borderRadius: 12, background: '#FBFBF9',
            padding: '40px 20px', textAlign: 'center',
            fontSize: 12, color: '#A0A5AA', fontFamily: "'Noto Sans Thai',sans-serif",
          }}>
            เลือกช่องจากเมทริกซ์ หรือกด Fallback
          </div>
        )}
      </div>
    </div>
  );
}
