// Regression tests for Loading.tsx's screen_config wiring (order / show / geo / pos).
// The "no screen_config" cases are the safety net: any campaign that has never
// touched the LIFF & Style block builder must render exactly as it always did.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loading from '../screens/Loading';

describe('Loading — default behavior (no screen_config)', () => {
  it('renders the default title/body when copy is empty', () => {
    render(<Loading config={{ copy: {}, appearance: {} }} />);
    expect(screen.getByText('LOADING')).toBeInTheDocument();
    expect(screen.getByText('กำลังโหลด...')).toBeInTheDocument();
  });

  it('renders campaign copy overrides', () => {
    render(<Loading config={{ copy: { loading_title: 'รอแป๊บ', loading_body: 'ใกล้แล้ว' }, appearance: {} }} />);
    expect(screen.getByText('รอแป๊บ')).toBeInTheDocument();
    expect(screen.getByText('ใกล้แล้ว')).toBeInTheDocument();
  });

  it('renders the loading image when appearance.images.loading is set', () => {
    const { container } = render(<Loading config={{ copy: {}, appearance: { images: { loading: 'https://example.com/x.png' } } }} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/x.png');
  });

  it('omits the image entirely when unset', () => {
    const { container } = render(<Loading config={{ copy: {}, appearance: {} }} />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('Loading — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'loadArt', uid: 'loadArt', show: true, geo: {} },
    { id: 'loadCopy', uid: 'loadCopy', show: true, geo: {} },
    { id: 'loadBar', uid: 'loadBar', show: true, geo: {} },
  ];

  it('hides a block whose show flag is false', () => {
    render(
      <Loading config={{
        copy: { loading_title: 'X' },
        appearance: { images: { loading: 'https://example.com/x.png' }, screen_config: { Loading: { blocks: baseBlocks.map(b => b.id === 'loadArt' ? { ...b, show: false } : b) } } },
      }} />
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('applies a geo override (image height)', () => {
    const { container } = render(
      <Loading config={{
        copy: {},
        appearance: { images: { loading: 'https://example.com/x.png' }, screen_config: { Loading: { blocks: baseBlocks.map(b => b.id === 'loadArt' ? { ...b, geo: { h: 80 } } : b) } } },
      }} />
    );
    const img = container.querySelector('img')!.parentElement as HTMLElement;
    expect(img.style.width).toBe('80px');
    expect(img.style.height).toBe('80px');
  });

  it('renders a floating block with an absolute, percentage-based position', () => {
    render(
      <Loading config={{
        copy: { loading_title: 'Floaty' },
        appearance: { screen_config: { Loading: { blocks: baseBlocks.map(b => b.id === 'loadCopy' ? { ...b, pos: { x: 37.5, y: 100, w: 300 } } : b) } } },
      }} />
    );
    const el = screen.getByText('Floaty').closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '80%' }); // 37.5/375 = 10%, 300/375 = 80%
  });
});

describe('Loading — new appearance wiring (font scale / shape & feel / progress style)', () => {
  it('is pixel-identical to before when appearance is empty (no font_scale, no progress_style_loading)', () => {
    render(<Loading config={{ copy: { loading_title: 'X' }, appearance: {} }} />);
    const title = screen.getByText('X');
    expect(title.style.fontSize).toBe('28px');
    const bar = document.querySelector('.pbar-loading');
    expect(bar).not.toBeNull();
    const track = bar!.parentElement as HTMLElement;
    expect(track.style.borderRadius).toBe('var(--progress-radius)');
  });

  it('multiplies the title font-size by font_scale', () => {
    render(<Loading config={{ copy: { loading_title: 'Scaled' }, appearance: { font_scale: 1.5 } }} />);
    const title = screen.getByText('Scaled');
    expect(title.style.fontSize).toBe('42px'); // round(28 * 1.5)
  });

  it('renders the default progress bar (.pbar-loading) when progress_style_loading is unset or "default"', () => {
    const { container } = render(<Loading config={{ copy: {}, appearance: { progress_style_loading: 'default' } }} />);
    expect(container.querySelector('.pbar-loading')).not.toBeNull();
  });

  it('renders a narrower compact progress fill for progress_style_loading "compact"', () => {
    const { container } = render(<Loading config={{ copy: {}, appearance: { progress_style_loading: 'compact' } }} />);
    expect(container.querySelector('.pbar-loading')).toBeNull();
    const fill = container.querySelector('.pbar-stripe') as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('45%');
  });

  it('renders a solid-color fill for progress_style_loading "bar"', () => {
    const { container } = render(<Loading config={{ copy: {}, appearance: { progress_style_loading: 'bar' } }} />);
    const fill = container.querySelector('.pbar-stripe') as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe('82%');
    expect(fill.style.background).toBe('var(--ac)');
  });
});
