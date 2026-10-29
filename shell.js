'use strict';
/**
 * openvibe-shared/shell — compose a whole server-rendered page from the pieces every OpenVibe site
 * already ships: the SEO head (`seo.headTags` / `seo.pageSummary`), the OpenVibe Frame
 * (`frame.noscriptNav`, `frame.footer`), the theme-loader before the first paint, and the deferred
 * web runtime (`web-runtime.js`, `navbar.js`, `footer.js`) booted from an escaped JSON blob.
 *
 * The shell adds no markup of its own — it is the composition the hand-written `<!doctype html>`
 * layouts repeat, in one place, so a repo's `layout.js` can become a call to it (the T11 sweep).
 *
 *   const shell = require('openvibe-shared/shell');
 *   res.type('html').send(shell.page({
 *       name: 'example', title: 'Example', description: '…', canonical: 'https://example.com/',
 *       summary: 'One line an AI can read',
 *       body: '<main>…</main>',
 *       features: { chat: { scripts: ['/js/chat.js'] } },
 *       routes: [{ path: '^/chat', features: ['chat'] }],
 *   }));
 *
 *   page(o)      the whole document: doctype, <head>, <body>.
 *   scripts(o)   just the <head> scripts (theme-loader, the deferred runtime, the boot JSON and the
 *                inline boot call).
 *
 * Every value that reaches markup is escaped: `seo` escapes the head, this module escapes `lang` and
 * the body attributes, and the runtime boot is `JSON.stringify(…).replace(/</g, '\\u003c')` so a
 * feature name can never close the <script> and break out.
 */
const seo = require('./seo');
const frame = require('./frame');
const serve = require('./serve');
const social = require('./social');
const appIcons = require('./app-icons');

const esc = seo.esc;

