import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { homeAssets } from '@/data/homepage';
import { HomeMedia } from './HomeMedia';

// Section 4 of the owner's image pack: the layer story.
export function HomeStatement() {
  return (
    <section className="home-statement" aria-labelledby="statement-heading">
      <div className="home-statement-grid home-container">
        <div className="home-statement-copy">
          <p className="home-eyebrow home-eyebrow-light">04 — Layers</p>
          <h2 id="statement-heading" className="home-display">Layer up.</h2>
          <p>Soft knits, wide denim, a graphic underneath. The pieces that do the heavy lifting, worn on repeat.</p>
          <Link href="/shop" className="home-button home-statement-cta">
            Shop the collection <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          <p className="home-statement-note">Styled in-house · Curated in Karachi</p>
        </div>
        <div className="home-statement-visual">
          <span className="home-statement-plate" aria-hidden="true" />
          <HomeMedia
            asset={homeAssets.statement}
            label="Layered knitwear"
            className="home-statement-photo"
            sizes="(max-width: 767px) 100vw, (max-width: 1328px) 52vw, 660px"
          />
          <span className="home-statement-tag">Knitwear / 04</span>
        </div>
      </div>
    </section>
  );
}
