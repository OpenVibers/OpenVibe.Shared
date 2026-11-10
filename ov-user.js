/* The public user card's data and hooks. Plain kit markup; sites opt in with OVUser.bind(root).
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
        const avatar = safeUrl(person.avatar_url);
        if (avatar) {
            const img = doc.createElement('img');
            img.src = avatar; img.alt = ''; img.width = 64; img.height = 64; img.decoding = 'async';
            section.appendChild(img);
        }
        if (typeof person.display_name === 'string') section.appendChild(element(doc, 'h2', person.display_name));
        section.appendChild(element(doc, 'p', `@${person.username}`));
        if (person.live?.now === true) {
            const live = link(doc, 'Live now', person.live.url);
            if (live) section.appendChild(live);
        } else if (person.live?.now === false) section.appendChild(element(doc, 'p', 'Offline'));
        const stats = element(doc, 'dl');
        for (const [key, label] of [['level', 'Level'], ['streak', 'Streak'], ['badges_count', 'Badges'], ['followers', 'Followers']]) {
            const value = person[key];
            if (!Number.isSafeInteger(value) || value < 0) continue;
            stats.appendChild(element(doc, 'dt', label));
            stats.appendChild(element(doc, 'dd', key === 'streak' ? `${value} ${value === 1 ? 'day' : 'days'}` : value));
        }
        if (stats.childNodes.length) section.appendChild(stats);
        if (Array.isArray(person.active_sites)) {
            const list = element(doc, 'ul');
            for (const site of person.active_sites) {
                if (!site || typeof site.name !== 'string') continue;
                const a = link(doc, site.name, site.url);
                if (a) { const li = element(doc, 'li'); li.appendChild(a); list.appendChild(li); }
            }
            if (list.childNodes.length) { section.appendChild(element(doc, 'h3', 'This week')); section.appendChild(list); }
        }
        for (const [label, url] of [['View profile', person.profile_url], ['Channel', person.channel_url]]) {
            const a = link(doc, label, url);
            if (a) section.appendChild(a);
        }
    }
    function card(host, options = {}) {
        const username = usernameOf(options.username);
        if (!host?.ownerDocument || typeof host.replaceChildren !== 'function') throw new TypeError('OVUser.card: pass a host element');
        if (!username) throw new TypeError('OVUser.card: use a username of 3–24 letters, digits or underscores');
        mounts.get(host)?.destroy();
        const doc = host.ownerDocument;
        const section = element(doc, 'section', undefined, 'ovk-card');
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
                const status = element(doc, 'p', 'Loading profile…'); status.setAttribute('role', 'status');
                section.replaceChildren(status); section.setAttribute('aria-busy', 'true');
                const fetcher = options.fetchImpl || root.fetch.bind(root);
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
                            const message = element(doc, 'p', 'Profile unavailable.'); message.setAttribute('role', 'status');
                            section.replaceChildren(message, link(doc, 'View profile', profile));
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
            const dialog = element(doc, 'dialog', undefined, 'ovk-card');
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
