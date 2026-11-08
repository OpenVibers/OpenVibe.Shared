/**
 * OpenVibe overlays (Shared 4.152.0): small floating surfaces that stay with a person across pages and across OpenVibe
 * sites: a live channel's picture, a chat, an agent at work, a Codes task. The owner, 11-08: "move and resize it like
 * YouTube on Android", "a chat button for the room", "make it work across sites", "an SDK any site, agent, Vibe chat
 * or Codes can use".
 *
 *   OVOverlay.open({ id, src, title, href, live, side: { title, src }, aspect, w, corner, portable })  → handle
 *     src       a first-party https URL drawn in a sandboxed frame (Live's /embed/<name>, a chat room, an agent)
 *     title     shown on the card; href: where "open" goes (the full page); live: the LIVE badge
 *     side      a second frame the card's chat button opens beside it (a sheet above the app bar on a phone)
 *     portable  (default true) it follows the person to another OpenVibe site they open from a link
 *   OVOverlay.close(id) · OVOverlay.list() · OVOverlay.declare(id, descriptor | null)
 *     declare: a page that draws its own floating player (Live's mini player moves its <video>) says what to open on
 *     the next site, without this file drawing anything here.
 *   window.OVOverlayHere = (card) => boolean: a page that already shows what a carried card would (Live's channel page
 *     for its own embed) answers true, and that card is not opened on arrival.
 *
 * Handling (one gesture set for every card): drag anywhere and it settles in the nearest corner, a flick carries it;
 * more than half off the side, or a sideways throw past the edge, closes it; the grip on its inner corner (mouse),
 * two fingers or a double tap resize it; a tap shows its controls (a mouse hover always does). It sits between the
 * navbar and the phone's app bar, never under either. Corner and size are kept per card kind on this device.
 *
 * Across sites: while a portable card is open (or declared), a same-tab click on a link to another OpenVibe site adds
 * `#ovo=<data>` to it; the next site's navbar sees it, loads this file and opens the same cards (the hash never
 * reaches a server, and is removed from the address at once). Only first-party https sources are ever opened: the
 * hosts below, checked again on arrival. Within one site the cards come back after a reload (sessionStorage).
 */
