import { useState } from 'react';

interface Props {
  onFriendAdded: () => void;
  oaId?: string;
  returnUrl?: string;
  fanCardUrls?: string[];
}

const STEPS = [
  { n: 1, text: <>เข้าร่วมกิจกรรม ตอบ 6 ข้อ จับคู่กับเพื่อน และลุ้น<b>ของรางวัลในแคมเปญ</b></> },
  { n: 2, text: <>หลังจากนั้น OA จะ<b>ส่งผลและแจ้งเตือน</b> ให้เอง เมื่อเพื่อนตอบหรือทีมครบ</> },
  { n: 3, text: <><b>ข่าวกิจกรรมและบริการอื่น</b> ของ Codera Solutions</> },
];

export default function FriendGate({ onFriendAdded: _, oaId, returnUrl, fanCardUrls = [] }: Props) {
  const FAN_CARDS = fanCardUrls.slice(0, 3);
  const OA_ADD_URL = `https://line.me/R/ti/p/%40${(oaId || '@747xtauy').replace('@', '')}`;
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    setChecking(true);
    setError('');
    try {
      const { friendFlag } = await liff.getFriendship();
      if (friendFlag) {
        window.location.replace(returnUrl || window.location.href);
      } else {
        setError('ยังไม่เจอการเพิ่มเพื่อน ลองกดเพิ่มเพื่อนก่อนนะ');
      }
    } catch {
      setError('ตรวจสอบไม่ได้ในตอนนี้ ลองอีกครั้ง');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#F7F1E3',
      overflowY: 'auto',
      position: 'relative',
    }}>
      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 20% 15%, rgba(245,225,75,.35) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(232,53,79,.15) 0%, transparent 45%)',
      }} />

      {/* 3-card fan hero */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 180,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 8,
      }}>
        {/* Left card */}
        <div style={{
          position: 'absolute',
          width: 110,
          height: 150,
          transform: 'rotate(-12deg) translateX(-72px) translateY(8px)',
          transformOrigin: 'bottom center',
          zIndex: 1,
        }}>
          <img src={FAN_CARDS[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,.18))' }} />
        </div>
        {/* Center card */}
        <div style={{
          position: 'relative',
          width: 130,
          height: 170,
          zIndex: 2,
        }}>
          <img src={FAN_CARDS[1]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(2px 6px 10px rgba(0,0,0,.22))' }} />
        </div>
        {/* Right card */}
        <div style={{
          position: 'absolute',
          width: 110,
          height: 150,
          transform: 'rotate(12deg) translateX(72px) translateY(8px)',
          transformOrigin: 'bottom center',
          zIndex: 1,
        }}>
          <img src={FAN_CARDS[2]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,.18))' }} />
        </div>
      </div>

      {/* Main card */}
      <div style={{
        margin: '0 16px',
        width: 'calc(100% - 32px)',
        background: '#FFFDF6',
        border: '2.5px solid #1C1A17',
        borderRadius: 18,
        boxShadow: '4px 5px 0 #1C1A17',
        padding: '20px 18px 22px',
        position: 'relative',
        boxSizing: 'border-box',
      }}>
        {/* Badge */}
        <div style={{
          position: 'absolute', top: -14, left: 14,
          background: '#F5E14B',
          border: '2px solid #1C1A17',
          borderRadius: 7,
          padding: '3px 12px',
          fontFamily: 'Bangers, cursive',
          fontSize: 14,
          letterSpacing: '.06em',
          transform: 'rotate(-1.5deg)',
          whiteSpace: 'nowrap',
        }}>
          เข้าร่วมเลย!
        </div>

        {/* Headline */}
        <div style={{
          fontFamily: 'Bangers, cursive',
          fontSize: 32,
          letterSpacing: '.04em',
          color: '#1C1A17',
          lineHeight: 1.1,
          marginTop: 6,
        }}>
          เพิ่มเพื่อนเพื่อเข้าร่วมกิจกรรม
        </div>

        {/* Subtitle */}
        <div style={{
          font: "500 13px/1.6 'Bai Jamjuree', sans-serif",
          color: 'rgba(28,26,23,.65)',
          marginTop: 8,
        }}>
          กิจกรรมนี้เล่นผ่านบัญชี Codera Solutions เพิ่มเพื่อนแล้วเริ่มตอบได้เลย ไม่ต้องสมัครอะไรเพิ่ม
        </div>

        {/* Dashed divider */}
        <div style={{
          borderTop: '1.5px dashed rgba(28,26,23,.2)',
          margin: '14px 0',
        }} />

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                background: '#F5E14B',
                border: '2px solid #1C1A17',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Bangers, cursive',
                fontSize: 15,
                letterSpacing: '.04em',
                color: '#1C1A17',
              }}>
                {s.n}
              </div>
              <div style={{
                font: "500 13px/1.55 'Bai Jamjuree', sans-serif",
                color: '#1C1A17',
                paddingTop: 4,
              }}>
                {s.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '10px 16px 0',
          padding: '8px 14px',
          background: 'rgba(232,53,79,.08)',
          border: '1.5px solid rgba(232,53,79,.3)',
          borderRadius: 10,
          font: "600 13px/1.4 'Bai Jamjuree', sans-serif",
          color: '#E8354F',
          width: 'calc(100% - 32px)',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* CTA buttons */}
      <div style={{
        width: '100%',
        padding: '16px 16px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box',
        position: 'relative',
      }}>
        <button
          onClick={() => window.open(OA_ADD_URL, '_blank')}
          style={{
            width: '100%',
            padding: '15px 20px',
            background: '#06C755',
            color: '#fff',
            border: '2.5px solid #1C1A17',
            borderRadius: 14,
            font: "700 17px/1 'Bai Jamjuree', sans-serif",
            cursor: 'pointer',
            boxShadow: '4px 5px 0 #1C1A17',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.477 2 2 6.038 2 11.05c0 2.492 1.045 4.735 2.738 6.352.22.21.283.554.175.843l-.54 1.94a.5.5 0 0 0 .664.613l2.163-.87c.23-.092.49-.07.706.058A10.5 10.5 0 0 0 12 20.1c5.523 0 10-4.038 10-9.05S17.523 2 12 2Z" fill="white"/>
          </svg>
          เพิ่มเพื่อน แล้วเริ่มเล่น
        </button>

        <button
          onClick={handleCheck}
          disabled={checking}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: checking ? 'rgba(28,26,23,.06)' : '#FFFDF6',
            color: '#1C1A17',
            border: '2.5px solid #1C1A17',
            borderRadius: 14,
            font: "700 16px/1 'Bai Jamjuree', sans-serif",
            cursor: checking ? 'not-allowed' : 'pointer',
            opacity: checking ? .7 : 1,
          }}
        >
          {checking ? 'กำลังตรวจสอบ...' : 'เพิ่มแล้ว – เริ่มตอบเลย'}
        </button>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          padding: '4px 0 24px',
          font: "500 11px/1.5 'Bai Jamjuree', sans-serif",
          color: 'rgba(28,26,23,.4)',
        }}>
          บล็อกหรือเลิกติดตามได้ตลอดเวลา · ใช้ข้อมูลเพื่อจัดกิจกรรมและส่งข่าวเท่านั้น
        </div>
      </div>
    </div>
  );
}
