'use strict';
// Your agent, edited in place (4.295.0; the owner's phone, 11-17: "you can't even edit these properly, or like edit and
// configure them easily"). Over a local Frame, in a real headless Chrome at 390 px: the Actor row's edit button opens
// "Juniper, your agent" with its face and name; a new name saves (PATCH /actor) and shows on the row; its pictures are
// there to wear (POST /actor/face); three are drawn from a few words in a style (POST /actor/pictures/generate); How it
// runs opens the picker on Actor; your own setup leads with your own AI key. Nothing off the screen; no page errors.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('agent-sheet-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const PIC = (n) => `https://openvibe.media/o/med_01KFACE${String(n).padStart(19, '0')}`;
const actor = { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0.12 }, caps: { usd: 1 }, avatar: { face: 'fce_1', url: PIC(1) } };
const said = { patch: [], face: [], generate: [] };
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>
window.open = (u) => { window.__opened = (window.__opened || []).concat([u]); return {}; };
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, codes: true, title: 'Vibe' });
</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const read = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => ok(b ? JSON.parse(b) : {})); });
const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' }], places: [{ kind: 'auto', name: 'Auto' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/runs') return json(res, 200, { runs: [], partial: [] });
    if (p === '/api/frame/actor' && req.method === 'PATCH') { const b = await read(req); said.patch.push(b); if (b.name) actor.name = b.name; return json(res, 200, actor); }
    if (p === '/api/frame/actor') return json(res, 200, actor);
    if (p === '/api/frame/actor/pictures') return json(res, 200, { faces: [{ id: 'fce_1', url: PIC(1) }, { id: 'fce_2', url: PIC(2) }], styles: [{ id: 'openvibe', name: 'OpenVibe' }, { id: 'pixel', name: 'Pixel' }] });
    if (p === '/api/frame/actor/face' && req.method === 'POST') { const b = await read(req); said.face.push(b); actor.avatar = { face: b.face, url: PIC(b.face === 'fce_2' ? 2 : 1) }; return json(res, 200, actor); }
    if (p === '/api/frame/actor/pictures/generate' && req.method === 'POST') { said.generate.push(await read(req)); return json(res, 200, { faces: [3, 4, 5].map((n) => ({ id: `fce_${n}`, url: PIC(n) })), cost_usd: 0.03 }); }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-agent-sheet-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await p.evaluate("document.querySelector('.ovse-menu').click()");
        await until(p, "!!document.querySelector('.ovse-actor:not(.ovse-codes) .ovse-actor-set')");
        await p.evaluate("document.querySelector('.ovse-actor:not(.ovse-codes) .ovse-actor-set').click()");
        const opened = await until(p, `(() => { const s = document.querySelector('.ovse-sheet.is-in'); return s && { title: s.querySelector('.ovse-sheet-h b').textContent, name: s.querySelector('.ovse-ag-name').value,
            line: s.querySelector('.ovse-ag-line').textContent, face: !!s.querySelector('.ovse-ag-face .ovse-face') }; })()`);
        assert.deepStrictEqual(opened, { title: 'Juniper, your agent', name: 'Juniper', line: 'Ready · $0.12 of $1.00 today', face: true });

        // A new name saves and shows on the row.
        assert.ok(await p.evaluate("document.querySelector('.ovse-ag-save').hidden"), 'Save waits for a change');
        await p.evaluate("(() => { const i = document.querySelector('.ovse-ag-name'); i.value = 'Juno'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
        await p.evaluate("document.querySelector('.ovse-ag-save').click()");
        await until(p, "/Saved/.test(document.querySelector('.ovse-ag-note').textContent)");
        assert.deepStrictEqual(said.patch, [{ name: 'Juno' }]);
        assert.strictEqual(await p.evaluate("document.querySelector('.ovse-actor:not(.ovse-codes) .ovse-actor-top b').textContent"), 'Juno', 'the row has the new name');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovse-sheet-h b').textContent"), 'Juno, your agent');

        // Its pictures: wear another; draw three in a style.
        await until(p, "document.querySelectorAll('.ovse-ag-pic').length === 2");
        assert.strictEqual(await p.evaluate("document.querySelector('.ovse-ag-pic[aria-checked=true] img').src"), PIC(1), 'the one it wears is marked');
        await p.evaluate("document.querySelectorAll('.ovse-ag-pic')[1].click()");
        await until(p, "(document.querySelector('.ovse-ag-pic[aria-checked=true] img') || {}).src === " + JSON.stringify(PIC(2)));
        assert.deepStrictEqual(said.face, [{ face: 'fce_2' }]);
        await p.evaluate("document.querySelectorAll('.ovse-ag-style')[1].click()");
        await p.evaluate("(() => { const i = document.querySelector('.ovse-ag-words'); i.value = 'a calm fox'; document.querySelector('.ovse-ag-draw').requestSubmit(); })()");
        await until(p, "document.querySelectorAll('.ovse-ag-pic').length === 5");
        assert.deepStrictEqual(said.generate, [{ name: 'Juno', description: 'a calm fox', style: 'pixel', n: 3 }]);
        assert.match(await p.evaluate("document.querySelector('.ovse-ag-note').textContent"), /^Three new pictures · \$0\.03: tap one to wear it\.$/);

        // Your own setup leads with your own AI key; How it runs opens the picker on Actor.
        assert.strictEqual(await p.evaluate("document.querySelector('.ovse-ag-row b').textContent"), 'Your own AI key');
        assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'nothing off the screen');
        await p.evaluate("[...document.querySelectorAll('.ovse-ag-btn')].find((b) => /How it runs/.test(b.textContent)).click()");
        await until(p, "!document.querySelector('.ovse-sheet') && document.querySelector('.ovse-actor:not(.ovse-codes)').classList.contains('is-on')", 4000);
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('agent-sheet-chrome: your agent in place (name saved and shown, a picture worn, three drawn in a style, your own setup, How it runs) ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
