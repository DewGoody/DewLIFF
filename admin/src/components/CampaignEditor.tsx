import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCampaign, saveCampaign, setCampaignStatus, publishCampaign } from '../api';
import type { EditorState, EditorAxis, EditorQuestion, CampaignConfig } from '../types';
import { configToEditorState, editorStateToConfig } from '../editorUtils';
import { isSchemaV1, convertSchemaV1ToCampaignConfig } from '../importConverter';
import AxesSection from './sections/AxesSection';
import QuestionsSection from './sections/QuestionsSection';
import ResultsSection from './sections/ResultsSection';
import BrandSection from './sections/BrandSection';
import RulesSection from './sections/RulesSection';
import RewardsSection from './sections/RewardsSection';
import GroupSection from './sections/GroupSection';
import PlayPreview from './PlayPreview';
import JsonDrawer from './JsonDrawer';
import FlexCardSection from './sections/FlexCardSection';
import LiffSection from './sections/LiffSection';
import OGFramesSection from './sections/OGFramesSection';
import PublishSection from './sections/PublishSection';

const MODE_META: Record<string, { color: string; tint: string; line: string; name: string; desc: string; axisWord: string; notes: string[] }> = {
  solo:  { color: '#B07B12', tint: '#FDF7E8', line: '#EBDCB4', name: 'ผลเดี่ยว',   desc: 'คะแนนรวมชี้ว่าใครเป็นสายไหน แล้วโชว์ผลของสายนั้น — ไม่มีการจับคู่',         axisWord: 'สาย',  notes: ['ผลลัพธ์ = จำนวนสาย (1:1) ไม่ใช่คู่', 'ไม่ใช้หน้า Invited / Pair Result', 'แชร์ใช้ OG แบบ solo ต่อสาย'] },
  mbti:  { color: '#3A6EA5', tint: '#EFF5FC', line: '#CBDCEF', name: 'ผลตามชนิด',  desc: 'แต่ละแกนมี 2 ขั้ว รวมเป็นรหัสชนิด 2ⁿ — ต้องเขียนผลให้ครบทุกชนิด',           axisWord: 'แกน',  notes: ['ต้องกรอกขั้ว ⊕/⊖ ทุกแกน ไม่งั้นสร้างรหัสไม่ได้', 'จำนวนผล = 2 ยกกำลังจำนวนแกน (4 แกน = 16)', 'ไม่มีโหมดกลุ่มและไม่มีคำเชิญคู่'] },
  pair:  { color: '#E8354F', tint: '#FEF2F4', line: '#F4CFD5', name: 'ผลคู่',       desc: 'ผลมาจากคู่สายของสองคน เป็นเมทริกซ์สามเหลี่ยม n(n+1)/2 ช่อง',              axisWord: 'สาย',  notes: ['ผลลัพธ์ผูกกับคู่สาย ไม่ใช่สายเดี่ยว', 'ใช้หน้า Invited + Pair Result + คำเชิญ', 'fallback ใช้เมื่อคู่ไม่ตรงช่องไหนเลย'] },
  group: { color: '#1F7A6F', tint: '#ECF6F3', line: '#CBE5DE', name: 'ผลกลุ่ม',    desc: 'ใช้ผลคู่เป็นฐาน แล้วเพิ่มผลกลุ่มที่เปิดเมื่อสมาชิกครบ',                    axisWord: 'สาย',  notes: ['ต้องตั้งผลคู่ให้ครบก่อน ผลกลุ่มจึงคำนวณได้', 'เพิ่ม step กติกากลุ่ม (ขั้นต่ำ / ล็อคผล)', 'แต่ละสายมีน้ำหนักกลุ่มต่างกันได้'] },
};

const STEPS_BY_MODE: Record<string, [string, string, string][]> = {
  solo:  [['axes','01','สาย + ผลลัพธ์'],  ['q','02','คำถาม'],                             ['more','03','ตั้งค่าเพิ่มเติม']],
  mbti:  [['axes','01','แกน + ขั้ว'],     ['q','02','คำถาม'],['res','03','ผลลัพธ์ตามชนิด'],['more','04','ตั้งค่าเพิ่มเติม']],
  pair:  [['axes','01','สาย + ผลรายคน'], ['q','02','คำถาม'],['res','03','ผลลัพธ์คู่'],    ['more','04','ตั้งค่าเพิ่มเติม']],
  group: [['axes','01','สาย + ผลรายคน'], ['q','02','คำถาม'],['grp','03','กติกากลุ่ม'],   ['res','04','ผลคู่ + ผลกลุ่ม'],['more','05','ตั้งค่าเพิ่มเติม']],
};

