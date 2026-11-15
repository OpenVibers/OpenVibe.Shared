/**
 * openvibe-shared/ov-trending.js — every search box shows what people are searching for (4.277.0; plan 2026-11-13 §AD.13
 * (1); the owner, 11-15: "it scrolls thru what's trending with a cool animation/effects in the search input itself …
 * across all sites").
 *
 *   <input type="search" …>   or   <input data-ov-trending …>       the navbar loads this file when a page has one, and
 *                                                                    it attaches to every box, now and added later
 *   data-ov-trending="off"                       leaves a box alone (a box that is not a search, a password, a code)
 *   data-ov-trending-site="openvibe.exchange"    the site whose trending lead (default: the page's host)
 *   OVTrending.attach(input) / .detach(input) / .refresh()          for a page that draws its box later
 *
 * While a box is empty, its placeholder gives way to the trending searches, one at a time in the box itself: the line
 * slides up and out, the next slides up and in, every few seconds (Calm: slower and shorter; Off and reduced motion: the
 * first one, still). Tab takes the line shown (on a keyboard), and the box's hint says so on focus. Typing hides it at
 * once; clearing the box brings it back. A box that reads nothing gets its placeholder back as its accessible name.
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
    const BOX = 'input[type="search"]:not([data-ov-trending="off"]), input[data-ov-trending]:not([data-ov-trending="off"])';
    const KEEP_MS = 5 * 60_000;
    const host = (location.hostname || '').replace(/^www\./, '');
    const boxes = new Map();   // input → { ghost, line, next, ro, placeholder, labelled }
    let list = null;           // [{ query }]
    let index = 0;
    let timer = 0;
    let loading = null;

    const motion = () => {
        const m = document.documentElement.getAttribute('data-ov-motion');
        if (m === 'off' || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) return 'off';
        return m === 'calm' || m === 'reduced' ? 'calm' : 'full';
    };
    const css = () => {
        if (document.getElementById('ov-trending-css')) return;
        const st = document.createElement('style');
        st.id = 'ov-trending-css';
        st.textContent = '.ovt-ghost{position:absolute;z-index:1;pointer-events:none;overflow:hidden;display:flex;align-items:center;white-space:nowrap;box-sizing:border-box;contain:layout paint}'
            + '.ovt-ghost[hidden]{display:none}'
            + '.ovt-line{position:absolute;left:0;right:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:transform var(--ovt-dur,.55s) cubic-bezier(.2,.8,.2,1),opacity var(--ovt-dur,.55s) ease,filter var(--ovt-dur,.55s) ease}'
            + '.ovt-line.is-out{transform:translateY(calc(-110% * var(--ov-move,1)));opacity:0;filter:blur(2px)}'
            + '.ovt-line.is-in{transform:translateY(calc(110% * var(--ov-move,1)));opacity:0;filter:blur(2px)}'
            + '.ovt-ghost{opacity:.62}.ovt-pre{opacity:.8}.ovt-term{font-weight:600;background:linear-gradient(90deg,currentColor 0 38%,var(--ovk-accent,var(--accent,#7aa2ff)) 50%,currentColor 62% 100%);background-size:300% 100%;background-position:0 0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:ovt-shine 1.6s ease-out .15s 1 both}'
            + '.ovt-tab{position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:.72em;padding:1px 6px;border:1px solid currentColor;border-radius:6px;opacity:.55;font-weight:600}'
            + '@keyframes ovt-shine{from{background-position:100% 0}to{background-position:0 0}}'
            + '.ovt-tab{opacity:.8}'
            + 'html[data-ov-motion="off"] .ovt-line{transition:none}html[data-ov-motion="off"] .ovt-term{animation:none;-webkit-text-fill-color:currentColor;background:none}'
            + '@media (prefers-reduced-motion:reduce){.ovt-line{transition:none}.ovt-term{animation:none;-webkit-text-fill-color:currentColor;background:none}}';
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
                list = (d && Array.isArray(d.trending) ? d.trending : []).map((x) => ({ query: String(x.query || '').slice(0, 80) })).filter((x) => x.query);
                try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), list })); } catch { /* */ }
                return list;
            })
            .catch(() => { list = []; return list; });
        return loading;
    }

    /** Where the ghost sits: over the box's text area, in the box's own offset parent. */
    function place(input, b) {
        if (!input.isConnected || !input.offsetParent) { b.ghost.hidden = true; return false; }
        const cs = getComputedStyle(input);
        const pl = parseFloat(cs.paddingLeft) || 0;
        const pr = parseFloat(cs.paddingRight) || 0;
        const g = b.ghost;
        g.style.left = `${input.offsetLeft + input.clientLeft + pl}px`;
        g.style.top = `${input.offsetTop + input.clientTop}px`;
        g.style.width = `${Math.max(0, input.clientWidth - pl - pr)}px`;
        g.style.height = `${input.clientHeight}px`;
        g.style.font = cs.font;
        g.style.letterSpacing = cs.letterSpacing;
        g.style.color = cs.color;
        g.style.textAlign = cs.textAlign === 'center' ? 'center' : 'left';
        return input.clientWidth > 40;
    }

    function show(input) {
        const b = boxes.get(input);
        if (!b) return;
        const empty = !input.value && list && list.length;
        if (!empty || !place(input, b)) {
            b.ghost.hidden = true;
            if (b.placeholder != null) input.setAttribute('placeholder', b.placeholder);
            return;
        }
        input.setAttribute('placeholder', '');
        b.ghost.hidden = false;
        if (!b.line.textContent) fill(b.line, list[index % list.length].query, b);
    }

    function fill(line, term, b) {
        line.textContent = '';
        const pre = document.createElement('span');
        pre.className = 'ovt-pre';
        pre.textContent = b.prefix;
        const t = document.createElement('span');
        t.className = 'ovt-term';
        t.textContent = term;
        line.append(pre, t);
    }

    function tick() {
        if (!list || list.length < 2 || motion() === 'off' || document.hidden) return;
        index = (index + 1) % list.length;
        const term = list[index].query;
        boxes.forEach((b, input) => {
            if (b.ghost.hidden || input.value) return;
            const old = b.line;
            const next = old.cloneNode(false);
            fill(next, term, b);
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

    function attach(input) {
        if (!input || boxes.has(input) || input.getAttribute('data-ov-trending') === 'off' || input.type === 'password') return;
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
        const b = { ghost, line, placeholder, prefix: 'Try ', ro: null, sent: new Map() };
        if (typeof ResizeObserver === 'function') { b.ro = new ResizeObserver(() => show(input)); b.ro.observe(input); }
        boxes.set(input, b);
        input.addEventListener('input', () => show(input));
        input.addEventListener('focus', () => { show(input); hint(input, true); });
        input.addEventListener('blur', () => hint(input, false));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && !e.shiftKey && !input.value && !b.ghost.hidden && list && list.length) {
                e.preventDefault();
                input.value = list[index % list.length].query;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (e.key === 'Enter' && !input.form && input.value.trim()) {
                count(input);
            }
        });
        if (input.form) input.form.addEventListener('submit', () => count(input), true);
        load().then(() => { show(input); rotate(); });
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
        b.ghost.remove();
        if (b.placeholder != null) input.setAttribute('placeholder', b.placeholder);
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

    function scan() { document.querySelectorAll(BOX).forEach(attach); }
    function start() {
        scan();
        let soon = 0;
        new MutationObserver(() => { if (soon) return; soon = setTimeout(() => { soon = 0; scan(); boxes.forEach((_b, i) => { if (!i.isConnected) detach(i); }); }, 400); })
            .observe(document.body, { childList: true, subtree: true });
        document.addEventListener('visibilitychange', () => { if (!document.hidden) boxes.forEach((_b, i) => show(i)); });
        root.addEventListener('resize', () => boxes.forEach((_b, i) => show(i)), { passive: true });
        new MutationObserver(rotate).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ov-motion'] });
    }

    root.OVTrending = { attach, detach, refresh: () => { list = null; loading = null; load().then(() => boxes.forEach((_b, i) => show(i))); }, count };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})(typeof window !== 'undefined' ? window : globalThis);
