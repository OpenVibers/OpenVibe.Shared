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

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('linkcard-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en" data-theme-mode="dark"><head><meta charset="utf-8"><title>Cards</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head>
<body style="margin:0;padding:16px;background:#0b0f19;color:#e6edf7;font:14px system-ui"><ul id="chat" style="list-style:none;margin:0;padding:0">
<li id="m1"><b>ana</b> look at this</li><li id="m2"><b>bo</b> and these</li></ul>
<script src="/ov-linkcard.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/ov-linkcard.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'ov-linkcard.js'))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-linkcard-'));
    const browser = await h.launch({ tmpDir });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
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

        // Motion Off: no entrance animation.
        const off = await p.evaluate(`(() => { document.documentElement.setAttribute('data-ov-motion', 'off'); const c = window.OVLinkCard.make({ url: 'https://example.com/z', title: 'Still' }); document.body.appendChild(c); return getComputedStyle(c).animationName; })()`);
        assert.strictEqual(off, 'none');
        console.log(`linkcard-chrome: https and Media only, text only, 3 per message, replaced on redraw, × calls back, ${list.doc} px wide, motion Off still`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
