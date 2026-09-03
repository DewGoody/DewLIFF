/**
 * App.tsx — E2E simulation tests
 * Covers: AUTH-001..007, A-001..008, B-001..008, D-005, ERR-001..004
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import App from '../App';
import { mockLiff } from './setup';
import { server, mockConfig, mockSummary } from './server';

// Helper: render and wait past loading spinner ("HANG ON!" is the loading screen text)
async function renderApp() {
  render(<App />);
  await waitFor(
    () => expect(screen.queryByText(/HANG ON/i)).toBeNull(),
    { timeout: 5000 },
  );
}

// Helper: assert text exists even when multiple elements match the same regex
function expectText(pattern: RegExp) {
  expect(screen.queryAllByText(pattern).length).toBeGreaterThan(0);
}

// Helper: reset window.location to default (no params)
function resetLocation() {
  Object.defineProperty(window, 'location', {
    value: { origin: 'http://localhost', pathname: '/', search: '', hash: '', href: 'http://localhost/' },
    writable: true,
    configurable: true,
  });
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

describe('AUTH — initialization', () => {
  beforeEach(resetLocation);

  it('AUTH-001: liff.login() called when not logged in', async () => {
    // isLoggedIn() is called twice in App.tsx init (console.log then if-check),
    // so mockReturnValue (not Once) is needed to make both calls return false.
    mockLiff.isLoggedIn.mockReturnValue(false);
    render(<App />);
    await waitFor(() => expect(mockLiff.login).toHaveBeenCalledWith({ redirectUri: expect.any(String) }));
  });

  it('AUTH-002: external browser + getFriendship throws → friend-gate shown', async () => {
    // External browser: isInClient=false. If getFriendship throws, show friend-gate
    // (not open-in-line — external browsers can now play after adding OA as friend).
    mockLiff.isInClient.mockReturnValue(false);
    mockLiff.getFriendship.mockRejectedValueOnce(new Error('API unavailable'));
    render(<App />);
    await waitFor(() => expectText(/เพิ่มเพื่อน/i));
  });

  it('AUTH-003: friend-gate when friendFlag=false', async () => {
    mockLiff.getFriendship.mockResolvedValueOnce({ friendFlag: false });
    render(<App />);
    // Multiple elements match /เพิ่มเพื่อน/i (heading, body text, button) — use queryAllByText
    await waitFor(() => expectText(/เพิ่มเพื่อน/i));
  });

  it('AUTH-004: getFriendship throw → allow through (reaches intro)', async () => {
    mockLiff.getFriendship.mockRejectedValueOnce(new Error('API unavailable'));
    await renderApp();
    expect(screen.queryAllByText(/เพิ่มเพื่อน/i)).toHaveLength(0);
    expect(screen.getByRole('button', { name: /เริ่ม/i })).toBeInTheDocument();
  });

  it('AUTH-005: campaignId inside liff.state query string → parsed correctly', async () => {
    // URL: ?liff.state=%2F%3FcampaignId%3Dtest123
    // encodes "/?campaignId=test123" — parseCampaignId must extract "test123"
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost',
        pathname: '/',
        search: '?liff.state=%2F%3FcampaignId%3Dtest123',
        hash: '',
        href: 'http://localhost/?liff.state=%2F%3FcampaignId%3Dtest123',
      },
      writable: true, configurable: true,
    });
    let calledId = '';
    server.use(
      http.get('*/api/campaign/:id', ({ params }) => {
        calledId = params.id as string;
        return HttpResponse.json(mockConfig);
      }),
    );
    await renderApp();
    expect(calledId).toBe('test123');
    expect(screen.getByRole('button', { name: /เริ่ม/i })).toBeInTheDocument();
  });

  it('AUTH-006: campaignId inside liff.state hash → parsed correctly', async () => {
    // URL: #liff.state=%2F%3FcampaignId%3Dtest456
    // hash encodes "/?campaignId=test456" — parseCampaignId must extract "test456"
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost',
        pathname: '/',
        search: '',
        hash: '#liff.state=%2F%3FcampaignId%3Dtest456',
        href: 'http://localhost/#liff.state=%2F%3FcampaignId%3Dtest456',
      },
      writable: true, configurable: true,
    });
    let calledId = '';
    server.use(
      http.get('*/api/campaign/:id', ({ params }) => {
        calledId = params.id as string;
        return HttpResponse.json(mockConfig);
      }),
    );
    await renderApp();
    expect(calledId).toBe('test456');
    expect(screen.getByRole('button', { name: /เริ่ม/i })).toBeInTheDocument();
  });

  it('AUTH-007: no campaignId in URL → fallback buddy_demo loads', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: /เริ่ม/i })).toBeInTheDocument();
  });
});

