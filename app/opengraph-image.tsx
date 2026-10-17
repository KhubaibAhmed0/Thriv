import { ImageResponse } from 'next/og';

export const alt = 'thriv — Curated Thrift & Streetwear, Pakistan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#111111',
          color: '#F5F3F0',
          padding: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em' }}>
            thriv<span style={{ color: '#9A9A9A' }}>.pk</span>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              color: '#9A9A9A',
              border: '1px solid #303030',
              borderRadius: 9999,
              padding: '8px 22px',
            }}
          >
            Karachi, Pakistan
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            maxWidth: 980,
          }}
        >
          One-of-one thrift. Heavyweight streetwear.
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            color: '#9A9A9A',
          }}
        >
          <div style={{ display: 'flex' }}>
            Zara &middot; Bershka &middot; Calvin Klein &middot; H&amp;M &middot; In-house anime tees
          </div>
          <div style={{ display: 'flex', color: '#F5F3F0', fontWeight: 700 }}>
            Flat Rs 200 delivery
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
