'use strict';
// The menu's box looks the same wherever you are (4.286.0; the owner, 11-16, the Vibe door's "Plan my week" beside
// You → Alerts' "Search your alerts": "Still inconsistent", then "I liked the bolder font you had going on, that was
// like thicker and like had a cool animation"). In a real headless Chrome at 390 × 844, signed in: the words start at
// the same place, in the same size, weight and colour, whether they are a suggestion line (Vibe) or the box's own words
// (Alerts, History, Feed); the open button has no disc behind it in either; and the words fit a phone. Skipped without
// Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-box-look-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const SITES = ['live', 'chat', 'community', 'video', 'design', 'games', 'space', 'codes']
    .map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), url: `https://openvibe.${id}/`, icon: id, group: 'play' }));
const FRAME = { nav: SITES, groups: [{ id: 'play', name: 'Play' }], soon: [], footer: {} };
const NOTES = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, type: 'follow', title: `Person ${i + 1} followed you`, body: 'Say hello back.',
    url: 'https://openvibe.live/p', is_read: i > 1, created_at: new Date(Date.now() - i * 600e3).toISOString(), service: 'live' }));

const page = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Box</title><link rel="icon" href="data:,">
<script>
  const J = (b, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => b, headers: new Headers({ 'content-type': 'application/json' }) });
  const realFetch = window.fetch;
  window.fetch = (u, o) => {
    const s = String(u);
    if (s.startsWith('https://openvibe.network/api/frame?')) return J(${JSON.stringify(FRAME)});
    if (s.includes('/api/notifications/unread-count')) return J({ count: 2 });
    if (s.includes('/api/notifications/unread-by-tab')) return J({ tabs: {} });
    if (s.includes('/api/notifications?')) return J({ notifications: ${JSON.stringify(NOTES)}, total: 4, has_more: false });
    if (s.startsWith('https://')) return J({}, false, 404);
    return realFetch(u, o);
  };
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div><main style="height:2000px">Page</main>
<script>document.addEventListener('DOMContentLoaded', function () { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} OpenVibeNavbar.init({ service: 'site', user: { id: 'u1', username: 'ada', display_name: 'Ada' }, token: 'tok-1', links: [], countViews: false }); });</script>
</body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css|woff2))$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': m[1].endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page());
});

