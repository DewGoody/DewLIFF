import type { EditorState } from '../types';
import { pairKey } from '../utils';

interface Props {
  state: EditorState;
  campaignStatus: string;
  isSaving: boolean;
  onSave: () => void;
  onStatusChange: (status: 'draft' | 'live' | 'ended') => void;
  onPlay: () => void;
}

function generateMbtiCodes(axes: EditorState['axes']): string[] {
  let codes = [''];
  for (const ax of axes) {
    const p0 = (ax.poles?.[0] ?? ax.id[0] ?? 'A').toUpperCase();
    const p1 = (ax.poles?.[1] ?? ax.id[1] ?? 'B').toUpperCase();
    codes = codes.flatMap(prefix => [prefix + p0, prefix + p1]);
  }
  return codes.map(c => c.toLowerCase());
}

function validate(state: EditorState): string[] {
  const issues: string[] = [];
  if (state.axes.length < 1) issues.push('ต้องมีแกนอย่างน้อย 1 แกน');
  if (state.questions.length < 1) issues.push('ต้องมีคำถามอย่างน้อย 1 ข้อ');
  state.questions.forEach((q, i) => {
    if (!q.text.trim()) issues.push(`คำถามข้อ ${i + 1} ยังไม่มีข้อความ`);
    const hasScore = q.options.some((o) => Object.values(o.scores).some((v) => v !== 0));
    if (!hasScore) issues.push(`คำถามข้อ ${i + 1} ยังไม่มีคะแนน`);
    if (q.options.length < 2) issues.push(`คำถามข้อ ${i + 1} ต้องมีตัวเลือกอย่างน้อย 2 ข้อ`);
  });

  if (state.mode === 'mbti') {
    const hasPoles = state.axes.every(ax => ax.poles?.[0] && ax.poles?.[1]);
    if (!hasPoles) {
      issues.push('แกน MBTI ต้องมี Pole+ และ Pole− ทุกแกน');
    } else {
      const codes = generateMbtiCodes(state.axes);
      for (const code of codes) {
        if (!state.results[code]?.title) issues.push(`ยังไม่มีผลลัพธ์สำหรับ type "${code.toUpperCase()}"`);
      }
    }
  } else {
    for (let i = 0; i < state.axes.length; i++) {
      for (let j = i; j < state.axes.length; j++) {
        const key = pairKey(state.axes[i].id, state.axes[j].id);
        const r = state.results[key];
        if (!r || !r.title) issues.push(`ยังไม่มีผลลัพธ์สำหรับ ${state.axes[i].label}+${state.axes[j].label}`);
      }
    }
  }
  return issues;
}

export default function Sidebar({ state, campaignStatus, isSaving, onSave, onStatusChange, onPlay }: Props) {
  const axes = state.axes;
  const isMbti = state.mode === 'mbti';
  const issues = validate(state);

  const filledResults = Object.values(state.results).filter((r) => r && r.title).length;
  let totalExpected: number;
  let resultText: string;
  if (isMbti) {
    totalExpected = Math.pow(2, axes.length);
    resultText = filledResults >= totalExpected ? `ครบ ${totalExpected} types` : `${filledResults}/${totalExpected} types`;
  } else {
    totalExpected = axes.length * (axes.length + 1) / 2;
    resultText = filledResults >= totalExpected && totalExpected > 0 ? `ครบ ${totalExpected} คู่` : `${filledResults} ผล`;
  }

  const STATUS_OPTIONS: Array<{ value: 'draft' | 'live' | 'ended'; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'live', label: 'Live' },
    { value: 'ended', label: 'Ended' },
  ];

  return (
    <div id="sidebar">
      <div className="sb-section">
        <div className="sb-title">บันทึก</div>
        <button className="hdr-btn primary" style={{ width: '100%', marginBottom: 8 }} disabled={isSaving} onClick={onSave}>
          {isSaving ? 'กำลังบันทึก...' : 'Save'}
        </button>
        <select
          style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
          value={campaignStatus}
          onChange={(e) => onStatusChange(e.target.value as 'draft' | 'live' | 'ended')}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="sb-section">
        <div className="sb-title">ภาพรวม</div>
        <div className="count-row">
          <div className="count-box">
            <div className="num">{axes.length}</div>
            <div className="lbl">แกน</div>
          </div>
          <div className="count-box">
            <div className="num">{state.questions.length}</div>
            <div className="lbl">คำถาม</div>
          </div>
          <div className="count-box">
            <div className="num" style={{ fontSize: resultText.length > 6 ? 16 : 22 }}>{resultText}</div>
            <div className="lbl">ผลลัพธ์</div>
          </div>
        </div>
      </div>

      {isMbti && axes.length >= 1 && axes.every(ax => ax.poles?.[0] && ax.poles?.[1]) && (
        <div className="sb-section">
          <div className="sb-title">MBTI Types</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {generateMbtiCodes(axes).map(code => {
              const has = !!(state.results[code]?.title);
              return (
                <span key={code} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, padding: '2px 6px', borderRadius: 4, background: has ? '#1C1A17' : '#F0F0EE', color: has ? '#fff' : '#aaa', border: '1px solid ' + (has ? '#1C1A17' : '#E5E5E3') }}>
                  {code.toUpperCase()}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {!isMbti && axes.length >= 2 && (
        <div className="sb-section">
          <div className="sb-title">Pair Matrix</div>
          <div className="matrix">
            <table>
              <thead>
                <tr>
                  <th></th>
                  {axes.map((a) => (
                    <th key={a.id}><span style={{ color: a.color }}>●</span> {a.label.substring(0, 4)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {axes.map((rowAxis, i) => (
                  <tr key={rowAxis.id}>
                    <th style={{ textAlign: 'right' }}>
                      <span style={{ color: rowAxis.color }}>●</span> {rowAxis.label.substring(0, 4)}
                    </th>
                    {axes.map((colAxis, j) => {
                      if (j < i) return <td key={colAxis.id}></td>;
                      const key = pairKey(rowAxis.id, colAxis.id);
                      const has = !!(state.results[key]?.title);
                      return (
                        <td key={colAxis.id} className={has ? 'dot-filled' : 'dot-empty'}>
                          {has ? '●' : '○'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="sb-section">
        <div className="sb-title">สถานะ</div>
        {issues.length === 0 ? (
          <div className="validate-ok">✓ พร้อมใช้งาน</div>
        ) : (
          <>
            <div className="validate-err">✗ ขาด {issues.length} อย่าง</div>
            <ul className="validate-list">
              {issues.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          </>
        )}
      </div>

      <button className="sb-play-btn" onClick={onPlay}>▶ ลองเล่น</button>
    </div>
  );
}
