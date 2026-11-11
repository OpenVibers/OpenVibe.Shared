'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = path.resolve(__dirname, '../..');
const id = (prefix, n) => `${prefix}_${String(n).padStart(26, '0')}`;
const subject = id('usr', 1);
const definitions = [
    { id: id('itd', 1), name: 'Rainbow Name', kind: 'live.name_effect', art: { token: 'name-fx-rainbow' }, issuer: 'service:live' },
    { id: id('itd', 2), name: 'Golden Crown', kind: 'live.hat', art: { emoji: '👑' }, issuer: 'service:live' },
    { id: id('itd', 3), name: 'Stardust', kind: 'live.particle', art: { emoji: '✦' }, issuer: 'service:live' },
];
const wallet = {
    subject: { type: 'user', id: subject }, currency: 'USD', money_writes_frozen: false, used_ai_this_month: true, bits_per_usd: 100,
    balances: {
        coins: { label: 'OpenCoins', amount: '160799', currency: 'opencoins', scale: 0, purpose: 'Earned by taking part; spend on items across OpenVibe.', action: 'How to earn OpenCoins' },
        vibes: { label: 'Vibes', amount: '400', currency: 'vibes-bits', scale: 0, purpose: 'Support creators and buy items across OpenVibe.', action: 'Buy Vibes' },
        balance: { label: 'Balance', amount: '0', currency: 'USD', scale: 9, held: '0', purpose: 'Real money for AI and paid features.', action: 'Top up' },
    },
    checkout: { providers: [{ name: 'stripe', hosts: ['checkout.stripe.com'] }], vibes: { minimum: 100, maximum: 100000, price_tiers: [{ min: 100, usd_per_bit: 0.012 }] }, topup: { enabled: true, amounts_cents: [1000, 2500], fee_bps: 0 } },
    recent_activity: [
        { id: 'a', at: '2026-11-08T12:00:00Z', kind: 'coins', amount: '50', label: 'for the quest Publish a video', subject: { name: 'Publish a video', url: 'https://openvibe.quest/quests/publish-a-video' }, site: 'OpenVibe.Quest', detail: '' },
        { id: 'b', at: '2026-11-08T10:00:00Z', kind: 'vibes', amount: '-25', label: 'for a tip to @alice', subject: { name: '@alice', url: 'https://openvibe.live/@alice' }, site: 'OpenVibe', detail: '' },
    ],
};
function fixture({ changes = false, changeNet = 5 } = {}) {
    const calls = [], owned = new Set([definitions[1].id]);
    let slots = {}, base, readCursor = null;
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        // The sheet asks Network's relay (/api/frame/wallet/…); the fixture answers as Billing and Inventory would.
        const pathname = url.pathname.startsWith('/api/frame/wallet/') ? url.pathname.slice('/api/frame/wallet'.length) : url.pathname;
        const json = (x, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(x)); };
        if (pathname.startsWith('/api/') || pathname.startsWith('/changes')) {
            const chunks = []; for await (const chunk of req) chunks.push(chunk);
            const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
            calls.push({ path: pathname, method: req.method, body, authorization: req.headers.authorization, cookie: req.headers.cookie });
            if (pathname.startsWith('/changes') && changes) {
                if (req.method === 'PUT' && pathname === '/changes/read') { readCursor = body.cursor; return json({ currency: body.currency, read_cursor: readCursor }); }
                if (changes === 'unauthorized') return json({ error: 'Authentication required' }, 401);
                return json({ opencoins: { currency: 'opencoins', net: readCursor ? 0 : changeNet, cursor: 42, moves: readCursor ? [] : [{ id: 42, at: '2026-11-11T12:00:00Z', delta: changeNet, label: 'For a quest' }] }, vibes: null, channel_points: null });
            }
            if (pathname === '/api/v1/me/wallet') return json(wallet);
            if (pathname === '/api/v1/store') return json({ items: definitions.map((d, i) => ({ ...d, preview: d.art, prices: { vibes: (i + 1) * 50, coins: (i + 1) * 250 }, available: true, owned: owned.has(d.id), slots: [d.kind.split('.')[1]], surfaces: [{ surface: 'chat' }, { surface: 'profile' }] })) });
            if (pathname === '/api/v1/me/items') return json({ subject, instances: definitions.filter((d) => owned.has(d.id)).map((d) => ({ id: d.id.replace('itd_', 'inv_'), definition_id: d.id, state: 'owned' })), definitions: Object.fromEntries(definitions.map((d) => [d.id, d])), next_cursor: null });
            if (pathname.endsWith('/equipped')) { if (body) slots = { ...slots, [`${body.kind}:${body.slot}`]: body.instance_id ? { instance_id: body.instance_id } : null }; return json({ subject, slots }); }
            if (pathname === '/api/v1/kinds') return json({ kinds: definitions.map((d) => ({ id: d.kind, slots: [d.kind.split('.')[1]], surfaces: [{ surface: 'chat' }, { surface: 'profile' }] })) });
            if (pathname.endsWith('/buy')) { owned.add(pathname.split('/')[4]); return json({ status: 'fulfilled' }); }
            return json({ unread: 0, notifications: [], items: [] });
        }
        if (pathname === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'" });
            return res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wallet preview</title><link rel="icon" href="data:,"><style>body{margin:0;background:#111820;color:#e9edf2;font:16px system-ui;min-height:150vh}main{padding:90px 7%}h1{font-size:50px;letter-spacing:-2px}p{max-width:470px;line-height:1.6}@media(prefers-color-scheme:light){body{background:#f1f4f6;color:#25303d}}</style><script>if(location.search.includes('off=1'))document.documentElement.setAttribute('data-ov-motion','off');if(location.search.includes('calm=1'))document.documentElement.setAttribute('data-ov-motion','reduced');window._purseEffects=[];window._pursePieces=[];new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1&&n.classList.contains('ovp-delta'))window._purseEffects.push(n.textContent);if(n.nodeType===1&&n.classList.contains('ovp-bit'))window._pursePieces.push(n.textContent)}))).observe(document.documentElement,{childList:true,subtree:true});const originalFetch=window.fetch.bind(window);window.fetch=(u,o)=>new URL(u,location.href).origin===location.origin?originalFetch(u,o):Promise.resolve(new Response(JSON.stringify({items:[],notifications:[],unread:0}),{headers:{'Content-Type':'application/json'}}));</script><script src="/navbar.js"></script><main><p>OPENVIBE LIVE</p><h1>Good company.<br>Anywhere.</h1><p>A local fixture for the shared Wallet. Balances, store items and activity below are sample data.</p></main><script>OpenVibeNavbar.init({service:'live',auth:'external',apiBase:${JSON.stringify(base)},frameBase:${JSON.stringify(base + '/api/frame')},user:{id:1,subject:${JSON.stringify(subject)},display_name:'Maya'},token:'wallet-fixture',wallet:true,search:false,presence:false,dock:false,networkBase:${JSON.stringify(base)}});</script></html>`);
        }
        const name = pathname.slice(1);
        if (/^[a-z0-9-]+\.(js|css|woff2)$/.test(name) && fs.existsSync(path.join(root, name))) {
            res.writeHead(200, { 'Content-Type': name.endsWith('.css') ? 'text/css' : name.endsWith('.woff2') ? 'font/woff2' : 'application/javascript' });
            return res.end(fs.readFileSync(path.join(root, name)));
        }
        res.writeHead(204); res.end();
    });
    return { calls, wallet, server, start: async () => { await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`; return base; }, close: () => new Promise((r) => server.close(r)) };
}
module.exports = { fixture };
