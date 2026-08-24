import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCampaign, saveCampaign, setCampaignStatus } from '../api';
import type { EditorState, EditorAxis, EditorQuestion, CampaignConfig } from '../types';
import { configToEditorState, editorStateToConfig } from '../editorUtils';
import { isSchemaV1, convertSchemaV1ToCampaignConfig } from '../importConverter';
import Sidebar from './Sidebar';
import AxesSection from './sections/AxesSection';
import QuestionsSection from './sections/QuestionsSection';
import ResultsSection from './sections/ResultsSection';
import BrandSection from './sections/BrandSection';
import CopySection from './sections/CopySection';
import RulesSection from './sections/RulesSection';
import MessagesSection from './sections/MessagesSection';
import RewardsSection from './sections/RewardsSection';
import GroupSection from './sections/GroupSection';
import PlayPreview from './PlayPreview';
import JsonDrawer from './JsonDrawer';

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
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'setup' | 'play'>('setup');
  const [showJson, setShowJson] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => {
    fetchCampaign(campaignId).then(({ campaign, config }) => {
      setEditorState(configToEditorState(config as CampaignConfig));
      setCampaignStatusState(campaign.status);
      setVersion(campaign.currentVersion);
      showToast('โหลด ' + campaignId + ' สำเร็จ — v' + campaign.currentVersion);
    }).catch((e) => {
      showToast('โหลดไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    });
  }, [campaignId, showToast]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const config = editorStateToConfig(editorState, campaignId, version);
      const result = await saveCampaign(campaignId, config);
      setVersion(result.version);
      showToast('บันทึกแล้ว — version ' + result.version);
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

  const currentConfig = editorStateToConfig(editorState, campaignId, version);

  return (
    <>
      {/* Editor Header */}
      <div className="app-header">
        <div className="left">
          <button className="hdr-btn" onClick={() => navigate('/')} title="กลับ">←</button>
          <span className="host-label">Krob · Host Console</span>
          <span className="title">Config Playground</span>
          <span className="badge mono">{campaignId}</span>
          <span className="badge mono">{editorState.mode}</span>
          <span className={`badge mono status-${campaignStatus}`}>{campaignStatus}</span>
        </div>
        <div className="right">
          <button className="hdr-btn" onClick={() => navigate(`/campaign/${campaignId}/appearance`)}>
            🎨 หน้าตา
          </button>
          <div className="pill-group">
            <button
              className={`pill-btn${viewMode === 'setup' ? ' active' : ''}`}
              onClick={() => setViewMode('setup')}
            >
              ⚙ ตั้งค่า
            </button>
            <button
              className={`pill-btn${viewMode === 'play' ? ' active' : ''}`}
              onClick={() => setViewMode('play')}
            >
              ▶ ลองเล่น
            </button>
          </div>
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
          <button className="hdr-btn primary" disabled={isSaving} onClick={handleSave}>
            {isSaving ? 'กำลังบันทึก...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Setup View */}
      {viewMode === 'setup' && (
        <div className="editor-layout">
          <Sidebar
            state={editorState}
            campaignStatus={campaignStatus}
            isSaving={isSaving}
            onSave={handleSave}
            onStatusChange={handleStatusChange}
            onPlay={() => setViewMode('play')}
          />
          <div id="main">
            <AxesSection
              axes={editorState.axes}
              questions={editorState.questions}
              onChange={(axes: EditorAxis[], questions: EditorQuestion[]) =>
                setEditorState((prev) => ({ ...prev, axes, questions }))
              }
            />
            <QuestionsSection
              axes={editorState.axes}
              questions={editorState.questions}
              onChange={(questions: EditorQuestion[]) =>
                setEditorState((prev) => ({ ...prev, questions }))
              }
            />
            <ResultsSection
              axes={editorState.axes}
              results={editorState.results}
              fallback={editorState.fallback}
              onChange={(results) => setEditorState((prev) => ({ ...prev, results }))}
              onFallbackChange={(fallback) => setEditorState((prev) => ({ ...prev, fallback }))}
              groupScoreMode={editorState.group?.enabled && editorState.group?.result_mode === 'score'}
            />

            <GroupSection
              group={editorState.group}
              axes={editorState.axes}
              onChange={(group) => setEditorState((prev) => ({ ...prev, group }))}
            />

            {/* Advanced Settings Accordion */}
            <AdvancedAccordion editorState={editorState} setEditorState={setEditorState} />
          </div>
        </div>
      )}

      {/* Play View */}
      {viewMode === 'play' && <PlayPreview state={editorState} onChange={setEditorState} />}

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
    </>
  );
}

interface AdvancedAccordionProps {
  editorState: EditorState;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
}

function AdvancedAccordion({ editorState, setEditorState }: AdvancedAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="accordion">
      <button className={`acc-toggle${open ? ' open' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span>⚙ ตั้งค่าเพิ่มเติม</span>
        <span className="chevron">▾</span>
      </button>
      <div className={`acc-body${open ? ' open' : ''}`}>
        <BrandSection
          brand={editorState.brand}
          onChange={(brand) => setEditorState((prev) => ({ ...prev, brand }))}
        />
        <CopySection
          copy={editorState.copy}
          onChange={(copy) => setEditorState((prev) => ({ ...prev, copy }))}
        />
        <RulesSection
          rules={editorState.rules}
          onChange={(rules) => setEditorState((prev) => ({ ...prev, rules }))}
        />
        <MessagesSection
          messages={editorState.messages}
          onChange={(messages) => setEditorState((prev) => ({ ...prev, messages }))}
        />
        <RewardsSection
          rewards={editorState.rewards}
          onChange={(rewards) => setEditorState((prev) => ({ ...prev, rewards }))}
        />
      </div>
    </div>
  );
}
