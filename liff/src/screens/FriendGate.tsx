import { useState } from 'react';
import { ARCH } from '../data';

interface Props {
  onFriendAdded: () => void;
  oaId?: string;
  returnUrl?: string;
}

const BENEFITS = [
  { icon: '🎯', text: 'รับผลลัพธ์แบบทดสอบของคุณ' },
  { icon: '🤝', text: 'จับคู่กับเพื่อนและดูว่าคุณเข้ากันแค่ไหน' },
  { icon: '🎁', text: 'รับสิทธิพิเศษและกิจกรรมจาก OA' },
];

export default function FriendGate({ onFriendAdded, oaId, returnUrl }: Props) {
  // Fallback only fires if a campaign's config.appearance.oa_id is unset (this is
  // DewLIFF's own separate deployment/OA — never KimLIFF's real OA basic ID here).
  // Set config.appearance.oa_id per campaign via the admin console to avoid relying
  // on this placeholder ever being hit in production.
  const OA_ADD_URL = `https://line.me/R/ti/p/%40${(oaId || '@your-dewliff-oa-id').replace('@', '')}`;
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const card = ARCH.prep.card;

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
      padding: '0 24px 32px',
      overflowY: 'auto',
      position: 'relative',
    }}>
      {/* Radial glow background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 20% 15%, rgba(245,225,75,.35) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(232,53,79,.15) 0%, transparent 45%)',
      }} />

      {/* Card image */}
      <div style={{
        marginTop: 48,
        width: 130,
        height: 130,
        position: 'relative',
        animation: 'v2Bob 2.4s ease-in-out infinite',
        flexShrink: 0,
      }}>
        <img src={card} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>

      {/* Headline */}
      <div style={{
        fontFamily: 'Bangers, cursive',
        fontSize: 36,
        letterSpacing: '.06em',
        color: '#1C1A17',
        marginTop: 16,
        textAlign: 'center',
        lineHeight: 1.1,
        position: 'relative',
      }}>
        เพิ่มเพื่อนก่อน<br />รับสิทธิ์เลย!
      </div>

      <div style={{
        font: "500 14px/1.6 'Bai Jamjuree', sans-serif",
        color: 'rgba(28,26,23,.6)',
        textAlign: 'center',
        marginTop: 8,
        position: 'relative',
        maxWidth: 280,
      }}>
        เพิ่ม LINE Official Account เพื่อรับผลลัพธ์<br />และเข้าร่วมกิจกรรมได้เต็มที่
      </div>

      {/* Benefits card */}
      <div style={{
        marginTop: 20,
        width: '100%',
        background: '#FFFDF6',
        border: '2.5px solid #1C1A17',
        borderRadius: 16,
        boxShadow: '4px 5px 0 #1C1A17',
        padding: '16px 18px',
        position: 'relative',
      }}>
        {/* Badge */}
        <div style={{
          position: 'absolute', top: -13, left: 16,
          background: '#F5E14B',
          border: '2px solid #1C1A17',
          borderRadius: 6,
          padding: '2px 10px',
          fontFamily: 'Bangers, cursive',
          fontSize: 13,
          letterSpacing: '.06em',
          transform: 'rotate(-1.5deg)',
        }}>
          สิ่งที่คุณจะได้รับ
        </div>

        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {BENEFITS.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, flexShrink: 0,
                background: '#F5E14B',
                border: '2px solid #1C1A17',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>
                {b.icon}
              </div>
              <div style={{
                font: "600 13px/1.4 'Bai Jamjuree', sans-serif",
                color: '#1C1A17',
              }}>
                {b.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 12,
          padding: '8px 14px',
          background: 'rgba(232,53,79,.08)',
          border: '1.5px solid rgba(232,53,79,.3)',
          borderRadius: 10,
          font: "600 13px/1.4 'Bai Jamjuree', sans-serif",
          color: '#E8354F',
          width: '100%',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}>
          {error}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* CTA buttons */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24, position: 'relative' }}>
        <button
          onClick={() => window.open(OA_ADD_URL, '_blank')}
          style={{
            width: '100%',
            padding: '15px 20px',
            background: '#06C755',
            color: '#fff',
            border: '2.5px solid #1C1A17',
            borderRadius: 13,
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
          เพิ่มเพื่อน Official Account
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
            borderRadius: 13,
            font: "700 16px/1 'Bai Jamjuree', sans-serif",
            cursor: checking ? 'not-allowed' : 'pointer',
            opacity: checking ? .7 : 1,
          }}
        >
          {checking ? 'กำลังตรวจสอบ...' : 'เพิ่มแล้ว ✓ เริ่มได้เลย'}
        </button>

        {/* Footer link */}
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <a
            href="https://codera.co.th"
            target="_blank"
            rel="noreferrer"
            style={{
              font: "500 11px/1.5 'Bai Jamjuree', sans-serif",
              color: 'rgba(28,26,23,.35)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            ดูบริการอื่นๆ ที่เราให้บริการสำหรับกิจกรรมบนไลน์ OA
          </a>
        </div>
      </div>
    </div>
  );
}
