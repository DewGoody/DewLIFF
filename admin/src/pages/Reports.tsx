import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API = '/api/reports';
const ADMIN_KEY = (window as any).__ADMIN_REPORT_KEY__ || 'dev-admin';
function authHeader() { return { Authorization: `Bearer ${ADMIN_KEY}` }; }

// ── Types ─────────────────────────────────────────────────────────────

interface OaSummary {
  generatedAt: string;
  campaignCount: number;
  totals: { opens: number; starts: number; completions: number; pairs_done: number; shares: number; participants: number; completed: number };
  campaigns: Array<{
    campaignId: string; type: string; status: string;
    funnel: { opens: number; starts: number; completions: number; pairs_done: number; shares: number };
    participants: number; completed: number; completionRate: number;
  }>;
}

interface CampaignReport {
  campaignId: string;
  generatedAt: string;
  campaign: { status: string; startsAt: string | null; endsAt: string | null };
  funnel: { opens: number; starts: number; completions: number; pairs_done: number; shares: number; follows: number };
  participants: { total: number; completed: number; dropped: number; completionRate: number };
  topResults: Array<{ resultId: string; count: number; pct: number }>;
  pairs?: { total: number; completed: number; waiting: number; completionRate: number };
  groups?: { total: number; completed: number; active: number; completionRate: number };
  sourceBreakdown: Record<string, number>;
  viral: { totalInvitesSent: number; totalInvitesConverted: number; viralCoefficient: number; inviteConversionRate: number; maxReferralDepth: number };
  dailyTrend: Array<{ date: string; opens: number; starts: number; completions: number; pairs_done: number; new_participants: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────

function pct(n: number, d: number) { return d > 0 ? Math.round(n / d * 100) : 0; }

const STATUS_TH: Record<string, { label: string; color: string }> = {
  live:  { label: 'กำลังใช้งาน', color: '#16A34A' },
  draft: { label: 'แบบร่าง',     color: '#9B9B98' },
  ended: { label: 'สิ้นสุดแล้ว', color: '#E63B2E' },
};

const SOURCE_TH: Record<string, string> = {
  organic: 'ค้นพบเอง',
  invite:  'เพื่อนชวน',
  richmenu: 'Rich Menu',
  push:    'Push Message',
};

// ── UI Components ─────────────────────────────────────────────────────

function KPI({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#FAFAF8', border: '1px solid #EDEDEB', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || '#1C1A17', letterSpacing: '-0.02em', fontFamily: "'JetBrains Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function FunnelStep({ step, label, value, max, pctOfPrev, color }: {
  step: number; label: string; value: number; max: number; pctOfPrev?: string; color: string;
}) {
  const w = max > 0 ? Math.max(4, Math.round(value / max * 100)) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#bbb', width: 16 }}>{step}</span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color }}>{value.toLocaleString()}</span>
        {pctOfPrev && <span style={{ fontSize: 11, color: '#aaa' }}>({pctOfPrev})</span>}
      </div>
      <div style={{ height: 8, background: '#F0EFED', borderRadius: 4, overflow: 'hidden', marginLeft: 24 }}>
        <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E3', borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, color: '#1C1A17' }}>{title}</div>
      {children}
    </div>
  );
}

// ── OA Summary ────────────────────────────────────────────────────────

function OaSummaryView() {
  const navigate = useNavigate();
  const [data, setData] = useState<OaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${API}/oa/summary`, { headers: authHeader() })
      .then(r => r.json()).then(setData)
      .catch(e => setErr(String(e))).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>กำลังโหลดข้อมูล...</div>;
  if (err || !data) return <div style={{ padding: 40, color: '#e63' }}>โหลดไม่ได้: {err}</div>;

  const t = data.totals;
  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: '#aaa', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '.08em', marginBottom: 6 }}>ภาพรวมทั้งหมด</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>รายงานรวม OA</h1>
        <div style={{ fontSize: 12, color: '#bbb', marginTop: 6 }}>อัปเดต: {new Date(data.generatedAt).toLocaleString('th-TH')}</div>
      </div>

      {/* OA KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
        <KPI icon="📋" label="แคมเปญทั้งหมด" value={data.campaignCount} />
        <KPI icon="👀" label="ครั้งที่เปิดดู" value={t.opens.toLocaleString()} sub="นับทุกครั้งที่เปิด" />
        <KPI icon="✏️" label="คนที่เริ่มเล่น" value={t.starts.toLocaleString()} sub={`${pct(t.starts, t.opens)}% ของคนที่เปิด`} />
        <KPI icon="✅" label="คนที่เล่นจบ" value={t.completions.toLocaleString()} sub={`${pct(t.completions, t.starts)}% ของคนที่เริ่ม`} color="#16A34A" />
        <KPI icon="💑" label="คู่ที่จับคู่สำเร็จ" value={t.pairs_done.toLocaleString()} />
        <KPI icon="📤" label="แชร์ทั้งหมด" value={t.shares.toLocaleString()} />
      </div>

      {/* Campaign table */}
      <Section title="แคมเปญทั้งหมด — คลิกเพื่อดูรายละเอียด">
        {data.campaigns.length === 0
          ? <div style={{ color: '#aaa', textAlign: 'center', padding: 24 }}>ยังไม่มีแคมเปญที่เปิดใช้งาน</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.campaigns.map(c => {
                const st = STATUS_TH[c.status] || { label: c.status, color: '#aaa' };
                return (
                  <div
                    key={c.campaignId}
                    onClick={() => navigate(`/reports/${c.campaignId}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderRadius: 10, background: '#FAFAF8', border: '1px solid #EDEDEB', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F3F3F0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#FAFAF8')}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.campaignId}</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{c.funnel.opens.toLocaleString()} ครั้งที่เปิด · {c.funnel.completions.toLocaleString()} คนเล่นจบ</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: c.completionRate > 50 ? '#16A34A' : '#1C1A17' }}>{c.completionRate}%</div>
                        <div style={{ fontSize: 10, color: '#aaa' }}>เล่นจบ</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.color + '15', borderRadius: 6, padding: '3px 8px' }}>{st.label}</span>
                      <span style={{ color: '#ccc' }}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </Section>
    </div>
  );
}

