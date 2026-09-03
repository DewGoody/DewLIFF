// Regression tests for ErrorScreen.tsx's screen_config wiring (order / show / geo / pos / src).
// The "no screen_config" cases are the safety net: any campaign that has never touched the
// LIFF & Style block builder — and today's App.tsx, which doesn't even pass appearance/axes
// yet — must render exactly as it always did.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorScreen from '../screens/ErrorScreen';

describe('ErrorScreen — default behavior (no screen_config)', () => {
  it('renders default heading/body/retry/close copy', () => {
    render(<ErrorScreen title="" body="" />);
    expect(screen.getByText('อ๊ะ! สัญญาณหลุด')).toBeInTheDocument();
    expect(screen.getByText('โลกกำลังจะแตกก็แบบนี้แหละ ลองอีกทีนะ')).toBeInTheDocument();
    expect(screen.getByText('กลับหน้าแรก')).toBeInTheDocument();
  });

  it('renders campaign copy overrides for heading/body', () => {
    render(<ErrorScreen title="" body="ลองใหม่นะ" copy={{ error_heading: 'พังแล้ว' }} />);
    expect(screen.getByText('พังแล้ว')).toBeInTheDocument();
    expect(screen.getByText('ลองใหม่นะ')).toBeInTheDocument();
  });

  it('renders the retry button only when onRetry is provided', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorScreen title="" body="" />);
    expect(screen.queryByText('ลองอีกครั้ง')).toBeNull();
    rerender(<ErrorScreen title="" body="" onRetry={onRetry} copy={{ error_retry_btn: 'ลองใหม่' }} />);
    const btn = screen.getByText('ลองใหม่');
    btn.click();
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders the error art image when cardUrl is set', () => {
    const { container } = render(<ErrorScreen title="" body="" cardUrl="https://example.com/x.png" />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/x.png');
  });

  it('omits the image entirely when cardUrl is unset', () => {
    const { container } = render(<ErrorScreen title="" body="" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the title caption only when title is truthy', () => {
    const { rerender } = render(<ErrorScreen title="" body="" />);
    expect(screen.queryByText('detail-code')).toBeNull();
    rerender(<ErrorScreen title="detail-code" body="" />);
    expect(screen.getByText('detail-code')).toBeInTheDocument();
  });
});

describe('ErrorScreen — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'errArt', uid: 'errArt', show: true, geo: {} },
    { id: 'errCopy', uid: 'errCopy', show: true, geo: {} },
    { id: 'errRetry', uid: 'errRetry', show: true, geo: {} },
  ];

  it('hides a block whose show flag is false', () => {
    const { container } = render(
      <ErrorScreen
        title=""
        body=""
        cardUrl="https://example.com/x.png"
        appearance={{ screen_config: { Error: { blocks: baseBlocks.map(b => b.id === 'errArt' ? { ...b, show: false } : b) } } }}
      />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('อ๊ะ! สัญญาณหลุด')).toBeInTheDocument();
  });

  it('applies a geo override (art size)', () => {
    const { container } = render(
      <ErrorScreen
        title=""
        body=""
        cardUrl="https://example.com/x.png"
        appearance={{ screen_config: { Error: { blocks: baseBlocks.map(b => b.id === 'errArt' ? { ...b, geo: { h: 90 } } : b) } } }}
      />
    );
    const wrapper = container.querySelector('img')!.parentElement as HTMLElement;
    expect(wrapper.style.width).toBe('90px');
    expect(wrapper.style.height).toBe('90px');
  });

  it('renders a floating block with an absolute, percentage-based position', () => {
    render(
      <ErrorScreen
        title=""
        body=""
        copy={{ error_heading: 'Floaty' }}
        appearance={{ screen_config: { Error: { blocks: baseBlocks.map(b => b.id === 'errCopy' ? { ...b, pos: { x: 37.5, y: 100, w: 300 } } : b) } } }}
      />
    );
    const el = screen.getByText('Floaty').closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '80%' }); // 37.5/375 = 10%, 300/375 = 80%
  });

  it('resolves errCopy heading from a bound axis when unset in copy', () => {
    render(
      <ErrorScreen
        title=""
        body=""
        axes={[{ label: 'สายรอด' }]}
        appearance={{
          screen_config: {
            Error: {
              blocks: baseBlocks.map(b => b.id === 'errCopy' ? { ...b, src: { text: { mode: 'axes', field: 'label', idx: 0 } } } : b),
            },
          },
        }}
      />
    );
    expect(screen.getByText('สายรอด')).toBeInTheDocument();
  });
});

describe('ErrorScreen — new appearance wiring (font scale)', () => {
  it('is pixel-identical to before when appearance.font_scale is unset', () => {
    render(<ErrorScreen title="" body="" copy={{ error_heading: 'พังแล้ว' }} appearance={{}} />);
    const heading = screen.getByText('พังแล้ว');
    expect(heading.style.font).toContain('26px');
  });

  it('multiplies the heading font-size by font_scale', () => {
    render(<ErrorScreen title="" body="" copy={{ error_heading: 'ใหญ่ขึ้น' }} appearance={{ font_scale: 2 }} />);
    const heading = screen.getByText('ใหญ่ขึ้น');
    expect(heading.style.font).toContain('52px'); // 26 * 2
  });

  it('does not crash with a custom font_scale and no crash on render', () => {
    expect(() => render(<ErrorScreen title="" body="" onRetry={() => {}} appearance={{ font_scale: 0.8 }} />)).not.toThrow();
  });
});
