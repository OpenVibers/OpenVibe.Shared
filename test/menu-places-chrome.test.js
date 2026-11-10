'use strict';
// The menu's head is one row of places (4.194.0) in a real headless Chrome. The owner, 2026-11-10, with the menu and the
// Dock side by side: "combine and consolidate these two menus into one unified menu … It just seems a little much with
// all the buttons on the first one". Where the bar can open the Dock for the person: this site, Feed, Messages, AI, You,
// in that order, in ONE row, with no second row under it; Messages and AI open the Dock on those places and are never
// the chosen tab here. For a visitor: this site, Feed, You, as before.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-places-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat</title><link rel="icon" href="data:,"></head>
<body style="margin:0;min-height:100vh;background:#0b1120"><script>window.fetch = async () => new Response('{}', { status: 404 });</script><script src="/search.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    const f = path.join(root, u.slice(1));
    if (/^\/[a-z-]+\.js$/.test(u) && fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(f)); }
    res.writeHead(404); res.end();
});
const OPEN = (dock) => `OpenVibeSearch.open({ service: 'chat', scope: { label: 'Chat', page: '/search' }, links: [{ label: 'Rooms', href: '/rooms' }], frame: {}, token: ${dock ? "'t'" : 'null'}, from: document.body,
    user: ${dock ? "{ id: 7, username: 'maya', display_name: 'Maya' }" : 'null'}, dock: ${dock ? '(id) => { window.went = id; }' : 'null'},
    dockTimer: () => { window.timerCalled = true; }, ask: (text) => { window.asked = text; }, section: 'notifications' })`;
