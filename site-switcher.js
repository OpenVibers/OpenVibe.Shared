/**
 * site-switcher.js — the site switcher behind the OpenVibe icon (4.48.0).
 *
 * The owner, 2026-10-30: "clicking the icon … should have its own drop-down that lets you very quickly … a more compact
 * view of all the OpenVibe domains … tools and services … all the sites, so you can hop between them fast and easy.
 * And make it ordered based on whatever makes sense." The navbar loads this on the first tap of its mark (as it loads
 * search.js for the menu) and calls OpenVibeSiteSwitcher.open().
 *
 * Order:
 * - Recent: the sites this person was on last (their account's list when signed in, from
 *   /api/themes/me/sites; otherwise the sites they jumped to from here, kept in this site's storage).
 * - Pinned: the sites they pinned (hold a site, or right-click it).
 * - Then every open site, grouped by what people come to do (the frame's launcher groups). Inside a group the frame's
 *   order is kept: most used first.
 *
 * Use:
 * - Type to filter. The arrow keys move, Enter goes, Esc closes.
 * - On phones it is a sheet under the bar that keeps its own scroll and locks the page behind it.
 * - The site's name in the bar stays its link home.
 *
 * The switcher is DOM nodes only: no text from the frame is parsed as HTML, and links must be https.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeSiteSwitcher) return;

    const STYLE_ID = 'ov-switcher-style';
    const LOCAL = 'ov_sw_sites';
    const SITE_ID = /^[a-z][a-z0-9-]{1,31}$/;
    const ACCOUNT = 'https://openvibe.network/my';
    const CSS = `
.ovsw { position: fixed; inset: 0; z-index: 10021; display: none; background: rgba(3, 6, 12, .32); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.ovsw.is-open { display: block; }
.ovsw-panel { position: fixed; top: var(--ovsw-top, 64px); left: var(--ovsw-left, 8px); width: min(560px, calc(100vw - 16px)); max-height: calc(100dvh - var(--ovsw-top, 64px) - 12px); overflow-y: auto; overscroll-behavior: contain; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 12px; box-sizing: border-box; border-radius: 20px; background: var(--bg-secondary, #101828); color: var(--text-primary, #e6edf7); box-shadow: 0 0 0 1px var(--border-light, rgba(255,255,255,.12)), 0 22px 60px rgba(0,0,0,.45); transform-origin: 24px -6px; animation: ovsw-in .34s cubic-bezier(.2, 1.2, .3, 1) both; }
@media (max-width: 640px) { .ovsw-panel { left: 0; width: 100vw; border-radius: 0 0 22px 22px; } }
.ovsw-top { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 8px 0 12px; border-radius: 13px; background: var(--bg-primary, #0a0f1c); box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.1)); }
.ovsw-top:focus-within { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent, #3b82f6) 70%, transparent), 0 0 0 4px color-mix(in srgb, var(--accent, #3b82f6) 15%, transparent); }
.ovsw-top svg { width: 17px; height: 17px; flex: none; fill: none; stroke: var(--text-muted, #8192ac); stroke-width: 2.2; stroke-linecap: round; }
.ovsw-top input { all: unset; flex: 1; min-width: 0; font-size: 15px; color: var(--text-primary, #e6edf7); }
.ovsw-top input::placeholder { color: var(--text-muted, #8192ac); }
.ovsw-top input::-webkit-search-cancel-button { display: none; }
.ovsw-top kbd { font: 600 10.5px/1 inherit; padding: 4px 6px; border-radius: 6px; color: var(--text-muted, #8192ac); box-shadow: inset 0 0 0 1px var(--border-light, rgba(255,255,255,.14)); }
@media (pointer: coarse) { .ovsw-top kbd { display: none; } }
.ovsw-h { display: flex; justify-content: space-between; gap: 8px; margin: 0; padding: 0 4px 4px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted, #8192ac); }
.ovsw-h span { font-weight: 500; letter-spacing: 0; text-transform: none; }
.ovsw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); gap: 2px; }
.ovsw-row { position: relative; display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.ovsw-row::-webkit-scrollbar { display: none; }
.ovsw-row .ovsw-t { flex: 0 0 72px; }
.ovsw-t { all: unset; box-sizing: border-box; position: relative; display: grid; justify-items: center; gap: 5px; padding: 8px 2px 7px; border-radius: 13px; cursor: pointer; font-size: 11.5px; font-weight: 600; line-height: 1.15; text-align: center; color: var(--text-secondary, #a8b3c4); -webkit-touch-callout: none; user-select: none; animation: ovsw-tile .36s cubic-bezier(.2, 1.3, .3, 1) both; animation-delay: calc(var(--k, 0) * 10ms + 50ms); }
.ovsw-t:hover, .ovsw-t:focus-visible { outline: none; color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #e6edf7) 7%, transparent); }
.ovsw-t:focus-visible { box-shadow: inset 0 0 0 1.5px var(--accent, #3b82f6); }
.ovsw-t .ov-icon { width: 36px; height: 36px; transition: transform .26s cubic-bezier(.2, 1.4, .3, 1); }
.ovsw-t:hover .ov-icon { transform: translateY(-2px) scale(1.06); }
.ovsw-t.is-here .ov-icon { border-radius: 11px; box-shadow: 0 0 0 2px var(--bg-secondary, #101828), 0 0 0 4px var(--accent, #3b82f6); }
.ovsw-t.is-here::after { content: 'here'; position: absolute; top: 2px; right: 6px; font-size: 9px; font-weight: 700; color: var(--accent-light, var(--accent, #60a5fa)); }
.ovsw-pin { position: absolute; top: 2px; left: 6px; font-size: 10px; color: #f59e0b; }
.ovsw-none { margin: 0; padding: 8px 4px; font-size: 14px; color: var(--text-secondary, #a8b3c4); }
.ovsw-foot { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 2px 4px 0; font-size: 12.5px; color: var(--text-muted, #8192ac); }
.ovsw-foot a { color: var(--accent-light, var(--accent, #60a5fa)); font-weight: 650; text-decoration: none; }
.ovsw-foot a:hover { text-decoration: underline; }
@keyframes ovsw-in { from { opacity: 0; transform: translateY(-8px) scale(.97); } }
@keyframes ovsw-tile { from { opacity: 0; transform: translateY(6px) scale(.94); } }
@media (prefers-reduced-motion: reduce) { .ovsw-panel, .ovsw-t { animation: none; } .ovsw-t .ov-icon { transition: none; } }
html[data-ov-motion="reduced"] .ovsw-panel, html[data-ov-motion="reduced"] .ovsw-t { animation: none; }
`;

    let el = null, panel = null, ctx = {}, lastFocus = null, mine = null, query = '';
    const https = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
    const ids = (a, n) => [...new Set((Array.isArray(a) ? a : []).map(String).filter((x) => SITE_ID.test(x)))].slice(0, n);
    function localSites() {
        try { const d = JSON.parse(localStorage.getItem(LOCAL) || 'null') || {}; return { pinned: ids(d.pinned, 12), recent: ids(d.recent, 8) }; } catch { return { pinned: [], recent: [] }; }
    }
    function saveLocal(d) { try { localStorage.setItem(LOCAL, JSON.stringify({ pinned: ids(d.pinned, 12), recent: ids(d.recent, 8) })); } catch { /* storage may be off */ } }
    function headers(json) {
        const h = { Accept: 'application/json' };
        if (json) h['Content-Type'] = 'application/json';
        if (ctx.token) h.Authorization = 'Bearer ' + ctx.token;
        return h;
    }
    const signedIn = () => !!(ctx.user && ctx.apiBase);
    function loadMine() {
        if (!signedIn() || typeof fetch === 'undefined') return Promise.resolve(localSites());
        return fetch(ctx.apiBase + '/api/themes/me/sites', { headers: headers(), credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => (d ? { pinned: ids(d.pinned, 12), recent: ids(d.recent, 8) } : localSites()))
            .catch(() => localSites());
    }
    function savePins(pinned) {
        const cur = mine || localSites();
        mine = { pinned: ids(pinned, 12), recent: cur.recent };
        saveLocal(mine);
        if (signedIn() && typeof fetch !== 'undefined') fetch(ctx.apiBase + '/api/themes/me/sites', { method: 'PUT', headers: headers(true), credentials: 'include', body: JSON.stringify({ pinned: mine.pinned }) }).catch(() => {});
    }
    function noteJump(id) {
        const cur = localSites();
        saveLocal({ pinned: cur.pinned, recent: [id, ...cur.recent] });
    }

    function style() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
    }
    function sites() {
        const f = ctx.frame || {};
        return (Array.isArray(f.nav) ? f.nav : []).filter((s) => s && SITE_ID.test(s.id) && https(s.url));
    }
    function lens() {
        const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
        const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '11'); c.setAttribute('cy', '11'); c.setAttribute('r', '7');
        const p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'm21 21-4.3-4.3');
        svg.append(c, p); return svg;
    }
    function build() {
        style();
        el = document.createElement('div');
        el.className = 'ovsw';
        el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
        panel = document.createElement('div');
        panel.className = 'ovsw-panel';
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Switch to another OpenVibe site');
        panel.addEventListener('keydown', onKey);
        el.appendChild(panel);
        document.body.appendChild(el);
    }
    // The page's own site: by its address (one service can serve several sites: media-hub is Video, Pics and Download).
    const isHere = (s) => { try { return new URL(s.url).hostname === location.hostname; } catch { return s.id === ctx.service; } };
    function tile(s, k, opts) {
        const here = isHere(s);
        const b = document.createElement('a');
        b.className = 'ovsw-t' + (here ? ' is-here' : '');
        b.href = s.url;
        b.style.setProperty('--k', String(k));
        b.title = s.tagline ? `${s.name}: ${s.tagline}` : s.name;
        if (here) b.setAttribute('aria-current', 'page');
        const ic = document.createElement('span'); ic.className = 'ov-icon'; ic.setAttribute('data-icon', s.id); ic.setAttribute('data-size', '36'); ic.setAttribute('aria-hidden', 'true');
        b.appendChild(ic);
        b.appendChild(document.createTextNode(s.name));
        if (opts && opts.pinned) { const p = document.createElement('span'); p.className = 'ovsw-pin'; p.textContent = '★'; p.setAttribute('aria-label', 'pinned'); b.appendChild(p); }
        // Hold (touch) or right-click: pin or unpin.
        let hold = 0, held = false;
        const toggle = () => { const cur = (mine || localSites()).pinned; savePins(cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [s.id, ...cur]); render(); };
        b.addEventListener('pointerdown', (e) => { held = false; if (e.pointerType !== 'mouse') hold = setTimeout(() => { held = true; toggle(); }, 480); });
        b.addEventListener('pointerup', () => clearTimeout(hold));
        b.addEventListener('pointerleave', () => clearTimeout(hold));
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); toggle(); });
        b.addEventListener('click', (e) => { if (held) { e.preventDefault(); held = false; return; } if (here) { e.preventDefault(); close(); return; } noteJump(s.id); });
        return b;
    }
    function section(title, hint, list, row, pinnedSet) {
        const wrap = document.createElement('section');
        const h = document.createElement('p'); h.className = 'ovsw-h'; h.textContent = title;
        if (hint) { const sp = document.createElement('span'); sp.textContent = hint; h.appendChild(sp); }
        const grid = document.createElement('div'); grid.className = row ? 'ovsw-row' : 'ovsw-grid';
        list.forEach((s, k) => grid.appendChild(tile(s, k, { pinned: pinnedSet && pinnedSet.has(s.id) })));
        wrap.append(h, grid);
        return wrap;
    }
    function render() {
        if (!panel) return;
        const keep = panel.querySelector('input');
        const hadFocus = keep && document.activeElement === keep;
        const pos = keep ? keep.selectionStart : null;
        panel.textContent = '';
        const top = document.createElement('label'); top.className = 'ovsw-top';
        const input = document.createElement('input');
        input.type = 'search'; input.placeholder = 'Jump to a site'; input.autocomplete = 'off'; input.setAttribute('aria-label', 'Filter the sites'); input.value = query;
        input.addEventListener('input', () => { query = input.value; render(); });
        const kbd = document.createElement('kbd'); kbd.textContent = 'Esc';
        top.append(lens(), input, kbd);
        panel.appendChild(top);
        const all = sites(), byId = new Map(all.map((s) => [s.id, s]));
        const m = mine || localSites(), pinnedSet = new Set(m.pinned);
        const q = query.trim().toLowerCase();
        const groups = (ctx.frame && Array.isArray(ctx.frame.groups) && ctx.frame.groups.length) ? ctx.frame.groups : [{ id: '', name: 'OpenVibe' }];
        if (!all.length) {
            const p = document.createElement('p'); p.className = 'ovsw-none'; p.textContent = 'Loading the sites…'; panel.appendChild(p);
        } else if (q) {
            const hits = all.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q) || String(s.tagline || '').toLowerCase().includes(q));
            if (hits.length) panel.appendChild(section(`${hits.length} ${hits.length === 1 ? 'site' : 'sites'}`, 'Enter opens the first', hits, false, pinnedSet));
            else { const p = document.createElement('p'); p.className = 'ovsw-none'; p.textContent = `No site called "${query.trim()}".`; panel.appendChild(p); }
        } else {
            const recent = m.recent.map((id) => byId.get(id)).filter((s) => s && !isHere(s));
            if (recent.length) panel.appendChild(section('Recent', signedIn() ? 'where you were last' : 'where you went from here', recent, true));
            const pinned = m.pinned.map((id) => byId.get(id)).filter(Boolean);
            panel.appendChild(pinned.length ? section('Pinned', 'hold a site to unpin it', pinned, false, pinnedSet) : (() => { const p = document.createElement('p'); p.className = 'ovsw-h'; p.textContent = 'Pinned'; const sp = document.createElement('span'); sp.textContent = 'hold a site (or right-click) to pin it'; p.appendChild(sp); return p; })());
            // Each group in the frame's order, most used first inside it; a site in a group this release does not know
            // joins the last group (as the menu's Sites tab does).
            const known = new Set(groups.map((g) => g.id));
            groups.forEach((g, gi) => {
                const list = all.filter((s) => (g.id ? s.group === g.id : true) || (gi === groups.length - 1 && !known.has(s.group)));
                if (list.length) panel.appendChild(section(g.name, '', list, false, pinnedSet));
            });
        }
        const foot = document.createElement('div'); foot.className = 'ovsw-foot';
        const count = document.createElement('span'); count.textContent = `${all.length || ''}${all.length ? ' sites · ' : ''}one account`;
        const acct = document.createElement('a'); acct.href = ACCOUNT; acct.textContent = 'Your account →';
        foot.append(count, acct);
        panel.appendChild(foot);
        if (typeof ctx.icons === 'function') { try { ctx.icons(panel); } catch { /* icons are optional */ } }
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { const first = panel.querySelector('.ovsw-t:not(.is-here)'); if (first) { e.preventDefault(); first.click(); } }
            if (e.key === 'ArrowDown') { const first = panel.querySelector('.ovsw-t'); if (first) { e.preventDefault(); first.focus(); } }
        });
        if (hadFocus) { input.focus(); try { input.setSelectionRange(pos, pos); } catch { /* */ } }
    }
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        const tiles = [...panel.querySelectorAll('.ovsw-t')], i = tiles.indexOf(document.activeElement);
        if (i < 0) return;
        const row = tiles[i].parentElement, cols = Math.max(1, Math.round(row.clientWidth / Math.max(1, tiles[i].offsetWidth)));
        const go = (j) => { if (tiles[j]) { e.preventDefault(); tiles[j].focus(); } };
        if (e.key === 'ArrowRight') go(i + 1);
        else if (e.key === 'ArrowLeft') go(i - 1);
        else if (e.key === 'ArrowDown') go(Math.min(tiles.length - 1, i + cols));
        else if (e.key === 'ArrowUp') { if (i - cols < 0) { e.preventDefault(); const inp = panel.querySelector('input'); if (inp) inp.focus(); } else go(i - cols); }
    }

    function open(opts) {
        ctx = opts || {};
        if (!el) build();
        lastFocus = document.activeElement;
        query = '';
        const at = ctx.anchor;
        el.style.setProperty('--ovsw-top', `${Math.max(0, Math.round(at && at.top || 64))}px`);
        el.style.setProperty('--ovsw-left', `${Math.max(8, Math.round(at && at.left || 8))}px`);
        el.classList.add('is-open');
        document.documentElement.style.overflow = 'hidden';
        try { document.dispatchEvent(new CustomEvent('openvibe-menu', { detail: { open: true, switcher: true } })); } catch { /* */ }
        render();
        // A pointer that can hover gets the filter focused; a phone keeps its keyboard down until someone taps it.
        if (typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) { const inp = panel.querySelector('input'); if (inp) setTimeout(() => inp.focus(), 0); }
        else setTimeout(() => { const t = panel.querySelector('.ovsw-t'); if (t && t.focus) t.focus({ preventScroll: true }); }, 0);
        loadMine().then((d) => { mine = d; if (isOpen()) render(); });
    }
    function update(frame) { if (frame) { ctx.frame = frame; if (isOpen()) render(); } }
    function close() {
        if (!el || !el.classList.contains('is-open')) return;
        el.classList.remove('is-open');
        document.documentElement.style.overflow = '';
        if (typeof ctx.onClose === 'function') { try { ctx.onClose(); } catch { /* */ } }
        try { document.dispatchEvent(new CustomEvent('openvibe-menu', { detail: { open: false, switcher: true } })); } catch { /* */ }
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    const isOpen = () => !!(el && el.classList.contains('is-open'));

    const api = { open, close, update, isOpen };
    root.OpenVibeSiteSwitcher = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
