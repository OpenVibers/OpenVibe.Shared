'use strict';
// One face system (ov-face.js, 4.318.0; the owner, 11-18, the menu's Vibe beside openvibe.chat/vibe: "These should share
// the same universal shared system so they both have the faces"). The menu's sessions (ov-session.js) and Chat's Vibe
// (ov-run.js) mounted in one page over one Frame: your Actor wears the same face in both (the shape and colour it chose),
// Codes the same terminal, another agent the same blob; its sessions in the menu wear its face, not a glyph or a letter;
// ov-face.js loads once and its styles are added once.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('faces-one-system-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const RUNS = [
    { ref: 'chat:c_1', kind: 'chat', title: 'A good first synth', status: 'done', created_at: iso(900), updated_at: iso(600), agent: { id: 'vibe', name: 'Vibe' } },
    { ref: 'codes:tsk_1', kind: 'code', title: 'Add a dark mode switch', status: 'done', created_at: iso(800), updated_at: iso(500), agent: { id: 'codes', name: 'Codes' } },
    { ref: 'agents:run_3', kind: 'task', title: 'Design review', status: 'done', created_at: iso(700), updated_at: iso(400), agent: { id: 'agt_design', name: 'Design review' } },
];
const ACTOR = { id: 'agt_1', name: 'Juniper', enabled: true, status: 'idle', now: {}, asks: [], avatar: { blob: { hue: 320, shape: 'leaf' } } };
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e6edf7;font:15px system-ui} .two{display:grid;grid-template-columns:1fr 1fr;height:100vh} .two>div{min-width:0;height:100vh}</style>
<script src="/ov-session.js"></script><script src="/ov-run.js"></script><script src="/footer.js"></script></head><body><div class="two"><div id="menu"></div><div id="chat"></div></div>
<script>
const sibling = (f) => '/' + f;
window.__s = OpenVibeSession.mount(document.getElementById('menu'), { base: location.origin + '/api/frame', token: 'tok', sibling, actor: true, codes: true });
window.__r = OpenVibeRun.mount(document.getElementById('chat'), { base: location.origin + '/api/frame', token: 'tok', sibling, agent: true });
// The shared footer's stylesheet on the page, as on every site (its root class is .ovf: 4.325.0 moved the faces off it).
try { OpenVibeFooter.init({ service: 'test', variant: 'compact' }); } catch (e) { /* the footer's own markup is not what this checks */ }
</script></body></html>`;
const served = { faces: 0 };
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) {
        if (p === '/ov-face.js') served.faces += 1;
        res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(root, p.slice(1))));
    }
    if (p === '/api/frame/actor') return json(res, 200, ACTOR);
    if (p === '/api/frame/runs') return json(res, 200, { runs: RUNS, next: null, partial: [] });
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' }] });
    json(res, 404, { error: 'No such thing' });
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-faces-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(80); } };
    // A face as a plain record: what it is, its shape and its colour.
    const read = (sel) => `(() => { const f = ${sel}; if (!f || !f.classList.contains('ovface')) return null;
        return { kind: f.classList.contains('ovface-coder') ? 'coder' : f.classList.contains('ovface-blob') ? 'blob' : f.classList.contains('ovface-pic') ? 'pic' : '?',
            shape: f.dataset.shape || '', hue: f.style.getPropertyValue('--ovface-h').trim(), eyes: f.querySelectorAll(':scope > .ovface-eye').length,
            prompt: !!f.querySelector('.ovface-coder-prompt'), letter: !!f.querySelector('.ovse-face-l'), state: f.dataset.state || '',
            dot: getComputedStyle(f, '::after').backgroundColor }; })()`;
    const got = (p, sel, what) => until(p, `(() => { const x = ${read(sel)}; return x ? JSON.stringify(x) : null; })()`, what).then(JSON.parse);
    const rowFace = (box, rowSel, titleSel, title) => `[...document.querySelectorAll('${box} ${rowSel}')].map((r) => [r, r.querySelector('${titleSel}')]).filter(([, t]) => t && t.textContent.trim() === ${JSON.stringify(title)}).map(([r]) => r.querySelector('.ovface'))[0]`;
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 900 });
        const errors = [];
        p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(`${base}/`, { maxMs: 8000 });

        // The menu: your Actor's card and Codes' card wear faces, not a letter and a glyph tile.
        const menuActor = await got(p, "document.querySelector('#menu .ovse-me-face')", 'your Actor\'s face in the menu');
        const menuCodes = await got(p, "document.querySelector('#menu .ovse-codes-face')", 'Codes\' face in the menu');
        assert.deepStrictEqual([menuActor.kind, menuActor.shape, menuActor.hue, menuActor.eyes, menuActor.letter], ['blob', 'leaf', '320', 2, false], 'your Actor wears the face it chose: ' + JSON.stringify(menuActor));
        assert.deepStrictEqual([menuCodes.kind, menuCodes.prompt], ['coder', true], 'Codes wears its terminal');

        // Chat's Vibe: the same faces.
        const chatActor = await got(p, "document.querySelector('#chat .ovr-people .ovr-person .ovr-face')", 'your Actor\'s face on Chat');
        const chatCodes = await got(p, "document.querySelectorAll('#chat .ovr-people .ovr-person')[1].querySelector('.ovr-face')", 'Codes\' face on Chat');
        assert.deepStrictEqual([chatActor.kind, chatActor.shape, chatActor.hue], [menuActor.kind, menuActor.shape, menuActor.hue], 'one Actor, one face');
        assert.deepStrictEqual([menuActor.state, chatActor.state, menuActor.dot], ['resting', 'resting', chatActor.dot], 'the same ready dot on both: ' + menuActor.dot);
        assert.strictEqual(menuActor.dot, 'rgb(34, 197, 94)', 'green: ready');
        assert.deepStrictEqual(chatCodes.kind, 'coder');

        // The sessions list loads when its drawer opens (half a wide page is a narrow surface).
        await p.evaluate("document.querySelector('#menu .ovse-menu').click(), true");
        // The menu's sessions: your Actor's wears its face, Codes' its terminal, another agent's its own blob, the same
        // blob Chat draws for it.
        const mineRow = await got(p, rowFace('#menu', '.ovse-row', '.ovse-row-top b', 'A good first synth'), 'your Actor\'s session in the menu');
        const codeRow = await got(p, rowFace('#menu', '.ovse-row', '.ovse-row-top b', 'Add a dark mode switch'), 'Codes\' session in the menu');
        const otherRow = await got(p, rowFace('#menu', '.ovse-row', '.ovse-row-top b', 'Design review'), 'another agent\'s session in the menu');
        assert.deepStrictEqual([mineRow.kind, mineRow.shape, mineRow.hue], ['blob', 'leaf', '320'], 'your Actor\'s session wears its face');
        assert.strictEqual(codeRow.kind, 'coder');
        assert.ok(otherRow.kind === 'blob' && otherRow.eyes === 2 && otherRow.shape && otherRow.hue && otherRow.hue !== '320', 'another agent, its own blob: ' + JSON.stringify(otherRow));
        const chatOther = await got(p, rowFace('#chat', '.ovr-row', '.ovr-row-top b', 'Design review'), 'the same agent on Chat');
        assert.deepStrictEqual([chatOther.kind, chatOther.shape, chatOther.hue], [otherRow.kind, otherRow.shape, otherRow.hue], 'the same agent is the same face on both');

        // The owner, 11-19 (the menu's Vibe on openvibe.community, a phone): "A lot of these icons are the wrong aspect ratio."
        // The faces carried the class .ovf, the shared footer's own: its padding (24px 14px 20px), margin and border made a
        // 30 px face 45 px tall. With the footer's stylesheet on the page every face is still square and unpadded.
        assert.ok(await p.evaluate("!!document.getElementById('ovf-css')"), 'the footer\'s stylesheet is on the page');
        const boxes = await p.evaluate("[...document.querySelectorAll('.ovface')].filter((f) => f.getBoundingClientRect().width > 0).map((f) => { const r = f.getBoundingClientRect(), cs = getComputedStyle(f); return [Math.round(r.width), Math.round(r.height), cs.paddingTop, cs.marginTop]; })");
        assert.ok(boxes.length >= 4, 'faces were measured: ' + boxes.length);
        for (const [fw, fh, pad, margin] of boxes) assert.ok(Math.abs(fw - fh) <= 1 && pad === '0px' && margin === '0px', `a face is square and unpadded: ${fw}x${fh}, padding ${pad}, margin ${margin}`);
        assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovf .ovface, .ovface.ovf').length"), 0, 'no face carries the footer\'s class');

        // One module, one stylesheet.
        assert.strictEqual(served.faces, 1, 'ov-face.js is fetched once for both surfaces');
        assert.strictEqual(await p.evaluate("document.querySelectorAll('#ov-face-css').length"), 1, 'its styles are added once');
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('faces-one-system-chrome: all checks passed');
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
