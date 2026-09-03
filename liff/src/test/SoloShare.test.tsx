// Regression tests for SoloShare.tsx's screen_config wiring (order / show / geo / pos / pat / src).
// The "no screen_config" cases are the safety net: any campaign that has never
// touched the LIFF & Style block builder must render exactly as it always did.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SoloShare from '../screens/SoloShare';

const baseConfig = { copy: {}, brand: {}, appearance: {} };

const baseProps = {
  config: baseConfig,
  campaignId: 'camp1',
  liffId: 'liff1',
  archTitle: 'สายไฟลุก',
  archBody: 'ตัดสินใจเร็วกว่าคิด',
  cardImageUrl: 'https://example.com/card.png',
  onBack: vi.fn(),
  onPlayAgain: vi.fn(),
};

describe('SoloShare — default behavior (no screen_config)', () => {
  it('renders the card with archTitle/archBody and the default LINE share label', () => {
    render(<SoloShare {...baseProps} />);
    expect(screen.getAllByText('สายไฟลุก').length).toBeGreaterThan(0);
    expect(screen.getByText('ตัดสินใจเร็วกว่าคิด')).toBeInTheDocument();
    expect(screen.getByText('ส่งผ่าน LINE')).toBeInTheDocument();
  });

  it('renders the card art at the original portrait size (130×172, radius 10)', () => {
    const { container } = render(<SoloShare {...baseProps} />);
    const artBox = container.querySelector('img[alt="สายไฟลุก"]')!.parentElement as HTMLElement;
    expect(artBox.style.width).toBe('130px');
    expect(artBox.style.height).toBe('172px');
    expect(artBox.style.borderRadius).toBe('10px');
  });

  it('omits the eyebrow line when no copy/src is bound', () => {
    const { container } = render(<SoloShare {...baseProps} />);
    // brandName renders in the same font as before; no extra eyebrow text node above it
    expect(container.querySelector('img[alt="สายไฟลุก"]')).not.toBeNull();
    expect(screen.queryByText(/summary_card_eyebrow/)).toBeNull();
  });
});

describe('SoloShare — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'survivorCard', uid: 'survivorCard', show: true, geo: {} },
    { id: 'shareRow', uid: 'shareRow', show: true, geo: {} },
  ];

  it('hides a block whose show flag is false', () => {
    render(
      <SoloShare
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { SoloShare: { blocks: baseBlocks.map(b => b.id === 'shareRow' ? { ...b, show: false } : b) } } },
        }}
      />
    );
    expect(screen.queryByText('ส่งผ่าน LINE')).toBeNull();
    expect(screen.getAllByText('สายไฟลุก').length).toBeGreaterThan(0);
  });

  it('applies a geo override (survivorCard artW)', () => {
    const { container } = render(
      <SoloShare
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { SoloShare: { blocks: baseBlocks.map(b => b.id === 'survivorCard' ? { ...b, geo: { artW: 100 } } : b) } } },
        }}
      />
    );
    const artBox = container.querySelector('img[alt="สายไฟลุก"]')!.parentElement as HTMLElement;
    expect(artBox.style.width).toBe('100px');
  });

  it('applies a pattern-variant override (solo → circle)', () => {
    const { container } = render(
      <SoloShare
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { SoloShare: { blocks: baseBlocks.map(b => b.id === 'survivorCard' ? { ...b, pat: { solo: 'circle' } } : b) } } },
        }}
      />
    );
    const artBox = container.querySelector('img[alt="สายไฟลุก"]')!.parentElement as HTMLElement;
    // circle: r=1 (height=width=130), radius=min(999,130)=130
    expect(artBox.style.width).toBe('130px');
    expect(artBox.style.height).toBe('130px');
    expect(artBox.style.borderRadius).toBe('130px');
  });

  it('renders a floating block with an absolute, percentage-based position', () => {
    render(
      <SoloShare
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { SoloShare: { blocks: baseBlocks.map(b => b.id === 'shareRow' ? { ...b, pos: { x: 37.5, y: 100, w: 300 } } : b) } } },
        }}
      />
    );
    const el = screen.getByText('ส่งผ่าน LINE').closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '80%' }); // 37.5/375 = 10%, 300/375 = 80%
  });

  it('resolves the shareRow LINE-button label from a bound copy key when copy.solo_share_send is unset', () => {
    render(
      <SoloShare
        {...baseProps}
        config={{
          copy: { some_other_key: 'ส่งเลย!' },
          brand: {},
          appearance: {
            screen_config: {
              SoloShare: {
                blocks: baseBlocks.map(b => b.id === 'shareRow' ? { ...b, src: { text: { mode: 'copy', key: 'some_other_key' } } } : b),
              },
            },
          },
        }}
      />
    );
    expect(screen.getByText('ส่งเลย!')).toBeInTheDocument();
  });
});

