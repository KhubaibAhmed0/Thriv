'use client';

import { useEffect } from 'react';

/**
 * Last-resort error boundary: rendered in place of the root layout, so it
 * carries its own <html>/<body> and inline styles (global CSS may be absent).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[thriv] global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#F5F3F0',
          color: '#111111',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#67635D',
            }}
          >
            thriv
          </p>
          <h1
            style={{
              margin: '0 0 16px',
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            Something went wrong.
          </h1>
          <p
            style={{
              margin: '0 0 28px',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#444444',
            }}
          >
            An unexpected error interrupted the app. Your cart is saved on this
            device.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              display: 'inline-block',
              minHeight: 44,
              padding: '12px 28px',
              borderRadius: 9999,
              border: 'none',
              background: '#111111',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          {/* global-error renders when the app router itself may be broken;
              a plain <a> keeps navigation working without it. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: 'inline-block',
              minHeight: 44,
              marginLeft: 12,
              padding: '12px 28px',
              borderRadius: 9999,
              border: '1px solid #E2E0DC',
              background: '#FFFFFF',
              color: '#111111',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Back to Home
          </a>
        </div>
      </body>
    </html>
  );
}
