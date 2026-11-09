'use strict';
// The Dock's Actor block (dock-actor.js, Actor v3 stage A3), in a real headless Chrome, against a local stand-in for
// OpenVibe.Actor's /api/v1/me/actor:
//   • a working Actor shows its name, "Working", the step in plain words, what it looks at, the last three steps, Next,
//     and the model with today's cost against the cap;
//   • its first ask shows with its own buttons: the first answers it (POST …/answer {option}), "Not now" declines it;
//   • "Tell your Actor something" posts the words; Pause posts /pause;
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
    if (req.url === '/dock-actor.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'dock-actor.js'))); }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (req.url.startsWith('/api/v1/me/actor')) {
            calls.push({ method: req.method, url: req.url, auth: req.headers.authorization || '', cookie: req.headers.cookie || '', body: body ? JSON.parse(body) : null });
            if (mode === 'none') { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"detail":"no actor"}'); }
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify(req.method === 'GET' ? ACTOR : { ok: true }));
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
                return { name: t('.ovdac-name'), state: t('.ovdac-state'), step: t('.ovdac-step'), look: t('.ovdac-look'), done: [...box.querySelectorAll('.ovdac-done li')].map((n) => n.textContent),
                    next: t('.ovdac-next'), cost: t('.ovdac-cost'), ask: t('.ovdac-ask p'), more: t('.ovdac-ask .ovdac-note'), imgs: box.querySelectorAll('img').length, pwned: !!window.pwned,
                    buttons: [...box.querySelectorAll('.ovdac-ask button')].map((n) => n.textContent), small, scroll: document.documentElement.scrollWidth };
            })()`);
            assert.strictEqual(seen.name, 'Juniper');
            assert.strictEqual(seen.state, 'Waiting for you', 'an ask makes it wait for you');
            assert.strictEqual(seen.step, 'Reading the third job post on the list');
            assert.strictEqual(seen.look, 'Looking at: Remote support jobs, posted today');
            assert.deepStrictEqual(seen.done, ['Opened the job board', 'Searched remote support', 'Saved two posts']);
            assert.strictEqual(seen.next, 'Next: Write a cover letter for the best one');
            assert.strictEqual(seen.cost, 'Model: DeepSeek V4 · today $0.42 of your $3.00 cap');
            assert.ok(seen.ask.includes('<img src=x'), 'the ask is text, never markup');
            assert.strictEqual(seen.imgs, 0, 'no element came from the Actor\'s words');
            assert.strictEqual(seen.pwned, false);
            assert.deepStrictEqual(seen.buttons, ['Apply', 'Skip it', 'Not now']);
            assert.strictEqual(seen.more, '1 more on your Actor\'s page');
            assert.deepStrictEqual(seen.small, [], `${width}px: every control is 44 px`);
            assert.ok(seen.scroll <= width, `${width}px: no sideways scroll (${seen.scroll})`);
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
        await pg.close();

        // No Actor: nothing shows.
        mode = 'none';
        const none = await h.openPage(browser, context, { width: 390, height: 800 });
        await none.goto(`${base}/`, { maxMs: 5000 });
        await wait(none, `false`, 600);
        const empty = await none.evaluate(`(() => { const b = document.getElementById('box'); return { on: b.classList.contains('on'), kids: b.children.length, shown: getComputedStyle(b).display }; })()`);
        assert.deepStrictEqual(empty, { on: false, kids: 0, shown: 'none' }, 'a person with no Actor sees nothing');
        await none.close();
        console.log('dock-actor-chrome: the Actor block shows the step, asks with their buttons, tells and pauses with the bearer, text only, 44 px, nothing without an Actor ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
