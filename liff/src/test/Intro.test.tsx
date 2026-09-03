// Regression tests for Intro.tsx's screen_config wiring (order / show / geo / pos / src)
// and the newer 03 Typography / 04 Shape & Feel appearance wiring.
// The "no screen_config" / "appearance is empty" cases are the safety net: any campaign
// that has never touched those admin tabs must render exactly as it always did.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Intro from '../screens/Intro';

const baseConfig = { copy: {}, mode: 'pair', questions: [{}, {}, {}, {}, {}, {}], axes: [{}, {}, {}, {}, {}], appearance: {} };

describe('Intro — default behavior (no screen_config)', () => {
  it('renders the default quiz label, body and cta text', () => {
    render(<Intro config={baseConfig} onStart={vi.fn()} />);
    expect(screen.getByText('DUO QUIZ · 6 ข้อ')).toBeInTheDocument();
    expect(screen.getByText('เริ่มตอบ')).toBeInTheDocument();
  });

  it('renders campaign copy overrides', () => {
    render(<Intro config={{ ...baseConfig, copy: { intro_cta: 'ลุยเลย' } }} onStart={vi.fn()} />);
    expect(screen.getByText('ลุยเลย')).toBeInTheDocument();
  });

  it('calls onStart when the cta is clicked', () => {
    const onStart = vi.fn();
    render(<Intro config={baseConfig} onStart={onStart} />);
    screen.getByText('เริ่มตอบ').click();
    expect(onStart).toHaveBeenCalledWith(false);
  });

  it('renders the KV placeholder when no image is configured', () => {
    render(<Intro config={baseConfig} onStart={vi.fn()} />);
    expect(screen.getByText('KV IMAGE')).toBeInTheDocument();
  });
});

describe('Intro — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'kv', uid: 'kv', show: true, geo: {} },
    { id: 'infoCard', uid: 'infoCard', show: true, geo: {} },
    { id: 'cta', uid: 'cta', show: true, geo: {} },
    { id: 'note', uid: 'note', show: true, geo: {} },
  ];

  it('hides a block whose show flag is false', () => {
    render(
      <Intro
        config={{
          ...baseConfig,
          appearance: { screen_config: { Intro: { blocks: baseBlocks.map(b => b.id === 'infoCard' ? { ...b, show: false } : b) } } },
        }}
        onStart={vi.fn()}
      />
    );
    expect(screen.queryByText('DUO QUIZ · 6 ข้อ')).toBeNull();
    expect(screen.getByText('เริ่มตอบ')).toBeInTheDocument();
  });

  it('applies a geo override (kv image height)', () => {
    const { container } = render(
      <Intro
        config={{
          ...baseConfig,
          appearance: {
            images: { 'kv-intro': 'https://example.com/kv.png' },
            screen_config: { Intro: { blocks: baseBlocks.map(b => b.id === 'kv' ? { ...b, geo: { h: 240 } } : b) } },
          },
        }}
        onStart={vi.fn()}
      />
    );
    const img = container.querySelector('img') as HTMLElement;
    expect(img.style.height).toBe('240px');
  });

  it('applies a geo override (cta color=primary)', () => {
    render(
      <Intro
        config={{
          ...baseConfig,
          appearance: { screen_config: { Intro: { blocks: baseBlocks.map(b => b.id === 'cta' ? { ...b, geo: { color: 'primary' } } : b) } } },
        }}
        onStart={vi.fn()}
      />
    );
    const btn = screen.getByText('เริ่มตอบ').closest('button') as HTMLElement;
    expect(btn.style.background).toBe('var(--ac)');
  });

  it('renders a floating block with an absolute, percentage-based position', () => {
    render(
      <Intro
        config={{
          ...baseConfig,
          copy: { intro_note: 'Floaty' },
          appearance: { screen_config: { Intro: { blocks: baseBlocks.map(b => b.id === 'note' ? { ...b, pos: { x: 37.5, y: 100, w: 300 } } : b) } } },
        }}
        onStart={vi.fn()}
      />
    );
    const el = screen.getByText('Floaty').closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '80%' }); // 37.5/375 = 10%, 300/375 = 80%
  });

  it('resolves the infoCard label from a bound axis when copy.intro_quiz_label is unset', () => {
    render(
      <Intro
        config={{
          ...baseConfig,
          copy: {},
          axes: [{ label: 'สายไฟลุก' }],
          appearance: {
            screen_config: {
              Intro: { blocks: baseBlocks.map(b => b.id === 'infoCard' ? { ...b, src: { text: { mode: 'axes', field: 'label', idx: 0 } } } : b) },
            },
          },
        }}
        onStart={vi.fn()}
      />
    );
    expect(screen.getByText('สายไฟลุก')).toBeInTheDocument();
  });
});

describe('Intro — appearance (03 Typography / 04 Shape & Feel) wiring', () => {
  it('is pixel-identical to before when font_scale is unset (no-op default)', () => {
    render(<Intro config={baseConfig} onStart={vi.fn()} />);
    const body = screen.getByText('คุณกับเพื่อนจะรอดกี่วันถ้าโลกแตกพรุ่งนี้? ตอบ 6 ข้อรู้ว่าคุณเป็นสายไหน แล้วชวนเพื่อนมาจับคู่');
    // infoCard body text is font:`700 20px/1.35 ...`
    expect(body.style.font).toContain('20px');
  });

  it('multiplies the infoCard body font-size by font_scale', () => {
    render(<Intro config={{ ...baseConfig, appearance: { font_scale: 1.5 } }} onStart={vi.fn()} />);
    const body = screen.getByText('คุณกับเพื่อนจะรอดกี่วันถ้าโลกแตกพรุ่งนี้? ตอบ 6 ข้อรู้ว่าคุณเป็นสายไหน แล้วชวนเพื่อนมาจับคู่');
    expect(body.style.font).toContain('30px'); // round(20 * 1.5)
  });

  it('applies var(--card-radius) to the infoCard surface', () => {
    render(<Intro config={baseConfig} onStart={vi.fn()} />);
    const card = screen.getByText('DUO QUIZ · 6 ข้อ').parentElement as HTMLElement;
    expect(card.style.borderRadius).toBe('var(--card-radius)');
  });

  it('applies a rotate transform driven by var(--tilt-deg) to the infoCard', () => {
    render(<Intro config={baseConfig} onStart={vi.fn()} />);
    const card = screen.getByText('DUO QUIZ · 6 ข้อ').parentElement as HTMLElement;
    expect(card.style.transform).toBe('rotate(calc(var(--tilt-deg) * -1deg))');
  });

  it('leaves the cta button radius on var(--radius), not var(--card-radius)', () => {
    render(<Intro config={baseConfig} onStart={vi.fn()} />);
    const btn = screen.getByText('เริ่มตอบ').closest('button') as HTMLElement;
    expect(btn.style.borderRadius).toBe('var(--radius)');
  });

  it('renders without crashing (shadow style is resolved via CSS var, not a prop branch)', () => {
    expect(() => render(<Intro config={baseConfig} onStart={vi.fn()} />)).not.toThrow();
    const card = screen.getByText('DUO QUIZ · 6 ข้อ').parentElement as HTMLElement;
    expect(card.style.boxShadow).toBe('var(--shadow)');
  });
});
