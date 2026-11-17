'use strict';
// The menu's Vibe, set up your way (4.294.0; the owner's phone, 11-17: "when I choose codes, it brings me to a thing that
// still has the A from actor, and then it says vibe … you can't even edit these properly … the icon is really huge on
// codes … switching to actor doesn't work"; "configure their own API keys, or … the coding harness … all the different
// methods work interconnected, and model selection"; and on the 402: "should guide the user to set up their different
// coding agents or the harnesses … or set it up on the shared node or their own computer … rather than just being a lame
// ass message"). Over a local Frame, in a real headless Chrome at 390 px:
//   - Codes chosen: the hello is Codes' (its face, "What should we build?"), the head names Codes, its row is marked;
//     Actor chosen again: Actor's face and row. Both rows carry Set up at the size of Pause.
//   - How it runs sits under the hello (agent, model, runs on, your own), each one tap from its picker.
//   - A run that ended on the spent free allowance shows the setup card (own key, Codes, your computer, another model),
//     the raw words folded; its row in the sessions says it plainly; Hand it to Codes puts the words in a Codes session.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('vibe-setup-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const SPENT = 'OpenVibe.Exchange HTTP 402: The free AI allowance for usr_01KKT9AC60KM7CRTB3WN1Z8P56 is spent, and the calling service has no budget to cover this run. Add a key for the person, or wait for the allowance to reset. {"tried":[{"provider":"shared","skipped":"free_provider_not_allowed"}]}';
const runs = [
    { ref: 'actor:run_9', kind: 'task', title: 'Test', status: 'failed', created_at: iso(300), updated_at: iso(120), preview: SPENT, agent: { id: 'actor', name: 'Actor', hue: 265 } },
];
const steps = { 'actor:run_9': [
    { seq: 1, kind: 'message', from: 'person', status: 'done', text: 'Make me a tiny landing page for my band' },
    { seq: 2, kind: 'message', from: 'agent', status: 'done', text: SPENT },
] };
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>
window.__events = [];
window.open = (u) => { window.__opened = (window.__opened || []).concat([u]); return {}; };
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f,
  actor: true, codes: true, title: 'Vibe', starters: [['code', 'Build me a landing page']], onEvent: (t, d) => window.__events.push([t, d]) });
