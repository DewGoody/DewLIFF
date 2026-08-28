import { useState, useEffect, useCallback } from 'react';
import { setToken, api } from './api';
import { getAxisCard, findAxisId } from './data';
import Loading from './screens/Loading';
import Intro from './screens/Intro';
import Invited from './screens/Invited';
import Question from './screens/Question';
import Summary from './screens/Summary';
import PairResult from './screens/PairResult';
import Rewards from './screens/Rewards';
import Group from './screens/Group';
import SoloShare from './screens/SoloShare';
import ErrorScreen from './screens/ErrorScreen';
import FriendGate from './screens/FriendGate';
import type { PairPopup } from './screens/Summary';

// DewLIFF's own LIFF ID — never KimLIFF's (see fix commit 9294b15; a wrong
// LIFF ID here makes liff.init() authenticate against the wrong LINE channel).
const LIFF_ID = '2011192503-E4zprfoA';
const IS_PREVIEW = new URLSearchParams(window.location.search).get('preview') === '1';

type Screen = 'loading' | 'intro' | 'invited' | 'question' | 'summary' | 'solo-share' | 'pair-result' | 'error' | 'friend-gate' | 'open-in-line' | 'matching' | 'rewards' | 'group';

interface RewardMilestone {
  key: string;
  trigger_pairs: number;
  reward_pool_id: string;
  label: string;
  icon?: string;
}

interface RewardsConfig {
  enabled: boolean;
  points_per_pair: number;
  milestones?: RewardMilestone[];
}

interface RewardClaim {
  id: string;
  milestone_key: string;
  pool_type: string;
  pool_name: string;
  code?: string;
  issued_at: string;
  meta?: { code?: string; pool_type?: string; pool_name?: string };
}

interface AppearanceConfig {
  accent?: string;
  theme?: 'dark' | 'light';
  radius?: number;
  intro_layout?: string;
  question_layout?: string;
  summary_layout?: string;
  pair_layout?: string;
  loading_style?: string;
  loading_copy?: string;
  images?: Record<string, string>;
  liff_id?: string;
  oa_id?: string;
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
  rewards?: RewardsConfig;
  group?: GroupConfig;
  appearance?: AppearanceConfig;
}

interface SummaryData {
  myArchetype: string;
  myArchetypeLabel: string;
  myArchetypeBody?: string;
  myArchetypeEn?: string;
  myArchetypeOrder?: string;
  myArchetypeShort?: string;
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
  axisMeShort?: string;
  axisBuddyShort?: string;
  rank?: number;
  pairUrl?: string;
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
  const [rewardClaims, setRewardClaims] = useState<RewardClaim[]>([]);
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

  const applyTheme = useCallback((brand?: AppConfig['brand']) => {
    if (!brand) return;
    const root = document.documentElement;
    if (brand.primary) root.style.setProperty('--primary', brand.primary);
    if (brand.surface) root.style.setProperty('--surface', brand.surface);
    if (brand.on_surface) root.style.setProperty('--on', brand.on_surface);
  }, []);