// How the box's words look right now: the suggestion line when it shows, else the box's own placeholder. A colour is
// compared as its red, green and blue with the alpha it is drawn at (the line's opacity, the placeholder's alpha).
const LOOK = `(() => {
    const ovs = document.querySelector('.ovs.is-open'); const input = ovs && ovs.querySelector('.ovs-input'); if (!input) return null;
    const rgba = (c, op) => { const m = String(c).match(/[\\d.]+/g) || []; let [r, g, b, a] = m.map(Number);
        if (/^color\\(srgb/.test(c)) { r *= 255; g *= 255; b *= 255; } return [Math.round(r), Math.round(g), Math.round(b), Math.round((a == null ? 1 : a) * op * 100) / 100]; };
    // This box's own line (ov-trending puts it right after its box), never another box's on the page (the bar's search).
    const ghost = [...ovs.querySelectorAll('.ovt-ghost')].find((x) => !x.hidden && x.offsetParent && x.previousElementSibling === input);
    const ib = input.getBoundingClientRect(); const ic = getComputedStyle(input);
    const start = Math.round(ib.left + parseFloat(ic.paddingLeft) + parseFloat(ic.borderLeftWidth));   // where typing starts
    const place = ovs.querySelector('a.ovs-ctx'); const pc = place ? getComputedStyle(place) : null;
    const disc = pc ? (pc.backgroundColor !== 'rgba(0, 0, 0, 0)' && pc.backgroundColor !== 'transparent') || pc.borderTopWidth !== '0px' : false;
    if (ghost) {
        const term = ghost.querySelector('.ovt-term'); const c = getComputedStyle(ghost); const rg = document.createRange(); rg.selectNodeContents(term || ghost);
        return { kind: 'line', words: ghost.textContent.trim(), x: Math.round(rg.getBoundingClientRect().left), start, size: c.fontSize, weight: c.fontWeight, color: rgba(c.color, Number(c.opacity)), disc };
    }
    const c = getComputedStyle(input); const p = getComputedStyle(input, '::placeholder');
    const probe = document.createElement('span'); probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + c.font + ';letter-spacing:' + c.letterSpacing; probe.textContent = input.placeholder; document.body.appendChild(probe);
    const wide = probe.getBoundingClientRect().width; probe.remove();
    const r = input.getBoundingClientRect();
    return { kind: 'words', words: input.placeholder, x: Math.round(r.left + parseFloat(c.paddingLeft) + parseFloat(c.borderLeftWidth)), start, size: p.fontSize, weight: p.fontWeight, color: rgba(p.color, 1), disc,
        fits: wide <= r.width - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight) + 1 };
})()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-box-look-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(60); } };
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.goto(`${base}/`, { maxMs: 6000 });
        await until(p, "!!document.getElementById('openvibe-burger') || !!document.getElementById('openvibe-search-btn')");
        await p.evaluate("(document.getElementById('openvibe-burger') || document.getElementById('openvibe-search-btn')).click(), true");
        assert.ok(await until(p, "!!document.querySelector('.ovs.is-open [data-tab=\"vibe\"]')"), 'the menu opened, with the Vibe door');
        await p.evaluate("document.querySelector('.ovs [data-tab=\"vibe\"]').click(), true");
        assert.ok(await until(p, "(() => { const ovs = document.querySelector('.ovs.is-open'); const i = ovs && ovs.querySelector('.ovs-input'); const g = i && i.nextElementSibling; return !!(g && g.classList.contains('ovt-ghost') && !g.hidden && g.textContent.trim()); })()"), 'Vibe suggests something to ask');
        await wait(1200);   // the open button's turn settles
        // The steady state, as a person sees it once the menu has settled: the line sits where typing starts. A line left
        // behind where its box was measured mid-animation never gets there (4.286.0: ov-trending re-places after one).
        await until(p, `(() => { const l = ${LOOK}; return l && l.kind === 'line' && Math.abs(l.x - l.start) <= 1; })()`, 4000);
        await until(p, "!document.querySelector('.ovs.is-open a.ovs-ctx.is-hint')", 4000);
        const vibe = await p.evaluate(LOOK);
        assert.strictEqual(vibe.kind, 'line');
        // The line is as wide as the box's typing room (Chrome 157 counts an input's padding out of clientWidth: it was 30 px
        // narrower there).
        const room = await p.evaluate(`(() => { const ovs = document.querySelector('.ovs.is-open'); const i = ovs.querySelector('.ovs-input'); const g = i.nextElementSibling; const c = getComputedStyle(i);
            return [Math.round(g.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().width - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight) - parseFloat(c.borderLeftWidth) - parseFloat(c.borderRightWidth))]; })()`);
        assert.ok(Math.abs(room[0] - room[1]) <= 1, `the line is as wide as the typing room (${room[0]} vs ${room[1]})`);
        if (Math.abs(vibe.x - vibe.start) > 1) {
            // Where the 30 px comes from, when it does (CI's Chrome only so far): every box between the field and the words.
            const geo = await p.evaluate(`(() => { const ovs = document.querySelector('.ovs.is-open'); const i = ovs.querySelector('.ovs-input'); const g = i.nextElementSibling;
                const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const c = getComputedStyle(e); return { cls: String(e.className).slice(0, 40), x: Math.round(b.left), w: Math.round(b.width),
                    pos: c.position, disp: c.display, pl: c.paddingLeft, ml: c.marginLeft, ti: c.textIndent, left: c.left, tr: c.transform === 'none' ? '' : c.transform, ta: c.textAlign, jc: c.justifyContent }; };
                const line = g && g.querySelector('.ovt-line'); const pre = line && line.querySelector('.ovt-pre'); const term = line && line.querySelector('.ovt-term');
                const C = (e) => (e ? String(e.className || e.tagName).slice(0, 40) : null);
                return { offsets: { inputOffsetLeft: i.offsetLeft, inputOffsetParent: C(i.offsetParent), inputClientLeft: i.clientLeft, ghostOffsetLeft: g && g.offsetLeft, ghostOffsetParent: g && C(g.offsetParent), fieldOffsetLeft: i.parentElement.offsetLeft, fieldClientLeft: i.parentElement.clientLeft, fieldScrollLeft: i.parentElement.scrollLeft, inputScrollLeft: i.scrollLeft, chain: (() => { const out = []; for (let n = i; n && out.length < 6; n = n.offsetParent) out.push([C(n), n.offsetLeft, n.clientLeft, n.scrollLeft]); return out; })() },
                    field: R(i.parentElement), input: R(i), ghost: R(g), ghostStyleLeft: g && g.style.left, offsetParent: g && g.offsetParent && String(g.offsetParent.className).slice(0, 40),
                    lines: g ? g.querySelectorAll('.ovt-line').length : 0, line: R(line), pre: R(pre), preText: pre && JSON.stringify(pre.textContent), term: R(term), styleEl: !!document.getElementById('ovt-style') || !!document.querySelector('style[data-ovt]'), ua: navigator.userAgent }; })()`);
            assert.fail(`"${vibe.words}" starts where typing starts (${vibe.x} vs ${vibe.start}): ${JSON.stringify(geo)}`);
        }

        const seen = [];
        for (const tab of ['notifications', 'recent']) {
            await p.evaluate("document.querySelector('.ovs [data-tab=\"you\"]').click(), true");
            await until(p, `!!document.querySelector('.ovh-tab[data-tab="${tab}"]')`);
            await p.evaluate(`document.querySelector('.ovh-tab[data-tab="${tab}"]').click(), true`);
            await wait(1200);
            // The open button turns with the place, tinted for a moment (0.9 s): measured once that is over (a slow
            // runner, GitHub's macOS, measured mid-turn and saw the tint as a disc).
            await until(p, "!document.querySelector('.ovs.is-open a.ovs-ctx.is-hint')", 4000);
            seen.push(await p.evaluate(LOOK));
        }
        for (const s of seen) {
            assert.strictEqual(s.kind, 'words', `${s.words}: the box's own words`);
            assert.ok(Math.abs(s.x - s.start) <= 1 && Math.abs(s.start - vibe.start) <= 1, `${s.words}: starts where typing starts, as "${vibe.words}" does (${s.x} vs ${vibe.x})`);
            assert.strictEqual(s.size, vibe.size, `${s.words}: the same size as the line (${vibe.size})`);
            assert.strictEqual(s.weight, vibe.weight, `${s.words}: the same weight`);
            assert.deepStrictEqual(s.color, vibe.color, `${s.words}: the same colour, drawn as strongly`);
            assert.ok(s.fits, `${s.words}: fits a phone`);
            assert.strictEqual(s.disc, false, `${s.words}: no disc behind the open button`);
        }
        assert.strictEqual(vibe.disc, false, 'Vibe: no disc behind the open button');
        assert.ok(parseFloat(vibe.size) >= 16, `the bolder size the owner liked (${vibe.size})`);
        console.log(`menu-box-look-chrome: "${vibe.words}" and ${seen.map((s) => `"${s.words}"`).join(', ')} look the same (${vibe.size}, from x ${vibe.x})`);
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