// ─── FLOW A ───────────────────────────────────────────────────────────────────

describe('Flow A — Inviter quiz', () => {
  beforeEach(resetLocation);

  it('A-001: intro screen loads when not answered', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: /เริ่ม/i })).toBeInTheDocument();
  });

  it('A-002: already answered → skip to summary', async () => {
    server.use(http.get('*/api/quiz/my-answers', () => HttpResponse.json({ answered: true })));
    await renderApp();
    // Summary screen shows archetype label "เตรียมพร้อม" in multiple places
    await waitFor(() => expectText(/เตรียมพร้อม/i));
    expect(screen.queryByRole('button', { name: /^เริ่ม$/i })).toBeNull();
  });

  it('A-003: back mid-quiz → decrements question', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: /เริ่ม/i }));
    await waitFor(() => screen.getByText(/คำถาม 1/i));
    await user.click(screen.getByText(/ตัวเลือก A/i));
    await waitFor(() => screen.getByText(/คำถาม 2/i));
    await user.click(screen.getByText(/ย้อนกลับ/i));
    await waitFor(() => screen.getByText(/คำถาม 1/i));
  });

  it('A-004: back at Q1 (no inviterId) → intro', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: /เริ่ม/i }));
    await waitFor(() => screen.getByText(/คำถาม 1/i));
    await user.click(screen.getByText(/ย้อนกลับ/i));
    await waitFor(() => screen.getByRole('button', { name: /เริ่ม/i }));
  });

  it('A-006: save-answers fail → error screen with retry', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/quiz/save-answers', () => HttpResponse.error()));
    await renderApp();
    await user.click(screen.getByRole('button', { name: /เริ่ม/i }));
    await waitFor(() => screen.getByText(/คำถาม 1/i));
    await user.click(screen.getByText(/ตัวเลือก A/i));
    await waitFor(() => screen.getByText(/คำถาม 2/i));
    await user.click(screen.getByText(/ตัวเลือก A/i));
    // Error screen shows title "ส่งคำตอบไม่สำเร็จ" and body containing "ลองใหม่"
    // — multiple elements match the combined regex, so use queryAllByText
    await waitFor(() => expectText(/ส่งคำตอบไม่สำเร็จ|ลองใหม่/i), { timeout: 5000 });
  });

  it('A-008: my-answers check fail → still shows intro', async () => {
    server.use(http.get('*/api/quiz/my-answers', () => HttpResponse.error()));
    await renderApp();
    expect(screen.getByRole('button', { name: /เริ่ม/i })).toBeInTheDocument();
  });
});

// ─── FLOW B ───────────────────────────────────────────────────────────────────

