'use strict';
// The top box talks (4.287.0; the owner, 11-16: "from the top box, start a conversation with Vibe, Actor or any agent").
// In a real headless Chrome at 390 px, signed in, against a stand-in Frame:
//   • a question gets an Ask group first: your Actor by its name, Codes, and an agent you made with its face (never
//     your Actor twice);
//   • words that only name a thing ("live") keep the results first, and Ask comes near the end;
//   • a press on "Ask Scout" starts a conversation with that agent (the Frame's POST /runs names it);
//   • Enter on a request starts it with your Actor, in the menu, instead of searching.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-box-asks-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const SCOUT = 'agt_01ABCDEFGHJKMNPQRSTVWXYZ00';
const FRAME = { nav: [{ id: 'live', name: 'Live', url: 'https://openvibe.live/', icon: 'live', group: 'play' }], groups: [{ id: 'play', name: 'Play' }], soon: [], footer: {} };
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Asks</title><link rel="icon" href="data:,">
<script>
  window.__calls = [];
  const J = (b, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => b, text: async () => JSON.stringify(b), headers: new Headers({ 'content-type': 'application/json' }) });
  const realFetch = window.fetch;
  window.fetch = (u, o) => {
    const s = String(u); window.__calls.push({ u: s, m: (o && o.method) || 'GET', body: o && o.body });
    if (s.startsWith('https://openvibe.network/api/frame?')) return J(${JSON.stringify(FRAME)});
    if (s === 'https://openvibe.network/api/frame/actor/faces') return J({ agents: [
      { id: 'agt_01ABCDEFGHJKMNPQRSTVWXYZ11', name: 'Juniper', avatar_url: null, hue: 258, glyph: 'spark', state: 'resting', asks: 0 },
      { id: '${SCOUT}', name: 'Scout', avatar_url: 'https://pictures.test/scout.png', hue: 140, glyph: 'search', state: 'resting', asks: 0 }] });
    if (s.startsWith('https://openvibe.network/api/frame/actor')) return J({ id: 'act_1', name: 'Juniper', enabled: true, status: 'idle', now: {}, asks: [] });
    if (s.startsWith('https://openvibe.network/api/frame/runs') && (!o || !o.method || o.method === 'GET')) return J({ runs: [], next: null });
    // 4.288.0: the agent button's run starts (its page hears session.started); every other start is refused here.
    if (s === 'https://openvibe.network/api/frame/runs' && o && /safe defaults/.test(String(o.body || ''))) return J({ id: 'run_1', ref: 'actor:tsk_1', status: 'running', title: 'Set up AI' }, true, 201);
    if (s === 'https://openvibe.network/api/frame/runs') return J({ error: 'stand-in' }, false, 503);
    if (s.startsWith('https://')) return J({}, false, 404);
    return realFetch(u, o);
  };
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<script>document.addEventListener('DOMContentLoaded', function () { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} OpenVibeNavbar.init({ service: 'site', user: { id: 'u1', username: 'ada', display_name: 'Ada' }, token: 'tok-1', countViews: false, notifications: false }); });</script>
</body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css|woff2))$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': m[1].endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-asks-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(60); } };
    const type = (p, words) => p.evaluate(`(() => { const i = document.querySelector('.ovs-input'); i.focus(); i.value = ${JSON.stringify(words)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
    // A group's title is its own <li>; its rows are the siblings after it, up to the next title.
    const groups = (p) => p.evaluate(`[...document.querySelectorAll('.ovs-group')].map((g) => g.textContent.trim())`);
    const asks = (p) => p.evaluate(`(() => { const g = [...document.querySelectorAll('.ovs-group')].find((x) => x.textContent.trim() === 'Ask'); if (!g) return null;
        const out = []; for (let n = g.nextElementSibling; n && !n.classList.contains('ovs-group'); n = n.nextElementSibling) { const o = n.matches('.ovs-opt') ? n : n.querySelector('.ovs-opt'); if (o) out.push([o.querySelector('.ovs-title').textContent, (o.querySelector('.ovs-ic img') || {}).src || null]); }
        return out; })()`);
    const posted = (p) => p.evaluate(`window.__calls.filter((c) => c.u === 'https://openvibe.network/api/frame/runs' && c.m === 'POST').map((c) => JSON.parse(c.body || '{}'))`);
    const open = async (p) => {
        await p.goto(`${base}/`, { maxMs: 8000 });
        await until(p, `!!(window.OpenVibeDock && window.OpenVibeDock.mountInto)`, 'the Dock beside the navbar');
        await p.evaluate(`(document.getElementById('openvibe-burger') || document.getElementById('openvibe-search-btn')).click(), true`);
        await until(p, `!!document.querySelector('.ovs.is-open .ovs-input')`, 'the menu opened');
        await until(p, `window.__calls.some((c) => c.u === 'https://openvibe.network/api/frame/actor/faces')`, 'your agents read');
        await wait(300);
    };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await open(p);
        // A question: Ask leads, your Actor by its name, Codes, then Scout with its face; Juniper (your Actor) once.
        await type(p, 'what is live tonight?');
        await until(p, `(() => { const g = document.querySelector('.ovs-group'); return g && g.textContent.trim() === 'Ask'; })()`, 'Ask first for a question');
        assert.deepStrictEqual(await asks(p), [['Ask Juniper', null], ['Ask Codes', null], ['Ask Scout', 'https://pictures.test/scout.png']]);
        // A name of a thing (a place here): the results lead, Ask near the end.
        await type(p, 'live');
        await until(p, `[...document.querySelectorAll('.ovs-group')].some((g) => g.textContent.trim() === 'Ask') && document.querySelector('.ovs-group').textContent.trim() !== 'Ask'`, 'Ask is there, after the results');
        const order = await groups(p);
        assert.notStrictEqual(order[0], 'Ask', `results first for a name (${order.join(', ')})`);
        assert.ok(order.indexOf('Ask') > order.length - 3, `Ask near the end (${order.join(', ')})`);
        // A press on Ask Scout starts that agent's conversation.
        await type(p, 'find me a cheap flight to Lisbon?');
        await until(p, `[...document.querySelectorAll('.ovs-opt')].some((o) => o.querySelector('.ovs-title').textContent === 'Ask Scout' && /Lisbon/.test(o.textContent))`, 'Ask Scout shows for these words');
        await p.evaluate(`[...document.querySelectorAll('.ovs-opt')].find((o) => o.querySelector('.ovs-title').textContent === 'Ask Scout').click(), 1`);
        await until(p, `window.__calls.some((c) => c.u === 'https://openvibe.network/api/frame/runs' && c.m === 'POST')`, 'a conversation started', 10000);
        const first = (await posted(p))[0];
        assert.strictEqual(first.agent, SCOUT, 'Scout answers');
        assert.match(JSON.stringify(first), /cheap flight to Lisbon/);

        // Enter on a request asks your Actor in the menu; it does not search.
        const q = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await open(q);
        await type(q, 'Plan my week for the stream');
        await wait(150);
        await q.evaluate(`document.querySelector('.ovs-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })), 1`);
        await until(q, `window.__calls.some((c) => c.u === 'https://openvibe.network/api/frame/runs' && c.m === 'POST')`, 'Enter started a conversation', 10000);
        const asked = (await posted(q))[0];
        assert.strictEqual(asked.agent, 'actor', 'your Actor answers');
        assert.match(JSON.stringify(asked), /Plan my week for the stream/);
        assert.strictEqual(await q.evaluate(`!!document.querySelector('.ovs.is-results, .ovs-results')`), false, 'no results page');
        assert.strictEqual(await q.evaluate('document.documentElement.scrollWidth'), 390, 'nothing wider than the phone');
        // 4.288.0: the agent button's way in (OpenVibeSearch.ask): who answers, the model, and where it was asked go to
        // the Frame's POST /runs; the session's events reach the page as "ov:session".
        const a = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await open(a);
        await a.evaluate(`(() => { window.__heard = []; addEventListener('ov:session', (e) => window.__heard.push(e.detail.type));
            OpenVibeSearch.ask('Set up AI with safe defaults', { agent: 'actor', model: 'openrouter/auto', context: { site: 'openvibe.network', url: 'https://openvibe.network/admin/ai', title: 'AI setup', kind: 'form', extra: 'dropped' } }); return 1; })()`);
        await until(a, `window.__calls.some((c) => c.u === 'https://openvibe.network/api/frame/runs' && c.m === 'POST')`, 'ask() started a conversation', 10000);
        const run = (await posted(a))[0];
        assert.deepStrictEqual([run.agent, run.model && run.model.id, run.context], ['actor', 'openrouter/auto', { site: 'openvibe.network', url: 'https://openvibe.network/admin/ai', title: 'AI setup', kind: 'form' }]);
        await until(a, `window.__heard.includes('session.started')`, 'the page hears its session start');
        // approve first: the words wait in the box, nothing starts.
        const before = (await posted(a)).length;
        await a.evaluate(`OpenVibeSearch.ask('Explain this page', { prefill: true }), 1`);
        await until(a, `(() => { const t = document.querySelector('.ovse-compose textarea'); return t && t.value === 'Explain this page'; })()`, 'the words in the box');
        await wait(300);
        assert.strictEqual((await posted(a)).length, before, 'approve first starts nothing');
        console.log('menu-box-asks-chrome: a question asks first (your Actor, Codes, your agents with faces), Ask Scout starts Scout, Enter on a request asks your Actor; ask() names the agent, model and place, and prefill waits');
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
