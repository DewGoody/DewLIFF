import type { Brand } from '../../types';

interface Props {
  brand: Brand;
  onChange: (brand: Brand) => void;
}

export default function BrandSection({ brand, onChange }: Props) {
  const set = (key: keyof Brand, value: string) => onChange({ ...brand, [key]: value });

  return (
    <div className="section" id="sec-brand">
      <div className="section-head">
        <span className="section-num">Brand</span>
        <span className="section-title">Brand & สี</span>
      </div>

      <div className="adv-section">
        <div className="adv-group-label">ตัวตนแบรนด์</div>
        <div className="adv-row">
          <div className="akey">name</div>
          <div>
            <input
              type="text"
              value={brand.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="ชื่อแคมเปญ"
            />
          </div>
          <div className="aeffect">ชื่อแคมเปญในหน้า Intro และหัว Flex Message</div>
        </div>
        <div className="adv-row">
          <div className="akey">logo_url</div>
          <div>
            <input
              type="text"
              value={brand.logo_url || ''}
              onChange={(e) => set('logo_url', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="aeffect">โลโก้มุมบนของหน้า Intro — เว้นว่างได้</div>
        </div>
      </div>

      <div className="adv-section" style={{ marginTop: 16 }}>
        <div className="adv-group-label">สี 3 ตัวที่คุมทั้งระบบ</div>
        {([
          ['primary', brand.primary, 'ปุ่ม CTA ทุกปุ่ม · progress bar · ชื่อผลลัพธ์'],
          ['surface', brand.surface, 'พื้นหลังทุกหน้าใน LIFF'],
          ['on_surface', brand.on_surface, 'ตัวอักษรทั้งหมดที่วางบนพื้นหลัง'],
        ] as [keyof Brand, string, string][]).map(([key, val, effect]) => (
          <div className="adv-row" key={key}>
            <div className="akey">{key}</div>
            <div>
              <div className="color-field">
                <div className="color-swatch" style={{ background: val }}>
                  <input
                    type="color"
                    value={val}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </div>
                <input
                  type="text"
                  value={val}
                  style={{ width: 100, fontFamily: 'var(--mono)', fontSize: 12 }}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            </div>
            <div className="aeffect">{effect}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
