'use strict';
// agent-session.js in a real headless Chrome: the attachments of a step and a message (4.50.0). A group's header
// shows them while the group is folded; a message's sit under its text. A tap opens a preview sheet that shows the
// file the way its kind asks for — an image, a video, an audio, a PDF, text — with Open and Download. Text is set as
// text (never as markup), an attachment loads only from the page's own origin, and a broken image hides itself.
// Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('agent-session-embeds-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}
const ROOT = path.join(__dirname, '..');

// A small PNG, made here so the test needs nothing else.
function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
        c = (crc ^ buf[n]) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = c ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
}
function png(w, h, rgb) {
    const raw = Buffer.alloc((w * 3 + 1) * h);
    let o = 0;
    for (let y = 0; y < h; y++) { raw[o++] = 0; for (let x = 0; x < w; x++) { raw[o++] = rgb[0]; raw[o++] = rgb[1]; raw[o++] = rgb[2]; } }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const SHOT = png(240, 150, [64, 132, 214]);
const NOTES = '# Proof\n\n<script>window.__pwned = 1</script>\n\n<img src=x onerror="window.__pwned=2">\n\n| a | b |\n';
const CODE = 'const a = "<script>alert(1)</script>";\n// a comment\n';
const CSV = 'name,size\nshot.png,12\nother.png,34\n';
const JSONF = '{"a":1,"b":[2,3]}';

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Embeds</title><link rel="icon" href="data:,"></head>
<body style="margin:0;padding:0 16px"><div id="s"></div><script src="/agent-session.js"></script>
<script>window.v = OpenVibeAgentSession.mount(document.getElementById('s'), { title: 'Fix the stats', status: 'running' });</script></body></html>`;

const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u === '/agent-session.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'agent-session.js'))); }
    if (u === '/agent-session.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, 'agent-session.css'))); }
    if (u === '/shot.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(SHOT); }
    if (u === '/broken.png') { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('no'); }
    if (u === '/notes.md') { res.writeHead(200, { 'content-type': 'text/markdown' }); return res.end(NOTES); }
    if (u === '/code.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(CODE); }
    if (u === '/table.csv') { res.writeHead(200, { 'content-type': 'text/csv' }); return res.end(CSV); }
    if (u === '/data.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSONF); }
    if (u === '/movie.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(Buffer.alloc(16)); }
    if (u === '/sound.mp3') { res.writeHead(200, { 'content-type': 'audio/mpeg' }); return res.end(Buffer.alloc(16)); }
    if (u === '/doc.pdf') { res.writeHead(200, { 'content-type': 'application/pdf' }); return res.end('%PDF-1.4\n%%EOF\n'); }
    res.writeHead(404); return res.end();
});

const att = (url, name, kind, role, mime) => ({ url, name, mime: mime || '', kind, role: role || 'output' });

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-ovas-embeds-'));
    const browser = await h.launch({ tmpDir });
    const push = (p, e) => p.evaluate(`window.v.push(${JSON.stringify(e)}), 1`);
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 900 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 8000 });

        // A step's attachment shows in its group's header, while the group is folded.
        await push(p, { t: 'tool', id: 'r1', name: 'Read', input: { file_path: 'shot.png' }, attachments: [att('/shot.png', 'shot.png', 'image', 'read', 'image/png')] });
        await push(p, { t: 'tool', id: 'c1', name: 'Bash', input: { command: 'npm test' } });
        await p.evaluate(`(() => { const g = document.querySelector('.ovas-group'); g.open = false; return 1 })()`);
        let v = await p.evaluate(`(() => { const g = document.querySelector('.ovas-group'); const tile = g.querySelector('summary .ovas-att-img'); const img = tile && tile.querySelector('img'); return {
            open: g.open, tile: !!tile, src: img && img.getAttribute('src'), cap: tile && tile.querySelector('.ovas-att-cap').textContent,
            inSummary: !!(tile && tile.closest('summary')), height: tile ? tile.getBoundingClientRect().height : 0 } })()`);
        assert.ok(!v.open, 'the group is folded');
        assert.ok(v.tile && v.inSummary, "a step's attachment shows in its group's header, folded or not");
        assert.strictEqual(v.src, '/shot.png', 'the thumbnail is the URL the product gave');
        assert.strictEqual(v.cap, 'shot.png', 'the tile carries the name');
        assert.ok(v.height > 0, 'the thumbnail is drawn while the group is folded');

        // A message's attachment shows under its text.
        await push(p, { t: 'text', text: 'Here is the proof.', attachments: [att('/shot.png', 'proof.png', 'image', 'output', 'image/png')] });
        v = await p.evaluate(`(() => { const m = [...document.querySelectorAll('.ovas-msg')].pop(); const img = m.querySelector('.ovas-att-img');
            const kids = [...m.children]; const strip = m.querySelector('.ovas-att'); const para = m.querySelector('p');
            return { text: (para && para.textContent || '').trim(), img: !!img, after: !!(strip && para && kids.indexOf(strip) > kids.indexOf(para)) } })()`);
        assert.ok(v.img && v.after, "a message's attachment shows under its text");

        // A tap opens the preview sheet.
        await p.evaluate(`document.querySelector('.ovas-msg .ovas-att-img').click(), 1`);
        v = await p.evaluate(`(() => { const s = document.querySelector('.ovas-sheet'); return {
            open: !s.hidden, img: !!s.querySelector('.ovas-prev-img'), src: s.querySelector('.ovas-prev-img') && s.querySelector('.ovas-prev-img').getAttribute('src'),
            name: s.querySelector('.ovas-sheet-name').textContent, openHref: s.querySelector('.ovas-sheet-open').getAttribute('href'),
            dl: s.querySelector('.ovas-sheet-dl').getAttribute('download'), focused: document.activeElement.className } })()`);
        assert.ok(v.open && v.img, 'the preview opens with the image');
        assert.strictEqual(v.src, '/shot.png', 'the preview shows the image at full width');
        assert.strictEqual(v.name, 'proof.png', 'the sheet says which file it is');
        assert.strictEqual(v.openHref, '/shot.png', 'and offers to open it');
        assert.strictEqual(v.dl, 'proof.png', 'and to download it');
        assert.ok(/ovas-sheet-x/.test(v.focused), 'the keyboard goes to the close button');

        // Escape closes it.
        await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 1`);
        v = await p.evaluate(`document.querySelector('.ovas-sheet').hidden`);
        assert.strictEqual(v, true, 'Escape closes the preview');

        // One step, one file of every kind: each opens the way its kind asks for.
        await push(p, { t: 'tool', id: 'k1', name: 'Read', input: { file_path: 'bundle' }, attachments: [
            att('/shot.png', 'shot.png', 'image', 'read', 'image/png'), att('/movie.mp4', 'movie.mp4', 'video', 'output', 'video/mp4'),
            att('/sound.mp3', 'sound.mp3', 'audio', 'output', 'audio/mpeg'), att('/doc.pdf', 'doc.pdf', 'pdf', 'output', 'application/pdf'),
            att('/code.js', 'code.js', 'text', 'wrote', 'text/javascript')] });
        const kinds = await p.evaluate(`(() => { const gs = document.querySelectorAll('.ovas-group'); const g = gs[gs.length - 1]; const tiles = g.querySelectorAll('.ovas-att > *'); return [...tiles].map((t) => t.dataset.kind) })()`);
        assert.deepStrictEqual(kinds, ['image', 'video', 'audio', 'pdf', 'text'], 'every kind of file is a tile of its own');
        const openBy = async (name) => {
            await p.evaluate(`(() => { const t = [...document.querySelectorAll('.ovas-att > *')].find((n) => n.querySelector('.ovas-att-cap').textContent === ${JSON.stringify(name)}); if (!t) throw new Error('no tile ' + ${JSON.stringify(name)}); t.click(); return 1 })()`);
            return p.evaluate(`(() => { const s = document.querySelector('.ovas-sheet'); const b = s.querySelector('.ovas-sheet-body'); return {
                video: !!b.querySelector('video'), audio: !!b.querySelector('audio'), pdf: !!b.querySelector('iframe'),
                code: !!b.querySelector('pre code'), text: b.textContent, scripts: b.querySelectorAll('script').length,
                pwned: window.__pwned === undefined } })()`);
        };
        v = await openBy('movie.mp4');
        assert.ok(v.video, 'a video opens in its player');
        v = await openBy('sound.mp3');
        assert.ok(v.audio, 'audio opens in its player');
        v = await openBy('doc.pdf');
        assert.ok(v.pdf, 'a PDF opens in a frame');
        v = await openBy('code.js');
        assert.ok(v.code, 'text opens as code');
        assert.ok(v.text.includes('<script>alert(1)</script>'), 'the code is there as text');
        assert.strictEqual(v.scripts, 0, 'and never as markup');
        assert.ok(v.pwned, 'the text never ran');

        // A CSV as a table, JSON pretty-printed.
        await push(p, { t: 'tool', id: 'k2', name: 'Read', input: { file_path: 'table.csv' }, attachments: [att('/table.csv', 'table.csv', 'text', 'read', 'text/csv')] });
        await openBy('table.csv');
        for (let i = 0; i < 30 && !(await p.evaluate(`!!document.querySelector('.ovas-sheet-body .ovas-csv')`)); i++) await p.evaluate(`new Promise((r) => setTimeout(r, 100)), 1`);
        v = await p.evaluate(`(() => { const b = document.querySelector('.ovas-sheet-body'); const t = b.querySelector('.ovas-csv'); return {
            table: !!t, head: t && t.querySelector('th').textContent, rows: t ? t.querySelectorAll('tbody tr').length : 0,
            cell: t && t.querySelector('tbody td').textContent } })()`);
        assert.ok(v.table && v.head === 'name' && v.rows === 2 && v.cell === 'shot.png', 'a CSV opens as a table');
        await push(p, { t: 'tool', id: 'k3', name: 'Read', input: { file_path: 'data.json' }, attachments: [att('/data.json', 'data.json', 'text', 'read', 'application/json')] });
        await openBy('data.json');
        for (let i = 0; i < 30 && !(await p.evaluate(`document.querySelector('.ovas-sheet-body').textContent.includes('"a"')`)); i++) await p.evaluate(`new Promise((r) => setTimeout(r, 100)), 1`);
        v = await p.evaluate(`document.querySelector('.ovas-sheet-body').textContent`);
        assert.ok(v.includes('"a": 1'), 'JSON is pretty-printed (got: ' + v.slice(0, 200) + ')');

        // A third-party address the model printed never loads.
        await push(p, { t: 'text', text: 'Not mine', attachments: [att('https://evil.example.com/x.png', 'x.png', 'image', 'output', 'image/png')] });
        v = await p.evaluate(`(() => { const m = [...document.querySelectorAll('.ovas-msg')].pop(); return {
            tiles: m.querySelectorAll('.ovas-att > *').length, srcs: [...document.querySelectorAll('.ovas-att img')].map((i) => i.getAttribute('src')) } })()`);
        assert.strictEqual(v.tiles, 0, "a third-party address is not shown");
        assert.ok(!v.srcs.includes('https://evil.example.com/x.png'), 'and never loaded');

        // A broken image hides itself.
        await push(p, { t: 'text', text: 'Broken', attachments: [att('/broken.png', 'broken.png', 'image', 'output', 'image/png')] });
        await p.evaluate(`(() => { const m = [...document.querySelectorAll('.ovas-msg')].pop(); m.scrollIntoView(); return 1 })()`);
        let gone = false;
        for (let i = 0; i < 25 && !gone; i++) {
            await p.evaluate(`new Promise((r) => setTimeout(r, 100)), 1`);
            gone = await p.evaluate(`(() => { const m = [...document.querySelectorAll('.ovas-msg')].pop(); const b = m.querySelector('.ovas-att > *'); return !!(b && b.hidden && !b.querySelector('img')); })()`);
        }
        assert.ok(gone, 'a broken image hides itself');

        // The phone: nothing sideways, and every target big enough to tap.
        v = await p.evaluate(`(() => { const doc = document.documentElement; const chips = [...document.querySelectorAll('.ovas-att-chip')]; return {
            wide: doc.scrollWidth, chips: chips.map((c) => Math.round(c.getBoundingClientRect().height)) } })()`);
        assert.ok(v.wide <= 390, 'nothing scrolls sideways at 390 px (' + v.wide + ')');
        assert.ok(v.chips.every((h) => h >= 44), 'a chip is a 44 px target on a phone');

        await p.close();
        console.log('agent-session-embeds-chrome: attachments, previews and safety ok');
    } finally {
        await browser.close().catch(() => {});
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
