'use strict';
// mountInto uses the Dock's actual panel siblings against local service stand-ins. Also checks six cleanup laps.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('dock-mount-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const state = { open: false, tab: 'activity', pinned: true, place: { phone: {}, desktop: {} } };
const page = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html,body{margin:0;height:100%;font:14px system-ui;background:#161820;color:#eee}
    #host{width:100%;height:600px;overflow:hidden}main{height:100px}
    </style><script src="/dock.js"></script></head><body><main>Local Dock mount test</main><div id="host"></div>
    <script>OpenVibeDock.mount({token:()=> 'local-token',apiBase:location.origin,chatBase:location.origin,actorBase:location.origin,agentBase:location.origin,sibling:(name)=>'/'+name});</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://local');
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
    const file = /^\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (file && fs.existsSync(path.join(ROOT, file[1]))) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, file[1]))); }
    if (u.pathname === '/api/v1/me/dock') return json(200, { state, counts: { unread: 2, running: 0, waiting: 0 } });
    if (u.pathname === '/api/v1/me/actions') return json(200, { counts: { running: 0, waiting: 0 }, buckets: { waiting: [], running: [], scheduled: [], done: [], failed: [] } });
    if (u.pathname === '/api/v1/me/actions/skills') return json(200, { listings: [] });
    if (u.pathname === '/api/v1/me/actor' || u.pathname === '/api/v1/me/agent-view') return json(404, {});
    if (u.pathname === '/api/dm/unread') return json(200, { unread: 3 });
    if (u.pathname === '/api/dm/conversations') return json(200, { conversations: [{ id: 1, participants: [{ username: 'local', display_name: 'Local' }, { username: 'ada', display_name: 'Ada' }], last_sender_id: 1, last_message: 'Hello', unread_count: 3, last_message_at: new Date().toISOString() }] });
    if (u.pathname === '/api/vibe/conversations') return json(200, { conversations: [], count: 0 });
    if (u.pathname === '/api/notifications') return json(200, { notifications: [], has_more: false, total: 0 });
    if (u.pathname === '/api/notifications/count' || u.pathname === '/api/notifications/unread') return json(200, { unread: 2, count: 2 });
    if (u.pathname === '/api/notifications/tabs') return json(200, { tabs: {} });
    return json(404, {});
});

