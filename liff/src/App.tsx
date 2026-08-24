import { useState, useEffect, useCallback } from 'react';
import { setToken, api } from './api';
import Loading from './screens/Loading';
import Intro from './screens/Intro';
import Invited from './screens/Invited';
import Question from './screens/Question';
import Share from './screens/Share';
import Summary from './screens/Summary';
import PairResult from './screens/PairResult';
import Rewards from './screens/Rewards';
import Group from './screens/Group';
import ErrorScreen from './screens/ErrorScreen';
import FriendGate from './screens/FriendGate';
import type { PairPopup } from './screens/Summary';

const LIFF_ID = '2011037337-KlqFK4LM';
const IS_PREVIEW = new URLSearchParams(window.location.search).get('preview') === '1';

type Screen = 'loading' | 'intro' | 'invited' | 'question' | 'share' | 'summary' | 'pair-result' | 'error' | 'friend-gate' | 'matching' | 'rewards' | 'group';

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

interface GroupConfig {
  enabled?: boolean;
  result_mode?: 'score' | 'match';
  min_members?: number;
  reward_members?: number;
  max_members?: number;
  overflow_mode?: 'hard_cap' | 'rolling' | 'creator_pick';
  batch_size?: number;
}

interface AppConfig {
  id?: string;
  brand?: { name?: string; logo_url?: string; primary?: string; surface?: string; on_surface?: string; kv_image_url?: string };
  copy?: Record<string, string>;
  axes?: { id: string; label: string; label_en?: string; order?: string; short?: string }[];
  questions?: { id: string; kicker?: string; text: string; options: { id: string; label: string }[] }[];
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
  const [myUserId, setMyUserId] = useState<string>('');

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
      const validScreens = ['loading','intro','invited','question','share','summary','pair-result','rewards','group'];
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

        // Eagerly store display name from LIFF profile (available without OA friendship)
        try {
          const profile = await liff.getProfile();
          if (profile.displayName) {
            api('POST', '/api/quiz/set-name', { displayName: profile.displayName, pictureUrl: profile.pictureUrl }).catch(() => {});
          }
        } catch { /* non-critical */ }

        const params = new URLSearchParams(window.location.search);
        const urlInviterId = params.get('inviterId');
        const urlPairId = params.get('pairId');
        const urlToken = params.get('token');
        const urlGroupId = params.get('groupId');

        // Store LINE userId for group screen
        try {
          const profile = await liff.getProfile();
          setMyUserId(profile.userId);
        } catch { /* non-critical */ }

        console.log('[App] URL params: inviterId=', urlInviterId, 'pairId=', urlPairId, 'groupId=', urlGroupId, 'campaign=', campaignId);

        // Group join flow — from group share link
        if (urlGroupId) {
          console.log('[App] groupId found:', urlGroupId);
          setGroupId(urlGroupId);
          const data = await api<AppConfig>('GET', `/api/campaign/${campaignId}`);
          setConfig(data);
          applyTheme(data.brand);
          applyAppearance(data.appearance);
          // Check if already answered — if so, auto-join and show group
          try {
            const myAnswers = await api<{ answered: boolean }>('GET', `/api/quiz/my-answers?campaignId=${campaignId}`);
            if (myAnswers.answered) {
              await api('POST', `/api/group/${urlGroupId}/join`).catch(() => {}); // already member = ok
              setScreen('group');
              return;
            }
          } catch { /* not answered yet — go through quiz first */ }
          // Not answered yet → go through quiz, then auto-join after
          setScreen('intro');
          return;
        }

