'use strict';
// ov-locker.js and ov-locker.css in a real headless Chrome, with a stand-in crypto core (the real one, generated from
// openvibe-sdk/locker, has its own vectors) and a stand-in Network: a password-locked item opens with its password
// only; a link lock opens with the key after #k= and says so when the key is missing; a people lock asks to unlock the
// locker; making a locker refuses a weak or mismatched passphrase, shows 24 words once and checks two of them; and,
// the point of all of it, the passphrase and the recovery words never leave the page, and nothing is stored.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('ov-locker-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PASS = 'correct horse battery staple';
const CORE = `window.OVLockerCore = {
  WORDS: 'acid atom bold calm cedar coral delta ember fable fern gecko glow harbor iris jade kite lumen maple nectar onyx'.split(' '),
  async generatePersonKeys() { return { id: 'p1' }; },
  async recoveryWords(n) { const w = this.WORDS; return Array.from({ length: n }, (_, i) => w[(i * 7) % w.length]); },
  async exportPersonKeys() { return { ecdh: { kty: 'EC' }, signing: { kty: 'EC' }, self_signature: 'sig', fingerprint: 'cedar ember lumen onyx fable maple gecko iris' }; },
  async exportPrivateKeys() { return { d: 'private' }; },
  async importPersonKeys() { return { id: 'p1' }; },
  async seal(b, o) { return new TextEncoder().encode('sealed-by-' + o.lock); },
  inspect(b) { return { lock: new TextDecoder().decode(b).split(':')[0] }; },
  async open(b, c) {
    const [lock, secret, body] = new TextDecoder().decode(b).split(':');
    const bad = () => { throw Object.assign(new Error('no'), { code: 'locker.wrong_key' }); };
    if (lock === 'password' && c.password !== secret) bad();
    if (lock === 'link' && !(c.key && c.key.length === 32)) bad();
    if (lock === 'people' && !c.person) bad();
    if (lock === 'backup') { if (c.password !== secret) bad(); return new TextEncoder().encode('{"d":"private"}'); }
    return new TextEncoder().encode(body || 'inside');
  },
};`;
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Locker</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/ov-locker.css"></head><body style="font:15px system-ui;padding:16px"><div id="item"></div>
<script>window.OpenVibeLockerConfig = { network: '' }; window.__opened = []; </script><script src="/ov-locker-core.js"></script><script src="/ov-locker.js"></script></body></html>`;
const sent = [];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
        if (u.pathname === '/ov-locker-core.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(CORE); }
        if (u.pathname === '/ov-locker.js' || u.pathname === '/ov-locker.css') {
            res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8' });
            return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1))));
        }
        sent.push(`${req.method} ${u.pathname}${u.search} ${body}`);
        if (u.pathname === '/api/v1/me/keys' && req.method === 'PUT') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}'); }
        if (u.pathname === '/api/v1/me/keys/backup') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ passphrase: { envelope: Buffer.from(`backup:${PASS}`).toString('base64') }, recovery: { envelope: Buffer.from('backup:x').toString('base64') } }));
        }
        res.writeHead(404); return res.end();
    });
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-locker-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const q = (k) => `document.querySelector('[data-k="${k}"]')`;
    const type = (k, v) => `(() => { const i = ${q(k)}; i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`;
    const submit = (k) => `${q(k)}.click()`;
    const openItem = (text, extra = '') => `(() => { OVLocker.open(document.getElementById('item'), { bytes: new TextEncoder().encode(${JSON.stringify(text)}), title: 'notes', onOpen: (b) => window.__opened.push(new TextDecoder().decode(b)) ${extra} }); })()`;
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 1280 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await wait(150);

        // A password lock: only its password opens it; the card says so plainly.
        await p.evaluate(openItem('password:hunter22:the notes'));
        await wait(150);
        assert.match(await p.evaluate("document.querySelector('.ovl-cardtitle').textContent"), /is locked/);
        await p.evaluate(type('item-pass', 'wrong')); await p.evaluate(submit('item-open')); await wait(120);
        assert.match(await p.evaluate("document.querySelector('.ovl-card .ovl-msg').textContent"), /does not open it/);
        assert.deepStrictEqual(await p.evaluate('window.__opened'), []);
        await p.evaluate(type('item-pass', 'hunter22')); await p.evaluate(submit('item-open')); await wait(120);
        assert.deepStrictEqual(await p.evaluate('window.__opened'), ['the notes'], 'the right password opens it');

        // A link lock without its key, then with it.
        await p.evaluate(openItem('link::linked'));
        await wait(120);
        assert.match(await p.evaluate("document.querySelector('.ovl-cardtitle').textContent"), /missing its key/);
        const key = 'A'.repeat(43);
        await p.evaluate(openItem('link::linked', `, link: 'https://x.test/p/1#k=${key}'`));
        await wait(120);
        assert.deepStrictEqual(await p.evaluate('window.__opened'), ['the notes', 'linked'], 'the key after #k= opens it by itself');
        assert.strictEqual(await p.evaluate("OVLocker.keyFromLink('https://x.test/#k=short')"), null, 'a key that is not 32 bytes is no key');

        // A people lock: unlock the locker (wrong passphrase first), then it opens.
        await p.evaluate(openItem('people::for you'));
        await wait(120);
        await p.evaluate(submit('item-unlock')); await wait(300);
        await p.evaluate(type('pass', 'nope')); await p.evaluate(submit('unlock')); await wait(150);
        assert.match(await p.evaluate("document.querySelector('dialog .ovl-msg').textContent"), /does not open your locker/);
        await p.evaluate(type('pass', PASS)); await p.evaluate(submit('unlock')); await wait(400);
        assert.strictEqual(await p.evaluate('OVLocker.state().unlocked'), true);
        assert.deepStrictEqual(await p.evaluate('window.__opened'), ['the notes', 'linked', 'for you'], 'unlocked, it opens');
        await p.evaluate('OVLocker.forget()');
        assert.strictEqual(await p.evaluate('OVLocker.state().unlocked'), false, 'forget() drops the keys');

        // Making a locker: weak, then mismatched, then good; 24 words; two checked; saved locked.
        await p.evaluate('(() => { OVLocker.setup(); })()');
        await wait(300);
        await p.evaluate(type('pass', 'short')); await p.evaluate(type('pass2', 'short')); await p.evaluate(submit('next')); await wait(80);
        assert.match(await p.evaluate("document.querySelector('dialog .ovl-msg').textContent"), /longer/, 'a weak passphrase is refused');
        await p.evaluate(type('pass', 'violet lantern river cobalt')); await p.evaluate(type('pass2', 'violet lantern river cobalT')); await p.evaluate(submit('next')); await wait(80);
        assert.match(await p.evaluate("document.querySelector('dialog .ovl-msg').textContent"), /do not match/);
        await p.evaluate(type('pass2', 'violet lantern river cobalt')); await p.evaluate(submit('next')); await wait(300);
        const words = await p.evaluate("[...document.querySelectorAll('.ovl-words li')].map((li) => li.textContent)");
        assert.strictEqual(words.length, 24, 'the kit is 24 words');
        const labels = await p.evaluate("[...document.querySelectorAll('dialog .ovl-pair .ovl-label')].map((l) => Number(l.textContent.replace(/\\D/g, '')))");
        await p.evaluate(type('w1', 'wrong')); await p.evaluate(type('w2', 'words')); await p.evaluate(submit('make')); await wait(100);
        assert.match(await p.evaluate("document.querySelector('dialog .ovl-msg').textContent"), /not the words/);
        assert.ok(!sent.some((s) => s.startsWith('PUT')), 'nothing is saved before the kit is checked');
        await p.evaluate(type('w1', words[labels[0] - 1])); await p.evaluate(type('w2', words[labels[1] - 1])); await p.evaluate(submit('make')); await wait(400);
        assert.strictEqual(await p.evaluate(`${q('fingerprint')}.textContent`), 'cedar ember lumen onyx fable maple gecko iris', 'the fingerprint, eight words');
        const put = sent.find((s) => s.startsWith('PUT /api/v1/me/keys'));
        assert.ok(put, 'the locked copies are saved');
        assert.ok(!put.includes('violet') && !put.includes('lantern'), 'the passphrase never leaves the page');
        assert.ok(!words.filter((w) => put.includes(` ${w} `) || put.includes(`"${w}`)).length && !put.includes(words.join(' ')), 'nor do the recovery words');
        assert.ok(!put.includes('"d":"private"') && !put.includes('private'), 'nor the private keys in the clear');
        assert.match(put, /"backups":\{"passphrase":\{"format":"locker.envelope.v1"/, 'what is saved is two Locker envelopes');
        assert.strictEqual(await p.evaluate('localStorage.length + sessionStorage.length'), 0, 'nothing is stored in the browser');

        // A phone: the kit fits, no sideways scroll.
        const phone = await h.openPage(browser, context, { width: 390 });
        await phone.goto(`${base}/`, { maxMs: 5000 });
        await phone.evaluate('(() => { OVLocker.setup(); })()');
        await wait(300);
        await phone.evaluate(type('pass', 'violet lantern river cobalt')); await phone.evaluate(type('pass2', 'violet lantern river cobalt')); await phone.evaluate(submit('next')); await wait(300);
        assert.strictEqual(await phone.evaluate('document.documentElement.scrollWidth'), 390);
        assert.ok(await phone.evaluate("(() => { const d = document.querySelector('dialog').getBoundingClientRect(); return [...document.querySelectorAll('dialog input')].every((i) => i.getBoundingClientRect().right <= d.right + 0.5); })()"), 'every field fits inside the sheet');
        await phone.close();
        console.log('ov-locker-chrome: password, link and people locks; making and unlocking a locker; nothing secret leaves the page or is stored; the phone ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
