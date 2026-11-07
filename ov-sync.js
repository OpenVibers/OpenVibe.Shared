/*
 * OVSync — one timeline for many players (OpenVibe_Seven_Domains_Plan_2026-11-07 §1 B4, §7).
 *
 *   const clock = OVSync.attach(video, { room: 'friday-film', socket, self: 'usr_…' });
 *   clock.destroy();
 *
 * One HTMLMediaElement follows a common.sync-clock@1 state that OpenVibe.Chat fans over /ws/chat:
 *
 *   { room, media, position_ms, rate, paused, at_ms, set_by, seq }
 *
 * Where it should be is `position_ms + (serverNow() - at_ms) * rate` while the room plays, and exactly
 * `position_ms` while it is paused. serverNow() is the local clock corrected by NTP-style `time`
 * pings on the same socket: five samples, the one with the smallest round trip wins, refreshed every
 * 60 s. Until the first sample arrives the element is not moved.
 *
 * Drift |media - timeline| is held inside ±80 ms: 80–400 ms nudges the playback rate by 0.95–1.05 of
 * the room's rate until it is back, past 400 ms seeks. The element plays and pauses with the room.
 * When the local person is not the common.control-lease@1 holder, their own play, pause, seek or rate
 * change is put back with a short notice; the holder's own change is sent as a `sync` instead. `self`
 * is the local subject; when it is left out it is learned from the socket's `room_joined` or `auth`
 * frame (`subject`) or from `socket.subject`. `opts.holder: true|false` overrides the lease check.
 *
 * Media: a string is an https URL and is put on the element when it changes; a Media object is
 * reported as an `ovsync:media` event (and to `opts.onMedia`) for the page to resolve. The script has
 * no dependencies and works both as a browser classic script (`window.OVSync`, `window.OpenVibeSync`)
 * and through `require('openvibe-shared/ov-sync')`.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OVSync = api;
    root.OpenVibeSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const TARGET_MS = 80;       // inside this the element is left alone
    const SEEK_MS = 400;         // past this a seek, not a nudge
    const NUDGE = 0.05;          // a nudge is 0.95–1.05 of the room's rate
    const TICK_MS = 100;
    const SAMPLES = 5;
    const SAMPLE_GAP_MS = 120;
    const CLOCK_TIMEOUT_MS = 2500;
    const REFRESH_MS = 60000;

    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

    function attach(media, options) {
        if (!media || typeof media.play !== 'function' || !('currentTime' in media)) {
            throw new TypeError('OVSync.attach needs an HTMLMediaElement');
        }
        const opts = options || {};
        const socket = opts.socket;
        const room = String(opts.room || '');
        if (!socket || typeof socket.send !== 'function') throw new TypeError('OVSync.attach needs the room socket');
        if (!room) throw new TypeError('OVSync.attach needs a room');

        let self = typeof opts.self === 'string' ? opts.self : (typeof opts.subject === 'string' ? opts.subject : null);
        let state = opts.state && typeof opts.state === 'object' ? opts.state : null;
        let lease = null;
        let offset = 0;
        let rtt = null;
        let clockReady = false;
        let generation = 0;
        let batch = null;
        const sentTimes = new Map();
        let destroyed = false;
        let tickTimer = null;
        let refreshTimer = null;
        let suppressUntil = 0;
        let pendingSelfUntil = 0;
        let lastDrift = 0;
        let mediaKey = null;
        let programmaticRate = null;
        const outbox = [];
        let noticeEl = null;
        let noticeTimer = null;
        let lastNoticeAt = -Infinity;

        const perfNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        const serverNow = () => Date.now() + offset;
        const quiet = () => perfNow() < suppressUntil;
        const suppress = (ms) => { suppressUntil = Math.max(suppressUntil, perfNow() + ms); };

        function emit(name, detail) {
            try { media.dispatchEvent(new CustomEvent(name, { bubbles: true, detail })); } catch (e) { /* no DOM */ }
        }

        function send(frame) {
            if (destroyed) return;
            const ready = socket.readyState === undefined || socket.readyState === 1;
            if (!ready) { outbox.push(frame); return; }
            try { socket.send(JSON.stringify(frame)); } catch (e) { /* the socket went away */ }
        }

        function flush() {
            while (outbox.length) {
                const frame = outbox.shift();
                try { socket.send(JSON.stringify(frame)); } catch (e) { return; }
            }
        }

        // ── Clock: five samples, best round trip ─────────────────────────────
        function sampleClock() {
            if (destroyed) return;
            const gen = ++generation;
            const b = { gen, samples: [], timer: null };
            batch = b;
            for (let i = 0; i < SAMPLES; i++) {
                setTimeout(() => {
                    if (destroyed || !batch || batch.gen !== gen) return;
                    const id = `t${gen}-${i}-${Math.random().toString(36).slice(2, 8)}`;
                    const t0 = Date.now();
                    sentTimes.set(id, { t0, gen });
                    send({ type: 'time', id, t0 });
                }, i * SAMPLE_GAP_MS);
            }
            b.timer = setTimeout(() => finishClock(gen), (SAMPLES - 1) * SAMPLE_GAP_MS + CLOCK_TIMEOUT_MS);
        }

        function finishClock(gen) {
            if (!batch || batch.gen !== gen) return;
            clearTimeout(batch.timer);
            const samples = batch.samples;
            batch = null;
            if (!samples.length) {
                // Nothing came back (a sleeping tab, a lost socket): try again shortly, not in a minute.
                if (!destroyed) setTimeout(sampleClock, 5000);
                return;
            }
            const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
            offset = best.offset;
            rtt = best.rtt;
            clockReady = true;
            emit('ovsync:clock', { offset, rtt });
            tick();
        }

        function onTime(msg) {
            const sent = sentTimes.get(msg.id);
            if (!sent || !batch || sent.gen !== batch.gen) return;
            sentTimes.delete(msg.id);
            const t0 = Number.isFinite(Number(msg.t0)) ? Number(msg.t0) : sent.t0;
            const t1 = Number(msg.t_server);
            const t3 = Date.now();
            if (!Number.isFinite(t0) || !Number.isFinite(t1)) return;
            const sampleRtt = t3 - t0;
            if (sampleRtt < 0 || sampleRtt > 5000) return;
            batch.samples.push({ offset: t1 - (t0 + t3) / 2, rtt: sampleRtt });
            if (batch.samples.length >= SAMPLES) finishClock(batch.gen);
        }

        // ── The room's timeline ──────────────────────────────────────────────
        function targetMs() {
            if (!state) return null;
            const position = Number(state.position_ms);
            const at = Number(state.at_ms);
            const rate = Number(state.rate);
            if (!Number.isFinite(position) || !Number.isFinite(at) || !Number.isFinite(rate)) return null;
            if (state.paused) return Math.max(0, position);
            return Math.max(0, position + (serverNow() - at) * rate);
        }

        function isHolder() {
            if (opts.holder === true) return true;
            if (opts.holder === false) return false;
            if (!self || !lease || !lease.holder) return false;
            return lease.holder.kind === 'person' && lease.holder.subject === self;
        }

        function applyState(next, source) {
            if (!next || typeof next !== 'object') return;
            if (room && next.room && next.room !== room) return;
            if (state && Number(state.seq) > 0 && Number(next.seq) > 0 && Number(next.seq) < Number(state.seq)) return;
            state = next;
            if (self && next.set_by === self) pendingSelfUntil = 0;
            emit('ovsync:state', state);
            if (source) emit('ovsync:' + source, state);
            adoptMedia();
            tick();
        }

        function adoptMedia() {
            if (!state || opts.followMedia === false) return;
            const m = state.media;
            if (typeof m === 'string') {
                let url;
                try { url = new URL(m, typeof location !== 'undefined' ? location.href : undefined); } catch (e) { return; }
                // Only an https source: Chat already refuses media off OpenVibe's own hosts, and the player never
                // follows a clock to http, data: or blob: whatever a server says.
                if (url.protocol !== 'https:') return;
                url = url.href;
                if (mediaKey === url) return;
                mediaKey = url;
                const current = media.currentSrc || media.src;
                if (current === url) return;
                suppress(600);
                try { media.src = url; media.load(); } catch (e) { /* the page owns the source */ }
                emit('ovsync:media', m);
                return;
            }
            if (m && typeof m === 'object') {
                const key = JSON.stringify(m);
                if (mediaKey === key) return;
                mediaKey = key;
                emit('ovsync:media', m);
                if (typeof opts.onMedia === 'function') { try { opts.onMedia(m); } catch (e) { /* the page's */ } }
            }
        }

        function seek(ms) {
            const t = Math.max(0, Number(ms) / 1000);
            if (!Number.isFinite(t)) return;
            if (Math.abs(media.currentTime - t) < 0.005) return;
            suppress(600);
            try { media.currentTime = t; } catch (e) { /* not seekable yet */ }
        }

        function setRate(rate) {
            const r = Math.round(clamp(rate, 0.0625, 16) * 1000) / 1000;
            if (Math.abs(media.playbackRate - r) < 0.001) return;
            programmaticRate = r;
            suppress(400);
            try { media.playbackRate = r; } catch (e) { /* the browser refused */ }
        }

        function tick() {
            if (destroyed || !clockReady || !state) return;
            if (pendingSelfUntil && Date.now() < pendingSelfUntil) return;
            if (media.readyState < 1) {
                if (media.networkState === 0 && (media.src || media.currentSrc)) {
                    try { media.load(); } catch (e) { /* no source yet */ }
                }
                return;
            }
            const target = targetMs();
            if (target == null) return;
            const base = clamp(Number(state.rate) || 1, 0.0625, 16);
            const drift = media.currentTime * 1000 - target;
            lastDrift = drift;

            if (state.paused) {
                if (!media.paused) { suppress(500); try { media.pause(); } catch (e) { /* */ } }
                setRate(base);
                if (Math.abs(drift) > TARGET_MS) seek(target);
                return;
            }

            if (media.paused) {
                suppress(700);
                const p = media.play();
                if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay waits for a tap */ });
            }
            if (Math.abs(drift) > SEEK_MS) {
                seek(target);
                setRate(base);
                return;
            }
            if (Math.abs(drift) > TARGET_MS) {
                // Positive drift is ahead of the room: slow down. 80 ms is a 2% nudge, 400 ms the 5% cap.
                const factor = clamp(1 - drift / 5000, 1 - NUDGE, 1 + NUDGE);
                setRate(base * factor);
            } else {
                setRate(base);
            }
        }

        function notify(message) {
            const now = perfNow();
            if (now - lastNoticeAt < 1200) return;
            lastNoticeAt = now;
            emit('ovsync:notice', { message });
            if (opts.notice === false || typeof document === 'undefined' || !document.body) return;
            if (!noticeEl) {
                noticeEl = document.createElement('div');
                noticeEl.setAttribute('data-ov-sync-notice', '');
                noticeEl.setAttribute('role', 'status');
                noticeEl.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;'
                    + 'background:#10131a;color:#fff;font:14px/1.4 system-ui,sans-serif;padding:8px 14px;border-radius:999px;'
                    + 'box-shadow:0 6px 20px rgba(0,0,0,.35);pointer-events:none;max-width:calc(100vw - 32px)';
                document.body.appendChild(noticeEl);
            }
            noticeEl.textContent = message;
            noticeEl.style.display = 'block';
            clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => { if (noticeEl) noticeEl.style.display = 'none'; }, 2500);
        }

        function sendSelfSync() {
            if (!state) return;
            pendingSelfUntil = Date.now() + 1500;
            send({
                type: 'sync',
                room,
                media: state.media,
                position_ms: Math.max(0, Math.round(media.currentTime * 1000)),
                rate: media.paused ? (Number(state.rate) || 1) : (media.playbackRate || Number(state.rate) || 1),
                paused: !!media.paused,
            });
        }

        function localChange() {
            if (destroyed || !state) return;
            if (isHolder()) { sendSelfSync(); return; }
            notify('Only the person with the remote can change the timeline.');
            suppress(30);
            setTimeout(tick, 40);
        }

        // ── The socket and the element ───────────────────────────────────────
        function onMessage(event) {
            let msg;
            try { msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (e) { return; }
            if (!msg || typeof msg !== 'object') return;
            if ((msg.type === 'room_joined' || msg.type === 'auth') && !self && typeof msg.subject === 'string' && msg.subject) {
                self = msg.subject;
                tick();
            }
            if (msg.type === 'time') { onTime(msg); return; }
            if (room && msg.room && msg.room !== room) return;
            if (msg.type === 'sync') {
                const next = msg.state || (msg.position_ms !== undefined ? msg : null);
                if (next) applyState(next, 'sync');
                return;
            }
            if (msg.type === 'lease') {
                const next = msg.state || msg;
                if (next && next.holder) { lease = next; emit('ovsync:lease', next); tick(); }
                return;
            }
            if (msg.type === 'sync_error') {
                pendingSelfUntil = 0;
                notify(msg.message || 'The room did not accept that change.');
                tick();
            }
        }

        const onOpen = () => flush();
        const onSeeking = () => { if (!quiet()) localChange(); };
        const onPlay = () => { if (!quiet()) localChange(); };
        const onPause = () => { if (!quiet()) localChange(); };
        const onRate = () => {
            if (programmaticRate != null && Math.abs(media.playbackRate - programmaticRate) < 0.002) return;
            programmaticRate = null;
            if (!quiet()) localChange();
        };
        const onReady = () => tick();

        if (typeof socket.addEventListener === 'function') {
            socket.addEventListener('message', onMessage);
            socket.addEventListener('open', onOpen);
        }
        media.addEventListener('seeking', onSeeking);
        media.addEventListener('play', onPlay);
        media.addEventListener('pause', onPause);
        media.addEventListener('ratechange', onRate);
        media.addEventListener('loadedmetadata', onReady);
        media.addEventListener('canplay', onReady);

        if (!self && typeof socket.subject === 'string') self = socket.subject;
        if (state) { adoptMedia(); tick(); }
        tickTimer = setInterval(tick, TICK_MS);
        refreshTimer = setInterval(sampleClock, REFRESH_MS);
        sampleClock();

        return {
            get state() { return state; },
            get lease() { return lease; },
            isHolder,
            clock: () => ({ offset, rtt, ready: clockReady }),
            serverNow,
            targetMs,
            drift: () => lastDrift,
            setSelf: (subject) => { self = typeof subject === 'string' ? subject : null; tick(); },
            notify,
            destroy() {
                if (destroyed) return;
                destroyed = true;
                clearInterval(tickTimer);
                clearInterval(refreshTimer);
                if (batch && batch.timer) clearTimeout(batch.timer);
                batch = null;
                sentTimes.clear();
                outbox.length = 0;
                if (typeof socket.removeEventListener === 'function') {
                    socket.removeEventListener('message', onMessage);
                    socket.removeEventListener('open', onOpen);
                }
                media.removeEventListener('seeking', onSeeking);
                media.removeEventListener('play', onPlay);
                media.removeEventListener('pause', onPause);
                media.removeEventListener('ratechange', onRate);
                media.removeEventListener('loadedmetadata', onReady);
                media.removeEventListener('canplay', onReady);
                if (noticeTimer) clearTimeout(noticeTimer);
                if (noticeEl && noticeEl.parentNode) noticeEl.parentNode.removeChild(noticeEl);
                noticeEl = null;
            },
        };
    }

    return { attach, TARGET_MS, SEEK_MS, NUDGE, clockSamples: SAMPLES };
});
