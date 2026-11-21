'use strict';
// Setting up a coding agent, guided (4.336.0; the owner's phone, 11-21: "I'm trying to set up Claude Code harness, but I
// can't … there should be a guided setup"; the picker said Claude Code was Ready while no computer of theirs had it, and
// "Test" ran on another agent). Over a local Frame, in a real headless Chrome at 390 px: Claude Code picked but not set
// up, "Test" is not sent: "Set up Claude Code" opens with the computer and "Sign in on ov-node-01" (Codes' sign-in on that
// computer: it installs the agent if missing and takes the code back) and Check, and the words stay in the box. Check reads the computers again; once it is ready, Use Claude Code sends the
// waiting words to Claude Code. In the picker the row says "Not installed" and opens the same sheet. Nothing off screen.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('harness-setup-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
let ready = false;
const started = [];
const claude = () => ({
    id: 'claude-code', name: 'Claude Code', kind: 'harness', available: ready, badge: ready ? 'Ready' : 'Not installed',
    line: ready ? 'A coding agent by Anthropic' : 'Not on your machine yet',
    setup: ready ? null : { plan: 'a Claude Pro or Max plan', install: 'npm install -g @anthropic-ai/claude-code', sign_in: 'claude', sign_in_note: 'and sign in when it asks', docs: 'https://docs.claude.com/en/docs/claude-code/setup', url: 'https://openvibe.codes/setup#agent-claude-code' },
});
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>
localStorage.setItem('ov:composer:run', JSON.stringify({ agent: 'claude-code' }));
window.open = (u) => { window.__opened = (window.__opened || []).concat([u]); return {}; };
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, codes: true, title: 'Vibe' })
</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const read = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => ok(b ? JSON.parse(b) : {})); });
const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/run-options') {
        return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' }, claude()],
            places: [{ kind: 'auto', name: 'Auto' }, { kind: 'machine', id: 'dev_01K9R2V6M8Q4T0B7C3D5E9F2GB', name: 'ov-node-01', line: 'Online' }] });
    }
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/runs' && req.method === 'POST') { const b = await read(req); started.push(b); return json(res, 201, { id: 'run_1', ref: 'codes:run_1', status: 'running', title: b.text || 'Test' }); }
    if (p === '/api/frame/runs') return json(res, 200, { runs: [], partial: [] });
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-harness-setup-')) });
    let failed = 0;
    const check = async (name, fn) => { try { await fn(); console.log(`  ✓ ${name}`); } catch (e) { failed += 1; console.log(`  ✗ ${name}\n      ${e && e.message}`); } };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await until(p, "!!document.querySelector('.ovse-foot textarea')");

        await check('the new session\'s Coding agent tile says Claude Code is not set up, and opens its setup (4.337.0)', async () => {
            const tile = await until(p, "(() => { const b = document.querySelector('.ovse-how-c.is-warn'); return b && b.textContent; })()");
            assert.match(tile, /Claude Code/);
            assert.match(tile, /Set it up/);
            await p.evaluate("document.querySelector('.ovse-how-c.is-warn').click()");
            const title = await until(p, "(() => { const s = document.querySelector('.ovse-sheet.is-in'); return s && s.querySelector('.ovse-sheet-h b').textContent; })()");
            assert.strictEqual(title, 'Set up Claude Code');
            await p.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
            await until(p, "!document.querySelector('.ovse-sheet')");
        });

        await check('"Test" to Claude Code that is not set up is not sent: the guided sheet opens and the words stay', async () => {
            await p.evaluate("(() => { const t = document.querySelector('.ovse-foot textarea'); t.value = 'Test'; t.closest('form').requestSubmit(); })()");
            const sheet = await until(p, `(() => { const s = document.querySelector('.ovse-sheet.is-in'); return s && {
                title: s.querySelector('.ovse-sheet-h b').textContent,
                steps: [...s.querySelectorAll('.ovse-hs-step > .ovse-hs-t > b')].map((b) => b.textContent),
                done: [...s.querySelectorAll('.ovse-hs-step')].map((li) => li.classList.contains('is-done')),
                signIn: (s.querySelector('.ovse-hs-t2 .ovse-hs-link') || {}).textContent || null,
                why: s.querySelector('.ovse-hs-why').textContent }; })()`);
            assert.strictEqual(sheet.title, 'Set up Claude Code');
            assert.deepStrictEqual(sheet.steps, ['Your computer: ov-node-01', 'Sign in with your own account']);
            assert.deepStrictEqual(sheet.done, [true, false], 'the paired computer is done');
            assert.strictEqual(sheet.signIn, 'Sign in on ov-node-01', 'the sign-in runs on that computer, through Codes');
            await p.evaluate("document.querySelector('.ovse-hs-t2 .ovse-hs-link').click()");
            assert.deepStrictEqual(await p.evaluate('window.__opened'), ['https://openvibe.codes/setup#agent-claude-code'], 'it opens the sign-in on Codes');
            assert.match(sheet.why, /a Claude Pro or Max plan: OpenVibe never lends it someone else's sign-in/);
            assert.strictEqual(started.length, 0, 'nothing was sent');
            assert.strictEqual(await p.evaluate("document.querySelector('.ovse-foot textarea').value"), 'Test', 'the words stay in the box');
        });

        await check('Check reads the computers again: not yet says so; ready offers Use Claude Code, which sends the waiting words', async () => {
            await p.evaluate("document.querySelector('.ovse-hs-check').click()");
            await until(p, "/^Not yet: Not on your machine yet/.test(document.querySelector('.ovse-hs-said').textContent)");
            ready = true;
            await p.evaluate("document.querySelector('.ovse-hs-check').click()");
            await until(p, "!!document.querySelector('.ovse-hs-use')");
            assert.strictEqual(await p.evaluate("document.querySelector('.ovse-hs-said').textContent"), 'Claude Code is ready.');
            await p.evaluate("document.querySelector('.ovse-hs-use').click()");
            await until(p, "!document.querySelector('.ovse-sheet.is-in')");
            const end = Date.now() + 4000; while (!started.length && Date.now() < end) await pause(50);
            assert.strictEqual(started.length, 1, 'the waiting words were sent once it was ready');
            assert.strictEqual(started[0].text, 'Test');
            assert.strictEqual((started[0].agent || (started[0].how || {}).agent), 'claude-code', JSON.stringify(started[0]).slice(0, 300));
            await until(p, "document.querySelector('.ovse-foot textarea').value === ''");
        });

        await check('nothing pans sideways at 390 px, and no page errors', async () => {
            assert.ok(await p.evaluate('document.documentElement.scrollWidth <= innerWidth'));
            assert.deepStrictEqual(errors, []);
        });
    } finally {
        await browser.close();
        server.close();
    }
    if (failed) { console.log(`harness-setup-chrome: ${failed} failed`); process.exit(1); }
    console.log('harness-setup-chrome: a coding agent not set up is guided, not sent; Check, then Use it sends the waiting words');
})().catch((e) => { console.error(e); process.exit(1); });
