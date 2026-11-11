'use strict';

const seo = require('./seo');
const catalog = require('./crawl-sites.json');
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const absolute = (url, base) => new URL(url, base).href;

/** Static navigation, network links and discovery metadata for HTML sent before JavaScript runs. */
function render({ name, service, url, description = '', links, pages = [], searchUrl } = {}) {
    if (!name || !url) throw new TypeError('crawlable.render requires name and url');
    const base = new URL(url).origin;
    const ownLinks = Array.isArray(links) ? links : [];
    const ownItems = ownLinks.flatMap((item) => Array.isArray(item.items) ? item.items : [item])
        .filter((item) => item && (item.href || item.url) && (item.label || item.name || item.title))
        .map((item) => ({ label: item.label || item.name || item.title, href: item.href || item.url }));
    const nav = `<nav aria-label="${esc(name)}"><ul><li><a href="/">Home</a></li>${ownItems.filter((item) => item.href !== '/').map((item) => `<li><a href="${esc(item.href)}">${esc(item.label)}</a></li>`).join('')}</ul></nav>`;
    const network = catalog.sites.filter((site) => site.id !== service);
    const footer = `<nav aria-label="OpenVibe">${catalog.groups.map((group) => {
        const sites = network.filter((site) => site.group === group.id);
        return sites.length ? `<section><h2>${esc(group.name)}</h2><ul>${sites.map((site) => `<li><a href="${esc(site.url)}">${esc(site.name)}</a> — ${esc(site.description)}</li>`).join('')}</ul></section>` : '';
    }).join('')}</nav>`;
    const sameAs = [...new Set(catalog.sites.map((site) => new URL(site.url).origin))];
    const jsonLd = [seo.jsonLd.organization({ sameAs }), seo.jsonLd.website({ name, url: base + '/', description, searchUrl })];
    const head = jsonLd.map((item) => `<script type="application/ld+json">${JSON.stringify(item).replace(/</g, '\\u003c')}</script>`).join('\n');
    const llmsTxt = seo.llmsTxt({ name, summary: description || name, sections: [
        { title: 'Main pages', links: [{ title: 'Home', url: base + '/' }, ...pages.map((page) => ({ title: page.title || page.name, url: absolute(page.url || page.href, base) }))] },
        ...catalog.groups.map((group) => ({ title: group.name, links: network.filter((site) => site.group === group.id).map((site) => ({ title: site.name, url: site.url, note: site.description })) })).filter((section) => section.links.length),
    ] });
    return { nav, footer, head, jsonLd, llmsTxt };
}

module.exports = { render, catalog };
