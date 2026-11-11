'use strict';
// The Code part (dock-code.js, 4.201.0; ask 350: "chat, codes, and agents all in the same place") in a real headless
// Chrome against a stub of Network's relay: your tasks, running first, with their state, repository and Stop; a task's
// address is a link only on openvibe.codes; My code asks for the repository before it can start; Ctrl+Enter starts a
// task with the person's token and the list reads again; Stop stops it; signed out, it says to sign in; when Codes cannot
// be reached, the box opens openvibe.codes with what was written in it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
assert.doesNotThrow(() => require('../dock-code'), 'dock-code.js loads (browser-only: Node takes the early return)');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('dock-code-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const now = new Date().toISOString();
let tasks = [
    { id: 't2', title: 'Settings switch', status: 'done', mode: 'repo', repo: 'https://github.com/someone/site.git', url: 'https://evil.example/t2', updated_at: now },
    { id: 't1', title: 'A goal bar for my sub goal', status: 'running', mode: 'create', steps: 12, url: 'https://openvibe.codes/tasks/t1', updated_at: now },
];
const seen = [];
let up = true;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/dock-code.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'dock-code.js'))); }
    if (u.pathname.startsWith('/api/frame/codes-tasks')) {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
            seen.push({ method: req.method, path: u.pathname + u.search, auth: req.headers.authorization || '', body: body ? JSON.parse(body) : null });
            if (!up) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"not here"}'); }
            res.writeHead(200, { 'content-type': 'application/json' });
            if (req.method === 'GET') return res.end(JSON.stringify({ tasks }));
            if (u.pathname.endsWith('/stop')) { tasks = tasks.map((t) => (t.id === 't1' ? { ...t, status: 'stopped' } : t)); return res.end('{"ok":true}'); }
            tasks = [{ id: 't3', title: 'Fix the login redirect', status: 'queued', mode: 'repo', repo: 'someone/site', url: 'https://openvibe.codes/tasks/t3', updated_at: now }, ...tasks];
            return res.end(JSON.stringify({ id: 't3', url: 'https://openvibe.codes/tasks/t3' }));
        });
        return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#111;color:#eee;font-family:sans-serif">
