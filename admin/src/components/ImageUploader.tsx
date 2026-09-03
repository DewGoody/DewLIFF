import { useRef, useState } from 'react';

interface Props {
  value?: string | null;
  onChange: (url: string) => void;
  aspectRatio?: string;   // e.g. '1:1' | '2:1' | '16:9'
  hint?: string;
  maxHeight?: number;     // cap preview box height in px
}

export default function ImageUploader({ value, onChange, aspectRatio = '1:1', hint, maxHeight }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
      const data = await res.json() as { ok?: boolean; url?: string; error?: { message?: string } };
      if (!res.ok || !data.url) throw new Error(data.error?.message || 'Upload failed');
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Compute preview box aspect ratio
  const [aw, ah] = aspectRatio.split(':').map(Number);
  const paddingTop = maxHeight ? undefined : `${((ah / aw) * 100).toFixed(1)}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Drop zone / preview */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          width: '100%',
          paddingTop,
          height: maxHeight ? maxHeight : undefined,
          borderRadius: 8,
          border: '1.5px dashed ' + (error ? '#E63B2E' : '#D0D0CC'),
          background: value ? 'transparent' : '#F7F7F5',
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden',
        }}
      >
        {value && (
          <img
            src={value}
            alt="preview"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            background: value ? 'rgba(0,0,0,0.35)' : 'transparent',
            opacity: uploading ? 1 : value ? 0 : 1,
            transition: 'opacity .15s',
          }}
          className={value ? 'img-upload-overlay' : ''}
        >
          {uploading ? (
            <span style={{ fontSize: 13, color: value ? '#fff' : '#888' }}>กำลังอัปโหลด...</span>
          ) : (
            <>
              <span style={{ fontSize: 22 }}>↑</span>
              <span style={{ fontSize: 12, color: value ? '#fff' : '#888', textAlign: 'center' }}>
                {value ? 'คลิกเพื่อเปลี่ยนภาพ' : 'คลิกหรือลากไฟล์มาวาง'}
              </span>
              {hint && (
                <span style={{ fontSize: 11, color: value ? 'rgba(255,255,255,.7)' : '#BBB' }}>{hint}</span>
              )}
            </>
          )}
        </div>
      </div>

      {error && <span style={{ fontSize: 12, color: '#E63B2E' }}>{error}</span>}

      {/* Clear button */}
      {value && !uploading && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{ fontSize: 11, color: '#9B9B98', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
        >
          ลบภาพ
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      <style>{`.img-upload-overlay:hover { opacity: 1 !important; }`}</style>
    </div>
  );
}
