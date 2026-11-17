'use strict';
// Read aloud (4.308.0; the owner, 11-17: "There should be a feature for the sessions and codes and actor and etc where it
// will read out it's messages using text to speech if configured"). Over a local Frame at 390 px, with this browser's
// voices stood in for (headless Chrome has none):
//   • turned on, a session reads a new answer as it finishes, made speakable (no markdown marks, a link is its words),
//     and never the history it opened with;
//   • the speaker in the head moves while it reads, and a tap stops it;
//   • the Read aloud sheet turns it off (the speaker goes), and OpenVibe voices ask the Frame's /speech as the person;
// Nothing off the screen; no page errors.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');

const root = path.join(__dirname, '..');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-speak-chrome: skipped'); process.exit(0); }

const run = { ref: 'actor:tsk_1', kind: 'chat', title: 'Ship it', status: 'running', created_at: new Date().toISOString(), agent: { id: 'actor', name: 'Actor' } };
const steps = [
    { seq: 1, kind: 'message', from: 'person', text: 'Is the build green?' },
    { seq: 2, kind: 'message', from: 'agent', text: 'An old answer that must stay silent.' },
    { seq: 3, kind: 'message', from: 'person', text: 'And now?' },
];
let stream = null;
const speechAsked = [];
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script>
// This browser's voices, stood in for: what is said is kept; each piece ends a moment later.
window.__said = []; window.__cancels = 0;
const fake = { speaking: false, getVoices: () => [{ name: 'Test Voice (en-US)', lang: 'en-US', localService: true }],
  speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 600); }, cancel() { window.__cancels += 1; } };
Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
window.SpeechSynthesisUtterance = function (t) { this.text = t; };
localStorage.setItem('ov:speak', JSON.stringify({ on: true, engine: 'device', rate: 1 }));
</script>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, title: 'Vibe' }); window.__s.open('actor:tsk_1');</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const p = u.pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.(js|css)$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) {
        res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'application/javascript; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(root, p.slice(1))));
    }
    if (p === '/api/frame/speech' && req.method === 'POST') {
        let raw = ''; req.on('data', (c) => { raw += c; }); req.on('end', () => { speechAsked.push({ auth: req.headers.authorization, body: JSON.parse(raw) }); res.writeHead(200, { 'content-type': 'audio/mpeg' }); res.end(Buffer.from('not-really-mp3')); });
        return undefined;
    }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }], places: [{ kind: 'auto', name: 'Auto' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/runs') return json(res, 200, { runs: [run], partial: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 } });
    if (p === '/api/frame/resources') return json(res, 404, {});
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
        if (!m[2]) return json(res, 200, run);
        if (m[2] === '/steps') return json(res, 200, { steps, next: null });
        if (m[2] === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' }); res.write(': open\n\n'); stream = res; return undefined; }
    }
    return json(res, 404, {});
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-speak-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await until(p, "!!document.querySelector('.ovse-say')");
        await until(p, "(() => { const b = document.querySelector('.ovse-speak'); return b && !b.hidden; })()");
        await pause(400);
        assert.deepStrictEqual(await p.evaluate('window.__said'), [], 'the history it opened with stays silent');

        // A new answer finishes: it is read, made speakable.
        const deadline = Date.now() + 4000;
        while (!stream && Date.now() < deadline) await pause(50);
        assert.ok(stream, 'the session follows the run');
        stream.write(`id: 4\nevent: step\ndata: ${JSON.stringify({ step: { seq: 4, kind: 'message', from: 'agent', text: '**The build** is green. See [the log](https://ci.example/run/7) for `npm test`.\n\n```\nok 412\n```' } })}\n\n`);
        const said = await until(p, "window.__said.length ? window.__said : null");
        assert.deepStrictEqual(said, ['The build is green. See the log for npm test. (code)'], 'read as words: no marks, a link is its words, code is not read (sentences go together up to about 220 characters)');
        assert.ok(await p.evaluate("document.querySelector('.ovse-speak').classList.contains('is-speaking')"), 'the speaker moves while it reads');
        await p.evaluate("document.querySelector('.ovse-speak').click()");
        assert.ok(await p.evaluate('window.__cancels > 0'), 'a tap stops it');
        await until(p, "!document.querySelector('.ovse-speak').classList.contains('is-speaking')");

        // The sheet: OpenVibe voices ask the Frame's /speech as the person; off hides the speaker.
        await p.evaluate("document.querySelector('.ovse-speak').click()");
        await until(p, "!!document.querySelector('.ovse-speaksheet .ovse-switch')");
        await p.evaluate("[...document.querySelectorAll('.ovse-speaksheet .ovse-use-tab')].find((t) => /OpenVibe voices/.test(t.textContent)).click()");
        await until(p, "JSON.parse(localStorage.getItem('ov:speak')).engine === 'openvibe' && [...document.querySelectorAll('.ovse-speaksheet .ovse-use-row b')].some((b) => b.textContent === 'Wave Queen')");
        await p.evaluate("[...document.querySelectorAll('.ovse-speaksheet button')].find((b) => /Try it/.test(b.textContent)).click()");
        const deadline2 = Date.now() + 4000;
        while (!speechAsked.length && Date.now() < deadline2) await pause(50);
        assert.deepStrictEqual(speechAsked[0], { auth: 'Bearer signed-in-test', body: { text: 'This is how answers will sound.', voice: 'gc_wave_queen', speed: 1 } });
        assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 390, 'nothing off the screen');
        await p.evaluate("document.querySelector('.ovse-speaksheet .ovse-switch').click()");
        await until(p, "JSON.parse(localStorage.getItem('ov:speak')).on === false");
        await until(p, "document.querySelector('.ovse-speak').hidden");
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('session-speak-chrome: a new answer read as words, never the history; the speaker stops it; OpenVibe voices through the Frame; off hides it');
    } finally {
        if (stream) stream.end();
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
