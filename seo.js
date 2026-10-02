'use strict';
/**
 * openvibe-shared/seo.js — one SEO toolkit for every OpenVibe site (Node, no dependencies).
 *
 *   const seo = require('openvibe-shared/seo');
 *   seo.headTags({ title, description, canonical, image, jsonLd: [seo.jsonLd.website({...})] })
 *   seo.sitemapXml([{ loc, lastmod }])   seo.robotsTxt({ sitemaps })   seo.llmsTxt({...})
 *
 * Rules it encodes so pages do not have to remember them: one canonical per page, titles cut at
 * 60 characters on a word, descriptions at 160, og/twitter mirrored from the same values, JSON-LD
 * serialised safely (no `</script>` break-outs), sitemaps with absolute URLs only, robots.txt that
 * welcomes search and AI crawlers by default and always names the sitemap, and an /llms.txt so
 * language-model crawlers get a clean map of the site.
 */

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const xml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** Cut on a word boundary with an ellipsis; never mid-word, never longer than `max`. */
function clip(text, max) {
    const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max - 1);
    const at = cut.lastIndexOf(' ');
    return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-–—]+$/, '') + '…';
}

function absolute(url, base) {
    if (!url) return '';
    try { return new URL(url, base || undefined).toString(); } catch { return String(url); }
}