</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' }, { id: 'claude-code', name: 'Claude Code', kind: 'harness', line: 'Anthropic\'s coding agent' }],
        places: [{ kind: 'auto', name: 'Auto' }, { kind: 'openvibe', name: 'OpenVibe' }, { kind: 'shared', name: 'A shared node' }, { kind: 'machine', id: 'mch_1', name: 'Studio PC' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [{ id: 'openvibe', title: 'OpenVibe', rows: [{ model: 'glm/glm-4.7', name: 'GLM 4.7', maker: 'Zhipu' }] }] });
    if (p === '/api/frame/runs' && req.method === 'GET') return json(res, 200, { runs, partial: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 }, caps: { usd: 1 } });
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
        const ref = decodeURIComponent(m[1]); const rest = m[2] || '';
        const run = runs.find((r) => r.ref === ref);
        if (!run) return json(res, 404, { error: 'Not found' });
        if (!rest) return json(res, 200, run);
        if (rest === '/steps') return json(res, 200, { steps: steps[ref] || [] });
        if (rest === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); return; }
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-vibe-setup-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await until(p, "!!document.querySelector('.ovse-hello-face.is-actor .ovse-face')");
        assert.ok(await until(p, "document.querySelectorAll('.ovse-how .ovse-how-c').length >= 4"), 'How it runs, under the hello');

        // Codes: its hello, its head, its row marked; Set up the size of Pause on both rows.
        await p.evaluate("document.querySelector('.ovse-menu').click()");
        await until(p, "!document.querySelector('.ovse-actor').hidden && !!document.querySelector('.ovse-codes .ovse-actor-who')");
        const sizes = await p.evaluate("[...document.querySelectorAll('.ovse-actor .ovse-ib')].map((b) => { const r = b.getBoundingClientRect(), g = b.querySelector('svg').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(g.width)]; })");
        assert.ok(sizes.length >= 3 && sizes.every(([w, hh, g]) => w === sizes[0][0] && hh === sizes[0][1] && g <= 22), `every row's buttons one size, no huge icon (${JSON.stringify(sizes)})`);
        await p.evaluate("document.querySelector('.ovse-codes .ovse-actor-who').click()");
        const codes = await until(p, `(() => { const f = document.querySelector('.ovse-hello-face'); return f && f.classList.contains('is-code') && { t: document.querySelector('.ovse-hello-t').textContent, head: document.querySelector('.ovse-title').textContent,
            on: document.querySelector('.ovse-codes').classList.contains('is-on'), actorOn: document.querySelector('.ovse-actor:not(.ovse-codes)').classList.contains('is-on'), chip: document.querySelector('.ovse-how-c b').textContent }; })()`);
        assert.deepStrictEqual(codes, { t: 'What should we build?', head: 'Codes', on: true, actorOn: false, chip: 'Codes' }, 'Codes, not Actor\'s A and not "Vibe"');
        await p.evaluate("document.querySelector('.ovse-menu').click()");
        await until(p, "document.querySelector('.ovse-drawer') && !!document.querySelector('.ovse-actor:not(.ovse-codes) .ovse-actor-who')");
        await p.evaluate("document.querySelector('.ovse-actor:not(.ovse-codes) .ovse-actor-who').click()");
        const back = await until(p, `(() => { const f = document.querySelector('.ovse-hello-face'); return f && f.classList.contains('is-actor') && !!f.querySelector('.ovse-face') && { head: document.querySelector('.ovse-title').textContent, on: document.querySelector('.ovse-actor:not(.ovse-codes)').classList.contains('is-on'), codesOn: document.querySelector('.ovse-codes').classList.contains('is-on') }; })()`);
        assert.deepStrictEqual(back, { head: 'Juniper', on: true, codesOn: false }, 'switching back to Actor works');

        // Set up Codes: How it runs opens on it.
        await p.evaluate("document.querySelector('.ovse-menu').click()");
        await until(p, "!!document.querySelector('.ovse-codes .ovse-actor-set')");
        await p.evaluate("document.querySelector('.ovse-codes .ovse-actor-set').click()");
        await until(p, "!!document.querySelector('.ovse-hello-face.is-code') && /How it runs/.test(document.body.innerText)", 5000);

        // The spent allowance: the setup card, the raw words folded, the row plain.
        await p.evaluate("window.__s.open('actor:run_9')");
        const card = await until(p, `(() => { const c = document.querySelector('.ovse-setup'); return c && { h: c.querySelector('.ovse-setup-h b').textContent, rows: [...c.querySelectorAll('.ovse-setup-r b')].map((b) => b.textContent),
            raw: c.querySelector('.ovse-setup-raw').open === false && /HTTP 402/.test(c.querySelector('.ovse-setup-raw p').textContent), bare: [...document.querySelectorAll('.ovse-say')].some((x) => !x.classList.contains('ovse-setup') && /HTTP 402/.test(x.textContent)) }; })()`);
        assert.deepStrictEqual(card, { h: 'Your free AI is used up for today', rows: ['Use your own AI key', 'Hand it to Codes', 'Run on your computer', 'Pick another model'], raw: true, bare: false });
        await p.evaluate("document.querySelector('.ovse-menu').click()");
        assert.strictEqual(await until(p, "(document.querySelector('.ovse-row .ovse-row-l') || {}).textContent"), 'Free AI used up for today: set up your own', 'its row says it plainly');
        await p.evaluate("document.querySelector('.ovse-dclose') && document.querySelector('.ovse-dclose').click()");
        await p.evaluate("document.querySelectorAll('.ovse-setup-r')[2].click()");
        const opened = await until(p, 'window.__opened && window.__opened[window.__opened.length - 1]');
        assert.match(opened, /^https:\/\/openvibe\.link\/add-computer\?return_to=http%3A%2F%2F127\.0\.0\.1/, 'Your computer comes back here (add-computer needs return_to)');
        await p.evaluate("document.querySelectorAll('.ovse-setup-r')[1].click()");
        await until(p, "!!document.querySelector('.ovse-hello-face.is-code') && (document.querySelector('.ovse-foot textarea') || {}).value === 'Make me a tiny landing page for my band'");
        assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'no sideways scroll');
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('vibe-setup-chrome: the chosen agent shows (Codes and back to Actor), Set up on both rows, How it runs, the spent-allowance setup card, its row, Your computer comes back, Hand it to Codes ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
