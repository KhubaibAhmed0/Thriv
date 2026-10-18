'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { ShopProductCard } from '@/components/ShopProductCard';
import type { Product } from '@/types';
import styles from './ShopCatalog.module.css';

const categories = [
  { value: 'all', label: 'All pieces' },
  { value: 'jeans', label: 'Denim' },
  { value: 'graphic-tees', label: 'Graphic tees' },
];
const fitLabel = (value: string) => value.replaceAll('-', ' ');

export function ShopCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/products', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Catalogue unavailable');
        const data = await response.json();
        if (!Array.isArray(data.products)) throw new Error('Invalid catalogue');
        if (!controller.signal.aborted) {
          // The returned catalogue is authoritative, including an empty one.
          setAllProducts(data.products);
          setLoadState('ready');
        }
      })
      .catch(() => { if (!controller.signal.aborted) setLoadState('error'); });
    return () => controller.abort();
  }, [attempt]);

  const category = searchParams.get('category') || 'all';
  const fit = searchParams.get('subcategory') || 'all';
  const brand = searchParams.get('brand') || 'all';
  const condition = searchParams.get('condition') || 'all';
  const sort = searchParams.get('sort') || 'newest';
  const query = searchParams.get('q') || '';

  const updateParams = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value === 'all' || !value) params.delete(key);
      else params.set(key, value);
    });
    router.push(`/shop${params.size ? `?${params}` : ''}`, { scroll: false });
  };
  const reset = () => router.push('/shop', { scroll: false });

  const products = useMemo(() => allProducts.filter((product) => {
    const searchText = [product.name, product.brand, product.description, product.subcategory].join(' ').toLowerCase();
    return (!query || searchText.includes(query.trim().toLowerCase()))
      && (category === 'all' || product.category === category)
      && (fit === 'all' || product.subcategory === fit)
      && (brand === 'all' || product.brand === brand)
      && (condition === 'all' || product.condition === condition);
  }).sort((a, b) => {
    const stockOrder = Number(a.stock <= 0) - Number(b.stock <= 0);
    if (stockOrder) return stockOrder;
    if (sort === 'price-asc') return a.price - b.price;
    if (sort === 'price-desc') return b.price - a.price;
    return Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
  }), [allProducts, category, fit, brand, condition, sort, query]);

  const brands = [...new Set([...allProducts.map((product) => product.brand), ...(brand !== 'all' ? [brand] : [])])].sort();
  const fits = [...new Set([
    ...allProducts.filter((product) => category === 'all' || product.category === category).map((product) => product.subcategory).filter(Boolean),
    ...(fit !== 'all' ? [fit] : []),
  ])].sort();
  const activeFilters = [
    { key: 'q', value: query, label: `Search: ${query}` },
    { key: 'brand', value: brand, label: brand },
    { key: 'subcategory', value: fit, label: fitLabel(fit) },
    { key: 'condition', value: condition, label: condition },
  ].filter((item) => item.value && item.value !== 'all');
  const filterCount = [brand, fit, condition].filter((value) => value !== 'all').length;
  const hasFilters = category !== 'all' || activeFilters.length > 0;

  return (
    <div className={`${styles.catalog} home-container`}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Shop</span>
      </nav>
      <header className={styles.intro}>
        <h1 className="home-display">Curated drops<span>.</span></h1>
        <div className={styles.introCopy}>
          <p>One-of-one branded denim.<br />In-house graphic tees. Yours to make your own.</p>
          <span>Handpicked in Karachi. Delivered across Pakistan.</span>
        </div>
      </header>
      <div className={styles.collectionNav}>
        <div className={styles.categories} role="group" aria-label="Product categories">
          {categories.map((item) => (
            <button key={item.value} type="button" aria-pressed={category === item.value}
              onClick={() => updateParams({ category: item.value, subcategory: 'all' })}>
              <span className="home-display">{item.label}</span>
              {loadState === 'ready' && <small>{allProducts.filter((product) => item.value === 'all' || product.category === item.value).length}</small>}
            </button>
          ))}
        </div>
        <Link href="/wishlist" className={styles.savedLink}><Heart size={16} aria-hidden="true" />Saved pieces<ArrowUpRight size={14} aria-hidden="true" /></Link>
      </div>
      <section aria-label="Refine the collection" className={styles.controls}>
        <div className={styles.toolbar}>
          <form className={styles.search} onSubmit={(event) => {
            event.preventDefault();
            updateParams({ q: String(new FormData(event.currentTarget).get('q') ?? '').trim() });
          }}>
            <label htmlFor="shop-search" className="sr-only">Search the collection</label>
            <input key={query} id="shop-search" name="q" type="search" defaultValue={query} placeholder="Find your next piece" />
            <button type="submit" aria-label="Search collection"><Search size={17} aria-hidden="true" /></button>
          </form>
          <button type="button" className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="shop-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}>
            <SlidersHorizontal size={16} aria-hidden="true" />Filters{filterCount > 0 && <span>{filterCount}</span>}
          </button>
          <p className={styles.resultCount} role="status" aria-live="polite" aria-atomic="true">
            {loadState === 'loading' ? 'Loading pieces…' : loadState === 'error' ? 'Collection unavailable' : `${products.length} ${products.length === 1 ? 'piece' : 'pieces'}`}
          </p>
          <div className={styles.sort}>
            <label htmlFor="shop-sort">Sort by</label>
            <select id="shop-sort" value={sort} onChange={(event) => updateParams({ sort: event.target.value })}>
              <option value="newest">Featured & newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </div>
        </div>
        <div id="shop-filters" className={styles.filterPanel} hidden={!filtersOpen}>
          <div className={styles.filterField}>
            <label htmlFor="shop-brand">Brand</label>
            <select id="shop-brand" value={brand} onChange={(event) => updateParams({ brand: event.target.value })}>
              <option value="all">All brands</option>
              {brands.map((value) => <option key={value} value={value}>{value}</option>)}
            </select><ChevronDown size={14} aria-hidden="true" />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="shop-fit">Style / fit</label>
            <select id="shop-fit" value={fit} onChange={(event) => updateParams({ subcategory: event.target.value })}>
              <option value="all">All styles & fits</option>
              {fits.map((value) => <option key={value} value={value}>{fitLabel(value)}</option>)}
            </select><ChevronDown size={14} aria-hidden="true" />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="shop-condition">Condition</label>
            <select id="shop-condition" value={condition} onChange={(event) => updateParams({ condition: event.target.value })}>
              <option value="all">All conditions</option>
              {['Premium', 'Excellent', 'Very Good'].map((value) => <option key={value} value={value}>{value}</option>)}
            </select><ChevronDown size={14} aria-hidden="true" />
          </div>
          <button type="button" className={styles.reset} onClick={reset}>Reset all</button>
        </div>
        {activeFilters.length > 0 && <div className={styles.activeFilters} aria-label="Active filters">
          {activeFilters.map((item) => <button type="button" key={item.key} onClick={() => updateParams({ [item.key]: 'all' })} aria-label={`Remove ${item.label} filter`}>
            <span>{item.label}</span><X size={13} aria-hidden="true" />
          </button>)}
          <button type="button" className={styles.clearFilters} onClick={reset}>Clear all</button>
        </div>}
      </section>
      <section aria-label="Products" aria-busy={loadState === 'loading'}>
        {loadState === 'loading' ? (
          <div className={styles.grid} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((value) => <div key={value} className={styles.skeleton}><div /><span /><span /></div>)}
          </div>
        ) : loadState === 'error' ? (
          <div className={styles.empty} role="alert">
            <h2 className="home-display">A little interruption.</h2>
            <p>We couldn’t load the collection. Please try again.</p>
            <button type="button" className="home-button" onClick={() => { setLoadState('loading'); setAttempt(attempt + 1); }}>Try again<ArrowUpRight size={16} aria-hidden="true" /></button>
          </div>
        ) : products.length > 0 ? (
          <div className={styles.grid}>
            {products.map((product, index) => <ShopProductCard key={product.id} product={product} preload={index < 3} />)}
          </div>
        ) : (
          <div className={styles.empty}>
            <h2 className="home-display">{hasFilters ? 'No match. Keep looking.' : 'Between drops.'}</h2>
            <p>{hasFilters ? 'Try another brand or fit, or clear your filters to see the full collection.' : 'There are no pieces in the collection right now. Follow Thriv on Instagram for the next drop.'}</p>
            {hasFilters ? <button type="button" onClick={reset} className="home-button">View all pieces<ArrowUpRight size={16} aria-hidden="true" /></button>
              : <Link href="https://www.instagram.com/thriv.pk/" className="home-button" target="_blank" rel="noopener noreferrer">Follow the drops<ArrowUpRight size={16} aria-hidden="true" /></Link>}
          </div>
        )}
      </section>
      <div className={styles.delivery}>
        <p className="home-display">Good pieces.<br />Worth finding.</p>
        <p>Dispatched from Karachi.<br />Rs 200 nationwide delivery.<br />All thrift pieces are one-of-one, final sale.</p>
        <Link href="/faq">A few things to know<ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
