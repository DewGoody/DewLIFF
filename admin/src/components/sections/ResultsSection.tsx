import { useState } from 'react';
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
}

export default function ResultsSection({ axes, results, fallback, onChange, onFallbackChange, groupScoreMode }: Props) {
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [editingFallback, setEditingFallback] = useState(false);

  const selectPair = (key: string) => {
    setEditingFallback(false);
    setSelectedPair(selectedPair === key ? null : key);
  };

  const updateResult = (key: string, field: keyof ResultEntry, val: string) => {
    const current = results[key] || { title: '', body: '' };
    onChange({ ...results, [key]: { ...current, [field]: val } });
  };

  const currentResult = selectedPair ? (results[selectedPair] || { title: '', body: '' }) : null;
  const pairParts = selectedPair ? selectedPair.split('|') : null;
  const axis1 = pairParts ? axes.find((a) => a.id === pairParts[0]) : null;
  const axis2 = pairParts ? axes.find((a) => a.id === pairParts[1]) : null;

  return (
    <div className="section" id="sec-results">
      <div className="section-head">
        <span className="section-num">Step 3</span>
        <span className="section-title">ตั้งผลลัพธ์</span>
      </div>

      <div className="results-layout">
        <div className="results-grid">
          <table className="res-table">
            <thead>
              <tr>
                <th></th>
                {axes.map((ax) => (
                  <th key={ax.id}>
                    <div className="axis-header">
                      <span style={{ color: ax.color }}>●</span> {ax.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {axes.map((rowAxis, i) => (
                <tr key={rowAxis.id}>
                  <th style={{ textAlign: 'right' }}>
                    <div className="axis-header">
                      <span style={{ color: rowAxis.color }}>●</span> {rowAxis.label}
                    </div>
                  </th>
                  {axes.map((colAxis, j) => {
                    if (j < i) return <td key={colAxis.id}></td>;
                    const key = pairKey(rowAxis.id, colAxis.id);
                    const res = results[key];
                    const isActive = selectedPair === key && !editingFallback;
                    return (
                      <td key={colAxis.id}>
                        <button
                          className={`res-cell-btn${isActive ? ' active' : ''}${res?.title ? '' : ' empty'}`}
                          onClick={() => selectPair(key)}
                        >
                          {res?.title ? res.title.substring(0, 12) : '+'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="fallback-note" style={{ cursor: 'pointer' }} onClick={() => { setSelectedPair(null); setEditingFallback(true); }}>
            ไม่ตรงเลย → <strong>{fallback.title || '(ไม่มีชื่อ)'}</strong>
            {editingFallback && <span style={{ marginLeft: 8, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--blue)' }}>◀ กำลังแก้</span>}
          </div>
        </div>

        <div className="results-editor">
          {editingFallback ? (
            <>
              <div className="label-lg" style={{ marginBottom: 16 }}>Fallback Result</div>
              <div className="res-editor-label">Title</div>
              <input
                className="res-input"
                value={fallback.title}
                onChange={(e) => onFallbackChange({ ...fallback, title: e.target.value })}
              />
              <div className="res-editor-label">Body</div>
              <textarea
                className="res-textarea"
                value={fallback.body}
                onChange={(e) => onFallbackChange({ ...fallback, body: e.target.value })}
              />
            </>
          ) : selectedPair && currentResult ? (
            <>
              <div className="label-lg" style={{ marginBottom: 16 }}>
                {axis1?.label || '?'} + {axis2?.label || '?'}
              </div>
              <div className="res-editor-label">Title</div>
              <input
                className="res-input"
                value={currentResult.title}
                onChange={(e) => updateResult(selectedPair, 'title', e.target.value)}
              />
              <div className="res-editor-label">Body</div>
              <textarea
                className="res-textarea"
                value={currentResult.body}
                onChange={(e) => updateResult(selectedPair, 'body', e.target.value)}
              />
              <div className="res-editor-label">Image</div>
              <ImageUploader
                value={currentResult.image_url}
                onChange={(url) => updateResult(selectedPair, 'image_url', url)}
                aspectRatio="2:1"
                hint="แนะนำ 1040×520 px"
              />
              {groupScoreMode && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div className="res-editor-label" style={{ marginBottom: 6 }}>คะแนนให้กลุ่ม (Group Score)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="number" min={0} max={9999}
                      value={currentResult.score_contribution ?? ''}
                      placeholder="0"
                      onChange={e => {
                        const v = e.target.value ? parseInt(e.target.value) : undefined;
                        onChange({ ...results, [selectedPair]: { ...currentResult, score_contribution: v } });
                      }}
                      style={{ width: 90, padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 9, fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, textAlign: 'center', outline: 'none' }}
                    />
                    <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                      คะแนนที่คนนี้ให้กลุ่ม<br/>เมื่อใช้ Group Score Mode
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--dim)', textAlign: 'center', padding: '48px 0', fontSize: 13 }}>
              เลือกช่องจาก grid ด้านซ้าย หรือกด Fallback
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
