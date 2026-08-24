interface ResultData {
  title: string;
  body: string;
  image_url?: string;
  eyebrow?: string;
  typeCode?: string;
  axisMe?: string;
  axisBuddy?: string;
  poles?: string[];
}

interface Props {
  config: {
    brand?: { primary?: string; name?: string };
    copy?: { result_share_btn?: string; result_retry_btn?: string; result_invite_btn?: string };
    mode?: string;
    chat_trigger?: boolean;
  };
  result: ResultData;
  onPlayAgain: () => void;
  onInviteAnother: () => void;
}

export default function Result({ config, result, onPlayAgain, onInviteAnother }: Props) {
  const copy = config.copy || {};
  const brand = config.brand || {};
  const isSolo = config.mode === 'solo';
  const primaryColor = brand.primary || 'var(--primary)';

  const axisTags = [
    ...(result.axisMe ? [`คุณ · ${result.axisMe}`] : []),
    ...(result.axisBuddy ? [`คู่หู · ${result.axisBuddy}`] : []),
    ...(result.poles || []),
  ];

  const handleShareResult = async () => {
    console.log('[Result] sharing result via targetPicker');
    try {
      await liff.shareTargetPicker([
        {
          type: 'flex',
          altText: `${result.title} - ${brand.name || 'คู่หูสายไหน'}`,
          contents: {
            type: 'bubble',
            size: 'mega',
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'md',
              contents: [
                {
                  type: 'text',
                  text: result.eyebrow || 'ผลลัพธ์',
                  size: 'xs',
                  color: '#888888',
                },
                {
                  type: 'text',
                  text: result.title,
                  weight: 'bold',
                  size: 'xl',
                  wrap: true,
                },
                {
                  type: 'text',
                  text: result.body,
                  size: 'sm',
                  color: '#666666',
                  wrap: true,
                },
              ],
            },
          },
        },
      ]);
      console.log('[Result] share completed');
    } catch (err) {
      console.error('[Result] share error:', err);
    }
  };

  return (
    <div className="screen result-screen fade-enter" style={{ background: primaryColor }}>
      <div className="screen-body" style={{ justifyContent: 'flex-end', paddingBottom: 10 }}>
        {result.image_url ? (
          <img
            src={result.image_url}
            alt={result.title}
            style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 14, marginBottom: 24 }}
          />
        ) : (
          <div className="result-image">RESULT</div>
        )}
        {result.eyebrow && <div className="result-eyebrow">{result.eyebrow}</div>}
        <h1 className="result-title">{result.title}</h1>
        <p className="result-body">{result.body}</p>
        {axisTags.length > 0 && (
          <div className="axis-tags">
            {axisTags.map((tag, i) => (
              <span key={i} className="axis-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="screen-footer">
        <button className="btn-result" onClick={handleShareResult}>
          {copy.result_share_btn || 'อวดผลให้คนอื่น'}
        </button>
        {isSolo ? (
          <button className="btn-result-outline" onClick={onPlayAgain}>
            {copy.result_retry_btn || 'ลองทำอีกครั้ง'}
          </button>
        ) : (
          <button className="btn-result-outline" onClick={onInviteAnother}>
            {copy.result_invite_btn || 'ชวนอีกคน'}
          </button>
        )}
      </div>
    </div>
  );
}
