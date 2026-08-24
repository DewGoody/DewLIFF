import { useState } from 'react';

interface Props {
  copy: Record<string, string>;
  onChange: (copy: Record<string, string>) => void;
}

interface FieldDef {
  path: string;
  effect: string;
}

interface GroupDef {
  label: string;
  rows: FieldDef[];
}

const COPY_GROUPS: GroupDef[] = [
  {
    label: 'Intro',
    rows: [
      { path: 'intro_title', effect: 'หัวข้อใหญ่หน้าแรก' },
      { path: 'intro_body', effect: 'คำอธิบายใต้หัวข้อ' },
      { path: 'intro_cta', effect: 'ปุ่มเริ่มเกม' },
      { path: 'demo_cta', effect: 'ปุ่มลองเล่นกับคู่หูตัวอย่าง' },
    ],
  },
  {
    label: 'Question',
    rows: [
      { path: 'question_counter', effect: 'ตัวนับบนหน้าคำถาม — ใช้ {current} / {total}' },
    ],
  },
  {
    label: 'Invite · Share · Waiting',
    rows: [
      { path: 'invited_title', effect: 'หน้าที่ B เห็นตอนเปิดลิงก์ — ใช้ {inviter}' },
      { path: 'invited_cta', effect: 'ปุ่มเริ่มตอบของ B' },
      { path: 'share_title', effect: 'หน้า Share หลัง A ตอบครบ' },
      { path: 'share_cta', effect: 'ปุ่มเปิด shareTargetPicker' },
      { path: 'waiting_title', effect: 'หน้ารอคู่หูตอบ' },
      { path: 'waiting_close', effect: 'ปุ่มปิดหน้าต่าง' },
    ],
  },
  {
    label: 'Result',
    rows: [
      { path: 'result_eyebrow', effect: 'บรรทัดเล็กเหนือชื่อผลลัพธ์' },
      { path: 'result_share_cta', effect: 'ปุ่มแชร์ผลลัพธ์' },
    ],
  },
  {
    label: 'Gate · Error',
    rows: [
      { path: 'friend_gate_title', effect: 'bottom sheet ที่กั้นก่อน add friend' },
      { path: 'expired_title', effect: 'HTTP 410 — token หมดอายุ' },
      { path: 'limit_title', effect: 'HTTP 409 — เกินโควตาต่อวัน' },
    ],
  },
  {
    label: 'Chat Trigger',
    rows: [
      { path: 'chat_trigger_text', effect: 'ข้อความที่ user เห็นใน chat ก่อน bot ตอบ Flex Card' },
    ],
  },
];

export default function CopySection({ copy, onChange }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    COPY_GROUPS.forEach((g) => { init[g.label] = true; });
    return init;
  });

  const set = (key: string, val: string) => onChange({ ...copy, [key]: val });

  const toggleBool = (key: string) => {
    const current = copy[key] === 'true' || copy[key] === true as unknown as string;
    set(key, current ? 'false' : 'true');
  };

  return (
    <div className="section" id="sec-copy">
      <div className="section-head">
        <span className="section-num">Copy</span>
        <span className="section-title">ข้อความทุกหน้าจอ</span>
      </div>

      {COPY_GROUPS.map((group) => {
        const isOpen = openGroups[group.label] !== false;
        return (
          <div className="adv-section" key={group.label}>
            <div
              className={`adv-header${isOpen ? ' open' : ''}`}
              onClick={() => setOpenGroups((prev) => ({ ...prev, [group.label]: !isOpen }))}
            >
              <span className="atitle">{group.label}</span>
              <span className="achevron">▾</span>
            </div>
            <div className={`adv-body${isOpen ? ' open' : ''}`}>
              {group.rows.map((row) => (
                <div className="adv-row" key={row.path}>
                  <div className="akey">{row.path}</div>
                  <div>
                    {row.path === 'chat_trigger_enabled' ? (
                      <button
                        className={`toggle-pill ${(copy[row.path] === 'true' || copy[row.path] === true as unknown as string) ? 'on' : 'off'}`}
                        onClick={() => toggleBool(row.path)}
                      >
                        {(copy[row.path] === 'true' || copy[row.path] === true as unknown as string) ? 'ON' : 'OFF'}
                      </button>
                    ) : (
                      <input
                        type="text"
                        value={copy[row.path] || ''}
                        onChange={(e) => set(row.path, e.target.value)}
                      />
                    )}
                  </div>
                  <div className="aeffect">{row.effect}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
