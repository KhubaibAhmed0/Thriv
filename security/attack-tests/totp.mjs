// security/attack-tests/totp.mjs
// Minimal RFC 6238 TOTP (base32 secret, SHA-1, 6 digits, 30 s step).
// Used by the attack-test suite for the admin MFA account. No dependencies.

import { createHmac } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(secret) {
  const clean = String(secret).replace(/[=\s]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totp(secret, atMs = Date.now()) {
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter % 2 ** 32, 4);

  const key = base32Decode(secret);
  const digest = createHmac('sha1', key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
      .toString()
      .padStart(6, '0');
  return code;
}
