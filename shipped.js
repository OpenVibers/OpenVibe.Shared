/*!
 * openvibe-shared/shipped — what shipped, on every OpenVibe site, from one feed: the network changelog
 * OpenVibe.Blog keeps (every deployed commit of every site) and serves through OpenVibe.Network at
 * GET https://openvibe.network/api/v1/changelog, which every site's CSP already allows.
 *
 * Three views, the same on every site:
 *   latest  the one-liner "🚀 shipped 5m ago: <newest change>", linking to the site's updates page
 *   list    the newest few changes, each linked to its commit, plus the latest "Patch notes" post
 *   log     the full updates page: changes grouped by day, "Load more", this site or the whole
 *           network (with a filter per site), and the patch notes posts
 *
 * Markup only (the script mounts every element on the page, and the shared footer loads it):
 *   <a data-ov-shipped="latest" data-service="wiki" href="/updates"></a>
 *   <section data-ov-shipped="list" data-service="wiki" data-limit="8" data-more="/updates"></section>
 *   <div data-ov-shipped="log" data-service="wiki"></div>        data-service="" = the whole network
 *   <script src="https://openvibe.network/shared/shipped.js" defer></script>
 *
 * Or from code: OpenVibeShipped.latest(el, opts), .list(el, opts) (alias mount), .log(el, opts),
 * .scan(root). Options: service (a registry id; 'auto' = from the hostname; omitted = every site),
 * limit, title ('' = no heading), href / more (links), api (the feed URL, for tests). DOM nodes only
 * (commit text is never parsed as HTML), https links only; a failed or empty feed hides the element,
 * never an error on the page. Styles follow the theme's CSS variables. A classic script, no modules.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') {
        window.OpenVibeShipped = api;
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => api.scan(document));
            else api.scan(document);
        }
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const API = 'https://openvibe.network/api/v1/changelog';
    const SITE_NAMES = { live: 'Live', network: 'Network', tools: 'Tools', media: 'Media', community: 'Community', chat: 'Chat', games: 'Games', blog: 'Blog', wiki: 'Wiki', news: 'News', reviews: 'Reviews', deals: 'Deals', coupons: 'Coupons', trade: 'Trade', codes: 'Codes', host: 'Host', ai: 'AI', search: 'Search', sources: 'Sources', events: 'Events', billing: 'Billing', tips: 'Tips', vip: 'VIP', openre: 'OpenRe', sites: 'Sites', realtime: 'Realtime' };
    const STYLE_ID = 'ov-shipped-style';
    const TEXT = 'var(--text-primary,var(--text,inherit))';
    const MUTED = 'var(--text-secondary,var(--text-muted,#8b93ad))';
    const ACCENT = 'var(--accent-light,var(--accent,#3b82f6))';
    const BORDER = 'var(--border,rgba(127,127,127,.25))';
    const CSS = [
        `.ov-shipped-latest{display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:999px;font-size:.8rem;text-decoration:none;color:${MUTED};background:color-mix(in srgb,var(--bg-secondary,#111827) 70%,transparent);border:1px solid color-mix(in srgb,var(--accent,#3b82f6) 22%,transparent);max-width:min(640px,100%);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}`,
        `.ov-shipped-latest:hover{border-color:var(--accent,#3b82f6);color:${TEXT}}.ov-shipped-latest svg{flex:none;color:var(--accent,#3b82f6)}`,
        `.ov-shipped-latest b{color:${TEXT};font-weight:600;overflow:hidden;text-overflow:ellipsis;min-width:0}`,
        '[data-ov-shipped][hidden],.ov-shipped[hidden],.ov-shipped-latest[hidden]{display:none!important}',
        '.ov-shipped-home{display:grid;gap:12px;justify-items:start;margin:16px 0;min-width:0}.ov-shipped-home>.ov-shipped{justify-self:stretch}',
        `.ov-updates{min-width:0}.ov-updates h1{margin:.2em 0 .3em}.ov-updates-lede{color:${MUTED};line-height:1.55;margin:0 0 18px}`,
        '.ov-shipped{font-size:.92rem;min-width:0}.ov-shipped h3{font-size:1rem;margin:0 0 .5rem;display:flex;gap:.4rem;align-items:center}',
        '.ov-shipped ul{list-style:none;margin:0;padding:0;display:grid;gap:.35rem}.ov-shipped li{display:flex;gap:.5rem;align-items:baseline;min-width:0}',
        `.ov-shipped-site{flex:none;font-size:.72rem;font-weight:700;padding:.05rem .45rem;border-radius:999px;background:color-mix(in srgb,var(--accent,#3b82f6) 16%,transparent);color:${ACCENT};text-decoration:none}`,
        `.ov-shipped a.ov-shipped-subject{color:${TEXT};text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}`,
        '.ov-shipped a.ov-shipped-subject:hover{text-decoration:underline}.ov-shipped li time{flex:none;margin-left:auto;font-size:.75rem;opacity:.7}',
        `.ov-shipped-major{font-weight:600}.ov-shipped-links{display:flex;flex-wrap:wrap;gap:.4rem 1rem;margin-top:.6rem}.ov-shipped-links a{font-weight:600;color:${ACCENT};text-decoration:none}.ov-shipped-links a:hover{text-decoration:underline}`,
        '.ov-shipped-log{display:flex;flex-direction:column;gap:22px;min-width:0}',
        '.ov-shipped-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
        `.ov-shipped-chip{font:inherit;font-size:.8rem;padding:4px 12px;border-radius:999px;border:1px solid ${BORDER};background:transparent;color:${MUTED};cursor:pointer;text-decoration:none}`,
        `.ov-shipped-chip:hover{color:${TEXT};border-color:var(--accent,#3b82f6)}.ov-shipped-chip[aria-pressed="true"]{background:var(--accent,#3b82f6);border-color:var(--accent,#3b82f6);color:var(--on-accent,#fff)}`,
        `.ov-shipped-day h3{font-size:.95rem;font-weight:600;color:${MUTED};padding-bottom:8px;border-bottom:1px solid ${BORDER};margin:0 0 4px}`,
        '.ov-shipped-entries{display:flex;flex-direction:column;gap:2px}',
        '.ov-shipped-entry{display:flex;align-items:baseline;gap:10px;padding:8px 12px;border-radius:6px;min-width:0}',
        '.ov-shipped-entry:hover{background:var(--bg-tertiary,rgba(127,127,127,.08))}',
        `.ov-shipped-hash{font-family:'JetBrains Mono','Fira Code',ui-monospace,monospace;font-size:.8rem;color:${ACCENT};text-decoration:none;flex:none}.ov-shipped-hash:hover{text-decoration:underline}`,
        `.ov-shipped-text{flex:1;min-width:0;font-size:.9rem;color:${TEXT};overflow-wrap:anywhere}.ov-shipped-text.ov-shipped-major{font-weight:600}`,
        `.ov-shipped-meta{font-size:.75rem;color:${MUTED};flex:none;white-space:nowrap}`,
        `.ov-shipped-more{align-self:center;font:inherit;font-size:.85rem;padding:8px 18px;border-radius:999px;border:1px solid ${BORDER};background:transparent;color:${TEXT};cursor:pointer}.ov-shipped-more:hover{border-color:var(--accent,#3b82f6)}.ov-shipped-more[disabled]{opacity:.6;cursor:default}`,
        `.ov-shipped-posts{border:1px solid ${BORDER};border-radius:12px;padding:12px 16px}.ov-shipped-posts h3{font-size:.95rem;margin:0 0 8px}.ov-shipped-posts ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}`,
        `.ov-shipped-posts a{color:${ACCENT};text-decoration:none;font-weight:600}.ov-shipped-posts a:hover{text-decoration:underline}.ov-shipped-posts small{color:${MUTED};margin-left:6px}`,
        `.ov-shipped-empty{color:${MUTED};text-align:center;padding:24px 0;margin:0}`,
        '@media (max-width:600px){.ov-shipped-entry{flex-wrap:wrap;gap:4px 8px}.ov-shipped-meta{width:100%}}',
    ].join('');
    const ROCKET = 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5';

    // ── helpers ─────────────────────────────────────────────────
    function ago(iso, now) {
        const t = Date.parse(iso);
        if (!t) return '';
        const s = Math.max(0, ((now || Date.now()) - t) / 1000);
        if (s < 45) return 'just now';
        if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
        if (s < 86400) return `${Math.round(s / 3600)}h ago`;
        if (s < 86400 * 45) return `${Math.round(s / 86400)}d ago`;
        return `${Math.round(s / (86400 * 30))}mo ago`;
    }
    function el(tag, attrs, text) {
        const n = document.createElement(tag);
        for (const k of Object.keys(attrs || {})) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
        if (text != null) n.textContent = text;
        return n;
    }
    function style() {
        if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
        const s = el('style', { id: STYLE_ID });
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
    }
    function safeUrl(u) { return /^https:\/\//.test(String(u || '')) ? String(u) : null; }
    function localHref(u) { const s = String(u || ''); return /^\/(?!\/)/.test(s) || /^https:\/\//.test(s) ? s : null; }
    function clamp(n, lo, hi, d) { const v = parseInt(n, 10); return Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : d; }
    const siteName = (id) => SITE_NAMES[id] || id;
    function timeEl(iso) { const t = el('time', { datetime: iso, 'data-ov-ago': '' }, ago(iso)); t.title = new Date(iso).toLocaleString(); return t; }
    function rocket() {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        for (const [k, v] of Object.entries({ width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
        const p = document.createElementNS(ns, 'path');
        p.setAttribute('d', ROCKET);
        svg.appendChild(p);
        return svg;
    }

    /** The registry id for a hostname (or an id already): openvibe.wiki → wiki, pdf.openvibe.tools → tools. */
    function serviceFor(value) {
        const v = String(value || '').toLowerCase().trim();
        if (SITE_NAMES[v]) return v;
        const h = v.replace(/:\d+$/, '').replace(/^www\./, '');
        if (/(^|\.)openre\.stream$/.test(h)) return 'openre';
        if (/(^|\.)openvibe\.tools$/.test(h)) return 'tools';
        if (/(^|\.)openvibe\.network$/.test(h)) {
            const sub = h.replace(/\.?openvibe\.network$/, '');
            return SITE_NAMES[sub] && sub !== 'network' ? sub : 'network';
        }
        const m = /(?:^|\.)openvibe\.([a-z]+)$/.exec(h);
        return m && SITE_NAMES[m[1]] ? m[1] : null;
    }
    /** 'auto' = this page's host; a site id that is not a registry id (a Tools satellite's 'dev') also falls back to the host; '' = the whole network. */
    function resolveService(s) {
        const host = () => (typeof location !== 'undefined' ? serviceFor(location.hostname) : null);
        if (s === 'auto') return host();
        return s ? (serviceFor(s) || host()) : null;
    }

    // One request per feed URL for 30 s, shared by the footer line, the pill and the list on a page.
    const _feeds = new Map();
    function feed({ service = null, limit = 5, before = null, api = null } = {}) {
        const url = new URL(api || API);
        if (service) url.searchParams.set('service', String(service));
        url.searchParams.set('limit', String(clamp(limit, 1, 100, 5)));
        if (before) url.searchParams.set('before', String(before));
        const key = url.toString();
        const hit = _feeds.get(key);
        if (hit && Date.now() - hit.at < 30000) return hit.promise;
        const promise = fetch(key, { headers: { Accept: 'application/json' }, credentials: 'omit' })
            .then((r) => (r.ok ? r.json() : null)).catch(() => null);
        _feeds.set(key, { at: Date.now(), promise });
        return promise;
    }

    // "5m ago" stays true while the page is open.
    let _ticker = null;
    function tick() {
        if (_ticker || typeof setInterval === 'undefined' || typeof document === 'undefined') return;
        _ticker = setInterval(() => {
            for (const t of document.querySelectorAll('time[data-ov-ago]')) t.textContent = ago(t.getAttribute('datetime'));
        }, 60000);
        if (_ticker.unref) _ticker.unref();
    }

    // ── latest: the one-liner ───────────────────────────────────
    /** Render the newest entry into `node` (exported for tests). A node that is an <a> keeps its own href. */
    function renderLatest(node, data, opts) {
        const o = opts || {};
        const e = data && Array.isArray(data.entries) ? data.entries[0] : null;
        node.textContent = '';
        if (!e || !e.subject) { node.hidden = true; return node; }
        node.classList.add('ov-shipped-latest');
        const href = localHref(o.href) || (node.tagName === 'A' && node.getAttribute('href')) || null;
        if (node.tagName === 'A' && href) node.setAttribute('href', href);
        node.appendChild(rocket());
        node.appendChild(document.createTextNode(o.service ? ' shipped ' : ` ${siteName(e.service)} shipped `));
        node.appendChild(timeEl(e.deployed_at));
        node.appendChild(document.createTextNode(': '));
        node.appendChild(el('b', {}, e.subject));
        node.title = e.subject;
        node.hidden = false;
        if (node.style && node.style.display === 'none') node.style.display = '';
        tick();
        return node;
    }
    async function latest(target, opts) {
        const o = { ...(opts || {}) };
        const node = typeof target === 'string' ? document.querySelector(target) : target;
        if (!node) return null;
        o.service = resolveService(o.service);
        style();
        return renderLatest(node, await feed({ service: o.service, limit: 1, api: o.api }), o);
    }

    // ── list: the newest few ────────────────────────────────────
    /** Render a changelog answer into `node` (exported for tests). */
    function render(node, data, opts) {
        const o = opts || {};
        const entries = (data && Array.isArray(data.entries) ? data.entries : []).slice(0, clamp(o.limit, 1, 20, 5));
        node.textContent = '';
        if (!entries.length) { node.hidden = true; return node; }
        node.classList.add('ov-shipped');
        if (o.title !== '') node.appendChild(el('h3', {}, o.title || 'Recently shipped'));
        const ul = el('ul');
        const showSite = o.showSite != null ? o.showSite : !o.service;
        for (const e of entries) {
            const li = el('li');
            if (showSite) li.appendChild(el('span', { class: 'ov-shipped-site' }, siteName(e.service)));
            const href = safeUrl(e.url);
            const a = el(href ? 'a' : 'span', href ? { href, class: `ov-shipped-subject${e.major ? ' ov-shipped-major' : ''}`, rel: 'noopener', target: '_blank', title: e.subject } : { class: 'ov-shipped-subject' }, e.subject);
            li.appendChild(a);
            if (e.deployed_at) li.appendChild(timeEl(e.deployed_at));
            ul.appendChild(li);
        }
        node.appendChild(ul);
        const links = el('div', { class: 'ov-shipped-links' });
        const more = localHref(o.more);
        if (more) links.appendChild(el('a', { href: more }, 'All updates →'));
        const post = data.latest_post && safeUrl(data.latest_post.url) ? data.latest_post : null;
        if (post) links.appendChild(el('a', { class: 'ov-shipped-notes', href: post.url }, `Patch notes: ${String(post.title || 'latest').replace(/^Patch notes:\s*/, '')} →`));
        if (links.childNodes.length) node.appendChild(links);
        node.hidden = false;
        tick();
        return node;
    }
    async function list(target, opts) {
        const o = { ...(opts || {}) };
        const node = typeof target === 'string' ? document.querySelector(target) : target;
        if (!node) return null;
        o.service = resolveService(o.service);
        style();
        return render(node, await feed({ service: o.service, limit: clamp(o.limit, 1, 20, 5), api: o.api }), o);
    }

    // ── log: the updates page ───────────────────────────────────
    function dayOf(iso) { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
    function entryRow(e, showSite) {
        const row = el('div', { class: 'ov-shipped-entry' });
        const href = safeUrl(e.url);
        row.appendChild(el(href ? 'a' : 'span', href ? { class: 'ov-shipped-hash', href, target: '_blank', rel: 'noopener', title: 'The change on GitHub' } : { class: 'ov-shipped-hash' }, e.short || String(e.sha || '').slice(0, 7)));
        if (showSite) row.appendChild(el('span', { class: 'ov-shipped-site' }, siteName(e.service)));
        row.appendChild(el('span', { class: `ov-shipped-text${e.major ? ' ov-shipped-major' : ''}` }, e.subject));
        const meta = el('span', { class: 'ov-shipped-meta' });
        const time = new Date(e.deployed_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        meta.textContent = `${e.author ? `${e.author} · ` : ''}${time}`;
        row.appendChild(meta);
        return row;
    }
    /** Append entries under day headings, continuing the last day already shown (exported for tests). */
    function appendDays(box, entries, showSite) {
        let day = box.lastElementChild && box.lastElementChild.classList.contains('ov-shipped-day') ? box.lastElementChild : null;
        for (const e of entries) {
            const d = dayOf(e.deployed_at);
            if (!day || day.getAttribute('data-day') !== d) {
                day = el('section', { class: 'ov-shipped-day', 'data-day': d });
                day.appendChild(el('h3', {}, d));
                day.appendChild(el('div', { class: 'ov-shipped-entries' }));
                box.appendChild(day);
            }
            day.lastElementChild.appendChild(entryRow(e, showSite));
        }
    }
    async function log(target, opts) {
        const o = { ...(opts || {}) };
        const node = typeof target === 'string' ? document.querySelector(target) : target;
        if (!node) return null;
        style();
        const own = resolveService(o.service);
        const pageSize = clamp(o.limit, 10, 100, 50);
        const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
        // ?site= picks the site on the whole-network page (and "all" on a site's own page).
        let current = own;
        const asked = params.get('site');
        if (asked === 'all') current = null;
        else if (asked && serviceFor(asked)) current = serviceFor(asked);

        node.textContent = '';
        node.classList.add('ov-shipped-log');
        const bar = el('div', { class: 'ov-shipped-bar', role: 'group', 'aria-label': 'Which site' });
        const posts = el('aside', { class: 'ov-shipped-posts', hidden: '' });
        const days = el('div', { class: 'ov-shipped-days' });
        days.style.cssText = 'display:flex;flex-direction:column;gap:24px;min-width:0';
        const more = el('button', { type: 'button', class: 'ov-shipped-more', hidden: '' }, 'Load more');
        node.append(bar, posts, days, more);
        let next = null;
        let seq = 0;

        function setUrl(svc) {
            if (o.syncUrl === false || typeof history === 'undefined' || !history.replaceState) return;
            const u = new URL(location.href);
            if (own ? svc === own : !svc) u.searchParams.delete('site'); else u.searchParams.set('site', svc || 'all');
            history.replaceState(history.state, '', u.pathname + u.search + u.hash);
        }
        function chip(label, svc) {
            const b = el('button', { type: 'button', class: 'ov-shipped-chip', 'aria-pressed': String((svc || null) === (current || null)) }, label);
            b.addEventListener('click', () => { current = svc || null; setUrl(current); load(true); });
            return b;
        }
        function drawBar(sites) {
            bar.textContent = '';
            if (own) { bar.append(chip(siteName(own), own), chip('All of OpenVibe', null)); return; }
            bar.append(chip('Everything', null));
            for (const s of (sites || []).slice(0, 30)) bar.appendChild(chip(siteName(s.service), s.service));
        }
        function drawPosts(list) {
            posts.textContent = '';
            const good = (list || []).filter((p) => safeUrl(p.url)).slice(0, 5);
            if (!good.length || o.posts === false) { posts.hidden = true; return; }
            posts.appendChild(el('h3', {}, 'Patch notes'));
            const ul = el('ul');
            for (const p of good) {
                const li = el('li');
                li.appendChild(el('a', { href: p.url }, p.title || 'Patch notes'));
                if (p.published_at) li.appendChild(el('small', {}, `${new Date(p.published_at).toLocaleDateString()}${p.entries ? ` · ${p.entries} changes` : ''}`));
                ul.appendChild(li);
            }
            posts.appendChild(ul);
            posts.hidden = false;
        }
        let sitesSeen = null;
        async function load(reset) {
            const mine = ++seq;
            if (reset) {
                next = null;
                days.textContent = '';
                days.appendChild(el('p', { class: 'ov-shipped-empty' }, 'Loading…'));
                for (const b of bar.querySelectorAll('.ov-shipped-chip')) b.setAttribute('aria-pressed', 'false');
            }
            more.disabled = true;
            const data = await feed({ service: current, limit: pageSize, before: reset ? null : next, api: o.api });
            if (mine !== seq) return;
            if (reset) {
                days.textContent = '';
                if (data && data.sites) sitesSeen = data.sites;
                if (!own && !sitesSeen) {
                    const all = await feed({ service: null, limit: 1, api: o.api });
                    sitesSeen = all && all.sites;
                }
                drawBar(sitesSeen);
                for (const b of bar.querySelectorAll('.ov-shipped-chip')) if (b.textContent === (current ? siteName(current) : (own ? 'All of OpenVibe' : 'Everything'))) b.setAttribute('aria-pressed', 'true');
                drawPosts(data && data.posts);
            }
            if (!data) {
                if (reset) days.appendChild(el('p', { class: 'ov-shipped-empty' }, 'The update history could not be loaded just now.'));
                more.hidden = true;
                return;
            }
            const entries = Array.isArray(data.entries) ? data.entries : [];
            if (reset && !entries.length) days.appendChild(el('p', { class: 'ov-shipped-empty' }, 'Nothing has shipped here yet.'));
            appendDays(days, entries, !current);
            next = data.next || null;
            more.hidden = !next;
            more.disabled = false;
            tick();
        }
        more.addEventListener('click', () => load(false));
        await load(true);
        return node;
    }

    // ── markup ──────────────────────────────────────────────────
    const VIEWS = { latest, list, log };
    /** Mount every [data-ov-shipped] element under `root` once. */
    function scan(rootEl) {
        const r = rootEl || (typeof document !== 'undefined' ? document : null);
        if (!r || !r.querySelectorAll) return [];
        const out = [];
        for (const n of r.querySelectorAll('[data-ov-shipped]')) {
            if (n.hasAttribute('data-ov-shipped-mounted')) continue;
            const view = VIEWS[n.getAttribute('data-ov-shipped')];
            if (!view) continue;
            n.setAttribute('data-ov-shipped-mounted', '');
            const d = n.dataset || {};
            out.push(view(n, { service: d.service || null, limit: d.limit, title: d.title, href: d.href, more: d.more, api: d.api, posts: d.posts === 'off' ? false : undefined }).catch(() => null));
        }
        return out;
    }

    return { latest, list, mount: list, log, scan, render, renderLatest, appendDays, serviceFor, ago, API, SITE_NAMES };
}));
