/**
 * openvibe-shared/ov-share.js — one Share sheet for anything on OpenVibe, on every site (plan track Q; the owner,
 * 2026-11-06: share with named accounts only, give a thing away with the recipient's say-so, "for everything else too …
 * a more universal system", and "a unified share system … more platforms … easy copying of a link … the phone's own share
 * thing … intuitive, user-friendly"). The look is ov-share.css, linked from beside this file; docs/share.md has both.
 *
 * One sheet, two parts, never tabs:
 *   Send it      for everyone: the link and Copy; on a phone, the phone's own share sheet (contacts, messages, apps);
 *                X, Bluesky, WhatsApp, Reddit, Discord, Telegram, Threads, Mastodon, Facebook, email, Messages,
 *                LinkedIn, Pinterest, Tumblr, Hacker News, LINE (recent ones first, the rest behind "More (n)"); a QR
 *                code made on the device; "Start at 1:23"; embed code.
 *   Who can open it   for the owner, when the thing has kind and id: Everyone, Anyone with the link, Specific people
 *                (by @name, each Can view or Can edit, with an end date), Only me; people who asked; Transfer.
 *
 * A locked item (Locker, ov-locker.js) gets one more part between them: what its lock means in plain words, each
 * person's eight-word fingerprint (and a warning when their key changed), and, for a people lock, adding someone (their
 * content key is wrapped for them on this device) and removing someone (the content is sealed again under a fresh key,
 * and the sheet says they keep what they already opened). A link lock's key is the part of the link after #, which
 * browsers never send; the sheet never invents it, it copies the whole link. ov-locker.js is loaded on the first press
 * of that part, never before.
 *
 *   <button type="button" data-ov-share-sheet data-title="…">Share</button>       the page's own address
 *     data-url="https://…"      the link to share (else the page's address)
 *     data-text="…"             a line to send with it (email, the phone's sheet)
 *     data-image="https://…"    a picture of it (Pinterest)
 *     data-embed="https://…"    an embeddable player address (the Embed tile)
 *     data-time-from="#player"  a <video> or <audio> whose current time offers "Start at …" (data-time-param, else t)
 *     data-kind="paste" data-id="abc"   also "Who can open it", for its owner (data-base, data-path as below)
 *     data-base="https://…"     the service's origin, when it is not this page's
 *     data-path="/api/v1/…"     the share URL, when it is not /api/v1/<kind>/<id>/share
 *
 *   OVShare.open({ url?, title?, text?, image?, embedUrl?, time?, timeParam?, kind?, id?, base?, path?, token?, headers?, onChange? })
 *       opens the sheet; resolves with the saved sharing state, or null when nothing was saved
 *   OVShare.offer(el, { kind, id, transfer_id, from, expires_at, keep_access?, title?, base?, token?, onDone? })
 *       the recipient's banner for a pending transfer: Accept, Decline
 *   OVShare.gate(el, { kind, id, signedInAs?, signInUrl?, base?, token?, onDone? })
 *       the page a person who is not on the list sees: "Ask for access", or "Sign in"
 *   <div data-ov-share-gate data-kind="post" data-id="12" data-signed-in-as="usr_…" data-sign-in-url="/auth/login?next=…">
 *       the same gate from markup, started when this file loads (and by OVShare.startGates() for markup added later):
 *       no inline script, so a page under a strict CSP needs nothing else, and every value goes through the page's
 *       own attribute escaping (data-base and data-path as for the sheet). The element's text is what shows before.
 *
 * The sheet only asks; the service decides. Who may see a thing is enforced by the service holding it (canView), never
 * by this file. Every name and title is set as text, never as markup. No tracking is added to a shared link.
 *
 * Calls (openvibe-sdk/share's router); a 401, 403 or 404 on the first GET means "not the owner": the sheet sends only.
 *   GET  <path>                       { audience, audiences, roles, you, owner, members, requests, transfer, title, link } + ETag
 *   PUT  <path>   If-Match            { audience, members: [{ subject | name, role, expires_at? }], notify } → the same
 *   POST <path>/transfer              { to, keep_access }      POST <path>/transfer/cancel   { transfer_id }
 *   POST <path>/transfer/accept       POST <path>/transfer/decline   { transfer_id }
 *   POST <path>/requests              (ask for access)          POST <path>/requests/<id>/dismiss
 *   GET  <base>/api/v1/share/people?name=x   { person: { subject, username, display_name, avatar_url } | null }
 * Events on document: 'ov-share:change' { kind, id, state } after a save, a transfer or an answer;
 *                     'ov-share:sent' { target, url, kind, id } when the link goes somewhere (copy, x, device, qr …).
 */