<div id="part" style="width:380px"></div><script src="/dock-code.js"></script>
<script>window.signedIn = ${u.searchParams.get('out') ? 'false' : 'true'};
window.part = OpenVibeDockCode.mount(document.getElementById('part'), { token: () => (window.signedIn ? 'tok_abc' : null), frameBase: location.origin + '/api/frame', codes: location.origin + '/codes', active: () => true, take: () => { const t = window.handed || ''; window.handed = ''; return t; } });</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-dock-code-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
        await page.goto(base + '/', { maxMs: 5000 });
        const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
        const rows = () => page.evaluate(`[...document.querySelectorAll('.ovdc-task')].map((li) => ({ t: li.querySelector('.ovdc-t').textContent, s: li.querySelector('.ovdc-s').textContent, m: li.querySelector('.ovdc-m').textContent, link: li.querySelector('a.ovdc-a') ? li.querySelector('a.ovdc-a').getAttribute('href') : null, stop: !!li.querySelector('.ovdc-stop') }))`);
        assert.ok(await until(`document.querySelectorAll('.ovdc-task').length === 2`), 'your tasks are listed');
        let r = await rows();
        assert.deepEqual(r.map((x) => [x.t, x.s, x.stop]), [['A goal bar for my sub goal', 'Running', true], ['Settings switch', 'Done', false]], 'running first, with its state; Stop only while it runs');
        assert.match(r[0].m, /12 steps · just now/);
        assert.match(r[1].m, /someone\/site · just now/, 'a repository task names its repository');
        assert.equal(r[0].link, 'https://openvibe.codes/tasks/t1');
        assert.equal(r[1].link, null, 'an address off openvibe.codes is not a link');
        assert.equal(seen[0].auth, 'Bearer tok_abc', 'the read carries the person\'s token');
        assert.equal(seen[0].path, '/api/frame/codes-tasks?limit=8', 'through Network\'s relay');

        // My code wants a repository; Ctrl+Enter starts the task.
        await page.evaluate(`document.querySelector('[data-mode="repo"]').click()`);
        const box = () => page.evaluate(`({ repo: !document.querySelector('.ovdc-repo').hidden, go: document.querySelector('.ovdc-go').disabled, ph: document.querySelector('.ovdc-text').placeholder, checked: document.querySelector('.ovdc-mode[aria-checked="true"]').textContent })`);
        let b = await box();
        assert.deepEqual([b.repo, b.go, b.checked], [true, true, 'My code'], 'My code shows the repository field and waits for words');
        await page.evaluate(`(() => { const t = document.querySelector('.ovdc-text'); t.value = 'Fix the login redirect'; t.dispatchEvent(new Event('input')); })()`);
        assert.equal((await box()).go, true, 'still waiting for the repository');
        await page.evaluate(`(() => { const r = document.querySelector('.ovdc-repo'); r.value = 'someone/site'; r.dispatchEvent(new Event('input')); })()`);
        assert.equal((await box()).go, false);
        await page.evaluate(`document.querySelector('.ovdc-text').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }))`);
        assert.ok(await until(`document.querySelectorAll('.ovdc-task').length === 3`), 'the new task is in the list');
        const start = seen.find((x) => x.method === 'POST' && x.path === '/api/frame/codes-tasks');
        assert.deepEqual(start.body, { text: 'Fix the login redirect', mode: 'repo', repo: 'someone/site' });
        assert.equal(start.auth, 'Bearer tok_abc');
        b = await page.evaluate(`({ text: document.querySelector('.ovdc-text').value, note: document.querySelector('.ovdc-note').textContent, link: document.querySelector('.ovdc-note a') && document.querySelector('.ovdc-note a').getAttribute('href') })`);
        assert.deepEqual(b, { text: '', note: 'Started. Follow it on openvibe.codes', link: 'https://openvibe.codes/tasks/t3' });
        assert.equal((await rows())[0].s, 'Waiting', 'a queued task says it is waiting');

        // Vibe's Build it in Code: the words another part hands over go in the box, ready to start.
        await page.evaluate(`window.handed = 'Build a goal bar for my sub goal'; window.part.refresh()`);
        b = await page.evaluate(`({ text: document.querySelector('.ovdc-text').value, note: document.querySelector('.ovdc-note').textContent, focused: document.activeElement === document.querySelector('.ovdc-text'), go: document.querySelector('.ovdc-go').disabled })`);
        assert.deepEqual(b, { text: 'Build a goal bar for my sub goal', note: 'From your chat with Vibe. Start it, or change it first.', focused: true, go: false }, 'handed-over words are in the box, ready to start (My code keeps its repository)');
        await page.evaluate(`document.querySelector('[data-mode="create"]').click()`);
        assert.equal(await page.evaluate(`document.querySelector('.ovdc-go').disabled`), false);
        await page.evaluate(`(() => { const t = document.querySelector('.ovdc-text'); t.value = ''; t.dispatchEvent(new Event('input')); })()`);

        // Stop.
        await page.evaluate(`[...document.querySelectorAll('.ovdc-task')].find((li) => li.textContent.includes('goal bar')).querySelector('.ovdc-stop').click()`);
        assert.ok(await until(`[...document.querySelectorAll('.ovdc-task')].some((li) => li.textContent.includes('goal bar') && li.textContent.includes('Stopped'))`), 'Stop stops it');
        assert.ok(seen.some((x) => x.method === 'POST' && x.path === '/api/frame/codes-tasks/t1/stop'));
        await page.close();

        // Signed out: a word to sign in, and nothing asked.
        const before = seen.length;
        const out = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
        await out.goto(base + '/?out=1', { maxMs: 5000 });
        await wait(300);
        assert.match(await out.evaluate(`document.querySelector('.ovdc-list').textContent`), /Sign in to start coding tasks/);
        assert.equal(seen.length, before, 'nothing is asked without a token');
        await out.close();

        // Codes cannot be reached: the list says where your tasks are, and the box opens openvibe.codes with your words.
        up = false;
        const down = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
        await down.goto(base + '/', { maxMs: 5000 });
        await wait(300);
        assert.match(await down.evaluate(`document.querySelector('.ovdc-list').textContent`), /Your tasks are on openvibe\.codes/);
        await down.evaluate(`(() => { const t = document.querySelector('.ovdc-text'); t.value = 'A goal bar'; t.dispatchEvent(new Event('input')); document.querySelector('.ovdc-go').click(); })()`);
        const went = await (async () => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await down.evaluate('location.pathname + location.search').catch(() => ''); if (v.startsWith('/codes')) return v; await wait(50); } return ''; })();
        assert.equal(went, '/codes/?prompt=A+goal+bar&mode=create', 'it opens Codes with what you wrote');
        await down.close();
        console.log('dock-code-chrome: tasks (running first, state, repository, Stop), My code asks for the repository, Ctrl+Enter starts one, signed out, Codes unreachable opens Codes with your words');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
