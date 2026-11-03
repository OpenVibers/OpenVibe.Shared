'use strict';
// ov-forms.js and ov-forms.css (4.109.0) in a real headless Chrome: every select becomes OpenVibe's own (a menu on a
// computer, a sheet on a phone), the hidden select still holds the value a form posts, a script that sets the value
// is followed, the keyboard works, options say their state, and data-ov-native keeps the browser's own. Skipped
// without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('ov-forms-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const LONG = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Forms</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/ov-forms.css"></head><body style="font:15px system-ui;padding:16px">
<form id="f" action="/sent">
<label for="agent">Agent</label>
<select id="agent" name="agent" required style="width:100%">
  <option value="">Choose…</option>
  <option value="claude-code" data-state="ok" data-badge="Signed in" data-desc="Your own Claude login, on your machine">Claude Code</option>
  <option value="codex" data-state="warn" data-badge="91% used">Codex</option>
  <option value="opencode" disabled data-state="off" data-href="/setup/opencode" data-href-label="Set up">OpenCode</option>
</select>
<label>Many <select id="many" name="many" multiple><option>a</option><option>b</option><option>c</option></select></label>
<label>Long <select id="long" name="long"><optgroup label="Small">${LONG.slice(0, 6).map((x) => `<option>${x}</option>`).join('')}</optgroup><optgroup label="Big">${LONG.slice(6).map((x) => `<option>${x}</option>`).join('')}</optgroup></select></label>
<span data-ov-native><select id="raw" name="raw"><option>x</option></select></span>
<label><input type="checkbox" role="switch" id="sw"> A switch</label>
<button id="send">Send</button>
</form>
<script>window.__changes = 0; document.getElementById('agent').addEventListener('change', () => window.__changes++);
document.getElementById('f').addEventListener('submit', (e) => { e.preventDefault(); const d = new FormData(e.target); window.__sent = { agent: d.get('agent'), many: d.getAll('many'), long: d.get('long') }; });</script>
<script src="/ov-forms.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/ov-forms.js' || u.pathname === '/ov-forms.css') {
        res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' });
        return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1))));
    }
    res.writeHead(404); return res.end();
});

