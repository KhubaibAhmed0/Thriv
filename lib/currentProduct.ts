/**
 * lib/currentProduct.ts
 *
 * Tiny module store that lets layout-level chrome (the WhatsApp FAB, audit
 * F-75) ask about the product currently being viewed. The PDP is deep in the
 * tree and shares no context with the root layout, so a module-level store +
 * subscription is the smallest bridge. SSR-safe: the snapshot is null on the
 * server and until a PDP mounts.
 */

import { useSyncExternalStore } from 'react';

export interface CurrentProductInfo {
  name: string;
  brand: string;
  size?: string | null;
  condition?: string;
}

const EVENT = 'thriv:current-product';

let current: CurrentProductInfo | null = null;

export function setCurrentProduct(info: CurrentProductInfo | null): void {
  current = info;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function getCurrentProduct(): CurrentProductInfo | null {
  return current;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

export function useCurrentProduct(): CurrentProductInfo | null {
  return useSyncExternalStore(subscribe, getCurrentProduct, () => null);
}
