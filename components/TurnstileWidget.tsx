'use client';

/**
 * components/TurnstileWidget.tsx
 *
 * Cloudflare Turnstile (2026-10-18 brief, Phase 4a/3c) — explicit render, no
 * npm dependency. The script origin and iframe origin are added to the CSP in
 * next.config.ts; both must ship in the same deploy as this component.
 *
 * Contract with the parent form:
 *  - `onToken(token)` fires with the token after a solve, and with `null` on
 *    expiry or error (the parent re-enables the widget — remount via `key` —
 *    and disables submit until a fresh token arrives).
 *  - `onReady()` fires only when the widget actually rendered. If the site
 *    key is missing or the script never loads, submit stays ENABLED and the
 *    server rejects the request (fail closed with a visible error) instead of
 *    a dead button.
 */

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
  onReady?: () => void;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export function TurnstileWidget({
  onToken,
  onReady,
  action,
  theme = 'auto',
  className,
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Keep the latest callbacks without re-running the render effect.
  const onTokenRef = useRef(onToken);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onTokenRef.current = onToken;
    onReadyRef.current = onReady;
  }, [onToken, onReady]);

  // No site key in the build: clear any token expectation once — never during
  // render (review fix).
  useEffect(() => {
    if (!siteKey) onTokenRef.current(null);
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey || !scriptLoaded) return;

    const el = containerRef.current;
    const turnstile = typeof window !== 'undefined' ? window.turnstile : undefined;
    if (!el || !turnstile || widgetIdRef.current) return;

    widgetIdRef.current = turnstile.render(el, {
      sitekey: siteKey,
      theme,
      ...(action ? { action } : {}),
      callback: (token: string) => onTokenRef.current(token),
      'expired-callback': () => onTokenRef.current(null),
      'error-callback': () => onTokenRef.current(null),
    });
    onReadyRef.current?.();

    return () => {
      try {
        if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
      } catch {
        // Widget teardown is best-effort.
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, scriptLoaded, action, theme]);

  if (!siteKey) {
    // Render nothing, never claim to be ready.
    return null;
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        // onReady also fires when the script was already loaded (client-side
        // navigation), so a cached script never leaves the widget dormant.
        onReady={() => setScriptLoaded(true)}
        onError={() => {
          // Blocked or failed to load — leave submit enabled; the server
          // rejects the request (fail closed) and the user sees the error.
          onTokenRef.current(null);
        }}
      />
      <div ref={containerRef} className={className} />
    </>
  );
}
