'use strict';
// Where the next answer runs, before it is sent (4.297.0, plan §AD.17: "one agent system that always finds a way"; the
// owner, 11-17: "it can use different harnesses … even with the chat mode … or API keys"). Over a local Frame at 390 px,
// the session's context row carries a road chip from the Frame's /resources, in Actor's order:
//   • free AI left: a ring filled to what is left and "76% free";
//   • the free AI used up and a key Actor may use: that key ("Anthropic key");
//   • used up, no key Actor may use, a computer of yours online: that computer;
//   • nothing: amber, "Back <time>", and a tap opens Your AI on the ways to keep going;
//   • a coding run (Code) routes itself, and a Network without /resources says nothing: no chip.
// Nothing off the screen; no page errors.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-road-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const RESET = '2026-11-18T00:00:00.000Z';
const day = (left) => ({ tier: 'standard', unlimited: false, tokens: 50000, used: 50000 - left, left, resets_at: RESET });
const SCENES = {
    free: { allowance: day(38000), keys: [], key_apps: [], balance: null, partial: [] },
    key: { allowance: day(0), keys: [{ provider: 'openrouter', status: 'ok' }, { provider: 'anthropic', status: 'ok' }], key_apps: [{ service: 'actor', providers: ['anthropic'] }], balance: null, partial: [] },
    computer: { allowance: day(0), keys: [{ provider: 'openrouter', status: 'ok' }], key_apps: [], balance: null, partial: [] },
    none: { allowance: day(0), keys: [], key_apps: [], balance: null, partial: [] },
};
let scene = 'free', machineOnline = true, resourceReads = 0;
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>
window.open = (u) => { window.__opened = (window.__opened || []).concat([u]); return {}; };
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, codes: true, title: 'Vibe' });
</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.(js|css)$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) {
        res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'application/javascript; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(root, p.slice(1))));
    }
    if (p === '/api/frame/run-options') return json(res, 200, {
        agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' }],
        places: [{ kind: 'auto', name: 'Auto' }, { kind: 'openvibe', name: 'OpenVibe' }, { kind: 'machine', id: 'mch_1', name: 'Studio PC', online: machineOnline }],
    });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/runs') return json(res, 200, { runs: [], partial: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 }, caps: { usd: 1 } });
    if (p === '/api/frame/resources') { resourceReads++; return scene === 'old' ? json(res, 404, {}) : json(res, 200, SCENES[scene]); }
    if (p === '/api/frame/wallet/api/v1/me/wallet') return json(res, 200, { balances: { balance: { amount: '0', scale: 2, currency: 'USD' } } });
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }
const CHIP = `(() => { const r = document.querySelector('.ovse-road'); if (!r || r.hidden) return null;
    return { cls: r.className, text: r.querySelector('span').textContent, label: r.getAttribute('aria-label'), p: getComputedStyle(r).getPropertyValue('--ovse-road-p').trim(),
        glyph: r.querySelector('.ovse-road-ring svg').innerHTML.slice(0, 40), w: document.documentElement.scrollWidth }; })()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-road-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        const open = async (name, online = true) => { scene = name; machineOnline = online; await p.goto(base, { maxMs: 8000 }); await until(p, "!!document.querySelector('.ovse-ctxrow')"); };

        // Free AI left: the ring fills to what is left.
        await open('free');
        let c = await until(p, CHIP);
        assert.strictEqual(c.text, '76% free');
        assert.match(c.cls, /\bis-free\b/);
        assert.match(c.label, /38k of 50k tokens left today/);
        c = await until(p, `(() => { const c = ${CHIP}; return c && Math.abs(Number(c.p) - 0.76) < 0.01 ? c : null; })()`);
        assert.strictEqual(c.w, 390, 'nothing off the screen');

        // A tap opens Your AI.
        await p.evaluate("document.querySelector('.ovse-road').click()");
        assert.strictEqual(await until(p, "(document.querySelector('.ovse-sheet.is-in .ovse-sheet-h b') || {}).textContent"), 'Your AI');

        // Code routes itself: no chip.
        await p.evaluate("document.querySelector('.ovse-sheet.is-in .ovse-sheet-h .ovse-ib') && document.querySelector('.ovse-sheet.is-in .ovse-sheet-h .ovse-ib').click()");
        await until(p, "!document.querySelector('.ovse-sheet.is-in')");
        await p.evaluate("document.querySelector('.ovse-mode[data-mode=\"code\"]').click()");
        await until(p, "document.querySelector('.ovse-road').hidden");
        await p.evaluate("document.querySelector('.ovse-mode[data-mode=\"chat\"]').click()");
        assert.strictEqual((await until(p, CHIP)).text, '76% free', 'back for Chat');

        // Used up, a key Actor may use: that key (not the one it may not).
        await open('key');
        c = await until(p, `(() => { const c = ${CHIP}; return c && /is-key/.test(c.cls) ? c : null; })()`);
        assert.strictEqual(c.text, 'Anthropic key');
        assert.match(c.label, /^Your Anthropic key: the free AI is used up until /);

        // Used up, no key Actor may use, a computer online: that computer.
        await open('computer');
        c = await until(p, `(() => { const c = ${CHIP}; return c && /is-computer/.test(c.cls) ? c : null; })()`);
        assert.strictEqual(c.text, 'Studio PC');

        // Nothing: amber, when it is back, and Your AI on a tap.
        await open('computer', false);
        c = await until(p, `(() => { const c = ${CHIP}; return c && /is-none/.test(c.cls) ? c : null; })()`);
        assert.match(c.text, /^Back /);
        assert.match(c.label, /Add a key or a computer to keep going/);
        await p.evaluate("document.querySelector('.ovse-road').click()");
        await until(p, "!!document.querySelector('.ovse-sheet.is-in .ovse-yai-r')");

        // A Network without /resources: no chip, no error.
        await open('old');
        await until(p, "!!document.querySelector('.ovse-ctx')");
        const before = resourceReads;
        await until(p, `${before} > 0`);
        assert.ok(await p.evaluate("document.querySelector('.ovse-road').hidden"), 'no chip without the read');

        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('session-road-chrome: the next answer\'s road before it is sent (free AI left, your key, your computer, nothing yet); Code and old Networks say nothing ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
