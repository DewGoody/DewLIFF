interface Props {
  config: {
    copy?: { waiting_title?: string; waiting_body?: string };
  };
}

export default function Waiting({ config }: Props) {
  const copy = config.copy || {};

  const handleClose = () => {
    console.log('[Waiting] closing window');
    try {
      liff.closeWindow();
    } catch {
      window.close();
    }
  };

  return (
    <div className="screen fade-enter">
      <div className="screen-body">
        <div className="ring-container">
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring-core" />
        </div>
        <h2>{copy.waiting_title || 'รอคู่หูตอบอยู่'}</h2>
        <p className="desc">{copy.waiting_body || 'ปิดหน้านี้ได้เลย เราจะแจ้งเตือนเมื่อมีผลลัพธ์'}</p>
        <div className="wait-dots">
          <span className="wait-dot" />
          <span className="wait-dot" />
          <span className="wait-dot" />
        </div>
      </div>
      <div className="screen-footer">
        <button className="btn-outline" onClick={handleClose}>
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  );
}
