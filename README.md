# OpenVibe.Shared

> Versioned UI, the OpenVibe Frame (the navbar, footer and "shipped" views every site sits in), SEO, legal and release-client packages every OpenVibe site renders.

**Status:** alpha, v2.5.0 (every release is a tag; see [CHANGELOG.md](CHANGELOG.md)). Every deployed
consumer installs a tagged release and none keeps a vendored copy
([docs/migration-plan.md](docs/migration-plan.md) is done); each repository's `package.json` names
the tag it pins.
**Plan:** OpenVibe End-to-End Realignment & Implementation Plan, revision 3 (20 Sep 2026), §3.3 and §16.6.
**License:** MIT, as the package has always been: it is a client library other sites and developers embed (the OpenVibe services themselves are AGPL-3.0).

This repository **is** the npm package `openvibe-shared`. `package.json` sits at the repository
root, so GitHub's tarball of a release tag installs as the package with no build step. It was
imported history-free from `OpenVibe.Network/packages/openvibe-shared` at Network `f337eb6`.
[docs/divergence-2026-09-22.md](docs/divergence-2026-09-22.md) records how the vendored copies
were reconciled first.

## What's in it

| Kind | Files |
|---|---|
| Browser scripts, served at `/shared/<file>` (listed in `files.js`) | `navbar.js`, `nav-icons.js`, `theme-loader.js`, `footer.js`, `notification-ui.js`, `notification-live.js`, `account-switcher.js`, `user-card.js`, `ov-mark.js`, `ov-icons.js`, `history.js`, `sso-client.js`, `panels.js`, `ui.js`, `island.js`, `tooltip.js`, `release-watch.js`, `release-update.js`, `web-runtime.js`, `boost.js`, `openvibe-sw.js` |
| Node modules (`require('openvibe-shared/<name>')`) | `index` (`.`), `analytics` (+ `analytics/{privacy,tracker,retention,schema,event,prune-cli}`), `app-icon`, `assets` (content-addressed image/asset URLs and responsive `<picture>` markup: `hash(bytes)`, `url(src, hash)`, `srcset(entries)`, `picture({ src, hash?, alt, width, height, sizes, sources })` — AVIF before WebP before the fallback `<img>`, an unhashed path kept exactly as given), `auth-client`, `brand`, `builtin-themes`, `cache-policy` (the one cache rule: a content-addressed asset — `?v=<hash>` or a hashed filename — is `public, max-age=31536000, immutable`, anything else is `public, max-age=300, stale-while-revalidate=86400`, HTML is `public, max-age=120, stale-while-revalidate=3600` and a personalised page is `private, no-store`; `assetHeaders`/`htmlHeaders`/`isHashed` plus an `applyHtml()` middleware, used by `serve.js`), `indexnow` (tell engines a page changed: `createIndexNow({ host, key, keyLocation?, endpoint?, fetch, log })` → `keyFile` for `/<key>.txt`, `ping(urls)` for one POST of a deduped, https-only, own-host batch of ≤10,000 URLs that never throws, and `pingSoon(urls)` debounced into one batch in 30s; an unset key sends nothing), `frame` (the OpenVibe Frame on the server), `legal`, `middleware`, `notifications`, `seo`, `theme-sync`, `url-resolver`, `files`, `egress` (SSRF-safe addresses and connect-time DNS for outbound fetches of user-chosen hosts), `trace` (the request's W3C trace on outbound calls inside the network), `release`, `release-compat` (tests), `metrics`, `ready`, `config` (the configuration model: revisioned, validated, classified settings with last-known-good and `/api/admin/config`), `test-runner` (the `npm test` runner of every service's `test/run.js`: each `*.test.js` in its own process; a line `<label>: skipped (<why>)` makes a file skipped, listed with ○ and never counted as passed, and `--strict` fails on skips), `perf-budget` (size budgets for a page's first load, measured from the running server: HTML, same-origin scripts and stylesheets, raw and brotli; for `npm test`), `browser-harness` (real-Chrome checks of a running site: status, console errors, overflow, duplicate scripts, no-JS text, canonical, JSON-LD against visible text, axe-core, repeated-navigation growth and idle work; Node 22, Chrome); `footer`, `shipped` (the shared "shipped X ago" pill, recent list and `/updates` log, from the network changelog) and `icons` (= `ov-icons.js`) work on both sides, and `release-update` gives Node its pure `plan()` |
| Schemas | `docs/schemas/analytics-event.v1.json` (`analytics/event.v1`, exported as `openvibe-shared/analytics/event.v1.json`) |
| Generators | `scripts/build-nav-icons.py` (Font Awesome glyphs → `nav-icons.js`, `ov-icons.js`), `scripts/build-navbar-icons.js` (navbar.js's built-in glyphs), `scripts/build-theme-loader.js`, `scripts/build-app-icons.js` |
| Checks (CI) | `scripts/pin-drift.js` (every openvibe-* pin is a published tag and not more than one minor behind, and openvibe-shared is installed once) and `scripts/floating-promises.js` (`node scripts/floating-promises.js <dir> [--json]`: an async call whose result nobody awaits — a failure is an unhandled rejection and a transaction commits without it — unless awaited, returned, assigned, `void`-ed, chained with `.then(`/`.catch(`/`.finally(` or opted out with `// floating-ok: <reason>`; exit 1 when found) |

Every module file has an explicit `exports` entry (no wildcards), so `require('openvibe-shared/navbar')`,
`require.resolve('openvibe-shared/package.json')` and the rest all resolve. It stays one package with
subpath exports rather than a set of `@openvibe/*` packages:
[docs/adr/0001-one-package-subpath-exports.md](docs/adr/0001-one-package-subpath-exports.md).

## Consuming it

### Start a new site

```sh
npm run create-site -- my-site
```

The command creates `./my-site` with a pinned Shared dependency, a small Express server,
discovery routes (`/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`), and a smoke test. Set `SITE_URL` to the site's public origin before serving it.

### Server side: pin a release tarball

```json
"dependencies": {
    "openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0"
}
```

`npm install` writes the resolved URL and its `integrity` into `package-lock.json`, and `npm ci`
reproduces it exactly. Upgrade by changing the tag in the URL and running `npm install`. Never
hand-copy files into `node_modules/` or a `vendor/` directory.

```js
const legal = require('openvibe-shared/legal');
const seo = require('openvibe-shared/seo');
const { AnalyticsTracker } = require('openvibe-shared/analytics');
```

### SEO kit

`openvibe-shared/seo` exports the page head, sitemap, robots and `llms.txt` helpers, plus
the discovery formats below. The package root also exports them as `seo`. A site serves
`/robots.txt`, `/sitemap.xml`, `/llms.txt` and `/llms-full.txt` (`templates/site` has all four).

`llmsFull({ site, summary, base, sections, maxBytes })` renders `/llms-full.txt`: the `llms.txt`
header, then `## <section>` and, for each page, `### <title>`, `URL: <absolute url>` and the page's
full plain text — `text` as given (newlines kept) or `html` stripped to text; a page with neither is
listed with its URL only. Input order is kept and bodies are never clipped. With `maxBytes` it stops
before the first page that would pass the limit and ends with
`(truncated: N more pages at <base>/llms.txt)`. Sections with no pages are left out. (Sections in the
2.4.0 shape, `{ title, url, body }` with `maxChars`/`maxTotal`, still render as before.)

```js
const seo = require('openvibe-shared/seo');
const full = seo.llmsFull({ site: 'Example', summary: 'What Example publishes', base: 'https://example.com/',
    sections: [{ title: 'Guides', pages: [{ title: 'Start', url: '/start', text: 'Step one.\nStep two.' },
        { title: 'API', url: '/api', html: '<h1>API</h1><p>Call get().</p>' }]}],
    maxBytes: 500000 }); // serve as text/plain at /llms-full.txt
```

`pageSummary({ title, summary, url, updated, facts })` is the AI-readable summary of a page. As a
string it is `<meta name="ai-summary">` (the summary clipped to 160 like the description, which
`headTags` still owns), a WebPage JSON-LD tag (`name`, `description`, `url`, `dateModified` as ISO,
`abstract`; written with `jsonLdTag`) and, when `facts` (strings) are given, a
`<noscript><section data-ai-summary>` block with the title, summary and facts. Everything is
escaped. `.head` is the meta and JSON-LD on their own and `.body` the noscript block, for pages that
put facts in `<body>`; `.meta`, `.jsonLd` and `.html` are the 2.4.0 values.

```js
const summary = seo.pageSummary({ title: 'Start', summary: 'How to set up Example in five minutes',
    url: 'https://example.com/start', updated: '2026-10-01', facts: ['Takes five minutes', 'No account needed'] });
`<head>${seo.headTags({ title: 'Start', description: 'How to set up Example', canonical: 'https://example.com/start' })}
${summary.head}</head><body>${summary.body}…`; // or `${summary}` in <head> when there are no facts
```

```js
const site = { name: 'Example', url: 'https://example.com/' };
const feed = { title: 'Example', link: site.url, description: 'Recent guides', language: 'en',
    selfUrl: '/feed.xml', items: [{ title: 'Guide', link: '/guide', guid: 'guide-1',
        published: '2026-10-01T12:00:00Z', description: 'A short guide', content: '<p>Full text</p>', author: 'Example' }] };
seo.feedXml(feed, { format: 'rss' });  // serve as application/rss+xml
seo.feedXml(feed, { format: 'atom' }); // serve as application/atom+xml
seo.feedLinkTags({ rss: 'https://example.com/feed.xml', atom: 'https://example.com/atom.xml', title: 'Example' });
```

`jsonLd` also builds `product`, `review`, `aggregateRating`, `imageGallery` (an ImageObject
array) and `videoObject` (the same VideoObject shape as `video`). Feed URLs should be absolute,
or relative to the absolute `link`. `feedXml` throws on a format other than `rss` or `atom`. Without
`updated`, the feed uses its newest item date, or the current time when there are no items. Without a
`guid`, an item's link is its RSS guid (`isPermaLink="true"`) and its Atom id. The 2.4.0 item names `url`,
`id` and `summary` still work. `llmsFull` resolves page URLs against `base` (or `site.url`).

### Images and responsive pictures (`assets.js`)

`openvibe-shared/assets` gives an image the same content-addressed URL the rest of the estate uses —
`?v=<first 12 hex of sha256>`, which `cache-policy` and every CDN already treat as immutable — and
renders the `<picture>` around it, without the page hand-writing a srcset:

```js
const fs = require('fs');
const assets = require('openvibe-shared/assets');
const hash = assets.hash(fs.readFileSync('public/img/hero.png'));   // 12 hex
assets.url('/img/hero.png', hash);                                  // /img/hero.png?v=<hash>
const html = assets.picture({
    src: '/img/hero.png', hash, alt: 'The dashboard', width: 1600, height: 900,
    sizes: '(max-width: 800px) 100vw, 800px',
    sources: [
        { type: 'image/avif', entries: [{ src: '/img/hero-800.avif', hash: h800, w: 800 },
                                        { src: '/img/hero-1600.avif', hash: h1600, w: 1600 }] },
        { type: 'image/webp', entries: [{ src: '/img/hero-800.webp', hash: w800, w: 800 },
                                        { src: '/img/hero-1600.webp', hash: w1600, w: 1600 }] },
    ],
});
// <picture><source type="image/avif" …><source type="image/webp" …><img src="/img/hero.png?v=…" alt="…" …></picture>
```

`hash(data)` is sha256 over bytes (`Buffer`/`string`), truncated to the estate's 12 hex. `url(src,
hash)` appends `?v=`, uses `&` after an existing query, replaces an old `?v=` instead of stacking it,
and **returns the path unchanged when there is no hash** — so a site with no build step keeps its
existing asset paths. `srcset(entries)` builds one from `[{ src, hash?, w? | x? }]`.

`picture(o)` orders the `<source>`s itself — AVIF, then WebP, then any other type, with the caller's
order kept inside a format — and always puts the fallback `<img>` last. With no usable source it
renders a plain `<img>`, never an empty `<picture>`; with no `src` it renders nothing. `alt`, `type`,
`srcset`, `sizes`, `media`, `class`, `id`, `loading` (`lazy`), `decoding` (`async`) and `fetchpriority`
all pass through escaped, and a fixed attribute order means the same input renders the same bytes.

For variants named `hero-400.avif`, `hero-800.avif`, and their WebP equivalents, pass
`widths: [400, 800]` with `src: '/img/hero.jpg'`. `picture()` derives both srcsets and keeps the
original JPEG as the `<img>` fallback. Supply widths only for variants the site has generated.
`hashAsset(bytes)` is the same 12-hex content hash used by `serve.hashOf()`; `hash()` remains an alias.

To copy a directory of static files to hashed filenames, run:

```sh
openvibe-build-assets public/img dist/img
```

The command writes `dist/img/manifest.json`, mapping paths such as `hero.jpg` to
`hero.<hash>.jpg` (and preserving subdirectories). `cache-policy.isHashed()` recognises these
names as immutable. Shared does not transcode images: generate AVIF and WebP variants in the
site build before using `widths`, or pass existing variants through `sources`.

### Performance budgets (`perf-budget.js`)

`measure({ base, path })` weighs a page's first load from the running server (HTML, same-origin
scripts and stylesheets, raw and brotli) with no browser. `measure({ ..., browser: true })` then
opens the page in Chrome through `browser-harness`, clicks once at the viewport centre and adds
`cwv: { lcpMs, inpMs, cls }`, so `check()` takes Core Web Vitals budgets as well. The shared
test workflow needs no extra step for this, because `ubuntu-latest` has `/usr/bin/google-chrome`.
Run the check from `extra`:

```yaml
jobs:
  test:
    uses: OpenVibers/OpenVibe.Shared/.github/workflows/test.yml@<sha>
    with:
      extra: node scripts/perf/cwv.js
```

```js
// scripts/perf/cwv.js: start the site, measure the home page in Chrome, fail over budget.
const { measure, check, format } = require('openvibe-shared/perf-budget');
const server = require('../../server/app').listen(0, '127.0.0.1', async () => {
    const m = await measure({ base: `http://127.0.0.1:${server.address().port}`, path: '/', browser: true });
    const over = check(m, { htmlBrotliKB: 30, jsBrotliKB: 90, lcpMs: 2500, inpMs: 200, cls: 0.1 });
    console.log(format(m, over));
    server.close();
    process.exitCode = over.length ? 1 : 0;
});
```

### Metrics and readiness (server)

```js
const release = require('openvibe-shared/release').createRelease({ service: 'community' });
const m = require('openvibe-shared/metrics').instrument(app, { service: 'community', release: release.release });
// before any route: HTTP golden signals by route template, process metrics, release_info,
// and GET /metrics for direct loopback callers only (404 through a proxy)
m.registry.gauge({ name: 'jobs', help: 'Jobs by state', labelNames: ['state'], collect: () => rows });
// collect may be async (a database read): /metrics awaits it, up to 2 s, and leaves out one that fails.
m.registry.gauge({ name: 'docs', help: 'Documents', collect: async () => (await db.one(sql`SELECT count(*)::int AS n FROM docs`)).n });
// instrument() also routes an async handler's rejection to next(err) (openvibe-shared/express-async): Express 4
// would leave it unhandled, and Node 22 ends the process on an unhandled rejection.

const ready = require('openvibe-shared/ready').createReadiness({
    service: 'community', release: release.release,
    checks: [
        { name: 'db', required: true, check: () => db.prepare('SELECT 1 AS ok').get().ok === 1 },
        { name: 'media', required: false, cacheMs: 30000, check: async () => (await ping()) || 'unreachable' },
    ],
});
app.get('/api/ready', ready.handler);   // 503 only when a required check fails; optional → degraded
```

A check fails when it throws, times out, returns `false`, a string (the reason) or
`{ ok: false, error }`. Name a dependency required only when the service really cannot serve
without it.

A check that verified nothing (its feature is not configured, its dependency is switched off)
returns `skip('not configured')` (`require('openvibe-shared/ready').skip`, or `{ skipped: reason }`),
never `true`: it reports status `skipped` with the reason and is listed in `skipped`. No fake green
(roadmap WS-Q task 7): a skipped required check makes the service `degraded`, and a service is
`ready` only when at least one check really passed.

### Configuration (server, WS-C task 7)

`openvibe-shared/config` keeps one namespace of a service's configuration as immutable revisions
(`common.config-snapshot@1`) in the service's own SQLite database. No new dependency: pass the
better-sqlite3 handle. Several namespaces share one database (tables `config_snapshots` and
`config_keys`).

On PostgreSQL (an openvibe-sdk/db handle, ADR-035) `createConfigStore` returns a promise of the store (`config-pg.js`): `const tiering = await config.createConfigStore({ db, … })`. Its reading and writing methods are async, while `get()` and `revision()` stay in memory. The service's migrations create the tables from `config.configSchema()`.

```js
const config = require('openvibe-shared/config');
const settings = config.createConfigStore({
    db, service: 'live', namespace: 'live.site_settings',
    schema,                        // JSON Schema subset: type, enum, const, required, properties,
                                   // additionalProperties, min/max*, pattern, items, uniqueItems, multipleOf
    validate: (values) => true,    // or false, a message, a list, { valid, errors }; synchronous
    classify: (key) => (/api_key|secret|token/.test(key) ? 'secret' : undefined),  // or { key: class }; unknown = internal
    defaults,                      // revision 1 of a new namespace, and under every revision
    legacy: () => config.fromRows(db.prepare('SELECT * FROM site_settings').all()),  // revision 1 instead
    onActivate: async (values, previous, { restoring }) => { /* apply it; throw to refuse */ },
    keep: 50, log: console, now: () => new Date(),
});
settings.get();                    // defaults overlaid with the active values: frozen, in memory
settings.get('max_bitrate_kbps');  // one value; never a database read
settings.revision();               // the active revision, or null
settings.propose(values, { actor, reason, merge, unset });   // validated, stored as proposed (redacted snapshot)
await settings.activate(revision, { actor });
await settings.apply(values, { actor, reason, merge, unset }); // propose + activate
await settings.rollback({ actor, reason, to });                 // a new revision copying the previous good one (or `to`)
settings.lastKnownGood(); settings.history({ limit, before }); settings.snapshot(revision); settings.summary();
settings.import(legacy);           // revision 1 from a legacy source when the namespace has none
settings.reload();                 // another process changed it: re-read the active revision
```

- **Values** are a complete snapshot; `merge: true` starts from the active values and `unset` removes
  keys (a key with a default falls back to it). A redaction marker sent back (`{ redacted: true,
  fingerprint }` as the routes show it) keeps the value it stands for, so a form can round-trip
  secrets; a marker whose fingerprint is not the current value's is refused (422).
- **Activation** is serialized per store. The switch (new revision active, old superseded) is one
  transaction; then `onActivate(values, previous)` runs. If it throws, the previous revision is active
  again in memory and in the database, the new one is `rejected` with the error (scrubbed of secrets),
  `onActivate` runs once more with the restored values (`{ restoring: true }`), and a
  `ConfigError` (`config.activation_failed`, 422) is thrown with the original as `cause`. A proposal
  whose base is no longer active is `config.stale` (409). A process that stopped mid-activation boots
  on the last-known-good.
- **Last-known-good** is the newest revision that activated successfully. Pruning keeps the newest
  `keep` revisions and never the active one or the last-known-good.
- **Secrets** stay in the row so they can be activated again, but leave only redacted (history,
  summary, routes, the return values) and never reach the log or a stored error. A redacted value is
  `{ redacted: true, fingerprint }`: HMAC-SHA256 of its canonical JSON under a random 32-byte key made
  for the namespace on first use and kept in `config_keys`. The key never leaves the database and is
  never logged, so equal fingerprints mean an unchanged value while nothing can be guessed offline. A
  snapshot's `checksum` is the sha256 of its values as shown. Losing the key row only means a new key:
  older markers stop round-tripping. A key classified secret later is redacted in older revisions too.
  Errors name the rule, never the value.
- `config.fromRows(rows, { prefix, type })` reads typed key-value rows (`number`, `boolean`, `json`,
  anything else a string), as Live's and Network's `site_settings` and Media's `media_settings` keep them.

```js
config.adminRoutes([settings, other], {
    requireAdmin,                             // a middleware or a list; guards every handler
    actor: (req) => ({ type: 'user', id: req.user.subject_id }),  // default: req.actor, req.subject, req.user.subject(_id)
    authorize: (req, { action, namespace, keys }) => action === 'read' || isOwner(req.user) || !keys.some(isSecret),
    basePath: '/api/admin/config',
}).mount(app);                                // or { router }, the handlers, or handle(req, res, next) on plain http
```

| Route | Answer |
|---|---|
| `GET /api/admin/config` | `{ namespaces: [{ service, namespace, revision, values, classification, active, last_known_good }] }`, values redacted |
| `GET /api/admin/config/:namespace` | one of them |
| `GET /api/admin/config/:namespace/history?limit&before` | `{ namespace, snapshots, next_before }`, newest first |
| `POST /api/admin/config/:namespace` `{ values, reason, merge?, unset? }` | the new active snapshot; 422 `config.invalid` with `errors[]`, 422 `config.activation_failed` |
| `POST /api/admin/config/:namespace/rollback` `{ to?, reason }` | the new active snapshot; 409 `config.no_previous`, `config.not_good` |

Errors are `application/problem+json` (`errors.problem@1`). Mount it after a JSON body parser, or
let it read the body itself.

### Releases: `/release.json`, open tabs and the mixed-version test (ADR-016, Track R)

```js
const release = require('openvibe-shared/release').createRelease({
    service: 'community',
    root: path.join(__dirname, '..'),
    components: {
        styles: { kind: 'style', assets: ['/css/app.css', '/css/pages.css'] },   // swapped in place
        pages: { kind: 'content', files: ['server/web/pages'] },                // regions re-fetched in place
        shell: { kind: 'script', assets: ['/js/app.js'], files: ['server/web/layout.js', 'public/index.html'] },
    },
    contracts: { 'community.web-api': { version: '1.4.0', accepts: '^1.0.0' } },   // what the pages call
    schemaGeneration: () => migrations.generation(),                            // optional
});
const m = require('openvibe-shared/metrics').instrument(app, { service: 'community', release: release.release });
release.mount(app, { registry: m.registry });   // GET /release.json, POST /release-metrics → /metrics
```

- **Components.** `style` (stylesheets, `assets` are URL paths under `publicDir`, default
  `root/public`), `content` (server-rendered regions), `script` (code the page runs) and `server`
  (code only the server runs). A component's version is the hash of its files. `shell` is the
  catch-all `script` component: list in it **every client-facing file no other component lists**
  (layout templates, page scripts). An undeclared shell is versioned by the release, so every
  release reloads, which is the 1.4.0 behaviour. The asset map's URLs are `<path>?v=<12 hex of
  sha256>`, which matches Live's `server/web/assets.js`; pass `assetUrl(path, hash)` for another
  scheme.
- **Contract ranges.** `version` is what this release speaks. `accepts` is the range it still
  serves from the other side (`^1.0.0` → `>=1.0.0 <2.0.0`); keep it wide enough for the previous
  release, which is the 24-hour window. `role: 'consumes'` marks another service's contract that
  this one calls.
- **What is served** is limited to the fields your installed openvibe-contracts
  `registry.release-manifest` schema declares: 1.0.0 until you pin openvibe-contracts ≥ v0.31.0.
  `release.validate()` checks the served manifest with your contracts (put it in a test), and
  `release.full()` is everything. A static-only release switch without a restart: pass
  `recheckMs`, or call `release.refresh()`.
- **Markup for in-place content**: `<main data-ov-content="pages" data-ov-rev="<revision>">…</main>`.
  The tab re-fetches the page URL (or `data-ov-src`) and takes the element with the same
  `data-ov-content`. Scripts and inline handlers are dropped, so rebind on `ov:content-updated`.
  A stylesheet whose URL path is not the asset's logical path needs `data-ov-asset="/css/app.css"`.
  Mark anything that must not be replaced with `data-ov-protected`.
- **Client generations and the shell (manifest 1.2.0, openvibe-contracts ≥ 0.60.0).** Pass
  `createRelease({ clientGeneration, minClientGeneration, shell })`. `clientGeneration` (an integer, or a
  function returning one) goes up only when an older client can no longer work against this server; the
  meta tag then carries `data-generation`. `minClientGeneration` (or env `MIN_CLIENT_GENERATION`) makes
  every tab below it reload at the next safe moment (`reloaded: required`), without waiting for the
  window. `shell` names the components that form the page shell (`['shell', 'nav']`); the manifest serves
  `{ version, components }`, and a tab whose shell version differs is prompted, never updated in place.
- **The update matrix (WS-P task 8)**, what an open tab does with each kind of change, each row tested
  (test/release-update.test.js, test/release.test.js):

  | Change | What the tab does | Events / counts |
  |---|---|---|
  | Stylesheet or theme (`style`) | loads the new `<link>` beside the old, swaps when every one loaded; a failure or 15 s timeout keeps the old | `ov:styles-updated`; `applied` or `failed: style/style-timeout` |
  | Content (`content`) | re-fetches the region, skips an unchanged `data-ov-rev`, keeps its scroll and what the reader sees above it | `ov:content-updated`; `applied` |
  | A widget inside a region | told to let go before its region is replaced, then to mount again | `ov:content-dispose`, then `ov:content-updated` |
  | A busy region (focus, unsent form, playing media, live camera/mic, `data-ov-protected`) | waits, and is replaced once it is not busy | `deferred` with the reason, once per release |
  | An account switched in place (the page's `openvibe-auth-changed` window event) while a region waits or is being fetched | the region is fetched again with the new session; what was fetched for the previous account is never committed (test/release-account-switch.test.js) | `deferred: account` |
  | Shell, router or any script (`script` and anything not in place) | prompts once; reloads only when it must | `prompted: optional` |
  | Security minimum (`min_client_release`), mixed-version window over, contracts out of range | reloads when safe (hidden or idle, nothing busy), prompting meanwhile | `prompted` and `reloaded: required/window/contract` |
  | Server only (`server`) | nothing to do in the tab | `applied: server` |
- **Release notifications (1.17.0).** When OpenVibe.Host announces a release, it publishes
  `host.release.published` (public, `ovhost deploy` / `ovhost announce`). release-watch opens one
  EventSource per tab, without credentials, on
  `https://events.openvibe.network/realtime/stream?topics=host.release.published`.
  - **Which events count.** Only events whose `payload.service` is the page's service: `OVReleaseConfig.service`,
    the meta tag's `data-service`, else the `service` of `/release.json`. The tab ignores the release it runs
    or already knows (a hex prefix counts as the same release) and repeats of an event, and runs its usual
    check once, after a random 0–20 s delay.
  - **Bursts.** At most one check per 30 s; anything that arrives in between collapses into one more.
  - **Account changes.** The events are public, so an account switch changes nothing and never opens a
    second stream. `/release.json` is read without credentials, so whether a tab updates never depends on
    who is signed in.
  - **Hidden tabs.** A tab hidden for 5 minutes closes its stream, and reopens it on return with
    `last_event_id`.
  - **Failures.** Errors back off from 30 s to 15 minutes. After 6 failures in a row only the poll is left,
    until the browser goes back online. Back online (the `online` event), the stream reconnects at once from
    its cursor, whether it had given up or was still backing off, and one check runs
    (test/release-offline-resume.test.js).
  - **Where to connect.** The default applies on https pages only. `OVReleaseConfig.eventsUrl` or the meta
    tag's `data-events` sets another URL, and `false` or `"off"` turns it off. Polling (focus, visibility,
    every 10 minutes) is unchanged.
  - **Origins.** Events answers `https://*.openvibe.*` origins, plus those in its `REALTIME_CORS_ORIGINS`.
  - **CSP.** The site's CSP `connect-src` must allow `https://events.openvibe.network`. Otherwise the
    browser refuses the stream once, and release-watch stops (state `blocked`) and keeps polling.
  - **State.** `OVRelease.state().realtime` reports `{ state, service, url, events, ignored, checks, failures, lastSeq }`.
