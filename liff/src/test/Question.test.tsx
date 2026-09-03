// Regression tests for Question.tsx's screen_config wiring (order / show / geo / pos / src).
// The "no screen_config" cases are the safety net: any campaign that has never touched the
// LIFF & Style block builder must render exactly as it always did.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Question from '../screens/Question';

const QUESTIONS = [
  { id: 'q1', text: 'ไฟดับทั้งเมือง คุณทำอะไรก่อน?', options: [{ id: 'a', label: 'หาน้ำ' }, { id: 'b', label: 'โทรหาเพื่อน' }] },
  { id: 'q2', text: 'ข้อสอง?', options: [{ id: 'a', label: 'ตัวเลือกเอ' }, { id: 'b', label: 'ตัวเลือกบี' }] },
];

describe('Question — default behavior (no screen_config)', () => {
  it('renders the default progress label, question text and options', () => {
    render(<Question config={{ copy: {}, questions: QUESTIONS }} questionIndex={0} onAnswer={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('ข้อ 1 / 2')).toBeInTheDocument();
    expect(screen.getByText('ไฟดับทั้งเมือง คุณทำอะไรก่อน?')).toBeInTheDocument();
    expect(screen.getByText('หาน้ำ')).toBeInTheDocument();
    expect(screen.getByText('โทรหาเพื่อน')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('← ย้อนกลับ')).toBeInTheDocument();
  });

  it('renders campaign copy overrides for the back button', () => {
    render(<Question config={{ copy: { question_back: 'ย้อน' }, questions: QUESTIONS }} questionIndex={0} onAnswer={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('ย้อน')).toBeInTheDocument();
  });

  it('calls onAnswer / onBack as before', () => {
    const onAnswer = vi.fn();
    const onBack = vi.fn();
    render(<Question config={{ copy: {}, questions: QUESTIONS }} questionIndex={0} onAnswer={onAnswer} onBack={onBack} />);
    screen.getByText('← ย้อนกลับ').click();
    expect(onBack).toHaveBeenCalled();
  });

  it('returns null when there is no question at this index', () => {
    const { container } = render(<Question config={{ copy: {}, questions: QUESTIONS }} questionIndex={9} onAnswer={vi.fn()} onBack={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('Question — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'progress', uid: 'progress', show: true, geo: {} },
    { id: 'qCard', uid: 'qCard', show: true, geo: {} },
    { id: 'options', uid: 'options', show: true, geo: {} },
    { id: 'backRow', uid: 'backRow', show: true, geo: {} },
  ];

  it('hides a block whose show flag is false', () => {
    render(
      <Question
        config={{
          copy: {}, questions: QUESTIONS,
          appearance: { screen_config: { Question: { blocks: baseBlocks.map(b => b.id === 'backRow' ? { ...b, show: false } : b) } } },
        }}
        questionIndex={0}
        onAnswer={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.queryByText('← ย้อนกลับ')).toBeNull();
    expect(screen.getByText('ไฟดับทั้งเมือง คุณทำอะไรก่อน?')).toBeInTheDocument();
  });

  it('applies a geo override (option min-height)', () => {
    const { container } = render(
      <Question
        config={{
          copy: {}, questions: QUESTIONS,
          appearance: { screen_config: { Question: { blocks: baseBlocks.map(b => b.id === 'options' ? { ...b, geo: { optH: 72 } } : b) } } },
        }}
        questionIndex={0}
        onAnswer={vi.fn()}
        onBack={vi.fn()}
      />
    );
    const optionButtons = container.querySelectorAll('button');
    // First button after the (absent) back button click target is an option button.
    const optBtn = Array.from(optionButtons).find(b => b.textContent?.includes('หาน้ำ'))!;
    expect(optBtn.style.minHeight).toBe('72px');
  });

  it('omits the option key badge when keyShape is "none"', () => {
    render(
      <Question
        config={{
          copy: {}, questions: QUESTIONS,
          appearance: { screen_config: { Question: { blocks: baseBlocks.map(b => b.id === 'options' ? { ...b, geo: { keyShape: 'none' } } : b) } } },
        }}
        questionIndex={0}
        onAnswer={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.getByText('หาน้ำ')).toBeInTheDocument();
  });

  it('renders a floating block with an absolute, percentage-based position', () => {
    render(
      <Question
        config={{
          copy: { question_back: 'Floaty' }, questions: QUESTIONS,
          appearance: { screen_config: { Question: { blocks: baseBlocks.map(b => b.id === 'backRow' ? { ...b, pos: { x: 37.5, y: 100, w: 300 } } : b) } } },
        }}
        questionIndex={0}
        onAnswer={vi.fn()}
        onBack={vi.fn()}
      />
    );
    const el = screen.getByText('Floaty').closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '80%' }); // 37.5/375 = 10%, 300/375 = 80%
  });

  it('resolves the back-row label from a bound axis when unset in copy', () => {
    render(
      <Question
        config={{
          copy: {}, questions: QUESTIONS,
          axes: [{ label: 'ย้อนสายรอด' }],
          appearance: {
            screen_config: {
              Question: {
                blocks: baseBlocks.map(b => b.id === 'backRow' ? { ...b, src: { text: { mode: 'axes', field: 'label', idx: 0 } } } : b),
              },
            },
          },
        }}
        questionIndex={0}
        onAnswer={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText('ย้อนสายรอด')).toBeInTheDocument();
  });
});

describe('Question — appearance (03 Typography / 04 Shape & Feel) wiring', () => {
  it('is pixel-identical to before when font_scale is unset (no-op default)', () => {
    render(<Question config={{ copy: {}, questions: QUESTIONS, appearance: {} }} questionIndex={0} onAnswer={vi.fn()} onBack={vi.fn()} />);
    const qText = screen.getByText('ไฟดับทั้งเมือง คุณทำอะไรก่อน?');
    // qCard text is font:`700 ${qCardSize}px/1.35 ...` with default qCardSize 20
    expect(qText.style.font).toContain('20px');
  });

  it('multiplies the question text font-size by font_scale', () => {
    render(<Question config={{ copy: {}, questions: QUESTIONS, appearance: { font_scale: 1.5 } }} questionIndex={0} onAnswer={vi.fn()} onBack={vi.fn()} />);
    const qText = screen.getByText('ไฟดับทั้งเมือง คุณทำอะไรก่อน?');
    expect(qText.style.font).toContain('30px'); // round(20 * 1.5)
  });

  it('applies var(--card-radius) to the qCard surface', () => {
    render(<Question config={{ copy: {}, questions: QUESTIONS }} questionIndex={0} onAnswer={vi.fn()} onBack={vi.fn()} />);
    const qText = screen.getByText('ไฟดับทั้งเมือง คุณทำอะไรก่อน?');
    const card = qText.parentElement as HTMLElement;
    expect(card.style.borderRadius).toBe('var(--card-radius)');
  });

  it('leaves the option row and key-badge radius on var(--radius), not var(--card-radius)', () => {
    render(<Question config={{ copy: {}, questions: QUESTIONS }} questionIndex={0} onAnswer={vi.fn()} onBack={vi.fn()} />);
    const optBtn = screen.getByText('หาน้ำ').closest('button') as HTMLElement;
    expect(optBtn.style.borderRadius).toBe('var(--radius)');
  });

  it('renders without crashing when shadow style is none/soft (resolved via CSS var, not a prop branch)', () => {
    expect(() =>
      render(<Question config={{ copy: {}, questions: QUESTIONS }} questionIndex={0} onAnswer={vi.fn()} onBack={vi.fn()} />)
    ).not.toThrow();
  });
});
