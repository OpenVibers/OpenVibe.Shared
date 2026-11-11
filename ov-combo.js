/**
 * ov-combo.js (openvibe-shared 4.202.0): one search-as-you-type dropdown for a field. Ask 348, the owner, on Codes'
 * repository field (a browser datalist): "a completely custom drop-down system … that works a little more intelligently
 * … async or dynamic fetching or search … configurable … You should be able to just create the new repository … through
 * this UI". It looks like the one dropdown (ov-drop.js) and works with the keyboard and a screen reader (a combobox
 * with a listbox).
 *
 * Without script the field is a plain input. With it:
 *   <input name="repo" data-ov-combo="/api/v1/me/repos" data-ov-combo-create="/api/v1/repos">
 * reads GET <source>?q=&limit=12 (same origin, the page's cookies) → { sections: [{ id, label, items: [{ label, url,
 * host, private, sub }] }], create: { allowed, host, owner } }, as you type (160 ms after the last key, the one before
 * aborted, answers kept a minute). Picking a row puts its url in the field. With create allowed, a last row offers
 * "Create “name” on OpenVibe Git": POST <create> { name, private: true } → { url, label }, and the new one goes in.
 * A site with its own data: OVCombo.enhance(input, { source: async (q, signal) => ({ sections }), create: async (name) => ({ url }) }).
 * Events on the input: 'ov-combo:pick' { detail: item } after a pick or a create.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVCombo) return;

    const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
    const HOST_IC = {
        'git.openvibe.codes': svg('<circle cx="7" cy="6" r="2.2"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="8" r="2.2"/><path d="M7 8.2v7.6M17 10.2c0 4-6 3-9.2 6"/>'),
        'github.com': svg('<path d="M9 19c-4 1.3-4-2-5.6-2.5M14.6 21v-3.3a2.9 2.9 0 0 0-.8-2.2c2.7-.3 5.6-1.3 5.6-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.5 11.5 0 0 0-6 0C6.2 2.8 5.2 3.1 5.2 3.1a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.8 9.5c0 4.6 2.8 5.7 5.5 6a2.9 2.9 0 0 0-.8 2.2V21"/>'),
        recent: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
        repo: svg('<path d="M5 4.5h11.5a1.5 1.5 0 0 1 1.5 1.5v13H6.5A1.5 1.5 0 0 1 5 17.5z"/><path d="M5 17.5A1.5 1.5 0 0 1 6.5 16H18"/>'),
        plus: svg('<path d="M12 5v14M5 12h14"/>'),
        lock: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5.5" y="11" width="13" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg>',
    };
    const CSS = `.ovcombo { position: fixed; z-index: 10030; box-sizing: border-box; max-height: min(60vh, 420px); overflow: auto; overscroll-behavior: contain; padding: 6px; border-radius: 16px;
  background: color-mix(in srgb, var(--bg-elevated, var(--bg-secondary, #111826)) 96%, transparent); border: 1px solid var(--border, rgba(255,255,255,.12)); box-shadow: 0 18px 44px rgba(0,0,0,.42), 0 2px 6px rgba(0,0,0,.2);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); color: var(--text-primary, #e6edf7); font: 600 14.5px/1.25 var(--font, system-ui, -apple-system, 'Segoe UI', sans-serif);
  transform-origin: 24px 0; animation: ovcombo-in .2s cubic-bezier(.2, 1.2, .3, 1) both; }
.ovcombo.is-up { transform-origin: 24px 100%; }
.ovcombo[hidden] { display: none; }
.ovcombo-sec { margin: 0; padding: 8px 10px 5px; font-size: 11.5px; font-weight: 700; letter-spacing: .02em; color: var(--text-muted, #93a0b4); }
.ovcombo-sec:not(:first-child) { margin-top: 4px; border-top: 1px solid var(--border, rgba(255,255,255,.08)); padding-top: 10px; }
.ovcombo-i { display: flex; align-items: center; gap: 11px; min-height: 46px; padding: 4px 12px 4px 10px; border-radius: 11px; cursor: pointer; }
.ovcombo-i[aria-selected="true"] { background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
.ovcombo-i:hover { background: color-mix(in srgb, var(--text-primary, #e6edf7) 8%, transparent); }
.ovcombo-i[aria-selected="true"]:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 20%, transparent); }
.ovcombo-ic { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); }
.ovcombo-ic svg { width: 18px; height: 18px; }
.ovcombo-i.is-create .ovcombo-ic { color: var(--accent-light, var(--accent, #60a5fa)); background: color-mix(in srgb, var(--accent, #3b82f6) 15%, transparent); }
.ovcombo-t { flex: 1; min-width: 0; display: grid; gap: 2px; }
.ovcombo-t b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovcombo-t b mark { background: none; color: var(--accent-light, var(--accent, #60a5fa)); }
.ovcombo-t small { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: var(--text-muted, #93a0b4); overflow: hidden; white-space: nowrap; }
.ovcombo-none { padding: 14px 12px; font-weight: 500; font-size: 13.5px; color: var(--text-muted, #93a0b4); }
.ovcombo-skel { display: flex; align-items: center; gap: 11px; height: 46px; padding: 0 10px; }
.ovcombo-skel i { flex: none; width: 30px; height: 30px; border-radius: 9px; }
.ovcombo-skel b { height: 11px; border-radius: 6px; width: var(--w, 60%); }
.ovcombo-skel i, .ovcombo-skel b { background: linear-gradient(90deg, color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent), color-mix(in srgb, var(--text-primary, #e6edf7) 12%, transparent), color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent)); background-size: 200% 100%; animation: ovcombo-shine 1.1s linear infinite; }
.ovcombo-err { padding: 10px 12px; font-size: 13px; font-weight: 500; color: var(--live-red, #f87171); }
@keyframes ovcombo-in { from { opacity: 0; transform: translateY(-4px) scale(.97); } }
@keyframes ovcombo-shine { to { background-position: -200% 0; } }
html[data-ov-motion=off] .ovcombo, html[data-ov-motion=off] .ovcombo-skel i, html[data-ov-motion=off] .ovcombo-skel b { animation: none; }`;

    let pop = null, cur = null, uid = 0;
    function styles() { if (document.getElementById('ovcombo-styles')) return; const st = document.createElement('style'); st.id = 'ovcombo-styles'; st.textContent = CSS; document.head.appendChild(st); }
    function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    const nameOf = (q) => { const s = String(q || '').trim().replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, ''); const last = s.split('/').pop(); return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(last || '') ? last : ''; };
    const ago = (t) => { const s = (Date.now() - new Date(t).getTime()) / 1000; if (!isFinite(s) || s < 0) return ''; return s < 3600 ? `${Math.max(1, Math.floor(s / 60))} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };

    function enhance(input, opts) {
        if (!input || input.__ovcombo) return input && input.__ovcombo;
        styles();
        const o = Object.assign({}, opts);
        const src = o.source || input.getAttribute('data-ov-combo');
        const createAt = o.create || input.getAttribute('data-ov-combo-create');
        const listId = `ovcombo-${++uid}`;
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', listId);
        input.setAttribute('autocomplete', 'off');
        input.removeAttribute('list');
        const cache = new Map();
        let rows = [], at = -1, ctl = null, timer = 0, lastQ = null, creating = false;

        async function fetchQ(q) {
            const hit = cache.get(q);
            if (hit && Date.now() - hit.at < 60000) return hit.v;
            if (ctl) ctl.abort();
            ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            let v;
            if (typeof src === 'function') v = await src(q, ctl && ctl.signal);
            else {
                const u = new URL(src, location.href); u.searchParams.set('q', q); u.searchParams.set('limit', '12');
                const r = await fetch(u.href, { credentials: 'same-origin', headers: { accept: 'application/json' }, signal: ctl && ctl.signal });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                v = await r.json();
            }
            v = { sections: Array.isArray(v && v.sections) ? v.sections : [], create: (v && v.create) || null };
            cache.set(q, { at: Date.now(), v });
            return v;
        }
        function place() {
            if (!pop || pop.hidden) return;
            const r = input.getBoundingClientRect();
            const vh = root.innerHeight, vw = root.innerWidth;
            const below = vh - r.bottom - 12, above = r.top - 12;
            const up = below < 220 && above > below;
            pop.classList.toggle('is-up', up);
            const w = Math.min(Math.max(r.width, 280), vw - 16);
            pop.style.width = `${w}px`;
            pop.style.left = `${Math.max(8, Math.min(r.left, vw - w - 8))}px`;
            pop.style.maxHeight = `${Math.min(420, Math.max(160, up ? above : below))}px`;
            if (up) { pop.style.top = ''; pop.style.bottom = `${vh - r.top + 6}px`; } else { pop.style.bottom = ''; pop.style.top = `${r.bottom + 6}px`; }
        }
        function open() {
            if (!pop) { pop = el('div', 'ovcombo'); pop.setAttribute('role', 'listbox'); pop.hidden = true; document.body.appendChild(pop); pop.addEventListener('mousedown', (e) => e.preventDefault()); }
            pop.id = listId;
            pop.setAttribute('aria-label', input.getAttribute('aria-label') || input.placeholder || 'Choices');
            cur = api;
            pop.hidden = false;
            input.setAttribute('aria-expanded', 'true');
            place();
        }
        function close() {
            // A closed list stays closed: the answer still on its way is dropped.
            lastQ = null; clearTimeout(timer);
            if (ctl) { ctl.abort(); ctl = null; }
            if (cur === api && pop) { pop.hidden = true; pop.replaceChildren(); }
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            rows = []; at = -1;
        }
        function mark(text, q) {
            const b = el('b');
            const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
            if (i < 0) { b.textContent = text; return b; }
            b.append(text.slice(0, i), el('mark', null, text.slice(i, i + q.length)), text.slice(i + q.length));
            return b;
        }
        function select(i) {
            at = i;
            rows.forEach((r, k) => r.el.setAttribute('aria-selected', String(k === at)));
            if (rows[at]) { input.setAttribute('aria-activedescendant', rows[at].el.id); rows[at].el.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
        }
        function row(item, q, kind) {
            const d = el('div', `ovcombo-i${kind === 'create' ? ' is-create' : ''}`);
            d.id = `${listId}-${rows.length}`;
            d.setAttribute('role', 'option');
            d.setAttribute('aria-selected', 'false');
            const ic = el('span', 'ovcombo-ic');
            ic.innerHTML = kind === 'create' ? HOST_IC.plus : HOST_IC[item.host] || (kind === 'recent' ? HOST_IC.recent : HOST_IC.repo);
            const t = el('span', 'ovcombo-t');
            t.appendChild(kind === 'create' ? el('b', null, item.label) : mark(String(item.label || item.url || ''), q));
            const subBits = kind === 'create' ? [item.sub] : [item.host && item.host !== 'git.openvibe.codes' ? item.host : item.host ? 'OpenVibe Git' : null, item.sub || (item.updated_at ? ago(item.updated_at) : null)].filter(Boolean);
            if (subBits.length || item.private) {
                const s = el('small');
                if (item.private && kind !== 'create') { const l = el('span'); l.innerHTML = HOST_IC.lock; l.setAttribute('title', 'Private'); s.appendChild(l); }
                s.append(subBits.join(' · '));
                t.appendChild(s);
            }
            d.append(ic, t);
            const k = rows.length;
            d.addEventListener('click', () => choose(k));
            d.addEventListener('mousemove', () => { if (at !== k) select(k); });
            rows.push({ el: d, item, kind });
            return d;
        }
        function skeleton() {
            open();
            pop.replaceChildren();
            ['62%', '48%', '70%'].forEach((w) => { const s = el('div', 'ovcombo-skel'); s.style.setProperty('--w', w); s.append(el('i'), el('b')); pop.appendChild(s); });
            pop.setAttribute('aria-busy', 'true');
        }
        function paint(v, q) {
            open();
            pop.removeAttribute('aria-busy');
            pop.replaceChildren(); rows = []; at = -1;
            let any = false;
            for (const sec of v.sections) {
                const items = (sec.items || []).filter((x) => x && (x.url || x.label));
                if (!items.length) continue;
                any = true;
                const h = el('p', 'ovcombo-sec', sec.label || ''); h.setAttribute('role', 'presentation');
                pop.appendChild(h);
                for (const it of items) pop.appendChild(row(it, q, sec.id === 'recent' ? 'recent' : 'item'));
            }
            const name = nameOf(q);
            const c = v.create;
            const exists = rows.some((r) => String(r.item.label || '').split('/').pop().toLowerCase() === name.toLowerCase());
            if (createAt && c && c.allowed && name && !exists) {
                if (any) { const h = el('p', 'ovcombo-sec', 'New'); h.setAttribute('role', 'presentation'); pop.appendChild(h); }
                pop.appendChild(row({ label: `Create “${name}” on ${c.host === 'git.openvibe.codes' || !c.host ? 'OpenVibe Git' : c.host}`, sub: `Private, under ${c.owner ? '@' + c.owner : 'your account'}. You can share it later.`, name }, q, 'create'));
            }
            if (!rows.length) pop.appendChild(el('div', 'ovcombo-none', q ? `Nothing matches “${q}”. A full address works too.` : 'Nothing here yet. Paste an address, or type a name.'));
            place();
            if (rows.length && q) select(0);
        }
        async function look(q) {
            lastQ = q;
            if (!cache.has(q)) skeleton();
            try {
                const v = await fetchQ(q);
                if (lastQ !== q || document.activeElement !== input) return;
                paint(v, q);
            } catch (e) {
                if (e && e.name === 'AbortError') return;
                if (lastQ !== q) return;
                open(); pop.removeAttribute('aria-busy'); pop.replaceChildren(el('div', 'ovcombo-err', 'The list did not load. You can still paste an address.')); place();
            }
        }
        async function choose(i) {
            const r = rows[i]; if (!r || creating) return;
            if (r.kind !== 'create') { put(r.item); return; }
            creating = true;
            r.el.querySelector('b').textContent = `Creating “${r.item.name}”…`;
            try {
                let made;
                if (typeof createAt === 'function') made = await createAt(r.item.name);
                else {
                    const res = await fetch(new URL(createAt, location.href).href, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ name: r.item.name, private: true }) });
                    made = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(made.message || made.error || `HTTP ${res.status}`);
                }
                cache.clear();
                put({ label: made.label || r.item.name, url: made.url, host: 'git.openvibe.codes', created: true });
            } catch (e) {
                const s = r.el.querySelector('small') || r.el.querySelector('.ovcombo-t').appendChild(el('small'));
                r.el.querySelector('b').textContent = `Create “${r.item.name}”`;
                s.textContent = String((e && e.message) || 'It was not created.').slice(0, 160);
                s.style.color = 'var(--live-red, #f87171)';
            } finally { creating = false; }
        }
        function put(item) {
            input.value = item.url || item.label || '';
            close();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new CustomEvent('ov-combo:pick', { bubbles: true, detail: item }));
            input.__ovcomboPicked = input.value;
        }

        input.addEventListener('focus', () => { if (input.__ovcomboPicked !== input.value || !input.value) look(input.value.trim()); });
        input.addEventListener('input', () => { if (input.__ovcomboPicked === input.value) return; input.__ovcomboPicked = null; clearTimeout(timer); timer = setTimeout(() => look(input.value.trim()), 160); });
        input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) close(); }, 120));
        input.addEventListener('keydown', (e) => {
            const shown = pop && !pop.hidden && cur === api;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!shown) { look(input.value.trim()); return; }
                if (!rows.length) return;
                select(at < 0 ? (e.key === 'ArrowDown' ? 0 : rows.length - 1) : (at + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length);
            } else if (e.key === 'Enter' && shown && at >= 0) { e.preventDefault(); e.stopPropagation(); choose(at); }
            else if (e.key === 'Escape' && shown) { e.preventDefault(); e.stopPropagation(); close(); }
            else if (e.key === 'Tab' && shown) close();
        });
        root.addEventListener('resize', place);
        root.addEventListener('scroll', place, true);
        const api = { input, open: () => look(input.value.trim()), close, destroy() { close(); input.__ovcombo = null; root.removeEventListener('resize', place); root.removeEventListener('scroll', place, true); } };
        input.__ovcombo = api;
        return api;
    }

    function scan(scope) { (scope || document).querySelectorAll('input[data-ov-combo]').forEach((i) => enhance(i)); }
    root.OVCombo = { enhance, scan };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(), { once: true }); else scan();
    document.addEventListener('ov:boost:load', () => scan());
})(typeof window !== 'undefined' ? window : globalThis);