const STEP_HINT: Record<string, Record<string, string>> = {
  axes: { solo:'1 สาย = 1 ผลลัพธ์ เขียนผลได้ในการ์ดเดียวกันเลย', mbti:'แกนคู่ตรงข้าม กรอกอักษรขั้วให้ครบ', pair:'สาย + ผลรายคน ที่โชว์ก่อนจับคู่', group:'สาย + ผลรายคน ที่โชว์ก่อนจับคู่' },
  q:    { solo:'คะแนนของตัวเลือกจะบวกเข้าสาย', mbti:'ตัวเลือกให้คะแนนไปขั้วใดขั้วหนึ่ง', pair:'คะแนนของตัวเลือกจะบวกเข้าสาย', group:'คะแนนของตัวเลือกจะบวกเข้าสาย' },
  res:  { mbti:'ต้องครบทุกรหัสชนิด', pair:'เลือกช่องในเมทริกซ์แล้วเขียนผล', group:'ผลคู่ + ผลกลุ่มตามเงื่อนไขสาย' },
  grp:  { group:'ตั้งก่อนเขียนผลกลุ่ม — วิธีตัดสินที่เลือกที่นี่กำหนดว่าใบผลกลุ่มต้องกรอกอะไร' },
  more: { solo:'แบรนด์ ข้อความ กติกา', mbti:'แบรนด์ ข้อความ กติกา', pair:'แบรนด์ ข้อความ กติกา', group:'แบรนด์ ข้อความ กติกา' },
};

function genMbtiCodes(axes: EditorAxis[]): string[] {
  let codes = [''];
  for (const ax of axes) {
    const p0 = (ax.poles?.[0] ?? ax.id[0] ?? 'A').toUpperCase();
    const p1 = (ax.poles?.[1] ?? ax.id[1] ?? 'B').toUpperCase();
    codes = codes.flatMap(prefix => [prefix + p0, prefix + p1]);
  }
  return codes.map(c => c.toLowerCase());
}

function validateState(state: EditorState): string[] {
  const issues: string[] = [];
  if (state.axes.length < 2) issues.push('ต้องมีสาย/แกนอย่างน้อย 2 รายการ');
  if (state.questions.length < 3) issues.push('คำถามน้อยกว่า 3 ข้อ');
  state.questions.forEach((q, i) => {
    if (!q.text.trim()) issues.push(`คำถามข้อ ${i+1} ยังไม่มีข้อความ`);
    if (!q.options.some(o => Object.values(o.scores).some(v => v !== 0))) issues.push(`คำถามข้อ ${i+1} ยังไม่มีคะแนน`);
  });
  if (state.mode === 'mbti') {
    if (!state.axes.every(a => a.poles?.[0] && a.poles?.[1])) issues.push('ยังกรอกขั้วไม่ครบ');
    else { const keys = genMbtiCodes(state.axes); const missing = keys.filter(k => !state.results[k]?.title); if (missing.length) issues.push(`ยังไม่มีผล ${missing.length} ชนิด`); }
  } else if (state.mode === 'solo') {
    const missing = state.axes.filter(a => !a.body);
    if (missing.length) issues.push(`ยังไม่มี Body ${missing.length} สาย`);
  } else {
    const n = state.axes.length; const expected = n*(n+1)/2;
    const filled = Object.values(state.results).filter(r => r?.title).length;
    if (filled < expected) issues.push(`ผลลัพธ์ยังไม่ครบ (${filled}/${expected})`);
  }
  if (state.mode === 'group') {
    if (!state.group?.archetypes?.length) issues.push('ยังไม่มีผลกลุ่ม');
    else if (!state.group.archetypes.some(a => a.fallback)) issues.push('ยังไม่มีผลกลุ่ม fallback');
  }
  return issues;
}

const DEFAULT_STATE: EditorState = {
  axes: [
    { id: 'energy', label: 'สายลุย', color: '#E63B2E' },
    { id: 'calm', label: 'สายนิ่ง', color: '#2563EB' },
    { id: 'detail', label: 'สายละเอียด', color: '#16A34A' },
  ],
  questions: [],
  results: {},
  fallback: { title: 'คู่หูสายกลาง', body: 'ไม่มีใครสุดทางไหน เลยปรับเข้าหากันได้ตลอด' },
  brand: { name: 'คู่หูสายไหน', primary: '#FF3D8B', surface: '#1B1430', on_surface: '#FFF3E4' },
  copy: {
    intro_title: 'คู่หูสายไหน',
    intro_body: 'ตอบ 5 ข้อ แล้วส่งให้เพื่อนร่วมงานตอบ',
    intro_cta: 'เริ่มตอบ',
    demo_cta: 'ลองกับคู่หูตัวอย่าง',
    question_counter: 'ข้อ {current} จาก {total}',
    invited_title: '{inviter} ชวนคุณมาตอบ',
    invited_cta: 'ตอบเลย',
    share_title: 'ส่งให้คู่หูตอบ',
    share_cta: 'เลือกเพื่อนแล้วส่ง',
    waiting_title: 'รอคู่หูตอบอยู่',
    waiting_close: 'ปิดหน้าต่าง',
    result_eyebrow: 'คุณสองคนคือ',
    result_share_cta: 'อวดผลให้คนอื่น',
    friend_gate_title: 'เพิ่มเพื่อนก่อนดูผล',
    expired_title: 'คำเชิญหมดอายุแล้ว',
    limit_title: 'วันนี้ครบโควตาแล้ว',
  },
  rules: { invite_ttl_hours: 48, require_friend: true, max_pairs_per_user_per_day: 5, allow_self_pair: false },
  messages: { invite_title: '{inviter} ชวนคุณตอบควิซคู่หู', invite_cta: 'ตอบควิซ', partner_done_title: 'คู่หูตอบแล้ว มาดูผลกัน' },
  mode: 'pair',
};

