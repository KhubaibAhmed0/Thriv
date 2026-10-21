import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { homeEditCards } from '@/data/homepage';
import { HomeMedia } from './HomeMedia';

// Section 2 of the owner's image pack: three photographs, three ways in.
export function HomeEdit() {
  return (
    <section className="home-edit home-container" aria-labelledby="edit-heading">
      <div className="home-section-head">
        <div>
          <p className="home-eyebrow">New in</p>
          <h2 id="edit-heading" className="home-display">The new edit.</h2>
        </div>
        <div className="home-section-aside">
          <p>Three ways into the season: a graphic tee, washed denim, and a little colour.</p>
          <Link href="/shop" className="home-text-link">
            Shop new in <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="home-edit-grid">
        {homeEditCards.map((card, index) => (
          <Link key={card.caption} href={card.href} className="home-edit-card">
            <HomeMedia
              asset={card.asset}
              label={card.caption}
              className="home-edit-photo"
              sizes="(max-width: 767px) 82vw, (max-width: 1100px) 32vw, 410px"
            />
            <span className="home-edit-caption">
              <span>{card.caption}</span>
              <span className="home-edit-index" aria-hidden="true">0{index + 1}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
