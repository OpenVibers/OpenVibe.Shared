'use strict';
// The Share sheet's Locked part, end to end in a real headless Chrome with the REAL crypto (ov-locker-core.js from
// openvibe-sdk/locker) and a stand-in service + Network key directory:
//   ov-locker.js is not loaded until the Locked part is pressed;
//   a people-locked paste names its lock and its people's fingerprints in plain words;
//   adding @quinn wraps the content key for quinn on this device, and the envelope that goes up opens for quinn;
//   removing @maticus seals the content again under a fresh key: the new bytes open for quinn, not for maticus;
//   a link-locked paste's link keeps the key after #k=, and says so when the key is missing.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('ov-share-lock-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const locker = require('openvibe-sdk/locker');
const PASS = 'violet lantern river cobalt';
const OWN = { type: 'user', id: 'usr_own' };
const MAT = { type: 'user', id: 'usr_mat' };
const QUI = { type: 'user', id: 'usr_q' };
const PEOPLE = {
    maticus: { subject: MAT, username: 'maticus', display_name: 'Maticus' },
    quinn: { subject: QUI, username: 'quinn', display_name: 'Quinn' },
};
const keys = {};          // subject id → what Network publishes: { subject, ecdh_public, fingerprint }
const items = {};         // path → envelope bytes
let lockerPut = null;     // the browser's PUT /api/v1/me/keys
const puts = [];          // every share save body
const transfers = [];     // every POST .../share/transfer body
let share = null;         // the share GET body

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Locked</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/ov-share.css"></head><body style="font:15px system-ui;padding:16px">
<button type="button" id="sh" data-ov-share-sheet data-kind="paste" data-id="locked" data-title="Locked note">Share</button>
<div id="item"></div>
<script>window.OpenVibeLockerConfig = { network: '' };</script><script src="/ov-share.js"></script></body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
        const file = { '/ov-share.js': 'text/javascript', '/ov-share.css': 'text/css', '/ov-locker.js': 'text/javascript', '/ov-locker.css': 'text/css', '/ov-locker-core.js': 'text/javascript' }[u.pathname];
        if (file) { res.writeHead(200, { 'content-type': `${file}; charset=utf-8` }); return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1)))); }
        if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
        if (u.pathname === '/api/v1/me/keys' && req.method === 'PUT') { lockerPut = JSON.parse(body); return json(200, { ok: true }); }
        if (u.pathname.startsWith('/p/') && u.pathname.endsWith('/raw') && items[u.pathname]) {
            res.writeHead(200, { 'content-type': 'application/octet-stream' }); return res.end(Buffer.from(items[u.pathname]));
        }
        const who = u.pathname.match(/^\/api\/v1\/people\/([^/]+)\/keys$/);
        if (who) {
            const found = keys[decodeURIComponent(who[1])];
            return found ? json(200, found) : json(404, { code: 'locker.no_keys', error: 'no keys' });
        }
        if (u.pathname === '/api/v1/share/people') {
            const n = String(u.searchParams.get('name') || '').toLowerCase();
            return json(200, { person: PEOPLE[n] || null });
        }
        if (u.pathname === '/api/v1/paste/locked/share' && req.method === 'GET') {
            res.writeHead(200, { 'content-type': 'application/json', etag: '"4"' }); return res.end(JSON.stringify(share));
        }
        if (u.pathname === '/api/v1/paste/locked/share/transfer' && req.method === 'POST') {
            const b = JSON.parse(body);
            transfers.push(b);
            share = { ...share, transfer: { id: '00000000-0000-4000-8000-0000000000aa', to: b.to, keep_access: b.keep_access, expires_at: '2026-11-13T10:00:00Z', state: 'pending' } };
            res.writeHead(201, { 'content-type': 'application/json' }); return res.end(JSON.stringify(share));
        }
        if (u.pathname === '/api/v1/paste/locked/share' && req.method === 'PUT') {
            const b = JSON.parse(body);
            puts.push(b);
            // What the store does: the member rows as they were sent, with what the key directory has for them.
            share = {
                ...share,
                audience: b.audience,
                members: (b.members || []).map((m) => {
                    const id = m.subject && m.subject.id;
                    const known = Object.values(PEOPLE).find((p) => p.subject.id === id);
                    return { ...(known || { subject: m.subject, username: m.subject ? null : String(m.name) }), role: m.role, key_slot: m.key_slot };
                }),
            };
            return json(200, share);
        }
        res.writeHead(404); res.end();
    });
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const mat = await locker.generatePersonKeys();
    const matPub = await locker.exportPersonKeys(mat);
    const qui = await locker.generatePersonKeys();
    const quiPub = await locker.exportPersonKeys(qui);
    keys[MAT.id] = { subject: MAT, ecdh_public: matPub.ecdh, signing_public: matPub.signing, fingerprint: matPub.fingerprint };
    keys[QUI.id] = { subject: QUI, ecdh_public: quiPub.ecdh, signing_public: quiPub.signing, fingerprint: quiPub.fingerprint };

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-share-lock-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const q = (k) => `document.querySelector('[data-k="${k}"]')`;
    const type = (k, v) => `(() => { const i = ${q(k)}; i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`;
    const press = (k) => `${q(k)}.click()`;
    const text = (sel) => `(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`;
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 1280 });
        await page.goto(`${base}/`, { maxMs: 5000 });

        // The owner's locker, with the real crypto (two PBKDF2 seals). The sheet has already loaded ov-locker.js in
        // that tab; here it is loaded the way a page that unlocks a locker does.
        await page.evaluate(`(() => { const s = document.createElement('script'); s.src = '/ov-locker.js'; document.head.appendChild(s); })()`);
        await wait(600);
        await page.evaluate('(() => { OVLocker.setup(); })()'); await wait(300);
        await page.evaluate(type('pass', PASS)); await page.evaluate(type('pass2', PASS)); await page.evaluate(press('next'));
        await wait(1500);
        const words = await page.evaluate("[...document.querySelectorAll('.ovl-words li')].map((li) => li.textContent)");
        const labels = await page.evaluate("[...document.querySelectorAll('dialog .ovl-pair .ovl-label')].map((l) => Number(l.textContent.replace(/\\D/g, '')))");
        await page.evaluate(type('w1', words[labels[0] - 1])); await page.evaluate(type('w2', words[labels[1] - 1])); await page.evaluate(press('make'));
        await wait(9000);
        await page.evaluate(press('done'));   // the locker's own Done: the setup sheet closes
        await wait(300);
        assert.ok(lockerPut && lockerPut.ecdh_public, 'the owner has a locker');
        keys[OWN.id] = { subject: OWN, ecdh_public: lockerPut.ecdh_public, signing_public: lockerPut.signing_public, fingerprint: lockerPut.fingerprint };

        // The paste as it was made: a people lock for the owner and maticus, sealed before it was uploaded.
        const plain = JSON.stringify({ v: 1, type: 'paste', title: 'Locked note', content: 'the secret words', language: 'text' });
        const sealed = await locker.seal(plain, { lock: 'people', keys: [{ subject: OWN, publicKey: keys[OWN.id].ecdh_public }, { subject: MAT, publicKey: matPub.ecdh }] });
        items['/p/locked/raw'] = sealed.bytes;
        share = {
            audience: 'people', audiences: ['people', 'private'], roles: ['viewer'], title: 'Locked note', link: `${base}/p/locked`,
            lock: 'people', envelope_url: '/p/locked/raw',
            you: { subject: OWN, role: 'owner' }, owner: { subject: OWN, username: 'owner', display_name: 'Owner' },
            members: [{
                ...PEOPLE.maticus, role: 'viewer', added_at: '2026-11-06T10:00:00Z', added_by: OWN,
                key_slot: sealed.header.slots.people.find((s) => s.subject.id === MAT.id),
                key_fingerprint: matPub.fingerprint, fingerprint_changed: false,
            }],
            requests: [], transfer: null,
        };

        // The sheet itself loads no Locker: a fresh tab proves it, and that the first press of the part does.
        const fresh = await h.openPage(browser, await browser.newContext(), { width: 390 });
        await fresh.goto(`${base}/`, { maxMs: 5000 });
        assert.strictEqual(await fresh.evaluate('!!window.OVLocker'), false, 'ov-share.js alone loads no Locker');
        await fresh.evaluate("document.getElementById('sh').click()");
        await wait(400);
        assert.match(await fresh.evaluate(text('.ov-share-lock')), /Locked/, 'a fresh tab sees the item is locked');
        await fresh.evaluate(press('lock-open'));
        await wait(600);
        assert.ok(await fresh.evaluate('!!window.OVLocker'), 'pressing Locked loads ov-locker.js');
        await fresh.evaluate(press('close'));

        // 1. The Locked part says what the lock means, in plain words, and whose keys it is wrapped for.
        await page.evaluate("document.getElementById('sh').click()");
        await wait(400);
        assert.match(await page.evaluate(text('.ov-share-lock')), /Locked/, 'the sheet says the item is locked');
        assert.match(await page.evaluate(text('.ov-share-lockshort')), /can’t read what’s inside/, 'and says it in plain words');
        await page.evaluate(press('lock-open'));
        await wait(500);
        assert.match(await page.evaluate(text('.ov-share-lockmeans')), /Only you and the people below can open it/, 'what a people lock means');
        assert.ok((await page.evaluate(text('.ov-share-fp'))).includes(matPub.fingerprint.split(' · ')[0]), 'the member’s fingerprint is shown');

        // 2. Add @quinn: their public key is wrapped for them here.
        await page.evaluate(type('add', 'quinn'));
        await page.evaluate(press('add-btn'));
        await wait(600);
        assert.match(await page.evaluate(text('.ov-share-list')), /Quinn/, 'quinn is on the list');
        await page.evaluate(press('done'));
        await wait(2500);   // the re-wrap
        assert.strictEqual(puts.length, 1, 'one save');
        const addPut = puts[0];
        assert.ok(addPut.envelope, 'the save carries the envelope sealed again');
        const quinnRow = addPut.members.find((m) => m.subject && m.subject.id === QUI.id);
        assert.ok(quinnRow && quinnRow.key_slot, 'quinn’s member row carries their key slot');
        assert.strictEqual(quinnRow.key_slot.recipient_key, await locker.jwkThumbprint(quiPub.ecdh), 'the slot names quinn’s key');
        const afterAdd = Buffer.from(addPut.envelope, 'base64');
        assert.deepStrictEqual([...new Uint8Array(await locker.open(afterAdd, { privateKey: qui.ecdh.privateKey, subject: QUI }))], [...Buffer.from(plain)], 'the envelope that went up opens for quinn');
        assert.deepStrictEqual([...new Uint8Array(await locker.open(afterAdd, { privateKey: mat.ecdh.privateKey, subject: MAT }))], [...Buffer.from(plain)], 'and for maticus, whose slot stayed');

        // 3. Remove @maticus: fresh key, and the bytes that went up do not open for them.
        items['/p/locked/raw'] = afterAdd;
        await page.evaluate("document.getElementById('sh').click()");
        await wait(400);
        await page.evaluate(press('rm-user:usr_mat'));
        await wait(200);
        assert.match(await page.evaluate(text('.ov-share-note')), /They had the key before you removed them/, 'removal says they keep what they opened');
        await page.evaluate(press('done'));
        await wait(3000);
        assert.strictEqual(puts.length, 2, 'the removal saved');
        const removePut = puts[1];
        assert.ok(removePut.envelope, 'the removal carries a re-sealed envelope');
        const afterRemove = Buffer.from(removePut.envelope, 'base64');
        assert.deepStrictEqual([...new Uint8Array(await locker.open(afterRemove, { privateKey: qui.ecdh.privateKey, subject: QUI }))], [...Buffer.from(plain)], 'quinn still opens it');
        await assert.rejects(async () => await locker.open(afterRemove, { privateKey: mat.ecdh.privateKey, subject: MAT }), 'maticus cannot open the new envelope');
        assert.ok(!removePut.members.some((m) => m.subject && m.subject.id === MAT.id), 'maticus is not a member');

        // 4. Transfer to maticus: the offer carries the slot they need, and the envelope that goes up opens for them.
        await page.evaluate("document.getElementById('sh').click()");
        await wait(400);
        await page.evaluate(press('give'));
        await wait(200);
        await page.evaluate(type('give-name', 'maticus'));
        await page.evaluate(press('give-send'));
        await wait(3000);
        assert.strictEqual(transfers.length, 1, 'the offer was sent');
        assert.ok(transfers[0].key_slot, 'the offer carries a key slot for the new owner');
        assert.strictEqual(transfers[0].key_slot.recipient_key, await locker.jwkThumbprint(matPub.ecdh), 'the slot names their key');
        const forTransfer = Buffer.from(puts[puts.length - 1].envelope, 'base64');
        assert.deepStrictEqual([...new Uint8Array(await locker.open(forTransfer, { privateKey: mat.ecdh.privateKey, subject: MAT }))], [...Buffer.from(plain)], 'they can open it before accepting');

        // 5. A link lock: the key after # is part of the link the sheet copies, and a link without it says so.
        const linkSealed = await locker.seal(plain, { lock: 'link' });
        const linkPage = await h.openPage(browser, await browser.newContext(), { width: 390 });
        await linkPage.goto(`${base}/#k=${linkSealed.linkKey}`, { maxMs: 5000 });
        share = { ...share, lock: 'link', members: [], audiences: ['link', 'private'] };
        items['/p/locked/raw'] = linkSealed.bytes;
        await linkPage.evaluate(`(() => { OVShare.open({ kind: 'paste', id: 'locked', title: 'Locked note' }); })()`);
        await wait(500);
        assert.match(await linkPage.evaluate(`${q('link')}.value`), /#k=[A-Za-z0-9_-]{43}/, 'the copied link keeps the key after #');
        await linkPage.evaluate(press('lock-open'));
        await wait(400);
        await linkPage.evaluate('history.replaceState(null, "", location.pathname)');
        await linkPage.evaluate(press('lock-open'));
        await linkPage.evaluate(press('lock-open'));
        await wait(500);
        assert.match(await linkPage.evaluate(text('.ov-share-lock')), /missing its key/i, 'a link with no key says so');

        console.log('ov-share-lock-chrome: the Locked part with real crypto: lazy load, fingerprints, add wraps for them, removal re-seals, the link lock keeps its key');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
