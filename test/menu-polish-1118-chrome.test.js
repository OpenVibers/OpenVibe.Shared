'use strict';
// The menu, tidied after the owner's phone shots of 11-18 (4.317.0), in a real headless Chrome at 390 × 844, signed in:
// - Vibe: Actor, Codes and Your AI "took the whole screen … make it collapse": they fold into one row (one tap opens the
//   full cards and back), and the sessions under them are tight ("reduce spacing, padding").
// - The box's long suggestion ("Deep dive the be…", "animate to see full") slides to show its end.
// - Alerts: one search, the box's ("type search" up there): no second field; Unread sits on the slim bar beside the count,
//   Clear all and Inbox ("make a bit more compact"); the agents' filter says AI ("shorten to AI"); an operator alert says
//   its severity in its meta line, not as a WARNING chip ("update, improve").
// - History: "as you scroll everything fades in flashing" and "not infinite scroll": a row comes in once, when it is
//   added, and the list goes on past the first page of the account's history to its end.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-polish-1118-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const SITES = ['live', 'chat', 'community', 'design', 'tools'].map((id) => ({ id, name: id, url: `https://openvibe.${id}/`, icon: id, group: 'play' }));
const FRAME = { nav: SITES, groups: [{ id: 'play', name: 'Play' }], soon: [], footer: {} };
const now = Date.now();
const iso = (ms) => new Date(now - ms).toISOString();
const NOTES = [
    { id: 101, type: 'AGENT_TASK_FAILED', category: 'agents', service: 'actor', title: 'Your task did not finish', message: 'Not finished: Add unit tests', url: 'https://openvibe.actor/t/1', is_read: false, created_at: iso(3600e3), rich_content: { task_title: 'Add unit tests' } },
    { id: 102, type: 'OPERATOR_ALERT', category: 'system', service: 'network', priority: 'high', title: 'Alert: developer_path_missed', message: 'Missed.', url: 'https://openvibe.network/status', is_read: false, created_at: iso(2 * 3600e3),
        rich_content: { kind: 'ops_alert', name: 'developer_path_missed', state: 'firing', severity: 'warning', sites: ['openvibe.codes'], summary: 'The developer path was missed.' } },
];
const HIST = Array.from({ length: 100 }, (_, i) => ({ id: 9000 - i, type: 'page', title: `Place ${i + 1}`, url: `https://openvibe.design/p/${i + 1}`, service: 'design', service_label: 'Design', updated_at: iso((i + 1) * 3 * 3600e3) }));
const RUNS = Array.from({ length: 8 }, (_, i) => ({ ref: `r${i}`, id: `r${i}`, title: `Session ${i + 1}`, status: 'done', agent: 'actor', updated_at: iso((i + 1) * 5400e3), preview: { text: 'Here is what I found.' } }));