- **Metrics (D46)**: `release_client_updates_total{outcome,reason}`, where outcome is `prompted`
  (reason `optional`, `required`, `window` or `contract`), `applied`, `reloaded`, `deferred` or
  `failed`. `release_client_sessions{generation}` counts open tabs heard from in the last 12
  minutes, `current` when they run the release this process serves and `older` otherwise: each tab
  beats every 5 minutes with a random id it keeps in memory only (never tied to an account) and
  says when it ends. The tab finds the endpoint in the manifest's `metrics_url` (set by `mount`),
  the meta tag's `data-metrics`, or `OpenVibeNavbar.init({ releaseWatch: { metricsUrl } })`.

Mixed-version test: capture the previous release's `/release.json` (its `full()` form) and the
calls its pages make as fixtures, then:

```js
const compat = require('openvibe-shared/release-compat');
await compat.assertMixedVersion({ releases: [
    { name: 'N-1', manifest: require('./fixtures/release-prev.json'), client: compat.replay(require('./fixtures/calls-prev.json')) },
    { name: 'N', manifest: release.full(), server: async () => ({ url, close }), client: compat.replay(calls) },
] });
```

It fails when adjacent releases' ranges don't overlap both ways, when a pair the manifests call
compatible fails against the real server, and when an incompatible pair would not make the tab
reload. `compat.openPage({ html, serve })` runs release-watch in a linkedom page (install
`linkedom` as a devDependency) for in-place tests of your own markup. `globals` adds window properties,
such as a fake `EventSource`, and `timeouts()`, `fireTimeouts(filter)` and `dispatch(type)` drive the
page's timers and events.

