import { useRef } from 'react';
import type { CampaignConfig } from '../types';

interface Props {
  open: boolean;
  config: CampaignConfig;
  campaignId: string;
  version: number;
  onClose: () => void;
  onImport: (config: CampaignConfig) => void;
}

export default function JsonDrawer({ open, config, campaignId, version, onClose, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = campaignId + '-v' + version + '.json';
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as CampaignConfig;
        onImport(data);
        onClose();
      } catch (err) {
        alert('Invalid JSON: ' + (err instanceof Error ? err.message : err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <div className={`json-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`json-drawer${open ? ' open' : ''}`}>
        <div className="drawer-header">
          <span className="dtitle">campaign.json</span>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <pre>{JSON.stringify(config, null, 2)}</pre>
        </div>
        <div className="drawer-actions">
          <button className="hdr-btn" onClick={exportJSON}>↓ Export JSON</button>
          <button className="hdr-btn" onClick={() => fileRef.current?.click()}>↑ Import JSON</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </div>
      </div>
    </>
  );
}