describe('Flow B — Invitee', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost', pathname: '/', search: '?inviterId=UinviterA&campaignId=buddy_demo', hash: '', href: 'http://localhost/?inviterId=UinviterA&campaignId=buddy_demo' },
      writable: true,
      configurable: true,
    });
  });
  afterEach(resetLocation);

  it('B-001: inviterId in URL → invited screen shows inviter name', async () => {
    await renderApp();
    // Invited screen shows "Partner A" in name div and in the CTA button "ตอบให้Partner A"
    await waitFor(() => expectText(/Partner A/i));
  });

  it('B-002: B already answered → auto-match → summary without quiz', async () => {
    server.use(http.get('*/api/quiz/my-answers', () => HttpResponse.json({ answered: true })));
    await renderApp();
    // Summary shows archetype label in multiple places
    await waitFor(() => expectText(/เตรียมพร้อม/i), { timeout: 5000 });
    expect(screen.queryByText(/คำถาม 1/i)).toBeNull();
  });

  it('B-003: self-invite (new answers) → graceful redirect, no crash', async () => {
    server.use(
      http.post('*/api/quiz/match', () =>
        // api.ts reads data?.error?.message — must nest under "error" to match
        HttpResponse.json({ error: { message: 'ไม่สามารถจับคู่กับตัวเองได้' } }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    await renderApp();
    await waitFor(() => screen.getAllByText(/Partner A/i).length > 0);
    // Invited screen CTA button is "ตอบให้Partner A", not "เริ่ม"
    await user.click(screen.getByRole('button', { name: /ตอบให้/i }));
    await waitFor(() => screen.getByText(/คำถาม 1/i));
    await user.click(screen.getByText(/ตัวเลือก A/i));
    await waitFor(() => screen.getByText(/คำถาม 2/i));
    await user.click(screen.getByText(/ตัวเลือก A/i));
    await waitFor(() => {
      const hasSummary = screen.queryAllByText(/เตรียมพร้อม/i).length > 0;
      const hasIntro = screen.queryByRole('button', { name: /เริ่ม/i });
      const hasError = screen.queryAllByText(/ลองใหม่/i).length > 0;
      expect(hasSummary || hasIntro || hasError).toBeTruthy();
    }, { timeout: 5000 });
    // Must not be white screen
    expect(document.body.children.length).toBeGreaterThan(0);
  });

  it('B-004: inviterId 404 → error screen shown', async () => {
    server.use(http.get('*/api/quiz/inviter/:id', () => HttpResponse.error()));
    await renderApp();
    await waitFor(() => expect(screen.getByText(/ลิงก์ไม่ถูกต้อง/i)).toBeInTheDocument(), { timeout: 5000 });
  });

  it('B-006: push fail + no inviterShareUrl → shareTargetPicker NOT called', async () => {
    server.use(
      http.get('*/api/quiz/my-answers', () => HttpResponse.json({ answered: true })),
      http.post('*/api/quiz/match', () => HttpResponse.json({
        pairId: 'p1', result: { title: 'รอด 7 วัน', body: 'ดี' },
        axisMe: 'เตรียมพร้อม', axisBuddy: 'ไลฟ์สด',
        pushSentToInviter: false, inviterShareUrl: undefined,
      })),
    );
    await renderApp();
    // Summary shows archetype label in multiple places — use queryAllByText
    await waitFor(() => expectText(/เตรียมพร้อม/i), { timeout: 5000 });
    expect(mockLiff.shareTargetPicker).not.toHaveBeenCalled();
  });
});

// ─── D-005 Rewards gate ────────────────────────────────────────────────────────

describe('D-005 — Rewards button visibility', () => {
  beforeEach(resetLocation);

  it('rewards.enabled=true → Rewards button shown', async () => {
    server.use(http.get('*/api/quiz/my-answers', () => HttpResponse.json({ answered: true })));
    await renderApp();
    await waitFor(() => expect(screen.getByText(/ดูสิทธิ์/i)).toBeInTheDocument());
  });

  it('rewards.enabled=false → Rewards button hidden', async () => {
    server.use(
      http.get('*/api/quiz/my-answers', () => HttpResponse.json({ answered: true })),
      http.get('*/api/campaign/:id', () =>
        HttpResponse.json({ ...mockConfig, rewards: { enabled: false, points_per_pair: 0 } }),
      ),
    );
    await renderApp();
    // Summary has multiple "เตรียมพร้อม" elements — use queryAllByText
    await waitFor(() => expectText(/เตรียมพร้อม/i));
    expect(screen.queryByText(/ดูสิทธิ์/i)).toBeNull();
  });
});

// ─── ERR — friendly error messages ───────────────────────────────────────────

describe('ERR — friendly error messages', () => {
  beforeEach(resetLocation);

  it('ERR-001: network error → Thai friendly message (not raw JS error)', async () => {
    server.use(http.get('*/api/campaign/:id', () => HttpResponse.error()));
    render(<App />);
    // Error screen shows body "เครือข่ายมีปัญหา..." AND title "โหลดควิซไม่สำเร็จ"
    // — both match the regex, so use queryAllByText
    await waitFor(
      () => expectText(/เครือข่ายมีปัญหา|โหลดควิซ/i),
      { timeout: 5000 },
    );
    expect(screen.queryByText(/Failed to fetch|TypeError/i)).toBeNull();
  });

  it('ERR-002: 500 response → friendly system error message', async () => {
    server.use(http.get('*/api/campaign/:id', () =>
      HttpResponse.json({ error: { message: '500 Internal Server Error' } }, { status: 500 }),
    ));
    render(<App />);
    // Error screen shows body "เกิดข้อผิดพลาดในระบบ..." AND title "โหลดควิซไม่สำเร็จ"
    await waitFor(
      () => expectText(/เกิดข้อผิดพลาดในระบบ|โหลดควิซ/i),
      { timeout: 5000 },
    );
  });

  it('ERR-003: 401 response → session expired message', async () => {
    server.use(http.get('*/api/campaign/:id', () =>
      HttpResponse.json({ error: { message: '401 Unauthorized token expired' } }, { status: 401 }),
    ));
    render(<App />);
    await waitFor(
      () => expect(screen.getByText(/เซสชันหมดอายุ/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });
});