/** JSON-LD script tag; `<` is escaped so content can never close the script element. */
function jsonLdTag(obj) {
    return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

/**
 * The whole <head> SEO block as an HTML string.
 * @param {object} o title, description, canonical (absolute), image, imageAlt, type ('website'),
 *   siteName, robots ('index, follow'), locale ('en_US'), keywords (array|string), author,
 *   themeColor, twitterSite, alternates [{ hreflang, href }], prev, next, jsonLd (array|object),
 *   titleSuffix (appended when it fits), noTitle (skip <title> when the page has its own)
 */
function headTags(o = {}) {
    let title = String(o.title || o.siteName || 'OpenVibe');
    if (o.titleSuffix && (title + o.titleSuffix).length <= 60) title += o.titleSuffix;
    title = clip(title, 60);
    const description = clip(o.description || '', 160);
    const canonical = absolute(o.canonical);
    const image = o.image ? absolute(o.image, canonical) : '';
    const keywords = Array.isArray(o.keywords) ? o.keywords.join(', ') : (o.keywords || '');
    const robots = o.robots || 'index, follow, max-image-preview:large, max-snippet:-1';
    const out = [];
    if (!o.noTitle) out.push(`<title>${esc(title)}</title>`);
    if (description) out.push(`<meta name="description" content="${esc(description)}">`);
    if (keywords) out.push(`<meta name="keywords" content="${esc(keywords)}">`);
    out.push(`<meta name="robots" content="${esc(robots)}">`);
    if (o.author) out.push(`<meta name="author" content="${esc(o.author)}">`);
    if (o.themeColor) out.push(`<meta name="theme-color" content="${esc(o.themeColor)}">`);
    if (canonical) out.push(`<link rel="canonical" href="${esc(canonical)}">`);
    for (const a of o.alternates || []) if (a && a.href) out.push(`<link rel="alternate" hreflang="${esc(a.hreflang || 'x-default')}" href="${esc(absolute(a.href))}">`);
    if (o.prev) out.push(`<link rel="prev" href="${esc(absolute(o.prev))}">`);
    if (o.next) out.push(`<link rel="next" href="${esc(absolute(o.next))}">`);
    out.push(`<meta property="og:type" content="${esc(o.type || 'website')}">`);
    if (o.siteName) out.push(`<meta property="og:site_name" content="${esc(o.siteName)}">`);
    out.push(`<meta property="og:title" content="${esc(title)}">`);
    if (description) out.push(`<meta property="og:description" content="${esc(description)}">`);
    if (canonical) out.push(`<meta property="og:url" content="${esc(canonical)}">`);
    out.push(`<meta property="og:locale" content="${esc(o.locale || 'en_US')}">`);
    if (image) {
        out.push(`<meta property="og:image" content="${esc(image)}">`);
        if (o.imageAlt) out.push(`<meta property="og:image:alt" content="${esc(o.imageAlt)}">`);
    }
    out.push(`<meta name="twitter:card" content="${image && o.largeImage !== false ? 'summary_large_image' : 'summary'}">`);
    if (o.twitterSite) out.push(`<meta name="twitter:site" content="${esc(o.twitterSite)}">`);
    out.push(`<meta name="twitter:title" content="${esc(title)}">`);
    if (description) out.push(`<meta name="twitter:description" content="${esc(description)}">`);
    if (image) out.push(`<meta name="twitter:image" content="${esc(image)}">`);
    const ld = o.jsonLd ? (Array.isArray(o.jsonLd) ? o.jsonLd : [o.jsonLd]) : [];
    for (const item of ld) if (item) out.push(jsonLdTag(item));
    return out.join('\n');
}

const ORG = { '@type': 'Organization', '@id': 'https://openvibe.network/#org', name: 'OpenVibe', url: 'https://openvibe.network/', logo: 'https://openvibe.network/assets/logo-512.png', sameAs: ['https://github.com/OpenVibers', 'https://discord.gg/M6MuRUaeJj'] };

const jsonLd = {
    organization(extra = {}) { return { '@context': 'https://schema.org', ...ORG, ...extra }; },
    /** WebSite; `searchUrl` with {q} adds the sitelinks SearchAction. */
    website({ name, url, description, searchUrl, inLanguage = 'en' } = {}) {
        const o = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${url}#site`, name, url, description, inLanguage, publisher: { '@id': ORG['@id'] } };
        if (searchUrl) o.potentialAction = { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: searchUrl.replace('{q}', '{search_term_string}') }, 'query-input': 'required name=search_term_string' };
        return o;
    },
    webPage({ name, url, description, type = 'WebPage', siteUrl, dateModified } = {}) {
        return { '@context': 'https://schema.org', '@type': type, '@id': `${url}#page`, name, url, description, ...(siteUrl ? { isPartOf: { '@id': `${siteUrl}#site` } } : {}), ...(dateModified ? { dateModified } : {}) };
    },
    /** A web tool. No price/offer fields: the platform makes no cost claims. */
    softwareApp({ name, url, description, category = 'UtilitiesApplication', keywords, image, os = 'Any (web browser)' } = {}) {
        return { '@context': 'https://schema.org', '@type': 'WebApplication', name, url, description, applicationCategory: category, operatingSystem: os, browserRequirements: 'Requires a modern web browser', ...(keywords ? { keywords: Array.isArray(keywords) ? keywords.join(', ') : keywords } : {}), ...(image ? { image } : {}), publisher: { '@id': ORG['@id'] } };
    },
    breadcrumbs(items = []) {
        return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })) };
    },
    itemList(name, items = [], { url } = {}) {
        return { '@context': 'https://schema.org', '@type': 'ItemList', name, ...(url ? { url } : {}), numberOfItems: items.length, itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url, ...(it.description ? { description: it.description } : {}) })) };
    },
    faq(pairs = []) {
        return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: pairs.map((p) => ({ '@type': 'Question', name: p.q, acceptedAnswer: { '@type': 'Answer', text: p.a } })) };
    },
    howTo({ name, description, steps = [] } = {}) {
        return { '@context': 'https://schema.org', '@type': 'HowTo', name, description, step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name || `Step ${i + 1}`, text: s.text })) };
    },
    article({ headline, url, description, author, datePublished, dateModified, image } = {}) {
        return { '@context': 'https://schema.org', '@type': 'Article', headline: clip(headline, 110), url, description, ...(author ? { author: { '@type': 'Person', name: author } } : {}), ...(datePublished ? { datePublished } : {}), ...(dateModified ? { dateModified } : {}), ...(image ? { image } : {}), publisher: { '@id': ORG['@id'] } };
    },
    video({ name, url, description, thumbnailUrl, uploadDate, duration, contentUrl, embedUrl } = {}) {
        return { '@context': 'https://schema.org', '@type': 'VideoObject', name, url, description: description || name, thumbnailUrl, uploadDate, ...(duration ? { duration } : {}), ...(contentUrl ? { contentUrl } : {}), ...(embedUrl ? { embedUrl } : {}) };
    },
    videoObject(options = {}) { return jsonLd.video(options); },
    product({ name, url, description, image, sku, brand, offers, aggregateRating, review } = {}) {
        return { '@context': 'https://schema.org', '@type': 'Product', name, url, description,
            ...(image ? { image } : {}), ...(sku ? { sku } : {}),
            ...(brand ? { brand: typeof brand === 'string' ? { '@type': 'Brand', name: brand } : brand } : {}),
            ...(offers ? { offers } : {}), ...(aggregateRating ? { aggregateRating } : {}), ...(review ? { review } : {}) };
    },
    review({ name, url, reviewBody, author, datePublished, itemReviewed, rating, bestRating = 5, worstRating = 1 } = {}) {
        return { '@context': 'https://schema.org', '@type': 'Review', name, url, reviewBody,
            ...(author ? { author: typeof author === 'string' ? { '@type': 'Person', name: author } : author } : {}),
            ...(datePublished ? { datePublished } : {}), ...(itemReviewed ? { itemReviewed } : {}),
            ...(rating != null ? { reviewRating: { '@type': 'Rating', ratingValue: rating, bestRating, worstRating } } : {}) };
    },
    aggregateRating({ ratingValue, ratingCount, reviewCount, bestRating = 5, worstRating = 1 } = {}) {
        return { '@context': 'https://schema.org', '@type': 'AggregateRating', ratingValue,
            ...(ratingCount != null ? { ratingCount } : {}), ...(reviewCount != null ? { reviewCount } : {}), bestRating, worstRating };
    },
    imageGallery(images = []) {
        return images.map((image) => {
            const item = typeof image === 'string' ? { url: image } : image;
            return { '@context': 'https://schema.org', '@type': 'ImageObject', url: item.url,
                ...(item.name ? { name: item.name } : {}), ...(item.caption ? { caption: item.caption } : {}),
                ...(item.width != null ? { width: item.width } : {}), ...(item.height != null ? { height: item.height } : {}) };
        });
    },
};

