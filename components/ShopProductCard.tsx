'use client';

import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { Check, Heart, Plus, X } from 'lucide-react';
import type { Product } from '@/types';
import { HomeMedia } from '@/components/home/HomeMedia';
import { productAsset } from '@/data/homepage';
import { useQuickAdd } from '@/lib/useQuickAdd';
import { useWishlist } from '@/components/WishlistProvider';
import { useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/formatPrice';
import styles from './ShopCatalog.module.css';

export function ShopProductCard({ product, preload = false }: { product: Product; preload?: boolean }) {
  const { isSaved, toggle } = useWishlist();
  const { announce } = useCart();
  const saved = isSaved(product.slug);
  const sold = product.stock <= 0;
  const { sizes, showSizePicker, setShowSizePicker, justAdded, inCart, trigger, pickSize } = useQuickAdd(product);
  const fixedInCart = !product.isMerch && inCart;
  const actionLabel = sold ? 'Sold out' : justAdded ? 'Added to bag' : fixedInCart ? 'In your bag' : 'Quick add';
  const sizePickerId = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const firstSize = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (showSizePicker) firstSize.current?.focus(); }, [showSizePicker]);
  const closeSizes = () => { setShowSizePicker(false); addButton.current?.focus(); };

  return (
    <article className={styles.product}>
      <div className={styles.photo}>
        <Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`}>
          <HomeMedia asset={productAsset(product)} label="Product photograph" preload={preload} />
        </Link>
        <span className={styles.productTag}>{sold ? 'Sold out' : product.isMerch ? 'In-house merch' : '1 of 1 denim'}</span>
        <button type="button" className={styles.save} aria-pressed={saved}
          aria-label={`${saved ? 'Unsave' : 'Save'} ${product.name}`}
          onClick={() => { toggle(product.slug); announce(`${product.name} ${saved ? 'removed from' : 'added to'} saved pieces`); }}>
          <Heart size={18} strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.productMeta}>
        <span>{product.brand}</span>
        <span>{product.isMerch ? (product.sizes?.join(' / ') || 'Graphic tee') : product.size ? `Size ${product.size}` : 'See measurements'}</span>
      </div>
      <h2 className="home-display"><Link href={`/product/${product.slug}`}>{product.name}</Link></h2>
      <div className={styles.productDescription}>
        <p>{product.subcategory.replaceAll('-', ' ')}{product.subcategory && ' · '}{product.condition}</p>
        {Boolean(product.colors?.length) && <div className={styles.swatches} aria-label="Product colours">
          {product.colors!.map((color, index) => <span key={`${color}-${index}`} style={{ backgroundColor: color }} />)}
        </div>}
      </div>
      <div className={styles.purchase}>
        <strong>{formatPrice(product.price)}</strong>
        <button ref={addButton} type="button" onClick={trigger} disabled={sold || fixedInCart}
          aria-expanded={product.isMerch && sizes.length > 1 ? showSizePicker : undefined}
          aria-controls={showSizePicker ? sizePickerId : undefined}
          aria-label={`${actionLabel} — ${product.name}`}>
          {justAdded ? <Check size={15} aria-hidden="true" /> : !sold && !fixedInCart ? <Plus size={15} aria-hidden="true" /> : null}
          {actionLabel}
        </button>
      </div>
      {showSizePicker && !sold && <div id={sizePickerId} className={styles.sizePicker} role="group" aria-label={`Choose a size for ${product.name}`}
        onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeSizes(); } }}>
        <div><span>Choose your size</span><button type="button" onClick={closeSizes} aria-label="Close size choices"><X size={15} aria-hidden="true" /></button></div>
        <div>{sizes.map((size, index) => <button ref={index === 0 ? firstSize : undefined} type="button" key={size} onClick={() => { pickSize(size); addButton.current?.focus(); }} aria-label={`Add ${product.name}, size ${size}`}>{size}</button>)}</div>
      </div>}
    </article>
  );
}
