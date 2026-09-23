/*
 * openvibe-shared/release-update.js — plans a new release for an open tab and applies it in place
 * (ADR-016, Track R). release-watch.js loads it from its own directory when /release.json reports a
 * release with components or contract ranges; pages never load it themselves. In Node, require() returns
 * the pure plan(), compatible() and satisfies() (openvibe-shared/release-compat builds on them).
 *
 * In place is transactional: every new stylesheet loads and every region is fetched before anything old
 * is removed; a rejection (style, style-timeout, content, origin) leaves the page as it was.
 *   styles(ids, next)  new <link>s for the changed style components' assets, loaded beside the old ones
 *   regions(ids)       fresh [data-ov-content="<component>"] HTML (from data-ov-src, default this URL),
 *                      without scripts, frames or inline handlers; unchanged data-ov-rev is skipped
 *   commit(list, next, busy, record)  replaces the regions busy() allows, returns those still waiting
 *   apply(plan, next, busy, record)   all of the above for an in-place plan
 */
(function (root) {
    'use strict';
    const IN_PLACE = { style: 1, content: 1, server: 1 };
    const ver = (v) => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '')); return m ? [+m[1], +m[2], +m[3]] : null; };
    const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
    /** version inside ">=a.b.c <x.y.z", the only form a manifest writes. */
    function satisfies(version, range) {
        const v = ver(version); const m = /^>=(\S+) <(\S+)$/.exec(String(range || ''));
        const lo = m && ver(m[1]); const hi = m && ver(m[2]);
        return !!(v && lo && hi && cmp(v, lo) >= 0 && cmp(v, hi) < 0);
    }
    /** Every contract the page's release produces is still accepted by the server, and the reverse. */
    function compatible(page, server) {
        const problems = []; const mine = (page && page.contract_ranges) || {}; const theirs = (server && server.contract_ranges) || {};
        for (const id of Object.keys(mine)) {
            const a = mine[id]; const b = theirs[id];
            if (!a || a.role === 'consumes') continue;
            if (!b || b.role === 'consumes') problems.push(`${id}: the server no longer serves it`);
            else if (!satisfies(a.version, b.accepts)) problems.push(`${id}: the server accepts ${b.accepts}, the page speaks ${a.version}`);
            else if (!satisfies(b.version, a.accepts)) problems.push(`${id}: the page accepts ${a.accepts}, the server speaks ${b.version}`);
        }
        return { ok: !problems.length, problems };
    }
    /**
     * What a tab on `page` (the manifest of the release it runs) does about `server`:
     * { action: none | in-place | prompt | reload, reason?: contract | required | window, changed, problems? }.
     * In place only when every changed component is style, content (same kind on both sides) or server.
     */
    function plan(page, server, now) {
        if (!server || !page || server.release === page.release) return { action: 'none', changed: [] };
        const c = compatible(page, server);
        if (!c.ok) return { action: 'reload', reason: 'contract', changed: [], problems: c.problems };
        const a = page.components; const b = server.components; let changed = null;
        if (a && b) {
            let ok = true; changed = [];
            for (const id of Object.keys(Object.assign({}, a, b))) {
                const x = a[id]; const y = b[id];
                if (x && y && x.kind === y.kind && x.version === y.version) continue;
                const kind = (y || x).kind;
                changed.push({ id, kind });
                if (!IN_PLACE[kind] || (x && y ? x.kind !== y.kind : kind !== 'server')) ok = false;
            }
            if (ok) return { action: 'in-place', changed };
        }
        const windowMs = (Number(server.mixed_version_window_hours) || 0) * 3600e3;
        if (server.min_client_release === server.release) return { action: 'reload', reason: 'required', changed };
        if (windowMs > 0 && (now == null ? Date.now() : +now) - Date.parse(server.released_at) > windowMs) return { action: 'reload', reason: 'window', changed };
        return { action: 'prompt', changed };
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { plan, compatible, satisfies };
    if (typeof document === 'undefined' || root.OVReleaseUpdate) return;

    const loc = () => root.location.href;
    const sameOrigin = (u) => { try { return new URL(u, loc()).origin === new URL(loc()).origin; } catch { return false; } };

    function styles(ids, next) {
        const jobs = [];
        for (const p of Object.keys(next.assets || {})) {
            const a = next.assets[p];
            if (!ids[a.component]) continue;
            const want = new URL(a.url, loc());
            for (const l of document.querySelectorAll('link[rel~="stylesheet"]')) {
                const have = new URL(l.getAttribute('href') || '', loc());
                if (l.getAttribute('data-ov-asset') !== p && (have.origin !== want.origin || (have.pathname !== want.pathname && have.pathname !== p))) continue;
                if (have.href === want.href) continue;
                if (have.origin !== want.origin || !/^https?:$/.test(want.protocol)) return Promise.reject('origin');
                const n = l.cloneNode(false);
                n.setAttribute('href', want.href);
                if (a.integrity) n.setAttribute('integrity', a.integrity); else n.removeAttribute('integrity');
                jobs.push({ old: l, n });
            }
        }
        return Promise.all(jobs.map((j) => new Promise((ok, no) => {
            const timer = root.setTimeout(() => no('style-timeout'), 15000);
            j.n.addEventListener('load', () => { root.clearTimeout(timer); ok(); });
            j.n.addEventListener('error', () => { root.clearTimeout(timer); no('style'); });
            j.old.parentNode.insertBefore(j.n, j.old.nextSibling);
        }))).then(() => jobs, (why) => { jobs.forEach((j) => j.n.remove()); throw why; });
    }

    async function regions(ids) {
        const out = []; const docs = {};
        for (const el of document.querySelectorAll('[data-ov-content]')) {
            const id = el.getAttribute('data-ov-content');
            if (!ids[id] || !/^[a-z][a-z0-9-]{0,39}$/.test(id)) continue;
            const src = new URL(el.getAttribute('data-ov-src') || loc(), loc()); src.hash = '';
            if (!sameOrigin(src.href)) throw 'origin';
            if (!docs[src.href]) {
                const r = await root.fetch(src.href, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'text/html' } });
                if (!r.ok) throw 'content';
                docs[src.href] = new root.DOMParser().parseFromString(await r.text(), 'text/html');
            }
            const doc = docs[src.href];
            const fresh = doc.querySelector(`[data-ov-content="${id}"]`) || (el.hasAttribute('data-ov-src') ? doc.body : null);
            if (!fresh) throw 'content';
            for (const x of fresh.querySelectorAll('script, iframe, object, embed, base, frame, meta')) x.remove();
            for (const x of [fresh, ...fresh.querySelectorAll('*')]) {
                for (const at of Array.from(x.attributes)) {
                    if (/^on/i.test(at.name) || (/^(href|src|action|formaction|xlink:href|srcdoc)$/i.test(at.name) && /^\s*(javascript|vbscript|data):/i.test(at.value) && !/^\s*data:image\//i.test(at.value))) x.removeAttribute(at.name);
                }
            }
            const rev = fresh.getAttribute('data-ov-rev');
            if (rev && rev === el.getAttribute('data-ov-rev')) continue;
            out.push({ el, fresh, id });
        }
        return out;
    }

    function commit(list, next, busy, record) {
        return list.filter((w) => {
            if (!w.el.isConnected) return false;
            const why = busy(w.el);
            if (why) { record('deferred', why, true); return true; }
            const r = w.el.getBoundingClientRect();
            const st = w.el.scrollTop;
            w.el.replaceChildren(...Array.from(w.fresh.childNodes).map((n) => document.importNode(n, true)));
            const rev = w.fresh.getAttribute('data-ov-rev');
            if (rev) w.el.setAttribute('data-ov-rev', rev);
            w.el.scrollTop = st;
            // A region above the viewport that changed height must not move what the reader is looking at.
            if (r.bottom <= 0 && root.scrollBy) root.scrollBy(0, w.el.getBoundingClientRect().bottom - r.bottom);
            try { w.el.dispatchEvent(new root.CustomEvent('ov:content-updated', { bubbles: true, detail: { component: w.id, release: next.release } })); } catch { /* */ }
            return false;
        });
    }

    /** Applies an in-place plan; resolves with the regions still waiting for commit(), rejects with a reason. */
    async function apply(p, next, busy, record) {
        const ids = {}; const k = {};
        for (const ch of p.changed) { ids[ch.id] = 1; k[ch.kind] = 1; }
        const list = k.content ? await regions(ids) : [];
        const jobs = k.style ? await styles(ids, next) : [];
        jobs.forEach((j) => j.old.remove());
        if (jobs.length) try { root.dispatchEvent(new root.CustomEvent('ov:styles-updated', { detail: { release: next.release } })); } catch { /* */ }
        return commit(list, next, busy, record);
    }

    root.OVReleaseUpdate = { plan, compatible, satisfies, styles, regions, commit, apply };
})(typeof window !== 'undefined' ? window : globalThis);
