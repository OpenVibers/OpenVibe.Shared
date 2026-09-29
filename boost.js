/*
 * openvibe-shared/boost.js — smooth page moves for a server-rendered site (plan T11). Every page stays a normal page
 * (it works with no JavaScript, crawlers see the same HTML); boost only makes a same-site move feel like an app:
 *
 *   <meta name="ov-boost" content="<site>@<release>">     on every page that may be swapped (the server's release id)
 *   <main id="main">…</main>                              the part that changes
 *   <script src="/shared/boost.js" data-main="#main" defer></script>    starts itself (or call OVBoost.start below)
 *
 * A click on a same-site link (no modifier key, no target, no download, not data-no-boost, not /auth/ or /api/) fetches
 * the next page's HTML (already prefetched on hover, focus or touch), loads its new stylesheets first, swaps <main> with
 * the shared transition (route-transition.js: the top bar, "Loading Content…", a fade), updates the title, the head
 * tags that describe the page (description, canonical, Open Graph, Twitter, JSON-LD), pushes history, restores scroll on
 * back/forward and moves focus to the new content. Any doubt is a normal page load: a different release marker, a
 * different set of external scripts, a non-HTML answer, a redirect off the site, an error, a timeout.
 * Inline scripts inside the new <main> run after the swap (once); pages listen for `<prefix>:boost:load` to wire widgets.
 *
 *   OVBoost.start({ main, prefix = 'ov', exclude = [], timeout = 8000, prefetch = true, fx = true }) → controller
 *   controller.go(url)   controller.stop()   controller.stats()
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVBoost) return;
    const selfSrc = document.currentScript && document.currentScript.src;
    const selfData = (document.currentScript && document.currentScript.dataset) || {};
    const HEAD_TAGS = 'meta[name="description"],link[rel="canonical"],meta[property^="og:"],meta[name^="twitter:"],script[type="application/ld+json"],link[rel="alternate"][hreflang],meta[name="robots"]';
    const FILE_EXT = /\.(?:pdf|zip|gz|tgz|png|jpe?g|gif|webp|avif|svg|mp4|webm|mp3|wav|ogg|json|xml|txt|csv|ics)$/i;

    function start(o = {}) {
        const mainSel = o.main || 'main';
        const prefix = o.prefix || 'ov';
        const timeout = o.timeout || 8000;
        const exclude = ['/auth/', '/api/', '/logout', ...(o.exclude || [])];
        const cache = new Map();                  // url → { at, promise }
        const scrolls = Object.create(null);      // history key → y
        const s = { moves: 0, fallbacks: 0, prefetches: 0, last: null };
        let inflight = null, stopped = false, key = 0;
        const emit = (type, detail) => document.dispatchEvent(new root.CustomEvent(`${prefix}:boost:${type}`, { bubbles: true, detail }));
        const marker = (doc) => { const m = doc.querySelector('meta[name="ov-boost"]'); return m ? m.getAttribute('content') : null; };
        const externalScripts = (doc) => [...doc.querySelectorAll('script[src]')].map((t) => { try { const u = new URL(t.getAttribute('src'), root.location.href); return u.origin + u.pathname; } catch { return ''; } }).sort().join('\n');
        const here = { marker: marker(document), scripts: externalScripts(document) };
        if (!here.marker || !document.querySelector(mainSel)) return { go: (u) => root.location.assign(u), stop() {}, stats: () => ({ ...s, off: 'no ov-boost marker or main element' }) };

        function boostable(a, ev) {
            if (!a || a.target && a.target !== '_self' || a.hasAttribute('download') || a.closest('[data-no-boost]')) return null;
            if (ev && (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return null;
            let u; try { u = new URL(a.href, root.location.href); } catch { return null; }
            if (u.origin !== root.location.origin || !/^https?:$/.test(u.protocol)) return null;
            if (FILE_EXT.test(u.pathname) || exclude.some((p) => u.pathname.startsWith(p))) return null;
            if (u.pathname === root.location.pathname && u.search === root.location.search && u.hash) return null;   // in-page anchor
            return u;
        }

        function fetchPage(url) {
            const hit = cache.get(url);
            if (hit && Date.now() - hit.at < 15000) return hit.promise;
            const ctl = new AbortController();
            const t = root.setTimeout(() => ctl.abort(), timeout);
            const promise = root.fetch(url, { credentials: 'same-origin', headers: { 'X-OV-Boost': '1', Accept: 'text/html' }, signal: ctl.signal, redirect: 'follow' })
                .then(async (r) => {
                    const ct = r.headers.get('content-type') || '';
                    if (!r.ok || !/text\/html/.test(ct)) throw new Error(`not a page (${r.status} ${ct})`);
                    const final = new URL(r.url || url);
                    if (final.origin !== root.location.origin) throw new Error('redirected off the site');
                    return { html: await r.text(), url: final.href };
                })
                .finally(() => root.clearTimeout(t));
            cache.set(url, { at: Date.now(), promise });
            promise.catch(() => cache.delete(url));
            return promise;
        }

        function prefetch(u) {
            if (o.prefetch === false) return;
            const c = root.navigator && root.navigator.connection;
            if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
            if (cache.has(u.href)) return;
            s.prefetches++;
            fetchPage(u.href).catch(() => {});
        }

        function loadStylesFirst(doc) {
            const have = new Set([...document.querySelectorAll('link[rel="stylesheet"][href]')].map((l) => new URL(l.href, root.location.href).href));
            const added = [...doc.querySelectorAll('link[rel="stylesheet"][href]')]
                .map((l) => new URL(l.getAttribute('href'), root.location.href).href)
                .filter((h) => !have.has(h))
                .map((href) => new Promise((done) => {
                    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href;
                    l.onload = l.onerror = () => done(); root.setTimeout(done, 4000);
                    document.head.appendChild(l);
                }));
            return Promise.all(added);
        }

        function updateHead(doc) {
            document.title = doc.title;
            document.head.querySelectorAll(HEAD_TAGS).forEach((el) => el.remove());
            doc.head.querySelectorAll(HEAD_TAGS).forEach((el) => document.head.appendChild(document.importNode(el, true)));
            const lang = doc.documentElement.getAttribute('lang');
            if (lang) document.documentElement.setAttribute('lang', lang);
            if (doc.body) document.body.className = doc.body.className;   // page-type classes
        }

        function runInlineScripts(scope) {
            scope.querySelectorAll('script:not([src])').forEach((old) => {
                if (old.type && !/^(text|application)\/(javascript|ecmascript)$|^module$/.test(old.type)) return;
                const s2 = document.createElement('script');
                for (const a of old.attributes) s2.setAttribute(a.name, a.value);
                s2.textContent = old.textContent;
                old.replaceWith(s2);
            });
        }

        function fx(mainEl) {
            if (o.fx === false) return Promise.resolve(null);
            if (root.OVRouteFx) return Promise.resolve(root.OVRouteFx);
            if (!selfSrc) return Promise.resolve(null);
            return new Promise((done) => {
                const t = document.createElement('script');
                t.src = selfSrc.replace(/boost\.js(\?.*)?$/, 'route-transition.js');
                t.onload = () => done(root.OVRouteFx || null); t.onerror = () => done(null);
                document.head.appendChild(t);
            });
        }

        async function go(href, { push = true, restoreY = null } = {}) {
            if (stopped) return root.location.assign(href);
            const target = new URL(href, root.location.href);
            const mine = inflight = {};
            const mainEl = document.querySelector(mainSel);
            const Fx = await fx(mainEl);
            const h = Fx ? Fx.start(mainEl, { prefix }) : null;
            emit('before', { url: target.href });
            try {
                const page = await fetchPage(target.href);
                if (inflight !== mine) return;                            // a newer move won
                const doc = new root.DOMParser().parseFromString(page.html, 'text/html');
                const next = doc.querySelector(mainSel);
                // A different release, other external scripts, or no <main>: this page cannot be swapped safely.
                if (!next || marker(doc) !== here.marker || externalScripts(doc) !== here.scripts) throw new Error('not swappable');
                if (h) h.status('applying styles');
                await loadStylesFirst(doc);
                if (inflight !== mine) return;
                if (push) {
                    scrolls[key] = root.scrollY;
                    key += 1;
                    root.history.pushState({ ovBoost: key }, '', page.url + (target.hash && !new URL(page.url).hash ? target.hash : ''));
                }
                // The same element keeps its identity (the transition fades it, listeners on it survive): its
                // attributes and children become the new page's.
                const imported = document.importNode(next, true);
                for (const at of [...mainEl.attributes]) if (!imported.hasAttribute(at.name)) mainEl.removeAttribute(at.name);
                for (const at of [...imported.attributes]) mainEl.setAttribute(at.name, at.value);
                mainEl.replaceChildren(...imported.childNodes);
                const fresh = mainEl;
                updateHead(doc);
                runInlineScripts(fresh);
                const anchor = target.hash && document.getElementById(decodeURIComponent(target.hash.slice(1)));
                if (restoreY != null) root.scrollTo(0, restoreY);
                else if (anchor) anchor.scrollIntoView();
                else root.scrollTo(0, 0);
                if (!fresh.hasAttribute('tabindex')) fresh.setAttribute('tabindex', '-1');
                try { fresh.focus({ preventScroll: true }); } catch { /* */ }
                s.moves++; s.last = page.url;
                if (h) h.done();
                emit('load', { url: page.url });
            } catch (err) {
                if (inflight !== mine) return;
                s.fallbacks++;
                if (h) h.done();
                root.location.assign(target.href);                        // any doubt: a normal page load
            }
        }

        function onClick(ev) {
            const a = ev.target && ev.target.closest && ev.target.closest('a[href]');
            const u = boostable(a, ev);
            if (!u) return;
            ev.preventDefault();
            go(u.href);
        }
        function onIntent(ev) { const a = ev.target && ev.target.closest && ev.target.closest('a[href]'); const u = boostable(a); if (u) prefetch(u); }
        function onPop(ev) {
            const st = ev.state;
            if (!st || st.ovBoost == null) { root.location.reload(); return; }
            const y = scrolls[st.ovBoost];
            scrolls[key] = root.scrollY;
            key = st.ovBoost;
            go(root.location.href, { push: false, restoreY: y != null ? y : 0 });
        }

        root.history.replaceState({ ...(root.history.state || {}), ovBoost: key }, '');
        root.history.scrollRestoration = 'manual';
        document.addEventListener('click', onClick);
        document.addEventListener('mouseover', onIntent, { passive: true });
        document.addEventListener('focusin', onIntent);
        document.addEventListener('touchstart', onIntent, { passive: true });
        root.addEventListener('popstate', onPop);
        return {
            go: (u) => go(u),
            stop() {
                stopped = true;
                document.removeEventListener('click', onClick);
                document.removeEventListener('mouseover', onIntent);
                document.removeEventListener('focusin', onIntent);
                document.removeEventListener('touchstart', onIntent);
                root.removeEventListener('popstate', onPop);
                root.history.scrollRestoration = 'auto';
            },
            stats: () => ({ ...s, cached: cache.size }),
        };
    }

    root.OVBoost = { start, controller: null };
    // <script src=".../boost.js" data-main="#main" [data-prefix] [data-exclude="/a/,/b/"] defer>: start once the page is parsed.
    if (selfData.main) {
        const boot = () => {
            if (root.OVBoost.controller) return;
            root.OVBoost.controller = start({ main: selfData.main, prefix: selfData.prefix || 'ov', exclude: (selfData.exclude || '').split(',').map((x) => x.trim()).filter(Boolean) });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
        else boot();
    }
})(typeof window !== 'undefined' ? window : globalThis);