const ROW = `Array.from(document.querySelectorAll('.ovs-starttabs .ovs-tab')).map((t) => { const r = t.getBoundingClientRect(); return { label: t.textContent.trim(), chosen: t.getAttribute('aria-selected') === 'true', door: t.getAttribute('data-dock') || '', role: t.getAttribute('role'), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; })`;
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-places-'));
    const browser = await h.launch({ tmpDir });
    try {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        for (const [width, height, name] of [[390, 780, 'a phone'], [1280, 800, 'a computer']]) {
            const page = await h.openPage(browser, await browser.newContext(), { width, height });
            await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
            const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { if (await page.evaluate(expr)) return true; await wait(60); } return false; };
            await page.evaluate(`window.OpenVibeNotifications = { unread: () => 7, renderMenuNotifications(host, count) { host.innerHTML = '<div data-role="list">five newest</div>'; count(12); return { showAll() { window.notificationsExpanded = true; } }; } };`);
            // Signed in, with the Dock: five places in one row.
            await page.evaluate(OPEN(true));
            assert.ok(await until(`document.querySelectorAll('.ovs.is-open .ovs-starttabs .ovs-tab').length === 5`), `${name}: five places`);
            await wait(350);
            const row = await page.evaluate(ROW);
            assert.deepEqual(row.map((t) => t.label.replace(/\d+$/, '') + (t.chosen ? '*' : '') + (t.door ? `>${t.door}` : '')), ['Chat*', 'Feed', 'Messages>chats', 'AI>vibe', 'You'], `${name}: this site, Feed, Messages, AI, You, in that order`);
            assert.ok(row.every((t) => t.top === row[0].top), `${name}: one row (${row.map((t) => t.top).join(',')})`);
            assert.ok(row.every((t) => Math.abs(t.w - row[0].w) <= 1 && t.h >= 42), `${name}: the same width each, and tall enough to press (${row.map((t) => `${t.w}x${t.h}`).join(' ')})`);
            assert.ok(row.every((t) => t.role === 'tab') && row[row.length - 1].right <= width, `${name}: all on the screen`);
            assert.deepEqual(await page.evaluate(`Array.from(document.querySelectorAll('.ovs-starttabs .ovs-tab')).map((t) => t.dataset.tab)`), ['here', 'feed', 'chats', 'vibe', 'you'], `${name}: stable place ids`);
            assert.equal(await page.evaluate('OpenVibeSearch._state().from === document.body'), true, `${name}: opening source retained`);
            assert.equal(await page.evaluate(`document.querySelectorAll('.ovs-bridge, .ovs-bridge-b').length`), 0, `${name}: no second row of buttons under the tabs`);
            assert.equal(await page.evaluate(`document.querySelectorAll('.ovs-starttabs .ovs-tab svg, .ovs-starttabs .ovs-tab .ovs-tab-ic').length >= 4`), true, `${name}: each place has its icon`);
            await page.evaluate(`document.querySelector('.ovs-starttabs [data-tab="you"]').click()`);
            assert.equal(await page.evaluate(`document.querySelector('.ovs-starttabs [data-tab="you"] .ovs-tabnew-red').textContent`), '7', `${name}: You has the red unread badge`);
            assert.equal(await page.evaluate(`document.querySelector('.ovs-list [data-sec="notifications"] .ovs-notifications-host [data-role="list"]')?.textContent`), 'five newest', `${name}: You starts with the notifications preview`);
            assert.equal(await page.evaluate(`document.querySelector('.ovs-list [data-sec="notifications"] .ovs-fold')?.textContent`), 'Show all 12', `${name}: notification expansion count`);
            await page.evaluate(`document.querySelector('.ovs-list [data-sec="notifications"] .ovs-fold').click()`);
            assert.equal(await page.evaluate('window.notificationsExpanded'), true, `${name}: notifications expand in place`);
            await page.evaluate(`document.querySelector('.ovs-starttabs [data-tab="here"]').click()`);
            // AI opens the Dock on Vibe; Messages on the conversations; neither becomes the chosen tab.
            await page.evaluate(`document.querySelector('.ovs-starttabs [data-dock="vibe"]').click()`);
            assert.equal(await page.evaluate('window.went'), 'vibe', `${name}: AI opens the Dock's Vibe`);
            await page.evaluate(`document.querySelector('.ovs-starttabs [data-dock="chats"]').click()`);
            assert.equal(await page.evaluate('window.went'), 'chats', `${name}: Messages opens the Dock's conversations`);
            assert.deepEqual((await page.evaluate(ROW)).filter((t) => t.chosen).map((t) => t.label), ['Chat'], `${name}: the chosen tab is still this site's`);
            // Feed is a tab of this sheet.
            await page.evaluate(`document.querySelector('.ovs-starttabs [data-tab="feed"]').click()`);
            assert.ok(await until(`(document.querySelector('.ovs-starttabs [aria-selected="true"]') || {}).textContent.trim().startsWith('Feed')`), `${name}: Feed is chosen in place`);
            await page.evaluate('OpenVibeSearch.close()'); await wait(300);
            // On a phone, with the Dock able to lend its panels (OpenVibeDock.mountInto, 312 step 2): Messages and AI open
            // INSIDE the menu, under its own head, and become the chosen place; AI has a Vibe · Agents switch; Feed and
            // closing hand the panel back. A computer keeps the floating Dock.
            await page.evaluate(`window.went = null; window.log = []; window.OpenVibeDock = { filterChats(q) { window.filtered = q; }, mountInto(host, o) { window.log.push('mount:' + o.tab); host.innerHTML = '<div class="stub"></div>';
                return { show(t) { window.log.push('show:' + t); }, destroy() { window.log.push('destroy'); host.innerHTML = ''; } }; } }`);
            await page.evaluate(OPEN(true)); await wait(350);
            const inside = async () => page.evaluate(`({ door: !!document.querySelector('.ovs.ovs-in-door'), list: !document.querySelector('.ovs-list').hidden, stub: !!document.querySelector('.ovs-door-host .stub'),
                sw: document.querySelector('.ovs-door-sw') && !document.querySelector('.ovs-door-sw').hidden ? Array.from(document.querySelectorAll('.ovs-door-sw [data-part]')).map((b) => b.textContent + (b.getAttribute('aria-selected') === 'true' ? '*' : '')).join(' ') : '',
                chosen: Array.from(document.querySelectorAll('.ovs-starttabs .ovs-tab[aria-selected="true"]')).map((t) => t.textContent.trim()).join(' ') })`);
            await page.evaluate(`document.querySelector('.ovs-starttabs [data-dock="vibe"]').click()`); await wait(120);
            if (width <= 640) {
                assert.deepEqual(await inside(), { door: true, list: false, stub: true, sw: 'Vibe* Agents', chosen: 'AI' }, `${name}: AI opens inside the menu, on Vibe`);
                assert.equal(await page.evaluate('window.went'), null, `${name}: no floating Dock`);
                await page.evaluate(`document.querySelector('.ovs-door-sw [data-part="agent"]').click()`); await wait(80);
                assert.equal((await inside()).sw, 'Vibe Agents*', `${name}: the switch goes to Agents`);
                await page.evaluate(`document.querySelector('.ovs-ai-timer').click()`);
                assert.equal(await page.evaluate('window.timerCalled'), true, `${name}: AI timer entry`);
                await page.evaluate(`document.querySelector('.ovs-input').value = 'find this'; document.querySelector('.ovs-input').dispatchEvent(new Event('input', { bubbles: true }));`); await wait(170);
                await page.evaluate(`document.querySelector('.ovs-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));`);
                assert.equal(await page.evaluate('window.asked'), 'find this', `${name}: AI Enter hands its text to Vibe`);
                await page.evaluate(`document.querySelector('.ovs-input').value = ''; document.querySelector('.ovs-input').dispatchEvent(new Event('input', { bubbles: true }));`);
                await page.evaluate(`document.querySelector('.ovs-starttabs [data-dock="chats"]').click()`); await wait(80);
                assert.deepEqual(await inside(), { door: true, list: false, stub: true, sw: '', chosen: 'Messages' }, `${name}: Messages inside the menu, no switch`);
                await page.evaluate(`document.querySelector('.ovs-input').value = 'sara'; document.querySelector('.ovs-input').dispatchEvent(new Event('input', { bubbles: true }));`); await wait(180);
                assert.equal(await page.evaluate('window.filtered'), 'sara', `${name}: Messages search filters conversations in place`);
                await page.evaluate(`document.querySelector('.ovs-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));`);
                assert.equal(await page.evaluate(`!!(document.querySelector('.ovs-input').value === '' && document.querySelector('.ovs.is-open'))`), true, `${name}: Escape clears before closing`);
                await page.evaluate(`document.querySelector('.ovs-starttabs [data-tab="feed"]').click()`); await wait(80);
                assert.deepEqual(await inside(), { door: false, list: true, stub: false, sw: '', chosen: 'Feed' }, `${name}: Feed hands the panel back`);
                await page.evaluate(`document.querySelector('.ovs-starttabs [data-dock="vibe"]').click()`); await wait(80);
                await page.evaluate('OpenVibeSearch.close()'); await wait(300);
                assert.deepEqual(await page.evaluate('window.log'), ['mount:vibe', 'show:agent', 'show:chats', 'destroy', 'mount:agent', 'destroy'], `${name}: one mount at a time, handed back on Feed and on close`);
            } else {
                assert.equal(await page.evaluate('window.went'), 'vibe', `${name}: AI still opens the floating Dock`);
                assert.deepEqual(await page.evaluate('window.log'), [], `${name}: nothing mounted in the menu`);
                await page.evaluate('OpenVibeSearch.close()'); await wait(300);
            }
            await page.evaluate('delete window.OpenVibeDock');
            // Opened from a button: the sheet grows out of that button's centre, wherever the sheet itself was placed.
            if (width > 900) {
                await page.evaluate(OPEN(true).replace("frame: {},", `frame: {}, anchor: { top: 52, left: ${width - 150}, cx: ${width - 130}, cy: 26 },`));
                assert.ok(await until(`!!document.querySelector('.ovs.is-open.ovs-anchored .ovs-panel')`), 'opened from a button');
                // Measured once the sheet has stopped growing: a fixed wait read it mid-motion on a busy machine (2026-11-10).
                await wait(120);
                await until(`document.querySelector('.ovs-panel').getAnimations().every((a) => a.playState !== 'running')`);
                const o = await page.evaluate(`(() => { const p = document.querySelector('.ovs-panel'), r = p.getBoundingClientRect(); return { origin: parseFloat(getComputedStyle(p).transformOrigin), left: r.left, right: r.right }; })()`);
                assert.ok(Math.abs(o.origin - (width - 130 - o.left)) <= 2, `the sheet's origin is the pressed button's centre (${JSON.stringify(o)})`);
                assert.ok(o.right <= width && o.left >= 0, `and the sheet is wholly on the screen (${JSON.stringify(o)})`);
                await page.evaluate('OpenVibeSearch.close()'); await wait(300);
            }
            // A visitor: three places, as before.
            await page.evaluate(OPEN(false));
            assert.ok(await until(`document.querySelectorAll('.ovs.is-open .ovs-starttabs .ovs-tab').length === 3`), `${name}: a visitor has this site, Feed and You`);
            assert.deepEqual((await page.evaluate(ROW)).map((t) => t.label), ['Chat', 'Feed', 'You'].map((x, i) => x), `${name}: in that order`);
            await page.close();
        }
        const page = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 800 });
        await page.goto('http://127.0.0.1:' + server.address().port + '/', { maxMs: 6000 });
        await page.evaluate("new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/navbar.js'; document.head.appendChild(s); s.onload = () => { OpenVibeNavbar.init({ service: 'chat', auth: 'external', user: { id: 7, username: 'maya', display_name: 'Maya' }, token: 't', search: true, dock: true, links: [] }); ok(); }; s.onerror = no; })");
        const endBell = Date.now() + 7000;
        while (!await page.evaluate("!!document.querySelector('.openvibe-bell')") && Date.now() < endBell) await wait(80);
        await page.evaluate("document.querySelector('.openvibe-bell').click()"); await wait(500);
        assert.equal(await page.evaluate("!!document.querySelector('.ovs.is-open .ovs-starttabs [data-tab=you][aria-selected=true]')"), true, '1280 px bell opens You in the menu');
        assert.equal(await page.evaluate("!!document.querySelector('.ovdk.is-open')"), false, '1280 px bell does not open the floating Dock');
        await page.close();
        console.log('menu-places-chrome: Notifications in You, red unread badge and in-place expansion; stable tab ids; bell opens You at 1280px; phone Messages and AI search stay in place');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((err) => { console.error(err); process.exit(1); });
