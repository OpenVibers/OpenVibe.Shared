/*
 * openvibe-shared/mini.js — the video that comes with you (the owner, 2026-11-10, on the browser's floating
 * picture-in-picture window over a watch page: "should … actually [be] like YouTube where it moves that video. Now you
 * go to the search again or the index … the homepage").
 *
 * A watch page says its video may come along:
 *
 *   <video data-ov-player data-ov-mini data-ov-mini-title="…" data-ov-mini-by="…" [data-ov-mini-page="/watch?v=…"]
 *          [data-ov-mini-to="/"] [data-ov-mini-src="https://…/file.mp4"] [data-ov-mini-hls="https://…/index.m3u8"] src="…">
 *
 * The shared player's picture-in-picture button then calls OpenVibeMini.carry(video): what is playing is written down
 * (the page, the file, the title, who made it, the poster, the second, the speed, the volume, whether it was playing)
 * and the person goes to the site's front page. Every page of the site that finds the record draws the small player and
 * goes on from the same second: bottom left on a computer, a bar above the app bar on a phone. (A site turns this
 * on by loading this file on its pages, deferred: it starts itself and does nothing without a record.) It has play and pause,
 * a way back to the video's own page at that second, and a close. The page the video came from takes the second back
 * and the small player is not drawn there. Starting another video on a page closes it: one sound at a time.
 * It plays what the page plays: the streaming playlist (data-ov-mini-hls) where the browser plays one by itself, in the
 * same cross-origin mode as the page, and the plain file otherwise; a playlist that fails gives way to the file at the
 * same second. A file that cannot be played either is said, with the way back.
 *
 * The record is this tab's own (sessionStorage): it never leaves the site, so a private file's signed address is safe
 * in it. Across sites it will travel another way (plan, ask 265).
 *
 *   OpenVibeMini.carry(video, { to })   → true when the video was taken along
 *   OpenVibeMini.open(record)           draw the small player for a record
 *   OpenVibeMini.resume()               what a page does on load (this file does it by itself)
 *   OpenVibeMini.close()                stop and forget
 *   OpenVibeMini.record()               what is written down, or null
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeMini) return;
    const KEY = 'ov-mini';
    const OLD = 6 * 3600 * 1000;      // a record older than this is forgotten: nobody is still watching it
    let el = null, video = null, saved = 0;
    let live = false;                 // true once the record's second, speed and state have been given to the element

    const store = () => { try { return root.sessionStorage; } catch { return null; } };
    const record = () => { try { const r = JSON.parse(store().getItem(KEY) || 'null'); return r && r.src && r.page ? r : null; } catch { return null; } };
    const save = (r) => { try { store().setItem(KEY, JSON.stringify(r)); } catch { /* a full or closed store: the video just does not come along */ } };
    const forget = () => { try { store().removeItem(KEY); } catch { /* nothing to forget */ } };
    const samePage = (page) => {
        try { const a = new URL(page, root.location.href); const b = root.location; const strip = (s) => s.replace(/([?&])t=[^&]*&?/, '$1').replace(/[?&]$/, ''); return a.origin === b.origin && a.pathname === b.pathname && strip(a.search) === strip(b.search); } catch { return false; }
    };
    const clock = (s) => { const n = Math.max(0, Math.floor(s || 0)); const h = Math.floor(n / 3600); const m = Math.floor((n % 3600) / 60); return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(n % 60).padStart(2, '0'); };
    const I = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="${d}" fill="currentColor"/></svg>`;
    const ICON = {
        play: I('M8 5.6v12.8a1 1 0 0 0 1.5.86l10.6-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z'),
        pause: I('M7 5h3.2a.8.8 0 0 1 .8.8v12.4a.8.8 0 0 1-.8.8H7a.8.8 0 0 1-.8-.8V5.800A.8.8 0 0 1 7 5zm6.800 0H17a.8.8 0 0 1 .8.8v12.4a.8.8 0 0 1-.8.8h-3.200a.8.8 0 0 1-.8-.8V5.800a.8.8 0 0 1 .8-.8z'),
        close: I('M6.700 5.300a1 1 0 0 0-1.400 1.400L10.600 12l-5.300 5.300a1 1 0 1 0 1.400 1.400L12 13.400l5.300 5.300a1 1 0 0 0 1.400-1.400L13.400 12l5.300-5.300a1 1 0 0 0-1.400-1.400L12 10.600z'),
        back: I('M5 4h6a1 1 0 1 1 0 2H7.400l4.300 4.300a1 1 0 0 1-1.400 1.400L6 7.400V11a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1zm8 9a1 1 0 0 1 1.700-.7L19 16.600V13a1 1 0 1 1 2 0v6a1 1 0 0 1-1 1h-6a1 1 0 1 1 0-2h3.600l-4.300-4.300A1 1 0 0 1 13 13z'),
        sound: I('M4 9.500h3l4.300-3.600a.8.8 0 0 1 1.300.6v11a.8.8 0 0 1-1.300.6L7 14.500H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1zm12.300-.2a1 1 0 0 1 1.400 0l1.300 1.300 1.300-1.300a1 1 0 1 1 1.400 1.400L20.400 12l1.300 1.300a1 1 0 0 1-1.400 1.400L19 13.400l-1.300 1.300a1 1 0 0 1-1.400-1.400l1.300-1.300-1.300-1.300a1 1 0 0 1 0-1.400z'),
    };

    function style() {
        if (document.getElementById('ov-mini-style')) return;
        const st = document.createElement('style');
        st.id = 'ov-mini-style';
        st.textContent = `
