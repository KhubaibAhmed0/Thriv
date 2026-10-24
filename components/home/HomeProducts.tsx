'use client';

import Link from 'next/link';
import { Heart, Check, ArrowUpRight, ArrowRight } from 'lucide-react';
import type { Product } from '@/types';
import { homeAssets, productAsset } from '@/data/homepage';
import { formatPrice } from '@/lib/formatPrice';
import { useWishlist } from '@/components/WishlistProvider';
import { useQuickAdd } from '@/lib/useQuickAdd';
import { useCart } from '@/components/CartProvider';
import { HomeMedia } from './HomeMedia';

function SaveProduct({ product }: { product: Product }) {
  const { isSaved, toggle } = useWishlist();
  const { announce } = useCart();
  const saved = isSaved(product.slug);
  return <button type="button" className="home-save" aria-label={`${saved ? 'Unsave' : 'Save'} ${product.name}`} aria-pressed={saved} onClick={() => {
    toggle(product.slug);
    announce(`${product.name} ${saved ? 'removed from' : 'added to'} saved items`);
  }}><Heart size={18} strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /></button>;
}

function Swatches({ product }: { product: Product }) {
  if (!product.colors?.length) return null;
  return <div className="home-swatches" aria-label="Product colours">{product.colors.map((color) => <span key={color} style={{ backgroundColor: color }} role="img" aria-label={`Colour ${color}`} />)}</div>;
}

export function HomeProductCard({ product }: { product: Product }) {
  return <article className="home-product">
    <div className="home-product-panel">
      <Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`}><HomeMedia asset={productAsset(product)} label="Product photograph" sizes="(max-width: 767px) 50vw, (max-width: 1328px) 33vw, 440px" /></Link>
      <SaveProduct product={product} />
      {product.stock <= 0 && <span className="home-sold-label">Sold out</span>}
    </div>
    <div className="home-product-details">
      <Swatches product={product} />
      <h3 className="home-display"><Link href={`/product/${product.slug}`}>{product.name}</Link></h3>
      <p>{product.isMerch ? 'In-house graphic tee · multiple sizes' : `One-of-one denim · size ${product.size ?? 'see details'}`} · {product.condition}</p>
      <span className="home-product-price">{formatPrice(product.price)}</span>
    </div>
  </article>;
}

export function FeaturedDenim({ product }: { product: Product | null }) {
  if (!product) return <section className="home-feature home-container home-feature-empty" aria-labelledby="feature-heading">
    <h2 id="feature-heading" className="home-display">Your next<br />one-of-one.</h2>
    <p>No denim is available right now. Check the shop for the current collection.</p>
    <Link href="/shop" className="home-button">Visit the shop <ArrowRight size={16} /></Link>
  </section>;
  return <FeaturedPurchase key={product.id} product={product} />;
}

function FeaturedPurchase({ product }: { product: Product }) {
  const { trigger, pickSize, sizes, needsSizeChoice, showSizePicker, justAdded, inCart } = useQuickAdd(product);
  const asset = homeAssets.featured.src ? homeAssets.featured : productAsset(product);
  const sold = product.stock <= 0;
  return <section className="home-feature home-container" aria-labelledby="feature-heading">
    <HomeMedia asset={asset} label="Featured denim photograph" className="home-feature-photo" sizes="(max-width: 767px) 100vw, (max-width: 1328px) 52vw, 660px" />
    <div className="home-feature-copy">
      <h2 id="feature-heading" className="home-display"><Link href={`/product/${product.slug}`}>{product.name}</Link></h2>
      <p className="home-feature-fact">Handpicked &amp; disinfected · {product.condition}</p>
      <p className="home-feature-description">{product.description}</p>
      <div className="home-feature-options">
        <span className="home-field-label">Colour &amp; fit</span><Swatches product={product} />
        <span className="home-fixed-size">Size {product.size ?? 'see product details'}</span><p>One piece only. No restocks.</p>
      </div>
      {product.measurements && <dl className="home-measurements">{Object.entries(product.measurements).slice(0, 4).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      <div className="home-feature-price"><span>Price</span><strong className="home-display">{formatPrice(product.price)}</strong></div>
      <div className="home-purchase-actions">
        <button type="button" className="home-button home-add-cart" disabled={sold || inCart} onClick={trigger}>
          {justAdded && <Check size={16} aria-hidden="true" />}{sold ? 'Sold out' : justAdded ? 'Added to cart' : inCart ? 'In your cart' : 'Add to Cart'}
        </button><SaveProduct product={product} />
      </div>
      {needsSizeChoice && showSizePicker && <div className="home-size-options" role="group" aria-label="Choose a size">{sizes.map((size) => <button type="button" key={size} onClick={() => pickSize(size)}>{size}</button>)}</div>}
      {inCart && <Link className="home-view-cart" href="/cart">View your cart <ArrowUpRight size={15} /></Link>}
      <p className="home-delivery-note">Rs 200 nationwide delivery. All sales final.<br /><Link href={`/product/${product.slug}`}>View measurements &amp; full details <ArrowUpRight size={13} /></Link></p>
    </div>
  </section>;
}