### Analytics (server, ADR-021)

```js
const Database = require('better-sqlite3');            // the service's own; Shared has no native dependency
const { AnalyticsTracker } = require('openvibe-shared/analytics');
const db = new Database('data/analytics.db');
db.pragma('journal_mode = WAL');
const analytics = new AnalyticsTracker(db, 'live', {
    retention: { days: 30 },                           // nightly prune (the default); false if you schedule it yourself
    paramPrefixes: ['avatar'],                         // extra words whose next segment is a parameter
    pathRules: [[/\/by-username\/[^/?#]+/gi, '/by-username/:username']],  // parameters the segment rules can't see
});
app.use(analytics.middleware());
```

A raw event has no IP, user or subject id, or city. It has a route template (never a raw URL), a
referer origin, a user-agent class, a rotating session id and a country. Raw events are kept for
30 days, and the rollups for longer. A request with `Sec-GPC: 1` or `DNT: 1` is not recorded at
all. The row shape is `analytics/event.v1` (`docs/schemas/analytics-event.v1.json`), and
`require('openvibe-shared/analytics/event').checkRow(row)` checks a stored row against it. The
prune and one-time scrub command is `openvibe-shared/analytics/prune-cli`: a service wraps it in
its own `scripts/analytics-prune.js` and passes in its `Database` and default paths.