(function (root) {
    'use strict';
    if (!root || !root.document || root.OVShare) return;
    const doc = root.document;
    const NAME_RE = /^[A-Za-z0-9_.-]{1,40}$/;   // Network's username rule
    const AUDIENCES = {
        public: { label: 'Everyone', title: 'Everyone', desc: 'Listed on the site and in search. Anyone can open it.' },
        link: { label: 'Link', title: 'Anyone with the link', desc: 'Not listed and not in search. Anyone with the link can open it.' },
        people: { label: 'People', title: 'Specific people', desc: 'Only you and the people below, signed in to OpenVibe.' },
        private: { label: 'Only me', title: 'Only me', desc: 'Only you can open it.' },
    };
    const ROLE_WORDS = { viewer: 'Can view', editor: 'Can edit' };
    // What each lock means, in the words the person choosing it reads (Locker design 2026-11-06: "OpenVibe can't read
    // what's inside"). The same three sentences are on the page that makes a locked item.
    const LOCK_WORDS = {
        people: {
            label: 'For the people on the list',
            means: 'Only you and the people below can open it, each with their own keys. OpenVibe can’t read what’s inside.',
        },
        password: {
            label: 'With a password',
            means: 'Anyone you give the password to can open it. OpenVibe can’t read what’s inside, and if the password is lost, nobody can open it, including us.',
        },
        link: {
            label: 'With the link',
            means: 'The key travels in the link, after the #, which browsers never send to OpenVibe. Anyone with the whole link can open it.',
        },
    };
    const svg = (d, extra) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"${extra || ''}>${d}</svg>`;
    const ICON = {
        public: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.3-3.8-8.5s1.2-6.1 3.8-8.5Z"/>'),
        link: svg('<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/>'),
        people: svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.7-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.8" cy="9.5" r="2.5"/><path d="M15.8 14.2c2.4-.3 4.2 1.2 4.7 4"/>'),
        private: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
        close: svg('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>'),
        back: svg('<path d="M14.5 6 8.5 12l6 6"/>'),
        copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8"/>'),
        give: svg('<path d="M4 12h12M12 6l6 6-6 6"/><path d="M20 5v14"/>'),
        tick: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    };

    // ── Small helpers ─────────────────────────────────────────────────────────────────────────────────────────
    const el = (tag, cls, attrs, text) => {
        const n = doc.createElement(tag);
        if (cls) n.className = cls;
        if (attrs) for (const k of Object.keys(attrs)) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
        if (text != null) n.textContent = text;
        return n;
    };
    const iconEl = (name, cls) => { const s = el('span', cls || 'ov-share-ico'); s.innerHTML = ICON[name]; return s; };   // constants only
    const reduce = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const cleanName = (s) => String(s || '').trim().replace(/^@+/, '');
    const sid = (s) => (!s ? '' : typeof s === 'string' ? s : `${s.type}:${s.id}`);
    const same = (a, b) => !!a && !!b && sid(a) === sid(b);
    const handle = (p) => (p && p.username ? `@${p.username}` : '');
    const nameOf = (p) => (p && (p.display_name || p.username)) || 'Someone';
    function when(iso, withYear) {
        const d = new Date(iso);
        if (!iso || isNaN(d)) return '';
        const o = { month: 'short', day: 'numeric' };
        if (withYear || d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
        return d.toLocaleDateString(undefined, o);
    }
    function hue(s) { let h = 0; for (const c of String(s || '?')) h = (h * 31 + c.codePointAt(0)) % 360; return h; }
    function avatar(p) {
        const s = el('span', 'ov-share-av', { 'aria-hidden': 'true' });
        const initial = (nameOf(p).trim()[0] || '?').toUpperCase();
        s.style.setProperty('--ov-share-h', String(hue(p && (p.username || sid(p.subject)))));
        const url = p && p.avatar_url;
        if (url && /^(https:\/\/|\/(?!\/))/.test(url)) {
            const img = el('img', null, { src: url, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
            img.addEventListener('error', () => { img.remove(); s.textContent = initial; }, { once: true });
            s.appendChild(img);
        } else s.textContent = initial;
        return s;
    }

    // The look, once, from beside this script (a page or the navbar may have linked it already).
    function stylesheet() {
        if (doc.querySelector('link[href*="ov-share.css"]')) return;
        const me = doc.currentScript || doc.querySelector('script[src*="ov-share.js"]');
        const src = me && me.src ? me.src : '/shared/ov-share.js';
        doc.head.appendChild(el('link', null, { rel: 'stylesheet', href: src.replace(/ov-share\.js(\?[^#]*)?.*$/, 'ov-share.css$1') }));
    }
    stylesheet();

    // ── Talking to the service ────────────────────────────────────────────────────────────────────────────────
    function endpoint(o) {
        const base = String(o.base || '').replace(/\/+$/, '');
        const path = o.path || `/api/v1/${encodeURIComponent(o.kind)}/${encodeURIComponent(o.id)}/share`;
        return { base, path: base + path };
    }
    async function call(o, method, url, body, extra) {
        const headers = Object.assign({ accept: 'application/json', 'x-requested-with': 'ov-share' }, o.headers || {}, extra || {});
        if (body !== undefined) headers['content-type'] = 'application/json';
        if (o.token) headers.authorization = `Bearer ${o.token}`;
        const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: o.base ? 'include' : 'same-origin' });
        let j = null;
        try { j = await r.json(); } catch (_) { /* an empty answer */ }
        if (!r.ok) {
            const e = new Error((j && (j.message || j.error_description)) || `The service answered ${r.status}`);
            e.status = r.status; e.body = j;
            throw e;
        }
        const out = j || {};
        const tag = r.headers && r.headers.get ? r.headers.get('etag') : null;
        if (tag) Object.defineProperty(out, '__etag', { value: tag, enumerable: false });
        return out;
    }
    // One @name → a person, or null. undefined means the check itself could not run (the name is checked on save).
    async function lookup(o, name) {
        try {
            const j = await call(o, 'GET', `${endpoint(o).base}/api/v1/share/people?name=${encodeURIComponent(name)}`);
            return j.person && j.person.subject ? j.person : null;
        } catch (e) {
            if (e.status === 429) { const x = new Error('Too many name checks. Wait a minute, then try again.'); x.status = 429; throw x; }
            return undefined;
        }
    }
    function announce(o, state) {
        doc.dispatchEvent(new CustomEvent('ov-share:change', { detail: { kind: o.kind, id: o.id, state } }));
        if (typeof o.onChange === 'function') { try { o.onChange(state); } catch (_) { /* the page's problem */ } }
    }

    // ── Send: the link, the device's own share sheet, the places people post it ──────────────────────────────
    // No tracking is added to a link: the address shared is the address of the thing (with ?t= when asked).
    const E = encodeURIComponent;
    const phoneLike = () => !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
    // [id, label, brand slug in brands.js (null: a glyph of our own), the link it opens (null: an action here)]
    const TARGETS = [
        ['x', 'X', 'x', (u, t) => `https://x.com/intent/post?text=${E(t)}&url=${E(u)}`],
        ['bluesky', 'Bluesky', 'bluesky', (u, t) => `https://bsky.app/intent/compose?text=${E(t ? `${t} ${u}` : u)}`],
        ['whatsapp', 'WhatsApp', 'whatsapp', (u, t) => `https://wa.me/?text=${E(t ? `${t} ${u}` : u)}`],
        ['reddit', 'Reddit', 'reddit', (u, t) => `https://www.reddit.com/submit?url=${E(u)}&title=${E(t)}`],
        ['discord', 'Discord', 'discord', null],
        ['telegram', 'Telegram', 'telegram', (u, t) => `https://t.me/share/url?url=${E(u)}&text=${E(t)}`],
        ['threads', 'Threads', 'threads', (u, t) => `https://www.threads.net/intent/post?text=${E(t ? `${t} ${u}` : u)}`],
        ['mastodon', 'Mastodon', 'mastodon', null],
        ['facebook', 'Facebook', 'facebook', (u) => `https://www.facebook.com/sharer/sharer.php?u=${E(u)}`],
        ['email', 'Email', null, (u, t, o) => `mailto:?subject=${E(t)}&body=${E(`${o.text ? `${o.text}\n\n` : ''}${u}`)}`],
        ['sms', 'Messages', null, (u, t) => `sms:?&body=${E(t ? `${t} ${u}` : u)}`],
        ['linkedin', 'LinkedIn', null, (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${E(u)}`],
        ['pinterest', 'Pinterest', 'pinterest', (u, t, o) => `https://www.pinterest.com/pin/create/button/?url=${E(u)}&media=${E(o.image)}&description=${E(t)}`],
        ['tumblr', 'Tumblr', 'tumblr', (u, t) => `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${E(u)}&title=${E(t)}`],
        ['hn', 'Hacker News', 'ycombinator', (u, t) => `https://news.ycombinator.com/submitlink?u=${E(u)}&t=${E(t)}`],
        ['line', 'LINE', 'line', (u) => `https://social-plugins.line.me/lineit/share?url=${E(u)}`],
    ];
    const SHOWN = 8;   // tiles before the counted fold ("More places (8)")
    const remembered = (k, fallback) => { try { const v = JSON.parse(root.localStorage.getItem(k)); return v == null ? fallback : v; } catch (_) { return fallback; } };
    const remember = (k, v) => { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } };
    function targetsFor(st) {
        const o = st.o;
        const list = TARGETS.filter(([id]) => (id !== 'pinterest' || o.image) && (id !== 'sms' || phoneLike()));
        const recent = remembered('ov-share-recent', []).filter((id) => list.some((t) => t[0] === id)).slice(0, 3);
        return [...recent.map((id) => list.find((t) => t[0] === id)), ...list.filter((t) => !recent.includes(t[0]))];
    }
    const hms = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
    /** The key a link carries after #k= (a link lock): base64url, 32 bytes. The same rule as ov-locker.js. */
    function linkKey(href) {
        const h = String(href == null ? root.location.hash : href).replace(/^#/, '');
        const m = h.match(/(?:^|&)k=([A-Za-z0-9_-]{43})(?:&|$)/) || String(root.location.hash || '').match(/(?:^|&)k=([A-Za-z0-9_-]{43})(?:&|$)/);
        return m ? m[1] : null;
    }
    function theLink(st) {
        const raw = (st.server && st.server.link) || st.o.link || st.o.url || root.location.href;
        let u;
        try { u = new URL(raw, root.location.href); } catch (_) { return raw; }
        if (st.atTime && st.o.time > 0) u.searchParams.set(st.o.timeParam || 't', String(Math.floor(st.o.time)));
        // A link-locked item is opened by the part after #; the service's own link never has it, the page's address does.
        const key = st.server && st.server.lock === 'link' ? linkKey() : null;
        if (key && !linkKey(u.href)) u.hash = `k=${key}`;
        return u.href;
    }
    const shownLink = (href) => href.replace(/^https?:\/\//, '').replace(/\/$/, '');
    function sent(st, target) {
        if (target !== 'copy') remember('ov-share-recent', [target, ...remembered('ov-share-recent', []).filter((x) => x !== target)].slice(0, 6));
        doc.dispatchEvent(new CustomEvent('ov-share:sent', { detail: { target, url: theLink(st), kind: st.o.kind || null, id: st.o.id || null } }));
    }
    // A short word after an action; quiet ones are only said to a screen reader (the button already shows "Copied").
    function toast(st, words, quiet) {
        st.toastWords = words; st.toastQuiet = !!quiet;
        const t = st.dlg.querySelector('.ov-share-toast');
        if (t) { t.textContent = words; t.classList.toggle('is-quiet', !!quiet); t.classList.remove('is-on'); void t.offsetWidth; t.classList.add('is-on'); }
        clearTimeout(st.toastTimer);
        st.toastTimer = setTimeout(() => { st.toastWords = ''; const n = st.dlg.querySelector('.ov-share-toast'); if (n) n.classList.remove('is-on'); }, 2200);
    }
    async function copyText(st, text) {
        try { await root.navigator.clipboard.writeText(text); return true; } catch (_) { /* fall back below */ }
        const t = el('textarea', 'ov-share-copybuf', { readonly: true, 'aria-hidden': 'true' });
        t.value = text; st.dlg.appendChild(t); t.select();
        let ok = false;
        try { ok = doc.execCommand('copy'); } catch (_) { ok = false; }
        t.remove();
        return ok;
    }
    // A file beside this one (brands.js, ov-qr.js), once; resolves when it has loaded, false when it could not.
    const loading = {};
    function loadSibling(name, global) {
        if (root[global]) return Promise.resolve(true);
        if (loading[name]) return loading[name];
        const me = doc.currentScript || doc.querySelector('script[src*="ov-share.js"]');
        const src = (me && me.src ? me.src : '/shared/ov-share.js').replace(/ov-share\.js(\?[^#]*)?.*$/, `${name}$1`);
        loading[name] = new Promise((resolve) => {
            const sc = el('script', null, { src, async: true });
            sc.onload = () => resolve(!!root[global]);
            sc.onerror = () => { loading[name] = null; resolve(false); };
            doc.head.appendChild(sc);
        });
        return loading[name];
    }
    const GLYPH = {
        email: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7.5 7.5 6 7.5-6"/>',
        sms: '<path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/>',
        linkedin: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 10.5v5M8.5 8v.01M12 15.5v-5M12 13c0-1.5 1-2.5 2.2-2.5s1.8.8 1.8 2.3v2.7"/>',
        device: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M6.5 11H6a2 2 0 0 0-2 2v5.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V13a2 2 0 0 0-2-2h-.5"/>',
        qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
        embed: '<path d="m8.5 8-4.5 4 4.5 4M15.5 8l4.5 4-4.5 4M13.5 5.5l-3 13"/>',
        more: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
        ovchat: '<path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3v-3H5A1.5 1.5 0 0 1 3.5 16V8A1.5 1.5 0 0 1 5 6.5z"/>',
    };
    function tileIcon(id, slug) {
        const s = el('span', `ov-share-tileic is-${id}`, { 'aria-hidden': 'true' });
        const b = slug && root.OVBrands && root.OVBrands.get(slug);
        if (b) { s.style.setProperty('--ov-brand', b.hex); s.innerHTML = root.OVBrands.svg(slug, { size: 22, color: 'currentColor' }); s.classList.add('is-brand'); }   // generated, CC0
        else if (GLYPH[id]) s.innerHTML = svg(GLYPH[id]);   // constants
        else s.textContent = id.slice(0, 1).toUpperCase();
        return s;
    }
    function tile(st, id, label, slug, href, onClick, i) {
        const t = href
            ? el('a', 'ov-share-tile', { href, target: /^(mailto|sms):/.test(href) ? null : '_blank', rel: 'noopener noreferrer', 'data-k': `to-${id}`, style: `--i:${i}` })
            : el('button', 'ov-share-tile', { type: 'button', 'data-k': `to-${id}`, style: `--i:${i}`, 'aria-expanded': onClick && st.panel === id ? 'true' : null });
        t.appendChild(tileIcon(id, slug));
        t.appendChild(el('span', 'ov-share-tilelabel', null, label));
        t.addEventListener('click', (e) => { if (onClick) { e.preventDefault(); onClick(); } else sent(st, id); });
        return t;
    }

    function sendSection(st, body) {
        const o = st.o;
        const sec = el('section', 'ov-share-send', { 'aria-label': 'Send it' });
        const href = theLink(st);
        // The link, and Copy: the one thing everybody can do.
        const pill = el('div', `ov-share-linkpill${st.copied ? ' is-copied' : ''}`);
        pill.appendChild(iconEl('link'));
        const inp = el('input', 'ov-share-linktext', { type: 'text', readonly: true, 'aria-label': 'The link', 'data-k': 'link', value: shownLink(href) });
        inp.value = shownLink(href);
        inp.addEventListener('focus', () => { inp.value = href; inp.select(); });
        inp.addEventListener('blur', () => { inp.value = shownLink(href); });
        pill.appendChild(inp);
        const copy = el('button', 'ov-share-btn is-primary ov-share-copy', { type: 'button', 'data-k': 'copy' });
        copy.appendChild(iconEl(st.copied ? 'tick' : 'copy'));
        copy.appendChild(el('span', null, null, st.copied ? 'Copied' : 'Copy'));
        copy.addEventListener('click', async () => {
            const ok = await copyText(st, href);
            if (!ok) { toast(st, 'Select the link and copy it.'); inp.focus(); return; }
            st.copied = true; sent(st, 'copy'); draw(st); toast(st, 'Link copied', true);
            clearTimeout(st.copyTimer);
            st.copyTimer = setTimeout(() => { st.copied = false; if (st.dlg.isConnected) draw(st); }, 1800);
        });
        pill.appendChild(copy);
        sec.appendChild(pill);
        // Who the link opens for, when the owner is looking and it is not open to everyone.
        if (st.server && owner(st) && (st.audience === 'people' || st.audience === 'private')) {
            sec.appendChild(el('p', 'ov-share-muted ov-share-linkfor', null, st.audience === 'private' ? 'Only you can open this link. Choose who else can, below.' : 'Only you and the people below can open this link.'));
        }
        if (o.time > 0) {
            const l = el('label', 'ov-share-check');
            const sw = el('input', null, { type: 'checkbox', role: 'switch', 'data-k': 'at-time' });
            sw.checked = !!st.atTime;
            sw.addEventListener('change', () => { st.atTime = sw.checked; draw(st); });
            l.appendChild(sw);
            l.appendChild(el('span', null, null, `Start at ${hms(o.time)}`));
            sec.appendChild(l);
        }
        // The device's own share sheet: on a phone, its contacts and every app; first, because it reaches the most.
        const canDevice = !!(root.navigator && typeof root.navigator.share === 'function');
        if (canDevice && phoneLike()) {
            const d = el('button', 'ov-share-device', { type: 'button', 'data-k': 'device' });
            d.appendChild(tileIcon('device'));
            const w = el('span', 'ov-share-devicewords');
            w.appendChild(el('span', 'ov-share-devicetitle', null, 'Send with your phone'));
            w.appendChild(el('span', 'ov-share-muted', null, 'Your contacts, messages and apps'));
            d.appendChild(w);
            d.addEventListener('click', () => device(st));
            sec.appendChild(d);
        }
        // Where people post it: a grid, the person's recent ones first, the rest behind a counted fold.
        const all = targetsFor(st);
        const extra = [];
        if (canDevice && !phoneLike()) extra.push(['device', 'More apps', null, null, () => device(st)]);
        extra.push(['qr', 'QR code', null, null, () => { st.panel = st.panel === 'qr' ? '' : 'qr'; draw(st); }]);
        if (o.embedUrl) extra.push(['embed', 'Embed', null, null, () => { st.panel = st.panel === 'embed' ? '' : 'embed'; draw(st); }]);
        const tiles = all.map(([id, label, slug, fn]) => {
            if (id === 'discord') return [id, label, slug, null, async () => { const ok = await copyText(st, href); sent(st, id); toast(st, ok ? 'Link copied: paste it in Discord' : 'Copy the link, then paste it in Discord'); }];
            if (id === 'mastodon') return [id, label, slug, null, () => { st.panel = st.panel === 'mastodon' ? '' : 'mastodon'; draw(st); }];
            return [id, label, slug, fn(href, st.o.title || '', st.o), null];
        });
        // OpenVibe Chat (4.144.0): to someone on OpenVibe, first, for a signed-in person (the Dock is theirs). The sheet
        // closes and the Dock opens on "Send to…"; nothing is sent until they press Send in the conversation.
        const dock = root.OpenVibeDock && typeof root.OpenVibeDock.share === 'function'
            && (typeof root.OpenVibeDock.canSend !== 'function' || root.OpenVibeDock.canSend()) ? root.OpenVibeDock : null;
        const first = dock ? [['ovchat', 'OpenVibe Chat', null, null, () => {
            sent(st, 'ovchat');
            close(st, true);
            dock.share({ text: o.title ? `${o.title} ${href}` : href, title: o.title || '' });
        }]] : [];
        const room = SHOWN - extra.length - first.length;
        const ordered = [...first, ...tiles.slice(0, room), ...extra, ...tiles.slice(room)];
        const grid = el('div', 'ov-share-grid', { role: 'group', 'aria-label': 'Send it to' });
        const show = st.allTargets ? ordered : ordered.slice(0, SHOWN);
        show.forEach(([id, label, slug, h, fn], i) => grid.appendChild(tile(st, id, label, slug, h, fn, i)));
        if (!st.allTargets && ordered.length > SHOWN) {
            const more = el('button', 'ov-share-tile is-more', { type: 'button', 'data-k': 'more', style: `--i:${SHOWN}`, 'aria-expanded': 'false' });
            more.appendChild(tileIcon('more'));
            more.appendChild(el('span', 'ov-share-tilelabel', null, `More (${ordered.length - SHOWN})`));
            more.addEventListener('click', () => { st.allTargets = true; draw(st); });
            grid.appendChild(more);
        }
        sec.appendChild(grid);
        if (st.panel === 'mastodon') sec.appendChild(mastodonPanel(st, href));
        if (st.panel === 'qr') sec.appendChild(qrPanel(st, href));
        if (st.panel === 'embed') sec.appendChild(embedPanel(st));
        body.appendChild(sec);
    }

    async function device(st) {
        const o = st.o;
        const data = { title: o.title || doc.title, url: theLink(st) };
        if (o.text) data.text = o.text;
        try {
            if (root.navigator.canShare && !root.navigator.canShare(data)) throw new Error('cannot');
            await root.navigator.share(data);
            sent(st, 'device'); toast(st, 'Sent');
        } catch (e) {
            if (e && e.name === 'AbortError') return;   // the person closed their phone's sheet
            toast(st, 'Your device could not share it. Copy the link instead.');
        }
    }
    function mastodonPanel(st, href) {
        const f = el('form', 'ov-share-panel', { novalidate: true, 'aria-label': 'Share on Mastodon' });
        f.appendChild(el('label', 'ov-share-label', { for: 'ov-share-masto' }, 'Your Mastodon server'));
        const row = el('div', 'ov-share-add');
        const field = el('div', 'ov-share-addfield');
        const inp = el('input', null, { id: 'ov-share-masto', type: 'text', 'data-k': 'masto', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'mastodon.social', inputmode: 'url' });
        inp.value = remembered('ov-share-mastodon', '');
        field.appendChild(inp);
        row.appendChild(field);
        row.appendChild(el('button', 'ov-share-btn', { type: 'submit' }, 'Open'));
        f.appendChild(row);
        const msg = el('p', 'ov-share-addmsg', { 'aria-live': 'polite' });
        f.appendChild(msg);
        f.addEventListener('submit', (e) => {
            e.preventDefault();
            const host = inp.value.trim().replace(/^https?:\/\//i, '').replace(/^@?[^@]*@/, '').replace(/\/.*$/, '').toLowerCase();
            if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) { msg.textContent = 'Type the address of your server, like mastodon.social.'; msg.classList.add('is-bad'); return; }
            remember('ov-share-mastodon', host);
            root.open(`https://${host}/share?text=${E(st.o.title ? `${st.o.title} ${href}` : href)}`, '_blank', 'noopener,noreferrer');
            sent(st, 'mastodon');
        });
        setTimeout(() => inp.focus(), 0);
        return f;
    }
    function qrPanel(st, href) {
        const p = el('div', 'ov-share-panel ov-share-qr', { 'aria-label': 'QR code' });
        const art = el('div', 'ov-share-qrart', { role: 'img', 'aria-label': `A QR code for ${shownLink(href)}` });
        p.appendChild(art);
        const side = el('div', 'ov-share-qrside');
        side.appendChild(el('p', 'ov-share-muted', null, 'Point a phone camera at it to open the link. It is made on this device: the link is not sent anywhere.'));
        const dl = el('button', 'ov-share-btn is-small', { type: 'button', 'data-k': 'qr-save' }, 'Save picture');
        side.appendChild(dl);
        p.appendChild(side);
        loadSibling('ov-qr.js', 'OVQR').then((ok) => {
            if (!ok) { art.textContent = 'The QR code could not load.'; dl.disabled = true; return; }
            let markup;
            try { markup = root.OVQR.svg(href, { ecc: 'M', margin: 2, dark: '#0b0f17', light: '#ffffff' }); } catch (_) { art.textContent = 'This link is too long for a QR code.'; dl.disabled = true; return; }
            art.innerHTML = markup;   // made by ov-qr.js from the link, no markup of the link's own
            dl.addEventListener('click', () => {
                const img = new Image();
                img.onload = () => {
                    const c = el('canvas'); c.width = c.height = 1024;
                    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, 1024, 1024);
                    c.toBlob((b) => { if (!b) return; const a = el('a', null, { href: URL.createObjectURL(b), download: `${(st.o.title || 'openvibe').replace(/[^\w.-]+/g, '-').slice(0, 60)}-qr.png` }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); sent(st, 'qr'); }, 'image/png');
                };
                img.src = `data:image/svg+xml;charset=utf-8,${E(markup)}`;
            });
        });
        return p;
    }
    function embedPanel(st) {
        const o = st.o;
        const p = el('div', 'ov-share-panel', { 'aria-label': 'Embed' });
        // The code is pasted into somebody else's page: every attribute value is escaped as HTML.
        const attr = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const t = attr(o.title || 'OpenVibe');
        let src;
        try { src = new URL(o.embedUrl, root.location.href).href; } catch (_) { return p; }
        if (st.atTime && o.time > 0) { const u = new URL(src); u.searchParams.set(o.timeParam || 't', String(Math.floor(o.time))); src = u.href; }
        const code = `<iframe src="${attr(src)}" width="640" height="360" title="${t}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" style="border:0;max-width:100%;aspect-ratio:16/9;height:auto"></iframe>`;
        p.appendChild(el('label', 'ov-share-label', { for: 'ov-share-embed' }, 'Embed on your site'));
        const ta = el('textarea', 'ov-share-code', { id: 'ov-share-embed', readonly: true, rows: '3', 'data-k': 'embed-code', spellcheck: 'false' });
        ta.value = code;
        ta.addEventListener('focus', () => ta.select());
        p.appendChild(ta);
        const c = el('button', 'ov-share-btn is-small', { type: 'button', 'data-k': 'embed-copy' }, 'Copy code');
        c.addEventListener('click', async () => { const ok = await copyText(st, code); toast(st, ok ? 'Embed code copied' : 'Select the code and copy it.'); if (ok) sent(st, 'embed'); });
        p.appendChild(c);
        return p;
    }

    // ── The sheet ─────────────────────────────────────────────────────────────────────────────────────────────
    let current = null;   // the open sheet's state

    function open(opts) {
        const o = Object.assign({}, opts || {});
        if (current) current.close(true);
        stylesheet();
        return new Promise((resolve) => {
            const st = {
                o, server: null, audience: 'private', members: [], notify: true, view: 'main', busy: false,
                note: '', error: '', confirmLeave: false, saved: null, resolve, giveTo: null, keepAccess: false,
                access: !!(o.kind && o.id), first: true, atTime: false, panel: '', allTargets: false,
                lockOpen: false, reseal: false,
            };
            st.dlg = el('dialog', 'ov-share', { 'aria-labelledby': 'ov-share-title' });
            st.close = (force) => close(st, force);
            st.dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(st); });
            st.dlg.addEventListener('click', (e) => { if (e.target === st.dlg) close(st); });   // the backdrop
            doc.body.appendChild(st.dlg);
            current = st;
            draw(st);
            st.dlg.showModal();
            doc.documentElement.classList.add('ov-share-locked');
            if (reduce()) st.dlg.classList.add('is-open');
            else root.requestAnimationFrame(() => root.requestAnimationFrame(() => st.dlg.classList.add('is-open')));
            if (st.access) load(st);
            if (!root.OVBrands) loadSibling('brands.js', 'OVBrands').then((ok) => { if (ok && st.dlg.isConnected) draw(st); });
        });
    }

    async function load(st) {
        try {
            take(st, await call(st.o, 'GET', endpoint(st.o).path));
            st.error = '';
        } catch (e) {
            // Not the owner (or signed out): this person can still send it; who can open it is not theirs to see.
            if ([401, 403, 404].includes(e.status)) st.access = false;
            else st.error = `Could not load who can open this. ${e.message}`;
        }
        draw(st);
    }
    function take(st, s) {
        st.server = s;
        if (s.__etag) st.etag = s.__etag;
        st.audience = s.audience || 'private';
        st.members = (s.members || []).map((m) => Object.assign({}, m));
        st.confirmLeave = false;
    }
    const owner = (st) => !!(st.server && st.server.you && st.server.you.role === 'owner');
    const roles = (st) => (st.server && Array.isArray(st.server.roles) && st.server.roles.length ? st.server.roles : ['viewer']);
    function memberKey(m) { return m.subject ? sid(m.subject) : `name:${String(m.name || m.username).toLowerCase()}`; }
    function dirty(st) {
        if (!st.server) return false;
        if (st.reseal) return true;
        if (st.audience !== (st.server.audience || 'private')) return true;
        const a = (st.server.members || []).map((m) => `${memberKey(m)}|${m.role}|${m.expires_at || ''}`).sort().join(',');
        const b = st.members.map((m) => `${memberKey(m)}|${m.role}|${m.expires_at || ''}`).sort().join(',');
        return a !== b;
    }

    function close(st, force) {
        if (!st.dlg.isConnected) return;
        if (!force && dirty(st) && !st.confirmLeave) { st.confirmLeave = true; draw(st); return; }
        if (current === st) current = null;
        doc.documentElement.classList.remove('ov-share-locked');
        const done = () => { try { st.dlg.close(); } catch (_) { /* closed */ } st.dlg.remove(); st.resolve(st.saved); };
        if (reduce()) return done();
        st.dlg.classList.remove('is-open');
        let ended = false;
        const end = () => { if (!ended) { ended = true; done(); } };
        st.dlg.addEventListener('transitionend', end, { once: true });
        setTimeout(end, 260);
    }

    // Draw the whole sheet again from its state: small enough that keeping it simple beats patching it.
    function draw(st, focus) {
        const keep = doc.activeElement && st.dlg.contains(doc.activeElement) ? doc.activeElement.getAttribute('data-k') : null;
        const box = el('div', `ov-share-box${st.first ? ' is-first' : ''}`);
        st.first = false;
        box.appendChild(head(st));
        const body = el('div', 'ov-share-body');
        if (st.view === 'give') giveView(st, body); else mainView(st, body);
        box.appendChild(body);
        box.appendChild(foot(st));
        box.appendChild(el('p', `ov-share-toast${st.toastWords ? ' is-on' : ''}${st.toastQuiet ? ' is-quiet' : ''}`, { role: 'status', 'aria-live': 'polite' }, st.toastWords || ''));
        st.dlg.replaceChildren(box);
        // A panel just opened (QR code, Embed, Mastodon) comes into view in the sheet's scroll.
        if (st.panel && st.panel !== st.shownPanel) {
            const pnl = st.dlg.querySelector('.ov-share-panel');
            if (pnl && pnl.scrollIntoView) pnl.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
        }
        st.shownPanel = st.panel;
        const want = keep ? st.dlg.querySelector(`[data-k="${keep}"]`) : null;
        if (want) want.focus();
        else if (focus || !keep) {
            const first = st.dlg.querySelector('[data-k="give-name"]') || st.dlg.querySelector('[data-k="copy"]') || st.dlg.querySelector('[data-k="close"]');
            if (first) first.focus();
        }
    }

    function head(st) {
        const h = el('div', 'ov-share-head');
        if (st.view === 'give') {
            const b = el('button', 'ov-share-iconbtn', { type: 'button', 'aria-label': 'Back', 'data-k': 'back' });
            b.appendChild(iconEl('back'));
            b.addEventListener('click', () => { st.view = 'main'; st.error = ''; draw(st, true); });
            h.appendChild(b);
        }
        const title = (st.server && st.server.title) || st.o.title || '';
        const t = el('h2', 'ov-share-title', { id: 'ov-share-title' });
        t.textContent = st.view === 'give' ? 'Transfer ownership' : (title ? `Share “${title}”` : 'Share');
        h.appendChild(t);
        const x = el('button', 'ov-share-iconbtn', { type: 'button', 'aria-label': 'Close', 'data-k': 'close' });
        x.appendChild(iconEl('close'));
        x.addEventListener('click', () => close(st));
        h.appendChild(x);
        return h;
    }

    function mainView(st, body) {
        sendSection(st, body);
        if (!st.access) return;
        if (!st.server) {
            body.appendChild(el('p', st.error ? 'ov-share-error' : 'ov-share-muted', { role: st.error ? 'alert' : null }, st.error || 'Loading who can open this\u2026'));
            return;
        }
        const s = st.server;
        const mine = owner(st);
        body.appendChild(el('hr', 'ov-share-rule'));
        if (s.transfer && s.transfer.state === 'pending' && mine) body.appendChild(pendingBanner(st));

        // Who can open this: four choices, one line saying what the chosen one means.
        // A locked item is never public (the service refuses it too): the choice is not offered.
        const offered = (Array.isArray(s.audiences) && s.audiences.length ? s.audiences : Object.keys(AUDIENCES))
            .filter((a) => AUDIENCES[a] && !(isLocked(st) && a === 'public'));
        const fs = el('fieldset', 'ov-share-aud', { disabled: !mine || st.busy });
        fs.appendChild(el('legend', 'ov-share-label', null, 'Who can open this'));
        const seg = el('div', 'ov-share-seg', { style: `--n:${offered.length}` });
        for (const a of offered) {
            const lab = el('label', 'ov-share-segopt', { title: AUDIENCES[a].title });
            const r = el('input', null, { type: 'radio', name: 'ov-share-aud', value: a, 'data-k': `aud-${a}` });
            r.checked = st.audience === a;
            r.addEventListener('change', () => { st.audience = a; st.note = ''; draw(st); });
            lab.appendChild(r);
            lab.appendChild(iconEl(a));
            lab.appendChild(el('span', 'ov-share-seglabel', null, AUDIENCES[a].label));
            seg.appendChild(lab);
        }
        fs.appendChild(seg);
        const desc = el('p', 'ov-share-desc', { 'aria-live': 'polite' });
        desc.appendChild(el('strong', null, null, `${AUDIENCES[st.audience] ? AUDIENCES[st.audience].title : st.audience}. `));
        desc.appendChild(doc.createTextNode(AUDIENCES[st.audience] ? AUDIENCES[st.audience].desc : ''));
        fs.appendChild(desc);
        body.appendChild(fs);

        // Locked items: what the lock means, the fingerprints, and the people they are wrapped for.
        if (isLocked(st)) body.appendChild(lockSection(st));

        // People: who has access (or, on an open item, who may edit it).
        const open = st.audience === 'public' || st.audience === 'link';
        const canEditRole = roles(st).includes('editor');
        const listMeans = open ? (canEditRole ? 'edit' : 'nothing') : 'open';
        const sec = el('section', 'ov-share-people', { 'aria-labelledby': 'ov-share-people-h' });
        const hd = el('div', 'ov-share-sechead');
        hd.appendChild(el('h3', 'ov-share-label', { id: 'ov-share-people-h' }, open ? 'People who can edit' : 'People with access'));
        sec.appendChild(hd);
        if (mine && listMeans !== 'nothing') sec.appendChild(adder(st));
        if (st.note) sec.appendChild(el('p', 'ov-share-note', { role: 'status' }, st.note));
        if (st.audience === 'private' && st.members.length) {
            sec.appendChild(el('p', 'ov-share-warn', null, st.members.length === 1
                ? 'Only me: saving removes the person below.' : `Only me: saving removes the ${st.members.length} people below.`));
        }
        if (open && listMeans === 'nothing' && st.members.length) {
            sec.appendChild(el('p', 'ov-share-muted', null, 'Anyone can open it now, so this list does nothing. Choose People to limit it to them.'));
        }
        const ul = el('ul', 'ov-share-list');
        if (s.owner) ul.appendChild(personRow(st, s.owner, { tag: 'Owner', you: s.you && same(s.owner.subject, s.you.subject) }));
        st.members.forEach((m, i) => ul.appendChild(personRow(st, m, { member: m, index: i, dim: st.audience === 'private' })));
        sec.appendChild(ul);
        if (!st.members.length && listMeans === 'open' && mine) {
            sec.appendChild(el('p', 'ov-share-muted', null, st.audience === 'private' ? 'Add someone by name to share it with them.' : 'Nobody else yet. Add someone by their OpenVibe name.'));
        }
        if (st.members.some((m) => m.isNew)) {
            const nl = el('label', 'ov-share-check');
            const cb = el('input', null, { type: 'checkbox', 'data-k': 'notify' });
            cb.checked = st.notify;
            cb.addEventListener('change', () => { st.notify = cb.checked; });
            nl.appendChild(cb);
            nl.appendChild(el('span', null, null, 'Tell the people I add (a notification on OpenVibe)'));
            sec.appendChild(nl);
        }
        body.appendChild(sec);

        // People who asked.
        const asks = (s.requests || []).filter((r) => !st.members.some((m) => same(m.subject, r.subject)));
        if (mine && asks.length) {
            const rs = el('section', 'ov-share-people', { 'aria-labelledby': 'ov-share-asks-h' });
            rs.appendChild(el('h3', 'ov-share-label', { id: 'ov-share-asks-h' }, `Asking for access (${asks.length})`));
            const rl = el('ul', 'ov-share-list');
            for (const r of asks) rl.appendChild(requestRow(st, r));
            rs.appendChild(rl);
            body.appendChild(rs);
        }
        if (!mine) {
            body.appendChild(el('p', 'ov-share-muted', null, s.owner && s.owner.username
                ? `Only ${handle(s.owner)} can change who can open this.` : 'Only the owner can change who can open this.'));
        }
        if (st.error) body.appendChild(el('p', 'ov-share-error', { role: 'alert' }, st.error));
    }

    // ── Locked items (Locker) ────────────────────────────────────────────────────────────────────────────────
    // ov-locker.js loads on the first press of the Locked part, never before: the lock's words and the fingerprints
    // come from the service's own answer; only the wrapping and the re-seal need the keys, and they live in that file.
    const isLocked = (st) => !!(st.server && st.server.lock && st.server.lock !== 'none');
    async function locker() {
        if (root.OVLocker) return root.OVLocker;
        const ok = await loadSibling('ov-locker.js', 'OVLocker');
        return ok && root.OVLocker ? root.OVLocker : null;
    }
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return root.btoa(s); };
    /** The people whose slot was in the stored envelope and who are no longer on the list. */
    function removedMembers(st) {
        if (!st.server) return [];
        return (st.server.members || []).filter((m) => m.key_slot && !st.members.some((x) => same(x.subject, m.subject)));
    }
    function lockSection(st) {
        const kind = st.server.lock;
        const words = LOCK_WORDS[kind] || { label: kind, means: '' };
        const sec = el('section', 'ov-share-lock', { 'aria-labelledby': 'ov-share-lock-h' });
        const head = el('button', 'ov-share-lockhead', { type: 'button', 'data-k': 'lock-open', 'aria-expanded': st.lockOpen ? 'true' : 'false', 'aria-controls': 'ov-share-lock-body' });
        head.appendChild(iconEl('private'));
        const w = el('span', 'ov-share-locklabel');
        w.appendChild(el('span', 'ov-share-locktitle', { id: 'ov-share-lock-h' }, 'Locked'));
        w.appendChild(el('span', 'ov-share-muted', null, words.label));
        head.appendChild(w);
        head.appendChild(el('span', 'ov-share-lockcaret', { 'aria-hidden': 'true' }, st.lockOpen ? '−' : '+'));
        head.addEventListener('click', () => {
            st.lockOpen = !st.lockOpen;
            if (st.lockOpen && !root.OVLocker) locker();   // the words need nothing; the sealing later does
            draw(st);
        });
        sec.appendChild(head);
        if (!st.lockOpen) {
            sec.appendChild(el('p', 'ov-share-muted ov-share-lockshort', null, 'OpenVibe can’t read what’s inside.'));
            return sec;
        }
        const inner = el('div', 'ov-share-lockbody', { id: 'ov-share-lock-body' });
        inner.appendChild(el('p', 'ov-share-lockmeans', null, words.means));
        if (kind === 'link') {
            const key = linkKey(theLink(st));
            inner.appendChild(el('p', key ? 'ov-share-muted' : 'ov-share-warn', { role: key ? null : 'status' }, key
                ? 'The whole link, including the part after #, is the key. Copy sends the whole link.'
                : 'This link is missing its key: a locked link ends with #k=… Ask whoever shared it for the whole link. OpenVibe never had the key, so it cannot send it.'));
        }
        if (kind === 'password') {
            inner.appendChild(el('p', 'ov-share-muted', null, 'The password is not stored anywhere. If you lose it, nobody can open this: there is no reset.'));
        }
        if (kind === 'people') {
            inner.appendChild(el('p', 'ov-share-muted', null, 'Each person’s content key is wrapped for their locker on this device. OpenVibe never sees a key.'));
            const known = st.members.filter((m) => m.key_fingerprint);
            if (known.length) {
                const ul = el('ul', 'ov-share-fps', { 'aria-label': 'Fingerprints' });
                for (const m of known) {
                    const li = el('li', 'ov-share-fprow');
                    li.appendChild(el('span', 'ov-share-fpwho', null, handle(m) || nameOf(m)));
                    li.appendChild(el('span', 'ov-share-fp', null, m.key_fingerprint));
                    if (m.fingerprint_changed) li.appendChild(el('span', 'ov-share-tag is-warn', null, 'key changed'));
                    ul.appendChild(li);
                }
                inner.appendChild(ul);
            }
            const changed = st.members.filter((m) => m.fingerprint_changed);
            if (changed.length) {
                const who = changed.map((m) => handle(m) || nameOf(m)).join(', ');
                inner.appendChild(el('p', 'ov-share-warn', { role: 'status' }, `${who} changed locker keys since this was shared for them. Compare the new fingerprint with them, in person or on a call, before you use it.`));
                const use = el('button', 'ov-share-btn is-small is-quiet', { type: 'button', 'data-k': 'use-new-key' }, 'Use their new key');
                use.addEventListener('click', async () => {
                    use.disabled = true;
                    try {
                        const L = await locker();
                        if (!L) throw new Error('The Locker could not load. Check your connection and try again.');
                        for (const m of changed) {
                            const keys = await L.keys(m.subject);
                            if (!keys) throw new Error(`${handle(m) || nameOf(m)} has no locker now.`);
                            m._publicKey = keys.ecdh_public || keys.ecdh;
                            m._keyFingerprint = keys.fingerprint || null;
                            m.fingerprint_changed = false;
                            m.useNewKey = true;
                        }
                        st.reseal = true; st.lockNote = 'Their new key is used when you save.';
                        st.lockError = '';
                    } catch (e) { st.lockError = e.message; }
                    draw(st);
                });
                inner.appendChild(use);
            }
            const gone = removedMembers(st);
            if (gone.length) {
                const who = gone.map((m) => handle(m) || nameOf(m)).join(', ');
                inner.appendChild(el('p', 'ov-share-warn', { role: 'status' },
                    `They had the key before you removed them (${who}). They may still have a copy of what they already opened.`));
            }
            if (st.lockNote) inner.appendChild(el('p', 'ov-share-note', { role: 'status' }, st.lockNote));
            if (st.lockError) inner.appendChild(el('p', 'ov-share-error', { role: 'alert' }, st.lockError));
        }
        sec.appendChild(inner);
        return sec;
    }

    /** The person's public key, asked of Network through the Locker: a people lock cannot be made without it. */
    async function attachKey(st, p) {
        if (!p || !p.subject) { st.addMsg = `We could not confirm ${handle(p) || nameOf(p)}’s account, so no key is known.`; st.addMsgBad = true; return false; }
        try {
            const L = await locker();
            if (!L) throw new Error('The Locker could not load. Check your connection and try again.');
            const keys = await L.keys(p.subject);
            if (!keys) {
                st.addMsg = `${handle(p) || nameOf(p)} has no locker yet: they make one the first time they open a locked item.`;
                st.addMsgBad = true;
                return false;
            }
            p._publicKey = keys.ecdh_public || keys.ecdh;
            p._keyFingerprint = keys.fingerprint || null;
            p.needsKey = true;
            return true;
        } catch (e) {
            st.addMsg = `Could not get ${handle(p) || nameOf(p)}’s key: ${e.message}`;
            st.addMsgBad = true;
            return false;
        }
    }

    /** The bytes a locked item serves: its envelope. */
    async function envelopeBytes(st) {
        const url = (st.server && st.server.envelope_url) || st.o.envelope_url;
        if (!url) throw new Error('This service did not say where the locked item is.');
        const r = await fetch(url, { credentials: st.o.base ? 'include' : 'same-origin', headers: { accept: 'application/octet-stream' } });
        if (!r.ok) throw new Error(`The locked item answered ${r.status}.`);
        return new Uint8Array(await r.arrayBuffer());
    }

    /**
     * For a people lock whose list changed: the envelope re-wrapped here. Someone added gets their slot (the content key
     * never leaves this device); someone removed means the content is sealed again under a fresh key for those who stay,
     * so the key the person leaving holds opens nothing. The service stores the bytes and never reads them.
     */
    async function resealIfNeeded(st) {
        const before = st.server.members || [];
        const after = st.audience === 'private' ? [] : st.members;
        const gone = before.filter((m) => !after.some((x) => same(x.subject, m.subject)));
        const needing = after.filter((m) => m.needsKey || m.fingerprint_changed || m.useNewKey);
        // A slot that is already there has to go when it is wrapped again for the same person: two slots for one
        // person would leave the old key in the envelope.
        const stale = needing.filter((m) => m.key_slot);
        const remove = [...gone, ...stale].map((m) => m.subject);
        if (!remove.length && !needing.length && !st.reseal) return null;
        const L = await locker();
        if (!L) throw new Error('The Locker could not load. Check your connection and try again.');
        await L.ensure();
        const publicKey = async (m) => {
            if (m._publicKey) return m._publicKey;
            const keys = await L.keys(m.subject);
            if (!keys) throw new Error(`${handle(m) || nameOf(m)} has no locker now.`);
            m._publicKey = keys.ecdh_public || keys.ecdh;
            m._keyFingerprint = keys.fingerprint || null;
            return m._publicKey;
        };
        const add = [];
        for (const m of needing) add.push({ subject: m.subject, publicKey: await publicKey(m) });
        const keys = [];
        const me = await L.publicKeys();
        const my = st.server.you && st.server.you.subject;
        if ((remove.length || st.o.prepareEnvelope) && my && me) keys.push({ subject: my, publicKey: me.ecdh });
        if (remove.length || st.o.prepareEnvelope) for (const m of after) keys.push({ subject: m.subject, publicKey: await publicKey(m) });
        // File services may stream a new envelope to their ciphertext store and return a short receipt.
        // The sheet still supplies the recipients and saves their slots and access list together.
        const out = typeof st.o.prepareEnvelope === 'function'
            ? await st.o.prepareEnvelope({ keys, remove, add })
            : await L.rewrap(await envelopeBytes(st), { add, remove, keys });
        const slots = new Map((out.header.slots.people || []).map((slot) => [sid(slot.subject), slot]));
        const list = after.map((m) => {
            const slot = slots.get(sid(m.subject));
            if (!slot) throw new Error(`The sealed envelope has no key for ${handle(m) || nameOf(m)}.`);
            const r = { subject: m.subject, role: m.role, key_slot: slot };
            if (m.expires_at) r.expires_at = m.expires_at;
            return r;
        });
        return { members: list, ...(out.envelope_ref ? { envelope_ref: out.envelope_ref } : { envelope: b64(out.bytes) }) };
    }

    // The @name field: Enter or Add checks the name with Network (through the service), then adds a chip-row.
    function adder(st) {
        const wrap = el('form', 'ov-share-add', { novalidate: true });
        const field = el('div', 'ov-share-addfield');
        field.appendChild(el('span', 'ov-share-at', { 'aria-hidden': 'true' }, '@'));
        const inp = el('input', null, {
            type: 'text', name: 'name', 'data-k': 'add', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
            enterkeyhint: 'done', maxlength: '41', placeholder: 'Add people by their OpenVibe name', 'aria-label': 'Add people by their OpenVibe name',
            'aria-describedby': 'ov-share-add-msg',
        });
        if (st.draftName) inp.value = st.draftName;
        inp.addEventListener('input', () => { st.draftName = inp.value; if (st.addMsg) { st.addMsg = ''; msg.textContent = ''; msg.className = 'ov-share-addmsg'; } });
        field.appendChild(inp);
        wrap.appendChild(field);
        const btn = el('button', 'ov-share-btn', { type: 'submit', 'data-k': 'add-btn' }, st.checking ? 'Checking…' : 'Add');
        btn.disabled = !!st.checking;
        wrap.appendChild(btn);
        const msg = el('p', `ov-share-addmsg${st.addMsgBad ? ' is-bad' : ''}`, { id: 'ov-share-add-msg', 'aria-live': 'polite' }, st.addMsg || '');
        wrap.appendChild(msg);
        wrap.addEventListener('submit', (e) => { e.preventDefault(); addNames(st, inp.value); });
        const sugg = suggestionsFor(st);
        if (sugg.length) {
            const row = el('div', 'ov-share-sugg', { role: 'group', 'aria-label': 'People you have shared with' });
            for (const p of sugg) {
                const c = el('button', 'ov-share-chip', { type: 'button', 'data-k': `sugg-${p.username}` });
                c.appendChild(avatar(p));
                c.appendChild(el('span', null, null, handle(p)));
                c.addEventListener('click', () => addPerson(st, p));
                row.appendChild(c);
            }
            wrap.appendChild(row);
        }
        return wrap;
    }
    function suggestionsFor(st) {
        const have = new Set(st.members.map((m) => sid(m.subject)));
        if (st.server && st.server.owner) have.add(sid(st.server.owner.subject));
        return (st.suggested || []).filter((p) => p && p.subject && !have.has(sid(p.subject))).slice(0, 6);
    }

    async function addNames(st, raw) {
        const names = String(raw || '').split(/[\s,;]+/).map(cleanName).filter(Boolean);
        if (!names.length) return;
        const bad = names.filter((n) => !NAME_RE.test(n));
        if (bad.length) { st.addMsg = `“${bad[0]}” is not an OpenVibe name: letters, numbers, dots, dashes and underscores only.`; st.addMsgBad = true; draw(st); return; }
        st.checking = true; st.addMsg = ''; draw(st);
        const missing = [];
        try {
            const peopleLock = !!(st.server && st.server.lock === 'people');
            for (const n of names) {
                const p = await lookup(st.o, n);
                if (p === null) missing.push(n);
                else if (p === undefined && peopleLock) { st.addMsg = `We could not check @${n}, so no key is known for them. Try again.`; st.addMsgBad = true; }
                else if (p === undefined) addPerson(st, { name: n, username: n, unchecked: true }, true);
                else if (peopleLock) { if (await attachKey(st, p)) addPerson(st, p, true); }
                else addPerson(st, p, true);
            }
            st.draftName = missing.join(' ');
            if (missing.length) {
                st.addMsg = `No OpenVibe account is called ${missing.map((n) => `@${n}`).join(', ')}.`;
                st.addMsgBad = true;
            }
        } catch (e) {
            st.addMsg = e.message; st.addMsgBad = true;
        }
        st.checking = false;
        draw(st);
    }
    function addPerson(st, p, quiet) {
        const s = st.server;
        if (s.owner && p.subject && same(p.subject, s.owner.subject)) { st.addMsg = `${handle(p)} owns this already.`; st.addMsgBad = false; if (!quiet) draw(st); return; }
        if (st.members.some((m) => memberKey(m) === memberKey(p))) { st.addMsg = `${handle(p)} is on the list already.`; st.addMsgBad = false; if (!quiet) draw(st); return; }
        const open = st.audience === 'public' || st.audience === 'link';
        const role = open && roles(st).includes('editor') ? 'editor' : 'viewer';
        st.members.push({
            subject: p.subject, name: p.subject ? undefined : p.name, username: p.username, display_name: p.display_name,
            avatar_url: p.avatar_url, role, expires_at: null, isNew: true, unchecked: !!p.unchecked,
            ...(p.key_slot ? { key_slot: p.key_slot } : {}),
            ...(p.needsKey ? { needsKey: true } : {}),
            ...(p._publicKey ? { _publicKey: p._publicKey } : {}),
            ...(p._keyFingerprint || p.key_fingerprint ? { key_fingerprint: p._keyFingerprint || p.key_fingerprint } : {}),
        });
        if (st.audience === 'private') { st.audience = 'people'; st.note = 'Switched to Specific people, so they can open it.'; }
        if (!quiet) { st.draftName = ''; draw(st); }
    }

    function personRow(st, p, x) {
        const li = el('li', `ov-share-row${x.dim ? ' is-dim' : ''}${x.member && x.member.isNew ? ' is-new' : ''}`);
        li.appendChild(avatar(p));
        const words = el('div', 'ov-share-words');
        const top = el('div', 'ov-share-name');
        top.appendChild(el('span', 'ov-share-display', null, nameOf(p)));
        if (x.you || (st.server && st.server.you && p.subject && same(p.subject, st.server.you.subject))) top.appendChild(el('span', 'ov-share-tag', null, 'You'));
        if (x.member && x.member.isNew) top.appendChild(el('span', 'ov-share-tag is-new', null, 'New'));
        words.appendChild(top);
        const sub = el('div', 'ov-share-sub');
        if (p.username) sub.appendChild(el('span', null, null, handle(p)));
        if (x.member && x.member.unchecked) sub.appendChild(el('span', 'ov-share-soft', null, 'checked when you save'));
        if (x.member) sub.appendChild(expiry(st, x.member));
        // A people lock shows which key the slot is for: the eight words a person can compare out of band.
        if (x.member && isLocked(st) && st.server.lock === 'people' && x.member.key_fingerprint) {
            sub.appendChild(el('span', `ov-share-fp${x.member.fingerprint_changed ? ' is-changed' : ''}`, { title: 'Their locker’s fingerprint' }, x.member.key_fingerprint));
            if (x.member.fingerprint_changed) sub.appendChild(el('span', 'ov-share-soft', null, 'key changed'));
        }
        words.appendChild(sub);
        li.appendChild(words);
        if (x.tag) { li.appendChild(el('span', 'ov-share-role is-fixed', null, x.tag)); return li; }
        const m = x.member;
        if (!owner(st)) { li.appendChild(el('span', 'ov-share-role is-fixed', null, ROLE_WORDS[m.role] || m.role)); return li; }
        const rs = roles(st);
        if (rs.length > 1) {
            const sel = el('select', 'ov-share-select', { 'aria-label': `What ${handle(m) || nameOf(m)} can do`, 'data-k': `role-${memberKey(m)}`, 'data-ov-select': 'bare' });
            for (const r of rs) { const op = el('option', null, { value: r }, ROLE_WORDS[r] || r); op.selected = m.role === r; sel.appendChild(op); }
            sel.addEventListener('change', () => { m.role = sel.value; draw(st); });
            const pill = el('span', 'ov-share-rolepill');
            pill.appendChild(sel);
            li.appendChild(pill);
        } else li.appendChild(el('span', 'ov-share-role is-fixed', null, ROLE_WORDS[m.role] || m.role));
        const rm = el('button', 'ov-share-iconbtn is-small', { type: 'button', 'aria-label': `Remove ${handle(m) || nameOf(m)}`, 'data-k': `rm-${memberKey(m)}` });
        rm.appendChild(iconEl('close'));
        rm.addEventListener('click', () => {
            st.members.splice(st.members.indexOf(m), 1);
            st.note = m.isNew ? '' : isLocked(st) && st.server.lock === 'people'
                ? `${handle(m) || nameOf(m)} loses access when you save. They had the key before you removed them: they may still have a copy of what they already opened.`
                : `${handle(m) || nameOf(m)} loses access when you save. They may still have a copy of what they already opened.`;
            draw(st);
        });
        li.appendChild(rm);
        return li;
    }

    // "until Nov 30": an end date for one person's access, set with the browser's date picker.
    function expiry(st, m) {
        const wrap = el('span', 'ov-share-exp');
        if (!owner(st)) { if (m.expires_at) wrap.textContent = `until ${when(m.expires_at)}`; return wrap; }
        if (st.editingExp === memberKey(m)) {
            const d = el('input', 'ov-share-date', { type: 'date', 'aria-label': `Last day for ${handle(m) || nameOf(m)}`, 'data-k': `date-${memberKey(m)}` });
            const t = new Date(Date.now() + 86400000);
            d.min = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
            if (m.expires_at) { const e = new Date(m.expires_at); d.value = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`; }
            const commit = () => {
                if (d.value) { const [y, mo, da] = d.value.split('-').map(Number); m.expires_at = new Date(y, mo - 1, da, 23, 59, 59).toISOString(); }
                st.editingExp = null; draw(st);
            };
            d.addEventListener('change', commit);
            d.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); st.editingExp = null; draw(st); } });
            wrap.appendChild(d);
            if (m.expires_at) {
                const none = el('button', 'ov-share-btn is-quiet', { type: 'button', 'data-k': `noexp-${memberKey(m)}` }, 'No end date');
                none.addEventListener('click', () => { m.expires_at = null; st.editingExp = null; draw(st); });
                wrap.appendChild(none);
            }
            setTimeout(() => { try { d.focus(); if (d.showPicker) d.showPicker(); } catch (_) { /* a picker needs a gesture in some browsers */ } }, 0);
            return wrap;
        }
        const b = el('button', 'ov-share-link', { type: 'button', 'data-k': `exp-${memberKey(m)}` }, m.expires_at ? `until ${when(m.expires_at)}` : 'Set an end date');
        b.addEventListener('click', () => { st.editingExp = memberKey(m); draw(st); });
        if (m.expires_at) b.setAttribute('aria-label', `Access for ${handle(m) || nameOf(m)} ends ${when(m.expires_at, true)}: change`);
        wrap.appendChild(b);
        return wrap;
    }

    function requestRow(st, r) {
        const li = el('li', 'ov-share-row');
        li.appendChild(avatar(r));
        const words = el('div', 'ov-share-words');
        words.appendChild(el('div', 'ov-share-name', null, nameOf(r)));
        const sub = el('div', 'ov-share-sub');
        if (r.username) sub.appendChild(el('span', null, null, handle(r)));
        if (r.requested_at) sub.appendChild(el('span', null, null, `asked ${when(r.requested_at)}`));
        words.appendChild(sub);
        li.appendChild(words);
        const add = el('button', 'ov-share-btn is-small', { type: 'button', 'data-k': `req-add-${sid(r.subject)}` }, 'Add');
        add.addEventListener('click', () => addPerson(st, r));
        li.appendChild(add);
        const no = el('button', 'ov-share-btn is-small is-quiet', { type: 'button', 'data-k': `req-no-${sid(r.subject)}` }, 'Dismiss');
        no.addEventListener('click', async () => {
            no.disabled = true;
            try {
                await call(st.o, 'POST', `${endpoint(st.o).path}/requests/${encodeURIComponent(r.id)}/dismiss`, {});
                st.server.requests = (st.server.requests || []).filter((q) => q !== r);
            } catch (e) { st.error = `Could not dismiss: ${e.message}`; }
            draw(st);
        });
        li.appendChild(no);
        return li;
    }

    function pendingBanner(st) {
        const t = st.server.transfer;
        const b = el('div', 'ov-share-banner', { role: 'status' });
        b.appendChild(iconEl('give'));
        const p = el('p');
        p.appendChild(doc.createTextNode('Waiting for '));
        p.appendChild(el('strong', null, null, handle(t.to) || nameOf(t.to)));
        p.appendChild(doc.createTextNode(` to accept ownership${t.expires_at ? `. The offer ends ${when(t.expires_at)}` : ''}.`));
        b.appendChild(p);
        const c = el('button', 'ov-share-btn is-small is-quiet', { type: 'button', 'data-k': 'cancel-give' }, 'Cancel offer');
        c.addEventListener('click', async () => {
            st.busy = true; draw(st);
            try { take(st, await call(st.o, 'POST', `${endpoint(st.o).path}/transfer/cancel`, { transfer_id: t.id })); st.note = 'Offer cancelled. It is still yours.'; announce(st.o, st.server); }
            catch (e) { st.error = `Could not cancel: ${e.message}`; }
            st.busy = false; draw(st);
        });
        b.appendChild(c);
        return b;
    }

    // ── Transfer ownership: pick one person, say what happens to your own access, send ─────────────────────────
    function giveView(st, body) {
        const title = (st.server && st.server.title) || st.o.title;
        body.appendChild(el('p', 'ov-share-lead', null, `Give ${title ? `“${title}”` : 'this'} to someone else. They become the owner when they accept, and can then decide who else may open it.`));
        const f = el('form', 'ov-share-give', { novalidate: true });
        const lab = el('label', 'ov-share-label', { for: 'ov-share-give-name' }, 'New owner');
        f.appendChild(lab);
        const field = el('div', 'ov-share-addfield');
        field.appendChild(el('span', 'ov-share-at', { 'aria-hidden': 'true' }, '@'));
        const inp = el('input', null, { id: 'ov-share-give-name', type: 'text', 'data-k': 'give-name', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', maxlength: '41', placeholder: 'their OpenVibe name', 'aria-describedby': 'ov-share-give-msg' });
        if (st.giveTo) inp.value = st.giveTo.username || '';
        else if (st.giveDraft) inp.value = st.giveDraft;
        inp.addEventListener('input', () => { st.giveDraft = inp.value; st.giveTo = null; });
        field.appendChild(inp);
        f.appendChild(field);
        f.appendChild(el('p', `ov-share-addmsg${st.giveBad ? ' is-bad' : ''}`, { id: 'ov-share-give-msg', 'aria-live': 'polite' }, st.giveMsg || ''));
        const people = st.members.filter((m) => m.subject && !m.isNew);
        if (people.length && !st.giveTo) {
            const row = el('div', 'ov-share-sugg', { role: 'group', 'aria-label': 'People with access' });
            for (const p of people.slice(0, 6)) {
                const c = el('button', 'ov-share-chip', { type: 'button', 'data-k': `give-${p.username}` });
                c.appendChild(avatar(p));
                c.appendChild(el('span', null, null, handle(p)));
                c.addEventListener('click', () => { st.giveTo = p; st.giveMsg = `${nameOf(p)} (${handle(p)}) will be asked.`; st.giveBad = false; draw(st); });
                row.appendChild(c);
            }
            f.appendChild(row);
        }
        const keep = el('fieldset', 'ov-share-keep');
        keep.appendChild(el('legend', 'ov-share-label', null, 'When they accept'));
        for (const [v, t, d] of [[false, 'Remove my access', 'Recommended. It is theirs alone; they can share it back with you.'], [true, 'Keep me as a viewer', 'You can still open it, but not change it.']]) {
            const l = el('label', 'ov-share-radio');
            const r = el('input', null, { type: 'radio', name: 'ov-share-keep', 'data-k': `keep-${v}` });
            r.checked = st.keepAccess === v;
            r.addEventListener('change', () => { st.keepAccess = v; });
            l.appendChild(r);
            const w = el('span', 'ov-share-radiowords');
            w.appendChild(el('span', 'ov-share-radiotitle', null, t));
            w.appendChild(el('span', 'ov-share-muted', null, d));
            l.appendChild(w);
            keep.appendChild(l);
        }
        f.appendChild(keep);
        f.appendChild(el('p', 'ov-share-muted', null, 'They have 7 days to accept, and can open it meanwhile to look. Until they accept it stays yours, and you can cancel the offer.'));
        if (st.error) f.appendChild(el('p', 'ov-share-error', { role: 'alert' }, st.error));
        f.addEventListener('submit', (e) => { e.preventDefault(); sendOffer(st, inp.value); });
        body.appendChild(f);
    }
    async function sendOffer(st, raw) {
        st.error = '';
        let to = st.giveTo;
        if (!to) {
            const n = cleanName(raw);
            if (!NAME_RE.test(n)) { st.giveMsg = 'Type their OpenVibe name.'; st.giveBad = true; draw(st); return; }
            st.busy = true; st.giveMsg = 'Checking…'; st.giveBad = false; draw(st);
            try {
                const p = await lookup(st.o, n);
                if (p === null) { st.busy = false; st.giveMsg = `No OpenVibe account is called @${n}.`; st.giveBad = true; draw(st); return; }
                to = p || { name: n, username: n };
            } catch (e) { st.busy = false; st.giveMsg = e.message; st.giveBad = true; draw(st); return; }
        }
        if (st.server.owner && to.subject && same(to.subject, st.server.owner.subject)) { st.busy = false; st.giveMsg = 'That is you.'; st.giveBad = true; draw(st); return; }
        st.busy = true; draw(st);
        try {
            // A people-locked item is opened by its slots: the recipient's comes with the offer, and the envelope that
            // goes up carries it too, so they can look before they accept. Their key is asked of Network, and the
            // wrapping happens here.
            let slot = null;
            if (isLocked(st) && st.server.lock === 'people') {
                if (!to.subject) throw new Error('That is not an OpenVibe account, so there is no key to lock it for.');
                const L = await locker();
                if (!L) throw new Error('The Locker could not load. Check your connection and try again.');
                const keys = await L.keys(to.subject);
                if (!keys) throw new Error(`${handle(to) || nameOf(to)} has no locker yet: they make one the first time they open a locked item.`);
                await L.ensure();
                const bytes = await envelopeBytes(st);
                const wrapped = await L.rewrap(bytes, { add: [{ subject: to.subject, publicKey: keys.ecdh_public || keys.ecdh }] });
                slot = (wrapped.header.slots.people || []).find((x) => same(x.subject, to.subject)) || null;
                if (!slot) throw new Error('The sealed envelope has no key for them; try again.');
                const members = st.audience === 'private' ? [] : st.members.map((m) => ({
                    subject: m.subject, role: m.role,
                    ...(m.expires_at ? { expires_at: m.expires_at } : {}),
                    ...(m.key_slot ? { key_slot: m.key_slot } : {}),
                }));
                take(st, await call(st.o, 'PUT', endpoint(st.o).path, { audience: st.audience, members, envelope: b64(wrapped.bytes) }, st.etag ? { 'if-match': st.etag } : null));
            }
            const out = await call(st.o, 'POST', `${endpoint(st.o).path}/transfer`, {
                to: to.subject ? { subject: to.subject } : { name: to.name }, keep_access: !!st.keepAccess, ...(slot ? { key_slot: slot } : {}),
            });
            if (out && out.audience) take(st, out); else take(st, await call(st.o, 'GET', endpoint(st.o).path));
            st.view = 'main'; st.giveTo = null; st.giveDraft = ''; st.giveMsg = '';
            st.note = `Offer sent to ${handle(to) || nameOf(to)}. It stays yours until they accept.`;
            announce(st.o, st.server);
        } catch (e) {
            st.error = e.status === 404 && e.body && /name|person|subject/i.test(JSON.stringify(e.body)) ? `No OpenVibe account is called ${handle(to)}.` : `Could not send the offer: ${e.message}`;
        }
        st.busy = false; draw(st, true);
    }

    function foot(st) {
        const f = el('div', 'ov-share-foot');
        if (st.view === 'give') {
            const c = el('button', 'ov-share-btn is-quiet', { type: 'button', 'data-k': 'give-cancel' }, 'Back');
            c.addEventListener('click', () => { st.view = 'main'; st.error = ''; draw(st, true); });
            const s = el('button', 'ov-share-btn is-primary', { type: 'button', 'data-k': 'give-send', disabled: st.busy }, st.busy ? 'Sending…' : 'Send offer');
            s.addEventListener('click', () => { const i = st.dlg.querySelector('[data-k="give-name"]'); sendOffer(st, i ? i.value : ''); });
            f.appendChild(el('span', 'ov-share-grow'));
            f.appendChild(c); f.appendChild(s);
            return f;
        }
        if (st.confirmLeave) {
            f.classList.add('is-confirm');
            f.appendChild(el('p', 'ov-share-grow', { role: 'alert' }, 'Leave without saving your changes?'));
            const k = el('button', 'ov-share-btn is-quiet', { type: 'button', 'data-k': 'keep-editing' }, 'Keep editing');
            k.addEventListener('click', () => { st.confirmLeave = false; draw(st); });
            const d = el('button', 'ov-share-btn is-danger', { type: 'button', 'data-k': 'discard' }, 'Discard');
            d.addEventListener('click', () => close(st, true));
            f.appendChild(k); f.appendChild(d);
            return f;
        }
        const s = st.server;
        if (s && owner(st) && !(s.transfer && s.transfer.state === 'pending') && s.transferable !== false) {
            const g = el('button', 'ov-share-btn is-quiet', { type: 'button', 'data-k': 'give' });
            g.appendChild(iconEl('give'));
            g.appendChild(el('span', null, null, 'Transfer'));
            g.setAttribute('aria-label', 'Transfer ownership');
            g.addEventListener('click', () => { st.view = 'give'; st.error = ''; st.giveMsg = ''; draw(st, true); });
            f.appendChild(g);
        }
        f.appendChild(el('span', 'ov-share-grow'));
        const isDirty = dirty(st);
        const done = el('button', `ov-share-btn ${isDirty ? 'is-primary' : ''}`, { type: 'button', 'data-k': 'done', disabled: st.busy || (isDirty && st.checking) }, st.busy ? 'Saving…' : isDirty ? 'Save' : 'Done');
        done.addEventListener('click', () => (isDirty ? save(st) : close(st)));
        f.appendChild(done);
        return f;
    }

    async function save(st) {
        st.busy = true; st.error = ''; st.lockError = ''; draw(st);
        const members = st.audience === 'private' ? [] : st.members.map((m) => {
            const r = { role: m.role };
            if (m.expires_at) r.expires_at = m.expires_at;
            if (m.subject) r.subject = m.subject; else r.name = m.name || m.username;
            return r;
        });
        try {
            const body = { audience: st.audience, members, notify: !!st.notify };
            // A people lock follows its people: someone added is wrapped for now, someone removed means the content is
            // sealed again. The bytes go up with the list, and this browser is the only place they were opened.
            if (isLocked(st) && st.server.lock === 'people') {
                const sealed = await resealIfNeeded(st);
                if (sealed) { body.members = sealed.members; if (sealed.envelope_ref) body.envelope_ref = sealed.envelope_ref; else body.envelope = sealed.envelope; }
            }
            const out = await call(st.o, 'PUT', endpoint(st.o).path, body, st.etag ? { 'if-match': st.etag } : null);
            take(st, out && out.audience ? out : await call(st.o, 'GET', endpoint(st.o).path));
            st.saved = st.server; st.note = 'Saved.'; st.reseal = false; st.lockNote = '';
            announce(st.o, st.server);
        } catch (e) {
            if (e.status === 412) {
                try { take(st, await call(st.o, 'GET', endpoint(st.o).path)); } catch (_) { /* keep what is drawn */ }
                st.busy = false; st.error = 'Someone changed who can open this meanwhile. This is how it is now; make your change again.';
                draw(st); return;
            }
            const names = e.body && Array.isArray(e.body.names) ? e.body.names : null;
            const code = (e.body && e.body.code) || e.code;
            if (code === 'share.key_changed') st.error = 'Someone’s locker key changed. Open the Locked part and use their new key, then save again.';
            else if (code === 'share.no_key') st.error = 'Someone on the list has no locker yet. They make one the first time they open a locked item.';
            else if (code === 'share.reseal_required') st.error = 'Removing someone from a locked item seals it again here. Unlock your locker and save again.';
            else if (code === 'share.slot_required') st.error = 'Every person on a locked item needs their key. Add them again, then save.';
            else st.error = names && names.length ? `No OpenVibe account is called ${names.map((n) => `@${n}`).join(', ')}. Remove them, then save.` : `Could not save: ${e.message}`;
        }
        st.busy = false; draw(st);
    }

    // ── For the recipient of a transfer: a banner on the item ─────────────────────────────────────────────────
    function offer(container, opts) {
        const o = Object.assign({}, opts || {});
        stylesheet();
        const b = el('div', 'ov-share-banner is-offer', { role: 'region', 'aria-label': 'Ownership offer' });
        const drawOffer = (state, err) => {
            b.replaceChildren();
            b.appendChild(iconEl(state === 'accepted' ? 'tick' : 'give'));
            const p = el('p');
            if (state === 'accepted') p.textContent = 'It is yours now. You decide who else can open it.';
            else if (state === 'declined') p.textContent = 'You declined. Nothing changed.';
            else {
                p.appendChild(el('strong', null, null, handle(o.from) || nameOf(o.from)));
                p.appendChild(doc.createTextNode(` wants to give you ${o.title ? `“${o.title}”` : 'this'}. `));
                p.appendChild(doc.createTextNode(o.keep_access ? 'They would keep view access. ' : 'They would lose access. '));
                if (o.expires_at) p.appendChild(doc.createTextNode(`The offer ends ${when(o.expires_at)}.`));
            }
            b.appendChild(p);
            if (err) b.appendChild(el('p', 'ov-share-error', { role: 'alert' }, err));
            if (!state) {
                const acts = el('div', 'ov-share-acts');
                const yes = el('button', 'ov-share-btn is-primary is-small', { type: 'button' }, 'Accept');
                const no = el('button', 'ov-share-btn is-quiet is-small', { type: 'button' }, 'Decline');
                const answer = async (verb) => {
                    yes.disabled = no.disabled = true;
                    try {
                        const out = await call(o, 'POST', `${endpoint(o).path}/transfer/${verb}`, { transfer_id: o.transfer_id });
                        announce(o, out);
                        drawOffer(verb === 'accept' ? 'accepted' : 'declined');
                        if (typeof o.onDone === 'function') o.onDone(verb === 'accept' ? 'accepted' : 'declined', out);
                    } catch (e) { drawOffer(null, e.status === 410 || e.status === 404 ? 'This offer is no longer open.' : `Could not answer: ${e.message}`); }
                };
                yes.addEventListener('click', () => answer('accept'));
                no.addEventListener('click', () => answer('decline'));
                acts.appendChild(yes); acts.appendChild(no);
                b.appendChild(acts);
            }
        };
        drawOffer(null);
        container.replaceChildren(b);
        return b;
    }

    // ── For a person who is not on the list: ask, or sign in. Never the title or the content. ─────────────────
    function gate(container, opts) {
        const o = Object.assign({}, opts || {});
        stylesheet();
        const card = el('div', 'ov-share-gate', { role: 'region', 'aria-label': 'Access' });
        const drawGate = (state, err) => {
            card.replaceChildren();
            card.appendChild(iconEl('people', 'ov-share-ico is-big'));
            card.appendChild(el('h2', 'ov-share-gatetitle', null, state === 'asked' ? 'Asked' : 'This is shared with specific people'));
            if (!o.signedInAs) {
                card.appendChild(el('p', 'ov-share-muted', null, 'Sign in with the OpenVibe account it was shared with.'));
                const a = el('a', 'ov-share-btn is-primary', { href: o.signInUrl || '/login' }, 'Sign in');
                card.appendChild(a);
            } else if (state === 'asked') {
                card.appendChild(el('p', 'ov-share-muted', null, 'The owner has a notification. You will get one when they answer.'));
            } else {
                const p = el('p', 'ov-share-muted');
                p.appendChild(doc.createTextNode('You are signed in as '));
                p.appendChild(el('strong', null, null, `@${cleanName(o.signedInAs)}`));
                p.appendChild(doc.createTextNode(', who is not on the list.'));
                card.appendChild(p);
                if (err) card.appendChild(el('p', 'ov-share-error', { role: 'alert' }, err));
                const acts = el('div', 'ov-share-acts');
                const ask = el('button', 'ov-share-btn is-primary', { type: 'button' }, 'Ask for access');
                ask.addEventListener('click', async () => {
                    ask.disabled = true;
                    try { await call(o, 'POST', `${endpoint(o).path}/requests`, {}); drawGate('asked'); if (typeof o.onDone === 'function') o.onDone('asked'); }
                    catch (e) { drawGate(null, e.status === 429 ? 'You asked recently. The owner has it.' : `Could not ask: ${e.message}`); }
                });
                acts.appendChild(ask);
                if (o.signInUrl) acts.appendChild(el('a', 'ov-share-btn is-quiet', { href: o.signInUrl }, 'Switch account'));
                card.appendChild(acts);
            }
        };
        drawGate(null);
        container.replaceChildren(card);
        return card;
    }

    // ── Buttons in markup: [data-ov-share-sheet] ──────────────────────────────────────────────────────────────
    doc.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('[data-ov-share-sheet]') : null;
        if (!b || b.disabled) return;
        e.preventDefault();
        open(fromButton(b));
    });

    // ── Gates in markup: [data-ov-share-gate] ─────────────────────────────────────────────────────────────────────────
    // A page's "not on the list" answer is markup only: the page escapes the values as it escapes any attribute, and no
    // inline script is needed (an inline script needs a CSP nonce on most of the network's sites, and a value written
    // into one has to be escaped for JavaScript, not HTML). Each gate starts once.
    function startGates(scope) {
        const within = scope && scope.querySelectorAll ? scope : doc;
        const nodes = within.querySelectorAll('[data-ov-share-gate]:not([data-ov-share-gate-on])');
        let n = 0;
        nodes.forEach((node) => {
            const d = node.dataset || {};
            if (!d.kind || !d.id) return;
            node.setAttribute('data-ov-share-gate-on', '');
            gate(node, { kind: d.kind, id: d.id, signedInAs: d.signedInAs || null, signInUrl: d.signInUrl || undefined, base: d.base, path: d.path });
            n += 1;
        });
        return n;
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => startGates());
    else startGates();

    // A button's data-* as open()'s options (navbar.js and kit-web.js use it too, once this file has loaded).
    function fromButton(b) {
        const d = b.dataset || {};
        let time = 0;
        if (d.timeFrom) { const m = doc.querySelector(d.timeFrom); if (m && typeof m.currentTime === 'number' && isFinite(m.currentTime)) time = m.currentTime; }
        else if (d.time) time = Number(d.time) || 0;
        return { kind: d.kind, id: d.id, title: d.title || doc.title, text: d.text, url: d.url || d.link, image: d.image, embedUrl: d.embed,
            time: time >= 5 ? time : 0, timeParam: d.timeParam, base: d.base, path: d.path };
    }

    root.OVShare = { open, offer, gate, startGates, fromButton, version: 4 };
})(typeof window !== 'undefined' ? window : null);
