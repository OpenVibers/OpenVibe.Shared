/*
 * OpenVibeGuestAsk (4.330.0): a signed-out visitor's question to Vibe, from any page (the plan's §V.1 guests; the
 * owner's register #801: "anons should be able to … use AI features with abuse prevention, severe rate limits … a global
 * cap"). The menu's box (search.js) and openvibe.chat's Vibe page use it; a page draws the answer its own way.
 *
 *   const { answer, model, left, receipt } = await OpenVibeGuestAsk.ask('How do I go live?', { apiBase, context, site, current });
 *   (receipt: { chose, why } or null: which model answered and why, Auto's receipt from OpenVibe.AI)
 *
 * It asks OpenVibe.Network's GET /api/frame/ask/guest/challenge, solves it here (ALTCHA's proof of work: the number whose
 * SHA-256 of salt + number is the challenge, through WebCrypto, about half a second), then POST /api/frame/ask/guest.
 * Network keeps the limits: three a day per guest, ten per address, a daily budget for all guests. A failure throws an
 * Error whose message is for the visitor, with .status (Network's answer, 0 when none) and .code (guest.limit,
 * guest.ai_paused, guest.check_failed, guest.answer_failed, guest.offline, guest.check_unsupported, guest.cancelled).
 * The guest's id is kept on the device (localStorage ov:guest-ask:id). No cookie, no token.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeGuestAsk) return;
    const KEY = 'ov:guest-ask:id';

    function guestId() {
        try {
            const kept = localStorage.getItem(KEY);
            if (kept && /^[A-Za-z0-9_-]{16,64}$/.test(kept)) return kept;
            const b = new Uint8Array(18); root.crypto.getRandomValues(b);
            const id = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            localStorage.setItem(KEY, id);
            return id;
        } catch { return ''; }
    }
    /** The number whose SHA-256 of salt + number is the challenge, or null (no WebCrypto, called off, or not found). */
    async function solve(c, current = () => true) {
        const subtle = root.crypto && root.crypto.subtle;
        if (!subtle || !c || c.algorithm !== 'SHA-256' || !/^[0-9a-f]{64}$/.test(String(c.challenge || ''))) return null;
        const want = new Uint8Array(32);
        for (let i = 0; i < 32; i++) want[i] = parseInt(c.challenge.slice(i * 2, i * 2 + 2), 16);
        const max = Math.min(Number(c.maxnumber) || 0, 1e6), enc = new TextEncoder(), salt = String(c.salt || '');
        const same = (buf) => { const a = new Uint8Array(buf); for (let i = 0; i < 32; i++) if (a[i] !== want[i]) return false; return true; };
        for (let n0 = 0; n0 <= max; n0 += 1000) {
            if (!current()) return null;
            const batch = [];
            for (let n = n0; n <= Math.min(n0 + 999, max); n++) batch.push(subtle.digest('SHA-256', enc.encode(salt + n)));
            const got = await Promise.all(batch);
            for (let k = 0; k < got.length; k++) if (same(got[k])) return n0 + k;
        }
        return null;
    }
    const fail = (message, status, code) => Object.assign(new Error(message), { status, code });
    const siteHere = () => (/(?:^|\.)openvibe\.([a-z]{2,20})$/.exec(String(location.hostname || '')) || [])[1] || '';

    async function ask(text, o = {}) {
        const words = String(text || '').trim().slice(0, 1000);
        if (words.length < 2) throw fail('Ask a question.', 0, 'guest.ask_invalid');
        const current = typeof o.current === 'function' ? o.current : () => true;
        const frame = `${String(o.apiBase || 'https://openvibe.network').replace(/\/+$/, '')}/api/frame/ask/guest`;
        let c = null;
        try {
            const cr = await fetch(`${frame}/challenge`, { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } });
            c = cr.ok ? await cr.json() : null;
        } catch { c = null; }
        if (!c) throw fail('Vibe could not be reached. Try again in a moment.', 0, 'guest.offline');
        const number = await solve(c, current);
        if (!current()) throw fail('', 0, 'guest.cancelled');
        if (number == null) throw fail('This browser could not do the quick check. Sign in (free) to ask.', 0, 'guest.check_unsupported');
        const context = o.context != null ? String(o.context) : `${document.title || ''} (${location.origin}${location.pathname})`;
        const site = o.site != null ? String(o.site) : siteHere();
        let r;
        try {
            r = await fetch(frame, {
                method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ text: words, context: context.slice(0, 2000), site: site || undefined, guest: guestId() || undefined, proof: { ...c, number } }),
            });
        } catch { throw fail('Vibe could not be reached. Try again in a moment.', 0, 'guest.offline'); }
        const d = await r.json().catch(() => ({}));
        if (!current()) throw fail('', 0, 'guest.cancelled');
        if (!r.ok || typeof d.answer !== 'string') throw fail(d.error || 'Vibe could not answer right now. Try again in a moment.', r.status, String(d.code || ''));
        const left = Number(d.left);
        const receipt = d.receipt && typeof d.receipt.why === 'string' ? { chose: d.receipt.chose ? String(d.receipt.chose) : null, why: String(d.receipt.why) } : null;
        return { answer: d.answer, model: d.model || null, left: Number.isFinite(left) ? left : null, receipt };
    }
    /** Whether a failure is the day's limit or a resting budget (sign in, no Try again). */
    const limited = (err) => !!err && (err.status === 429 || err.status === 503 || err.code === 'guest.check_unsupported');

    root.OpenVibeGuestAsk = { ask, guestId, solve, limited };
})(typeof window !== 'undefined' ? window : globalThis);
