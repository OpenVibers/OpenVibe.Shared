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
 * It only drives the media element (play, currentTime, volume, …) and listens to its events, so a page's own script
 * (HLS attachment, chapters, next-up, view counts) keeps working on the same element. OpenVibePlayer.enhance(video)
 * for a video added later; enhance() is idempotent.
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || window.OpenVibePlayer) return;

    const SVG = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="${d}"/></svg>`;
    const ICON = {
        play: SVG('M8 5.14v13.72a1 1 0 0 0 1.52.85l10.9-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z'),
        pause: SVG('M7 5h3.5v14H7zM13.5 5H17v14h-3.5z'),
        replay: SVG('M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z'),
        volume: SVG('M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z'),
        low: SVG('M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12z'),
        muted: SVG('M4 9v6h4l5 4V5L8 9H4zm12.6 3 2.2-2.2-1.4-1.4-2.2 2.2-2.2-2.2-1.4 1.4 2.2 2.2-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4z'),
        cc: SVG('M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1z'),
        pip: SVG('M19 11h-8v6h8v-6zm4 8V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2zm-2 .02H3V4.97h18v14.05z'),
        full: SVG('M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'),
        exit: SVG('M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z'),
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
    const captionTrack = (video) => Array.from(video.textTracks || []).find((t) => t.kind === 'captions' || t.kind === 'subtitles') || null;
    const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    function enhance(video, options = {}) {
        if (!video || video.__ovPlayer) return video && video.__ovPlayer;
        const idleMs = options.idleMs || 2500;
        const root = el('div', 'ov-player is-paused is-start', { tabindex: '0', role: 'region', 'aria-label': options.label || video.getAttribute('aria-label') || 'Video player' });
        video.parentNode.insertBefore(root, video);
        root.appendChild(video);
        video.controls = false;
        video.removeAttribute('controls');
        video.classList.add('ov-player-video');

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
        root.append(spinner, big, message, bar);

        const pipOk = typeof document !== 'undefined' && document.pictureInPictureEnabled && !video.disablePictureInPicture;
        if (!pipOk) pipBtn.hidden = true;
        const fsOk = !!(root.requestFullscreen || root.webkitRequestFullscreen || video.webkitEnterFullscreen);
        if (!fsOk) fullBtn.hidden = true;

        const saved = stored();
        if (saved && !video.hasAttribute('muted')) { video.volume = Math.min(1, Math.max(0, saved.volume)); video.muted = !!saved.muted; }

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
            muteBtn.innerHTML = v === 0 ? ICON.muted : v < 0.5 ? ICON.low : ICON.volume;
            const label = video.muted || v === 0 ? 'Unmute (m)' : 'Mute (m)';
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
            skip(s) { api.seek((video.currentTime || 0) + s); },
            setVolume(v) { video.volume = Math.min(1, Math.max(0, v)); video.muted = video.volume === 0; store(video); },
            toggleMute() { if (video.muted && video.volume === 0) video.volume = 0.5; video.muted = !video.muted; store(video); },
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

        big.addEventListener('click', () => api.toggle());
        playBtn.addEventListener('click', () => api.toggle());
        muteBtn.addEventListener('click', () => api.toggleMute());
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
            if (root.classList.contains('is-idle')) wake(); else if (!video.paused) root.classList.add('is-idle');
        });
        video.addEventListener('dblclick', () => api.toggleFullscreen());

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
            else handled = false;
            if (handled) { e.preventDefault(); wake(); }
        });

        // ── Media events ─────────────────────────────────────
        video.addEventListener('play', () => { root.classList.remove('is-start'); paintPlay(); });
        video.addEventListener('pause', paintPlay);
        video.addEventListener('ended', paintPlay);
        video.addEventListener('timeupdate', paintTime);
        video.addEventListener('durationchange', paintTime);
        video.addEventListener('loadedmetadata', () => { paintTime(); paintCaptions(); });
        video.addEventListener('progress', paintBuffered);
        video.addEventListener('volumechange', paintVolume);
        video.addEventListener('ratechange', paintSpeed);
        video.addEventListener('waiting', () => root.classList.add('is-waiting'));
        video.addEventListener('playing', () => { root.classList.remove('is-waiting'); message.textContent = ''; paintPlay(); });
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
