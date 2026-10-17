'use client';

import React, { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface AdminToastState {
  kind: 'success' | 'error';
  message: string;
}

/**
 * Fixed, announced status toast — audit F-77: replaces window.alert() calls
 * with a non-blocking, screen-reader-announced message.
 */
export function AdminToast({
  toast,
  onDismiss,
}: {
  toast: AdminToastState | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[60] flex items-center gap-2.5 bg-admin-raised border border-admin-line-strong text-white text-sm font-medium px-4 py-3 rounded-[12px] shadow-2xl max-w-[92vw]"
    >
      {toast.kind === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
      ) : (
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
      )}
      <span>{toast.message}</span>
    </div>
  );
}

/**
 * Small accessible confirm dialog — audit F-77: replaces window.confirm().
 * Focuses the confirm button on open, closes on Escape or backdrop click.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  busy = false,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm bg-admin-bg border border-admin-line-strong rounded-[16px] p-5 space-y-4"
      >
        <h2 id={titleId} className="text-sm font-bold text-white">
          {title}
        </h2>
        <p className="text-xs text-neutral-300 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-4 text-xs font-semibold text-neutral-300 hover:text-white bg-admin-field hover:bg-admin-raised border border-admin-line rounded-full transition-colors cursor-pointer"
          >
            Keep
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-11 px-5 text-xs font-bold rounded-full transition-colors disabled:opacity-50 cursor-pointer ${
              destructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-white text-black hover:bg-neutral-200'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