/** urls: [{ loc, lastmod?, changefreq?, priority?, alternates?: [{hreflang, href}], images?: [url] }] — absolute http(s) only. */
function sitemapXml(urls = []) {
    const rows = urls.filter((u) => u && /^https?:\/\//i.test(u.loc)).map((u) => {
        const parts = [`<loc>${xml(u.loc)}</loc>`];
        if (u.lastmod) parts.push(`<lastmod>${xml(String(u.lastmod).slice(0, 10))}</lastmod>`);
        if (u.changefreq) parts.push(`<changefreq>${xml(u.changefreq)}</changefreq>`);
        if (u.priority != null) parts.push(`<priority>${Number(u.priority).toFixed(1)}</priority>`);
        for (const a of u.alternates || []) parts.push(`<xhtml:link rel="alternate" hreflang="${xml(a.hreflang)}" href="${xml(a.href)}"/>`);
        for (const img of u.images || []) parts.push(`<image:image><image:loc>${xml(img)}</image:loc></image:image>`);
        return `  <url>${parts.join('')}</url>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${rows.join('\n')}\n</urlset>\n`;
}

function sitemapIndexXml(maps = []) {
    const rows = maps.filter((m) => m && m.loc).map((m) => `  <sitemap><loc>${xml(m.loc)}</loc>${m.lastmod ? `<lastmod>${xml(String(m.lastmod).slice(0, 10))}</lastmod>` : ''}</sitemap>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</sitemapindex>\n`;
}

// Crawlers that build search and AI indexes — welcomed by name so a generic Disallow never hits them.
const AI_AND_SEARCH_BOTS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'PerplexityBot', 'CCBot', 'Google-Extended', 'Amazonbot', 'meta-externalagent', 'YouBot', 'Bytespider'];

function robotsTxt({ sitemaps = [], disallow = [], allow = ['/'], allowAI = true, block = [], crawlDelay } = {}) {
    const lines = ['User-agent: *'];
    for (const a of allow) lines.push(`Allow: ${a}`);
    for (const d of disallow) lines.push(`Disallow: ${d}`);
    if (crawlDelay) lines.push(`Crawl-delay: ${crawlDelay}`);
    if (allowAI) {
        lines.push('');
        for (const bot of AI_AND_SEARCH_BOTS) lines.push(`User-agent: ${bot}`);
        lines.push('Allow: /');
        for (const d of disallow) lines.push(`Disallow: ${d}`);
    }
    for (const b of block) { lines.push('', `User-agent: ${b}`, 'Disallow: /'); }
    lines.push('');
    for (const s of sitemaps) lines.push(`Sitemap: ${s}`);
    return lines.join('\n') + '\n';
}

/** /llms.txt (llmstxt.org): a markdown map of the site for language-model crawlers. */
function llmsTxt({ name, summary, details, sections = [] } = {}) {
    const out = [`# ${name}`, '', `> ${String(summary || '').replace(/\s+/g, ' ').trim()}`, ''];
    if (details) out.push(String(details).trim(), '');
    for (const sec of sections) {
        if (!sec || !sec.links || !sec.links.length) continue;
        out.push(`## ${sec.title}`, '');
        for (const l of sec.links) out.push(`- [${l.title}](${l.url})${l.note ? `: ${String(l.note).replace(/\s+/g, ' ').trim()}` : ''}`);
        out.push('');
    }
    return out.join('\n');
}

/** Preserve full-text paragraphs while enforcing a character limit, including the ellipsis. */
function limitText(value, max) {
    const text = String(value == null ? '' : value);
    if (max == null || !Number.isFinite(max)) return text;
    const size = Math.max(0, Math.floor(max));
    if (text.length <= size) return text;
    return size ? text.slice(0, size - 1).trimEnd() + '…' : '';
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Plain text from HTML: scripts, styles and comments dropped, block ends kept as line breaks. */
function htmlText(html) {
    return String(html == null ? '' : html)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<br\s*\/?>|<\/(li|dt|dd|tr)\s*>/gi, '\n')
        .replace(/<\/(p|div|section|article|header|footer|main|aside|nav|ul|ol|dl|table|h[1-6]|blockquote|pre|figure)\s*>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
            if (e[0] !== '#') return ENTITIES[e.toLowerCase()] || m;
            const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
        })
        .split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** One /llms-full.txt page: `### title`, `URL: …` and its full text (`text`, or `html` stripped to text). */
function llmsPage(page, base) {
    const url = absolute(page.url, base);
    const text = page.text != null ? String(page.text).replace(/\r\n?/g, '\n').trim() : htmlText(page.html);
    return `\n### ${page.title || ''}\n${url ? `\nURL: ${url}\n` : ''}${text ? `\n${text}\n` : ''}`;
}

/**
 * /llms-full.txt: the llms.txt header followed by full, plain-text sections. A section with
 * `pages: [{ title, url, text | html }]` renders `## title` then every page in input order, never
 * clipped; `maxBytes` stops before the first page that would pass it and ends with a
 * `(truncated: N more pages at <base>/llms.txt)` line. A section with `url`/`body` renders as in 2.4.0.
 */
function llmsFull({ site, summary, base, sections = [], maxChars, maxTotal, maxBytes } = {}) {
    const name = site && typeof site === 'object' ? site.name || site.title : site;
    base = base || (site && typeof site === 'object' ? site.url : site);
    let out = llmsTxt({ name, summary });
    let left = 0;
    for (const section of sections) {
        if (!section) continue;
        if (Array.isArray(section.pages)) {
            let heading = `\n## ${section.title || ''}\n`;
            for (const page of section.pages) {
                if (!page) continue;
                const chunk = heading + llmsPage(page, base);
                if (left || (maxBytes != null && Buffer.byteLength(out + chunk) > maxBytes)) { left++; continue; }
                out += chunk;
                heading = '';
            }
            continue;
        }
        if (left) continue;
        const url = absolute(section.url, base);
        const body = limitText(String(section.body == null ? '' : section.body).trim(), section.maxChars == null ? maxChars : section.maxChars);
        out += `\n## ${section.title || ''}\n\n${url}\n\n${body}\n`;
    }
    if (left) out += `\n(truncated: ${left} more page${left === 1 ? '' : 's'} at ${absolute('/llms.txt', base)})\n`;
    return limitText(out, maxTotal);
}

/**
 * AI-readable page summary. As a string (`${seo.pageSummary(…)}`, `String(…)`) it is the HTML:
 * `<meta name="ai-summary">` (clipped to 160 like the description), a WebPage JSON-LD tag and, when
 * `facts` (strings) are given, a `<noscript><section data-ai-summary>` block. `.head` and `.body` hold
 * the head part and the noscript block on their own; `.meta`, `.jsonLd` and `.html` are the 2.4.0 values.
 */
function pageSummary({ title, summary, facts = [], url, updated } = {}) {
    const pageUrl = absolute(url);
    const text = String(summary == null ? '' : summary);
    const jsonLd = { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: pageUrl,
        abstract: text, ...(updated ? { dateModified: updated } : {}) };
    const rows = facts.filter(Array.isArray).map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join('');
    const html = `<section data-ov-summary hidden><h2>${esc(title)}</h2><p>${esc(text)}</p>${rows ? `<dl>${rows}</dl>` : ''}${pageUrl ? `<a href="${esc(pageUrl)}">${esc(pageUrl)}</a>` : ''}${updated ? `<time datetime="${esc(updated)}">${esc(updated)}</time>` : ''}</section>`;
    const modified = feedDate(updated, 'iso');
    const ld = { '@context': 'https://schema.org', '@type': 'WebPage', ...(title != null ? { name: String(title) } : {}),
        description: text, ...(pageUrl ? { url: pageUrl } : {}), ...(modified ? { dateModified: modified } : {}), abstract: text };
    const head = [text ? `<meta name="ai-summary" content="${esc(clip(text, 160))}">` : '', jsonLdTag(ld)].filter(Boolean).join('\n');
    const items = facts.map((f) => (Array.isArray(f) ? f.filter((x) => x != null && x !== '').join(': ') : String(f == null ? '' : f)).trim()).filter(Boolean);
    const body = items.length ? `<noscript><section data-ai-summary><h2>${esc(title)}</h2><p>${esc(text)}</p><ul>${items.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section></noscript>` : '';
    const result = { meta: esc(clip(text, 160)), jsonLd, html };
    const tags = body ? `${head}\n${body}` : head;
    Object.defineProperties(result, { head: { value: head }, body: { value: body }, toString: { value: () => tags } });
    return result;
}

function feedDate(value, format) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : (format === 'rss' ? date.toUTCString() : date.toISOString());
}