const key = (k, target = 'document.activeElement') => `(${target}).dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }))`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-forms-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        // ── A computer: the menu ──
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 1280 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await wait(250);
        const btn = "document.querySelector('#agent + .ov-sel')";
        assert.strictEqual(await p.evaluate("document.getElementById('agent').classList.contains('ov-sel-native')"), true, 'the select is enhanced');
        assert.strictEqual(await p.evaluate(`${btn}.textContent.trim()`), 'Choose…');
        assert.strictEqual(await p.evaluate("!!document.querySelector('#raw + .ov-sel')"), false, 'data-ov-native keeps the browser\'s own');
        assert.strictEqual(await p.evaluate(`${btn}.getAttribute('aria-labelledby').split(' ').some((id) => document.getElementById(id) && document.getElementById(id).tagName === 'LABEL')`), true, 'the button is named by the select\'s label');
        assert.strictEqual(await p.evaluate(`${btn}.getBoundingClientRect().width === document.getElementById('f').getBoundingClientRect().width`), true, 'a full-width select gives a full-width button');

        await p.evaluate(`${btn}.click()`);
        await wait(80);
        assert.strictEqual(await p.evaluate("!!document.querySelector('.ov-sel-pop.is-open')"), true, 'a click opens the menu');
        assert.strictEqual(await p.evaluate("document.querySelectorAll('.ov-sel-pop [role=option]').length"), 4);
        assert.strictEqual(await p.evaluate("document.querySelector('.ov-sel-pop [role=option][aria-disabled=true] a.ov-sel-link').getAttribute('href')"), '/setup/opencode', 'a choice that is not ready links to its setup');
        assert.strictEqual(await p.evaluate("document.querySelector('.ov-sel-pop .ov-sel-desc').textContent"), 'Your own Claude login, on your machine');
        assert.strictEqual(await p.evaluate("document.querySelector('.ov-sel-pop .ov-sel-badge.is-warn').textContent"), '91% used');
        await p.evaluate(key('ArrowDown'));
        await p.evaluate(key('ArrowDown'));
        await p.evaluate(key('ArrowDown'));     // past the end: OpenCode is disabled, Codex stays the last
        await p.evaluate(key('Enter'));
        await wait(60);
        assert.strictEqual(await p.evaluate("document.getElementById('agent').value"), 'codex', 'the keyboard chooses, skipping a disabled choice');
        assert.strictEqual(await p.evaluate('window.__changes'), 1, 'and the select says change, as a person\'s choice would');
        assert.strictEqual(await p.evaluate("!!document.querySelector('.ov-sel-pop')"), false, 'and the menu closes');
        assert.strictEqual(await p.evaluate(`document.activeElement === ${btn}`), true, 'with the focus back on the button');
        assert.match(await p.evaluate(`${btn}.textContent`), /Codex.*91% used/, 'the button shows the choice and its badge');

        await p.evaluate("document.getElementById('agent').value = 'claude-code'");
        assert.match(await p.evaluate(`${btn}.textContent`), /Claude Code/, 'a script that sets the value is followed');

        // A long list has a search box, and groups.
        await p.evaluate("document.querySelector('#long + .ov-sel').click()");
        await wait(80);
        assert.strictEqual(await p.evaluate("document.querySelectorAll('.ov-sel-pop .ov-sel-group').length"), 2);
        await p.evaluate("(() => { const i = document.querySelector('.ov-sel-pop .ov-sel-search input'); i.value = 'tw'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
        assert.deepStrictEqual(await p.evaluate("[...document.querySelectorAll('.ov-sel-pop .ov-sel-label')].map((x) => x.textContent)"), ['two', 'twelve'], 'typing narrows the list');
        await p.evaluate(key('Enter', "document.querySelector('.ov-sel-pop .ov-sel-search input')"));
        await wait(60);
        assert.strictEqual(await p.evaluate("document.getElementById('long').value"), 'two');

        // A multiple select keeps its menu open and counts.
        await p.evaluate("document.querySelector('#many + .ov-sel').click()");
        await wait(80);
        await p.evaluate("document.querySelectorAll('.ov-sel-pop .ov-sel-opt')[0].click()");
        await p.evaluate("document.querySelectorAll('.ov-sel-pop .ov-sel-opt')[2].click()");
        assert.strictEqual(await p.evaluate("!!document.querySelector('.ov-sel-pop')"), true, 'the menu stays open while choosing several');
        await p.evaluate(key('Escape', "document.querySelector('.ov-sel-pop')"));
        await wait(30);
        assert.strictEqual(await p.evaluate("document.querySelector('#many + .ov-sel').textContent.trim()"), 'a, c');

        // A click elsewhere closes the menu; the form posts what was chosen.
        await p.evaluate("document.querySelector('#agent + .ov-sel').click()");
        await wait(60);
        await p.evaluate("document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))");
        assert.strictEqual(await p.evaluate("!!document.querySelector('.ov-sel-pop')"), false, 'a click elsewhere closes it');
        await p.evaluate("document.getElementById('send').click()");
        assert.deepStrictEqual(await p.evaluate('window.__sent'), { agent: 'claude-code', many: ['a', 'c'], long: 'two' }, 'the form posts the hidden selects\' values');

        // A required select left empty: the button says so, not a bubble on a hidden control.
        await p.evaluate("document.getElementById('agent').value = ''");
        await p.evaluate("document.getElementById('f').requestSubmit()");
        assert.strictEqual(await p.evaluate(`${btn}.classList.contains('is-invalid')`), true, 'an empty required select marks its button');
        assert.strictEqual(await p.evaluate(`document.activeElement === ${btn}`), true, 'and takes the focus');

        // Markup added later is enhanced too.
        await p.evaluate("document.body.insertAdjacentHTML('beforeend', '<select id=\"late\"><option>x</option><option>y</option></select>')");
        await wait(200);
        assert.strictEqual(await p.evaluate("!!document.querySelector('#late + .ov-sel')"), true, 'a select added later is enhanced');
        assert.strictEqual(await p.evaluate("getComputedStyle(document.getElementById('sw')).appearance"), 'none', 'a checkbox with role=switch is a switch');
        await p.close();

        // ── A phone: the sheet ──
        const phone = await h.openPage(browser, context, { width: 390 });
        await phone.goto(`${base}/`, { maxMs: 5000 });
        await wait(250);
        await phone.evaluate("document.querySelector('#agent + .ov-sel').click()");
        await wait(320);
        assert.strictEqual(await phone.evaluate("!!document.querySelector('.ov-sel-sheet.is-open') && !!document.querySelector('.ov-sel-scrim.is-open')"), true, 'a phone gets a sheet over a scrim');
        assert.strictEqual(await phone.evaluate("document.querySelector('.ov-sel-sheet-title').textContent"), 'Agent', 'titled with the select\'s label');
        assert.strictEqual(await phone.evaluate("document.documentElement.classList.contains('ov-sel-locked')"), true, 'the page under it does not scroll');
        assert.ok(await phone.evaluate("document.querySelector('.ov-sel-sheet .ov-sel-opt').getBoundingClientRect().height") >= 44, 'rows are a finger tall');
        await phone.evaluate("document.querySelectorAll('.ov-sel-sheet .ov-sel-opt')[1].click()");
        await wait(320);
        assert.strictEqual(await phone.evaluate("document.getElementById('agent').value"), 'claude-code');
        assert.strictEqual(await phone.evaluate("!!document.querySelector('.ov-sel-sheet') || document.documentElement.classList.contains('ov-sel-locked')"), false, 'choosing closes the sheet and frees the page');
        assert.strictEqual(await phone.evaluate('document.documentElement.scrollWidth'), 390, 'nothing is wider than the phone');
        await phone.close();
        console.log('ov-forms-chrome: the menu, the sheet, the keyboard, search, several choices, the form\'s values and native opt-outs ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
