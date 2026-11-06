'use strict';
// Locker end to end in a real headless Chrome with the REAL crypto (ov-locker-core.js, generated from
// openvibe-sdk/locker) and a stand-in Network that only stores what it is given:
//   make a locker (passphrase + recovery kit) → the page sends public keys and two locked backups;
//   a second, empty tab (a new device) unlocks with the passphrase from the stored backup;
//   an item locked in Node for that person's public key opens in the browser; a stranger's locker cannot open it;
//   a password-locked item opens with its password only; the recovery words open the locker too.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('ov-locker-e2e-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const locker = require('openvibe-sdk/locker');
const PASS = 'violet lantern river cobalt';
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Locker</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/ov-locker.css"></head><body style="font:15px system-ui;padding:16px"><div id="item"></div>
<script>window.OpenVibeLockerConfig = { network: '' }; window.__opened = [];</script><script src="/ov-locker-core.js"></script><script src="/ov-locker.js"></script></body></html>`;
let stored = null;       // what Network keeps: the PUT body
const items = {};        // locked items served as bytes
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
        if (['/ov-locker.js', '/ov-locker.css', '/ov-locker-core.js'].includes(u.pathname)) {
            res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8' });
            return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1))));
        }
        if (u.pathname === '/api/v1/me/keys' && req.method === 'PUT') { stored = JSON.parse(body); res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}'); }
        if (u.pathname === '/api/v1/me/keys/backup') {
            if (!stored) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"no keys"}'); }
            res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ subject: 'usr_x', ...stored.backups }));
        }
        if (u.pathname.startsWith('/item/') && items[u.pathname.slice(6)]) { res.writeHead(200, { 'content-type': 'application/octet-stream' }); return res.end(Buffer.from(items[u.pathname.slice(6)])); }
        res.writeHead(404); return res.end();
    });
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-locker-e2e-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const q = (k) => `document.querySelector('[data-k="${k}"]')`;
    const type = (k, v) => `(() => { const i = ${q(k)}; i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`;
    const press = (k) => `${q(k)}.click()`;
    try {
        const context = await browser.newContext();
        // Device one: make the locker with the real crypto.
        const a = await h.openPage(browser, context, { width: 1280 });
        await a.goto(`${base}/`, { maxMs: 5000 });
        await a.evaluate('(() => { OVLocker.setup(); })()'); await wait(300);
        await a.evaluate(type('pass', PASS)); await a.evaluate(type('pass2', PASS)); await a.evaluate(press('next'));
        await wait(1500);   // real key generation
        const words = await a.evaluate("[...document.querySelectorAll('.ovl-words li')].map((li) => li.textContent)");
        assert.strictEqual(words.length, 24, 'a real recovery kit of 24 words');
        assert.ok(locker.isRecoveryPhrase(words.join(' ')), 'every word is from the list');
        const labels = await a.evaluate("[...document.querySelectorAll('dialog .ovl-pair .ovl-label')].map((l) => Number(l.textContent.replace(/\\D/g, '')))");
        await a.evaluate(type('w1', words[labels[0] - 1])); await a.evaluate(type('w2', words[labels[1] - 1])); await a.evaluate(press('make'));
        await wait(9000);   // two PBKDF2 seals at 600 000 iterations
        assert.ok(stored, 'the locker was saved');
        const fp = await a.evaluate(`${q('fingerprint')}.textContent`);
        assert.strictEqual(fp, await locker.fingerprintOf(stored.ecdh_public, stored.signing_public), 'the fingerprint shown is the keys’ own');
        assert.ok(await locker.verifyPersonKeys({ ecdh: stored.ecdh_public, signing: stored.signing_public, fingerprint_signature: stored.self_signature, fingerprint: fp }), 'the self-signature verifies');
        const body = JSON.stringify(stored);
        assert.ok(!body.includes(PASS) && !body.includes(words.join(' ')), 'neither the passphrase nor the recovery words were sent');
        ['passphrase', 'recovery'].forEach((k) => assert.strictEqual(locker.inspect(Buffer.from(stored.backups[k].envelope, 'base64')).lock, 'password', `the ${k} backup is a password-locked envelope`));

        // An item locked in Node for that person, and one for a stranger.
        const mine = await locker.seal(Buffer.from('for you only'), { lock: 'people', keys: [{ subject: { type: 'user', id: 'usr_x' }, publicKey: stored.ecdh_public }] });
        items.mine = mine.bytes;
        const stranger = await locker.generatePersonKeys();
        const strangerPub = await locker.exportPersonKeys(stranger);
        items.theirs = (await locker.seal(Buffer.from('not yours'), { lock: 'people', keys: [{ subject: { type: 'user', id: 'usr_y' }, publicKey: strangerPub.ecdh }] })).bytes;
        items.pw = (await locker.seal(Buffer.from('with a password'), { lock: 'password', password: 'hunter22 hunter22' })).bytes;

        // Device two: an empty tab unlocks from the backup with the passphrase, then opens the item.
        const b = await h.openPage(browser, await browser.newContext(), { width: 390 });
        await b.goto(`${base}/`, { maxMs: 5000 });
        await b.evaluate(`(() => { OVLocker.open(document.getElementById('item'), { url: '/item/mine', onOpen: (x) => window.__opened.push(new TextDecoder().decode(x)) }); })()`);
        await wait(300);
        await b.evaluate(press('item-unlock')); await wait(300);
        await b.evaluate(type('pass', PASS)); await b.evaluate(press('unlock'));
        await wait(5000);
        if (process.env.LOCKER_E2E_DEBUG) console.log('DEBUG', await b.evaluate("JSON.stringify({ card: (document.querySelector('.ovl-card') || {}).textContent, msg: (document.querySelector('dialog .ovl-msg') || {}).textContent, state: OVLocker.state() })"));
        assert.deepStrictEqual(await b.evaluate('window.__opened'), ['for you only'], 'a new device unlocks with the passphrase and opens what was locked for this person');
        await b.evaluate(`(() => { OVLocker.open(document.getElementById('item'), { url: '/item/theirs' }); })()`);
        await wait(800);
        assert.match(await b.evaluate("document.querySelector('.ovl-cardtitle').textContent"), /not locked for you/, 'someone else’s item says so');
        await b.evaluate(`(() => { OVLocker.open(document.getElementById('item'), { url: '/item/pw', onOpen: (x) => window.__opened.push(new TextDecoder().decode(x)) }); })()`);
        await wait(300);
        await b.evaluate(type('item-pass', 'wrong one')); await b.evaluate(press('item-open')); await wait(3500);
        assert.match(await b.evaluate("document.querySelector('.ovl-card .ovl-msg').textContent"), /does not open it/);
        await b.evaluate(type('item-pass', 'hunter22 hunter22')); await b.evaluate(press('item-open')); await wait(3500);
        assert.deepStrictEqual(await b.evaluate('window.__opened'), ['for you only', 'with a password'], 'the password item opens with its password');

        // Device three: the recovery words open the locker too.
        const c = await h.openPage(browser, await browser.newContext(), { width: 1280 });
        await c.goto(`${base}/`, { maxMs: 5000 });
        await c.evaluate('(() => { OVLocker.unlock(); })()'); await wait(300);
        await c.evaluate(press('other')); await wait(80);
        await c.evaluate(type('words', words.join('  ').toUpperCase())); await c.evaluate(press('unlock'));
        await wait(5000);
        assert.strictEqual(await c.evaluate('OVLocker.state().fingerprint'), fp, 'the recovery words open the same locker');
        console.log('ov-locker-e2e-chrome: real crypto: make a locker, unlock it on a new device by passphrase and by recovery words, open what was locked for you, refuse what was not');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
