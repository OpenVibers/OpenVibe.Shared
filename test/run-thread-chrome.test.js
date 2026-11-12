'use strict';
// The one run thread (ov-run.js, 4.224.0) in a real headless Chrome, against a stand-in for the Frame's Run API
// (Network /api/frame/runs): the list puts what needs you first and filters by kind without losing the words being
// typed; a thread draws your words, the agent's (links, numbered sources), thinking folded, a tool row, an approval card
// and a results card; it follows the run live and resumes after its last step; an approval and a message reach the API
// with the person's token; a new run starts from the list's box; page text never becomes markup; and nothing is wider
// than a phone.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('run-thread-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const T = '2026-11-12T10:00:00Z';
const RUNS = [
    { id: 'c_1', ref: 'chat:c_1', kind: 'chat', title: 'Goal bar ideas', status: 'waiting', waiting: { for: 'message' }, agent: { id: 'vibe', name: 'Vibe', glyph: 'spark' }, preview: { text: 'Three ideas for your goal bar' }, updated_at: T, url: 'https://openvibe.chat/vibe/c_1' },
    { id: 't_9', ref: 'actor:t_9', kind: 'task', title: 'Post the clip', status: 'waiting', waiting: { for: 'approval', what: 'Post it to your channel?', approval: 'apr_9' }, agent: { id: 'ag_1', name: 'Clipper', hue: 140 }, updated_at: '2026-11-12T09:00:00Z' },
    { id: 'k_3', ref: 'codes:k_3', kind: 'code', title: 'Fix the overlay', status: 'running', doing: { text: 'Running the tests', glyph: 'code' }, agent: { id: 'codes', name: 'Codes', glyph: 'code' }, updated_at: '2026-11-12T09:30:00Z' },
];
const STEPS = [
    { seq: 1, kind: 'message', from: 'person', text: 'Ideas for a goal bar <img src=x onerror="window.pwned=1">' },
    { seq: 2, kind: 'think', title: 'Thinking it over', text: 'A bar that fills as the goal nears.' },
    { seq: 3, kind: 'tool', title: 'Searched the web', glyph: 'search', status: 'done' },
    { seq: 4, kind: 'message', from: 'agent', text: 'Here are three:\n\n- A **filling** bar [1]\n- A ring\n- See https://openvibe.live/docs/whip', sources: [{ n: 1, url: 'https://example.org/bars', title: 'Bars' }, { n: 2, url: 'javascript:alert(1)', title: 'Bad' }] },
    { seq: 5, kind: 'message', from: 'agent', text: 'Done.', ui: { type: 'results', data: { results: [{ kind: 'timer', label: 'Timer, 10 min' }] } } },
    { seq: 6, kind: 'approval', title: 'Post it?', text: 'It goes to your channel.', result: { approval: 'ap_1', options: [{ id: 'approve', label: 'Post it' }, { id: 'decline', label: 'Not now' }] } },
];
// The Action Center (Network GET /api/v1/me/actions, common.action-item@1): one confirmation that needs you, one AI run
// working, and two the runs already show (the coding run, and the approval the task waits on): those two are not drawn twice.
const ACTIONS = { buckets: {
    waiting: [
        { service: 'network', id: 'cf_1', kind: 'approval', title: 'Let Clipper post for you', summary: 'A new app wants to post clips', bucket: 'waiting', state: 'waiting', created_at: T, updated_at: '2026-11-12T09:50:00Z', href: 'https://openvibe.network/confirm/cf_1', actions: ['approve', 'decline'] },
        { service: 'actor', id: 'apr_9', kind: 'approval', title: 'Post the clip', bucket: 'waiting', state: 'waiting', created_at: T, updated_at: T, href: 'https://openvibe.actor/a/apr_9', actions: ['approve', 'decline'] },
    ],
    running: [
        { service: 'ai', id: 'air_4', kind: 'ai_run', title: 'Captions for your VOD', step: 'Listening, 40%', bucket: 'running', state: 'running', created_at: T, updated_at: '2026-11-12T09:40:00Z', href: 'https://openvibe.ai/runs/air_4', actions: [] },
        { service: 'codes', id: 'k_3', kind: 'code_task', title: 'Fix the overlay', bucket: 'running', state: 'running', created_at: T, updated_at: T, href: 'https://openvibe.codes/tasks/k_3', actions: [] },
    ],
    scheduled: [], done: [], failed: [] } };
