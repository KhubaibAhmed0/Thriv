'use client';

/**
 * components/WishlistProvider.tsx
 *
 * Persisted wishlist (audit F-24). The heart buttons on cards and PDPs used
 * to be local no-op state; saving now survives reloads via localStorage and
 * powers the /wishlist page. No account needed.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'thriv_wishlist_v1';

interface WishlistContextType {
  slugs: string[];
  count: number;
  isSaved: (slug: string) => boolean;
  toggle: (slug: string) => void;
  /** True once localStorage has been read. */
  isHydrated: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount (SSR has no storage).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((s): s is string => typeof s === 'string');
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot localStorage hydration
          setSlugs(clean);
        }
      }
    } catch {
      // Corrupt storage: start from an empty wishlist.
    }
    setIsHydrated(true);
  }, []);

  // Persist changes (skip until hydrated so we never clobber saved data).
  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
    } catch {
      // Storage full/blocked: wishlist still works for this session.
    }
  }, [slugs, isHydrated]);

  const toggle = useCallback((slug: string) => {
    setSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }, []);

  const isSaved = useCallback(
    (slug: string) => slugs.includes(slug),
    [slugs]
  );

  const value = useMemo(
    () => ({ slugs, count: slugs.length, isSaved, toggle, isHydrated }),
    [slugs, isSaved, toggle, isHydrated]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextType {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return ctx;
}
