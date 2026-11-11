'use strict';
// The Dock's Actor block (dock-actor.js, Actor v3 stage A3), in a real headless Chrome, against a local stand-in for
// OpenVibe.Actor's /api/v1/me/actor:
//   • a working Actor shows its name, its state, the step in plain words, what it looks at, the steps before it, Next,
//     and today's cost against the cap (the model is the cost's tooltip); the row is the link to the Actor's page;
//   • its first ask shows with its own buttons: the first answers it (POST …/answer {option}), "Not now" declines it;
//   • "Tell your Actor something" posts the words; Pause posts /pause; a paused Actor shows "Resume", no steps, and
//     never "Paused" twice; Resume posts /resume;
//   • a refresh never touches the line being typed, and an unchanged answer repaints nothing;
//   • every call carries the person's token as a bearer (a token given as a function is resolved at the call) and no
//     cookies; what the Actor wrote is text, never markup;
//   • a person with no Actor (404) sees nothing; every control is 44 px; nothing runs off a 320 px screen.
// Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('dock-actor-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const ACTOR = {
    id: 'act_1', name: 'Juniper', enabled: true, status: 'working', brain: 'DeepSeek V4', caps: { usd: 3 },
    now: {
        current_step: 'Reading the third job post on the list',
        looking_at: { title: 'Remote support jobs, posted today' },
        last_three_steps: [{ text: 'Opened the job board' }, { text: 'Searched remote support' }, { text: 'Saved two posts' }],
        next: { text: 'Write a cover letter for the best one' },
        cost_today: 0.42,
    },
    asks: [{ id: 'ask_1', text: 'Apply to <img src=x onerror="window.pwned=1"> Northwind?', options: [{ id: 'apply', label: 'Apply' }, { id: 'skip', label: 'Skip it' }] },
        { id: 'ask_2', text: 'Second ask', options: [] }],
};
const calls = [];
let mode = 'actor';
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dock</title></head>
<body style="margin:0;background:#111;color:#eee;font:14px system-ui"><div id="box"></div><script src="/dock-actor.js"></script>
<script>window.m = OpenVibeDockActor.mount(document.getElementById('box'), { token: async () => 'tok-1', base: location.origin, active: () => true });</script></body></html>`;

const server = http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
    const file = req.url.split('?')[0];
    if (['/dock-actor.js', '/ov-window.js', '/agent-sheet.js'].includes(file)) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, file.slice(1)))); }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (req.url.startsWith('/api/v1/me/agents/')) {
            calls.push({ method: req.method, url: req.url, auth: req.headers.authorization || '', cookie: req.headers.cookie || '', body: null });
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({
                agent: { id: 'act_1', name: 'Juniper', face: null, state: 'working', instructions: 'Find remote support jobs <b>now</b>', voice: null },
                now: { id: 'w1', task: 'Reading the third job post', state: 'running', cost_usd: 0.42 },
                work: [{ id: 'w0', task: 'Saved two posts', state: 'done', cost_usd: 0.1 }],
                asks: [{ id: 'ask_1', state: 'waiting', what: 'Apply to Northwind?', why: 'It matches remote and support.' }],
                asks_empty: 'Requests to approve will appear here.', computer: null,
                schedules: [{ schedule: 'off', next_run_at: null, last_run_at: null, last_result: null }], memory: [], activity: [],
            }));
        }
        if (req.url.startsWith('/api/v1/me/actor')) {
            calls.push({ method: req.method, url: req.url, auth: req.headers.authorization || '', cookie: req.headers.cookie || '', body: body ? JSON.parse(body) : null });
            if (mode === 'none') { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"detail":"no actor"}'); }
            res.writeHead(200, { 'content-type': 'application/json' });
            const paused = { ...ACTOR, enabled: false, status: 'paused', asks: [], now: { current_step: 'Paused', looking_at: null, last_three_steps: [{ text: 'Opened the job board' }], next: { text: 'Write a cover letter' }, cost_today: 0 } };
            return res.end(JSON.stringify(req.method === 'GET' ? (mode === 'paused' ? paused : ACTOR) : { ok: true }));
        }
        res.writeHead(404); res.end();
    });
});

const wait = async (pg, expr, ms = 4000) => {
    const end = Date.now() + ms;
    for (;;) {
        if (await pg.evaluate(expr)) return true;
        if (Date.now() > end) return false;
        await new Promise((ok) => setTimeout(ok, 50));
    }
};

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-dockactor-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        for (const width of [320, 390]) {
            const pg = await h.openPage(browser, context, { width, height: 800 });
            await pg.goto(`${base}/`, { maxMs: 5000 });
            assert.ok(await wait(pg, `!!document.querySelector('#box.on .ovdac-name')`), `${width}px: the block shows`);
            const seen = await pg.evaluate(`(() => {
                const t = (s) => (document.querySelector(s) || {}).textContent || '';
                const box = document.getElementById('box');
                const small = [...box.querySelectorAll('button, a, input')].filter((n) => n.getBoundingClientRect().height < 44).map((n) => n.textContent || n.placeholder);
                const live = box.querySelector('.ovdac-rail .is-live');
                const spend = box.querySelector('.ovdac-spend');
                return { name: t('.ovdac-name'), state: t('.ovdac-state'), step: live ? live.firstChild.textContent : '', look: t('.ovdac-look'),
                    done: [...box.querySelectorAll('.ovdac-rail li:not(.is-live):not(.is-next)')].map((n) => n.textContent),
                    next: t('.ovdac-rail .is-next'), cost: t('.ovdac-spend'), model: spend ? (spend.getAttribute('data-ov-tip') || spend.title) : '', ask: t('.ovdac-ask p'), more: t('.ovdac-more'),
                    page: (box.querySelector('.ovdac-id') || {}).href || '', kicker: t('.ovdac-ask-k'), ring: box.getAttribute('data-state'),
                    imgs: box.querySelectorAll('img').length, pwned: !!window.pwned,
                    buttons: [...box.querySelectorAll('.ovdac-ask button')].map((n) => n.textContent), small, scroll: document.documentElement.scrollWidth,
                    wide: [...box.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().right > document.documentElement.clientWidth + 0.01).map((n) => n.tagName.toLowerCase() + '.' + String(n.className.baseVal || n.className) + ' ' + n.getBoundingClientRect().right.toFixed(1)).slice(0, 4) };
            })()`);
            assert.strictEqual(seen.name, 'Juniper');
            assert.strictEqual(seen.state, 'Waiting for you', 'an ask makes it wait for you');
            assert.strictEqual(seen.step, 'Reading the third job post on the list');
            assert.strictEqual(seen.look, 'Looking at Remote support jobs, posted today');
            assert.strictEqual(seen.ring, 'waiting', 'the face wears the state');
            assert.ok(seen.page.endsWith('/you'), 'the row is the way to the Actor\'s page');
            assert.strictEqual(seen.kicker, 'Juniper asks');
            assert.deepStrictEqual(seen.done, ['Opened the job board', 'Searched remote support', 'Saved two posts']);
            assert.strictEqual(seen.next, 'Next: Write a cover letter for the best one');
            assert.strictEqual(seen.cost, '$0.42 of $3.00 today');
            assert.strictEqual(seen.model, 'Model: DeepSeek V4');
            assert.ok(seen.ask.includes('<img src=x'), 'the ask is text, never markup');
            assert.strictEqual(seen.imgs, 0, 'no element came from the Actor\'s words');
            assert.strictEqual(seen.pwned, false);
            assert.deepStrictEqual(seen.buttons, ['Apply', 'Skip it', 'Not now']);
            assert.strictEqual(seen.more, '1 more on your Actor\'s page');
            assert.deepStrictEqual(seen.small, [], `${width}px: every control is 44 px`);
            assert.ok(seen.scroll <= width, `${width}px: no sideways scroll (${seen.scroll}; ${seen.wide.join(', ')})`);
            await pg.close();
        }

        // Answer, decline, tell and pause, each a POST with the bearer and no cookie.
        const pg = await h.openPage(browser, context, { width: 390, height: 800 });
        await pg.goto(`${base}/`, { maxMs: 5000 });
        await wait(pg, `!!document.querySelector('#box.on .ovdac-ask button')`);
        calls.length = 0;
        await pg.evaluate(`document.querySelector('.ovdac-ask button').click()`);
        const until = Date.now() + 3000;
        while (!calls.some((c) => c.method === 'POST') && Date.now() < until) await new Promise((ok) => setTimeout(ok, 50));
        const answer = calls.find((c) => c.method === 'POST');
        assert.ok(answer, 'the answer was posted');
        assert.deepStrictEqual({ url: answer.url, body: answer.body }, { url: '/api/v1/me/actor/asks/ask_1/answer', body: { option: 'apply' } });
        assert.strictEqual(answer.auth, 'Bearer tok-1', 'the token function is resolved at the call');
        assert.strictEqual(answer.cookie, '', 'no cookies go with it');
        const post = async (js, url) => {
            // The block refreshes after each POST and takes one action at a time: wait for that read to land.
            const settle = Date.now() + 3000;
            while (!(calls.length && calls[calls.length - 1].method === 'GET') && Date.now() < settle) await new Promise((ok) => setTimeout(ok, 50));
            await new Promise((ok) => setTimeout(ok, 150));
            calls.length = 0;
            await wait(pg, `!!document.querySelector('#box.on .ovdac-tell')`);
            await pg.evaluate(js);
            const end = Date.now() + 3000;
            while (!calls.some((c) => c.method === 'POST') && Date.now() < end) await new Promise((ok) => setTimeout(ok, 50));
            const c = calls.find((x) => x.method === 'POST');
            assert.ok(c, `${url} was posted`);
            assert.strictEqual(c.url, url);
            return c;
        };
        await post(`[...document.querySelectorAll('.ovdac-ask button')].find((b) => b.textContent === 'Not now').click()`, '/api/v1/me/actor/asks/ask_1/decline');
        const tell = await post(`(() => { const i = document.querySelector('.ovdac-tell input'); i.value = 'Only remote jobs, please'; document.querySelector('.ovdac-tell button').click(); })()`, '/api/v1/me/actor/tell');
        assert.deepStrictEqual(tell.body, { text: 'Only remote jobs, please' });
        await post(`[...document.querySelectorAll('.ovdac-head button')].find((b) => b.textContent === 'Pause').click()`, '/api/v1/me/actor/pause');

        // The line being typed survives a refresh, and an unchanged answer repaints nothing.
        await new Promise((ok) => setTimeout(ok, 400));
        const kept = await pg.evaluate(`(async () => {
            const i = document.querySelector('.ovdac-tell input'); i.value = 'half a thought'; i.focus();
            const row = document.querySelector('.ovdac-rail li');
            await window.m.refresh();
            const j = document.querySelector('.ovdac-tell input');
            return { same: i === j, value: j.value, focused: document.activeElement === j, sameRow: row === document.querySelector('.ovdac-rail li') };
        })()`);
        assert.deepStrictEqual(kept, { same: true, value: 'half a thought', focused: true, sameRow: true });
        await pg.close();

        // A paused Actor: "Resume" is the one action, there are no steps, and "Paused" is said once.
        mode = 'paused';
        const pz = await h.openPage(browser, context, { width: 390, height: 800 });
        await pz.goto(`${base}/`, { maxMs: 5000 });
        assert.ok(await wait(pz, `!!document.querySelector('#box.on .ovdac-go')`), 'the paused block shows');
        const paused = await pz.evaluate(`(() => { const b = document.getElementById('box'); return { state: b.querySelector('.ovdac-state').textContent, go: b.querySelector('.ovdac-go').textContent,
            main: b.querySelector('.ovdac-go').classList.contains('is-main'), rail: b.querySelector('.ovdac-rail').hidden, ask: b.querySelector('.ovdac-ask').hidden,
            said: (b.textContent.match(/Paused/g) || []).length }; })()`);
        assert.deepStrictEqual(paused, { state: 'Paused', go: 'Resume', main: true, rail: true, ask: true, said: 1 });
        calls.length = 0;
        await pz.evaluate(`document.querySelector('.ovdac-go').click()`);
        const end = Date.now() + 3000;
        while (!calls.some((c) => c.method === 'POST') && Date.now() < end) await new Promise((ok) => setTimeout(ok, 50));
        assert.strictEqual((calls.find((c) => c.method === 'POST') || {}).url, '/api/v1/me/actor/resume');
        assert.ok(await wait(pz, `/Resumed/.test(document.querySelector('.ovdac-note').textContent)`), 'it says what happened');
        await pz.close();

        // The row opens the agent's sheet in the one window (agent-sheet.js): its state, the ask first, the parts as tabs
        // with their own empty words, the bearer and no cookie, the instructions as text.
        mode = 'actor';
        const sh = await h.openPage(browser, context, { width: 390, height: 800 });
        await sh.goto(`${base}/`, { maxMs: 5000 });
        await wait(sh, `!!document.querySelector('#box.on .ovdac-id')`);
        calls.length = 0;
        await sh.evaluate(`document.querySelector('.ovdac-id').click()`);
        assert.ok(await wait(sh, `!!document.querySelector('.ovw .ovas-tabs')`), 'the sheet opens');
        const sheet = await sh.evaluate(`(() => { const w = document.querySelector('.ovw'); const sel = w.querySelector('.ovas-tab[aria-selected=true]');
            const shown = [...w.querySelectorAll('.ovas-part')].find((p) => !p.hidden);
            return { name: w.querySelector('.ovas-name b').textContent, state: w.querySelector('.ovas-state').textContent,
                tabs: [...w.querySelectorAll('.ovas-tab')].map((t) => t.firstChild.textContent), first: sel.firstChild.textContent, count: (sel.querySelector('em') || {}).textContent,
                ask: shown.textContent, bold: w.querySelectorAll('.ovas-name b b').length, open: (w.querySelector('.ovas-open') || {}).href || '' }; })()`);
        assert.deepStrictEqual({ name: sheet.name, state: sheet.state, tabs: sheet.tabs, first: sheet.first, count: sheet.count },
            { name: 'Juniper', state: 'Working', tabs: ['Now', 'Asks', 'Work', 'Schedule', 'Memory', 'Computer'], first: 'Asks', count: '1' });
        assert.ok(sheet.ask.includes('Apply to Northwind?') && sheet.ask.includes('It matches remote and support.'), 'the ask with its reason');
        assert.strictEqual(sheet.bold, 0, 'the instructions are text');
        assert.ok(sheet.open.endsWith('/you'), 'the Actor\'s page is one tap further');
        const read = calls.find((c) => c.url.startsWith('/api/v1/me/agents/'));
        assert.ok(read && read.url === '/api/v1/me/agents/act_1?view=sheet' && read.auth === 'Bearer tok-1' && read.cookie === '', 'the sheet read carries the bearer, no cookie');
        await sh.evaluate(`document.querySelector('#ovas-t-memory').click()`);
        assert.strictEqual(await sh.evaluate(`document.querySelector('#ovas-p-memory').textContent`), 'Nothing remembered yet.', 'an empty part says so');
        await sh.evaluate(`document.querySelector('#ovas-t-now').click()`);
        assert.ok((await sh.evaluate(`document.querySelector('#ovas-p-now').textContent`)).includes('Reading the third job post'), 'Now shows the work in progress');
        await sh.close();

        // No Actor: nothing shows.
        mode = 'none';
        const none = await h.openPage(browser, context, { width: 390, height: 800 });
        await none.goto(`${base}/`, { maxMs: 5000 });
        await wait(none, `false`, 600);
        const empty = await none.evaluate(`(() => { const b = document.getElementById('box'); return { on: b.classList.contains('on'), kids: b.children.length, shown: getComputedStyle(b).display }; })()`);
        assert.deepStrictEqual(empty, { on: false, kids: 0, shown: 'none' }, 'a person with no Actor sees nothing');
        await none.close();
        console.log('dock-actor-chrome: the Actor block shows the step, asks with their buttons, tells, pauses and resumes with the bearer, keeps the typed line, opens its sheet, text only, 44 px, nothing without an Actor ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
