// Regression tests for PairResult.tsx's screen_config wiring (order / show / geo /
// pos / pattern variants). The "no screen_config" cases are the safety net: any
// campaign that has never touched the LIFF & Style block builder must render
// exactly as it always did.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PairResult from '../screens/PairResult';

const axes = [
  { id: 'a1', label: 'สายไฟลุก', image_url: 'https://example.com/a1.png' },
  { id: 'a2', label: 'สายน้ำนิ่ง', image_url: 'https://example.com/a2.png' },
];

const baseProps = {
  config: { copy: {}, axes, appearance: {} },
  partnerName: 'มีน',
  title: '12 วัน',
  body: 'คนหนึ่งกล้าเสี่ยง อีกคนคิดก่อนทำ',
  axisMe: 'สายไฟลุก',
  axisBuddy: 'สายน้ำนิ่ง',
  axisMeId: 'a1',
  axisBuddyId: 'a2',
  myName: 'คุณ',
  onBack: vi.fn(),
};

describe('PairResult — default behavior (no screen_config)', () => {
  it('renders the survival title and reason body', () => {
    render(<PairResult {...baseProps} />);
    expect(screen.getByText('12 วัน')).toBeInTheDocument();
    expect(screen.getByText('คนหนึ่งกล้าเสี่ยง อีกคนคิดก่อนทำ')).toBeInTheDocument();
  });

  it('renders the default badge text when copy is empty', () => {
    render(<PairResult {...baseProps} />);
    expect(screen.getByText('คู่นี้รอดได้')).toBeInTheDocument();
  });

  it('renders campaign copy overrides for the badge', () => {
    render(<PairResult {...baseProps} config={{ ...baseProps.config, copy: { pair_result_badge: 'สุดยอดคู่' } }} />);
    expect(screen.getByText('สุดยอดคู่')).toBeInTheDocument();
  });

  it('renders the default share CTA text', () => {
    render(<PairResult {...baseProps} />);
    expect(screen.getByText('แชร์ผลไปไลน์')).toBeInTheDocument();
  });

  it('renders axis chips with the default (pill) 20px radius — matches the admin builder\'s own canonical default (getPatternDefaults) when the block has no explicit pat override', () => {
    render(<PairResult {...baseProps} />);
    const chip = screen.getByText('มีน').parentElement!.parentElement!;
    expect(chip).toHaveStyle({ borderRadius: '20px' });
  });

  it('renders hero cards with the default tilt pattern (±8deg rotate)', () => {
    const { container } = render(<PairResult {...baseProps} />);
    const myCardEl = container.querySelector('div[style*="a1.png"]') as HTMLElement;
    const buddyCardEl = container.querySelector('div[style*="a2.png"]') as HTMLElement;
    expect(myCardEl).toHaveStyle({ transform: 'rotate(8deg)', marginLeft: '-34px' });
    expect(buddyCardEl).toHaveStyle({ transform: 'rotate(-8deg)', marginRight: '-34px' });
  });
});

