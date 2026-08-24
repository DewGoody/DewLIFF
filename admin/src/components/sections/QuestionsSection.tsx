import type { EditorAxis, EditorQuestion, EditorOption } from '../../types';

interface Props {
  axes: EditorAxis[];
  questions: EditorQuestion[];
  onChange: (questions: EditorQuestion[]) => void;
}

function newOption(): EditorOption {
  return { id: 'opt_' + Date.now(), label: 'ตัวเลือกใหม่', scores: {} };
}

export default function QuestionsSection({ axes, questions, onChange }: Props) {
  const update = (next: EditorQuestion[]) => onChange(next);

  const updateText = (qi: number, text: string) => {
    update(questions.map((q, i) => i === qi ? { ...q, text } : q));
  };

  const moveQ = (qi: number, dir: number) => {
    const j = qi + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[qi], next[j]] = [next[j], next[qi]];
    update(next);
  };

  const dupeQ = (qi: number) => {
    const copy = JSON.parse(JSON.stringify(questions[qi])) as EditorQuestion;
    copy.id = 'q_' + Date.now();
    copy.options = copy.options.map((o, oi) => ({ ...o, id: copy.id + '_' + String.fromCharCode(97 + oi) }));
    const next = [...questions];
    next.splice(qi + 1, 0, copy);
    update(next);
  };

  const delQ = (qi: number) => {
    update(questions.filter((_, i) => i !== qi));
  };

  const addQ = () => {
    const id = 'q_' + Date.now();
    update([...questions, {
      id,
      text: '',
      options: [
        { id: id + '_a', label: 'ตัวเลือก 1', scores: {} },
        { id: id + '_b', label: 'ตัวเลือก 2', scores: {} },
      ],
    }]);
  };

  const updateOptLabel = (qi: number, oi: number, label: string) => {
    update(questions.map((q, i) => i !== qi ? q : {
      ...q,
      options: q.options.map((o, j) => j !== oi ? o : { ...o, label }),
    }));
  };

  const delOpt = (qi: number, oi: number) => {
    if (questions[qi].options.length <= 1) return;
    update(questions.map((q, i) => i !== qi ? q : {
      ...q,
      options: q.options.filter((_, j) => j !== oi),
    }));
  };

  const addOpt = (qi: number) => {
    if (questions[qi].options.length >= 4) return;
    update(questions.map((q, i) => i !== qi ? q : {
      ...q,
      options: [...q.options, newOption()],
    }));
  };

  const setScore = (qi: number, oi: number, axId: string, val: number) => {
    update(questions.map((q, i) => i !== qi ? q : {
      ...q,
      options: q.options.map((o, j) => {
        if (j !== oi) return o;
        const scores = { ...o.scores };
        if ((scores[axId] || 0) === val) {
          delete scores[axId];
        } else {
          scores[axId] = val;
        }
        return { ...o, scores };
      }),
    }));
  };

  return (
    <div className="section" id="sec-questions">
      <div className="section-head">
        <span className="section-num">Step 2</span>
        <span className="section-title">เขียนคำถาม</span>
      </div>
      <div className="section-desc">กดวงกลมเพื่อให้คะแนนแกน · กดวงเดิมซ้ำเพื่อล้างเป็น 0</div>

      {questions.map((q, qi) => {
        const hasScore = q.options.some((o) => Object.values(o.scores).some((v) => v > 0));
        return (
          <div className="q-card" key={q.id}>
            <div className="q-header">
              <span className="q-num">ข้อ {qi + 1}</span>
              <input
                className="q-text-input"
                value={q.text}
                onChange={(e) => updateText(qi, e.target.value)}
                placeholder="ข้อความคำถาม..."
              />
              <span className="q-charcount mono">{q.text.length}</span>
              <span className={`q-scored ${hasScore ? 'yes' : 'no'}`}>{hasScore ? 'scored' : 'no score'}</span>
              <div className="q-actions">
                <button onClick={() => moveQ(qi, -1)} disabled={qi === 0}>↑</button>
                <button onClick={() => moveQ(qi, 1)} disabled={qi === questions.length - 1}>↓</button>
                <button onClick={() => dupeQ(qi)} title="Duplicate">⧉</button>
                <button onClick={() => delQ(qi)} title="Delete">×</button>
              </div>
            </div>

            {q.options.map((opt, oi) => (
              <div className="opt-block" key={opt.id || oi}>
                <div className="opt-top">
                  <div className="opt-radio" />
                  <input
                    className="opt-label-input"
                    value={opt.label}
                    onChange={(e) => updateOptLabel(qi, oi, e.target.value)}
                  />
                  <button className="opt-del" onClick={() => delOpt(qi, oi)}>×</button>
                </div>
                <div className="opt-scores-vertical">
                  {axes.map((ax) => {
                    const val = opt.scores[ax.id] || 0;
                    return (
                      <div className="score-row" key={ax.id}>
                        <span className="axis-name">
                          <span className="mini-dot" style={{ background: ax.color }} />
                          {ax.label}
                        </span>
                        <span className="score-dots">
                          {[1, 2, 3, 4, 5].map((s) => {
                            const active = val >= s;
                            return (
                              <span
                                key={s}
                                className={`score-dot${active ? ' active' : ''}`}
                                style={active ? { background: ax.color } : {}}
                                onClick={() => setScore(qi, oi, ax.id, s)}
                              />
                            );
                          })}
                        </span>
                        <span className="score-val">{val > 0 ? '+' + val : '0'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {q.options.length < 4 && (
              <button className="add-opt-btn" onClick={() => addOpt(qi)}>+ เพิ่มตัวเลือก</button>
            )}
          </div>
        );
      })}

      <button className="add-btn" style={{ width: '100%', padding: 16 }} onClick={addQ}>
        + เพิ่มคำถาม
      </button>
    </div>
  );
}
