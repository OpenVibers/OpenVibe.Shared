'use strict';
// Your AI keeps keys and the Balance in reach (4.299.0; the owner's phone, 11-17: nine coding agents pushed them below
// the fold). With six coding agents the ready ones come first, three are shown and one dashed row says "3 more coding
// agents", naming them; How it's paid starts on the first screen; a tap unfolds the rest in place.
// (Built on the Your AI harness:) "A menu that brings them to set up their agents and their harnesses and their API keys, or to enable billing … buy
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

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('your-ai-compact-chrome: skipped'); process.exit(0); }

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
            { id: 'claude-code', name: 'Claude Code', kind: 'harness', line: 'A coding agent by Anthropic', available: true }, { id: 'codex', name: 'Codex', kind: 'harness', line: 'A coding agent by OpenAI', available: false },
            { id: 'opencode', name: 'OpenCode', kind: 'harness', line: 'A coding agent by OpenCode', available: true }, { id: 'aider', name: 'Aider', kind: 'harness', line: 'A coding agent by Aider', available: true },
            { id: 'gemini-cli', name: 'Gemini CLI', kind: 'harness', line: 'A coding agent by Google', available: true }, { id: 'muse', name: 'Muse Code', kind: 'harness', line: 'A coding agent by Meta', available: true }],
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
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-your-ai-compact-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await p.evaluate("document.querySelector('.ovse-menu').click()");
        await until(p, "!!document.querySelector('.ovse-ai-row .ovse-actor-who')");
        await p.evaluate("document.querySelector('.ovse-ai-row .ovse-actor-who').click()");
        const got = await until(p, `(() => { const s = document.querySelector('.ovse-sheet.is-in'); if (!s || !s.querySelector('.ovse-yai-r.is-unfold')) return null;
            const shown = [...s.querySelectorAll('.ovse-yai-r')].filter((r) => !r.hidden).map((r) => [r.querySelector('.ovse-yai-t b').textContent, (r.querySelector('.ovse-yai-chip') || {}).textContent || '']);
            const paid = [...s.querySelectorAll('.ovse-yai-h')].find((x) => /paid/.test(x.textContent));
            return { shown, more: s.querySelector('.ovse-yai-r.is-unfold small').textContent, paidTop: Math.round(paid.getBoundingClientRect().top), h: innerHeight }; })()`);
        assert.deepStrictEqual(got.shown.slice(0, 6), [['Juniper', ''], ['Codes', ''], ['Claude Code', 'Ready'], ['OpenCode', 'Ready'], ['Aider', 'Ready'], ['3 more coding agents', '']], 'ready first, three shown, then one row');
        assert.strictEqual(got.more, 'Gemini CLI, Muse Code, Codex', 'the row names them, the one to set up last');
        assert.ok(got.paidTop < got.h, `How it's paid starts on the first screen (${got.paidTop} < ${got.h})`);
        await p.evaluate("document.querySelector('.ovse-sheet.is-in .ovse-yai-r.is-unfold').click()");
        const open = await until(p, `(() => { const s = document.querySelector('.ovse-sheet.is-in'); if (s.querySelector('.ovse-yai-r.is-unfold')) return null;
            return [...s.querySelectorAll('.ovse-yai-r')].filter((r) => !r.hidden).map((r) => [r.querySelector('.ovse-yai-t b').textContent, (r.querySelector('.ovse-yai-chip') || {}).textContent || '']).slice(2, 8); })()`);
        assert.deepStrictEqual(open, [['Claude Code', 'Ready'], ['OpenCode', 'Ready'], ['Aider', 'Ready'], ['Gemini CLI', 'Ready'], ['Muse Code', 'Ready'], ['Codex', 'Set it up']], 'all six, in place');
        assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 390, 'nothing off the screen');
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('your-ai-compact-chrome: ready coding agents first, three shown, the rest one row; keys and Balance on the first screen ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
