/*!
 * openvibe-shared/shipped — "Recently shipped" for any OpenVibe site: what was deployed, newest first,
 * from the network changelog OpenVibe.Blog keeps (GET https://openvibe.blog/api/v1/changelog), with a
 * link to the latest "Patch notes" post that gathers each batch of changes.
 *
 *   <div id="shipped"></div>
 *   <script src="https://openvibe.network/shared/shipped.js" defer></script>
 *   OpenVibeShipped.mount('#shipped', { service: 'live', limit: 5 });   // one site
 *   OpenVibeShipped.mount('#shipped', { limit: 8 });                    // the whole network
 *
 * Options: service (a registry id; omitted = every site), limit (1-20), title (heading text; '' for
 * none), api (the changelog URL, for tests), showSite (label each line with its site; default when no
 * service). Builds DOM nodes only (commit text is never parsed as HTML); a failed fetch leaves the
 * element empty and hidden, never an error on the page. Styles follow the theme's CSS variables.
 * A classic script: no modules, no dependencies.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.OpenVibeShipped = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const API = 'https://openvibe.blog/api/v1/changelog';
    const SITE_NAMES = { live: 'Live', network: 'Network', tools: 'Tools', media: 'Media', community: 'Community', chat: 'Chat', games: 'Games', blog: 'Blog', wiki: 'Wiki', news: 'News', reviews: 'Reviews', deals: 'Deals', coupons: 'Coupons', trade: 'Trade', codes: 'Codes', host: 'Host', ai: 'AI', search: 'Search', sources: 'Sources', events: 'Events', billing: 'Billing', tips: 'Tips', vip: 'VIP', openre: 'OpenRe', sites: 'Sites' };
    const STYLE_ID = 'ov-shipped-style';
    const CSS = '.ov-shipped{font-size:.92rem}.ov-shipped h3{font-size:1rem;margin:0 0 .5rem;display:flex;gap:.4rem;align-items:center}'
        + '.ov-shipped ul{list-style:none;margin:0;padding:0;display:grid;gap:.35rem}.ov-shipped li{display:flex;gap:.5rem;align-items:baseline;min-width:0}'
        + '.ov-shipped .ov-shipped-site{flex:none;font-size:.72rem;font-weight:700;padding:.05rem .45rem;border-radius:999px;background:color-mix(in srgb,var(--accent,#3b82f6) 16%,transparent);color:var(--accent-light,var(--accent,#3b82f6))}'
        + '.ov-shipped a.ov-shipped-subject{color:var(--text,inherit);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}'
        + '.ov-shipped a.ov-shipped-subject:hover{text-decoration:underline}.ov-shipped time{flex:none;margin-left:auto;font-size:.75rem;opacity:.7}'
        + '.ov-shipped .ov-shipped-major{font-weight:600}.ov-shipped .ov-shipped-notes{display:inline-block;margin-top:.6rem;font-weight:600;color:var(--accent-light,var(--accent,#3b82f6))}';

    function ago(iso) {
        const t = Date.parse(iso);
        if (!t) return '';
        const s = Math.max(0, (Date.now() - t) / 1000);
        if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
        if (s < 86400) return `${Math.round(s / 3600)}h ago`;
        return `${Math.round(s / 86400)}d ago`;
    }
    function el(tag, attrs, text) {
        const n = document.createElement(tag);
        for (const k of Object.keys(attrs || {})) n.setAttribute(k, attrs[k]);
        if (text != null) n.textContent = text;
        return n;
    }
    function style() {
        if (document.getElementById(STYLE_ID)) return;
        const s = el('style', { id: STYLE_ID });
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
    }
    function safeUrl(u) { return /^https:\/\//.test(String(u || '')) ? String(u) : null; }

    /** Render a changelog answer into `node` (exported for tests). */
    function render(node, data, opts) {
        const o = opts || {};
        const entries = (data && Array.isArray(data.entries) ? data.entries : []).slice(0, Math.min(Math.max(o.limit || 5, 1), 20));
        node.textContent = '';
        if (!entries.length) { node.hidden = true; return node; }
        node.classList.add('ov-shipped');
        if (o.title !== '') node.appendChild(el('h3', {}, o.title || 'Recently shipped'));
        const ul = el('ul');
        const showSite = o.showSite != null ? o.showSite : !o.service;
        for (const e of entries) {
            const li = el('li');
            if (showSite) li.appendChild(el('span', { class: 'ov-shipped-site' }, SITE_NAMES[e.service] || e.service));
            const href = safeUrl(e.url);
            const a = el(href ? 'a' : 'span', href ? { href, class: `ov-shipped-subject${e.major ? ' ov-shipped-major' : ''}`, rel: 'noopener', target: '_blank', title: e.subject } : { class: 'ov-shipped-subject' }, e.subject);
            li.appendChild(a);
            if (e.deployed_at) li.appendChild(el('time', { datetime: e.deployed_at }, ago(e.deployed_at)));
            ul.appendChild(li);
        }
        node.appendChild(ul);
        const post = data.latest_post && safeUrl(data.latest_post.url) ? data.latest_post : null;
        if (post) node.appendChild(el('a', { class: 'ov-shipped-notes', href: post.url }, `Read the patch notes: ${post.title || 'latest'} →`));
        node.hidden = false;
        return node;
    }

    /** Fetch and render into a selector or element. Resolves the element (hidden when there is nothing). */
    async function mount(target, opts) {
        const o = opts || {};
        const node = typeof target === 'string' ? document.querySelector(target) : target;
        if (!node) return null;
        style();
        const url = new URL(o.api || API);
        if (o.service) url.searchParams.set('service', String(o.service));
        url.searchParams.set('limit', String(Math.min(Math.max(o.limit || 5, 1), 20)));
        try {
            const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, credentials: 'omit' });
            if (!res.ok) { node.hidden = true; return node; }
            return render(node, await res.json(), o);
        } catch (_) { node.hidden = true; return node; }
    }

    return { mount, render, API };
}));
