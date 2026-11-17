'use strict';
// Rooms (4.307.0, plan §AD.25; the owner, 11-17: "have claude code work on the code and interface and then have muse and
// codex or API analyze and review the gui and critique it … a Design bot as a default next to Actor and Codes"). Over a
// local Frame at 390 px, a group whose round went build, review, fix:
//   • each agent's message says why it spoke beside its name ("Review 1 of 2", "@design asked for changes");
//   • a reviewer's last word is a chip (Approved; Asks for 2 changes) and a builder's DONE is a Done chip, never a
//     shouted word left at the end of the text;
//   • the members sheet says who reviews and that Design works with openvibe.design's rules and tools;
//   • Start a group offers three recipes, and "Build, then review" starts one with Actor leading, Codes, Design and the
//     Codex critic as reviewers, from the Frame's presets.
// Nothing off the screen; no page errors.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');

const root = path.join(__dirname, '..');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-rooms-chrome: skipped'); process.exit(0); }

const members = [
    { id: 'usr:ada', kind: 'person', name: 'Ada', handle: 'ada' },
    { id: 'agent:actor', kind: 'agent', name: 'Actor', handle: 'actor', product: 'actor', lead: true },
    { id: 'agent:codes', kind: 'agent', name: 'Codes', handle: 'codes', product: 'codes', coder: true },
    { id: 'agent:design', kind: 'agent', name: 'Design', handle: 'design', product: 'actor', engine: { kind: 'agent', specialist: 'design' }, reviewer: true },
    { id: 'agent:codex-review', kind: 'agent', name: 'Codex · review', handle: 'codex-review', product: 'actor', engine: { kind: 'harness', harness: 'codex' }, reviewer: true },
];
const a = (seq, id, name, text, why) => ({ seq, kind: 'message', from: 'agent', author: { id, name, handle: id.split(':')[1] }, text, status: 'done', ...(why ? { why } : {}) });
const steps = [
    { seq: 1, kind: 'message', from: 'person', author: { id: 'usr:ada', name: 'Ada', you: true }, text: '@codes build the usage sheet', status: 'done' },
    a(2, 'agent:codes', 'Codes', 'Built it: https://openvibe.live/x. DONE', '@codes'),
    a(3, 'agent:design', 'Design', 'The tabs read well.\nCHANGES\n1. The gauges are full width: draw each to its share.\n2. The rows stick out of the sheet at 390 px.', 'review 1 of 2'),
    a(4, 'agent:codex-review', 'Codex · review', 'The code reads fine.\nAPPROVED', 'review 1 of 2'),
    a(5, 'agent:codes', 'Codes', 'Fixed both. DONE', '@design asked for changes'),
];
const presets = [
    { handle: 'actor', name: 'Actor', product: 'actor', lead: true, default: true },
    { handle: 'codes', name: 'Codes', product: 'codes', coder: true, default: true },
    { handle: 'design', name: 'Design', product: 'actor', engine: { kind: 'agent', specialist: 'design' }, reviewer: true, default: true },
    { handle: 'codex-review', name: 'Codex · review', product: 'actor', engine: { kind: 'harness', harness: 'codex' }, reviewer: true },
    { handle: 'claude-review', name: 'Claude Code · review', product: 'actor', engine: { kind: 'harness', harness: 'claude-code' }, reviewer: true },
    { handle: 'muse-review', name: 'Muse · review', product: 'actor', engine: { kind: 'harness', harness: 'muse' }, reviewer: true },
    { handle: 'model-review', name: 'A model · review', product: 'actor', engine: { kind: 'model' }, reviewer: true },
];
const started = [];
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, codes: true, title: 'Vibe' });</script></body></html>`;
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const run = (id) => ({ id, ref: `group:${id}`, kind: 'group', title: id === 'g1' ? 'Usage sheet' : 'Build and review', status: 'waiting', members, agent: { id: 'group', name: 'Usage sheet', product: 'group' } });
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const p = decodeURIComponent(u.pathname);
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.(js|css)$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) {
        res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'application/javascript; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(root, p.slice(1))));
    }
    if (p === '/api/frame/groups' && req.method === 'GET') return json(res, 200, { groups: [], can_start: true });
    if (p === '/api/frame/groups' && req.method === 'POST') {
        let raw = ''; req.on('data', (c) => { raw += c; }); req.on('end', () => { started.push(JSON.parse(raw || '{}')); json(res, 201, { id: 'g2', title: 'Build and review' }); });
        return undefined;
    }
    if (p === '/api/frame/groups/presets') return json(res, 200, { agents: presets });
    if (p === '/api/frame/runs') return json(res, 200, { runs: [], partial: [] });
    const m = /^\/api\/frame\/runs\/group:(g[12])(\/.*)?$/.exec(p);
    if (m && !m[2]) return json(res, 200, run(m[1]));
    if (m && m[2] === '/steps') return json(res, 200, { steps: m[1] === 'g1' ? steps : [], next: null });
    if (m && m[2].startsWith('/events')) { res.writeHead(204); return res.end(); }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [], places: [] });
    return json(res, 404, {});
});

(async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-rooms-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 860 });
        const errors = []; p.on('pageerror', (e) => errors.push(String(e && e.message || e)));
        await p.goto(base, { maxMs: 8000 });
        await until(p, "!!document.querySelector('.ovse-group-start')");
        await p.evaluate("window.__s.open('group:g1')");
        const said = await until(p, `(() => { const n = [...document.querySelectorAll('.ovse-say')].filter((x) => x.querySelector('.ovse-author')); if (n.length < 4) return null;
            return n.map((x) => [x.querySelector('.ovse-author').firstChild.textContent, (x.querySelector('.ovse-why') || {}).textContent || '', (x.querySelector('.ovse-verdict') || {}).textContent || '', /APPROVED|DONE/.test(x.textContent)]); })()`);
        assert.deepStrictEqual(said, [
            ['Codes', '', 'Done', false],
            ['Design', 'Review 1 of 2', 'Asks for 2 changes', false],
            ['Codex · review', 'Review 1 of 2', 'Approved', false],
            ['Codes', '@design asked for changes', 'Done', false],
        ], 'why each spoke, and the verdicts as chips');
        assert.ok(await p.evaluate("[...document.querySelectorAll('.ovse-say')].some((x) => !/CHANGES/.test(x.textContent) && /gauges are full width/.test(x.textContent) && x.querySelectorAll('li').length === 2)"), 'the asks stay readable as a list; the chip says CHANGES');
        if (process.env.OV_SHOT) { await pause(600); const shot = await p.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${process.env.OV_SHOT}-room-390.png`, Buffer.from(shot.data, 'base64')); }

        // Who reviews, and what Design works with.
        await p.evaluate("document.querySelector('.ovse-group-faces').click()");
        await until(p, "!!document.querySelector('.ovse-gsheet .ovse-gmember')");
        const listed = await p.evaluate("[...document.querySelectorAll('.ovse-gsheet .ovse-gmember')].map((r) => r.textContent)");
        assert.ok(listed.some((x) => x.includes('Design · @design') && x.includes('openvibe.design\'s rules and tools · reviews')), listed.join(' | '));
        assert.ok(listed.some((x) => x.includes('Codex · review · @codex-review') && x.includes('codex · reviews')), listed.join(' | '));
        await p.evaluate("document.querySelector('.ovse-gsheet .ovse-ib').click()");

        // Start a group from a recipe.
        await p.evaluate("window.__s.blank()");
        await until(p, "!!document.querySelector('.ovse-group-start')");
        await p.evaluate("document.querySelector('.ovse-group-start').click()");
        const rows = await until(p, "(() => { const r = [...document.querySelectorAll('.ovp-row .ovp-t b')].map((b) => b.textContent); return r.length === 3 ? r : null; })()");
        assert.deepStrictEqual(rows, ['Actor, Codes and Design', 'Build, then review', 'A panel of critics']);
        await p.evaluate("[...document.querySelectorAll('.ovp-row')].find((r) => /Build, then review/.test(r.textContent)).click()");
        await until(p, 'window.location && ' + "document.querySelector('.ovse-title') && document.querySelector('.ovse-title').textContent === 'Build and review'");
        assert.strictEqual(started.length, 1);
        assert.strictEqual(started[0].title, 'Build and review');
        assert.deepStrictEqual(started[0].agents.map((x) => [x.handle, !!x.lead, !!x.reviewer]), [['actor', true, false], ['codes', false, false], ['design', false, true], ['codex-review', false, true]], 'Actor leads, Codes builds, Design and Codex review');
        assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 390, 'no sideways scroll');
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('session-rooms-chrome: why each agent spoke, verdicts as chips, who reviews, and a group started from a recipe');
    } finally { await browser.close(); server.close(); }
    process.exit(0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
