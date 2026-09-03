// Regression tests for Group.tsx's screen_config wiring (order / show / geo /
// pos / pattern variants), for BOTH the main 'Group' screen and the
// independently-configured 'GroupComplete' section (the "TEAM COMPLETE!"
// moment shown inline inside Group.tsx when the team just filled up).
// The "no screen_config" cases are the safety net: any campaign that has
// never touched the LIFF & Style block builder must render exactly as it
// always did.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import Group from '../screens/Group';
import { server } from './server';

const axes = [
  { id: 'a1', label: 'สายไฟลุก', image_url: 'https://example.com/a1.png' },
  { id: 'a2', label: 'สายน้ำนิ่ง', image_url: 'https://example.com/a2.png' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockGroupView(overrides: any = {}) {
  return {
    groupId: 'g1',
    campaignId: 'camp1',
    creatorId: 'Umock123',
    createdBy: 'Umock123',
    name: 'ทีมทดสอบ',
    members: [
      { userId: 'Umock123', displayName: 'คุณ', topAxis: 'a1', batchNo: 1, joinedAt: '2024-01-01' },
      { userId: 'U2', displayName: 'มีน', topAxis: 'a2', batchNo: 1, joinedAt: '2024-01-01' },
    ],
    result: { archetype: null, score: null, scoreUnit: null, isLocked: false },
    totalMembers: 2,
    memberCount: 2,
    overflowMode: 'fixed',
    batchSize: 5,
    maxMembers: 5,
    ...overrides,
  };
}

const baseConfig = {
  brand: { primary: '#E8354F', name: 'APOCALYPSE SQUAD' },
  copy: {} as Record<string, string>,
  axes,
  group: { enabled: true, max_members: 5, min_members: 2 },
  appearance: {} as { screen_config?: Record<string, { blocks: unknown[] }> },
};

const baseProps = {
  groupId: 'g1',
  campaignId: 'camp1',
  myUserId: 'Umock123',
  liffId: 'liff-123',
  isFriend: true,
  onBack: vi.fn(),
  onViewPair: vi.fn(),
};

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get('*/api/group/:groupId', () => HttpResponse.json(mockGroupView())),
  );
});

describe('Group — default behavior (no screen_config)', () => {
  it('renders the default page title and members heading when copy is empty', async () => {
    render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('สมาชิก');
    expect(screen.getAllByText('ผลกลุ่ม').length).toBeGreaterThan(0); // page title + card kicker
  });

  it('renders the fan-card header with the default (fan) arrangement', async () => {
    const { container } = render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('สมาชิก');
    const img2 = container.querySelector('img[src="https://example.com/a2.png"]') as HTMLElement;
    expect(img2).toHaveStyle({ transform: 'rotate(7deg)', marginLeft: '-24px' });
    const hero = container.querySelector('div[style*="FCEFE0"]') as HTMLElement;
    expect(hero).toHaveStyle({ height: '220px' });
  });

  it('renders member rows with name and axis label', async () => {
    render(<Group {...baseProps} config={baseConfig} />);
    const nameEl = await screen.findByText('มีน');
    expect(nameEl.parentElement?.textContent).toContain('สายน้ำนิ่ง');
  });

  it('renders axis composition chips with the default (pill / 20px) radius', async () => {
    const { container } = render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('สมาชิก');
    const chips = container.querySelectorAll('span[style*="padding: 3px 10px"]');
    expect(chips.length).toBe(2);
    chips.forEach(chip => expect(chip).toHaveStyle({ borderRadius: '20px' }));
  });

  it('renders the invite-more button with the remaining-count copy', async () => {
    render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('ชวนเพิ่ม · ยังว่างอีก 3 คน');
  });

  it('omits the invite-more button once the group is locked/full', async () => {
    server.use(http.get('*/api/group/:groupId', () => HttpResponse.json(mockGroupView({
      result: { archetype: null, score: null, scoreUnit: null, isLocked: true },
    }))));
    render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('สมาชิก');
    expect(screen.queryByText(/ชวนเพิ่ม/)).toBeNull();
  });
});

describe('Group — TEAM COMPLETE! moment (no screen_config)', () => {
  it('shows the default push/title/cta copy when the team just filled up', async () => {
    server.use(http.get('*/api/group/:groupId', () => HttpResponse.json(mockGroupView({
      overflowMode: 'fixed', batchSize: 2, maxMembers: 2,
    }))));
    render(<Group {...baseProps} config={{ ...baseConfig, group: { enabled: true, max_members: 2, min_members: 1 } }} />);
    await screen.findByText('TEAM COMPLETE!');
    expect(screen.getByText('ทีมของคุณครบ 2 คนแล้ว เปิดดูผลทีมได้เลย')).toBeInTheDocument();
  });
});

