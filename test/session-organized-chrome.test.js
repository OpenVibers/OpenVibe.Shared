'use strict';
// 4.311.0, the owner's phone (11-18): "add custom layouts for this, explain this better, make this more organized … I'm so
// confused … more user friendly and intuitive", over a local Frame at 390 px:
//   - the spent free AI, refused when a session starts, is a card with its ways to keep going, never a white bubble;
//   - the hello explains each choice in a line (who answers, what it thinks with, where it runs, your own AI);
//   - the box's row stays on one line: the modes, one chip, the road;
//   - a picture you send shows as a picture, not only its name.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-organized-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const SPENT = 'You have used today\'s free allowance ($0.05). It comes back at midnight UTC. To keep going now, add your own model key at https://openvibe.actor/chat/model: Actor runs on it, and it does not count against the free allowance.';
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, codes: true, title: 'Vibe' });</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
let refuse = true;
const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/run-options') {
        return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' },
            { id: 'claude-code', name: 'Claude Code', kind: 'harness', available: true }], places: [{ kind: 'auto', name: 'Auto' }, { kind: 'openvibe', name: 'OpenVibe' }] });
    }
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 }, caps: { usd: 1 } });
    if (p === '/api/frame/runs' && req.method === 'GET') return json(res, 200, { runs: [], partial: [] });
    if (p === '/api/frame/runs' && req.method === 'POST') {
        if (refuse) return json(res, 429, { type: 'about:blank', title: 'Too many', status: 429, code: 'actor.budget.day_spent', detail: SPENT });
        return json(res, 201, { ref: 'actor:run_9', id: 'run_9', kind: 'chat', title: 'Look at this', status: 'running', created_at: new Date().toISOString(), agent: { id: 'actor', name: 'Actor' } });
    }
    if (p === '/api/frame/runs/files' || p === '/api/frame/files') return json(res, 201, { file: { id: 'f_1', name: 'cat.png', kind: 'image', type: 'image/png' } });
    if (/^\/api\/frame\/runs\/actor%3Arun_9/.test(req.url) || /^\/api\/frame\/runs\/actor:run_9/.test(req.url)) {
        if (/\/events/.test(req.url)) { res.writeHead(200, { 'content-type': 'text/event-stream' }); return; }
        if (/\/steps/.test(req.url)) return json(res, 200, { steps: [] });
        return json(res, 200, { ref: 'actor:run_9', id: 'run_9', kind: 'chat', title: 'Look at this', status: 'running', agent: { id: 'actor', name: 'Actor' } });
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-organized-')) });
    let failed = 0;
    const check = async (name, fn) => { try { await fn(); console.log(`  ✓ ${name}`); } catch (e) { failed += 1; console.log(`  ✗ ${name}\n      ${e && e.message}`); } };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });

        await check('the hello explains each choice in a line', async () => {
            const rows = await until(p, "document.querySelectorAll('.ovse-how.is-list .ovse-how-c').length >= 4 && [...document.querySelectorAll('.ovse-how.is-list .ovse-how-c')].map((b) => [b.querySelector('small').textContent, (b.querySelector('.ovse-how-l') || {}).textContent || ''])");
            assert.deepStrictEqual(rows.map((r) => r[0]).slice(0, 3), ['Who answers', 'Thinks with', 'Runs on'], JSON.stringify(rows));
            assert.ok(rows.every((r) => r[1].length > 10), `every row says what it means: ${JSON.stringify(rows)}`);
            assert.match(await p.evaluate("document.querySelector('.ovse-how-h').textContent"), /How your next message runs/);
        });

        await check('the box\'s row is one line at 390 px: the modes, one chip, the road', async () => {
            const row = await p.evaluate(`(() => { const r = document.querySelector('.ovse-ctxrow'); const kids = [...r.children].filter((x) => !x.hidden && getComputedStyle(x).display !== 'none' && x.getBoundingClientRect().width > 0);
                const tops = kids.map((x) => Math.round(x.getBoundingClientRect().top)); return { n: kids.length, spread: Math.max(...tops) - Math.min(...tops), h: Math.round(r.getBoundingClientRect().height), chips: r.querySelectorAll('.ovse-ctx').length, engine: r.querySelectorAll('.ovse-engine').length }; })()`);
            assert.ok(row.spread <= 6 && row.h <= 48, `one line: ${JSON.stringify(row)}`);
            assert.deepStrictEqual([row.chips, row.engine], [1, 0], 'one chip');
            assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'nothing off the screen');
        });

        await check('the spent free AI is a card with its ways to keep going, never a bubble', async () => {
            await until(p, "!!document.querySelector('.ovse-compose textarea')");
            await p.evaluate(`(() => { const ta = document.querySelector('.ovse-compose textarea'); ta.focus(); ta.value = 'Test'; ta.dispatchEvent(new Event('input', { bubbles: true }));
                const f = document.querySelector('.ovse-compose form'); if (f) f.requestSubmit(); else ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()`);
            const card = await until(p, "(() => { const c = document.querySelector('.ovse-spent.is-float'); return c && { head: c.querySelector('b').textContent, line: c.querySelector('.ovse-spent-l').textContent, acts: [...c.querySelectorAll('.ovse-spent-b')].map((b) => b.textContent) }; })()");
            assert.strictEqual(card.head, 'Today\'s free AI is used up');
            assert.match(card.line, /comes back in \d+ (h|min)/);
            assert.deepStrictEqual(card.acts, ['Your own key', 'Your computer', 'More ways']);
            assert.strictEqual(await p.evaluate("[...document.querySelectorAll('.ovse-flash')].filter((x) => /free allowance/.test(x.textContent)).length"), 0, 'no white bubble');
            const r = await p.evaluate("(() => { const b = document.querySelector('.ovse-spent.is-float').getBoundingClientRect(); return { l: b.left, r: b.right }; })()");
            assert.ok(r.l >= 0 && r.r <= 390, JSON.stringify(r));
            await p.evaluate("document.querySelector('.ovse-spent-x').click()");
            await until(p, "!document.querySelector('.ovse-spent.is-float')", 3000);
        });

        await check('a picture you send shows as a picture', async () => {
            refuse = false;
            await p.evaluate("window.__s.blank()");
            const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8Dwn4GBgYGJgYGBAQAZHgID7SjpKwAAAABJRU5ErkJggg==';
            await until(p, "!!document.querySelector('.ovse-compose input[type=file]')");
            await p.evaluate(`(() => { const bin = atob('${png}'); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                const dt = new DataTransfer(); dt.items.add(new File([bytes], 'cat.png', { type: 'image/png' }));
                const input = document.querySelector('.ovse-compose input[type=file]'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
            await until(p, "!!document.querySelector('.ovc-file')");
            await p.evaluate(`(() => { const ta = document.querySelector('.ovse-compose textarea'); ta.focus(); ta.value = 'Look at this'; ta.dispatchEvent(new Event('input', { bubbles: true }));
                const f = document.querySelector('.ovse-compose form'); if (f) f.requestSubmit(); else ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()`);
            const img = await until(p, "(() => { const i = document.querySelector('.ovse-attach img.ovse-thumb'); return i && i.getAttribute('src').slice(0, 30); })()");
            assert.ok(/^(data:image\/|https:)/.test(img), img);
        });
        assert.deepStrictEqual(errors, []);
    } finally {
        await browser.close();
        server.close();
    }
    if (failed) { console.log(`${failed} failed`); process.exit(1); }
    console.log('session organized: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