// Regression tests for the 02 Colors / 03 Typography / 04 Shape & Feel / 05 Art Style CSS-var
// wiring added in this session (App.tsx's applyTheme sets these on document.documentElement at
// runtime; here we set them directly to simulate that, since these unit tests render SoloShare
// in isolation without mounting App.tsx). The "no appearance fields set" cases are the pixel-
// identical safety net: scaleFont(N, undefined) === N and getPatternDefaults(undefined).solo
// === 'portrait', so an untouched campaign must render exactly as it did before this change.
describe('SoloShare — Colors / Typography / Shape & Feel / Art Style wiring', () => {
  it('font scale multiplies a text element\'s rendered font-size (default: no-op)', () => {
    render(<SoloShare {...baseProps} />);
    // eyebrow line — solo_share_eyebrow — renders at fs(11) === 11 by default
    expect(screen.getByText('แชร์ผลของคุณ').style.fontSize).toBe('11px');
  });

  it('font scale multiplies a text element\'s rendered font-size (font_scale set)', () => {
    render(
      <SoloShare
        {...baseProps}
        config={{ ...baseConfig, appearance: { font_scale: 2 } }}
      />
    );
    // fs(11) = Math.round(11 * 2) = 22
    expect(screen.getByText('แชร์ผลของคุณ').style.fontSize).toBe('22px');
  });

  it('replaces the hardcoded LINE-brand hex with var(--line) on the LINE share and copy-link buttons', () => {
    document.documentElement.style.setProperty('--line', '#00B900');
    try {
      render(<SoloShare {...baseProps} />);
      const lineBtn = screen.getByText('ส่งผ่าน LINE');
      expect(lineBtn.style.background).toBe('var(--line)');
      expect(getComputedStyle(lineBtn).background).toBe('#00B900');
    } finally {
      document.documentElement.style.removeProperty('--line');
    }
  });

  it('applies a custom --card-radius to the survivorCard', () => {
    document.documentElement.style.setProperty('--card-radius', '30px');
    try {
      const { container } = render(<SoloShare {...baseProps} />);
      const survivorCard = container.querySelector('img[alt="สายไฟลุก"]')!.parentElement!.parentElement!.parentElement as HTMLElement;
      expect(survivorCard.style.borderRadius).toBe('var(--card-radius)');
      expect(getComputedStyle(survivorCard).borderRadius).toBe('30px');
    } finally {
      document.documentElement.style.removeProperty('--card-radius');
    }
  });

  it.each(['none', 'soft', 'hard'] as const)('renders without crashing for shadow style "%s"', (shadow) => {
    expect(() => render(
      <SoloShare {...baseProps} config={{ ...baseConfig, appearance: { shadow } }} />
    )).not.toThrow();
  });

  it('applies a --tilt-deg rotate transform to the survivorCard', () => {
    document.documentElement.style.setProperty('--tilt-deg', '0.6');
    try {
      const { container } = render(<SoloShare {...baseProps} />);
      const survivorCard = container.querySelector('img[alt="สายไฟลุก"]')!.parentElement!.parentElement!.parentElement as HTMLElement;
      expect(survivorCard.style.transform).toBe('rotate(calc(var(--tilt-deg) * -1deg))');
      expect(getComputedStyle(survivorCard).transform).toContain('0.6');
    } finally {
      document.documentElement.style.removeProperty('--tilt-deg');
    }
  });

  it('global art_shape="circle" (no per-block pat override) makes survivorCard render the circle shape', () => {
    const { container } = render(
      <SoloShare {...baseProps} config={{ ...baseConfig, appearance: { art_shape: 'circle' } }} />
    );
    const artBox = container.querySelector('img[alt="สายไฟลุก"]')!.parentElement as HTMLElement;
    // circle: r=1 (height=width=130), radius=min(999,130)=130
    expect(artBox.style.width).toBe('130px');
    expect(artBox.style.height).toBe('130px');
    expect(artBox.style.borderRadius).toBe('130px');
  });

  it('a per-block pat override still wins over the global art_shape default', () => {
    const { container } = render(
      <SoloShare
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: {
            art_shape: 'circle',
            screen_config: { SoloShare: { blocks: [{ id: 'survivorCard', uid: 'survivorCard', show: true, geo: {}, pat: { solo: 'square' } }] } },
          },
        }}
      />
    );
    const artBox = container.querySelector('img[alt="สายไฟลุก"]')!.parentElement as HTMLElement;
    expect(artBox.style.width).toBe('130px');
    expect(artBox.style.height).toBe('130px');
    expect(artBox.style.borderRadius).toBe('10px'); // square, not circle
  });
});
