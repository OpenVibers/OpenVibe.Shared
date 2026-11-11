'use strict';
// The one composer (ov-composer.js, 4.201.0; ask 349) in a real headless Chrome, on thread.composer()'s own markup:
// files by the picker, a paste and a drop become chips and go with the form; a long paste becomes a text file that can
// go back in the box; "/" lists the site's commands, then yours, then settings, and the arrows and Enter pick one; "@"
// lists a mod's people; a mod's upload shows its progress, holds the send, and the form carries the id; Ctrl+Enter sends
// whatever the setting; with "Ctrl+Enter sends" Enter is a new line; Ctrl+B marks bold; the draft comes back after a
// reload and goes when sent; the count shows near the limit; your own command shows in the list as Yours.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
assert.doesNotThrow(() => require('../ov-composer'), 'ov-composer.js loads (browser-only: Node takes the early return)');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-composer-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const thread = require('../thread');
const form = thread.composer({
    action: '/send', id: 'c1', placeholder: 'Message', maxlength: 600,
    attach: { menu: true, accept: 'image/*,text/plain,.md' },
    commands: [{ name: 'fix', hint: 'Fix a bug', insert: 'Fix this: ' }, { name: 'plan', hint: 'Plan first', insert: 'Plan it first. ' }],
});
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const file = { '/ov-composer.js': 'application/javascript', '/ov-window.js': 'application/javascript', '/thread.css': 'text/css' }[u];
    if (file) { res.writeHead(200, { 'content-type': file }); return res.end(fs.readFileSync(path.join(root, u.slice(1)))); }
    if (u === '/send') { res.writeHead(204); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/thread.css">
<body style="margin:0;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div class="ovt" data-ovt style="padding:200px 16px 40px">${form}</div>
<script>window.sent = 0; document.getElementById('c1').addEventListener('submit', (e) => { e.preventDefault(); window.sent++; });</script>
<script src="/ov-composer.js"></script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-composer-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
        await page.goto(base + '/', { maxMs: 5000 });
        const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
        const key = async (k, mods = 0) => {
            const codes = { Enter: 13, ArrowDown: 40, ArrowUp: 38, Escape: 27, Tab: 9, b: 66 };
            const ev = { key: k, code: k.length === 1 ? `Key${k.toUpperCase()}` : k, windowsVirtualKeyCode: codes[k], nativeVirtualKeyCode: codes[k], modifiers: mods };
            await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...ev, ...(k === 'Enter' && !mods ? { text: '\r' } : {}) });
            await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ev });
        };
        const type = (t) => page.send('Input.insertText', { text: t });
        const val = () => page.evaluate(`document.querySelector('#c1 textarea').value`);
        const clear = () => page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
        // The composer's mod key is the platform's (Cmd on a Mac, Ctrl elsewhere): send the one the box listens for.
        const MOD = await page.evaluate(`/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')`) ? 4 : 2;
        assert.ok(await until(`!!(window.OpenVibeComposer && document.getElementById('c1').__ovc)`), 'it joins the box');
        await page.evaluate(`document.querySelector('#c1 textarea').focus()`);

        // Files: a paste and a drop become chips, and the form's file input holds them.
        await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); const dt = new DataTransfer();
            dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' }));
            t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
        await page.evaluate(`(() => { const z = document.querySelector('[data-ovt]'); const dt = new DataTransfer();
            dt.items.add(new File(['# notes'], 'notes.md', { type: 'text/markdown' }));
            for (const type of ['dragenter', 'dragover', 'drop']) z.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true })); })()`);
        let f = await page.evaluate(`(() => ({ chips: [...document.querySelectorAll('#c1 .ovc-file-n')].map((x) => x.textContent), inForm: document.querySelector('#c1 input[type=file]').files.length,
            thumb: !!document.querySelector('#c1 .ovc-file img.ovc-file-th'), dropping: document.getElementById('c1').classList.contains('ovc-dropping'), send: document.querySelector('#c1 [data-ovt-send]').disabled }))()`);
        assert.deepEqual(f.chips, ['shot.png', 'notes.md'], 'a pasted picture and a dropped file are chips');
        assert.equal(f.inForm, 2, 'and they go with the form');
        assert.ok(f.thumb && !f.dropping, 'the picture shows its thumbnail; the drop target goes after the drop');
        assert.equal(f.send, false, 'a file alone can be sent');
        // A file the box does not take is refused with a word, not added.
        await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); const dt = new DataTransfer(); dt.items.add(new File(['x'], 'tool.exe', { type: 'application/x-msdownload' }));
            t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
        assert.match(await page.evaluate(`document.querySelector('#c1 [data-ovt-note]').textContent`), /does not take that kind of file/);
        assert.equal(await page.evaluate(`document.querySelectorAll('#c1 .ovc-file').length`), 2);
        // × removes one, from the chips and from the form.
        await page.evaluate(`document.querySelector('#c1 .ovc-file [data-ovc-x]').click()`);
        f = await page.evaluate(`({ chips: document.querySelectorAll('#c1 .ovc-file').length, inForm: document.querySelector('#c1 input[type=file]').files.length })`);
        assert.deepEqual(f, { chips: 1, inForm: 1 }, '× takes it out of the chips and the form');
        await page.evaluate(`document.querySelector('#c1 .ovc-file [data-ovc-x]').click()`);

        // A long paste is a file you can put back.
        await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); const dt = new DataTransfer(); dt.setData('text/plain', Array.from({ length: 200 }, (_, i) => 'line ' + i).join('\\n'));
            t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
        f = await page.evaluate(`({ name: (document.querySelector('#c1 .ovc-file-n') || {}).textContent, sub: (document.querySelector('#c1 .ovc-file-s') || {}).textContent, box: document.querySelector('#c1 textarea').value })`);
        assert.equal(f.name, 'Pasted text');
        assert.match(f.sub, /^200 lines/);
        assert.equal(f.box, '', 'the long paste did not flood the box');
        await page.evaluate(`document.querySelector('#c1 [data-ovc-back]').click()`);
        assert.ok((await val()).startsWith('line 0\nline 1'), '↩ puts it back in the box');
        assert.equal(await page.evaluate(`document.querySelectorAll('#c1 .ovc-file').length`), 0);
        // A box that takes only pictures keeps a long paste as text (it is not turned into a file it would refuse).
        await page.evaluate(`(() => { const i = document.querySelector('#c1 input[type=file]'); i.dataset.acc = i.getAttribute('accept'); i.setAttribute('accept', 'image/*'); })()`);
        f = await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); const dt = new DataTransfer(); dt.setData('text/plain', 'x\\n'.repeat(200));
            const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); t.dispatchEvent(ev); return { prevented: ev.defaultPrevented, chips: document.querySelectorAll('#c1 .ovc-file').length }; })()`);
        assert.deepEqual(f, { prevented: false, chips: 0 }, 'a pictures-only box lets the long paste in as text');
        await page.evaluate(`(() => { const i = document.querySelector('#c1 input[type=file]'); i.setAttribute('accept', i.dataset.acc); })()`);
        await clear();

        // "/": the site's commands, then settings; the arrows and Enter pick one, and Enter does not send.
        await type('/');
        assert.ok(await until(`!document.querySelector('#c1 .ovc-pop').hidden`), '/ opens the list');
        const rows = await page.evaluate(`[...document.querySelectorAll('#c1 .ovc-pop-i b')].map((b) => b.textContent)`);
        assert.deepEqual(rows, ['/fix', '/plan', '/settings']);
        await key('ArrowDown');
        await key('Enter');
        assert.equal(await val(), 'Plan it first. ', 'the second command went in where / was');
        assert.equal(await page.evaluate('window.sent'), 0, 'Enter picked, it did not send');
        assert.equal(await page.evaluate(`document.querySelector('#c1 .ovc-pop').hidden`), true);
        await clear();
        await type('/pl');
        await until(`!document.querySelector('#c1 .ovc-pop').hidden`);
        assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('#c1 .ovc-pop-i b')].map((b) => b.textContent)`), ['/plan'], 'typing narrows the list');
        await key('Escape');
        assert.equal(await page.evaluate(`document.querySelector('#c1 .ovc-pop').hidden`), true, 'Escape closes it');
        await clear();

        // A mod: "@" people, a tool, and an upload that holds the send until it is done.
        await page.evaluate(`(() => {
            window.toolRan = 0; window.finish = null;
            OpenVibeComposer.mod({ id: 'test', mentions: { search: async (q) => [{ label: 'Alex', handle: 'alex', sub: '@alex' }, { label: 'Sam', handle: 'sam' }].filter((p) => p.handle.startsWith(q)) },
                tools: [{ id: 'star', label: 'Star it', path: 'M12 3l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z', run: (ctx) => { window.toolRan++; ctx.insert('★'); } }],
                upload: (file, progress) => new Promise((ok) => { progress(0.4); window.finish = () => ok({ id: 'att_123' }); }) });
        })()`);
        await type('Hi @al');
        assert.ok(await until(`!document.querySelector('#c1 .ovc-pop').hidden && document.querySelectorAll('#c1 .ovc-pop-i').length === 1`), '@ lists the people');
        await key('Enter');
        assert.equal(await val(), 'Hi @alex ', 'the mention went in');
        await page.evaluate(`document.querySelector('#c1 .ovc-tool').click()`);
        assert.equal(await page.evaluate('window.toolRan'), 1, "the mod's tool is a button in the row");
        assert.equal(await val(), 'Hi @alex ★');
        await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); const dt = new DataTransfer(); dt.items.add(new File(['x'], 'a.png', { type: 'image/png' }));
            t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
        f = await page.evaluate(`({ up: document.querySelector('#c1 .ovc-file').classList.contains('is-up'), pct: document.querySelector('#c1 .ovc-file-s').textContent, send: document.querySelector('#c1 [data-ovt-send]').disabled, inForm: document.querySelector('#c1 input[type=file]').files.length })`);
        assert.deepEqual(f, { up: true, pct: '40%', send: true, inForm: 0 }, 'an upload shows its progress, holds the send, and the file does not also go in the form');
        await key('Enter', MOD);
        assert.equal(await page.evaluate('window.sent'), 0, 'no send while a file uploads');
        await page.evaluate('window.finish()');
        assert.ok(await until(`document.querySelector('#c1 input[name=attachments]') && document.querySelector('#c1 input[name=attachments]').value === 'att_123'`), 'the form carries the upload\'s id');
        assert.equal(await page.evaluate(`document.querySelector('#c1 [data-ovt-send]').disabled`), false);
        await key('Enter', MOD);
        assert.equal(await page.evaluate('window.sent'), 1, 'Ctrl+Enter sends');
        await page.evaluate(`document.querySelector('#c1 .ovc-file [data-ovc-x]').click()`);
        assert.equal(await page.evaluate(`document.querySelectorAll('#c1 input[name=attachments]').length`), 0, 'removing the chip removes its id');
        await clear();

        // Ctrl+Enter sends; Enter is a new line.
        await page.evaluate(`OpenVibeComposer.setPrefs({ send_key: 'mod-enter' })`);
        await type('one');
        await key('Enter');
        await type('two');
        assert.equal(await val(), 'one\ntwo', 'Enter is a new line');
        assert.equal(await page.evaluate('window.sent'), 1);
        await key('Enter', MOD);
        assert.equal(await page.evaluate('window.sent'), 2, 'Ctrl+Enter sends');
        await page.evaluate(`OpenVibeComposer.setPrefs({ send_key: 'enter' })`);
        await clear();

        // Ctrl+B marks the selection bold.
        await type('make this bold');
        await page.evaluate(`document.querySelector('#c1 textarea').setSelectionRange(10, 14)`);
        await key('b', MOD);
        assert.equal(await val(), 'make this **bold**');

        // The draft: back after a reload; gone once sent.
        await wait(550);
        await page.goto(base + '/', { maxMs: 5000 });
        assert.ok(await until(`!!(window.OpenVibeComposer && document.getElementById('c1').__ovc)`));
        assert.equal(await val(), 'make this **bold**', 'the draft came back');
        await page.evaluate(`document.getElementById('c1').requestSubmit()`);
        await page.goto(base + '/', { maxMs: 5000 });
        await until(`!!(window.OpenVibeComposer && document.getElementById('c1').__ovc)`);
        assert.equal(await val(), '', 'a sent draft does not come back');

        // Your own command: in the list, marked Yours; the settings sheet lists it.
        await page.evaluate(`OpenVibeComposer.setPrefs({ snippets: [{ trigger: 'sig', text: 'Thanks, Alex' }] })`);
        await page.evaluate(`document.querySelector('#c1 textarea').focus()`);
        await type('/si');
        assert.ok(await until(`!document.querySelector('#c1 .ovc-pop').hidden`));
        f = await page.evaluate(`[...document.querySelectorAll('#c1 .ovc-pop-i')].map((b) => b.textContent)`);
        assert.ok(f.some((t) => t.includes('/sig') && t.includes('Yours')), 'your command is in the list, marked Yours');
        await key('Enter');
        assert.equal(await val(), 'Thanks, Alex');
        await clear();
        await type('/settings');
        await until(`!document.querySelector('#c1 .ovc-pop').hidden`);
        await key('Enter');
        assert.ok(await until(`!!document.querySelector('.ovw .ovc-set-in')`), '/settings opens your composer settings, in the one window (ov-window.js, loaded from beside the composer)');
        assert.equal(await page.evaluate(`document.querySelector('.ovw .ovw-t').textContent`), 'Your composer');
        f = await page.evaluate(`({ mine: [...document.querySelectorAll('.ovw .ovc-set-l b')].map((b) => b.textContent), box: document.querySelector('#c1 textarea').value })`);
        assert.deepEqual(f, { mine: ['/sig'], box: '' }, 'the sheet lists your commands; the /settings word left the box');

        // The count near the limit (600: it shows from 90 left, the last 15%); far from it, nothing.
        await page.evaluate(`OVWindow.closeAll()`);
        await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); t.value = 'x'.repeat(450); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        assert.equal(await page.evaluate(`document.querySelector('#c1 .ovc-count').hidden`), true, '150 left of 600 is not near the limit');
        await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); t.value = 'x'.repeat(590); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        f = await page.evaluate(`({ shown: !document.querySelector('#c1 .ovc-count').hidden, text: document.querySelector('#c1 .ovc-count').textContent, low: document.querySelector('#c1 .ovc-count').classList.contains('is-low') })`);
        assert.deepEqual(f, { shown: true, text: '10 left', low: true });
        await page.close();
        console.log('ov-composer-chrome: files (paste, drop, refuse, remove), a long paste as a file, / and @, a mod\'s tool and upload, Ctrl+Enter, Ctrl+B, drafts, your commands, settings and the count');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
