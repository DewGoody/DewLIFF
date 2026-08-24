interface Messages {
  invite_title: string;
  invite_cta: string;
  partner_done_title: string;
}

interface Props {
  messages: Messages;
  onChange: (messages: Messages) => void;
}

export default function MessagesSection({ messages, onChange }: Props) {
  const set = (key: keyof Messages, val: string) => onChange({ ...messages, [key]: val });

  return (
    <div className="section" id="sec-messages">
      <div className="section-head">
        <span className="section-num">Messages</span>
        <span className="section-title">ข้อความใน LINE chat</span>
      </div>

      <div className="adv-section">
        <div className="adv-group-label">invite — Flex ที่ A ส่งหา B</div>
        <div className="adv-row">
          <div className="akey">invite_title</div>
          <div>
            <input
              type="text"
              value={messages.invite_title}
              onChange={(e) => set('invite_title', e.target.value)}
            />
          </div>
          <div className="aeffect">หัวการ์ดใน chat ของ B</div>
        </div>
        <div className="adv-row">
          <div className="akey">invite_cta</div>
          <div>
            <input
              type="text"
              value={messages.invite_cta}
              onChange={(e) => set('invite_cta', e.target.value)}
            />
          </div>
          <div className="aeffect">ปุ่มบนการ์ด → เปิด LIFF พร้อม token</div>
        </div>
      </div>

      <div className="adv-section" style={{ marginTop: 16 }}>
        <div className="adv-group-label">partner_done — push กลับหา A</div>
        <div className="adv-row">
          <div className="akey">partner_done_title</div>
          <div>
            <input
              type="text"
              value={messages.partner_done_title}
              onChange={(e) => set('partner_done_title', e.target.value)}
            />
          </div>
          <div className="aeffect">กลไกดึงคนกลับมาดูผล — ข้อความนี้ต้องน่ากด</div>
        </div>
      </div>
    </div>
  );
}
