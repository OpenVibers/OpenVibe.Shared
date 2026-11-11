/* purse.js — the balances in the bar as one pill (4.189.0). The owner, 2026-11-10: "we just show one, but it can
   animate between all three, especially when you spend some … first load it should scroll through them all, or every once
   in a while … a custom animation for gaining and losing, with coins coming out of it … nice icons that are animated,
   designed for the three currencies … it only needs to show the things you have."

   navbar.js draws the pill (#openvibe-chips-all: one .ovnav-chip-mini per balance the person has, the first one showing)
   and loads this file beside itself. This file gives each currency its own drawn icon, rolls the pill through the
   balances on the first page of a visit and now and then after, and, when a balance changes, turns to it, counts the
   number up or down and sends a few of its pieces in or out. catchUp reads the person's change window.

   OpenVibePurse.mount(button)   the pill, after each draw of the bar
   OpenVibePurse.set(id, value)  a balance changed ('coins', '1,234')
   OpenVibePurse.icon(id, size)  the currency's icon as SVG text ('coins' | 'vibes' | 'balance'), for other surfaces
   OpenVibePurse.play(id, delta) the gain or spend effect at the bar's pill
   OpenVibePurse.burst(el, id, delta)        the same effect at any element: a buy button, a card, a tip
   OpenVibePurse.count(el, from, to, format) count a number from one value to another
   A holder with data-purse="coins|vibes|balance" has the currency's colour as --pc; .ovp-play plays its icon's move. */
