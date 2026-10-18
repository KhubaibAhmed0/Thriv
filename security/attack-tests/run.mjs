// security/attack-tests/run.mjs
//
// Phase 7 attack suite for the Thriv storefront (2026-10-18 hardening brief).
//
// Zero dependencies — Node's fetch + the local TOTP helper only.
//
// Usage:
//   node run.mjs                 # local suite against BASE_URL (default :3210)
//   SUITE=prod BASE_URL=https://thriv-five.vercel.app node run.mjs
//   node run.mjs out.md          # also writes the markdown table to a file
//
// Environment:
//   BASE_URL    target origin          (default http://127.0.0.1:3210)
//   SUITE       'local' | 'prod'       (default local; prod = read-only subset)
//   CREDS_PATH  fixture credentials    (default ~/.config/thriv/attack-test-creds.json)
//   SUPABASE_ANON_KEY  needed for the aal1/non-admin Bearer checks (local only)
//
// This script never prints credentials, tokens, cookies, or the TOTP secret.

import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { totp } from './totp.mjs';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3210').replace(/\/+$/, '');
const SUITE = process.env.SUITE === 'prod' ? 'prod' : 'local';
const CREDS_PATH =
  process.env.CREDS_PATH || join(homedir(), '.config', 'thriv', 'attack-test-creds.json');

const results = [];
const state = {
  creds: null,
  productSlug: null,
  orderNumber: null,
  publicToken: null,
  idempotencyKey: randomUUID(),
  ticket: null,
  adminCookie: null,
};

