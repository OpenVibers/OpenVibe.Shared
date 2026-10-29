'use strict';
// Server-only discovery and representations of the site's own public render output.
const { parseHTML } = require('linkedom');
const esc = s => String(s).replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]));
const md = s => String(s || '').replace(/\\/g, '\\\\').replace(/([\[\]*_`])/g, '\\$1');

function twinUrl(value) {
    const url = new URL(value, 'https://agent.invalid');
    url.searchParams.delete('format');
    if (!url.pathname.endsWith('.md')) url.pathname = url.pathname === '/' ? '/index.md' : url.pathname.replace(/\/$/, '') + '.md';
    return /^[a-z]+:/i.test(value) ? url.href : url.pathname + url.search + url.hash;
}

function agentManifest(descriptor = {}, overrides = {}) {
    const d = { ...descriptor, ...overrides };
    const home = d.home || d.canonical;
    const abs = value => value && home ? new URL(value, home).href : value;
    return {
        network: 'OpenVibe', site: d.site || (home ? new URL(home).hostname : undefined),
        id: d.id, name: d.name, purpose: d.purpose, home,
        api: abs(d.api), openapi: abs(d.openapi),
        mcp: d.mcp ? { transport: 'streamable-http', ...d.mcp, url: abs(d.mcp.url) } : undefined,
        docs: abs(d.docs), llms: abs(d.llms || (home && '/llms.txt')),
        llmsFull: abs(d.llmsFull || (home && '/llms-full.txt')), sitemap: abs(d.sitemap || (home && '/sitemap.xml')),
        policy: { robots: 'https://openvibe.network/bot.json', ...d.policy },
    };
}

function linkHeaderTags(canonical, llms = '/llms.txt') {
    const twin = twinUrl(canonical);
    // URL encoding keeps arbitrary caller input out of HTTP header syntax.
    const headerUrl = s => String(s).replace(/[<>"\r\n]/g, c => encodeURIComponent(c));
    return {
        head: `<link rel="alternate" type="text/markdown" href="${esc(twin)}">\n<link rel="describedby" href="${esc(llms)}">`,
        header: `<${headerUrl(twin)}>; rel="alternate"; type="text/markdown", <${headerUrl(llms)}>; rel="describedby"`,
    };
}

function markdownTwin({ html, title, canonical, updated = null }) {
    const { document } = parseHTML(html);
    title = title || document.querySelector('title')?.textContent || '';
    const walk = node => {
        if (node.nodeType === 3) return md(node.textContent.replace(/\s+/g, ' '));
        if (node.nodeType !== 1) return '';
        const tag = node.localName;
        if (['script', 'style', 'template', 'nav', 'footer'].includes(tag) || node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return '';
        const inside = () => Array.from(node.childNodes).map(walk).join('');
        if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${inside().trim()}\n\n`;
        if (tag === 'a') return node.hasAttribute('href') ? `[${inside()}](${destination(node.getAttribute('href'))})` : inside();
        if (tag === 'img') return `![${md(node.getAttribute('alt') || '')}](${destination(node.getAttribute('src') || '')})`;
        if (tag === 'br') return '\n';
        if (tag === 'strong' || tag === 'b') return `**${inside()}**`;
        if (tag === 'em' || tag === 'i') return `*${inside()}*`;
        if (tag === 'pre') return `\n\n~~~~\n${node.textContent}\n~~~~\n\n`;
        if (tag === 'code') return '`' + node.textContent.replace(/`/g, '\\`') + '`';
        if (tag === 'ul' || tag === 'ol') {
            return '\n\n' + Array.from(node.children).filter(n => n.localName === 'li').map((n, i) => {
                const text = Array.from(n.childNodes).map(walk).join('').trim();
                const prefix = tag === 'ol' ? `${Number(node.getAttribute('start') || 1) + i}. ` : '- ';
                return prefix + text.replace(/\n/g, '\n' + ' '.repeat(prefix.length));
            }).join('\n') + '\n\n';
        }
        if (tag === 'table') {
            const rows = Array.from(node.querySelectorAll('tr')).map(row => Array.from(row.children).filter(n => /^(th|td)$/.test(n.localName)).map(n => walk(n).trim().replace(/\|/g, '\\|').replace(/\n+/g, '<br>')));
            if (!rows.length) return '';
            const width = Math.max(...rows.map(r => r.length));
            const line = row => '| ' + Array.from({ length: width }, (_, i) => row[i] || '').join(' | ') + ' |';
            return '\n\n' + [line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n') + '\n\n';
        }
        const content = inside();
        return /^(p|div|section|article|main|blockquote|dl|dt|dd)$/.test(tag) ? `\n\n${content}\n\n` : content;
    };
    const destination = value => String(value).replace(/[\s()<>]/g, c => encodeURIComponent(c).replace(/\(/g, '%28').replace(/\)/g, '%29'));
    const content = walk(document.querySelector('main') || document.body).replace(/\n[ \t]+\n/g, '\n\n').replace(/\n{3,}/g, '\n\n').trim();
    return `---\ntitle: ${JSON.stringify(title)}\ncanonical: ${JSON.stringify(canonical)}\nupdated: ${JSON.stringify(updated)}\n---\n\n# ${md(title)}\n\nHTML: [${md(title || 'Original page')}](${destination(canonical)})\n\n${content}\n`;
}

/** Mount before public HTML routes. render(path, { query }) returns { html, title?, updated? } or null.
 * It must use the same public snapshot renderer as HTML and must never return personalised content.
 */
function mount(app, { descriptor = {}, render }) {
    const manifest = agentManifest(descriptor);
    app.use((req, res, next) => {
        if (!['GET', 'HEAD'].includes(req.method)) return next();
        const url = new URL(req.url, 'https://agent.invalid');
        if (url.pathname === '/.well-known/agent.json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(manifest));
        }
        const isTwin = url.pathname.endsWith('.md') || url.searchParams.get('format') === 'markdown' || (req.headers.accept && req.accepts(['html', 'text/markdown']) === 'text/markdown');
        let path = url.pathname;
        if (path === '/index.md') path = '/';
        else if (path.endsWith('.md')) path = path.slice(0, -3);
        url.searchParams.delete('format');
        if (!render) return next();
        Promise.resolve().then(() => render(path, { query: url.searchParams })).then(page => {
            if (!page) {
                if (!isTwin) return next();
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
                return res.end(req.method === 'HEAD' ? undefined : '# Not found\n');
            }
            const canonical = new URL(path + url.search, manifest.home).href;
            const links = linkHeaderTags(path + url.search, manifest.llms || '/llms.txt');
            res.setHeader('Link', [res.getHeader('Link'), links.header].filter(Boolean).join(', '));
            res.setHeader('Vary', [res.getHeader('Vary'), 'Accept'].filter(Boolean).join(', '));
            res.setHeader('Cache-Control', 'public, max-age=300');
            res.setHeader('Content-Type', isTwin ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8');
            const body = isTwin ? markdownTwin({ ...page, canonical }) : page.html.replace(/<link\b(?=[^>]*\brel=["'](?:alternate|describedby)["'])(?=[^>]*(?:text\/markdown|rel=["']describedby["']))[^>]*>/gi, '').replace(/<\/head>/i, links.head + '\n</head>');
            res.end(req.method === 'HEAD' ? undefined : body);
        }).catch(next);
    });
}

module.exports = { mount, agentManifest, markdownTwin, linkHeaderTags, twinUrl };
