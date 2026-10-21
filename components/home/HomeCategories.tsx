import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { homeCategoryCards } from '@/data/homepage';
import { HomeMedia } from './HomeMedia';

// Section 3 of the owner's image pack: three category cards.
export function HomeCategories() {
  return (
    <section className="home-categories home-container" aria-labelledby="categories-heading">
      <div className="home-section-head">
        <div>
          <p className="home-eyebrow">Shop by category</p>
          <h2 id="categories-heading" className="home-display">Find your fit.</h2>
        </div>
        <div className="home-section-aside">
          <p>Denim, graphics, or the layer on top. Start where you already know.</p>
        </div>
      </div>
      <div className="home-category-grid">
        {homeCategoryCards.map((card) => (
          <Link key={card.label} href={card.href} className="home-category-card">
            <HomeMedia
              asset={card.asset}
              label={card.label}
              className="home-category-photo"
              sizes="(max-width: 767px) 78vw, (max-width: 1100px) 32vw, 410px"
            />
            <span className="home-category-label">
              <span>{card.label}</span>
              <ArrowUpRight size={19} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
