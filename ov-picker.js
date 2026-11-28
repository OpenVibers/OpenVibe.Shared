/*
 * ov-picker.js — OpenVibePicker: one animated picker for every choice on OpenVibe (plan §AD.8 step 4; the owner, 11-15:
 * "the drop downs … not custom animations"). A sheet from the bottom on a phone, a popover anchored to its chip on a
 * computer; sections, search, an icon and a line per row, a check on the chosen one (or several), keyboard and swipe.
 *
 *   OpenVibePicker.open({ anchor, title, intro?, rows | sections, value, multi, search, onPick, onClose }) → { close }
 *     intro: a sentence under the title saying what the choices are (4.311.0).
 *     rows: [{ id, name, line?, icon? (an OpenVibe glyph name), svg? (markup), badge?, disabled?, group? }]
 *     sections: [{ title, rows }]           value: an id, or ids when multi
 *     onPick(row) for one; onPick(rows) for several, when Done is pressed. search: true, false or 'auto' (more than 8).
 *   OpenVibePicker.enhance(select, opts?) → the pill that stands for a native <select>; the select stays (hidden,
 *     data-ov-native) so forms, labels and screen readers keep working; a pick sets its value and fires change.
 *   OpenVibePicker.enhanceAll(root) — every select[data-ov-picker] under root.
 *   4.266.0: a <select> is OVForms' (ov-forms.js: every select on every site, since 4.109): where OVForms is on the
 *   page, enhance() hands the select to it and draws nothing of its own, so a select never has two systems. The picker
 *   is for choices that are not a select (the composer's chips, a session's context chip and its menu).
 *
 * Motion follows html[data-ov-motion]: Calm moves less (--ov-move), Off does not move. Colours are theme tokens only.
 */
