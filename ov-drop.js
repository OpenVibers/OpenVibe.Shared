/* ov-drop.js — the one dropdown (4.191.0). The owner, 2026-11-10: "clicking the actual name of the domain should have a
   sleek little minimalist drop down with nice animation effects that just shows the pages … a custom, animated system
   for these drop downs and positioning of them, used across all sites."

   A small list that opens out of the thing pressed: under it (above it when there is no room below), kept on screen,
   growing from where the press was, its rows arriving one after another. Arrow keys move, Enter chooses, Escape and a
   press outside close it and give the focus back. One is open at a time, and it closes with every other panel on the
   page (panels.js).

   OVDrop.open(anchor, items, opts)   items: [{ label, href?, onClick?, icon? (SVG text), sub?, current?, danger? }]
                                      or a function that returns them; a falsy item is a hairline between groups
                                      opts: { label (what the list is, said to a screen reader and shown small on top),
                                              align: 'start' | 'end', minWidth, onClose }
   OVDrop.attach(button, items, opts) the button opens and closes it, with aria-expanded kept true to what is shown
   OVDrop.pages(anchor, links, icon, more)  a site's pages from its bar links, Home first, the present page marked;
                                      more: { label, onClick } ends it with a way out (the navbar's: every OpenVibe site)
   OVDrop.close()                     close the one that is open */