### Browser side: two options

1. **From the Network** (what most pages do today):
   `<script src="https://openvibe.network/shared/navbar.js" defer></script>`. Network serves the
   browser files of the version it pins, from its own `node_modules/openvibe-shared`.
2. **From the site's own origin**: the page's first paint doesn't depend on the Network being
   up, and the files match the version the site's server pins. Serve exactly the browser files
   from `node_modules`:

   ```js
   const shared = require('openvibe-shared/files');
   app.use('/shared', (req, res, next) => {
       const name = path.basename(req.path);
       if (!shared.isBrowserFile(name)) return next();
       res.setHeader('Access-Control-Allow-Origin', '*');
       res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
       res.sendFile(shared.path(name));
   });
   // Web Push worker: same origin, scope "/"
   app.get('/openvibe-sw.js', (req, res) => { res.setHeader('Service-Worker-Allowed', '/'); res.sendFile(shared.path('openvibe-sw.js')); });
   ```

   Never `express.static` the whole package directory. It also holds server code, tests and
   scripts.

**navbar.js and `nav-icons.js`.** navbar.js draws the icons for its own rows inline. The rest
of the Font Awesome glyph set sites name in `links`, `chips` and menu sections lives in
`nav-icons.js`. navbar.js fetches that file once, after first paint, from **the same directory
navbar.js was loaded from**, as `nav-icons.js?v=<first 12 hex of its sha256>`. It falls back to
`https://openvibe.network/shared/` when navbar.js is bundled or inlined.

