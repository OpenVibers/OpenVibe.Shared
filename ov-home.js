// ═══════════════════════════════════════════════════════════════
// OpenVibe — the menu's home screen and wall (plan 2026-11-09, ~/openvibe/OpenVibe_Menu_Home_Feed_Plan_2026-11-09.md)
//
// search.js loads this the first time the You or Feed tab paints (a sibling, by content hash) and hands it an
// element and what it knows:
//   OpenVibeHome.home(el, o)       You: your Actor, Recent, your Home grid (long-press or Edit, drag to arrange,
//                                  folders), All apps (the drawer)
//   OpenVibeHome.wallTop(el, o)    Feed: what's new with you (the composer, when Community says you can post) and
//                                  today's numbers
//   OpenVibeHome.timeline(el, o)   Feed: the network's wall, newest first, "Show more"
//
// The owner, 11-09: "make it more like a phone… hold down on an icon and move it around, just like on Android or
// iOS… the most popular sites until you set it up… recent apps at the top… tools as a folder of apps… the Actor
// built in… the feed more like a Facebook wall… who went live recently… how many people today".
//
// The arrangement is kept on this device (localStorage ovs-home) and, signed in, on Network
// (GET/PUT /api/v1/me/home-screen, network.home-screen@1); Network's copy wins when it answers. Everything a person or
// a site wrote is set as text; links are https or same-site only. No spinners: grey bars hold the place of what loads.
// ═══════════════════════════════════════════════════════════════
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeHome) return;

    const HOME_KEY = 'ovs-home';
    const INVITE_KEY = 'ovs-actor-invite';
    const LONG_MS = 450;
    const HOME_MAX = 40;
    const ACTOR = 'https://openvibe.actor';
    const COMMUNITY = 'https://openvibe.community';

    const safe = (u) => { try { const x = new URL(String(u || ''), location.href); return x.protocol === 'https:' || x.origin === location.origin ? x.href : null; } catch { return null; } };
    const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const ago = (iso) => {
        const t = Date.parse(iso || ''); if (!t) return '';
        const s = Math.max(1, Math.round((Date.now() - t) / 1000));
        if (s < 60) return 'now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`;
        const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`;
    };
    const num = (n) => { const v = Number(n) || 0; return v >= 10000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : v.toLocaleString('en-US'); };

    function styles() {
        if (document.getElementById('ovh-styles')) return;
        const st = document.createElement('style');
        st.id = 'ovh-styles';
        st.textContent = `
.ovh { list-style: none; padding: 2px 4px 6px; }
.ovh-sec { display: flex; align-items: center; gap: 8px; padding: 10px 6px 4px; font-size: 11px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--text-muted, #93a0b4); }
.ovh-sec > span { flex: 1; }
.ovh-sec button, .ovh-link { min-height: 36px; padding: 0 10px; border: 0; border-radius: 999px; background: transparent; color: var(--accent, #3b82f6); font: inherit; font-size: 13px; font-weight: 700; letter-spacing: 0; text-transform: none; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.ovh-sec button.is-done { background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); }
.ovh-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 2px; }
@media (min-width: 400px) { .ovh-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (min-width: 861px) { .ovh-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
.ovh-recent .ovh-app { min-height: 80px; }
.ovh-app { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; min-height: 88px; padding: 8px 2px 6px; border: 0; border-radius: 16px;
    background: transparent; color: inherit; font: inherit; text-decoration: none; cursor: pointer; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.ovh-app:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: -2px; }
.ovh-ic { position: relative; display: grid; place-items: center; width: 56px; height: 56px; border-radius: 17px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 6%, transparent);
    box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.1)); transition: transform .18s cubic-bezier(.2,1.4,.4,1); }
.ovh-recent .ovh-ic { width: 48px; height: 48px; border-radius: 15px; }
.ovh-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 650; color: var(--text-secondary, #a8b3c4); }
.ovh-folder .ovh-ic { display: grid; grid-template-columns: repeat(2, 18px); grid-auto-rows: 18px; gap: 4px; place-content: center; }
.ovh-folder .ovh-ic > span { display: grid; place-items: center; width: 18px; height: 18px; }
.ovh-glyph { display: grid; place-items: center; width: 100%; height: 100%; }
.ovh-glyph svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; color: var(--accent, #3b82f6); }
.ovh-badge { position: absolute; top: -6px; left: -6px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 0; padding: 0; cursor: pointer;
    background: var(--bg-tertiary, #2a3140); color: var(--text-primary, #e8ecf3); font: 700 16px/1 system-ui, sans-serif; box-shadow: 0 0 0 2px var(--bg-secondary, #141a24); }
.ovh-badge::after { content: ""; position: absolute; inset: -10px; }
.ovh-badge.is-add { background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); }
.ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-app { touch-action: none; }
.ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-ic { animation: ovh-wiggle .32s ease-in-out infinite alternate; }
.ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-app:nth-child(2n) .ovh-ic { animation-delay: -.16s; }
.ovh-app.is-lifted { opacity: .25; }
.ovh-ghost { position: fixed; z-index: 10040; pointer-events: none; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 19px; display: grid; place-items: center;
    background: var(--bg-secondary, #141a24); box-shadow: 0 12px 30px rgba(0,0,0,.35), inset 0 0 0 1px var(--border, rgba(255,255,255,.14)); transform: scale(1.08); }
@keyframes ovh-wiggle { from { transform: rotate(-1.6deg); } to { transform: rotate(1.6deg); } }
.ovh-hint { margin: 2px 6px 6px; font-size: 12.5px; color: var(--text-muted, #93a0b4); }
.ovh-all[hidden], .ovh[hidden] { display: none !important; }
.ovh-all { display: flex; align-items: center; justify-content: center; gap: 8px; width: calc(100% - 8px); min-height: 44px; margin: 6px 4px 2px; border: 1px solid var(--border, rgba(255,255,255,.12));
    border-radius: 14px; background: transparent; color: var(--text-primary, #e8ecf3); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.ovh-head { display: flex; align-items: center; gap: 8px; padding: 6px 2px; }
.ovh-head b { flex: 1; font-size: 16px; }
.ovh-back { min-height: 44px; padding: 0 12px; border: 0; border-radius: 12px; background: transparent; color: var(--accent, #3b82f6); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.ovh-filter { width: calc(100% - 8px); min-height: 44px; margin: 2px 4px 4px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--border, rgba(255,255,255,.14));
    background: var(--bg-primary, rgba(0,0,0,.2)); color: inherit; font: inherit; font-size: 15px; }
.ovh-actor { display: flex; align-items: center; gap: 12px; width: calc(100% - 8px); min-height: 64px; margin: 6px 4px 4px; padding: 10px 12px; border-radius: 16px; border: 0; text-align: left; cursor: pointer;
    background: color-mix(in srgb, var(--accent, #3b82f6) 11%, var(--bg-secondary, #141a24)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 28%, transparent); color: inherit; font: inherit; }
.ovh-face { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; overflow: hidden; background: var(--accent, #3b82f6); color: #fff; font-weight: 800; font-size: 17px; }
.ovh-face img { width: 100%; height: 100%; object-fit: cover; }
.ovh-actor-txt { flex: 1; min-width: 0; display: grid; gap: 2px; }
.ovh-actor-txt b { font-size: 14.5px; }
.ovh-actor-txt small { font-size: 12.5px; color: var(--text-secondary, #a8b3c4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovh-chip { display: inline-flex; align-items: center; gap: 5px; margin-left: 6px; font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #a8b3c4); }
.ovh-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted, #8b8b96); }
.ovh-chip.is-working .ovh-dot { background: var(--success, #22c55e); animation: ovh-pulse 1.8s ease-in-out infinite; }
.ovh-chip.is-waiting .ovh-dot { background: var(--warning, #f5a524); }
.ovh-go { flex: none; color: var(--accent, #3b82f6); font-weight: 700; font-size: 13px; }
.ovh-x { flex: none; min-width: 44px; min-height: 44px; border: 0; background: transparent; color: var(--text-muted, #93a0b4); font: inherit; font-size: 12.5px; cursor: pointer; }
@keyframes ovh-pulse { 50% { opacity: .35; } }
.ovh-skel { display: block; height: 14px; margin: 10px 8px; border-radius: 7px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); }
.ovh-compose { display: flex; gap: 10px; align-items: flex-start; margin: 6px 4px; padding: 10px; border-radius: 16px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent);
    box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.1)); }
.ovh-compose textarea { flex: 1; min-width: 0; min-height: 44px; max-height: 160px; padding: 11px 12px; border-radius: 12px; border: 1px solid var(--border, rgba(255,255,255,.14));
    background: var(--bg-primary, rgba(0,0,0,.2)); color: inherit; font: inherit; font-size: 15px; line-height: 1.4; resize: none; overflow-y: auto; }
.ovh-post { flex: none; min-height: 44px; padding: 0 16px; border: 0; border-radius: 12px; background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); font: inherit; font-weight: 700; cursor: pointer; }
.ovh-post:disabled { opacity: .5; cursor: default; }
.ovh-note { margin: 2px 8px 6px; font-size: 12.5px; color: var(--text-muted, #93a0b4); }
.ovh-today { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 4px 4px 6px; }
.ovh-stat { display: grid; gap: 2px; align-content: start; min-width: 0; padding: 10px; border-radius: 14px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent); }
.ovh-stat b { font-size: 18px; font-variant-numeric: tabular-nums; }
.ovh-stat small { font-size: 11.5px; color: var(--text-muted, #93a0b4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovh-stat svg { width: 100%; height: 18px; color: var(--accent, #3b82f6); }
@media (max-width: 380px) { .ovh-today { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ovh-wall { list-style: none; margin: 0; padding: 0; }
.ovh-entry { display: flex; gap: 12px; align-items: flex-start; min-height: 56px; padding: 10px 8px; border-radius: 14px; color: inherit; text-decoration: none; }
.ovh-entry + .ovh-entry { margin-top: 2px; }
@media (hover: hover) { .ovh-entry:hover, .ovh-app:hover { background: var(--bg-hover, rgba(255,255,255,.07)); } }
.ovh-entry .ovh-ic { width: 40px; height: 40px; border-radius: 12px; flex: none; }
.ovh-entry-txt { flex: 1; min-width: 0; display: grid; gap: 3px; }
.ovh-entry-txt b { font-size: 14px; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
.ovh-entry-txt small { font-size: 12px; color: var(--text-muted, #93a0b4); }
.ovh-lives { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.ovh-lives a { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border-radius: 999px; background: color-mix(in srgb, var(--live, #ef4444) 12%, transparent); color: inherit; text-decoration: none; font-size: 13px; font-weight: 650; }
.ovh-lives a::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--live, #ef4444); }
@media (prefers-reduced-motion: reduce) { .ovh.is-edit .ovh-grid .ovh-ic, .ovh-chip.is-working .ovh-dot { animation: none !important; } .ovh-ic { transition: none; } }
`;
        document.head.appendChild(st);
    }

    // ── The arrangement ────────────────────────────────────────────────────────────────────────────────────────
    function readLocal() { try { const v = JSON.parse(localStorage.getItem(HOME_KEY) || 'null'); return v && Array.isArray(v.home) ? v : null; } catch { return null; } }
    function writeLocal(l) { try { localStorage.setItem(HOME_KEY, JSON.stringify(l)); } catch { /* a private window keeps it for this opening */ } }
    const homeUrl = (o) => `${o.apiBase || 'https://openvibe.network'}/api/v1/me/home-screen`;
    const signedIn = (o) => !!(o.token && o.user && !o.user.is_anon);
    let putTimer = 0;
    function pushRemote(o, l) {
        if (!signedIn(o) || typeof fetch !== 'function') return;
        clearTimeout(putTimer);
        putTimer = setTimeout(() => {
            fetch(homeUrl(o), { method: 'PUT', credentials: 'omit', headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ home: l.home.slice(0, HOME_MAX), folders: l.folders }) }).catch(() => {});
        }, 600);
    }
    let remoteAsked = false;
    async function pullRemote(o) {
        if (remoteAsked || !signedIn(o) || typeof fetch !== 'function') return null;
        remoteAsked = true;
        try {
            const r = await fetch(homeUrl(o), { credentials: 'omit', headers: { Authorization: `Bearer ${o.token}` } });
            if (!r.ok) return null;
            const j = await r.json();
            return j && Array.isArray(j.home) ? { home: j.home.filter((x) => typeof x === 'string').slice(0, HOME_MAX), folders: Array.isArray(j.folders) ? j.folders : [] } : null;
        } catch { return null; }
    }

    /** Every app the menu knows, by id: sites, the person's own places (Files, Wallet…), the folders. */
    function universe(o) {
        const byId = new Map();
        (o.apps || []).forEach((a) => { if (a && a.id && safe(a.url)) byId.set(a.id, a); });
        (o.yours || []).forEach((a) => { if (a && a.id && safe(a.url)) byId.set(a.id, a); });
        return byId;
    }
    function folderDefs(o) {
        const apps = o.apps || [];
        return [
            { id: 'tools', name: 'Tools', apps: (o.tools || []).map((t) => t.id), glyph: 'tools', more: { label: `All ${o.toolCount || (o.tools || []).length} tools`, href: 'https://openvibe.tools/' } },
            { id: 'build', name: 'Build', apps: apps.filter((a) => a.group === 'build').map((a) => a.id), glyph: 'code' },
        ].filter((f) => f.apps.length);
    }
    /** Until the person arranges it: their own places first (signed in), then the most used and popular sites. */
    function defaultHome(o) {
        const mineFirst = (o.yours || []).filter((y) => ['you:vibe', 'you:codes', 'you:files', 'you:wallet'].includes(y.id)).map((y) => y.id);
        const sites = (o.apps || []).filter((a) => a.group !== 'build').map((a) => a.id);
        const room = 12 - 2 - mineFirst.length;
        return mineFirst.concat(sites.slice(0, Math.max(6, room)), ['folder:tools', 'folder:build']);
    }
    function layoutOf(o) {
        const byId = universe(o);
        const folders = folderDefs(o);
        const known = (id) => byId.has(id) || (id.startsWith('folder:') && folders.some((f) => `folder:${f.id}` === id));
        const l = readLocal();
        const home = (l ? l.home : defaultHome(o)).filter((id, i, a) => known(id) && a.indexOf(id) === i).slice(0, HOME_MAX);
        return { home, folders, arranged: !!l, byId };
    }

    // ── Drawing an icon ────────────────────────────────────────────────────────────────────────────────────────
    function siteIcon(site, size) {
        const s = h('span', 'ov-icon'); s.setAttribute('data-icon', site || 'ov'); s.setAttribute('data-size', String(size)); s.setAttribute('data-fx', 'none');
        return s;
    }
    function appTile(o, a, { tag = 'a', size = 40, small = false } = {}) {
        const el = h(tag, 'ovh-app');
        if (tag === 'a') el.href = safe(a.url) || '#'; else el.type = 'button';
        el.setAttribute('data-id', a.id);
        const ic = h('span', 'ovh-ic');
        ic.append(siteIcon(a.site, small ? 32 : size));
        el.append(ic, h('span', 'ovh-name', a.title));
        if (tag === 'a') el.addEventListener('click', () => { if (o.onOpen) o.onOpen(a); });
        return el;
    }
    function folderTile(o, f, byId, tag) {
        const el = h(tag, 'ovh-app ovh-folder');
        if (tag === 'button') el.type = 'button'; else { el.href = '#'; el.setAttribute('role', 'button'); }
        el.setAttribute('data-id', `folder:${f.id}`);
        el.setAttribute('aria-label', `${f.name} folder, ${f.apps.length} apps`);
        const ic = h('span', 'ovh-ic');
        f.apps.slice(0, 4).forEach((id) => { const a = byId.get(id) || (o.tools || []).find((t) => t.id === id); const cell = h('span'); cell.append(siteIcon(a ? a.site : f.glyph, 16)); ic.append(cell); });
        el.append(ic, h('span', 'ovh-name', f.name));
        return el;
    }

    // ── You: the home screen ───────────────────────────────────────────────────────────────────────────────────
    function home(el, o) {   // o is replaced by update() when the menu learns more (history, the catalogue)
        styles();
        el.classList.add('ovh');
        el.setAttribute('data-sec', 'home');
        const state = { view: 'home', edit: false, folder: null, filter: '', drag: null, suppress: 0 };
        let L = layoutOf(o);
        const save = () => { const keep = { home: L.home.slice(0, HOME_MAX), folders: L.folders.map((f) => ({ id: f.id, name: f.name, apps: f.apps.slice(0, 400) })) }; writeLocal(keep); pushRemote(o, keep); L.arranged = true; };
        const icons = () => { if (typeof o.mountIcons === 'function') { try { o.mountIcons(el); } catch { /* optional */ } } };
        let actorBox = null;

        function paintHome() {
            el.textContent = '';
            el.classList.toggle('is-edit', state.edit);
            if (signedIn(o)) { actorBox = actorBox || h('div'); el.append(actorBox); }
            // Recent: the last places opened, newest first.
            const recent = (o.recent || []).map((id) => L.byId.get(id)).filter(Boolean).slice(0, 5);
            if (recent.length && !state.edit) {
                el.append(sec('Recent'));
                const row = h('div', 'ovh-grid ovh-recent'); row.setAttribute('aria-label', 'Recent');
                recent.forEach((a) => row.append(appTile(o, a, { small: true })));
                el.append(row);
            }
            const head = sec(L.arranged || signedIn(o) ? 'Your home' : 'Popular on OpenVibe');
            const edit = h('button', state.edit ? 'is-done' : '', state.edit ? 'Done' : 'Edit');
            edit.type = 'button';
            edit.setAttribute('aria-pressed', state.edit ? 'true' : 'false');
            edit.addEventListener('click', () => setEdit(!state.edit));
            head.append(edit);
            el.append(head);
            if (state.edit) el.append(h('p', 'ovh-hint', 'Drag an app to move it, or use the arrow keys. − takes it off Home; All apps puts it back.'));
            const grid = h('div', 'ovh-grid'); grid.setAttribute('aria-label', 'Your home');
            L.home.forEach((id, i) => grid.append(homeTile(id, i)));
            el.append(grid);
            const total = L.byId.size;
            const all = h('button', 'ovh-all', `All apps (${total})`); all.type = 'button';
            all.addEventListener('click', () => { state.view = 'drawer'; paint(); });
            el.append(all);
            icons();
            if (signedIn(o) && actorBox && !actorBox.childNodes.length) actor(actorBox, o);
        }

        function homeTile(id, i) {
            let t;
            if (id.startsWith('folder:')) {
                const f = L.folders.find((x) => `folder:${x.id}` === id);
                t = folderTile(o, f, L.byId, state.edit ? 'button' : 'a');
                if (!state.edit) t.addEventListener('click', (e) => { e.preventDefault(); if (Date.now() < state.suppress) return; state.view = 'folder'; state.folder = f.id; paint(); });
            } else {
                const a = L.byId.get(id);
                t = appTile(o, a, { tag: state.edit ? 'button' : 'a' });
            }
            const name = t.querySelector('.ovh-name').textContent;
            if (state.edit) {
                t.setAttribute('aria-label', `${name}, ${i + 1} of ${L.home.length}. Arrow keys move it; Delete takes it off Home.`);
                const rm = h('button', 'ovh-badge', '−'); rm.type = 'button'; rm.setAttribute('aria-label', `Take ${name} off Home`);
                rm.addEventListener('click', (e) => { e.stopPropagation(); L.home.splice(L.home.indexOf(id), 1); save(); paint(); });
                rm.addEventListener('pointerdown', (e) => e.stopPropagation());
                t.append(rm);
                t.addEventListener('keydown', (e) => keyMove(e, id));
            }
            press(t, id);
            return t;
        }

        function keyMove(e, id) {
            const i = L.home.indexOf(id); let j = i;
            const cols = Math.max(1, getComputedStyle(el.querySelector('.ovh-grid:not(.ovh-recent)')).gridTemplateColumns.split(' ').length);
            if (e.key === 'ArrowLeft') j = i - 1; else if (e.key === 'ArrowRight') j = i + 1;
            else if (e.key === 'ArrowUp') j = i - cols; else if (e.key === 'ArrowDown') j = i + cols;
            else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); L.home.splice(i, 1); save(); paint(); const n = el.querySelector('.ovh-grid:not(.ovh-recent) .ovh-app'); if (n) n.focus(); return; }
            else return;
            e.preventDefault(); e.stopPropagation();
            j = Math.max(0, Math.min(L.home.length - 1, j));
            if (j === i) return;
            L.home.splice(i, 1); L.home.splice(j, 0, id); save(); paint();
            const n = el.querySelector(`.ovh-grid:not(.ovh-recent) [data-id="${CSS.escape(id)}"]`); if (n) n.focus();
        }

        // Long-press starts Edit (and keeps hold of the app, so a finger can drag at once); in Edit a press drags.
        function press(t, id) {
            t.addEventListener('contextmenu', (e) => { if (state.edit || state.drag) e.preventDefault(); });
            t.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const start = { x: e.clientX, y: e.clientY, id: e.pointerId };
                let timer = 0;
                const cancel = () => { clearTimeout(timer); window.removeEventListener('pointermove', early); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel); };
                const early = (m) => { if (m.pointerId === start.id && Math.hypot(m.clientX - start.x, m.clientY - start.y) > 8) { cancel(); if (state.edit) beginDrag(id, m); } };
                window.addEventListener('pointermove', early);
                window.addEventListener('pointerup', cancel);
                window.addEventListener('pointercancel', cancel);
                if (!state.edit) {
                    timer = setTimeout(() => {
                        cancel();
                        state.suppress = Date.now() + 700;
                        try { if (navigator.vibrate) navigator.vibrate(12); } catch { /* */ }
                        setEdit(true);
                        // The finger is still down: the next move drags this app.
                        const follow = (m) => { if (m.pointerId === start.id && Math.hypot(m.clientX - start.x, m.clientY - start.y) > 6) { window.removeEventListener('pointermove', follow); beginDrag(id, m); } };
                        window.addEventListener('pointermove', follow);
                        window.addEventListener('pointerup', () => window.removeEventListener('pointermove', follow), { once: true });
                    }, LONG_MS);
                }
            });
            // A long-press must not also open the app.
            t.addEventListener('click', (e) => { if (Date.now() < state.suppress && !(e.target.closest && e.target.closest('.ovh-badge'))) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
        }

        function beginDrag(id, e) {
            if (state.drag) return;
            const ghost = h('div', 'ovh-ghost');
            const src = el.querySelector(`.ovh-grid:not(.ovh-recent) [data-id="${CSS.escape(id)}"] .ovh-ic`);
            if (src) ghost.append(src.cloneNode(true).firstChild || h('span'));
            document.body.append(ghost);
            state.drag = { id, ghost };
            const at = (m) => { ghost.style.left = `${m.clientX}px`; ghost.style.top = `${m.clientY}px`; };
            at(e);
            const lift = () => { const n = el.querySelector(`.ovh-grid:not(.ovh-recent) [data-id="${CSS.escape(id)}"]`); if (n) n.classList.add('is-lifted'); };
            lift();
            const move = (m) => {
                at(m);
                const under = document.elementFromPoint(m.clientX, m.clientY);
                const cell = under && under.closest && under.closest('.ovh-grid:not(.ovh-recent) .ovh-app');
                if (!cell || !el.contains(cell)) return;
                const to = L.home.indexOf(cell.getAttribute('data-id')), from = L.home.indexOf(id);
                if (to < 0 || to === from) return;
                L.home.splice(from, 1); L.home.splice(to, 0, id);
                const grid = el.querySelector('.ovh-grid:not(.ovh-recent)');
                grid.textContent = ''; L.home.forEach((x, i) => grid.append(homeTile(x, i)));
                icons(); lift();
            };
            const end = () => {
                window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
                ghost.remove(); state.drag = null; state.suppress = Date.now() + 300; save(); paint();
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', end);
            window.addEventListener('pointercancel', end);
        }

        function setEdit(on) { state.edit = on; paint(); const b = el.querySelector('.ovh-sec button'); if (b && !on) b.focus(); }

        function paintFolder() {
            const f = L.folders.find((x) => x.id === state.folder);
            if (!f) { state.view = 'home'; return paintHome(); }
            el.textContent = '';
            el.append(backHead(f.name));
            const grid = h('div', 'ovh-grid'); grid.setAttribute('aria-label', f.name);
            const ranked = f.apps.map((id) => L.byId.get(id) || (o.tools || []).find((t) => t.id === id)).filter(Boolean);
            const shown = f.id === 'tools' ? ranked.slice(0, 24) : ranked;
            shown.forEach((a) => grid.append(appTile(o, a)));
            el.append(grid);
            if (f.more) { const m = h('a', 'ovh-all', `${f.more.label} →`); m.href = f.more.href; el.append(m); }
            icons();
        }

        function paintDrawer() {
            el.textContent = '';
            el.append(backHead('All apps'));
            const field = h('input', 'ovh-filter'); field.type = 'search'; field.placeholder = 'Find an app'; field.setAttribute('aria-label', 'Find an app'); field.value = state.filter;
            el.append(field);
            const body = h('div');
            el.append(body);
            const groups = (o.groups && o.groups.length ? o.groups : [{ id: '', name: 'OpenVibe' }]).slice();
            const draw = () => {
                body.textContent = '';
                const q = state.filter.trim().toLowerCase();
                const all = [...L.byId.values()].filter((a) => !q || a.title.toLowerCase().includes(q)).sort((a, b) => a.title.localeCompare(b.title));
                const yours = all.filter((a) => a.id.startsWith('you:'));
                const sets = [];
                if (yours.length) sets.push(['Yours', yours]);
                groups.forEach((g, gi) => {
                    const list = all.filter((a) => !a.id.startsWith('you:') && (g.id ? a.group === g.id : true) && (g.id || gi === groups.length - 1 || true));
                    if (list.length) sets.push([g.name, list]);
                });
                const placed = new Set(sets.flatMap(([, list]) => list.map((a) => a.id)));
                const rest = all.filter((a) => !placed.has(a.id));
                if (rest.length) sets.push(['More', rest]);
                L.folders.forEach((f) => { if (!q || f.name.toLowerCase().includes(q)) sets.push([`${f.name} folder`, [{ folder: f }]]); });
                if (!sets.length) { body.append(h('p', 'ovh-note', 'No app has that name.')); return; }
                sets.forEach(([name, list]) => {
                    body.append(sec(`${name} (${list.length})`));
                    const grid = h('div', 'ovh-grid');
                    list.forEach((a) => {
                        const id = a.folder ? `folder:${a.folder.id}` : a.id;
                        const t = a.folder ? folderTile(o, a.folder, L.byId, 'a') : appTile(o, a);
                        if (a.folder) t.addEventListener('click', (e) => { e.preventDefault(); state.view = 'folder'; state.folder = a.folder.id; paint(); });
                        if (!L.home.includes(id) && L.home.length < HOME_MAX) {
                            const add = h('button', 'ovh-badge is-add', '+'); add.type = 'button';
                            add.setAttribute('aria-label', `Put ${a.folder ? a.folder.name : a.title} on Home`);
                            add.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); L.home.push(id); save(); draw(); icons(); });
                            t.append(add);
                        }
                        grid.append(t);
                    });
                    body.append(grid);
                });
                icons();
            };
            field.addEventListener('input', () => { state.filter = field.value; draw(); });
            draw();
        }

        function backHead(title) {
            const head = h('div', 'ovh-head');
            const back = h('button', 'ovh-back', '← Home'); back.type = 'button';
            back.addEventListener('click', () => { state.view = 'home'; state.folder = null; paint(); const b = el.querySelector('.ovh-all'); if (b) b.focus(); });
            head.append(back, h('b', '', title));
            return head;
        }
        function sec(text) { const s = h('div', 'ovh-sec'); s.append(h('span', '', text)); return s; }

        function paint() { if (state.view === 'folder') return paintFolder(); if (state.view === 'drawer') return paintDrawer(); return paintHome(); }
        paint();
        // Network's copy wins when it answers and differs.
        pullRemote(o).then((r) => {
            if (!r) return;
            const now = JSON.stringify(L.home);
            const known = r.home.filter((id) => L.byId.has(id) || (id.startsWith('folder:') && L.folders.some((f) => `folder:${f.id}` === id)));
            if (!known.length || JSON.stringify(known) === now) return;
            writeLocal({ home: known, folders: r.folders });
            L = layoutOf(o);
            if (!state.drag && el.isConnected) paint();
        });
        return {
            repaint: paint,
            /** The menu learned more (history, the catalogue): redraw with it, unless the person is arranging. */
            update(next) { o = next; L = layoutOf(o); if (!state.drag && !state.edit && state.view === 'home') paint(); },
        };
    }

    // ── Your Actor, on top of You ──────────────────────────────────────────────────────────────────────────────
    async function actor(box, o) {
        const base = String(o.actorBase || ACTOR).replace(/\/+$/, '');
        let a = null;
        try {
            const r = await fetch(`${base}/api/v1/me/actor`, { credentials: 'omit', headers: { Accept: 'application/json', Authorization: `Bearer ${o.token}` } });
            if (r.ok) a = await r.json();
        } catch { a = null; }
        if (!box.isConnected) return;
        box.textContent = '';
        if (a && a.id && a.enabled !== false) {
            const asks = Array.isArray(a.asks) ? a.asks : [];
            const st = asks.length ? 'waiting' : ['working', 'resting', 'paused'].includes(a.status) ? a.status : 'resting';
            const label = { working: 'Working', resting: 'Resting', paused: 'Paused', waiting: 'Waiting for you' }[st];
            const b = h('button', 'ovh-actor'); b.type = 'button';
            const face = h('span', 'ovh-face');
            const pic = a.avatar && /^https:\/\//.test(String(a.avatar.url || '')) ? a.avatar.url : '';
            if (pic) { const img = h('img'); img.alt = ''; img.src = pic; face.append(img); } else face.textContent = String(a.name || 'A').trim().charAt(0).toUpperCase() || 'A';
            const txt = h('span', 'ovh-actor-txt');
            const name = h('b', '', a.name || 'Your Actor');
            const chip = h('span', `ovh-chip is-${st}`); chip.append(h('span', 'ovh-dot'), document.createTextNode(label));
            name.append(chip);
            const now = a.now || {};
            txt.append(name, h('small', '', asks.length ? `It asks you: ${asks[0].text || ''}` : now.current_step ? String(now.current_step) : st === 'paused' ? 'Paused until you resume it' : 'Resting until its next goal is due'));
            b.append(face, txt, h('span', 'ovh-go', asks.length ? 'Answer' : 'Open'));
            b.addEventListener('click', () => {
                if (root.OpenVibeNavbar && typeof root.OpenVibeNavbar.openDock === 'function') { if (o.close) o.close(); try { root.OpenVibeNavbar.openDock('agent'); return; } catch { /* */ } }
                location.href = `${base}/you`;
            });
            box.append(b);
            return;
        }
        // No Actor yet: one invitation, which the person can put away.
        try { if (localStorage.getItem(INVITE_KEY) === 'off') return; } catch { /* */ }
        const card = h('div', 'ovh-actor'); card.setAttribute('role', 'group'); card.setAttribute('aria-label', 'Your own AI');
        const face = h('span', 'ovh-face'); face.append(siteIcon('actor', 28));
        const txt = h('span', 'ovh-actor-txt');
        txt.append(h('b', '', 'Your own AI'), h('small', '', 'It works for you while you watch: finds work, posts, runs your channel.'));
        const go = h('a', 'ovh-go', 'Set it up'); go.href = `${base}/you`;
        const no = h('button', 'ovh-x', 'Not now'); no.type = 'button';
        no.addEventListener('click', () => { try { localStorage.setItem(INVITE_KEY, 'off'); } catch { /* */ } box.textContent = ''; });
        card.append(face, txt, go, no);
        box.append(card);
        if (typeof o.mountIcons === 'function') { try { o.mountIcons(box); } catch { /* */ } }
    }

    // ── Feed: what's new with you, and today ───────────────────────────────────────────────────────────────────
    function wallTop(el, o) {
        styles();
        el.classList.add('ovh');
        el.setAttribute('data-sec', 'wall-top');
        el.textContent = '';
        const compose = h('div'); const today = h('div');
        el.append(compose, today);
        // The composer shows when Community says this person can post (pulse viewer.can_post), so it never offers a
        // post that would be refused.
        o.pulseReady.then((p) => { if (p && p.viewer && p.viewer.can_post && signedIn(o) && compose.isConnected) composer(compose, o); });
        fetch(`${o.apiBase || 'https://openvibe.network'}/api/v1/frame/today`, { credentials: 'omit', headers: { Accept: 'application/json' } })
            .then((r) => (r.ok ? r.json() : null)).then((t) => { if (t && today.isConnected) paintToday(today, t); }).catch(() => {});
    }
    function composer(box, o) {
        const form = h('form', 'ovh-compose');
        const face = h('span', 'ovh-face');
        const pic = o.user && /^https:\/\//.test(String(o.user.avatar_url || o.user.avatar || '')) ? (o.user.avatar_url || o.user.avatar) : '';
        if (pic) { const img = h('img'); img.alt = ''; img.src = pic; face.append(img); } else face.textContent = String((o.user && (o.user.display_name || o.user.username)) || 'Y').charAt(0).toUpperCase();
        const first = String((o.user && (o.user.display_name || o.user.username)) || '').split(/\s+/)[0];
        const ta = h('textarea'); ta.name = 'text'; ta.maxLength = 500; ta.rows = 1; ta.placeholder = first ? `What's new, ${first}?` : "What's new?"; ta.setAttribute('aria-label', "What's new");
        const post = h('button', 'ovh-post', 'Post'); post.type = 'submit'; post.disabled = true;
        ta.addEventListener('input', () => { post.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = `${Math.min(160, ta.scrollHeight + 2)}px`; });
        form.append(face, ta, post);
        const note = h('p', 'ovh-note'); note.hidden = true;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = ta.value.trim(); if (!text) return;
            post.disabled = true;
            try {
                const r = await fetch(`${o.communityBase || COMMUNITY}/api/v1/me/status`, { method: 'POST', credentials: 'omit', headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(j.detail || 'It did not post. Try again in a moment.');
                ta.value = ''; note.hidden = false; note.textContent = 'Posted. It is on your profile and in your followers’ feeds.';
                if (o.onPosted) o.onPosted(j);
            } catch (err) { note.hidden = false; note.textContent = String(err.message || err); post.disabled = false; }
        });
        box.append(form, note);
    }
    function spark(series) {
        const v = (Array.isArray(series) ? series : []).map(Number).filter((x) => Number.isFinite(x)).slice(-14);
        if (v.length < 2) return null;
        const max = Math.max(...v, 1), w = 100, hgt = 18;
        const pts = v.map((x, i) => `${(i / (v.length - 1)) * w},${hgt - (x / max) * (hgt - 2) - 1}`).join(' ');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
        const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        pl.setAttribute('points', pts); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', 'currentColor'); pl.setAttribute('stroke-width', '1.6'); pl.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.append(pl);
        return svg;
    }
    function paintToday(box, t) {
        const rows = [['people', 'People'], ['streams', 'Streams'], ['posts', 'Posts'], ['videos', 'New videos']]
            .map(([k, label]) => [label, t[k] && typeof t[k] === 'object' ? t[k] : { today: t[k] }]).filter(([, v]) => v && Number.isFinite(Number(v.today)));
        if (!rows.length) return;
        const s = h('div', 'ovh-sec'); s.append(h('span', '', 'Today on OpenVibe')); box.append(s);
        const grid = h('div', 'ovh-today');
        rows.forEach(([label, v]) => {
            const c = h('div', 'ovh-stat');
            c.append(h('b', '', num(v.today)), h('small', '', label));
            const sp = spark(v.series); if (sp) c.append(sp);
            grid.append(c);
        });
        box.append(grid);
    }

    // ── Feed: the wall ─────────────────────────────────────────────────────────────────────────────────────────
    const LIVE_RE = /^(.{1,60}?) went live(?::\s*(.*))?$/;
    function pulseUrl(o, cursor) {
        const p = new URLSearchParams({ limit: '20' });
        if (signedIn(o)) p.set('for', 'me');
        if (cursor) p.set('after', cursor);
        return `${o.communityBase || COMMUNITY}/api/v1/pulse?${p}`;
    }
    function loadPulse(o, cursor) {
        return fetch(pulseUrl(o, cursor), { credentials: 'omit', headers: Object.assign({ Accept: 'application/json' }, signedIn(o) ? { Authorization: `Bearer ${o.token}` } : {}) })
            .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    }
    function timeline(el, o) {
        styles();
        el.classList.add('ovh');
        el.setAttribute('data-sec', 'wall');
        el.textContent = '';
        const s = h('div', 'ovh-sec'); s.append(h('span', '', 'On OpenVibe'));
        const list = h('div', 'ovh-wall');
        for (let k = 0; k < 3; k++) list.append(h('span', 'ovh-skel'));
        el.append(s, list);
        let next = null;
        const more = h('button', 'ovh-all', 'Show more'); more.type = 'button'; more.hidden = true;
        el.append(more);
        const draw = (j, append) => {
            if (!append) list.textContent = '';
            const items = (j && Array.isArray(j.items) ? j.items : []).filter((x) => x && typeof x.title === 'string' && safe(x.url));
            // Nothing to show: the section goes, not a line saying so (11-09, the owner: "why does it say show more if there's
            // nothing new").
            if (!items.length && !append) { el.hidden = true; more.hidden = true; return; }
            el.hidden = false;
            // Went live, back to back: one row of names.
            let lives = null;
            items.forEach((x) => {
                const m = LIVE_RE.exec(x.title.trim());
                if (m) {
                    if (!lives) {
                        const row = h('div', 'ovh-entry');
                        const ic = h('span', 'ovh-ic'); ic.append(siteIcon('live', 26));
                        const txt = h('span', 'ovh-entry-txt'); txt.append(h('b', '', 'Went live recently'));
                        lives = h('span', 'ovh-lives'); txt.append(lives, h('small', '', ago(x.occurred_at || x.at)));
                        row.append(ic, txt); list.append(row);
                    }
                    if (lives.childNodes.length < 8) { const a = h('a', '', m[1]); a.href = safe(x.url); a.title = m[2] || ''; lives.append(a); }
                    return;
                }
                lives = null;
                const a = h('a', 'ovh-entry'); a.href = safe(x.url);
                const svc = String((x.ref && x.ref.service) || x.service || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
                const ic = h('span', 'ovh-ic'); ic.append(siteIcon(svc || 'ov', 26));
                const txt = h('span', 'ovh-entry-txt');
                txt.append(h('b', '', x.title.slice(0, 220)));
                const meta = [ago(x.occurred_at || x.at), x.via ? `via ${String(x.via).slice(0, 40)}` : '', x.origin === 'ai' ? 'made by AI' : ''].filter(Boolean).join(' · ');
                if (meta) txt.append(h('small', '', meta));
                a.append(ic, txt); list.append(a);
            });
            next = j && j.next_cursor ? j.next_cursor : null;
            more.hidden = !next;
            if (typeof o.mountIcons === 'function') { try { o.mountIcons(el); } catch { /* */ } }
        };
        o.pulseReady.then((j) => { if (el.isConnected) draw(j, false); });
        more.addEventListener('click', async () => { more.disabled = true; const j = await loadPulse(o, next); more.disabled = false; if (j) draw(j, true); });
    }


    // ── Feed v2: a real feed (owner, 11-09: "a real feed… you scroll through easy content… sections or a filter system…
    // clean, intuitive"). Community's GET /api/v1/feed (plan "Feed v2"): one stream of cards by kind, chips on top, more as
    // you near the end. When the API is not there yet, the pulse wall above stands (timeline()).
    const KINDS = [['', 'For you'], ['live', 'Live'], ['clip', 'Clips'], ['video', 'Videos'], ['pic', 'Pics'], ['post', 'Posts'], ['meme', 'Memes'], ['game', 'Games'], ['update', 'Updates']];
    function feedUrl(o, kind, cursor) {
        const p = new URLSearchParams({ limit: '12' });
        if (kind) p.set('kind', kind);
        if (cursor) p.set('cursor', cursor);
        return `${o.communityBase || COMMUNITY}/api/v1/feed?${p}`;
    }
    function loadFeed(o, kind, cursor) {
        return fetch(feedUrl(o, kind, cursor), { credentials: 'omit', headers: Object.assign({ Accept: 'application/json' }, signedIn(o) ? { Authorization: `Bearer ${o.token}` } : {}) })
            .then((r) => (r.ok ? r.json() : null)).then((j) => (j && Array.isArray(j.items) ? j : null)).catch(() => null);
    }
    const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.getAttribute('data-ov-motion') === 'reduced' || !!(navigator.connection && navigator.connection.saveData); } catch { return false; } };
    const count = (n) => { const v = Number(n) || 0; return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v); };
    let player = null;   // one IntersectionObserver plays the preview in view and pauses the rest
    function watchPreview(box, c) {
        const media = c.media || {};
        const preview = safe(media.preview);
        if (!preview || still() || typeof IntersectionObserver !== 'function') return;
        player = player || new IntersectionObserver((es) => es.forEach((x) => {
            const v = x.target.querySelector('video');
            if (x.isIntersecting && x.intersectionRatio >= 0.6) {
                if (!v) { const nv = document.createElement('video'); nv.muted = true; nv.loop = true; nv.playsInline = true; nv.setAttribute('playsinline', ''); nv.preload = 'none'; nv.src = x.target.getAttribute('data-preview'); nv.className = 'ovf-video'; x.target.append(nv); nv.play().catch(() => {}); }
                else v.play().catch(() => {});
            } else if (v) v.pause();
        }), { threshold: [0, 0.6] });
        box.setAttribute('data-preview', preview);
        player.observe(box);
    }
    function feedCard(c) {
        const kind = String(c.kind || 'post');
        const url = safe(c.url);
        if (!url) return null;
        if (kind === 'update') {
            const a = h('a', 'ovf-update'); a.href = url;
            const ic = h('span', 'ovh-ic'); ic.append(siteIcon(c.site || 'ov', 20));
            const t = h('span', 'ovf-update-txt'); t.append(h('b', '', String(c.title || '').slice(0, 160)), h('small', '', [c.site_name || c.site, ago(c.at)].filter(Boolean).join(' · ')));
            a.append(ic, t); return a;
        }
        const a = h('a', `ovf-card ovf-${kind.replace(/[^a-z]/g, '')}`); a.href = url;
        const head = h('span', 'ovf-head');
        const face = h('span', 'ovf-face');
        const av = c.actor && safe(c.actor.avatar);
        if (av && /^https:/.test(av)) { const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = av; face.append(img); } else face.textContent = String((c.actor && c.actor.name) || '?').charAt(0).toUpperCase();
        const who = h('span', 'ovf-who');
        who.append(h('b', '', String((c.actor && c.actor.name) || c.site_name || '').slice(0, 60)));
        const meta = h('small', '');
        meta.append(siteIcon(c.site || 'ov', 14), document.createTextNode(` ${[c.site_name || '', ago(c.at)].filter(Boolean).join(' · ')}`));
        who.append(meta);
        head.append(face, who);
        if (kind === 'live') head.append(h('span', 'ovf-livechip', 'LIVE'));
        a.append(head);
        const media = c.media || {};
        const thumb = safe(media.thumb);
        if (thumb && /^https:/.test(thumb)) {
            const box = h('span', 'ovf-media');
            const r = Number(media.ratio) > 0 ? Math.max(0.8, Math.min(1.91, Number(media.ratio))) : (kind === 'pic' || kind === 'meme' ? 1 : 16 / 9);
            box.style.aspectRatio = String(r);
            const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = thumb; box.append(img);
            if (media.length) box.append(h('span', 'ovf-len', String(media.length).slice(0, 10)));
            if (kind === 'live' && c.counts && c.counts.viewers) box.append(h('span', 'ovf-len ovf-viewers', `${count(c.counts.viewers)} watching`));
            a.append(box);
            if (kind === 'clip' || kind === 'video' || kind === 'live') watchPreview(box, c);
        }
        if (c.title) a.append(h('b', 'ovf-title', String(c.title).slice(0, 200)));
        if (c.text && (kind === 'post' || !thumb)) a.append(h('p', 'ovf-text', String(c.text).slice(0, 500)));
        const n = c.counts || {};
        const bits = [n.views ? `${count(n.views)} views` : '', n.likes ? `♥ ${count(n.likes)}` : '', n.comments ? `${count(n.comments)} replies` : ''].filter(Boolean);
        if (bits.length) a.append(h('small', 'ovf-counts', bits.join(' · ')));
        return a;
    }
    function feed(el, o) {
        styles(); feedStyles();
        el.classList.add('ovh', 'ovf');
        el.setAttribute('data-sec', 'wall');
        el.textContent = '';
        const chips = h('div', 'ovf-chips'); chips.setAttribute('role', 'tablist'); chips.setAttribute('aria-label', 'Feed');
        const list = h('div', 'ovf-list');
        const sentinel = h('div', 'ovf-more');
        el.append(chips, list, sentinel);
        let kind = '', cursor = null, busy = false, done = false, seq = 0;
        const skeletons = () => { for (let k = 0; k < 3; k++) list.append(h('span', 'ovf-skel')); };
        const clearSkels = () => list.querySelectorAll('.ovf-skel').forEach((x) => x.remove());
        async function more(first) {
            if (busy || done) return;
            busy = true; const my = ++seq;
            if (first) { list.textContent = ''; skeletons(); } else skeletons();
            const j = await loadFeed(o, kind, cursor);
            if (my !== seq) return;
            clearSkels(); busy = false;
            if (!j) {
                if (first && !kind) { el.textContent = ''; if (o.feedMissing) o.feedMissing(); timeline(el, o); return; }   // the API is not there: the wall stands
                done = true; sentinel.textContent = ''; sentinel.append(h('p', 'ovh-note', 'That did not load. Pull the menu again to retry.')); return;
            }
            if (first && o.feedLive) o.feedLive();
            j.items.map(feedCard).filter(Boolean).forEach((c) => list.append(c));
            if (typeof o.mountIcons === 'function') { try { o.mountIcons(list); } catch { /* */ } }
            cursor = j.next_cursor || null;
            done = !cursor;
            sentinel.textContent = '';
            if (done) sentinel.append(h('p', 'ovh-note ovf-caught', list.childNodes.length ? "You're all caught up." : 'Nothing here yet.'));
        }
        KINDS.forEach(([k, label]) => {
            const b = h('button', 'ovf-chip', label); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', k === kind ? 'true' : 'false');
            b.addEventListener('click', () => {
                if (k === kind) return;
                kind = k; cursor = null; done = false; busy = false;
                chips.querySelectorAll('.ovf-chip').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
                more(true);
            });
            chips.append(b);
        });
        if (typeof IntersectionObserver === 'function') {
            const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) more(false); }, { root: el.closest('.ovs-list') || null, rootMargin: '600px 0px' });
            io.observe(sentinel);
        }
        more(true);
        return { update() {} };
    }
    function feedStyles() {
        if (document.getElementById('ovf-styles')) return;
        const st = document.createElement('style'); st.id = 'ovf-styles';
        st.textContent = `
.ovf-chips{position:sticky;top:0;z-index:2;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:8px 4px;margin:0 -4px;background:var(--bg-secondary,#141a24)}
.ovf-chips::-webkit-scrollbar{display:none}
.ovf-chip{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--border,rgba(255,255,255,.12));background:transparent;color:var(--text-secondary,#a8b3c4);font:inherit;font-size:13.5px;font-weight:650;cursor:pointer}
.ovf-chip[aria-selected=true]{background:var(--text-primary,#e8ecf3);color:var(--bg-primary,#0b1220);border-color:transparent}
.ovf-list{display:grid;gap:10px;padding:4px 0}
@media (min-width:861px){.ovf-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ovf-card{display:grid;gap:8px;padding:10px;border-radius:16px;background:color-mix(in srgb,var(--text-primary,#e8ecf3) 4%,transparent);box-shadow:inset 0 0 0 1px var(--border,rgba(255,255,255,.08));color:inherit;text-decoration:none;min-width:0}
@media (hover:hover){.ovf-card:hover{background:color-mix(in srgb,var(--text-primary,#e8ecf3) 7%,transparent)}}
.ovf-head{display:flex;align-items:center;gap:8px;min-width:0}
.ovf-face{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:50%;overflow:hidden;background:var(--accent,#3b82f6);color:#fff;font-weight:800;font-size:13px}
.ovf-face img{width:100%;height:100%;object-fit:cover}
.ovf-who{min-width:0;display:grid}
.ovf-who b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ovf-who small{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-muted,#93a0b4)}
.ovf-livechip{margin-left:auto;padding:2px 8px;border-radius:6px;background:var(--live,#ef4444);color:#fff;font-size:11px;font-weight:800;letter-spacing:.06em}
.ovf-media{position:relative;display:block;border-radius:12px;overflow:hidden;background:var(--bg-tertiary,#1f2633)}
.ovf-media img,.ovf-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ovf-len{position:absolute;right:8px;bottom:8px;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.72);color:#fff;font-size:12px;font-weight:700}
.ovf-viewers{left:8px;right:auto}
.ovf-title{font-size:14.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ovf-text{margin:0;font-size:14px;line-height:1.5;color:var(--text-secondary,#a8b3c4);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.ovf-counts{font-size:12px;color:var(--text-muted,#93a0b4)}
.ovf-update{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;color:inherit;text-decoration:none}
.ovf-update .ovh-ic{width:34px;height:34px;border-radius:10px;flex:none}
.ovf-update-txt{min-width:0;display:grid;gap:2px}.ovf-update-txt b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ovf-update-txt small{font-size:12px;color:var(--text-muted,#93a0b4)}
.ovf-skel{display:block;height:180px;border-radius:16px;background:linear-gradient(90deg,color-mix(in srgb,var(--text-primary,#e8ecf3) 5%,transparent) 0,color-mix(in srgb,var(--text-primary,#e8ecf3) 9%,transparent) 50%,color-mix(in srgb,var(--text-primary,#e8ecf3) 5%,transparent) 100%);background-size:200% 100%;animation:ovf-shimmer 1.4s ease-in-out infinite}
.ovf-more{min-height:1px}.ovf-caught{text-align:center;padding:10px 0}
@keyframes ovf-shimmer{to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.ovf-skel{animation:none}}
`;
        document.head.appendChild(st);
    }

    root.OpenVibeHome = { home, wallTop, timeline, feed, loadPulse, _defaultHome: defaultHome };
})(typeof window !== 'undefined' ? window : globalThis);
