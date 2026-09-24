'use strict';
// openvibe-shared/chrome-ssr — the parts of the shared chrome that can be baked into HTML on the server.
//   footer(cfg)        the full shared footer (HTML + CSS); the browser's footer.js renders into the same element
//   noscriptNav(site)  a plain navigation bar inside <noscript>: the JavaScript navbar cannot exist without
//                      scripts, so visitors who block them (and text browsers) still get the brand and the network
//   shipped(opts)      a home page's "shipped" block: the "🚀 shipped X ago" pill and the recent changes,
//                      filled by shipped.js; without JavaScript, a link to the update log
//   updatesBody(opts)  the body of a site's /updates page (the full log; openvibe.network's server-rendered
//                      log is the no-JavaScript fallback)
//   shippedScript()    the <script> tag for shipped.js (the footer loads it lazily too; a page that shows the
//                      log should load it itself)
const footerModule = require('./footer');

const SITES = [['Live', 'https://openvibe.live/'], ['Tools', 'https://openvibe.tools/'], ['Community', 'https://openvibe.community/'], ['Games', 'https://openvibe.games/'], ['Media', 'https://openvibe.media/'], ['Network', 'https://openvibe.network/']];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function noscriptNav({ name, home = '/', links = [] } = {}) {
    const own = links.map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
    const net = SITES.filter(([n]) => !String(name || '').endsWith('.' + n)).map(([n, u]) => `<a href="${u}">${n}</a>`).join('');
    return `<noscript><nav aria-label="Site" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,.1);font:500 14px/1.4 system-ui,sans-serif"><a href="${esc(home)}" style="font-weight:700;color:inherit;text-decoration:none">${esc(name || 'OpenVibe')}</a>${own}<span style="flex:1"></span>${net}</nav></noscript>`;
}

const NETWORK = 'https://openvibe.network';
const SERVICE_RE = /^[a-z][a-z0-9-]{1,39}$/;
const svc = (s) => (SERVICE_RE.test(String(s || '')) ? String(s) : '');

function shipped({ service, updates = '/updates', title = null, limit = 5 } = {}) {
    const id = svc(service);
    const n = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);
    return `<section class="ov-shipped-home" aria-label="What shipped">`
        + `<a data-ov-shipped="latest" data-service="${esc(id)}" href="${esc(updates)}" hidden></a>`
        + `<div data-ov-shipped="list" data-service="${esc(id)}" data-limit="${n}" data-more="${esc(updates)}"${title ? ` data-title="${esc(title)}"` : ''} hidden></div>`
        + `<noscript><p><a href="${esc(updates)}">What shipped recently</a></p></noscript>`
        + `</section>`;
}

function updatesBody({ service, siteName = null, base = NETWORK } = {}) {
    const id = svc(service);
    const name = siteName || (id ? `OpenVibe.${id.charAt(0).toUpperCase()}${id.slice(1)}` : 'OpenVibe');
    const network = `${String(base).replace(/\/+$/, '')}/updates${id ? `?site=${encodeURIComponent(id)}` : ''}`;
    return `<section class="ov-updates">`
        + `<h1>What shipped on ${esc(name)}</h1>`
        + `<p class="ov-updates-lede">Every change deployed to ${esc(name)}, newest first. Each line is a commit from the OpenVibers repositories, linked to the change itself; batches become <a href="https://openvibe.blog/@openvibe">Patch notes on openvibe.blog</a>. Switch to <a href="${esc(String(base).replace(/\/+$/, ''))}/updates">the whole network</a>.</p>`
        + `<div data-ov-shipped="log" data-service="${esc(id)}" data-limit="50"><noscript><p>The update log needs JavaScript here; <a href="${esc(network)}">the same log on openvibe.network</a> works without it.</p></noscript></div>`
        + `</section>`;
}

function shippedScript({ base = NETWORK } = {}) {
    return `<script src="${esc(String(base).replace(/\/+$/, ''))}/shared/shipped.js" defer></script>`;
}

module.exports = { footer: (cfg) => footerModule.ssr(cfg), noscriptNav, shipped, updatesBody, shippedScript };
