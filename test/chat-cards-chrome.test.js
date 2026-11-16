'use strict';
// Chat's event cards (4.284.0, ov-chat-cards.js; the owner, 11-16: Global in the menu "is missing all the styles that
// exist when you're out … compared to how it is on .live", and "custom widgets or custom HTML or AI vibe coded … shared"):
// a go-live row becomes a card with Watch, a Rundown episode a card with Read, a run of deploys folds into one card, a
// widget runs in a sandbox with no same origin, a link off OpenVibe is no card at all, and a site's own kind is drawn
// first. Real headless Chrome at 390 px.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('chat-cards-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cards</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><ul id="list"></ul><script src="/ov-chat-cards.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    const name = u.pathname.slice(1);
    if (/^[a-z0-9-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); return res.end();
});

const RUN = `(() => {
  const C = window.OVChatCards, list = document.getElementById('list');
  const at = '2026-11-16T04:00:00Z';
  const add = (m) => { const c = C.of(m); if (!c) return null; if (!C.fold(list.lastElementChild, c)) list.append(C.render(c)); return c.kind; };
  const kinds = [
    add({ id: 1, message_type: 'system', message: '\\u{1F534} Alice_1 is live. Share the stream: https://openvibe.live/@Alice_1?section=vods#x', timestamp: at }),
    add({ id: 2, message_type: 'system', message: '\\u{1F4F0} Bob: \\u201CThe long night\\u201D at https://openvibe.live/rundown/e/42', timestamp: at }),
    add({ id: 3, message_type: 'system', message: '\\u{1F680} 2 updates shipped: Faster menu \\u00B7 Tabs glide', timestamp: at }),
    add({ id: 4, message_type: 'system', message: '\\u{1F680} 1 update shipped: Cards in Global', timestamp: at }),
    add({ id: 5, message_type: 'system', message: '\\u{1F534} Eve is live. Share the stream: https://evil.example/@Eve', timestamp: at }),
    add({ id: 6, message_type: 'chat', username: 'carol', message: 'just words', timestamp: at }),
    add({ id: 7, message_type: 'chat', username: 'dave', display_name: 'Dave', message: 'made a thing', metadata: JSON.stringify({ widget: { title: 'Counter', html: '<button id=b>0</button>', height: 120 } }), timestamp: at }),
  ];
  C.register('poll', { match: (m) => (m.metadata && m.metadata.poll ? { q: m.metadata.poll } : null), render: (c, h) => { const li = h('li', 'my-poll', c.q); return li; } });
  kinds.push(add({ id: 8, message_type: 'chat', message: 'x', metadata: { poll: 'Pizza?' } }));
  const live = list.querySelector('.ovcc--live'), rd = list.querySelector('.ovcc--rundown'), sh = list.querySelectorAll('.ovcc--shipped'), w = list.querySelector('.ovcc--widget iframe');
  return {
    kinds, cards: list.children.length,
    watch: live && live.querySelector('.ovcc-go').getAttribute('href'), watchText: live && live.querySelector('.ovcc-go').textContent,
    face: live && live.querySelector('.ovcc-ic img').getAttribute('src'),
    read: rd && rd.querySelector('.ovcc-go').textContent, title: rd && rd.querySelector('.ovcc-s').textContent,
    shipped: sh.length, shippedN: sh[0] && sh[0].querySelector('.ovcc-n').textContent, shippedItems: sh[0] && sh[0].querySelectorAll('li').length,
    sandbox: w && w.getAttribute('sandbox'), by: list.querySelector('.ovcc-wh') && list.querySelector('.ovcc-wh').textContent,
    poll: !!list.querySelector('.my-poll'),
    wide: document.documentElement.scrollWidth,
    goH: live && live.querySelector('.ovcc-go').offsetHeight, icW: live && live.querySelector('.ovcc-ic').offsetWidth,
  };
})()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-cards-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        for (let i = 0; i < 60 && !(await p.evaluate('typeof OVChatCards !== "undefined"')); i++) await wait(50);
        const r = await p.evaluate(RUN);
        assert.deepStrictEqual(r.kinds, ['live', 'rundown', 'shipped', 'shipped', null, null, 'widget', 'poll'], `what each message is (${JSON.stringify(r.kinds)})`);
        assert.strictEqual(r.watch, 'https://openvibe.live/@Alice_1', 'Watch opens the channel, never a section or a hash');
        assert.strictEqual(r.watchText, 'Watch');
        assert.strictEqual(r.face, 'https://openvibe.network/avatar/Alice_1?s=64', 'the streamer\'s own picture');
        assert.strictEqual(r.read, 'Read');
        assert.strictEqual(r.title, '“The long night”');
        assert.deepStrictEqual([r.shipped, r.shippedN, r.shippedItems], [1, '3 updates shipped', 3], 'a run of deploys is one card');
        assert.strictEqual(r.sandbox, 'allow-scripts', 'a widget runs in a sandbox: scripts, no same origin, no forms, no pop-ups');
        assert.ok(/Counter/.test(r.by) && /Dave/.test(r.by), `a widget says what it is and who made it (${r.by})`);
        assert.ok(r.poll, 'a site\'s own kind draws its own card');
        assert.strictEqual(r.cards, 5, 'live, Rundown, one shipped, the widget, the poll');
        assert.strictEqual(r.wide, 390, 'nothing wider than the phone');
        assert.ok(r.goH >= 34 && r.icW >= 32, `the button and the face are full size (${r.goH}, ${r.icW})`);
        console.log('chat-cards-chrome: live → Watch (the channel), Rundown → Read, three deploys → one card, a widget in a sandbox, a link off OpenVibe → no card, a site\'s own kind drawn');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
