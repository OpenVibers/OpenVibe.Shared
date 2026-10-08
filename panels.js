/**
 * openvibe-shared/panels.js — one coordinator for every dropdown, drawer and popover on a page.
 *
 * Sites keep their own markup and their own open/close toggles. They register each panel here and get the
 * behaviour that should be identical everywhere:
 *   • one panel open at a time (opening one closes the others)
 *   • Escape and a device rotation close everything
 *   • <body class="ov-panel-open"> while any panel is open (floating buttons step aside)
 *   • a freshly opened panel starts scrolled to the top
 *
 *   OpenVibePanels.register({ el, openClass: 'show', close: () => …, id?: 'user-menu', signal? }) → unregister()
 *   OpenVibePanels.unregister(el)   ·   OpenVibePanels.closeAll(exceptEl?)   ·   OpenVibePanels.anyOpen()
 *
 * It watches the panel's class instead of wrapping the site's click handlers, so it cannot fight them: a
 * panel is "open" exactly when its element has `openClass`, however that came about.
 *
 * A registration holds its element until it is unregistered: markup that is thrown away and rebuilt (the navbar
 * re-renders on every openvibe-shared/boost page move) passes an AbortSignal, or calls unregister, so the old
 * element can be collected.
 */
(function (root) {
    'use strict';
    if (root.OpenVibePanels) return;
    if (typeof document === 'undefined') { const stub = { register: () => () => {}, unregister() {}, closeAll() {}, anyOpen: () => false }; if (typeof module !== 'undefined') module.exports = stub; return; }

    const panels = [];   // { el, openClass, close, id, unregister }
    const isOpen = (p) => p.el.isConnected && p.el.classList.contains(p.openClass);
    const anyOpen = () => panels.some(isOpen);
    const syncBody = () => document.body && document.body.classList.toggle('ov-panel-open', anyOpen());

    function closeAll(except) {
        // A panel nested in another (a submenu inside the mobile drawer) never closes its container, or vice versa.
        const related = (a, b) => a && b && (a.contains(b) || b.contains(a));
        for (const p of panels) if (p.el !== except && !related(p.el, except) && isOpen(p)) { try { p.close(); } catch { p.el.classList.remove(p.openClass); } }
        syncBody();
    }

    function register(opts) {
        const el = opts && opts.el, signal = opts && opts.signal;
        if (!el || (signal && signal.aborted)) return () => {};
        const known = panels.find(p => p.el === el); if (known) return known.unregister;
        const p = { el, openClass: opts.openClass || 'open', id: opts.id || '', close: typeof opts.close === 'function' ? opts.close : () => el.classList.remove(opts.openClass || 'open') };
        let was = isOpen(p);
        const watch = new MutationObserver(() => {
            const now = isOpen(p); if (now === was) return; was = now;
            if (now) { closeAll(el); try { el.scrollTop = 0; } catch { /* */ } }
            syncBody();
        });
        p.unregister = () => {
            const i = panels.indexOf(p); if (i < 0) return;
            panels.splice(i, 1);
            watch.disconnect();
            syncBody();
        };
        panels.push(p);
        watch.observe(el, { attributes: true, attributeFilter: ['class'] });
        if (signal && typeof signal.addEventListener === 'function') signal.addEventListener('abort', p.unregister, { once: true });
        syncBody();
        return p.unregister;
    }

    function unregister(el) { const p = panels.find(x => x.el === el); if (p) p.unregister(); }

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && anyOpen()) closeAll(); });
    root.addEventListener('orientationchange', () => closeAll(), { passive: true });

    const api = { register, unregister, closeAll, anyOpen };
    root.OpenVibePanels = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
