import { useState } from 'react';

interface Props {
  onFriendAdded: () => void;
  oaId?: string;
}

export default function FriendGate({ onFriendAdded, oaId }: Props) {
  const OA_ADD_URL = oaId
    ? `https://line.me/ti/p/~${oaId.replace('@', '')}`
    : 'https://line.me/ti/p/~2011037337';
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    console.log('[FriendGate] checking friendship');
    setChecking(true);
    setError('');
    try {
      const { friendFlag } = await liff.getFriendship();
      console.log('[FriendGate] friendFlag:', friendFlag);
      if (friendFlag) {
        onFriendAdded();
      } else {
        setError('ยังไม่ได้เพิ่มเพื่อน กดเพิ่มเพื่อนก่อนนะ');
      }
    } catch (err) {
      console.error('[FriendGate] error:', err);
      setError('ไม่สามารถตรวจสอบได้ ลองอีกครั้ง');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="screen fade-enter">
      <div className="screen-body">
        <div className="logo-box" style={{ fontSize: 28 }}>+</div>
        <h2>เพิ่มเพื่อนก่อนเริ่ม</h2>
        <p className="desc">ต้องเพิ่มเพื่อน LINE OA ก่อนถึงจะเล่นได้ กดปุ่มด้านล่างเพื่อเพิ่มเพื่อน แล้วกลับมากด "เพิ่มแล้ว"</p>
        {error && <p style={{ color: '#FF3D8B', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
      <div className="screen-footer">
        <button
          className="btn-primary"
          onClick={() => window.open(OA_ADD_URL, '_blank')}
        >
          เพิ่มเพื่อน Official Account
        </button>
        <button className="btn-outline" onClick={handleCheck} disabled={checking}>
          {checking ? 'กำลังตรวจสอบ...' : 'เพิ่มแล้ว เริ่มเลย'}
        </button>
      </div>
    </div>
  );
}
