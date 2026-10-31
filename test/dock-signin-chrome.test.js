'use strict';
// The Dock with the extension's read-only scopes and an async token (2026-10-30): every request uses the
// token the function returns at call time; the Agents tab shows Details but no approve/decline; the Chats
// tab reads but has no composer; the Activity tab loads through the same token function.
// Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('dock-signin-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const iso = (ago) => new Date(Date.now() - ago).toISOString();
const state = { open: false, tab: 'activity', pinned: false, agent: null, chat: null, place: { phone: { corner: 'bottom-right' }, desktop: { corner: 'bottom-right', width: null, height: null } }, updated_at: iso(0) };
const item = { id: 'apr_1', service: 'actor', agent: 'Researcher', bucket: 'waiting', state: 'waiting', kind: 'approval', title: 'Send the weekly digest?', summary: 'It wants to send from your address.', href: 'https://openvibe.actor/tasks/t1', actions: ['approve', 'decline', 'open'], cost_usd: null, steps: null, error: null, next_run_at: null, updated_at: iso(60e3), created_at: iso(60e3) };
const ACTIONS = { generated_at: iso(1000), sources: { network: 'ok' }, counts: { running: 1, waiting: 1, scheduled: 0, done: 0, failed: 0 }, buckets: { waiting: [item], running: [], scheduled: [], done: [], failed: [] } };
const NOTES = [{ id: 1, type: 'agent_done', category: 'agents', service: 'codes', title: 'Codes finished a task', message: 'The suite passed.', priority: 'normal', is_read: 0, created_at: iso(300e3) }];

let tokenCalls = 0;
const seenAuth = [];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
        if (u.pathname === '/page') {
            res.writeHead(200, { 'content-type': 'text/html' });
            return res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Dock</title></head><body><main>page</main>
<script src="/ov-mark.js"></script><script src="/dock.js"></script>
<script>window.__calls=0; OpenVibeDock.mount({ token: async () => { window.__calls++; return 'tok_async'; }, apiBase: location.origin, chatBase: location.origin, scopes: ['dock','activity','chat.read'], me: 'ada', sibling: (n) => '/' + n });</script>
</body></html>`);
        }
        if (u.pathname === '/api/v1/me/dock') {
            seenAuth.push(req.headers.authorization);
            if (req.method === 'PUT') { Object.assign(state, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
            return json(200, { state, counts: { running: 1, waiting: 1, unread: 1 }, sources_partial: false });
        }
        if (u.pathname === '/api/v1/me/actions') { seenAuth.push(req.headers.authorization); return json(200, ACTIONS); }
        if (u.pathname === '/api/dm/unread') { seenAuth.push(req.headers.authorization); return json(200, { unread: 1 }); }
        if (u.pathname === '/api/dm/conversations') { seenAuth.push(req.headers.authorization); return json(200, { conversations: [{ id: 11, name: null, is_group: false, last_message: 'see the shots?', last_sender_id: 2, last_message_at: iso(240e3), unread_count: 1, participants: [{ id: 1, username: 'ada', display_name: 'Ada' }, { id: 2, username: 'kai', display_name: 'Kai' }] }] }); }
        const dm = /^\/api\/dm\/conversations\/(\d+)\/(messages|read)$/.exec(u.pathname);
        if (dm && dm[2] === 'read') { seenAuth.push(req.headers.authorization); return json(200, { ok: true }); }
        if (dm) { seenAuth.push(req.headers.authorization); return json(200, { messages: [{ id: 101, username: 'kai', display_name: 'Kai', message: 'see the shots?', created_at: iso(240e3) }] }); }
        if (u.pathname === '/api/notifications') { seenAuth.push(req.headers.authorization); return json(200, { notifications: NOTES, total: 1, has_more: false }); }
        if (u.pathname === '/api/notifications/unread-count') { seenAuth.push(req.headers.authorization); return json(200, { count: 1 }); }
        if (u.pathname === '/api/notifications/unread-by-tab') { seenAuth.push(req.headers.authorization); return json(200, { tabs: { all: 1 } }); }
        const name = u.pathname.slice(1);
        if (/^[a-z-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
        res.writeHead(404); res.end();
    });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(p, expr, what, ms = 6000) {
    const end = Date.now() + ms;
    for (;;) {
        const v = await p.evaluate(expr);
        if (v) return v;
        if (Date.now() > end) throw new Error(`timed out: ${what}`);
        await wait(80);
    }
}

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-dock-signin-'));
    const browser = await h.launch({ tmpDir });
    const context = await browser.newContext();
    const p = await h.openPage(browser, context, { width: 1280, height: 860 });
    try {
        await p.goto(`${base}/page`, { maxMs: 5000 });
        await until(p, 'window.__calls > 0', 'the first dock read with the async token');
        await until(p, "!!document.getElementById('ovdk-pill')", 'the pill');
        assert.ok(seenAuth.length && seenAuth.every((a) => a === 'Bearer tok_async'), 'every request used the token function result');
        await p.evaluate("document.getElementById('ovdk-pill').click()");
        await until(p, "!!document.querySelector('.ovdk [data-panel=agent]')", 'the Dock opens');
        await p.evaluate("document.getElementById('ovdk-tab-agent').click()");
        await until(p, "document.querySelectorAll('.ovdk .ovac-item').length === 1", 'the action item');
        assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovdk .ovac-item [data-do=approve], .ovdk .ovac-item [data-do=decline]').length"), 0, 'no approve/decline with activity only');
        assert.strictEqual(await p.evaluate("!!document.querySelector('.ovdk .ovac-item a[href]')"), true, 'Details stays');
        await p.evaluate("document.getElementById('ovdk-tab-chats').click()");
        await until(p, "document.querySelectorAll('.ovdk .ovdk-chat').length === 1", 'the chat list');
        await p.evaluate("document.querySelector('.ovdk .ovdk-chat').click()");
        await until(p, "document.querySelectorAll('.ovdk .ovdk-msg').length === 1", 'the thread');
        assert.strictEqual(await p.evaluate("!!document.querySelector('.ovdk .ovdk-send')"), false, 'no composer with chat.read only');
        assert.match(await p.evaluate("document.querySelector('.ovdk [data-panel=chats]').innerText"), /Reading only/);
        await p.evaluate("document.getElementById('ovdk-tab-activity').click()");
        await until(p, "document.querySelectorAll('.ovdk .openvibe-notif-item').length === 1", 'the activity list');
        assert.ok((await p.evaluate('window.__calls')) >= 3, 'the async token was resolved for each tab');
        assert.ok(seenAuth.every((a) => a === 'Bearer tok_async'), JSON.stringify([...new Set(seenAuth)]));
        console.log('dock signin chrome: all checks passed');
    } finally {
        await p.close();
        await browser.close();
        await new Promise((r) => server.close(r));
    }
})().catch((err) => { console.error(err); process.exit(1); });
