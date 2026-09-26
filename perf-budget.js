'use strict';
/**
 * openvibe-shared/perf-budget — size budgets for a page's first load (roadmap WS-T task 1), measured
 * from what the running server actually answers: no browser, deterministic, cheap enough for `npm test`.
 *
 *   const { measure, check, format } = require('openvibe-shared/perf-budget');
 *   const m = await measure({ base: 'http://127.0.0.1:4000', path: '/' });
 *   const over = check(m, { htmlBrotliKB: 30, jsFiles: 12, jsBrotliKB: 90, cssBrotliKB: 40 });
 *   assert.deepStrictEqual(over, [], format(m, over));
 *
 * measure({ base, path = '/', fetch, headers }) fetches the page, then every same-origin script
 * (<script src>) and stylesheet (<link rel="stylesheet">, not media="print") it names, and answers
 *   { html: { rawKB, brotliKB }, js: { files, rawKB, brotliKB }, css: { files, rawKB, brotliKB },
 *     external: [url], urls: { js: [..], css: [..] } }
 * sizes in KB (1 decimal), brotli at quality 11 as the edge serves it. Scripts and stylesheets on other
 * origins (the OpenVibe Frame from openvibe.network, a CDN) are listed in `external` and counted in
 * `files`, not in bytes: they are the other origin's budget. Inline <script>/<style> count in the HTML.
 *
 * check(m, budgets) → [{ name, value, budget }] for every budget exceeded. Budget names:
 *   htmlRawKB htmlBrotliKB jsFiles jsRawKB jsBrotliKB cssFiles cssRawKB cssBrotliKB externalFiles
 * Set each a little above a measurement; raising one should be a decision said in the commit.
 */
const zlib = require('zlib');

const kb = (n) => Math.round((n / 1024) * 10) / 10;
const brotli = (buf) => zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const attr = (tag, name) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
    return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
};

/** The script and stylesheet URLs a page's HTML names, in order (comments ignored). */
function assetsOf(html) {
    const body = String(html).replace(/<!--[\s\S]*?-->/g, '');
    const js = [], css = [];
    for (const m of body.matchAll(/<script\b[^>]*>/gi)) {
        const src = attr(m[0], 'src');
        const type = (attr(m[0], 'type') || '').toLowerCase();
        if (src && !['application/json', 'application/ld+json', 'text/template'].includes(type)) js.push(src);
    }
    for (const m of body.matchAll(/<link\b[^>]*>/gi)) {
        const rel = (attr(m[0], 'rel') || '').toLowerCase().split(/\s+/);
        const media = (attr(m[0], 'media') || '').toLowerCase();
        const disabled = /\sdisabled(\s|=|\/?>)/i.test(m[0]);
        if (rel.includes('stylesheet') && media !== 'print' && !disabled) css.push(attr(m[0], 'href'));
    }
    return { js: js.filter(Boolean), css: css.filter(Boolean) };
}

async function measure({ base, path = '/', fetch: f = globalThis.fetch, headers = {} } = {}) {
    const origin = new URL(base).origin;
    const pageUrl = new URL(path, base).href;
    const res = await f(pageUrl, { headers: { accept: 'text/html', ...headers } });
    if (!res.ok) throw new Error(`perf-budget: ${pageUrl} answered ${res.status}`);
    const html = Buffer.from(await res.arrayBuffer());
    const { js, css } = assetsOf(html.toString('utf8'));
    const external = [];
    async function total(urls) {
        let raw = 0, br = 0;
        for (const u of urls) {
            const abs = new URL(u, pageUrl);
            if (abs.origin !== origin) { external.push(abs.href); continue; }
            const r = await f(abs.href, { headers });
            if (!r.ok) throw new Error(`perf-budget: ${abs.pathname} (named by ${path}) answered ${r.status}`);
            const b = Buffer.from(await r.arrayBuffer());
            raw += b.length; br += brotli(b);
        }
        return { files: urls.length, rawKB: kb(raw), brotliKB: kb(br) };
    }
    const jsT = await total(js);
    const cssT = await total(css);
    return { url: pageUrl, html: { rawKB: kb(html.length), brotliKB: kb(brotli(html)) }, js: jsT, css: cssT, external, urls: { js, css } };
}

const READ = {
    htmlRawKB: (m) => m.html.rawKB, htmlBrotliKB: (m) => m.html.brotliKB,
    jsFiles: (m) => m.js.files, jsRawKB: (m) => m.js.rawKB, jsBrotliKB: (m) => m.js.brotliKB,
    cssFiles: (m) => m.css.files, cssRawKB: (m) => m.css.rawKB, cssBrotliKB: (m) => m.css.brotliKB,
    externalFiles: (m) => m.external.length,
};

function check(m, budgets = {}) {
    const over = [];
    for (const [name, budget] of Object.entries(budgets)) {
        if (!READ[name]) throw new Error(`perf-budget: unknown budget ${name}`);
        const value = READ[name](m);
        if (value > budget) over.push({ name, value, budget });
    }
    return over;
}

function format(m, over = []) {
    const lines = [`${m.url}: html ${m.html.rawKB} KB (${m.html.brotliKB} br), js ${m.js.files} files ${m.js.rawKB} KB (${m.js.brotliKB} br), css ${m.css.files} files ${m.css.rawKB} KB (${m.css.brotliKB} br), ${m.external.length} external`];
    for (const o of over) lines.push(`  over budget: ${o.name} ${o.value} > ${o.budget}`);
    return lines.join('\n');
}

module.exports = { measure, check, format, assetsOf };