So wherever you serve navbar.js, serve `nav-icons.js` beside it. The `?v=` matches the file's
content hash, so it can be cached as immutable.

Until the glyphs arrive, each icon's slot has the right width and nothing moves. If the file
can't load, those icons fall back to `<i class="fa-solid …">`. Two options change this:

- `OpenVibeNavbar.init({ iconsUrl })` points navbar.js at another URL.
- Loading `nav-icons.js` *before* navbar.js puts every glyph in the first frame.

**The notification bell in realtime (1.22.0, off by default).** `OpenVibeNavbar.init({ notificationsRealtime: true })`, or `OpenVibeNotifications.init({ realtime: true })` where a site mounts the bell itself, makes the bell hear the person's new notifications as they happen. It uses Network's `network.notification.created` over OpenVibe.Events' realtime stream (ADR-005 amendment 2).
- **Loading.** notification-ui.js then loads `notification-live.js` from its own directory, so serve it beside notification-ui.js (it is in `files.js`).
- **Each (re)connect.** It asks Network for a two-minute ticket (`POST https://openvibe.network/api/v1/realtime/ticket`) with the page's Bearer token, or with the session cookie on openvibe.network itself. It then opens `https://events.openvibe.network/realtime/stream?topics=network.notification.*&ticket=…` without credentials, resuming with `last_event_id`.
- **What it reacts to.** On an event whose subject is the person, it re-reads the unread count and toasts what is new: one request per burst. On `event: gap` it also reloads the open lists.
- **Polling stays:** every 15 s without a stream, and every 2 min while the stream is open, as a safety net for reads made on other sites.
- **Retries and giving up.**
  - Errors back off from 2 s, with jitter. After ten failures in a row the bell polls only, until the browser comes back `online`.
  - A tab hidden 5 minutes closes the stream and resumes it when shown.
  - A Content-Security-Policy refusal, a signed-out 401/403, or Network's `REALTIME_TICKETS=off` (503) stop the stream, and the bell polls.
