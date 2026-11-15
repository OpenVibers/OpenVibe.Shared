/*
 * ov-picker.js — OpenVibePicker: one animated picker for every choice on OpenVibe (plan §AD.8 step 4; the owner, 11-15:
 * "the drop downs … not custom animations"). A sheet from the bottom on a phone, a popover anchored to its chip on a
 * computer; sections, search, an icon and a line per row, a check on the chosen one (or several), keyboard and swipe.
 *
 *   OpenVibePicker.open({ anchor, title, rows | sections, value, multi, search, onPick, onClose }) → { close }
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
.ovp-sec { margin: 10px 10px 4px; font-size: 11.5px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #8b93a4); }
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
.ovp-end { display: flex; align-items: center; gap: 8px; }
.ovp-badge { padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); }
.ovp-check { width: 20px; height: 20px; color: var(--accent-light, var(--accent, #60a5fa)); opacity: 0; transform: scale(.6); transition: opacity .15s ease, transform .2s cubic-bezier(.34,1.56,.64,1); }
.ovp-row[aria-selected="true"] .ovp-check { opacity: 1; transform: none; }
.ovp-none { padding: 22px 12px; text-align: center; color: var(--text-secondary, #a8b3c4); }
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
        const sections = Array.isArray(opts.sections) ? opts.sections.filter((s) => s && Array.isArray(s.rows)) : [{ title: '', rows: Array.isArray(opts.rows) ? opts.rows : [] }];
        const all = sections.flatMap((s) => s.rows);
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
        const wantSearch = opts.search === true || (opts.search !== false && all.length > 8);
        let input = null;
        if (wantSearch) {
            const find = el('div', 'ovp-find'); find.innerHTML = SVG.find;
            input = el('input'); input.type = 'search'; input.placeholder = opts.searchLabel || 'Search'; input.setAttribute('aria-label', opts.searchLabel || 'Search'); input.autocomplete = 'off'; input.spellcheck = false;
            find.append(input); box.append(find);
        }
        const list = el('div', 'ovp-list'); list.setAttribute('role', 'listbox'); if (multi) list.setAttribute('aria-multiselectable', 'true');
        list.setAttribute('aria-label', opts.title || 'Choices');
        box.append(list);
        let rowsEls = [];
        let active = -1;
        const setActive = (i) => {
            rowsEls.forEach((r, n) => r.classList.toggle('is-active', n === i));
            active = i;
            if (rowsEls[i]) { rowsEls[i].scrollIntoView({ block: 'nearest' }); if (input) input.setAttribute('aria-activedescendant', rowsEls[i].id); }
        };
        const iconOf = (row) => {
            const ic = el('span', 'ovp-ic');
            if (row.svg) ic.innerHTML = String(row.svg);
            else if (row.icon) { const i = el('i'); i.setAttribute('data-ov-icon', String(row.icon)); i.setAttribute('aria-hidden', 'true'); ic.append(i); }
            else ic.textContent = String(row.name || '?').trim().charAt(0).toUpperCase();
            return ic;
        };
        const pickOne = (row) => {
            if (!row || row.disabled) return;
            if (multi) {
                const k = String(row.id);
                if (chosen.has(k)) chosen.delete(k); else chosen.add(k);
                rowsEls.forEach((r) => r.setAttribute('aria-selected', String(chosen.has(r.dataset.id))));
                return;
            }
            chosen.clear(); chosen.add(String(row.id));
            rowsEls.forEach((r) => r.setAttribute('aria-selected', String(chosen.has(r.dataset.id))));
            close(true);
            try { if (typeof opts.onPick === 'function') opts.onPick(row); } catch (e) { setTimeout(() => { throw e; }); }
        };
        const paint = (q) => {
            const n = norm(q);
            list.textContent = ''; rowsEls = [];
            let i = 0;
            for (const s of sections) {
                const rows = s.rows.filter((r) => !n || norm(`${r.name} ${r.line || ''} ${r.badge || ''} ${(r.keywords || []).join(' ')}`).includes(n));
                if (!rows.length) continue;
                if (s.title) list.append(el('p', 'ovp-sec', s.title));
                for (const row of rows) {
                    const b = el('button', 'ovp-row'); b.type = 'button'; b.setAttribute('role', 'option'); b.dataset.id = String(row.id);
                    b.id = `${titleId}-${i}`; b.style.setProperty('--i', String(Math.min(i, 14)));
                    b.setAttribute('aria-selected', String(chosen.has(String(row.id))));
                    if (row.disabled) b.setAttribute('aria-disabled', 'true');
                    const t = el('span', 'ovp-t'); t.append(el('b', '', String(row.name || row.id))); if (row.line) t.append(el('small', '', String(row.line)));
                    const end = el('span', 'ovp-end'); if (row.badge) end.append(el('span', 'ovp-badge', String(row.badge))); end.insertAdjacentHTML('beforeend', SVG.check);
                    b.append(iconOf(row), t, end);
                    b.addEventListener('click', () => pickOne(row));
                    b.addEventListener('pointermove', () => setActive(rowsEls.indexOf(b)));
                    list.append(b); rowsEls.push(b); i++;
                }
            }
            if (!rowsEls.length) list.append(el('div', 'ovp-none', n ? `Nothing matches “${q}”` : (opts.empty || 'Nothing to choose yet')));
            active = -1;
            if (root.OVGlyphs && typeof root.OVGlyphs.swap === 'function') { try { root.OVGlyphs.swap(list); } catch { /* glyphs optional */ } }
            // A glyph name the set does not draw (or no glyph script on the page) shows the row's initial, never an empty box.
            requestAnimationFrame(() => list.querySelectorAll('.ovp-ic > i[data-ov-icon]').forEach((i) => {
                if (i.querySelector('svg') || i.getBoundingClientRect().width > 4 && getComputedStyle(i, '::before').content !== 'none') return;
                const row = i.closest('.ovp-row'); const name = row ? (row.querySelector('.ovp-t b') || {}).textContent || '' : '';
                i.parentNode.textContent = name.trim().charAt(0).toUpperCase();
            }));
        };
        paint('');
        if (input) input.addEventListener('input', () => { paint(input.value); if (rowsEls.length) setActive(0); });
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
        const firstOn = rowsEls.findIndex((r) => r.getAttribute('aria-selected') === 'true');
        if (input && !phone()) input.focus(); else (rowsEls[firstOn >= 0 ? firstOn : 0] || box).focus();
        // Keys: arrows move, Enter picks, Escape closes, Tab stays inside; typing finds.
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const from = active >= 0 ? active : rowsEls.indexOf(doc.activeElement);
                const next = Math.max(0, Math.min(rowsEls.length - 1, from + (e.key === 'ArrowDown' ? 1 : -1)));
                setActive(next); if (doc.activeElement !== input) rowsEls[next] && rowsEls[next].focus();
                return;
            }
            if (e.key === 'Enter' && doc.activeElement === input && active >= 0) { e.preventDefault(); rowsEls[active].click(); return; }
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
        let closed = false;
        function close(picked) {
            if (closed) return; closed = true;
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
