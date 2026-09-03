// Regression tests for Summary.tsx's screen_config wiring (order / show / geo / pos / pat / src).
// The "no screen_config" cases are the safety net: any campaign that has never touched the
// LIFF & Style block builder must render exactly as it always did — for BOTH solo and group
// modes, since Summary's section gating (isSoloMode / config.group?.enabled) branches on mode.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Summary from '../screens/Summary';

const axes = [
  { id: 'prep', label: 'เตรียมพร้อม', label_en: 'Prepper', body: 'คุณเป็นคนเตรียมพร้อมเสมอ', image_url: 'https://example.com/prep.png' },
  { id: 'chill', label: 'ปลงแล้ว', label_en: 'Chiller', body: 'ปลงกับทุกเรื่อง', image_url: 'https://example.com/chill.png' },
];

const basePairs = [
  { pairId: 'pair-1', role: 'inviter' as const, partnerName: 'มีน', status: 'completed' as const, resultTitle: 'รอด 7 วัน' },
];

function baseProps(overrides: Partial<React.ComponentProps<typeof Summary>> = {}): React.ComponentProps<typeof Summary> {
  return {
    config: {
      brand: { primary: '#E8354F' },
      copy: {},
      appearance: {},
      group: { enabled: false },
      axes,
      mode: 'pair',
    },
    campaignId: 'buddy_demo',
    liffId: 'mock-liff-id',
    myArchetypeLabel: 'เตรียมพร้อม',
    myArchetypeBody: 'คุณเป็นคนเตรียมพร้อมเสมอ',
    myArchetypeEn: 'Prepper',
    myArchetype: 'prep',
    pairsDone: 1,
    shareUrl: 'https://liff.line.me/mock',
    pairs: basePairs,
    onViewPair: vi.fn(),
    onRetake: vi.fn(),
    isFriend: true,
    ...overrides,
  };
}