- **The site's CSP** needs `connect-src https://events.openvibe.network` (and `https://openvibe.network` for the ticket, which the bell already calls). `OpenVibeNotifications.realtimeState()` reports the feed's state.

### Boost (`boost.js`): smooth page moves for a server-rendered site

Every page stays a normal page (it works without JavaScript and crawlers read the same HTML); boost only makes a same-site
move feel like an app. Mark the page and its changing part, then start it:

```html
<meta name="ov-boost" content="<site>@<release>">   <!-- the release id: a different one means a normal page load -->
<main id="main">…</main>
<script src="/shared/boost.js" defer></script>
<script>addEventListener('DOMContentLoaded', () => OVBoost.start({ main: '#main' }));</script>
```

A click on a same-site link (no modifier key, no target, no download, not `data-no-boost`, not `/auth/`, `/api/` or a
file) fetches the page (already prefetched on hover, focus or touch), loads its new stylesheets first, swaps `<main>` in
place with `route-transition.js`'s bar and fade, updates the title, description, canonical, Open Graph, Twitter and
JSON-LD tags, runs the new main's inline scripts once, pushes history, restores scroll on back and forward, and focuses
the new content. Another release marker, other external scripts, a non-HTML answer, a redirect off the site, an error
or a timeout is a normal load. Listen for `ov:boost:before` and `ov:boost:load` to tear down and wire widgets.
`OVBoost.start(opts)` returns `{ go(url), stop(), stats() }`; options: `main`, `prefix` (`ov`), `exclude` (path
prefixes), `timeout` (8000 ms), `prefetch` (true), `fx` (true).

### The web runtime (`web-runtime.js`, `route-transition.js`)

```text
openvibe-shared/web-runtime.js — a site's feature loader and route lifecycle (roadmap WS-P task 6), taken out of
OpenVibe.Live's public/js/ov-loader.js so every OpenVibe site loads its code the same way.

  const rt = OVWebRuntime.create({ features, routes, versions, ... });   // registry: see README "Web runtime"
  rt.load('broadcast')      → the feature's stylesheets (its dependencies' too) and markup fragment together, the markup
                              inserted once the styles are in (never unstyled), then its dependencies and scripts (in
                              order) and its `after` hook; once, cached; a failed load can be retried.
  rt.route(path)            → every feature the path's routes name, as one promise.
  rt.enter(section, work, { label })
                            → a page while its route loads: hidden (keeping its space) until its styles and code are in;
                              route-transition.js (loaded on the first move) adds the top bar, a "Loading <label>…" line
                              after 150 ms with the phase, and the fade-in. rt.status(text) changes that line.
  rt.prefetch('channel')    → download only (link rel=prefetch), never execute; skipped on Save-Data, 2g and < 2 GB
                              of memory, and within a budget (count, and bytes where sizes are known).
  rt.nextRoute() / rt.gen() / rt.isCurrent(gen)
                            → route generations: a loader that awaited something can tell whether the visitor moved on.
  rt.scope()                → timers, listeners, observers, fetches (AbortSignal) and child scopes owned by the current
                              route, released by the next nextRoute(). Anything registered on a scope whose route has
                              ended is refused (and counted), never left running.
  rt.diagnostics(), rt.leaks()
                            → loaded, failed and rolled-back features, duplicate tags, late registrations, what the
                              current route holds, and the prefetch budget spent.

Asset groups are transactional: a feature counts as loaded, runs its hook and fires `<prefix>:feature` only when
every script loaded. When one fails, the stylesheets that attempt added (and no other feature wants) are taken out
again and the failed script's tag is removed, so a retry fetches exactly what is missing. Scripts that did run are
kept, so nothing runs twice.
Tags the server already put in the document count as loaded. Global stubs (installStubs) keep inline onclick
handlers working before their feature has loaded.
```

