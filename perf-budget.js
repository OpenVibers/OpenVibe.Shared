'use strict';
/**
 * openvibe-shared/perf-budget — size budgets for a page's first load (roadmap WS-T task 1), measured
 * from what the running server actually answers: no browser, deterministic, cheap enough for `npm test`. Core Web Vitals are opt-in: `browser` adds a real-Chrome pass.
 *
 *   const { measure, check, format } = require('openvibe-shared/perf-budget');
 *   const m = await measure({ base: 'http://127.0.0.1:4000', path: '/' });
 *   const over = check(m, { htmlBrotliKB: 30, jsFiles: 12, jsBrotliKB: 90, cssBrotliKB: 40 });
 *   assert.deepStrictEqual(over, [], format(m, over));
 *
 * measure({ base, path = '/', fetch, headers, browser }) fetches the page, then every same-origin script
 * (<script src>) and stylesheet (<link rel="stylesheet">, not media="print") it names, and answers
 *   { html: { rawKB, brotliKB }, js: { files, rawKB, brotliKB }, css: { files, rawKB, brotliKB },
 *     external: [url], urls: { js: [..], css: [..] } }
 * sizes in KB (1 decimal), brotli at quality 11 as the edge serves it. Scripts and stylesheets on other
 * origins (the OpenVibe Frame from openvibe.network, a CDN) are listed in `external` and counted in
 * `files`, not in bytes: they are the other origin's budget. Inline <script>/<style> count in the HTML.
 *
 * With `browser` (true for launch() defaults, an options object for browser-harness launch(), or
 * { running } for a browser already started with launch()), the page is then opened at 1280×900 in a fresh
 * browser context, one mouse click lands at the viewport centre, and 500 ms later the result gains
 *   cwv: { lcpMs, inpMs, cls }
 * lcpMs the last largest-contentful-paint entry's startTime (null when none); inpMs the longest 'event'
 * entry with an interactionId (0 when none); cls the largest session window of layout shifts without recent
 * input (shifts under 1 s apart, at most 5 s long; the web-vitals definition), 3 decimals. A browser this
 * call launched is stopped again; a running one is left running.
 *
 *   const m = await measure({ base, path: '/', browser: true });
 *   check(m, { lcpMs: 2500, inpMs: 200, cls: 0.1 });
 *
 * check(m, budgets) → [{ name, value, budget }] for every budget exceeded. Budget names:
 *   htmlRawKB htmlBrotliKB jsFiles jsRawKB jsBrotliKB cssFiles cssRawKB cssBrotliKB externalFiles
 *   lcpMs inpMs cls (these need measure({ browser }); without m.cwv check() throws)
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

// Installed before any page script: the Core Web Vitals entries, buffered so none before it is missed.
const CWV_PROBE = `(() => {
  if (window.__ovCwv) return;
  const s = { lcp: [], shifts: [], events: [] };
  const watch = (type, fn, extra) => {
    try { new PerformanceObserver((list) => list.getEntries().forEach(fn)).observe({ type, buffered: true, ...extra }); } catch { /* unsupported */ }
  };
  watch('largest-contentful-paint', (e) => s.lcp.push(e.startTime));
  watch('layout-shift', (e) => { if (!e.hadRecentInput) s.shifts.push([e.startTime, e.value]); });
  watch('event', (e) => { if (e.interactionId > 0) s.events.push(e.duration); }, { durationThreshold: 16 });
  Object.defineProperty(window, '__ovCwv', { value: () => s });
})();`;
const VIEWPORT = { width: 1280, height: 900 };

/** The largest session window of layout shifts ([startTime, value]): under 1 s apart, at most 5 s long. */
function clsOf(shifts) {
    let max = 0, sum = 0, first = 0, last = 0;
    for (const [t, v] of [...shifts].sort((a, b) => a[0] - b[0])) {
        if (sum && t - last < 1000 && t - first < 5000) sum += v;
        else { sum = v; first = t; }
        last = t;
        max = Math.max(max, sum);
    }
    return Math.round(max * 1000) / 1000;
}

/** Opens the page in Chrome with the probe, clicks once at the viewport centre, and reads the vitals. */
async function vitals(url, browser) {
    const harness = require('./browser-harness');
    const own = !browser.running;
    const b = browser.running || await harness.launch(browser === true ? {} : browser);
    let context = null, page = null;
    try {
        context = await b.newContext();
        page = await harness.openPage(b, context, VIEWPORT);
        await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CWV_PROBE });
        await page.goto(url);
        const at = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2, button: 'left', clickCount: 1 };
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at });
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at });
        await new Promise((r) => setTimeout(r, 500));
        const raw = await page.evaluate('window.__ovCwv ? window.__ovCwv() : null');
        if (!raw) throw new Error(`perf-budget: the vitals probe did not run on ${url}`);
        return {
            lcpMs: raw.lcp.length ? Math.round(raw.lcp[raw.lcp.length - 1]) : null,
            inpMs: Math.round(Math.max(0, ...raw.events)),
            cls: clsOf(raw.shifts),
        };
    } finally {
        if (page) await page.close();
        if (context) await context.dispose();
        if (own) await b.close();
    }
}

async function measure({ base, path = '/', fetch: f = globalThis.fetch, headers = {}, browser = null } = {}) {
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
    const m = { url: pageUrl, html: { rawKB: kb(html.length), brotliKB: kb(brotli(html)) }, js: jsT, css: cssT, external, urls: { js, css } };
    if (browser) m.cwv = await vitals(pageUrl, browser);
    return m;
}

const READ = {
    htmlRawKB: (m) => m.html.rawKB, htmlBrotliKB: (m) => m.html.brotliKB,
    jsFiles: (m) => m.js.files, jsRawKB: (m) => m.js.rawKB, jsBrotliKB: (m) => m.js.brotliKB,
    cssFiles: (m) => m.css.files, cssRawKB: (m) => m.css.rawKB, cssBrotliKB: (m) => m.css.brotliKB,
    externalFiles: (m) => m.external.length,
    lcpMs: (m) => vital(m, 'lcpMs'), inpMs: (m) => vital(m, 'inpMs'), cls: (m) => vital(m, 'cls'),
};
function vital(m, name) {
    if (!m.cwv) throw new Error(`perf-budget: ${name} needs measure({ browser })`);
    return m.cwv[name];
}

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
    if (m.cwv) lines.push(`  cwv: lcp ${m.cwv.lcpMs ?? 'none'} ms, inp ${m.cwv.inpMs} ms, cls ${m.cwv.cls}`);
    for (const o of over) lines.push(`  over budget: ${o.name} ${o.value} > ${o.budget}`);
    return lines.join('\n');
}

module.exports = { measure, check, format, assetsOf };
