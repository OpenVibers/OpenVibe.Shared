'use strict';
// sso-client.js — the FedCM hint carries the account's own name into the navbar's first paint, and never a
// name that is not a safe username.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(user) {
    const store = {}, tab = {};
    const ctx = {
        console, setTimeout, clearTimeout, AbortController,
        crypto: { getRandomValues: (a) => { a.fill(1); return a; } },
        location: { origin: 'https://openvibe.blog', hostname: 'openvibe.blog', href: 'https://openvibe.blog/' },
        isSecureContext: true,
        IdentityCredential: function IdentityCredential() {},
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
        sessionStorage: { getItem: k => (k in tab ? tab[k] : null), setItem: (k, v) => { tab[k] = String(v); } },
        navigator: { credentials: { get: async () => ({ token: 'fedcm-token', isAutoSelected: false }) } },
        fetch: async () => ({ ok: true, json: async () => ({ user }) }),
    };
    ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx; ctx.top = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'sso-client.js'), 'utf8'), ctx);
    return { ctx, store };
}

(async () => {
    {
        const { ctx, store } = load({ username: 'vibe' });
        assert.ok(ctx.OpenVibeSSO, 'the module loads');
        const out = await ctx.OpenVibeSSO.fedcm({ apiBase: 'https://openvibe.network', fedcmLogin: '/auth/fedcm' });
        assert.equal(out.ok, true);
        assert.equal(store.ov_sso_hint, 'account:vibe', 'the next first paint knows the account name');
    }
    {
        const { ctx, store } = load({ username: '<b>not-a-name</b>' });
        const out = await ctx.OpenVibeSSO.fedcm({ apiBase: 'https://openvibe.network', fedcmLogin: '/auth/fedcm' });
        assert.equal(out.ok, true);
        assert.equal(store.ov_sso_hint, 'account', 'an unsafe name is dropped, never rendered');
    }
    console.log('sso-client: the FedCM hint carries only a safe account name into the first paint');
})().catch((err) => {
    console.error('sso-client test failed');
    console.error(String(err.stack).split('\n').slice(0, 5).join('\n'));
    process.exitCode = 1;
});
