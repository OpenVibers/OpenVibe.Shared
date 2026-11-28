'use strict';
// OVLinkCard (4.320.0; plan §Y.1 A8: Live's stream chat and the menu's Chat drew no cards for the addresses Chat reads):
// one card per address, the same everywhere. Only an https address opens, only an OpenVibe.Media picture loads, every
// field stays text, a message keeps at most three cards, drawing again replaces them, the × calls back, nothing
// spills past a 390 px phone, and motion Off has no entrance. Real headless Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
// The cards' pictures name production Media and Video; a test never fetches them (11-28: each run asked openvibe.media for
// abc.png, live.png and ov-test-missing-*.jpg). Blocked, they fail to load exactly as the missing ones did.
const OFFLINE = ['*openvibe.media*', '*openvibe.video*'];

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('linkcard-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en" data-theme-mode="dark"><head><meta charset="utf-8"><title>Cards</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head>
<body style="margin:0;padding:16px;background:#0b0f19;color:#e6edf7;font:14px system-ui"><ul id="chat" style="list-style:none;margin:0;padding:0">
<li id="m1"><b>ana</b> look at this</li><li id="m2"><b>bo</b> and these</li></ul>
<script src="/ov-linkcard.js"></script></body></html>`;
// The menu's Chat (messages.js): it loads ov-linkcard.js from beside itself the first time a message has cards.
const MENU = `<!doctype html><html lang="en" data-theme-mode="dark"><head><meta charset="utf-8"><title>Menu chat</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head>
<body style="margin:0;padding:16px;background:#0b0f19;color:#e6edf7;font:14px system-ui"><ul id="room"></ul><ul id="dm"></ul>
<script src="/shared/messages.js?v=test"></script></body></html>`;
let linkcardLoads = 0;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/menu') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(MENU); }
    if (u.pathname === '/shared/messages.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'messages.js'))); }
    if (u.pathname === '/shared/ov-linkcard.js') { linkcardLoads++; res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'ov-linkcard.js'))); }
    if (u.pathname === '/ov-linkcard.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'ov-linkcard.js'))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-linkcard-'));
    const browser = await h.launch({ tmpDir });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800, block: OFFLINE });
        await p.goto(`${base}/`, { maxMs: 6000 });
        const r = await p.evaluate(`(() => {
            const M = window.OVLinkCard;
            const media = 'https://openvibe.media/i/abc.png';
            const cards = {
                good: M.make({ url: 'https://example.com/a', title: 'A <b>bold</b> title', description: 'What the page says about itself, in a line or two.', site_name: 'Example', image: media, kind: 'video', by: 'ana' }),
                third: M.make({ url: 'https://example.com/b', title: 'Third-party picture', image: 'https://example.com/pic.png' }),
                js: M.make({ url: 'javascript:alert(1)', title: 'No' }),
                http: M.make({ url: 'http://example.com/', title: 'No' }),
                untitled: M.make({ url: 'https://example.com/' }),
            };
            const pic = cards.good && cards.good.querySelector('.ovlc-pic img');
            const link = cards.good && cards.good.querySelector('a.ovlc-title');
            return {
                good: !!cards.good, kind: cards.good && cards.good.dataset.kind, pic: pic ? pic.getAttribute('src') : null,
                play: !!(cards.good && cards.good.querySelector('.ovlc-play svg')),
                title: link ? link.textContent : null, bold: !!(cards.good && cards.good.querySelector('b')),
                href: link ? link.href : null, target: link ? link.target : null, rel: link ? link.rel : null,
                site: cards.good && cards.good.querySelector('.ovlc-site').textContent,
                thirdImg: !!(cards.third && cards.third.querySelector('img')), thirdPlain: !!(cards.third && cards.third.classList.contains('ovlc-plain')),
                js: cards.js, http: cards.http, untitled: cards.untitled,
            };
        })()`);
        assert.deepStrictEqual([r.good, r.kind, r.pic, r.play], [true, 'video', 'https://openvibe.media/i/abc.png', true], 'a Media picture, with the play mark on a video');
        assert.strictEqual(r.title, 'A <b>bold</b> title'); assert.strictEqual(r.bold, false, 'a title is text, never markup');
        assert.deepStrictEqual([r.href, r.target], ['https://example.com/a', '_blank']);
        assert.ok(/noopener/.test(r.rel) && /nofollow/.test(r.rel), r.rel);
        assert.strictEqual(r.site, 'Example · by ana');
        assert.deepStrictEqual([r.thirdImg, r.thirdPlain], [false, true], 'a page\'s own picture is never loaded: the card is words only');
        assert.deepStrictEqual([r.js, r.http, r.untitled], [null, null, null], 'no card for a javascript: or http address, or without a title');

        // A message draws at most three; drawing again replaces them; the × calls back with its embed.
        const list = await p.evaluate(`(() => {
            const M = window.OVLinkCard; const host = document.getElementById('m1');
            const e = (i, extra) => Object.assign({ url: 'https://example.com/' + i, title: 'Card ' + i + ' with a long title that has to stop at two lines on a phone, never pushing the page wider than it is', description: 'x'.repeat(400), site_name: 'A site with a rather long name that must ellipsize' }, extra || {});
            const first = M.render(host, [e(1), e(2), e(3), e(4)], { onHide: (embed) => { window.__hidden = embed.title; } });
            const second = M.render(host, [e(5, { live: true, kind: 'live', image: 'https://openvibe.media/i/live.png' }), e(6)], { onHide: (embed) => { window.__hidden = embed.title; } });
            const cards = [...host.querySelectorAll(':scope > .ovlc')];
            cards[1].querySelector('.ovlc-hide').click();
            const widths = cards.map((c) => Math.round(c.getBoundingClientRect().right));
            const title = cards[1].querySelector('.ovlc-title');
            return { first, second, count: cards.length, live: !!cards[0].querySelector('.ovlc-live'), hidden: window.__hidden,
                rights: widths, doc: document.documentElement.scrollWidth, titleLines: Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight)),
                hideW: Math.round(cards[1].querySelector('.ovlc-hide').getBoundingClientRect().width) };
        })()`);
        assert.deepStrictEqual([list.first, list.second, list.count], [3, 2, 2], 'three at most; the second drawing replaced the first');
        assert.strictEqual(list.live, true);
        assert.ok(/^Card 6/.test(list.hidden), `the × called back with its embed (${list.hidden})`);
        assert.strictEqual(list.doc, 390, 'nothing spills past the phone');
        assert.ok(list.rights.every((x) => x <= 390 - 16 + 1), `cards end inside the gutter: ${list.rights}`);
        assert.ok(list.titleLines <= 2, `a long title stops at two lines (${list.titleLines})`);
        assert.ok(list.hideW >= 24, 'the × is a real button');

        // 4.321.0: html() (a server's card) draws the card make() builds, and watch() drops a picture that does not load.
        const parity = await p.evaluate(`(() => {
            const M = window.OVLinkCard;
            const e = { url: 'https://example.com/p', title: 'Same card', description: 'Either way', site_name: 'Ex', kind: 'video', image: 'https://openvibe.media/i/ov-test-missing-' + Date.now() + '.jpg' };
            const a = M.make(e);
            const host = document.createElement('div'); host.innerHTML = M.html(e); document.body.appendChild(host);
            const b = host.firstElementChild;
            const shape = (c) => [c.className.replace(' ovlc-plain', ''), c.dataset.kind, c.querySelector('.ovlc-site').textContent, c.querySelector('.ovlc-title').textContent,
                c.querySelector('.ovlc-title').href, c.querySelector('.ovlc-title').target, c.querySelector('.ovlc-line').textContent, !!c.querySelector('.ovlc-play svg')];
            return { same: JSON.stringify(shape(a)) === JSON.stringify(shape(b)), a: shape(a), b: shape(b) };
        })()`);
        assert.ok(parity.same, `html() draws make()'s card: ${JSON.stringify(parity)}`);
        await p.evaluate("window.OVLinkCard.watch(document), 1");
        await h.eventually(async () => assert.strictEqual(await p.evaluate("(() => { const c = [...document.querySelectorAll('.ovlc')].find((x) => x.querySelector('.ovlc-title').textContent === 'Same card' && x.querySelector('[data-ovlc-pic], .ovlc-pic') === null); return !!(c && c.classList.contains('ovlc-plain')); })()"), true,
            'a server-drawn card whose picture does not load keeps its words'), { timeout: 8000 });

        // Motion Off: no entrance animation.
        const off = await p.evaluate(`(() => { document.documentElement.setAttribute('data-ov-motion', 'off'); const c = window.OVLinkCard.make({ url: 'https://example.com/z', title: 'Still' }); document.body.appendChild(c); return getComputedStyle(c).animationName; })()`);
        assert.strictEqual(off, 'none');
        // The menu's Chat: a room row and a bubble each get their cards under the words; the module is loaded once.
        const m = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800, block: OFFLINE });
        await m.goto(`${base}/menu`, { maxMs: 6000 });
        await m.evaluate(`(() => {
            const card = (i) => ({ url: 'https://example.com/' + i, title: 'Card ' + i, site_name: 'Example' });
            window.OVMessages.render(document.getElementById('room'), { view: 'room', messages: [{ id: 1, user_id: 2, username: 'ana', message: 'see https://example.com/1', created_at: '2026-11-18T22:00:00Z', embeds: [card(1), card(2), card(3), card(4)] }, { id: 2, user_id: 3, username: 'bo', message: 'no link', created_at: '2026-11-18T22:01:00Z' }] });
            window.OVMessages.render(document.getElementById('dm'), { view: 'bubbles', me: 2, messages: [{ id: 3, sender_id: 2, message: 'mine https://example.com/5', created_at: '2026-11-18T22:02:00Z', embeds: [card(5)] }] });
            return 1;
        })()`);
        const menu = await h.eventually(async () => {
            const x = await m.evaluate(`(() => ({ room: document.querySelectorAll('#room .ovm-room')[0].querySelectorAll('.ovm-cards > .ovlc').length,
                plain: document.querySelectorAll('#room .ovm-room')[1].querySelectorAll('.ovm-cards').length,
                dm: document.querySelectorAll('#dm .ovm-group-body > .ovm-cards > .ovlc').length, doc: document.documentElement.scrollWidth }))()`);
            assert.ok(x.room === 3 && x.dm === 1, `the menu's Chat draws the cards (${JSON.stringify(x)})`);
            return x;
        }, { timeout: 6000 });
        assert.strictEqual(menu.plain, 0, 'a message with no address gets no card box');
        assert.strictEqual(menu.doc, 390);
        assert.strictEqual(linkcardLoads, 1, 'ov-linkcard.js is loaded once, from beside messages.js');
        console.log(`linkcard-chrome: the menu's Chat draws them in rooms and bubbles; https and Media only, text only, 3 per message, replaced on redraw, × calls back, ${list.doc} px wide, motion Off still`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
