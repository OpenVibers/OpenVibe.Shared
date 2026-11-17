'use strict';
// The bar keeps its own token live (4.292.0; the owner, 11-17: "The history tab no longer loads or is broken"): just
// after its access token expires it asks its session again (a refused token is what renews it), a tab that comes back
// to the front does so at once when its token has lapsed, and a site that signs people in itself (auth: 'external')
// is left to hand over its own. The notification bell reads the token per request.
//   node test/navbar-token-refresh.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
const fn = (name) => { const m = src.match(new RegExp(`    function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}`)); assert.ok(m, `${name} is defined`); return m[0]; };

const box = { atob: (s) => Buffer.from(s, 'base64').toString('binary'), out: null, tok: `h.${Buffer.from(JSON.stringify({ exp: 1900000000 })).toString('base64url')}.s` };
vm.runInNewContext(`${fn('tokenExpiry')}; out = JSON.stringify([tokenExpiry(tok), tokenExpiry('x'), tokenExpiry(null)]);`, box);
assert.strictEqual(box.out, JSON.stringify([1900000000000, 0, 0]));

const plan = fn('planTokenRefresh');
assert.match(plan, /_config\.auth === 'external'/, 'a site that signs people in itself renews its own');
assert.match(plan, /exp - Date\.now\(\) \+ 2000/, 'just after it expires');
assert.match(plan, /refreshAuthState\(\)/);
assert.match(fn('refreshAuthState'), /if \(session\.token\) _config\.token = session\.token;\n\s+planTokenRefresh\(\);/, 'each new token plans the next renewal');
assert.match(src, /document\.addEventListener\('visibilitychange', \(\) => \{[\s\S]*?exp < Date\.now\(\) \+ 5000\) refreshAuthState\(\);/, 'a tab back in front renews a lapsed token');
assert.match(src, /N\.init\(\{ token: \(\) => _config\.token,/, 'the bell reads the token per request');
console.log('navbar-token-refresh: renewed just after expiry and on a tab coming back; external sites renew their own; the bell reads it per request');
