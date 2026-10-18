// security/attack-tests/teardown.mjs
// Removes the attack-test fixtures from the target Supabase project:
//   - both auth users (thriv.attacktest.user@ / thriv.attacktest.admin@)
//   - the admins row for the test admin
//   - the fixture rate-limit counters and login-attempt rows
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node teardown.mjs [creds.json]
//
// The creds file (default: ~/.config/thriv/attack-test-creds.json) is read when
// present for exact user ids; without it the known test emails are looked up.
// Safe to run twice. Never prints keys or tokens.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const credsPath =
  process.argv[2] || join(homedir(), '.config', 'thriv', 'attack-test-creds.json');

if (!url || !serviceKey) {
  console.error('usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node teardown.mjs [creds.json]');
  process.exit(1);
}

let creds = null;
if (existsSync(credsPath)) {
  try {
    creds = JSON.parse(readFileSync(credsPath, 'utf8'));
  } catch {
    creds = null;
  }
}

const USER_EMAIL = 'thriv.attacktest.user@example.com';
const ADMIN_EMAIL = 'thriv.attacktest.admin@example.com';

const baseHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function api(path, init = {}) {
  const res = await fetch(`${url}${path}`, { headers: baseHeaders, ...init });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function findUser(email) {
  for (let page = 1; ; page += 1) {
    const r = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    if (r.status !== 200 || !Array.isArray(r.body?.users)) return null;
    const hit = r.body.users.find((u) => u.email === email);
    if (hit) return hit;
    if (r.body.users.length < 200) return null;
  }
}

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

let removedUsers = 0;

// admins row first (may hold an FK to auth.users)
if (creds?.adminUserId) {
  const r = await api(`/rest/v1/admins?user_id=eq.${creds.adminUserId}`, {
    method: 'DELETE',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
  });
  console.log(`admins row delete: status=${r.status}`);

  // order_events.created_by references auth.users — the fixture admin's
  // status updates (test order lifecycle) must be detached before the user
  // row can go. The events stay; only the "who" is cleared.
  const ev = await api(`/rest/v1/order_events?created_by=eq.${creds.adminUserId}`, {
    method: 'PATCH',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ created_by: null }),
  });
  console.log(`order_events created_by nulled: status=${ev.status}`);
}

for (const email of [USER_EMAIL, ADMIN_EMAIL]) {
  const user = await findUser(email);
  if (!user) {
    console.log(`${email}: no auth user (already removed)`);
    continue;
  }
  let del = await api(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE' });
  if (del.status >= 300) {
    // A user carrying an MFA factor fails to delete on this GoTrue build —
    // remove factors first, then retry once.
    const fac = await api(`/auth/v1/admin/users/${user.id}/factors`);
    if (fac.status < 300 && Array.isArray(fac.body)) {
      for (const f of fac.body) {
        await api(`/auth/v1/admin/users/${user.id}/factors/${f.id}`, { method: 'DELETE' });
      }
    }
    del = await api(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE' });
  }
  console.log(`${email}: delete status=${del.status}`);
  if (del.status >= 300 && del.body?.msg) console.log(`  (${del.body.msg})`);
  if (del.status < 300) removedUsers += 1;
}

// Fixture counters, best-effort (they also expire on their own).
const hashes = [];
if (creds?.adminEmail) {
  hashes.push(sha256Hex(`admin-login-acct:${creds.adminEmail.trim().toLowerCase()}`));
}
if (creds?.adminUserId) {
  hashes.push(sha256Hex(`admin-mfa-uid:${creds.adminUserId}`));
}
if (hashes.length) {
  const r = await api(`/rest/v1/rate_limits?key_hash=in.(${hashes.join(',')})`, {
    method: 'DELETE',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
  });
  console.log(`rate_limits rows delete: status=${r.status}`);
} else {
  console.log('rate_limits: skipped (no creds file — hashes unknown)');
}

for (const email of [USER_EMAIL, ADMIN_EMAIL]) {
  const r = await api(`/rest/v1/admin_login_attempts?email=eq.${email}`, {
    method: 'DELETE',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
  });
  console.log(`admin_login_attempts (${email}) delete: status=${r.status}`);
}

console.log(`teardown done — users removed: ${removedUsers}/2`);
