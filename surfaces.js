/**
 * Shared behavior for sheets and floating pop-overs. Load beside navbar.js or kit-web.js.
 *
 * The layers (4.235.0; the owner, 11-13: "the little three dots doesn't actually open a menu … the same unified …
 * cross-site shared UI system"): what opens from a button is ANCHORED to it.
 *
 *   const a = OVSurfaces.anchor(el, trigger, { place: 'bottom-end', gap: 6, margin: 8, sheet: false, animate: true });
 *   a.update(); a.release();
 *
 * - It goes in the browser's top layer (the Popover API): nothing clips it, no overflow: hidden, no rail's mask, no
 *   stacking context. Without the API it is position: fixed.
 * - It is placed beside its button: `place` is side-align (bottom|top|left|right, start|center|end). It flips to the
 *   other side when there is no room, shifts along to stay inside the visible screen (the visual viewport: the
 *   keyboard and a pinch zoom count) and is kept no taller than the room on its side (max-height).
 * - It is placed again on a scroll, a resize, a turn of the phone, and when it or its button changes size.
 * - `sheet: 'phone'` opens it as a sheet at the bottom of a phone's screen (under 560 px wide), for long menus and
 *   settings; `sheet: true` always.
 * - The element says where it went: data-ov-side="bottom|top|left|right|sheet", and the transform origin is the
 *   button's side, so the default entrance (a short scale and fade, none when motion is off) grows from the button.
 *
 * OVSurfaces.popover({ el, trigger, close, pop, place, sheet }) anchors `pop` (the menu inside `el`) while it is open,
 * so a <details> menu needs nothing else: one open at a time, a press elsewhere or Escape closes it.
 */
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

    /* ── the anchored layer ──────────────────────────────────────────────────────────────────────────────── */

    const ANCHOR_CSS = `:where([data-ov-anchored]) { position: fixed; inset: auto; margin: 0; color: inherit; box-sizing: border-box; overscroll-behavior: contain; overflow: auto;
  padding: 0; border: 0; background: none; }
[data-ov-anchored][data-ov-anim] { animation: ovAnchorIn var(--ov-dur-2, .16s) var(--ov-ease-out, cubic-bezier(.2, .9, .25, 1)); }
[data-ov-anchored][data-ov-side="sheet"] { left: 0 !important; right: 0 !important; top: auto !important; bottom: 0 !important; width: 100% !important; min-width: 0 !important; max-width: none !important;
  border-radius: 18px 18px 0 0 !important; padding-bottom: max(10px, env(safe-area-inset-bottom, 0px)) !important; }
[data-ov-anchored][data-ov-side="sheet"][data-ov-anim] { animation: ovAnchorSheet var(--ov-dur-3, .26s) var(--ov-ease-out, cubic-bezier(.2, .9, .25, 1)); }
@keyframes ovAnchorIn { from { opacity: 0; transform: scale(.96); } }
@keyframes ovAnchorSheet { from { transform: translateY(100%); } }
html[data-ov-motion="off"] [data-ov-anchored] { animation: none !important; }`;

    function anchorStyles() {
        if (document.getElementById('ov-anchor-styles')) return;
        const st = document.createElement('style');
        st.id = 'ov-anchor-styles';
        st.textContent = ANCHOR_CSS;
        (document.head || document.documentElement).appendChild(st);
    }

    /** The screen a person can see: the visual viewport (the keyboard and a pinch zoom count), in layout coordinates. */
    function visible() {
        const vv = root.visualViewport;
        if (vv) return { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height };
        return { left: 0, top: 0, width: root.innerWidth, height: root.innerHeight };
    }

    /**
     * Where a box of `size` goes beside `at` (the button's rect) inside `view`: the asked side, or the other one when it
     * does not fit there and fits better there; then shifted along to stay inside. Pure (the tests call it).
     */
    function placeBox(at, size, view, opts) {
        const o = opts || {};
        const gap = o.gap == null ? 6 : o.gap, m = o.margin == null ? 8 : o.margin;
        const [side0, align = 'end'] = String(o.place || 'bottom-end').split('-');
        const vertical = side0 === 'top' || side0 === 'bottom';
        const room = {
            bottom: view.top + view.height - m - (at.bottom + gap), top: at.top - gap - (view.top + m),
            right: view.left + view.width - m - (at.right + gap), left: at.left - gap - (view.left + m),
        };
        const need = vertical ? size.height : size.width;
        const other = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' }[side0] || 'top';
        const side = room[side0] >= need || room[side0] >= room[other] ? side0 : other;
        const maxMain = Math.max(0, room[side]);
        let left, top;
        if (vertical) {
            const w = Math.min(size.width, view.width - 2 * m);
            left = align === 'start' ? at.left : align === 'center' ? at.left + at.width / 2 - w / 2 : at.right - w;
            left = Math.min(Math.max(view.left + m, left), view.left + view.width - m - w);
            const h = Math.min(size.height, maxMain);
            top = side === 'bottom' ? at.bottom + gap : at.top - gap - h;
            return { left, top, side, maxHeight: maxMain, maxWidth: view.width - 2 * m, origin: `${align === 'start' ? 'left' : align === 'center' ? 'center' : 'right'} ${side === 'bottom' ? 'top' : 'bottom'}` };
        }
        const h = Math.min(size.height, view.height - 2 * m);
        top = align === 'start' ? at.top : align === 'center' ? at.top + at.height / 2 - h / 2 : at.bottom - h;
        top = Math.min(Math.max(view.top + m, top), view.top + view.height - m - h);
        const w = Math.min(size.width, maxMain);
        left = side === 'right' ? at.right + gap : at.left - gap - w;
        return { left, top, side, maxHeight: view.height - 2 * m, maxWidth: maxMain, origin: `${side === 'right' ? 'left' : 'right'} ${align === 'start' ? 'top' : align === 'center' ? 'center' : 'bottom'}` };
    }

    function anchor(el, trigger, opts) {
        const o = opts || {};
        if (!el || !trigger) return { update() {}, release() {} };
        anchorStyles();
        const topLayer = typeof el.showPopover === 'function';
        const sheetMode = () => o.sheet === true || (o.sheet === 'phone' && visible().width < 560);
        const align = String(o.place || 'bottom-end').split('-')[1] || 'end';
        let queued = 0, released = false, ro = null;
        el.setAttribute('data-ov-anchored', '');
        if (o.animate !== false) el.setAttribute('data-ov-anim', '');
        if (topLayer) {
            if (!el.hasAttribute('popover')) el.setAttribute('popover', 'manual');
            try { if (!el.matches(':popover-open')) el.showPopover(); } catch { /* stays fixed */ }
        }
        function update() {
            queued = 0;
            if (released) return;
            if (!trigger.isConnected) { api.release(); if (typeof o.onLost === 'function') o.onLost(); return; }
            const view = visible();
            // A component's own placement (position: absolute; right: 0, the old way) gives way to the layer's.
            el.style.position = 'fixed'; el.style.right = 'auto'; el.style.bottom = 'auto';
            if (!topLayer) el.style.zIndex = '1000';
            if (sheetMode()) {
                el.setAttribute('data-ov-side', 'sheet');
                el.style.left = el.style.top = '';
                el.style.maxHeight = `${Math.round(view.height * 0.85)}px`;
                el.style.transformOrigin = 'center bottom';
                return;
            }
            const at = trigger.getBoundingClientRect();
            // Its whole height (scrollHeight: a max-height from the last time does not count), the side with room for
            // it, no taller than that room, then its place on that side at the height it is drawn.
            const p = placeBox(at, { width: el.offsetWidth, height: Math.max(el.offsetHeight, el.scrollHeight) }, view, o);
            el.setAttribute('data-ov-side', p.side);
            el.style.maxHeight = `${Math.max(120, Math.floor(p.maxHeight))}px`;
            el.style.maxWidth = `${Math.floor(p.maxWidth)}px`;
            const q = placeBox(at, { width: el.offsetWidth, height: el.offsetHeight }, view, Object.assign({}, o, { place: `${p.side}-${align}` }));
            el.style.left = `${Math.round(q.left)}px`;
            el.style.top = `${Math.round(q.top)}px`;
            el.style.transformOrigin = q.origin;
        }
        const later = () => { if (!queued) queued = requestAnimationFrame(update); };
        const vv = root.visualViewport;
        root.addEventListener('scroll', later, { capture: true, passive: true });
        root.addEventListener('resize', later);
        if (vv) { vv.addEventListener('resize', later); vv.addEventListener('scroll', later); }
        if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(later); ro.observe(el); ro.observe(trigger); }
        const api = {
            update,
            release() {
                if (released) return;
                released = true;
                if (queued) cancelAnimationFrame(queued);
                root.removeEventListener('scroll', later, { capture: true });
                root.removeEventListener('resize', later);
                if (vv) { vv.removeEventListener('resize', later); vv.removeEventListener('scroll', later); }
                try { ro && ro.disconnect(); } catch { /* */ }
                if (topLayer && el.hasAttribute('popover')) { try { if (el.matches(':popover-open')) el.hidePopover(); } catch { /* closed */ } el.removeAttribute('popover'); }
                for (const a of ['data-ov-anchored', 'data-ov-anim', 'data-ov-side']) el.removeAttribute(a);
                for (const k of ['left', 'top', 'right', 'bottom', 'position', 'zIndex', 'maxHeight', 'maxWidth', 'transformOrigin']) el.style[k] = '';
            },
        };
        update();
        return api;
    }

    function popover({ el, trigger, close, pop: menu, place, sheet: asSheet, gap }) {
        if (!el) return null;
        let anchored = null;
        const unanchor = () => { if (anchored) { anchored.release(); anchored = null; } };
        const api = { open() {
                if (pop && pop !== api) pop.close();
                if (root.OpenVibePanels) root.OpenVibePanels.closeAll();
                pop = api;
                if (menu && trigger && !anchored) anchored = anchor(menu, trigger, { place, sheet: asSheet, gap, onLost: () => api.close() });
            },
            close() { unanchor(); if (pop !== api) return; pop = null; close(); },
            update() { if (anchored) anchored.update(); },
            destroy() { unanchor(); if (pop === api) pop = null; } };
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
    root.OVSurfaces = { sheet, popover, anchor, closePopover() { if (pop) pop.close(); }, _test: { placeBox } };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.OVSurfaces;
})(typeof window !== 'undefined' ? window : globalThis);
