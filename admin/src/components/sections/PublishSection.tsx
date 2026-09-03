import { useState } from 'react';
import type { EditorState } from '../../types';

interface Props {
  campaignId: string;
  version: number;
  draftVersion: number | null;
  status: string;
  editorState: EditorState;
  isSaving: boolean;
  onSave: () => Promise<void>;
  onPublish: () => Promise<void>;
  onStatusChange: (status: 'draft' | 'live' | 'ended') => Promise<void>;
}

export default function PublishSection({ campaignId, version, draftVersion, status, editorState, isSaving, onSave, onPublish, onStatusChange }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [publishLog, setPublishLog] = useState<string[]>([]);

  const checks = [
    {
      key: 'liff_id',
      label: 'LIFF ID',
      ok: !!editorState.appearance?.liff_id,
      note: editorState.appearance?.liff_id || 'ยังไม่ได้ตั้งค่า — ไปที่ Tab LIFF',
    },
    {
      key: 'questions',
      label: 'คำถาม',
      ok: editorState.questions.length > 0,
      note: `${editorState.questions.length} ข้อ`,
    },
    {
      key: 'results',
      label: 'ผลลัพธ์',
      ok: Object.keys(editorState.results).length > 0,
      note: `${Object.keys(editorState.results).length} ผลลัพธ์`,
    },
    {
      key: 'brand',
      label: 'แบรนด์',
      ok: !!editorState.brand.name && !!editorState.brand.primary,
      note: editorState.brand.name || 'ยังไม่ได้ตั้งค่า',
    },
  ];

  const allPassed = checks.every(c => c.ok);
  const hasDraft = draftVersion != null;

  const handlePublishClick = async () => {
    if (publishing || isSaving) return;
    setPublishing(true);
    setPublishLog([]);
    try {
      if (!hasDraft) {
        setPublishLog(p => [...p, '📝 บันทึก draft ก่อน...']);
        await onSave();
        setPublishLog(p => [...p, '✓ บันทึก draft แล้ว']);
      }
      setPublishLog(p => [...p, '🚀 กำลัง publish...']);
      await onPublish();
      setPublishLog(p => [...p, '✓ Publish สำเร็จ — LIFF อัพเดตแล้ว!']);
    } catch (e) {
      setPublishLog(p => [...p, '✗ เกิดข้อผิดพลาด: ' + (e instanceof Error ? e.message : String(e))]);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', maxWidth: 640 }}>

      {/* Campaign info */}
      <div style={{ background: '#F7F7F5', border: '1.5px solid #E5E5E3', borderRadius: 12, padding: '16px 20px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: '#111' }}>{campaignId}</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, background: '#E5E5E3', padding: '2px 8px', borderRadius: 4, color: '#555' }}>mode: {editorState.mode}</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, background: '#E5E5E3', padding: '2px 8px', borderRadius: 4, color: '#555' }}>live v{version}</span>
          {hasDraft && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 4 }}>draft v{draftVersion}</span>
          )}
          <StatusBadge status={status} />
        </div>
        {editorState.brand.name && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>{editorState.brand.name}</div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: hasDraft ? '#854d0e' : '#166534', background: hasDraft ? '#fef9c3' : '#dcfce7', borderRadius: 6, padding: '6px 10px' }}>
          {hasDraft
            ? `มี draft v${draftVersion} รอ publish — LIFF ยังแสดง v${version} (published)`
            : `ไม่มี draft — ทุกอย่าง published แล้ว (v${version})`}
        </div>
      </div>

      {/* Readiness checklist */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: '.06em' }}>READINESS CHECK</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checks.map(c => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: `1.5px solid ${c.ok ? '#86efac' : '#fca5a5'}`, borderRadius: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{c.ok ? '✅' : '❌'}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: '#333', width: 100, flexShrink: 0 }}>{c.label}</span>
              <span style={{ fontSize: 12, color: c.ok ? '#555' : '#E8354F', fontFamily: "'JetBrains Mono',monospace", minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status control */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: '.06em' }}>STATUS</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['draft', 'live', 'ended'] as const).map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              disabled={status === s}
              style={{
                padding: '8px 18px', border: '1.5px solid',
                borderColor: status === s ? '#111' : '#E5E5E3',
                borderRadius: 8, background: status === s ? '#111' : '#fff',
                color: status === s ? '#fff' : '#555',
                fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
                fontWeight: status === s ? 700 : 400,
                cursor: status === s ? 'default' : 'pointer',
              }}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Publish button */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={handlePublishClick}
          disabled={publishing || isSaving || !allPassed}
          style={{
            width: '100%', padding: '14px 20px',
            background: allPassed ? '#111' : '#E5E5E3',
            color: allPassed ? '#fff' : '#aaa',
            border: 'none', borderRadius: 10,
            fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700,
            cursor: allPassed && !publishing ? 'pointer' : 'default',
            transition: 'background .15s',
          }}
        >
          {publishing ? '⏳ กำลัง publish...' : isSaving ? '⏳ กำลังบันทึก...' : !allPassed ? '⚠ แก้ไข Readiness ก่อน Publish' : hasDraft ? `🚀 Publish draft v${draftVersion} → live` : '🚀 Save & Publish'}
        </button>
        {!allPassed && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#888', textAlign: 'center' }}>
            ต้องผ่านทุก check ก่อนถึงจะ publish ได้
          </div>
        )}
      </div>

      {/* Publish log */}
      {publishLog.length > 0 && (
        <div style={{ background: '#111', borderRadius: 8, padding: '14px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8effa8', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {publishLog.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    live:   { bg: '#dcfce7', color: '#166534' },
    draft:  { bg: '#fef9c3', color: '#854d0e' },
    ended:  { bg: '#fee2e2', color: '#991b1b' },
  };
  const c = colors[status] || { bg: '#E5E5E3', color: '#555' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: 20, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700 }}>
      {status}
    </span>
  );
}