.ovmini { --mc: var(--accent, #3b82f6); box-sizing: border-box; position: fixed; z-index: var(--ovb-z-mini, 9991); left: max(16px, env(safe-area-inset-left, 0px)); bottom: calc(max(16px, env(safe-area-inset-bottom, 0px)) + var(--ovb-bar, var(--ovnav-appbar-h, 0px))); translate: 0 calc(-1 * var(--ovb-lift, 0px)); width: 340px; max-width: calc(100vw - 32px); display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; column-gap: 2px; border: 1px solid var(--border, #1f2d47); border-radius: 16px; background: var(--bg-elevated, var(--bg-card, #101828)); color: var(--text-primary, #e6edf7); box-shadow: 0 18px 44px -18px rgba(0, 0, 0, .7), 0 2px 8px rgba(0, 0, 0, .25); overflow: hidden; font: 500 .88rem/1.3 var(--font-sans, system-ui, sans-serif); animation: ovmini-in .28s cubic-bezier(.2, .7, .2, 1) both; }
.ovmini-pic { position: relative; grid-column: 1 / -1; display: block; aspect-ratio: 16 / 9; background: #000; cursor: pointer; }
.ovmini-pic video { display: block; width: 100%; height: 100%; object-fit: contain; background: #000; }
.ovmini-back { position: absolute; left: 8px; top: 8px; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px 0 8px; border: 0; border-radius: 999px; background: rgba(5, 8, 15, .72); color: #fff; font: 600 .76rem/1 var(--font-sans, system-ui, sans-serif); text-decoration: none; opacity: 0; transition: opacity .16s ease; }
.ovmini:hover .ovmini-back, .ovmini-back:focus-visible { opacity: 1; }
.ovmini-sound { position: absolute; right: 8px; top: 8px; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px 0 8px; border: 0; border-radius: 999px; background: var(--mc); color: var(--on-accent, #fff); font: 700 .76rem/1 var(--font-sans, system-ui, sans-serif); cursor: pointer; }
.ovmini-sound[hidden] { display: none; }
.ovmini-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255, 255, 255, .22); }
.ovmini-bar i { display: block; height: 100%; width: 0; background: var(--mc); transition: width .25s linear; }
.ovmini-text { min-width: 0; padding: 9px 4px 10px 14px; color: inherit; text-decoration: none; }
.ovmini-title { display: block; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ovmini-by { display: block; font-size: .76rem; color: var(--text-secondary, #96a7c2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ovmini-btn { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 12px; background: none; color: inherit; cursor: pointer; transition: background-color .15s ease, transform .12s ease; }
.ovmini-btn:hover { background: color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent); }
.ovmini-btn:active { transform: scale(.92); }
.ovmini-btn:focus-visible, .ovmini-back:focus-visible, .ovmini-sound:focus-visible, .ovmini-text:focus-visible { outline: 2px solid var(--mc); outline-offset: 2px; }
.ovmini-btn:last-child { margin-right: 4px; }
.ovmini-btn[hidden] { display: none; }
.ovmini.is-broken .ovmini-bar { visibility: hidden; }
.ovmini.is-leaving { animation: ovmini-out .18s ease both; }
@keyframes ovmini-in { from { opacity: 0; transform: translateY(14px) scale(.98); } }
@keyframes ovmini-out { to { opacity: 0; transform: translateY(10px); } }
@media (max-width: 640px) {
  /* A phone: one bar above the app bar. The picture at its left, then what is playing, then play and close. */
  .ovmini { left: 8px; right: 8px; width: auto; max-width: none; bottom: calc(8px + var(--ovb-base, var(--ovnav-appbar-h, env(safe-area-inset-bottom, 0px)))); grid-template-columns: auto minmax(0, 1fr) auto auto; border-radius: 14px; }
  .ovmini-pic { grid-column: 1; width: 112px; aspect-ratio: 16 / 9; }
  .ovmini-back { display: none; }
  .ovmini-sound { left: 4px; right: auto; top: auto; bottom: 7px; min-height: 26px; padding: 0 8px 0 5px; font-size: .68rem; }
  .ovmini-sound span { display: none; }
  .ovmini-bar { position: static; grid-column: 1 / -1; grid-row: 2; }
  .ovmini-pic .ovmini-bar { display: none; }
  .ovmini-text { padding: 6px 2px 6px 10px; }
}
@media (min-width: 641px) { .ovmini > .ovmini-bar { display: none; } }
html[data-ov-motion=reduced] .ovmini { animation: ovmini-fade .2s ease both; }
html[data-ov-motion=off] .ovmini, html[data-ov-motion=off] .ovmini.is-leaving { animation: none; }
html[data-ov-motion=off] .ovmini-bar i { transition: none; }
@media (prefers-reduced-motion: reduce) { html:not([data-ov-motion]) .ovmini { animation: ovmini-fade .2s ease both; } }
@keyframes ovmini-fade { from { opacity: 0; } }
@media print { .ovmini { display: none; } }`;
        document.head.appendChild(st);
    }

    function note(r) {
        // Not before the element has taken the record's second: its first events (a volume set, a duration known) would
        // write second 0 and "paused" over what came along.
        if (!video || !live) return;
        r.t = video.currentTime || 0;
        r.playing = !video.paused && !video.ended;
        r.vol = video.volume; r.muted = video.muted; r.rate = video.playbackRate;
        if (isFinite(video.duration)) r.dur = video.duration;
        r.at = Date.now();
        save(r);
    }

    /** Draw the small player for a record and go on from its second. */
    function open(r) {
        if (!r || !r.src) return null;
        close(true);
        live = false;
        style();
        const back = () => { const u = new URL(r.page, root.location.href); return u.pathname + u.search + u.hash; };
        el = document.createElement('aside');
        el.className = 'ovmini';
        el.setAttribute('aria-label', `Still playing: ${r.title || 'a video'}`);
        el.innerHTML = `<a class="ovmini-pic" data-m="back" aria-label="Back to the video"><video playsinline preload="auto"></video><span class="ovmini-back">${ICON.back}Back to the video</span><button type="button" class="ovmini-sound" data-m="sound" hidden>${ICON.sound}<span>Turn the sound on</span></button><span class="ovmini-bar"><i></i></span></a>`
            + '<a class="ovmini-text" data-m="back"><span class="ovmini-title"></span><span class="ovmini-by"></span></a>'
            + `<button type="button" class="ovmini-btn" data-m="play" aria-label="Play">${ICON.play}</button><button type="button" class="ovmini-btn" data-m="close" aria-label="Close the video">${ICON.close}</button><span class="ovmini-bar"><i></i></span>`;
        el.querySelector('.ovmini-title').textContent = r.title || 'Video';
        const by = el.querySelector('.ovmini-by');
        video = el.querySelector('video');
        if (r.poster) video.poster = r.poster;
        const playBtn = el.querySelector('[data-m="play"]'); const soundBtn = el.querySelector('[data-m="sound"]');
        const bars = el.querySelectorAll('.ovmini-bar i');
        const paint = () => {
            if (!video) return;
            const on = !video.paused && !video.ended;
            playBtn.innerHTML = on ? ICON.pause : ICON.play;
            playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
            const d = isFinite(video.duration) && video.duration > 0 ? video.duration : (r.dur || 0);
            const pct = d ? Math.min(100, (video.currentTime / d) * 100) : 0;
            bars.forEach((b) => { b.style.width = pct.toFixed(2) + '%'; });
            if (!el.classList.contains('is-broken')) by.textContent = [r.by, d ? `${clock(video.currentTime)} / ${clock(d)}` : clock(video.currentTime)].filter(Boolean).join(' · ');
            soundBtn.hidden = !(video.muted && on && r.wantSound);
        };
        el.querySelectorAll('[data-m="back"]').forEach((a) => { a.href = back(); });
        el.addEventListener('click', (e) => {
            const t = e.target.closest('[data-m]'); if (!t) return;
            const m = t.getAttribute('data-m');
            if (m === 'play') { if (video.paused) video.play().catch(() => {}); else video.pause(); }
            else if (m === 'sound') { e.preventDefault(); e.stopPropagation(); video.muted = false; r.wantSound = false; paint(); }
            else if (m === 'close') close();
            else if (m === 'back') note(r);       // the page it came from takes the second back (resume())
        });
        video.addEventListener('timeupdate', () => { paint(); if (Date.now() - saved > 1000) { saved = Date.now(); note(r); } });
        ['play', 'pause', 'ended', 'volumechange', 'ratechange', 'durationchange'].forEach((t) => video.addEventListener(t, () => { paint(); note(r); }));
        // A file that cannot be played here: say so, keep the way back, and do not follow the person to the next page.
        video.addEventListener('error', () => {
            if (!video) return;
            // The playlist failed: the file, from the same second, once.
            if (onPlaylist && r.src) { onPlaylist = false; if (live && video.currentTime > 0) r.t = video.currentTime; live = false; arm(); source(); return; }
            live = false; forget(); playBtn.hidden = true; soundBtn.hidden = true; by.textContent = 'Open its page to keep watching'; el.classList.add('is-broken');
        });
        const arm = () => video.addEventListener('loadedmetadata', () => {
            try { if (r.t > 0 && (!isFinite(video.duration) || r.t < video.duration - 0.25)) video.currentTime = r.t; } catch { /* not seekable yet: it starts where it can */ }
            video.playbackRate = r.rate || 1;
            const was = r.playing;
            live = true;
            if (!was) { paint(); return; }
            // With its sound where the browser lets a new page make sound; else silent, with the way to turn it on.
            video.play().catch(() => { r.wantSound = !r.muted; video.muted = true; return video.play(); }).catch(() => {}).then(paint);
        }, { once: true });
        // What the page plays: its playlist where the browser plays one by itself (a signed playlist is served without
        // CORS, as on the page), else the file.
        let onPlaylist = !!(r.hls && video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl'));
        const source = () => {
            if (onPlaylist) { if (!/[?&]sig=/.test(r.hls)) video.crossOrigin = 'anonymous'; video.src = r.hls; }
            else { video.removeAttribute('crossorigin'); video.src = r.src; }
        };
        video.volume = typeof r.vol === 'number' ? r.vol : 1;
        video.muted = !!r.muted;
        arm(); source();
        document.body.appendChild(el);
        if (root.OpenVibeBottom) root.OpenVibeBottom.refresh();
        root.addEventListener('pagehide', leave);
        document.addEventListener('play', other, true);
        paint();
        return el;
        function leave() { note(r); }
        function other(e) { if (e.target !== video && e.target && e.target.matches && e.target.matches('video[data-ov-player], audio[data-ov-player]')) close(); }
    }

    /** Stop and forget. `quiet` keeps the record (a redraw). */
    function close(quiet) {
        if (!el) { if (!quiet) forget(); return; }
        const node = el; const v = video;
        el = null; video = null; live = false;
        if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* already gone */ } }
        if (!quiet) forget();
        const off = () => { node.remove(); if (root.OpenVibeBottom) root.OpenVibeBottom.refresh(); };
        if (quiet || document.documentElement.getAttribute('data-ov-motion') === 'off') off();
        else { node.classList.add('is-leaving'); node.addEventListener('animationend', off, { once: true }); root.setTimeout(off, 260); }
    }

    /** Take a page's video along: write down what is playing and go to the site's front page (or `to`). */
    function carry(v, o = {}) {
        if (!v || !v.getAttribute) return false;
        const d = v.dataset || {};
        let src = d.ovMiniSrc || v.getAttribute('src') || '';
        if (!src || /^blob:/.test(src)) src = /^blob:/.test(v.currentSrc || '') ? '' : (v.currentSrc || '');
        if (!src) return false;
        save({
            page: d.ovMiniPage || (root.location.pathname + root.location.search), src: new URL(src, root.location.href).href, hls: d.ovMiniHls ? new URL(d.ovMiniHls, root.location.href).href : '',
            title: d.ovMiniTitle || document.title, by: d.ovMiniBy || '', poster: v.poster || '',
            t: v.currentTime || 0, dur: isFinite(v.duration) ? v.duration : 0, rate: v.playbackRate || 1, vol: v.volume, muted: v.muted,
            playing: !v.paused && !v.ended, at: Date.now(),
        });
        if (!record()) return false;          // no store in this browser: the browser's own window is still there
        try { v.pause(); } catch { /* it stops with the page */ }
        root.location.assign(o.to || d.ovMiniTo || '/');
        return true;
    }

    /** On a page's load: the video's own page takes its second back; any other page of the site goes on playing it. */
    function resume() {
        const r = record();
        if (!r) return null;
        if (Date.now() - (r.at || 0) > OLD) { forget(); return null; }
        if (samePage(r.page)) {
            forget();
            const v = document.querySelector('video[data-ov-mini]');
            if (v) {
                const go = () => { try { v.currentTime = r.t || 0; } catch { /* it starts at the beginning */ } if (r.playing) v.play().catch(() => {}); };
                if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
            }
            return null;
        }
        return open(r);
    }

    root.OpenVibeMini = { carry, open, resume, close, record };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resume, { once: true }); else resume();
}(typeof window !== 'undefined' ? window : globalThis));
