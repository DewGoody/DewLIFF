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

    </div>
  );
}
