/*
 * OpenVibe player: one look for every <video> across the network (owner, 2026-10-20: "override the default style of
 * video players across all our sites and vods … for a more unified look").
 *
 *   <link rel="stylesheet" href="/shared/player.css">
 *   <video data-ov-player controls src="…" poster="…" preload="metadata" playsinline></video>
 *   <script src="/shared/player.js" defer></script>
 *
 * Progressive: without this script the browser's own controls stay. With it, each video[data-ov-player] is wrapped
 * in .ov-player and gets the network's controls: a scrubber (buffered, played, the time under the pointer), play,
 * volume, time, captions, speed, picture-in-picture and fullscreen, hidden while playing and idle. Keys while the
 * player has focus: Space/K play, J/L ±10 s, ←/→ ±5 s, ↑/↓ volume, M mute, F fullscreen, C captions, 0–9 jump to that
 * tenth. On touch a tap shows the controls and a double tap on either side seeks ±10 s.
 *
 * Sound: a video playing muted (autoplay) shows "Tap for sound"; the first tap on it unmutes, and so do the media
 * volume keys where a browser passes them to the page (desktop keyboards, TVs; phones keep their hardware buttons to
 * themselves, so no page can see those). Lock screens and headsets get play/pause/seek through the Media Session API.
 * On a touch screen the volume slider shows, finger-sized, wherever the page can set the volume (Android; an iPhone
 * leaves volume to its own buttons, so it keeps the mute button alone). A video with no sound track says so ("No sound
 * in this video", a dimmed speaker) instead of offering a mute button that seems broken.
 *
 * Loading looks like it is already there (owner, 2026-10-25): data-ov-color paints the average colour at once,
 * data-ov-thumb (a tiny inline image) shows blurred, the poster sharpens over it, and the first frame fades in.
 * data-ov-ambient adds a soft glow of the picture around the player (YouTube's ambient mode: a low-resolution sample
 * every 0.7 s, blurred and crossfaded; off for reduced motion and data saver).
 *
 * It only drives the media element (play, currentTime, volume, …) and listens to its events, so a page's own script
 * (HLS attachment, chapters, next-up, view counts) keeps working on the same element. OpenVibePlayer.enhance(video)
 * for a video added later; enhance() is idempotent.
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || window.OpenVibePlayer) return;

    const SVG = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="${d}"/></svg>`;
    // Material Icons Round (Apache-2.0): one filled, rounded set, so every control reads at the same weight.
    const ICON = {
        play: SVG('M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.69L9.54 5.98A.998.998 0 0 0 8 6.82z'),
        pause: SVG('M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z'),
        replay: SVG('M12 5V2.21c0-.45-.54-.67-.85-.35l-3.8 3.79c-.2.2-.2.51 0 .71l3.79 3.79c.32.31.86.09.86-.36V7c3.73 0 6.68 3.42 5.86 7.29-.47 2.27-2.31 4.1-4.57 4.57-3.57.75-6.75-1.7-7.23-5.01a1 1 0 0 0-.98-.85c-.6 0-1.08.53-1 1.13.62 4.39 4.8 7.64 9.53 6.72 3.12-.61 5.63-3.12 6.24-6.24C20.84 9.48 16.94 5 12 5z'),
        volume: SVG('M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4c-.55 0-1 .45-1 1zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 4.45v.2c0 .38.25.71.6.85C17.18 6.53 19 9.06 19 12s-1.82 5.47-4.4 6.5c-.36.14-.6.47-.6.85v.2c0 .63.63 1.07 1.21.85C18.6 19.11 21 15.84 21 12s-2.4-7.11-5.79-8.4c-.58-.23-1.21.22-1.21.85z'),
        low: SVG('M16.5 12A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L9 9H6c-.55 0-1 .45-1 1z'),
        muted: SVG('M3.63 3.63a.996.996 0 0 0 0 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 1 0 1.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0 0 14 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z'),
        cc: SVG('M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 6.5a.5.5 0 0 1-.5.5h-.5a.5.5 0 0 1-.5-.5h-2v3h2a.5.5 0 0 1 .5-.5h.5a.5.5 0 0 1 .5.5v.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.5zm7 0a.5.5 0 0 1-.5.5h-.5a.5.5 0 0 1-.5-.5h-2v3h2a.5.5 0 0 1 .5-.5h.5a.5.5 0 0 1 .5.5v.5a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.5z'),
        pip: SVG('M18 11h-6c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1zm5 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-3 .02H4c-.55 0-1-.45-1-1V5.97c0-.55.45-1 1-1h16c.55 0 1 .45 1 1v12.05c0 .55-.45 1-1 1z'),
        full: SVG('M6 14c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h3c.55 0 1-.45 1-1s-.45-1-1-1H7v-2c0-.55-.45-1-1-1zm0-4c.55 0 1-.45 1-1V7h2c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1zm11 7h-2c-.55 0-1 .45-1 1s.45 1 1 1h3c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1s-1 .45-1 1v2zM14 6c0 .55.45 1 1 1h2v2c0 .55.45 1 1 1s1-.45 1-1V6c0-.55-.45-1-1-1h-3c-.55 0-1 .45-1 1z'),
        exit: SVG('M6 16h2v2c0 .55.45 1 1 1s1-.45 1-1v-3c0-.55-.45-1-1-1H6c-.55 0-1 .45-1 1s.45 1 1 1zm2-8H6c-.55 0-1 .45-1 1s.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1s-1 .45-1 1v2zm7 11c.55 0 1-.45 1-1v-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-3c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1zm1-11V6c0-.55-.45-1-1-1s-1 .45-1 1v3c0 .55.45 1 1 1h3c.55 0 1-.45 1-1s-.45-1-1-1h-2z'),
        fwd: SVG('M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z'),
        back: SVG('M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z'),
    };
    const SPEEDS = [1, 1.25, 1.5, 2, 0.5, 0.75];
    const VOLUME_KEY = 'ov-player-volume';

    function fmt(s) {
        if (!Number.isFinite(s) || s < 0) s = 0;
        s = Math.floor(s);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
    }
    function stored() {
        try { const v = JSON.parse(localStorage.getItem(VOLUME_KEY) || 'null'); return v && Number.isFinite(v.volume) ? v : null; } catch { return null; }
    }
    function store(video) {
        try { localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume: video.volume, muted: video.muted })); } catch { /* private window */ }
    }
    function el(tag, cls, attrs) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
        return e;
    }
    function button(cls, label, icon) {
        const b = el('button', `ov-player-btn ${cls}`, { type: 'button', 'aria-label': label, title: label });
        b.innerHTML = icon;
        return b;
    }
    /** Whether this browser lets a page set a media element's volume (an iPhone's Safari does not: only muted). */
    function volumeSettable(video) {
        const was = video.volume;
        try {
            video.volume = was > 0.5 ? was - 0.1 : was + 0.1;
            const ok = Math.abs(video.volume - was) > 0.01;
            video.volume = was;
            return ok;
        } catch { return false; }
    }
    const captionTrack = (video) => Array.from(video.textTracks || []).find((t) => t.kind === 'captions' || t.kind === 'subtitles') || null;
    const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    // The media volume keys, where the browser passes them to the page (UI Events key names, and the older ones).
    const VOLUME_KEYS = /^(AudioVolume(Up|Down|Mute)|Volume(Up|Down|Mute))$/;
    let current = null;   // the player last played or touched: the one the page-wide keys drive
    function volumeKey(api, k) {
        const v = api.video;
        if (/Mute$/.test(k)) api.toggleMute();
        else if (/Up$/.test(k)) { if (v.muted) api.unmute(); else api.setVolume(v.volume + 0.1); }
        else api.setVolume(v.volume - 0.1);
    }
    document.addEventListener('keydown', (e) => {
        if (!current || !VOLUME_KEYS.test(e.key) || current.root.contains(e.target)) return;
        const t = e.target && e.target.tagName;
        if (t === 'INPUT' || t === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
        volumeKey(current, e.key);
    });

    /** An image, asked for with CORS so its pixels can be read; without CORS it still loads, only unread. */
    function loadImage(src, done) {
        if (typeof Image !== 'function') return;
        const img = new Image();
        img.decoding = 'async';
        img.crossOrigin = 'anonymous';
        img.onload = () => done(img);
        img.onerror = () => { if (!img.crossOrigin) return; img.crossOrigin = null; img.removeAttribute('crossorigin'); img.src = src; };
        img.src = src;
    }

    /** The average colour of a loaded image (a preview or a poster), when the browser lets the page read it. */
    function averageColor(img, done) {
        try {
            const c = document.createElement('canvas'); c.width = 8; c.height = 8;
            const g = c.getContext('2d');
            g.drawImage(img, 0, 0, 8, 8);
            const d = g.getImageData(0, 0, 8, 8).data;
            let r = 0, gr = 0, b = 0;
            for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
            const n = d.length / 4;
            done(`rgb(${Math.round(r / n)}, ${Math.round(gr / n)}, ${Math.round(b / n)})`);
        } catch { /* a poster from another origin without CORS: the default stays */ }
    }

    /**
     * The ambient glow: two small canvases behind the player, painted from the video every 0.7 s while it plays and is
     * on screen, blurred and crossfaded by player.css. A cross-origin video taints a canvas, which can still be shown.
     */
    function glow(root, video) {
        const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const saver = typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData;
        const probe = document.createElement('canvas');
        if (reduce || saver || typeof probe.getContext !== 'function' || !probe.getContext('2d')) return null;
        const wrap = el('div', 'ov-player-ambient', { 'aria-hidden': 'true' });
        const a = el('canvas'), b = el('canvas');
        [a, b].forEach((c) => { c.width = 32; c.height = 18; });
        wrap.append(a, b);
        root.parentNode.insertBefore(wrap, root);
        root.parentNode.classList.add('ov-player-host');
        let front = a, timer = 0, visible = true;
        const paint = (src) => {
            const back = front === a ? b : a;
            try { back.getContext('2d').drawImage(src, 0, 0, back.width, back.height); } catch { return; }
            back.classList.add('is-front'); front.classList.remove('is-front'); front = back;
        };
        if (typeof IntersectionObserver === 'function') new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(root);
        return {
            still(img) { paint(img); wrap.classList.add('is-on'); },
            start() { clearInterval(timer); wrap.classList.add('is-on'); timer = setInterval(() => { if (visible && !document.hidden && video.readyState >= 2) paint(video); }, 700); },
            stop() { clearInterval(timer); },
        };
    }

    /** Lock screen, headset and notification controls (Media Session) for the player that is playing. */
    function session(api, options) {
        const ms = typeof navigator !== 'undefined' && navigator.mediaSession;
        if (!ms) return;
        try {
            const v = api.video;
            const art = v.getAttribute('poster');
            if (typeof MediaMetadata === 'function') ms.metadata = new MediaMetadata({ title: options.title || v.getAttribute('data-ov-title') || v.getAttribute('aria-label') || document.title, artist: options.artist || v.getAttribute('data-ov-artist') || '', artwork: art ? [{ src: art }] : [] });
            ms.setActionHandler('play', () => api.toggle());
            ms.setActionHandler('pause', () => api.toggle());
            ms.setActionHandler('seekbackward', () => api.skip(-10));
            ms.setActionHandler('seekforward', () => api.skip(10));
            ms.setActionHandler('seekto', (d) => { if (d && Number.isFinite(d.seekTime)) api.seek(d.seekTime); });
        } catch { /* an action this browser does not know */ }
    }

    function enhance(video, options = {}) {
        if (!video || video.__ovPlayer) return video && video.__ovPlayer;
        const idleMs = options.idleMs || 2500;
        const root = el('div', 'ov-player is-paused is-start', { tabindex: '0', role: 'region', 'aria-label': options.label || video.getAttribute('aria-label') || 'Video player' });
        video.parentNode.insertBefore(root, video);
        root.appendChild(video);
        video.controls = false;
        video.removeAttribute('controls');
        video.classList.add('ov-player-video');
        // Loading: the average colour now, a tiny blurred preview, then the poster, then the first frame.
        const color = video.getAttribute('data-ov-color');
        if (/^#[0-9a-f]{3,8}$/i.test(color || '')) root.style.setProperty('--ovp-bg', color);
        const thumb = video.getAttribute('data-ov-thumb');
        const placeholder = el('div', 'ov-player-placeholder', { 'aria-hidden': 'true' });
        if (/^(data:image\/|https:\/\/)/.test(thumb || '')) {
            placeholder.style.backgroundImage = `url("${thumb.replace(/"/g, '%22')}")`;
            root.classList.add('has-thumb');
            // No colour given: the preview's average, which arrives first (a few hundred bytes).
            if (!/^#[0-9a-f]{3,8}$/i.test(color || '')) loadImage(thumb, (img) => averageColor(img, (c) => root.style.setProperty('--ovp-bg', c)));
        }
        const posterLayer = el('div', 'ov-player-poster', { 'aria-hidden': 'true' });
        root.insertBefore(placeholder, video);
        root.insertBefore(posterLayer, video);
        const shown = () => root.classList.add('has-frame');
        if (video.readyState >= 2) shown(); else video.addEventListener('loadeddata', shown, { once: true });

        // ── Build ────────────────────────────────────────────
        const big = button('ov-player-big', 'Play', ICON.play);
        const spinner = el('div', 'ov-player-spinner', { 'aria-hidden': 'true' });
        const message = el('div', 'ov-player-message', { role: 'status' });
        const bar = el('div', 'ov-player-bar');
        const scrub = el('div', 'ov-player-scrub', { role: 'slider', tabindex: '0', 'aria-label': 'Seek', 'aria-valuemin': '0', 'aria-valuemax': '0', 'aria-valuenow': '0', 'aria-valuetext': '0:00 of 0:00' });
        const track = el('div', 'ov-player-track');
        const buffered = el('div', 'ov-player-buffered');
        const played = el('div', 'ov-player-played');
        const hover = el('div', 'ov-player-hover', { 'aria-hidden': 'true' });
        track.append(buffered, played);
        scrub.append(track, hover);
        const row = el('div', 'ov-player-row');
        const playBtn = button('ov-player-play', 'Play (k)', ICON.play);
        const volWrap = el('div', 'ov-player-volume');
        const muteBtn = button('ov-player-mute', 'Mute (m)', ICON.volume);
        const volSlider = el('input', 'ov-player-volume-slider', { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': 'Volume' });
        volWrap.append(muteBtn, volSlider);
        const time = el('div', 'ov-player-time', { 'aria-hidden': 'true' });
        const spacer = el('div', 'ov-player-spacer');
        const ccBtn = button('ov-player-cc', 'Captions (c)', ICON.cc);
        const speedBtn = el('button', 'ov-player-btn ov-player-speed', { type: 'button', 'aria-label': 'Playback speed: 1×', title: 'Playback speed' });
        speedBtn.textContent = '1×';
        const pipBtn = button('ov-player-pip', 'Picture in picture', ICON.pip);
        const fullBtn = button('ov-player-full', 'Fullscreen (f)', ICON.full);
        row.append(playBtn, volWrap, time, spacer, ccBtn, speedBtn, pipBtn, fullBtn);
        bar.append(scrub, row);
        const unmute = el('button', 'ov-player-unmute', { type: 'button', hidden: '' });
        unmute.innerHTML = `${ICON.muted}<span>Tap for sound</span>`;
        const flash = el('div', 'ov-player-flash', { 'aria-hidden': 'true' });
        root.append(spinner, big, message, unmute, flash, bar);
        const ambient = video.hasAttribute('data-ov-ambient') || options.ambient ? glow(root, video) : null;
        const poster = video.getAttribute('poster');
        if (poster) loadImage(poster, (img) => {
            posterLayer.style.backgroundImage = `url("${poster.replace(/"/g, '%22')}")`;
            root.classList.add('has-poster');
            if (!color && !thumb) averageColor(img, (c) => root.style.setProperty('--ovp-bg', c));
            if (ambient) ambient.still(img);
        });

        const pipOk = typeof document !== 'undefined' && document.pictureInPictureEnabled && !video.disablePictureInPicture;
        if (!pipOk) pipBtn.hidden = true;
        const fsOk = !!(root.requestFullscreen || root.webkitRequestFullscreen || video.webkitEnterFullscreen);
        if (!fsOk) fullBtn.hidden = true;

        const saved = stored();
        if (saved && !video.hasAttribute('muted')) { video.volume = Math.min(1, Math.max(0, saved.volume)); video.muted = !!saved.muted; }
        // Muted by the page (autoplay) rather than by the viewer: the first tap or a volume key brings the sound in.
        let pageMuted = video.muted && (video.hasAttribute('muted') || video.autoplay || !saved || !saved.muted);
        if (volumeSettable(video)) root.classList.add('can-volume');
        // No sound track (a recording whose microphone never reached the recorder: VOD 5986, 2026-10-25). Only a browser
        // that can tell says so: Firefox (mozHasAudio), Chrome and Safari (no audio decoded after 2 s of decoded video,
        // which they count muted or not). A new source asks again.
        let silent = false;
        let soundKnown = false;
        let playedFrom = null;

        // ── State → UI ───────────────────────────────────────
        const duration = () => (Number.isFinite(video.duration) ? video.duration : 0);
        function paintTime() {
            const d = duration(), t = video.currentTime || 0;
            time.textContent = d ? `${fmt(t)} / ${fmt(d)}` : fmt(t);
            played.style.width = d ? `${Math.min(100, (t / d) * 100)}%` : '0%';
            scrub.setAttribute('aria-valuemax', String(Math.floor(d)));
            scrub.setAttribute('aria-valuenow', String(Math.floor(t)));
            scrub.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(d)}`);
        }
        function paintBuffered() {
            const d = duration(), b = video.buffered;
            if (!d || !b || !b.length) { buffered.style.width = '0%'; return; }
            let end = 0;
            for (let i = 0; i < b.length; i++) if (b.start(i) <= video.currentTime + 0.5) end = Math.max(end, b.end(i));
            buffered.style.width = `${Math.min(100, (end / d) * 100)}%`;
        }
        function paintPlay() {
            const paused = video.paused || video.ended;
            root.classList.toggle('is-paused', paused);
            root.classList.toggle('is-ended', video.ended);
            playBtn.innerHTML = video.ended ? ICON.replay : paused ? ICON.play : ICON.pause;
            const label = video.ended ? 'Replay' : paused ? 'Play (k)' : 'Pause (k)';
            playBtn.setAttribute('aria-label', label); playBtn.title = label;
            big.innerHTML = video.ended ? ICON.replay : ICON.play;
            big.setAttribute('aria-label', video.ended ? 'Replay' : 'Play');
            if (paused) wake();
        }
        function paintVolume() {
            const v = video.muted ? 0 : video.volume;
            unmute.hidden = silent || !(video.muted && pageMuted && !video.paused);
            root.classList.toggle('is-muted', video.muted || v === 0);
            root.classList.toggle('is-silent', silent);
            muteBtn.innerHTML = silent || v === 0 ? ICON.muted : v < 0.5 ? ICON.low : ICON.volume;
            const label = silent ? 'No sound in this video' : video.muted || v === 0 ? 'Unmute (m)' : 'Mute (m)';
            muteBtn.setAttribute('aria-label', label); muteBtn.title = label;
            volSlider.value = String(v);
            volSlider.style.setProperty('--ovp-fill', `${v * 100}%`);
        }
        function paintCaptions() {
            const t = captionTrack(video);
            ccBtn.hidden = !t;
            ccBtn.classList.toggle('is-on', !!t && t.mode === 'showing');
            ccBtn.setAttribute('aria-pressed', t && t.mode === 'showing' ? 'true' : 'false');
        }
        function paintSpeed() {
            const r = video.playbackRate || 1;
            speedBtn.textContent = `${r}×`;
            speedBtn.setAttribute('aria-label', `Playback speed: ${r}×`);
        }
        function paintFull() {
            const on = fullscreenElement() === root;
            root.classList.toggle('is-fullscreen', on);
            fullBtn.innerHTML = on ? ICON.exit : ICON.full;
            const label = on ? 'Exit fullscreen (f)' : 'Fullscreen (f)';
            fullBtn.setAttribute('aria-label', label); fullBtn.title = label;
        }

        // ── Idle: controls hide while playing and nothing moves ──
        let idleTimer = 0;
        function wake() {
            root.classList.remove('is-idle');
            clearTimeout(idleTimer);
            // Not while a control in the bar has focus (keyboard use) or the pointer is scrubbing.
            if (!video.paused && !video.ended) idleTimer = setTimeout(() => { if (!video.paused && !bar.contains(document.activeElement) && !dragging) root.classList.add('is-idle'); }, idleMs);
        }

        // ── Actions ──────────────────────────────────────────
        const api = {
            root, video,
            toggle() {
                if (video.paused || video.ended) { const p = video.play(); if (p && p.catch) p.catch(() => paintPlay()); } else video.pause();
            },
            seek(t) { const d = duration(); if (!d) return; video.currentTime = Math.min(d, Math.max(0, t)); paintTime(); },
            skip(s) { api.seek((video.currentTime || 0) + s); show(s < 0 ? ICON.back : ICON.fwd, `${s > 0 ? '+' : ''}${s} s`, s < 0 ? 'left' : 'right'); },
            setVolume(v) { pageMuted = false; video.volume = Math.min(1, Math.max(0, v)); video.muted = video.volume === 0; store(video); show(video.muted ? ICON.muted : video.volume < 0.5 ? ICON.low : ICON.volume, `${Math.round(video.volume * 100)}%`); },
            toggleMute() { pageMuted = false; if (video.muted && video.volume === 0) video.volume = 0.5; video.muted = !video.muted; store(video); },
            /** Sound on, at the remembered level (full when that was zero). */
            unmute() { pageMuted = false; if (video.volume === 0) video.volume = 1; video.muted = false; store(video); show(ICON.volume, `${Math.round(video.volume * 100)}%`); },
            toggleCaptions() { const t = captionTrack(video); if (t) { t.mode = t.mode === 'showing' ? 'hidden' : 'showing'; paintCaptions(); } },
            nextSpeed() { const i = SPEEDS.indexOf(video.playbackRate); video.playbackRate = SPEEDS[(i + 1) % SPEEDS.length]; paintSpeed(); },
            togglePip() {
                if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
                else if (video.requestPictureInPicture) video.requestPictureInPicture().catch(() => {});
            },
            toggleFullscreen() {
                if (fullscreenElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
                else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
                else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
                else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
            },
        };
        video.__ovPlayer = api;

        // A short sign in the middle: a seek, a volume level (the double tap and the keys).
        let flashTimer = 0;
        function show(icon, text, side, ms = 650) {
            flash.className = `ov-player-flash is-on${side ? ` is-${side}` : ''}`;
            flash.innerHTML = `${icon}<span>${text}</span>`;
            clearTimeout(flashTimer);
            flashTimer = setTimeout(() => { flash.className = 'ov-player-flash'; }, ms);
        }
        function checkSound() {
            if (soundKnown || video.paused) return;
            let none = null;
            if (typeof video.mozHasAudio === 'boolean' && video.readyState >= 2) none = !video.mozHasAudio;
            else if (typeof video.webkitAudioDecodedByteCount === 'number' && video.webkitVideoDecodedByteCount > 0
                && playedFrom != null && (video.currentTime || 0) - playedFrom >= 2) none = video.webkitAudioDecodedByteCount === 0;
            if (none == null) return;
            soundKnown = true;
            if (!none) return;
            silent = true;
            paintVolume();
            show(ICON.muted, 'No sound in this video', null, 2600);
        }
        unmute.addEventListener('click', (e) => { e.stopPropagation(); api.unmute(); });
        big.addEventListener('click', () => api.toggle());
        playBtn.addEventListener('click', () => api.toggle());
        muteBtn.addEventListener('click', () => { if (silent) show(ICON.muted, 'No sound in this video', null, 2600); else api.toggleMute(); });
        volSlider.addEventListener('input', () => api.setVolume(Number(volSlider.value)));
        ccBtn.addEventListener('click', () => api.toggleCaptions());
        speedBtn.addEventListener('click', () => api.nextSpeed());
        pipBtn.addEventListener('click', () => api.togglePip());
        fullBtn.addEventListener('click', () => api.toggleFullscreen());

        // Scrubbing: click or drag; the time under the pointer shows above it.
        const atPointer = (e) => {
            const r = track.getBoundingClientRect();
            return Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1))) * duration();
        };
        let dragging = false;
        scrub.addEventListener('pointerdown', (e) => {
            if (!duration()) return;
            dragging = true;
            root.classList.add('is-scrubbing');
            if (scrub.setPointerCapture && e.pointerId != null) { try { scrub.setPointerCapture(e.pointerId); } catch { /* */ } }
            api.seek(atPointer(e));
        });
        scrub.addEventListener('pointermove', (e) => {
            const d = duration();
            if (!d) return;
            const t = atPointer(e);
            const r = track.getBoundingClientRect();
            hover.textContent = fmt(t);
            hover.style.left = `${((t / d) * (r.width || 0))}px`;
            if (dragging) api.seek(t);
        });
        const endDrag = () => { dragging = false; root.classList.remove('is-scrubbing'); };
        scrub.addEventListener('pointerup', endDrag);
        scrub.addEventListener('pointercancel', endDrag);

        // The picture: a click plays or pauses (mouse); a tap shows the controls, a double tap seeks ±10 s (touch).
        let lastTap = 0;
        video.addEventListener('pointerup', (e) => {
            if (e.pointerType !== 'touch') { api.toggle(); return; }
            const now = Date.now();
            if (now - lastTap < 300) {
                const r = video.getBoundingClientRect();
                const x = (e.clientX - r.left) / (r.width || 1);
                if (x < 0.35) api.skip(-10); else if (x > 0.65) api.skip(10); else api.toggle();
                lastTap = 0;
                return;
            }
            lastTap = now;
            if (video.muted && pageMuted && !video.paused) { api.unmute(); wake(); return; }
            if (root.classList.contains('is-idle')) wake(); else if (!video.paused) root.classList.add('is-idle');
        });
        video.addEventListener('dblclick', () => api.toggleFullscreen());

        root.addEventListener('pointerdown', () => { current = api; });
        root.addEventListener('focusin', () => { current = api; });
        root.addEventListener('pointermove', wake);
        root.addEventListener('focusin', wake);
        root.addEventListener('keydown', (e) => {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' && e.target !== volSlider) return;
            const k = e.key;
            const onSlider = e.target === volSlider;
            let handled = true;
            if (k === ' ' || k === 'k' || k === 'K') { if (tag === 'BUTTON' && k === ' ') return; api.toggle(); }
            else if (k === 'j' || k === 'J') api.skip(-10);
            else if (k === 'l' || k === 'L') api.skip(10);
            else if (k === 'ArrowLeft' && !onSlider) api.skip(-5);
            else if (k === 'ArrowRight' && !onSlider) api.skip(5);
            else if (k === 'ArrowUp' && !onSlider) api.setVolume(video.volume + 0.05);
            else if (k === 'ArrowDown' && !onSlider) api.setVolume(video.volume - 0.05);
            else if (k === 'Home' && e.target === scrub) api.seek(0);
            else if (k === 'End' && e.target === scrub) api.seek(duration());
            else if (k === 'm' || k === 'M') api.toggleMute();
            else if (k === 'f' || k === 'F') api.toggleFullscreen();
            else if (k === 'c' || k === 'C') api.toggleCaptions();
            else if (/^[0-9]$/.test(k)) api.seek(duration() * Number(k) / 10);
            else if (VOLUME_KEYS.test(k)) volumeKey(api, k);
            else handled = false;
            if (handled) { e.preventDefault(); wake(); }
        });

        // ── Media events ─────────────────────────────────────
        video.addEventListener('play', () => { root.classList.remove('is-start'); paintPlay(); paintVolume(); current = api; session(api, options); if (ambient) ambient.start(); });
        video.addEventListener('pause', () => { paintPlay(); paintVolume(); if (ambient) ambient.stop(); });
        video.addEventListener('ended', paintPlay);
        video.addEventListener('timeupdate', () => { paintTime(); checkSound(); });
        video.addEventListener('emptied', () => { silent = false; soundKnown = false; playedFrom = null; paintVolume(); });
        video.addEventListener('durationchange', paintTime);
        video.addEventListener('loadedmetadata', () => { paintTime(); paintCaptions(); });
        video.addEventListener('progress', paintBuffered);
        video.addEventListener('volumechange', paintVolume);
        video.addEventListener('ratechange', paintSpeed);
        video.addEventListener('waiting', () => root.classList.add('is-waiting'));
        video.addEventListener('playing', () => { root.classList.remove('is-waiting'); message.textContent = ''; if (playedFrom == null) playedFrom = video.currentTime || 0; paintPlay(); });
        video.addEventListener('seeked', () => { if (!soundKnown) playedFrom = video.currentTime || 0; });
        video.addEventListener('canplay', () => root.classList.remove('is-waiting'));
        video.addEventListener('error', () => { root.classList.remove('is-waiting'); message.textContent = 'This video could not be played.'; });
        if (video.textTracks && video.textTracks.addEventListener) {
            video.textTracks.addEventListener('addtrack', paintCaptions);
            video.textTracks.addEventListener('change', paintCaptions);
        }
        document.addEventListener('fullscreenchange', paintFull);
        document.addEventListener('webkitfullscreenchange', paintFull);

        paintTime(); paintBuffered(); paintPlay(); paintVolume(); paintCaptions(); paintSpeed(); paintFull();
        if (!video.paused) root.classList.remove('is-start');
        return api;
    }

    function enhanceAll(scope) {
        (scope || document).querySelectorAll('video[data-ov-player]').forEach((v) => enhance(v));
    }

    window.OpenVibePlayer = { enhance, enhanceAll, format: fmt };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhanceAll());
    else enhanceAll();
})();
