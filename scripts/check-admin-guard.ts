/**
 * Unit checks for the fail-closed Supabase env helpers (audit F-01 / F-08 / F-24).
 *
 * Run with:  npx --yes tsx scripts/check-admin-guard.ts
 *
 * These assertions encode the security contract: missing, malformed, or
 * placeholder env values must NEVER count as "configured".
 */
import assert from 'node:assert/strict';
import {
  getSupabasePublicEnv,
  isSupabasePublicConfigured,
  isSupabaseServiceConfigured,
} from '../lib/supabase-env';
import { verifyAdminToken } from '../lib/admin-auth';

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearAll() {
  setEnv({
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    SUPABASE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    SUPABASE_ANON_KEY: undefined,
    SUPABASE_KEY: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    SUPABASE_SERVICE_KEY: undefined,
  });
}

// 1. Nothing set → not configured (fail closed)
clearAll();
assert.equal(isSupabasePublicConfigured(), false, 'empty env must be unconfigured');
assert.equal(isSupabaseServiceConfigured(), false, 'empty env must be unconfigured');

// 2. .env.example placeholders must NOT count as configured
setEnv({
  NEXT_PUBLIC_SUPABASE_URL: 'https://<project>.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '<anon_key>',
  SUPABASE_SERVICE_ROLE_KEY: '<service_role_key>',
});
assert.equal(isSupabasePublicConfigured(), false, 'placeholder URL/key must be unconfigured');
assert.equal(isSupabaseServiceConfigured(), false, 'placeholder service key must be unconfigured');

// 3. Real-looking values → configured; URL is normalized (trailing /rest/v1 stripped)
setEnv({
  NEXT_PUBLIC_SUPABASE_URL: 'https://example-project.supabase.co/rest/v1/',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(200),
  SUPABASE_SERVICE_ROLE_KEY: 'b'.repeat(200),
});
assert.equal(
  getSupabasePublicEnv().url,
  'https://example-project.supabase.co',
  'URL must be normalized'
);
assert.equal(isSupabasePublicConfigured(), true);
assert.equal(isSupabaseServiceConfigured(), true);

// 4. Legacy fallback env names still work (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY)
clearAll();
setEnv({
  SUPABASE_URL: 'https://fallback.supabase.co',
  SUPABASE_ANON_KEY: 'c'.repeat(200),
  SUPABASE_SERVICE_KEY: 'd'.repeat(200),
});
assert.equal(isSupabasePublicConfigured(), true, 'fallback URL/anon names must work');
assert.equal(isSupabaseServiceConfigured(), true, 'fallback service key name must work');

// 5. A non-https URL is rejected
clearAll();
setEnv({ SUPABASE_URL: 'http://insecure.supabase.co', SUPABASE_ANON_KEY: 'e'.repeat(200) });
assert.equal(isSupabasePublicConfigured(), false, 'non-https URL must be rejected');

// 6-8. The guard itself must deny (audit F-01 / F-08) — no server required.
async function main() {
  // 6. Public env present, service key missing → deny without any network call.
  clearAll();
  setEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example-fake.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'f'.repeat(200),
  });
  assert.equal(
    (await verifyAdminToken('forged-token')).authorized,
    false,
    'missing service key must deny'
  );

  // 7. All env present but the token is invalid → deny (network/API failure path).
  setEnv({ SUPABASE_SERVICE_ROLE_KEY: 'g'.repeat(200) });
  assert.equal(
    (await verifyAdminToken('forged-token')).authorized,
    false,
    'invalid token must deny even when all env is present'
  );

  // 8. Empty / whitespace tokens are denied before any network call.
  clearAll();
  assert.equal((await verifyAdminToken('')).authorized, false, 'empty token must deny');
  assert.equal((await verifyAdminToken('   ')).authorized, false, 'blank token must deny');
  assert.equal((await verifyAdminToken(undefined)).authorized, false, 'missing token must deny');

  console.log('check-admin-guard: all assertions passed ✔');
}

main().catch((err) => {
  console.error('check-admin-guard FAILED:', err);
  process.exit(1);
});
