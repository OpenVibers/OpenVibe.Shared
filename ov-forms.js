/**
 * openvibe-shared/ov-forms.js — OpenVibe's own select, on every site (the owner, 2026-11-03: "a custom system for those
 * select inputs … shared across the network and all websites rather than using default stuff … mobile, desktop, etc.
 * device specific support that looks amazing"). The look is ov-forms.css; docs/forms.md describes both.
 *
 * Every <select> becomes a button that opens OpenVibe's own list: a menu under it on a computer, a sheet from the
 * bottom on a phone. The <select> stays in the form, hidden, and holds the value: a form posts as it did, a script that
 * sets select.value or listens for change still works, and with no script the page has its plain select.
 *
 *   An <option> may say more than its label:
 *     data-desc="…"           a second line under it
 *     data-badge="…"          a short tag on its right ("Signed in", "72% used")
 *     data-state="ok|warn|bad|off|new"   the tag's tone, and a dot before the label
 *     data-icon="…"           one or two characters before the label (an emoji, a letter)
 *     data-href="/setup"      a link on the row ("Set up"), for a choice that is not ready: disabled options keep it
 *     data-href-label="…"     the link's words
 *   A <select> may say:
 *     data-ov-native          keep the browser's own select (also on any ancestor, or <html data-ov-forms="off">)
 *     data-ov-search="on|off" a search box (on by itself from 9 choices)
 *     data-ov-title="…"       the phone sheet's title (else the select's label)
 *     data-ov-select="bare"   no box of its own and no chevron: a select inside a chip or a toolbar keeps that look,
 *                             and only its list is OpenVibe's (4.109.1)
 *
 *   OVForms.enhance(root)     every select under root (the navbar calls it once the page settles, and for new markup)
 *   OVForms.refresh(select)   read the select again (its options changed in a way the page did not announce)
 *   OVForms.open(select)      open its list
 *
 * Keyboard: Enter, Space, ↓ or ↑ open it; ↑ ↓ Home End move; typing searches (or jumps, without a search box); Enter
 * chooses; Escape and Tab close. A multiple select keeps its list open and says how many are chosen.
 */
