/**
 * openvibe-shared/ov-locker.js — Locker in the browser (plan track Q2; the owner, 2026-11-06: "encrypt it … set the
 * encryption password … completely encrypted on our end … decrypted on the client's end, so we don't have access to
 * any of the user data"). The look is ov-locker.css, linked from beside this file; docs/locker.md describes both.
 *
 *   OVLocker.open(el, { bytes | url, title?, onOpen(bytes, info) })   the card a locked item shows: it opens with the
 *                                                                     link's key, a password, or your locker
 *   OVLocker.setup({ onDone })     make your locker: a passphrase, then a recovery kit (24 words), saved locked
 *   OVLocker.unlock({ onDone })    unlock it on this device (the passphrase, or the recovery kit)
 *   OVLocker.state()               { unlocked, fingerprint, subject }
 *   OVLocker.forget()              drop the unlocked keys from this tab
 *   OVLocker.keyFromLink(href?)    the content key a link carries after #k= (link locks)
 *   window.OpenVibeLockerConfig = { network: 'https://openvibe.network' }   where the key directory is
 *
 * The cryptography is ov-locker-core.js beside this file (generated from openvibe-sdk/locker: WebCrypto only, the
 * shared test vectors). This file never sends a password, a passphrase, the recovery words, a content key or a private
 * key anywhere: they live in this tab's memory and go when it closes, or with forget(). What Network keeps is the
 * public keys and two locked copies of the private keys (one opens with the passphrase, one with the recovery words).
 *
 * Every word on screen is text, never markup. Nothing spins: a wait is words.
 */
