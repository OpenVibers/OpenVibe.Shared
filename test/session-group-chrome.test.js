'use strict';
// Group conversations in the session surface (4.302.0, plan §AD.19): a group is a run (group:<id>) every site opens;
// its bar shows the people and agents (each agent's @handle and harness), someone else's words carry their name on the
// others' side, an agent at work shows its name and waits, the Space sheet lists every file with its download, @ in the
// box offers the members, Add puts an agent role in, and admins see "Start a group" on a new session.
//   node test/session-group-chrome.test.js
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');

const root = path.join(__dirname, '..');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-group-chrome: skipped'); process.exit(0); }

let members = [
    { id: 'usr:ada', kind: 'person', name: 'Ada', handle: 'ada' },
    { id: 'usr:bo', kind: 'person', name: 'Bo', handle: 'bo' },
    { id: 'agent:actor', kind: 'agent', name: 'Actor', handle: 'actor', product: 'actor', lead: true },
    { id: 'agent:codex', kind: 'agent', name: 'Actor · Codex', handle: 'codex', product: 'actor', engine: { kind: 'harness', harness: 'codex' } },
    { id: 'agent:codes', kind: 'agent', name: 'Codes', handle: 'codes', product: 'codes', coder: true },
];
const steps = [
    { seq: 1, kind: 'message', from: 'person', author: { id: 'usr:ada', name: 'Ada', you: true }, text: 'Plan the launch', status: 'done' },
    { seq: 2, kind: 'message', from: 'person', author: { id: 'usr:bo', name: 'Bo', you: false }, text: 'And fix the deploy script', status: 'done' },
    { seq: 3, kind: 'message', from: 'agent', author: { id: 'agent:codes', name: 'Codes', handle: 'codes' }, text: 'Fixed it. DONE', status: 'done',
        files: [{ id: 'med_01J00000000000000000000000', name: 'patch.diff', url: 'https://openvibe.media/o/med_01J00000000000000000000000', type: 'text/x-diff' }] },
    { seq: 4, kind: 'message', from: 'agent', author: { id: 'agent:actor', name: 'Actor', handle: 'actor' }, text: null, status: 'running' },
];
const added = [];
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, codes: true, title: 'Vibe' });</script></body></html>`;
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const p = decodeURIComponent(u.pathname);
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.(js|css)$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) {
        res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'application/javascript; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(root, p.slice(1))));
    }
    if (p === '/api/frame/groups' && req.method === 'GET') return json(res, 200, { groups: [], can_start: true });
    if (p === '/api/frame/actor/faces') return json(res, 200, { agents: [{ id: 'agt_01J0SC0VT0000000000000000Z', name: 'Scout Bot', glyph: 'spark', hue: 200, state: 'resting' }, { id: 'not-an-agent', name: 'Nope' }] });
    if (p === '/api/frame/groups/presets') return json(res, 200, { agents: [{ handle: 'opencode', name: 'Codes · OpenCode', product: 'codes', harness: 'opencode', line: 'Codes on the OpenCode harness' }] });
    if (p === '/api/frame/groups/g1/members' && req.method === 'POST') {
        let raw = ''; req.on('data', (c) => { raw += c; }); req.on('end', () => { const b = JSON.parse(raw || '{}'); added.push(b); members = [...members, { id: `agent:${b.agent.handle}`, kind: 'agent', name: b.agent.name, handle: b.agent.handle, product: b.agent.product, harness: b.agent.harness, ...(b.agent.agent ? { personal: true, owner_name: 'Ada' } : {}) }]; json(res, 201, { members }); });
        return undefined;
    }
    if (p === '/api/frame/runs') return json(res, 200, { runs: [{ id: 'g1', ref: 'group:g1', kind: 'group', title: 'Launch room', status: 'running', updated_at: new Date().toISOString(), agent: { id: 'group', name: 'Launch room', product: 'group' } }] });
    if (p === '/api/frame/runs/group:g1') return json(res, 200, { id: 'g1', ref: 'group:g1', kind: 'group', title: 'Launch room', status: 'running', members, agent: { id: 'group', name: 'Launch room', product: 'group' } });
    if (p === '/api/frame/runs/group:g1/steps') return json(res, 200, { steps, next: null });
    if (p.startsWith('/api/frame/runs/group:g1/events')) { res.writeHead(204); return res.end(); }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [], places: [] });
    return json(res, 404, {});
});

(async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-group-')) });
    try {
        for (const w of [390, 1280]) {
            const ctx = await browser.newContext();
            const p = await h.openPage(browser, ctx, { width: w, height: 860 });
            const errors = []; p.on('pageerror', (e) => errors.push(String(e && e.message || e)));
            await p.goto(base, { maxMs: 8000 });
            // A new session: admins and the owner see "Start a group".
            await until(p, "!!document.querySelector('.ovse-group-start')");
            // The group as a run.
            await p.evaluate("window.__s.open('group:g1')");
            await until(p, "!!document.querySelector('.ovse-gbar:not([hidden]) .ovse-gm-face')");
            assert.strictEqual(await p.evaluate("document.querySelector('.ovse-group-count').textContent"), '2 people · 3 agents');
            assert.deepStrictEqual(await p.evaluate("[...document.querySelectorAll('.ovse-gm-stack .ovse-gm-face')].map((x) => x.dataset.handle)"), ['ada', 'bo', 'actor', 'codex', 'codes']);
            // Everyone, with each agent's role: a tap on the faces.
            await p.evaluate("document.querySelector('.ovse-group-faces').click()");
            await until(p, "!!document.querySelector('.ovse-gsheet .ovse-gmember')");
            const listed = await p.evaluate("[...document.querySelectorAll('.ovse-gsheet .ovse-gmember')].map((r) => r.textContent)");
            assert.ok(listed.some((x) => x.includes('Actor · Codex · @codex') && x.includes('Actor · codex')), 'the harness an agent works through: ' + listed.join(' | '));
            assert.ok(listed.some((x) => x.includes('Codes · @codes') && x.includes('takes the code')));
            await p.evaluate("document.querySelector('.ovse-gsheet .ovse-ib').click()");
            await until(p, "!!document.querySelector('.ovse-them')");
            const them = await p.evaluate("(() => { const n = document.querySelector('.ovse-them'); return [n.querySelector('.ovse-author').textContent, n.textContent.includes('And fix the deploy script')]; })()");
            assert.deepStrictEqual(them, ['Bo', true], 'someone else\'s words carry their name');
            assert.ok(await p.evaluate("!!document.querySelector('.ovse-me') && document.querySelector('.ovse-me').textContent.includes('Plan the launch')"), 'your own words stay yours');
            assert.strictEqual(await p.evaluate("document.querySelector('.ovse-group-working .ovse-author').textContent"), 'Actor', 'an agent at work shows its name');
            // The shared space.
            if (process.env.OV_SHOT) { await pause(700); const shot = await p.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${process.env.OV_SHOT}-${w}.png`, Buffer.from(shot.data, 'base64')); }
            await p.evaluate("[...document.querySelectorAll('.ovse-group-b')].find((b) => /Space/.test(b.textContent)).click()");
            await until(p, "!!document.querySelector('.ovse-gsheet .ovse-gfile')");
            const file = await p.evaluate("(() => { const a = document.querySelector('.ovse-gsheet a.ovse-gfile'); return [a.textContent.includes('patch.diff'), a.textContent.includes('Codes'), a.getAttribute('href'), a.hasAttribute('download')]; })()");
            assert.deepStrictEqual(file, [true, true, 'https://openvibe.media/o/med_01J00000000000000000000000', true]);
            await p.evaluate("document.querySelector('.ovse-gsheet .ovse-ib').click()");
            // @ in the box offers the members.
            await p.evaluate("(() => { const t = document.querySelector('.ovse-compose textarea'); t.focus(); t.value = 'hey @co'; t.setSelectionRange(7, 7); t.dispatchEvent(new Event('input', { bubbles: true })); })()");
            await until(p, "!!document.querySelector('.ovse-mention:not([hidden]) .ovse-mention-b')");
            assert.deepStrictEqual(await p.evaluate("[...document.querySelectorAll('.ovse-mention-b')].map((b) => b.textContent)"), ['@codex', '@codes']);
            await p.evaluate("document.querySelectorAll('.ovse-mention-b')[1].click()");
            assert.strictEqual(await p.evaluate("document.querySelector('.ovse-compose textarea').value"), 'hey @codes ');
            // Add an agent role.
            if (w === 1280) {
                await p.evaluate("[...document.querySelectorAll('.ovse-group-b')].find((b) => /Add/.test(b.textContent)).click()");
                await until(p, "!!document.querySelector('.ovse-gsheet button.ovse-gfile')");
                await p.evaluate("document.querySelector('.ovse-gsheet button.ovse-gfile').click()");
                await until(p, "[...document.querySelectorAll('.ovse-gm-face')].some((x) => x.dataset.handle === 'opencode')");
                assert.deepStrictEqual(added[0].agent.handle, 'opencode');
                // Your own agent (Network #1070): listed with its face, added by its agt_ id with a handle from its name.
                await p.evaluate("[...document.querySelectorAll('.ovse-group-b')].find((b) => /Add/.test(b.textContent)).click()");
                await until(p, "!!document.querySelector('.ovse-gsheet .ovse-gyours')");
                assert.deepStrictEqual(await p.evaluate("[...document.querySelectorAll('.ovse-gsheet .ovse-gyours b')].map((b) => b.textContent)"), ['Scout Bot · @scout-bot'], 'only real agt_ ids, named for @');
                assert.ok(await p.evaluate("!!document.querySelector('.ovse-gsheet .ovse-gyours .ovse-face')"), 'with its face');
                await p.evaluate("document.querySelector('.ovse-gsheet .ovse-gyours').click()");
                // Six faces show; the seventh member is the +1 and the count.
                await until(p, "document.querySelector('.ovse-group-count').textContent === '2 people · 5 agents'");
                assert.deepStrictEqual(added[1].agent, { product: 'actor', agent: 'agt_01J0SC0VT0000000000000000Z', name: 'Scout Bot', handle: 'scout-bot' });
                await p.evaluate("document.querySelector('.ovse-group-faces').click()");
                await until(p, "!!document.querySelector('.ovse-gsheet .ovse-gmember')");
                assert.ok(await p.evaluate("[...document.querySelectorAll('.ovse-gsheet .ovse-gmember')].some((r) => /Ada's own agent/.test(r.textContent))"), 'whose agent it is');
                await p.evaluate("document.querySelector('.ovse-gsheet .ovse-ib').click()");
            }
            assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), w, 'no sideways scroll');
            assert.deepStrictEqual(errors, [], 'no page errors');
            if (p.close) await p.close().catch(() => {});
        }
        console.log('session-group-chrome: a group is a run every site opens: members with their harness, others\' names, agents at work, the shared space, @ chips, adding an agent');
    } finally { await browser.close(); server.close(); }
    process.exit(0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
