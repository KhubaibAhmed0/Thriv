'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/FormFields';
import { Button } from '@/components/ui/Button';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Successful login
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-[#111111]">
      <div className="w-full max-w-sm bg-[#181818] border border-[#282828] rounded-[20px] p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[10px] bg-white flex items-center justify-center text-[#111111] shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">Admin Portal</h1>
            <p className="text-xs text-neutral-400">Thriv Dispatch & Orders</p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-800/40 rounded-[12px] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
              className="w-full bg-[#202020] border border-[#303030] rounded-[10px] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-400 transition-colors"
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
              className="w-full bg-[#202020] border border-[#303030] rounded-[10px] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-400 transition-colors"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-sm font-bold bg-white text-[#111111] hover:bg-neutral-200 rounded-full flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
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

        <p className="text-[11px] text-center text-neutral-500 mt-6">
          Authorized personnel only. Access is monitored.
        </p>
      </div>
    </div>
  );
}
