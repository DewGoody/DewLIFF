import type { EditorAxis, EditorQuestion } from '../../types';
import { PALETTE } from '../../utils';

interface Props {
  axes: EditorAxis[];
  questions: EditorQuestion[];
  onChange: (axes: EditorAxis[], questions: EditorQuestion[]) => void;
}

export default function AxesSection({ axes, questions, onChange }: Props) {
  const updateLabel = (i: number, label: string) => {
    const next = axes.map((a, idx) => idx === i ? { ...a, label } : a);
    onChange(next, questions);
  };

  const addAxis = () => {
    if (axes.length >= PALETTE.length) return;
    const id = 'axis_' + Date.now();
    onChange([...axes, { id, label: 'แกนใหม่', color: PALETTE[axes.length] }], questions);
  };

  const deleteAxis = (i: number) => {
    const removed = axes[i];
    const nextAxes = axes.filter((_, idx) => idx !== i);
    const nextQuestions = questions.map((q) => ({
      ...q,
      options: q.options.map((o) => {
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
      <div className="axes-row">
        {axes.map((ax, i) => (
          <div className="axis-card" key={ax.id}>
            <div className="axis-dot" style={{ background: ax.color }} />
            <div>
              <input
                className="axis-label-input"
                value={ax.label}
                onChange={(e) => updateLabel(i, e.target.value)}
              />
              <div className="axis-id mono">{ax.id}</div>
            </div>
            <button className="axis-del" onClick={() => deleteAxis(i)} title="ลบแกน">×</button>
          </div>
        ))}
        {axes.length < PALETTE.length && (
          <button className="add-btn" onClick={addAxis}>+ เพิ่มแกน</button>
        )}
      </div>
    </div>
  );
}
