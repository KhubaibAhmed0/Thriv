import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { homeAssets } from '@/data/homepage';
import { HomeMedia } from './HomeMedia';

// Section 5 of the owner's image pack: the closing look, using the cutout.
export function HomeLook() {
  return (
    <section className="home-look home-container" aria-labelledby="look-heading">
      <div className="home-look-panel">
        <div className="home-look-copy">
          <p className="home-eyebrow">05 — The uniform</p>
          <h2 id="look-heading" className="home-display">The daily<br />rotation.</h2>
          <p>Texture on top, wide denim below. One uniform that works from the first coffee to the last stop.</p>
          <Link href="/shop" className="home-button home-look-cta">
            Shop the collection <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="home-look-visual">
          <span className="home-look-circle" aria-hidden="true" />
          <HomeMedia
            asset={homeAssets.look}
            label="The everyday look"
            className="home-look-photo"
            sizes="(max-width: 767px) 94vw, (max-width: 1328px) 46vw, 590px"
          />
        </div>
      </div>
    </section>
  );
}
