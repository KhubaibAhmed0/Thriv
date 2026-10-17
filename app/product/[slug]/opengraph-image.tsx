import { ImageResponse } from 'next/og';
import { getProductBySlug } from '@/lib/products-db';
import { formatPrice } from '@/lib/formatPrice';

export const alt = 'One-of-one piece on thriv.pk';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface ImageProps {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;

  let brand = 'thriv';
  let name = 'One-of-one piece';
  let meta = 'Curated thrift · Karachi';

  try {
    const product = await getProductBySlug(slug);
    if (product) {
      brand = String(product.brand);
      name =
        product.name.length > 58
          ? `${product.name.slice(0, 55).trimEnd()}...`
          : product.name;
      const bits: string[] = [formatPrice(product.price)];
      if (product.condition) bits.push(`Grade: ${product.condition}`);
      if (product.size) bits.push(`Size ${product.size}`);
      meta = bits.join('   ·   ');
    }
  } catch (error) {
    console.error('[og] product fetch failed:', error);
  }

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
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em' }}>
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
            1-of-1 · Once it sells, it&apos;s gone
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              color: '#9A9A9A',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: 18,
            }}
          >
            {brand}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              maxWidth: 1040,
            }}
          >
            {name}
          </div>
          <div style={{ display: 'flex', fontSize: 32, marginTop: 26, color: '#F5F3F0' }}>
            {meta}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 22, color: '#9A9A9A' }}>
          Handpicked · Disinfected · Shipped nationwide from Karachi
        </div>
      </div>
    ),
    { ...size }
  );
}
