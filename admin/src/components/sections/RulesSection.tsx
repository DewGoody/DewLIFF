import type { Rules } from '../../types';

interface Props {
  rules: Rules;
  onChange: (rules: Rules) => void;
}

export default function RulesSection({ rules, onChange }: Props) {
  const set = <K extends keyof Rules>(key: K, val: Rules[K]) => onChange({ ...rules, [key]: val });

  return (
    <div className="section" id="sec-rules">
      <div className="section-head">
        <span className="section-num">Rules</span>
        <span className="section-title">กฎ · TTL · โควตา · Friend Gate</span>
      </div>

      <div className="adv-section">
        <div className="adv-group-label">backend บังคับใช้ — LIFF ไม่เห็นค่าเหล่านี้</div>

        <div className="adv-row">
          <div className="akey">invite_ttl_hours</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                value={rules.invite_ttl_hours}
                style={{ width: 80 }}
                onChange={(e) => set('invite_ttl_hours', Number(e.target.value))}
              />
              <span className="unit-label">ชม.</span>
            </div>
          </div>
          <div className="aeffect">เลยเวลานี้ B เปิดลิงก์จะเจอหน้า "คำเชิญหมดอายุ"</div>
        </div>

        <div className="adv-row">
          <div className="akey">max_pairs_per_user_per_day</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                value={rules.max_pairs_per_user_per_day}
                style={{ width: 80 }}
                onChange={(e) => set('max_pairs_per_user_per_day', Number(e.target.value))}
              />
              <span className="unit-label">คู่/วัน</span>
            </div>
          </div>
          <div className="aeffect">เกินโควตาจะเจอหน้า "วันนี้ครบโควตาแล้ว"</div>
        </div>

        <div className="adv-row">
          <div className="akey">require_friend</div>
          <div>
            <button
              className={`toggle-pill ${rules.require_friend ? 'on' : 'off'}`}
              onClick={() => set('require_friend', !rules.require_friend)}
            >
              {rules.require_friend ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="aeffect">เปิด = ต้อง add friend ก่อนดูผล</div>
        </div>

        <div className="adv-row">
          <div className="akey">allow_self_pair</div>
          <div>
            <button
              className={`toggle-pill ${rules.allow_self_pair ? 'on' : 'off'}`}
              onClick={() => set('allow_self_pair', !rules.allow_self_pair)}
            >
              {rules.allow_self_pair ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="aeffect">ปิด = ส่งลิงก์ให้ตัวเองแล้วเจอหน้า "จับคู่กับตัวเองไม่ได้"</div>
        </div>
      </div>
    </div>
  );
}
