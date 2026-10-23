import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { homeAssets } from '@/data/homepage';
import { HomeMedia } from './HomeMedia';

// Section 5 of the owner's image pack: the closing look, composed as a
// campaign board — oversized type and a disc behind the cutout, with the copy
// held in a solid seal, matching the supplied reference in Thriv's palette.
export function HomeLook() {
  return (
    <section id="look" className="home-look home-container" aria-labelledby="look-heading">
      <div className="home-look-panel">
        <span className="home-look-disc" aria-hidden="true" />
        <h2 id="look-heading" className="home-display home-look-title">The daily<br />rotation.</h2>
        <span className="home-look-rules" aria-hidden="true"><span /><span /><span /></span>
        <HomeMedia
          asset={homeAssets.look}
          label="The everyday look"
          className="home-look-photo"
          sizes="(max-width: 767px) 84vw, (max-width: 1100px) 54vw, 470px"
        />
        <div className="home-look-seal">
          <p className="home-eyebrow">05 — The uniform</p>
          <p className="home-display home-look-seal-title">Built for<br />the everyday.</p>
          <p className="home-look-seal-copy">Texture on top, wide denim below. One uniform that works from the first coffee to the last stop.</p>
        </div>
        <Link href="/shop" className="home-button home-look-cta">
          Shop the collection <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
