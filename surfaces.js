/** Shared behavior for sheets and floating pop-overs. Load beside navbar.js or kit-web.js. */
(function (root) {
    'use strict';
    if (root.OVSurfaces || typeof document === 'undefined') return;

    const sheets = new Set();
    const dialogs = new Map();
    let saved = null;
    let pop = null;
    let opener = null;
    let mediaLock = false;
    const blockBackdropScroll = (e) => {
        const top = [...sheets].at(-1);
        if (top && top.el && !top.el.contains(e.target)) e.preventDefault();
    };

    function lock() {
        if (saved) return;
        const html = document.documentElement, body = document.body;
        const y = root.scrollY || html.scrollTop || 0;
        saved = { y, htmlOverflow: html.style.overflow, htmlPadding: html.style.paddingRight,
            bodyPosition: body.style.position, bodyTop: body.style.top, bodyLeft: body.style.left,
            bodyRight: body.style.right, bodyWidth: body.style.width };
        const gap = Math.max(0, root.innerWidth - html.clientWidth);
        if (gap) html.style.paddingRight = `${(parseFloat(getComputedStyle(html).paddingRight) || 0) + gap}px`;
        html.style.overflow = 'hidden';
        // Moving a playing video into a fixed-position body interrupts playback on some
        // mobile WebKit builds. Keep the media layer in its existing layout instead.
        mediaLock = [...document.querySelectorAll('video, audio')].some((media) => !media.paused && !media.ended);
        if (mediaLock) document.addEventListener('touchmove', blockBackdropScroll, { passive: false, capture: true });
        else {
            body.style.position = 'fixed'; body.style.top = `-${y}px`;
            body.style.left = '0'; body.style.right = '0'; body.style.width = '100%';
        }
    }
    function unlock() {
        if (!saved || sheets.size) return;
        const s = saved, html = document.documentElement, body = document.body;
        saved = null;
        if (mediaLock) document.removeEventListener('touchmove', blockBackdropScroll, true);
        mediaLock = false;
        html.style.overflow = s.htmlOverflow; html.style.paddingRight = s.htmlPadding;
        body.style.position = s.bodyPosition; body.style.top = s.bodyTop;
        body.style.left = s.bodyLeft; body.style.right = s.bodyRight; body.style.width = s.bodyWidth;
        root.scrollTo(0, s.y);
    }

    function sheet({ el, opener, header, body, close, deferRelease = false }) {
        if (!el) return null;
        let active = false, start = null;
        const scroll = body || el;
        const oldOverscroll = scroll.style.overscrollBehavior;
        scroll.style.overscrollBehavior = 'contain';
        const head = header || el.querySelector('[data-ov-sheet-head]');
        const oldTouch = head && head.style.touchAction;
        if (head) head.style.touchAction = 'none';
        const release = () => {
            if (!active) return;
            active = false; sheets.delete(api); el.style.translate = '';
            unlock();
            if (opener && opener.isConnected) try { opener.focus({ preventScroll: true }); } catch (_) { /* */ }
        };
        const dismiss = () => { if (close) close(); else if (el.close) el.close(); if (!deferRelease) release(); };
        const onDown = (e) => {
            if (!active || e.pointerType !== 'touch' || (e.target.closest && e.target.closest('button, a, input, textarea, select'))) return;
            start = { id: e.pointerId, y: e.clientY };
            if (head.setPointerCapture) try { head.setPointerCapture(e.pointerId); } catch (_) { /* */ }
        };
        const onMove = (e) => { if (start && e.pointerId === start.id) el.style.translate = `0 ${Math.max(0, e.clientY - start.y)}px`; };
        const onUp = (e) => {
            if (!start || e.pointerId !== start.id) return;
            const dy = e.clientY - start.y; start = null;
            el.style.translate = '';
            if (dy > 90) dismiss();
        };
        if (head) { head.addEventListener('pointerdown', onDown); head.addEventListener('pointermove', onMove); head.addEventListener('pointerup', onUp); head.addEventListener('pointercancel', onUp); }
        if (el instanceof HTMLDialogElement) el.addEventListener('close', release);
        const api = { el, open() { if (active) return; active = true; sheets.add(api); lock(); }, close: release, dismiss,
            destroy() { release(); scroll.style.overscrollBehavior = oldOverscroll; if (head) { head.style.touchAction = oldTouch; head.removeEventListener('pointerdown', onDown); head.removeEventListener('pointermove', onMove); head.removeEventListener('pointerup', onUp); head.removeEventListener('pointercancel', onUp); } if (el instanceof HTMLDialogElement) el.removeEventListener('close', release); } };
        return api;
    }

    function popover({ el, trigger, close }) {
        if (!el) return null;
        const api = { open() { if (pop && pop !== api) pop.close(); if (root.OpenVibePanels) root.OpenVibePanels.closeAll(); pop = api; },
            close() { if (pop !== api) return; pop = null; close(); },
            destroy() { if (pop === api) pop = null; } };
        api.el = el; api.trigger = trigger;
        return api;
    }
    document.addEventListener('pointerdown', (e) => {
        if (e.target && e.target.closest) opener = e.target.closest('button, a, [role="button"]');
        if (pop && !pop.el.contains(e.target) && !(pop.trigger && pop.trigger.contains(e.target))) pop.close();
    }, true);
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest) opener = e.target.closest('button, a, [role="button"]');
        if (e.key !== 'Escape') return;
        if (pop) { e.preventDefault(); const trigger = pop.trigger; pop.close(); if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true }); return; }
        const top = [...sheets].at(-1); if (top) { e.preventDefault(); top.dismiss(); }
    }, true);
    function syncDialogs() {
        document.querySelectorAll('dialog').forEach((el) => {
            let api = dialogs.get(el);
            if (el.open && el.matches(':modal')) {
                if (!api) {
                    api = sheet({ el, opener, header: el.querySelector('[data-ov-sheet-head], .ovk-sheet-head, .ov-share-head, .sn-head'),
                        body: el.querySelector('.ovk-sheet-body, .ov-share-body, .sn-body') || el, deferRelease: true,
                        close: () => { if (el.dispatchEvent(new Event('cancel', { cancelable: true }))) el.close(); } });
                    dialogs.set(el, api);
                }
                api.open();
            } else if (api) { api.destroy(); dialogs.delete(el); }
        });
        for (const [el, api] of dialogs) if (!el.isConnected) { api.destroy(); dialogs.delete(el); }
    }
    new MutationObserver(syncDialogs).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    syncDialogs();
    root.OVSurfaces = { sheet, popover, closePopover() { if (pop) pop.close(); } };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.OVSurfaces;
})(typeof window !== 'undefined' ? window : globalThis);