(function (root) {
    'use strict';
    if (!root || !root.document || root.OVLocker) return;
    const doc = root.document;
    const cfg = () => Object.assign({ network: 'https://openvibe.network' }, root.OpenVibeLockerConfig || {});
    const RECOVERY_WORDS = 24;
    const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
    const ICON = {
        lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
        open: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/>'),
        key: svg('<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M15.5 7.5l2 2M13.5 9.5l1.5 1.5"/>'),
        eye: svg('<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
        close: svg('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>'),
        tick: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    };

    // ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────────
    const el = (tag, cls, attrs, text) => {
        const n = doc.createElement(tag);
        if (cls) n.className = cls;
        if (attrs) for (const k of Object.keys(attrs)) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
        if (text != null) n.textContent = text;
        return n;
    };
    const icon = (name, cls) => { const s = el('span', cls || 'ovl-ico'); s.innerHTML = ICON[name]; return s; };   // constants only
    const reduce = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return root.btoa(s); };
    const unb64 = (s) => Uint8Array.from(root.atob(String(s)), (c) => c.charCodeAt(0));
    const unb64url = (s) => unb64(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
    const utf8 = (s) => new TextEncoder().encode(s);
    const fromUtf8 = (u8) => new TextDecoder().decode(u8);

    function beside(name) {
        const me = doc.currentScript || doc.querySelector('script[src*="ov-locker.js"]');
        return (me && me.src ? me.src : '/shared/ov-locker.js').replace(/ov-locker\.js(\?[^#]*)?.*$/, `${name}$1`);
    }
    function stylesheet() {
        if (doc.querySelector('link[href*="ov-locker.css"]')) return;
        doc.head.appendChild(el('link', null, { rel: 'stylesheet', href: beside('ov-locker.css') }));
    }
    stylesheet();
    let coreLoad = null;
    /** The crypto core, once (ov-locker-core.js, generated from openvibe-sdk/locker). */
    function core() {
        if (root.OVLockerCore) return Promise.resolve(root.OVLockerCore);
        if (!coreLoad) {
            coreLoad = new Promise((resolve, reject) => {
                const sc = el('script', null, { src: beside('ov-locker-core.js'), async: true });
                sc.onload = () => (root.OVLockerCore ? resolve(root.OVLockerCore) : reject(new Error('The Locker could not start.')));
                sc.onerror = () => { coreLoad = null; reject(new Error('The Locker could not load. Check your connection and try again.')); };
                doc.head.appendChild(sc);
            });
        }
        return coreLoad;
    }
    async function network(method, path, body) {
        const r = await fetch(cfg().network.replace(/\/+$/, '') + path, {
            method, credentials: 'include',
            headers: Object.assign({ accept: 'application/json', 'x-requested-with': 'ov-locker' }, body ? { 'content-type': 'application/json' } : {}),
            body: body ? JSON.stringify(body) : undefined,
        });
        let j = null;
        try { j = await r.json(); } catch (_) { /* empty */ }
        if (!r.ok) { const e = new Error((j && (j.error || j.message)) || `OpenVibe answered ${r.status}`); e.status = r.status; throw e; }
        return j || {};
    }

    // ── This tab's unlocked locker: memory only ─────────────────────────────────────────────────────────────
    let session = null;   // { person, subject, fingerprint }
    const state = () => ({ unlocked: !!session, fingerprint: session ? session.fingerprint : null, subject: session ? session.subject : null });
    function forget() { session = null; doc.dispatchEvent(new CustomEvent('ov-locker:change', { detail: state() })); }

    /** The content key a link carries: #k=<base64url>, anywhere in the part after #. */
    function keyFromLink(href) {
        const h = String(href == null ? root.location.hash : (String(href).split('#')[1] || '')).replace(/^#/, '');
        const m = h.match(/(?:^|&)k=([A-Za-z0-9_-]{43})(?:&|$)/);
        if (!m) return null;
        try { const k = unb64url(m[1]); return k.length === 32 ? k : null; } catch (_) { return null; }
    }

    // ── How strong a passphrase is, in plain words (no list to download: length, variety, and the obvious) ─────
    const COMMON = /^(password|passw0rd|letmein|qwerty|iloveyou|admin|welcome|monkey|dragon|openvibe|123456|abc123)/i;
    function strength(p) {
        const s = String(p || '');
        if (!s) return { score: 0, words: '' };
        const words = s.trim().split(/[\s\-_.]+/).filter((w) => w.length >= 3).length;
        const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9\s]/].filter((r) => r.test(s)).length;
        let score = s.length >= 20 || words >= 4 ? 4 : s.length >= 16 || (words >= 3 && s.length >= 14) ? 3 : s.length >= 12 && classes >= 2 ? 2 : 1;
        if (COMMON.test(s) || /^(.)\1+$/.test(s) || /^(0123|1234|abcd)/i.test(s)) score = 1;
        return { score, words: ['', 'Too easy to guess', 'Getting there: add a word', 'Good', 'Strong'][score] };
    }

    // ── A sheet of our own (setup, unlock): a dialog, a bottom sheet on a phone ──────────────────────────────
    function sheet(title) {
        const dlg = el('dialog', 'ovl-sheet', { 'aria-labelledby': 'ovl-title' });
        const box = el('div', 'ovl-box');
        const head = el('div', 'ovl-head');
        head.appendChild(icon('lock', 'ovl-ico is-badge'));
        head.appendChild(el('h2', 'ovl-title', { id: 'ovl-title' }, title));
        const x = el('button', 'ovl-iconbtn', { type: 'button', 'aria-label': 'Close' });
        x.appendChild(icon('close'));
        head.appendChild(x);
        const body = el('div', 'ovl-body');
        box.appendChild(head); box.appendChild(body);
        dlg.appendChild(box);
        doc.body.appendChild(dlg);
        let done = null;
        const finished = new Promise((r) => { done = r; });
        const close = (value) => {
            if (!dlg.isConnected) return;
            doc.documentElement.classList.remove('ovl-locked');
            const end = () => { try { dlg.close(); } catch (_) { /* closed */ } dlg.remove(); done(value); };
            if (reduce()) end(); else { dlg.classList.remove('is-open'); setTimeout(end, 220); }
        };
        x.addEventListener('click', () => close(null));
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
        dlg.showModal();
        doc.documentElement.classList.add('ovl-locked');
        if (reduce()) dlg.classList.add('is-open'); else root.requestAnimationFrame(() => root.requestAnimationFrame(() => dlg.classList.add('is-open')));
        return { dlg, body, close, finished, setTitle: (t) => { head.querySelector('.ovl-title').textContent = t; } };
    }
    function field(label, attrs, hint) {
        const wrap = el('label', 'ovl-field');
        wrap.appendChild(el('span', 'ovl-label', null, label));
        const row = el('span', 'ovl-inputrow');
        const input = el('input', 'ovl-input', Object.assign({ autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none' }, attrs));
        row.appendChild(input);
        if (attrs.type === 'password') {
            const eye = el('button', 'ovl-iconbtn is-small', { type: 'button', 'aria-label': 'Show', 'aria-pressed': 'false' });
            eye.appendChild(icon('eye'));
            eye.addEventListener('click', () => {
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                eye.setAttribute('aria-pressed', String(show)); eye.setAttribute('aria-label', show ? 'Hide' : 'Show');
                input.focus();
            });
            row.appendChild(eye);
        }
        wrap.appendChild(row);
        if (hint) wrap.appendChild(el('span', 'ovl-hint', null, hint));
        return { wrap, input };
    }
    const button = (label, kind, attrs) => el('button', `ovl-btn${kind ? ` is-${kind}` : ''}`, Object.assign({ type: 'button' }, attrs || {}), label);
    const say = (box, words, bad) => { box.textContent = words || ''; box.className = `ovl-msg${bad ? ' is-bad' : ''}`; };

    // ── Make your locker ────────────────────────────────────────────────────────────────────────────────────
    async function setup(opts) {
        const o = Object.assign({}, opts || {});
        const s = sheet('Make your locker');
        const step1 = () => {
            s.body.replaceChildren();
            s.body.appendChild(el('p', 'ovl-lead', null, 'Your locker holds the keys that open what people lock for you. OpenVibe keeps only a locked copy: nobody here can open it, and nobody can reset it.'));
            const f = el('form', 'ovl-form', { novalidate: true });
            const p1 = field('A passphrase', { type: 'password', autocomplete: 'new-password', 'data-k': 'pass' }, 'Four or more words you will remember. Not one you use anywhere else.');
            const meter = el('span', 'ovl-meter', { 'data-score': '0', 'aria-live': 'polite' });
            meter.appendChild(el('span', 'ovl-meterbar'));
            meter.appendChild(el('span', 'ovl-meterwords'));
            p1.wrap.appendChild(meter);
            const p2 = field('The same again', { type: 'password', autocomplete: 'new-password', 'data-k': 'pass2' });
            const msg = el('p', 'ovl-msg', { 'aria-live': 'polite' });
            const go = button('Next', 'primary', { type: 'submit', 'data-k': 'next' });
            p1.input.addEventListener('input', () => { const st = strength(p1.input.value); meter.dataset.score = String(st.score); meter.lastChild.textContent = st.words; });
            f.appendChild(p1.wrap); f.appendChild(p2.wrap); f.appendChild(msg); f.appendChild(go);
            f.addEventListener('submit', (e) => {
                e.preventDefault();
                if (strength(p1.input.value).score < 3) return say(msg, 'Make it longer: four words, or 16 characters or more.', true);
                if (p1.input.value !== p2.input.value) return say(msg, 'The two do not match.', true);
                step2(p1.input.value);
            });
            s.body.appendChild(f);
            setTimeout(() => p1.input.focus(), 0);
        };
        const step2 = async (passphrase) => {
            s.body.replaceChildren(el('p', 'ovl-lead', { role: 'status' }, 'Making your keys on this device…'));
            let c, person, words;
            try {
                c = await core();
                person = await c.generatePersonKeys();
                words = await c.recoveryWords(RECOVERY_WORDS);
            } catch (e) { s.body.replaceChildren(el('p', 'ovl-msg is-bad', { role: 'alert' }, e.message)); return; }
            step3(c, person, passphrase, words);
        };
        const step3 = (c, person, passphrase, words) => {
            s.setTitle('Your recovery kit');
            s.body.replaceChildren();
            s.body.appendChild(el('p', 'ovl-lead', null, 'If you forget your passphrase, these 24 words are the only other way into your locker. Write them down or save them somewhere only you can reach. They are shown once.'));
            const grid = el('ol', 'ovl-words', { 'aria-label': 'Your 24 recovery words' });
            words.forEach((w) => grid.appendChild(el('li', null, null, w)));
            s.body.appendChild(grid);
            const acts = el('div', 'ovl-acts');
            const copy = button('Copy the words', 'quiet', { 'data-k': 'copy' });
            copy.addEventListener('click', async () => {
                try { await root.navigator.clipboard.writeText(words.join(' ')); copy.textContent = 'Copied'; } catch (_) { copy.textContent = 'Select and copy them'; }
            });
            const save = button('Save as a file', 'quiet', { 'data-k': 'save' });
            save.addEventListener('click', () => {
                const text = `OpenVibe Locker recovery kit\n\nThese 24 words open your locker if you forget your passphrase.\nKeep them where only you can reach them. Anyone with them can open your locker.\n\n${words.map((w, i) => `${String(i + 1).padStart(2, ' ')}. ${w}`).join('\n')}\n`;
                const a = el('a', null, { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: 'openvibe-locker-recovery-kit.txt' });
                doc.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            });
            acts.appendChild(copy); acts.appendChild(save);
            s.body.appendChild(acts);
            // Two words back, so the kit was really kept.
            const pick = [3 + Math.floor(Math.random() * 8), 13 + Math.floor(Math.random() * 10)];
            const f = el('form', 'ovl-form', { novalidate: true });
            const w1 = field(`Word ${pick[0] + 1}`, { type: 'text', 'data-k': 'w1', autocomplete: 'off' });
            const w2 = field(`Word ${pick[1] + 1}`, { type: 'text', 'data-k': 'w2', autocomplete: 'off' });
            const row = el('div', 'ovl-pair'); row.appendChild(w1.wrap); row.appendChild(w2.wrap);
            f.appendChild(el('p', 'ovl-label', null, 'Check you kept them'));
            f.appendChild(row);
            const msg = el('p', 'ovl-msg', { 'aria-live': 'polite' });
            f.appendChild(msg);
            const go = button('Make my locker', 'primary', { type: 'submit', 'data-k': 'make' });
            f.appendChild(go);
            f.addEventListener('submit', async (e) => {
                e.preventDefault();
                const ok = [w1.input.value, w2.input.value].map((v) => v.trim().toLowerCase());
                if (ok[0] !== words[pick[0]] || ok[1] !== words[pick[1]]) return say(msg, 'Those are not the words in your kit. Look again.', true);
                go.disabled = true; say(msg, 'Locking your keys and saving the locked copies…');
                try {
                    const pub = await c.exportPersonKeys(person);
                    const priv = utf8(JSON.stringify(await c.exportPrivateKeys(person)));
                    // seal() answers { header, bytes, … }: the bytes are the envelope that goes on the wire.
                    const byPass = (await c.seal(priv, { lock: 'password', password: passphrase })).bytes;
                    const byWords = (await c.seal(priv, { lock: 'password', password: words.join(' ') })).bytes;
                    await network('PUT', '/api/v1/me/keys', {
                        ecdh_public: pub.ecdh, signing_public: pub.signing, self_signature: pub.self_signature,
                        backups: { passphrase: { format: 'locker.envelope.v1', envelope: b64(byPass) }, recovery: { format: 'locker.envelope.v1', envelope: b64(byWords) } },
                    });
                    session = { person, subject: null, fingerprint: pub.fingerprint };
                    doc.dispatchEvent(new CustomEvent('ov-locker:change', { detail: state() }));
                    step4(pub.fingerprint);
                } catch (err) {
                    go.disabled = false;
                    say(msg, err.status === 401 ? 'Sign in to OpenVibe first, then make your locker.' : `Could not save your locker: ${err.message}`, true);
                }
            });
            s.body.appendChild(f);
        };
        const step4 = (fingerprint) => {
            s.setTitle('Your locker is ready');
            s.body.replaceChildren();
            const ok = el('div', 'ovl-done');
            ok.appendChild(icon('tick', 'ovl-ico is-big'));
            ok.appendChild(el('p', 'ovl-lead', null, 'People can now lock things for you, and only you can open them.'));
            ok.appendChild(el('p', 'ovl-label', null, 'Your locker’s fingerprint'));
            ok.appendChild(el('p', 'ovl-fp', { 'data-k': 'fingerprint' }, fingerprint));
            ok.appendChild(el('p', 'ovl-hint', null, 'Someone who wants to be sure a locked item is for you can compare these words with you, in person or on a call.'));
            const d = button('Done', 'primary', { 'data-k': 'done' });
            d.addEventListener('click', () => s.close(state()));
            ok.appendChild(d);
            s.body.appendChild(ok);
            if (typeof o.onDone === 'function') o.onDone(state());
        };
        step1();
        return s.finished;
    }

    // ── Unlock your locker on this device ───────────────────────────────────────────────────────────────────
    async function unlock(opts) {
        const o = Object.assign({}, opts || {});
        if (session) return state();
        const s = sheet('Unlock your locker');
        let backups = null;
        const draw = (mode) => {
            s.body.replaceChildren();
            s.body.appendChild(el('p', 'ovl-lead', null, mode === 'words'
                ? 'Type your 24 recovery words, in order, with spaces between them.'
                : 'Your passphrase opens your locker on this device. It stays here: OpenVibe never sees it.'));
            const f = el('form', 'ovl-form', { novalidate: true });
            let input;
            if (mode === 'words') {
                const wrap = el('label', 'ovl-field');
                wrap.appendChild(el('span', 'ovl-label', null, 'Recovery words'));
                input = el('textarea', 'ovl-input ovl-wordsin', { rows: '4', 'data-k': 'words', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none' });
                wrap.appendChild(input);
                f.appendChild(wrap);
            } else {
                const p = field('Passphrase', { type: 'password', autocomplete: 'current-password', 'data-k': 'pass' });
                input = p.input;
                f.appendChild(p.wrap);
            }
            const msg = el('p', 'ovl-msg', { 'aria-live': 'polite' });
            f.appendChild(msg);
            const go = button('Unlock', 'primary', { type: 'submit', 'data-k': 'unlock' });
            f.appendChild(go);
            const other = el('button', 'ovl-link', { type: 'button', 'data-k': 'other' }, mode === 'words' ? 'Use my passphrase instead' : 'I forgot it: use my recovery kit');
            other.addEventListener('click', () => draw(mode === 'words' ? 'pass' : 'words'));
            f.appendChild(other);
            f.addEventListener('submit', async (e) => {
                e.preventDefault();
                const secret = mode === 'words' ? input.value.trim().toLowerCase().split(/\s+/).join(' ') : input.value;
                if (!secret) return say(msg, mode === 'words' ? 'Type the 24 words.' : 'Type your passphrase.', true);
                go.disabled = true; say(msg, 'Unlocking…');
                try {
                    const c = await core();
                    if (!backups) backups = await network('GET', '/api/v1/me/keys/backup');
                    const b = backups[mode === 'words' ? 'recovery' : 'passphrase'];
                    if (!b || !b.envelope) throw Object.assign(new Error('nothing'), { status: 404 });
                    const priv = JSON.parse(fromUtf8(await c.open(unb64(b.envelope), { password: secret })));
                    const person = await c.importPersonKeys(priv);
                    const pub = await c.exportPersonKeys(person);
                    session = { person, subject: backups.subject || null, fingerprint: pub.fingerprint };
                    doc.dispatchEvent(new CustomEvent('ov-locker:change', { detail: state() }));
                    s.close(state());
                    if (typeof o.onDone === 'function') o.onDone(state());
                } catch (err) {
                    go.disabled = false;
                    if (err.status === 404) {
                        say(msg, 'You have no locker yet.', true);
                        const mk = button('Make my locker', 'quiet', { 'data-k': 'make-instead' });
                        mk.addEventListener('click', async () => { s.close(null); const st = await setup(); if (st && typeof o.onDone === 'function') o.onDone(st); });
                        msg.appendChild(doc.createTextNode(' ')); msg.appendChild(mk);
                    } else if (err.status === 401) say(msg, 'Sign in to OpenVibe first.', true);
                    else if (err.code === 'locker.wrong_key') say(msg, mode === 'words' ? 'Those words do not open your locker. Check each one.' : 'That passphrase does not open your locker.', true);
                    else say(msg, `Could not unlock: ${err.message}`, true);
                }
            });
            s.body.appendChild(f);
            setTimeout(() => input.focus(), 0);
        };
        draw('pass');
        return s.finished;
    }

    // ── The card a locked item shows ────────────────────────────────────────────────────────────────────────
    async function open(container, opts) {
        const o = Object.assign({}, opts || {});
        const card = el('div', 'ovl-card', { role: 'region', 'aria-label': 'Locked' });
        container.replaceChildren(card);
        const top = (title, words, lockIcon) => {
            card.replaceChildren();
            card.appendChild(icon(lockIcon || 'lock', 'ovl-ico is-big'));
            card.appendChild(el('h2', 'ovl-cardtitle', null, title));
            if (words) card.appendChild(el('p', 'ovl-muted', null, words));
        };
        top('Opening…', '');
        let bytes = o.bytes, c, info;
        try {
            c = await core();
            if (!bytes && o.url) {
                const r = await fetch(o.url, { credentials: 'include' });
                if (!r.ok) throw Object.assign(new Error(`The locked item answered ${r.status}`), { status: r.status });
                bytes = new Uint8Array(await r.arrayBuffer());
            }
            info = c.inspect(bytes);
        } catch (e) { top('This locked item cannot open', e.message); return null; }
        const done = (plain) => {
            card.replaceChildren();
            card.classList.add('is-opened');
            if (typeof o.onOpen === 'function') o.onOpen(plain, info);
            doc.dispatchEvent(new CustomEvent('ov-locker:opened', { detail: { lock: info.lock } }));
            return plain;
        };
        const tryOpen = async (credentials) => done(await c.open(bytes, credentials));

        if (info.lock === 'link') {
            const key = keyFromLink(o.link);
            if (key) {
                try { return await tryOpen({ key }); } catch (_) { top('This link does not open it', 'The key in the link is not the one it was locked with. Ask for the link again.'); return null; }
            }
            top('This link is missing its key', 'A locked link carries its key after the # at the end. Ask for the whole link: OpenVibe never had the key, so it cannot send it.');
            return null;
        }

        if (info.lock === 'password') {
            top(o.title ? `“${o.title}” is locked` : 'This is locked with a password', 'Type the password you were given. It stays on this device: OpenVibe cannot read what is inside.');
            const f = el('form', 'ovl-form', { novalidate: true });
            const p = field('Password', { type: 'password', autocomplete: 'off', 'data-k': 'item-pass' });
            const msg = el('p', 'ovl-msg', { 'aria-live': 'polite' });
            const go = button('Open', 'primary', { type: 'submit', 'data-k': 'item-open' });
            f.appendChild(p.wrap); f.appendChild(msg); f.appendChild(go);
            card.appendChild(f);
            return new Promise((resolve) => {
                f.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!p.input.value) return say(msg, 'Type the password.', true);
                    go.disabled = true; say(msg, 'Opening…');
                    try { resolve(await tryOpen({ password: p.input.value })); }
                    catch (err) { go.disabled = false; say(msg, err.code === 'locker.wrong_key' ? 'That password does not open it.' : `Could not open it: ${err.message}`, true); p.input.select(); }
                });
            });
        }

        // people: your locker opens it, if it is for you.
        const forMe = async () => {
            try { return await tryOpen({ person: session.person }); }
            catch (err) {
                if (err.code === 'locker.no_slot' || err.code === 'locker.wrong_key') {
                    top('This is not locked for you', 'It is locked for specific people, and your locker is not one of them. Ask the person who shared it.');
                } else top('This locked item cannot open', err.message);
                return null;
            }
        };
        if (session) return forMe();
        top(o.title ? `“${o.title}” is locked for you` : 'This is locked for specific people', 'Unlock your locker on this device to open it. OpenVibe cannot read what is inside.');
        const go = button('Unlock my locker', 'primary', { 'data-k': 'item-unlock' });
        card.appendChild(go);
        return new Promise((resolve) => {
            go.addEventListener('click', async () => { const st = await unlock(); if (st && st.unlocked) resolve(await forMe()); });
        });
    }

    root.OVLocker = { open, setup, unlock, state, forget, keyFromLink, strength, version: 1 };
})(typeof window !== 'undefined' ? window : null);
