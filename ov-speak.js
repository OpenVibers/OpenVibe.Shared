/*!
 * ov-speak.js — words read aloud, the same way on every OpenVibe site (4.308.0; the owner, 2026-11-17: "There should be
 * a feature for the sessions and codes and actor and etc where it will read out it's messages using text to speech if
 * configured"). A session (ov-session.js: Vibe, Codes, Actor, rooms) reads its agents' new answers when the person turns
 * it on; any page may read any text on demand.
 *
 * Two voices, chosen by the person, kept on this device:
 *   device    this browser's own voices (speechSynthesis): free, at once, and nothing leaves the device
 *   openvibe  OpenVibe's natural voices (Google, Polly) through the Frame's POST /speech, charged by the character to
 *             the person's own AI allowance, then their Balance
 *
 *   OpenVibeSpeak.prefs()               → { on, engine: 'device'|'openvibe', voice, rate }
 *   OpenVibeSpeak.save(partial)         → the prefs, saved (and an 'ov-speak-prefs' event on window)
 *   OpenVibeSpeak.configure({ base, headers })   where the Frame is and how to sign a request (for openvibe)
 *   OpenVibeSpeak.say(text, { who })    queue words (markdown, code and links made speakable; `who` read first)
 *   OpenVibeSpeak.stop()                stop and empty the queue
 *   OpenVibeSpeak.speaking()            is it reading now
 *   OpenVibeSpeak.on(fn)                fn({ speaking, error }) on every change; returns an off()
 *   OpenVibeSpeak.deviceVoices()        this browser's voices, the person's language first
 *   OpenVibeSpeak.VOICES                OpenVibe's voices: [{ id, name, line }]
 *   OpenVibeSpeak.speakable(markdown)   the words as they are read
 */
