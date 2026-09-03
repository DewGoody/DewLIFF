// Regression tests for SymbolCollection.tsx's screen_config wiring (order / show /
// geo / pos). The "no screen_config" cases are the safety net: any campaign that
// has never touched the LIFF & Style block builder must render exactly as it
// always did. topNav/symGrid have no data-source channel in the admin builder
// (not in CH_OF) and no pattern family (not in PATTERN_OF), so there's nothing
// to test there beyond order/show/geo/pos.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SymbolCollection from '../screens/SymbolCollection';

const archetypes = [
  { code: 'fire', title: 'ทีมไฟ', symbol_url: 'https://example.com/fire.png' },
  { code: 'water', title: 'ทีมน้ำ', symbol_url: 'https://example.com/water.png' },
];

const baseProps = {
  config: { copy: {}, group: { archetypes }, appearance: {} },
  campaignId: 'buddy_demo',
  onBack: vi.fn(),
};

describe('SymbolCollection — default behavior (no screen_config)', () => {
  it('renders the default title and unlocked count after loading', async () => {
    render(<SymbolCollection {...baseProps} />);
    expect(screen.getByText('สะสมสัญลักษณ์')).toBeInTheDocument();
    expect(await screen.findByText('0 / 2 ดวง')).toBeInTheDocument();
  });

  it('renders campaign copy overrides for the title', () => {
    render(<SymbolCollection {...baseProps} config={{ ...baseProps.config, copy: { symbols_title: 'คลังของฉัน' } }} />);
    expect(screen.getByText('คลังของฉัน')).toBeInTheDocument();
  });

  it('renders the empty-state message when there are no collectible archetypes', async () => {
    render(<SymbolCollection {...baseProps} config={{ ...baseProps.config, group: { archetypes: [] } }} />);
    expect(await screen.findByText('ยังไม่มีสัญลักษณ์ในแคมเปญนี้')).toBeInTheDocument();
  });

  it('lays the grid out in 3 columns by default', async () => {
    const { container } = render(<SymbolCollection {...baseProps} />);
    await screen.findByText('0 / 2 ดวง');
    const grid = container.querySelector('div[style*="grid-template-columns"]') as HTMLElement;
    expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(3, 1fr)' });
  });
});

describe('SymbolCollection — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'topNav', uid: 'topNav', show: true, geo: {} },
    { id: 'symGrid', uid: 'symGrid', show: true, geo: {} },
  ];

  it('hides the top nav when show is false, while the grid still renders', async () => {
    render(
      <SymbolCollection
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { Symbols: { blocks: baseBlocks.map(b => b.id === 'topNav' ? { ...b, show: false } : b) } } },
        }}
      />
    );
    expect(screen.queryByText('สะสมสัญลักษณ์')).toBeNull();
    const locked = await screen.findAllByText('???'); // grid still renders below the hidden top nav
    expect(locked).toHaveLength(2);
  });

  it('applies a geo override (symGrid cols → 4)', async () => {
    const { container } = render(
      <SymbolCollection
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { Symbols: { blocks: baseBlocks.map(b => b.id === 'symGrid' ? { ...b, geo: { cols: '4' } } : b) } } },
        }}
      />
    );
    await screen.findByText('0 / 2 ดวง');
    const grid = container.querySelector('div[style*="grid-template-columns"]') as HTMLElement;
    expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(4, 1fr)' });
  });

  it('renders a floating block with an absolute, percentage-based position', async () => {
    render(
      <SymbolCollection
        {...baseProps}
        config={{
          ...baseProps.config,
          appearance: { screen_config: { Symbols: { blocks: baseBlocks.map(b => b.id === 'topNav' ? { ...b, pos: { x: 37.5, y: 100, w: 300 } } : b) } } },
        }}
      />
    );
    const el = screen.getByText('สะสมสัญลักษณ์').closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '80%' }); // 37.5/375 = 10%, 300/375 = 80%
  });
});

// Regression tests for the newly-landed CSS custom properties (03 Typography /
// 04 Shape & Feel, applied at runtime by App.tsx's applyTheme()). Like
// PairResult, SymbolCollection just emits `var(--x)` and trusts App.tsx to have
// set the custom property on <html> before this screen mounts, so these tests
// set the custom property on document.documentElement directly.
describe('SymbolCollection — 03 Typography / 04 Shape & Feel wiring', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('font_scale multiplies the top-nav close icon\'s font-size (17px × 1.5 = 26px, rounded)', () => {
    render(<SymbolCollection {...baseProps} config={{ ...baseProps.config, appearance: { font_scale: 1.5 } }} />);
    expect(screen.getByText('✕')).toHaveStyle({ fontSize: '26px' }); // Math.round(17 * 1.5) = 26
  });

  it('font_scale is a no-op when unset (17px unchanged)', () => {
    render(<SymbolCollection {...baseProps} />);
    expect(screen.getByText('✕')).toHaveStyle({ fontSize: '17px' });
  });

  it('a custom card_radius (--card-radius) applies to symbol tile corners', async () => {
    document.documentElement.style.setProperty('--card-radius', '22px');
    const { container } = render(<SymbolCollection {...baseProps} />);
    await screen.findByText('0 / 2 ดวง');
    const tile = container.querySelector('div[style*="var(--card-radius)"]') as HTMLElement;
    expect(tile).not.toBeNull();
    expect(tile).toHaveStyle({ borderRadius: '22px' });
  });
});