const page = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Menu</title><link rel="icon" href="data:,">
<script>
  const J = (b, status = 200) => Promise.resolve(new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } }));
  const realFetch = window.fetch;
  window.fetch = (u, o) => {
    const s = String(u);
    if (s.startsWith('https://openvibe.network/api/frame?')) return J(${JSON.stringify(FRAME)});
    if (s.startsWith('https://openvibe.network/api/frame/runs?')) return J({ runs: ${JSON.stringify(RUNS)} });
    if (s === 'https://openvibe.network/api/frame/actor') return J({ id: 'a1', name: 'Maticus', state: 'idle' });
    if (s.includes('/api/notifications/unread-count')) return J({ count: 2 });
    if (s.includes('/api/notifications/unread-by-tab')) return J({ tabs: { agents: 1, system: 1 } });
    if (s.includes('/api/notifications?')) return J({ notifications: ${JSON.stringify(NOTES)}, total: 2, has_more: false });
    if (s.startsWith('https://openvibe.network/api/history')) return realFetch('/hist' + s.slice(s.indexOf('/api/history') + 12), o);
    if (s.startsWith('https://')) return J({}, 404);
    return realFetch(u, o);
  };
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div><main style="height:2000px">Page</main>
<script>document.addEventListener('DOMContentLoaded', function () { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} OpenVibeNavbar.init({ service: 'live', user: { id: 'u1', username: 'ada', display_name: 'Ada' }, token: 'tok-1', links: [], countViews: false }); });</script>
</body></html>`;

let pages = 0;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/hist')) {
        const q = new URL(`https://x/api/history${u.pathname.slice(5)}${u.search}`);
        res.writeHead(200, { 'content-type': 'application/json' });
        if (q.searchParams.get('type') === 'search') return res.end(JSON.stringify({ items: [] }));
        pages++;
        const limit = Number(q.searchParams.get('limit') || 50);
        const cur = q.searchParams.get('cursor');
        const start = cur ? Number(Buffer.from(cur, 'base64url').toString()) : 0;
        const next = start + limit < HIST.length ? Buffer.from(String(start + limit)).toString('base64url') : null;
        return res.end(JSON.stringify({ items: HIST.slice(start, start + limit), total: HIST.length, next_cursor: next, services: [] }));
    }
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css|woff2))$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': m[1].endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page()); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-menu-polish-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(60); } };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.goto(`${base}/`, { maxMs: 6000 });
        await until(p, "!!document.getElementById('openvibe-burger') || !!document.getElementById('openvibe-search-btn')");
        await p.evaluate("(() => { const a = document.getElementById('openvibe-burger'); const b = document.getElementById('openvibe-search-btn'); ((a && a.getBoundingClientRect().width) ? a : b).click(); return 1; })()");
        assert.ok(await until(p, "!!document.querySelector('.ovs.is-open [data-tab=\"vibe\"]')"), 'the menu opened');

        // Vibe: your agents in one row; the full cards a tap away; the sessions tight.
        await p.evaluate("document.querySelector('.ovs [data-tab=\"vibe\"]').click(), 1");
        assert.ok(await until(p, "!!document.querySelector('.ovs .ovse-menu')"), 'Vibe opened');
        await p.evaluate("(() => { const m = document.querySelector('.ovs .ovse-menu'); if (m.getAttribute('aria-expanded') !== 'true') m.click(); return 1; })()");
        const AGENTS = `(() => { const a = document.querySelector('.ovs .ovse-agents'); if (!a) return null; const f = a.querySelector('.ovse-agents-fold');
            const shown = [...a.querySelectorAll(':scope > .ovse-actor')].filter((x) => x.getBoundingClientRect().height > 0);
            const tops = new Set(shown.map((x) => Math.round(x.getBoundingClientRect().top)));
            return { folded: a.classList.contains('is-folded'), h: Math.round(a.getBoundingClientRect().height), cards: shown.length, rows: tops.size, expanded: f.getAttribute('aria-expanded'),
                set: shown.some((x) => { const s = x.querySelector('.ovse-actor-set'); return !!(s && s.getBoundingClientRect().width); }) }; })()`;
        const folded = await h.eventually(async () => { const x = await p.evaluate(AGENTS); assert.ok(x && x.folded && x.cards >= 2 && x.rows === 1 && x.h <= 60 && !x.set && x.expanded === 'false', `your agents fold into one row (${JSON.stringify(x)})`); return x; });
        await p.evaluate("document.querySelector('.ovs .ovse-agents-fold').click(), 1");
        await h.eventually(async () => { const x = await p.evaluate(AGENTS); assert.ok(x && !x.folded && x.rows === x.cards && x.set && x.expanded === 'true', `one tap opens the full cards, their settings with them (${JSON.stringify(x)})`); });
        await p.evaluate("document.querySelector('.ovs .ovse-agents-fold').click(), 1");
        await h.eventually(async () => { const x = await p.evaluate(AGENTS); assert.ok(x && x.folded, 'and folds them again'); });
        const rows = await h.eventually(async () => {
            const x = await p.evaluate("[...document.querySelectorAll('.ovs .ovse-runs .ovse-row:not(.is-ghost)')].slice(0, 4).map((r) => Math.round(r.getBoundingClientRect().height))");
            assert.ok(x.length >= 3 && x.every((v) => v >= 44 && v <= 56), `the sessions are tight rows, 44 to 56 px (${x})`); return x;
        });

        // The box's long suggestion slides to show its end.
        await p.evaluate("(() => { const i = document.querySelector('.ovs.is-open .ovs-input'); window.OVTrending.attach(i, { items: [{ query: 'Deep dive the best budget phones for streaming in the year 2026', pre: '' }, { query: 'Plan my week', pre: '' }] }); return 1; })()");
        await h.eventually(async () => {
            const x = await p.evaluate("(() => { const l = document.querySelector('.ovs.is-open .ovt-line'); const r = l && l.querySelector('.ovt-run'); return l ? { long: l.classList.contains('is-long'), x: r ? new DOMMatrix(getComputedStyle(r).transform).m41 : 0, text: l.textContent } : null; })()");
            assert.ok(x && x.long && x.x < -8 && /^Deep dive/.test(x.text), `the long suggestion slides to show its end (${JSON.stringify(x)})`);
        }, { timeout: 9000 });

        // You → Alerts: one search, Unread on the slim bar, "AI", the severity in the meta line.
        await p.evaluate("document.querySelector('.ovs [data-tab=\"you\"]').click(), 1");
        assert.ok(await until(p, "!!document.querySelector('.ovh-tab[data-tab=\"notifications\"]')"), 'You opened');
        await p.evaluate("document.querySelector('.ovh-tab[data-tab=\"notifications\"]').click(), 1");
        const alerts = await h.eventually(async () => {
            const x = await p.evaluate(`(() => { const ovs = document.querySelector('.ovs'); const f = ovs.querySelector('.openvibe-nv-find'); const ops = ovs.querySelector('.openvibe-notif-item.is-ops');
                const tab = ovs.querySelector('.openvibe-nv-tabs [data-tab="agents"]'); const un = ovs.querySelector('.openvibe-nv-bar .openvibe-nv-unread');
                return { find: !!(f && f.getBoundingClientRect().height), tab: tab ? tab.firstChild && tab.textContent.replace(/\\d+$/, '').trim() : null, unread: un ? un.textContent.trim() : null, unreadH: un ? Math.round(un.getBoundingClientRect().height) : 0,
                    meta: ops ? ops.querySelector('.meta').textContent.trim() : null, chip: !!ovs.querySelector('.openvibe-notif-item.is-ops .ovn-chip.sev') }; })()`);
            assert.strictEqual(x.find, false, 'no second search field under the box');
            assert.strictEqual(x.tab, 'AI', `the agents' filter says AI (${x.tab})`);
            assert.ok(x.unread === 'Unread' && x.unreadH >= 34, `Unread is on the slim bar, with its word (${JSON.stringify(x)})`);
            assert.ok(x.meta && /^Warning/.test(x.meta) && !x.chip, `the operator alert leads its meta with its severity, no chip (${JSON.stringify(x)})`);
            return x;
        });

        // You → History: rows come in once; the list goes on to the end of the account's history.
        await p.evaluate("document.querySelector('.ovh-tab[data-tab=\"recent\"]').click(), 1");
        assert.ok(await until(p, "document.querySelectorAll('.ovh-hrow').length >= 12"), 'History drew its first rows');
        // Count entrances once the opening rows have made theirs.
        assert.ok(await until(p, "document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('ovh-hrow') && a.playState !== 'finished').length === 0", 6000), 'the first rows settled');
        await p.evaluate("(() => { window.__rowIns = 0; document.addEventListener('animationstart', (e) => { if (e.target.classList && e.target.classList.contains('ovh-hrow')) window.__rowIns++; }, true); return 1; })()");
        const start = await p.evaluate("document.querySelectorAll('.ovh-hrow').length");
        const total = await h.eventually(async () => {
            await p.evaluate("(() => { const rows = document.querySelectorAll('.ovh-hrow'); rows[rows.length - 1].scrollIntoView({ block: 'end' }); const m = document.querySelector('.ovh-hist-more'); if (m && !m.hidden) m.scrollIntoView({ block: 'end' }); return 1; })()");
            const n = await p.evaluate("document.querySelectorAll('.ovh-hrow').length");
            assert.strictEqual(n, HIST.length, `scrolling goes on to the end of the history (${n} of ${HIST.length})`);
            return n;
        }, { timeout: 30000, every: 300 });
        const ins = await p.evaluate('window.__rowIns');
        assert.ok(ins <= total - start, `only the rows added came in (${ins} entrances for ${total - start} new rows): the ones there stay still`);
        assert.ok(pages >= 2, `the next page of the account's history was read (${pages} reads)`);
        await h.eventually(async () => assert.strictEqual(await p.evaluate("(() => { const m = document.querySelector('.ovh-hist-more'); return !m || m.hidden; })()"), true, 'at the end, no Show more'));
        console.log(`menu-polish-1118-chrome: agents fold to one row (${folded.h} px) and open, sessions ${rows.join('/')} px; the long line slides; Alerts: one search, Unread on the bar, "${alerts.tab}", "${alerts.meta}"; History ${start} → ${total} rows over ${pages} reads, ${ins} entrances`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