  const applyAppearance = useCallback((appearance?: AppConfig['appearance']) => {
    if (!appearance) return;
    const root = document.documentElement;
    if (appearance.accent) root.style.setProperty('--primary', appearance.accent);
    if (appearance.radius !== undefined) root.style.setProperty('--radius', appearance.radius + 'px');
    const dark = appearance.theme !== 'light';
    if (appearance.theme) {
      root.style.setProperty('--surface', dark ? '#0C0B0A' : '#F5F1EA');
      root.style.setProperty('--on', dark ? '#EDE7DF' : '#1A1714');
    }
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
      applyTheme(cfg.brand);
      applyAppearance(cfg.appearance);
      const validScreens = ['loading','intro','invited','question','summary','pair-result','rewards','group'];
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
    async function init() {
      try {
        console.log('[App] starting LIFF init, liffId:', LIFF_ID);
        await liff.init({ liffId: LIFF_ID });
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
          const { friendFlag } = await liff.getFriendship();
          if (!friendFlag) {
            setScreen('friend-gate');
            return;
          }
        } catch (e) {
          // getFriendship threw — could be scope/API issue OR external browser limitation.
          // If we're inside LINE client, it's an API error → allow through (user is likely a friend).
          // If we're outside LINE client, be conservative → show friend-gate so user adds OA first.
          if (!liff.isInClient()) {
            console.warn('[App] getFriendship failed in external browser, showing friend-gate:', e);
            setScreen('friend-gate');
            return;
          }
          console.warn('[App] getFriendship failed in LINE client (API issue), allowing through:', e);
        }

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
          applyTheme(data.brand);
          applyAppearance(data.appearance);

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
            applyTheme(cfgData.brand);
            applyAppearance(cfgData.appearance);

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
          applyTheme(data.brand);
          applyAppearance(data.appearance);

          try {
            const myAnswers = await api<{ answered: boolean }>('GET', `/api/quiz/my-answers?campaignId=${campaignId}`);
            if (myAnswers.answered) {
              console.log('[App] A already answered, going to summary');
              const summary = await loadSummary();
              setSummaryData(summary);
              setScreen('summary');
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
      applyTheme(data.brand);
      applyAppearance(data.appearance);

      // If B already answered → auto-match using stored answers, skip quiz
      try {
        const myAnswers = await api<{ answered: boolean }>('GET', `/api/quiz/my-answers?campaignId=${campaignId}`);
        console.log('[App] handleInviterFlow answered:', myAnswers.answered);
        if (myAnswers.answered) {
          setMatchingBuddyAxisId(findAxisId(profile.archLabel || profile.archEn || '') || 'chill');
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
      if (data.config) { setConfig(data.config); applyTheme(data.config.brand); }
      if (data.inviter) { setInviterName(data.inviter.displayName); setInviterPic(data.inviter.pictureUrl); }
      setScreen('invited');
    } catch (err) {
      showError('ลิงก์ไม่ถูกต้อง', (err as Error).message);
    }
  }

  // --- Friend gate passed ---
  const handleFriendAdded = useCallback(() => {
    if (pendingInviterId) handleInviterFlow(pendingInviterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInviterId]);

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
        setMatchingBuddyAxisId(findAxisId(inviterArchLabel || inviterArchEn || '') || 'chill');
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
      if (pendingInviterId) {
        // B's flow — save answers first, then match with A → popup + summary
        await api('POST', '/api/quiz/save-answers', { campaignId, answers: newAnswers });
        setMatchingBuddyAxisId(findAxisId(inviterArchLabel || inviterArchEn || '') || 'chill');
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
          // DewLIFF is its own separate Vercel deployment from KimLIFF's — this LIFF
          // app is served from the same origin as its own /api/og (see vercel.json),
          // so window.location.origin is always correct here, unlike a hardcoded domain.
          const OG_BASE = `${window.location.origin}/api/og`;
          const liffBase = `https://liff.line.me/${LIFF_ID}`;

          // Resolve axis IDs from labels (data.axisMe = B's label, data.axisBuddy = A's label)
          const axisIdMe = findAxisId(data.axisMe) || 'prep';
          const axisIdBuddy = findAxisId(data.axisBuddy) || 'prep';
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
          setMatchingBuddyAxisId(findAxisId(inviterArchLabel || inviterArchEn || '') || 'chill');
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
      }>('GET', `/api/pair/${pid}`);

      if (data.status === 'completed' && data.result) {
        const liffBase = `https://liff.line.me/${LIFF_ID}`;
        setPairResultData({
          pairId: pid,
          partnerName,
          title: data.result.title,
          body: data.result.body,
          imageUrl: data.result.image_url,
          axisMe: data.axisMe,
          axisBuddy: data.axisBuddy,
          pairUrl: `${liffBase}?campaignId=${campaignId}&pairId=${pid}`,
        });
        setScreen('pair-result');
      }

    } catch (err) {
      showError('โหลดผลลัพท์ไม่สำเร็จ', (err as Error).message);
    }
  }, [campaignId, showError]);

  // --- Go to rewards screen (load claims first) ---
  const handleGoRewards = useCallback(async () => {
    try {
      const data = await api<{ claims: RewardClaim[] }>('GET', `/api/quiz/rewards/my/${campaignId}`);
      setRewardClaims(data.claims || []);
    } catch {
      setRewardClaims([]);
    }
    setScreen('rewards');
  }, [campaignId]);

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

  // --- Claim a milestone reward ---
  const handleClaim = useCallback(async (milestoneKey: string) => {
    await api('POST', '/api/quiz/rewards/claim', { campaign_id: campaignId, milestone_key: milestoneKey });
    // Refresh claims
    const data = await api<{ claims: RewardClaim[] }>('GET', `/api/quiz/rewards/my/${campaignId}`);
    setRewardClaims(data.claims || []);
  }, [campaignId]);

  // --- Render ---
  return (
    <div className="app">
      {screen === 'loading' && <Loading />}
      {screen === 'matching' && (
        <div className="screen" style={{ alignItems:'center', justifyContent:'center', gap:26, background:'#F7F1E3' }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 50% 40%,rgba(245,225,75,.4),transparent 55%)', pointerEvents:'none' }} />
          <div style={{ position:'relative', display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ backgroundImage:`url('${getAxisCard(matchingMyAxisId || 'prep', config.axes)}')`, backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:124, height:172, marginRight:-26, animation:'v2TiltL 2.2s ease-in-out infinite' }} />
            <div style={{ backgroundImage:`url('${getAxisCard(matchingBuddyAxisId || 'chill', config.axes)}')`, backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat', width:124, height:172, marginLeft:-26, animation:'v2TiltR 2.2s ease-in-out .35s infinite', zIndex:2 }} />
          </div>
          <div style={{ position:'relative', textAlign:'center' }}>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:26, letterSpacing:'.05em' }}>{config.copy?.matching_title || 'MATCHING...'}</div>
            <div style={{ font:"500 13px 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.55)', marginTop:4 }}>{inviterName ? `${config.copy?.matching_with || 'จับคู่กับ'} ${inviterName}` : (config.copy?.matching_sub || 'กำลังคำนวณผลคู่...')}</div>
          </div>
          <div style={{ position:'relative', width:190, height:12, border:'2px solid #1C1A17', borderRadius:8, overflow:'hidden', background:'#FFFDF6' }}>
            <div style={{ height:'100%', width:'72%', background:'repeating-linear-gradient(115deg,#E8354F 0 10px,#F5E14B 10px 18px)', backgroundSize:'36px 100%', animation:'v2Dash 1s linear infinite' }} />
          </div>
        </div>
      )}
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
          introUrl={`https://liff.line.me/${LIFF_ID}?campaignId=${campaignId}`}
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
          liffId={LIFF_ID}
          myArchetype={summaryData.myArchetype}
          myArchetypeLabel={summaryData.myArchetypeLabel}
          myArchetypeBody={summaryData.myArchetypeBody}
          myArchetypeEn={summaryData.myArchetypeEn}
          myArchetypeOrder={summaryData.myArchetypeOrder}
          myArchetypeShort={summaryData.myArchetypeShort}
          archStats={summaryData.archStats}
          pairsDone={summaryData.pairsDone}
          shareUrl={summaryData.shareUrl}
          pairs={summaryData.pairs}
          initialPopup={initialPopup}
          onViewPair={handleViewPair}
          onGoRewards={config.rewards?.enabled ? handleGoRewards : undefined}
          onCreateGroup={config.group?.enabled ? handleCreateGroupDirect : undefined}
          onGoGroup={handleGoGroup}
          onSoloShare={handleSoloShare}
          onRetake={() => { setAnswers([]); setQuestionIndex(0); setScreen('question'); }}
        />
      )}
      {screen === 'solo-share' && summaryData && (() => {
        const axisId = summaryData.myArchetype || findAxisId(summaryData.myArchetypeLabel || '') || 'prep';
        const cardUrl = getAxisCard(axisId, config.axes);
        return (
          <SoloShare
            config={config}
            campaignId={campaignId}
            liffId={LIFF_ID}
            archTitle={summaryData.myArchetypeLabel || ''}
            archBody={summaryData.myArchetypeBody || ''}
            cardImageUrl={cardUrl}
            myUserId={soloShareMyUserId}
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
          axisMeShort={pairResultData.axisMeShort}
          axisBuddyShort={pairResultData.axisBuddyShort}
          rank={pairResultData.rank}
          pairUrl={pairResultData.pairUrl}
          myName={myDisplayName || undefined}
          onBack={() => setScreen('summary')}
        />
      )}
      {screen === 'rewards' && summaryData && (
        <Rewards
          pairsDone={summaryData.pairsDone}
          pairs={summaryData.pairs}
          rewardsConfig={config.rewards}
          claims={rewardClaims}
          onClaim={handleClaim}
          onBack={() => setScreen('summary')}
          campaignId={campaignId}
          groupArchetypes={config.group?.archetypes}
        />
      )}
      {screen === 'group' && groupId && (
        <Group
          groupId={groupId}
          campaignId={campaignId}
          myUserId={myUserId}
          config={config}
          liffId={LIFF_ID}
          onBack={() => setScreen(summaryData ? 'summary' : 'intro')}
          onViewPair={handleViewPair}
        />
      )}
      {screen === 'open-in-line' && (
        <div className="screen fade-enter" style={{ background:'#F7F1E3', alignItems:'center', justifyContent:'center', padding:20, textAlign:'center' }}>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:28, letterSpacing:'.05em', marginBottom:12 }}>เปิดในแอป LINE</div>
          <div style={{ font:"500 14px/1.7 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.65)', marginBottom:24 }}>
            กรุณาเปิดลิงก์นี้ผ่านแอป LINE เพื่อเริ่มเล่นและเพิ่มเพื่อน Official Account
          </div>
          <button
            onClick={() => { window.location.href = `https://liff.line.me/${LIFF_ID}${window.location.search}`; }}
            style={{ padding:'15px 24px', background:'#06C755', color:'#fff', border:'none', borderRadius:13, font:"700 17px/1 'Bai Jamjuree',sans-serif", cursor:'pointer' }}
          >เปิดใน LINE</button>
        </div>
      )}
      {screen === 'error' && <ErrorScreen title={errorInfo.title} body={errorInfo.body} onRetry={errorInfo.retryFn} />}
      {screen === 'friend-gate' && <FriendGate onFriendAdded={handleFriendAdded} oaId={config.appearance?.oa_id} returnUrl={window.location.href} />}
    </div>
  );
}
