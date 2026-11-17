'use strict';
// "A menu that brings them to set up their agents and their harnesses and their API keys, or to enable billing … buy
// credits" (4.296.0; the owner's phone, 11-17). Over a local Frame at 390 px: Vibe's sessions carry "Your AI" under your
// agents; it opens one sheet with Who works (your Actor, Codes, each coding agent ready or to set up), How it's paid
// (the free AI, your Balance with its amount and what it is for, Top up in the Wallet, your own key), Where it runs
// (your computers online or not, the shared node, add one) and Sign-ins. A ready coding agent becomes the new session's;
// the spent-allowance card leads with "Set up your AI". Nothing off the screen; no page errors.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('your-ai-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const SPENT = 'OpenVibe.Exchange HTTP 402: The free AI allowance for usr_01KKT9AC60KM7CRTB3WN1Z8P56 is spent, and the calling service has no budget to cover this run.';
let withResources = false;
const runs = [{ ref: 'actor:run_9', kind: 'task', title: 'Find me three cheap GPU rentals', status: 'failed', created_at: iso(300), updated_at: iso(120), preview: SPENT, agent: { id: 'actor', name: 'Actor' } }];
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>
window.open = (u) => { window.__opened = (window.__opened || []).concat([u]); return {}; };
window.OpenVibeWallet = { open: async (o) => { window.__wallet = { frameBase: o.frameBase, token: typeof o.getToken === 'function' ? o.getToken() : null }; } };
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, codes: true, title: 'Vibe' });
</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.(js|css)$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/run-options') return json(res, 200, {
        agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' },
            { id: 'claude-code', name: 'Claude Code', kind: 'harness', line: 'Anthropic\'s coding agent', available: true }, { id: 'codex', name: 'Codex', kind: 'harness', line: 'OpenAI\'s coding agent', available: false }],
        places: [{ kind: 'auto', name: 'Auto' }, { kind: 'openvibe', name: 'OpenVibe' }, { kind: 'shared', name: 'A shared node' }, { kind: 'machine', id: 'mch_1', name: 'Studio PC', available: true }, { kind: 'machine', id: 'mch_2', name: 'Old laptop', available: false }],
    });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/runs') return json(res, 200, { runs, partial: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 }, caps: { usd: 1 } });
    if (p === '/api/frame/resources') return withResources ? json(res, 200, { allowance: { tier: 'standard', unlimited: false, tokens: 50000, used: 12000, left: 38000, resets_at: '2026-11-18T00:00:00.000Z' },
        keys: [{ provider: 'anthropic', status: 'ok', checked_at: null }, { provider: 'openrouter', status: 'ok', checked_at: null }], key_apps: [{ service: 'actor', providers: ['anthropic'] }],
        balance: { amount: '500', scale: 2, currency: 'USD', purpose: 'For the AI API, the Exchange and pro products' }, partial: [] }) : json(res, 404, {});
    if (p === '/api/frame/wallet/api/v1/me/wallet') return json(res, 200, { balances: { balance: { amount: '1234', scale: 2, currency: 'USD', label: 'Balance', purpose: 'For the AI API, the Exchange and pro products' } } });
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
        if (!m[2]) return json(res, 200, runs[0]);
        if (m[2] === '/steps') return json(res, 200, { steps: [{ seq: 1, kind: 'message', from: 'person', status: 'done', text: runs[0].title }, { seq: 2, kind: 'message', from: 'agent', status: 'done', text: SPENT }] });
        if (m[2] === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); return; }
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }
const SHEET = `(() => { const s = document.querySelector('.ovse-sheet.is-in'); if (!s || !s.querySelector('.ovse-yai-chip.is-money')) return null;
    return { title: s.querySelector('.ovse-sheet-h b').textContent, heads: [...s.querySelectorAll('.ovse-yai-h span')].map((x) => x.textContent),
        rows: [...s.querySelectorAll('.ovse-yai-r')].map((r) => [r.querySelector('.ovse-yai-t b').textContent, (r.querySelector('.ovse-yai-chip') || {}).textContent || '']),
        balance: [...s.querySelectorAll('.ovse-yai-r')].find((r) => r.querySelector('.ovse-yai-t b').textContent === 'Your Balance').querySelector('small').textContent }; })()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-your-ai-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await p.evaluate("document.querySelector('.ovse-menu').click()");
        await until(p, "!!document.querySelector('.ovse-ai-row .ovse-actor-who')");
        await p.evaluate('window.__s.refresh()');
        await pause(300);
        await p.evaluate("document.querySelector('.ovse-ai-row .ovse-actor-who').click()");
        const sh = await until(p, SHEET);
        assert.strictEqual(sh.title, 'Your AI');
        assert.deepStrictEqual(sh.heads, ['Who works', 'How it\'s paid', 'Where it runs', 'Sign-ins']);
        assert.deepStrictEqual(sh.rows, [
            ['Juniper', ''], ['Codes', ''], ['Claude Code', 'Ready'], ['Codex', 'Set it up'],
            ['Free AI', 'Daily'], ['Your Balance', '$12.34'], ['Your own AI key', ''],
            ['Studio PC', 'Online'], ['Old laptop', 'Offline'], ['A shared node', ''], ['Add another computer', ''], ['Shared nodes and your computers', ''],
            ['Sign-ins for your agents', ''],
        ]);
        assert.strictEqual(sh.balance, 'For the AI API, the Exchange and pro products', 'what Balance is for, as the Wallet says it');
        assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'nothing off the screen');

        // Top up opens the Wallet in place, with the Frame and the token.
        await p.evaluate("[...document.querySelector('.ovse-sheet.is-in').querySelectorAll('.ovse-yai-r')].find((r) => r.querySelector('.ovse-yai-t b').textContent === 'Your Balance').click()");
        const w = await until(p, 'window.__wallet');
        assert.deepStrictEqual(w, { frameBase: base.replace(/\/$/, '') + '/api/frame', token: 'signed-in-test' });

        // A ready coding agent becomes the new session's; one to set up opens Codes' setup.
        await p.evaluate("document.querySelector('.ovse-ai-row .ovse-actor-who') ? null : document.querySelector('.ovse-menu').click()");
        await p.evaluate("(document.querySelector('.ovse-ai-row .ovse-actor-who') || {}).click && document.querySelector('.ovse-ai-row .ovse-actor-who').click()");
        await until(p, SHEET);
        await p.evaluate("[...document.querySelector('.ovse-sheet.is-in').querySelectorAll('.ovse-yai-r')].find((r) => r.querySelector('.ovse-yai-t b').textContent === 'Codex').click()");
        assert.match(await until(p, 'window.__opened && window.__opened[window.__opened.length - 1]'), /^https:\/\/openvibe\.codes\/setup/);
        await p.evaluate("[...document.querySelector('.ovse-sheet.is-in').querySelectorAll('.ovse-yai-r')].find((r) => r.querySelector('.ovse-yai-t b').textContent === 'Claude Code').click()");
        await pause(900);
        const after = await p.evaluate("JSON.stringify({ sheets: document.querySelectorAll('.ovse-sheet').length, which: [...document.querySelectorAll('.ovse-sheet')].map((x) => x.getAttribute('aria-label') + ':' + x.className), face: (document.querySelector('.ovse-hello-face') || {}).className, title: (document.querySelector('.ovse-title') || {}).textContent })");
        assert.deepStrictEqual(JSON.parse(after), { sheets: 0, which: [], face: 'ovse-hello-face is-code', title: 'Claude Code' }, after);

        // The spent allowance leads with Set up your AI.
        await p.evaluate("window.__s.open('actor:run_9')");
        await until(p, "!!document.querySelector('.ovse-setup .ovse-setup-all')");
        await p.evaluate("document.querySelector('.ovse-setup .ovse-setup-all').click()");
        await until(p, SHEET);
        // 4.297.0: with the Frame's /resources, the free AI left, each key and whether Actor may use it, the Balance.
        withResources = true;
        await p.evaluate("document.querySelector('.ovse-sheet .ovse-sheet-h .ovse-ib') && document.querySelector('.ovse-sheet .ovse-sheet-h .ovse-ib').click()");
        await pause(300);
        await p.evaluate("window.__s.blank(); document.querySelector('.ovse-menu').click()");
        await until(p, "!!document.querySelector('.ovse-ai-row .ovse-actor-who')");
        await p.evaluate("document.querySelector('.ovse-ai-row .ovse-actor-who').click()");
        const live = await until(p, `(() => { const s = document.querySelector('.ovse-sheet.is-in'); if (!s || !s.querySelector('.ovse-yai-keys .ovse-yai-r:nth-child(3)')) return null;
            const rows = [...s.querySelectorAll('.ovse-yai-r')].map((r) => [r.querySelector('.ovse-yai-t b').textContent, (r.querySelector('.ovse-yai-chip') || {}).textContent || '']);
            return { free: rows.find((x) => x[0] === 'Free AI'), balance: rows.find((x) => x[0] === 'Your Balance'), keys: [...s.querySelectorAll('.ovse-yai-keys .ovse-yai-r')].map((r) => [r.querySelector('.ovse-yai-t b').textContent, (r.querySelector('.ovse-yai-chip') || {}).textContent || '', r.querySelector('small').textContent]),
                freeLine: [...s.querySelectorAll('.ovse-yai-r')].find((r) => r.querySelector('.ovse-yai-t b').textContent === 'Free AI').querySelector('small').textContent }; })()`);
        assert.deepStrictEqual(live.free, ['Free AI', '76% left']);
        assert.match(live.freeLine, /^38k of 50k tokens left today · back in full at /);
        assert.deepStrictEqual(live.balance, ['Your Balance', '$5.00']);
        assert.deepStrictEqual(live.keys.map((k) => k.slice(0, 2)), [['Anthropic key', 'Ready'], ['OpenRouter key', 'Allow'], ['Add another key', '']]);
        assert.match(live.keys[1][2], /allow Actor to use it/);
        // Allow opens OpenVibe.AI's grant page with the provider filled in.
        await p.evaluate("window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return {}; }");
        await p.evaluate("[...document.querySelectorAll('.ovse-sheet.is-in .ovse-yai-keys .ovse-yai-r')][1].click()");
        const opened = await until(p, "window.__opened.length ? window.__opened[0] : null");
        assert.match(opened, /^https:\/\/ai\.openvibe\.services\/you\?allow=actor&provider=openrouter/);
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('your-ai-chrome: one menu for your agents, coding agents, keys, Balance (top up in place) and computers; the setup card leads to it ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