// ── Per-campaign report ───────────────────────────────────────────────

function CampaignReportView({ campaignId }: { campaignId: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<CampaignReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/${campaignId}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setErr(String(e))).finally(() => setLoading(false));
  }, [campaignId]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysis('');
    try {
      const r = await fetch(`${API}/${campaignId}/analyze`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setAnalysis(d.analysis);
    } catch (e) {
      setAnalysis(`เกิดข้อผิดพลาด: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const r = await fetch(`${API}/${campaignId}/export`, { headers: authHeader() });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${campaignId}-รายงาน.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>กำลังโหลดข้อมูล...</div>;
  if (err || !data) return <div style={{ padding: 40, color: '#e63' }}>โหลดไม่ได้: {err}</div>;

  const { funnel, participants, viral, topResults, sourceBreakdown, dailyTrend, campaign } = data;
  const maxFunnel = Math.max(funnel.opens, 1);
  const st = STATUS_TH[campaign.status] || { label: campaign.status, color: '#aaa' };

  // Story headline
  const headline = participants.total === 0
    ? 'แคมเปญนี้ยังไม่มีผู้เล่น'
    : participants.completionRate >= 70
      ? `ยอดเยี่ยม! ${participants.completed.toLocaleString()} คนเล่นจบ คิดเป็น ${participants.completionRate}%`
      : participants.completionRate >= 40
        ? `${participants.completed.toLocaleString()} คนเล่นจบจาก ${participants.total.toLocaleString()} คนที่เข้าร่วม`
        : `มีคนเข้าร่วม ${participants.total.toLocaleString()} คน แต่เล่นจบ ${participants.completionRate}% — ควรปรับปรุง`;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => navigate('/reports')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 13, padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← ภาพรวม OA
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{campaignId}</h1>
              <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.color + '15', borderRadius: 6, padding: '3px 10px' }}>{st.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#555', fontWeight: 500 }}>{headline}</p>
            <div style={{ fontSize: 11, color: '#ccc', marginTop: 4 }}>อัปเดต: {new Date(data.generatedAt).toLocaleString('th-TH')}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #E5E5E3', background: analyzing ? '#F7F7F5' : '#fff', color: '#1C1A17', fontSize: 13, fontWeight: 600, cursor: analyzing ? 'not-allowed' : 'pointer' }}
            >
              {analyzing ? '⏳ กำลังวิเคราะห์...' : '✨ วิเคราะห์ด้วย AI'}
            </button>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              style={{ padding: '9px 16px', borderRadius: 9, border: 0, background: '#1C1A17', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {exportLoading ? 'กำลังดาวน์โหลด...' : '⬇ ดาวน์โหลด CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Analysis result */}
      {analysis && (
        <div style={{ background: 'linear-gradient(135deg, #F0F4FF 0%, #FFF5F0 100%)', border: '1px solid #D4D8F0', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✨</span> การวิเคราะห์โดย AI
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: '#333', whiteSpace: 'pre-wrap' }}>{analysis}</div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI icon="👥" label="ผู้เล่นไม่ซ้ำ" value={participants.total.toLocaleString()} sub="นับแต่ละคนครั้งเดียว" />
        <KPI icon="✅" label="เล่นจบ" value={participants.completed.toLocaleString()} sub={`${participants.completionRate}% ของผู้เล่น`} color="#16A34A" />
        <KPI icon="💑" label="จับคู่สำเร็จ" value={funnel.pairs_done.toLocaleString()} sub="คู่ที่ดูผลร่วมกัน" />
        <KPI icon="📤" label="แชร์" value={funnel.shares.toLocaleString()} sub="ครั้งที่กดแชร์" />
        <KPI icon="❤️" label="ติดตาม OA" value={funnel.follows.toLocaleString()} sub="คนที่กด follow" color="#E8354F" />
      </div>

      {/* Pairs + Groups breakdown */}
      {(data.pairs || data.groups) && (
        <div style={{ display: 'grid', gridTemplateColumns: data.pairs && data.groups ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
          {data.pairs && data.pairs.total > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E5E3', borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>คู่ที่สร้าง (Pairs)</div>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>ไม่นับคู่ที่หมดอายุ</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 80, background: '#F8F8F7', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>สร้างทั้งหมด</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 700 }}>{data.pairs.total.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 80, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#16A34A', marginBottom: 4 }}>จับคู่สำเร็จ ✓</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 700, color: '#16A34A' }}>{data.pairs.completed.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 80, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#B45309', marginBottom: 4 }}>รอคู่อีกฝั่ง</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 700, color: '#B45309' }}>{data.pairs.waiting.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ height: 8, background: '#F0EFED', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${data.pairs.completionRate}%`, background: '#16A34A', borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 6, fontWeight: 600 }}>{data.pairs.completionRate}% จับคู่สำเร็จ</div>
            </div>
          )}
          {data.groups && data.groups.total > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E5E3', borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>ทีม (Groups)</div>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>กลุ่มที่สร้างทั้งหมด</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 80, background: '#F8F8F7', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>ทีมทั้งหมด</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 700 }}>{data.groups.total.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 80, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#16A34A', marginBottom: 4 }}>ปลดล็อกผลแล้ว ✓</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 700, color: '#16A34A' }}>{data.groups.completed.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 80, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#4338CA', marginBottom: 4 }}>ยังรวบรวมสมาชิก</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 700, color: '#4338CA' }}>{data.groups.active.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ height: 8, background: '#F0EFED', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${data.groups.completionRate}%`, background: '#16A34A', borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 6, fontWeight: 600 }}>{data.groups.completionRate}% ปลดล็อกผลสำเร็จ</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 0 }}>
        {/* Funnel */}
        <Section title="เส้นทางของผู้เล่น">
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>จากคนที่เปิดดู → จนถึงจับคู่สำเร็จ</div>
          <FunnelStep step={1} label="เปิดดูแคมเปญ" value={funnel.opens} max={maxFunnel} color="#6366F1" />
          <FunnelStep step={2} label="เริ่มตอบคำถาม" value={funnel.starts} max={maxFunnel}
            pctOfPrev={`${pct(funnel.starts, funnel.opens)}%`} color="#8B5CF6" />
          <FunnelStep step={3} label="ตอบครบทุกข้อ" value={funnel.completions} max={maxFunnel}
            pctOfPrev={`${pct(funnel.completions, funnel.starts)}%`} color="#EC4899" />
          <FunnelStep step={4} label="จับคู่กับเพื่อน" value={funnel.pairs_done} max={maxFunnel}
            pctOfPrev={`${pct(funnel.pairs_done, funnel.completions)}%`} color="#E8354F" />
          {funnel.shares > 0 && (
            <FunnelStep step={5} label="แชร์ผลลัพธ์" value={funnel.shares} max={maxFunnel}
              pctOfPrev={`${pct(funnel.shares, funnel.completions)}%`} color="#F59E0B" />
          )}
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#F8F8F7', borderRadius: 8, fontSize: 12, color: '#666' }}>
            💡 "เปิดดู" นับทุกครั้งที่เปิด — คนเดิมอาจเปิดหลายครั้งได้
          </div>
        </Section>

        {/* Viral */}
        <Section title="การบอกต่อ">
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>ผู้เล่นชวนเพื่อนมาเล่นมากแค่ไหน</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8F8F7', borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>ส่งคำเชิญทั้งหมด</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 700 }}>{viral.totalInvitesSent.toLocaleString()}</div>
              </div>
              <span style={{ fontSize: 28 }}>✉️</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>เพื่อนที่มาเล่นจริง</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 700, color: '#16A34A' }}>{viral.totalInvitesConverted.toLocaleString()}</div>
              </div>
              <span style={{ fontSize: 28 }}>🎯</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: '10px 14px', background: '#F8F8F7', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>ค่าบอกต่อเฉลี่ย</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700 }}>{viral.viralCoefficient}</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>คนต่อผู้เล่ว 1 คน</div>
              </div>
              <div style={{ padding: '10px 14px', background: '#F8F8F7', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>สาย referral ลึกสุด</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700 }}>{viral.maxReferralDepth}</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>ระดับ</div>
              </div>
            </div>
            {viral.viralCoefficient >= 1 && (
              <div style={{ padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, fontSize: 12, color: '#92400E' }}>
                🔥 ค่าบอกต่อ &ge; 1 คือแคมเปญกำลัง "ระเบิด" — ผู้เล่นชวนเพื่อนได้มากกว่า 1 คนต่อคน
              </div>
            )}
          </div>
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        {/* Top results */}
        <Section title="ผลลัพธ์ยอดนิยม">
          {topResults.length === 0
            ? <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 20 }}>ยังไม่มีผู้เล่นได้รับผลลัพธ์</div>
            : topResults.map((r, i) => (
              <div key={r.resultId} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#bbb', width: 16, flexShrink: 0 }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{r.resultId}</span>
                    <span style={{ fontSize: 12, color: '#888' }}>{r.count} คน ({r.pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#F0EFED', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${r.pct}%`, background: i === 0 ? '#E8354F' : '#D4A0A8', borderRadius: 3 }} />
                  </div>
                </div>
              </div>
            ))}
        </Section>

        {/* Source */}
        <Section title="ผู้เล่นมาจากไหน">
          {Object.keys(sourceBreakdown).length === 0
            ? <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 20 }}>ยังไม่มีข้อมูล</div>
            : (() => {
              const total = Object.values(sourceBreakdown).reduce((s, v) => s + v, 0);
              const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6'];
              return Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([src, cnt], i) => (
                <div key={src} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{SOURCE_TH[src] || src}</span>
                    <span style={{ fontSize: 12, color: '#888' }}>{cnt} คน ({pct(cnt, total)}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#F0EFED', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct(cnt, total)}%`, background: colors[i % colors.length], borderRadius: 3 }} />
                  </div>
                </div>
              ));
            })()}
          <div style={{ marginTop: 8, padding: '10px 14px', background: '#F8F8F7', borderRadius: 8, fontSize: 12, color: '#666' }}>
            💡 "เพื่อนชวน" คือคนที่มาจากลิงก์ที่ผู้เล่นแชร์ออกไป
          </div>
        </Section>
      </div>

      {/* Daily trend */}
      {dailyTrend.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Section title={`แนวโน้มรายวัน (${dailyTrend.length} วันล่าสุด)`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #F0EFED', color: '#888' }}>
                    <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600 }}>วันที่</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 600 }}>เปิดดู</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 600 }}>เริ่มเล่น</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 600 }}>เล่นจบ</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 600 }}>จับคู่</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 600 }}>คนใหม่</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyTrend.map((d, i) => (
                    <tr key={d.date} style={{ borderBottom: '1px solid #F7F7F5', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace" }}>{d.opens}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace" }}>{d.starts}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#16A34A', fontWeight: d.completions > 0 ? 700 : 400 }}>{d.completions}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace" }}>{d.pairs_done}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#6366F1' }}>{d.new_participants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────

export default function Reports() {
  const { campaignId } = useParams<{ campaignId?: string }>();
  return campaignId ? <CampaignReportView campaignId={campaignId} /> : <OaSummaryView />;
}
