'use strict';
// The one dropdown for a field (ov-combo.js, 4.202.0; ask 348) in a real headless Chrome against a stub source: the
// field becomes a combobox (no datalist); focus shows the sections, typing asks again (the earlier answer is not
// painted over the newer), the match is marked, the arrows and Enter pick and the address goes in; a name nobody has
// offers "Create … on OpenVibe Git", which posts the name and puts the new address in; a source that fails says so and
// the field still takes a pasted address; Escape closes; the list stays on screen near the bottom (it opens upward).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-combo-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const REPOS = [
    { label: 'goosely/goal-bar', url: 'https://git.openvibe.codes/goosely/goal-bar.git', host: 'git.openvibe.codes', private: true },
    { label: 'goosely/site', url: 'https://git.openvibe.codes/goosely/site.git', host: 'git.openvibe.codes' },
    { label: 'goosely/overlay-kit', url: 'https://github.com/goosely/overlay-kit.git', host: 'github.com' },
];
const asked = [];
let failing = false;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/ov-combo.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-combo.js'))); }
    if (u.pathname === '/repos') {
        const q = (u.searchParams.get('q') || '').toLowerCase();
        asked.push(q);
        const answer = () => {
            if (failing) { res.writeHead(500); return res.end(); }
            const m = (r) => !q || r.label.toLowerCase().includes(q);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ sections: [{ id: 'recent', label: 'Recent', items: REPOS.slice(0, 1).filter(m) }, { id: 'git', label: 'On OpenVibe Git', items: REPOS.slice(1, 2).filter(m) }, { id: 'github', label: 'On GitHub', items: REPOS.slice(2).filter(m) }], create: { allowed: true, host: 'git.openvibe.codes', owner: 'goosely' } }));
        };
        // "go" answers late: a later query must not be painted over by it.
        return q === 'go' ? setTimeout(answer, 600) : answer();
    }
    if (u.pathname === '/create' && req.method === 'POST') {
        let body = ''; req.on('data', (c) => { body += c; });
        req.on('end', () => { const b = JSON.parse(body); res.writeHead(201, { 'content-type': 'application/json' }); res.end(JSON.stringify({ url: `https://git.openvibe.codes/goosely/${b.name}.git`, label: `goosely/${b.name}`, private: b.private })); });
        return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#111;color:#eee;font-family:sans-serif">
<form id="f" style="padding:40px 16px"><input id="repo" name="repo" list="old" aria-label="Repository" style="width:100%;height:40px" data-ov-combo="/repos" data-ov-combo-create="/create"><datalist id="old"></datalist></form>
<input id="low" data-ov-combo="/repos" aria-label="Low" style="position:fixed;bottom:8px;left:16px;width:300px;height:36px">
<script>window.picks = []; document.addEventListener('ov-combo:pick', (e) => window.picks.push(e.detail.url));</script><script src="/ov-combo.js"></script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-combo-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 700 });
        await page.goto(base + '/', { maxMs: 5000 });
        const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
        const key = async (k) => { const codes = { Enter: 13, ArrowDown: 40, ArrowUp: 38, Escape: 27 }; const ev = { key: k, code: k, windowsVirtualKeyCode: codes[k], nativeVirtualKeyCode: codes[k] }; await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...ev }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ev }); };
        const view = () => page.evaluate(`(() => { const p = document.querySelector('.ovcombo'); if (!p || p.hidden) return null; return { secs: [...p.querySelectorAll('.ovcombo-sec')].map((x) => x.textContent), rows: [...p.querySelectorAll('.ovcombo-i b')].map((x) => x.textContent), sel: [...p.querySelectorAll('.ovcombo-i')].findIndex((x) => x.getAttribute('aria-selected') === 'true'), marks: [...p.querySelectorAll('.ovcombo-i b mark')].map((x) => x.textContent), none: (p.querySelector('.ovcombo-none, .ovcombo-err') || {}).textContent || '' }; })()`);

        const a = await page.evaluate(`({ role: repo.getAttribute('role'), list: repo.getAttribute('list'), exp: repo.getAttribute('aria-expanded'), ac: repo.getAttribute('autocomplete') })`);
        assert.deepEqual(a, { role: 'combobox', list: null, exp: 'false', ac: 'off' }, 'a combobox, the datalist gone');

        await page.evaluate(`repo.focus()`);
        assert.ok(await until(`!!document.querySelector('.ovcombo:not([hidden]) .ovcombo-i')`), 'focus shows the list');
        let v = await view();
        assert.deepEqual(v.secs, ['Recent', 'On OpenVibe Git', 'On GitHub']);
        assert.deepEqual(v.rows, ['goosely/goal-bar', 'goosely/site', 'goosely/overlay-kit']);
        assert.equal(await page.evaluate(`repo.getAttribute('aria-expanded')`), 'true');

        // A slow answer for "go" must not paint over the answer for "goal".
        await page.send('Input.insertText', { text: 'go' });
        await wait(250);
        await page.send('Input.insertText', { text: 'al' });
        assert.ok(await until(`(() => { const p = document.querySelector('.ovcombo'); return p && !p.hidden && p.querySelectorAll('.ovcombo-i').length && [...p.querySelectorAll('.ovcombo-i b')][0].textContent === 'goosely/goal-bar'; })()`));
        await wait(700);
        v = await view();
        assert.deepEqual(v.rows, ['goosely/goal-bar', 'Create “goal” on OpenVibe Git'], 'only what matches "goal", and a Create row');
        assert.deepEqual(v.marks, ['goal'], 'the match is marked');
        assert.equal(v.sel, 0, 'the first row is ready for Enter');
        await key('Enter');
        assert.equal(await page.evaluate('repo.value'), 'https://git.openvibe.codes/goosely/goal-bar.git', 'Enter put the address in');
        assert.equal(await view(), null, 'and closed the list');
        assert.deepEqual(await page.evaluate('window.picks'), ['https://git.openvibe.codes/goosely/goal-bar.git']);

        // A new name: Create … on OpenVibe Git.
        await page.evaluate(`(() => { repo.value = ''; repo.__ovcomboPicked = null; })()`);
        await page.send('Input.insertText', { text: 'sub-goal-bar' });
        assert.ok(await until(`[...document.querySelectorAll('.ovcombo .ovcombo-i b')].some((b) => b.textContent === 'Create “sub-goal-bar” on OpenVibe Git')`), 'a name nobody has can be created');
        v = await view();
        assert.match(await page.evaluate(`document.querySelector('.ovcombo .is-create small').textContent`), /Private, under @goosely/);
        await key('ArrowDown');
        await key('ArrowUp');
        await key('Enter');
        assert.ok(await until(`repo.value === 'https://git.openvibe.codes/goosely/sub-goal-bar.git'`), 'the new repository went in');
        assert.equal(await page.evaluate('window.picks.length'), 2);

        // Escape closes; ArrowDown opens again.
        await key('ArrowDown');
        assert.ok(await until(`!!document.querySelector('.ovcombo:not([hidden])')`));
        await key('Escape');
        assert.equal(await view(), null, 'Escape closes it');

        // A source that fails says so; a pasted address still stands.
        failing = true;
        await page.evaluate(`(() => { repo.value = ''; repo.__ovcomboPicked = null; })()`);
        await page.send('Input.insertText', { text: 'zz' });
        assert.ok(await until(`/did not load/.test((document.querySelector('.ovcombo-err') || {}).textContent || '')`), 'a failed source says the list did not load');
        failing = false;
        assert.equal(await page.evaluate('repo.value'), 'zz');

        // Near the bottom, it opens upward and stays on screen.
        await page.evaluate(`document.getElementById('low').focus()`);
        assert.ok(await until(`!!document.querySelector('.ovcombo.is-up:not([hidden]) .ovcombo-i')`), 'it opens upward near the bottom');
        const r = await page.evaluate(`(() => { const b = document.querySelector('.ovcombo').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, vw: innerWidth, vh: innerHeight }; })()`);
        assert.ok(r.top >= 0 && r.bottom <= r.vh && r.left >= 8 && r.right <= r.vw - 8, `on screen ${JSON.stringify(r)}`);
        await page.close();
        console.log('ov-combo-chrome: a combobox (no datalist), sections, a slow answer not painted over a newer one, marks, Enter picks, Create on OpenVibe Git, Escape, a failed source, upward near the bottom');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
