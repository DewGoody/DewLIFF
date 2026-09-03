import { useState, useEffect, useCallback } from 'react';
import { setToken, api } from './api';
import { getAxisCard, findAxisId } from './data';
import { getScreenBlocks, floatStyle, scaleFont, getPatternDefaults } from './screenConfig';
import Loading from './screens/Loading';
import Intro from './screens/Intro';
import Invited from './screens/Invited';
import Question from './screens/Question';
import Summary from './screens/Summary';
import PairResult from './screens/PairResult';
import Group from './screens/Group';
import SoloShare from './screens/SoloShare';
import SymbolCollection from './screens/SymbolCollection';
import Rewards from './screens/Rewards';
import ErrorScreen from './screens/ErrorScreen';
import type { PairPopup } from './screens/Summary';

const DEFAULT_LIFF_ID = import.meta.env.VITE_LIFF_ID || '2011037337-KlqFK4LM';
const IS_PREVIEW = new URLSearchParams(window.location.search).get('preview') === '1';

type Screen = 'loading' | 'intro' | 'invited' | 'question' | 'summary' | 'solo-share' | 'pair-result' | 'error' | 'open-in-line' | 'matching' | 'group' | 'symbols' | 'rewards';


interface AppearanceConfig {
  accent?: string;
  theme?: 'dark' | 'light';
  radius?: number;
  border_width?: number;
  shadow?: 'none' | 'soft' | 'hard';
  shadow_offset?: number;
  intro_layout?: string;
  question_layout?: string;
  summary_layout?: string;
  pair_layout?: string;
  loading_style?: string;
  loading_copy?: string;
  images?: Record<string, string>;
  og_base_url?: string;
  liff_id?: string;
  oa_id?: string;
  font_display?: string;
  font_body?: string;
  font_accent?: string;
  font_scale?: number;
  colors?: {
    primary?: string; on_primary?: string; surface?: string; on_surface?: string;
    muted?: string; accent?: string; accent_soft?: string; highlight?: string; background?: string;
    overlay?: string; danger?: string; success?: string; line_green?: string;
  };
  card_radius?: number;
  progress_radius?: number;
  axis_chip_radius?: number;
  badge_radius?: number;
  tilt?: 'off' | 'subtle' | 'playful';
  texture?: 'none' | 'paper';
  [key: string]: unknown;
}

interface GroupCondition {
  has_axes?: string[];
  has_mode?: 'any' | 'all';
  top_axes?: string[];
  top_n?: number;
  is_balanced?: boolean;
  dominant_threshold?: number;
  min_members_with_axis?: number;
  max_distinct?: number;
}
interface GroupArchetype {
  code: string;
  title: string;
  primary_text?: string;
  body: string;
  image_url?: string;
  min_group_size: number;
  max_group_size?: number;
  condition?: GroupCondition | null;
  fallback?: boolean;
}
interface GroupConfig {
  enabled?: boolean;
  result_mode?: 'score' | 'match';
  min_members?: number;
  reward_members?: number;
  max_members?: number;
  overflow_mode?: 'hard_cap' | 'rolling' | 'creator_pick';
  batch_size?: number;
  archetypes?: GroupArchetype[];
  fallback_archetype?: string;
  formula?: { base?: number; per_axis_coverage?: number; balance_bonus?: number; per_member?: number; per_member_cap?: number; unit?: string };
}

interface AppConfig {
  id?: string;
  brand?: { name?: string; logo_url?: string; primary?: string; surface?: string; on_surface?: string; kv_image_url?: string };
  copy?: Record<string, string>;
  axes?: { id: string; label: string; label_en?: string; order?: string; short?: string; image_url?: string }[];
  questions?: { id: string; kicker?: string; text: string; options: { id: string; label: string }[] }[];
  results?: Array<unknown>;
  mode?: string;
  chat_trigger?: boolean;
  group?: GroupConfig;
  rewards?: { enabled?: boolean };
  appearance?: AppearanceConfig;
}

interface SummaryData {
  myArchetype: string;
  myArchetypeLabel: string;
  myArchetypeBody?: string;
  myArchetypeEn?: string;
  myArchetypeOrder?: string;
  myArchetypeShort?: string;
  myArchetypeImage?: string;
  archStats?: { bestPartnerLabel: string; bestSurvival: string; worstPartnerLabel: string; worstSurvival: string };
  pairsDone: number;
  shareUrl: string;
  pairs: Array<{
    pairId: string;
    role: 'inviter' | 'invitee';
    partnerName: string;
    status: 'waiting' | 'completed' | 'expired';
    resultTitle?: string;
    partnerAxisLabel?: string;
    completedAt?: string;
    completedAtIso?: string;
  }>;
}

interface PairResultData {
  pairId: string;
  partnerName: string;
  title: string;
  body: string;
  imageUrl?: string;
  axisMe?: string;
  axisBuddy?: string;
  axisMeId?: string;
  axisBuddyId?: string;
  axisMeShort?: string;
  axisBuddyShort?: string;
  pairUrl?: string;
  inviteUrl?: string;
}

