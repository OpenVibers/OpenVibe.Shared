/**
 * ov-float.js (openvibe-shared 4.208.0; the handle, the size and the window 4.235.0): the move engine behind a picture-in-picture, a panel window or any box that
 * floats over a page. It is Live's PiP move (public/js/stream-pip.js, 2026-11-11: "move it anywhere … mobile and
 * desktop … more solid feeling and more responsive") lifted out whole, so every floating thing behaves the same:
 *
 *   const f = OVFloat.attach(el, { frame, key, defaults, aspect, minPx, onChange });
 *
 * - Docked in `frame` (an element) or floating over the page (position: fixed). It follows the finger or the mouse
 *   with a transform each animation frame and lands with a spring (FLIP); a flick carries on where it was thrown.
 * - Dropped over its frame it docks; anywhere else it floats. Near an edge it snaps; thrown past a side it tucks into
 *   that side: it folds into a small handle at the edge (4.235.0; it used to leave a strip as tall as itself), the
 *   handle slides up and down that edge, a tap opens it where it was, and a pull brings it out under the finger.
 * - Two fingers pinch it, the corner sizes it, a double tap toggles small and large, and with focus the arrows move it,
 *   + and − size it, T tucks, F pops it out of its frame (or back in) and Home puts it back where it started. It grows
 *   up to the whole width of the window: past what its frame holds it floats over the page and keeps growing.
 * - Its place is kept as fractions of its frame: in this browser under `key`, and in the person's account when the
 *   page has GET/PATCH /api/me/layout (the `pip` map Live keeps). This browser's place wins; the account's fills a
 *   device that has none (a phone and a desktop each keep their own). `OVFloat.store` is the account plug:
 *   { get(key), put(key, value), load?() }; assign your own to keep it somewhere else.
 * - `f.geom()`, `f.set(patch, { save })`, `f.tuck()`, `f.untuck()`, `f.toggleMode()`, `f.toggleSize()`, `f.reset()`,
 *   `f.paint()`, `f.settle()`, `f.save()`, `f.sizeTo(px)`, `f.relayout()`, `f.destroy()`. `OVFloat.layout()` lists every attached box,
 *   and each save dispatches `ov:float` ({ key, geom, el }).
 *
 * The CSS (injected once) is behaviour, not looks: positioning, the lift, the tuck's translate, the tab and the resize
 * grip. A component adds its own colours, border, shadow and children. `aspect: null`, `size: false` and
 * `resize: false` let a panel window keep its own height and width while it gets the move, the tuck and the place.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVFloat) return;

    const BASE = 16 / 9;          // the shape `w` is measured for
    const MIN_W = 0.08, MAX_W = 1;  // up to its frame's whole width (4.235.0; was 0.60, a phone's PiP could not grow)
    const MAX_H = 0.85;           // docked: of the frame's height, whatever the shape
    const FLOAT_MAX_H = 0.92;     // floating: of the window's height
    const MIN_PX = 150;           // the smallest 16:9 width on a phone-sized frame
    const SNAP = 0.04;            // within this fraction of an edge, a drop snaps to it
    const EDGE_PX = 12;           // the margin it snaps to
    const TAB_PX = 30;            // the tucked handle's width (a finger's: 34), and what stays on screen in a drag
    const TAB_H = 64;             // the tucked handle's height (a finger's: 72)
    const TUCK_MS = 340;          // folding into the handle and opening out of it
    const OPEN_CLIP = 'inset(-80px -80px -80px -80px round 0px)';   // nothing clipped, its shadow included
    const DRAG_PX = 4;            // a press that moves less is a tap
    const BIG_W = 0.5;            // a double tap's large size
    const PROJECT_MS = 120;       // how far a flick carries
    const TAP_MS = 300;
    const ACTIVE_MS = 3200;
    const LAND_MS = 300;
    const DEFAULT_IGNORE = 'a, button, input, textarea, select, [contenteditable], .ov-float-resize, [data-ov-float-resize], [data-ov-float-no-drag]';

    const CSS = `:where(.ov-float) { position: absolute; box-sizing: border-box; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
  --ov-float-tab-w: ${TAB_PX}px; --ov-float-tab-h: ${TAB_H}px; }
@media (pointer: coarse) { :where(.ov-float) { --ov-float-tab-w: 34px; --ov-float-tab-h: 72px; } }
.ov-float.is-floating { position: fixed; z-index: 900; }
.ov-float.is-lifted { position: fixed; z-index: 905; will-change: transform; transition: none; }
.ov-float.is-lifted, .ov-float.is-lifted * { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
.ov-float.is-dragging { cursor: grabbing; }
.ov-float.is-tucked { cursor: pointer; }
.ov-float.is-tucked-right { clip-path: inset(max(0px, calc(50% - var(--ov-float-tab-h) / 2)) 0px max(0px, calc(50% - var(--ov-float-tab-h) / 2)) calc(100% - var(--ov-float-tab-w)) round 14px 0px 0px 14px); }
.ov-float.is-tucked-left { clip-path: inset(max(0px, calc(50% - var(--ov-float-tab-h) / 2)) calc(100% - var(--ov-float-tab-w)) max(0px, calc(50% - var(--ov-float-tab-h) / 2)) 0px round 0px 14px 14px 0px); }
.ov-float.is-tucked .ov-float-tab { display: grid; animation: ovFloatTabIn ${TUCK_MS}ms ease-out; }
@keyframes ovFloatTabIn { from { opacity: 0; } }
.ov-float-tab { position: absolute; top: 50%; z-index: 4; width: var(--ov-float-tab-w); height: min(var(--ov-float-tab-h), 100%); translate: 0 -50%; display: none; place-items: center; padding: 0; border: 0; cursor: pointer; touch-action: none;
  color: #fff; font: 600 18px/1 system-ui, sans-serif; background: rgba(10, 12, 18, .62); -webkit-backdrop-filter: blur(10px) saturate(1.2); backdrop-filter: blur(10px) saturate(1.2); }
.ov-float.is-tucked-left .ov-float-tab { left: 0; border-radius: 0 14px 14px 0; box-shadow: inset -1px 0 0 rgba(255, 255, 255, .2); }
.ov-float.is-tucked-right .ov-float-tab { right: 0; border-radius: 14px 0 0 14px; box-shadow: inset 1px 0 0 rgba(255, 255, 255, .2); }
.ov-float-tab-l, .ov-float-tab-r { display: none; }
.ov-float.is-tucked-left .ov-float-tab-r, .ov-float.is-tucked-right .ov-float-tab-l { display: block; }
.ov-float-resize { position: absolute; right: 0; bottom: 0; z-index: 3; width: 22px; height: 22px; cursor: nwse-resize; touch-action: none; opacity: 0;
  background: linear-gradient(135deg, transparent 52%, rgba(255, 255, 255, .72) 52%, rgba(255, 255, 255, .72) 60%, transparent 60%, transparent 70%, rgba(255, 255, 255, .72) 70%, rgba(255, 255, 255, .72) 78%, transparent 78%); }
.ov-float:hover .ov-float-resize, .ov-float:focus-within .ov-float-resize, .ov-float.is-resizing .ov-float-resize { opacity: 1; }
@media (pointer: coarse) { .ov-float-resize { width: 30px; height: 30px; opacity: .85; } }
html[data-ov-motion="off"] .ov-float { transition: none !important; }
html[data-ov-motion="off"] .ov-float-tab, html[data-ov-motion="off"] .ov-float-resize { transition: none !important; animation: none !important; }
@media (prefers-reduced-motion: reduce) {
  html:not([data-ov-motion="on"]) .ov-float { transition: none !important; }
}`;

    const instances = new Set();
    let uid = 0;

    function clamp(v, lo, hi, dflt) {
        const n = Number(v);
        if (!Number.isFinite(n)) return dflt;
        return Math.min(hi, Math.max(lo, n));
    }

    function viewport(inst) {
        const de = document.documentElement;
        // A floating element's percentage place is measured on the document's client box, not on innerWidth when a
        // scrollbar takes 15 px of it. Live's PiP keeps the window size it always used; a free panel asks for `client`.
        const client = inst && inst.options.viewport === 'client' && de;
        const w = (client ? de.clientWidth : root.innerWidth) || 0;
        const h = (client ? de.clientHeight : root.innerHeight) || 0;
        return { left: 0, top: 0, width: w, height: h, right: w, bottom: h };
    }

    function rectOf(el) {
        return el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : viewport();
    }

    /** The box an absolutely positioned child measures its percentages on: the frame's padding box, not its border. */
    function contentRect(el) {
        const r = rectOf(el);
        if (!el || !el.clientWidth || !el.clientHeight) return r;
        const left = r.left + (el.clientLeft || 0), top = r.top + (el.clientTop || 0);
        return { left, top, width: el.clientWidth, height: el.clientHeight, right: left + el.clientWidth, bottom: top + el.clientHeight };
    }

    function reduced() {
        const m = document.documentElement && document.documentElement.getAttribute('data-ov-motion');
        if (m === 'off') return true;
        try { return m !== 'on' && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
    }

    function inFullscreen(inst) {
        const fs = typeof document !== 'undefined' && document.fullscreenElement;
        return !!(fs && inst && inst.frame && (fs === inst.frame || fs.contains(inst.frame)));
    }

    function frameRect(inst) {
        if (inst.geom.mode === 'float' && !inFullscreen(inst)) return viewport(inst);
        return inst.frame ? contentRect(inst.frame) : viewport(inst);
    }

    /* ── geometry (pure; the tests call these) ─────────────────────────────────────────────────────────────── */

    /**
     * The box as fractions of its frame: width, height and the place it may go, for the source's own shape.
     * aspect: null keeps the element's own height (a panel window); `elHeight` is its measured height.
     */
    function boxOf(geom, rect, opts) {
        const o = opts || {};
        const a = o.aspect === null ? null : (Number(o.aspect) > 0 ? Number(o.aspect) : BASE);
        const minW = o.minW == null ? MIN_W : o.minW;
        const maxW = o.maxW == null ? MAX_W : o.maxW;
        const maxH = o.maxH == null ? MAX_H : o.maxH;
        const rw = (rect && rect.width) || 0, rh = (rect && rect.height) || 0;
        const rl = (rect && rect.left) || 0, rt = (rect && rect.top) || 0;
        let w = clamp(geom && geom.w, minW, maxW, Math.min(0.25, maxW));
        if (a == null) {
            return { a: null, wf: w, hf: rh && o.elHeight ? o.elHeight / rh : 0, rw, rh, rl, rt };
        }
        // On a phone-sized frame a quarter of the width is a postage stamp: never smaller than a 150 px wide 16:9 box
        // (the saved size is unchanged, so a desktop shows it as saved).
        const minPx = o.minPx == null ? MIN_PX : o.minPx;
        if (rw && rw < (o.phoneFramePx == null ? 640 : o.phoneFramePx)) w = Math.max(w, Math.min(maxW, minPx / rw));
        let wf = w * Math.sqrt(a / BASE);                        // the same area as a 16:9 box of width w
        if (rw && rh && (wf * rw) / a > maxH * rh) wf = (maxH * rh * a) / rw;
        wf = Math.min(wf, 1);
        const hf = rw && rh ? (wf * rw) / a / rh : wf / a;
        return { a, wf, hf, rw, rh, rl, rt };
    }

    /** After a drop: keep it inside, and snap it to an edge it was dropped close to. */
    function settleGeom(geom, box, opts) {
        const o = opts || {};
        const edge = o.edgePx == null ? EDGE_PX : o.edgePx;
        const snap = o.snap == null ? SNAP : o.snap;
        const mx = box.rw ? edge / box.rw : 0, my = box.rh ? edge / box.rh : 0;
        const maxX = Math.max(0, 1 - box.wf), maxY = Math.max(0, 1 - (box.hf || 0));
        let x = clamp(geom.x, 0, maxX, 0), y = clamp(geom.y, 0, maxY, 0);
        if (x < snap) x = Math.min(mx, maxX); else if (x > maxX - snap) x = Math.max(0, maxX - mx);
        if (y < snap) y = Math.min(my, maxY); else if (y > maxY - snap) y = Math.max(0, maxY - my);
        geom.x = x; geom.y = y;
        return geom;
    }

    /** The last 90 ms of a drag: the speed it was let go at, and where a flick carries it. */
    function flick(hist, from, opts) {
        const o = opts || {};
        const h = Array.isArray(hist) && hist.length ? hist : [{ x: 0, y: 0, t: 0 }];
        const a = h[0], z = h[h.length - 1];
        const dt = Math.max(16, (z.t || 0) - (a.t || 0));
        const vx = ((z.x || 0) - (a.x || 0)) / dt, vy = ((z.y || 0) - (a.y || 0)) / dt;
        const fast = Math.hypot(vx, vy) > (o.fastAt == null ? 0.6 : o.fastAt);
        return { vx, vy, fast, left: from.left + (fast ? vx * PROJECT_MS : 0), top: from.top + (fast ? vy * PROJECT_MS : 0) };
    }

    /** Past a side of its frame by more than a third of itself (or thrown at it): tucked into that side. */
    function tuckFor(point, from, frame, speed, opts) {
        const o = opts || {};
        const edge = o.edgePx == null ? EDGE_PX : o.edgePx;
        const out = from.width / 3;
        if (point.left < frame.left - out || (speed.fast && speed.vx < -1.2 && point.left < frame.left + edge)) return 'left';
        if (point.left + from.width > frame.right + out || (speed.fast && speed.vx > 1.2 && point.left + from.width > frame.right - edge)) return 'right';
        return null;
    }

    function overFrame(cx, cy, frame) {
        return !!frame && cx >= frame.left && cx <= frame.right && cy >= frame.top && cy <= frame.bottom;
    }

    /** Draw a geometry: the percentages, the shape, and the state classes the component styles. */
    function paint(el, geom, box, opts) {
        const o = opts || {};
        const tuck = geom.tuck;
        const floating = !!o.floating;
        const classes = el.classList;
        classes.toggle('is-floating', floating);
        classes.toggle('is-tucked', !!tuck);
        classes.toggle('is-tucked-left', tuck === 'left');
        classes.toggle('is-tucked-right', tuck === 'right');
        classes.toggle('is-portrait', !!box.a && box.a < 1);
        // Shown inside its frame even when a turn of the phone or a smaller window would push it out; the saved place
        // is not changed, so it comes back when there is room again. A tucked one sits at its side (CSS `translate`
        // leaves only its tab on screen; `transform` stays free for the landing).
        const left = tuck === 'left' ? 0 : tuck === 'right' ? Math.max(0, 1 - box.wf) : Math.min(Math.max(0, geom.x), Math.max(0, 1 - box.wf));
        el.style.left = `${left * 100}%`;
        el.style.top = `${Math.min(Math.max(0, geom.y), Math.max(0, 1 - (box.hf || 0))) * 100}%`;
        if (o.size !== false) {
            el.style.width = `${box.wf * 100}%`;
            if (box.a) el.style.aspectRatio = String(box.a);
        }
    }

    /* ── the account plug (GET/PATCH /api/me/layout, the shape Live's stream-pip.js keeps) ───────────────── */

    function makeDefaultStore() {
        const state = { data: null, loading: null, pending: {}, timer: 0, off: false };
        function load() {
            if (state.off || typeof fetch !== 'function') return Promise.resolve(null);
            if (!state.loading) {
                state.loading = fetch('/api/me/layout', { credentials: 'same-origin', headers: { accept: 'application/json' } })
                    .then((r) => {
                        if (r.status === 400 || r.status === 401 || r.status === 403 || r.status === 404) { state.off = true; return null; }
                        return r.ok ? r.json() : null;
                    })
                    .then((d) => { state.data = d && typeof d === 'object' ? d : {}; return state.data; })
                    .catch(() => null);
            }
            return state.loading;
        }
        function get(key) {
            const pip = state.data && state.data.pip;
            return pip && pip[key] ? pip[key] : null;
        }
        function put(key, value) {
            if (state.off || typeof fetch !== 'function') return;
            state.pending[key] = value;
            if (state.data) { state.data.pip = state.data.pip || {}; state.data.pip[key] = value; }
            clearTimeout(state.timer);
            state.timer = setTimeout(() => {
                const pip = state.pending; state.pending = {};
                fetch('/api/me/layout', {
                    method: 'PATCH', credentials: 'same-origin',
                    headers: { 'content-type': 'application/json', accept: 'application/json' },
                    body: JSON.stringify({ pip }),
                }).then((r) => { if (r.status === 400 || r.status === 401 || r.status === 403 || r.status === 404) state.off = true; })
                    .catch(() => { /* the next move tries again */ });
            }, 1500);
        }
        return { load, get, put, _state: state };
    }

    function normalizeDefaults(raw, hasFrame) {
        const d = raw && typeof raw === 'object' ? raw : {};
        return {
            x: clamp(d.x, 0, 1, 0.72), y: clamp(d.y, 0, 1, 0.70), w: clamp(d.w, MIN_W, MAX_W, 0.25),
            mode: hasFrame ? (d.mode === 'float' ? 'float' : 'dock') : 'float',
            tuck: d.tuck === 'left' || d.tuck === 'right' ? d.tuck : null,
            muted: typeof d.muted === 'boolean' ? d.muted : undefined,
            at: 0,
        };
    }

    function normalize(raw, fallback, opts) {
        const o = opts || {};
        if (!raw || typeof raw !== 'object') return Object.assign({}, fallback);
        const g = Object.assign({}, fallback);
        g.x = clamp(raw.x, 0, 1, fallback.x);
        g.y = clamp(raw.y, 0, 1, fallback.y);
        g.w = clamp(raw.w, o.minW == null ? MIN_W : o.minW, o.maxW == null ? MAX_W : o.maxW, fallback.w);
        g.mode = o.hasFrame === false ? 'float' : (raw.mode === 'float' ? 'float' : raw.mode === 'dock' ? 'dock' : fallback.mode);
        g.tuck = raw.tuck === 'left' || raw.tuck === 'right' ? raw.tuck : null;
        if (typeof raw.muted === 'boolean') g.muted = raw.muted;
        g.at = Number(raw.at) || 0;
        // Where a box tucked by hand opens again (this browser only).
        if (g.tuck && raw.ux != null && Number.isFinite(Number(raw.ux))) g.ux = clamp(raw.ux, 0, 1, 0);
        return g;
    }

    /** The place as an account keeps it (live.layout's fields): no browser-only extras. */
    function placeOf(g) {
        const out = { x: g.x, y: g.y, w: g.w, mode: g.mode, tuck: g.tuck || null, at: g.at || 0 };
        if (typeof g.muted === 'boolean') out.muted = g.muted;
        return out;
    }

    function readSaved(key, legacyKeys) {
        const keys = [key].concat(Array.isArray(legacyKeys) ? legacyKeys : []);
        for (const k of keys) {
            try {
                const raw = root.localStorage && root.localStorage.getItem(k);
                if (!raw) continue;
                const v = JSON.parse(raw);
                if (v && typeof v === 'object') return v;
            } catch { /* private mode, or a key from another shape */ }
        }
        return null;
    }

    /* ── the instance ──────────────────────────────────────────────────────────────────────────────────────── */

    function box(inst) {
        const floating = inst.geom.mode === 'float' && !inFullscreen(inst);
        return boxOf(inst.geom, frameRect(inst), {
            aspect: inst.aspect, minPx: inst.minPx, minW: inst.minW, maxW: inst.maxW,
            maxH: floating ? FLOAT_MAX_H : MAX_H,
            elHeight: inst.el.offsetHeight || 0,
        });
    }

    /** The handle a tucked box folds into, in px (the component may set its own with --ov-float-tab-w/-h). */
    function tabSize(inst) {
        let w = 0, h = 0;
        try {
            const cs = root.getComputedStyle(inst.el);
            w = parseFloat(cs.getPropertyValue('--ov-float-tab-w'));
            h = parseFloat(cs.getPropertyValue('--ov-float-tab-h'));
        } catch { /* no computed style here */ }
        return { w: w > 0 ? w : TAB_PX, h: h > 0 ? h : TAB_H };
    }

    /**
     * The tuck's own motion: the box folds into its handle at the side, or opens out of it, as a clip, so nothing inside
     * is squeezed (the move to the side is the landing's spring, at the same time). The CSS class holds the folded shape.
     */
    function animateClip(inst, opening, side) {
        const el = inst.el;
        if (!side || reduced() || typeof el.animate !== 'function') return;
        const w = el.offsetWidth, h = el.offsetHeight;
        if (!w || !h) return;
        const t = tabSize(inst);
        const v = Math.max(0, (h - t.h) / 2), across = Math.max(0, w - t.w);
        const folded = side === 'right'
            ? `inset(${v}px 0px ${v}px ${across}px round 14px 0px 0px 14px)`
            : `inset(${v}px ${across}px ${v}px 0px round 0px 14px 14px 0px)`;
        try {
            if (inst.clipAnim) inst.clipAnim.cancel();
            inst.clipAnim = el.animate([{ clipPath: opening ? folded : OPEN_CLIP }, { clipPath: opening ? OPEN_CLIP : folded }],
                { duration: TUCK_MS, easing: 'cubic-bezier(.2, .9, .25, 1)' });
        } catch { /* a browser that cannot animate a clip simply shows the end */ }
    }

    /**
     * Size it so the box is `px` wide on screen (for another shape, the width it has at that 16:9 area): inside a docked
     * frame while it fits; past what the frame holds it floats over the page, where it is, and keeps growing up to the
     * window's width. Answers true when it changed frames (the caller takes its pointers back).
     */
    function sizeTo(inst, px) {
        const a = inst.aspect;
        const k = a ? Math.sqrt(a / BASE) || 1 : 1;
        let b = box(inst);
        if (inst.geom.mode === 'dock' && inst.frame && !inFullscreen(inst) && b.rw && b.rh) {
            const hpx = a ? px / a : (inst.el.offsetHeight || 0);
            if (px > b.rw + 0.5 || (a && hpx > MAX_H * b.rh + 0.5)) {
                const r = inst.el.getBoundingClientRect();
                toMode(inst, 'float', { left: r.left, top: r.top, width: px, height: hpx });
                placeIn(inst);
                paintNow(inst);
                return true;
            }
        }
        b = box(inst);
        if (!b.rw) return false;
        inst.geom.w = clamp(px / b.rw / k, inst.minW, inst.maxW, inst.geom.w);
        b = box(inst);
        inst.geom.x = Math.min(inst.geom.x, Math.max(0, 1 - b.wf));
        inst.geom.y = Math.min(inst.geom.y, Math.max(0, 1 - b.hf));
        paintNow(inst);
        return false;
    }

    function paintNow(inst) {
        const b = box(inst);
        paint(inst.el, inst.geom, b, {
            floating: inst.geom.mode === 'float' && !inFullscreen(inst),
            size: inst.options.size !== false,
        });
        return b;
    }

    function settleInst(inst) {
        return settleGeom(inst.geom, box(inst));
    }

    function placeIn(inst) {
        const fs = document.fullscreenElement;
        let want;
        if (inst.geom.mode === 'float' && !inFullscreen(inst)) want = document.body;
        else if (inst.frame) want = fs && !fs.contains(inst.frame) ? fs : inst.frame;
        else want = document.body;
        if (want && inst.el.parentNode !== want) {
            const v = inst.el.querySelector('video');
            want.appendChild(inst.el);
            // A media element moved in one task keeps playing; play() covers a browser that paused it.
            if (v && v.paused) v.play().catch(() => {});
        }
    }

    function save(inst) {
        if (inst.destroyed) return;
        // A drop clears the lifted inline left/top before it saves; draw the final place first so an onChange that
        // reads the element's rect (a window's absolute place, for one) sees where it landed, not its static position.
        if (!inst.el.classList.contains('is-lifted')) paintNow(inst);
        inst.geom.at = Date.now();
        // This browser keeps everything (where a tucked box opens again too); the account and listeners get the place.
        try { if (root.localStorage) root.localStorage.setItem(inst.key, JSON.stringify(inst.geom)); } catch { /* private mode */ }
        if (inst.store && typeof inst.store.put === 'function') {
            try { inst.store.put(inst.accountKey, placeOf(inst.geom)); } catch { /* the page's own store */ }
        }
        if (typeof inst.options.onChange === 'function') {
            try { inst.options.onChange(placeOf(inst.geom), inst.api); } catch (err) { console.error(err); }
        }
        try {
            root.dispatchEvent(new root.CustomEvent('ov:float', { detail: { key: inst.key, geom: placeOf(inst.geom), el: inst.el } }));
        } catch { /* an environment without CustomEvent */ }
    }

    /** Move it to its place with a spring from where it was (`from`: its rect on screen before). */
    function land(inst, from) {
        placeIn(inst);
        const el = inst.el;
        el.style.transition = 'none';
        el.style.transform = '';
        paintNow(inst);
        if (!from || reduced()) { el.style.transition = ''; return; }
        const to = el.getBoundingClientRect();
        if (!to.width) { el.style.transition = ''; return; }
        const dx = from.left - to.left, dy = from.top - to.top, s = from.width / to.width;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.01) { el.style.transition = ''; return; }
        el.style.transformOrigin = '0 0';
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${s})`;
        void el.offsetWidth;
        el.style.transition = `transform ${LAND_MS}ms var(--ov-ease-spring, cubic-bezier(.2, 1.25, .3, 1))`;
        el.style.transform = '';
        clearTimeout(inst.landTimer);
        inst.landTimer = setTimeout(() => {
            if (!inst.destroyed) { el.style.transition = ''; el.style.transformOrigin = ''; }
        }, LAND_MS + 40);
    }

    /** Switch frames keeping its size and place on screen (`rect`: where it is now). */
    function toMode(inst, mode, rect) {
        if (!inst.frame) mode = 'float';
        inst.geom.mode = mode;
        const b0 = box(inst);
        if (!b0.rw || !b0.rh) return;
        const a = inst.aspect || BASE;
        const k = Math.sqrt(a / BASE) || 1;
        if (inst.options.size !== false) inst.geom.w = clamp(rect.width / b0.rw / k, inst.minW, inst.maxW, inst.geom.w);
        const b = box(inst);
        inst.geom.x = (rect.left - b.rl) / b.rw;
        inst.geom.y = (rect.top - b.rt) / b.rh;
        settleInst(inst);
    }

    function tuck(inst, side) {
        if (side === null) { untuck(inst); return; }
        const from = inst.el.getBoundingClientRect();
        const b = box(inst);
        // Tucked by hand (the button, T): it opens again where it was. Thrown at a side, it opens at that side.
        if (!inst.geom.tuck) inst.geom.ux = inst.geom.x;
        inst.geom.tuck = side || (inst.geom.x + b.wf / 2 < 0.5 ? 'left' : 'right');
        save(inst);
        land(inst, from);
        animateClip(inst, false, inst.geom.tuck);
    }

    function untuck(inst) {
        const side = inst.geom.tuck;
        if (!side) return;
        const from = inst.el.getBoundingClientRect();
        const b = box(inst);
        const margin = b.rw ? EDGE_PX / b.rw : 0;
        inst.geom.tuck = null;
        inst.geom.x = inst.geom.ux != null ? inst.geom.ux : side === 'left' ? margin : Math.max(0, 1 - b.wf - margin);
        delete inst.geom.ux;
        inst.untuckedAt = performance.now();
        settleInst(inst);
        save(inst);
        land(inst, from);
        animateClip(inst, true, side);
    }

    function toggleMode(inst) {
        if (!inst.frame) return false;
        const from = inst.el.getBoundingClientRect();
        toMode(inst, inst.geom.mode === 'float' ? 'dock' : 'float', from);
        save(inst);
        land(inst, from);
        return true;
    }

    /** Small and large: large is half its frame, and on a phone the whole width of the screen (it floats to get it). */
    function toggleSize(inst) {
        const from = inst.el.getBoundingClientRect();
        const vp = viewport(inst);
        const b = box(inst);
        const k = inst.aspect ? Math.sqrt(inst.aspect / BASE) || 1 : 1;
        const bigW = inst.options.bigW == null ? BIG_W : inst.options.bigW;
        const bigPx = vp.width && vp.width < 640 ? vp.width : bigW * k * b.rw;
        delete inst.geom.ux;
        inst.geom.tuck = null;
        if (from.width < bigPx * 0.95) sizeTo(inst, bigPx);
        else inst.geom.w = clamp(inst.defaults.w, inst.minW, inst.maxW, inst.defaults.w);
        settleInst(inst);
        save(inst);
        land(inst, from);
    }

    function reset(inst) {
        const from = inst.el.getBoundingClientRect();
        const d = inst.defaults;
        Object.assign(inst.geom, { x: d.x, y: d.y, w: d.w, mode: inst.frame ? d.mode : 'float', tuck: null });
        delete inst.geom.ux;
        settleInst(inst);
        save(inst);
        land(inst, from);
    }

    function relayout(inst) {
        if (inst.destroyed || inst.el.classList.contains('is-lifted')) return;
        placeIn(inst);
        paintNow(inst);
    }

    function syncAccount(inst) {
        const store = inst.store;
        if (!store || typeof store.get !== 'function') return;
        const apply = () => {
            // This device's own place wins; the account's opens a device that has none where the person left it.
            if (inst.destroyed || inst.touched || inst.hadLocal) return;
            const remote = normalize(store.get(inst.accountKey), inst.defaults, { hasFrame: !!inst.frame, minW: inst.minW, maxW: inst.maxW });
            if ((remote.at || 0) > (inst.geom.at || 0)) {
                inst.geom = remote;
                placeIn(inst);
                paintNow(inst);
            }
        };
        if (typeof store.load === 'function') {
            let p;
            try { p = store.load(); } catch { p = null; }
            if (p && typeof p.then === 'function') p.then(apply).catch(() => { /* no account on this page */ });
            else apply();
        } else apply();
    }

    /* ── gestures ──────────────────────────────────────────────────────────────────────────────────────────── */

    function wireMove(inst) {
        const el = inst.el;
        const handle = inst.options.handle && inst.options.handle.addEventListener ? inst.options.handle : el;
        const ignore = inst.options.ignore || DEFAULT_IGNORE;
        const hintClass = inst.options.hintClass || 'ov-float-dock-hint';
        const pts = new Map();   // pointerId → { x, y }
        let drag = null, pinch = null, raf = 0, lastTap = 0, activeTimer = 0;
        const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
        const hint = (on) => { if (inst.frame && inst.frame.classList) inst.frame.classList.toggle(hintClass, !!on); };
        const paint = () => {
            raf = 0;
            if (!drag || !drag.lifted) return;
            el.style.transform = `translate3d(${drag.dx}px, ${drag.dy}px, 0)`;
            const c = drag.r;
            const p = inst.frame ? contentRect(inst.frame) : null;
            if (p) hint(overFrame(c.left + drag.dx + c.width / 2, c.top + drag.dy + c.height / 2, p));
        };
        const lift = () => {
            drag.lifted = true;
            // Over the page from the first move, at the same place on screen, so it can go anywhere.
            const r = drag.r;
            const layer = document.fullscreenElement || document.body;
            if (el.parentNode !== layer) layer.appendChild(el);
            // Moving the element in the DOM releases any pointer capture it had; take the pointers it is following back.
            for (const id of pts.keys()) { try { el.setPointerCapture(id); } catch { /* a pointer the browser no longer tracks */ } }
            el.classList.add('is-dragging', 'is-lifted');
            el.style.transition = 'none';
            el.style.left = `${r.left}px`; el.style.top = `${r.top}px`; el.style.width = `${r.width}px`;
            const v = el.querySelector('video');
            if (v && v.paused) v.play().catch(() => {});
            if (typeof inst.options.onLift === 'function') { try { inst.options.onLift(inst.api); } catch { /* */ } }
        };
        const showActive = () => {
            el.classList.add('is-active');
            clearTimeout(activeTimer);
            activeTimer = setTimeout(() => el.classList.remove('is-active'), ACTIVE_MS);
        };
        const recapture = () => { for (const id of pts.keys()) { try { el.setPointerCapture(id); } catch { /* */ } } };
        const onDown = (e) => {
            if (e.button > 0) return;
            // The tucked handle is a button that moves: a tap opens it, a drag slides it along its side or pulls it out.
            if (e.target.closest && e.target.closest(ignore) && !e.target.closest('[data-ov-float-tab]')) return;
            if (typeof inst.options.canDrag === 'function' && !inst.options.canDrag(e)) return;
            inst.touched = true;
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            try { el.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks */ }
            e.preventDefault();
            if (pts.size === 2) {
                if (drag && drag.lifted) el.style.transform = '';
                drag = null;
                pinch = { d: gap(), px: el.getBoundingClientRect().width };
                el.classList.add('is-resizing');
                return;
            }
            if (pts.size > 2) return;
            drag = {
                sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, r: el.getBoundingClientRect(), lifted: false,
                tucked: inst.geom.tuck || null, slide: false,
                hist: [{ x: e.clientX, y: e.clientY, t: performance.now() }],
            };
        };
        const onMove = (e) => {
            if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch && pts.size === 2) {
                // Up to the whole width of the window: past its frame it floats over the page and keeps growing.
                if (sizeTo(inst, pinch.px * (gap() / pinch.d))) recapture();
                return;
            }
            if (!drag) return;
            const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
            if (!drag.lifted && !drag.slide && Math.hypot(dx, dy) < DRAG_PX) return;
            if (drag.tucked && !drag.lifted && (drag.slide || Math.abs(dy) > Math.abs(dx))) {
                // A tucked handle dragged up or down slides along its side, the whole box inside its frame.
                if (!drag.slide) { drag.slide = true; el.classList.add('is-dragging'); el.style.transition = 'none'; }
                const f = frameRect(inst), r = drag.r;
                drag.dy = Math.min(Math.max(dy, f.top - r.top), f.top + f.height - r.bottom);
                if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (drag && drag.slide) el.style.transform = `translate3d(0, ${drag.dy}px, 0)`; });
                return;
            }
            if (!drag.lifted) {
                if (drag.tucked) {
                    // Pulled out of its side: it opens under the finger and follows it.
                    const side = inst.geom.tuck;
                    inst.geom.tuck = null;
                    delete inst.geom.ux;
                    el.classList.remove('is-tucked', 'is-tucked-left', 'is-tucked-right');
                    animateClip(inst, true, side);
                }
                lift();
            }
            // Anywhere on screen; most of it may go past a side (that is how it tucks), never past the top or bottom.
            const vp = viewport(inst);
            const r = drag.r, vw = vp.width, vh = vp.height, tab = inst.options.tabPx == null ? TAB_PX : inst.options.tabPx;
            drag.dx = Math.min(Math.max(dx, -r.left - r.width + tab), vw - r.left - tab);
            drag.dy = Math.min(Math.max(dy, -r.top), vh - r.top - r.height);
            const now = performance.now();
            drag.hist.push({ x: e.clientX, y: e.clientY, t: now });
            while (drag.hist.length > 2 && now - drag.hist[0].t > 90) drag.hist.shift();
            if (!raf) raf = requestAnimationFrame(paint);
        };
        const onUp = (e) => {
            pts.delete(e.pointerId);
            try { el.releasePointerCapture(e.pointerId); } catch { /* */ }
            if (pinch) {
                if (pts.size < 2) {
                    pinch = null;
                    el.classList.remove('is-resizing');
                    // A pinch that began after the lift put the box over the page; put it back in its frame for its mode.
                    if (el.classList.contains('is-lifted')) {
                        el.classList.remove('is-dragging', 'is-lifted');
                        el.style.left = ''; el.style.top = ''; el.style.width = ''; el.style.transform = '';
                        placeIn(inst);
                    }
                    settleInst(inst);
                    paintNow(inst);
                    save(inst);
                }
                return;
            }
            if (!drag) return;
            const d = drag; drag = null;
            if (raf) { cancelAnimationFrame(raf); raf = 0; }
            hint(false);
            if (d.slide) {
                // Slid along its side: it stays tucked there, at that height.
                el.classList.remove('is-dragging');
                el.style.transition = 'none';
                el.style.transform = '';
                const b = box(inst);
                if (b.rh) inst.geom.y = clamp((d.r.top + d.dy - b.rt) / b.rh, 0, Math.max(0, 1 - b.hf), inst.geom.y);
                paintNow(inst);
                el.style.transition = '';
                save(inst);
                return;
            }
            if (!d.lifted) {
                // A tap on a tucked box opens it; on an open one, the bar for a moment (a touch screen has no hover), and a
                // second within 300 ms toggles the size.
                if (inst.geom.tuck) { if (e.type === 'pointerup') untuck(inst); return; }
                const now = performance.now();
                if (inst.options.doubleTap !== false && now - lastTap < TAP_MS) { lastTap = 0; toggleSize(inst); }
                else {
                    lastTap = now;
                    if (e.pointerType !== 'mouse' && inst.options.activeBar !== false) showActive();
                }
                return;
            }
            el.classList.remove('is-dragging', 'is-lifted');
            // Where it was let go, and where a flick carries it (the last 90 ms, 120 ms on).
            const fl = flick(d.hist, { left: d.r.left + d.dx, top: d.r.top + d.dy });
            const from = { left: d.r.left + d.dx, top: d.r.top + d.dy, width: d.r.width, height: d.r.height };
            const vp = viewport(inst);
            const vhei = vp.height;
            const top = Math.min(Math.max(0, fl.top), vhei - from.height);
            const p = inst.frame ? contentRect(inst.frame) : null;
            const fs = inFullscreen(inst);
            const overPlayer = !!p && (fs || overFrame(fl.left + from.width / 2, top + from.height / 2, p));
            const frame = overPlayer ? p : vp;
            const tuckSide = tuckFor({ left: fl.left }, from, frame, fl);
            el.style.transform = '';
            el.style.left = ''; el.style.top = ''; el.style.width = '';
            toMode(inst, overPlayer ? 'dock' : 'float', {
                left: Math.min(Math.max(frame.left, fl.left), frame.right - from.width),
                top,
                width: from.width,
                height: from.height,
            });
            inst.geom.tuck = tuckSide;
            save(inst);
            land(inst, from);
        };
        handle.addEventListener('pointerdown', onDown);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
        inst.cleanups.push(() => {
            handle.removeEventListener('pointerdown', onDown);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
            el.removeEventListener('pointercancel', onUp);
            clearTimeout(activeTimer);
            hint(false);
        });
    }

    function wireKeys(inst) {
        const el = inst.el;
        const onKey = (e) => {
            if (e.target !== el || e.altKey || e.ctrlKey || e.metaKey) return;
            const step = e.shiftKey ? 0.1 : 0.02;
            const k = e.key;
            let moved = true;
            if (k === 'ArrowLeft') inst.geom.x -= step;
            else if (k === 'ArrowRight') inst.geom.x += step;
            else if (k === 'ArrowUp') inst.geom.y -= step;
            else if (k === 'ArrowDown') inst.geom.y += step;
            else if (k === '+' || k === '=' || k === '-' || k === '_') {
                const r = el.getBoundingClientRect();
                sizeTo(inst, r.width * (k === '+' || k === '=' ? 1.12 : 1 / 1.12));
            }
            else if (k === 'Home') { e.preventDefault(); reset(inst); return; }
            else if (k === 't' || k === 'T' || k === 'h' || k === 'H') { e.preventDefault(); inst.geom.tuck ? untuck(inst) : tuck(inst); return; }
            else if (k === 'f' || k === 'F') { e.preventDefault(); toggleMode(inst); return; }
            else return;
            e.preventDefault();
            if (!moved) return;
            const b = box(inst);
            inst.geom.tuck = null;
            delete inst.geom.ux;
            inst.geom.x = Math.min(Math.max(0, inst.geom.x), Math.max(0, 1 - b.wf));
            inst.geom.y = Math.min(Math.max(0, inst.geom.y), Math.max(0, 1 - b.hf));
            paintNow(inst);
            save(inst);
        };
        el.addEventListener('keydown', onKey);
        inst.cleanups.push(() => el.removeEventListener('keydown', onKey));
    }

    function ensureTab(inst) {
        let tab = inst.el.querySelector('[data-ov-float-tab]');
        if (!tab) {
            tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'ov-float-tab';
            tab.dataset.ovFloatTab = '';
            tab.setAttribute('aria-label', 'Bring it back');
            tab.innerHTML = '<span class="ov-float-tab-l" aria-hidden="true">‹</span><span class="ov-float-tab-r" aria-hidden="true">›</span>';
            inst.el.append(tab);
            inst.ownedTab = tab;
        }
        // A pointer tap already opened it (the gesture's pointerup); the click is a key's, or a tap the gesture missed.
        const onClick = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (performance.now() - (inst.untuckedAt || 0) < 700) return;
            untuck(inst);
        };
        tab.addEventListener('click', onClick);
        inst.cleanups.push(() => tab.removeEventListener('click', onClick));
    }

    function ensureResize(inst) {
        let handle = inst.el.querySelector('[data-ov-float-resize]');
        if (!handle) {
            handle = document.createElement('span');
            handle.className = 'ov-float-resize';
            handle.dataset.ovFloatResize = '';
            handle.setAttribute('aria-hidden', 'true');
            inst.el.append(handle);
            inst.ownedResize = handle;
        }
        let start = null;
        const onDown = (e) => {
            if (e.button > 0) return;
            start = { px: e.clientX, py: e.clientY, width: inst.el.getBoundingClientRect().width };
            inst.touched = true;
            inst.el.classList.add('is-resizing');
            try { handle.setPointerCapture(e.pointerId); } catch { /* */ }
            e.preventDefault();
            e.stopPropagation();
        };
        const onMove = (e) => {
            if (!start || !start.width) return;
            // The handle's diagonal pull is the box's own width; past its frame it floats and keeps growing.
            const pull = inst.aspect ? ((e.clientX - start.px) + (e.clientY - start.py) * inst.aspect) / 2 : (e.clientX - start.px);
            if (sizeTo(inst, Math.max(1, start.width + pull))) { try { handle.setPointerCapture(e.pointerId); } catch { /* */ } }
        };
        const end = (e) => {
            if (!start) return;
            start = null;
            inst.el.classList.remove('is-resizing');
            try { handle.releasePointerCapture(e.pointerId); } catch { /* */ }
            settleInst(inst);
            paintNow(inst);
            save(inst);
        };
        handle.addEventListener('pointerdown', onDown);
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
        inst.cleanups.push(() => {
            handle.removeEventListener('pointerdown', onDown);
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
        });
    }

    function wireWindow(inst) {
        // A turn of the phone, a keyboard, the address bar or a new window size: back inside, once a frame.
        let queued = 0;
        const onResize = () => {
            if (queued) return;
            queued = requestAnimationFrame(() => { queued = 0; relayout(inst); });
        };
        const vv = root.visualViewport;
        root.addEventListener('resize', onResize);
        root.addEventListener('orientationchange', onResize);
        if (vv && vv.addEventListener) vv.addEventListener('resize', onResize);
        document.addEventListener('fullscreenchange', onResize);
        let ro = null;
        if (typeof ResizeObserver === 'function') {
            ro = new ResizeObserver(onResize);
            if (inst.frame) ro.observe(inst.frame);
            ro.observe(inst.el);
        }
        inst.cleanups.push(() => {
            if (queued) cancelAnimationFrame(queued);
            root.removeEventListener('resize', onResize);
            root.removeEventListener('orientationchange', onResize);
            if (vv && vv.removeEventListener) vv.removeEventListener('resize', onResize);
            document.removeEventListener('fullscreenchange', onResize);
            try { ro && ro.disconnect(); } catch { /* */ }
        });
    }

    /* ── public API ───────────────────────────────────────────────────────────────────────────────────────── */

    function attach(el, options) {
        if (!el || typeof el !== 'object' || !el.classList) throw new TypeError('OVFloat.attach(el, options): el is required');
        const o = options || {};
        const frame = o.frame || null;
        const key = String(o.key || `ov-float-${++uid}`);
        const minW = clamp(o.minW == null ? MIN_W : o.minW, 0, 1, MIN_W);
        const maxW = clamp(o.maxW == null ? MAX_W : o.maxW, minW, 1, MAX_W);
        const defaults = normalizeDefaults(o.defaults, !!frame);
        const inst = {
            el, frame, key,
            accountKey: o.accountKey == null ? key : String(o.accountKey),
            options: o, defaults, minW, maxW,
            aspect: o.aspect === null ? null : (typeof o.aspect === 'function' ? Number(o.aspect()) || BASE : (Number(o.aspect) > 0 ? Number(o.aspect) : BASE)),
            minPx: Number(o.minPx) > 0 ? Number(o.minPx) : MIN_PX,
            store: o.store === null ? null : (o.store || root.OVFloat.store || null),
            geom: null, touched: false, destroyed: false, cleanups: [], landTimer: 0, ownedTab: null, ownedResize: null, api: null,
        };
        const local = readSaved(key, o.legacyKeys);
        inst.hadLocal = !!local;
        inst.geom = normalize(local, defaults, { hasFrame: !!frame, minW, maxW });
        injectStyles();
        el.classList.add('ov-float');
        if (o.tab !== false) ensureTab(inst);
        if (o.resize !== false) ensureResize(inst);
        wireMove(inst);
        wireKeys(inst);
        wireWindow(inst);
        placeIn(inst);
        paintNow(inst);

        inst.api = {
            el, key,
            geom: () => Object.assign({}, inst.geom),
            set(patch, opts) {
                Object.assign(inst.geom, patch || {});
                if (opts && opts.settle) settleInst(inst);
                placeIn(inst);
                paintNow(inst);
                if (opts && opts.save) save(inst);
                return Object.assign({}, inst.geom);
            },
            setAspect(a) {
                inst.aspect = a === null ? null : (Number(a) > 0 ? Number(a) : BASE);
                paintNow(inst);
            },
            metrics: () => box(inst),
            sizeTo: (px) => sizeTo(inst, px),
            paint: () => paintNow(inst),
            settle: () => { settleInst(inst); paintNow(inst); return Object.assign({}, inst.geom); },
            save: () => save(inst),
            tuck: (side) => tuck(inst, side),
            untuck: () => untuck(inst),
            toggleTuck: () => (inst.geom.tuck ? untuck(inst) : tuck(inst)),
            toggleMode: () => toggleMode(inst),
            toggleSize: () => toggleSize(inst),
            reset: () => reset(inst),
            relayout: () => relayout(inst),
            destroy: () => destroy(inst),
        };
        instances.add(inst);
        syncAccount(inst);
        return inst.api;
    }

    function destroy(inst) {
        if (inst.destroyed) return;
        inst.destroyed = true;
        instances.delete(inst);
        clearTimeout(inst.landTimer);
        if (inst.clipAnim) { try { inst.clipAnim.cancel(); } catch { /* */ } }
        for (const fn of inst.cleanups) { try { fn(); } catch { /* */ } }
        inst.cleanups = [];
        if (inst.ownedTab) { try { inst.ownedTab.remove(); } catch { /* */ } }
        if (inst.ownedResize) { try { inst.ownedResize.remove(); } catch { /* */ } }
        inst.el.classList.remove('ov-float', 'is-floating', 'is-lifted', 'is-dragging', 'is-tucked', 'is-tucked-left', 'is-tucked-right', 'is-resizing', 'is-active');
    }

    function injectStyles() {
        if (document.getElementById('ov-float-styles')) return;
        const st = document.createElement('style');
        st.id = 'ov-float-styles';
        st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
    }

    const defaultStore = makeDefaultStore();
    root.OVFloat = {
        attach,
        store: defaultStore,
        newStore: makeDefaultStore,
        layout: () => [...instances].map((i) => ({ key: i.key, geom: Object.assign({}, i.geom), el: i.el })),
        _test: {
            boxOf, settle: settleGeom, flick, tuckFor, overFrame, paint, normalize,
            BASE, MAX_H, FLOAT_MAX_H, MIN_W, MAX_W, EDGE_PX, SNAP, PROJECT_MS, TAB_H, placeOf,
        },
    };
})(typeof window !== 'undefined' ? window : globalThis);
