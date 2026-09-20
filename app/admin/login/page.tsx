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
    <div className="min-h-[80vh] flex flex-col justify-center items-center px-4 py-12 bg-[#F5F3F0]">
      <div className="w-full max-w-sm bg-[#EDEBE8] border border-[#E2E0DC] rounded-[20px] p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[10px] bg-[#111111] flex items-center justify-center text-white shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#111111] tracking-tight">Admin Portal</h1>
            <p className="text-xs text-[#9A9A9A]">Thriv Dispatch & Orders</p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3.5 bg-[#F5E6E6] border border-[#E2C2C2] rounded-[12px] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#8B2020] shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-[#8B2020] leading-relaxed">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            id="admin-email"
            type="email"
            label="Email Address"
            placeholder="admin@thriv.pk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <Input
            id="admin-password"
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={loading}
              className="py-3.5 text-sm font-bold"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </form>

        <p className="text-[11px] text-center text-[#9A9A9A] mt-6">
          Authorized personnel only. Access is monitored.
        </p>
      </div>
    </div>
  );
}
