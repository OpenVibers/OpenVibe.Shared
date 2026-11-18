/**
 * ov-stage.js — OpenVibeStage: OpenVibe's own product-demo kit (plan §AD.25, "ov-stage"; the owner sent Stageshow on
 * 2026-11-17). A feature card plays a short scripted demo of the real interface: a scene built from our own components,
 * a cursor that moves, clicks and types, and a loop. Vanilla JS, no library (the network's no-third-party-UI rule).
 *
 *   OpenVibeStage.mount(el, { beats, phone?, label, loop?, size? }) → { play(), pause(), reset(), destroy(), get playing }
 *     el        holds the scene: its markup at the design size (size, default 960×540), scaled to fit el's width
 *     phone     { beats, size? } for a compact phone redesign: the scene in el's <template data-ov-stage-phone>, used
 *               when the stage is under 520 px wide (designed twice, never just shrunk)
 *     beats     the script, in order:
 *                 { wait: ms }                         hold
 *                 { move: 'selector', ms? }            the cursor glides to the element's centre
 *                 { click: 'selector', add?, remove? } the cursor presses it; classes change on it after the press
 *                 { type: 'selector', text, cps? }     types into an input's value or an element's text
 *                 { set: 'selector', add?, remove?, text?, attr?: { name: value } }   a state change, at once
 *                 { show: 'selector' } / { hide: 'selector' }
 *     label     what the demo shows, in a sentence: the stage is role="img" with this label; the scene is hidden from
 *               screen readers (it is a picture of the product, not the product)
 *     loop      true (the default): after the last beat, a pause, the scene as it was, and again
 *
 * Motion follows <html data-ov-motion>: "off" shows the poster frame (every beat applied at once, the end state, still,
 * no cursor); "calm" plays slower with no press bounce; anything else plays as written. It changes live with the setting.
 * The demo plays only while it is on screen and the page is shown, and a Pause button stops it (WCAG 2.2.2: moving
 * content longer than five seconds can be paused).
 */