export default function CampaignEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const campaignId = id!;

  const [editorState, setEditorState] = useState<EditorState>(DEFAULT_STATE);
  const [campaignStatus, setCampaignStatusState] = useState<string>('draft');
  const [version, setVersion] = useState(1);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'flex' | 'liff' | 'frames' | 'publish'>('data');
  const [showPlay, setShowPlay] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [toast, setToast] = useState('');
  const [dataStep, setDataStep] = useState<string>('axes');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const savedStateRef = useRef<EditorState>(DEFAULT_STATE);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchCampaign(campaignId).then(({ campaign, config }) => {
      const state = configToEditorState(config as CampaignConfig);
      setEditorState(state);
      savedStateRef.current = state;
      setCampaignStatusState(campaign.status);
      setVersion(campaign.currentVersion);
      setDraftVersion(campaign.draftVersion ?? null);
      showToast('โหลด ' + campaignId + ' สำเร็จ — v' + campaign.currentVersion);
    }).catch((e) => {
      showToast('โหลดไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    }).finally(() => {
      setIsLoading(false);
    });
  }, [campaignId, showToast]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const config = editorStateToConfig(editorState, campaignId, version);
      const result = await saveCampaign(campaignId, config);
      setVersion(result.version);
      if (result.isDraft) setDraftVersion(result.version);
      savedStateRef.current = editorState;
      showToast('บันทึก draft แล้ว — v' + result.version + ' (ยังไม่ publish)');
    } catch (e) {
      if (e instanceof Error) {
        alert(e.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (status: 'draft' | 'live' | 'ended') => {
    try {
      await setCampaignStatus(campaignId, status);
      setCampaignStatusState(status);
      showToast('เปลี่ยนสถานะเป็น ' + status);
    } catch (e) {
      showToast('เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const handlePublish = async () => {
    try {
      const result = await publishCampaign(campaignId);
      setDraftVersion(null);
      setVersion(result.version);
      showToast('Publish สำเร็จ — v' + result.version + ' เป็น live แล้ว');
    } catch (e) {
      throw e; // let PublishSection handle the error display
    }
  };

  const handleImport = (cfg: CampaignConfig) => {
    setEditorState(configToEditorState(cfg));
    showToast('Import สำเร็จ');
  };

  const handleImportRaw = (data: unknown) => {
    if (isSchemaV1(data)) {
      const cfg = convertSchemaV1ToCampaignConfig(data, campaignId);
      setEditorState(configToEditorState(cfg));
      showToast('Import schema v1.0 สำเร็จ — ' + (cfg.axes?.length ?? 0) + ' archetypes, ' + (cfg.questions?.length ?? 0) + ' คำถาม, ' + (cfg.results?.length ?? 0) + ' ผลลัพธ์');
    } else {
      handleImport(data as CampaignConfig);
    }
  };

  // Reset step when mode changes
  useEffect(() => {
    const validSteps = (STEPS_BY_MODE[editorState.mode] ?? STEPS_BY_MODE.pair).map(([k]) => k);
    if (!validSteps.includes(dataStep)) setDataStep(validSteps[0]);
  }, [editorState.mode]); // eslint-disable-line

  const handleModeChange = (newMode: EditorState['mode']) => {
    setEditorState(prev => ({
      ...prev,
      mode: newMode,
      group: newMode === 'group'
        ? { result_mode: 'match' as const, min_members: 2, reward_members: 5, max_members: 50, overflow_mode: 'rolling' as const, batch_size: 5, result_locks_at: 0, archetypes: [], fallback_archetype: '', ...prev.group, enabled: true }
        : prev.group,
    }));
  };

  const currentConfig = editorStateToConfig(editorState, campaignId, version);

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: '#F4F4F2' }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#A0A5AA' }}>กำลังโหลด {campaignId}…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Editor Header */}
      <div className="app-header" style={{ flexShrink: 0 }}>
        <div className="left">
          <button className="hdr-btn" onClick={() => navigate('/')} title="กลับ">←</button>
          <span className="host-label">Krob · Host Console</span>
          <span className="title">Config Playground</span>
          <span className="badge mono">{campaignId}</span>
          <span style={{ display: 'flex', gap: 3, border: '1px solid #DEDEDA', borderRadius: 8, background: '#F4F4F2', padding: 3 }}>
            {(['solo', 'mbti', 'pair', 'group'] as const).map(m => {
              const on = editorState.mode === m;
              const mc = MODE_META[m].color;
              return (
                <button key={m} onClick={() => handleModeChange(m)} style={{
                  border: `1px solid ${on ? mc : 'transparent'}`,
                  background: on ? mc : 'transparent',
                  color: on ? '#FFFFFF' : '#8A8F94',
                  borderRadius: 6, padding: '5px 11px',
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700,
                  cursor: 'pointer',
                }}>{m}</button>
              );
            })}
          </span>
          <span className={`badge mono status-${campaignStatus}`}>{campaignStatus}</span>
        </div>
        <div className="right">
          <button className="hdr-btn" onClick={() => setShowPlay(v => !v)}>▶ ลองเล่น</button>
          <button className="hdr-btn" onClick={() => setShowJson(true)}>{'{}'} JSON</button>
          <button className="hdr-btn" onClick={() => {
            const blob = new Blob([JSON.stringify(currentConfig, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = campaignId + '-v' + version + '.json';
            a.click();
          }}>↓ Export</button>
          <button className="hdr-btn" onClick={() => importFileRef.current?.click()}>↑ Import</button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                try {
                  const data = JSON.parse(ev.target?.result as string) as unknown;
                  handleImportRaw(data);
                } catch (err) {
                  alert('Invalid JSON: ' + (err instanceof Error ? err.message : err));
                }
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
          <button className="hdr-btn" onClick={() => {
            if (window.confirm('คืนค่ากลับไปที่ version ที่บันทึกล่าสุด?')) {
              setEditorState(savedStateRef.current);
              showToast('คืนค่าแล้ว');
            }
          }}>↺ คืนค่า</button>
          {draftVersion != null && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 8px' }}>
              Draft v{draftVersion}
            </span>
          )}
          <button className="hdr-btn primary" disabled={isSaving} onClick={handleSave}>
            {isSaving ? 'กำลังบันทึก...' : 'Save Draft'}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display:'flex', gap:0, borderBottom:'1.5px solid #E5E5E3', background:'#fff', padding:'0 20px', flexShrink: 0 }}>
        {(['data', 'liff', 'flex', 'frames', 'publish'] as const).map(tab => {
          const labels: Record<string, string> = { data: 'ข้อมูล', liff: 'LIFF & Style', flex: 'Flex Cards', frames: 'OG Frames', publish: 'Publish' };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding:'10px 18px', border:'none', borderBottom: activeTab === tab ? '2.5px solid #111' : '2.5px solid transparent',
                background:'none', fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? '#111' : '#888', cursor:'pointer', marginBottom:-1.5,
              }}
            >{labels[tab]}</button>
          );
        })}
      </div>

      {/* Data Tab */}
      {activeTab === 'data' && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Left sidebar: steps + notes */}
          <div style={{ flex: 'none', width: 212, borderRight: '1px solid #DEDEDA', background: '#FFFFFF', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {/* Steps */}
            <div style={{ padding: '11px 12px 4px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: '.08em', color: '#A0A5AA' }}>ขั้นตอนของโหมดนี้</div>
            {(STEPS_BY_MODE[editorState.mode] ?? STEPS_BY_MODE.pair).map(([k, num, label]) => {
              const on = dataStep === k;
              const C = MODE_META[editorState.mode]?.color ?? '#E8354F';
              const isMbti = editorState.mode === 'mbti';
              const isSolo = editorState.mode === 'solo';
              const allKeys = isMbti
                ? (editorState.axes.every(a => a.poles?.[0] && a.poles?.[1]) ? genMbtiCodes(editorState.axes) : [])
                : isSolo
                  ? editorState.axes.map(a => a.id)
                  : editorState.axes.flatMap((r, i) => editorState.axes.slice(i).map(c => [r.id, c.id].sort().join('|')));
              const filled = isSolo
                ? editorState.axes.filter(a => !!a.body).length
                : allKeys.filter(key => editorState.results[key]?.title).length;
              const stepDone: Record<string, boolean> = {
                axes: isSolo ? editorState.axes.length >= 2 && filled >= editorState.axes.length : editorState.axes.length >= 2,
                q: editorState.questions.length >= 3,
                res: allKeys.length > 0 && filled >= allKeys.length,
                grp: (editorState.group?.archetypes?.length ?? 0) > 0,
                more: !!editorState.brand?.name,
              };
              return (
                <button key={k} onClick={() => setDataStep(k)} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', border: 'none', boxSizing: 'border-box',
                  borderLeft: `3px solid ${on ? C : 'transparent'}`,
                  background: on ? '#F4F4F2' : 'transparent',
                  padding: '9px 12px', cursor: 'pointer', textAlign: 'left',
                }}>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: on ? C : '#C9CCCE' }}>{num}</span>
                  <span style={{ flex: 1, fontSize: 12, fontFamily: "'Noto Sans Thai',sans-serif", fontWeight: on ? 700 : 500, color: on ? '#16181A' : '#5F6469' }}>{label}</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: stepDone[k] ? '#1F7A6F' : '#E0DED8' }} />
                </button>
              );
            })}

            <div style={{ height: 1, background: '#EFEFEC', margin: '10px 0' }} />
            <div style={{ padding: '0 12px 6px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: '.08em', color: '#A0A5AA' }}>โหมดนี้ต่างจากอื่นตรงไหน</div>
            {(MODE_META[editorState.mode]?.notes ?? []).map((note, i) => (
              <span key={i} style={{ display: 'block', padding: '0 13px 7px', fontSize: 11, lineHeight: 1.6, color: '#8A8F94', fontFamily: "'Noto Sans Thai',sans-serif" }}>· {note}</span>
            ))}
            <div style={{ height: 20 }} />
          </div>

          {/* Center: content */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F4F4F2', overflow: 'hidden' }}>
            {/* Mode banner */}
            {(() => {
              const meta = MODE_META[editorState.mode] ?? MODE_META.pair;
              const isMbti = editorState.mode === 'mbti';
              const isSolo = editorState.mode === 'solo';
              const allKeys = isMbti
                ? (editorState.axes.every(a => a.poles?.[0] && a.poles?.[1]) ? genMbtiCodes(editorState.axes) : [])
                : isSolo
                  ? editorState.axes.map(a => a.id)
                  : editorState.axes.flatMap((r, i) => editorState.axes.slice(i).map(c => [r.id, c.id].sort().join('|')));
              const filled = isSolo
                ? editorState.axes.filter(a => !!a.body).length
                : allKeys.filter(k => editorState.results[k]?.title).length;
              const stats = [
                { num: editorState.axes.length, label: meta.axisWord },
                { num: editorState.questions.length, label: 'คำถาม' },
                { num: isSolo ? `${filled}/${editorState.axes.length}` : `${filled}/${allKeys.length}`, label: isMbti ? 'ชนิด' : isSolo ? 'body/สาย' : 'ช่องผล' },
                ...(editorState.mode === 'group' ? [{ num: editorState.group?.archetypes?.length ?? 0, label: 'ผลกลุ่ม' }] : []),
              ];
              return (
                <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${meta.line}`, background: meta.tint }}>
                  <span style={{ flexShrink: 0, width: 4, height: 36, borderRadius: 3, background: meta.color }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const, padding: '2px 7px', borderRadius: 5, color: '#FFFFFF', background: meta.color }}>{editorState.mode}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#16181A' }}>{meta.name}</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#5F6469', lineHeight: 1.5 }}>{meta.desc}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                    {stats.map((p, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 1, minWidth: 52, border: `1px solid ${meta.line}`, borderRadius: 9, background: '#FFFFFF', padding: '5px 9px' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: '#16181A' }}>{p.num}</span>
                        <span style={{ fontSize: 9.5, color: '#8A8F94' }}>{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Step title bar */}
            {(() => {
              const steps = STEPS_BY_MODE[editorState.mode] ?? STEPS_BY_MODE.pair;
              const stepDef = steps.find(([k]) => k === dataStep);
              const hint = (STEP_HINT[dataStep] ?? {})[editorState.mode] ?? '';
              return (
                <div style={{ flex: 'none', padding: '11px 16px 9px', display: 'flex', alignItems: 'baseline', gap: 9, borderBottom: '1px solid #E7E7E3', background: '#FBFBF9' }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: '#16181A' }}>{stepDef?.[2] ?? ''}</span>
                  <span style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 11, color: '#8A8F94' }}>{hint}</span>
                </div>
              );
            })()}

            {/* Step content */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px 40px' }}>
              {dataStep === 'axes' && (
                <AxesSection
                  axes={editorState.axes}
                  questions={editorState.questions}
                  onChange={(axes: EditorAxis[], questions: EditorQuestion[]) => setEditorState(prev => ({ ...prev, axes, questions }))}
                  mode={editorState.mode}
                />
              )}
              {dataStep === 'q' && (
                <QuestionsSection
                  axes={editorState.axes}
                  questions={editorState.questions}
                  onChange={(questions: EditorQuestion[]) => setEditorState(prev => ({ ...prev, questions }))}
                  mode={editorState.mode}
                />
              )}
              {dataStep === 'grp' && editorState.mode === 'group' && (
                <GroupSection
                  view="settings"
                  group={{ ...(editorState.group ?? { enabled: true, result_mode: 'match' as const, min_members: 2, reward_members: 5, max_members: 50, overflow_mode: 'rolling' as const, batch_size: 5, result_locks_at: 0, archetypes: [], fallback_archetype: '' }), enabled: true }}
                  axes={editorState.axes}
                  onChange={group => setEditorState(prev => ({ ...prev, group }))}
                />
              )}
              {dataStep === 'res' && (
                <ResultsSection
                  axes={editorState.axes}
                  results={editorState.results}
                  fallback={editorState.fallback}
                  onChange={results => setEditorState(prev => ({ ...prev, results }))}
                  onFallbackChange={fallback => setEditorState(prev => ({ ...prev, fallback }))}
                  groupScoreMode={editorState.mode === 'group'}
                  showGroupExtras={editorState.mode === 'group'}
                  mode={editorState.mode}
                  fallbackCode={editorState.fallbackCode}
                  onFallbackCodeChange={code => setEditorState(prev => ({ ...prev, fallbackCode: code }))}
                  leftSlot={editorState.mode === 'group' ? (
                    <GroupSection
                      view="archetypes"
                      group={{ ...(editorState.group ?? { enabled: true, result_mode: 'match' as const, min_members: 2, reward_members: 5, max_members: 50, overflow_mode: 'rolling' as const, batch_size: 5, result_locks_at: 0, archetypes: [], fallback_archetype: '' }), enabled: true }}
                      axes={editorState.axes}
                      onChange={group => setEditorState(prev => ({ ...prev, group }))}
                    />
                  ) : undefined}
                />
              )}
              {dataStep === 'more' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                  {/* Group 1: แบรนด์ */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid #E7E7E3', borderRadius: 12, background: '#FFFFFF', padding: '15px 16px' }}>
                    <span style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 12.5, fontWeight: 700 }}>แบรนด์</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>ชื่อแคมเปญ</span>
                        <span style={{ marginLeft: 'auto', fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace", color: '#C9CCCE' }}>brand.name</span>
                      </div>
                      <input
                        value={editorState.brand?.name ?? ''}
                        onChange={e => setEditorState(prev => ({ ...prev, brand: { ...prev.brand, name: e.target.value } }))}
                        style={{ width: '100%', boxSizing: 'border-box' as const, border: '1px solid #DEDEDA', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: "'Noto Sans Thai',sans-serif", outline: 'none' }}
                      />
                    </div>
                  </div>

                  {/* Group 2: ข้อความหลัก */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid #E7E7E3', borderRadius: 12, background: '#FFFFFF', padding: '15px 16px' }}>
                    <span style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 12.5, fontWeight: 700 }}>ข้อความหลัก</span>
                    {[
                      { k: 'intro_title', label: 'หัวหน้า Intro', path: 'copy.intro_title' },
                      { k: 'intro_cta', label: 'ปุ่มเริ่ม', path: 'copy.intro_cta' },
                    ].map(f => (
                      <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>{f.label}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace", color: '#C9CCCE' }}>{f.path}</span>
                        </div>
                        <input
                          value={(editorState.copy as Record<string, string>)?.[f.k] ?? ''}
                          onChange={e => setEditorState(prev => ({ ...prev, copy: { ...prev.copy, [f.k]: e.target.value } }))}
                          style={{ width: '100%', boxSizing: 'border-box' as const, border: '1px solid #DEDEDA', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: "'Noto Sans Thai',sans-serif", outline: 'none' }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Group 3: ข้อความเชิญ (pair/group only) */}
                  {(editorState.mode === 'pair' || editorState.mode === 'group') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid #E7E7E3', borderRadius: 12, background: '#FFFFFF', padding: '15px 16px' }}>
                      <span style={{ fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 12.5, fontWeight: 700 }}>ข้อความเชิญ <span style={{ fontWeight: 400, fontSize: 11, color: '#8A8F94' }}>(เฉพาะโหมดที่มีคู่)</span></span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans Thai',sans-serif" }}>หัวข้อคำเชิญ</span>
                          <span style={{ marginLeft: 'auto', fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace", color: '#C9CCCE' }}>messages.invite_title</span>
                        </div>
                        <input
                          value={editorState.messages?.invite_title ?? ''}
                          onChange={e => setEditorState(prev => ({ ...prev, messages: { ...prev.messages, invite_title: e.target.value } }))}
                          style={{ width: '100%', boxSizing: 'border-box' as const, border: '1px solid #DEDEDA', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: "'Noto Sans Thai',sans-serif", outline: 'none' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Advanced settings accordion */}
                  <MoreAdvancedSection editorState={editorState} setEditorState={setEditorState} mode={editorState.mode} />
                </div>
              )}
            </div>
          </div>

          {/* Right rail: map + validation + JSON peek */}
          {(() => {
            const issues = validateState(editorState);
            const meta = MODE_META[editorState.mode] ?? MODE_META.pair;
            const isMbti = editorState.mode === 'mbti';
            const isSolo = editorState.mode === 'solo';
            const allKeys = isMbti
              ? (editorState.axes.every(a => a.poles?.[0] && a.poles?.[1]) ? genMbtiCodes(editorState.axes) : [])
              : editorState.axes.flatMap((r, i) => editorState.axes.slice(i).map(c => [r.id, c.id].sort().join('|')));
            const filled = isSolo
              ? editorState.axes.filter(a => !!a.body).length
              : allKeys.filter(k => editorState.results[k]?.title).length;
            const mapTitle = ({ solo: 'Body ต่อสาย', mbti: 'ชนิดทั้งหมด', pair: 'เมทริกซ์คู่', group: 'ผลคู่ + ผลกลุ่ม' } as Record<string, string>)[editorState.mode] ?? 'ผลลัพธ์';
            return (
              <div style={{ flex: 'none', width: 220, borderLeft: '1px solid #DEDEDA', background: '#FFFFFF', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
                {/* Map section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <span style={{ font: "600 10.5px 'JetBrains Mono',monospace", letterSpacing: '.08em', color: '#A0A5AA' }}>
                    {mapTitle}
                  </span>
                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ flex: 1, height: 8, borderRadius: 5, overflow: 'hidden', background: '#EDEDE9' }}>
                      <span style={{ display: 'block', height: '100%', width: `${allKeys.length ? Math.round(filled / allKeys.length * 100) : 0}%`, background: meta.color }} />
                    </span>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: '#5F6469' }}>{filled}/{allKeys.length}</span>
                  </div>
                  {/* Mini chips */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(isSolo ? editorState.axes.map(a => a.id) : allKeys).map(k => {
                      const has = isSolo
                        ? !!editorState.axes.find(a => a.id === k)?.body
                        : !!editorState.results[k]?.title;
                      const text = editorState.mode === 'mbti' ? k.toUpperCase()
                        : editorState.mode === 'solo' ? (editorState.axes.find(a => a.id === k)?.label ?? k).replace('สาย', '').substring(0, 6)
                        : k.split('|').map((p: string) => p.substring(0, 3)).join('·');
                      return (
                        <span key={k} style={{
                          fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                          padding: '3px 7px', borderRadius: 5,
                          border: `1px solid ${has ? meta.color : '#E7E7E3'}`,
                          background: has ? meta.color : '#FBFBF9',
                          color: has ? '#FFFFFF' : '#C0C4C8',
                        }}>{text}</span>
                      );
                    })}
                    {allKeys.length === 0 && (
                      <span style={{ fontSize: 11, color: '#C0C4C8', fontFamily: "'JetBrains Mono',monospace" }}>—</span>
                    )}
                  </div>
                </div>
                <div style={{ height: 1, background: '#EFEFEC' }} />

                {/* Validation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '.08em', color: '#A0A5AA' }}>สถานะความพร้อม</span>
                  {issues.length === 0 ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1F7A6F', background: '#ECF6F3', border: '1px solid #CBE5DE', borderRadius: 6, padding: '5px 9px' }}>✓ พร้อมใช้งาน</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#B02A3F', background: '#FDECEE', border: '1px solid #F4CFD5', borderRadius: 6, padding: '5px 9px' }}>✗ ขาด {issues.length} อย่าง</span>
                      {issues.map((iss, i) => (
                        <span key={i} style={{ display: 'block', fontSize: 11, lineHeight: 1.6, color: '#5F6469', paddingLeft: 8 }}>· {iss}</span>
                      ))}
                    </>
                  )}
                </div>

                {/* JSON peek */}
                <div style={{ height: 1, background: '#EFEFEC' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '.08em', color: '#A0A5AA' }}>โครง JSON ที่โหมดนี้ส่งออก</span>
                  {[
                    `"mode": "${editorState.mode}"`,
                    `"axes": [${editorState.axes.length}${editorState.mode === 'mbti' ? ' × poles' : editorState.mode === 'group' ? ' × weight' : ''}]`,
                    `"questions": [${editorState.questions.length}]`,
                    editorState.mode === 'solo' ? '"results": { axis_id → result }'
                      : editorState.mode === 'mbti' ? '"results": { type_code → result }'
                      : '"results": [ pair → result ]',
                    editorState.mode === 'mbti' ? `"fallback_result": "${(editorState.fallbackCode ?? '').toUpperCase() || '—'}"` : '"fallback_result": "default"',
                    editorState.mode === 'group' ? `"group": { min ${editorState.group?.min_members ?? 5} · ${editorState.group?.result_mode ?? 'match'} · ${editorState.group?.archetypes?.length ?? 0} archetypes }` : '"group": null',
                  ].map((line, i) => (
                    <span key={i} style={{
                      display: 'block', whiteSpace: 'pre-wrap',
                      fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500, lineHeight: 1.7,
                      color: '#5F6469', background: '#FBFBF9', border: '1px solid #EFEFEC',
                      borderRadius: 6, padding: '4px 7px',
                    }}>{line}</span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Flex Cards Tab */}
      {activeTab === 'flex' && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FlexCardSection
            mode={editorState.mode || 'pair'}
            copy={editorState.copy || {}}
            brand={editorState.brand}
            axes={editorState.axes.map(({ id, label, image_url, color }) => ({ id, label, image_url, color }))}
            results={editorState.results as Record<string, { title: string; body: string; image_url?: string }>}
            group={editorState.group}
            liffId={editorState.appearance?.liff_id}
            appearance={editorState.appearance}
            onChange={(copy) => setEditorState(prev => ({ ...prev, copy }))}
          />
        </div>
      )}

      {/* LIFF Tab */}
      {activeTab === 'liff' && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <LiffSection
            appearance={editorState.appearance || {}}
            brand={editorState.brand}
            copy={editorState.copy || {}}
            mode={editorState.mode || 'pair'}
            axes={editorState.axes.map(({ id, label, label_en, body, image_url }) => ({ id, label, label_en, body, image_url }))}
            questions={editorState.questions.map(q => ({ id: q.id, text: q.text, options: q.options.map(o => ({ id: o.id, label: o.label })) }))}
            results={editorState.results}
            group={editorState.mode === 'group' ? editorState.group : undefined}
            onChange={(appearance) => setEditorState(prev => ({ ...prev, appearance }))}
            onCopyChange={(copy) => setEditorState(prev => ({ ...prev, copy }))}
          />
        </div>
      )}

      {/* OG Frames Tab */}
      {activeTab === 'frames' && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <OGFramesSection
            mode={editorState.mode || 'pair'}
            axes={editorState.axes.map(({ id, label }) => ({ id, label }))}
            appearance={editorState.appearance || {}}
            onChange={(appearance) => setEditorState(prev => ({ ...prev, appearance }))}
          />
        </div>
      )}

      {/* Publish Tab */}
      {activeTab === 'publish' && (
        <PublishSection
          campaignId={campaignId}
          version={version}
          draftVersion={draftVersion}
          status={campaignStatus}
          editorState={editorState}
          isSaving={isSaving}
          onSave={handleSave}
          onPublish={handlePublish}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Play Preview Overlay */}
      {showPlay && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'#F7F1E3', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'1.5px solid #E5E5E3', background:'#fff' }}>
            <button className="hdr-btn" onClick={() => setShowPlay(false)}>✕ ปิด</button>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#888' }}>ลองเล่น — {campaignId}</span>
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <PlayPreview state={editorState} onChange={setEditorState} />
          </div>
        </div>
      )}

      {/* JSON Drawer */}
      <JsonDrawer
        open={showJson}
        config={currentConfig}
        campaignId={campaignId}
        version={version}
        onClose={() => setShowJson(false)}
        onImport={handleImport}
      />

      <div className={`toast${toast ? ' visible' : ''}`}>{toast}</div>
    </div>
  );
}

function MoreAdvancedSection({ editorState, setEditorState, mode }: { editorState: EditorState; setEditorState: React.Dispatch<React.SetStateAction<EditorState>>; mode: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid #E7E7E3', borderRadius: 12, background: '#FFFFFF', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: "'Noto Sans Thai',sans-serif", textAlign: 'left' as const }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16181A' }}>ตั้งค่าขั้นสูง</span>
        <span style={{ fontSize: 12, color: '#8A8F94' }}>แบรนด์สี · ฟอนต์ · กติกา · Rewards</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#A0A5AA' }}>{open ? '▴' : '▸'}</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #F0F0EE' }}>
          <BrandSection
            brand={editorState.brand}
            onChange={brand => setEditorState(prev => ({ ...prev, brand }))}
          />
          <RulesSection
            rules={editorState.rules}
            onChange={rules => setEditorState(prev => ({ ...prev, rules }))}
          />
          <RewardsSection
            rewards={editorState.rewards}
            onChange={rewards => setEditorState(prev => ({ ...prev, rewards }))}
          />
        </div>
      )}
    </div>
  );
}
