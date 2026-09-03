import type { EditorAxis, EditorQuestion, EditorOption } from '../../types';

interface Props {
  axes: EditorAxis[];
  questions: EditorQuestion[];
  onChange: (questions: EditorQuestion[]) => void;
  mode?: string;
}

function newOption(): EditorOption {
  return { id: 'opt_' + Date.now(), label: 'ตัวเลือกใหม่', scores: {} };
}

export default function QuestionsSection({ axes, questions, onChange, mode }: Props) {
  const update = (next: EditorQuestion[]) => onChange(next);
  const isMbti = mode === 'mbti';

  const updateText = (qi: number, text: string) =>
    update(questions.map((q, i) => i === qi ? { ...q, text } : q));

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

  const delQ = (qi: number) => update(questions.filter((_, i) => i !== qi));

  const addQ = () => {
    const id = 'q_' + Date.now();
    update([...questions, {
      id, text: '',
      options: [
        { id: id + '_a', label: 'ตัวเลือก 1', scores: {} },
        { id: id + '_b', label: 'ตัวเลือก 2', scores: {} },
      ],
    }]);
  };

  const updateOptLabel = (qi: number, oi: number, label: string) =>
    update(questions.map((q, i) => i !== qi ? q : {
      ...q, options: q.options.map((o, j) => j !== oi ? o : { ...o, label }),
    }));

  const delOpt = (qi: number, oi: number) => {
    if (questions[qi].options.length <= 1) return;
    update(questions.map((q, i) => i !== qi ? q : {
      ...q, options: q.options.filter((_, j) => j !== oi),
    }));
  };

  const addOpt = (qi: number) => {
    if (questions[qi].options.length >= 4) return;
    update(questions.map((q, i) => i !== qi ? q : {
      ...q, options: [...q.options, newOption()],
    }));
  };

  const setScore = (qi: number, oi: number, axId: string, val: number) => {
    update(questions.map((q, i) => i !== qi ? q : {
      ...q,
      options: q.options.map((o, j) => {
        if (j !== oi) return o;
        const scores = { ...o.scores };
        if (val === 0) delete scores[axId];
        else scores[axId] = val;
        return { ...o, scores };
      }),
    }));
  };

  const OPT_LETTERS = ['A', 'B', 'C', 'D'];

  return (
    <div className="section" id="sec-questions">
      <div className="section-head">
        <span className="section-num">Step 2</span>
        <span className="section-title">เขียนคำถาม</span>
      </div>
      <div className="section-desc">
        {isMbti
          ? 'กดชื่อ Pole เพื่อเพิ่มคะแนน (สูงสุด 3) · กดซ้ำเมื่อครบ 3 เพื่อล้าง'
          : 'กดชื่อสายเพื่อเพิ่มคะแนน (+1 → +2 → ล้าง) · กดซ้ำเพื่อวนรอบ'}
      </div>

      {questions.map((q, qi) => {
        const hasScore = q.options.some(o => Object.values(o.scores).some(v => v !== 0));
        return (
          <div key={q.id} style={{
            border: '1px solid #E8E8E5', borderRadius: 10, background: '#fff',
            marginBottom: 14, overflow: 'hidden',
          }}>
            {/* Question header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F7F7F5', borderBottom: '1px solid #EBEBEA' }}>
              <span style={{
                width: 26, height: 26, borderRadius: 6, background: hasScore ? '#E63B2E' : '#555',
                color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'JetBrains Mono',monospace", flexShrink: 0,
              }}>
                {String(qi + 1).padStart(2, '0')}
              </span>
              <input
                value={q.text}
                onChange={e => updateText(qi, e.target.value)}
                placeholder="ข้อความคำถาม..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, fontWeight: 500, background: 'transparent', padding: 0 }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => moveQ(qi, -1)} disabled={qi === 0} style={{ width: 24, height: 24, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 5, fontSize: 10, cursor: qi === 0 ? 'default' : 'pointer', color: '#5C5C58' }}>↑</button>
                <button onClick={() => moveQ(qi, 1)} disabled={qi === questions.length - 1} style={{ width: 24, height: 24, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 5, fontSize: 10, cursor: qi === questions.length - 1 ? 'default' : 'pointer', color: '#5C5C58' }}>↓</button>
                <button onClick={() => dupeQ(qi)} title="Duplicate" style={{ width: 24, height: 24, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 5, fontSize: 10, cursor: 'pointer', color: '#5C5C58' }}>⧉</button>
                <button onClick={() => delQ(qi)} title="Delete" style={{ width: 24, height: 24, border: '1px solid #E5E5E3', background: '#fff', borderRadius: 5, fontSize: 12, cursor: 'pointer', color: '#E63B2E' }}>×</button>
              </div>
            </div>

            {/* Options */}
            {q.options.map((opt, oi) => (
              <div key={opt.id || oi} style={{ borderTop: oi > 0 ? '1px solid #F3F3F1' : 'none', padding: '10px 14px' }}>
                {/* Option row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {/* Letter badge */}
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', background: '#EBEBEA',
                    fontSize: 11, fontWeight: 700, color: '#555',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {OPT_LETTERS[oi] ?? oi + 1}
                  </span>

                  {/* Text input */}
                  <input
                    value={opt.label}
                    onChange={e => updateOptLabel(qi, oi, e.target.value)}
                    placeholder="ข้อความตัวเลือก..."
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, background: 'transparent', padding: 0, minWidth: 0 }}
                  />

                  {/* Non-MBTI: inline axis score chips */}
                  {!isMbti && axes.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {axes.map(ax => {
                        const val = opt.scores[ax.id] ?? 0;
                        const isActive = val > 0;
                        return (
                          <button
                            key={ax.id}
                            onClick={() => {
                              // cycle: 0 → +1 → +2 → 0
                              const next = val === 0 ? 1 : val < 2 ? val + 1 : 0;
                              setScore(qi, oi, ax.id, next);
                            }}
                            style={{
                              padding: '3px 11px', borderRadius: 99, fontSize: 12,
                              fontWeight: isActive ? 700 : 400, cursor: 'pointer', border: 'none',
                              background: isActive ? ax.color : 'transparent',
                              color: isActive ? '#fff' : '#B5B5B0',
                              flexShrink: 0, lineHeight: 1.5,
                              transition: 'background .1s, color .1s',
                            }}
                          >
                            {ax.label}{isActive ? ` +${val}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Delete option */}
                  <button onClick={() => delOpt(qi, oi)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#CCC', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>

                {/* MBTI: compact pole controls below option text */}
                {isMbti && axes.length > 0 && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, paddingLeft: 31 }}>
                    {axes.map(ax => {
                      const val = opt.scores[ax.id] ?? 0;
                      const pole0 = ax.poles?.[0] ?? 'A';
                      const pole1 = ax.poles?.[1] ?? 'B';
                      const mag0 = val > 0 ? val : 0;
                      const mag1 = val < 0 ? -val : 0;

                      const clickPole0 = () => setScore(qi, oi, ax.id, mag0 < 3 ? mag0 + 1 : 0);
                      const clickPole1 = () => setScore(qi, oi, ax.id, mag1 < 3 ? -(mag1 + 1) : 0);

                      return (
                        <div key={ax.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5,
                            color: (mag0 > 0 || mag1 > 0) ? ax.color : '#B5B5B0',
                            maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{ax.label}</span>
                          {/* Pole 0 pill */}
                          <button onClick={clickPole0} style={{
                            padding: '3px 8px', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: `1px solid ${mag0 > 0 ? ax.color : '#E5E5E3'}`,
                            background: mag0 > 0 ? ax.color : '#fff',
                            color: mag0 > 0 ? '#fff' : '#9B9B98',
                            lineHeight: 1.3,
                          }}>
                            {pole0}{mag0 > 0 ? `+${mag0}` : ''}
                          </button>
                          <span style={{ fontSize: 11, color: '#DEDEDA' }}>—</span>
                          {/* Pole 1 pill */}
                          <button onClick={clickPole1} style={{
                            padding: '3px 8px', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: `1px solid ${mag1 > 0 ? '#666' : '#E5E5E3'}`,
                            background: mag1 > 0 ? '#555' : '#fff',
                            color: mag1 > 0 ? '#fff' : '#9B9B98',
                            lineHeight: 1.3,
                          }}>
                            {pole1}{mag1 > 0 ? `+${mag1}` : ''}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Add option + add question actions */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid #F3F3F1', gap: 10 }}>
              {q.options.length < 4 && (
                <button onClick={() => addOpt(qi)} style={{
                  fontSize: 12, color: '#9B9B98', border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                }}>
                  + เพิ่มตัวเลือก
                </button>
              )}
            </div>
          </div>
        );
      })}

      <button className="add-btn" style={{ width: '100%', padding: 16 }} onClick={addQ}>
        + เพิ่มคำถาม
      </button>
    </div>
  );
}
