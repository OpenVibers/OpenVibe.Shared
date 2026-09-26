# OpenVibe.Shared

> Versioned UI, the OpenVibe Frame (the navbar, footer and "shipped" views every site sits in), SEO, legal and release-client packages every OpenVibe site renders.

**Status:** alpha. The `openvibe-shared` package lives here; the latest tag is v1.4.0, and 1.5.0 (Track R:
release manifests, in-place updates in open tabs, update metrics, the mixed-version harness) is on
`main`, untagged. Every deployed consumer installs a tagged release and none keeps a
vendored copy ([docs/migration-plan.md](docs/migration-plan.md) is done): v1.3.0 in Network, Live,
Media, Community, Tools, Events, Codes, Wiki, Blog, News, Reviews, Deals, Coupons, Trade, VIP and
Host; v1.2.1 in Tips and OpenRe.Stream; v1.0.0 in Sites. CI failed on the v1.3.0 tag (`1173562`,
a race in the event-loop-lag p99 test, not in the package); `f81e54b` on `main` fixes the test and
is green, untagged.
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
| Browser scripts, served at `/shared/<file>` (listed in `files.js`) | `navbar.js`, `nav-icons.js`, `theme-loader.js`, `footer.js`, `notification-ui.js`, `account-switcher.js`, `user-card.js`, `ov-mark.js`, `ov-icons.js`, `history.js`, `sso-client.js`, `panels.js`, `ui.js`, `island.js`, `tooltip.js`, `release-watch.js`, `release-update.js`, `openvibe-sw.js` |
| Node modules (`require('openvibe-shared/<name>')`) | `index` (`.`), `analytics` (+ `analytics/{privacy,tracker,retention,schema,event,prune-cli}`), `app-icon`, `auth-client`, `brand`, `builtin-themes`, `frame` (the OpenVibe Frame on the server; `chrome-ssr` is a deprecated alias), `legal`, `middleware`, `notifications`, `seo`, `theme-sync`, `url-resolver`, `files`, `egress` (SSRF-safe addresses and connect-time DNS for outbound fetches of user-chosen hosts), `trace` (the request's W3C trace on outbound calls inside the network), `release`, `release-compat` (tests), `metrics`, `ready`, `config` (the configuration model: revisioned, validated, classified settings with last-known-good and `/api/admin/config`), `perf-budget` (size budgets for a page's first load, measured from the running server: HTML, same-origin scripts and stylesheets, raw and brotli; for `npm test`), `browser-harness` (real-Chrome checks of a running site: status, console errors, overflow, duplicate scripts, no-JS text, canonical, JSON-LD against visible text, axe-core, repeated-navigation growth and idle work; Node 22, Chrome); `footer`, `shipped` (the shared "shipped X ago" pill, recent list and `/updates` log, from the network changelog) and `icons` (= `ov-icons.js`) work on both sides, and `release-update` gives Node its pure `plan()` |
| Schemas | `docs/schemas/analytics-event.v1.json` (`analytics/event.v1`, exported as `openvibe-shared/analytics/event.v1.json`) |
| Generators | `scripts/build-nav-icons.py` (Font Awesome glyphs → `nav-icons.js`, `ov-icons.js`), `scripts/build-navbar-icons.js` (navbar.js's built-in glyphs), `scripts/build-theme-loader.js`, `scripts/build-app-icons.js` |

Every module file has an explicit `exports` entry (no wildcards), so `require('openvibe-shared/navbar')`,
`require.resolve('openvibe-shared/package.json')` and the rest all resolve. It stays one package with
subpath exports rather than a set of `@openvibe/*` packages:
[docs/adr/0001-one-package-subpath-exports.md](docs/adr/0001-one-package-subpath-exports.md).

## Consuming it

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

### Metrics and readiness (server)

```js
const release = require('openvibe-shared/release').createRelease({ service: 'community' });
const m = require('openvibe-shared/metrics').instrument(app, { service: 'community', release: release.release });
// before any route: HTTP golden signals by route template, process metrics, release_info,
// and GET /metrics for direct loopback callers only (404 through a proxy)
m.registry.gauge({ name: 'jobs', help: 'Jobs by state', labelNames: ['state'], collect: () => rows });

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

### Configuration (server, WS-C task 7)

`openvibe-shared/config` keeps one namespace of a service's configuration as immutable revisions
(`common.config-snapshot@1`) in the service's own SQLite database. No new dependency: pass the
better-sqlite3 handle. Several namespaces share one database (tables `config_snapshots` and
`config_keys`).

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
    second stream.
  - **Hidden tabs.** A tab hidden for 5 minutes closes its stream, and reopens it on return with
    `last_event_id`.
  - **Failures.** Errors back off from 30 s to 15 minutes. After 6 failures in a row only the poll is left,
    until the browser goes back online.
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

## Charter

The canonical home of what was `OpenVibe.Network/packages/openvibe-shared` (navbar, footer,
themes, icons, legal pages, SEO helpers, notifications UI, panels). It is published as
immutable versioned artifacts with a CDN-compatible mirror, instead of being vendored or
rsynced from Network.

**Owns**
- `@openvibe/tokens|ui|frame|auth-ui|seo|legal|icons|release-client|web-runtime|server-web|testing-web`
  (today still one package, `openvibe-shared`)
- design tokens and theme rendering
- release manifest client (active-tab update coordinator)

**Does not own**
- theme *authority* (OpenVibe.Network owns the theme API and preferences)
- identity

**Planned surfaces**
- a vanilla-JS-compatible build (no framework rewrite required)
- pinned versions, selective entry points and content-addressed browser assets
- local/mirrored serving, so a Network outage doesn't blank every page

**Data:** none (artifact repository). **Capabilities and events:** package APIs only; release
manifest notifications (client side). **Depends on:** OpenVibe.Contracts (release manifest
contract).

**Acceptance (must be true before "done")**
- Live, Community, Media, Tools and Sites consume pinned versions with no manual copies
- old `openvibe.network/shared/*` URLs keep serving version-pinned mirrors during migration

---

Part of the [OpenVibe network](https://openvibe.network). Built in the open by [OpenVibers](https://github.com/OpenVibers).
