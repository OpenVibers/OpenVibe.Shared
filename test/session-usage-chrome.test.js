'use strict';
// What a session used, and what you have left (4.306.0; the owner, 11-17, on the Vibe session: "display usage stats and
// tokens and all that for each harness or API balances or cost"). Over a local Frame at 390 px:
//   • the status line says the session's tokens and cost ("8.4k tokens · under 1¢"), and it is a button;
//   • it opens Usage: this session (each answer's receipt summed), by how it was paid and by model;
//   • Today and 30 days come from the Frame's /usage (Actor's receipts);
//   • the limits and balances: the free AI left, the day's limit, the Balance, the keys;
//   • each coding agent on your computers with its windows, the fullest first to warn;
//   • Your AI's first payment row says today's tokens and opens the same sheet.
// Nothing off the screen; no page errors.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-usage-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const soon = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
const run = { ref: 'actor:tsk_1', kind: 'chat', title: 'Review the new menu', status: 'succeeded', created_at: iso(300), updated_at: iso(60), agent: { id: 'actor', name: 'Actor' } };
const steps = [
    { seq: 1, kind: 'message', from: 'person', text: 'Review the new menu' },
    { seq: 18, kind: 'message', from: 'agent', text: 'Three things stand out.',
        cost: { usd: 0.0042, tokens: 6120, seconds: 21.4, by: { allowance: { tokens: 4100, usd: 0.0008, seconds: 9.8 }, key: { tokens: 2020, usd: 0.0042, seconds: 11.6 } } },
        model: { id: 'claude-sonnet-5-5', provider: 'anthropic' } },
    { seq: 21, kind: 'message', from: 'person', text: 'And on a phone?' },
    { seq: 38, kind: 'message', from: 'agent', text: 'The sheet fits.', cost: { usd: 0, tokens: 2300, seconds: 8, by: { machine: { tokens: 2300, usd: 0, seconds: 8 } } }, model: { id: 'qwen2.5-1.5b' } },
];
const usage = {
    days: 30, since: '2026-10-19',
    today: { usd: 0.0905, tokens: 68278, tasks: 2, by: { allowance: { usd: 0.0095, tokens: 53278, tasks: 1 }, key: { usd: 0.081, tokens: 15000, tasks: 1 } } },
    period: { usd: 0.5, tokens: 1234567, tasks: 44, by: { allowance: { usd: 0.2, tokens: 900000, tasks: 30 }, key: { usd: 0.3, tokens: 300000, tasks: 10 }, machine: { usd: 0, tokens: 34567, tasks: 4 } } },
    models: [{ id: 'deepseek-flash', provider: null, usd: 0.2, tokens: 900000, tasks: 30 }, { id: 'claude-sonnet-5-5', provider: 'anthropic', usd: 0.3, tokens: 300000, tasks: 10 }],
    limit: { per_day_usd: 1, tasks_per_day: 50 },
};
const resources = {
    allowance: { tier: 'standard', unlimited: false, tokens: 50000, used: 12000, left: 38000, resets_at: '2026-11-18T00:00:00.000Z' },
    keys: [{ provider: 'anthropic', status: 'ok' }, { provider: 'openrouter', status: 'failed' }], key_apps: [],
    balance: { amount: '1234', scale: 2, currency: 'USD' }, partial: [],
    harnesses: [{ agent: 'claude', name: 'Claude Code', machines: ['Tower', 'Laptop'], signed_in: true, windows: [{ name: '5-hour', pct: 72, resets_at: soon }, { name: 'weekly', pct: 30, resets_at: null }] },
        { agent: 'codex', name: 'Codex', machines: ['Tower'], signed_in: false, windows: [] }],
};
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, codes: true, title: 'Vibe' });
window.__s.open('actor:tsk_1');
</script></body></html>`;
let usageReads = 0;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const p = u.pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.(js|css)$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) {
        res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'application/javascript; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(root, p.slice(1))));
    }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }], places: [{ kind: 'auto', name: 'Auto' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/runs') return json(res, 200, { runs: [run], partial: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 } });
    if (p === '/api/frame/resources') return json(res, 200, resources);
    if (p === '/api/frame/usage') { usageReads++; assert.strictEqual(u.searchParams.get('days'), '30'); assert.strictEqual(req.headers.authorization, 'Bearer signed-in-test'); return json(res, 200, usage); }
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
        if (!m[2]) return json(res, 200, run);
        if (m[2] === '/steps') return json(res, 200, { steps, next: null });
        if (m[2] === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); return; }
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }
const SHEET = `(() => { const b = document.querySelector('.ovse-sheet .ovse-use'); if (!b) return null;
    const txt = (sel) => [...b.querySelectorAll(sel)].map((n) => n.textContent);
    return { on: txt('.ovse-use-tab.is-on')[0], big: b.querySelector('.ovse-use-big').textContent, unit: b.querySelector('.ovse-use-unit').textContent, sub: b.querySelector('.ovse-use-sub').textContent,
        segs: b.querySelectorAll('.ovse-use-seg').length, legend: [...b.querySelectorAll('.ovse-use-leg')].map((r) => [r.querySelector('b').textContent, r.querySelector('span').textContent]),
        models: [...b.querySelectorAll('.ovse-use-model')].map((r) => [r.querySelector('b').textContent, r.querySelector('.ovse-use-n').textContent]),
        lims: [...b.querySelectorAll('.ovse-use-list')[0].querySelectorAll('.ovse-use-row')].map((r) => [r.querySelector('b').textContent, (r.querySelector('.ovse-yai-chip') || {}).textContent || '']),
        agents: [...b.querySelectorAll('.ovse-use-agent')].map((a) => [a.querySelector('b').textContent, a.querySelector('small').textContent, (a.querySelector('.ovse-yai-chip') || {}).textContent, [...a.querySelectorAll('.ovse-use-win')].map((w) => [w.querySelector('.ovse-use-wn').textContent, w.querySelector('.ovse-use-wv').textContent.replace(/resets .*/, 'resets …')])]),
        w: document.documentElement.scrollWidth, sw: document.querySelector('.ovse-sheet').scrollWidth, cw: document.querySelector('.ovse-sheet').clientWidth,
        // Every row inside the sheet's body (a sheet is outside .ovse: its rows need their own border-box).
        out: (() => { const edge = b.getBoundingClientRect().right + 0.5; return [...b.querySelectorAll('.ovse-use-row, .ovse-use-model, .ovse-use-win, .ovse-yai-chip')].filter((n) => n.getBoundingClientRect().right > edge).length; })(),
        // Each gauge drawn to its share, not full: [share, drawn width / track width].
        gauges: [...b.querySelectorAll('.ovse-use-gauge')].map((g) => { const r = g.getBoundingClientRect(); const f = getComputedStyle(g, '::after').transform; const m = /matrix[(]([^,]+)/.exec(f); return [Number(g.style.getPropertyValue('--w')), m ? Number(m[1]) : (f === 'none' ? 1 : NaN), r.width > 0]; }) }; })()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-usage-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });

        // The status line: the session's tokens and cost, a button.
        const line = await until(p, "(() => { const b = document.querySelector('.ovse-stat-use'); return b && !b.hidden && b.textContent ? { text: b.textContent, tag: b.tagName, label: b.getAttribute('aria-label') } : null; })()");
        assert.deepStrictEqual([line.text, line.tag], ['8.4k tokens · under 1¢', 'BUTTON'], 'what the session used, in the status line');
        assert.match(line.label, /Open Usage/);

        // Usage: this session, from the answers' receipts.
        await p.evaluate("document.querySelector('.ovse-stat-use').click()");
        let u = await until(p, `(() => { const s = ${SHEET}; return s && s.lims.length >= 3 && s.agents.length ? s : null; })()`);
        assert.deepStrictEqual([u.on, u.big, u.unit, u.sub], ['This session', '8.4k', 'tokens', 'under 1¢ · 2 answers'], 'this session first');
        assert.strictEqual(u.segs, 3, 'one bar part per way it was paid');
        assert.deepStrictEqual(u.legend, [['Free AI', '4.1k tokens · free to you'], ['Your own key', '2k tokens · under 1¢'], ['Your computer', '2.3k tokens · free to you']]);
        assert.deepStrictEqual(u.models, [['Claude Sonnet 5.5', '6.1k · under 1¢'], ['Qwen2.5 1.5B', '2.3k']], 'the models, most tokens first');
        assert.deepStrictEqual(u.lims, [['Free AI today', '76% left'], ['Your day with Actor', ''], ['Your Balance', '$12.34'], ['Anthropic key', 'Ready'], ['OpenRouter key', 'Check it']], 'limits and balances');
        assert.deepStrictEqual(u.agents, [
            ['Claude Code', 'Tower, Laptop', '28% left', [['5-hour window', '72% used · resets …'], ['Weekly window', '30% used']]],
            ['Codex', 'Tower · not signed in', 'Sign in', []],
        ], 'each coding agent with its windows');
        assert.deepStrictEqual([u.w, u.sw <= u.cw, u.out], [390, true, 0], 'nothing off the screen or out of the sheet');
        await pause(800);   // the gauges' fill
        const drawn = (await p.evaluate(SHEET)).gauges;
        assert.ok(drawn.length >= 5 && drawn.every(([w, x, shown]) => shown && Math.abs(w - x) < 0.02), `each gauge is drawn to its share: ${JSON.stringify(drawn)}`);
        assert.ok(drawn.some(([w]) => w < 0.5), 'and some are short of full');

        // 30 days: Actor's numbers through the Frame.
        await p.evaluate("[...document.querySelectorAll('.ovse-use-tab')].find((t) => t.textContent === '30 days').click()");
        u = await until(p, `(() => { const s = ${SHEET}; return s && s.on === '30 days' ? s : null; })()`);
        assert.deepStrictEqual([u.big, u.sub], ['1.2M', '$0.50 · 44 tasks']);
        assert.deepStrictEqual(u.legend.map((x) => x[0]), ['Free AI', 'Your own key', 'Your computer']);
        assert.deepStrictEqual(u.models, [['DeepSeek Flash', '900k · $0.20'], ['Claude Sonnet 5.5', '300k · $0.30']]);
        await p.evaluate("[...document.querySelectorAll('.ovse-use-tab')].find((t) => t.textContent === 'Today').click()");
        u = await until(p, `(() => { const s = ${SHEET}; return s && s.on === 'Today' ? s : null; })()`);
        assert.deepStrictEqual([u.big, u.sub], ['68k', '$0.09 · 2 tasks']);
        assert.strictEqual(usageReads, 1, 'the Frame is asked once while the sheet is open');
        await p.evaluate("document.querySelector('.ovse-sheet .ovse-ib').click()");
        await until(p, "!document.querySelector('.ovse-sheet')");

        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('session-usage-chrome: the status line says tokens and cost and opens Usage; this session, today, 30 days by how it was paid and by model; limits, Balance, keys; each coding agent\'s windows');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