(function (root) {
    'use strict';
    if (!root || root.OVOverlay || typeof document === 'undefined') return;

    // Every source a card may frame, and every site a card may follow the person to.
    const FIRST_PARTY = /^(?:[a-z0-9-]+\.)*openvibe\.(?:live|chat|actor|codes|network|games|video|design|report|my|link|computer|tools|services|space|community|news|wiki|blog|mail|email|events|help|quest|rent|work|food|host|deals|coupons|trade|tips|vip|zone|run|search|today|surf|meme|vision|exchange|fun|cam|casino|tours|shoes|connect|media|pics|download|domains|studio|party|locker|watch|bot|inventory)$/;
    const KEY = 'ov-overlay';
    const MAX_CARDS = 3;
    const cards = new Map();      // id → card
    const declared = new Map();   // id → descriptor (drawn by the page itself)
    let styleEl = null, clicksWired = false;

    const reduced = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
    const phone = () => { try { return root.matchMedia('(max-width: 759px)').matches; } catch { return false; } };
    const fine = () => { try { return root.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };

    /** A first-party https URL, or null. */
    function safeSrc(u) {
        try {
            const url = new URL(String(u || ''), root.location.href);
            if (url.protocol !== 'https:' && !(url.origin === root.location.origin && /^https?:$/.test(url.protocol))) return null;
            if (url.origin !== root.location.origin && !FIRST_PARTY.test(url.hostname)) return null;
            return url.href;
        } catch { return null; }
    }
    const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, '').slice(0, n);

    /** A descriptor as it may travel: only these fields, every URL checked. */
    function portableOf(d) {
        const src = safeSrc(d && d.src);
        if (!src) return null;
        const out = { id: clean(d.id || 'card', 40).replace(/[^a-z0-9_-]/gi, '') || 'card', src, title: clean(d.title, 80), live: !!d.live };
        const href = safeSrc(d.href); if (href) out.href = href;
        const side = d.side && safeSrc(d.side.src); if (side) out.side = { src: side, title: clean(d.side.title, 80) };
        if (Number(d.aspect) > 0.3 && Number(d.aspect) < 4) out.aspect = Number(d.aspect);
        return out;
    }

    const ICON = {
        chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
        open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9.5l5 5M22 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
        grip: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13L13 3M8 13l5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    };

    function styles() {
        if (styleEl) return;
        styleEl = document.createElement('style');
        styleEl.id = 'ov-overlay-style';
        styleEl.textContent = `
.ovo-card{position:fixed;left:0;top:0;z-index:9980;width:var(--ovo-w,320px);aspect-ratio:var(--ovo-ar,16/9);border-radius:14px;overflow:hidden;background:#000;
  transform:translate3d(var(--ovo-x,0px),var(--ovo-y,0px),0);box-shadow:0 18px 44px -12px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.1);
  touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:grab;will-change:transform}
.ovo-card.is-settling{transition:transform .34s cubic-bezier(.2,.8,.2,1),width .34s cubic-bezier(.2,.8,.2,1),opacity .25s}
.ovo-card.is-dragging{cursor:grabbing;box-shadow:0 26px 60px -14px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.16)}
.ovo-card.is-leaving{opacity:.35}
.ovo-card.is-entering{opacity:0;transform:translate3d(var(--ovo-x,0px),calc(var(--ovo-y,0px) + 16px),0) scale(.96)}
.ovo-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;pointer-events:none}
.ovo-card.is-live-input .ovo-frame{pointer-events:auto}
.ovo-ui{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;opacity:0;transition:opacity .2s;background:linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,0) 42%,rgba(0,0,0,0) 58%,rgba(0,0,0,.55))}
.ovo-card.is-ui .ovo-ui{opacity:1}
@media (hover:hover) and (pointer:fine){.ovo-card:hover .ovo-ui{opacity:1}}
.ovo-top,.ovo-row{display:flex;align-items:center;gap:6px;padding:7px 8px}
.ovo-live{flex:none;display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:999px;background:#e5484d;color:#fff;font:800 10px/1.6 system-ui,sans-serif;letter-spacing:.06em}
.ovo-live::before{content:'';width:6px;height:6px;border-radius:50%;background:#fff}
.ovo-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font:700 12.5px/1.3 system-ui,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.ovo-row{justify-content:flex-end}
.ovo-b{flex:none;display:inline-grid;place-items:center;width:34px;height:34px;border:0;border-radius:999px;background:rgba(20,22,30,.55);color:#fff;cursor:pointer;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:background-color .15s,transform .15s}
.ovo-b svg{width:18px;height:18px}
.ovo-b:hover{background:rgba(255,255,255,.24)}
.ovo-b:active{transform:scale(.9)}
.ovo-b:focus-visible{outline:2px solid #fff;outline-offset:1px}
.ovo-b[aria-pressed="true"]{background:#fff;color:#0b0f19}
.ovo-x{width:28px;height:28px}
.ovo-x svg{width:15px;height:15px}
.ovo-grip{position:absolute;width:26px;height:26px;display:grid;place-items:center;color:rgba(255,255,255,.85);cursor:nwse-resize;opacity:0;transition:opacity .2s}
.ovo-grip svg{width:14px;height:14px}
.ovo-card:hover .ovo-grip{opacity:1}
.ovo-card[data-corner="br"] .ovo-grip{left:0;top:0;transform:rotate(180deg)}
.ovo-card[data-corner="bl"] .ovo-grip{right:0;top:0;transform:rotate(270deg);cursor:nesw-resize}
.ovo-card[data-corner="tr"] .ovo-grip{left:0;bottom:0;transform:rotate(90deg);cursor:nesw-resize}
.ovo-card[data-corner="tl"] .ovo-grip{right:0;bottom:0}
@media (hover:none){.ovo-grip{display:none}}
.ovo-side{position:fixed;z-index:9979;display:flex;flex-direction:column;overflow:hidden;border-radius:16px;background:var(--bg-card,#101624);
  box-shadow:0 20px 48px -14px rgba(0,0,0,.65),0 0 0 1px var(--border,rgba(255,255,255,.12));opacity:0;transform:translateY(10px) scale(.98);transform-origin:var(--ovo-origin,100% 100%);
  transition:opacity .22s,transform .3s cubic-bezier(.2,.8,.2,1)}
.ovo-side.is-open{opacity:1;transform:none}
.ovo-side-h{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 14px;border-bottom:1px solid var(--border,rgba(255,255,255,.1));color:var(--text-primary,#e6edf7);font:700 13px/1.3 system-ui,sans-serif}
.ovo-side-h span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ovo-side-h .ovo-b{background:transparent;color:inherit;width:30px;height:30px}
.ovo-side-h .ovo-b:hover{background:rgba(127,127,127,.18)}
.ovo-side iframe{flex:1;width:100%;border:0;background:transparent}
@media (prefers-reduced-motion:reduce){.ovo-card.is-settling,.ovo-side{transition:none}.ovo-card.is-entering{transform:translate3d(var(--ovo-x,0px),var(--ovo-y,0px),0)}}
`;
        (document.head || document.documentElement).appendChild(styleEl);
    }

    // ── Where a card may sit: between the navbar and the phone's app bar ──
    function bounds() {
        const nav = document.querySelector('.openvibe-navbar');
        const nr = nav ? nav.getBoundingClientRect() : null;
        const top = Math.max(8, nr && nr.bottom > 0 ? nr.bottom + 8 : 64);
        const bar = document.querySelector('.ovnav-appbar');
        const barH = bar ? bar.getBoundingClientRect().height : 0;
        const m = phone() ? 10 : 16;
        return { left: m, right: root.innerWidth - m, top, bottom: root.innerHeight - barH - m };
    }
    const heightOf = (c, w) => Math.round(w / c.aspect);
    function clampW(w) {
        const min = phone() ? 160 : 220, max = Math.min(phone() ? root.innerWidth - 20 : 640, root.innerWidth * (phone() ? 0.94 : 0.6));
        return Math.round(Math.max(min, Math.min(max, w)));
    }
    function cornerXY(c, corner, w) {
        const b = bounds(), h = heightOf(c, w);
        return { x: corner[1] === 'l' ? b.left : b.right - w, y: corner[0] === 't' ? b.top : Math.max(b.top, b.bottom - h) };
    }
    function place(c, x, y, w, settle) {
        c.x = x; c.y = y; c.w = w;
        c.el.classList.toggle('is-settling', !!settle && !reduced());
        c.el.style.setProperty('--ovo-w', `${w}px`);
        c.el.style.setProperty('--ovo-x', `${Math.round(x)}px`);
        c.el.style.setProperty('--ovo-y', `${Math.round(y)}px`);
        placeSide(c);
    }
    function settle(c, corner, w) {
        c.corner = corner;
        c.el.setAttribute('data-corner', corner);
        const p = cornerXY(c, corner, w);
        place(c, p.x, p.y, w, true);
        try { localStorage.setItem(`${KEY}:${c.kindKey}`, JSON.stringify({ corner, w })); } catch { /* private mode */ }
    }
    function nearest(c, x, y, w) {
        const b = bounds(), h = heightOf(c, w);
        return `${y + h / 2 < (b.top + b.bottom) / 2 ? 't' : 'b'}${x + w / 2 < (b.left + b.right) / 2 ? 'l' : 'r'}`;
    }
    function freeCorner(want, self) {
        const used = new Set([...cards.values()].filter((c) => c !== self).map((c) => c.corner));
        if (!used.has(want)) return want;
        return ['br', 'bl', 'tr', 'tl'].find((k) => !used.has(k)) || want;
    }
    function showUi(c) {
        c.el.classList.add('is-ui');
        clearTimeout(c.idle);
        c.idle = setTimeout(() => { if (!c.el.matches(':focus-within')) c.el.classList.remove('is-ui'); }, 3200);
    }

    // ── One gesture set: drag (a flick carries it, off the side closes it), pinch and the grip resize, double tap ──
    function wire(c) {
        const box = c.el, pts = new Map(), vel = [];
        const capture = (id) => { try { box.setPointerCapture(id); } catch { /* a pointer the browser no longer tracks */ } };
        let drag = null, pinch = null, grip = null, lastTap = 0;
        box.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.ovo-b')) return;
            if (e.target.closest('.ovo-grip')) { grip = { x: e.clientX, w: c.w }; capture(e.pointerId); e.preventDefault(); return; }
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            capture(e.pointerId);
            if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, w: c.w }; drag = null; return; }
            drag = { sx: e.clientX, sy: e.clientY, x: c.x, y: c.y, moved: false };
            vel.length = 0;
        });
        box.addEventListener('pointermove', (e) => {
            if (grip) { const w = clampW(grip.w + (e.clientX - grip.x) * (c.corner[1] === 'r' ? -1 : 1)); const p = cornerXY(c, c.corner, w); place(c, p.x, p.y, w, false); return; }
            if (!pts.has(e.pointerId)) return;
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch && pts.size === 2) {
                const [a, b] = [...pts.values()];
                const w = clampW(pinch.w * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
                const cx = c.x + c.w / 2, cy = c.y + heightOf(c, c.w) / 2;
                place(c, cx - w / 2, cy - heightOf(c, w) / 2, w, false);
                return;
            }
            if (!drag) return;
            const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
            if (!drag.moved && Math.hypot(dx, dy) < 6) return;
            if (!drag.moved) { drag.moved = true; box.classList.add('is-dragging'); }
            vel.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (vel.length > 6) vel.shift();
            place(c, drag.x + dx, drag.y + dy, c.w, false);
            const b = bounds();
            box.classList.toggle('is-leaving', c.x + c.w < b.left + c.w * 0.45 || c.x > b.right - c.w * 0.55);
        });
        const end = (e) => {
            if (grip) { grip = null; settle(c, c.corner, c.w); return; }
            pts.delete(e.pointerId);
            if (pinch) { if (pts.size < 2) { pinch = null; settle(c, nearest(c, c.x, c.y, c.w), c.w); } return; }
            if (!drag) return;
            const d = drag; drag = null;
            box.classList.remove('is-dragging');
            if (!d.moved) {
                const now = performance.now();
                if (now - lastTap < 300) { lastTap = 0; const big = c.w < clampW(phone() ? root.innerWidth : 520) * 0.8; settle(c, c.corner, clampW(big ? (phone() ? root.innerWidth - 20 : 520) : (phone() ? 200 : 320))); return; }
                lastTap = now;
                if (box.classList.contains('is-ui') && !fine()) { box.classList.remove('is-ui'); clearTimeout(c.idle); } else showUi(c);
                return;
            }
            let vx = 0, vy = 0;
            if (vel.length > 1) { const a = vel[0], z = vel[vel.length - 1]; const dt = Math.max(1, z.t - a.t); vx = (z.x - a.x) / dt; vy = (z.y - a.y) / dt; }
            const b = bounds(), tdx = c.x - d.x, tdy = c.y - d.y;
            const sideways = Math.abs(vx) > 1.2 && Math.abs(vx) > Math.abs(vy) * 1.5 && Math.abs(tdx) > Math.abs(tdy) * 2;
            const off = c.x + c.w < b.left + c.w * 0.45 || c.x > b.right - c.w * 0.55
                || (sideways && vx > 0 && c.x + c.w > b.right + c.w * 0.15) || (sideways && vx < 0 && c.x < b.left - c.w * 0.15);
            if (off) { flyOff(c, vx >= 0 || c.x > b.right - c.w ? 1 : -1); return; }
            box.classList.remove('is-leaving');
            settle(c, nearest(c, c.x + vx * 180, c.y + vy * 180, c.w), c.w);
        };
        box.addEventListener('pointerup', end);
        box.addEventListener('pointercancel', end);
        box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(c.id); });
    }
    function flyOff(c, dir) {
        c.el.classList.remove('is-dragging');
        if (reduced()) { close(c.id); return; }
        c.el.classList.add('is-settling', 'is-leaving');
        c.el.style.setProperty('--ovo-x', `${dir > 0 ? root.innerWidth + 20 : -c.w - 20}px`);
        setTimeout(() => close(c.id), 300);
    }

    // ── The side frame (a chat beside the picture; a sheet above the app bar on a phone) ──
    function toggleSide(c, force) {
        const open = force != null ? force : !c.side;
        const btn = c.el.querySelector('[data-ovo="side"]');
        if (!open) {
            const s = c.side; c.side = null;
            if (btn) btn.setAttribute('aria-pressed', 'false');
            if (s) { s.classList.remove('is-open'); setTimeout(() => s.remove(), reduced() ? 0 : 260); if (cards.has(c.id)) settle(c, c.corner, c.w); }
            return;
        }
        if (c.side || !c.d.side) return;
        const s = document.createElement('section');
        s.className = 'ovo-side';
        s.setAttribute('aria-label', c.d.side.title || `${c.d.title} chat`);
        const h = document.createElement('div'); h.className = 'ovo-side-h';
        const t = document.createElement('span'); t.textContent = c.d.side.title || `${c.d.title} · chat`;
        const x = button('Close', ICON.close, () => toggleSide(c, false));
        h.append(t, x);
        const f = frame(c.d.side.src, c.d.side.title || 'Chat');
        f.style.pointerEvents = 'auto';
        s.append(h, f);
        document.body.appendChild(s);
        c.side = s;
        if (btn) btn.setAttribute('aria-pressed', 'true');
        placeSide(c);
        if (phone()) { const r = s.getBoundingClientRect(), b = bounds(); place(c, c.corner[1] === 'l' ? b.left : b.right - c.w, Math.max(b.top, r.top - heightOf(c, c.w) - 8), c.w, true); }
        requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('is-open')));
    }
    function placeSide(c) {
        const s = c.side; if (!s) return;
        const b = bounds(), h = heightOf(c, c.w);
        if (phone()) {
            const sh = Math.round(Math.min(root.innerHeight * 0.55, b.bottom - b.top - h - 12));
            Object.assign(s.style, { left: '8px', right: '8px', width: 'auto', top: 'auto', bottom: `${root.innerHeight - b.bottom}px`, height: `${sh}px` });
            s.style.setProperty('--ovo-origin', '50% 100%');
            return;
        }
        const w = Math.max(320, c.w), sh = Math.min(460, b.bottom - b.top - 10);
        const left = Math.min(Math.max(b.left, c.corner[1] === 'r' ? c.x + c.w - w : c.x), b.right - w);
        const above = c.corner[0] === 'b';
        const top = above ? Math.max(b.top, c.y - sh - 10) : Math.min(c.y + h + 10, b.bottom - sh);
        Object.assign(s.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${sh}px`, right: 'auto', bottom: 'auto' });
        s.style.setProperty('--ovo-origin', `${c.corner[1] === 'r' ? '100%' : '0%'} ${above ? '100%' : '0%'}`);
    }

    function button(label, icon, fn, cls) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = `ovo-b${cls ? ` ${cls}` : ''}`;
        b.setAttribute('aria-label', label); b.title = label; b.innerHTML = icon;
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
        return b;
    }
    function frame(src, title) {
        const f = document.createElement('iframe');
        f.className = 'ovo-frame';
        f.src = src;
        f.title = title || 'OpenVibe';
        f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
        f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
        f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        return f;
    }

    // ── Opening and closing ──
    function open(desc) {
        const d = portableOf(desc);
        if (!d) return null;
        d.portable = desc.portable !== false;
        if (cards.has(d.id)) { const c = cards.get(d.id); showUi(c); return handle(c); }
        if (cards.size >= MAX_CARDS) close(cards.keys().next().value);
        styles();
        wireClicks();
        const el = document.createElement('div');
        el.className = 'ovo-card is-entering';
        el.id = `ovo-${d.id}`;
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', `${d.title || 'OpenVibe'}${d.live ? ', live' : ''}, floating`);
        const c = { id: d.id, d, el, x: 0, y: 0, w: 0, corner: 'br', side: null, idle: 0, aspect: d.aspect || 16 / 9, kindKey: new URL(d.src).hostname.split('.').slice(-2).join('.') };
        el.style.setProperty('--ovo-ar', String(c.aspect));
        const ui = document.createElement('div'); ui.className = 'ovo-ui';
        const top = document.createElement('div'); top.className = 'ovo-top';
        if (d.live) { const l = document.createElement('span'); l.className = 'ovo-live'; l.textContent = 'LIVE'; top.appendChild(l); }
        const name = document.createElement('span'); name.className = 'ovo-name'; name.textContent = d.title || '';
        top.append(name, button('Close', ICON.close, () => close(c.id), 'ovo-x'));
        const row = document.createElement('div'); row.className = 'ovo-row';
        // A player that speaks the embed messages (Live's /embed/<name>): its sound, and its state back (title, live, muted).
        const embed = /^\/embed\//.test(new URL(d.src).pathname);
        if (embed) {
            const snd = button('Turn the sound on', ICON.muted, () => {
                const f = el.querySelector('.ovo-frame');
                try { f.contentWindow.postMessage({ type: 'ov-embed', cmd: c.muted === false ? 'mute' : 'unmute' }, new URL(d.src).origin); } catch { /* */ }
                showUi(c);
            });
            snd.setAttribute('data-ovo', 'sound');
            row.appendChild(snd);
        }
        if (d.side) { const s = button('Chat', ICON.chat, () => { toggleSide(c); showUi(c); }); s.setAttribute('data-ovo', 'side'); s.setAttribute('aria-pressed', 'false'); row.appendChild(s); }
        if (d.href) row.appendChild(button('Open the full page', ICON.open, () => { root.location.href = d.href; }));
        ui.append(top, row);
        const grip = document.createElement('span'); grip.className = 'ovo-grip'; grip.innerHTML = ICON.grip; grip.setAttribute('aria-hidden', 'true');
        el.append(frame(d.src, d.title), ui, grip);
        document.body.appendChild(el);
        cards.set(c.id, c);
        let pref = null; try { pref = JSON.parse(localStorage.getItem(`${KEY}:${c.kindKey}`) || 'null'); } catch { /* */ }
        const corner = freeCorner(desc.corner || (pref && /^[tb][lr]$/.test(pref.corner) ? pref.corner : 'br'), c);
        const w = clampW(desc.w || (pref && pref.w) || (phone() ? Math.min(240, root.innerWidth * 0.56) : 360));
        const p = cornerXY(c, corner, w);
        c.corner = corner; el.setAttribute('data-corner', corner);
        place(c, p.x, p.y, w, false);
        void el.offsetWidth;                      // the entering style is drawn once; dropping it now plays the entrance
        el.classList.add('is-settling');
        el.classList.remove('is-entering');
        wire(c);
        if (!fine()) showUi(c);
        remember();
        return handle(c);
    }
    function handle(c) {
        return { id: c.id, close: () => close(c.id), el: c.el, update: (u) => { if (u && u.title != null) { c.d.title = clean(u.title, 80); const n = c.el.querySelector('.ovo-name'); if (n) n.textContent = c.d.title; remember(); } } };
    }
    function close(id) {
        const c = cards.get(id); if (!c) return;
        toggleSide(c, false);
        cards.delete(id);
        clearTimeout(c.idle);
        try { c.el.remove(); } catch { /* */ }
        remember();
    }
    function list() { return [...cards.values()].map((c) => ({ ...c.d })); }
    function declare(id, desc) {
        const key = clean(id, 40);
        if (!desc) declared.delete(key); else { const d = portableOf({ ...desc, id: key }); if (d) declared.set(key, d); }
        if (declared.size) wireClicks();
    }

    // ── Within a site: the cards come back after a reload ──
    function remember() {
        try {
            const keep = [...cards.values()].filter((c) => c.d.portable).map((c) => portableOf(c.d)).filter(Boolean);
            if (keep.length) sessionStorage.setItem(KEY, JSON.stringify(keep)); else sessionStorage.removeItem(KEY);
        } catch { /* private mode */ }
    }

    // ── Across sites: a link to another OpenVibe site carries the cards in its hash ──
    const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const unb64 = (s) => decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/'))));
    function travelling() {
        const out = [...cards.values()].filter((c) => c.d.portable).map((c) => portableOf(c.d));
        for (const d of declared.values()) out.push(d);
        return out.filter(Boolean).slice(0, MAX_CARDS);
    }
    function handoffUrl(href) {
        const list = travelling();
        if (!list.length) return href;
        try {
            const u = new URL(href, root.location.href);
            if (u.origin === root.location.origin || u.protocol !== 'https:' || !FIRST_PARTY.test(u.hostname)) return href;
            const data = b64(JSON.stringify(list));
            if (data.length > 3000) return href;
            u.hash = `ovo=${data}`;
            return u.href;
        } catch { return href; }
    }
    function wireClicks() {
        if (clicksWired) return;
        clicksWired = true;
        document.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = e.target && e.target.closest && e.target.closest('a[href]');
            if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
            const next = handoffUrl(a.href);
            if (next !== a.href) a.href = next;     // the browser follows the link as it was going to, with the cards
        }, true);
    }
    /** On arrival: open the cards a link carried here, then take the hash out of the address. */
    function restore() {
        const m = /(?:^#|&)ovo=([A-Za-z0-9_-]{1,3000})/.exec(root.location.hash || '');
        let list = null;
        if (m) {
            try { list = JSON.parse(unb64(m[1])); } catch { list = null; }
            try { const u = new URL(root.location.href); u.hash = ''; root.history.replaceState(root.history.state, '', u.href.replace(/#$/, '')); } catch { /* */ }
        } else {
            try { list = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { list = null; }
        }
        if (!Array.isArray(list)) return 0;
        // A page that plays the same thing itself says so (window.OVOverlayHere = (card) => true): Live's channel page
        // for a card that frames its own embed, so one stream never plays twice.
        const here = typeof root.OVOverlayHere === 'function' ? root.OVOverlayHere : null;
        let n = 0;
        for (const d of list.slice(0, MAX_CARDS)) {
            let skip = false; try { skip = !!(here && here({ ...d })); } catch { skip = false; }
            if (!skip && open(d)) n += 1;
        }
        return n;
    }

    root.addEventListener('message', (e) => {
        const m = e.data;
        if (!m || m.type !== 'ov-embed' || m.event !== 'state') return;
        for (const c of cards.values()) {
            const f = c.el.querySelector('.ovo-frame');
            if (!f || e.source !== f.contentWindow || e.origin !== new URL(c.d.src).origin) continue;
            c.muted = !!m.muted;
            const b = c.el.querySelector('[data-ovo="sound"]');
            if (b) { b.innerHTML = c.muted ? ICON.muted : ICON.sound; b.setAttribute('aria-label', c.muted ? 'Turn the sound on' : 'Mute'); b.title = b.getAttribute('aria-label'); }
            if (typeof m.title === 'string' && m.title && !c.d.title) handle(c).update({ title: m.title });
            const live = c.el.querySelector('.ovo-live'); if (live) live.hidden = m.live === false;
        }
    });
    root.addEventListener('resize', () => { for (const c of cards.values()) settle(c, c.corner, clampW(c.w)); });
    root.OVOverlay = { open, close, list, declare, handoffUrl, restore, safeSrc, _travelling: travelling };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore, { once: true }); else restore();
})(typeof window !== 'undefined' ? window : null);