describe('Summary — default behavior (no screen_config)', () => {
  it('solo mode: renders the survivor card, hides invite button and pair log', () => {
    const { container } = render(
      <Summary {...baseProps({ config: { ...baseProps().config, mode: 'solo', group: { enabled: false } } })} />
    );
    // Survivor card eyebrow + archetype name
    expect(screen.getByText(/SURVIVOR CARD/)).toBeInTheDocument();
    expect(screen.getByText('เตรียมพร้อม')).toBeInTheDocument();
    // Solo mode never shows the pair-invite button or the pair log section
    expect(screen.queryByText('เชิญเพื่อน ▾')).toBeNull();
    expect(screen.queryByText('คู่หูของฉัน')).toBeNull();
    // Card art renders at the original 92×118 size
    const img = container.querySelector('img[src="https://example.com/prep.png"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.style.width).toBe('92px');
    expect(img.style.height).toBe('118px');
    expect(img.style.borderRadius).toBe('');
  });

  it('pair mode: renders the invite button and the pair log with real pair data', () => {
    render(<Summary {...baseProps({ config: { ...baseProps().config, mode: 'pair' } })} />);
    expect(screen.getByText('เชิญเพื่อน ▾')).toBeInTheDocument();
    expect(screen.getByText('คู่หูของฉัน')).toBeInTheDocument();
    expect(screen.getByText('มีน')).toBeInTheDocument();
    expect(screen.getByText('1 คู่')).toBeInTheDocument();
  });

  it('group mode: fetches and renders the teams section + symbols row, gated on config.group.enabled', async () => {
    render(
      <Summary {...baseProps({
        config: { ...baseProps().config, mode: 'group', group: { enabled: true } },
        onGoSymbols: vi.fn(),
      })} />
    );
    // Teams section header always shows once group is enabled
    expect(screen.getByText('ทีมของฉัน')).toBeInTheDocument();
    // Empty-teams state renders once the (mocked) /api/group/my-groups call resolves
    await waitFor(() => expect(screen.getByText('ยังไม่มีทีม')).toBeInTheDocument());
    expect(screen.getByText('สะสมสัญลักษณ์')).toBeInTheDocument();
  });

  it('retake button only renders when onRetake is supplied', () => {
    const { rerender } = render(<Summary {...baseProps({ onRetake: undefined })} />);
    expect(screen.queryByText('↺ ตอบแบบทดสอบใหม่')).toBeNull();
    rerender(<Summary {...baseProps({ onRetake: vi.fn() })} />);
    expect(screen.getByText('↺ ตอบแบบทดสอบใหม่')).toBeInTheDocument();
  });
});

describe('Summary — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'survivorCard', uid: 'survivorCard', show: true, geo: {} },
    { id: 'retake', uid: 'retake', show: true, geo: {} },
    { id: 'actionRow', uid: 'actionRow', show: true, geo: {} },
    { id: 'teamSection', uid: 'teamSection', show: true, geo: {} },
    { id: 'symbolsRow', uid: 'symbolsRow', show: true, geo: {} },
    { id: 'pairLog', uid: 'pairLog', show: true, geo: {} },
  ];

  it('hides a block whose show flag is false', () => {
    render(
      <Summary {...baseProps({
        config: {
          ...baseProps().config,
          appearance: { screen_config: { Summary: { blocks: baseBlocks.map(b => b.id === 'retake' ? { ...b, show: false } : b) } } },
        },
      })} />
    );
    expect(screen.queryByText('↺ ตอบแบบทดสอบใหม่')).toBeNull();
    // Other blocks still render normally
    expect(screen.getByText(/SURVIVOR CARD/)).toBeInTheDocument();
  });

  it('applies a geo override (survivorCard artW, portrait shape keeps the 118/92 aspect)', () => {
    const { container } = render(
      <Summary {...baseProps({
        config: {
          ...baseProps().config,
          appearance: { screen_config: { Summary: { blocks: baseBlocks.map(b => b.id === 'survivorCard' ? { ...b, geo: { artW: 120 } } : b) } } },
        },
      })} />
    );
    const img = container.querySelector('img[src="https://example.com/prep.png"]') as HTMLImageElement;
    expect(img.style.width).toBe('120px');
    expect(img.style.height).toBe(`${Math.round(120 * (118 / 92))}px`);
  });

  it('renders a floating block with an absolute, percentage-based position', () => {
    render(
      <Summary {...baseProps({
        config: {
          ...baseProps().config,
          appearance: { screen_config: { Summary: { blocks: baseBlocks.map(b => b.id === 'retake' ? { ...b, pos: { x: 37.5, y: 200, w: 150 } } : b) } } },
        },
      })} />
    );
    const el = screen.getByText('↺ ตอบแบบทดสอบใหม่').closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '40%' }); // 37.5/375=10%, 150/375=40%
  });

  it('switches the survivorCard art shape to a circle via pat', () => {
    const { container } = render(
      <Summary {...baseProps({
        config: {
          ...baseProps().config,
          appearance: { screen_config: { Summary: { blocks: baseBlocks.map(b => b.id === 'survivorCard' ? { ...b, pat: { solo: 'circle' } } : b) } } },
        },
      })} />
    );
    const img = container.querySelector('img[src="https://example.com/prep.png"]') as HTMLImageElement;
    // circle shape: width === height === artW (default 92), borderRadius === artW
    expect(img.style.width).toBe('92px');
    expect(img.style.height).toBe('92px');
    expect(img.style.borderRadius).toBe('92px');
  });

  it('switches the survivorCard art shape to a square via pat', () => {
    const { container } = render(
      <Summary {...baseProps({
        config: {
          ...baseProps().config,
          appearance: { screen_config: { Summary: { blocks: baseBlocks.map(b => b.id === 'survivorCard' ? { ...b, pat: { solo: 'square' } } : b) } } },
        },
      })} />
    );
    const img = container.querySelector('img[src="https://example.com/prep.png"]') as HTMLImageElement;
    expect(img.style.width).toBe('92px');
    expect(img.style.height).toBe('92px');
    expect(img.style.borderRadius).toBe('10px');
  });
});

