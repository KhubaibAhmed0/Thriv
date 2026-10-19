import Link from 'next/link';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { getAllProducts } from '@/lib/products-db';
import { homeAssets, selectHomeProducts } from '@/data/homepage';
import { HomeMedia } from '@/components/home/HomeMedia';
import { HomeEditorial } from '@/components/home/HomeEditorial';
import { HomeProductCard } from '@/components/home/HomeProducts';

// Audit F-17: the home page renders the live DB catalogue from an ISR cache
// (60s cap) and catalogue mutations revalidate it on demand (lib/revalidate.ts),
// so price/stock/visibility changes land on the next request; edits that bypass
// the app (Supabase Studio) heal within the window.
export const revalidate = 60;
export const metadata = {
  title: 'thriv | Curated Thrift Jeans & Anime Graphic Tees · Pakistan',
  description: 'One-of-one branded denim and in-house anime graphic tees. Handpicked, disinfected, and shipped from Karachi with flat Rs 200 nationwide delivery.',
};

export default async function HomePage() {
  const products = await getAllProducts();
  const collection = selectHomeProducts(products);
  const denim = products.find((product) => product.slug === 'zara-wide-leg-vintage-wash-denim')
    ?? products.find((product) => product.category === 'jeans' && product.stock > 0)
    ?? products.find((product) => product.category === 'jeans') ?? null;
  const tee = products.find((product) => product.slug === 'akira-neo-tokyo-cyberpunk-tee')
    ?? products.find((product) => product.isMerch) ?? null;
  const editorial = [denim, tee].filter((product) => product !== null);

  return (
    <main id="main-content" className="thriv-home">
      <section className="home-hero" aria-labelledby="hero-heading">
        <div className="home-hero-inner home-container">
          <div className="home-hero-copy">
            <h1 id="hero-heading" className="home-display">Branded jeans.<br />One piece<br />only.</h1>
            <div className="home-hero-facts">
              <div><strong className="home-display">1-of-1<span>+</span></strong><p>Every thrift piece is unique.</p></div>
              <div><strong className="home-display">Rs 200<ArrowUpRight size={28} aria-hidden="true" /></strong><p>Flat delivery. Across Pakistan.</p></div>
            </div>
          </div>
          <p className="home-hero-description">Zara, Bershka, Calvin Klein,<br />H&amp;M and Old Navy.<br />Handpicked in Karachi.<br />Made for your everyday.</p>
          <div className="home-hero-circle home-hero-circle-back" aria-hidden="true" />
          <div className="home-hero-circle home-hero-circle-front" aria-hidden="true" />
          <HomeMedia asset={homeAssets.hero} label="Hero photograph" className="home-hero-photo" preload />
          <Link href="/shop?category=jeans" className="home-button home-hero-cta">Shop Jeans <ArrowUpRight size={18} /></Link>
        </div>
      </section>
      <div className="home-announcement" aria-label="Store information">
        <span>One-of-one branded denim</span><span>Flat Rs 200 nationwide delivery</span><span>In-house anime graphic tees</span><span>Handpicked &amp; disinfected in Karachi</span>
      </div>
      <HomeEditorial products={editorial} />
      <section className="home-collection home-container" aria-labelledby="collection-heading">
        <h2 id="collection-heading" className="home-display">Explore products</h2>
        {collection.length ? <div className="home-product-grid">{collection.map((product, index) => <HomeProductCard key={product.id} product={product} wide={index === 0} />)}</div> : <p className="home-empty">The next collection is on its way. Visit the shop for availability.</p>}
        <Link href="/shop" className="home-button home-button-soft">Shop More <ArrowUpRight size={16} /></Link>
      </section>
      <section className="home-campaign" aria-labelledby="campaign-heading">
        <div className="home-campaign-inner home-container">
          <div className="home-campaign-circle" aria-hidden="true" />
          <h2 id="campaign-heading" className="home-display">Follow<br />the drops.</h2>
          <div className="home-campaign-rules" aria-hidden="true"><span /><span /><span /></div>
          <HomeMedia asset={homeAssets.campaign} label="Campaign photograph" className="home-campaign-photo" />
          <div className="home-campaign-seal"><h3 className="home-display">Handpicked.<br />Disinfected.<br />Ready to wear.</h3><p>Branded denim. In-house tees.<br />Curated in Karachi,<br />shipped across Pakistan.</p></div>
          <div className="home-campaign-action"><p>One-of-one pieces sell fast.<br />Find your next everyday favourite.</p><Link href="/shop" className="home-button home-button-soft">Shop Now <ArrowRight size={17} /></Link></div>
        </div>
      </section>
    </main>
  );
}