describe('Group — screen_config from the LIFF & Style builder', () => {
  const baseBlocks = [
    { id: 'topNav', uid: 'topNav', show: true, geo: {} },
    { id: 'grpHero', uid: 'grpHero', show: true, geo: {} },
    { id: 'grpCard', uid: 'grpCard', show: true, geo: {} },
    { id: 'memberList', uid: 'memberList', show: true, geo: {} },
    { id: 'axisCounts', uid: 'axisCounts', show: true, geo: {} },
    { id: 'inviteMore', uid: 'inviteMore', show: true, geo: {} },
  ];

  it('hides a block whose show flag is false', async () => {
    const { container } = render(
      <Group
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { Group: { blocks: baseBlocks.map(b => b.id === 'axisCounts' ? { ...b, show: false } : b) } } },
        }}
      />
    );
    await screen.findByText('สมาชิก');
    expect(container.querySelectorAll('span[style*="padding: 3px 10px"]').length).toBe(0);
  });

  it('applies a geo override (grpCard padding)', async () => {
    const { container } = render(
      <Group
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { Group: { blocks: baseBlocks.map(b => b.id === 'grpCard' ? { ...b, geo: { pad: 24 } } : b) } } },
        }}
      />
    );
    await screen.findByText('สมาชิก');
    const card = container.querySelector('div[style*="5px 6px 0 #1C1A17"]') as HTMLElement;
    expect(card).toHaveStyle({ padding: '24px' });
  });

  it('renders a floating block with an absolute, percentage-based position', async () => {
    render(
      <Group
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { Group: { blocks: baseBlocks.map(b => b.id === 'inviteMore' ? { ...b, pos: { x: 37.5, y: 100, w: 300 } } : b) } } },
        }}
      />
    );
    const btn = await screen.findByText('ชวนเพิ่ม · ยังว่างอีก 3 คน');
    const el = btn.closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '10%', width: '80%' }); // 37.5/375 = 10%, 300/375 = 80%
  });

  it('switches grpHero to the "stack" group pattern', async () => {
    const { container } = render(
      <Group
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { Group: { blocks: baseBlocks.map(b => b.id === 'grpHero' ? { ...b, pat: { group: 'stack' } } : b) } } },
        }}
      />
    );
    await screen.findByText('สมาชิก');
    const img2 = container.querySelector('img[src="https://example.com/a2.png"]') as HTMLElement;
    expect(img2).toHaveStyle({ marginLeft: '-46px', width: '100px', height: '140px' });
    expect(img2.style.transform).toBe('');
  });

  it('switches grpHero to the "grid" group pattern', async () => {
    const { container } = render(
      <Group
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { Group: { blocks: baseBlocks.map(b => b.id === 'grpHero' ? { ...b, pat: { group: 'grid' } } : b) } } },
        }}
      />
    );
    await screen.findByText('สมาชิก');
    const grid = container.querySelector('div[style*="grid-template-columns"]') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.style.gridTemplateColumns).toBe('repeat(2,1fr)');
  });

  it('switches axisCounts to the "soft" chip pattern (8px radius)', async () => {
    const { container } = render(
      <Group
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { Group: { blocks: baseBlocks.map(b => b.id === 'axisCounts' ? { ...b, pat: { chip: 'soft' } } : b) } } },
        }}
      />
    );
    await screen.findByText('สมาชิก');
    const chips = container.querySelectorAll('span[style*="padding: 3px 10px"]');
    expect(chips.length).toBe(2);
    chips.forEach(chip => expect(chip).toHaveStyle({ borderRadius: '8px' }));
  });

  it('switches axisCounts to the "cut" chip pattern (2px radius)', async () => {
    const { container } = render(
      <Group
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { screen_config: { Group: { blocks: baseBlocks.map(b => b.id === 'axisCounts' ? { ...b, pat: { chip: 'cut' } } : b) } } },
        }}
      />
    );
    await screen.findByText('สมาชิก');
    const chips = container.querySelectorAll('span[style*="padding: 3px 10px"]');
    expect(chips.length).toBe(2);
    chips.forEach(chip => expect(chip).toHaveStyle({ borderRadius: '2px' }));
  });
});

describe('Group — GroupComplete section (its own independent screen_config)', () => {
  const completeConfig = {
    ...baseConfig,
    group: { enabled: true, max_members: 2, min_members: 1 },
  };

  it('hides the TEAM COMPLETE! moment when its block is turned off, falling back to the normal page', async () => {
    server.use(http.get('*/api/group/:groupId', () => HttpResponse.json(mockGroupView({
      overflowMode: 'fixed', batchSize: 2, maxMembers: 2,
    }))));
    render(
      <Group
        {...baseProps}
        config={{
          ...completeConfig,
          appearance: { screen_config: { GroupComplete: { blocks: [{ id: 'grpComplete', uid: 'grpComplete', show: false, geo: {} }] } } },
        }}
      />
    );
    await screen.findByText('สมาชิก');
    expect(screen.queryByText('TEAM COMPLETE!')).toBeNull();
  });

  it('renders the TEAM COMPLETE! moment at a floating position when configured', async () => {
    server.use(http.get('*/api/group/:groupId', () => HttpResponse.json(mockGroupView({
      overflowMode: 'fixed', batchSize: 2, maxMembers: 2,
    }))));
    render(
      <Group
        {...baseProps}
        config={{
          ...completeConfig,
          appearance: { screen_config: { GroupComplete: { blocks: [{ id: 'grpComplete', uid: 'grpComplete', show: true, geo: {}, pos: { x: 0, y: 40, w: 375 } }] } } },
        }}
      />
    );
    const title = await screen.findByText('TEAM COMPLETE!');
    const el = title.closest('div[style*="position: absolute"]');
    expect(el).not.toBeNull();
    expect(el).toHaveStyle({ left: '0%', width: '100%' });
  });
});

