/**
 * openvibe-shared/ov-trending.js — every search box shows what people are searching for (4.277.0; plan 2026-11-13 §AD.13
 * (1); the owner, 11-15: "it scrolls thru what's trending with a cool animation/effects in the search input itself …
 * across all sites").
 *
 *   a site's own search: <form action="/search"><input type="search" name="q"> (or inside role="search")
 *                                                the navbar loads this file when a page has one, and it attaches to every
 *                                                such box, now and added later, with what people search on OpenVibe
 *   <input data-ov-trending …>                   any other box that wants the same
 *   data-ov-trending="off"                       leaves a box alone (a box that is not a search, a password, a code)
 *   data-ov-trending="own"                       waits for its page to attach it with its own list (below)
 *   data-ov-trending-site="openvibe.exchange"    the site whose trending lead (default: the page's host)
 *   data-ov-trending-items='["GPT-5 nano","DeepSeek"]'   on the box or its form: the page's OWN list, with no script
 *                                                (4.284.0): what this page is about rotates, never the network's
 *                                                trending people (the owner, 11-16: "curated based on the content on
 *                                                the page"); with chips on focus
 *   the shared composer's search (<textarea name="q"> in a GET form, ov-composer.js) is a search box too (4.284.0;
 *                                                the owner: "the suggestions … animated … shared with the other sites
 *                                                … the same composer across sites"): the line sits on its first line
 *   OVTrending.attach(input, { items, prefix, chips, dive, count, head })   a box with its OWN list: items is an array
 *                                                or a function returning one, of strings or { query, pre }; it rotates
 *                                                those, not the network's. chips, dive and count are off unless asked
 *   OVTrending.update(input)                     the box's context changed: its list is read again
 *   OVTrending.detach(input) / .refresh()
 *
 * Content first (the owner, 11-16: "it's not content aware … try GraveGateKeeper, that's a person … dumb to have it here
 * in the vibe"): what people search across OpenVibe belongs only in a site's own search. A box that filters something of
 * the person's (their sessions, their inbox, their chats) never shows it: it stays plain, or its page gives it its own
 * list (the menu: what you can ask and open; the sessions drawer: your sessions). A placeholder its page changes later
 * is taken up at once, so two lines are never drawn on top of each other, and the line sits on the box's own text line.
 *
 * While a box is empty, its placeholder gives way to the trending searches, one at a time in the box itself, the suggestion
 * alone (no "Try"): the line slides up and out, the next slides up and in, every few seconds, and holds while the box
 * is focused (current(input) gives it to the page's own list) (Calm: slower and shorter; Off and reduced motion: the
 * first one, still). Tab takes the line shown (on a keyboard), and the box's hint says so on focus. Typing hides it at
 * once; clearing the box brings it back. A box that reads nothing gets its placeholder back as its accessible name.
 *
 * Typing a question opens "Deep dive this" under the box (4.279.0; the owner, 11-15: Exchange's deep dive, "added to
 * all of em using an interconnected system"): OpenVibe Exchange's general deep dive of what is typed, every source read
 * and cited. Arrow Down reaches it, Escape closes it. OV_DEEP_DIVE_URL points elsewhere; data-ov-deep-dive="off" (or
 * Exchange's own search and deep dive pages, which have their own) leaves it out.
 *
 * Focus on an empty box opens the list under it as chips (4.278.0): "Trending" (or "Try" while the list is the site's
 * own pages), up to six, each a button that fills the box and searches. Arrow Down moves into them, the arrows between
 * them, Escape closes; typing closes them. A box with its own suggestions (a datalist, aria-autocomplete, a combobox)
 * or data-ov-trending-chips="off" gets no chips.
 *
 * Counting: a search sent from a box (its form's submit, or Enter in a box without a form) goes to
 * https://openvibe.network/api/frame/searched as a beacon ({ q, site }, text/plain: no preflight), never with Do Not Track
 * or Global Privacy Control on, once per query per ten seconds. The list comes from /api/frame/trending (kept 5 minutes
 * in this tab). Nothing is drawn when the list is empty: the box keeps its own placeholder.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVTrending) return;
    const API = root.OV_TRENDING_API || 'https://openvibe.network/api/frame';
    const DIVE = root.OV_DEEP_DIVE_URL || 'https://openvibe.exchange/deep-dive';
    const CANDIDATES = 'input[type="search"], input[name="q"], input[name="query"], input[name="search"], input[data-ov-trending], textarea[name="q"], textarea[data-ov-trending]';
    /** A site's own search (a GET form that goes somewhere, or role="search"), or a box that asked: never a filter. */
    function siteSearch(i) {
        const own = i.getAttribute('data-ov-trending');
        if (own != null) return own !== 'off' && own !== 'own';
        if (i.type === 'hidden' || i.type === 'password' || i.readOnly || i.disabled) return false;
        if (i.type !== 'search' && !/^(q|query|search)$/.test(i.name || '')) return false;
        if (i.closest('[data-ov-trending="off"]')) return false;
        if (i.closest('[role="search"]')) return true;
        const f = i.form;
        if (!f) return false;
        const a = (f.getAttribute('action') || '').trim();
        return !!a && !/^(#|javascript:)/i.test(a) && String(f.method || 'get').toLowerCase() === 'get';
    }
    const KEEP_MS = 5 * 60_000;
    const host = (location.hostname || '').replace(/^www\./, '');
    const boxes = new Map();   // input → { ghost, line, ro, mo, placeholder, labelled, own, i }
    let list = null;           // [{ query }]
    let timer = 0;
    let loading = null;
    let panel = null;          // the open chips: { el, input, kind }
    let taking = false;        // a chip being taken fills the box: not a question being typed

    const motion = () => {
        const m = document.documentElement.getAttribute('data-ov-motion');
        if (m === 'off') return 'off';
        return m === 'calm' || m === 'reduced' ? 'calm' : 'full';
    };
    const css = () => {
        if (document.getElementById('ov-trending-css')) return;
        const st = document.createElement('style');
        st.id = 'ov-trending-css';
        st.textContent = '.ovt-ghost{position:absolute;z-index:1;pointer-events:none;overflow:hidden;display:flex;align-items:center;white-space:nowrap;box-sizing:border-box;contain:layout paint}'
            + '.ovt-ghost[hidden]{display:none}'
            + '.ovt-line{position:absolute;left:0;right:0;top:0;height:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:transform var(--ovt-dur,.55s) cubic-bezier(.2,.8,.2,1),opacity var(--ovt-dur,.55s) ease,filter var(--ovt-dur,.55s) ease}'
            + '.ovt-line.is-out{transform:translateY(calc(-110% * var(--ov-move,1)));opacity:0;filter:blur(2px)}'
            + '.ovt-line.is-in{transform:translateY(calc(110% * var(--ov-move,1)));opacity:0;filter:blur(2px)}'
            + '.ovt-ghost{opacity:.62}.ovt-pre{opacity:.8}.ovt-term{font-weight:inherit;background:linear-gradient(90deg,currentColor 0 38%,var(--ovk-accent,var(--accent,#7aa2ff)) 50%,currentColor 62% 100%);background-size:300% 100%;background-position:0 0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:ovt-shine 1.6s ease-out .15s 1 both}'
            + '.ovt-tab{position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:.72em;padding:1px 6px;border:1px solid currentColor;border-radius:6px;opacity:.55;font-weight:600}'
            + '@keyframes ovt-shine{from{background-position:100% 0}to{background-position:0 0}}'
            + '.ovt-tab{opacity:.8}'
            + 'html[data-ov-motion="off"] .ovt-line{transition:none}html[data-ov-motion="off"] .ovt-term{animation:none;-webkit-text-fill-color:currentColor;background:none}'
            + '.ovt-chips{position:fixed;z-index:9000;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:10px;box-sizing:border-box;border-radius:14px;'
            + 'background:var(--ovk-panel,var(--panel,Canvas));color:var(--ovk-text,var(--text,CanvasText));border:1px solid var(--ovk-line,var(--line,rgba(127,127,127,.3)));'
            + 'box-shadow:0 12px 32px rgba(0,0,0,.28);transform-origin:top center;animation:ovt-pop .22s cubic-bezier(.2,.8,.2,1) both}'
            + '.ovt-chips-head{flex:1 0 100%;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.6;padding:0 2px 2px}'
            + '.ovt-chip{appearance:none;font:inherit;font-size:.9rem;line-height:1.2;min-height:40px;padding:8px 14px;border-radius:999px;color:inherit;cursor:pointer;max-width:100%;'
            + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--ovk-line,rgba(127,127,127,.35));'
            + 'background:color-mix(in srgb,var(--ovk-accent,var(--accent,#7aa2ff)) 8%,transparent);'
            + 'animation:ovt-chip .32s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--ovt-n,0) * 40ms);transition:background .15s,border-color .15s,transform .15s}'
            + '.ovt-chip:hover,.ovt-chip:focus-visible{background:color-mix(in srgb,var(--ovk-accent,var(--accent,#7aa2ff)) 20%,transparent);border-color:var(--ovk-accent,var(--accent,#7aa2ff));outline:none}'
            + '.ovt-chip:active{transform:scale(.97)}'
            + '.ovt-dive{display:grid !important;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:2px 10px;width:100%;border-radius:12px !important;text-align:left;text-decoration:none;white-space:normal !important}'
            + '.ovt-dive b{grid-row:span 2;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;color:var(--ovk-accent,var(--accent,#7aa2ff));background:color-mix(in srgb,var(--ovk-accent,var(--accent,#7aa2ff)) 16%,transparent);font-size:1rem}'
            + '.ovt-dive span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:650}'
            + '.ovt-dive small{opacity:.7;font-size:.76rem}'
            + '@media (pointer:coarse){.ovt-chip{min-height:44px}}'
            + '@keyframes ovt-pop{from{opacity:0;transform:translateY(calc(-6px * var(--ov-move,1))) scale(.98)}}'
            + '@keyframes ovt-chip{from{opacity:0;transform:translateY(calc(4px * var(--ov-move,1)))}}'
            + 'html[data-ov-motion="off"] .ovt-chips,html[data-ov-motion="off"] .ovt-chip{animation:none}';
        document.head.appendChild(st);
    };

    function load() {
        if (list) return Promise.resolve(list);
        if (loading) return loading;
        const named = document.querySelector('[data-ov-trending-site]');
        const site = (named && named.getAttribute('data-ov-trending-site')) || host;
        const key = `ov_trending:${site}`;
        try {
            const kept = JSON.parse(sessionStorage.getItem(key) || 'null');
            if (kept && Date.now() - kept.at < KEEP_MS && Array.isArray(kept.list)) { list = kept.list; return Promise.resolve(list); }
        } catch { /* storage off: ask */ }
        loading = fetch(`${API}/trending?site=${encodeURIComponent(site)}&limit=8`, { credentials: 'omit' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                list = (d && Array.isArray(d.trending) ? d.trending : []).map((x) => ({ query: String(x.query || '').slice(0, 80), suggested: !!x.suggested })).filter((x) => x.query);
                try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), list })); } catch { /* */ }
                return list;
            })
            .catch(() => { list = []; return list; });
        return loading;
    }

    /** A box's list, as [{ query, pre }]: its own (its page's), or what people search on OpenVibe. */
    function itemsOf(b) {
        if (!b.own) return list || [];
        let v = b.own.items;
        try { if (typeof v === 'function') v = v(); } catch { v = null; }
        return (Array.isArray(v) ? v : []).map((x) => (typeof x === 'string' ? { query: x } : x && { query: String(x.query || ''), pre: x.pre }))
            .filter((x) => x && x.query).map((x) => ({ query: x.query.slice(0, 80), pre: x.pre == null ? null : String(x.pre).slice(0, 24) })).slice(0, 24);
    }

    /** Where the ghost sits: exactly over the box's text, measured on screen (a scrolled row, a table cell or a box in a
     *  sheet all come out right), its line as tall as the box's text line so the words sit where typing would. */
    function place(input, b) {
        const g = b.ghost;
        if (!input.isConnected || !input.offsetParent) { g.hidden = true; return false; }
        const cs = getComputedStyle(input);
        const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
        const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
        const w = input.clientWidth - pl - pr, h = input.clientHeight - pt - pb;
        if (w < 64 || h < 12) return false;   // a folded or tiny box keeps its own placeholder
        const was = g.hidden;
        g.hidden = false;
        const cb = g.offsetParent;
        let ox, oy;
        if (!cb || (cb === document.body && getComputedStyle(cb).position === 'static')) { ox = -root.scrollX; oy = -root.scrollY; }
        else { const c = cb.getBoundingClientRect(); ox = c.left + cb.clientLeft - cb.scrollLeft; oy = c.top + cb.clientTop - cb.scrollTop; }
        const r = input.getBoundingClientRect();
        g.style.left = `${r.left - ox + input.clientLeft + pl}px`;
        g.style.top = `${r.top - oy + input.clientTop + pt}px`;
        g.style.width = `${w}px`;
        const one = input.tagName === 'TEXTAREA' ? Math.min(h, parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 16) * 1.4) : h;
        g.style.height = `${one}px`;
        g.style.font = cs.font;
        g.style.lineHeight = `${one}px`;
        g.style.letterSpacing = cs.letterSpacing;
        g.style.color = cs.color;
        // 4.286.0: always from where typing starts (a centred line floated away from the box's icon: "Plan my week").
        g.style.textAlign = cs.direction === 'rtl' ? 'right' : 'left';
        g.hidden = was;
        return true;
    }

    function show(input) {
        const b = boxes.get(input);
        if (!b) return;
        const items = itemsOf(b);
        if (input.value || !items.length || !place(input, b)) {
            b.ghost.hidden = true;
            input.removeAttribute('data-ovt-on');
            // Only the placeholder this file emptied comes back; one the page set since is the page's, and is kept.
            const now = input.getAttribute('placeholder');
            if (now) b.placeholder = now;
            else if (b.placeholder != null) input.setAttribute('placeholder', b.placeholder);
            return;
        }
        // A placeholder the page set since the line last showed is its newest words: keep them as the box's name.
        const now = input.getAttribute('placeholder');
        if (now && now !== b.placeholder) { b.placeholder = now; if (b.labelled) input.setAttribute('aria-label', now); }
        if (input.getAttribute('placeholder')) input.setAttribute('placeholder', '');
        b.ghost.hidden = false;
        input.setAttribute('data-ovt-on', '');   // ov-composer's own examples stand down while the line owns the box
        if (!b.line.textContent) fill(b.line, items[b.i % items.length], b);
    }

    function fill(line, item, b) {
        line.textContent = '';
        const pre = document.createElement('span');
        pre.className = 'ovt-pre';
        pre.textContent = item.pre != null ? item.pre : b.prefix;
        const t = document.createElement('span');
        t.className = 'ovt-term';
        t.textContent = item.query;
        line.append(pre, t);
    }

    /** The box's context changed (its page says so, or its placeholder did): its list is read again from the start. */
    function update(input) {
        const b = boxes.get(input);
        if (!b) return;
        b.i = 0;
        b.line.textContent = '';
        show(input);
    }

    function tick() {
        if (motion() === 'off' || document.hidden) return;
        boxes.forEach((b, input) => {
            // A focused box holds the line it showed (the owner, 11-16: "if you open the box it should stay on whatever one
            // it was on … put it into the list so you can click it"): its page lists it (current()).
            if (!input.isConnected) { detach(input); return; }
            if (b.ghost.hidden || input.value || document.activeElement === input) return;
            const items = itemsOf(b);
            if (items.length < 2) return;
            b.i = (b.i + 1) % items.length;
            const old = b.line;
            const next = old.cloneNode(false);
            fill(next, items[b.i], b);
            next.classList.add('is-in');
            b.ghost.append(next);
            // One frame later both move: the old line up and out, the new one up and in.
            requestAnimationFrame(() => requestAnimationFrame(() => { old.classList.add('is-out'); next.classList.remove('is-in'); }));
            setTimeout(() => old.remove(), 700);
            b.line = next;
        });
    }
    function rotate() {
        clearInterval(timer);
        if (motion() === 'off') return;
        timer = setInterval(tick, motion() === 'calm' ? 5200 : 3200);
    }

    // ── Deep dive this: a typed question, researched in full on OpenVibe Exchange ──
    const diveAllowed = (input) => input.getAttribute('data-ov-deep-dive') !== 'off' && root.OV_DEEP_DIVE !== false
        && !((boxes.get(input) || {}).own && !boxes.get(input).own.dive)
        && !(host === 'openvibe.exchange' && /^\/(search|deep-dive)(\/|$)/.test(location.pathname));
    const diveHref = (q) => `${DIVE}?q=${encodeURIComponent(String(q).trim().slice(0, 500))}`;
    function openDive(input) {
        const q = String(input.value || '').trim();
        if (q.length < 3 || document.activeElement !== input || !chipsAllowed(input) || !diveAllowed(input)) { if (panel && panel.kind === 'dive') closeChips(); return; }
        if (panel && panel.input === input && panel.kind === 'dive') {
            panel.link.href = diveHref(q);
            panel.text.textContent = `Deep dive \u201c${q.slice(0, 80)}\u201d`;
            placeChips();
            return;
        }
        closeChips();
        css();
        const el = document.createElement('div');
        el.className = 'ovt-chips';
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', 'Deep dive this');
        const a = document.createElement('a');
        a.className = 'ovt-chip ovt-dive';
        a.href = diveHref(q);
        const icon = document.createElement('b');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '\u2726';
        const text = document.createElement('span');
        text.textContent = `Deep dive \u201c${q.slice(0, 80)}\u201d`;
        const sub = document.createElement('small');
        sub.textContent = 'Every source read and cited, on OpenVibe Exchange';
        a.append(icon, text, sub);
        a.addEventListener('pointerdown', (e) => e.preventDefault()); // the box keeps its focus until the link is taken
        a.addEventListener('keydown', (e) => chipKey(e, input));
        el.append(a);
        el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget) && e.relatedTarget !== input) closeChips(); });
        document.body.append(el);
        panel = { el, input, kind: 'dive', link: a, text };
        placeChips();
    }

    // ── The chips: the list under a focused, empty box ──
    const chipsAllowed = (input) => !((boxes.get(input) || {}).own && !boxes.get(input).own.chips) && !input.hasAttribute('list') && !input.getAttribute('aria-autocomplete')
        && input.getAttribute('role') !== 'combobox' && input.getAttribute('data-ov-trending-chips') !== 'off';
    function openChips(input) {
        const b = boxes.get(input);
        const items = b ? itemsOf(b) : [];
        if (!items.length || input.value || document.activeElement !== input || !chipsAllowed(input)) { closeChips(); return; }
        if (panel && panel.input === input && panel.kind !== 'dive') { placeChips(); return; }
        closeChips();
        css();
        const el = document.createElement('div');
        el.className = 'ovt-chips';
        el.setAttribute('role', 'group');
        const tryOnly = !!(b && b.own) || items.every((x) => x.suggested);
        el.setAttribute('aria-label', b && b.own ? (b.own.head || 'Try') : tryOnly ? 'Searches to try' : 'Trending searches');
        const head = document.createElement('span');
        head.className = 'ovt-chips-head';
        head.setAttribute('aria-hidden', 'true');
        head.textContent = b && b.own ? (b.own.head || 'Try') : tryOnly ? 'Try' : 'Trending';
        el.append(head);
        items.slice(0, 6).forEach((x, n) => {
            const c = document.createElement('button');
            c.type = 'button';
            c.className = 'ovt-chip';
            c.textContent = x.query;
            c.style.setProperty('--ovt-n', String(n));
            c.addEventListener('pointerdown', (e) => e.preventDefault()); // the box keeps its focus
            c.addEventListener('click', () => take(input, x.query));
            c.addEventListener('keydown', (e) => chipKey(e, input));
            el.append(c);
        });
        el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget) && e.relatedTarget !== input) closeChips(); });
        document.body.append(el);
        panel = { el, input, kind: 'chips' };
        placeChips();
    }
    function placeChips() {
        if (!panel) return;
        const r = panel.input.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight) { closeChips(); return; }
        const w = Math.min(Math.max(r.width, 240), innerWidth - 16);
        panel.el.style.width = `${w}px`;
        panel.el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
        panel.el.style.top = `${r.bottom + 6}px`;
    }
    function closeChips() {
        if (!panel) return;
        panel.el.remove();
        panel = null;
    }
    /** A chip taken: the box gets it and searches (its form's submit, or Enter for a box without one). */
    function take(input, q) {
        closeChips();
        input.value = q;
        taking = true;
        try { input.dispatchEvent(new Event('input', { bubbles: true })); } finally { taking = false; }
        input.focus();
        if (input.form) {
            if (typeof input.form.requestSubmit === 'function') input.form.requestSubmit();
            else input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
        }
    }
    function chipKey(e, input) {
        const chips = panel ? [...panel.el.querySelectorAll('.ovt-chip')] : [];
        const at = chips.indexOf(e.target);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); (chips[at + 1] || chips[0]).focus(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); if (at <= 0) input.focus(); else chips[at - 1].focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); input.focus(); closeChips(); } // focus first: a removed chip would drop it
    }

    const ownOf = (o) => (o && (o.items != null) ? { items: o.items, prefix: o.prefix, chips: !!o.chips, dive: !!o.dive, count: !!o.count, head: o.head ? String(o.head) : '' } : null);
    // The page's own list in markup (data-ov-trending-items, JSON strings, on the box or around it): chips on focus.
    function markupList(input) {
        const at = input.closest('[data-ov-trending-items]');
        if (!at) return null;
        try {
            const v = JSON.parse(at.getAttribute('data-ov-trending-items'));
            const items = Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 80)).slice(0, 24) : [];
            return items.length ? { items, chips: true } : null;
        } catch { return null; }
    }
    function attach(input, opts) {
        if (!input || input.getAttribute('data-ov-trending') === 'off' || input.type === 'password') return;
        const own = ownOf(opts || markupList(input));
        if (boxes.has(input)) {
            if (own) { const b = boxes.get(input); b.own = own; if (own.prefix != null) b.prefix = String(own.prefix); update(input); }
            return;
        }
        if (!own && input.getAttribute('data-ov-trending') === 'own') return;   // its page attaches it with its own list
        css();
        const ghost = document.createElement('span');
        ghost.className = 'ovt-ghost';
        ghost.setAttribute('aria-hidden', 'true');
        ghost.hidden = true;
        const line = document.createElement('span');
        line.className = 'ovt-line';
        ghost.append(line);
        input.insertAdjacentElement('afterend', ghost);
        const placeholder = input.getAttribute('placeholder');
        // A box named only by its placeholder keeps that name while the line shows.
        const named = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby') || (input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`)) || input.closest('label');
        if (!named && placeholder) input.setAttribute('aria-label', placeholder);
        // No "Try" (the owner, 11-16: "remove the text try … just use the extra space to have whatever the recommendation is").
        const b = { ghost, line, placeholder, prefix: own && own.prefix != null ? String(own.prefix) : '', ro: null, mo: null, own, i: 0, labelled: !named && !!placeholder, sent: new Map() };
        if (typeof ResizeObserver === 'function') { b.ro = new ResizeObserver(() => show(input)); b.ro.observe(input); }
        // Its page changes the placeholder later (the menu does, tab by tab): take the new one up and read the list again,
        // so the page's words and the line are never drawn over each other.
        if (typeof MutationObserver === 'function') {
            b.mo = new MutationObserver(() => {
                const now = input.getAttribute('placeholder');
                if (!now) return;
                // 4.286.0 (the owner, 11-16, a third time: "still duplicated like labels at times in the search bar"): the
                // same words put back while the line shows (a composer fitting its placeholder to the box, a page redrawing
                // its tab) are taken out again, so the box's words and the line are never drawn over each other.
                if (now === b.placeholder) { if (!b.ghost.hidden) input.setAttribute('placeholder', ''); return; }
                b.placeholder = now;
                if (b.labelled) input.setAttribute('aria-label', now);
                update(input);
            });
            b.mo.observe(input, { attributes: true, attributeFilter: ['placeholder'] });
        }
        boxes.set(input, b);
        input.addEventListener('input', () => { show(input); if (input.value) { if (panel && panel.kind === 'chips') closeChips(); if (!taking) openDive(input); } else openChips(input); });
        input.addEventListener('focus', () => { show(input); hint(input, true); if (input.value) openDive(input); else openChips(input); });
        input.addEventListener('blur', () => {
            hint(input, false);
            setTimeout(() => { if (panel && panel.input === input && !panel.el.contains(document.activeElement) && document.activeElement !== input) closeChips(); }, 0);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' && panel && panel.input === input) {
                const first = panel.el.querySelector('.ovt-chip');
                if (first) { e.preventDefault(); first.focus(); }
            } else if (e.key === 'Escape' && panel && panel.input === input) {
                closeChips();
            } else if (e.key === 'Tab' && !e.shiftKey && !input.value && !b.ghost.hidden && itemsOf(b).length) {
                e.preventDefault();
                const items = itemsOf(b);
                input.value = items[b.i % items.length].query;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (e.key === 'Enter' && !input.form && input.value.trim() && (!b.own || b.own.count)) {
                count(input);
            }
        });
        if (input.form) input.form.addEventListener('submit', () => { if (!b.own || b.own.count) count(input); }, true);
        (b.own ? Promise.resolve() : load()).then(() => { show(input); rotate(); if (document.activeElement === input) openChips(input); });
    }
    function hint(input, on) {
        const b = boxes.get(input);
        if (!b) return;
        const old = b.ghost.querySelector('.ovt-tab');
        if (old) old.remove();
        if (on && !(root.matchMedia && root.matchMedia('(pointer: coarse)').matches)) {
            const k = document.createElement('span');
            k.className = 'ovt-tab';
            k.textContent = 'Tab';
            b.ghost.append(k);
        }
    }
    function detach(input) {
        const b = boxes.get(input);
        if (!b) return;
        if (b.ro) b.ro.disconnect();
        if (b.mo) b.mo.disconnect();
        b.ghost.remove();
        if (panel && panel.input === input) closeChips();
        if (b.placeholder != null) input.setAttribute('placeholder', b.placeholder);
        input.removeAttribute('data-ovt-on');
        boxes.delete(input);
    }

    /** The beacon: one search, never with DNT or GPC, once per query per ten seconds. */
    function count(input) {
        const q = String(input.value || '').trim().slice(0, 200);
        if (!q || navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true || typeof navigator.sendBeacon !== 'function') return;
        const b = boxes.get(input);
        const k = q.toLowerCase();
        if (b && b.sent.get(k) > Date.now() - 10_000) return;
        if (b) b.sent.set(k, Date.now());
        try { navigator.sendBeacon(`${API}/searched`, new Blob([JSON.stringify({ q, site: host })], { type: 'text/plain' })); } catch { /* */ }
    }

    function scan() { document.querySelectorAll(CANDIDATES).forEach((i) => { if (!boxes.has(i) && siteSearch(i)) attach(i); }); }
    let placing = 0;
    const replace = () => { if (placing) return; placing = requestAnimationFrame(() => { placing = 0; boxes.forEach((b, i) => { if (!b.ghost.hidden) show(i); }); }); };
    function start() {
        scan();
        let soon = 0;
        new MutationObserver(() => { if (soon) return; soon = setTimeout(() => { soon = 0; scan(); boxes.forEach((_b, i) => { if (!i.isConnected) detach(i); }); }, 400); })
            .observe(document.body, { childList: true, subtree: true });
        document.addEventListener('visibilitychange', () => { if (!document.hidden) boxes.forEach((_b, i) => show(i)); });
        root.addEventListener('resize', () => { boxes.forEach((_b, i) => show(i)); placeChips(); }, { passive: true });
        root.addEventListener('scroll', () => { placeChips(); replace(); }, { passive: true, capture: true });
        new MutationObserver(rotate).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ov-motion'] });
    }

    /** What people search on OpenVibe, for a page's own list (the menu over the feed); its boxes update when it arrives. */
    function trending() {
        if (!list && !loading) load().then(() => boxes.forEach((b, i) => { if (b.own) update(i); }));
        return list || [];
    }
    /** The suggestion a box shows now ({ query, pre }), or null: a page lists it with its own choices. */
    function current(input) {
        const b = boxes.get(input);
        if (!b || b.ghost.hidden || input.value) return null;
        const items = itemsOf(b);
        return items.length ? items[b.i % items.length] : null;
    }
    root.OVTrending = { attach, detach, update, trending, current, refresh: () => { list = null; loading = null; load().then(() => boxes.forEach((_b, i) => show(i))); }, count, siteSearch };
    try { document.dispatchEvent(new CustomEvent('ov-trending-ready')); } catch { /* */ }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})(typeof window !== 'undefined' ? window : globalThis);