// Regression tests for the 02 Colors / 03 Typography / 04 Shape & Feel / 05 Art Style CSS-var
// wiring added in this session (App.tsx's applyTheme sets these on document.documentElement at
// runtime; here we set them directly to simulate that, since these unit tests render Summary
// in isolation without mounting App.tsx). The "no appearance fields set" cases are the pixel-
// identical safety net: scaleFont(N, undefined) === N and getPatternDefaults(undefined).solo
// === 'portrait', so an untouched campaign must render exactly as it did before this change.
describe('Summary — Colors / Typography / Shape & Feel / Art Style wiring', () => {
  it('font scale multiplies a text element\'s rendered font-size (default: no-op)', () => {
    // Default (no font_scale set): fs(22) === 22, unchanged from before this change.
    render(<Summary {...baseProps()} />);
    expect(screen.getByText('Prepper').style.fontSize).toBe('22px');
  });

  it('font scale multiplies a text element\'s rendered font-size (font_scale set)', () => {
    render(<Summary {...baseProps({ config: { ...baseProps().config, appearance: { font_scale: 1.5 } } })} />);
    // enName ("Prepper") renders at fs(22) = Math.round(22 * 1.5) = 33
    expect(screen.getByText('Prepper').style.fontSize).toBe('33px');
  });

  it('applies a custom --card-radius to the survivorCard and --badge-radius to the VALID badge', () => {
    document.documentElement.style.setProperty('--card-radius', '24px');
    document.documentElement.style.setProperty('--badge-radius', '6px');
    try {
      const { container } = render(<Summary {...baseProps()} />);
      const survivorCard = Array.from(container.querySelectorAll('div')).find(d => d.style.borderRadius === 'var(--card-radius)');
      expect(survivorCard).toBeDefined();
      expect(getComputedStyle(survivorCard!).borderRadius).toBe('24px');

      const badge = screen.getByText('VALID');
      expect(badge.style.borderRadius).toBe('var(--badge-radius)');
      expect(getComputedStyle(badge).borderRadius).toBe('6px');
    } finally {
      document.documentElement.style.removeProperty('--card-radius');
      document.documentElement.style.removeProperty('--badge-radius');
    }
  });

  it('applies --card-radius to pairLog\'s row card', () => {
    document.documentElement.style.setProperty('--card-radius', '18px');
    try {
      render(<Summary {...baseProps()} />);
      const pairLogRow = screen.getByText('มีน').closest('button') as HTMLElement;
      expect(pairLogRow.style.borderRadius).toBe('var(--card-radius)');
      expect(getComputedStyle(pairLogRow).borderRadius).toBe('18px');
    } finally {
      document.documentElement.style.removeProperty('--card-radius');
    }
  });

  it.each(['none', 'soft', 'hard'] as const)('renders without crashing for shadow style "%s"', (shadow) => {
    expect(() => render(
      <Summary {...baseProps({ config: { ...baseProps().config, appearance: { shadow } } })} />
    )).not.toThrow();
  });

  it('applies a --tilt-deg rotate transform to the survivorCard', () => {
    document.documentElement.style.setProperty('--tilt-deg', '1.4');
    try {
      const { container } = render(<Summary {...baseProps()} />);
      const survivorCard = Array.from(container.querySelectorAll('div')).find(d => d.style.borderRadius === 'var(--card-radius)');
      expect(survivorCard!.style.transform).toBe('rotate(calc(var(--tilt-deg) * -1deg))');
      expect(getComputedStyle(survivorCard!).transform).toContain('1.4');
    } finally {
      document.documentElement.style.removeProperty('--tilt-deg');
    }
  });

  it('global art_shape="circle" (no per-block pat override) makes survivorCard render the circle shape', () => {
    const { container } = render(
      <Summary {...baseProps({
        config: { ...baseProps().config, appearance: { art_shape: 'circle' } },
      })} />
    );
    const img = container.querySelector('img[src="https://example.com/prep.png"]') as HTMLImageElement;
    // circle shape: width === height === artW (default 92), borderRadius === artW
    expect(img.style.width).toBe('92px');
    expect(img.style.height).toBe('92px');
    expect(img.style.borderRadius).toBe('92px');
  });

  it('a per-block pat override still wins over the global art_shape default', () => {
    const { container } = render(
      <Summary {...baseProps({
        config: {
          ...baseProps().config,
          appearance: {
            art_shape: 'circle',
            screen_config: { Summary: { blocks: [{ id: 'survivorCard', uid: 'survivorCard', show: true, geo: {}, pat: { solo: 'square' } }] } },
          },
        },
      })} />
    );
    const img = container.querySelector('img[src="https://example.com/prep.png"]') as HTMLImageElement;
    expect(img.style.borderRadius).toBe('10px'); // square, not circle
  });
});
