/**
 * lib/validation.ts
 *
 * Shared checkout validators — single source of truth for the province list
 * and Pakistani phone handling. Used by both the checkout form (client) and
 * the orders API (server) so the two can no longer drift (audit F-29).
 */

import type { Province } from '@/types';

export const PROVINCES: readonly Province[] = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Gilgit-Baltistan',
  'Azad Jammu & Kashmir',
  'Islamabad Capital Territory',
];

export function isProvince(value: string): value is Province {
  return (PROVINCES as readonly string[]).includes(value);
}

/**
 * Normalizes the phone formats people actually type/paste into a single
 * canonical form: 0XXXXXXXXXX (11 digits, leading 0).
 *
 * Accepts: 03001234567 · +92 300 1234567 · 0092-300-1234567 · 923001234567
 */
export function normalizePakistaniPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  let d = digits;
  if (d.startsWith('0092')) {
    d = d.slice(4);
  } else if (d.startsWith('92')) {
    d = d.slice(2);
  }
  if (d.startsWith('0')) return d;
  return `0${d}`;
}

/** True when the input normalizes to a valid Pakistani number (0 + 10 digits). */
export function isValidPakistaniPhone(input: string): boolean {
  return /^0\d{10}$/.test(normalizePakistaniPhone(input));
}