// Colors / Typography / Shape & Feel / Art Style wiring (App.tsx's applyTheme sets these
// as CSS custom properties on document.documentElement; here we set them directly to
// simulate that, the same way the real app would have them in place before Group mounts).
describe('Group — Colors/Typography/Shape & Feel wiring', () => {
  afterEach(() => {
    ['--card-radius', '--badge-radius', '--tilt-deg', '--shadow', '--shadow-lg'].forEach(v =>
      document.documentElement.style.removeProperty(v)
    );
  });

  it('scales a literal font-size by appearance.font_scale', async () => {
    render(<Group {...baseProps} config={{ ...baseConfig, appearance: { font_scale: 1.5 } }} />);
    const heading = await screen.findByText('สมาชิก');
    // membersHeading renders at a literal 16px — font_scale 1.5 rounds to 24px.
    expect(heading).toHaveStyle({ fontSize: '24px' });
  });

  it('leaves font-size unchanged when font_scale is unset (scale-1 no-op)', async () => {
    render(<Group {...baseProps} config={baseConfig} />);
    const heading = await screen.findByText('สมาชิก');
    expect(heading).toHaveStyle({ fontSize: '16px' });
  });

  it('applies a custom --card-radius to the group result card', async () => {
    document.documentElement.style.setProperty('--card-radius', '30px');
    const { container } = render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('สมาชิก');
    const card = container.querySelector('div[style*="5px 6px 0 #1C1A17"]') as HTMLElement;
    expect(card).toHaveStyle({ borderRadius: '30px' });
  });

  it('applies a custom --badge-radius to the member-count badge', async () => {
    document.documentElement.style.setProperty('--badge-radius', '6px');
    const { container } = render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('สมาชิก');
    const badge = container.querySelector('div[style*="rotate(-1.5deg)"]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge).toHaveStyle({ borderRadius: '6px' });
  });

  it('applies --tilt-deg as a rotate transform on the group result card', async () => {
    document.documentElement.style.setProperty('--tilt-deg', '1.4');
    const { container } = render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('สมาชิก');
    const card = container.querySelector('div[style*="5px 6px 0 #1C1A17"]') as HTMLElement;
    expect(card).toHaveStyle({ transform: 'rotate(calc(1.4 * -1deg))' });
  });

  it('renders without crashing when --shadow is "none"', async () => {
    document.documentElement.style.setProperty('--shadow', 'none');
    document.documentElement.style.setProperty('--shadow-lg', 'none');
    render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('สมาชิก');
    expect(screen.getAllByText('ผลกลุ่ม').length).toBeGreaterThan(0);
  });

  it('renders without crashing when --shadow is a soft box-shadow', async () => {
    document.documentElement.style.setProperty('--shadow', '0 4px 16px rgba(28,26,23,.18)');
    document.documentElement.style.setProperty('--shadow-lg', '0 5px 20px rgba(28,26,23,.22)');
    render(<Group {...baseProps} config={baseConfig} />);
    await screen.findByText('สมาชิก');
    expect(screen.getAllByText('ผลกลุ่ม').length).toBeGreaterThan(0);
  });

  it('uses the "grid" grpHero arrangement when appearance.group_hero_pattern is "grid" and no per-block pat override is set', async () => {
    const { container } = render(
      <Group {...baseProps} config={{ ...baseConfig, appearance: { group_hero_pattern: 'grid' } }} />
    );
    await screen.findByText('สมาชิก');
    const grid = container.querySelector('div[style*="grid-template-columns"]') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.style.gridTemplateColumns).toBe('repeat(2,1fr)');
  });

  it('an explicit per-block "stack" pat override still wins over the global group_hero_pattern default', async () => {
    const blocks = [
      { id: 'topNav', uid: 'topNav', show: true, geo: {} },
      { id: 'grpHero', uid: 'grpHero', show: true, geo: {}, pat: { group: 'stack' } },
      { id: 'grpCard', uid: 'grpCard', show: true, geo: {} },
      { id: 'memberList', uid: 'memberList', show: true, geo: {} },
      { id: 'axisCounts', uid: 'axisCounts', show: true, geo: {} },
      { id: 'inviteMore', uid: 'inviteMore', show: true, geo: {} },
    ];
    const { container } = render(
      <Group
        {...baseProps}
        config={{
          ...baseConfig,
          appearance: { group_hero_pattern: 'grid', screen_config: { Group: { blocks } } },
        }}
      />
    );
    await screen.findByText('สมาชิก');
    const img2 = container.querySelector('img[src="https://example.com/a2.png"]') as HTMLElement;
    expect(img2).toHaveStyle({ marginLeft: '-46px', width: '100px', height: '140px' });
  });
});
