'use strict';
// A guest asks the menu's box (4.328.0; the plan's §V.1 guests, the owner's register #801: "anons should be able to …
// use AI features with abuse prevention, severe rate limits … a global cap"). Signed out, a question was sent to
// openvibe.chat/vibe to be told to sign in. In a real headless Chrome, with Network's /api/frame/ask/guest stood in for:
//   - Enter on a question answers it here, above the list: the browser solves the challenge (the stand-in checks the
//     proof), the answer's link is a link, it says how many are left and offers the sign-in; nobody leaves the page;
//   - the Ask Vibe row is a guest's too (words that are not a question);
//   - a failed answer offers Try again, which answers; the day's limit says so with the sign-in and no Try again;
//   - the close button puts the card away; the phone's page never scrolls sideways;
//   - You shows the signed-in places, locked, each with its line, signing in back to that place (4.329.0).
//   node test/menu-guest-ask-chrome.test.js   (OV_SHOTS=dir keeps the phone's pictures)
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-guest-ask-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Go live — OpenVibe.Live</title><link rel="icon" href="data:,"></head>
<body style="margin:0;min-height:100vh;background:#0b1120"><a id="openvibe-login-btn" href="https://openvibe.network/login?return=here" hidden>Sign in</a>
<script>{ const real = window.fetch.bind(window); window.fetch = (u, o) => (String(u).startsWith(location.origin + '/api/frame/ask/guest') ? real(u, o) : Promise.resolve(new Response('{}', { status: 404 }))); }</script>
<script src="/search.js"></script></body></html>`;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const issued = new Map();   // challenge → the number, as Network keeps the signature
const asked = [];
let mode = 'ok', nextNumber = 60_000;
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u === '/api/frame/ask/guest/challenge') {
        const salt = `${crypto.randomBytes(12).toString('hex')}?expires=${Math.floor(Date.now() / 1000) + 300}`;
        const c = sha(salt + nextNumber);
        issued.set(c, nextNumber);
        return json(200, { algorithm: 'SHA-256', salt, challenge: c, maxnumber: 100_000, signature: sha(`sig:${c}`) });
    }
    if (u === '/api/frame/ask/guest' && req.method === 'POST') {
        let raw = '';
        req.on('data', (d) => { raw += d; });
        req.on('end', () => {
            const b = JSON.parse(raw);
            const p = b.proof || {};
            const solved = issued.has(p.challenge) && p.signature === sha(`sig:${p.challenge}`) && sha(p.salt + p.number) === p.challenge;
            issued.delete(p.challenge);
            asked.push({ text: b.text, context: b.context, guest: b.guest, solved });
            if (!solved) return json(403, { error: 'The quick check did not go through: try again', code: 'guest.check_failed' });
            if (mode === 'fail') { mode = 'ok'; return json(502, { error: 'Vibe could not answer right now. Try again in a moment.', code: 'guest.answer_failed' }); }
            if (mode === 'limit') return json(429, { error: "That was today's 3 guest questions. Sign in (free) to ask up to 100 a day.", code: 'guest.limit' });
            return json(200, { answer: 'Open https://openvibe.live/go-live and press Go live: no OBS, no follower minimum.', model: 'cheap-1', left: 2 });
        });
        return;
    }
    const f = path.join(root, u.slice(1));
    if (/^\/[a-z-]+\.js$/.test(u) && fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(f)); }
    res.writeHead(404); res.end();
});
const OPEN = "OpenVibeSearch.open({ service: 'live', scope: { label: 'Live', page: '/search' }, links: [], frame: {}, from: document.body, token: null, user: null, dock: null, apiBase: location.origin, sibling: (f) => '/' + f })";

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-guest-ask-')) });
    try {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 780 });
        const until = async (expr, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(50); } return false; };
        const key = async (k) => {
            const codes = { Enter: 13 };
            const ev = { key: k, code: k, windowsVirtualKeyCode: codes[k], nativeVirtualKeyCode: codes[k] };
            await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...ev, ...(k === 'Enter' ? { text: '\r' } : {}) });
            await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ev });
        };
        const typeInBox = async (t) => {
            await page.evaluate("(() => { const i = document.querySelector('.ovs-input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.focus(); })()");
            await page.send('Input.insertText', { text: t });
        };
        const shot = async (name) => {
            if (!process.env.OV_SHOTS) return;
            const pic = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 390, height: 520, scale: 2 } });
            fs.mkdirSync(process.env.OV_SHOTS, { recursive: true });
            fs.writeFileSync(path.join(process.env.OV_SHOTS, `guest-ask-${name}.png`), Buffer.from(pic.data, 'base64'));
        };
        const base = `http://127.0.0.1:${server.address().port}/`;
        await page.goto(base, { maxMs: 6000 });
        await page.evaluate(OPEN);
        assert.ok(await until("!!document.querySelector('.ovs.is-open .ovs-input')"), 'the menu opens');

        // Enter on a question: answered here.
        await typeInBox('How do I go live from my browser?');
        const t0 = Date.now();
        await key('Enter');
        assert.ok(await until("!!document.querySelector('.ovs-gans:not([hidden]) .ovs-gans-t.is-wait')", 3000), 'the card waits, with the mark');
        await shot('waiting');
        assert.ok(await until("!!document.querySelector('.ovs-gans .ovs-gans-t.is-in')"), 'the answer comes');
        const solveMs = Date.now() - t0;
        const card = await page.evaluate(`(() => { const g = document.querySelector('.ovs-gans'); return {
            q: g.querySelector('.ovs-gans-q').textContent, text: g.querySelector('.ovs-gans-t').textContent,
            link: (g.querySelector('.ovs-gans-t a') || {}).href || null, note: (g.querySelector('.ovs-gans-n') || {}).textContent || '',
            signIn: (g.querySelector('.ovs-gans-go') || {}).href || null, signInText: (g.querySelector('.ovs-gans-go') || {}).textContent || '',
            again: !!g.querySelector('.ovs-gans-again'), box: document.querySelector('.ovs-input').value, url: location.href,
            wide: document.documentElement.scrollWidth } })()`);
        await shot('answer');
        assert.equal(card.q, 'How do I go live from my browser?');
        assert.match(card.text, /no OBS, no follower minimum/);
        assert.equal(card.link, 'https://openvibe.live/go-live', 'the link is a link');
        assert.equal(card.note, '2 more today as a guest');
        assert.equal(await page.evaluate("[...document.querySelectorAll('.ovs-list a')].some((a) => /How do I go live/.test(a.textContent))"), false, 'the list is back to its start');
        assert.deepEqual([card.signIn, card.signInText], ['https://openvibe.network/login?return=here', 'Sign in for 100 a day']);
        assert.equal(card.again, false);
        assert.equal(card.box, '', 'the box is cleared');
        assert.equal(card.url, base, 'nobody left the page');
        assert.equal(card.wide, 390, 'no sideways scroll on a phone');
        assert.equal(asked.length, 1);
        assert.equal(asked[0].solved, true, 'the browser solved the check');
        assert.match(asked[0].guest, /^[A-Za-z0-9_-]{16,64}$/, 'a guest id the browser keeps');
        assert.match(asked[0].context, /^Go live — OpenVibe\.Live \(http:\/\/127\.0\.0\.1:\d+\/\)$/, 'the page, without its query');
        const kept = await page.evaluate("localStorage.getItem('ov:guest-ask:id')");
        assert.equal(kept, asked[0].guest);

        // The Ask Vibe row: words that are not a question; a failed answer offers Try again, which answers.
        mode = 'fail'; nextNumber = 1234;
        await typeInBox('go live tips');
        assert.ok(await until("[...document.querySelectorAll('.ovs-list a')].some((a) => /Ask Vibe/.test(a.textContent) && /free, no account/.test(a.textContent))"), 'the guest\'s Ask row');
        await page.evaluate("[...document.querySelectorAll('.ovs-list a')].find((a) => /Ask Vibe/.test(a.textContent)).click()");
        assert.ok(await until("!!document.querySelector('.ovs-gans .ovs-gans-again')"), 'Try again after a failed answer');
        assert.equal(await page.evaluate("document.querySelector('.ovs-gans-q').textContent"), 'go live tips');
        await shot('failed');
        nextNumber = 99_999;
        await page.evaluate("document.querySelector('.ovs-gans-again').click()");
        assert.ok(await until("!!document.querySelector('.ovs-gans .ovs-gans-t.is-in a')"), 'answered on the second try');
        assert.equal(asked.length, 3);
        assert.equal(asked[2].guest, asked[0].guest, 'the same guest');

        // The day's limit: said with the sign-in, no Try again.
        mode = 'limit'; nextNumber = 7;
        await typeInBox('What is OpenVibe?');
        await key('Enter');
        assert.ok(await until("/Sign in \\(free\\) to ask up to 100 a day/.test((document.querySelector('.ovs-gans .ovs-gans-t.is-in') || {}).textContent || '')"), 'the limit');
        assert.deepEqual(await page.evaluate("[!!document.querySelector('.ovs-gans-again'), (document.querySelector('.ovs-gans-go') || {}).textContent]"), [false, 'Sign in (free)']);
        await shot('limit');

        // Closed: the card goes, the list stays.
        await page.evaluate("document.querySelector('.ovs-gans-x').click()");
        assert.ok(await until("document.querySelector('.ovs-gans').hidden && !!document.querySelector('.ovs-list')"), 'closed');
        // You: the signed-in places, locked, each with its line; a press signs in and comes back to that place (4.329.0).
        await page.evaluate("document.querySelector('.ovs-starttabs [data-tab=you]').click()");
        assert.ok(await until("document.querySelectorAll('[data-sec=locked] .ovs-lock').length === 6"), 'six places, locked');
        const locked = await page.evaluate(`[...document.querySelectorAll('[data-sec="locked"] a.ovs-opt')].map((a) => [a.querySelector('.ovs-title').textContent, a.querySelector('.ovs-meta').textContent, a.href])`);
        assert.deepEqual(locked.map((x) => x[0]), ['Vibe', 'Agents', 'Codes', 'Files', 'Machines', 'Wallet']);
        assert.ok(locked.every((x) => x[1].length > 10), 'each says what it does');
        assert.equal(locked[0][2], 'https://openvibe.network/login?return=https%3A%2F%2Fopenvibe.chat%2Fvibe', 'signs in and lands on the place');
        assert.equal(await page.evaluate("document.querySelector('.ovs-guest .ovs-guest-line').textContent"), 'Free, and one account for every OpenVibe site.');
        assert.equal(await page.evaluate('document.documentElement.scrollWidth'), 390);
        if (process.env.OV_SHOTS) { const pic = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 390, height: 780, scale: 2 } }); fs.writeFileSync(path.join(process.env.OV_SHOTS, 'guest-ask-locked.png'), Buffer.from(pic.data, 'base64')); }
        console.log(`menu-guest-ask-chrome: a guest is answered in the menu (the check took ${solveMs} ms with 60,000 tries), retries, hears the limit, closes it; You shows the places it is missing, locked`);
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
