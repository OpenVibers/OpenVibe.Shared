'use strict';
// openvibe-shared/csp: connect-src names Media (the composer's upload origin) and Network by default, a site can add
// its own origins, and policy() is a complete CSP string.
const assert = require('assert');
const csp = require('../csp');

const src = csp.connectSources();
assert.ok(src.startsWith("'self'"));
for (const origin of ['https://openvibe.network', 'wss://openvibe.network', 'https://openvibe.events', 'wss://openvibe.events', 'https://openvibe.media']) {
    assert.ok(src.split(' ').includes(origin), `connect-src names ${origin}`);
}
assert.deepStrictEqual(csp.connectSources({ self: false, sites: ['wss://openvibe.chat'], extra: ['https://cloudflareinsights.com'] }).split(' '), [
    'https://openvibe.network', 'wss://openvibe.network', 'https://openvibe.events', 'wss://openvibe.events', 'https://openvibe.media', 'wss://openvibe.chat', 'https://cloudflareinsights.com',
]);
assert.strictEqual(csp.MEDIA_UPLOAD_ORIGIN, 'https://openvibe.media');

const policy = csp.policy({ nonce: 'abc123', sites: ['wss://openvibe.chat'], frames: ["'self'", 'https://openvibe.bot'] });
for (const part of ["default-src 'self'", "script-src 'self' 'nonce-abc123'", "style-src 'self' 'unsafe-inline'", "img-src https:", "media-src https:", "font-src 'self' data:", "frame-src 'self' https://openvibe.bot", "frame-ancestors 'self'", "base-uri 'self'", "object-src 'none'", "form-action 'self' https://openvibe.network"]) {
    assert.ok(policy.includes(part), `policy has ${part}`);
}
assert.ok(policy.includes('https://openvibe.media') && policy.includes('wss://openvibe.chat'), 'policy connect-src has Media and the site');
assert.ok(csp.policy({ extra: { 'worker-src': "'self' blob:" } }).includes("worker-src 'self' blob:"));
console.log('csp: all checks passed');
