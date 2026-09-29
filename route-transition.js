/*
 * openvibe-shared/route-transition.js — what a page move looks like (roadmap WS-P): web-runtime.js's rt.enter() fetches
 * this on the first in-site move. A thin progress bar at the top of the window; after 150 ms a centred line in the
 * page, "Loading Content…" with the current phase under it ("applying styles", "starting up", or the site's own
 * rt.status("Loading clips…")); then the page fades in (opacity only: a transform would make the page the containing
 * block of its position:fixed children, and a bottom sheet or a floating button would jump while it ran). Theme tokens colour it (--accent, --accent-light,
 * --text-muted); reduced motion gets no animation.
 *
 *   const h = OVRouteFx.start(section, { label, prefix })  → { status(text), done() }; follows <prefix>:phase events
 *   OVRouteFx.bar('run' | 'done')                  → the top bar alone (a site's own loads)
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVRouteFx) return;
    const css = `.ovrt-wait{position:fixed;z-index:40;pointer-events:none;display:grid;place-content:center;justify-items:center;gap:12px;padding:24px;color:var(--text-muted,#8a96a8);font:600 .84rem/1.35 system-ui,sans-serif;text-align:center;animation:ovrtIn .25s ease both}
.ovrt-wait i{display:block;width:min(200px,50vw);height:3px;border-radius:3px;overflow:hidden;position:relative;background:color-mix(in srgb,var(--accent,#3b82f6) 18%,transparent)}
.ovrt-wait i::after{content:'';position:absolute;inset:0;width:38%;border-radius:3px;background:var(--accent,#3b82f6);animation:ovrtSlide 1.05s cubic-bezier(.45,0,.2,1) infinite}
.ovrt-wait small{font-weight:500;font-size:.76rem;opacity:.85;min-height:1.2em;transition:opacity .2s}
.ovrt-bar{position:fixed;left:0;top:0;height:2px;width:100%;z-index:2147483000;pointer-events:none;transform-origin:0 50%;transform:scaleX(0);opacity:0;background:linear-gradient(90deg,var(--accent,#3b82f6),var(--accent-light,#60a5fa));box-shadow:0 0 8px color-mix(in srgb,var(--accent,#3b82f6) 55%,transparent)}
.ovrt-bar.is-run{opacity:1;transform:scaleX(.85);transition:transform 2.6s cubic-bezier(.1,.7,.2,1)}
.ovrt-bar.is-done{opacity:0;transform:scaleX(1);transition:transform .18s ease,opacity .35s .12s}
.ovrt-enter{animation:ovrtEnter .28s cubic-bezier(.22,1,.36,1) both}
@keyframes ovrtEnter{from{opacity:0}to{opacity:1}}
@keyframes ovrtIn{from{opacity:0}to{opacity:1}}
@keyframes ovrtSlide{from{transform:translateX(-100%)}to{transform:translateX(265%)}}
@media (prefers-reduced-motion:reduce){.ovrt-enter,.ovrt-wait,.ovrt-wait i::after{animation:none}.ovrt-bar.is-run,.ovrt-bar.is-done{transition:none}}`;
    const st = document.createElement('style');
    st.id = 'ovrt-css';
    st.textContent = css;
    document.head.appendChild(st);

    let barEl = null, barTimer = 0;
    function bar(state) {
        if (!barEl) { barEl = document.createElement('div'); barEl.className = 'ovrt-bar'; barEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(barEl); }
        root.clearTimeout(barTimer);
        if (state === 'run') { barEl.classList.remove('is-done', 'is-run'); void barEl.offsetWidth; barEl.classList.add('is-run'); }
        else { barEl.classList.add('is-done'); barTimer = root.setTimeout(() => barEl.classList.remove('is-run', 'is-done'), 600); }
    }
    const reduced = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

    const PHASES = { styles: 'applying styles', code: 'starting up' };
    function start(section, { label, prefix = 'ov' } = {}) {
        bar('run');
        let wait = null, open = true;
        const onPhase = (e) => { if (wait && e.detail && PHASES[e.detail.phase]) wait.querySelector('small').textContent = PHASES[e.detail.phase]; };
        document.addEventListener(`${prefix}:phase`, onPhase);
        const t = root.setTimeout(() => {
            if (!open) return;
            wait = document.createElement('div');
            wait.className = 'ovrt-wait';
            wait.setAttribute('role', 'status');
            wait.innerHTML = '<i></i><span></span><small></small>';
            wait.querySelector('span').textContent = `Loading ${label || 'page'}…`;
            // Over the page's visible area, but outside it: a page script that re-renders its section while the
            // route loads cannot take the line away.
            const r = section.getBoundingClientRect(), top = Math.max(r.top, 0);
            Object.assign(wait.style, { left: `${r.left}px`, width: `${r.width}px`, top: `${top}px`, height: `${Math.max(160, Math.min(r.bottom, root.innerHeight) - top)}px` });
            document.body.appendChild(wait);
        }, 150);
        return {
            status(text) { if (wait) wait.querySelector('small').textContent = String(text || ''); },
            done() {
                open = false;
                root.clearTimeout(t);
                document.removeEventListener(`${prefix}:phase`, onPhase);
                if (wait) wait.remove();
                bar('done');
                if (reduced()) return;
                section.classList.remove('ovrt-enter');
                void section.offsetWidth;
                section.classList.add('ovrt-enter');
                root.setTimeout(() => section.classList.remove('ovrt-enter'), 400);
            },
        };
    }

    root.OVRouteFx = { start, bar };
})(typeof window !== 'undefined' ? window : globalThis);
