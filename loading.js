/**
 * openvibe-shared/loading.js — the network's one loading look (window.OpenVibeLoading). The owner, 2026-10-28, of Live's
 * stream loader: "old and outdated… awkward… consider the latest frames of the stream… more integrated, modern and
 * sleek… no borders and wasted space and padding… minimalistic… a better animation… reusable and shared across the
 * sites… a loading system you can use in the SDK and API."
 *
 * It covers what is loading edge to edge, with no card: the thing's own picture (a stream's latest frame, a video's
 * poster) blurred and drifting behind, a thin ring turning around a soft dot, one word of status with one quiet line under
 * it, and a two-pixel line along the bottom that fills as the steps go by (or sweeps while the progress is unknown).
 * Only when it is slow does a hint and its actions appear; a failure says what happened and offers Retry. Done, it fades.
 *
 *   const l = OpenVibeLoading.mount(el, { poster, label: 'Connecting', sub: 'Getting your viewer ready', steps: 5 })
 *   l.update({ label, sub, step, progress })   step: 0-based of steps (or progress 0-1); omit both to keep it
 *   l.slow({ hint, actions: [{ label, onClick }] })      a hint and actions under the status (it keeps loading)
 *   l.fail({ title, detail, actions: [{ label, onClick }] })   stops the ring, says what happened
 *   l.done()       fades out and removes itself (the picture underneath shows through as it goes)
 *   l.destroy()    removes it at once
 *   OpenVibeLoading.skeleton(el, { rows: 3, mark: true })   shimmering rows while a list loads → { done() }
 *
 * The element it mounts into should be positioned (relative, absolute or fixed); it fills it. Text is set with
 * textContent; the poster must be an https URL, a same-site path or a blob/data image. Motion stops under
 * prefers-reduced-motion. Works without the rest of the OpenVibe Frame; colours follow the site's theme.
 */
