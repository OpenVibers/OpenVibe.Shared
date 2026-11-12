/**
 * ov-searchbox.js (openvibe-shared 4.229.0): one search field for every site. The owner, 11-12: "improve the search
 * field … autocomplete, dropdown, animated effects … a shared, universal, reusable search input component across all
 * sites". Its list is the one dropdown (ov-combo.js, loaded from beside this file), so it reads and moves like every
 * other list on OpenVibe.
 *
 *   <form action="/search" role="search">
 *     <input name="q" data-ov-searchbox="/api/search/suggest" data-ov-examples="streams|clips|people">
 *   </form>
 *
 * Without script it is the site's own form. With it:
 *   - a pill: the search mark, the field, a clear button and, on a computer, a "/" key hint; its edge glows with focus;
 *   - the placeholder walks through the examples ("Search streams", "Search clips"…) while the field is empty and idle
 *     (Calm walks slower; motion Off keeps the first);
 *   - as you type, suggestions from the source: GET <source>?q=&limit=8 → { sections: [{ id, label, items: [{ label, url,
 *     sub, icon, image }] }] } (OVCombo's shape; same origin, the page's cookies); while the field is empty, the person's
 *     recent searches here (this browser only; data-ov-recent="off" keeps none);
 *   - the first suggestion that starts with what was typed shows the rest as a ghost: Tab, or → at the end, takes it;
 *   - Enter searches what was typed: the form's action with ?<name>=…, or the row the arrows chose (its url); "/" anywhere
 *     on the page (outside another field) puts the cursor in the first one; Esc closes the list, then clears the field.
 *
 * A site with its own data or its own search (an SPA):
 *   OVSearchBox.mount(input, { source: async (q, signal) => ({ sections }), examples: ['streams', 'clips'], scope,
 *     recent: true, onSearch(q, item) { … return false to stop the page from moving } }) → { input, set(q), focus(), destroy() }
 * Events on the input: 'ov-search' { detail: { q, item } }, cancelable: a page that searches in place calls preventDefault.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVSearchBox) return;

    // The files loaded from beside this one, by content (scripts/sibling-revs.js): a release changes their URLs.
    const SEARCHBOX_REV = { 'ov-combo.js': '8001a3b19c2f' };
    const self = document.currentScript && document.currentScript.src;
    const base = (self && /^(.*\/)ov-searchbox\.js/.exec(self)) ? /^(.*\/)ov-searchbox\.js/.exec(self)[1] : 'https://openvibe.network/shared/';

    const svg = (inner, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
    const IC = { search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>'), clear: svg('<path d="M7 7l10 10M17 7 7 17"/>', 16) };
    const CSS = `.ovsb { position: relative; display: flex; align-items: center; gap: 4px; box-sizing: border-box; min-height: 44px; padding: 0 6px 0 12px; border-radius: 999px;
  background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, var(--bg-secondary, #111826)); border: 1px solid var(--border, rgba(255,255,255,.12)); color: var(--text-primary, #e6edf7);
  transition: border-color .18s ease, box-shadow .25s ease, background-color .18s ease; }
.ovsb:hover { border-color: color-mix(in srgb, var(--accent, #3b82f6) 35%, var(--border, rgba(255,255,255,.12))); }
.ovsb.is-focus { border-color: var(--accent, #3b82f6); background: color-mix(in srgb, var(--text-primary, #e6edf7) 3%, var(--bg-secondary, #111826));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent), 0 8px 26px color-mix(in srgb, var(--accent, #3b82f6) 18%, transparent); }
.ovsb-mark { flex: none; display: grid; place-items: center; width: 24px; height: 24px; color: var(--text-muted, #93a0b4); transition: color .18s ease, transform .3s cubic-bezier(.2, 1.4, .4, 1); }
.ovsb.is-focus .ovsb-mark { color: var(--accent-light, var(--accent, #60a5fa)); transform: scale(1.08) rotate(-8deg); }
.ovsb.is-busy .ovsb-mark { animation: ovsb-look 1s ease-in-out infinite; }
.ovsb-field { position: relative; flex: 1; min-width: 0; display: grid; }
.ovsb-field > input, .ovsb-ghost { grid-area: 1 / 1; box-sizing: border-box; width: 100%; min-width: 0; margin: 0; padding: 10px 4px; border: 0; font: inherit; font-size: 16px; line-height: 22px; letter-spacing: inherit; }
.ovsb-field > input { position: relative; z-index: 1; background: transparent; color: inherit; outline: none; -webkit-appearance: none; appearance: none; }
.ovsb-field > input::-webkit-search-cancel-button, .ovsb-field > input::-webkit-search-decoration { -webkit-appearance: none; }
.ovsb-field > input::placeholder { color: var(--text-muted, #93a0b4); opacity: 1; transition: opacity .22s ease, transform .22s ease; }
.ovsb.is-swap .ovsb-field > input::placeholder { opacity: 0; }
.ovsb-ghost { pointer-events: none; overflow: hidden; white-space: pre; color: transparent; }
.ovsb-ghost i { font-style: normal; color: var(--text-muted, #93a0b4); opacity: .7; }
.ovsb-clear, .ovsb-key { flex: none; display: grid; place-items: center; }
.ovsb-clear { width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-muted, #93a0b4); cursor: pointer; animation: ovsb-pop .18s cubic-bezier(.2, 1.4, .4, 1) both; }
.ovsb-clear:hover, .ovsb-clear:focus-visible { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #e6edf7) 10%, transparent); outline: none; }
.ovsb-clear[hidden], .ovsb-key[hidden] { display: none; }
.ovsb-key { min-width: 22px; height: 22px; margin-right: 6px; padding: 0 6px; box-sizing: border-box; border-radius: 6px; border: 1px solid var(--border, rgba(255,255,255,.16));
  font: 700 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text-muted, #93a0b4); }
@media (hover: none), (pointer: coarse) { .ovsb-key { display: none; } }
@keyframes ovsb-pop { from { opacity: 0; transform: scale(.6); } }
@keyframes ovsb-look { 50% { transform: translateX(2px) rotate(-14deg); } }
html[data-ov-motion=calm] .ovsb, html[data-ov-motion=calm] .ovsb-mark { transition-duration: .3s; }
html[data-ov-motion=off] .ovsb, html[data-ov-motion=off] .ovsb-mark, html[data-ov-motion=off] .ovsb-field > input::placeholder { transition: none; }
html[data-ov-motion=off] .ovsb-clear, html[data-ov-motion=off] .ovsb.is-busy .ovsb-mark { animation: none; }
html[data-ov-motion=off] .ovsb.is-focus .ovsb-mark { transform: none; }`;

    function styles() { if (document.getElementById('ovsb-styles')) return; const st = document.createElement('style'); st.id = 'ovsb-styles'; st.textContent = CSS; document.head.appendChild(st); }
    function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
    const motion = () => document.documentElement.getAttribute('data-ov-motion') || '';
    const editable = (t) => !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));

    let comboWait = null;
    function combo() {
        if (root.OVCombo) return Promise.resolve(root.OVCombo);
        if (comboWait) return comboWait;
        comboWait = new Promise((resolve) => {
            let s = document.querySelector('script[data-ov-combo-loader]');
            if (!s) {
                s = document.createElement('script');
                s.src = `${base}ov-combo.js${SEARCHBOX_REV['ov-combo.js'] ? `?v=${SEARCHBOX_REV['ov-combo.js']}` : ''}`;
                s.async = true; s.setAttribute('data-ov-combo-loader', '');
                document.head.appendChild(s);
            }
            s.addEventListener('load', () => resolve(root.OVCombo || null));
            s.addEventListener('error', () => resolve(null));
        });
        return comboWait;
    }

    const mounted = [];

    function mount(input, opts) {
        if (!input || input.__ovsb) return input && input.__ovsb;
        styles();
        const o = Object.assign({}, opts);
        const form = input.form || null;
        const name = input.name || 'q';
        const srcAttr = input.getAttribute('data-ov-searchbox');
        const source = o.source || (srcAttr && srcAttr !== 'true' && srcAttr !== '' ? srcAttr : null);
        const examples = (o.examples || String(input.getAttribute('data-ov-examples') || '').split('|')).map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
        const keepRecent = o.recent !== false && input.getAttribute('data-ov-recent') !== 'off';
        const scope = String(o.scope || input.getAttribute('data-ov-scope') || location.host).slice(0, 80);
        const key = `ov-sb:${scope}`;
        const words = input.getAttribute('placeholder') || 'Search';

        // The pill around the field (the field itself stays where the page put it: its form, its name, its value).
        const pill = el('div', 'ovsb');
        const mark = el('span', 'ovsb-mark'); mark.innerHTML = IC.search;
        const fieldBox = el('span', 'ovsb-field');
        const ghost = el('span', 'ovsb-ghost'); ghost.setAttribute('aria-hidden', 'true');
        const clear = el('button', 'ovsb-clear'); clear.type = 'button'; clear.innerHTML = IC.clear; clear.setAttribute('aria-label', 'Clear the search'); clear.hidden = !input.value;
        const hint = el('kbd', 'ovsb-key'); hint.textContent = '/'; hint.title = 'Press / to search';
        input.parentNode.insertBefore(pill, input);
        fieldBox.append(input, ghost);
        pill.append(mark, fieldBox, clear, hint);
        if (input.type !== 'search') { try { input.type = 'search'; } catch { /* the type it had */ } }
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('enterkeyhint', 'search');
        input.setAttribute('spellcheck', 'false');
        if (!input.getAttribute('aria-label')) input.setAttribute('aria-label', words);
        if (form && !form.getAttribute('role')) form.setAttribute('role', 'search');

        // Recent searches, in this browser, per site (or per scope a site names).
        function recents() { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x).slice(0, 8) : []; } catch { return []; } }
        function remember(q) {
            if (!keepRecent || !q) return;
            try { localStorage.setItem(key, JSON.stringify([q, ...recents().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8))); } catch { /* private mode */ }
        }
        function searchUrl(q) {
            const action = form ? (form.getAttribute('action') || location.pathname) : (o.action || '/search');
            const u = new URL(action, location.href);
            u.searchParams.set(name, q);
            return u.href;
        }

        // What the list shows: recent searches while empty; the source's answer while typing (recent ones that match lead).
        const answers = new Map();   // the source's answers, a minute each (the recent searches are read fresh every time)
        async function list(q, signal) {
            const mine = recents();
            if (!q) return { sections: mine.length ? [{ id: 'recent', label: 'Recent searches', items: mine.map((x) => ({ label: x, icon: 'recent', recent: true })) }] : [] };
            const lq = q.toLowerCase();
            const again = mine.filter((x) => x.toLowerCase().startsWith(lq) && x.toLowerCase() !== lq).slice(0, 3).map((x) => ({ label: x, icon: 'recent', recent: true }));
            let sections = [];
            const kept = answers.get(q);
            const fresh = !!(kept && Date.now() - kept.at < 60000);
            if (fresh) sections = kept.sections;
            else if (typeof source === 'function') sections = ((await source(q, signal)) || {}).sections || [];
            else if (source) {
                const u = new URL(source, location.href); u.searchParams.set('q', q); u.searchParams.set('limit', '8');
                pill.classList.add('is-busy');
                try {
                    const r = await fetch(u.href, { credentials: 'same-origin', headers: { accept: 'application/json' }, signal });
                    if (r.ok) sections = ((await r.json()) || {}).sections || [];
                } finally { pill.classList.remove('is-busy'); }
            }
            if (source && !fresh) { answers.set(q, { at: Date.now(), sections }); if (answers.size > 60) answers.delete(answers.keys().next().value); }
            return { sections: [...(again.length ? [{ id: 'recent', label: 'Recent searches', items: again }] : []), ...(Array.isArray(sections) ? sections : [])] };
        }

        // The ghost: the rest of the first suggestion that starts with what was typed.
        let rest = '';
        function paintGhost() {
            const v = input.value;
            ghost.textContent = '';
            if (!rest || !v || document.activeElement !== input || input.selectionEnd !== v.length) return;
            ghost.append(v, Object.assign(el('i'), { textContent: rest }));
        }
        function suggest(items, q) {
            const lq = q.toLowerCase();
            const first = q && items.map((it) => String(it.label || '')).find((l) => l.toLowerCase().startsWith(lq) && l.length > q.length);
            rest = first ? first.slice(q.length) : '';
            paintGhost();
        }
        function takeGhost() {
            if (!rest) return false;
            input.value += rest; rest = ''; paintGhost();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }

        function go(q, item) {
            q = String(q || '').trim();
            if (!q && !(item && item.url)) return;
            if (q && !(item && item.url && !item.recent)) remember(q);
            const ev = new CustomEvent('ov-search', { bubbles: true, cancelable: true, detail: { q, item: item || null } });
            const stay = input.dispatchEvent(ev) === false || (typeof o.onSearch === 'function' && o.onSearch(q, item || null) === false);
            if (stay) return;
            location.assign(item && item.url ? new URL(item.url, location.href).href : searchUrl(q));
        }

        // The examples walk: one every 2.8 s (5 s in Calm), only while the field is empty, idle and on screen.
        let ex = 0, walk = 0;
        function setWords(i) { input.setAttribute('placeholder', examples.length ? `Search ${examples[i % examples.length]}` : words); }
        function walkOn() {
            clearInterval(walk);
            if (examples.length < 2 || motion() === 'off') return;
            walk = setInterval(() => {
                if (input.value || document.activeElement === input || document.hidden) return;
                pill.classList.add('is-swap');
                setTimeout(() => { ex++; setWords(ex); pill.classList.remove('is-swap'); }, 220);
            }, motion() === 'calm' ? 5000 : 2800);
        }
        if (examples.length) setWords(0);
        walkOn();

        let comboApi = null;
        combo().then((C) => {
            if (!C || !input.isConnected) return;
            comboApi = C.enhance(input, {
                source: list, limit: 8, selectFirst: false, cacheMs: 0, anchor: pill,
                none: (q) => (q && source ? `Press Enter to search for “${q}”` : ''),
                pick: (item, q) => { if (item.recent) { input.value = item.label; go(item.label, null); } else go(q || item.label, item); },
                enter: (q) => go(q, null),
                onRows: suggest,
            });
        });

        input.addEventListener('focus', () => { pill.classList.add('is-focus'); hint.hidden = true; });
        input.addEventListener('blur', () => { pill.classList.remove('is-focus'); hint.hidden = !!input.value; rest = ''; paintGhost(); });
        input.addEventListener('input', () => { clear.hidden = !input.value; hint.hidden = !!input.value || document.activeElement === input; rest = rest && input.value ? rest : ''; paintGhost(); });
        input.addEventListener('keydown', (e) => {
            if ((e.key === 'Tab' && !e.shiftKey && rest) || (e.key === 'ArrowRight' && rest && input.selectionEnd === input.value.length)) {
                if (takeGhost()) e.preventDefault();
            } else if (e.key === 'Escape' && !(comboApi && comboApi.shown) && input.value) {
                e.preventDefault(); input.value = ''; clear.hidden = true; rest = ''; paintGhost();
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (e.key === 'Enter' && !comboApi) { e.preventDefault(); go(input.value, null); }
        });
        input.addEventListener('keyup', paintGhost);
        input.addEventListener('click', paintGhost);
        clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; rest = ''; paintGhost(); input.focus(); input.dispatchEvent(new Event('input', { bubbles: true })); });
        if (form) form.addEventListener('submit', (e) => { e.preventDefault(); go(input.value, null); });
        pill.addEventListener('mousedown', (e) => { if (e.target === pill || e.target === mark) { e.preventDefault(); input.focus(); } });

        const api = {
            input,
            set(q) { input.value = String(q || ''); clear.hidden = !input.value; rest = ''; paintGhost(); },
            focus() { input.focus(); },
            destroy() {
                clearInterval(walk);
                if (comboApi) comboApi.destroy();
                pill.parentNode.insertBefore(input, pill); pill.remove();
                input.__ovsb = null;
                const i = mounted.indexOf(api); if (i >= 0) mounted.splice(i, 1);
            },
        };
        input.__ovsb = api;
        mounted.push(api);
        return api;
    }

    // "/" puts the cursor in the page's first search field that shows (never while typing somewhere else).
    document.addEventListener('keydown', (e) => {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || editable(e.target)) return;
        const box = mounted.find((m) => m.input.isConnected && m.input.getClientRects().length);
        if (!box) return;
        e.preventDefault();
        box.focus();
    });

    function scan(scope) { (scope || document).querySelectorAll('input[data-ov-searchbox]').forEach((i) => mount(i)); }
    root.OVSearchBox = { mount, scan };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(), { once: true }); else scan();
    document.addEventListener('ov:boost:load', () => scan());
})(typeof window !== 'undefined' ? window : globalThis);
