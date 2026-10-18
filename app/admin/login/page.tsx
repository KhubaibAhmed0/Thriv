'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { TurnstileWidget } from '@/components/TurnstileWidget';

type Stage = 'password' | 'mfa' | 'setup';

/**
 * Admin sign-in (Phase 3, 2026-10-18 brief): password → MFA.
 *
 * The server never sets the admin cookie on a password alone. A correct
 * password yields either `mfa_required` (existing authenticator) or
 * `mfa_setup` + QR (first login), both as 401 responses with an httpOnly
 * ticket cookie; the cookie is only granted after the TOTP code verifies.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileUnavailable, setTurnstileUnavailable] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);
  // Honeypot — always empty for humans; bots helpfully fill it in.
  const [honeypot, setHoneypot] = useState('');

  const resetTurnstile = () => {
    setTurnstileToken(null);
    setWidgetKey((k) => k + 1);
  };

  const backToPassword = (message: string) => {
    setStage('password');
    setCode('');
    setError(message || null);
    setLoading(false);
    resetTurnstile();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          turnstile_token: turnstileToken,
          website: honeypot,
        }),
      });

      const data = await res.json().catch(() => ({}));

      // Phase 3: a 401 carrying mfa_setup / mfa_required means the password
      // was correct — advance to the authenticator step.
      if (data.mfa_setup === true) {
        setQrDataUri(typeof data.qr_data_uri === 'string' ? data.qr_data_uri : null);
        setManualKey(typeof data.manual_key === 'string' ? data.manual_key : null);
        setCode('');
        setError(null);
        setStage('setup');
        setLoading(false);
        return;
      }
      if (data.mfa_required === true) {
        setCode('');
        setError(null);
        setStage('mfa');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please check your credentials.');
        setLoading(false);
        // Single-use Turnstile token: reset the widget for the retry.
        resetTurnstile();
        return;
      }

      // Defensive: a success response without MFA should not exist; continue.
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success === true) {
        router.replace('/admin');
        router.refresh();
        return;
      }

      if (
        data.code === 'MFA_EXPIRED' ||
        data.code === 'MFA_LOCKED' ||
        data.code === 'TOO_MANY_ATTEMPTS'
      ) {
        backToPassword(
          data.error || 'Your sign-in session expired. Please sign in again.'
        );
        return;
      }

      setError(data.error || 'That code was not correct. Please try again.');
      setCode('');
      setLoading(false);
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <main data-admin className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-black">
      <div className="w-full max-w-sm bg-admin-bg border border-admin-line rounded-[20px] p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[10px] bg-white flex items-center justify-center text-black shrink-0">
            {stage === 'password' ? (
              <Lock className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">
              {stage === 'password'
                ? 'Admin Portal'
                : stage === 'setup'
                  ? 'Set Up Two-Factor'
                  : 'Two-Factor Verification'}
            </h1>
            <p className="text-xs text-neutral-400">
              {stage === 'password'
                ? 'Thriv Dispatch & Orders'
                : stage === 'setup'
                  ? 'Required for first sign-in'
                  : 'Enter your authenticator code'}
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-800/40 rounded-[12px] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        {stage === 'password' ? (
          /* ── Step 1: password ── */
          <form onSubmit={handlePasswordSubmit} className="space-y-4 relative" noValidate>
            {/* Honeypot — display:none so browser autofill and password
                managers never touch it (off-screen fields get filled);
                naive bots that fill every input still get caught. */}
            <div className="hidden" aria-hidden="true">
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="admin-email">
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                placeholder="admin@thriv.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            <TurnstileWidget
              key={widgetKey}
              theme="dark"
              onToken={(token) => {
                setTurnstileToken(token);
                // A real token means the widget works; clear any earlier
                // unavailable state.
                if (token) setTurnstileUnavailable(false);
              }}
              onUnavailable={() => setTurnstileUnavailable(true)}
              className="flex justify-center"
            />

            <div className="pt-2">
              <button
                type="submit"
                // Submit stays disabled until a token exists OR the widget is
                // definitively unable to produce one (script blocked, key
                // missing, widget error). Without the second clause a fast
                // click during load/remount sent a token-less request and the
                // server answered the generic 400 (live report, 2026-10-18).
                disabled={loading || (!turnstileToken && !turnstileUnavailable)}
                className="w-full py-3.5 text-sm font-bold bg-white text-black hover:bg-neutral-200 rounded-full flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ── Step 2: authenticator code ── */
          <form onSubmit={handleVerifySubmit} className="space-y-4" noValidate>
            {stage === 'setup' && (
              <div className="space-y-3">
                {qrDataUri && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUri}
                    alt="Two-factor QR code"
                    width={180}
                    height={180}
                    className="mx-auto rounded-[12px] bg-white p-2"
                  />
                )}
                {manualKey && (
                  <div className="text-center">
                    <p className="text-[11px] text-neutral-400">Or enter this key manually:</p>
                    <p className="mt-1 font-mono text-xs text-white break-all select-all">
                      {manualKey}
                    </p>
                  </div>
                )}
                <p className="text-xs text-neutral-400 leading-relaxed text-center">
                  Scan with an authenticator app (Google Authenticator, Authy), then
                  enter the 6-digit code it shows.
                </p>
              </div>
            )}

            {stage === 'mfa' && (
              <p className="text-xs text-neutral-400 leading-relaxed">
                Enter the 6-digit code from your authenticator app.
              </p>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="admin-mfa-code">
                6-Digit Code
              </label>
              <input
                id="admin-mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-sm font-bold bg-white text-black hover:bg-neutral-200 rounded-full flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    {stage === 'setup' ? 'Confirm & Continue' : 'Verify'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => backToPassword('')}
                className="w-full text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Back to sign-in
              </button>
            </div>
          </form>
        )}

        <p className="text-[11px] text-center text-neutral-400 mt-6">
          Authorized personnel only. Access is monitored.
        </p>
      </div>
    </main>
  );
}
