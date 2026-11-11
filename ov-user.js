/* The public user card (ask 287, the owner: "one user card … across all sites … level … live streams … like Discord, but
 * way better"). Its look, 4.202.0: a banner from the person's own picture (blurred, tinted by their name's hue), the face
 * with its ring (red while live), the name and @handle, Live now as the first action when they are, level / streak /
 * badges / followers as chips, the sites they used this week, and the way to their profile and channel. Opened from a
 * mention or a face (OVUser.bind), it sits in the one window (ov-window.js, a panel beside what was pressed; a sheet on
 * a phone), loaded from beside this file.
 * OVUser.card(host, { username }) -> { ready, refresh(), destroy() }
 * Nothing mounts or intercepts clicks merely by loading this file. */
(function (root, factory) {
    'use strict';
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.OVUser = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';
    const NETWORK = 'https://openvibe.network';
    const USER_REV = { 'ov-window.js': 'f0cf81f57e43' };
    const selfSrc = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
    const CSS = `.ovu { position: relative; display: grid; gap: 14px; padding: 0 0 18px; color: var(--text-primary, #e6edf7); font: 500 14.5px/1.4 var(--font, Inter, system-ui, sans-serif); }
.ovu-banner { position: relative; height: 92px; overflow: hidden; background: linear-gradient(135deg, hsl(var(--ovu-h, 220) 70% 42%), hsl(calc(var(--ovu-h, 220) + 40) 70% 28%)); }
.ovu-banner::before { content: ""; position: absolute; inset: -30%; background: var(--ovu-bg, none) center / cover; filter: blur(26px) saturate(1.5); opacity: .75; }
.ovu-banner::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--ovw-bg, #111826) 55%, transparent)); }
.ovu-head { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: end; gap: 12px; margin: -44px 16px 0; }
.ovu-face { position: relative; display: grid; place-items: center; width: 76px; height: 76px; border-radius: 50%; overflow: hidden; background: hsl(var(--ovu-h, 220) 55% 40%); color: #fff; font-size: 30px; font-weight: 800; box-shadow: 0 0 0 4px var(--ovw-bg, var(--bg-secondary, #111826)); }
.ovu-face img { width: 100%; height: 100%; object-fit: cover; }
.ovu-face.is-live { box-shadow: 0 0 0 3px var(--live-red, #ef4444), 0 0 0 6px var(--ovw-bg, var(--bg-secondary, #111826)); }
.ovu-names { min-width: 0; padding-bottom: 4px; }
.ovu-name { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 19px; font-weight: 800; letter-spacing: -.01em; }
.ovu-handle { margin: 0; color: var(--text-secondary, #a8b3c4); font-size: 14px; }
.ovu-state { margin: 0 16px; font-size: 13px; color: var(--text-muted, #8b98ad); }
.ovu-live { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; margin: 0 16px; border-radius: 12px; background: var(--live-red, #ef4444); color: #fff; font-weight: 750; text-decoration: none; }
.ovu-live::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: ovu-beat 1.4s ease-in-out infinite; }
.ovu-live small { font-weight: 600; opacity: .85; }
.ovu-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 16px; padding: 0; list-style: none; }
.ovu-chips li { display: inline-flex; align-items: baseline; gap: 5px; padding: 6px 10px; border-radius: 10px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); font-size: 12.5px; color: var(--text-secondary, #a8b3c4); }
.ovu-chips b { font-size: 14px; color: var(--text-primary, #e6edf7); }
.ovu-sec { margin: 0 16px; }
.ovu-sec h3 { margin: 0 0 6px; font-size: 11.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--text-muted, #8b98ad); }
.ovu-sites { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.ovu-sites a { display: inline-flex; align-items: center; min-height: 32px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--border, rgba(255,255,255,.12)); color: inherit; text-decoration: none; font-size: 13px; font-weight: 600; }
.ovu-sites a:hover { border-color: var(--accent, #3b82f6); }
.ovu-acts { display: flex; gap: 8px; margin: 2px 16px 0; }
.ovu-acts a { flex: 1; display: grid; place-items: center; min-height: 42px; border-radius: 12px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 8%, transparent); color: inherit; font-weight: 650; text-decoration: none; }
.ovu-acts a:first-child { background: var(--accent, #3b82f6); color: var(--on-accent, #fff); }
.ovu-acts a:hover { filter: brightness(1.1); }
.ovu-wait { display: grid; gap: 10px; padding: 0 16px 18px; }
.ovu-wait i { display: block; height: 12px; border-radius: 6px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent); animation: ovu-shine 1.2s ease-in-out infinite; }
.ovu-wait i:first-child { width: 55%; height: 18px; }
.ovu-wait i:nth-child(2) { width: 35%; }
.ovu-wait i:nth-child(3) { width: 80%; }
.ovu-none { margin: 0 16px; color: var(--text-secondary, #a8b3c4); }
@keyframes ovu-beat { 50% { opacity: .35; transform: scale(.75); } }
@keyframes ovu-shine { 50% { opacity: .45; } }
html[data-ov-motion=off] .ovu-live::before, html[data-ov-motion=off] .ovu-wait i { animation: none; }`;
    function styles(doc) { if (doc.getElementById('ovu-styles')) return; const st = doc.createElement('style'); st.id = 'ovu-styles'; st.textContent = CSS; doc.head.appendChild(st); }
    // The banner's hue: from the name, so a person's card always wears the same colour.
    const hueOf = (name) => { let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
    const compact = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
    function needWindow() {
        return new Promise((ok) => {
            if (root.OVWindow) return ok(root.OVWindow);
            const m = /^(https?:\/\/[^?#]*\/)ov-user(?:\.[0-9a-f]{6,})?\.js(?:[?#]|$)/.exec(selfSrc);
            if (!m || typeof document === 'undefined') return ok(null);
            const sc = document.createElement('script');
            sc.src = m[1] + 'ov-window.js' + (USER_REV['ov-window.js'] ? '?v=' + USER_REV['ov-window.js'] : '');
            sc.onload = () => ok(root.OVWindow || null); sc.onerror = () => ok(null);
            document.head.appendChild(sc);
        });
    }
    const mounts = new WeakMap();
    const bindings = new WeakMap();
    const usernameOf = value => typeof value === 'string' && /^[A-Za-z0-9_]{3,24}$/.test(value.replace(/^@/, '')) ? value.replace(/^@/, '') : null;
    function safeUrl(value) {
        try {
            const u = new URL(value);
            return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
        } catch { return null; }
    }
    function element(doc, tag, text, className) {
        const el = doc.createElement(tag);
        if (text !== undefined) el.textContent = String(text);
        if (className) el.className = className;
        return el;
    }
    function link(doc, label, url) {
        const safe = safeUrl(url);
        if (!safe) return null;
        const a = element(doc, 'a', label, 'ovk-btn ovk-btn--quiet');
        a.href = safe;
        return a;
    }
    function render(section, person) {
        const doc = section.ownerDocument;
        section.replaceChildren();
        section.setAttribute('aria-label', `User @${person.username}`);
        section.style.setProperty('--ovu-h', String(hueOf(person.username)));
        const avatar = safeUrl(person.avatar_url);
        const banner = element(doc, 'div', undefined, 'ovu-banner');
        if (avatar && !/["'()\\\s]/.test(avatar)) banner.style.setProperty('--ovu-bg', `url("${avatar}")`);
        section.appendChild(banner);
        const head = element(doc, 'div', undefined, 'ovu-head');
        const live = person.live && person.live.now === true;
        const face = element(doc, 'span', undefined, `ovu-face${live ? ' is-live' : ''}`);
        if (avatar) { const img = doc.createElement('img'); img.src = avatar; img.alt = ''; img.decoding = 'async'; img.addEventListener('error', () => { img.remove(); face.textContent = person.username[0].toUpperCase(); }); face.appendChild(img); }
        else face.textContent = person.username[0].toUpperCase();
        const names = element(doc, 'div', undefined, 'ovu-names');
        names.appendChild(element(doc, 'h2', typeof person.display_name === 'string' && person.display_name.trim() ? person.display_name : person.username, 'ovu-name'));
        names.appendChild(element(doc, 'p', `@${person.username}`, 'ovu-handle'));
        head.append(face, names);
        section.appendChild(head);
        if (live) {
            const a = link(doc, 'Live now', person.live.url);
            if (a) { a.className = 'ovu-live'; if (typeof person.live.where === 'string' && person.live.where) a.appendChild(element(doc, 'small', `on ${person.live.where}`)); section.appendChild(a); }
        } else if (person.live && person.live.now === false) section.appendChild(element(doc, 'p', 'Not live right now', 'ovu-state'));
        const chips = element(doc, 'ul', undefined, 'ovu-chips');
        for (const [key, label] of [['level', 'Level'], ['streak', 'day streak'], ['badges_count', 'badges'], ['followers', 'followers']]) {
            const value = person[key];
            if (!Number.isSafeInteger(value) || value < 0) continue;
            const li = element(doc, 'li');
            if (key === 'level') { li.append(label + ' '); li.appendChild(element(doc, 'b', value)); }
            else { li.appendChild(element(doc, 'b', compact(value))); li.append(` ${key === 'streak' && value === 1 ? 'day streak' : key === 'badges_count' && value === 1 ? 'badge' : key === 'followers' && value === 1 ? 'follower' : label}`); }
            chips.appendChild(li);
        }
        if (chips.childNodes.length) section.appendChild(chips);
        if (Array.isArray(person.active_sites)) {
            const list = element(doc, 'ul', undefined, 'ovu-sites');
            for (const site of person.active_sites) {
                if (!site || typeof site.name !== 'string') continue;
                const a = link(doc, site.name, site.url);
                if (a) { a.className = ''; const li = element(doc, 'li'); li.appendChild(a); list.appendChild(li); }
            }
            if (list.childNodes.length) { const sec = element(doc, 'div', undefined, 'ovu-sec'); sec.append(element(doc, 'h3', 'This week'), list); section.appendChild(sec); }
        }
        const acts = element(doc, 'div', undefined, 'ovu-acts');
        for (const [label, url] of [['Profile', person.profile_url], ['Channel', person.channel_url]]) {
            const a = link(doc, label, url);
            if (a) { a.className = ''; acts.appendChild(a); }
        }
        if (acts.childNodes.length) section.appendChild(acts);
    }
    function card(host, options = {}) {
        const username = usernameOf(options.username);
        if (!host?.ownerDocument || typeof host.replaceChildren !== 'function') throw new TypeError('OVUser.card: pass a host element');
        if (!username) throw new TypeError('OVUser.card: use a username of 3–24 letters, digits or underscores');
        mounts.get(host)?.destroy();
        const doc = host.ownerDocument;
        styles(doc);
        const section = element(doc, 'section', undefined, 'ovu');
        section.setAttribute('data-ov-user-card', '');
        host.replaceChildren(section);
        let generation = 0, controller, disposed = false;
        const profile = `${NETWORK}/@${encodeURIComponent(username)}`;
        const api = {
            ready: null,
            refresh() {
                if (disposed) return Promise.resolve(null);
                const ticket = ++generation;
                controller?.abort();
                const request = controller = new AbortController();
                const timer = setTimeout(() => request.abort(), 8000);
                const status = element(doc, 'div', undefined, 'ovu-wait'); status.setAttribute('role', 'status'); status.setAttribute('aria-label', 'Loading the profile');
                status.append(element(doc, 'i'), element(doc, 'i'), element(doc, 'i'));
                section.style.setProperty('--ovu-h', String(hueOf(username)));
                section.replaceChildren(element(doc, 'div', undefined, 'ovu-banner'), status); section.setAttribute('aria-busy', 'true');
                const fetcher = options.fetchImpl || ((...args) => root.fetch(...args));
                const url = `${String(options.networkUrl || NETWORK).replace(/\/+$/, '')}/api/v1/people/${encodeURIComponent(username)}/card`;
                api.ready = Promise.resolve().then(() => fetcher(url, { credentials: 'omit', cache: 'no-store',
                    headers: { Accept: 'application/json' }, signal: request.signal }))
                    .then(async response => {
                        if (!response.ok) throw new Error('Profile unavailable');
                        const person = await response.json();
                        if (!person || !usernameOf(person.username)) throw new Error('Profile unavailable');
                        if (!disposed && ticket === generation) render(section, person);
                        return person;
                    }).catch(() => {
                        if (!disposed && ticket === generation) {
                            const message = element(doc, 'p', 'The profile did not load.', 'ovu-none'); message.setAttribute('role', 'status');
                            const acts = element(doc, 'div', undefined, 'ovu-acts'); const a = link(doc, 'Open the profile', profile); if (a) { a.className = ''; acts.appendChild(a); }
                            section.replaceChildren(element(doc, 'div', undefined, 'ovu-banner'), message, acts);
                        }
                        return null;
                    }).finally(() => {
                        clearTimeout(timer);
                        if (!disposed && ticket === generation) section.removeAttribute('aria-busy');
                    });
                return api.ready;
            },
            destroy() {
                if (disposed) return;
                disposed = true; generation++; controller?.abort();
                section.remove();
                if (mounts.get(host) === api) mounts.delete(host);
            },
        };
        mounts.set(host, api);
        api.refresh();
        return api;
    }
    /** Delegated hook: marked mentions/avatars and profile links; call only when the site opts in. */
    function bind(scope, options = {}) {
        if (!scope?.addEventListener) throw new TypeError('OVUser.bind: pass a document or element');
        bindings.get(scope)?.();
        const doc = scope.ownerDocument || scope;
        let close = null, disposed = false;
        function open(username, trigger) {
            close?.();
            if (root.OVWindow || selfSrc) {
                needWindow().then((W) => {
                    if (!W) { openDialog(username, trigger); return; }
                    const host = element(doc, 'div');
                    const mounted = card(host, { ...options, username });
                    let win = null;
                    const cleanup = () => { mounted.destroy(); if (win) { const w = win; win = null; w.close(); } if (close === cleanup) close = null; };
                    close = cleanup;
                    win = W.open({ id: 'ov-user-card', kind: 'panel', size: 'sm', bare: true, title: `@${username}`, body: host, from: trigger, onClose: () => { win = null; mounted.destroy(); if (close === cleanup) close = null; } });
                });
                return true;
            }
            return openDialog(username, trigger);
        }
        function openDialog(username, trigger) {
            const dialog = element(doc, 'dialog');
            if (typeof dialog.showModal !== 'function') return false;
            dialog.setAttribute('aria-label', `User @${username}`);
            const dismiss = element(doc, 'button', 'Close', 'ovk-btn ovk-btn--quiet'); dismiss.type = 'button';
            const host = element(doc, 'div');
            dialog.append(dismiss, host); doc.body.appendChild(dialog);
            const mounted = card(host, { ...options, username });
            const cleanup = () => {
                mounted.destroy(); dialog.remove(); trigger.focus?.();
                if (close === cleanup) close = null;
            };
            close = cleanup;
            dismiss.addEventListener('click', cleanup);
            dialog.addEventListener('cancel', cleanup);
            dialog.addEventListener('close', cleanup);
            dialog.addEventListener('click', event => { if (event.target === dialog) cleanup(); });
            dialog.showModal();
            return true;
        }
        function handle(event) {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
            if (event.type === 'click' && event.button > 0) return;
            const target = event.target?.closest?.('[data-ov-user], [data-username], a[href]');
            if (!target || target.closest('[data-ov-user-card]')) return;
            if (event.type === 'keydown' && (!['Enter', ' '].includes(event.key) || ['A', 'BUTTON'].includes(target.tagName) || event.repeat)) return;
            let username = usernameOf(target.getAttribute('data-ov-user') || target.getAttribute('data-username'));
            if (!username && target.tagName === 'A') {
                try {
                    const base = doc.baseURI || NETWORK;
                    const url = new URL(target.getAttribute('href'), base);
                    if (!['https:', 'http:'].includes(url.protocol) || ![new URL(base).origin, NETWORK, 'https://openvibe.live'].includes(url.origin)) return;
                    const match = /^\/@([A-Za-z0-9_]{3,24})\/?$/.exec(url.pathname);
                    if (match) username = match[1];
                } catch { return; }
            }
            if (!username) return;
            if (typeof options.onOpen === 'function') {
                event.preventDefault(); options.onOpen({ username, trigger: target, event });
            } else if (open(username, target)) event.preventDefault();
        }
        for (const type of ['click', 'contextmenu', 'keydown']) scope.addEventListener(type, handle);
        const cleanup = () => {
            if (disposed) return;
            disposed = true; close?.();
            for (const type of ['click', 'contextmenu', 'keydown']) scope.removeEventListener(type, handle);
            if (bindings.get(scope) === cleanup) bindings.delete(scope);
        };
        bindings.set(scope, cleanup);
        return cleanup;
    }
    return { card, bind };
});