(function (root) {
    'use strict';
    if (!root || !root.document || root.OpenVibePurse) return;
    const doc = root.document;
    const svg = (size, body) => `<svg class="ovp-ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
    // Each icon: the currency's colour as its body (--pc), the detail cut in a darker mix of it, one light edge.
    const ICONS = {
        // OpenCoins: a coin with the network's ring struck in it.
        coins: '<g class="ovp-spin"><circle cx="12" cy="12" r="9.6" fill="var(--pc)"/><circle cx="12" cy="12" r="9.6" fill="none" stroke="var(--pd)" stroke-width="1.3" opacity=".55"/><circle cx="12" cy="12" r="4.4" fill="none" stroke="var(--pd)" stroke-width="2.5"/><path d="M5.6 9.2a7 7 0 0 1 4.6-4.1" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".7"/></g>',
        // Vibes: a cut gem (bought, then given).
        vibes: '<g class="ovp-gem"><path d="M7.2 3.6h9.6l4.4 5.6L12 21 2.8 9.2z" fill="var(--pc)" stroke="var(--pc)" stroke-width="1.6" stroke-linejoin="round"/><path d="M2.8 9.2h18.4M8.9 9.2 12 20.4l3.1-11.2M7.2 3.6l1.7 5.6L12 3.6l3.1 5.6 1.7-5.6" fill="none" stroke="var(--pd)" stroke-width="1.25" stroke-linejoin="round" opacity=".8"/><path class="ovp-glint" d="M6.3 7.3 8 5.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".75"/></g>',
        // The money balance: a note with a round seal.
        balance: '<g class="ovp-note"><rect x="2.2" y="5.6" width="19.6" height="12.8" rx="3.2" fill="var(--pc)"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="var(--pd)" stroke-width="2.1"/><path d="M5.6 9.2v.01M18.4 14.8v.01" stroke="var(--pd)" stroke-width="2.2" stroke-linecap="round"/><path d="M5 8.4h3.4" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".6"/></g>',
        'channel-points': '<path d="m12 2.5 2.8 6.6 7.1.6-5.4 4.7 1.7 7-6.2-3.7-6.2 3.7 1.7-7-5.4-4.7 7.1-.6z" fill="var(--pc)" stroke="var(--pd)" stroke-width="1.2"/>',
    };
    const CSS = `
[data-purse], .ovnav-chip-mini, .ovp-bit, .ovp-delta, .ovp-icw { --pc: var(--text-secondary, #a8b3c4); --pd: color-mix(in oklab, var(--pc) 42%, #000); }
/* Each colour leans toward the page's text, so it is brighter on a dark theme and deeper on a light one. */
[data-purse="coins"] { --pc: color-mix(in oklab, #f6b21d 88%, var(--text-primary, #e6edf7)); }
[data-purse="vibes"] { --pc: color-mix(in oklab, #1fc78c 86%, var(--text-primary, #e6edf7)); }
[data-purse="balance"] { --pc: color-mix(in oklab, var(--accent, #3b82f6) 78%, var(--text-primary, #e6edf7)); }
[data-purse="channel-points"] { --pc: color-mix(in oklab, #e899fb 85%, var(--text-primary, #e6edf7)); }
.ovp-ic { display: block; flex: none; overflow: visible; }
.openvibe-navbar .ovnav-chip.ovnav-chip--all.is-purse { height: 32px; padding: 0 3px 0 2px; border-radius: 999px; overflow: hidden; font-size: 13.5px; font-weight: 750; letter-spacing: -.1px; transition: background-color .2s, border-color .3s, box-shadow .3s, transform .15s; }
.openvibe-navbar .ovnav-chip--all.is-purse:active { transform: scale(.95); }
.is-purse .ovnav-chip-mini { gap: 6px; padding: 0 8px 0 5px; font-variant-numeric: tabular-nums; transform: translateY(calc(85% * var(--ov-move, 1))); transition: transform .5s cubic-bezier(.3, 1.35, .45, 1), opacity .28s; }
.is-purse .ovnav-chip-mini.is-on { transform: none; }
.is-purse .ovnav-chip-mini.is-out { transform: translateY(calc(-85% * var(--ov-move, 1))); }
.is-purse .ovnav-chip-mini .ovp-ic { width: 19px; height: 19px; filter: drop-shadow(0 1px 1.5px color-mix(in srgb, var(--pd) 55%, transparent)); }
/* Each icon moves its own way as its balance turns up. */
.is-purse .is-on .ovp-spin { transform-origin: 12px 12px; animation: ovpSpin .7s cubic-bezier(.3, .9, .3, 1) both; }
.is-purse .is-on .ovp-gem { transform-origin: 12px 12px; animation: ovpGem .7s cubic-bezier(.3, 1.4, .4, 1) both; }
.is-purse .is-on .ovp-note { transform-origin: 12px 12px; animation: ovpNote .6s cubic-bezier(.3, 1.3, .4, 1) both; }
.is-purse .is-on .ovp-glint { animation: ovpGlint 2.8s ease-in-out .6s infinite; }
/* Anywhere else: .ovp-play on an icon's holder plays its move once (take the class off and put it back to replay). */
.ovp-play .ovp-spin { transform-origin: 12px 12px; animation: ovpSpin .7s cubic-bezier(.3, .9, .3, 1) both; }
.ovp-play .ovp-gem { transform-origin: 12px 12px; animation: ovpGem .7s cubic-bezier(.3, 1.4, .4, 1) both; }
.ovp-play .ovp-note { transform-origin: 12px 12px; animation: ovpNote .6s cubic-bezier(.3, 1.3, .4, 1) both; }
.ovp-play .ovp-glint { animation: ovpGlint 2.8s ease-in-out .6s infinite; }
@keyframes ovpSpin { from { transform: scaleX(calc(1 - 2 * var(--ov-move, 1))); } 50% { transform: scaleX(calc(1 - .9 * var(--ov-move, 1))); } }
@keyframes ovpGem { from { transform: rotate(calc(-28deg * var(--ov-move, 1))) scale(.6); } }
@keyframes ovpNote { from { transform: translateX(calc(-5px * var(--ov-move, 1))) rotate(calc(-12deg * var(--ov-move, 1))); } }
@keyframes ovpGlint { 0%, 70%, 100% { opacity: .75; } 82% { opacity: .1; } }
/* A balance went up or down: the pill takes that balance's colour for a moment and its icon jumps or dips. */
.openvibe-navbar .ovnav-chip--all.is-purse.is-gain, .openvibe-navbar .ovnav-chip--all.is-purse.is-loss { border-color: color-mix(in srgb, var(--pf, currentColor) 60%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf, currentColor) 16%, transparent); }
.is-purse.is-gain .is-on .ovp-ic { animation: ovpHop .55s cubic-bezier(.3, 1.6, .4, 1); }
.is-purse.is-loss .is-on .ovp-ic { animation: ovpDip .5s ease-out; }
@keyframes ovpHop { 35% { transform: translateY(calc(-4px * var(--ov-move, 1))) scale(1.22); } }
@keyframes ovpDip { 35% { transform: translateY(calc(2px * var(--ov-move, 1))) scale(.84); } }
.ovp-bit, .ovp-delta { position: fixed; z-index: 2147483000; pointer-events: none; left: 0; top: 0; will-change: transform, opacity; }
.ovp-delta { padding: 2px 8px; border-radius: 999px; font: 800 12.5px/1.3 var(--font, system-ui, sans-serif); font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--pc);
  background: color-mix(in srgb, var(--bg-elevated, var(--bg-secondary, #111826)) 92%, var(--pc)); border: 1px solid color-mix(in srgb, var(--pc) 45%, transparent); box-shadow: 0 6px 18px rgba(0, 0, 0, .28); }
@media (max-width: 400px) { .openvibe-navbar .ovnav-chip.ovnav-chip--all.is-purse { font-size: 13px; letter-spacing: -.2px; } .is-purse .ovnav-chip-mini { gap: 4px; padding: 0 6px 0 4px; } .is-purse .ovnav-chip-mini .ovp-ic { width: 17px; height: 17px; } }
:root:root[data-ov-motion=off] .is-purse .ovnav-chip-mini, :root:root[data-ov-motion=off] .is-purse .ovnav-chip-mini * { animation: none !important; transition: none !important; }`;

    const num = (v) => { const s = v == null ? '' : String(v).trim(); if (!/^-?[\d,]+(\.\d+)?$/.test(s)) return null; const n = Number(s.replace(/,/g, '')); return isFinite(n) ? n : null; };
    /** 160774 → "161k" (the same short form the bar writes). */
    function short(n) {
        const a = Math.abs(n);
        if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
        if (a >= 1e4) return `${Math.round(n / 1e3)}k`;
        if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
        return String(Math.round(n));
    }
    const motion = () => { const m = doc.documentElement.getAttribute('data-ov-motion'); return m === 'off' ? 0 : m === 'reduced' ? .35 : 1; };
    const seen = () => { try { return root.sessionStorage.getItem('ovp-toured') === '1'; } catch { return true; } };
    const markSeen = () => { try { root.sessionStorage.setItem('ovp-toured', '1'); } catch { /* a private window: it tours again */ } };

    let btn = null, minis = [], home = 0, at = 0, timers = [], last = {}, busy = false;
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const visible = () => btn && btn.isConnected && !doc.hidden && btn.getClientRects().length > 0;

    function style() {
        if (doc.getElementById('ovp-style')) return;
        const st = doc.createElement('style'); st.id = 'ovp-style'; st.textContent = CSS; doc.head.appendChild(st);
    }
    /** Turn the pill to one balance: the one showing leaves upward, the next comes up from below. */
    function show(i) {
        if (!minis.length) return; i = ((i % minis.length) + minis.length) % minis.length;
        if (i === at && minis[i].classList.contains('is-on')) return;
        const out = minis[at];
        minis.forEach((m) => m.classList.remove('is-out'));
        if (out && out !== minis[i]) { out.classList.remove('is-on'); out.classList.add('is-out'); later(() => out.classList.remove('is-out'), 520); }
        minis[i].classList.add('is-on'); at = i;
    }
    /** Now and then the pill turns to the next balance for a few seconds, then back to the largest. */
    function idle() {
        if (minis.length < 2) return;
        let next = home;
        const tick = () => {
            if (!btn || !btn.isConnected) return;
            if (!busy && visible()) { next = (next + 1) % minis.length; if (next === home) next = (next + 1) % minis.length; show(next); later(() => { if (!busy) show(home); }, 3600); }
            later(tick, 42000);
        };
        later(tick, 42000);
    }
    /** The first page of a visit: each balance in turn, ending on the largest. */
    function tour() {
        if (minis.length < 2 || seen()) return idle();
        markSeen();
        let i = 0;
        const step = () => { if (busy) return idle(); i += 1; if (i < minis.length) { show(i); later(step, 2300); } else { show(home); idle(); } };
        later(step, 2600);
    }
    function mount(el) {
        if (!el || !el.querySelectorAll) return;
        style(); clear(); busy = false;
        btn = el; minis = Array.from(el.querySelectorAll('.ovnav-chip-mini')); home = 0; at = 0; last = {};
        el.classList.add('is-purse');
        minis.forEach((m, i) => {
            const id = m.getAttribute('data-chip-mini');
            last[id] = num(m.getAttribute('data-v'));
            if (ICONS[id]) {
                m.setAttribute('data-purse', id);
                const old = m.querySelector('.ovnav-ic, .ovp-ic'); const holder = doc.createElement('span'); holder.innerHTML = svg(19, ICONS[id]);
                if (old) old.replaceWith(holder.firstChild); else m.insertBefore(holder.firstChild, m.firstChild);
            }
            m.classList.toggle('is-on', i === 0); m.classList.remove('is-out');
        });
        tour();
    }
    /** A few of the currency's pieces: into the pill from below on a gain, out of it and down on a spend. */
    function pieces(id, rect, gain, k, at) {
        if (!ICONS[id] || typeof doc.body.animate !== 'function' || k === 0) return;
        // at: { x, y } where the pieces meet (the pill's icon by default), host: the layer they are drawn in, up: they fly above it.
        const cx = at && at.x != null ? at.x : rect.left + 14, cy = at && at.y != null ? at.y : rect.top + rect.height / 2, n = k < 1 ? 3 : 7, host = (at && at.host) || doc.body, sign = at && at.up ? -1 : 1;
        for (let i = 0; i < n; i += 1) {
            const b = doc.createElement('span'); b.className = 'ovp-bit'; b.setAttribute('data-purse', id); b.innerHTML = svg(13, ICONS[id]);
            host.appendChild(b);
            const spread = ((i / (n - 1)) - .5) * 2, dx = spread * 34 * k + (Math.random() - .5) * 10, dy = sign * (38 + Math.random() * 26) * k, turn = (Math.random() - .5) * 260 * k;
            const far = `translate(${cx - 6 + dx}px, ${cy - 6 + dy}px) rotate(${turn}deg) scale(.9)`, near = `translate(${cx - 6}px, ${cy - 6}px) rotate(0deg) scale(.55)`;
            const mid = `translate(${cx - 6 + dx * .7}px, ${cy - 6 + dy * (gain ? .75 : .25) - (gain ? 0 : 9 * k)}px) rotate(${turn / 2}deg) scale(1)`;
            const frames = gain ? [{ transform: far, opacity: 0 }, { transform: mid, opacity: 1, offset: .3 }, { transform: near, opacity: .9, offset: .92 }, { transform: near, opacity: 0 }]
                : [{ transform: near, opacity: 0 }, { transform: mid, opacity: 1, offset: .28 }, { transform: far, opacity: 0 }];
            const a = b.animate(frames, { duration: gain ? 760 : 900, delay: i * (gain ? 55 : 40), easing: gain ? 'cubic-bezier(.5,0,.3,1)' : 'cubic-bezier(.2,.6,.5,1)', fill: 'both' });
            const done = () => b.remove(); a.onfinish = done; a.oncancel = done; setTimeout(done, 2200);
        }
    }
    /** "+15" or "−200" under the pill: it rises into the pill on a gain and falls away on a spend. */
    function delta(id, rect, d, k, at) {
        if (typeof doc.body.animate !== 'function') return;
        const host = (at && at.host) || doc.body, up = !!(at && at.up);
        const t = doc.createElement('span'); t.className = 'ovp-delta'; t.setAttribute('data-purse', id);
        t.textContent = `${d > 0 ? '+' : '−'}${Math.abs(d) >= 1e4 ? short(Math.abs(d)) : Math.abs(d).toLocaleString()}`;
        host.appendChild(t);
        const x = Math.max(6, Math.min(root.innerWidth - t.offsetWidth - 6, rect.left + rect.width / 2 - t.offsetWidth / 2)), y = up ? rect.top - t.offsetHeight - 6 : rect.bottom + 6, m = (up ? -16 : 16) * (k || .01);
        const frames = d > 0 ? [{ transform: `translate(${x}px, ${y + m}px)`, opacity: 0 }, { transform: `translate(${x}px, ${y}px)`, opacity: 1, offset: .22 }, { transform: `translate(${x}px, ${y}px)`, opacity: 1, offset: .78 }, { transform: `translate(${x}px, ${y - m * .6}px) scale(.9)`, opacity: 0 }]
            : [{ transform: `translate(${x}px, ${y - m * .5}px)`, opacity: 0 }, { transform: `translate(${x}px, ${y}px)`, opacity: 1, offset: .22 }, { transform: `translate(${x}px, ${y}px)`, opacity: 1, offset: .75 }, { transform: `translate(${x}px, ${y + m}px)`, opacity: 0 }];
        const a = t.animate(frames, { duration: 1900, easing: 'ease-out', fill: 'both' });
        const done = () => t.remove(); a.onfinish = done; a.oncancel = done; setTimeout(done, 2600);
    }
    function play(id, d) {
        if (!btn || !visible() || !d || motion() === 0) return false;
        const i = minis.findIndex((m) => m.getAttribute('data-chip-mini') === id);
        const k = motion(), rect = btn.getBoundingClientRect();
        busy = true; clear(); if (i >= 0) show(i);
        btn.style.setProperty('--pf', i >= 0 ? root.getComputedStyle(minis[i]).getPropertyValue('--pc') || 'currentColor' : 'currentColor');
        btn.classList.remove('is-gain', 'is-loss'); void btn.offsetWidth; btn.classList.add(d > 0 ? 'is-gain' : 'is-loss');
        if (k === 1) pieces(id, rect, d > 0, k); delta(id, rect, d, k);
        later(() => { btn.classList.remove('is-gain', 'is-loss'); }, 1500);
        later(() => { busy = false; show(home); idle(); }, 3400);
        return true;
    }
    /**
     * The gain or spend effect at any element (4.190.0): the currency's pieces fly into it (a gain) or out of it (a
     * spend) and the amount shows beside it. It works inside an open dialog, and goes upward near the bottom of the
     * screen. burst(button, 'coins', -200) when someone spends; burst(card, 'vibes', 50) when they receive.
     */
    function burst(el, id, d) {
        if (!el || !el.getBoundingClientRect || !d || !ICONS[id]) return;
        style();
        const rect = el.getBoundingClientRect(); if (!rect.width) return;
        const icon = el.querySelector && el.querySelector('.ovp-ic'), ir = icon ? icon.getBoundingClientRect() : rect;
        const at = { x: ir.left + ir.width / 2, y: ir.top + ir.height / 2, host: (el.closest && el.closest('dialog[open]')) || doc.body, up: rect.bottom > root.innerHeight - 110 };
        const k = motion();
        pieces(id, rect, d > 0, k, at); delta(id, rect, d, k, at);
    }
    /** Count a number from what it was to what it is: in the bar's short form, or with the format given. */
    function count(el, from, to, fmt) {
        if (!el || typeof root.requestAnimationFrame !== 'function') return;
        if (motion() === 0) { el.textContent = (fmt || short)(to); return; }
        const t0 = root.performance.now(), ms = 800;
        const step = (t) => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); if (!el.isConnected) return; el.textContent = (fmt || short)(p < 1 ? from + (to - from) * e : to); if (p < 1) root.requestAnimationFrame(step); };
        root.requestAnimationFrame(step);
    }
    function set(id, value) {
        const n = num(value), was = last[id];
        last[id] = n;
        if (!btn || n == null || was == null || n === was) return;
        const m = minis.find((x) => x.getAttribute('data-chip-mini') === id); if (!m) return;
        m.setAttribute('data-v', String(value));
        play(id, n - was); count(m.querySelector('.ovnav-chip-mv'), was, n);
    }
    let recent = null, recentUser = null, running = null;
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    function recentChanges(user) {
        const id = user || recentUser;
        if (!id) return null;
        if (recent && id === recentUser) return recent;
        try { return JSON.parse(root.sessionStorage.getItem(`ovp-changes:${id}`) || 'null'); } catch { return null; }
    }
    async function catchUp({ frameBase = 'https://openvibe.network/api/frame', token, user, streamer, valid } = {}) {
        if (!user || running || typeof root.fetch !== 'function') return running;
        if (recentUser !== user) recent = null;
        recentUser = user;
        const base = String(frameBase).replace(/\/+$/, '');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const credentials = token ? 'omit' : 'include';
        const channel = /^[1-9]\d{0,15}$/.test(String(streamer || '')) ? String(streamer) : '';
        const url = `${base}/wallet/changes${channel ? `?streamer=${channel}` : ''}`;
        running = (async () => {
            let answer;
            try {
                const response = await root.fetch(url, { headers, credentials });
                if (!response.ok) return;
                answer = await response.json();
            } catch { return; }
            if (!answer || typeof answer !== 'object' || (valid && !valid())) return;
            const order = [['opencoins', 'coins'], ['vibes', 'vibes'], ['channel_points', 'channel-points']];
            const changed = order.filter(([name]) => answer[name] && Number.isSafeInteger(Number(answer[name].net)) && Number(answer[name].net) !== 0 && answer[name].cursor != null);
            if (!changed.length) return;
            recent = answer; recentUser = user;
            try { root.sessionStorage.setItem(`ovp-changes:${user}`, JSON.stringify(answer)); } catch { /* closed storage */ }
            for (const [name, id] of changed) {
                const part = answer[name], cursor = String(part.cursor);
                const guard = `ovp-read:${user}:${name}:${name === 'channel_points' ? channel : ''}`;
                let previous = null; try { previous = root.sessionStorage.getItem(guard); } catch { /* closed storage */ }
                if ((valid && !valid()) || previous === cursor || (motion() !== 0 && !visible())) continue;
                if (motion() !== 0) play(id, Number(part.net));
                try { root.sessionStorage.setItem(guard, cursor); } catch { /* closed storage */ }
                try {
                    await root.fetch(`${base}/wallet/changes/read`, { method: 'PUT', credentials, headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currency: id === 'coins' ? 'opencoins' : id, cursor: part.cursor, ...(id === 'channel-points' ? { streamer: Number(channel) } : {}) }) });
                } catch { /* the server's read state will be retried on the next visit */ }
                if (changed.at(-1)[0] !== name) await pause(700);
            }
        })().finally(() => { running = null; });
        return running;
    }
    root.OpenVibePurse = { mount, set, play, burst, count, catchUp, recentChanges, icon: (id, size) => { style(); return ICONS[id] ? svg(size || 20, ICONS[id]) : ''; }, ids: Object.keys(ICONS) };
    if (root.__ovPursePending) { const pending = root.__ovPursePending; delete root.__ovPursePending; catchUp(pending); }
    const now = doc.getElementById('openvibe-chips-all'); if (now) mount(now);
})(typeof window !== 'undefined' ? window : null);