(function (root) {
    'use strict';
    if (root.OpenVibeStage) return;
    const PHONE_BELOW = 520;
    const CSS = '.ovst{position:relative;overflow:hidden;border-radius:var(--ov-radius-lg,14px);background:var(--bg-secondary,#111827);aspect-ratio:var(--ovst-ar,16/9);max-width:100%;isolation:isolate}'
        + '.ovst-scaler{position:absolute;left:0;top:0;transform-origin:0 0}'
        + '.ovst-cursor{position:absolute;left:0;top:0;width:22px;height:22px;pointer-events:none;z-index:5;transition:transform var(--ovst-glide,.7s) cubic-bezier(.22,.8,.25,1),opacity .25s;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}'
        + '.ovst-cursor.is-pressing{animation:ovst-press .26s ease-out}'
        + '.ovst.is-calm .ovst-cursor.is-pressing{animation:none}'
        + '@keyframes ovst-press{50%{scale:.82}}'
        + '.ovst .is-ovst-pressed{filter:brightness(1.15)}'
        + '.ovst-pause{position:absolute;right:max(10px,env(safe-area-inset-right,0px));top:10px;z-index:6;min-width:44px;min-height:44px;padding:0 12px;border:0;border-radius:999px;background:color-mix(in srgb,var(--bg-primary,#0b0f17) 72%,transparent);color:var(--text-primary,#fff);font:600 13px/1 inherit;cursor:pointer;backdrop-filter:blur(6px)}'
        + '.ovst-pause:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:2px}'
        + 'html[data-ov-motion=off] .ovst-cursor{display:none}';
    const CURSOR = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 2.5l13.5 12.2-6.1.5 3.6 6.9-2.6 1.3-3.5-6.9-4.9 4.1z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';

    function injectCss() {
        if (document.getElementById('ovst-css')) return;
        const s = document.createElement('style');
        s.id = 'ovst-css';
        s.textContent = CSS;
        document.head.appendChild(s);
    }
    const motion = () => document.documentElement.getAttribute('data-ov-motion') || 'on';

    function mount(el, opts = {}) {
        if (!el || el.__ovst) return el && el.__ovst;
        injectCss();
        const phoneTpl = el.querySelector('template[data-ov-stage-phone]');
        if (phoneTpl) phoneTpl.remove();
        const wide = { html: el.innerHTML, beats: Array.isArray(opts.beats) ? opts.beats : [], size: opts.size || { w: 960, h: 540 } };
        const narrow = phoneTpl && opts.phone ? { html: phoneTpl.innerHTML, beats: Array.isArray(opts.phone.beats) ? opts.phone.beats : wide.beats, size: opts.phone.size || { w: 390, h: 640 } } : null;
        el.innerHTML = '';
        el.classList.add('ovst');
        el.setAttribute('role', 'img');
        if (opts.label) el.setAttribute('aria-label', String(opts.label));
        const scaler = document.createElement('div');
        scaler.className = 'ovst-scaler';
        scaler.setAttribute('aria-hidden', 'true');
        scaler.inert = true;
        const cursor = document.createElement('div');
        cursor.className = 'ovst-cursor';
        cursor.innerHTML = CURSOR;
        const pauseB = document.createElement('button');
        pauseB.type = 'button';
        pauseB.className = 'ovst-pause';
        el.append(scaler, pauseB);

        let scene = null, beat = 0, timer = null, userPaused = false, visible = false, gen = 0, destroyed = false;
        const loop = opts.loop !== false;
        const st = { get playing() { return Boolean(timer) || stepping; } };
        let stepping = false;

        function pick() { return narrow && el.clientWidth < PHONE_BELOW ? narrow : wide; }
        function build() {
            scene = pick();
            scaler.innerHTML = scene.html;
            scaler.appendChild(cursor);
            scaler.style.width = `${scene.size.w}px`;
            scaler.style.height = `${scene.size.h}px`;
            el.style.setProperty('--ovst-ar', `${scene.size.w}/${scene.size.h}`);
            fit();
            cursor.style.opacity = '0';
            cursor.style.transform = `translate(${scene.size.w * 0.62}px,${scene.size.h * 0.72}px)`;
            beat = 0;
        }
        function fit() { if (scene) scaler.style.transform = `scale(${el.clientWidth / scene.size.w})`; }
        const q = (sel) => (sel ? scaler.querySelector(sel) : null);
        function centre(t) {
            let x = t.offsetWidth / 2, y = t.offsetHeight / 2;
            for (let n = t; n && n !== scaler; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
            return { x, y };
        }
        function classes(t, b) {
            for (const c of String(b.add || '').split(/\s+/).filter(Boolean)) t.classList.add(c);
            for (const c of String(b.remove || '').split(/\s+/).filter(Boolean)) t.classList.remove(c);
        }
        // One beat applied: at once (instant) for the poster frame, else with its time. Answers the ms it takes.
        function apply(b, instant) {
            const calm = motion() === 'calm';
            if (b.wait != null) return instant ? 0 : Number(b.wait) || 0;
            if (b.move) {
                const t = q(b.move); if (!t) return 0;
                const c = centre(t);
                const ms = (Number(b.ms) || 700) * (calm ? 1.5 : 1);
                el.style.setProperty('--ovst-glide', `${instant ? 0 : ms}ms`);
                cursor.style.opacity = instant ? '0' : '1';
                cursor.style.transform = `translate(${c.x - 4}px,${c.y - 3}px)`;
                return instant ? 0 : ms;
            }
            if (b.click) {
                const t = q(b.click); if (!t) return 0;
                if (instant) { classes(t, b); return 0; }
                cursor.classList.remove('is-pressing'); void cursor.offsetWidth; cursor.classList.add('is-pressing');
                t.classList.add('is-ovst-pressed');
                const g = gen;
                setTimeout(() => { if (g !== gen) return; t.classList.remove('is-ovst-pressed'); classes(t, b); }, 200);
                return 420;
            }
            if (b.type) {
                const t = q(b.type); if (!t) return 0;
                const text = String(b.text || '');
                const put = (s) => { if ('value' in t && t.tagName !== 'BUTTON') t.value = s; else t.textContent = s; };
                if (instant) { put(text); return 0; }
                const per = 1000 / (Number(b.cps) || (calm ? 9 : 14));
                const g = gen;
                for (let i = 1; i <= text.length; i++) setTimeout(() => { if (g === gen) put(text.slice(0, i)); }, per * i);
                return per * text.length + 120;
            }
            if (b.set) {
                const t = q(b.set); if (!t) return 0;
                classes(t, b);
                if (b.text != null) t.textContent = String(b.text);
                for (const [k, v] of Object.entries(b.attr || {})) t.setAttribute(k, String(v));
                return 0;
            }
            if (b.show || b.hide) { const t = q(b.show || b.hide); if (t) t.hidden = Boolean(b.hide); return 0; }
            return 0;
        }
        function poster() {
            stop(); build();
            for (const b of scene.beats) apply(b, true);
            beat = scene.beats.length;
            pauseB.hidden = true;
        }
        function next() {
            timer = null;
            if (destroyed || userPaused || !visible || document.hidden) return;
            if (motion() === 'off') return poster();
            if (beat >= scene.beats.length) {
                if (!loop) return;
                gen += 1;
                timer = setTimeout(() => { timer = null; build(); next(); }, 1400);
                return;
            }
            stepping = true;
            const ms = apply(scene.beats[beat++], false);
            stepping = false;
            timer = setTimeout(next, Math.max(16, ms));
        }
        function stop() { if (timer) clearTimeout(timer); timer = null; gen += 1; }
        function label() { pauseB.textContent = userPaused ? 'Play' : 'Pause'; pauseB.setAttribute('aria-pressed', String(userPaused)); pauseB.setAttribute('aria-label', userPaused ? 'Play the demo' : 'Pause the demo'); }
        function play() { if (destroyed) return; userPaused = false; label(); pauseB.hidden = motion() === 'off'; el.classList.toggle('is-calm', motion() === 'calm'); if (!timer) next(); }
        function pause() { userPaused = true; label(); stop(); }
        pauseB.addEventListener('click', () => (userPaused ? play() : pause()));

        const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => {
            visible = es.some((e) => e.isIntersecting);
            if (visible && !userPaused && !timer) next(); else if (!visible) stop();
        }, { threshold: 0.25 }) : null;
        if (io) io.observe(el); else visible = true;
        const onVis = () => { if (!document.hidden && visible && !userPaused && !timer) next(); };
        document.addEventListener('visibilitychange', onVis);
        let lastW = el.clientWidth;
        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
            const w = el.clientWidth;
            if (w === lastW) return;
            const was = scene; lastW = w;
            if (pick() !== was) { stop(); build(); if (motion() === 'off') poster(); else next(); } else fit();
        }) : null;
        if (ro) ro.observe(el);
        const mo = new MutationObserver(() => {
            el.classList.toggle('is-calm', motion() === 'calm');
            if (motion() === 'off') poster(); else if (pauseB.hidden) { pauseB.hidden = false; stop(); build(); next(); }
        });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ov-motion'] });

        build();
        label();
        el.classList.toggle('is-calm', motion() === 'calm');
        if (motion() === 'off') poster(); else if (visible) next();

        const api = {
            play, pause,
            reset() { stop(); build(); if (motion() === 'off') poster(); else next(); },
            destroy() { destroyed = true; stop(); if (io) io.disconnect(); if (ro) ro.disconnect(); mo.disconnect(); document.removeEventListener('visibilitychange', onVis); delete el.__ovst; },
            get playing() { return st.playing; },
            get beat() { return beat; },
            get scene() { return scene === narrow ? 'phone' : 'wide'; },
        };
        el.__ovst = api;
        return api;
    }

    root.OpenVibeStage = { mount, PHONE_BELOW };
    // A stage written in markup: <div data-ov-stage='{"label":"…","beats":[…]}'> … </div>
    function auto() {
        for (const n of document.querySelectorAll('[data-ov-stage]')) {
            if (n.__ovst) continue;
            let o = {};
            try { o = JSON.parse(n.getAttribute('data-ov-stage') || '{}'); } catch { o = {}; }
            mount(n, o);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto, { once: true }); else auto();
})(typeof window !== 'undefined' ? window : this);