describe('PairResult — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'hero2', uid: 'hero2', show: true, geo: {} },
    { id: 'resultCard', uid: 'resultCard', show: true, geo: {} },
    { id: 'axisChips', uid: 'axisChips', show: true, geo: {} },
    { id: 'shareRow', uid: 'shareRow', show: true, geo: {} },
  ];

  it('hides axis chips when show is false, while the result card still renders', () => {
    render(
      <PairResult
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { PairResult: { blocks: baseBlocks.map(b => b.id === 'axisChips' ? { ...b, show: false } : b) } } },
        }}
      />
    );
    expect(screen.queryByText('สายไฟลุก')).toBeNull();
    expect(screen.getByText('12 วัน')).toBeInTheDocument();
  });

  it('applies a geo override (hero2 height)', () => {
    const { container } = render(
      <PairResult
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { PairResult: { blocks: baseBlocks.map(b => b.id === 'hero2' ? { ...b, geo: { h: 150 } } : b) } } },
        }}
      />
    );
    const hero = container.querySelector('div[style*="FCEFE0"]') as HTMLElement;
    expect(hero).toHaveStyle({ height: '150px' });
  });

  it('renders a floating block with an absolute, percentage-based position', () => {
    render(
      <PairResult
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { PairResult: { blocks: baseBlocks.map(b => b.id === 'shareRow' ? { ...b, pos: { x: 37.5, y: 100, w: 300 } } : b) } } },
        }}
      />
    );
    const el = screen.getByText('คัดลอกลิงก์เชิญ').closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '80%' }); // 37.5/375 = 10%, 300/375 = 80%
  });

  it('switches hero2 to the "side" pair pattern (no rotate, small gap)', () => {
    const { container } = render(
      <PairResult
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { PairResult: { blocks: baseBlocks.map(b => b.id === 'hero2' ? { ...b, pat: { pair: 'side' } } : b) } } },
        }}
      />
    );
    const buddyCardEl = container.querySelector('div[style*="a2.png"]') as HTMLElement;
    expect(buddyCardEl).toHaveStyle({ marginRight: '8px' });
    expect(buddyCardEl.style.transform).toBe('');
  });

  it('switches hero2 to the "overlap" pair pattern (no rotate, deep overlap)', () => {
    const { container } = render(
      <PairResult
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { PairResult: { blocks: baseBlocks.map(b => b.id === 'hero2' ? { ...b, pat: { pair: 'overlap' } } : b) } } },
        }}
      />
    );
    const buddyCardEl = container.querySelector('div[style*="a2.png"]') as HTMLElement;
    expect(buddyCardEl).toHaveStyle({ marginRight: '-60px' });
    expect(buddyCardEl.style.transform).toBe('');
  });

  it('switches axisChips to the "pill" chip pattern (20px radius)', () => {
    render(
      <PairResult
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { PairResult: { blocks: baseBlocks.map(b => b.id === 'axisChips' ? { ...b, pat: { chip: 'pill' } } : b) } } },
        }}
      />
    );
    const chip = screen.getByText('มีน').parentElement!.parentElement!;
    expect(chip).toHaveStyle({ borderRadius: '20px' });
  });

  it('switches axisChips to the "cut" chip pattern (2px radius)', () => {
    render(
      <PairResult
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { PairResult: { blocks: baseBlocks.map(b => b.id === 'axisChips' ? { ...b, pat: { chip: 'cut' } } : b) } } },
        }}
      />
    );
    const chip = screen.getByText('มีน').parentElement!.parentElement!;
    expect(chip).toHaveStyle({ borderRadius: '2px' });
  });
});