(function (root) {
    'use strict';
    if (!root || !root.document || root.OVForms) return;
    const doc = root.document;
    const SEARCH_FROM = 9;
    const PHONE = '(max-width: 640px), (pointer: coarse) and (max-width: 900px)';
    const done = new WeakMap();      // select → its state
    let open = null;                 // the state whose list is open
    let uid = 0;
    // Motion off (html[data-ov-motion=off], theme-loader.js) is the only setting that skips an effect; Calm plays it.
    const reduce = () => document.documentElement.getAttribute('data-ov-motion') === 'off';
    const phone = () => !!(root.matchMedia && root.matchMedia(PHONE).matches);
    const el = (tag, cls, attrs) => {
        const n = doc.createElement(tag);
        if (cls) n.className = cls;
        if (attrs) for (const k of Object.keys(attrs)) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
        return n;
    };
    const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
    const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
    const LOUPE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>';

    // ── The look: ov-forms.css beside this file, once (the navbar adds it with its own ?v=; a page may have it already).
    function stylesheet() {
        const have = doc.querySelector('link[href*="ov-forms.css"]');
        if (have) return have;
        const me = doc.currentScript || doc.querySelector('script[src*="ov-forms.js"]');
        const src = me && me.src ? me.src : '/shared/ov-forms.js';
        const link = el('link', null, { rel: 'stylesheet', href: src.replace(/ov-forms\.js(\?[^#]*)?.*$/, 'ov-forms.css$1') });
        doc.head.appendChild(link);
        return link;
    }
    const sheetReady = new Promise((resolve) => {
        const link = stylesheet();
        if (link.sheet) { resolve(); return; }
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener('error', () => resolve(false), { once: true });
        setTimeout(resolve, 4000);
    });

    // A select drawn as a list box (a size above 1) stays the browser's: it is already a list on the page.
    const skip = (s) => !s || (s.hasAttribute('size') && s.size > 1)
        || s.closest('[data-ov-native]') || doc.documentElement.getAttribute('data-ov-forms') === 'off';

    /** The words that name a select: its label(s), aria-label, or the title the page gave its sheet. */
    function nameOf(s) {
        if (s.dataset.ovTitle) return s.dataset.ovTitle;
        const labels = s.labels ? Array.prototype.slice.call(s.labels) : [];
        for (const l of labels) {
            const copy = l.cloneNode(true);
            copy.querySelectorAll('select,.ov-sel,small,.ov-sel-native').forEach((n) => n.remove());
            const t = copy.textContent.replace(/\s+/g, ' ').trim();
            if (t) return t;
        }
        return s.getAttribute('aria-label') || s.title || 'Choose';
    }

    /** One option as the list draws it. */
    function itemOf(o, i) {
        const d = o.dataset || {};
        return {
            i, value: o.value, label: (o.label || o.textContent || '').replace(/\s+/g, ' ').trim(),
            desc: d.desc || '', badge: d.badge || '', state: d.state || '', icon: d.icon || '',
            href: d.href || '', hrefLabel: d.hrefLabel || 'Set up',
            disabled: o.disabled || !!(o.parentNode && o.parentNode.disabled), group: o.parentNode && o.parentNode.tagName === 'OPTGROUP' ? o.parentNode.label : '',
            hidden: o.hidden,
        };
    }

    function enhanceOne(s) {
        if (done.has(s) || skip(s)) return;
        const st = { s, id: `ov-sel-${++uid}` };
        done.set(s, st);
        const cs = root.getComputedStyle(s);
        const parent = s.parentElement;
        // The button takes the select's place in the layout: its box, its margins, its share of a row or a grid.
        const btn = el('button', 'ov-sel', { type: 'button', id: `${st.id}-btn`, 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
        btn.innerHTML = `<span class="ov-sel-value"></span><span class="ov-sel-chev">${CHEVRON}</span>`;
        const keep = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'flex', 'flex-basis', 'flex-grow', 'flex-shrink', 'align-self', 'justify-self',
            'grid-column', 'grid-row', 'order', 'max-width', 'vertical-align', 'font-size', 'border-radius'];
        for (const p of keep) { const v = cs.getPropertyValue(p); if (v && v !== 'auto' && v !== 'normal' && v !== '0px' && v !== 'none') btn.style.setProperty(p, v); }
        if (cs.display === 'block' || cs.display === 'flex' || cs.display === 'grid') btn.classList.add('is-block');
        const bare = s.dataset.ovSelect === 'bare';
        if (bare) btn.classList.add('is-bare');
        const pw = parent ? parent.clientWidth - parseFloat(root.getComputedStyle(parent).paddingLeft || 0) - parseFloat(root.getComputedStyle(parent).paddingRight || 0) : 0;
        if (s.offsetWidth && pw && s.offsetWidth >= pw - 1 && !bare) btn.classList.add('is-full');
        else if (s.offsetWidth && !bare) btn.style.minWidth = `${s.offsetWidth}px`;
        // Inside an .ov-field the field's own height rules (44 px, the same as its text inputs); elsewhere the select's.
        if (s.offsetHeight && !s.closest('.ov-field') && !bare) btn.style.minHeight = `${s.offsetHeight}px`;
        if (s.className) btn.dataset.from = s.className.slice(0, 120);
        s.insertAdjacentElement('afterend', btn);
        s.classList.add('ov-sel-native');
        s.tabIndex = -1;
        s.setAttribute('aria-hidden', 'true');
        st.btn = btn;
        const ids = (s.labels ? Array.prototype.slice.call(s.labels) : []).map((l) => { if (!l.id) l.id = `${st.id}-l${Math.random().toString(36).slice(2, 6)}`; return l.id; });
        btn.setAttribute('aria-labelledby', [...ids, `${st.id}-btn`].join(' '));
        if (!ids.length) btn.setAttribute('aria-label', nameOf(s));

        // A label's click and a script's focus() land on the hidden select: the button takes them.
        s.addEventListener('focus', () => btn.focus());
        s.addEventListener('change', () => sync(st));
        s.addEventListener('input', () => sync(st));
        s.addEventListener('invalid', (e) => { e.preventDefault(); btn.classList.add('is-invalid'); btn.setAttribute('aria-invalid', 'true'); btn.title = s.validationMessage || ''; btn.focus(); });
        const form = s.form;
        if (form) form.addEventListener('reset', () => setTimeout(() => sync(st), 0));
        // A script that sets the value or the index says nothing: these two are watched on this select only.
        for (const prop of ['value', 'selectedIndex']) {
            const d = Object.getOwnPropertyDescriptor(root.HTMLSelectElement.prototype, prop);
            if (!d || !d.set) continue;
            try {
                Object.defineProperty(s, prop, { configurable: true, enumerable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(st); } });
            } catch { /* a frozen element: the change events still sync */ }
        }
        if (typeof root.MutationObserver === 'function') {
            st.watch = new root.MutationObserver(() => { if (!s.isConnected) { teardown(st); return; } sync(st); if (open === st) draw(st); });
            st.watch.observe(s, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'selected', 'label', 'data-desc', 'data-badge', 'data-state', 'data-href', 'class', 'style', 'required'] });
        }
        btn.addEventListener('click', () => (open === st ? close() : show(st)));
        btn.addEventListener('keydown', (e) => {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && open !== st) { e.preventDefault(); show(st, e.key === 'ArrowUp' ? -1 : 0); return; }
            if (!open && e.key.length === 1 && /\S/.test(e.key) && !s.multiple) jump(st, e.key);
        });
        sync(st);
    }

    function teardown(st) {
        if (st.watch) st.watch.disconnect();
        if (open === st) close();
        if (st.btn && st.btn.isConnected) st.btn.remove();
        done.delete(st.s);
    }

    /** The button says what is chosen, and mirrors the select's state. */
    function sync(st) {
        const { s, btn } = st;
        if (!btn) return;
        const chosen = Array.prototype.filter.call(s.options, (o) => o.selected);
        const value = btn.querySelector('.ov-sel-value');
        value.textContent = '';
        if (s.multiple) {
            value.textContent = chosen.length === 0 ? (s.dataset.placeholder || 'None') : chosen.length <= 2 ? chosen.map((o) => itemOf(o).label).join(', ') : `${chosen.length} chosen`;
            btn.classList.toggle('is-empty', !chosen.length);
        } else {
            const o = chosen[0] || s.options[s.selectedIndex] || null;
            const it = o ? itemOf(o, o.index) : null;
            if (it && it.state) value.appendChild(el('span', `ov-sel-dot is-${it.state}`, { 'aria-hidden': 'true' }));
            else if (it && it.icon) { const ic = el('span', 'ov-sel-icon', { 'aria-hidden': 'true' }); ic.textContent = it.icon; value.appendChild(ic); }
            const text = el('span', 'ov-sel-text');
            text.textContent = it ? it.label : (s.dataset.placeholder || '');
            value.appendChild(text);
            if (it && it.badge) { const b = el('span', `ov-sel-badge${it.state ? ` is-${it.state}` : ''}`); b.textContent = it.badge; value.appendChild(b); }
            btn.classList.toggle('is-empty', !it || it.value === '');
        }
        btn.disabled = s.disabled;
        btn.hidden = s.hidden || root.getComputedStyle(s).display === 'none';
        if (s.validity && s.validity.valid) { btn.classList.remove('is-invalid'); btn.removeAttribute('aria-invalid'); btn.removeAttribute('title'); }
        if (s.required) btn.setAttribute('aria-required', 'true'); else btn.removeAttribute('aria-required');
    }

    /** Typing on the closed button: the next choice whose label starts with what was typed. */
    function jump(st, ch) {
        st.typed = (Date.now() - (st.typedAt || 0) < 700 ? st.typed || '' : '') + ch.toLowerCase();
        st.typedAt = Date.now();
        const opts = Array.prototype.slice.call(st.s.options);
        const from = st.s.selectedIndex + (st.typed.length === 1 ? 1 : 0);
        const order = [...opts.slice(from), ...opts.slice(0, from)];
        const hit = order.find((o) => !o.disabled && !o.hidden && itemOf(o).label.toLowerCase().startsWith(st.typed));
        if (hit) choose(st, hit.index);
    }

    function choose(st, index, keepOpen) {
        const { s } = st;
        const o = s.options[index];
        if (!o || o.disabled) return;
        if (s.multiple) o.selected = !o.selected;
        else { if (s.selectedIndex === index) { if (!keepOpen) close(true); return; } o.selected = true; }
        s.dispatchEvent(new root.Event('input', { bubbles: true }));
        s.dispatchEvent(new root.Event('change', { bubbles: true }));
        sync(st);
        if (s.multiple || keepOpen) draw(st); else close(true);
    }

    // ── The list: a menu under the button, or a sheet from the bottom on a phone ──
    function show(st, startAt) {
        if (open) close();
        if (st.s.disabled) return;
        open = st;
        const sheet = phone();
        st.sheet = sheet;
        const items = Array.prototype.map.call(st.s.options, itemOf).filter((x) => !x.hidden);
        const searchy = st.s.dataset.ovSearch === 'on' || (st.s.dataset.ovSearch !== 'off' && items.length >= SEARCH_FROM);
        const wrap = el('div', sheet ? 'ov-sel-sheet' : 'ov-sel-pop', { id: `${st.id}-pop`, role: sheet ? 'dialog' : null, 'aria-modal': sheet ? 'true' : null, 'aria-label': sheet ? nameOf(st.s) : null });
        if (sheet) {
            const head = el('div', 'ov-sel-sheet-head');
            head.innerHTML = '<span class="ov-sel-grip" aria-hidden="true"></span>';
            const title = el('span', 'ov-sel-sheet-title');
            title.textContent = nameOf(st.s);
            const doneBtn = el('button', 'ov-sel-done', { type: 'button' });
            doneBtn.textContent = st.s.multiple ? 'Done' : 'Close';
            doneBtn.addEventListener('click', () => close(true));
            head.append(title, doneBtn);
            wrap.appendChild(head);
            dragToClose(head, wrap);
        }
        if (searchy) {
            const box = el('label', 'ov-sel-search');
            box.innerHTML = LOUPE;
            const input = el('input', null, { type: 'search', placeholder: 'Search', autocomplete: 'off', spellcheck: 'false', 'aria-controls': `${st.id}-list`, 'aria-label': `Search ${nameOf(st.s)}` });
            input.addEventListener('input', () => { st.query = input.value.trim().toLowerCase(); st.active = null; draw(st); });
            box.appendChild(input);
            wrap.appendChild(box);
            st.input = input;
        } else st.input = null;
        const list = el('ul', 'ov-sel-list', { id: `${st.id}-list`, role: 'listbox', tabindex: searchy ? null : '-1', 'aria-multiselectable': st.s.multiple ? 'true' : null, 'aria-label': nameOf(st.s) });
        wrap.appendChild(list);
        st.wrap = wrap; st.list = list; st.query = '';
        const current = st.s.selectedIndex;
        st.active = startAt === -1 ? last(st, items) : (current >= 0 ? current : null);
        if (sheet) {
            st.scrim = el('div', 'ov-sel-scrim');
            st.scrim.addEventListener('click', () => close(true));
            raise(st.scrim, st.btn);
            raise(wrap, st.btn);
            doc.documentElement.classList.add('ov-sel-locked');
        } else raise(wrap, st.btn);
        if (root.OVSurfaces) {
            st.surface = sheet
                ? root.OVSurfaces.sheet({ el: wrap, opener: st.btn, body: list, close: () => close(true) })
                : root.OVSurfaces.popover({ el: wrap, trigger: st.btn, close: () => close(false) });
            st.surface.open();
        }
        draw(st);
        st.btn.setAttribute('aria-expanded', 'true');
        st.btn.setAttribute('aria-controls', `${st.id}-pop`);
        if (!sheet) place(st);
        requestAnimationFrame(() => {
            wrap.classList.add('is-open');
            if (st.scrim) st.scrim.classList.add('is-open');
            (st.input && !sheet ? st.input : list).focus({ preventScroll: true });
            const a = list.querySelector('[aria-selected="true"], .is-active');
            if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
        });
        wrap.addEventListener('keydown', (e) => keys(st, e));
        list.addEventListener('pointerdown', (e) => { if (e.target.closest('.ov-sel-opt')) e.preventDefault(); });
        list.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;           // a row's own link goes where it says
            const row = e.target.closest('.ov-sel-opt');
            if (row && row.getAttribute('aria-disabled') !== 'true') choose(st, Number(row.dataset.i));
        });
    }

    /**
     * Put the list where it is seen and can be touched (4.109.2): inside the modal <dialog> or the fullscreen element
     * the select is in (else the body), and in the top layer when the browser has popovers, so it opens over the
     * dialog, a fullscreen player, and anything with a z-index.
     */
    const POPOVER = typeof root.HTMLElement === 'function' && typeof root.HTMLElement.prototype.showPopover === 'function';
    function raise(node, from) {
        // A modal dialog makes everything outside it inert, top layer or not: the list lives inside the dialog.
        const host = (from && from.closest('dialog[open]')) || (doc.fullscreenElement && doc.fullscreenElement.contains(from) ? doc.fullscreenElement : null) || doc.body;
        host.appendChild(node);
        if (!POPOVER) return;
        node.setAttribute('popover', 'manual');
        try { node.showPopover(); } catch { node.removeAttribute('popover'); }
    }

    function last(st, items) { for (let k = items.length - 1; k >= 0; k--) if (!items[k].disabled) return items[k].i; return null; }

    /** The rows that match the search, in groups when the select has them. */
    function draw(st) {
        const { s, list } = st;
        if (!list) return;
        const q = st.query || '';
        const items = Array.prototype.map.call(s.options, itemOf).filter((x) => !x.hidden && (!q || `${x.label} ${x.desc} ${x.badge}`.toLowerCase().includes(q)));
        list.textContent = '';
        let group = null;
        for (const it of items) {
            if (it.group && it.group !== group) {
                group = it.group;
                const g = el('li', 'ov-sel-group', { role: 'presentation' });
                g.textContent = group;
                list.appendChild(g);
            }
            const selected = s.options[it.i].selected;
            const row = el('li', `ov-sel-opt${it.disabled ? ' is-disabled' : ''}${st.active === it.i ? ' is-active' : ''}`, {
                id: `${st.id}-o${it.i}`, role: 'option', 'aria-selected': selected ? 'true' : 'false', 'aria-disabled': it.disabled ? 'true' : null, 'data-i': String(it.i),
            });
            const mark = el('span', `ov-sel-mark${s.multiple ? ' is-box' : ''}`, { 'aria-hidden': 'true' });
            mark.innerHTML = TICK;
            const lead = it.state ? el('span', `ov-sel-dot is-${it.state}`, { 'aria-hidden': 'true' }) : it.icon ? el('span', 'ov-sel-icon', { 'aria-hidden': 'true' }) : null;
            if (lead && it.icon && !it.state) lead.textContent = it.icon;
            const words = el('span', 'ov-sel-words');
            const label = el('span', 'ov-sel-label');
            label.textContent = it.label || ' ';
            words.appendChild(label);
            if (it.desc) { const d = el('span', 'ov-sel-desc'); d.textContent = it.desc; words.appendChild(d); }
            row.append(...[s.multiple ? mark : null, lead, words].filter(Boolean));
            if (it.badge) { const b = el('span', `ov-sel-badge${it.state ? ` is-${it.state}` : ''}`); b.textContent = it.badge; row.appendChild(b); }
            if (it.href) { const a = el('a', 'ov-sel-link', { href: it.href }); a.textContent = it.hrefLabel; row.appendChild(a); }
            if (!s.multiple) row.appendChild(mark);
            list.appendChild(row);
        }
        if (!items.length) { const none = el('li', 'ov-sel-none', { role: 'presentation' }); none.textContent = q ? `Nothing matches “${st.query}”` : 'Nothing to choose'; list.appendChild(none); }
        const active = st.active != null && list.querySelector(`#${st.id}-o${st.active}`);
        if (!active) { const first = list.querySelector('.ov-sel-opt:not(.is-disabled)'); st.active = first ? Number(first.dataset.i) : null; if (first) first.classList.add('is-active'); }
        const target = st.input || list;
        if (st.active != null) target.setAttribute('aria-activedescendant', `${st.id}-o${st.active}`); else target.removeAttribute('aria-activedescendant');
    }

    function move(st, step, to) {
        const rows = Array.prototype.slice.call(st.list.querySelectorAll('.ov-sel-opt:not(.is-disabled)'));
        if (!rows.length) return;
        let k = rows.findIndex((r) => Number(r.dataset.i) === st.active);
        if (to === 'first') k = 0; else if (to === 'last') k = rows.length - 1; else k = Math.max(0, Math.min(rows.length - 1, (k < 0 ? (step > 0 ? -1 : rows.length) : k) + step));
        st.list.querySelectorAll('.is-active').forEach((r) => r.classList.remove('is-active'));
        rows[k].classList.add('is-active');
        st.active = Number(rows[k].dataset.i);
        (st.input || st.list).setAttribute('aria-activedescendant', rows[k].id);
        rows[k].scrollIntoView({ block: 'nearest' });
    }

    function keys(st, e) {
        const k = e.key;
        if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
        if (k === 'Tab') { close(false); return; }
        if (k === 'ArrowDown') { e.preventDefault(); move(st, 1); return; }
        if (k === 'ArrowUp') { e.preventDefault(); move(st, -1); return; }
        if (k === 'PageDown') { e.preventDefault(); move(st, 8); return; }
        if (k === 'PageUp') { e.preventDefault(); move(st, -8); return; }
        if ((k === 'Home' || k === 'End') && !st.input) { e.preventDefault(); move(st, 0, k === 'Home' ? 'first' : 'last'); return; }
        if (k === 'Enter' || (k === ' ' && !st.input)) { e.preventDefault(); if (st.active != null) choose(st, st.active); return; }
        if (!st.input && k.length === 1 && /\S/.test(k)) {
            st.typed = (Date.now() - (st.typedAt || 0) < 700 ? st.typed || '' : '') + k.toLowerCase();
            st.typedAt = Date.now();
            const hit = Array.prototype.find.call(st.list.querySelectorAll('.ov-sel-opt:not(.is-disabled)'), (r) => r.textContent.toLowerCase().startsWith(st.typed));
            if (hit) { st.active = Number(hit.dataset.i); st.list.querySelectorAll('.is-active').forEach((r) => r.classList.remove('is-active')); hit.classList.add('is-active'); st.list.setAttribute('aria-activedescendant', hit.id); hit.scrollIntoView({ block: 'nearest' }); }
        }
    }

    /** The menu sits under the button, or over it when there is more room above; never wider than the screen. */
    function place(st) {
        const { btn, wrap } = st;
        if (!wrap || st.sheet) return;
        const r = btn.getBoundingClientRect();
        const vw = root.innerWidth; const vh = root.innerHeight;
        const gap = 6; const edge = 8;
        const below = vh - r.bottom - gap - edge; const above = r.top - gap - edge;
        const up = below < 220 && above > below;
        const room = Math.max(140, Math.min(420, up ? above : below));
        wrap.style.minWidth = `${Math.min(r.width, vw - 2 * edge)}px`;
        wrap.style.maxHeight = `${room}px`;
        const w = Math.min(Math.max(wrap.offsetWidth, r.width), vw - 2 * edge);
        const left = Math.max(edge, Math.min(r.left, vw - edge - w));
        wrap.style.left = `${left}px`;
        if (up) { wrap.style.top = ''; wrap.style.bottom = `${vh - r.top + gap}px`; wrap.classList.add('is-up'); }
        else { wrap.style.bottom = ''; wrap.style.top = `${r.bottom + gap}px`; wrap.classList.remove('is-up'); }
    }

    /** The phone sheet follows a finger down from its head, and closes past a third of its height. */
    function dragToClose(handle, sheet) {
        let y0 = null; let dy = 0;
        handle.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; handle.setPointerCapture && handle.setPointerCapture(e.pointerId); sheet.style.transition = 'none'; });
        handle.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
        const end = () => { if (y0 == null) return; y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > Math.min(160, sheet.offsetHeight / 3)) close(true); };
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }

    function close(refocus) {
        const st = open;
        if (!st) return;
        open = null;
        if (st.surface) { st.surface.destroy(); st.surface = null; }
        st.btn.setAttribute('aria-expanded', 'false');
        st.btn.removeAttribute('aria-controls');
        const wrap = st.wrap; const scrim = st.scrim;
        st.wrap = null; st.list = null; st.scrim = null; st.input = null;
        doc.documentElement.classList.remove('ov-sel-locked');
        const drop = (n) => { if (!n) return; try { if (n.matches(':popover-open')) n.hidePopover(); } catch { /* not a popover */ } n.remove(); };
        const gone = () => { drop(wrap); drop(scrim); };
        if (wrap) wrap.classList.remove('is-open');
        if (scrim) scrim.classList.remove('is-open');
        if (st.sheet && !reduce()) setTimeout(gone, 220); else gone();
        if (refocus) st.btn.focus({ preventScroll: true });
    }

    doc.addEventListener('pointerdown', (e) => {
        if (!open || open.sheet) return;
        if (open.wrap && open.wrap.contains(e.target)) return;
        if (open.btn.contains(e.target)) return;
        close(false);
    }, true);
    root.addEventListener('resize', () => { if (open && !open.sheet) place(open); if (open && open.sheet !== phone()) close(false); });
    doc.addEventListener('scroll', (e) => { if (open && !open.sheet && !(open.wrap && open.wrap.contains(e.target))) place(open); }, true);

    function enhance(scope) {
        const base = scope && scope.querySelectorAll ? scope : doc;
        if (base.tagName === 'SELECT') { enhanceOne(base); return; }
        Array.prototype.forEach.call(base.querySelectorAll('select'), enhanceOne);
    }

    // New markup (a boosted page move, a dialog, a list a script drew): looked at once the page is quiet again.
    let soon = 0;
    function watch() {
        if (typeof root.MutationObserver !== 'function' || !doc.body) return;
        new root.MutationObserver((records) => {
            for (const r of records) for (const n of r.addedNodes) {
                if (n.nodeType === 1 && (n.tagName === 'SELECT' || (n.querySelector && n.querySelector('select')))) {
                    if (!soon) soon = setTimeout(() => { soon = 0; enhance(doc); }, 60);
                    return;
                }
            }
        }).observe(doc.body, { childList: true, subtree: true });
    }

    root.OVForms = {
        enhance: (scope) => sheetReady.then((ok) => { if (ok !== false) enhance(scope); }),
        refresh: (s) => { const st = done.get(s); if (st) { sync(st); if (open === st) draw(st); } },
        open: (s) => { const st = done.get(s); if (st) show(st); },
        close: () => close(true),
    };
    const start = () => sheetReady.then((ok) => { if (ok === false) return; enhance(doc); watch(); });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})(typeof window !== 'undefined' ? window : undefined);