        if (urlInviterId) {
          console.log('[App] inviterId found');
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
        if (myAnswers.answered) {
          setScreen('matching');
          const matchData = await api<{
            pairId: string;
            result: { title: string; body: string; eyebrow?: string; image_url?: string };
            axisMe: string;
            axisBuddy: string;
          }>('POST', '/api/quiz/match', { inviterId, campaignId }); // no answers — backend loads stored ones

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
          return;
        }
      } catch (e) {
        console.warn('[App] auto-match check failed, continuing to quiz:', e);
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

  // --- Start from invited (B) ---
  const handleStartInvited = useCallback(() => {
    setQuestionIndex(0);
    setAnswers([]);
    setScreen('question');
  }, []);

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

    // Preview mode: skip all API calls, show mock share screen
    if (IS_PREVIEW) {
      setSummaryData({
        myArchetype: 'preview',
        myArchetypeLabel: '[PREVIEW] Archetype',
        pairsDone: 1,
        shareUrl: '#',
        pairs: [{ pairId: 'preview', role: 'inviter', partnerName: 'Demo User', status: 'waiting' }],
      });
      setScreen('share');
      return;
    }

    try {
      if (pendingInviterId) {
        // B's flow — match with A → popup + summary
        const data = await api<{
          pairId: string;
          result: { title: string; body: string; eyebrow?: string; image_url?: string };
          axisMe: string;
          axisBuddy: string;
          axisMeShort?: string;
          axisBuddyShort?: string;
          resultRank?: number;
          pushSentToInviter: boolean;
          inviterShareUrl?: string;
        }>('POST', '/api/quiz/match', { inviterId: pendingInviterId, campaignId, answers: newAnswers });

        // If OA push to A failed, B shares the result directly to A via chat
        if (!data.pushSentToInviter && data.inviterShareUrl && liff.isInClient()) {
          const primary = config.brand?.primary || '#E63B2E';
          liff.shareTargetPicker([{
            type: 'flex',
            altText: `${inviterName || 'เพื่อน'} ตอบแล้ว! ดูผลคู่กันเลย`,
            contents: {
              type: 'bubble',
              body: {
                type: 'box', layout: 'vertical', spacing: 'md',
                contents: [
                  { type: 'text', text: 'ฉันตอบแล้ว! ดูผลของเราด้วยกันเลย', weight: 'bold', size: 'lg', wrap: true },
                  { type: 'text', text: data.result.title, weight: 'bold', size: 'xl', color: primary, wrap: true },
                  { type: 'text', text: data.result.body, size: 'sm', color: '#666666', wrap: true },
                ],
              },
              footer: {
                type: 'box', layout: 'vertical',
                contents: [
                  { type: 'button', action: { type: 'uri', label: 'ดูผลคู่', uri: data.inviterShareUrl }, style: 'primary', color: primary },
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

      // If came from group link → auto-join then go to group screen
      if (groupId) {
        await api('POST', `/api/group/${groupId}/join`).catch(() => {});
        setScreen('group');
        return;
      }

      const summary = await loadSummary();
      setSummaryData(summary);
      setInitialPopup(null);
      setScreen('share'); // Show share screen first

    } catch (err) {
      const errMsg = (err as Error).message;
      showError('ส่งคำตอบไม่สำเร็จ', errMsg, () => {
        // Retry: go back to last question so user can resubmit
        setScreen('question');
        setQuestionIndex(totalQuestions - 1);
        setAnswers(newAnswers.slice(0, -1));
      });
    }
  }, [answers, questionIndex, config, campaignId, pairId, pendingInviterId, inviterName, isDemo, showError, loadSummary]);

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

  // --- Go to share screen (from summary "ชวนคนอื่นเพิ่ม") ---
  const handleGoShare = useCallback(() => {
    setScreen('share');
  }, []);

  // --- Share done → summary ---
  const handleShareDone = useCallback(() => {
    setScreen('summary');
  }, []);

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

  // --- Group ---
  const handleGoGroup = useCallback(async (gid: string) => {
    setGroupId(gid);
    setScreen('group');
  }, []);

  const handleCreateGroup = useCallback(async () => {
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
      {screen === 'loading' && <Loading appearance={config.appearance} />}
      {screen === 'matching' && (
        <div className="screen" style={{alignItems:'center',justifyContent:'center',background:'#0C0B0A'}}>
          <div className="tex" />
          <div style={{position:'relative',display:'flex',alignItems:'center',gap:0}}>
            <div style={{width:74,height:74,borderRadius:'50%',border:'1px solid rgba(237,231,223,.3)',display:'flex',alignItems:'center',justifyContent:'center',font:"600 20px 'IBM Plex Sans Thai',sans-serif",background:'#15120F',color:'#EDE7DF'}}>{inviterName?.[0] || '?'}</div>
            <div style={{width:56,height:1,background:'linear-gradient(90deg,rgba(237,231,223,.25),#D95F2B,rgba(237,231,223,.25))',animation:'duoFlicker 1.4s ease-in-out infinite'}} />
            <div style={{width:74,height:74,borderRadius:'50%',border:'1px solid rgba(217,95,43,.6)',display:'flex',alignItems:'center',justifyContent:'center',font:"600 20px 'IBM Plex Sans Thai',sans-serif",background:'#15120F',color:'#D95F2B'}}>คุณ</div>
          </div>
          <div style={{position:'relative',textAlign:'center',marginTop:30}}>
            <div style={{fontFamily:'Anton,sans-serif',fontSize:17,letterSpacing:'.26em',color:'#EDE7DF'}}>MATCHING</div>
            <div style={{font:"300 12.5px/1.7 'IBM Plex Sans Thai',sans-serif",color:'rgba(237,231,223,.42)',marginTop:9}}>{inviterName ? `จับคู่กับ ${inviterName} — ` : ''}ใช้คำตอบเดิมของคุณ กำลังคำนวณผลคู่...</div>
          </div>
        </div>
      )}
      {screen === 'intro' && <Intro config={{ ...config, appearance: config.appearance }} onStart={handleStart} />}
      {screen === 'invited' && (
        <Invited config={config} inviterName={inviterName} inviterPic={inviterPic} inviterArchLabel={inviterArchLabel} inviterArchEn={inviterArchEn} onStart={handleStartInvited} />
      )}
      {screen === 'question' && (
        <Question config={config} questionIndex={questionIndex} onAnswer={handleAnswer} onBack={() => { if (questionIndex > 0) setQuestionIndex(qi => qi - 1); else setScreen(pendingInviterId ? 'invited' : 'intro'); }} />
      )}
      {screen === 'share' && summaryData && (
        <Share config={config} shareUrl={summaryData.shareUrl} myArchetypeLabel={summaryData.myArchetypeLabel} pairsDone={summaryData.pairsDone} onGoSummary={handleShareDone} />
      )}
      {screen === 'summary' && summaryData && (
        <Summary
          config={config}
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
          onShare={handleGoShare}
          onViewPair={handleViewPair}
          onGoRewards={handleGoRewards}
          onCreateGroup={config.group?.enabled ? handleCreateGroup : undefined}
        />
      )}
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
        />
      )}
      {screen === 'error' && <ErrorScreen title={errorInfo.title} body={errorInfo.body} onRetry={errorInfo.retryFn} />}
      {screen === 'friend-gate' && <FriendGate onFriendAdded={handleFriendAdded} oaId={config.appearance?.oa_id} />}
    </div>
  );
}