(function (root) {
    'use strict';
    if (root.OpenVibePicker) return;
    const doc = root.document;
    const STYLE_ID = 'ov-picker-style';
    const CSS = `
.ovp-veil { position: fixed; inset: 0; z-index: 2147483000; background: color-mix(in srgb, #000 42%, transparent); opacity: 0; transition: opacity .2s ease; }
.ovp-veil.is-in { opacity: 1; }
.ovp-veil.is-pop { background: transparent; }
.ovp { position: fixed; z-index: 2147483001; display: flex; flex-direction: column; box-sizing: border-box; color: var(--text-primary, #e8ecf3); background: var(--bg-elevated, var(--bg-card, #1a2030)); box-shadow: 0 0 0 1px var(--border, rgba(148,163,184,.18)), 0 24px 60px -20px rgba(0,0,0,.6); font: 14px/1.4 var(--font-body, system-ui, sans-serif); outline: none; }
.ovp.is-sheet { left: 0; right: 0; bottom: 0; max-height: min(78vh, 640px); border-radius: 22px 22px 0 0; padding-bottom: env(safe-area-inset-bottom, 0px); transform: translateY(calc(100% * var(--ov-move, 1))); transition: transform .32s cubic-bezier(.2,.9,.25,1.05); }
.ovp.is-sheet.is-in { transform: none; }
.ovp.is-pop { width: min(360px, calc(100vw - 24px)); max-height: min(480px, calc(100vh - 24px)); border-radius: 16px; opacity: 0; transform: scale(.94) translateY(calc(-6px * var(--ov-move, 1))); transition: opacity .16s ease, transform .22s cubic-bezier(.2,.9,.25,1.15); }
.ovp.is-pop.is-in { opacity: 1; transform: none; }
.ovp-grab { flex: none; width: 40px; height: 5px; margin: 8px auto 2px; border-radius: 999px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 22%, transparent); }
.ovp.is-pop .ovp-grab { display: none; }
.ovp-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 12px 6px 18px; }
.ovp-title { flex: 1; min-width: 0; margin: 0; font-size: 16px; font-weight: 750; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovp-intro { flex: none; margin: 0 18px 8px; font-size: 13px; line-height: 1.45; color: var(--text-secondary, #a8b3c7); }
.ovp-x, .ovp-done { all: unset; box-sizing: border-box; display: inline-grid; place-items: center; min-width: 40px; min-height: 40px; border-radius: 999px; cursor: pointer; color: var(--text-secondary, #a8b3c4); }
.ovp-x:hover { background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); color: var(--text-primary, #e8ecf3); }
.ovp-x svg { width: 20px; height: 20px; }
.ovp-done { padding: 0 16px; font-weight: 750; color: #fff; background: var(--accent, #3b82f6); }
.ovp-x:focus-visible, .ovp-done:focus-visible, .ovp-row:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: -2px; }
.ovp-find { flex: none; margin: 2px 12px 6px; position: relative; }
.ovp-find input { box-sizing: border-box; width: 100%; height: 42px; padding: 0 14px 0 38px; border: 1px solid var(--border, rgba(148,163,184,.2)); border-radius: 12px; background: var(--bg-primary, rgba(0,0,0,.2)); color: inherit; font: inherit; font-size: 16px; outline: none; -webkit-appearance: none; appearance: none; box-shadow: none; margin: 0; }
.ovp-find input::-webkit-search-decoration, .ovp-find input::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }
.ovp-find input:focus { border-color: var(--accent, #3b82f6); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); }
.ovp-find svg { position: absolute; left: 12px; top: 50%; width: 17px; height: 17px; margin-top: -8.5px; color: var(--text-muted, #8b93a4); pointer-events: none; }
.ovp-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 2px 8px 10px; }
.ovp-sec { margin: 10px 10px 4px; font-size: 12px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #8b93a4); }
.ovp-row { all: unset; box-sizing: border-box; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; min-height: 50px; padding: 7px 10px; border-radius: 12px; cursor: pointer; animation: ovp-row-in .26s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 18ms); transition: background-color .14s ease; }
.ovp-row:hover, .ovp-row.is-active { background: color-mix(in srgb, var(--text-primary, #e8ecf3) 7%, transparent); }
.ovp-row:active { transform: scale(.985); }
.ovp-row[aria-disabled="true"] { opacity: .45; cursor: default; }
.ovp-ic { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 7%, transparent); font-weight: 800; }
.ovp-ic svg, .ovp-ic i { width: 18px; height: 18px; }
.ovp-row[aria-selected="true"] .ovp-ic { color: #fff; background: var(--accent, #3b82f6); }
.ovp-t { display: grid; min-width: 0; gap: 1px; }
.ovp-t b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
.ovp-t small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--text-secondary, #a8b3c4); }
.ovp.is-wrap .ovp-t small { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.35; }
.ovp-end { display: flex; align-items: center; gap: 8px; }
.ovp-badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); }
.ovp-check { width: 20px; height: 20px; color: var(--accent-light, var(--accent, #60a5fa)); opacity: 0; transform: scale(.6); transition: opacity .15s ease, transform .2s cubic-bezier(.34,1.56,.64,1); }
.ovp-row[aria-selected="true"] .ovp-check { opacity: 1; transform: none; }
.ovp-none { padding: 22px 12px; text-align: center; color: var(--text-secondary, #a8b3c4); }
.ovp-list .ovp-row { content-visibility: auto; contain-intrinsic-size: auto 52px; }
.ovp-row.is-late { animation: none; }
.ovp-more { height: 1px; }
.ovp-wait { display: grid; place-items: center; padding: 28px 12px; }
@keyframes ovp-row-in { from { opacity: 0; transform: translateY(calc(6px * var(--ov-move, 1))); } }
html[data-ov-motion="off"] .ovp, html[data-ov-motion="off"] .ovp-veil, html[data-ov-motion="off"] .ovp-row, html[data-ov-motion="off"] .ovp-check { transition: none; animation: none; }
.ovp-pill { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 8px; max-width: 100%; min-height: 44px; padding: 0 12px 0 14px; border-radius: 12px; cursor: pointer; color: var(--text-primary, #e8ecf3); background: var(--bg-primary, rgba(0,0,0,.2)); box-shadow: inset 0 0 0 1px var(--border, rgba(148,163,184,.22)); font: inherit; transition: box-shadow .15s ease; }
.ovp-pill:hover { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); }
.ovp-pill:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
.ovp-pill-v { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovp-pill svg { flex: none; width: 16px; height: 16px; color: var(--text-muted, #8b93a4); transition: transform .2s ease; }
.ovp-pill[aria-expanded="true"] svg { transform: rotate(180deg); }
select[data-ov-native] { position: absolute !important; width: 1px !important; height: 1px !important; opacity: 0 !important; pointer-events: none !important; clip-path: inset(50%) !important; }
`;
    const SVG = {
        x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        find: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/></svg>',
        check: '<svg class="ovp-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    };
    const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    function styles() { if (doc.getElementById(STYLE_ID)) return; const s = el('style'); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s); }
    const phone = () => (root.matchMedia ? root.matchMedia('(max-width: 640px), (pointer: coarse) and (max-width: 900px)').matches : root.innerWidth <= 640);
    const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    let current = null;

    function open(opts = {}) {
        if (current) current.close();
        styles();
        const multi = !!opts.multi;
        const sectionsOf = (o) => (Array.isArray(o && o.sections) ? o.sections.filter((x) => x && Array.isArray(x.rows))
            : Array.isArray(o) ? o.filter((x) => x && Array.isArray(x.rows)) : [{ title: '', rows: Array.isArray(o && o.rows) ? o.rows : [] }]);
        let sections = typeof opts.load === 'function' ? [] : sectionsOf(opts);
        let all = sections.flatMap((x) => x.rows);
        const chosen = new Set((multi ? (Array.isArray(opts.value) ? opts.value : []) : (opts.value != null ? [opts.value] : [])).map(String));
        const asSheet = opts.sheet != null ? !!opts.sheet : phone();
        const anchor = opts.anchor || null;
        const before = doc.activeElement;
        const veil = el('div', `ovp-veil${asSheet ? '' : ' is-pop'}`);
        const box = el('div', `ovp ${asSheet ? 'is-sheet' : 'is-pop'}`);
        box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.tabIndex = -1;
        const titleId = `ovp-t-${Math.random().toString(36).slice(2, 8)}`;
        box.setAttribute('aria-labelledby', titleId);
        const head = el('div', 'ovp-head');
        const title = el('h2', 'ovp-title', opts.title || 'Choose'); title.id = titleId;
        const x = el('button', 'ovp-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = SVG.x;
        head.append(title);
        let done = null;
        if (multi) { done = el('button', 'ovp-done', opts.doneLabel || 'Done'); done.type = 'button'; head.append(done); }
        head.append(x);
        box.append(el('div', 'ovp-grab'), head);
        // 4.311.0: a sentence under the title that says what the choices are (the owner, 11-18: "explain this better").
        if (opts.intro) box.append(el('p', 'ovp-intro', String(opts.intro)));
        // A sheet that explains (it has an intro) lets each row's line take two lines instead of cutting it.
        if (opts.intro || opts.wrap) box.classList.add('is-wrap');
        const wantSearch = opts.search === true || (opts.search !== false && (all.length > 8 || typeof opts.load === 'function'));
        let input = null;
        if (wantSearch) {
            const find = el('div', 'ovp-find'); find.innerHTML = SVG.find;
            input = el('input'); input.type = 'search'; input.placeholder = opts.searchLabel || 'Search'; input.setAttribute('aria-label', opts.searchLabel || 'Search'); input.autocomplete = 'off'; input.spellcheck = false;
            find.append(input); box.append(find);
        }
        let closed = false;
        const list = el('div', 'ovp-list'); list.setAttribute('role', 'listbox'); if (multi) list.setAttribute('aria-multiselectable', 'true');
        list.setAttribute('aria-label', opts.title || 'Choices');
        box.append(list);
        // 4.305.0 (the owner, 11-17: "Picker is very unoptimized … lazy loading, asynchronous, dynamic loading … search …
        // less intensive"): every row's search text is made once; a query is the rows that hold every word, the name's
        // own matches first; rows are made 40 at a time as the end of the list comes near (an IntersectionObserver), so a
        // catalog of hundreds opens as fast as a list of ten; one listener on the list serves every row; typing redraws
        // at most once a frame; and the list can come later (opts.load), the sheet opening at once with the mark busy.
        const CHUNK = 40;
        let index = [];          // { row, si, name, hay } for every row, in section order
        let matches = [];        // what the query keeps, in the order it is shown
        let shown = 0;           // how many of matches are drawn
        let rowsEls = [];        // the drawn rows, matches[0..shown)
        let lastSec = -1;
        let query = '';
        let active = -1;
        let loaded = typeof opts.load !== 'function';   // until then, typing only remembers the words
        const sentinel = el('div', 'ovp-more'); sentinel.setAttribute('aria-hidden', 'true');
        const build = () => {
            index = [];
            sections.forEach((sec, si) => sec.rows.forEach((row) => index.push({ row, si, name: norm(row.name || row.id),
                hay: norm(`${row.name || ''} ${row.id || ''} ${row.line || ''} ${row.badge || ''} ${(row.keywords || []).join(' ')}`) })));
        };
        const filter = () => {
            const terms = query.split(/\s+/).filter(Boolean);
            if (!terms.length) return index;
            const hit = [];
            for (const e of index) {
                if (!terms.every((t) => e.hay.includes(t))) continue;
                // The whole phrase at the start of the name first, then in it, then the first word, then anywhere.
                hit.push([e.name.startsWith(query) ? 0 : e.name.includes(query) ? 1 : e.name.startsWith(terms[0]) ? 2 : e.name.includes(terms[0]) ? 3 : 4, e]);
            }
            hit.sort((x, y) => x[0] - y[0]);   // stable: section order within each rank
            return hit.map((x) => x[1]);
        };
        const iconOf = (row) => {
            const ic = el('span', 'ovp-ic');
            if (row.svg) ic.innerHTML = String(row.svg);
            else if (row.icon) { const i = el('i'); i.setAttribute('data-ov-icon', String(row.icon)); i.setAttribute('aria-hidden', 'true'); ic.append(i); }
            else ic.textContent = String(row.name || '?').trim().charAt(0).toUpperCase();
            return ic;
        };
        const rowEl = (row, i) => {
            const b = el('button', `ovp-row${i >= 14 ? ' is-late' : ''}`); b.type = 'button'; b.setAttribute('role', 'option');
            b.dataset.id = String(row.id); b.dataset.i = String(i); b.id = `${titleId}-${i}`;
            if (i < 14) b.style.setProperty('--i', String(i));
            b.setAttribute('aria-selected', String(chosen.has(String(row.id))));
            if (row.disabled) b.setAttribute('aria-disabled', 'true');
            const t = el('span', 'ovp-t'); t.append(el('b', '', String(row.name || row.id))); if (row.line) t.append(el('small', '', String(row.line)));
            const end = el('span', 'ovp-end'); if (row.badge) end.append(el('span', 'ovp-badge', String(row.badge))); end.insertAdjacentHTML('beforeend', SVG.check);
            b.append(iconOf(row), t, end);
            return b;
        };
        const glyphs = (made) => {
            if (!made.some((b) => b.querySelector('.ovp-ic > i[data-ov-icon]'))) return;
            if (root.OVGlyphs && typeof root.OVGlyphs.swap === 'function') { made.forEach((b) => { try { root.OVGlyphs.swap(b); } catch { /* glyphs optional */ } }); }
            // A glyph name the set does not draw (or no glyph script on the page) shows the row's initial, never an empty box.
            requestAnimationFrame(() => made.forEach((b) => b.querySelectorAll('.ovp-ic > i[data-ov-icon]').forEach((i) => {
                if (i.querySelector('svg') || i.getBoundingClientRect().width > 4 && getComputedStyle(i, '::before').content !== 'none') return;
                i.parentNode.textContent = ((b.querySelector('.ovp-t b') || {}).textContent || '').trim().charAt(0).toUpperCase();
            })));
        };
        const more = () => {
            if (shown >= matches.length) return;
            const frag = doc.createDocumentFragment();
            const made = [];
            const stop = Math.min(matches.length, shown + CHUNK);
            for (let i = shown; i < stop; i++) {
                const e = matches[i];
                if (!query && e.si !== lastSec) { lastSec = e.si; const t = sections[e.si].title; if (t) frag.append(el('p', 'ovp-sec', t)); }
                const b = rowEl(e.row, i); frag.append(b); made.push(b);
            }
            rowsEls = rowsEls.concat(made);
            shown = stop;
            list.insertBefore(frag, sentinel);
            if (shown >= matches.length) sentinel.remove();
            glyphs(made);
        };
        const seen = typeof IntersectionObserver === 'function'
            ? new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) more(); }, { root: list, rootMargin: '0px 0px 480px 0px' }) : null;
        const upTo = (i) => { while (i >= shown && shown < matches.length) more(); };
        const setActive = (i, still) => {
            if (i < 0 || i >= matches.length) return;
            upTo(i);
            if (rowsEls[active]) rowsEls[active].classList.remove('is-active');
            active = i;
            const b = rowsEls[i];
            if (!b) return;
            b.classList.add('is-active');
            if (!still) b.scrollIntoView({ block: 'nearest' });
            if (input) input.setAttribute('aria-activedescendant', b.id);
        };
        const paint = () => {
            matches = filter();
            shown = 0; rowsEls = []; lastSec = -1; active = -1;
            list.textContent = '';
            if (!matches.length) {
                list.append(el('div', 'ovp-none', query ? `Nothing matches “${input ? input.value : query}”` : (opts.empty || 'Nothing to choose yet')));
                return;
            }
            list.append(sentinel);
            more();
            if (shown < matches.length) { if (seen) { seen.disconnect(); seen.observe(sentinel); } else upTo(matches.length - 1); }
            list.scrollTop = 0;
        };
        const pickOne = (row) => {
            if (!row || row.disabled) return;
            const k = String(row.id);
            if (multi) {
                if (chosen.has(k)) chosen.delete(k); else chosen.add(k);
                rowsEls.forEach((r) => { if (r.dataset.id === k) r.setAttribute('aria-selected', String(chosen.has(k))); });
                return;
            }
            rowsEls.forEach((r) => { if (r.getAttribute('aria-selected') === 'true' || r.dataset.id === k) r.setAttribute('aria-selected', String(r.dataset.id === k)); });
            chosen.clear(); chosen.add(k);
            close(true);
            try { if (typeof opts.onPick === 'function') opts.onPick(row); } catch (e) { setTimeout(() => { throw e; }); }
        };
        // One listener for every row: a tap picks, a pointer over a row makes it the active one.
        const rowAt = (t) => { const b = t && t.closest ? t.closest('.ovp-row') : null; return b && list.contains(b) ? b : null; };
        list.addEventListener('click', (ev) => { const b = rowAt(ev.target); const e = b ? matches[Number(b.dataset.i)] : null; if (e) pickOne(e.row); });
        list.addEventListener('pointermove', (ev) => { const b = rowAt(ev.target); if (b && Number(b.dataset.i) !== active) setActive(Number(b.dataset.i), true); });
        const fill = (data) => {
            sections = sectionsOf(data); all = sections.flatMap((x) => x.rows);
            loaded = true;
            build(); paint();
        };
        if (typeof opts.load === 'function') {
            const wait = el('div', 'ovp-wait'); wait.setAttribute('role', 'status'); wait.setAttribute('aria-label', 'Loading');
            const mark = el('span', 'ov-mark'); mark.dataset.size = '36'; mark.dataset.state = 'busy'; wait.append(mark);
            list.append(wait);
            if (root.OVMark && typeof root.OVMark.mount === 'function') { try { root.OVMark.mount(mark); } catch { /* the mark is optional */ } }
            Promise.resolve().then(() => opts.load()).then((data) => { if (!closed) fill(data); },
                () => { if (!closed) { list.textContent = ''; list.append(el('div', 'ovp-none', opts.loadError || 'These could not be loaded just now')); } });
        } else {
            build(); paint();
        }
        if (input) {
            // Typing redraws at most once a frame, and not at all when the words did not change.
            let frame = 0;
            input.addEventListener('input', () => {
                if (frame) return;
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    const q = norm(input.value).trim();
                    if (q === query) return;
                    query = q;
                    if (!loaded) return;
                    paint();
                    if (matches.length) setActive(0, true);
                });
            });
        }
        // Where it sits: a sheet from the bottom, or a popover under (or over) its chip, inside the window.
        const place = () => {
            if (asSheet || !anchor || !anchor.getBoundingClientRect) { if (!asSheet) { box.style.left = '50%'; box.style.top = '15vh'; box.style.translate = '-50% 0'; } return; }
            const r = anchor.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, vw = root.innerWidth, vh = root.innerHeight;
            const left = Math.max(12, Math.min(r.left, vw - w - 12));
            const below = r.bottom + 8 + h <= vh - 12 || r.top < vh / 2;
            const top = below ? Math.min(r.bottom + 8, vh - h - 12) : Math.max(12, r.top - 8 - h);
            box.style.left = `${Math.round(left)}px`; box.style.top = `${Math.round(top)}px`;
            box.style.transformOrigin = `${Math.round(r.left + r.width / 2 - left)}px ${below ? '0' : '100%'}`;
        };
        doc.body.append(veil, box);
        if (anchor && anchor.setAttribute) anchor.setAttribute('aria-expanded', 'true');
        place();
        requestAnimationFrame(() => { veil.classList.add('is-in'); box.classList.add('is-in'); });
        const firstOn = matches.findIndex((e) => chosen.has(String(e.row.id)));
        if (firstOn >= 0) upTo(firstOn);
        if (input && !phone()) input.focus(); else (rowsEls[firstOn >= 0 ? firstOn : 0] || box).focus();
        // Keys: arrows move, Enter picks, Escape closes, Tab stays inside; typing finds.
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!matches.length) return;
                const from = active >= 0 ? active : rowsEls.indexOf(doc.activeElement);
                const next = Math.max(0, Math.min(matches.length - 1, from + (e.key === 'ArrowDown' ? 1 : -1)));
                setActive(next); if (doc.activeElement !== input) rowsEls[next] && rowsEls[next].focus();
                return;
            }
            if (e.key === 'Enter' && doc.activeElement === input && active >= 0 && matches[active]) { e.preventDefault(); pickOne(matches[active].row); return; }
            if (e.key === 'Tab') {
                const f = [...box.querySelectorAll('button, input')].filter((n) => !n.disabled && n.offsetParent !== null);
                if (!f.length) return;
                const i = f.indexOf(doc.activeElement);
                if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
                return;
            }
            if (input && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && doc.activeElement !== input) { input.focus(); }
        };
        box.addEventListener('keydown', onKey);
        // A sheet follows a finger down and closes past a third of its height.
        let drag = null;
        if (asSheet) {
            box.addEventListener('pointerdown', (e) => { if (list.scrollTop > 0 && list.contains(e.target)) return; if (e.target.closest('input')) return; drag = { y: e.clientY, h: box.offsetHeight, dy: 0 }; });
            box.addEventListener('pointermove', (e) => { if (!drag) return; drag.dy = Math.max(0, e.clientY - drag.y); if (drag.dy > 6) { box.style.transition = 'none'; box.style.transform = `translateY(${drag.dy}px)`; } });
            const end = () => { if (!drag) return; const d = drag; drag = null; box.style.transition = ''; box.style.transform = ''; if (d.dy > d.h / 3) close(); };
            box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
        }
        veil.addEventListener('click', () => close());
        x.addEventListener('click', () => close());
        if (done) done.addEventListener('click', () => { const rows = all.filter((r) => chosen.has(String(r.id))); close(true); try { if (typeof opts.onPick === 'function') opts.onPick(rows); } catch (e) { setTimeout(() => { throw e; }); } });
        const onResize = () => { if (!asSheet) place(); };
        root.addEventListener('resize', onResize);
        function close(picked) {
            if (closed) return; closed = true;
            if (seen) seen.disconnect();
            current = current && current.box === box ? null : current;
            root.removeEventListener('resize', onResize);
            if (anchor && anchor.setAttribute) anchor.setAttribute('aria-expanded', 'false');
            const off = doc.documentElement.getAttribute('data-ov-motion') === 'off';
            veil.classList.remove('is-in'); box.classList.remove('is-in');
            const gone = () => { veil.remove(); box.remove(); };
            if (off) gone(); else setTimeout(gone, 260);
            const back = anchor && anchor.focus ? anchor : before;
            try { if (back && back.focus) back.focus({ preventScroll: true }); } catch { /* gone */ }
            if (!picked && typeof opts.onClose === 'function') { try { opts.onClose(); } catch { /* the caller's */ } }
        }
        current = { box, close: () => close() };
        return current;
    }

    /** A native <select> drawn as a pill that opens the picker; the select keeps the value, its label and its form. */
    function enhance(select, opts = {}) {
        if (root.OVForms && typeof root.OVForms.enhance === 'function') { select.removeAttribute('data-ov-picker'); try { root.OVForms.enhance(select.parentNode || doc); } catch { /* the select stays */ } return null; }
        if (!select || select.tagName !== 'SELECT' || select.__ovPicker) return select && select.__ovPicker;
        styles();
        const pill = el('button', 'ovp-pill'); pill.type = 'button'; pill.setAttribute('aria-haspopup', 'listbox'); pill.setAttribute('aria-expanded', 'false');
        const v = el('span', 'ovp-pill-v');
        pill.append(v); pill.insertAdjacentHTML('beforeend', SVG.down);
        const labelOf = () => {
            const lab = select.id && doc.querySelector(`label[for="${CSS.escape ? CSS.escape(select.id) : select.id}"]`);
            return opts.title || select.getAttribute('aria-label') || (lab && lab.textContent.trim()) || 'Choose';
        };
        const paintPill = () => {
            const shown = select.multiple ? [...select.selectedOptions].map((o) => o.textContent.trim()).join(', ') : (select.selectedOptions[0] ? select.selectedOptions[0].textContent.trim() : '');
            v.textContent = shown || opts.placeholder || 'Choose';
            pill.setAttribute('aria-label', `${labelOf()}: ${shown || 'none'}. Change it`);
            pill.disabled = select.disabled;
        };
        const sections = () => {
            const out = [];
            let cur = { title: '', rows: [] };
            for (const node of select.children) {
                if (node.tagName === 'OPTGROUP') {
                    if (cur.rows.length) out.push(cur);
                    cur = { title: node.label, rows: [...node.children].map(optRow) }; out.push(cur); cur = { title: '', rows: [] };
                } else if (node.tagName === 'OPTION') cur.rows.push(optRow(node));
            }
            if (cur.rows.length) out.push(cur);
            return out;
        };
        function optRow(o) { return { id: o.value, name: o.textContent.trim(), line: o.dataset.line || '', icon: o.dataset.icon || '', badge: o.dataset.badge || '', disabled: o.disabled }; }
        pill.addEventListener('click', () => {
            open({
                anchor: pill, title: labelOf(), sections: sections(), multi: select.multiple, search: opts.search != null ? opts.search : 'auto',
                value: select.multiple ? [...select.selectedOptions].map((o) => o.value) : select.value,
                onPick: (pick) => {
                    if (select.multiple) { const ids = new Set((pick || []).map((r) => String(r.id))); [...select.options].forEach((o) => { o.selected = ids.has(o.value); }); }
                    else select.value = pick.id;
                    paintPill();
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                },
            });
        });
        select.setAttribute('data-ov-native', '');
        select.tabIndex = -1;
        select.insertAdjacentElement('afterend', pill);
        select.addEventListener('change', paintPill);
        // A label for the select now opens the pill.
        if (select.id) doc.querySelectorAll(`label[for="${select.id}"]`).forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); pill.focus(); }));
        paintPill();
        select.__ovPicker = { pill, refresh: paintPill };
        return select.__ovPicker;
    }
    function enhanceAll(scope) { (scope || doc).querySelectorAll('select[data-ov-picker]').forEach((s) => enhance(s)); }

    root.OpenVibePicker = { open, enhance, enhanceAll, close: () => { if (current) current.close(); } };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => enhanceAll(doc), { once: true }); else enhanceAll(doc);
})(typeof window !== 'undefined' ? window : this);
