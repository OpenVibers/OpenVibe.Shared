/*
 * openvibe-shared/web-runtime.js — a site's feature loader and route lifecycle (roadmap WS-P task 6), taken out of
 * OpenVibe.Live's public/js/ov-loader.js so every OpenVibe site loads its code the same way.
 *
 *   const rt = OVWebRuntime.create({ features, routes, versions, ... });   // registry: see README "Web runtime"
 *   rt.load('broadcast')      → the feature's markup fragment, its dependencies, stylesheets and scripts (in order), then
 *                               its `after` hook; once, cached; a failed load can be retried.
 *   rt.route(path)            → every feature the path's routes name, as one promise.
 *   rt.prefetch('channel')    → download only (link rel=prefetch), never execute; skipped on Save-Data, 2g and < 2 GB
 *                               of memory, and within a budget (count, and bytes where sizes are known).
 *   rt.nextRoute() / rt.gen() / rt.isCurrent(gen)
 *                             → route generations: a loader that awaited something can tell whether the visitor moved on.
 *   rt.scope()                → timers, listeners, observers, fetches (AbortSignal) and child scopes owned by the current
 *                               route, released by the next nextRoute(). Anything registered on a scope whose route has
 *                               ended is refused (and counted), never left running.
 *   rt.diagnostics(), rt.leaks()
 *                             → loaded, failed and rolled-back features, duplicate tags, late registrations, what the
 *                               current route holds, and the prefetch budget spent.
 *
 * Asset groups are transactional: a feature counts as loaded, runs its hook and fires `<prefix>:feature` only when
 * every script loaded. When one fails, the stylesheets that attempt added (and no other feature wants) are taken out
 * again and the failed script's tag is removed, so a retry fetches exactly what is missing. Scripts that did run are
 * kept, so nothing runs twice.
 * Tags the server already put in the document count as loaded. Global stubs (installStubs) keep inline onclick
 * handlers working before their feature has loaded.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVWebRuntime) return;

    /** The key an asset is known by: its path on this site, origin + path elsewhere; the query (?v=) never counts. */
    function assetKey(src) {
        try {
            const u = new URL(src, root.location.href);
            return u.origin === root.location.origin ? u.pathname : u.origin + u.pathname;
        } catch { return String(src).split(/[?#]/)[0]; }
    }

    function create(o = {}) {
        const FEATURES = o.features || {};
        const ROUTES = (o.routes || []).map((r) => ({ re: r.path instanceof RegExp ? r.path : new RegExp(r.path), features: r.features || [] }));
        const versions = o.versions || {};
        const G = o.global || root;
        const prefix = o.eventPrefix || 'ov';
        const log = o.log || root.console;
        const styleTimeout = o.styleTimeout || 4000;
        const fragmentPath = o.fragmentPath || ((name) => `/fragments/${name}.html`);
        const url = o.url || ((p) => { const h = versions[p]; return h ? `${p}${p.indexOf('?') === -1 ? '?' : '&'}v=${h}` : p; });
        const d = { scripts: 0, styles: 0, late: 0, rolledBack: 0, failed: Object.create(null), scopes: 0, disposed: 0 };
        const emit = (type, detail, target) => (target || document).dispatchEvent(new root.CustomEvent(type, { bubbles: true, detail }));
        const failed = (kind, what, err) => { const f = d.failed[what] || (d.failed[what] = { kind, attempts: 0, error: '' }); f.attempts++; f.error = String((err && err.message) || err || ''); };

        // ── Scripts and styles, once each ────────────────────────────────────────────────────────
        const scripts = Object.create(null);    // key → promise
        const styles = Object.create(null);     // key → promise
        const styleEls = Object.create(null);   // key → the <link> this runtime inserted
        const wanted = Object.create(null);     // key → Set of features loading or loaded that list it

        function tagPromise(el, isScript) {
            // A deferred script that has run fired `load` long ago; after DOMContentLoaded every parser-inserted script has run.
            if (isScript && document.readyState !== 'loading' && !el.dataset.ovInjected) return Promise.resolve();
            return new Promise((resolve) => {
                el.addEventListener('load', () => resolve(), { once: true });
                el.addEventListener('error', () => resolve(), { once: true });
                if (isScript && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
            });
        }
        /** Tags already in the document (the server's, or another loader's) count as loaded or loading. */
        function adoptExisting() {
            document.querySelectorAll('script[src]').forEach((t) => { const k = assetKey(t.getAttribute('src')); if (!scripts[k]) scripts[k] = tagPromise(t, true); });
            document.querySelectorAll('link[rel="stylesheet"][href]').forEach((l) => { const k = assetKey(l.getAttribute('href')); if (!styles[k]) styles[k] = l.sheet ? Promise.resolve() : tagPromise(l, false); });
        }

        /** attrs: { integrity, crossOrigin } for another origin's file. */
        function loadScript(p, attrs) {
            const k = assetKey(p);
            if (scripts[k]) return scripts[k];
            const s = document.createElement('script');
            s.src = url(p);
            s.async = false;                    // injected together → run in insertion order
            s.dataset.ovInjected = '1';
            if (attrs && attrs.integrity) s.integrity = attrs.integrity;
            if (attrs && attrs.crossOrigin) s.crossOrigin = attrs.crossOrigin;
            scripts[k] = new Promise((resolve, reject) => {
                s.onload = () => { delete d.failed[k]; resolve(); };
                s.onerror = () => {
                    delete scripts[k];          // a retry adds a fresh tag
                    s.remove();
                    const err = new Error(`Could not load ${p}`);
                    failed('script', k, err);
                    reject(err);
                };
            });
            document.head.appendChild(s);
            d.scripts++;
            return scripts[k];
        }

        /** Never rejects: a missing stylesheet must not block a route (it waits at most styleTimeout ms). */
        function loadStyle(p, added) {
            const k = assetKey(p);
            if (styles[k]) return styles[k];
            const l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = url(p);
            const pr = styles[k] = new Promise((resolve) => {
                let done = false;
                const finish = () => { if (!done) { done = true; resolve(); } };
                l.onload = () => { delete d.failed[k]; finish(); };
                l.onerror = () => {
                    if (styles[k] === pr) { delete styles[k]; delete styleEls[k]; }
                    l.remove();
                    failed('style', k, 'error');
                    finish();
                };
                root.setTimeout(finish, styleTimeout);
            });
            // o.styleSlot(p) → the node it goes before (a site's cascade order), or nothing: last in <head>.
            const before = o.styleSlot ? o.styleSlot(p) : null;
            if (before && before.parentNode) before.parentNode.insertBefore(l, before);
            else document.head.appendChild(l);
            styleEls[k] = l;
            d.styles++;
            if (added) added.push(k);
            return pr;
        }

        // ── Markup fragments ─────────────────────────────────────────────────────────────────────
        const fragments = Object.create(null);
        function loadFragment(name, sectionId) {
            const section = document.getElementById(sectionId);
            if (!section || section.dataset.fragmentLoaded === '1') return Promise.resolve();
            if (fragments[name]) return fragments[name];
            section.setAttribute('aria-busy', 'true');
            fragments[name] = root.fetch(url(fragmentPath(name)), { credentials: 'same-origin' })
                .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
                .then((html) => {
                    // Inserted once, never replaced: players, previews and call tiles bind to these exact nodes.
                    if (section.dataset.fragmentLoaded !== '1') {
                        section.innerHTML = html;
                        section.dataset.fragmentLoaded = '1';
                        emit(`${prefix}:fragment`, { name }, section);
                    }
                    section.removeAttribute('aria-busy');
                }, (err) => {
                    delete fragments[name];
                    section.removeAttribute('aria-busy');
                    failed('fragment', name, err);
                    throw err;
                });
            return fragments[name];
        }

        // ── Features (transactional asset groups) ─────────────────────────────────────────────────
        const features = Object.create(null);   // name → promise, in flight or loaded
        const loaded = Object.create(null);
        const afterRan = Object.create(null);

        function load(name) {
            const f = FEATURES[name];
            if (!f) return Promise.resolve();
            if (features[name]) return features[name];
            const css = (f.css || []).map(assetKey);
            css.forEach((k) => (wanted[k] || (wanted[k] = new Set())).add(name));
            const added = [];
            // The feature's markup goes in before its dependencies and scripts run: modules bind to it when they load.
            const markup = f.fragment ? loadFragment(f.fragment, f.section || `page-${f.fragment}`) : Promise.resolve();
            features[name] = markup
                .then(() => Promise.all((f.deps || []).map(load)))
                .then(() => Promise.all((f.css || []).map((p) => loadStyle(p, added)).concat((f.js || []).map((p) => loadScript(p)))))
                .then(() => {
                    loaded[name] = true;
                    delete d.failed[name];
                    if (f.after && !afterRan[name] && typeof G[f.after] === 'function') {
                        afterRan[name] = true;
                        try { G[f.after](); } catch (e) { log.error(`[${prefix}] ${name} after-hook failed:`, e); }
                    }
                    emit(`${prefix}:feature`, { name });
                }, (err) => {
                    delete features[name];
                    css.forEach((k) => wanted[k] && wanted[k].delete(name));
                    for (const k of added) {
                        if (wanted[k] && wanted[k].size) continue;
                        if (styleEls[k]) styleEls[k].remove();
                        delete styleEls[k]; delete styles[k];
                        d.rolledBack++;
                    }
                    failed('feature', name, err);
                    throw err;
                });
            return features[name];
        }

        function featuresFor(path) {
            const out = [];
            ROUTES.forEach((r) => { if (r.re.test(path)) r.features.forEach((n) => { if (out.indexOf(n) === -1) out.push(n); }); });
            return out;
        }
        function route(path) { return Promise.all(featuresFor(path || root.location.pathname).map(load)); }

        // ── Prefetch (download, never execute), within a budget ──────────────────────────────────
        const pf = o.prefetch || {};
        const budget = { count: pf.count == null ? 60 : pf.count, bytes: pf.bytes == null ? 3 * 1024 * 1024 : pf.bytes };
        const sizes = pf.sizes || {};
        const spent = { count: 0, bytes: 0, skipped: 0, constrained: 0 };
        const prefetched = Object.create(null);
        function constrained() {
            const c = root.navigator && root.navigator.connection;
            if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return true;
            return !!root.navigator && typeof root.navigator.deviceMemory === 'number' && root.navigator.deviceMemory < 2;
        }
        function prefetchAsset(p) {
            const k = assetKey(p);
            if (prefetched[k] || scripts[k] || styles[k]) return;
            const size = Number(sizes[p]) || 0;
            if (spent.count + 1 > budget.count || spent.bytes + size > budget.bytes) { spent.skipped++; return; }
            prefetched[k] = true; spent.count++; spent.bytes += size;
            const l = document.createElement('link');
            l.rel = 'prefetch';
            l.href = url(p);
            l.setAttribute('as', /\.css$/.test(k) ? 'style' : /\.js$/.test(k) ? 'script' : 'fetch');
            document.head.appendChild(l);
        }
        function prefetch(name, seen) {
            seen = seen || Object.create(null);
            const f = FEATURES[name];
            if (!f || seen[name] || features[name]) return;
            if (constrained()) { spent.constrained++; return; }
            seen[name] = true;
            (f.deps || []).forEach((n) => prefetch(n, seen));
            (f.css || []).concat(f.js || []).forEach(prefetchAsset);
            if (f.fragment) prefetchAsset(fragmentPath(f.fragment));
        }
        function prefetchRoute(path) { featuresFor(path).forEach((n) => prefetch(n)); }

        /** Hover, focus or touch on an in-site link: fetch that route's code. Returns a function that stops watching. */
        function watchIntent(target) {
            const t = target || document;
            const on = (e) => {
                const a = e.target && e.target.closest && e.target.closest('a[href^="/"]');
                const href = a && a.getAttribute('href');
                if (!href || href.charAt(1) === '/') return;
                const path = href.split(/[?#]/)[0];
                if (path) prefetchRoute(path);
            };
            const kinds = [['pointerover', { passive: true }], ['focusin', undefined], ['touchstart', { passive: true }]];
            kinds.forEach(([k, opts]) => t.addEventListener(k, on, opts));
            return () => kinds.forEach(([k, opts]) => t.removeEventListener(k, on, opts));
        }
        /** The `idle` features of the path's routes, prefetched once the page has settled (load + 4 s + idle). */
        function idlePrefetch(path) {
            const idle = root.requestIdleCallback || ((fn) => root.setTimeout(fn, 3000));
            const go = () => root.setTimeout(() => idle(() => {
                featuresFor(path || root.location.pathname).forEach((n) => (FEATURES[n].idle || []).forEach((m) => prefetch(m)));
            }, { timeout: 15000 }), 4000);
            if (document.readyState === 'complete') go();
            else root.addEventListener('load', go, { once: true });
        }

        // ── Route generations and scopes ─────────────────────────────────────────────────────────
        let generation = 0;
        let current = null;

        function makeScope(gen) {
            const held = new Set();
            const controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
            let disposed = false;
            d.scopes++;
            const late = (kind) => { d.late++; if (o.debug) log.warn(`[${prefix}] ${kind} registered after its route ended (generation ${gen}); ignored`); };
            const hold = (kind, fn) => { const h = { kind, fn }; held.add(h); return h; };
            const scope = {
                gen,
                signal: controller ? controller.signal : undefined,
                interval(fn, ms) {
                    if (disposed) { late('interval'); return 0; }
                    const id = root.setInterval(fn, ms);
                    hold('interval', () => root.clearInterval(id));
                    return id;
                },
                timeout(fn, ms) {
                    if (disposed) { late('timeout'); return 0; }
                    let h = null;
                    const id = root.setTimeout(function () { held.delete(h); return fn.apply(this, arguments); }, ms);
                    h = hold('timeout', () => root.clearTimeout(id));
                    return id;
                },
                listen(target, type, fn, opts) {
                    if (!target) return;
                    if (disposed) { late('listener'); return; }
                    target.addEventListener(type, fn, opts);
                    hold('listener', () => target.removeEventListener(type, fn, opts));
                },
                observe(observer) {
                    if (disposed) { late('observer'); try { observer.disconnect(); } catch { /* */ } return observer; }
                    hold('observer', () => { try { observer.disconnect(); } catch { /* */ } });
                    return observer;
                },
                onDispose(fn) {
                    if (disposed) { late('onDispose'); try { fn(); } catch { /* */ } return; }
                    hold('onDispose', fn);
                },
                /** fetch() cancelled when the route ends (unless init brings its own signal). */
                fetch(input, init) {
                    if (disposed) { late('fetch'); return Promise.reject(Object.assign(new Error('The route has ended'), { name: 'AbortError' })); }
                    return root.fetch(input, Object.assign({ signal: scope.signal }, init));
                },
                /** A scope for one component (a dialog, a player) that can end early and ends with this one anyway. */
                child() {
                    const c = makeScope(gen);
                    if (disposed) { late('child'); c.dispose(); return c; }
                    const h = hold('child', () => c.dispose());
                    c.onDispose(() => held.delete(h));
                    return c;
                },
                /** What this scope holds right now, by kind. */
                held() {
                    const out = {};
                    held.forEach((h) => { out[h.kind] = (out[h.kind] || 0) + 1; });
                    return out;
                },
                get disposed() { return disposed; },
                dispose() {
                    if (disposed) return;
                    disposed = true;
                    d.disposed++;
                    if (controller) try { controller.abort(); } catch { /* */ }
                    const list = Array.from(held).reverse();
                    held.clear();
                    for (const h of list) { try { h.fn(); } catch (e) { log.warn(`[${prefix}] scope cleanup failed:`, e); } }
                },
            };
            return scope;
        }
        function scope() { if (!current) current = makeScope(generation); return current; }
        /** A new route: everything the previous one owned is released. Returns the new generation. */
        function nextRoute() {
            generation++;
            if (current) current.dispose();
            current = makeScope(generation);
            return generation;
        }

        // ── Stubs for inline handlers ────────────────────────────────────────────────────────────
        function installStubs() {
            Object.keys(FEATURES).forEach((name) => {
                (FEATURES[name].stubs || []).forEach((fn) => {
                    if (typeof G[fn] === 'function') return;
                    const stub = function () {
                        const args = arguments; const self = this;
                        return load(name).then(() => {
                            if (G[fn] !== stub && typeof G[fn] === 'function') return G[fn].apply(self, args);
                            log.warn(`[${prefix}] ${fn} is unavailable after loading ${name}`);
                        }, (err) => {
                            log.error(`[${prefix}]`, err);
                            if (typeof o.onStubError === 'function') o.onStubError(err, name);
                        });
                    };
                    stub.__ovStub = name;
                    G[fn] = stub;
                });
            });
        }

        // ── Recoverable failure UI for a route ───────────────────────────────────────────────────
        const RE = Object.assign({ icon: '', button: 'btn btn-primary', title: 'This page could not load.', text: 'Check your connection, then try again.', retry: 'Try again' }, o.routeError);
        function showRouteError(pageId, err, retry) {
            const page = document.getElementById(pageId);
            if (!page) return;
            let box = page.querySelector(':scope > .ov-route-error');
            if (!box) {
                box = document.createElement('div');
                box.className = 'ov-route-error';
                box.setAttribute('role', 'alert');
                page.insertBefore(box, page.firstChild);
            }
            box.textContent = '';
            if (RE.icon) { const i = document.createElement('i'); i.className = RE.icon; i.setAttribute('aria-hidden', 'true'); box.appendChild(i); }
            const msg = document.createElement('div');
            const strong = document.createElement('strong'); strong.textContent = RE.title;
            const span = document.createElement('span'); span.textContent = RE.text;
            msg.appendChild(strong); msg.appendChild(span); box.appendChild(msg);
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = RE.button; btn.textContent = RE.retry;
            btn.addEventListener('click', () => { box.remove(); retry(); }, { once: true });
            box.appendChild(btn);
            log.error(`[${prefix}] route failed to load:`, err);
        }

        // ── Diagnostics ──────────────────────────────────────────────────────────────────────────
        function duplicates() {
            const n = Object.create(null);
            document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach((el) => {
                const k = assetKey(el.getAttribute('src') || el.getAttribute('href'));
                n[k] = (n[k] || 0) + 1;
            });
            return Object.keys(n).filter((k) => n[k] > 1).map((k) => ({ asset: k, count: n[k] }));
        }
        function diagnostics() {
            return {
                generation,
                features: {
                    loaded: Object.keys(loaded),
                    loading: Object.keys(features).filter((n) => !loaded[n]),
                    failed: Object.keys(d.failed).filter((k) => d.failed[k].kind === 'feature').map((k) => ({ name: k, attempts: d.failed[k].attempts, error: d.failed[k].error })),
                },
                assets: {
                    scripts: Object.keys(scripts).length, styles: Object.keys(styles).length,
                    injected: { scripts: d.scripts, styles: d.styles },
                    failed: Object.keys(d.failed).filter((k) => d.failed[k].kind !== 'feature').map((k) => ({ asset: k, kind: d.failed[k].kind, attempts: d.failed[k].attempts })),
                    rolledBack: d.rolledBack,
                    duplicates: duplicates(),
                },
                scopes: { created: d.scopes, disposed: d.disposed, late: d.late, current: current ? current.held() : {} },
                prefetch: Object.assign({ budget: Object.assign({}, budget) }, spent),
            };
        }
        /** Plain sentences about anything that looks like a leak; empty when all is well. */
        function leaks() {
            const out = [];
            duplicates().forEach((x) => out.push(`${x.asset} is in the document ${x.count} times`));
            if (d.late) out.push(`${d.late} registration(s) arrived after their route ended (refused)`);
            return out;
        }

        return {
            load, route, featuresFor, prefetch, prefetchRoute, loadScript, loadStyle, loadFragment, url, assetKey,
            gen: () => generation,
            isCurrent: (g) => g === generation,
            scope, nextRoute, installStubs, showRouteError, adoptExisting, watchIntent, idlePrefetch, diagnostics, leaks,
            isLoaded: (name) => !!features[name],
            /** Adopt the server's tags, load `initial` features, watch link intent, prefetch the idle features. */
            boot(b = {}) {
                const start = () => {
                    adoptExisting();
                    (b.initial || []).forEach((n) => { load(n).catch(() => { /* recorded in diagnostics */ }); });
                    if (b.intent !== false) watchIntent(document);
                    if (b.idle !== false) idlePrefetch();
                };
                if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
                else start();
            },
        };
    }

    root.OVWebRuntime = { create, assetKey };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.OVWebRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
