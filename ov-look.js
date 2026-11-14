/**
 * openvibe-shared/ov-look.js - the Look panel (plan L42, 4.64.0): change your look from any OpenVibe site, signed in
 * or not, without leaving it. navbar.js loads it from beside itself the first time someone opens Look (the palette in
 * the account menu, or Look in a guest's menu), so it costs nothing on first paint.
 *
 *   OVLook.mount(box, { signedIn, season })    draws the panel into `box` and keeps it current (ov:theme, ov:display);
 *                                              season: false leaves out the season switch where the host has its own
 *
 * Theme swatches (the season's own while there is one), the season switch, Icons (4.71.0: Auto, Line or Solid, the
 * person's preference for every OpenVibe icon; plan L56), where this look comes from, Share (4.67.0:
 * a link that opens this page in your theme for anyone, with theme-loader's Use it / Stop bar; built-in themes only),
 * and "More looks" on openvibe.design, the home of every theme. State is theme-loader.js's: a pick applies at once, is
 * kept in this browser, saved to the account when signed in, and travels with links to the other OpenVibe sites.
 */
(function (root) {
    'use strict';
    if (!root || root.OVLook) return;
    const DESIGN = 'https://openvibe.design';
    const PICKS = [['vibe', 'Vibe'], ['midnight', 'Midnight'], ['violet-hour', 'Violet'], ['nord', 'Nord'], ['dracula', 'Dracula'], ['ocean-deep', 'Ocean'],
        ['forest', 'Forest'], ['sunset', 'Sunset'], ['high-contrast', 'Contrast'], ['daylight', 'Daylight'], ['paper', 'Paper']];
    const CSS = '.ovlk{container-type:inline-size;display:grid;gap:10px;padding:12px 4px 4px;font-size:13px;color:var(--text-secondary,#a8b3c4)}'
        + '.ovlk-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.ovlk-h b{color:var(--text-primary,#e6edf7);font-size:13.5px}.ovlk-h span{font-size:11.5px;color:var(--text-muted,#7d8aa0)}'
        + '.ovlk-sw{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}@container (max-width:330px){.ovlk-sw{grid-template-columns:repeat(4,minmax(0,1fr))}}'
        + '.ovlk .ovlk-sw button{all:unset;box-sizing:border-box;display:grid;justify-items:center;gap:4px;padding:6px 0;border-radius:12px;cursor:pointer;border:1px solid transparent}'
        + '.ovlk-sw button:hover{background:var(--bg-hover,rgba(255,255,255,.06))}.ovlk-sw button:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:1px}'
        + '.ovlk-sw button[aria-checked=true]{border-color:var(--accent,#3b82f6);background:color-mix(in srgb,var(--accent,#3b82f6) 12%,transparent)}'
        + '.ovlk-dot{position:relative;width:28px;height:28px;border-radius:50%;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(127,127,127,.35)}.ovlk-dot i{position:absolute;inset:0 0 0 50%}'
        + '.ovlk-sw small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;letter-spacing:-.02em;color:var(--text-muted,#7d8aa0)}.ovlk-sw button[aria-checked=true] small{color:var(--text-primary,#e6edf7)}'
        + '.ovlk .ovlk-season{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:12px;background:var(--bg-tertiary,rgba(255,255,255,.05))}'
        + '.ovlk-season b{color:var(--text-primary,#e6edf7);font-weight:650}'
        + '.ovlk .ovlk-switch{all:unset;position:relative;display:block;width:38px!important;height:22px!important;padding:0!important;flex:none;border-radius:999px;background:var(--border,#2c3d5c);cursor:pointer}.ovlk-switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}'
        + '.ovlk .ovlk-switch[aria-checked=true]{background:var(--accent-strong,var(--accent,#3472d8))}.ovlk .ovlk-switch[aria-checked=true]::after{transform:translateX(16px)}.ovlk .ovlk-switch:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:2px}'
        + '.ovlk-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}.ovlk-why{min-width:0;font-size:11.5px;color:var(--text-muted,#7d8aa0)}'
        + '.ovlk .ovlk-share{all:unset;flex:none;display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--border,rgba(255,255,255,.12));color:var(--text-primary,#e6edf7);font-size:12px;font-weight:650;cursor:pointer}'
        + '.ovlk .ovlk-share:hover{border-color:var(--accent,#3b82f6)}.ovlk .ovlk-share:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:2px}'
        + '.ovlk a.ovlk-more{display:flex!important;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px!important;border-radius:12px;border:1px solid var(--border,rgba(255,255,255,.1));color:var(--text-primary,#e6edf7)!important;text-decoration:none;font-size:13px!important;font-weight:600!important;line-height:1.35}'
        + '.ovlk-more:hover{border-color:var(--accent,#3b82f6)}.ovlk-more span{color:var(--accent-light,var(--accent,#60a5fa))}'
        + '.ovlk-icons{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 6px 6px 10px;border-radius:12px;background:var(--bg-tertiary,rgba(255,255,255,.05))}'
        + '.ovlk-icons>b{color:var(--text-primary,#e6edf7);font-weight:650}'
        + '.ovlk-seg{display:inline-flex;gap:2px;padding:2px;border-radius:999px;background:var(--bg-primary,rgba(0,0,0,.25))}'
        + '.ovlk-tz{min-width:0;max-width:62%;padding:6px 10px;border-radius:999px;border:1px solid var(--border,rgba(255,255,255,.12));background:var(--bg-primary,rgba(0,0,0,.25));color:var(--text-primary,#e6edf7);font:inherit;font-size:.86rem}'
        + '.ovlk .ovlk-seg button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:0 10px;border-radius:999px;cursor:pointer;font-size:12.5px;color:var(--text-secondary,#a8b3c4)}'
        + '.ovlk .ovlk-seg button[aria-checked=true]{background:var(--accent-strong,var(--accent,#3472d8));color:var(--on-accent-strong,#fff)}'
        + '.ovlk .ovlk-seg button:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:1px}'
        + '.ovlk-seg svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.ovlk-seg svg.is-solid{fill:currentColor;stroke:none}'
        + '';

    function css() {
        if (document.getElementById('ov-look-css')) return;
        const st = document.createElement('style'); st.id = 'ov-look-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const el = (tag, attrs, kids) => {
        const n = document.createElement(tag);
        for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
        (kids || []).forEach((c) => n.append(c));
        return n;
    };
    function swatch(id, name, vars, checked) {
        const dot = el('span', { class: 'ovlk-dot', 'aria-hidden': 'true' }, [el('i')]);
        dot.style.background = vars['--bg-primary'] || '#0a0f1c';
        dot.firstChild.style.background = vars['--accent'] || '#3b82f6';
        return el('button', { type: 'button', role: 'radio', 'aria-checked': String(checked), 'data-look': id, title: name }, [dot, el('small', {}, [name])]);
    }

    // A link's arrow is the glyph registry's (no text arrows: the owner, 11-13).
    function goIc() { const sp = document.createElement('span'); sp.setAttribute('aria-hidden', 'true'); sp.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="14" height="14" style="margin-left:5px;vertical-align:-2px"><path d="M3.2 12h16.7M13.7 5.7l6.3 6.3l-6.3 6.3"/></svg>'; return sp; }

    function draw(box, opts) {
        const L = root.OpenVibeThemeLoader;
        box.textContent = '';
        if (!L || !L.THEMES) { box.append(el('a', { class: 'ovlk-more', href: `${DESIGN}/look` }, ['Your look on openvibe.design', goIc()])); return; }
        const season = L.seasons && L.seasons.now();
        const showing = L.seasons && L.seasons.showing();
        const cur = showing ? `season:${showing.id}` : L.getCurrent();
        const panel = el('div', { class: 'ovlk' });
        panel.append(el('div', { class: 'ovlk-h' }, [el('b', {}, ['Look']), el('span', {}, ['Follows you to every OpenVibe site'])]));
        const sw = el('div', { class: 'ovlk-sw', role: 'radiogroup', 'aria-label': 'Theme' });
        if (season && L.THEMES[season.theme]) sw.append(swatch(`season:${season.id}`, season.name, L.THEMES[season.theme], cur === `season:${season.id}`));
        PICKS.forEach(([id, name]) => { if (L.THEMES[id]) sw.append(swatch(id, name, L.THEMES[id], cur === id)); });
        panel.append(sw);
        if (season && opts.season !== false) {
            const on = L.display.get().seasonal !== 'off';
            panel.append(el('div', { class: 'ovlk-season' }, [el('span', {}, [el('b', {}, [`${season.name} theme`]), ` on the default look`]),
                el('button', { type: 'button', class: 'ovlk-switch', role: 'switch', 'aria-checked': String(on), 'aria-label': `${season.name} theme`, 'data-look-season': '' })]));
        }
        // Icons (4.71.0, plan L56; the owner, 2026-11-01: "a setting to prefer a certain icon type... configurable for users
        // in most cases"): Auto (line, solid when small or for the tab you are on), Line or Solid, everywhere OpenVibe
        // draws its icons. A site still forces one where it must (.ovg-solid / .ovg-line).
        if (L.display && L.display.get) {
            const now = L.display.get().icons || 'auto';
            const BELL = '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20a2 2 0 0 0 4 0"/>';
            const BELL_S = '<path d="M5.8 16.2V11a6.2 6.2 0 0 1 12.4 0v5.2l1.7 2.3H4.1ZM9.9 19.6h4.2a2.1 2.1 0 0 1-4.2 0Z"/>';
            const sample = (solid) => { const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('viewBox', '0 0 24 24'); sv.setAttribute('aria-hidden', 'true'); if (solid) sv.setAttribute('class', 'is-solid'); sv.innerHTML = solid ? BELL_S : BELL; return sv; };
            const choice = (id, label, solid) => { const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(now === id), 'data-look-icons': id }, []); if (solid != null) b.append(sample(solid)); b.append(label); return b; };
            panel.append(el('div', { class: 'ovlk-icons' }, [el('b', {}, ['Icons']), el('div', { class: 'ovlk-seg', role: 'radiogroup', 'aria-label': 'Icons' }, [choice('auto', 'Auto', null), choice('line', 'Line', false), choice('solid', 'Solid', true)])]));
        }
        // Text size and motion live here, with the theme (11-09, the owner: "the typography and the Calm button... should
        // just be in the settings... keep day and night"): the account menu keeps only light, dark and auto.
        if (L.display && L.display.get && L.display.options) {
            const d = L.display.get();
            const row = (key, label, items) => el('div', { class: 'ovlk-icons' }, [el('b', {}, [label]), el('div', { class: 'ovlk-seg', role: 'radiogroup', 'aria-label': label },
                items.filter(([v]) => (L.display.options[key] || []).map(String).includes(String(v))).map(([v, t]) => el('button', { type: 'button', role: 'radio', 'aria-checked': String(String(d[key]) === String(v)), 'data-look-set': `${key}:${v}` }, [t])))]);
            if (L.scheme && L.scheme.get) {
                const sch = L.scheme.get();
                panel.append(el('div', { class: 'ovlk-icons' }, [el('b', {}, ['Appearance']), el('div', { class: 'ovlk-seg', role: 'radiogroup', 'aria-label': 'Appearance' },
                    [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([v, t]) => el('button', { type: 'button', role: 'radio', 'aria-checked': String(sch === v), 'data-look-scheme': v }, [t])))]));
            }
            panel.append(row('text', 'Text size', [[100, 'Default'], [112, 'Large'], [125, 'Largest']]));
            // Motion (4.183.0): Auto follows the device; Calm keeps every effect, smaller and slower; only Off stops them.
            panel.append(row('motion', 'Motion', [['auto', 'Auto'], ['full', 'Full'], ['reduced', 'Calm'], ['off', 'Off']]));
            // Windows (4.202.0, asks 304 and 318): every window at once (ov-window.js), glass, solid or outlined.
            panel.append(row('window', 'Windows', [['glass', 'Glass'], ['solid', 'Solid'], ['outline', 'Outline']]));
            // Time (4.248.0; the owner, 11-14): every time on every site in this zone and clock. Auto is this device's.
            if (L.time && L.display.options.clock) {
                panel.append(row('clock', 'Clock', [['auto', 'Auto'], ['12', '12-hour'], ['24', '24-hour']]));
                const dev = L.time.device();
                const cur = d.tz && d.tz !== 'auto' ? d.tz : 'auto';
                const sel = el('select', { class: 'ovlk-tz', 'data-look-tz': '', 'aria-label': 'Time zone' }, [el('option', { value: 'auto' }, [`Auto (${dev.replace(/_/g, ' ')})`])]);
                const zones = L.time.zones();
                if (cur !== 'auto' && zones.indexOf(cur) < 0) zones.unshift(cur);
                zones.forEach((z) => sel.append(el('option', { value: z }, [z.replace(/_/g, ' ')])));
                sel.value = cur;
                panel.append(el('div', { class: 'ovlk-icons' }, [el('b', {}, ['Time zone']), sel]));
            }
        }
        const signedIn = opts.signedIn != null ? !!opts.signedIn : /(?:^|; )ov_sso_hint=account/.test(document.cookie || '') || !!(root.localStorage && (() => { try { return root.localStorage.getItem('ov_token'); } catch (e) { return null; } })());
        const named = showing ? showing.name : ((PICKS.find(([id]) => id === cur) || [0, cur])[1]);
        const why = el('div', { class: 'ovlk-why' }, [`${named} \u00b7 ${signedIn ? 'saved to your account' : 'saved in this browser'}`]);
        const shareId = showing ? showing.theme : cur;
        panel.append(el('div', { class: 'ovlk-foot' }, [why].concat(L.THEMES[shareId] ? [el('button', { type: 'button', class: 'ovlk-share', 'data-look-share': shareId, 'aria-label': `Share the ${named} look` }, ['Share'])] : [])));
        panel.append(el('a', { class: 'ovlk-more', href: `${DESIGN}/` }, ['More looks on openvibe.design', goIc()]));
        box.append(panel);
    }

    /** A link to this page in that theme: anyone who opens it tries it (theme-loader's bar: Use it, Stop). */
    function shareLink(id) {
        const u = new URL(root.location.href);
        u.hash = '';
        ['ov_look', 'ov-try'].forEach((k) => u.searchParams.delete(k));
        u.searchParams.set('ov-try', id);
        return u.toString();
    }
    function share(btn) {
        const url = shareLink(btn.getAttribute('data-look-share'));
        const said = (t) => { btn.textContent = t; root.setTimeout(() => { if (btn.isConnected) btn.textContent = 'Share'; }, 1800); };
        const nav = root.navigator || {};
        if (nav.share && /Android|iPhone|iPad/i.test(nav.userAgent || '')) return nav.share({ title: 'My OpenVibe look', url }).catch(() => {});
        if (nav.clipboard && nav.clipboard.writeText) return nav.clipboard.writeText(url).then(() => said('Link copied'), () => { root.prompt && root.prompt('Copy this link', url); });
        if (root.prompt) root.prompt('Copy this link', url);
    }

    function mount(box, opts) {
        if (!box || box.__ovlk) return;
        box.__ovlk = true;
        opts = opts || {};
        css();
        draw(box, opts);
        box.addEventListener('click', (e) => {
            const L = root.OpenVibeThemeLoader; if (!L) return;
            const sh = e.target.closest && e.target.closest('[data-look-share]');
            if (sh) { e.stopPropagation(); return share(sh); }
            const ic = e.target.closest && e.target.closest('[data-look-icons]');
            if (ic) { e.stopPropagation(); L.display.set({ icons: ic.getAttribute('data-look-icons') }); return draw(box, opts); }
            const sc = e.target.closest && e.target.closest('[data-look-scheme]');
            if (sc && L.scheme) { e.stopPropagation(); L.scheme.set(sc.getAttribute('data-look-scheme')); return draw(box, opts); }
            const ds = e.target.closest && e.target.closest('[data-look-set]');
            if (ds) { e.stopPropagation(); const [k, v] = ds.getAttribute('data-look-set').split(':'); L.display.set({ [k]: /^\d+$/.test(v) ? Number(v) : v }); return draw(box, opts); }
            const s = e.target.closest && e.target.closest('[data-look-season]');
            if (s) { e.stopPropagation(); L.display.set({ seasonal: s.getAttribute('aria-checked') === 'true' ? 'off' : 'on' }); return draw(box, opts); }
            const b = e.target.closest && e.target.closest('[data-look]'); if (!b) return;
            e.stopPropagation();
            const id = b.getAttribute('data-look');
            if (id.indexOf('season:') === 0) { L.display.set({ seasonal: 'on' }); L.save('vibe', null, { keepSeasonal: true }); }
            else L.save(id);
            draw(box, opts);
        });
        box.addEventListener('change', (e) => {
            const L = root.OpenVibeThemeLoader; const t = e.target;
            if (L && t && t.matches && t.matches('[data-look-tz]')) { e.stopPropagation(); L.display.set({ tz: t.value || 'auto' }); }
        });
        ['ov:theme', 'ov:display'].forEach((ev) => root.addEventListener(ev, () => { if (box.isConnected && !(document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-look-tz]'))) draw(box, opts); }));
    }

    root.OVLook = { mount, PICKS, shareLink };
})(typeof window !== 'undefined' ? window : this);
