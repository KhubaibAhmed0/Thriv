// security/attack-tests/totp-cli.mjs
// Prints a TOTP code for a base32 secret: node totp-cli.mjs <SECRET>

import { totp } from './totp.mjs';

const secret = process.argv[2];
if (!secret) {
  console.error('usage: node totp-cli.mjs <base32-secret>');
  process.exit(1);
}
console.log(totp(secret));
