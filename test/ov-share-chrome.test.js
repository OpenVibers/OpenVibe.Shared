'use strict';
// ov-share.js and ov-share.css (4.114.0, plan track Q) in a real headless Chrome, against a stand-in for
// openvibe-sdk/share's router: the sheet loads who can open a thing, adds people by @name only once the service knows
// the name, says plainly when it does not, switches "Only me" to "Specific people" when someone is added, saves what
// changed (and only on Save), warns before leaving unsaved changes, sends a transfer offer bound to a person's subject,
// and the recipient's banner and the not-on-the-list gate call the right routes. Names and titles are text, never
// markup. A phone gets a sheet no wider than the phone. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('ov-share-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PEOPLE = {
    goosely: { subject: { type: 'user', id: 'usr_g' }, username: 'goosely', display_name: 'Goosely' },
    maticus: { subject: { type: 'user', id: 'usr_m' }, username: 'maticus', display_name: 'Maticus' },
    quinn: { subject: { type: 'user', id: 'usr_q' }, username: 'Quinn', display_name: '<img src=x onerror=window.__xss=1>' },
};
const fresh = () => ({
    audience: 'private', audiences: ['public', 'link', 'people', 'private'], roles: ['viewer', 'editor'],
    title: '<b>notes</b>', link: 'https://community.test/p/abc',
    you: { subject: { type: 'user', id: 'usr_g' }, role: 'owner' }, owner: PEOPLE.goosely, members: [],
    requests: [{ id: 'r1', ...PEOPLE.maticus, requested_at: '2026-11-05T10:00:00Z' }], transfer: null,
});
let S = fresh();
const calls = [];
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Share</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/ov-share.css"></head><body style="font:15px system-ui;padding:16px">
<button type="button" id="sh" data-ov-share-sheet data-kind="paste" data-id="abc" data-title="notes">Share</button>
<button type="button" id="send" data-ov-share-sheet data-title="A robot & a wave" data-url="https://video.test/v/1" data-time="83" data-embed="https://video.test/embed/1">Send</button>
<button type="button" id="theirs" data-ov-share-sheet data-kind="paste" data-id="theirs" data-title="theirs">Theirs</button>
<div id="offer"></div><div id="gate"></div>
<div id="gate2" data-ov-share-gate data-kind="paste" data-id="abc" data-sign-in-url="/login?next=%2Fp%2F&quot;&lt;/script&gt;">Shared with specific people.</div>
<script>window.__changes = 0; window.__sent = []; document.addEventListener('ov-share:change', () => { window.__changes++; }); document.addEventListener('ov-share:sent', (e) => { window.__sent.push(e.detail.target + ' ' + e.detail.url); });</script>
<script src="/ov-share.js"></script></body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
        if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
        if (u.pathname === '/ov-share.js' || u.pathname === '/ov-share.css') {
            res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8' });
            return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1))));
        }
        calls.push(`${req.method} ${u.pathname}${u.search}`);
        if (u.pathname === '/api/v1/share/people') {
            const n = (u.searchParams.get('name') || '').toLowerCase();
            if (n === 'slow') return json(429, { error: 'rate_limited' });
            return json(200, { person: PEOPLE[n] || null });
        }
        const p = '/api/v1/paste/abc/share';
        const find = (sub) => Object.values(PEOPLE).find((x) => sub && x.subject.id === sub.id);
        if (u.pathname === p && req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json', etag: '"7"' }); return res.end(JSON.stringify(S)); }
        if (u.pathname === p && req.method === 'PUT') {
            const b = JSON.parse(body);
            S.lastPut = b; S.lastIfMatch = req.headers['if-match'];
            S.audience = b.audience;
            S.members = b.members.map((m) => ({ ...find(m.subject), role: m.role, expires_at: m.expires_at }));
            S.requests = S.requests.filter((r) => !S.members.some((m) => m.subject.id === r.subject.id));
            return json(200, S);
        }
        if (u.pathname === `${p}/transfer`) {
            const b = JSON.parse(body);
            S.lastTransfer = b;
            S.transfer = { id: '00000000-0000-4000-8000-0000000000aa', to: find(b.to.subject), keep_access: b.keep_access, expires_at: '2026-11-13T12:00:00Z', state: 'pending' };
            return json(200, S);
        }
        if (u.pathname === `${p}/transfer/cancel`) { S.lastCancel = JSON.parse(body); S.transfer = null; return json(200, S); }
        if (u.pathname === `${p}/transfer/accept`) { S.lastAccept = JSON.parse(body); return json(200, { ...S, you: { subject: PEOPLE.maticus.subject, role: 'owner' } }); }
        if (u.pathname === '/api/v1/paste/theirs/share') return json(404, { code: 'share.not_found', error: 'Not found' });
        if (u.pathname === `${p}/requests`) return json(201, { ok: true });
        res.writeHead(404); return res.end();
    });
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-share-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const q = (k) => `document.querySelector('dialog.ov-share [data-k="${k}"]')`;
    const typeIn = (k, v) => `(() => { const i = ${q(k)}; i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`;
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 1280 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await wait(150);

        await p.evaluate("document.getElementById('sh').click()");
        await wait(300);
        assert.strictEqual(await p.evaluate("document.querySelector('dialog.ov-share').open"), true, 'a [data-ov-share-sheet] button opens the sheet as a modal dialog');
        assert.strictEqual(await p.evaluate("document.getElementById('ov-share-title').textContent"), 'Share “<b>notes</b>”', 'the title is text, never markup');
        // A site's own h2 rule (Wiki: h2 { border-bottom; padding-bottom; margin }) never reaches the sheet's title.
        await p.evaluate("(() => { const st = document.createElement('style'); st.textContent = 'h2 { border-bottom: 3px solid red; padding-bottom: 9px; text-transform: uppercase; }'; document.head.appendChild(st); })()");
        assert.strictEqual(await p.evaluate("getComputedStyle(document.getElementById('ov-share-title')).borderBottomWidth"), '0px', 'a page h2 border does not reach the sheet title');
        assert.strictEqual(await p.evaluate("getComputedStyle(document.getElementById('ov-share-title')).paddingBottom"), '0px', 'nor its padding');
        assert.strictEqual(await p.evaluate("getComputedStyle(document.getElementById('ov-share-title')).textTransform"), 'none', 'nor its text-transform');
        assert.strictEqual(await p.evaluate(`${q('aud-private')}.checked`), true, 'the service\'s audience is chosen');
        assert.strictEqual(await p.evaluate("document.querySelector('dialog.ov-share [data-k=\"done\"]').textContent"), 'Done', 'nothing changed: Done, not Save');

        // A name nobody has: said plainly, nothing added, nothing saved.
        await p.evaluate(typeIn('add', '@nobody'));
        await p.evaluate(`${q('add-btn')}.click()`);
        await wait(150);
        assert.match(await p.evaluate("document.getElementById('ov-share-add-msg').textContent"), /No OpenVibe account is called @nobody/);
        assert.strictEqual(await p.evaluate("document.querySelector('dialog.ov-share .ov-share-list').children.length"), 1, 'only the owner');
        // A name that is not a name is refused before anyone is asked.
        await p.evaluate(typeIn('add', 'a b!'));
        await p.evaluate(`${q('add-btn')}.click()`);
        await wait(80);
        assert.ok(!calls.some((c) => /name=b/.test(c)), 'an invalid name is never sent');
        // Too many checks: the service's 429 is shown, not swallowed.
        await p.evaluate(typeIn('add', 'slow'));
        await p.evaluate(`${q('add-btn')}.click()`);
        await wait(150);
        assert.match(await p.evaluate("document.getElementById('ov-share-add-msg').textContent"), /Too many name checks/);

        // A real name: added, Only me becomes Specific people, the display name stays text.
        await p.evaluate(typeIn('add', '@Quinn'));
        await p.evaluate(`${q('add-btn')}.click()`);
        await wait(150);
        assert.strictEqual(await p.evaluate(`${q('aud-people')}.checked`), true, 'adding someone to Only me switches to Specific people');
        assert.strictEqual(await p.evaluate('window.__xss'), undefined, 'a display name is never markup');
        assert.strictEqual(await p.evaluate("[...document.querySelectorAll('dialog.ov-share .ov-share-display')].map((n) => n.textContent)[1]"), PEOPLE.quinn.display_name);
        assert.strictEqual(await p.evaluate(`${q('done')}.textContent`), 'Save', 'a change asks to be saved');
        assert.ok(!calls.some((c) => c.startsWith('PUT')), 'nothing is saved before Save');

        // Leaving with unsaved changes asks first; Keep editing keeps them.
        await p.evaluate(`${q('close')}.click()`);
        await wait(80);
        assert.strictEqual(await p.evaluate("document.querySelector('dialog.ov-share').open"), true, 'unsaved changes keep the sheet open');
        assert.ok(await p.evaluate(`!!${q('discard')}`), 'and ask: Discard or Keep editing');
        await p.evaluate(`${q('keep-editing')}.click()`);
        await wait(50);

        // The person who asked can be added from the request.
        await p.evaluate(`${q('req-add-user:usr_m')}.click()`);
        await wait(50);
        await p.evaluate(`${q('done')}.click()`);
        await wait(200);
        assert.deepStrictEqual(S.lastPut, { audience: 'people', members: [{ role: 'viewer', subject: PEOPLE.quinn.subject }, { role: 'viewer', subject: PEOPLE.maticus.subject }], notify: true },
            'Save sends the audience and the members by subject (never by display name), with no end date when there is none');
        assert.strictEqual(S.lastIfMatch, '"7"', 'and only over the version it was shown (If-Match)');
        assert.strictEqual(await p.evaluate('window.__changes'), 1, 'and tells the page (ov-share:change)');
        assert.strictEqual(await p.evaluate(`${q('done')}.textContent`), 'Done');

        // Transfer: to a person on the list, removing my access by default, bound to their subject.
        await p.evaluate(`${q('give')}.click()`);
        await wait(80);
        assert.strictEqual(await p.evaluate(`${q('keep-false')}.checked`), true, '"Remove my access" is the default');
        await p.evaluate(`${q('give-maticus')}.click()`);
        await wait(50);
        await p.evaluate(`${q('give-send')}.click()`);
        await wait(200);
        assert.deepStrictEqual(S.lastTransfer, { to: { subject: PEOPLE.maticus.subject }, keep_access: false });
        assert.match(await p.evaluate("document.querySelector('dialog.ov-share .ov-share-banner').textContent"), /Waiting for @maticus to accept/);
        assert.strictEqual(await p.evaluate(`!!${q('give')}`), false, 'one offer at a time');
        await p.evaluate(`${q('cancel-give')}.click()`);
        await wait(200);
        assert.strictEqual(S.transfer, null, 'the owner can cancel');
        assert.deepStrictEqual(S.lastCancel, { transfer_id: '00000000-0000-4000-8000-0000000000aa' }, 'naming the offer it cancels');
        await p.evaluate(`${q('close')}.click()`);
        await wait(320);
        assert.strictEqual(await p.evaluate("document.querySelectorAll('dialog').length + (document.documentElement.classList.contains('ov-share-locked') ? 1 : 0)"), 0, 'closing removes the sheet and frees the page');

        // A gate in markup starts by itself, once, with its values as plain attributes (a quote or </script> in one is
        // just text); signed out, it offers the sign-in link it was given.
        assert.ok(await p.evaluate("!!document.querySelector('#gate2 .ov-share-gate')"), 'a gate in markup starts when ov-share.js loads');
        assert.strictEqual(await p.evaluate("document.querySelector('#gate2 a').getAttribute('href')"), '/login?next=%2Fp%2F"</script>', 'its sign-in link is the attribute, as text');
        assert.strictEqual(await p.evaluate('OVShare.startGates()'), 0, 'and it starts only once');
        // The recipient's banner and the gate.
        await p.evaluate("OVShare.offer(document.getElementById('offer'), { kind: 'paste', id: 'abc', transfer_id: '00000000-0000-4000-8000-0000000000aa', from: { username: 'goosely' }, title: 'notes' })");
        await p.evaluate("[...document.querySelectorAll('#offer button')].find((b) => b.textContent === 'Accept').click()");
        await wait(200);
        assert.ok(calls.includes('POST /api/v1/paste/abc/share/transfer/accept'));
        assert.deepStrictEqual(S.lastAccept, { transfer_id: '00000000-0000-4000-8000-0000000000aa' }, 'the answer names the offer');
        assert.match(await p.evaluate("document.getElementById('offer').textContent"), /It is yours now/);
        await p.evaluate("OVShare.gate(document.getElementById('gate'), { kind: 'paste', id: 'abc', signedInAs: 'quinn' })");
        assert.ok(!/notes/.test(await p.evaluate("document.getElementById('gate').textContent")), 'the gate never shows the title');
        await p.evaluate("document.querySelector('#gate .ov-share-btn').click()");
        await wait(200);
        assert.ok(calls.includes('POST /api/v1/paste/abc/share/requests'));
        assert.match(await p.evaluate("document.getElementById('gate').textContent"), /Asked/);
        await p.evaluate("OVShare.gate(document.getElementById('gate'), { kind: 'paste', id: 'abc', signInUrl: '/login' })");
        assert.strictEqual(await p.evaluate("document.querySelector('#gate a').getAttribute('href')"), '/login', 'signed out: sign in');

        // Send it: for anyone, with no kind or id; the link, Copy, the places, "Start at", embed code.
        await p.evaluate("Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } }, configurable: true })");   // headless Chrome refuses the real one without a grant
        await p.evaluate("document.getElementById('send').click()");
        await wait(300);
        assert.strictEqual(await p.evaluate("document.querySelectorAll('dialog.ov-share .ov-share-aud').length"), 0, 'no "who can open it" without kind and id');
        assert.strictEqual(await p.evaluate(`${q('link')}.value`), 'video.test/v/1', 'the link, shown without https://');
        await p.evaluate(`${q('copy')}.click()`);
        await wait(120);
        assert.strictEqual(await p.evaluate('window.__clip'), 'https://video.test/v/1', 'Copy copies the whole link');
        assert.ok(await p.evaluate("window.__sent.includes('copy https://video.test/v/1')"), 'and says so (ov-share:sent)');
        assert.strictEqual(await p.evaluate(`${q('copy')}.textContent`), 'Copied');
        // No Dock on this page (signed out): no OpenVibe Chat tile.
        assert.strictEqual(await p.evaluate(`!!${q('to-ovchat')}`), false, 'no OpenVibe Chat without the Dock');
        // OpenVibe Community is offered to everyone (4.179.0): a link to its new-topic form, the title and the link filled in.
        const comm = await p.evaluate(`(() => { const a = ${q('to-ovcommunity')}; return a ? { href: a.getAttribute('href'), text: a.textContent, first: document.querySelector('dialog.ov-share .ov-share-grid .ov-share-tile') === a } : null; })()`);
        assert.ok(comm, 'the Community tile');
        assert.strictEqual(comm.text, 'Community');
        assert.ok(comm.first, 'first-party places lead the grid');
        assert.ok(/^https:\/\/openvibe\.community\/forum\/discuss\?title=[^&]*&body=/.test(comm.href), comm.href);
        assert.ok(decodeURIComponent(comm.href.split('&body=')[1]).includes('http'), 'the body carries the link');
        const x = await p.evaluate(`${q('to-x')}.getAttribute('href')`);
        assert.strictEqual(x, 'https://x.com/intent/post?text=A%20robot%20%26%20a%20wave&url=https%3A%2F%2Fvideo.test%2Fv%2F1', 'X gets the title and the link, encoded');
        assert.strictEqual(await p.evaluate(`${q('to-x')}.getAttribute('rel')`), 'noopener noreferrer');
        assert.ok(!/utm_|ref=/.test(x), 'no tracking is added to a link');
        await p.evaluate(`${q('at-time')}.click()`);
        await wait(60);
        assert.strictEqual(await p.evaluate(`${q('link')}.value`), 'video.test/v/1?t=83', '"Start at 1:23" adds the time');
        await p.evaluate(`${q('more')} && ${q('more')}.click()`);
        await wait(60);
        await p.evaluate(`${q('to-embed')}.click()`);
        await wait(60);
        assert.match(await p.evaluate(`${q('embed-code')}.value`), /^<iframe src="https:\/\/video\.test\/embed\/1\?t=83" [^>]*title="A robot &amp; a wave"/, 'embed code, with the time and an escaped title');
        await p.evaluate(`${q('to-mastodon')}.click()`);
        await wait(60);
        await p.evaluate(`(() => { const i = ${q('masto')}; i.value = 'not a server'; i.form.requestSubmit(); })()`);
        assert.match(await p.evaluate("document.querySelector('dialog.ov-share .ov-share-panel .ov-share-addmsg').textContent"), /address of your server/, 'Mastodon asks for a real server address');
        await p.evaluate(`${q('close')}.click()`);
        await wait(320);
        // Signed in (the Dock is on the page): OpenVibe Chat comes first; it closes the sheet and hands the Dock the title
        // and the link, and nothing is sent from here.
        await p.evaluate("window.__docked = []; window.OpenVibeDock = { share: (o) => { window.__docked.push(o); }, isOpen: () => false }");
        await p.evaluate("document.getElementById('send').click()");
        await wait(300);
        assert.strictEqual(await p.evaluate("document.querySelector('dialog.ov-share .ov-share-grid .ov-share-tile').getAttribute('data-k')"), 'to-ovchat', 'OpenVibe Chat is the first place');
        assert.strictEqual(await p.evaluate(`${q('to-ovchat')}.textContent`), 'OpenVibe Chat');
        await p.evaluate(`${q('to-ovchat')}.click()`);
        await wait(320);
        assert.deepStrictEqual(await p.evaluate('window.__docked'), [{ text: 'A robot & a wave https://video.test/v/1', title: 'A robot & a wave' }], 'the Dock gets the title and the link');
        assert.strictEqual(await p.evaluate("!!document.querySelector('dialog.ov-share')"), false, 'the sheet closes');
        // A Dock that may not send (a read-only Dock token): no OpenVibe Chat.
        await p.evaluate("window.OpenVibeDock = { share: () => {}, isOpen: () => false, canSend: () => false }");
        await p.evaluate("document.getElementById('send').click()");
        await wait(300);
        assert.strictEqual(await p.evaluate(`!!${q('to-ovchat')}`), false, 'no OpenVibe Chat when the Dock cannot send');
        await p.evaluate(`${q('close')}.click()`);
        await wait(320);
        await p.evaluate("delete window.OpenVibeDock");
        // Somebody else's paste: they can send it; who can open it is not theirs to see, and nothing says it failed.
        await p.evaluate("document.getElementById('theirs').click()");
        await wait(300);
        assert.strictEqual(await p.evaluate("document.querySelectorAll('dialog.ov-share .ov-share-aud, dialog.ov-share .ov-share-error').length"), 0, 'a 404 from the share API leaves the send half alone');
        assert.ok(await p.evaluate(`!!${q('copy')}`));
        await p.evaluate(`${q('close')}.click()`);
        await wait(320);

        // A phone: a sheet from the bottom, never wider than the phone, finger-sized controls.
        S = fresh();
        S.members = [{ ...PEOPLE.maticus, role: 'viewer', expires_at: '2026-11-30T23:59:59Z' }];
        S.audience = 'people';
        const phone = await h.openPage(browser, context, { width: 390 });
        await phone.goto(`${base}/`, { maxMs: 5000 });
        // The phone's own share sheet (navigator.share), stood in for: offered first, with the link.
        await phone.evaluate("navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; navigator.canShare = () => true; matchMedia = ((m) => (q) => (q === '(pointer: coarse)' ? { matches: true, addEventListener() {}, removeEventListener() {} } : m(q)))(matchMedia.bind(window))");
        await phone.evaluate("document.getElementById('send').click()");
        await wait(400);
        await phone.evaluate("document.querySelector('dialog.ov-share [data-k=\"device\"]').click()");
        await wait(100);
        assert.deepStrictEqual(await phone.evaluate('window.__shared'), { title: 'A robot & a wave', url: 'https://video.test/v/1' }, 'the phone\'s sheet gets the title and the link');
        assert.ok(await phone.evaluate("!!document.querySelector('dialog.ov-share [data-k=\"to-sms\"]') || !!document.querySelector('dialog.ov-share [data-k=\"more\"]')"), 'Messages is offered on a phone');
        await phone.evaluate("document.querySelector('dialog.ov-share [data-k=\"close\"]').click()");
        await wait(320);
        await phone.evaluate("document.getElementById('sh').click()");
        await wait(500);
        const r = await phone.evaluate("(() => { const d = document.querySelector('dialog.ov-share').getBoundingClientRect(); return [Math.round(d.width), Math.round(innerHeight - d.bottom), document.documentElement.scrollWidth]; })()");
        assert.deepStrictEqual(r, [390, 0, 390], 'the sheet sits on the bottom edge, the phone\'s width, and nothing is wider');
        assert.ok(await phone.evaluate("document.querySelector('dialog.ov-share .ov-share-addfield').getBoundingClientRect().height") >= 44, 'the name field is a finger tall');
        await phone.close();
        console.log('ov-share-chrome: send (copy, X, start at, embed, Mastodon, the phone sheet), not-the-owner, loading, @names (unknown, invalid, rate-limited, found), Only me → people, save by subject, leave-unsaved, transfer and cancel, the offer, the gate, the phone ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