const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expression, ms = 6000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await p.evaluate(expression)) return; await pause(50); }
    throw new Error(`Timed out: ${expression}`);
}

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-dock-mount-'));
    const browser = await h.launch({ tmpDir });
    try {
        for (const width of [390, 1280]) {
            const context = await browser.newContext();
            const p = await h.openPage(browser, context, { width, height: 800, probe: true });
            await p.goto(base, { maxMs: 5000 });
            await until(p, '!!window.OpenVibeDock && !!document.getElementById("ovdk-pill")');
            await p.evaluate('window.mount = OpenVibeDock.mountInto(document.getElementById("host"), {tab:"chats"})');
            await until(p, '!!document.querySelector("#host .ovdk-chat")');
            await until(p, 'document.querySelector("#ovdk-tab-chats .n").textContent === "3"');
            await p.evaluate('OpenVibeDock.update({state: OpenVibeDock._state().doc.state, counts: {unread: 2, running: 0, waiting: 1}})');
            assert.strictEqual(await p.evaluate('document.querySelector("#ovdk-tab-agent .n").textContent'), '1', `${width}px: mounted panel shares unread counts`);
            assert.strictEqual(await p.evaluate('document.querySelector("#ovdk-pill .ovdk-t").textContent'), 'Needs you', `${width}px: pill uses the same counts`);
            for (const [tab, marker] of [['chats', '.ovdk-chat'], ['vibe', '.ovdk-vibe-new'], ['agent', '.ovdk-runs-foot'], ['activity', '.openvibe-nv-head']]) {
                await p.evaluate(`mount.show('${tab}')`);
                await until(p, `!!document.querySelector('#host [data-panel="${tab}"]:not([hidden]) ${marker}')`);
                const result = await p.evaluate(`(() => { const host=document.getElementById('host'); const panel=host.querySelector('[data-panel="${tab}"]');
                    const controls=[...panel.querySelectorAll('button,a,input,textarea,summary')].filter(n=>n.getClientRects().length && getComputedStyle(n).visibility!=='hidden');
                    return {heads:host.querySelectorAll('.ovdk-head,.ovdk-tabs,.ovdk-more,[data-act="close"]').length,
                        visible:host.querySelectorAll('[data-panel]:not([hidden])').length,
                        small:controls.filter(n=>n.getBoundingClientRect().height < 43.5).map(n=>n.getAttribute('aria-label')||n.textContent.trim().slice(0,30)),
                        overflow:host.scrollWidth-host.clientWidth,documentOverflow:document.documentElement.scrollWidth-innerWidth}; })()`);
                assert.strictEqual(result.heads, 0, `${width}px ${tab}: no Dock chrome`);
                assert.strictEqual(result.visible, 1, `${width}px ${tab}: one panel`);
                assert.ok(result.overflow <= 1 && result.documentOverflow <= 1, `${width}px ${tab}: no sideways scroll ${JSON.stringify(result)}`);
                if (width === 390) assert.deepStrictEqual(result.small, [], `${tab}: every phone control is 44px`);
            }
            await p.evaluate('mount.show("agents")');
            await until(p, '!!document.querySelector("#host [data-panel=agent]:not([hidden]) .ovdk-runs-foot")');
            await p.evaluate('mount.destroy()');
            assert.strictEqual(await p.evaluate('document.getElementById("host").childElementCount'), 0, `${width}px: destroy empties host`);
            await p.evaluate('window.mount = OpenVibeDock.mountInto(document.getElementById("host"), {tab:"vibe"})');
            await until(p, '!!document.querySelector("#host [data-panel=vibe]")');
            await p.evaluate('OpenVibeDock.open({tab:"activity"})');
            assert.strictEqual(await p.evaluate('document.getElementById("host").childElementCount'), 0, `${width}px: floating Dock takes ownership`);
            assert.strictEqual(await p.evaluate('OpenVibeDock.isOpen()'), true, `${width}px: floating Dock opens`);
            await p.evaluate('window.mount = OpenVibeDock.mountInto(document.getElementById("host"), {tab:"chats"})');
            await until(p, '!!document.querySelector("#host [data-panel=chats]")');
            assert.strictEqual(await p.evaluate('OpenVibeDock.isOpen()'), false, `${width}px: mount closes floating Dock`);
            await p.evaluate('mount.destroy()');
            if (width === 390) {
                // The probe and forced GC use the same measures as boost-navbar-chrome's lifecycle check.
                const samples = [];
                for (let lap = 0; lap < 6; lap++) {
                    await p.evaluate('window.mount = OpenVibeDock.mountInto(document.getElementById("host"), {tab:"chats"})');
                    await until(p, '!!document.querySelector("#host .ovdk-chat")');
                    for (const tab of ['vibe', 'agent', 'activity', 'chats']) {
                        await p.evaluate(`mount.show('${tab}')`);
                        await until(p, `!!document.querySelector('#host [data-panel="${tab}"]:not([hidden])')`);
                    }
                    await p.evaluate('mount.destroy()');
                    await p.send('HeapProfiler.collectGarbage'); await pause(100);
                    await p.send('HeapProfiler.collectGarbage');
                    const m = await p.metrics(), probe = await p.evaluate('__ovProbe()');
                    samples.push({ nodes: m.Nodes, listeners: m.JSEventListeners, doc: probe.documentListeners, win: probe.windowListeners, host: await p.evaluate('document.getElementById("host").childElementCount') });
                }
                const a = samples[1], b = samples[5];
                assert.ok(samples.every(s => s.host === 0), `host empties each lap: ${JSON.stringify(samples)}`);
                assert.ok(b.nodes-a.nodes <= 25 && b.listeners-a.listeners <= 3 && b.doc-a.doc <= 0 && b.win-a.win <= 0, `no node or listener growth: ${JSON.stringify(samples)}`);
            }
        }
        console.log('dock-mount-chrome: four panels, both widths, exclusive ownership, six leak laps passed');
    } finally { await browser.close().catch(() => {}); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