// Every run uses fresh source IPs (IP_OFFSET=100 for a re-run) so fixed-window
// counters left by a previous run cannot poison this one.
const IP_BASE = Number(process.env.IP_OFFSET || 0);
let ipCounter = 10;
function fakeIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter + IP_BASE}`;
}

// ── HTTP helper ───────────────────────────────────────────────────────

async function req(path, { method = 'GET', headers = {}, body, ip, cookie } = {}) {
  const h = { ...headers };
  if (ip) h['x-vercel-forwarded-for'] = ip;
  if (cookie) h.cookie = cookie;
  let payload = body;
  if (body !== undefined && typeof body !== 'string') {
    h['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: payload,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* html or empty */
  }
  const setCookies = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') || '')
        .split(/,(?=[^;,]+=)/)
        .filter(Boolean);
  return { status: res.status, headers: res.headers, text, json, setCookies };
}

function cookieValue(setCookies, name) {
  const hit = setCookies.find((c) => c.startsWith(name + '='));
  if (!hit) return null;
  return hit.slice(name.length + 1).split(';')[0];
}

function cookieFlags(setCookies, name) {
  return setCookies.find((c) => c.startsWith(name + '=')) || '';
}

// ── fixtures / payloads ───────────────────────────────────────────────

function baseOrderPayload(overrides = {}) {
  return {
    idempotency_key: randomUUID(),
    customer_name: 'Attack Test Order',
    customer_phone: '03001234567',
    customer_email: 'thriv.attacktest.user@example.com',
    address_line: 'Test address 123, Block A',
    city: 'Karachi',
    province: 'Sindh',
    payment_method: 'cash-on-delivery',
    agreed_to_final_sale: true,
    items: [{ product_slug: state.productSlug || 'missing', quantity: 1 }],
    turnstile_token: 'XXXX.DUMMY.TOKEN.XXXX',
    website: '',
    ...overrides,
  };
}

async function loadCreds() {
  if (state.creds) return state.creds;
  try {
    state.creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'));
  } catch (err) {
    state.creds = null;
    throw new Error(`cannot read fixture credentials (${err.code || err.message})`);
  }
  return state.creds;
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(BASE + '/', { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ── test registry ─────────────────────────────────────────────────────

async function test(id, name, prodSafe, run) {
  if (SUITE === 'prod' && !prodSafe) {
    results.push({ id, name, prodSafe, pass: null, observed: 'skipped (prod subset)' });
    return;
  }
  try {
    const r = await run();
    results.push({ id, name, prodSafe, pass: !!r.pass, observed: String(r.detail ?? '') });
  } catch (err) {
    results.push({
      id,
      name,
      prodSafe,
      pass: false,
      observed: `threw: ${err && err.message ? err.message : err}`,
    });
  }
}

// ══════════════════════════ suite ═══════════════════════════════════════

const serverUp = await waitForServer();
if (!serverUp) {
  console.error(`Server not reachable at ${BASE}. Start it first (PORT=3210 npm run start).`);
  process.exit(2);
}

const evil = { origin: 'https://evil.example' };

async function headCheck() {
  const r = await req('/');
  const csp = r.headers.get('content-security-policy') || '';
  const directives = Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [k, ...v] = d.split(/\s+/);
        return [k, v.join(' ')];
      })
  );
  const checks = {
    status200: r.status === 200,
    frameAncestorsNone: directives['frame-ancestors'] === "'none'",
    objectSrcNone: directives['object-src'] === "'none'",
    baseUriSelf: directives['base-uri'] === "'self'",
    formActionSelf: directives['form-action'] === "'self'",
    scriptCf: (directives['script-src'] || '').includes('challenges.cloudflare.com'),
    frameCf: (directives['frame-src'] || '').includes('challenges.cloudflare.com'),
    xfoDeny: r.headers.get('x-frame-options') === 'DENY',
    nosniff: r.headers.get('x-content-type-options') === 'nosniff',
    referrer: Boolean(r.headers.get('referrer-policy')),
    permissions: Boolean(r.headers.get('permissions-policy')),
    noPoweredBy: !r.headers.get('x-powered-by'),
  };
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  return { pass: failed.length === 0, detail: failed.length ? `failed: ${failed.join(', ')}` : 'all header checks ok' };
}

// ── A. headers / config ───────────────────────────────────────────────

await test(1, 'CSP + security headers on /', true, headCheck);

await test(2, 'X-Robots-Tag noindex on /admin/login', true, async () => {
  const r = await req('/admin/login');
  const tag = r.headers.get('x-robots-tag') || '';
  return { pass: r.status === 200 && /noindex/i.test(tag), detail: `status=${r.status} x-robots-tag=${tag || '(none)'}` };
});

await test(3, 'Unauth /api/admin/orders → 401 + noindex', true, async () => {
  const r = await req('/api/admin/orders');
  const tag = r.headers.get('x-robots-tag') || '';
  return { pass: r.status === 401 && /noindex/i.test(tag), detail: `status=${r.status} x-robots-tag=${tag || '(none)'}` };
});

await test(4, 'Order page: noindex, token not in title', true, async () => {
  const token = randomUUID();
  const r = await req(`/order/${token}`);
  const title = (r.text.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  const pass =
    r.status === 200 && /noindex/i.test(r.text) && !title.includes(token);
  return { pass, detail: `status=${r.status} title=${JSON.stringify(title)} noindex=${/noindex/i.test(r.text)}` };
});

await test(5, 'Old /order/<THR-> and /api/orders/<THR-> → 404', true, async () => {
  const a = await req('/order/THR-123456');
  const b = await req('/api/orders/THR-123456');
  return { pass: a.status === 404 && b.status === 404, detail: `page=${a.status} api=${b.status}` };
});

// ── B. checkout hardening (local only) ────────────────────────────────

await test(6, 'Checkout: cross-origin POST → 403', false, async () => {
  const r = await req('/api/orders', {
    method: 'POST',
    headers: evil,
    body: baseOrderPayload(),
    ip: fakeIp(),
  });
  return { pass: r.status === 403, detail: `status=${r.status}` };
});

await test(7, 'Checkout: malformed + oversized bodies → 400', false, async () => {
  const bad = await req('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not-json{{{',
    ip: fakeIp(),
  });
  const big = await req('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pad: 'x'.repeat(21 * 1024) }),
    ip: fakeIp(),
  });
  const gone = await req('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(baseOrderPayload()),
    ip: fakeIp(),
  });
  const noContentType = await req('/api/orders', { method: 'POST', body: 'x', ip: fakeIp() });
  // `gone` is a well-formed JSON body — it must NOT fail as "Invalid JSON"
  // (it may fail business validation with 400/404, both fine here).
  const goneParsed = Boolean(gone.json && gone.json.error);
  return {
    pass:
      bad.status === 400 &&
      big.status === 400 &&
      goneParsed &&
      gone.status !== undefined &&
      noContentType.status === 400,
    detail: `malformed=${bad.status} oversized=${big.status} json-parsed=${gone.status}:${goneParsed} raw=${noContentType.status}`,
  };
});

await test(8, 'Checkout: honeypot → 400, no order', false, async () => {
  const r = await req('/api/orders', {
    method: 'POST',
    body: baseOrderPayload({ website: 'https://spam.example' }),
    ip: fakeIp(),
  });
  return { pass: r.status === 400 && r.json?.code !== 'CHECKOUT_UNAVAILABLE', detail: `status=${r.status} body=${JSON.stringify(r.json)}` };
});

await test(9, 'Checkout: missing / empty Turnstile token → 400', false, async () => {
  const missing = await req('/api/orders', {
    method: 'POST',
    body: baseOrderPayload({ turnstile_token: undefined }),
    ip: fakeIp(),
  });
  const empty = await req('/api/orders', {
    method: 'POST',
    body: baseOrderPayload({ turnstile_token: '' }),
    ip: fakeIp(),
  });
  return { pass: missing.status === 400 && empty.status === 400, detail: `missing=${missing.status} empty=${empty.status}` };
});

await test(10, 'Checkout: 21 items → 400 (cap 20)', false, async () => {
  const items = Array.from({ length: 21 }, () => ({ product_slug: 'x', quantity: 1 }));
  const r = await req('/api/orders', { method: 'POST', body: baseOrderPayload({ items }), ip: fakeIp() });
  return { pass: r.status === 400, detail: `status=${r.status}` };
});

await test(11, 'Checkout: quantity 41 → 400 (cap 40)', false, async () => {
  const items = [{ product_slug: 'x', quantity: 41 }];
  const r = await req('/api/orders', { method: 'POST', body: baseOrderPayload({ items }), ip: fakeIp() });
  return { pass: r.status === 400, detail: `status=${r.status}` };
});

await test(12, 'Checkout: unknown field rejected (strict)', false, async () => {
  const r = await req('/api/orders', {
    method: 'POST',
    body: baseOrderPayload({ discount_pkr: 0 }),
    ip: fakeIp(),
  });
  return { pass: r.status === 400, detail: `status=${r.status}` };
});

await test(13, 'Checkout: invalid province → 400', false, async () => {
  const r = await req('/api/orders', {
    method: 'POST',
    body: baseOrderPayload({ province: 'Not A Province' }),
    ip: fakeIp(),
  });
  return { pass: r.status === 400, detail: `status=${r.status}` };
});

await test(14, 'Checkout: invalid email + phone → 400', false, async () => {
  const e = await req('/api/orders', {
    method: 'POST',
    body: baseOrderPayload({ customer_email: 'not-an-email' }),
    ip: fakeIp(),
  });
  const p = await req('/api/orders', {
    method: 'POST',
    body: baseOrderPayload({ customer_phone: '12345' }),
    ip: fakeIp(),
  });
  return { pass: e.status === 400 && p.status === 400, detail: `email=${e.status} phone=${p.status}` };
});

await test(15, 'Checkout: happy path → 201 + public_token (UUID)', false, async () => {
  const list = await req('/api/products');
  const products = Array.isArray(list.json?.products) ? list.json.products : [];
  const pick = products.find((p) => Number(p.stock) > 0) || null;
  if (!pick) return { pass: false, detail: 'no in-stock product available to order' };
  state.productSlug = pick.slug;

  const payload = baseOrderPayload();
  state.replayKey = payload.idempotency_key;

  const r = await req('/api/orders', {
    method: 'POST',
    body: payload,
    ip: fakeIp(),
  });
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ok =
    r.status === 201 &&
    typeof r.json?.order_number === 'string' &&
    r.json.order_number.startsWith('THR-') &&
    typeof r.json?.public_token === 'string' &&
    uuidRe.test(r.json.public_token) &&
    typeof r.json?.total_pkr === 'number';
  if (ok) {
    state.orderNumber = r.json.order_number;
    state.publicToken = r.json.public_token;
  }
  return {
    pass: ok,
    detail: `status=${r.status} keys=${r.json ? Object.keys(r.json).join(',') : '(none)'}`,
  };
});

await test(16, 'Checkout: per-IP burst → 429 with Retry-After', false, async () => {
  const ip = `198.51.100.${77 + IP_BASE}`;
  const codes = [];
  for (let i = 0; i < 7; i++) {
    const r = await req('/api/orders', {
      method: 'POST',
      body: baseOrderPayload({ items: [{ product_slug: `missing-${i}`, quantity: 1 }] }),
      ip,
    });
    codes.push(r.status);
    if (i === 6) {
      return {
        pass: r.status === 429 && Boolean(r.headers.get('retry-after')),
        detail: `statuses=${codes.join(',')} retry-after=${r.headers.get('retry-after')}`,
      };
    }
  }
  return { pass: false, detail: `statuses=${codes.join(',')}` };
});

await test(17, 'Checkout: idempotent replay leaks no token', false, async () => {
  if (!state.publicToken || !state.replayKey) return { pass: false, detail: 'no happy-path order to replay' };
  const r = await req('/api/orders', {
    method: 'POST',
    body: baseOrderPayload({ idempotency_key: state.replayKey }),
    ip: fakeIp(),
  });
  const leakedToken = JSON.stringify(r.json || {}).includes('public_token');
  return {
    pass: r.status === 201 && r.json?.idempotent === true && !leakedToken,
    detail: `status=${r.status} idempotent=${r.json?.idempotent} tokenLeak=${leakedToken}`,
  };
});

// ── C. public order lookup ────────────────────────────────────────────

await test(18, 'Lookup: non-UUID token → 404', true, async () => {
  const r = await req('/api/orders/not-a-uuid', { ip: fakeIp() });
  return { pass: r.status === 404, detail: `status=${r.status}` };
});

await test(19, 'Lookup: unknown UUID → 404', false, async () => {
  const r = await req(`/api/orders/${randomUUID()}`, { ip: fakeIp() });
  return { pass: r.status === 404, detail: `status=${r.status}` };
});

await test(20, 'Lookup: real token → 200, no PII, no-store', false, async () => {
  if (!state.publicToken) return { pass: false, detail: 'no happy-path token' };
  const r = await req(`/api/orders/${state.publicToken}`, { ip: fakeIp() });
  const piiKeys = ['customer_name', 'customer_phone', 'customer_email', 'address_line', 'notes'];
  const leaked = piiKeys.filter((k) => r.text.includes(k));
  const phoneLeak = r.text.includes('03001234567') || r.text.includes('3001234567');
  const emailLeak = r.text.includes('thriv.attacktest.user@example.com');
  const ok =
    r.status === 200 &&
    r.json?.order?.order_number === state.orderNumber &&
    leaked.length === 0 &&
    !phoneLeak &&
    !emailLeak &&
    /no-store/i.test(r.headers.get('cache-control') || '');
  return {
    pass: ok,
    detail: `status=${r.status} piiKeys=${leaked.join('|') || 'none'} phoneLeak=${phoneLeak} emailLeak=${emailLeak} no-store=${/no-store/i.test(r.headers.get('cache-control') || '')}`,
  };
});

await test(21, 'Lookup: rate limit 30/600 per IP', false, async () => {
  const ip = `198.51.100.${88 + IP_BASE}`;
  let last = 0;
  for (let i = 0; i < 31; i++) {
    const r = await req(`/api/orders/${randomUUID()}`, { ip });
    last = r.status;
    if (r.status === 429) {
      return { pass: true, detail: `429 after ${i + 1} requests` };
    }
  }
  return { pass: false, detail: `no 429 after 31 requests (last=${last})` };
});

// ── D. admin auth / MFA (local only) ──────────────────────────────────

await test(22, 'Admin login: cross-origin → 403', false, async () => {
  const r = await req('/api/admin/auth/login', {
    method: 'POST',
    headers: evil,
    body: { email: 'x@example.com', password: 'whatever1', turnstile_token: 't' },
    ip: fakeIp(),
  });
  return { pass: r.status === 403, detail: `status=${r.status}` };
});

await test(23, 'Admin login: honeypot → 400', false, async () => {
  const r = await req('/api/admin/auth/login', {
    method: 'POST',
    body: { email: 'x@example.com', password: 'whatever1', turnstile_token: 't', website: 'bot' },
    ip: fakeIp(),
  });
  return { pass: r.status === 400, detail: `status=${r.status}` };
});

await test(24, 'Admin login: wrong password → 401, no cookie, no token', false, async () => {
  const creds = await loadCreds();
  const r = await req('/api/admin/auth/login', {
    method: 'POST',
    body: { email: creds.adminEmail, password: 'wrong-password-1', turnstile_token: 't' },
    ip: fakeIp(),
  });
  const adminSet = r.setCookies.find((c) => c.startsWith('__Host-thriv_admin_token=')) || null;
  const tokenLeak = /access_token|refresh_token/.test(r.text);
  return {
    pass: r.status === 401 && !adminSet && !tokenLeak,
    detail: `status=${r.status} adminCookie=${Boolean(adminSet)} tokenLeak=${tokenLeak}`,
  };
});

await test(25, 'Admin login: correct password → 401 mfa_required + httpOnly ticket', false, async () => {
  const creds = await loadCreds();
  const r = await req('/api/admin/auth/login', {
    method: 'POST',
    body: { email: creds.adminEmail, password: creds.adminPassword, turnstile_token: 't' },
    ip: fakeIp(),
  });
  const flags = cookieFlags(r.setCookies, '__Host-thriv_mfa_ticket');
  const ticket = cookieValue(r.setCookies, '__Host-thriv_mfa_ticket');
  if (ticket) state.ticket = ticket;
  const ok =
    r.status === 401 &&
    r.json?.mfa_required === true &&
    Boolean(ticket) &&
    /HttpOnly/i.test(flags) &&
    /Secure/i.test(flags) &&
    /SameSite=Lax/i.test(flags) &&
    /Path=\//i.test(flags) &&
    /Max-Age=300/i.test(flags) &&
    !/access_token/.test(r.text);
  return {
    pass: ok,
    detail: `status=${r.status} mfaRequired=${r.json?.mfa_required} ticketSet=${Boolean(ticket)} httpOnly=${/HttpOnly/i.test(flags)} secure=${/Secure/i.test(flags)}`,
  };
});

const MFA_IP = `198.51.100.${99 + IP_BASE}`;

await test(26, 'MFA verify: no ticket → 401 MFA_EXPIRED', false, async () => {
  const r = await req('/api/admin/auth/mfa/verify', {
    method: 'POST',
    body: { code: '123456' },
    ip: MFA_IP,
  });
  return { pass: r.status === 401 && r.json?.code === 'MFA_EXPIRED', detail: `status=${r.status} code=${r.json?.code}` };
});

await test(27, 'MFA verify: non-numeric code → 400', false, async () => {
  const r = await req('/api/admin/auth/mfa/verify', {
    method: 'POST',
    body: { code: 'abcdef' },
    ip: MFA_IP,
    cookie: state.ticket ? `__Host-thriv_mfa_ticket=${state.ticket}` : undefined,
  });
  return { pass: r.status === 400, detail: `status=${r.status}` };
});

await test(28, 'MFA verify: wrong code → 401 MFA_INVALID, no admin cookie', false, async () => {
  if (!state.ticket) return { pass: false, detail: 'no ticket from login step' };
  const r = await req('/api/admin/auth/mfa/verify', {
    method: 'POST',
    body: { code: '000001' },
    ip: MFA_IP,
    cookie: `__Host-thriv_mfa_ticket=${state.ticket}`,
  });
  const adminSet = r.setCookies.find((c) => c.startsWith('__Host-thriv_admin_token=')) || null;
  return {
    pass: r.status === 401 && r.json?.code === 'MFA_INVALID' && !adminSet,
    detail: `status=${r.status} code=${r.json?.code} adminCookie=${Boolean(adminSet)}`,
  };
});

await test(29, 'MFA verify: correct TOTP → 200 + httpOnly admin cookie', false, async () => {
  if (!state.ticket) return { pass: false, detail: 'no ticket from login step' };
  const creds = await loadCreds();
  const code = totp(creds.adminTotpSecret);
  const r = await req('/api/admin/auth/mfa/verify', {
    method: 'POST',
    body: { code },
    ip: MFA_IP,
    cookie: `__Host-thriv_mfa_ticket=${state.ticket}`,
  });
  const adminFlags = cookieFlags(r.setCookies, '__Host-thriv_admin_token');
  const admin = cookieValue(r.setCookies, '__Host-thriv_admin_token');
  if (admin) state.adminCookie = admin;
  const ticketCleared = /__Host-thriv_mfa_ticket=;/.test(
    (r.setCookies.find((c) => c.startsWith('__Host-thriv_mfa_ticket=')) || '')
  );
  const ok =
    r.status === 200 &&
    r.json?.success === true &&
    Boolean(admin) &&
    /HttpOnly/i.test(adminFlags) &&
    /Secure/i.test(adminFlags);
  return {
    pass: ok,
    detail: `status=${r.status} adminCookie=${Boolean(admin)} httpOnly=${/HttpOnly/i.test(adminFlags)} ticketCleared=${ticketCleared}`,
  };
});

await test(30, 'Admin API: valid cookie → 200; no cookie → 401', false, async () => {
  if (!state.adminCookie) return { pass: false, detail: 'no admin cookie' };
  const authed = await req('/api/admin/orders', { cookie: `__Host-thriv_admin_token=${state.adminCookie}` });
  const anon = await req('/api/admin/orders');
  return { pass: authed.status === 200 && anon.status === 401, detail: `authed=${authed.status} anon=${anon.status}` };
});

await test(31, 'Admin order detail: 200 and NO public_token in body', false, async () => {
  if (!state.adminCookie || !state.orderNumber) return { pass: false, detail: 'missing admin cookie or test order' };
  const r = await req(`/api/admin/orders/${state.orderNumber}`, {
    cookie: `__Host-thriv_admin_token=${state.adminCookie}`,
  });
  const leak = r.text.includes('public_token');
  return {
    pass: r.status === 200 && r.json?.order?.order_number === state.orderNumber && !leak,
    detail: `status=${r.status} orderMatch=${r.json?.order?.order_number === state.orderNumber} publicTokenLeak=${leak}`,
  };
});

await test(32, 'Forged / aal1 / non-admin Bearer tokens → 401', false, async () => {
  const creds = await loadCreds();
  const anon = process.env.SUPABASE_ANON_KEY;
  const supabaseUrl = (creds.supabaseUrl || '').replace(/\/+$/, '');

  const garbage = await req('/api/admin/orders', {
    headers: { authorization: 'Bearer forged-token-abc' },
  });

  let aal1Status = 'skip(no-anon-key)';
  let userStatus = 'skip(no-anon-key)';
  if (anon && supabaseUrl) {
    async function grant(email, password) {
      const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: anon, 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => null);
      return body?.access_token || null;
    }
    const aal1 = await grant(creds.adminEmail, creds.adminPassword);
    if (aal1) {
      const r = await req('/api/admin/orders', { headers: { authorization: `Bearer ${aal1}` } });
      aal1Status = r.status;
    }
    const userTok = await grant(creds.userEmail, creds.userPassword);
    if (userTok) {
      const r = await req('/api/admin/orders', { headers: { authorization: `Bearer ${userTok}` } });
      userStatus = r.status;
    }
  }
  const pass = garbage.status === 401 && aal1Status === 401 && userStatus === 401;
  return { pass, detail: `garbage=${garbage.status} aal1-admin=${aal1Status} nonAdminUser=${userStatus}` };
});

// ── E. admin mutations ────────────────────────────────────────────────

await test(33, 'Admin status PATCH: cross-origin → 403', false, async () => {
  if (!state.adminCookie || !state.orderNumber) return { pass: false, detail: 'missing admin cookie or order' };
  const r = await req(`/api/admin/orders/${state.orderNumber}/status`, {
    method: 'PATCH',
    headers: { ...evil, cookie: `__Host-thriv_admin_token=${state.adminCookie}` },
    body: { status: 'confirmed' },
  });
  return { pass: r.status === 403, detail: `status=${r.status}` };
});

await test(34, 'Admin status PATCH: cancel test order → 200', false, async () => {
  if (!state.adminCookie || !state.orderNumber) return { pass: false, detail: 'missing admin cookie or order' };
  const r = await req(`/api/admin/orders/${state.orderNumber}/status`, {
    method: 'PATCH',
    headers: { origin: BASE, cookie: `__Host-thriv_admin_token=${state.adminCookie}` },
    body: { status: 'cancelled' },
  });
  return {
    pass: r.status === 200 && r.json?.status === 'cancelled',
    detail: `status=${r.status} newStatus=${r.json?.status}`,
  };
});

await test(35, 'Admin products POST: unauth → 401; cross-origin → 403', false, async () => {
  const unauth = await req('/api/admin/products', { method: 'POST', body: {} });
  const cross = await req('/api/admin/products', {
    method: 'POST',
    headers: { ...evil, cookie: `__Host-thriv_admin_token=${state.adminCookie || ''}` },
    body: {},
  });
  return { pass: unauth.status === 401 && cross.status === 403, detail: `unauth=${unauth.status} cross-origin=${cross.status}` };
});

await test(36, 'Admin products POST: fake image rejected (magic bytes)', false, async () => {
  if (!state.adminCookie) return { pass: false, detail: 'no admin cookie' };
  // Valid thrift-product fields so validation passes and the request reaches
  // the upload gate (F-53: size → MIME → magic bytes).
  const form = new FormData();
  form.set('name', 'Attack Test Product');
  form.set('brand', 'AttackTest');
  form.set('category', 'jeans');
  form.set('subcategory', '');
  form.set('condition', 'Premium');
  form.set('price', '1000');
  form.set('stock', '1');
  form.set('size', '32');
  form.set('description', 'attack test — never saved');
  form.append(
    'images',
    new Blob([Buffer.from('this is not an image at all')], { type: 'image/jpeg' }),
    'evil.jpg'
  );
  const res = await fetch(BASE + '/api/admin/products', {
    method: 'POST',
    headers: { origin: BASE, cookie: `__Host-thriv_admin_token=${state.adminCookie}` },
    body: form,
  });
  const body = await res.json().catch(() => null);
  return {
    pass: res.status === 400 && body?.code === 'INVALID_UPLOADS',
    detail: `status=${res.status} code=${body?.code ?? '(none)'} err=${body?.error ? String(body.error).slice(0, 60) : '(none)'}`,
  };
});

// ── extra: lockout boundaries (destructive to fixture auth state) ─────

await test(37, 'MFA uid limit: repeated wrong codes → 429 MFA_LOCKED', false, async () => {
  if (!state.ticket) return { pass: false, detail: 'no ticket from login step' };
  const seen = [];
  for (let i = 0; i < 6; i++) {
    const r = await req('/api/admin/auth/mfa/verify', {
      method: 'POST',
      body: { code: '000000' },
      ip: MFA_IP,
      cookie: `__Host-thriv_mfa_ticket=${state.ticket}`,
    });
    seen.push(`${r.status}${r.json?.code ? ':' + r.json.code : ''}`);
    if (r.status === 429 && r.json?.code === 'MFA_LOCKED') {
      return { pass: true, detail: seen.join(',') };
    }
  }
  return { pass: false, detail: `no lockout: ${seen.join(',')}` };
});

await test(38, 'Login failure throttle: 5 failures lock even a correct password', false, async () => {
  const creds = await loadCreds();
  const ip = `198.51.100.${111 + IP_BASE}`;
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const r = await req('/api/admin/auth/login', {
      method: 'POST',
      body: { email: creds.adminEmail, password: `wrong-${i}-password`, turnstile_token: 't' },
      ip,
    });
    seen.push(r.status);
  }
  const r = await req('/api/admin/auth/login', {
    method: 'POST',
    body: { email: creds.adminEmail, password: creds.adminPassword, turnstile_token: 't' },
    ip,
  });
  seen.push(`${r.status}:${r.json?.code ?? ''}`);
  return {
    pass: r.status === 429 && r.json?.code === 'TOO_MANY_ATTEMPTS',
    detail: seen.join(','),
  };
});

await test(39, 'GoTrue refuses a 2nd factor for an aal1 session with an existing factor', false, async () => {
  const creds = await loadCreds();
  const anon = process.env.SUPABASE_ANON_KEY;
  const supabaseUrl = (creds.supabaseUrl || '').replace(/\/+$/, '');
  if (!anon || !supabaseUrl) return { pass: false, detail: 'missing SUPABASE_ANON_KEY' };

  const grant = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'content-type': 'application/json' },
    body: JSON.stringify({ email: creds.adminEmail, password: creds.adminPassword }),
  });
  const gb = await grant.json().catch(() => null);
  if (!gb?.access_token) return { pass: false, detail: `password grant failed (${grant.status})` };

  // Direct GoTrue call bypassing our login route — the MFA bypass probe.
  const enroll = await fetch(`${supabaseUrl}/auth/v1/factors`, {
    method: 'POST',
    headers: {
      apikey: anon,
      authorization: `Bearer ${gb.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ factor_type: 'totp', friendly_name: 'attack-test-probe' }),
  });
  const eb = await enroll.json().catch(() => null);
  const factorId = eb?.id || null;

  if (enroll.status < 400 && factorId) {
    // Control failed AND a factor was created — remove it immediately.
    const del = await fetch(`${supabaseUrl}/auth/v1/factors/${factorId}`, {
      method: 'DELETE',
      headers: { apikey: anon, authorization: `Bearer ${gb.access_token}` },
    }).catch(() => null);
    return {
      pass: false,
      detail: `MFA BYPASS: aal1 session enrolled a 2nd factor (${enroll.status}); cleanup delete=${del ? del.status : 'failed'}`,
    };
  }
  return { pass: true, detail: `enroll-with-existing-factor rejected: status=${enroll.status}` };
});