### The navbar (`navbar.js`)

```text
Consistent top bar across all services with logo, navigation,
notification bell, account switcher, and theme-aware styling.
Usage: OpenVibeNavbar.init({ service, token, user, apiBase })
  Optional: loginUrl (override the Sign In href), sessionUrl (same-origin
  endpoint returning { user } — asked when no usable ov_token exists, including
  when a stored token turned out stale), logoutUrl (where Sign out goes, e.g. the
  site's '/auth/logout?next={path}', so a server-side session ends too; {url} is
  the full return URL, {path} its local path — loginUrl takes both too),
  onLogin/onLogout callbacks. When no `user` is passed the navbar resolves
  it itself: ov_token cookie → localStorage → token opt → sessionUrl, then
  GET {apiBase}/api/auth/me with `Authorization: Bearer <token>`.
Brand: derived from the hostname — `pastes.openvibe.tools` renders as
  Pastes · OpenVibe · Tools (three segments, the subdomain first so the
  context reads left-to-right), `openvibe.live` as OpenVibe · Live. Pass
  brand: { sub, tld, name, icon, variant } to override any part, or the
  legacy brandName/brandIcon. compact: 'auto' (default — the brand shortens
  to the subdomain on narrow viewports), 'always', 'never'.
Menus are modular: every site keeps the shared account menu and adds its own
  pieces — links: [{label, href, icon?, active?}] replaces the service's top
  links; menu: { before: [item], after: [item] } adds dropdown rows
  ({label, href, icon, onClick, danger, external}); OpenVibeNavbar.addMenuItem()
  / setLinks() do the same at runtime. Signed-in users also get a
  "Recently used" row fed by the shared history module when it is loaded.
```

Dropdowns under a top link (`children`) are fixed-positioned under their link when they show (hover, keyboard focus, a tap), because the links row scrolls sideways and would clip them.

## Development

```bash
npm ci
npm test                         # every test/*.test.js (fnm exec --using=22.22.1 npm test)
npm test -- navbar               # only matching files
npm run size                     # raw + brotli (q11) size of every browser file
python3 scripts/build-nav-icons.py --font …/fa-solid-900.woff2 --css …/fontawesome.min.css
node scripts/build-theme-loader.js
```

Tests are plain Node with stubbed browser globals. Some tests guard the release:

- **navbar.js size budget**: 29 KB brotli (`test/nav-icons.test.js`). release-watch.js and
  release-update.js: 5 KB and 3.5 KB (`test/release-update.test.js`).
- **Releases (ADR-016)**: the manifest validates against the installed openvibe-contracts (and
  the 1.1.0 schema), in-place updates are transactional and never replace a region in use, the
  reload rules hold, and the mixed-version matrix runs against real servers
  (`test/release*.test.js`).
- **Built-in icons**: every icon the default navbar renders must be built in and drawn with no
  fetch.
- **Generated blocks**: the generated navbar and theme-loader blocks must be up to date.
- **Browser bundles**: browser files must be free of `require()` and Node globals
  (`test/browser-bundles.test.js`).
- **Exports**: every export must resolve, and every module file (including `analytics/*.js`) must
  have one.
- **Analytics (ADR-021)**: no personal data in any table after real requests, opt-out requests
  leave nothing, every row is a valid `analytics/event.v1`, prune/scrub keep rollups intact, and
  the prune CLI's dry run changes nothing (`test/analytics-*.test.js`, with `better-sqlite3` as a
  dev dependency).

CI runs on Node 22.22.1 and installs a tag-style tarball into an empty project.

## Releasing

1. Land the change on `main` with tests green. Add an entry under a new version heading in
   `CHANGELOG.md`, and set the same version in `package.json`.
2. Commit (`Release vX.Y.Z`), then tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`. Push `main` and the tag.
   CI runs on the tag.
3. **Tags are immutable.** Never move or delete a released tag. Consumer lockfiles pin its
   tarball's integrity hash. A fix is a new patch release.
4. Upgrade Network first, because it serves `https://openvibe.network/shared/*` to every site.
   Then upgrade Live, Community, Media, Tools and Sites: change the tag in the URL, run
   `npm install`, commit the lockfile and deploy.

GitHub builds tag tarballs on demand. In practice they're byte-stable, but GitHub doesn't
promise it. If `npm ci` ever reports `EINTEGRITY` for this package on an unchanged tag, check
that the tag wasn't moved, then run `npm install` to refresh the lockfile. The content is the
tag's tree either way.

## Compatibility policy

- **Semver.** Major releases are for breaking changes: removing or renaming an exported
  subpath, an export, a browser global (`OpenVibeNavbar`, `OpenVibeFooter`, …) or a served file
  name, removing an init option, or changing markup, classes or defaults that sites style or
  script against. Minor releases add modules, options or files. Patch releases are fixes with no
  API change.
- **The previous major stays servable.** Network serves each major it supports at
  `/shared/v<major>/<file>`. It keeps the older major installed side by side
  (`"openvibe-shared-v1": "<v1 tarball URL>"`) for at least 90 days after the next major ships,
  and for as long as any consumer or published HTML still references it. That includes the
  pre-rendered pages in `OpenVibe.Sites/dist/`.
- **Unversioned paths never jump a major silently.** `/shared/<file>` keeps serving the major it
  served before. It moves to a new major only after every consumer has either moved to it or
  switched to an explicit `/shared/v<major>/` path. Because navbar.js loads `nav-icons.js` from
  its own directory, a versioned navbar always gets the icons of its own release.
- A new browser file is added to `files.js` in the same release, so sites that serve from
  `node_modules` pick it up.

**Web runtime: a site's feature loader (1.23.0).** `web-runtime.js` (`OVWebRuntime`) is OpenVibe.Live's route loader, made shareable (roadmap WS-P task 6). A site describes its features once and loads each when it is needed:

