'use strict';
// Post · Ask · Do (ov-composer.js 4.218.0; research-2026-11-12/composer-post-ask-do.md) in a real headless Chrome at 390 px,
// against a fake Network Frame:
//   - a box that opts in shows the three verbs; Ask and Do bring the Model, Sources and Depth chips; Post hides them;
//   - the Model sheet lists the Frame's groups (Auto first, OpenVibe with prices and an Exchange link, your keys), finds
//     by name, and a pick names the chip and is remembered;
//   - Sources are switches; the chip says what is on;
//   - Ask posts { verb, text, model, sources, depth, context } to the Frame and streams the run's events into an answer
//     card with its sources; "Post it" puts the answer in the box as a post; the box's own onSubmit never hears an Ask;
//   - a site can answer itself (onAsk) through the same card.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('composer-verbs-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const root = path.join(__dirname, '..');
const asked = [];
const CHOICES = { task: 'chat', recommended: { model: 'deepseek/v4.1-flash', source: 'openvibe' }, groups: [
    { id: 'openvibe', title: 'OpenVibe', rows: [
        { model: 'deepseek/v4.1-flash', source: 'openvibe', name: 'DeepSeek V4.1 Flash', maker: 'DeepSeek', price: { in: 0.27, out: 1.1, unit: 'per million tokens' }, url: 'https://openvibe.exchange/models/deepseek/v4.1-flash' },
        { model: 'qwen/qwen3-32b', source: 'openvibe', name: 'Qwen3 32B', maker: 'Qwen', free: true, url: 'https://openvibe.exchange/models/qwen/qwen3-32b' },
    ] },
    { id: 'keys', title: 'Your keys', rows: [{ model: 'anthropic/claude-sonnet', source: 'key', name: 'Claude Sonnet (your key)', maker: 'Anthropic' }] },
    { id: 'machines', title: 'Your computers', rows: [] },
] };
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (['/ov-composer.js', '/ov-window.js', '/ov-capture.js'].includes(u)) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, u.slice(1)))); }
    if (u === '/api/frame/choices') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(CHOICES)); }
    if (u === '/api/frame/ask' && req.method === 'POST') {
        let body = ''; req.on('data', (c) => { body += c; });
        return req.on('end', () => { asked.push(JSON.parse(body)); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ run: 'run_1' })); });
    }
    if (u === '/api/v1/runs/run_1/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
        const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
        send({ type: 'RUN_STARTED' });
        send({ type: 'TEXT_MESSAGE_CONTENT', delta: 'Streams on OpenVibe ' });
        setTimeout(() => {
            send({ type: 'TEXT_MESSAGE_CONTENT', delta: 'can be recorded as VODs [1].' });
            send({ type: 'CUSTOM', name: 'citations', value: [{ n: 1, title: 'Going live in your browser', url: 'https://openvibe.live/docs/go-live-in-your-browser', site: 'openvibe.live' }] });
            send({ type: 'RUN_FINISHED', result: { cost: 0.0012 } });
            res.end();
        }, 150);
        return undefined;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;padding:16px;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div id="a"></div><div id="b"></div>
<script src="/ov-composer.js"></script>
<script>
window.posted = []; window.own = [];
const C = OpenVibeComposer;
window.post = C.mount(document.getElementById('a'), { preset: 'post', id: 'p1', user: { display_name: 'goosely' }, verbs: ['post', 'ask', 'do'],
    frameBase: location.origin + '/api/frame', ask: { task: 'chat', context: { site: 'live', kind: 'stream', title: 'Maticus live', url: 'https://openvibe.live/@Maticus' } },
    onSubmit: async (v) => { window.posted.push(v.text); } });
window.chatBox = C.mount(document.getElementById('b'), { preset: 'chat', id: 'c1', verbs: ['post', 'ask'], frameBase: location.origin + '/api/frame',
    onSubmit: async () => true, onAsk: async (v, api) => { window.own.push(v.text); api.card.set('An answer the site gave itself.'); api.card.done({}); } });
</script>`);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'composer-verbs-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await page.goto(base + '/', { maxMs: 5000 });
        const until = async (expr, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
        assert.ok(await until(`!!window.chatBox`), 'the boxes mount');

        // The three verbs; Post first; the Ask chips hidden on Post.
        const shape = await page.evaluate(`(() => { const f = document.getElementById('p1'); return { verbs: [...f.querySelectorAll('.ovc-verb')].map((b) => b.dataset.verb + ':' + b.getAttribute('aria-pressed')), verb: f.dataset.verb, chipsShown: getComputedStyle(f.querySelector('.ovc-ask-chips')).display !== 'none' }; })()`);
        assert.deepEqual(shape, { verbs: ['post:true', 'ask:false', 'do:false'], verb: 'post', chipsShown: false });
        await page.evaluate(`document.querySelector('#p1 .ovc-verb[data-verb="ask"]').click()`);
        const asking = await page.evaluate(`(() => { const f = document.getElementById('p1'); return { verb: f.dataset.verb, send: f.querySelector('[data-ovt-send]').getAttribute('aria-label'), chips: [...f.querySelectorAll('.ovc-ask-chips .ovc-chip-v')].map((c) => c.textContent), placeholder: f.querySelector('textarea').placeholder }; })()`);
        assert.deepEqual(asking, { verb: 'ask', send: 'Ask', chips: ['Auto', 'Web · OpenVibe', 'Balanced'], placeholder: 'Ask anything' });

        // The Model sheet: Auto, then the Frame's groups with prices and an Exchange link; find; pick.
        await page.evaluate(`document.querySelector('#p1 .ovc-ask-chips .ovc-chip--btn').click()`);
        assert.ok(await until(`document.querySelectorAll('dialog.ovc-sheet .ovc-model').length >= 4`), 'the models are listed');
        const sheet = await page.evaluate(`(() => { const d = document.querySelector('dialog.ovc-sheet'); return { heads: [...d.querySelectorAll('h3')].map((x) => x.textContent), first: d.querySelector('.ovc-model b').textContent, price: [...d.querySelectorAll('.ovc-model small')].map((x) => x.textContent)[1], rec: !!d.querySelector('.ovc-model-rec'), link: d.querySelector('.ovc-model-x').href, width: Math.round(d.getBoundingClientRect().width) }; })()`);
        assert.deepEqual(sheet.heads, ['OpenVibe', 'Your keys'], 'groups with rows only');
        assert.match(sheet.first, /^Auto/);
        assert.match(sheet.price, /\$0\.27 \/ M/, 'a price per million');
        assert.ok(sheet.rec, 'the recommended model is marked');
        assert.match(sheet.link, /openvibe\.exchange\/models\//, 'each OpenVibe model opens on Exchange');
        assert.equal(sheet.width, 390, 'the whole width on a phone');
        await page.evaluate(`(() => { const f = document.querySelector('dialog.ovc-sheet .ovc-sheet-find'); f.value = 'qwen'; f.dispatchEvent(new Event('input')); })()`);
        assert.equal(await page.evaluate(`[...document.querySelectorAll('dialog.ovc-sheet .ovc-model')].filter((r) => !r.hidden).length`), 1, 'find narrows the list');
        await page.evaluate(`[...document.querySelectorAll('dialog.ovc-sheet .ovc-model')].find((r) => !r.hidden).querySelector('.ovc-model-b').click()`);
        assert.equal(await page.evaluate(`document.querySelector('#p1 .ovc-ask-chips .ovc-chip-v').textContent`), 'Qwen3 32B');
        assert.equal(await page.evaluate(`JSON.parse(localStorage.getItem('ov:composer:model:chat')).model`), 'qwen/qwen3-32b', 'remembered');

        // Sources: switches, and this page because the site gave its context.
        await page.evaluate(`document.querySelectorAll('#p1 .ovc-ask-chips .ovc-chip--btn')[1].click()`);
        assert.ok(await until(`document.querySelectorAll('dialog.ovc-sheet .ovc-src').length === 4`), 'web, OpenVibe, mine and this page');
        await page.evaluate(`(() => { const box = [...document.querySelectorAll('dialog.ovc-sheet .ovc-src')].find((l) => /This/.test(l.textContent)).querySelector('input'); box.click(); document.querySelector('dialog.ovc-sheet .ovc-bar-x').click(); })()`);
        assert.equal(await page.evaluate(`document.querySelectorAll('#p1 .ovc-ask-chips .ovc-chip-v')[1].textContent`), 'Web · OpenVibe · This page');

        // Ask: to the Frame, streamed into the card with its sources; onSubmit never hears it.
        await page.evaluate(`(() => { const t = post.text; t.value = 'Can I record my stream?'; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#p1 [data-ovt-send]').click(); })()`);
        assert.ok(await until(`!!document.querySelector('.ovc-answer footer:not([hidden])')`), 'the answer finishes');
        const card = await page.evaluate(`(() => { const c = document.querySelector('.ovc-answer'); return { text: c.querySelector('.ovc-answer-t').textContent, cites: [...c.querySelectorAll('.ovc-cites a')].map((a) => a.textContent), meta: c.querySelector('header small').textContent, actions: [...c.querySelectorAll('footer button')].map((b) => b.textContent) }; })()`);
        assert.equal(card.text, 'Streams on OpenVibe can be recorded as VODs [1].');
        assert.deepEqual(card.cites, ['1. Going live in your browser']);
        assert.match(card.meta, /Qwen3 32B · \$0\.001/);
        assert.deepEqual(card.actions, ['Post it', 'Continue in Vibe', 'Do this']);
        assert.equal(asked.length, 1);
        assert.deepEqual({ verb: asked[0].verb, text: asked[0].text, model: asked[0].model.model, sources: asked[0].sources, depth: asked[0].depth, context: asked[0].context.kind },
            { verb: 'ask', text: 'Can I record my stream?', model: 'qwen/qwen3-32b', sources: ['web', 'openvibe', 'page'], depth: 'balanced', context: 'stream' });
        assert.equal(await page.evaluate(`window.posted.length`), 0, 'an Ask is not a post');
        // Post it: the answer becomes the post, on the Post verb.
        await page.evaluate(`document.querySelector('.ovc-answer footer button').click()`);
        assert.deepEqual(await page.evaluate(`({ verb: document.getElementById('p1').dataset.verb, text: post.text.value })`), { verb: 'post', text: 'Streams on OpenVibe can be recorded as VODs [1].' });

        // A site that answers itself, through the same card.
        await page.evaluate(`(() => { document.querySelector('#c1 .ovc-verb[data-verb="ask"]').click(); const t = chatBox.text; t.value = 'what is up'; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#c1 [data-ovt-send]').click(); })()`);
        assert.ok(await until(`window.own.length === 1 && [...document.querySelectorAll('.ovc-answer .ovc-answer-t')].some((x) => x.textContent === 'An answer the site gave itself.')`), 'onAsk answers through the card');

        assert.equal(await page.evaluate(`document.documentElement.scrollWidth`), 390);
        await page.close();
        console.log('composer-verbs-chrome: Post · Ask · Do, the Model sheet from the Frame, Sources, an answer streamed with its sources, Post it, a site\'s own answer');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