(function (root) {
    'use strict';
    if (!root || !root.document || root.OVDrop) return;
    const doc = root.document;
    const CSS = `
.ovdrop { position: fixed; z-index: 10030; left: 0; top: 0; box-sizing: border-box; min-width: 200px; max-width: min(320px, calc(100vw - 16px)); max-height: min(70vh, 460px); overflow: auto; overscroll-behavior: contain; padding: 6px; border-radius: 16px;
  background: color-mix(in srgb, var(--bg-elevated, var(--bg-secondary, #111826)) 94%, transparent); border: 1px solid var(--border, rgba(255,255,255,.12)); box-shadow: 0 18px 44px rgba(0,0,0,.42), 0 2px 6px rgba(0,0,0,.2); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  color: var(--text-primary, #e6edf7); font: 600 14.5px/1.25 var(--font, system-ui, -apple-system, 'Segoe UI', sans-serif); transform-origin: var(--ovdrop-x, 24px) var(--ovdrop-y, 0); opacity: 0; transform: translateY(calc(var(--ovdrop-from, -6px) * var(--ov-move, 1))) scale(.94); transition: opacity .14s ease-out, transform .16s ease-in; pointer-events: none; }
.ovdrop.is-open { opacity: 1; transform: none; pointer-events: auto; transition: opacity .16s ease-out, transform .26s cubic-bezier(.2, 1.25, .3, 1); }
.ovdrop-label { margin: 0; padding: 7px 10px 6px; font-size: 11.5px; font-weight: 700; color: var(--text-muted, #93a0b4); }
.ovdrop-item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 11px; width: 100%; min-height: 44px; padding: 0 12px 0 10px; border-radius: 11px; cursor: pointer; color: inherit; opacity: 0; transform: translateY(calc(-5px * var(--ov-move, 1))); transition: background-color .12s, opacity .2s ease-out, transform .28s cubic-bezier(.2, 1.2, .3, 1); transition-delay: 0s, calc(var(--i, 0) * 22ms + 30ms), calc(var(--i, 0) * 22ms + 30ms); }
.ovdrop.is-open .ovdrop-item { opacity: 1; transform: none; }
.ovdrop-item:hover, .ovdrop-item:focus-visible { background: color-mix(in srgb, var(--text-primary, #e6edf7) 8%, transparent); }
.ovdrop-item:focus-visible { box-shadow: inset 0 0 0 2px var(--accent, #3b82f6); }
.ovdrop-item:active { background: color-mix(in srgb, var(--accent, #3b82f6) 18%, transparent); }
.ovdrop-ic { flex: none; display: grid; place-items: center; width: 20px; height: 20px; color: var(--text-muted, #93a0b4); }
.ovdrop-ic svg { width: 18px; height: 18px; display: block; }
.ovdrop-t { flex: 1; min-width: 0; display: grid; gap: 1px; }
.ovdrop-t b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovdrop-t small { font-size: 12px; font-weight: 500; color: var(--text-secondary, #a8b3c4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovdrop-item[aria-current] { background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); }
.ovdrop-item[aria-current] .ovdrop-ic { color: var(--accent-light, var(--accent, #60a5fa)); }
.ovdrop-item[aria-current]::after { content: ""; flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--accent-light, var(--accent, #60a5fa)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); }
.ovdrop-item.is-danger { color: var(--danger-text, #f87171); }
.ovdrop-sep { height: 1px; margin: 5px 8px; background: var(--border, rgba(255,255,255,.1)); }
:root:root[data-ov-motion=off] .ovdrop, :root:root[data-ov-motion=off] .ovdrop-item { transition: none; }`;
    function style() {
        if (doc.getElementById('ovdrop-style')) return;
        const st = doc.createElement('style'); st.id = 'ovdrop-style'; st.textContent = CSS; doc.head.appendChild(st);
    }
    const safeHref = (u) => { const s = String(u || ''); return /^(https?:\/\/|\/(?!\/)|#|\?|mailto:)/i.test(s) ? s : ''; };
    let cur = null;   // { el, anchor, opts, off: [fns] }

    /** Where the list sits: under the anchor, or above it when there is more room there; never off the screen. */
    function place() {
        if (!cur) return;
        const { el, anchor, opts } = cur;
        const a = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, vw = root.innerWidth, vh = root.innerHeight, gap = 8;
        if (!a.width && !a.height) return close();
        let left = opts.align === 'end' ? a.right - w : a.left - 6;
        left = Math.max(8, Math.min(vw - w - 8, left));
        const below = vh - a.bottom - gap - 8, above = a.top - gap - 8, up = h > below && above > below;
        const top = up ? Math.max(8, a.top - gap - h) : a.bottom + gap;
        el.style.left = `${Math.round(left)}px`; el.style.top = `${Math.round(top)}px`;
        el.style.setProperty('--ovdrop-x', `${Math.round(Math.max(12, Math.min(w - 12, a.left + a.width / 2 - left)))}px`);
        el.style.setProperty('--ovdrop-y', up ? '100%' : '0');
        el.style.setProperty('--ovdrop-from', up ? '6px' : '-6px');
    }
    function close(refocus) {
        if (!cur) return;
        const { el, anchor, opts, off } = cur; cur = null;
        off.forEach((fn) => { try { fn(); } catch { /* already gone */ } });
        el.classList.remove('is-open');
        if (anchor.setAttribute && anchor.hasAttribute('aria-expanded')) anchor.setAttribute('aria-expanded', 'false');
        setTimeout(() => el.remove(), 180);
        if (refocus && anchor.isConnected && anchor.focus) anchor.focus({ preventScroll: true });
        if (typeof opts.onClose === 'function') { try { opts.onClose(); } catch { /* the caller's */ } }
    }
    function open(anchor, items, opts) {
        if (!anchor || !anchor.getBoundingClientRect) return null;
        if (cur && cur.anchor === anchor) { close(); return null; }
        close(); style();
        opts = opts || {};
        const list = (typeof items === 'function' ? items() : items) || [];
        const el = doc.createElement('div'); el.className = 'ovdrop'; el.setAttribute('role', 'menu');
        if (opts.label) { el.setAttribute('aria-label', opts.label); const l = doc.createElement('p'); l.className = 'ovdrop-label'; l.textContent = opts.label; el.appendChild(l); }
        if (opts.minWidth) el.style.minWidth = `${Number(opts.minWidth) || 200}px`;
        let i = 0;
        for (const it of list) {
            if (!it) { const s = doc.createElement('div'); s.className = 'ovdrop-sep'; s.setAttribute('role', 'separator'); el.appendChild(s); continue; }
            const href = safeHref(it.href), row = doc.createElement(href ? 'a' : 'button');
            row.className = `ovdrop-item${it.danger ? ' is-danger' : ''}`; row.setAttribute('role', 'menuitem'); row.style.setProperty('--i', String(i)); i += 1;
            if (href) row.href = href; else row.type = 'button';
            if (it.current) row.setAttribute('aria-current', 'page');
            if (it.icon) { const ic = doc.createElement('span'); ic.className = 'ovdrop-ic'; ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = String(it.icon); row.appendChild(ic); }
            const t = doc.createElement('span'); t.className = 'ovdrop-t'; const b = doc.createElement('b'); b.textContent = it.label || ''; t.appendChild(b);
            if (it.sub) { const sm = doc.createElement('small'); sm.textContent = it.sub; t.appendChild(sm); }
            row.appendChild(t);
            row.addEventListener('click', (e) => { if (typeof it.onClick === 'function') { if (!href) e.preventDefault(); try { it.onClick(e); } catch { /* the caller's */ } } close(); });
            el.appendChild(row);
        }
        doc.body.appendChild(el);
        const rows = () => Array.from(el.querySelectorAll('.ovdrop-item'));
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(true); }
            if (e.key === 'Tab') return close();
            const r = rows(), at = r.indexOf(doc.activeElement);
            const go = (n) => { e.preventDefault(); if (r.length) r[(n + r.length) % r.length].focus(); };
            if (e.key === 'ArrowDown') go(at + 1); else if (e.key === 'ArrowUp') go(at < 0 ? r.length - 1 : at - 1);
            else if (e.key === 'Home') go(0); else if (e.key === 'End') go(r.length - 1);
        };
        const onDown = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); };
        const onMove = () => place();
        const onSize = () => close();
        doc.addEventListener('keydown', onKey, true); doc.addEventListener('pointerdown', onDown, true);
        root.addEventListener('scroll', onMove, { passive: true, capture: true }); root.addEventListener('resize', onSize);
        const off = [() => doc.removeEventListener('keydown', onKey, true), () => doc.removeEventListener('pointerdown', onDown, true),
            () => root.removeEventListener('scroll', onMove, { capture: true }), () => root.removeEventListener('resize', onSize)];
        // One panel at a time, with the bar's menus and every other registered panel.
        if (root.OpenVibePanels && root.OpenVibePanels.register) { try { root.OpenVibePanels.closeAll(); off.push(root.OpenVibePanels.register({ el, openClass: 'is-open', id: 'drop', close: () => close() })); } catch { /* optional */ } }
        cur = { el, anchor, opts, off };
        if (anchor.setAttribute) anchor.setAttribute('aria-expanded', 'true');
        place();
        void el.offsetWidth; el.classList.add('is-open');
        // The keyboard lands on the current row (or the first); a touch or a click leaves the focus where it was.
        if (opts.focus !== false && anchor.matches && anchor.matches(':focus-visible')) { const r = rows(); (r.find((x) => x.hasAttribute('aria-current')) || r[0] || el).focus({ preventScroll: true }); }
        return { el, close: () => close() };
    }
    function attach(button, items, opts) {
        if (!button || button.__ovdrop) return;
        button.__ovdrop = true;
        button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); open(button, items, opts); });
    }
    /**
     * A site's pages, from the bar's links (the navbar calls this when the site's name is pressed): Home first, the
     * page you are on marked. links: [{ label, href, icon, hidden }]; icon(name) gives an icon's SVG text.
     */
    const GRID = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>';
    function pages(anchor, links, icon, more) {
        const path = (h) => String(h).split(/[?#]/)[0].replace(/\/+$/, '') || '/';
        const list = (links || []).filter((l) => l && l.label && l.href && !l.hidden && !/^https?:/i.test(l.href));
        const at = path(root.location.pathname);
        let best = -1, len = -1;
        list.forEach((l, i) => { const q = path(l.href); const n = q === at ? 1e4 : (q !== '/' && at.startsWith(`${q}/`) ? q.length : -1); if (n > len) { best = i; len = n; } });
        const draw = (name) => { try { return typeof icon === 'function' ? icon(name) : ''; } catch { return ''; } };
        const items = list.map((l, i) => ({ label: l.label, href: l.href, icon: draw(l.icon || 'fa-arrow-right'), current: i === best }));
        if (!list.some((l) => path(l.href) === '/')) items.unshift({ label: 'Home', href: anchor.getAttribute('href') || '/', icon: draw('fa-house'), current: at === '/' });
        // The way to every site (ask 338, the owner: "a button … to view all sites … past the list of pages … to the list
        // of actual domains"): one row under a hairline.
        if (more && typeof more.onClick === 'function') items.push(null, { label: more.label || 'All OpenVibe sites', icon: GRID, onClick: more.onClick });
        return open(anchor, items, { label: `Pages on ${anchor.textContent.trim()}` });
    }
    root.OVDrop = { open, close: () => close(), attach, pages, get isOpen() { return !!cur; } };
})(typeof window !== 'undefined' ? window : null);