```js
const rt = OVWebRuntime.create({
    features: { player: { fragment: 'player', deps: ['base'], css: ['/css/player.css'], js: ['/js/p1.js', '/js/p2.js'], after: 'initPlayer', stubs: ['openPlayer'], idle: ['ops'] } },
    routes: [{ path: '^/watch/', features: ['player'] }],   // path: a RegExp or its source
    versions: { '/js/p1.js': '<hash>' },                     // → /js/p1.js?v=<hash>; or url: (p) => …
    styleSlot: (href) => node,        // insert a stylesheet before this node (cascade order); default: last in <head>
    fragmentPath: (name) => `/fragments/${name}.html`,       // loaded into #page-<name> (or `section`) once
    prefetch: { count: 60, bytes: 3 * 1024 * 1024, sizes: { '/js/p1.js': 12345 } },
    onStubError: (err, feature) => toast('That part of the site could not load.'),
    routeError: { icon: 'fa-solid fa-plug-circle-xmark' }, debug: false, eventPrefix: 'ov',
});
rt.boot({ initial: ['player'] });     // adopt the server's tags, load these, prefetch on link intent and when idle
```

- **Loading.** `load(name)` puts in the feature's fragment first, then its dependencies, then its stylesheets and scripts (injected together, run in order), then calls `after` once. It fires `ov:feature` (and `ov:fragment` on the section). One promise per feature; tags already in the document count as loaded. `route(path)` loads every feature its routes name. `loadScript(src, { integrity, crossOrigin })` and `loadStyle(href)` load single files once, another origin's included.
- **Transactional groups.** A feature is loaded only when every script loaded. When one fails, the attempt's own stylesheets leave the document (unless another feature wants them), the failed tag is removed, no hook runs, and a retry fetches only what is missing. A script that ran is never fetched or run again. A missing stylesheet never blocks: it waits at most 4 s.
- **Route scopes.** `nextRoute()` starts a generation (`gen()`, `isCurrent(gen)`) and ends the previous route's scope. `scope()` owns `interval`, `timeout`, `listen`, `observe`, `onDispose`, `fetch` (its `signal` aborts when the route ends) and `child()` scopes for one component. Anything registered on an ended scope is refused and counted, never left running (`debug: true` also warns).
- **Prefetch.** `prefetch(name)` and `prefetchRoute(path)` download without running (`link rel=prefetch`). Hover, focus and touch on in-site links prefetch their route. They skip Save-Data, 2g and devices under 2 GB of memory, and stop at the budget: a count, and bytes where `sizes` are known.
- **Diagnostics.** `diagnostics()` lists loaded, loading and failed features, failed and rolled-back assets, duplicate tags in the document, late registrations, what the current scope holds and the prefetch budget spent. `leaks()` returns the problems as sentences, or `[]`. Browser smoke tests can compare them across navigations.
- **Also:** `installStubs()` (global functions that load their feature, then call the real one, for inline handlers) and `showRouteError(pageId, err, retry)` (a retry box built from DOM nodes).

It is 6.1 KB brotli (budget 6.5 KB). Serve it beside the other browser files and load it before the site's own loader. `test/web-runtime.test.js` (linkedom) and `test/web-runtime-chrome.test.js` (headless Chrome: real 404s, ordering, scopes) cover it.

## Purpose

The canonical home of what was `OpenVibe.Network/packages/openvibe-shared` (navbar, footer,
themes, icons, legal pages, SEO helpers, notifications UI, panels): the OpenVibe Frame and the
server helpers every site uses, published as immutable versioned artifacts instead of being
vendored or rsynced from Network.

## Owns

- the `openvibe-shared` package (one package with subpath exports; the charter's
  `@openvibe/tokens|ui|frame|auth-ui|seo|legal|icons|release-client|web-runtime|server-web|testing-web`
  split was decided against in [docs/adr/0001-one-package-subpath-exports.md](docs/adr/0001-one-package-subpath-exports.md))
- design tokens and theme rendering, the navbar, footer and panels of the OpenVibe Frame
- the release manifest client (active-tab update coordinator) and the web runtime (feature loader)
- server helpers: readiness, metrics, trace, egress, config, analytics, legal, SEO

## Does not own

- theme *authority* (OpenVibe.Network owns the theme API and preferences)
- identity, notifications and the changelog (OpenVibe.Network, OpenVibe.Blog); the browser files
  only display them
- any service's data: it has none (artifact repository)

## Depends on

- `jsonwebtoken` (the only runtime dependency, for `auth-client`)
- OpenVibe.Contracts (the release manifest contract; `openvibe-contracts` v0.61.0 is a devDependency
  the tests validate against)
- in the browser, at run time: OpenVibe.Network (sessions, notifications and realtime tickets, the
  changelog feed) and OpenVibe.Events (the realtime stream for the notification bell)

## Capabilities

None: Shared implements no capability and holds no grant. Browser files call Network and Events as the
signed-in person (their session cookie or a Network realtime ticket), and server modules call whatever
their consumer configures with the consumer's own credentials.

## Acceptance

`npm test` runs every `test/*.test.js` (plain Node with stubbed browser globals; the `*-chrome` tests
need Chrome). What the release-guarding tests prove is listed under [Development](#development): size
budgets, releases and the mixed-version matrix, built-in icons, generated blocks, browser bundles free of
Node code, every export resolving, analytics privacy. The charter's two acceptance points hold: Live,
Community, Media, Tools and Sites consume pinned versions with no manual copies, and
`openvibe.network/shared/*` keeps serving version-pinned files.

## Security

Reporting a vulnerability: [SECURITY.md](SECURITY.md). Shared's code runs on every site, so:

- browser files carry no secrets and no Node code (`test/browser-bundles.test.js`);
- `egress` gives services SSRF-safe addresses and connect-time DNS checks for user-chosen hosts
  (`test/egress.test.js`); `trace` forwards the W3C trace only to loopback and OpenVibe hosts;
- analytics stores no personal data and honours opt-out (`test/analytics-privacy.test.js`);
- `/metrics` from `openvibe-shared/metrics` answers direct loopback callers only;
- tags are immutable, so a consumer's lockfile integrity hash always names the same code.

## Deploy

Nothing runs from this repository. A release is a git tag ([Releasing](#releasing)). OpenVibe.Network
serves `https://openvibe.network/shared/*` from the tag it pins, so a Network deploy
(`sudo ovhost deploy network`) publishes a release to every site that loads the Frame from there. A site
can instead serve its own pinned copy (`openvibe-shared/serve`); either way each consumer pins a tag and
ships it with its own deploy.
A bad release is undone by pinning the previous tag; a released tag is never moved.

---

Part of the [OpenVibe network](https://openvibe.network). Built in the open by [OpenVibers](https://github.com/OpenVibers).