(function (root) {
    'use strict';
    const CSS = `
.ovld { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; overflow: hidden; background: #05070c; color: #f4f6fb; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; transition: opacity .38s ease; contain: strict; }
.ovld.is-done { opacity: 0; pointer-events: none; }
.ovld-poster { position: absolute; inset: -8%; background-size: cover; background-position: center; filter: blur(22px) saturate(1.25) brightness(.5); transform: scale(1.06); opacity: 0; transition: opacity .6s ease; animation: ovld-drift 16s ease-in-out infinite alternate; }
.ovld-poster.is-in { opacity: 1; }
.ovld::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, rgba(5,7,12,0) 0%, rgba(5,7,12,.35) 55%, rgba(5,7,12,.75) 100%); pointer-events: none; }
.ovld-core { position: relative; z-index: 1; display: grid; justify-items: center; gap: 10px; max-width: min(86%, 420px); text-align: center; text-shadow: 0 1px 12px rgba(0,0,0,.45); }
.ovld-ring { position: relative; width: 46px; height: 46px; border-radius: 50%; }
.ovld-ring::before { content: ''; position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, rgba(255,255,255,0) 0 62%, var(--accent-light, #9cc0ff) 100%); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px)); mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px)); animation: ovld-spin 1.15s linear infinite; }
.ovld-ring::after { content: ''; position: absolute; inset: 16px; border-radius: 50%; background: var(--accent-light, #9cc0ff); box-shadow: 0 0 18px var(--accent-light, #9cc0ff); animation: ovld-breathe 1.6s ease-in-out infinite; }
.ovld-label { font-size: 15px; font-weight: 650; letter-spacing: .01em; transition: opacity .2s ease, transform .2s ease; }
.ovld-sub { font-size: 12.5px; line-height: 1.45; color: rgba(244,246,251,.72); min-height: 1.45em; transition: opacity .2s ease; }
.ovld-swap .ovld-label, .ovld-swap .ovld-sub { opacity: 0; transform: translateY(3px); }
.ovld-help { display: none; gap: 10px; justify-items: center; margin-top: 2px; font-size: 12.5px; line-height: 1.45; color: rgba(244,246,251,.8); }
.ovld.is-slow .ovld-help, .ovld.is-failed .ovld-help { display: grid; }
.ovld-acts { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.ovld-acts button { min-height: 36px; padding: 6px 14px; border: 0; border-radius: 999px; background: rgba(255,255,255,.14); color: inherit; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.ovld-acts button:hover, .ovld-acts button:focus-visible { background: rgba(255,255,255,.24); outline: none; }
.ovld-acts button:first-child { background: var(--accent-strong, #2563eb); color: var(--on-accent-strong, #fff); }
.ovld-line { position: absolute; left: 0; right: 0; bottom: 0; z-index: 1; height: 2px; background: rgba(255,255,255,.08); overflow: hidden; }
.ovld-line i { position: absolute; left: 0; top: 0; bottom: 0; width: var(--ovld-p, 0%); background: linear-gradient(90deg, var(--accent, #3b82f6), var(--accent-light, #9cc0ff)); box-shadow: 0 0 10px var(--accent-light, #9cc0ff); transition: width .7s cubic-bezier(.2,.7,.2,1); }
.ovld.is-unknown .ovld-line i { width: 30%; animation: ovld-sweep 1.4s ease-in-out infinite; }
.ovld.is-failed .ovld-ring::before { animation: none; background: none; }
.ovld.is-failed .ovld-ring::after { inset: 14px; background: var(--danger, #ef4444); box-shadow: 0 0 18px var(--danger, #ef4444); animation: none; }
.ovld.is-failed .ovld-line i { background: var(--danger, #ef4444); box-shadow: none; animation: none; width: 100%; }
.ovld-skel { display: grid; gap: 10px; padding: 4px 0; }
.ovld-skel-row { display: flex; align-items: center; gap: 12px; }
.ovld-skel-mark { flex: none; width: 40px; height: 40px; border-radius: 50%; }
.ovld-skel-lines { flex: 1; display: grid; gap: 7px; }
.ovld-skel-line { height: 11px; border-radius: 6px; }
.ovld-skel-line:last-child { width: 62%; }
.ovld-skel-mark, .ovld-skel-line { background: linear-gradient(90deg, var(--bg-hover, rgba(255,255,255,.06)) 25%, rgba(255,255,255,.12) 50%, var(--bg-hover, rgba(255,255,255,.06)) 75%); background-size: 300% 100%; animation: ovld-shimmer 1.3s ease-in-out infinite; }
@keyframes ovld-spin { to { transform: rotate(1turn); } }
@keyframes ovld-breathe { 0%, 100% { transform: scale(.72); opacity: .75; } 50% { transform: scale(1); opacity: 1; } }
@keyframes ovld-drift { from { transform: scale(1.06) translate3d(-1.5%, -1%, 0); } to { transform: scale(1.14) translate3d(1.5%, 1%, 0); } }
@keyframes ovld-sweep { from { left: -30%; } to { left: 100%; } }
@keyframes ovld-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .ovld-poster, .ovld-ring::before, .ovld-ring::after, .ovld-line i, .ovld-skel-mark, .ovld-skel-line { animation: none !important; } .ovld-ring::before { background: conic-gradient(var(--accent-light, #9cc0ff) 0 30%, rgba(255,255,255,.15) 30%); } }`;

    function styles() {
        if (typeof document === 'undefined' || document.getElementById('openvibe-loading-styles')) return;
        const st = document.createElement('style');
        st.id = 'openvibe-loading-styles';
        st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
    }
    const posterUrl = (u) => { const s = String(u || ''); if (/^(blob:|data:image\/)/.test(s)) return s; try { const x = new URL(s, location.href); return x.protocol === 'https:' || x.origin === location.origin ? x.href : null; } catch { return null; } };
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function mount(host, opts = {}) {
        styles();
        const box = el('div', 'ovld is-unknown');
        box.setAttribute('role', 'status');
        box.setAttribute('aria-live', 'polite');
        const poster = el('div', 'ovld-poster');
        const core = el('div', 'ovld-core');
        const ring = el('div', 'ovld-ring');
        ring.setAttribute('aria-hidden', 'true');
        const label = el('div', 'ovld-label', opts.label || 'Loading');
        const sub = el('div', 'ovld-sub', opts.sub || '');
        const help = el('div', 'ovld-help');
        const hint = el('div', 'ovld-hint');
        const acts = el('div', 'ovld-acts');
        help.append(hint, acts);
        core.append(ring, label, sub, help);
        const line = el('div', 'ovld-line');
        const fill = el('i');
        line.appendChild(fill);
        box.append(poster, core, line);
        host.appendChild(box);
        let steps = Number(opts.steps) || 0;
        let gone = false;

        function setPoster(u) {
            const url = posterUrl(u);
            if (!url) return;
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => { if (gone) return; poster.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`; poster.classList.add('is-in'); };
            img.src = url;
        }
        function setText(l, s) {
            const change = (l != null && l !== label.textContent) || (s != null && s !== sub.textContent);
            if (!change) return;
            if (reduced()) { if (l != null) label.textContent = l; if (s != null) sub.textContent = s; return; }
            core.classList.add('ovld-swap');
            setTimeout(() => { if (l != null) label.textContent = l; if (s != null) sub.textContent = s; core.classList.remove('ovld-swap'); }, 160);
        }
        function setActions(list) {
            acts.textContent = '';
            (list || []).slice(0, 3).forEach((a) => {
                if (!a || !a.label) return;
                const b = el('button', '', a.label);
                b.type = 'button';
                if (typeof a.onClick === 'function') b.addEventListener('click', (e) => a.onClick(e));
                acts.appendChild(b);
            });
        }
        if (opts.poster) setPoster(opts.poster);

        const api = {
            update({ label: l, sub: s, step, progress, steps: n, poster: p } = {}) {
                if (gone) return api;
                if (n != null) steps = Number(n) || 0;
                let pct = null;
                if (progress != null && Number.isFinite(Number(progress))) pct = Math.max(0, Math.min(1, Number(progress)));
                else if (step != null && steps > 0) pct = Math.max(0, Math.min(1, (Number(step) + 1) / (steps + 1)));
                if (pct != null) { box.classList.remove('is-unknown'); box.style.setProperty('--ovld-p', `${Math.round(pct * 100)}%`); }
                if (l != null || s != null) setText(l, s);
                if (p) setPoster(p);
                box.classList.remove('is-slow');
                return api;
            },
            slow({ hint: h = '', actions = [] } = {}) {
                if (gone) return api;
                hint.textContent = h;
                setActions(actions);
                box.classList.add('is-slow');
                return api;
            },
            fail({ title = 'Something went wrong', detail = '', actions = [] } = {}) {
                if (gone) return api;
                box.classList.remove('is-slow', 'is-unknown');
                box.classList.add('is-failed');
                box.setAttribute('role', 'alert');
                setText(title, detail);
                hint.textContent = '';
                setActions(actions);
                return api;
            },
            done() {
                if (gone) return;
                gone = true;
                box.style.setProperty('--ovld-p', '100%');
                box.classList.add('is-done');
                setTimeout(() => box.remove(), reduced() ? 0 : 400);
            },
            destroy() { gone = true; box.remove(); },
            get element() { return box; },
        };
        return api;
    }

    function skeleton(host, { rows = 3, mark = true } = {}) {
        styles();
        const wrap = el('div', 'ovld-skel');
        wrap.setAttribute('aria-busy', 'true');
        wrap.setAttribute('aria-label', 'Loading');
        for (let i = 0; i < Math.max(1, Math.min(20, rows)); i++) {
            const r = el('div', 'ovld-skel-row');
            if (mark) r.appendChild(el('div', 'ovld-skel-mark'));
            const lines = el('div', 'ovld-skel-lines');
            lines.append(el('div', 'ovld-skel-line'), el('div', 'ovld-skel-line'));
            r.appendChild(lines);
            wrap.appendChild(r);
        }
        host.appendChild(wrap);
        return { done() { wrap.remove(); }, element: wrap };
    }

    const api = { mount, skeleton, CSS };
    root.OpenVibeLoading = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