// ══════════════════════════ report ══════════════════════════════════════

const ran = results.filter((r) => r.pass !== null);
const failed = ran.filter((r) => !r.pass);
const skipped = results.filter((r) => r.pass === null);

const lines = [];
lines.push(`# Attack test run — suite=${SUITE} base=${BASE}`);
lines.push('');
lines.push(`Ran: ${ran.length} · Passed: ${ran.length - failed.length} · Failed: ${failed.length} · Skipped: ${skipped.length}`);
lines.push('');
lines.push('| # | Check | Result | Observed |');
lines.push('|---|-------|--------|----------|');
for (const r of results) {
  const verdict = r.pass === null ? 'SKIP' : r.pass ? 'PASS' : 'FAIL';
  const observed = r.observed.replace(/\|/g, '\\|').slice(0, 140);
  lines.push(`| ${r.id} | ${r.name} | ${verdict} | ${observed} |`);
}
const md = lines.join('\n');
console.log(md);
if (process.argv[2]) {
  writeFileSync(process.argv[2], md);
  console.log(`\n(written to ${process.argv[2]})`);
}

// Order-number/public-token values are bearer-adjacent; never print them.
if (state.orderNumber) console.log(`\nTest order: ${state.orderNumber} (created then cancelled by the suite)`);

process.exit(failed.length > 0 ? 1 : 0);
