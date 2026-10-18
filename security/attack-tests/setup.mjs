// security/attack-tests/setup.mjs
// Creates (or resets) the two attack-test accounts on the target Supabase project
// and writes their fresh credentials to a local file outside the repo.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node setup.mjs <creds-out.json>
//
// Passwords are random on every run. The output file is credentials material --
// never commit it, never print it.

import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { totp } from './totp.mjs';

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';
const outPath = process.argv[2];

if (!url || !serviceKey || !anonKey || !outPath) {
  console.error('usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node setup.mjs <creds-out.json>');
  process.exit(1);
}

const baseHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

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

function randomPassword() {
  return randomBytes(18).toString('base64url');
}

async function findUser(email) {
  let page = 1;
  for (;;) {
    const r = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    if (r.status !== 200 || !Array.isArray(r.body?.users)) return null;
    const hit = r.body.users.find((u) => u.email === email);
    if (hit) return hit;
    if (r.body.users.length < 200) return null;
    page += 1;
  }
}

async function ensureUser(email) {
  const password = randomPassword();
  let user = await findUser(email);
  if (!user) {
    const c = await api('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (c.status >= 300) throw new Error(`create ${email}: ${c.status} ${JSON.stringify(c.body)}`);
    user = c.body.user || c.body;
  } else {
    const u = await api(`/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
    if (u.status >= 300) throw new Error(`update ${email}: ${u.status} ${JSON.stringify(u.body)}`);
  }
  return { id: user.id, email, password };
}

async function ensureAdmin(user) {
  const r = await api('/rest/v1/admins', {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: user.id, email: user.email }),
  });
  if (r.status >= 300) throw new Error(`admins insert: ${r.status} ${JSON.stringify(r.body)}`);
}

async function resetAndEnrollMfa(admin, anonKey) {
  // Admin-level list/delete work on this GoTrue build; enrollment/verify do not
  // (POST /admin/.../factors → 405). Use the user-level factor endpoints with a
  // password-grant access token — this is exactly the flow the app's admin
  // login will use, so the fixture run doubles as a probe.
  const existing = await api(`/auth/v1/admin/users/${admin.id}/factors`);
  if (existing.status >= 300) throw new Error(`list factors: ${existing.status} ${JSON.stringify(existing.body)}`);
  for (const f of existing.body || []) {
    const d = await api(`/auth/v1/admin/users/${admin.id}/factors/${f.id}`, { method: 'DELETE' });
    if (d.status >= 300) throw new Error(`delete factor: ${d.status} ${JSON.stringify(d.body)}`);
  }

  const signIn = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: admin.email, password: admin.password }),
  });
  if (signIn.status >= 300) throw new Error(`sign-in for MFA: ${signIn.status} ${JSON.stringify(signIn.body)}`);
  const userToken = signIn.body.access_token;
  if (!userToken) throw new Error('sign-in for MFA returned no access token');

  const userHeaders = { apikey: anonKey, Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };
  async function ureq(path, init = {}) {
    const res = await fetch(`${url}${path}`, { headers: userHeaders, ...init });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  }

  const enroll = await ureq('/auth/v1/factors', {
    method: 'POST',
    body: JSON.stringify({ factor_type: 'totp', friendly_name: 'Thriv attack test' }),
  });
  if (enroll.status >= 300) throw new Error(`enroll: ${enroll.status} ${JSON.stringify(enroll.body)}`);
  const factor = enroll.body;

  const challenge = await ureq(`/auth/v1/factors/${factor.id}/challenge`, { method: 'POST', body: '{}' });
  if (challenge.status >= 300) throw new Error(`challenge: ${challenge.status} ${JSON.stringify(challenge.body)}`);

  const code = totp(factor.totp.secret);
  const verify = await ureq(`/auth/v1/factors/${factor.id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challenge.body.id, code }),
  });
  if (verify.status >= 300) throw new Error(`verify: ${verify.status} ${JSON.stringify(verify.body)}`);

  return {
    factorId: factor.id,
    secret: factor.totp.secret,
    verifyKeys: verify.body && typeof verify.body === 'object' ? Object.keys(verify.body) : typeof verify.body,
    verifyHasSession: Boolean(verify.body && verify.body.access_token),
  };
}

const user = await ensureUser('thriv.attacktest.user@example.com');
const admin = await ensureUser('thriv.attacktest.admin@example.com');
await ensureAdmin(admin);
const mfa = await resetAndEnrollMfa(admin, anonKey);

writeFileSync(
  outPath,
  JSON.stringify(
    {
      supabaseUrl: url,
      userEmail: user.email,
      userPassword: user.password,
      userId: user.id,
      adminEmail: admin.email,
      adminPassword: admin.password,
      adminUserId: admin.id,
      adminTotpSecret: mfa.secret,
      adminTotpFactorId: mfa.factorId,
    },
    null,
    2,
  ),
);

console.log('setup ok');
console.log('user id:', user.id);
console.log('admin id:', admin.id);
console.log('mfa factor id:', mfa.factorId);
console.log('mfa verify response keys:', JSON.stringify(mfa.verifyKeys));
console.log('mfa verify returned session:', mfa.verifyHasSession);