const seen = { auth: new Set(), kinds: [], lastIds: [], posts: [] };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/ov-run.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-run.js'))); }
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1020;color:#e6edf7"><div id="host" style="height:100vh"></div><script src="/ov-run.js"></script>'); }
    if (u.pathname === '/api/v1/me/actions') { seen.auth.add(req.headers.authorization || ''); res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(ACTIONS)); }
    if (u.pathname === '/api/v1/me/actions/network/cf_1/approve' && req.method === 'POST') { seen.posts.push({ path: u.pathname, body: null }); res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"item":{}}'); }
    if (!u.pathname.startsWith('/api/frame/runs')) { res.writeHead(404); return res.end(); }
    seen.auth.add(req.headers.authorization || '');
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const rest = decodeURIComponent(u.pathname.slice('/api/frame/runs'.length));
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (req.method === 'POST') seen.posts.push({ path: rest, body: body ? JSON.parse(body) : null, key: req.headers['idempotency-key'] || '' });
        if (rest === '' && req.method === 'GET') { const k = u.searchParams.get('kind'); seen.kinds.push(k || 'all'); return json(200, { runs: k ? RUNS.filter((r) => r.kind === k) : RUNS, next: null, partial: k ? [] : ['codes'] }); }
        if (rest === '' && req.method === 'POST') return json(201, { ...RUNS[0], id: 'c_2', ref: 'chat:c_2', title: 'A new one' });
        if (/^\/chat:c_[12]$/.test(rest)) return json(200, RUNS[0]);
        if (/^\/chat:c_[12]\/steps$/.test(rest)) return json(200, { steps: rest.includes('c_2') ? [] : STEPS, next: null });
        if (rest === '/chat:c_1/messages') return json(201, { seq: 8, kind: 'message', from: 'person', text: JSON.parse(body).text });
        if (rest === '/chat:c_1/approvals/ap_1' || rest === '/actor:t_9/approvals/apr_9') return json(200, { ok: true });
        if (/\/events$/.test(rest)) {
            seen.lastIds.push(req.headers['last-event-id'] || '');
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            if (seen.lastIds.length === 1) {
                res.write(`id: 7\nevent: step\ndata: ${JSON.stringify({ type: 'step', step: { seq: 7, kind: 'message', from: 'agent', text: 'One more thing.' } })}\n\n`);
                res.write(`id: 7\nevent: run\ndata: ${JSON.stringify({ type: 'run', run: { ...RUNS[0], title: 'Goal bar ideas, live' } })}\n\n`);
            }
            return setTimeout(() => res.end(), 150);
        }
        json(404, { error: 'No such run' });
    });
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-run-'));
    const browser = await h.launch({ tmpDir });
    try {
        for (const width of [390, 1280]) {
            seen.kinds.length = 0; seen.lastIds.length = 0; seen.posts.length = 0;
            const page = await h.openPage(browser, await browser.newContext(), { width, height: 820 });
            await page.goto(`${base}/`, { maxMs: 6000 });
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const until = async (expr, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(50); } return false; };
            const wide = () => page.evaluate('document.documentElement.scrollWidth > innerWidth + 1');
            await page.evaluate(`window.view = OpenVibeRun.mount(document.getElementById('host'), { base: '${base}/api/frame', token: () => 'tok_1', me: { name: 'Sam' } })`);

            // ── the list ──
            assert.ok(await until(`document.querySelectorAll('.ovr-rows .ovr-row:not(.is-ghost)').length === 3`), `${width}: three runs`);
            const list = await page.evaluate(`({ titles: [...document.querySelectorAll('.ovr-row-top b')].map((b) => b.textContent),
                needs: [...document.querySelectorAll('.ovr-row')].map((r) => r.classList.contains('is-needs')),
                filters: [...document.querySelectorAll('.ovr-filter')].map((b) => b.textContent + (b.getAttribute('aria-selected') === 'true' ? '*' : '')),
                pills: [...document.querySelectorAll('.ovr-pill')].map((p) => p.textContent), note: (document.querySelector('.ovr-list-note .ovr-note') || {}).textContent,
                lines: [...document.querySelectorAll('.ovr-row-line')].map((l) => l.textContent), box: !!document.querySelector('.ovr-compose form') })`);
            assert.deepEqual(list.titles, ['Goal bar ideas', 'Post the clip', 'Fix the overlay'], `${width}: in the API's order (it puts needs-you first)`);
            assert.deepEqual(list.needs, [false, true, false], `${width}: the run that needs you is marked`);
            assert.deepEqual(list.filters, ['All*', 'Chats', 'Tasks', 'Code'], `${width}: All · Chats · Tasks · Code, All chosen`);
            assert.deepEqual(list.pills, ['Needs you', 'Working'], `${width}: needs you and working, as pills`);
            assert.deepEqual(list.lines, ['Three ideas for your goal bar', 'Post it to your channel?', 'Running the tests'], `${width}: a waiting run says what it waits for; a working one, what it does`);
            assert.match(list.note, /did not load \(codes\)/, `${width}: a product that did not answer is named`);
            assert.ok(list.box, `${width}: a box to start a new run (the plain one: no composer beside it here)`);
            assert.equal(await wide(), false, `${width}: nothing wider than the screen`);
            const shot = async (name) => { if (!process.env.OV_CAPTURE_RUN) return; await wait(450); const r = await page.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(process.env.OV_CAPTURE_RUN, `${name}-${width}.png`), Buffer.from(r.data, 'base64')); };
            await shot('list');
            // A run that asks before it acts is answered from the list.
            assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.ovr-row-acts .ovr-btn')].map((b) => b.textContent)`), ['Approve', 'Not now'], `${width}: approve in place, on the run that asks`);
            await page.evaluate(`document.querySelector('.ovr-row-acts .ovr-btn').click()`);
            assert.ok(await until(`(document.querySelector('.ovr-row-acts') || {}).textContent === 'Approved'`), `${width}: the answer replaces the buttons`);
            assert.deepEqual(seen.posts.find((x) => x.path === '/actor:t_9/approvals/apr_9').body, { answer: 'approve' }, `${width}: and reaches the API`);
            // A filter reloads the rows only: the words being typed stay.
            await page.evaluate(`document.querySelector('.ovr-compose textarea').value = 'half typed'; document.querySelector('.ovr-filter[data-filter="code"]').click()`);
            assert.ok(await until(`document.querySelectorAll('.ovr-rows .ovr-row:not(.is-ghost)').length === 1`), `${width}: Code shows the coding run`);
            assert.deepEqual(seen.kinds, ['all', 'code'], `${width}: the filter asks the API by kind`);
            assert.equal(await page.evaluate(`document.querySelector('.ovr-compose textarea').value`), 'half typed', `${width}: the box keeps its words across a filter`);
            assert.equal(await page.evaluate(`document.querySelector('.ovr-filter[aria-selected="true"]').textContent`), 'Code', `${width}: Code is chosen`);
            await page.evaluate(`document.querySelector('.ovr-filter[data-filter="all"]').click()`);
            assert.ok(await until(`document.querySelectorAll('.ovr-rows .ovr-row:not(.is-ghost)').length === 3`), `${width}: back to all`);

            // ── a thread ──
            await page.evaluate(`document.querySelector('.ovr-row').click()`);
            assert.ok(await until(`document.querySelectorAll('.ovr-thread .ovr-step').length >= 6`), `${width}: the thread draws its steps`);
            const t = await page.evaluate(`(() => { const q = (s) => document.querySelector(s);
                return { you: q('.ovr-step.is-you').textContent, think: q('details.ovr-step.is-think > summary').textContent, thinkOpen: q('details.ovr-step.is-think').open,
                    tool: q('.ovr-step.is-row.is-tool').textContent, bullets: [...document.querySelectorAll('.ovr-step.is-agent li')].map((l) => l.textContent),
                    strong: (q('.ovr-step.is-agent strong') || {}).textContent, link: (q('.ovr-step.is-agent .ovr-a') || {}).href, cite: (q('.ovr-cite') || {}).href,
                    sources: [...document.querySelectorAll('.ovr-source')].map((a) => a.href), chips: [...document.querySelectorAll('.ovr-chip')].map((c) => c.textContent),
                    approve: [...document.querySelectorAll('.ovr-approval-acts .ovr-btn')].map((b) => b.textContent), title: q('.ovr-who b').textContent,
                    away: q('.ovr-thead a.ovr-ib').href, imgs: document.querySelectorAll('.ovr-thread img').length, pwned: !!window.pwned }; })()`);
            assert.equal(t.you, 'Ideas for a goal bar <img src=x onerror="window.pwned=1">', `${width}: your words, as text`);
            assert.equal(t.imgs, 0, `${width}: page text never becomes markup`);
            assert.equal(t.pwned, false, `${width}: nothing ran`);
            assert.deepEqual([t.think, t.thinkOpen], ['Thinking it over', false], `${width}: thinking is folded`);
            assert.equal(t.tool, 'Searched the web', `${width}: a tool is one quiet row`);
            assert.deepEqual(t.bullets, ['A filling bar 1', 'A ring', 'See https://openvibe.live/docs/whip'], `${width}: a list, with its citation`);
            assert.equal(t.strong, 'filling', `${width}: bold words`);
            assert.equal(t.link, 'https://openvibe.live/docs/whip', `${width}: an address is a link`);
            assert.equal(t.cite, 'https://example.org/bars', `${width}: [1] links to its source`);
            assert.deepEqual(t.sources, ['https://example.org/bars'], `${width}: sources listed, a javascript: one left out`);
            assert.deepEqual(t.chips, ['Timer, 10 min'], `${width}: a results card`);
            assert.deepEqual(t.approve, ['Post it', 'Not now'], `${width}: an approval card with its answers`);
            assert.equal(t.away, 'https://openvibe.chat/vibe/c_1', `${width}: its own page, one press away`);
            await shot('thread');
            // Live: the stream adds step 7 and renames the run; the next connection resumes after it.
            assert.ok(await until(`[...document.querySelectorAll('.ovr-step.is-agent')].some((s) => s.textContent === 'One more thing.')`), `${width}: a step arrives live`);
            assert.ok(await until(`document.querySelector('.ovr-who b').textContent === 'Goal bar ideas, live'`), `${width}: the run's head follows it`);
            assert.ok(await until(`true`) && await (async () => { const end = Date.now() + 5000; while (Date.now() < end && seen.lastIds.length < 2) await wait(50); return seen.lastIds.length >= 2; })(), `${width}: it reconnects`);
            assert.deepEqual(seen.lastIds.slice(0, 2), ['6', '7'], `${width}: from after the last step it has, then after the one that came live`);
            // An approval.
            await page.evaluate(`document.querySelector('.ovr-approval-acts .ovr-btn').click()`);
            assert.ok(await until(`/You answered: Post it/.test(document.querySelector('.ovr-step.is-approval').textContent)`), `${width}: the answer replaces the buttons`);
            assert.deepEqual(seen.posts.find((p) => p.path === '/chat:c_1/approvals/ap_1').body, { answer: 'approve' }, `${width}: the answer reaches the API`);
            // The next thing said.
            await page.evaluate(`document.querySelector('.ovr-compose textarea').value = 'And a ring?'; document.querySelector('.ovr-compose form').requestSubmit()`);
            assert.ok(await until(`[...document.querySelectorAll('.ovr-step.is-you')].some((s) => s.textContent === 'And a ring?')`), `${width}: your next words join the thread`);
            assert.deepEqual(seen.posts.find((p) => p.path === '/chat:c_1/messages').body, { text: 'And a ring?' }, `${width}: and reach the API`);
            assert.equal(await wide(), false, `${width}: the thread is no wider than the screen`);

            // ── back, and a new run from the list's box ──
            await page.evaluate(`document.querySelector('.ovr-thead .ovr-ib').click()`);
            assert.ok(await until(`document.querySelectorAll('.ovr-rows .ovr-row:not(.is-ghost)').length === 3`), `${width}: back to the list`);
            await page.evaluate(`document.querySelector('.ovr-compose textarea').value = 'A raid alert'; document.querySelector('.ovr-compose form').requestSubmit()`);
            assert.ok(await until(`document.querySelector('.ovr-who b') && document.querySelector('.ovr-thread .ovr-none')`), `${width}: the new run opens`);
            const start = seen.posts.find((p) => p.path === '');
            assert.deepEqual(start.body, { text: 'A raid alert' }, `${width}: started with the words`);
            assert.match(start.key, /^ovr-[a-z0-9]+-[a-z0-9]+$/, `${width}: once (an idempotency key)`);
            assert.deepEqual([...seen.auth], ['Bearer tok_1'], `${width}: every call carries the person's token`);
            await page.evaluate('window.view.destroy()');
            assert.equal(await page.evaluate(`document.getElementById('host').children.length`), 0, `${width}: destroy empties the host`);

            // ── 4.225.0, the menu's Vibe: starters, the Action Center's work, the host's slot above, the place, prefill ──
            await page.evaluate(`window.places = []; window.tops = 0; window.view = OpenVibeRun.mount(document.getElementById('host'), { base: '${base}/api/frame', token: 'tok_1',
                actions: { base: '${base}' }, starters: [['bell', 'Remind me to stretch'], ['live', 'Who is live right now?']],
                top(el) { window.tops++; el.innerHTML = '<div class="hosttop">Now</div>'; return { destroy() { window.tops--; } }; },
                onPlace(p) { window.places.push(p.filter || p.ref); } })`);
            assert.ok(await until(`document.querySelectorAll('.ovr-rows .ovr-row:not(.is-ghost)').length === 5`), `${width}: three runs and two from the Action Center`);
            const merged = await page.evaluate(`({ titles: [...document.querySelectorAll('.ovr-row-top b')].map((b) => b.textContent),
                links: [...document.querySelectorAll('a.ovr-row')].map((a) => a.getAttribute('href')), acts: [...document.querySelectorAll('.ovr-row-acts')].length,
                starters: [...document.querySelectorAll('.ovr-starter')].map((b) => b.textContent), top: (document.querySelector('.ovr-top .hosttop') || {}).textContent })`);
            assert.deepEqual(merged.titles, ['Let Clipper post for you', 'Post the clip', 'Goal bar ideas', 'Captions for your VOD', 'Fix the overlay'], `${width}: what needs you first, then newest; nothing twice`);
            assert.deepEqual(merged.links, ['https://openvibe.network/confirm/cf_1', 'https://openvibe.ai/runs/air_4'], `${width}: the Action Center's rows open their own pages`);
            assert.equal(merged.acts, 2, `${width}: both that need you can be answered in place`);
            assert.deepEqual(merged.starters, ['Remind me to stretch', 'Who is live right now?'], `${width}: the starters above the box`);
            assert.equal(merged.top, 'Now', `${width}: the host's slot above the list`);
            await page.evaluate(`document.querySelector('.ovr-rows li.has-acts .ovr-btn.is-primary').click()`);
            assert.ok(await until(`(document.querySelector('.ovr-rows li.has-acts .ovr-row-acts') || {}).textContent === 'Approved'`), `${width}: the Action Center's item approved in place`);
            assert.ok(seen.posts.some((x) => x.path === '/api/v1/me/actions/network/cf_1/approve'), `${width}: through the Action Center's own route`);
            // Code hides the slot and the starters; Chats shows the starters only.
            await page.evaluate(`document.querySelector('.ovr-filter[data-filter="code"]').click()`);
            assert.ok(await until(`document.querySelectorAll('.ovr-rows .ovr-row:not(.is-ghost)').length === 1`), `${width}: Code`);
            assert.deepEqual(await page.evaluate(`[document.querySelector('.ovr-top').hidden, document.querySelector('.ovr-starters').hidden]`), [true, true], `${width}: no slot and no starters on Code`);
            await page.evaluate(`document.querySelector('.ovr-filter[data-filter="chat"]').click()`);
            assert.ok(await until(`document.querySelector('.ovr-filter[aria-selected="true"]').dataset.filter === 'chat' && !document.querySelector('.ovr-rows .is-ghost')`), `${width}: Chats`);
            assert.deepEqual(await page.evaluate(`[document.querySelector('.ovr-top').hidden, document.querySelector('.ovr-starters').hidden]`), [true, false], `${width}: the starters on Chats`);
            // Ask your agent: the words in the box, unsent.
            await page.evaluate(`window.view.prefill('What is this page about?')`);
            assert.ok(await until(`document.querySelector('.ovr-compose textarea').value === 'What is this page about?' && document.activeElement === document.querySelector('.ovr-compose textarea')`), `${width}: prefill puts the words in the box, focused`);
            // A starter starts its run; the slot is handed back when the thread opens.
            await page.evaluate(`document.querySelector('.ovr-filter[data-filter="all"]').click()`);
            assert.ok(await until(`!document.querySelector('.ovr-rows .is-ghost') && !document.querySelector('.ovr-top').hidden`), `${width}: All again`);
            const before = seen.posts.length;
            await page.evaluate(`document.querySelector('.ovr-starter').click()`);
            assert.ok(await until(`!!document.querySelector('.ovr.is-thread')`), `${width}: a starter opens its new run`);
            assert.deepEqual(seen.posts.slice(before).find((x) => x.path === '').body, { text: 'Remind me to stretch' }, `${width}: started with the starter's words`);
            assert.equal(await page.evaluate('window.tops'), 0, `${width}: the host's slot is handed back in a thread`);
            assert.deepEqual(await page.evaluate('window.places'), ['all', 'code', 'chat', 'all', 'chat:c_2'], `${width}: each place is told to the host`);
            await page.evaluate('window.view.destroy()');
            await page.close();
        }
        console.log('run-thread-chrome: the list, filters, a thread with every kind of step, the live stream and its resume, approvals, messages and a new run');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((err) => { console.error(err); process.exit(1); });