/** One item shape for RSS 2.0 and Atom 1.0. Dates are rendered in each format's required form. */
function feedXml({ title, link, description, updated, items = [] } = {}, { format = 'rss' } = {}) {
    if (format !== 'rss' && format !== 'atom') throw new TypeError('format must be rss or atom');
    const home = absolute(link);
    const rows = items.map((item) => {
        const url = absolute(item.url, home);
        const id = item.id || url;
        const published = feedDate(item.published || item.updated, format);
        const modified = feedDate(item.updated || item.published, format);
        if (format === 'rss') return `  <item><title>${xml(item.title)}</title><link>${xml(url)}</link><guid isPermaLink="${item.id ? 'false' : 'true'}">${xml(id)}</guid>${published ? `<pubDate>${xml(published)}</pubDate>` : ''}${item.summary ? `<description>${xml(item.summary)}</description>` : ''}${item.author ? `<author>${xml(item.author)}</author>` : ''}</item>`;
        return `  <entry><title>${xml(item.title)}</title><link href="${xml(url)}"/><id>${xml(absolute(id, home))}</id>${modified ? `<updated>${xml(modified)}</updated>` : ''}${published ? `<published>${xml(published)}</published>` : ''}${item.summary ? `<summary>${xml(item.summary)}</summary>` : ''}${item.author ? `<author><name>${xml(item.author)}</name></author>` : ''}</entry>`;
    });
    if (format === 'rss') return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xml(title)}</title><link>${xml(home)}</link><description>${xml(description)}</description>${feedDate(updated, format) ? `<lastBuildDate>${xml(feedDate(updated, format))}</lastBuildDate>` : ''}\n${rows.join('\n')}\n</channel></rss>\n`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><title>${xml(title)}</title><link href="${xml(home)}"/><id>${xml(home)}</id>${description ? `<subtitle>${xml(description)}</subtitle>` : ''}${feedDate(updated, format) ? `<updated>${xml(feedDate(updated, format))}</updated>` : ''}\n${rows.join('\n')}\n</feed>\n`;
}

function feedLinkTags({ rss, atom, title = 'Feed' } = {}) {
    const out = [];
    if (rss) out.push(`<link rel="alternate" type="application/rss+xml" title="${esc(title)}" href="${esc(absolute(rss))}">`);
    if (atom) out.push(`<link rel="alternate" type="application/atom+xml" title="${esc(title)}" href="${esc(absolute(atom))}">`);
    return out.join('\n');
}

module.exports = { headTags, jsonLd, jsonLdTag, sitemapXml, sitemapIndexXml, robotsTxt, llmsTxt, llmsFull, pageSummary, feedXml, feedLinkTags, clip, esc, absolute, AI_AND_SEARCH_BOTS };
