'use strict';
// Your Actor's pictures in the menu's card (ov-run.js, 4.287.0; the owner, 11-16: "an avatar generator for agents … on
// the image models configured in the admin's guided setup and usable through the exchange"). In a real headless Chrome
// at 390 px against a stand-in Frame:
//   • the card lists your pictures and the styles; a few words and a style draw three more (the ask goes to the Frame's
//     /actor/pictures/generate as it is), and they come first;
//   • a tap wears one (POST /actor/face): the card's face and the strip's face show it;
//   • a rename keeps the picture (no drawn face is sent); pressing a shape and saving puts the drawn face on instead;
//   • nothing is wider than the phone;
//   • "New" makes an agent here: what it should do, a name from those words (yours to change), Create.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('run-actor-pictures-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');

const PIC = (id) => `https://pictures.test/faces/${id}`;
const state = { actor: { id: 'act_1', name: 'Juniper', enabled: true, status: 'idle', now: {}, asks: [], avatar: null, avatar_url: null },
    faces: [{ id: 'fac_old0000000a', url: PIC('fac_old0000000a') }], asked: [], wore: [], patched: [], made: [] };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        // ov-face.js draws the faces (4.318.0); with no sibling() ov-run.js takes it from beside itself.
        if (u.pathname === '/ov-run.js' || u.pathname === '/ov-face.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, u.pathname.slice(1)))); }
        if (u.pathname === '/') {
            res.writeHead(200, { 'content-type': 'text/html' });
            return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7">
<div id="app" style="height:100dvh"></div><script src="/ov-run.js"></script>
<script>window.view = OpenVibeRun.mount(document.getElementById('app'), { base: location.origin + '/api/frame', token: 'tok', agent: true });</script>`);
        }
        const json = (status, out) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(out)); };
        const b = body ? JSON.parse(body) : {};
        if (u.pathname === '/api/frame/actor' && req.method === 'GET') return json(200, state.actor);
        if (u.pathname === '/api/frame/actor' && req.method === 'PATCH') {
            state.patched.push(b);
            state.actor = { ...state.actor, name: b.name || state.actor.name };
            if (b.avatar) state.actor = { ...state.actor, avatar: b.avatar, avatar_url: null };
            return json(200, state.actor);
        }
        if (u.pathname === '/api/frame/actor/pictures') return json(200, { faces: state.faces, styles: [{ id: 'openvibe', name: 'OpenVibe' }, { id: 'pixel', name: 'Pixel' }] });
        if (u.pathname === '/api/frame/actor/pictures/generate' && req.method === 'POST') {
            state.asked.push(b);
            const made = [0, 1, 2].map((k) => ({ id: `fac_new${k}0000000`, url: PIC(`fac_new${k}0000000`) }));
            state.faces = made.concat(state.faces);
            return json(201, { faces: made, cost_usd: 0.03 });
        }
        if (u.pathname === '/api/frame/actor/face' && req.method === 'POST') {
            state.wore.push(b.face);
            state.actor = { ...state.actor, avatar: { face: b.face, url: `/faces/${b.face}` }, avatar_url: PIC(b.face) };
            return json(200, { agent: 'agt_1', face: `face:${b.face}`, face_url: `/faces/${b.face}` });
        }
        if (u.pathname === '/api/frame/actor/agents' && req.method === 'POST') { state.made.push(b); return json(201, { id: 'agt_01ABCDEFGHJKMNPQRSTVWXYZ00', ...b }); }
        if (u.pathname === '/api/frame/runs') return json(200, { runs: [], next: null });
        json(404, { error: 'No such thing' });
    });
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-run-pictures-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 6000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(60); } };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`${base}/`, { maxMs: 6000 });
        const open = async () => {
            await until(p, "document.querySelectorAll('.ovr-people .ovr-person').length > 0", 'the strip of agents');
            await p.evaluate("document.querySelector('.ovr-people .ovr-person').click(), true");
            await until(p, "!!document.querySelector('.ovr-sheet')", 'the Actor card');
        };
        await open();
        // Your pictures and the styles.
        await until(p, "(() => { const s = document.querySelector('.ovr-pics'); return s && !s.hidden && document.querySelectorAll('.ovr-pic').length === 1; })()", 'the picture section with your one picture');
        assert.equal(await p.evaluate("document.querySelector('.ovr-pic').getAttribute('aria-checked')"), 'false', 'not worn yet');
        assert.deepEqual(await p.evaluate("[...document.querySelectorAll('.ovr-draw-style')].map((c) => [c.textContent, c.getAttribute('aria-checked')])"),
            [['OpenVibe', 'true'], ['Pixel', 'false']], 'the styles, the first picked');
        // A few words and a style draw three more, first in the row.
        await p.evaluate("(() => { document.querySelectorAll('.ovr-draw-style')[1].click(); const i = document.querySelector('.ovr-draw-in'); i.value = 'a calm fox'; document.querySelector('.ovr-draw-go').click(); return 1; })()");
        await until(p, "document.querySelectorAll('.ovr-pic').length === 4", 'three new pictures');
        assert.deepEqual(state.asked, [{ name: 'Juniper', description: 'a calm fox', style: 'pixel', n: 3 }], 'the ask goes to the Frame as it is');
        assert.equal(await p.evaluate("document.querySelector('.ovr-pic img').getAttribute('src')"), PIC('fac_new00000000'), 'the new ones come first');
        assert.match(await p.evaluate("document.querySelector('.ovr-sheet-note').textContent"), /Three new pictures · \$0\.03/);
        // A tap wears one: the card's face and the strip's face show it.
        await p.evaluate("document.querySelector('.ovr-pic').click(), 1");
        await until(p, "document.querySelector('.ovr-pic').getAttribute('aria-checked') === 'true'", 'the tapped picture is worn');
        assert.deepEqual(state.wore, ['fac_new00000000']);
        assert.equal(await p.evaluate("(document.querySelector('.ovr-sheet-face img') || {}).src || null"), PIC('fac_new00000000'), 'the card wears it');
        await until(p, `(() => { const i = document.querySelector('.ovr-people .ovr-person .ovr-face img'); return i && i.src === ${JSON.stringify(PIC('fac_new00000000'))}; })()`, 'the strip wears it');
        assert.equal(await p.evaluate('document.documentElement.scrollWidth'), 390, 'nothing wider than the phone');
        assert.equal(await p.evaluate("getComputedStyle(document.querySelector('.ovr-sheet-btn.is-save')).display"), 'none', 'Save stays away with nothing to save');
        // A rename keeps the picture.
        await p.evaluate("(() => { const n = document.querySelector('.ovr-sheet-name'); n.value = 'Juniper Two'; n.dispatchEvent(new Event('input')); return 1; })()");
        await until(p, "!document.querySelector('.ovr-sheet-btn.is-save').hidden", 'Save shows for a new name');
        await p.evaluate("document.querySelector('.ovr-sheet-btn.is-save').click(), 1");
        await until(p, `${JSON.stringify(state.patched.length)} >= 0 && !document.querySelector('.ovr-sheet')`, 'the card closes on save');
        assert.deepEqual(state.patched.at(-1), { name: 'Juniper Two' }, 'a rename sends no drawn face, so the picture stays');
        // A shape pressed and saved puts the drawn face on instead.
        await open();
        await p.evaluate("document.querySelector('.ovr-pick-shape[data-shape=\"leaf\"]').click(), 1");
        assert.equal(await p.evaluate("!!document.querySelector('.ovr-sheet-face img')"), false, 'the card shows the drawn face once a shape is pressed');
        await p.evaluate("document.querySelector('.ovr-sheet-btn.is-save').click(), 1");
        await until(p, '!document.querySelector(\'.ovr-sheet\')', 'the card closes on save');
        assert.equal(state.patched.at(-1).avatar.blob.shape, 'leaf', 'the drawn face goes up');
        // New: an agent made here. The name follows what it does until you write one.
        await p.evaluate("document.querySelector('.ovr-people .ovr-person.is-new').click(), 1");
        await until(p, "!!document.querySelector('.ovr-sheet.ovr-new')", 'the new agent sheet');
        await p.evaluate("(() => { const t = document.querySelector('.ovr-new-what'); t.value = 'find me cheap flights to Lisbon every Friday'; t.dispatchEvent(new Event('input')); return 1; })()");
        assert.equal(await p.evaluate("document.querySelector('.ovr-new-name').value"), 'Find cheap flights', 'a name from the words');
        await p.evaluate("(() => { const n = document.querySelector('.ovr-new-name'); n.value = 'Lisbon scout'; n.dispatchEvent(new Event('input')); const t = document.querySelector('.ovr-new-what'); t.value += ' at night'; t.dispatchEvent(new Event('input')); return 1; })()");
        assert.equal(await p.evaluate("document.querySelector('.ovr-new-name').value"), 'Lisbon scout', 'a name you wrote stays');
        assert.equal(await p.evaluate('document.documentElement.scrollWidth'), 390, 'the sheet fits the phone');
        await p.evaluate("document.querySelector('.ovr-new .ovr-draw-go').click(), 1");
        await until(p, "!document.querySelector('.ovr-sheet.ovr-new')", 'the sheet closes once it is made');
        assert.deepEqual(state.made, [{ name: 'Lisbon scout', instructions: 'find me cheap flights to Lisbon every Friday at night' }]);
        assert.match(await p.evaluate("(document.querySelector('.ovr-list-note') || {}).textContent || ''"), /Lisbon scout is ready/);
        console.log('run-actor-pictures-chrome: pictures listed, three drawn in a style, one worn on the card and the strip, a rename keeps it, a shape replaces it; New makes an agent here');
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