// Regression tests for the newly-landed CSS custom properties (03 Typography /
// 04 Shape & Feel / 05 Art Style, applied at runtime by App.tsx's applyTheme()).
// PairResult itself never reads these appearance fields directly for anything
// but font_scale/art_hero — it just emits `var(--x)` and trusts App.tsx to have
// set the custom property on <html> before this screen mounts, so these tests
// set the custom properties on document.documentElement directly (the same
// thing App.tsx would have done) rather than mounting all of App.tsx.
describe('PairResult — 03 Typography / 04 Shape & Feel / 05 Art Style wiring', () => {
  const baseBlocks = [
    { id: 'hero2', uid: 'hero2', show: true, geo: {} },
    { id: 'resultCard', uid: 'resultCard', show: true, geo: {} },
    { id: 'axisChips', uid: 'axisChips', show: true, geo: {} },
    { id: 'shareRow', uid: 'shareRow', show: true, geo: {} },
  ];

  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('font_scale multiplies the survival title\'s font-size (38px × 1.5 = 57px)', () => {
    render(<PairResult {...baseProps} config={{ ...baseProps.config, appearance: { font_scale: 1.5 } }} />);
    expect(screen.getByText('12 วัน')).toHaveStyle({ fontSize: '57px' });
  });

  it('font_scale is a no-op when unset (38px unchanged)', () => {
    render(<PairResult {...baseProps} />);
    expect(screen.getByText('12 วัน')).toHaveStyle({ fontSize: '38px' });
  });

  it('a custom card_radius (--card-radius) applies to the result card', () => {
    document.documentElement.style.setProperty('--card-radius', '30px');
    const { container } = render(<PairResult {...baseProps} />);
    const resultCard = container.querySelector('div[style*="var(--card-radius)"]') as HTMLElement;
    expect(resultCard).not.toBeNull();
    expect(resultCard).toHaveStyle({ borderRadius: '30px' });
  });

  it('a custom axis_chip_radius (--axis-chip-radius) applies when the block explicitly uses the "soft" chip pattern', () => {
    document.documentElement.style.setProperty('--axis-chip-radius', '25px');
    render(
      <PairResult
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { PairResult: { blocks: baseBlocks.map(b => b.id === 'axisChips' ? { ...b, pat: { chip: 'soft' } } : b) } } },
        }}
      />
    );
    const chip = screen.getByText('มีน').parentElement!.parentElement!;
    expect(chip).toHaveStyle({ borderRadius: '25px' });
  });

  it('renders without crashing when Shadow Style is "none"', () => {
    document.documentElement.style.setProperty('--shadow', 'none');
    render(<PairResult {...baseProps} />);
    expect(screen.getByText('12 วัน')).toBeInTheDocument();
  });

  it('renders without crashing when Shadow Style is "soft"', () => {
    document.documentElement.style.setProperty('--shadow', '0 4px 16px rgba(28,26,23,.18)');
    render(<PairResult {...baseProps} />);
    expect(screen.getByText('12 วัน')).toBeInTheDocument();
  });

  it('--tilt-deg applies a rotate transform to the result card', () => {
    document.documentElement.style.setProperty('--tilt-deg', '1.4');
    const { container } = render(<PairResult {...baseProps} />);
    const resultCard = container.querySelector('div[style*="var(--card-radius)"]') as HTMLElement;
    expect(resultCard).toHaveStyle({ transform: 'rotate(calc(1.4 * -1deg))' });
  });

  it('--tilt-deg defaults to no visible rotation when unset (Card Tilt = off)', () => {
    const { container } = render(<PairResult {...baseProps} />);
    const resultCard = container.querySelector('div[style*="var(--card-radius)"]') as HTMLElement;
    expect(resultCard).toHaveStyle({ transform: 'rotate(calc(0 * -1deg))' });
  });

  // hero2's outer wrapper is the only element with this gradient background —
  // scope image-presence assertions to it, since axisChips also renders its own
  // small chip avatar images (from the same axis card URLs) further down the page.
  const getHero = (container: HTMLElement) => container.querySelector('div[style*="FCEFE0"]') as HTMLElement;

  it('art_hero="single" renders one centered image instead of the two-card default', () => {
    const { container } = render(<PairResult {...baseProps} config={{ ...baseProps.config, appearance: { art_hero: 'single' } }} />);
    const hero = getHero(container);
    expect(hero.querySelectorAll('div[style*="a1.png"]')).toHaveLength(1);
    expect(hero.querySelectorAll('div[style*="a2.png"]')).toHaveLength(0);
  });

  it('art_hero="band" renders a plain color bar, no image at all', () => {
    const { container } = render(<PairResult {...baseProps} config={{ ...baseProps.config, appearance: { art_hero: 'band' } }} />);
    const hero = getHero(container);
    expect(hero.querySelectorAll('div[style*="a1.png"]')).toHaveLength(0);
    expect(hero.querySelectorAll('div[style*="a2.png"]')).toHaveLength(0);
    const band = hero.querySelector('div[style*="78%"]') as HTMLElement;
    expect(band).not.toBeNull();
    expect(band.style.backgroundImage).toBe('initial');
  });

  it('art_hero defaults to "pair" (today\'s two tilted cards) when unset', () => {
    const { container } = render(<PairResult {...baseProps} />);
    const hero = getHero(container);
    expect(hero.querySelectorAll('div[style*="a1.png"]')).toHaveLength(1);
    expect(hero.querySelectorAll('div[style*="a2.png"]')).toHaveLength(1);
  });
});