function parseCampaignId(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('campaignId');
  if (fromQuery) return fromQuery;
  // LIFF may encode params inside liff.state — try query string first
  const liffState = params.get('liff.state');
  if (liffState) {
    try {
      const decoded = decodeURIComponent(liffState);
      const qs = decoded.includes('?') ? decoded.slice(decoded.indexOf('?') + 1) : decoded;
      const stateId = new URLSearchParams(qs).get('campaignId');
      if (stateId) return stateId;
    } catch {}
  }
  // Also check hash (#liff.state=...)
  const hash = window.location.hash.slice(1);
  if (hash.includes('liff.state')) {
    try {
      const hashParams = new URLSearchParams(hash);
      const liffStateHash = hashParams.get('liff.state');
      if (liffStateHash) {
        const decoded = decodeURIComponent(liffStateHash);
        const qs = decoded.includes('?') ? decoded.slice(decoded.indexOf('?') + 1) : decoded;
        const stateId = new URLSearchParams(qs).get('campaignId');
        if (stateId) return stateId;
      }
    } catch {}
  }
  const match = window.location.pathname.match(/\/quiz\/([^/?]+)/);
  return match ? match[1] : 'buddy_demo';
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [config, setConfig] = useState<AppConfig>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; optionId: string }[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [initialPopup, setInitialPopup] = useState<PairPopup | null>(null);
  const [pairResultData, setPairResultData] = useState<PairResultData | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ title: string; body: string; retryFn?: () => void }>({ title: '', body: '' });
  const [inviterName, setInviterName] = useState<string | undefined>();
  const [inviterPic, setInviterPic] = useState<string | undefined>();
  const [inviterArchLabel, setInviterArchLabel] = useState<string | undefined>();
  const [inviterArchEn, setInviterArchEn] = useState<string | undefined>();
  const [isDemo, setIsDemo] = useState(false);
  const [pairId, setPairId] = useState<string | null>(null);
  const [pendingInviterId, setPendingInviterId] = useState<string | null>(null);
  const [teamsVersion, setTeamsVersion] = useState(0);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupCreatorId, setGroupCreatorId] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<{ archTitle?: string; memberCount?: number; maxMembers?: number; body?: string; primaryText?: string; creatorName?: string } | null>(null);
  const [groupAlreadyAnswered, setGroupAlreadyAnswered] = useState(false);
  const [groupIsFull, setGroupIsFull] = useState(false);
  const [myUserId, setMyUserId] = useState<string>('');
  const [myDisplayName, setMyDisplayName] = useState<string>('');
  const [matchingBuddyAxisId, setMatchingBuddyAxisId] = useState<string>('');
  const [matchingMyAxisId, setMatchingMyAxisId] = useState<string>('');
  const [soloShareMyUserId, setSoloShareMyUserId] = useState<string>('');
  const [liffId, setLiffId] = useState<string>(DEFAULT_LIFF_ID);
  const [isFriend, setIsFriend] = useState(false);

  // Notify parent (admin preview) when screen changes
  useEffect(() => {
    if (!IS_PREVIEW) return;
    window.parent.postMessage({ type: 'preview_screen', screen }, '*');
  }, [screen]);

  const campaignId = parseCampaignId();

  const showError = useCallback((title: string, body: string, retryFn?: () => void) => {
    console.error('[App] error:', title, body);
    // Filter raw technical messages to friendly Thai
    const friendlyBody = body.includes('Failed to fetch') || body.includes('NetworkError') || body.includes('network')
      ? 'เครือข่ายมีปัญหา กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
      : body.includes('500') || body.includes('Internal') || body.includes('unexpected')
      ? 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
      : body.includes('401') || body.includes('Unauthorized') || body.includes('token')
      ? 'เซสชันหมดอายุ กรุณาเปิดลิงก์ใหม่'
      : body.length > 80 || /[A-Z]{2,}|undefined|null|Error:|at /.test(body)
      ? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
      : body;
    setErrorInfo({ title, body: friendlyBody, retryFn });
    setScreen('error');
  }, []);

  const applyTheme = useCallback((brand?: AppConfig['brand'], appearance?: AppearanceConfig) => {
    const root = document.documentElement;
    const c = appearance?.colors;
    const isLight = appearance?.theme === 'light';

    // --ac: primary action color (colors.primary > brand.primary > default)
    const ac = c?.primary || brand?.primary || '#E8354F';
    root.style.setProperty('--ac', ac);

    // --on-ac: text on primary button
    root.style.setProperty('--on-ac', c?.on_primary || '#FFFDF6');

    // --bg: page background
    root.style.setProperty('--bg', c?.background || (isLight ? '#F5F1EA' : '#F7F1E3'));

    // --card: card/surface background
    root.style.setProperty('--card', c?.surface || (isLight ? '#FFFFFF' : '#FFFDF6'));

    // --ink: primary text color
    const ink = c?.on_surface || (isLight ? '#1A1714' : '#1C1A17');
    root.style.setProperty('--ink', ink);

    // --ink2 / --ink3: colors.muted if the admin set one, else derived semi-transparent ink
    const hexToRgba = (hex: string, a: number) => {
      const h = hex.replace('#', '');
      const r = parseInt(h.length === 3 ? h[0]+h[0] : h.slice(0,2), 16);
      const g = parseInt(h.length === 3 ? h[1]+h[1] : h.slice(2,4), 16);
      const b = parseInt(h.length === 3 ? h[2]+h[2] : h.slice(4,6), 16);
      return isNaN(r) ? `rgba(28,26,23,${a})` : `rgba(${r},${g},${b},${a})`;
    };
    if (c?.muted) {
      root.style.setProperty('--ink2', c.muted);
      root.style.setProperty('--ink3', c.muted);
    } else {
      root.style.setProperty('--ink2', hexToRgba(ink, 0.6));
      root.style.setProperty('--ink3', hexToRgba(ink, 0.4));
    }

    // --hl: highlight color
    root.style.setProperty('--hl', c?.highlight || '#F5E14B');

    // --accent / --accent-soft / --line / --overlay / --danger: remaining Colors tab fields
    root.style.setProperty('--accent', c?.accent || '#7AC4D6');
    root.style.setProperty('--accent-soft', c?.accent_soft || '#E6F1F5');
    root.style.setProperty('--line', c?.line_green || '#06C755');
    root.style.setProperty('--overlay', c?.overlay || 'rgba(28,26,23,.55)');
    root.style.setProperty('--danger', c?.danger || '#C0392B');

    // --border: card border shorthand
    const bw = appearance?.border_width ?? 2.5;
    root.style.setProperty('--border', `${bw}px solid ${ink}`);

    // --shadow / --shadow-lg: none / soft / hard, per Shape & Feel → Shadow Style
    const so = appearance?.shadow_offset ?? 4;
    const shadowStyle = appearance?.shadow || 'hard';
    if (shadowStyle === 'none') {
      root.style.setProperty('--shadow', 'none');
      root.style.setProperty('--shadow-lg', 'none');
    } else if (shadowStyle === 'soft') {
      root.style.setProperty('--shadow', `0 ${so / 2 + 2}px ${so * 2 + 8}px rgba(28,26,23,.18)`);
      root.style.setProperty('--shadow-lg', `0 ${so / 2 + 3}px ${so * 2 + 12}px rgba(28,26,23,.22)`);
    } else {
      root.style.setProperty('--shadow', `${so}px ${so + 1}px 0 ${ink}`);
      root.style.setProperty('--shadow-lg', `${so + 1}px ${so + 2}px 0 ${ink}`);
    }

    // --radius: button radius (unchanged) · --card-radius / --progress-radius /
    // --axis-chip-radius / --badge-radius: the other Shape & Feel radius fields,
    // previously admin-only
    if (appearance?.radius !== undefined) root.style.setProperty('--radius', appearance.radius + 'px');
    root.style.setProperty('--card-radius', (appearance?.card_radius ?? 16) + 'px');
    root.style.setProperty('--progress-radius', (appearance?.progress_radius ?? 8) + 'px');
    root.style.setProperty('--axis-chip-radius', (appearance?.axis_chip_radius ?? 11) + 'px');
    root.style.setProperty('--badge-radius', (appearance?.badge_radius ?? 0) + 'px');

    // --tilt-deg: Card Tilt preset → degrees (off/subtle/playful), mirrors admin's tokC.tiltDeg
    const tiltPreset = appearance?.tilt || 'off';
    const tiltDeg = tiltPreset === 'off' ? 0 : tiltPreset === 'subtle' ? 0.6 : 1.4;
    root.style.setProperty('--tilt-deg', String(tiltDeg));

    // --texture-bg: paper texture overlay (or none)
    root.style.setProperty(
      '--texture-bg',
      appearance?.texture === 'paper'
        ? 'repeating-linear-gradient(120deg,rgba(0,0,0,.035) 0 2px,transparent 2px 5px)'
        : 'none',
    );

    // font vars
    if (appearance?.font_display) root.style.setProperty('--font-display', `'${appearance.font_display}'`);
    if (appearance?.font_body)    root.style.setProperty('--font-body',    `'${appearance.font_body}'`);
    if (appearance?.font_accent)  root.style.setProperty('--font-accent',  `'${appearance.font_accent}'`);

    // Cache theme so next load can apply it instantly (eliminates loading-screen flicker)
    try {
      const cid = parseCampaignId();
      if (cid) localStorage.setItem(`theme_${cid}`, JSON.stringify({ brand, appearance }));
    } catch {}
  }, []);

  const loadSummary = useCallback(async (): Promise<SummaryData> => {
    return await api<SummaryData>('GET', `/api/quiz/my-summary?campaignId=${campaignId}`);
  }, [campaignId]);

  // --- Preview mode (admin embed) ---
  useEffect(() => {
    if (!IS_PREVIEW) return;
    // Tell parent iframe is ready
    window.parent.postMessage({ type: 'preview_ready' }, '*');
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type !== 'preview_config') return;
      const cfg: AppConfig = e.data.config;
      setConfig(cfg);
      applyTheme(cfg.brand, cfg.appearance);
      const validScreens = ['loading','intro','invited','question','summary','pair-result','group'];
      const startScreen = e.data.startScreen;
      setScreen((validScreens.includes(startScreen) ? startScreen : 'intro') as Screen);
      setAnswers([]);
      setQuestionIndex(0);
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Init ---
  useEffect(() => {
    if (IS_PREVIEW) return; // skip real init in preview mode
    // Apply cached theme immediately so loading screen shows correct colors before API responds
    try {
      const cid = parseCampaignId();
      const cached = cid && localStorage.getItem(`theme_${cid}`);
      if (cached) { const { brand, appearance } = JSON.parse(cached); applyTheme(brand, appearance); }
    } catch {}
    async function init() {
      try {
        // Fetch campaign config first to get the correct LIFF ID
        let resolvedLiffId = DEFAULT_LIFF_ID;
        try {
          const cfgRes = await fetch(`/api/campaign/${campaignId}`);
          if (cfgRes.ok) {
            const cfgJson = await cfgRes.json();
            if (cfgJson?.appearance?.liff_id) resolvedLiffId = cfgJson.appearance.liff_id;
          }
        } catch { /* use default */ }
        setLiffId(resolvedLiffId);

        console.log('[App] starting LIFF init, liffId:', resolvedLiffId);
        await liff.init({ liffId: resolvedLiffId });
        console.log('[App] LIFF init OK, isLoggedIn:', liff.isLoggedIn());

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: location.href });
          return;
        }

        const token = liff.getIDToken();
        setToken(token);

        // Eagerly get profile — store userId + display name in one call
        let profileUserId = '';
        try {
          const profile = await liff.getProfile();
          profileUserId = profile.userId;
          setMyUserId(profile.userId);
          if (profile.displayName) {
            setMyDisplayName(profile.displayName);
            api('POST', '/api/quiz/set-name', { displayName: profile.displayName, pictureUrl: profile.pictureUrl }).catch(() => {});
          }
        } catch { /* non-critical */ }

        try {
          const friendship = await liff.getFriendship();
          setIsFriend(friendship.friendFlag);
        } catch { /* not available outside LINE */ }

        // LIFF sometimes encodes params inside ?liff.state=... — extract from all sources
        function resolveParams(): URLSearchParams {
          const direct = new URLSearchParams(window.location.search);
          // Try liff.state in search string (?liff.state=%2F%3FinviterId%3D...)
          const liffState = direct.get('liff.state');
          if (liffState) {
            try {
              const decoded = decodeURIComponent(liffState);
              const qs = decoded.includes('?') ? decoded.slice(decoded.indexOf('?') + 1) : decoded;
              const stateParams = new URLSearchParams(qs);
              if (stateParams.get('inviterId') || stateParams.get('groupId') || stateParams.get('pairId')) return stateParams;
            } catch {}
          }
          // Try liff.state in hash (#liff.state=...)
          const hash = window.location.hash.slice(1);
          if (hash.includes('liff.state')) {
            try {
              const hashParams = new URLSearchParams(hash);
              const liffStateHash = hashParams.get('liff.state');
              if (liffStateHash) {
                const decoded = decodeURIComponent(liffStateHash);
                const qs = decoded.includes('?') ? decoded.slice(decoded.indexOf('?') + 1) : decoded;
                const stateParams = new URLSearchParams(qs);
                if (stateParams.get('inviterId') || stateParams.get('groupId') || stateParams.get('pairId')) return stateParams;
              }
            } catch {}
          }
          return direct;
        }
        const params = resolveParams();
        const urlInviterId = params.get('inviterId');
        const urlPairId = params.get('pairId');
        const urlToken = params.get('token');
        const urlGroupId = params.get('groupId');

        console.log('[App] URL params: inviterId=', urlInviterId, 'pairId=', urlPairId, 'groupId=', urlGroupId, 'campaign=', campaignId);

        // Group join flow — from group share link
        if (urlGroupId) {
          console.log('[App] groupId found:', urlGroupId);
          setGroupId(urlGroupId);
          const data = await api<AppConfig>('GET', `/api/campaign/${campaignId}`);
          setConfig(data);
          applyTheme(data.brand, data.appearance);

          // Fetch group info to get creator + archetype for Invited screen
          let creatorId: string | null = null;
          let gViewMembers: { userId: string; displayName?: string; topAxis: string }[] = [];
          let gViewMaxMembers = data.group?.max_members ?? 5;
          try {
            const gView = await api<{
              createdBy: string;
              members: { userId: string; displayName?: string; topAxis: string }[];
              result?: { archetype?: { title?: string; body?: string; primary_text?: string } | null; score?: number | null; scoreUnit?: string | null } | null;
              totalMembers?: number; memberCount?: number; maxMembers?: number;
            }>('GET', `/api/group/${urlGroupId}?campaignId=${campaignId}`);
            creatorId = gView.createdBy;
            gViewMembers = gView.members || [];
            gViewMaxMembers = gView.maxMembers ?? gViewMaxMembers;
            setGroupCreatorId(gView.createdBy);
            const creatorMember = gView.members.find(m => m.userId === gView.createdBy);
            const arch = gView.result?.archetype;
            const memberCount = gView.totalMembers ?? gView.memberCount ?? gView.members.length;
            const isFull = memberCount >= gViewMaxMembers;
            setGroupIsFull(isFull);
            setGroupInfo({
              archTitle: arch?.title,
              body: arch?.body,
              primaryText: arch?.primary_text ?? (gView.result?.score != null ? `${gView.result.score} ${gView.result.scoreUnit || 'วัน'}` : undefined),
              memberCount,
              maxMembers: gViewMaxMembers,
              creatorName: creatorMember?.displayName,
            });
          } catch { /* non-critical — show invited screen anyway */ }

          // If already a member of this group → skip to group screen directly
          if (profileUserId && gViewMembers.some(m => m.userId === profileUserId)) {
            console.log('[App] already a member of group, going to group screen');
            let alreadyAnswered = false;
            try { const r = await api<{ answered: boolean }>('GET', `/api/quiz/my-answers?campaignId=${campaignId}`); alreadyAnswered = r.answered; } catch {}
            if (alreadyAnswered) {
              const summary = await loadSummary().catch(() => null);
              if (summary) setSummaryData(summary);
            }
            setScreen('group');
            return;
          }

          // Check if already answered
          let alreadyAnswered = false;
          try {
            const myAnswers = await api<{ answered: boolean }>('GET', `/api/quiz/my-answers?campaignId=${campaignId}`);
            alreadyAnswered = myAnswers.answered;
          } catch { /* assume not answered */ }

          setGroupAlreadyAnswered(alreadyAnswered);
          setScreen('invited');
          return;
        }

        if (urlInviterId) {
          console.log('[App] inviterId found:', urlInviterId, 'campaign:', campaignId);
          setPendingInviterId(urlInviterId);
          await handleInviterFlow(urlInviterId);
          return;
        }

        if (urlToken) {
          console.log('[App] legacy token found');
          await handleJoinPair(urlToken);
          return;
        }

        if (urlPairId) {
          // Opened from LINE push — show summary with pair popup
          console.log('[App] pairId found, loading summary + pair popup');
          try {
            const [pairData, cfgData] = await Promise.all([
              api<{ status: string; result?: { title: string; body: string; eyebrow?: string; image_url?: string }; axisMe?: string; axisBuddy?: string }>(
                'GET', `/api/pair/${urlPairId}`
              ),
              api<AppConfig>('GET', `/api/campaign/${campaignId}`),
            ]);
            setConfig(cfgData);
            applyTheme(cfgData.brand, cfgData.appearance);

            try {
              const summary = await loadSummary();
              setSummaryData(summary);
              if (pairData.status === 'completed' && pairData.result) {
                setInitialPopup({
                  pairId: urlPairId,
                  title: pairData.result.title,
                  body: pairData.result.body,
                  eyebrow: pairData.result.eyebrow,
                  imageUrl: pairData.result.image_url,
                  axisMe: pairData.axisMe,
                  axisBuddy: pairData.axisBuddy,
                });
              }
              setScreen('summary');
            } catch {
              // Not a participant — navigate them to intro
              setScreen('intro');
            }
          } catch (err) {
            showError('ไม่พบข้อมูล', (err as Error).message);
          }
          return;
        }

        // Default — A flow: load config, check if already answered
        console.log('[App] default flow, fetching campaign config');
        try {
          const data = await api<AppConfig>('GET', `/api/campaign/${campaignId}`);
          setConfig(data);
          applyTheme(data.brand, data.appearance);

          try {
            const myAnswers = await api<{ answered: boolean }>('GET', `/api/quiz/my-answers?campaignId=${campaignId}`);
            if (myAnswers.answered) {
              console.log('[App] A already answered, going to summary');
              const summary = await loadSummary();
              setSummaryData(summary);
              // If opened from F-08 push → go directly to symbols screen
              const urlView = params.get('view');
              setScreen(urlView === 'symbols' ? 'symbols' : urlView === 'rewards' ? 'rewards' : 'summary');
              return;
            }
          } catch (e) {
            console.warn('[App] my-answers check failed, continuing to intro:', e);
          }

          setScreen('intro');
        } catch (err) {
          showError('โหลดควิซไม่สำเร็จ', (err as Error).message);
        }
      } catch (err) {
        console.error('[App] init error:', err);
        showError('เกิดข้อผิดพลาด', (err as Error).message);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Inviter flow ---
  async function handleInviterFlow(inviterId: string) {
    try {
      const [profile, data] = await Promise.all([
        api<{ displayName: string; pictureUrl?: string; archLabel?: string; archEn?: string }>('GET', `/api/quiz/inviter/${inviterId}?campaignId=${campaignId}`),
        api<AppConfig>('GET', `/api/campaign/${campaignId}`),
      ]);
      setInviterName(profile.displayName);
      setInviterPic(profile.pictureUrl);
      setInviterArchLabel(profile.archLabel);
      setInviterArchEn(profile.archEn);
      setConfig(data);
      applyTheme(data.brand, data.appearance);

      // If B already answered → auto-match using stored answers, skip quiz
      try {
        const myAnswers = await api<{ answered: boolean }>('GET', `/api/quiz/my-answers?campaignId=${campaignId}`);
        console.log('[App] handleInviterFlow answered:', myAnswers.answered);
        if (myAnswers.answered) {
          setMatchingBuddyAxisId(findAxisId(profile.archLabel || profile.archEn || '', data.axes) || data.axes?.[0]?.id || '');
          setMatchingMyAxisId('');
          setScreen('matching');
          try {
            const matchData = await api<{
              pairId: string;
              result: { title: string; body: string; eyebrow?: string; image_url?: string };
              axisMe: string;
              axisBuddy: string;
            }>('POST', '/api/quiz/match', { inviterId, campaignId });

            setInitialPopup({
              pairId: matchData.pairId,
              title: matchData.result.title,
              body: matchData.result.body,
              eyebrow: matchData.result.eyebrow,
              imageUrl: matchData.result.image_url,
              axisMe: matchData.axisMe,
              axisBuddy: matchData.axisBuddy,
              partnerName: profile.displayName,
            });
            const summary = await loadSummary();
            setSummaryData(summary);
            setScreen('summary');
          } catch (matchErr) {
            const msg = (matchErr as Error).message || '';
            console.warn('[App] auto-match failed:', msg);
            if (msg.includes('ตัวเอง')) {
              // User clicked their own invite link
              const summary = await loadSummary().catch(() => null);
              if (summary) { setSummaryData(summary); setScreen('summary'); }
              else setScreen('intro');
            } else {
              // Inviter has no answers or other error — show invited screen to retry
              setScreen('invited');
            }
          }
          return;
        }
      } catch (e) {
        console.warn('[App] answered-check failed, going to quiz:', e);
      }

      setScreen('invited');
    } catch (err) {
      showError('ลิงก์ไม่ถูกต้อง', (err as Error).message);
    }
  }

  // --- Legacy join pair ---
  async function handleJoinPair(token: string) {
    try {
      const data = await api<{
        pairId: string;
        inviter?: { displayName?: string; pictureUrl?: string };
        config?: AppConfig;
      }>('POST', '/api/quiz/join', { token });
      setPairId(data.pairId);
      if (data.config) { setConfig(data.config); applyTheme(data.config.brand, data.config.appearance); }
      if (data.inviter) { setInviterName(data.inviter.displayName); setInviterPic(data.inviter.pictureUrl); }
      setScreen('invited');
    } catch (err) {
      showError('ลิงก์ไม่ถูกต้อง', (err as Error).message);
    }
  }

  // --- Start quiz (A) ---
  const handleStart = useCallback(async (demo: boolean) => {
    setIsDemo(demo);
    setQuestionIndex(0);
    setAnswers([]);

    if (!IS_PREVIEW && demo) {
      try {
        const data = await api<{ pairId: string }>('POST', '/api/quiz/start', { campaignId, demo: true });
        setPairId(data.pairId);
      } catch (err) {
        showError('เริ่มควิซไม่สำเร็จ', (err as Error).message);
        return;
      }
    }

    setScreen('question');
  }, [campaignId, showError]);

  // --- Start from invited (B or group) ---
  const handleStartInvited = useCallback(async () => {
    // Group invite + already answered → skip quiz, go straight to matching+group
    if (groupId && groupAlreadyAnswered) {
      // If group is full and we're not a member → skip to own summary
      if (groupIsFull) {
        const summary = await loadSummary().catch(() => null);
        if (summary) setSummaryData(summary);
        setScreen('summary');
        return;
      }

      // Join first (before any match) so the pair-check doesn't block membership
      const joinRes = await api<{ ok: boolean; viewOnly?: boolean; message?: string; existingMemberIds?: string[] }>('POST', `/api/group/${groupId}/join`).catch(() => ({ ok: false, viewOnly: false, existingMemberIds: [] as string[] }));
      const isViewOnly = joinRes.viewOnly === true;
      const existingMemberIds: string[] = joinRes.existingMemberIds || (groupCreatorId ? [groupCreatorId] : []);
      const firstMatchId = groupCreatorId || existingMemberIds[0];

      if (!isViewOnly && firstMatchId) {
        // Show matching animation for first member (creator), background-match the rest
        setMatchingBuddyAxisId(findAxisId(inviterArchLabel || inviterArchEn || '', config.axes) || config.axes?.[0]?.id || '');
        setMatchingMyAxisId('');
        setScreen('matching');
        try {
          const matchData = await api<{
            pairId: string;
            result: { title: string; body: string; eyebrow?: string; image_url?: string };
            axisMe: string;
            axisBuddy: string;
          }>('POST', '/api/quiz/match', { inviterId: firstMatchId, campaignId });
          setInitialPopup({
            pairId: matchData.pairId,
            title: matchData.result.title,
            body: matchData.result.body,
            eyebrow: matchData.result.eyebrow,
            imageUrl: matchData.result.image_url,
            axisMe: matchData.axisMe,
            axisBuddy: matchData.axisBuddy,
          });
          // Background: match with remaining members (no animation)
          for (const memberId of existingMemberIds) {
            if (memberId === firstMatchId) continue;
            api('POST', '/api/quiz/match', { inviterId: memberId, campaignId }).catch(() => {});
          }
        } catch { /* matching failed, continue to group */ }
      }

      const summary = await loadSummary().catch(() => null);
      if (summary) setSummaryData(summary);
      setScreen('group');
      return;
    }
    setQuestionIndex(0);
    setAnswers([]);
    setScreen('question');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, groupAlreadyAnswered, groupCreatorId, campaignId, loadSummary]);

  // --- Answer question ---
  const handleAnswer = useCallback(async (questionId: string, optionId: string) => {
    const newAnswers = [...answers, { questionId, optionId }];
    setAnswers(newAnswers);

    const totalQuestions = config.questions?.length || 0;
    const nextIndex = questionIndex + 1;

    if (nextIndex < totalQuestions) {
      setQuestionIndex(nextIndex);
      return;
    }

    console.log('[App] all questions answered');

    // Preview mode: skip all API calls, show mock summary screen
    if (IS_PREVIEW) {
      setSummaryData({
        myArchetype: 'preview',
        myArchetypeLabel: '[PREVIEW] Archetype',
        pairsDone: 1,
        shareUrl: '#',
        pairs: [{ pairId: 'preview', role: 'inviter', partnerName: 'Demo User', status: 'waiting' }],
      });
      setScreen('summary');
      return;
    }

    try {
      // Solo/MBTI mode: save answers → summary directly, no pair matching
      if (config.mode === 'solo' || config.mode === 'mbti') {
        await api('POST', '/api/quiz/save-answers', { campaignId, answers: newAnswers });
        const summary = await loadSummary();
        setSummaryData(summary);
        setScreen('summary');
        return;
      }

      if (pendingInviterId) {
        // B's flow — save answers first, then match with A → popup + summary
        await api('POST', '/api/quiz/save-answers', { campaignId, answers: newAnswers });
        setMatchingBuddyAxisId(findAxisId(inviterArchLabel || inviterArchEn || '', config.axes) || config.axes?.[0]?.id || '');
        setMatchingMyAxisId('');
        setScreen('matching');
        let data: {
          pairId: string;
          result: { title: string; body: string; eyebrow?: string; image_url?: string };
          axisMe: string;
          axisBuddy: string;
          axisMeShort?: string;
          axisBuddyShort?: string;
          resultRank?: number;
          pushSentToInviter: boolean;
          inviterShareUrl?: string;
        };
        try {
          data = await api<typeof data>('POST', '/api/quiz/match', { inviterId: pendingInviterId, campaignId });
        } catch (matchErr) {
          const msg = (matchErr as Error).message || '';
          if (msg.includes('ตัวเอง')) {
            const summary = await loadSummary().catch(() => null);
            if (summary) { setSummaryData(summary); setScreen('summary'); }
            else setScreen('intro');
          } else {
            showError('จับคู่ไม่สำเร็จ', msg, () => { setScreen('invited'); });
          }
          return;
        }

        // S-5: If OA push to A failed, B shares the result card directly to A via chat
        // Uses same structure as F-05 (mega, OG hero, axis pair box, rank)
        if (!data.pushSentToInviter && data.inviterShareUrl && liff.isInClient()) {
          const primary = config.brand?.primary || '#E8354F';
          const copy = config.copy || {};
          const OG_BASE = config.appearance?.og_base_url || `${window.location.origin}/api/og`;
          const liffBase = `https://liff.line.me/${liffId}`;
          const liffDeepBase = `line://app/${liffId}`;

          // Resolve axis IDs from labels (data.axisMe = B's label, data.axisBuddy = A's label)
          const axisIdMe = findAxisId(data.axisMe, config.axes) || config.axes?.[0]?.id || '';
          const axisIdBuddy = findAxisId(data.axisBuddy, config.axes) || config.axes?.[0]?.id || '';
          const cardMeUrl = getAxisCard(axisIdMe, config.axes) || '';
          const cardBuddyUrl = getAxisCard(axisIdBuddy, config.axes) || '';
          const axisLabelMe = config.axes?.find(a => a.id === axisIdMe)?.label || data.axisMe;
          const axisLabelBuddy = config.axes?.find(a => a.id === axisIdBuddy)?.label || data.axisBuddy;

          // OG hero: 2 axis cards at ±8° (same endpoint as F-05, cards only — text in body)
          const heroUrl = `${OG_BASE}?${new URLSearchParams({ type: 'pair', ...(cardMeUrl ? { cardMeUrl } : {}), ...(cardBuddyUrl ? { cardBuddyUrl } : {}) })}`;

          liff.shareTargetPicker([{
            type: 'flex',
            altText: `ฉันตอบแล้ว! ดูผลคู่กับ ${inviterName || 'เพื่อน'} กันเลย`.slice(0, 400),
            contents: {
              type: 'bubble',
              size: 'mega',
              hero: cardMeUrl
                ? { type: 'image', url: heroUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
                : undefined,
              body: {
                type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
                contents: [
                  // Survival title + subtitle inline
                  {
                    type: 'box' as const, layout: 'horizontal' as const, alignItems: 'baseline' as const, spacing: 'sm',
                    contents: [
                      { type: 'text' as const, text: data.result.title, weight: 'bold' as const, size: 'xxl' as const, color: primary, flex: 0 },
                      { type: 'text' as const, text: copy.result_subtitle || 'คือเวลาที่คู่นี้รอด', size: 'xxs' as const, color: '#888888', wrap: true, flex: 1 },
                    ],
                  },
                  // Axis pair boxes: buddy (gray) | me (yellow)
                  {
                    type: 'box' as const, layout: 'horizontal' as const, margin: 'sm' as const, spacing: 'sm',
                    contents: [
                      {
                        type: 'box' as const, layout: 'vertical' as const, flex: 1, paddingAll: '10px',
                        backgroundColor: 'rgba(28,26,23,.07)', cornerRadius: '8px',
                        contents: [
                          { type: 'text' as const, text: inviterName || 'เพื่อน', size: 'xxs' as const, color: '#888888' },
                          { type: 'text' as const, text: axisLabelBuddy, weight: 'bold' as const, size: 'sm' as const, color: '#1C1A17', wrap: true, margin: 'xs' as const },
                        ],
                      },
                      {
                        type: 'box' as const, layout: 'vertical' as const, flex: 1, paddingAll: '10px',
                        backgroundColor: '#F5E14B', cornerRadius: '8px',
                        contents: [
                          { type: 'text' as const, text: copy.me || 'คุณ', size: 'xxs' as const, color: '#888888' },
                          { type: 'text' as const, text: axisLabelMe, weight: 'bold' as const, size: 'sm' as const, color: '#1C1A17', wrap: true, margin: 'xs' as const },
                        ],
                      },
                    ],
                  },
                  // Body text
                  ...(data.result.body ? [{ type: 'text' as const, text: data.result.body, size: 'sm' as const, color: '#555555', wrap: true, margin: 'sm' as const }] : []),
                ],
              },
              footer: {
                type: 'box', layout: 'vertical',
                contents: [
                  { type: 'button', action: { type: 'uri', label: copy.result_cta || 'ดูผลคู่แบบเต็ม', uri: data.inviterShareUrl }, style: 'primary', color: primary },
                  { type: 'button', action: { type: 'uri', label: copy.result_cta2 || 'ชวนคนต่อไป', uri: `${liffBase}?campaignId=${campaignId}&view=share` }, style: 'secondary' },
                ],
              },
            },
          }]).catch(() => {});
        }

        setInitialPopup({
          pairId: data.pairId,
          title: data.result.title,
          body: data.result.body,
          eyebrow: data.result.eyebrow,
          imageUrl: data.result.image_url,
          axisMe: data.axisMe,
          axisBuddy: data.axisBuddy,
          partnerName: inviterName,
        });
        const summary = await loadSummary();
        setSummaryData(summary);
        setScreen('summary');
        return;
      }

      if (isDemo && pairId) {
        // Demo mode — show result popup then go to intro with CTA to start real quiz
        const demoResult = await api<{
          result?: { title: string; body: string };
          axisMe?: string;
        }>('POST', '/api/quiz/answer', { pairId, answers: newAnswers });
        if (demoResult.result) {
          setInitialPopup({
            title: demoResult.result.title,
            body: demoResult.result.body,
            axisMe: demoResult.axisMe,
          });
        }
        setScreen('intro');
        return;
      }

      // A's flow — save answers → share screen → summary
      await api('POST', '/api/quiz/save-answers', { campaignId, answers: newAnswers });

      // If came from group link → join group first (answers already saved), then match with all members
      if (groupId) {
        // Join FIRST so the pair-check in joinGroup doesn't block membership
        const joinRes = await api<{ ok: boolean; viewOnly?: boolean; existingMemberIds?: string[] }>(
          'POST', `/api/group/${groupId}/join`
        ).catch(() => ({ ok: false, existingMemberIds: [] as string[] }));
        const existingMemberIds: string[] = (joinRes as { existingMemberIds?: string[] }).existingMemberIds || (groupCreatorId ? [groupCreatorId] : []);
        const firstMatchId = groupCreatorId || existingMemberIds[0];

        if (firstMatchId) {
          setMatchingBuddyAxisId(findAxisId(inviterArchLabel || inviterArchEn || '', config.axes) || config.axes?.[0]?.id || '');
          setMatchingMyAxisId('');
          setScreen('matching');
          try {
            const matchData = await api<{
              pairId: string;
              result: { title: string; body: string; eyebrow?: string; image_url?: string };
              axisMe: string;
              axisBuddy: string;
            }>('POST', '/api/quiz/match', { inviterId: firstMatchId, campaignId, fromGroup: true });
            setInitialPopup({
              pairId: matchData.pairId,
              title: matchData.result.title,
              body: matchData.result.body,
              eyebrow: matchData.result.eyebrow,
              imageUrl: matchData.result.image_url,
              axisMe: matchData.axisMe,
              axisBuddy: matchData.axisBuddy,
            });
            // Background: match with remaining members — no push (fromGroup suppresses F-04)
            for (const memberId of existingMemberIds) {
              if (memberId === firstMatchId) continue;
              api('POST', '/api/quiz/match', { inviterId: memberId, campaignId, fromGroup: true }).catch(() => {});
            }
          } catch { /* matching failed, continue to group */ }
        }
        const summary = await loadSummary();
        setSummaryData(summary);
        setScreen('group');
        return;
      }

      const summary = await loadSummary();
      setSummaryData(summary);
      setInitialPopup(null);
      setScreen('summary');

    } catch (err) {
      const errMsg = (err as Error).message;
      showError('ส่งคำตอบไม่สำเร็จ', errMsg, () => {
        // Retry: go back to last question so user can resubmit
        setScreen('question');
        setQuestionIndex(totalQuestions - 1);
        setAnswers(newAnswers.slice(0, -1));
      });
    }
  }, [answers, questionIndex, config, campaignId, pairId, pendingInviterId, inviterName, isDemo, groupId, groupCreatorId, showError, loadSummary]);

  // --- View pair result ---
  const handleViewPair = useCallback(async (pid: string, partnerName: string) => {
    try {
      const data = await api<{
        status: string;
        result?: { title: string; body: string; eyebrow?: string; image_url?: string };
        axisMe?: string;
        axisBuddy?: string;
        axisMeId?: string;
        axisBuddyId?: string;
      }>('GET', `/api/pair/${pid}`);

      if (data.status === 'completed' && data.result) {
        const liffBase = `https://liff.line.me/${liffId}`;
        const liffDeepBase = `line://app/${liffId}`;
        // For clipboard/web share, use current origin so dev stays on dev
        const shareBase = liff.isInClient() ? liffBase : window.location.origin + window.location.pathname;
        setPairResultData({
          pairId: pid,
          partnerName,
          title: data.result.title,
          body: data.result.body,
          imageUrl: data.result.image_url,
          axisMe: data.axisMe,
          axisBuddy: data.axisBuddy,
          axisMeId: data.axisMeId,
          axisBuddyId: data.axisBuddyId,
          pairUrl: `${shareBase}?campaignId=${campaignId}&pairId=${pid}`,
          inviteUrl: myUserId ? `${shareBase}?campaignId=${campaignId}&inviterId=${myUserId}` : undefined,
        });
        setScreen('pair-result');
      }

    } catch (err) {
      showError('โหลดผลลัพท์ไม่สำเร็จ', (err as Error).message);
    }
  }, [campaignId, showError]);


  // --- Solo share preview screen ---
  const handleSoloShare = useCallback(() => {
    setSoloShareMyUserId(myUserId);
    setScreen('solo-share');
  }, [myUserId]);

  // --- Group ---
  const handleGoGroup = useCallback(async (gid: string) => {
    setGroupId(gid);
    setScreen('group');
  }, []);

  const handleCreateGroupDirect = useCallback(async (gid?: string) => {
    if (gid) { setGroupId(gid); setScreen('group'); return; }
    try {
      const res = await api<{ groupId: string }>('POST', '/api/group/create', { campaignId });
      setGroupId(res.groupId);
      setScreen('group');
    } catch (e) {
      showError('สร้างกลุ่มไม่สำเร็จ', (e as Error).message);
    }
  }, [campaignId, showError]);


  // --- Render ---
  return (
    <div className="app">
      {screen === 'loading' && <Loading config={config} />}
      {screen === 'matching' && (() => {
        const matchingAppearance = (config.appearance ?? {}) as {
          screen_config?: Record<string, { blocks: any[] }>;
          font_scale?: number;
          progress_style_matching?: 'default' | 'compact' | 'bar';
          art_shape?: 'card' | 'circle' | 'square' | 'wide' | 'none';
          art_frame?: 'outline' | 'soft' | 'flat';
          art_hero?: 'pair' | 'single' | 'band';
          group_hero_pattern?: 'fan' | 'grid';
        };
        const { blockOrder, blockVisible, geo, pos, pat } = getScreenBlocks(matchingAppearance, 'Matching', ['matArt', 'loadCopy', 'loadBar']);
        const artH = Number(geo('matArt').h) || 172;
        const pairPat = pat('matArt', 'pair', getPatternDefaults(matchingAppearance).pair);
        const fontScale = matchingAppearance.font_scale;
        const progressStyleMatching = matchingAppearance.progress_style_matching || 'default';
        const artStyle = (side: 'me' | 'buddy'): React.CSSProperties => {
          const base: React.CSSProperties = { backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:124, height:artH };
          if (pairPat === 'side') return { ...base, marginRight: side === 'me' ? 6 : 0 };
          if (pairPat === 'overlap') return { ...base, marginRight: side === 'me' ? -50 : 0, zIndex: side === 'buddy' ? 2 : undefined };
          // tilt (default) — preserves the original wobble animation
          return side === 'me'
            ? { ...base, marginRight:-26, animation:'v2TiltL 2.2s ease-in-out infinite' }
            : { ...base, marginLeft:-26, animation:'v2TiltR 2.2s ease-in-out .35s infinite', zIndex:2 };
        };

        const RENDERERS: Record<string, () => React.ReactNode> = {
          matArt: () => (
            <div key="matArt" style={{ position:'relative', display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ backgroundImage:`url('${getAxisCard(matchingMyAxisId || 'prep', config.axes)}')`, ...artStyle('me') }} />
              <div style={{ backgroundImage:`url('${getAxisCard(matchingBuddyAxisId || 'chill', config.axes)}')`, ...artStyle('buddy') }} />
            </div>
          ),
          loadCopy: () => (
            <div key="loadCopy" style={{ position:'relative', textAlign:'center' }}>
              <div style={{ fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:scaleFont(26, fontScale), letterSpacing:'.05em' }}>{config.copy?.matching_title || 'MATCHING...'}</div>
              <div style={{ font:`500 ${scaleFont(13, fontScale)}px var(--font-body,'Bai Jamjuree'),sans-serif`, color:'var(--ink2)', marginTop:4 }}>{inviterName ? `${config.copy?.matching_with || 'จับคู่กับ'} ${inviterName}` : (config.copy?.matching_sub || 'กำลังคำนวณผลคู่...')}</div>
            </div>
          ),
          loadBar: () => (
            <div key="loadBar" style={{ position:'relative', width:190, height:12, border:'2px solid var(--ink)', borderRadius:'var(--progress-radius)', overflow:'hidden', background:'var(--card)' }}>
              {progressStyleMatching === 'default' ? (
                <div style={{ height:'100%', width:'72%', background:'repeating-linear-gradient(115deg,#E8354F 0 10px,#F5E14B 10px 18px)', backgroundSize:'36px 100%', animation:'v2Dash 1s linear infinite' }} />
              ) : (
                <div style={{
                  height:'100%',
                  width: progressStyleMatching === 'compact' ? '45%' : '72%',
                  background: progressStyleMatching === 'bar' ? '#E8354F' : 'repeating-linear-gradient(115deg,#E8354F 0 10px,#F5E14B 10px 18px)',
                  backgroundSize: progressStyleMatching === 'bar' ? undefined : '36px 100%',
                  animation: progressStyleMatching === 'bar' ? undefined : 'v2Dash 1s linear infinite',
                }} />
              )}
            </div>
          ),
        };

        const visible = blockOrder.filter(blockVisible);
        const flowIds = visible.filter(id => !pos(id));
        const floatIds = visible.filter(id => pos(id));

        return (
          <div className="screen" style={{ alignItems:'center', justifyContent:'center', gap:26, background:'var(--bg)' }}>
            <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 50% 40%,rgba(245,225,75,.4),transparent 55%)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', inset:0, background:'var(--texture-bg)', pointerEvents:'none' }} />
            {flowIds.map(id => RENDERERS[id]?.())}
            {floatIds.map(id => <div key={id} style={floatStyle(pos(id)!)}>{RENDERERS[id]?.()}</div>)}
          </div>
        );
      })()}
      {screen === 'intro' && <Intro config={{ ...config, appearance: config.appearance }} onStart={handleStart} />}
      {screen === 'invited' && (
        <Invited
          config={config}
          inviterName={inviterName} inviterPic={inviterPic} inviterArchLabel={inviterArchLabel} inviterArchEn={inviterArchEn}
          mode={groupId ? 'team' : 'duo'}
          teamInfo={groupInfo ?? undefined}
          alreadyAnswered={groupId ? groupAlreadyAnswered : false}
          isFull={groupId ? groupIsFull : false}
          onViewGroup={groupId ? () => setScreen('group') : undefined}
          kvImageUrl={config.brand?.kv_image_url}
          introUrl={`https://liff.line.me/${liffId}?campaignId=${campaignId}`}
          isFriend={isFriend}
          onStart={handleStartInvited}
        />
      )}
      {screen === 'question' && (
        <Question config={config} questionIndex={questionIndex} onAnswer={handleAnswer} onBack={() => { if (questionIndex > 0) setQuestionIndex(qi => qi - 1); else setScreen(pendingInviterId ? 'invited' : 'intro'); }} />
      )}
      {screen === 'summary' && summaryData && (
        <Summary
          config={config}
          campaignId={campaignId}
          liffId={liffId}
          myArchetype={summaryData.myArchetype}
          myArchetypeLabel={summaryData.myArchetypeLabel}
          myArchetypeBody={summaryData.myArchetypeBody}
          myArchetypeEn={summaryData.myArchetypeEn}
          myArchetypeOrder={summaryData.myArchetypeOrder}
          myArchetypeShort={summaryData.myArchetypeShort}
          myArchetypeImage={summaryData.myArchetypeImage}
          pairsDone={summaryData.pairsDone}
          shareUrl={summaryData.shareUrl}
          pairs={summaryData.pairs}
          initialPopup={initialPopup}
          onViewPair={handleViewPair}
          onCreateGroup={config.group?.enabled ? handleCreateGroupDirect : undefined}
          onGoGroup={handleGoGroup}
          onSoloShare={handleSoloShare}
          onRetake={() => { setAnswers([]); setQuestionIndex(0); setScreen('question'); }}
          onPopupDismissed={() => setInitialPopup(null)}
          onGoSymbols={config.group?.enabled ? () => setScreen('symbols') : undefined}
          onGoRewards={config.rewards?.enabled ? () => setScreen('rewards') : undefined}
          isFriend={isFriend}
          teamsVersion={teamsVersion}
        />
      )}
      {screen === 'solo-share' && summaryData && (() => {
        const axisId = summaryData.myArchetype || findAxisId(summaryData.myArchetypeLabel || '', config.axes) || config.axes?.[0]?.id || '';
        const cardUrl = summaryData.myArchetypeImage || getAxisCard(axisId, config.axes);
        return (
          <SoloShare
            config={config}
            campaignId={campaignId}
            liffId={liffId}
            archTitle={summaryData.myArchetypeLabel || ''}
            archTitleEn={summaryData.myArchetypeEn || ''}
            archBody={summaryData.myArchetypeBody || ''}
            axisId={axisId}
            cardImageUrl={cardUrl}
            myUserId={soloShareMyUserId}
            isFriend={isFriend}
            onBack={() => setScreen('summary')}
            onPlayAgain={() => { setAnswers([]); setQuestionIndex(0); setScreen('intro'); }}
          />
        );
      })()}
      {screen === 'pair-result' && pairResultData && (
        <PairResult
          config={config}
          partnerName={pairResultData.partnerName}
          title={pairResultData.title}
          body={pairResultData.body}
          imageUrl={pairResultData.imageUrl}
          axisMe={pairResultData.axisMe}
          axisBuddy={pairResultData.axisBuddy}
          axisMeId={pairResultData.axisMeId}
          axisBuddyId={pairResultData.axisBuddyId}
          axisMeShort={pairResultData.axisMeShort}
          axisBuddyShort={pairResultData.axisBuddyShort}
          pairUrl={pairResultData.pairUrl}
          inviteUrl={pairResultData.inviteUrl}
          myName={myDisplayName || undefined}
          isFriend={isFriend}
          onBack={() => setScreen('summary')}
        />
      )}
      {screen === 'symbols' && (
        <SymbolCollection
          config={config}
          campaignId={campaignId}
          onBack={() => setScreen('summary')}
        />
      )}
      {screen === 'rewards' && (
        <Rewards
          campaignId={campaignId}
          pairsDone={summaryData?.pairsDone ?? 0}
          onBack={() => setScreen('summary')}
          copy={config.copy}
          groupArchetypes={config.group?.archetypes}
        />
      )}
      {screen === 'group' && groupId && (
        <Group
          groupId={groupId}
          campaignId={campaignId}
          myUserId={myUserId}
          config={config}
          liffId={liffId}
          isFriend={isFriend}
          onBack={() => { setTeamsVersion(v => v + 1); setScreen(summaryData ? 'summary' : 'intro'); }}
          onViewPair={handleViewPair}
        />
      )}
      {screen === 'open-in-line' && (
        <div className="screen fade-enter" style={{ background:'var(--bg)', alignItems:'center', justifyContent:'center', padding:20, textAlign:'center' }}>
          <div style={{ fontFamily:"var(--font-display,'Bangers'),cursive", fontSize:28, letterSpacing:'.05em', marginBottom:12 }}>{config.copy?.open_in_line_title || 'เปิดในแอป LINE'}</div>
          <div style={{ font:"500 14px/1.7 var(--font-body,'Bai Jamjuree'),sans-serif", color:'var(--ink2)', marginBottom:24 }}>
            {config.copy?.open_in_line_body || 'กรุณาเปิดลิงก์นี้ผ่านแอป LINE เพื่อเริ่มเล่นและเพิ่มเพื่อน Official Account'}
          </div>
          <button
            onClick={() => { window.location.href = `https://liff.line.me/${liffId}${window.location.search}`; }}
            style={{ padding:'15px 24px', background:'#06C755', color:'#fff', border:'none', borderRadius:'var(--radius)', font:"700 17px/1 var(--font-body,'Bai Jamjuree'),sans-serif", cursor:'pointer' }}
          >{config.copy?.open_in_line_btn || 'เปิดใน LINE'}</button>
        </div>
      )}
      {screen === 'error' && <ErrorScreen title={errorInfo.title} body={errorInfo.body} onRetry={errorInfo.retryFn} copy={config.copy} cardUrl={config.axes?.[config.axes.length - 1]?.image_url} axes={config.axes} appearance={config.appearance} />}

      {/* Global LINE OA floating button — visible on all active screens */}
      {!isFriend && !['loading', 'matching', 'error', 'open-in-line'].includes(screen) && (
        <button
          onClick={() => {
            const oaId = (config.appearance?.oa_id || '747xtauy').replace('@', '');
            window.open(`https://line.me/R/ti/p/%40${oaId}`, '_blank');
          }}
          title="เพิ่มเพื่อน LINE OA"
          style={{
            position: 'fixed', bottom: 24, right: 16, zIndex: 50,
            width: 44, height: 44,
            background: '#06C755',
            border: '2px solid var(--ink)',
            borderRadius: '50%',
            boxShadow: '2px 3px 0 var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.477 2 2 6.038 2 11.05c0 2.492 1.045 4.735 2.738 6.352.22.21.283.554.175.843l-.54 1.94a.5.5 0 0 0 .664.613l2.163-.87c.23-.092.49-.07.706.058A10.5 10.5 0 0 0 12 20.1c5.523 0 10-4.038 10-9.05S17.523 2 12 2Z" fill="white"/>
          </svg>
        </button>
      )}
      <div style={{
        position: 'fixed', bottom: 6, left: 8, zIndex: 9999,
        font: '11px/1 ui-monospace,monospace', color: '#00000055',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        {__COMMIT_HASH__}
      </div>
    </div>
  );
}
