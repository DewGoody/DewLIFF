const KEYS = {
  invite: 'oa_nudge_invite_v1',
  share: 'oa_nudge_share_v1',
  addFriend: 'oa_nudge_addfriend_v1',
} as const;

type NudgeTrigger = keyof typeof KEYS;

export function nudgeSeen(trigger: NudgeTrigger = 'invite'): boolean {
  try { return !!localStorage.getItem(KEYS[trigger]); } catch { return false; }
}

function markSeen(trigger: NudgeTrigger) {
  try { localStorage.setItem(KEYS[trigger], '1'); } catch {}
}

interface Props {
  oaId?: string;
  trigger?: NudgeTrigger;
  onDismiss: () => void;
  dismissLabel?: string;
  copy?: Record<string, string>;
}

export default function AddFriendNudge({ oaId, trigger = 'invite', onDismiss, dismissLabel, copy = {} }: Props) {
  const OA_ADD_URL = `https://line.me/R/ti/p/%40${(oaId || '@747xtauy').replace('@', '')}`;

  const handleAdd = () => {
    markSeen(trigger);
    window.open(OA_ADD_URL, '_blank');
    onDismiss();
  };

  const handleDismiss = () => {
    markSeen(trigger);
    onDismiss();
  };

  const title = copy.nudge_title || 'รับแจ้งเตือนผ่าน LINE OA';
  const bodyText = trigger === 'share'
    ? (copy.nudge_body_share || 'เพิ่มเพื่อน Official Account เพื่อรับแจ้งเตือนเมื่อเพื่อนตอบ และผลทีมออกมาทางแชท LINE')
    : trigger === 'addFriend'
    ? (copy.nudge_body_addfriend || 'เพิ่มเพื่อน Official Account เพื่อรับแจ้งเตือนเมื่อเพื่อนรับลิงก์และตอบแบบทดสอบแล้ว')
    : (copy.nudge_body_invite || 'เพิ่มเพื่อน Official Account เพื่อรับการแจ้งเตือนเมื่อเพื่อนตอบแล้ว คู่ครบ และผลทีมออกมาทางแชท LINE');
  const addBtn = copy.nudge_add_btn || 'เพิ่มเพื่อน Official Account';
  const skipBtn = dismissLabel ?? (copy.nudge_skip_btn || 'ข้ามไปก่อน');

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end' }}>
      {/* Backdrop */}
      <div onClick={handleDismiss} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.45)' }} />

      {/* Sheet */}
      <div style={{
        position:'relative', width:'100%', maxWidth:480,
        background:'#FFFDF6',
        borderRadius:'20px 20px 0 0',
        border:'2.5px solid #1C1A17',
        borderBottom:'none',
        padding:'24px 20px 40px',
        boxSizing:'border-box',
      }}>
        {/* Handle bar */}
        <div style={{ width:40, height:4, background:'rgba(28,26,23,.2)', borderRadius:2, margin:'0 auto 20px' }} />

        {/* Icon */}
        <div style={{ width:52, height:52, background:'#F5E14B', border:'2px solid #1C1A17', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, marginBottom:12 }}>
          🔔
        </div>

        <div style={{ fontFamily:'Bangers,cursive', fontSize:26, letterSpacing:'.04em', color:'#1C1A17', lineHeight:1.1 }}>
          {title}
        </div>
        <div style={{ font:"500 14px/1.65 'Bai Jamjuree',sans-serif", color:'rgba(28,26,23,.65)', marginTop:8, marginBottom:22 }}>
          {bodyText}
        </div>

        <button
          onClick={handleAdd}
          style={{
            width:'100%', padding:'15px 20px',
            background:'#06C755', color:'#fff',
            border:'2.5px solid #1C1A17', borderRadius:13,
            font:"700 16px/1 'Bai Jamjuree',sans-serif",
            cursor:'pointer', boxShadow:'4px 5px 0 #1C1A17',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.477 2 2 6.038 2 11.05c0 2.492 1.045 4.735 2.738 6.352.22.21.283.554.175.843l-.54 1.94a.5.5 0 0 0 .664.613l2.163-.87c.23-.092.49-.07.706.058A10.5 10.5 0 0 0 12 20.1c5.523 0 10-4.038 10-9.05S17.523 2 12 2Z" fill="white"/>
          </svg>
          {addBtn}
        </button>

        <button
          onClick={handleDismiss}
          style={{
            width:'100%', marginTop:10, padding:'13px 20px',
            background:'transparent', color:'rgba(28,26,23,.55)',
            border:'none',
            font:"600 14px/1 'Bai Jamjuree',sans-serif", cursor:'pointer',
          }}
        >
          {skipBtn}
        </button>
      </div>
    </div>
  );
}