/** JSON that is safe inside a <script>: `<` is escaped so nothing can close the element. */
function json(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** HTML attributes from an object; `true` is a bare attribute, null/false/undefined are dropped. */
function attrs(map) {
    return Object.entries(map || {})
        .filter(([, v]) => v != null && v !== false)
        .map(([k, v]) => (v === true ? ` ${esc(k)}` : ` ${esc(k)}="${esc(v)}"`))
        .join('');
}

/**
 * The page's scripts, in order: `theme-loader.js` eagerly (it applies the theme before the first
 * paint), then `web-runtime.js`, `navbar.js` and `footer.js` deferred via `serve.url`, then one
 * inline script that waits for DOMContentLoaded, hands the escaped JSON boot to
 * `OVWebRuntime.create(…).boot()` and initialises the navbar.
 *
 * o: name/service, navbar (OpenVibeNavbar.init options, `service` defaults to name),
 *    features, routes, versions (the runtime boot; `routes[].path` is a string, not a RegExp).
 */
function scripts(o = {}) {
    const name = o.name || o.service || 'OpenVibe';
    const navbar = { service: name, ...(o.navbar || {}) };
    const boot = { features: o.features || {}, routes: o.routes || [] };
    if (o.versions) boot.versions = o.versions;
    return [
        `<script src="${esc(serve.url('theme-loader.js'))}"></script>`,
        `<script src="${esc(serve.url('web-runtime.js'))}" defer></script>`,
        `<script src="${esc(serve.url('navbar.js'))}" defer></script>`,
        `<script src="${esc(serve.url('footer.js'))}" defer></script>`,
        `<script>window.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init(${json(navbar)}); OVWebRuntime.create(${json(boot)}).boot(); });</script>`,
    ].join('\n');
}

/**
 * Compose a whole page. Options:
 *   name / service      the site's service name (navbar init, noscript-nav brand, footer default)
 *   lang ('en')         `<html lang>`
 *   title, siteName, description, canonical, image, imageAlt, type, robots, keywords, author,
 *   themeColor, twitterSite, locale, titleSuffix, alternates, jsonLd      → `seo.headTags`
 *   summary             a one-line AI summary; when given, `seo.pageSummary`'s head goes in <head>
 *                       and its <noscript> block at the top of <body> (facts/url/updated feed it)
 *   facts, url, updated the `seo.pageSummary` inputs
 *   head                extra <head> markup appended verbatim (already trusted/escaped)
 *   manifest            the installable web app links (manifest + apple-touch-icon) are added when the
 *                       page's service has an icon set; `false` opts out
 *   body                the page's main content (trusted markup — the caller escaped it)
 *   bodyAttributes      attributes for <body>, escaped; bodyClass is shorthand for `class`
 *   navLinks, home      the `frame.noscriptNav` no-JavaScript navigation
 *   footer              `frame.footer` config; defaults to { service: name, variant: 'compact' }
 *   navbar, features, routes, versions   the runtime boot (see `scripts`)
 */
// Most sites name their service on the navbar and footer configs rather than on the page itself.
function serviceOf(o) {
    return o.service || (o.navbar && o.navbar.service) || (o.footer && o.footer.service);
}

// A page that names no image shares its site's card (openvibe-shared/social), when the site has one and the page
// has a canonical URL to make it absolute against. `image: null` opts out.
function defaultImage(o) {
    if (!o.canonical) return null;
    const service = serviceOf(o);
    return service ? social.url(service) : null;
}

// The installable web app links: the hashed manifest and the 192px touch icon. `manifest: false` opts out (a site
// that serves its own /manifest.webmanifest), and a page whose `head` already carries a manifest link keeps it.
function manifestLinks(o) {
    if (o.manifest === false) return '';
    const service = serviceOf(o);
    if (!service || !appIcons.has(service)) return '';
    if (typeof o.head === 'string' && /rel=["']?manifest/.test(o.head)) return '';
    const manifest = serve.manifestUrl(service);
    const touch = appIcons.url(service, 192);
    if (!manifest || !touch) return '';
    return `<link rel="manifest" href="${esc(manifest)}">\n<link rel="apple-touch-icon" href="${esc(touch)}">`;
}

// The shared navbar's script is deferred and mounts into the page's #navbar-mount: the mount holds the bar's 52px from
// the first paint so the page does not drop when it lands (layout shift), and without JavaScript it goes away. The body
// has no browser margin, so the Frame's navbar and footer meet the window's edges on a page with no stylesheet of its own
// (openvibe.events and openvibe.bot showed an 8px frame around the footer).
const NAVBAR_RESERVE = '<style>body{margin:0}#navbar-mount{min-height:52px}</style><noscript><style>#navbar-mount{display:none}</style></noscript>';

function page(o = {}) {
    const name = o.name || o.service || 'OpenVibe';
    const title = o.title || name;
    const summary = o.summary == null ? null
        : seo.pageSummary({ title, summary: o.summary, facts: o.facts, url: o.url || o.canonical, updated: o.updated });
    const head = seo.headTags({
        title, siteName: o.siteName || name, description: o.description,
        canonical: o.canonical, image: o.image === undefined ? defaultImage(o) : o.image, imageAlt: o.imageAlt || (o.image === undefined && defaultImage(o) ? o.siteName || name : undefined), type: o.type,
        robots: o.robots, keywords: o.keywords, author: o.author, themeColor: o.themeColor,
        twitterSite: o.twitterSite, locale: o.locale, titleSuffix: o.titleSuffix,
        alternates: o.alternates, jsonLd: o.jsonLd,
    });
    const bodyAttributes = { ...(o.bodyClass ? { class: o.bodyClass } : {}), ...(o.bodyAttributes || {}) };
    return [
        '<!doctype html>',
        `<html lang="${esc(o.lang || 'en')}">`,
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        head,
        o.agentLayer && o.canonical ? require('./agent-layer').linkHeaderTags(o.canonical, o.llms).head : '',
        summary ? summary.head : '',
        o.head || '',
        manifestLinks(o),
        NAVBAR_RESERVE,
        scripts(o),
        '</head>',
        `<body${attrs(bodyAttributes)}>`,
        summary ? summary.body : '',
        frame.noscriptNav({ name, home: o.home, links: o.navLinks }),
        o.body || '',
        frame.footer(o.footer || { service: name, variant: 'compact' }),
        '</body>',
        '</html>',
    ].filter((part) => part !== '').join('\n');
}

module.exports = { page, scripts };
