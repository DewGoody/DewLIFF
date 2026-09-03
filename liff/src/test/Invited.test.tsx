// Regression tests for Invited.tsx's screen_config wiring (order / show / geo / pos / src).
// The "no screen_config" cases are the safety net: any campaign that has never
// touched the LIFF & Style block builder must render exactly as it always did.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Invited from '../screens/Invited';

const baseConfig = { copy: {}, axes: [], appearance: {} };

describe('Invited — default behavior (no screen_config)', () => {
  it('renders the default duo invite badge and cta text', () => {
    render(
      <Invited config={baseConfig} inviterName="มีน" isFriend onStart={vi.fn()} />
    );
    expect(screen.getByText('คำเชิญ!')).toBeInTheDocument();
    expect(screen.getByText('ตอบให้มีน')).toBeInTheDocument();
  });

  it('renders the default hero image src', () => {
    const { container } = render(
      <Invited config={baseConfig} isFriend onStart={vi.fn()} />
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs[0]).toHaveAttribute('src', 'https://qcggwkdxjtwaesesehnw.supabase.co/storage/v1/object/public/campaign-assets/duo-quiz/invited-hero.png');
  });

  it('renders the note ghost button below the cta', () => {
    render(
      <Invited config={baseConfig} isFriend onStart={vi.fn()} />
    );
    expect(screen.getByText('ดูแคมเปญก่อน')).toBeInTheDocument();
  });

  it('renders the team-full double-button variant unaffected', () => {
    render(
      <Invited
        config={baseConfig}
        mode="team"
        isFull
        alreadyAnswered={false}
        onViewGroup={vi.fn()}
        isFriend
        onStart={vi.fn()}
      />
    );
    expect(screen.getByText('ทีมเต็มแล้ว!')).toBeInTheDocument();
    expect(screen.getByText('ดูผลลัพท์เต็ม')).toBeInTheDocument();
    expect(screen.getByText('ตอบแบบทดสอบ')).toBeInTheDocument();
  });
});

describe('Invited — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'invitedHero', uid: 'invitedHero', show: true, geo: {} },
    { id: 'inviterCard', uid: 'inviterCard', show: true, geo: {} },
    { id: 'cta', uid: 'cta', show: true, geo: {} },
    { id: 'note', uid: 'note', show: true, geo: {} },
  ];

  it('hides a block whose show flag is false', () => {
    render(
      <Invited
        config={{
          ...baseConfig,
          appearance: { screen_config: { Invited: { blocks: baseBlocks.map(b => b.id === 'inviterCard' ? { ...b, show: false } : b) } } },
        }}
        inviterName="มีน"
        isFriend
        onStart={vi.fn()}
      />
    );
    expect(screen.queryByText('คำเชิญ!')).toBeNull();
    expect(screen.getByText('ตอบให้มีน')).toBeInTheDocument();
  });

  it('applies a geo override (hero image height)', () => {
    const { container } = render(
      <Invited
        config={{
          ...baseConfig,
          appearance: { screen_config: { Invited: { blocks: baseBlocks.map(b => b.id === 'invitedHero' ? { ...b, geo: { h: 200 } } : b) } } },
        }}
        isFriend
        onStart={vi.fn()}
      />
    );
    const heroWrap = container.querySelectorAll('img')[0].parentElement as HTMLElement;
    expect(heroWrap.style.height).toBe('200px');
  });

  it('applies a geo override (cta color=primary)', () => {
    render(
      <Invited
        config={{
          ...baseConfig,
          appearance: { screen_config: { Invited: { blocks: baseBlocks.map(b => b.id === 'cta' ? { ...b, geo: { color: 'primary' } } : b) } } },
        }}
        inviterName="มีน"
        isFriend
        onStart={vi.fn()}
      />
    );
    const btn = screen.getByText('ตอบให้มีน').closest('button') as HTMLElement;
    expect(btn.style.background).toBe('var(--ac)');
  });

  it('renders a floating block with an absolute, percentage-based position', () => {
    render(
      <Invited
        config={{
          ...baseConfig,
          appearance: { screen_config: { Invited: { blocks: baseBlocks.map(b => b.id === 'note' ? { ...b, pos: { x: 37.5, y: 100, w: 300 } } : b) } } },
        }}
        isFriend
        onStart={vi.fn()}
      />
    );
    const el = screen.getByText('ดูแคมเปญก่อน').closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '80%' }); // 37.5/375 = 10%, 300/375 = 80%
  });

  it('resolves the inviterCard badge from a bound axis when copy.invited_duo_badge is unset', () => {
    render(
      <Invited
        config={{
          copy: {},
          axes: [{ id: 'a1', label: 'สายไฟลุก', label_en: 'THE FLARE' }],
          appearance: {
            screen_config: {
              Invited: {
                blocks: baseBlocks.map(b => b.id === 'inviterCard' ? { ...b, src: { text: { mode: 'axes', field: 'label', idx: 0 } } } : b),
              },
            },
          },
        }}
        isFriend
        onStart={vi.fn()}
      />
    );
    expect(screen.getByText('สายไฟลุก')).toBeInTheDocument();
  });
});

describe('Invited — appearance (03 Typography / 04 Shape & Feel) wiring', () => {
  it('multiplies a literal font-size by appearance.font_scale', () => {
    render(
      <Invited
        config={{ ...baseConfig, appearance: { font_scale: 1.5 } }}
        inviterName="มีน"
        isFriend
        onStart={vi.fn()}
      />
    );
    // inviterName label is font:"700 16px/1.4 ..." → 16 * 1.5 = 24
    const nameEl = screen.getByText('มีน');
    expect(nameEl.style.font).toContain('24px');
  });

  it('leaves font-size unchanged when font_scale is unset (no-op default)', () => {
    render(
      <Invited config={baseConfig} inviterName="มีน" isFriend onStart={vi.fn()} />
    );
    const nameEl = screen.getByText('มีน');
    expect(nameEl.style.font).toContain('16px');
  });

  it('applies var(--card-radius) to the inviterCard surface', () => {
    render(
      <Invited config={baseConfig} inviterName="มีน" isFriend onStart={vi.fn()} />
    );
    const card = screen.getByText('คำเชิญ!').parentElement as HTMLElement;
    expect(card.style.borderRadius).toBe('var(--card-radius)');
  });

  it('applies a rotate transform driven by var(--tilt-deg) to the inviterCard', () => {
    render(
      <Invited config={baseConfig} inviterName="มีน" isFriend onStart={vi.fn()} />
    );
    const card = screen.getByText('คำเชิญ!').parentElement as HTMLElement;
    expect(card.style.transform).toBe('rotate(calc(var(--tilt-deg) * -1deg))');
  });

  it('wires the inviterCard shadow to var(--shadow), which App.tsx branches by Shadow Style (none/soft/hard) — renders without crashing either way', () => {
    const { getByText, unmount } = render(
      <Invited config={baseConfig} inviterName="มีน" isFriend onStart={vi.fn()} />
    );
    const card = getByText('คำเชิญ!').parentElement as HTMLElement;
    expect(card.style.boxShadow).toBe('var(--shadow)');
    unmount();
    expect(() => render(<Invited config={baseConfig} inviterName="มีน" isFriend onStart={vi.fn()} />)).not.toThrow();
  });
});