(function (root) {
    'use strict';
    if (root.OpenVibeSpeak) return;
    const KEY = 'ov:speak';
    const DEFAULTS = { on: false, engine: 'device', voice: '', rate: 1 };
    // OpenVibe's voices (OpenVibe.AI server/providers/speech.js ids; WaveNet and Neural are the natural ones).
    const VOICES = [
        { id: 'gc_wave_queen', name: 'Wave Queen', line: 'Warm, American' },
        { id: 'gc_wave_daddy', name: 'Wave Daddy', line: 'Calm, American' },
        { id: 'gc_wave_brit', name: 'Wave Brit', line: 'Clear, British' },
        { id: 'gc_podcast_girl', name: 'Podcast', line: 'Bright, American' },
        { id: 'gc_news_anchor', name: 'News Anchor', line: 'Steady, American' },
        { id: 'gc_lady_london', name: 'Lady London', line: 'Crisp, British' },
    ];
    let cfg = { base: null, headers: () => ({}) };
    const queue = [];
    let busy = false, stopped = 0, audio = null, lastError = null;
    const listeners = new Set();
    const tell = () => { for (const fn of listeners) { try { fn({ speaking: busy, error: lastError }); } catch { /* a listener's own fault */ } } };

    function prefs() {
        try { return { ...DEFAULTS, ...JSON.parse(root.localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
    }
    function save(partial) {
        const next = { ...prefs(), ...(partial || {}) };
        next.rate = Math.min(2, Math.max(0.5, Number(next.rate) || 1));
        next.engine = next.engine === 'openvibe' ? 'openvibe' : 'device';
        try { root.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* no storage: this page only */ }
        if (!next.on) stop();
        try { root.dispatchEvent(new CustomEvent('ov-speak-prefs', { detail: next })); } catch { /* old browser */ }
        return next;
    }
    function configure(o) { cfg = { ...cfg, ...(o || {}) }; }
    const deviceOk = () => typeof root.speechSynthesis !== 'undefined' && typeof root.SpeechSynthesisUtterance === 'function';

    /** Markdown made speakable: code is not read, a link is its words, a bare address is "a link", marks go. */
    function speakable(md) {
        return String(md == null ? '' : md)
            .replace(/```[\s\S]*?```/g, ' (code) ')
            .replace(/`([^`]{1,60})`/g, '$1').replace(/`[^`]*`/g, ' (code) ')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
            .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1')
            .replace(/https?:\/\/\S+/g, 'a link')
            .replace(/^\s{0,3}#{1,6}\s+/gm, '').replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*>\s?/gm, '')
            .replace(/\|/g, ', ').replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1')
            .replace(/\[(?:E|S)\d+\]/g, '')
            .replace(/\s+/g, ' ').trim()
            .slice(0, 6000);
    }
    /** Pieces a voice reads well: whole sentences, at most about 220 characters (a long utterance stalls in Chrome). */
    function pieces(text) {
        const out = [];
        let cur = '';
        for (const s of String(text).match(/[^.!?…]+[.!?…]*\s*/g) || []) {
            if ((cur + s).length > 220 && cur) { out.push(cur.trim()); cur = ''; }
            if (s.length > 220) { for (let i = 0; i < s.length; i += 200) out.push(s.slice(i, i + 200).trim()); continue; }
            cur += s;
        }
        if (cur.trim()) out.push(cur.trim());
        return out.filter(Boolean);
    }

    function deviceVoices() {
        if (!deviceOk()) return [];
        const lang = String((root.navigator && root.navigator.language) || 'en').slice(0, 2).toLowerCase();
        return root.speechSynthesis.getVoices().map((v) => ({ id: v.name, name: v.name.replace(/\s*\(.*\)$/, ''), line: `${v.lang}${v.localService ? '' : ' · online'}`, lang: v.lang }))
            .sort((a, b) => Number(!a.lang.toLowerCase().startsWith(lang)) - Number(!b.lang.toLowerCase().startsWith(lang)) || a.name.localeCompare(b.name));
    }

    function sayDevice(piece, p, ticket) {
        return new Promise((done) => {
            const u = new root.SpeechSynthesisUtterance(piece);
            const v = p.voice && root.speechSynthesis.getVoices().find((x) => x.name === p.voice);
            if (v) { u.voice = v; u.lang = v.lang; }
            u.rate = p.rate;
            let ended = false;
            const end = () => { if (!ended) { ended = true; done(); } };
            u.onend = end; u.onerror = end;
            if (ticket !== stopped) return end();
            root.speechSynthesis.speak(u);
            // A voice that never says it ended (some engines): move on after a generous time.
            setTimeout(end, Math.max(4000, piece.length * 120 / p.rate));
        });
    }
    async function fetchVoice(piece, p) {
        if (!cfg.base) throw new Error('OpenVibe voices need the Frame');
        const r = await fetch(`${cfg.base}/speech`, {
            method: 'POST', credentials: 'omit',
            headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg', ...(typeof cfg.headers === 'function' ? cfg.headers() : cfg.headers || {}) },
            body: JSON.stringify({ text: piece, voice: p.voice && VOICES.some((x) => x.id === p.voice) ? p.voice : VOICES[0].id, speed: p.rate }),
        });
        if (!r.ok) {
            const j = await r.json().catch(() => null);
            throw new Error((j && (j.error && (j.error.message || j.error))) || (r.status === 402 ? 'Your free AI is used up: OpenVibe voices need your Balance' : `The voice did not answer (${r.status})`));
        }
        return URL.createObjectURL(await r.blob());
    }
    function play(url, ticket) {
        return new Promise((done) => {
            if (ticket !== stopped) { URL.revokeObjectURL(url); return done(); }
            audio = new Audio(url);
            const end = () => { URL.revokeObjectURL(url); audio = null; done(); };
            audio.onended = end; audio.onerror = end;
            audio.play().catch(end);
        });
    }

    async function pump() {
        if (busy) return;
        busy = true; lastError = null; tell();
        const ticket = stopped;
        try {
            while (queue.length && ticket === stopped) {
                const { text } = queue.shift();
                const p = prefs();
                const parts = pieces(text);
                if (p.engine === 'openvibe') {
                    // The next piece is fetched while this one plays: no gap between sentences.
                    let next = parts.length ? fetchVoice(parts[0], p) : null;
                    for (let i = 0; i < parts.length && ticket === stopped; i++) {
                        const url = await next;
                        next = i + 1 < parts.length ? fetchVoice(parts[i + 1], p) : null;
                        await play(url, ticket);
                    }
                    if (next) next.then((u) => URL.revokeObjectURL(u), () => {});
                } else if (deviceOk()) {
                    for (const piece of parts) { if (ticket !== stopped) break; await sayDevice(piece, p, ticket); }
                } else throw new Error('This browser cannot read aloud: choose OpenVibe voices');
            }
        } catch (err) {
            lastError = (err && err.message) || 'Reading aloud stopped';
            queue.length = 0;
        } finally {
            busy = false; tell();
        }
    }

    function say(text, { who = '' } = {}) {
        const words = speakable(text);
        if (!words) return;
        queue.push({ text: who ? `${who}: ${words}` : words });
        pump();
    }
    function stop() {
        stopped += 1;
        queue.length = 0;
        try { if (deviceOk()) root.speechSynthesis.cancel(); } catch { /* nothing to stop */ }
        if (audio) { try { audio.pause(); } catch { /* gone */ } audio = null; }
        if (busy) { busy = false; tell(); }
    }

    root.OpenVibeSpeak = { prefs, save, configure, say, stop, speaking: () => busy, on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, deviceVoices, deviceOk, VOICES, speakable, pieces };
})(typeof window !== 'undefined' ? window : globalThis);
