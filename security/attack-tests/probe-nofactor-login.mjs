// No-factor admin login probe — reproduces the owner's exact first-login path:
// password → /user (no factors) → enroll → mfa_setup payload → verify TOTP →
// aal2 admin cookie → protected endpoint. Local or prod: BASE_URL env.
//
//   local:  BASE_URL=http://127.0.0.1:3210 node probe-nofactor-login.mjs
//   prod:   BASE_URL=https://thriv-five.vercel.app node probe-nofactor-login.mjs
//
// Creates a throwaway admin (NO factor) via the service key, runs the flow,
// then deletes the user + admins row + known rate-limit buckets.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const { totp } = await import(pathToFileURL(resolve('security/attack-tests/totp.mjs')).href);

const env = {};
for (const line of readFileSync(join(homedir(), '.config', 'thriv', 'supabase-keys.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: svc } = env;

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3210').replace(/\/+$/, '');
const IS_PROD = !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(BASE);
const IP = process.env.PROBE_IP || '198.51.100.201';
const sha = (s) => createHash('sha256').update(s).digest('hex');

const ts = Date.now();
const email = `nofactor-probe-${ts}@thriv.pk`;
const emailKey = email.toLowerCase();
const password = `Probe!${Math.random().toString(36).slice(2)}Aa1`;
const j = (b) => JSON.stringify(b);
const H = (key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra });

let userId = null;
let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${detail}`); }
};
const setCookieList = (res) =>
  res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);

try {
  // ── fixture: temp admin, zero factors ─────────────────────────────────
  let r = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST', headers: H(svc),
    body: j({ email, password, email_confirm: true }),
  });
  const u = await r.json();
  if (!u.id) throw new Error('create user failed: ' + j(u));
  userId = u.id;
  console.log(`fixture admin created (no factor): ${userId}`);

  r = await fetch(`${url}/rest/v1/admins`, {
    method: 'POST', headers: { ...H(svc), Prefer: 'return=minimal' },
    body: j({ user_id: userId, email }),
  });
  check('fixture admins row inserted', r.status < 300, `status ${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`);

  // ── 1. password → must reach the enroll branch (mfa_setup), not 500 ───
  r = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE, ...(IS_PROD ? {} : { 'X-Forwarded-For': IP }) },
    body: j({ email, password, turnstile_token: 'probe-dummy-token' }),
  });
  const loginBody = await r.json().catch(() => null);
  console.log(`login: status=${r.status} bodyKeys=${loginBody && typeof loginBody === 'object' ? Object.keys(loginBody).join(',') : typeof loginBody}`);
  check('login 401 + mfa_setup (owner path, not 500)', r.status === 401 && loginBody?.mfa_setup === true, `status=${r.status} body=${j(loginBody)?.slice(0, 200)}`);
  check('qr_data_uri is svg+base64 data URI', typeof loginBody?.qr_data_uri === 'string' && loginBody.qr_data_uri.startsWith('data:image/svg+xml;base64,') && loginBody.qr_data_uri.length > 1000, `len=${loginBody?.qr_data_uri?.length ?? 'n/a'}`);
  check('manual_key is 32-char base32', typeof loginBody?.manual_key === 'string' && /^[A-Z2-7]{32}$/.test(loginBody.manual_key), `type=${typeof loginBody?.manual_key}`);
  const ticketCookie = setCookieList(r).find((c) => c.startsWith('__Host-thriv_mfa_ticket='));
  check('mfa ticket cookie set', !!ticketCookie);

  // ── 2. correct TOTP → aal2 admin cookie ────────────────────────────────
  if (ticketCookie && typeof loginBody?.manual_key === 'string') {
    const code = totp(loginBody.manual_key);
    r = await fetch(`${BASE}/api/admin/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE, Cookie: ticketCookie.split(';')[0], ...(IS_PROD ? {} : { 'X-Forwarded-For': IP }) },
      body: j({ code }),
    });
    const vBody = await r.json().catch(() => null);
    console.log(`mfa/verify: status=${r.status} bodyKeys=${vBody && typeof vBody === 'object' ? Object.keys(vBody).join(',') : typeof vBody}`);
    check('mfa verify 200', r.status === 200, `status=${r.status} body=${j(vBody)?.slice(0, 200)}`);
    const adminCookie = setCookieList(r).find((c) => c.startsWith('__Host-thriv_admin_token='));
    check('aal2 admin cookie set', !!adminCookie);

    // ── 3. protected admin endpoint with the cookie ──────────────────────
    if (adminCookie) {
      r = await fetch(`${BASE}/api/admin/orders`, { headers: { Cookie: adminCookie.split(';')[0] } });
      check('admin endpoint 200 with cookie', r.status === 200, `status=${r.status}`);
    }
  }
} catch (e) {
  fail++;
  console.log('ERROR:', e.message);
} finally {
  if (userId) {
    let r = await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: H(svc) });
    console.log('cleanup user:', r.status);
    r = await fetch(`${url}/rest/v1/admins?user_id=eq.${userId}`, { method: 'DELETE', headers: { ...H(svc), Prefer: 'return=minimal' } });
    console.log('cleanup admins:', r.status);
    const hashes = [
      sha(`admin-login-acct:${emailKey}`),
      sha(`admin-mfa-uid:${userId}`),
      ...(IS_PROD ? [] : [sha(`admin-login:${IP}`), sha(`admin-mfa:${IP}`)]),
    ].join(',');
    r = await fetch(`${url}/rest/v1/rate_limits?key_hash=in.(${hashes})`, { method: 'DELETE', headers: { ...H(svc), Prefer: 'return=minimal' } });
    console.log('cleanup rate_limits:', r.status, IS_PROD ? '(IP-scoped rows expire on their own)' : '');
    r = await fetch(`${url}/rest/v1/admin_login_attempts?email=eq.${encodeURIComponent(emailKey)}`, { method: 'DELETE', headers: { ...H(svc), Prefer: 'return=minimal' } });
    console.log('cleanup login_attempts(email):', r.status);
  }
  console.log(`RESULT: ${pass} passed, ${fail} failed — ${IS_PROD ? 'PROD' : 'local'} ${BASE}`);
  process.exitCode = fail ? 1 : 0;
}
