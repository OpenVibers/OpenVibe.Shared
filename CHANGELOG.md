# Changelog

All notable changes to `openvibe-shared`. Versions follow [semver](https://semver.org/): a
breaking change to any exported module, browser global or served file name is a new major.
A release is the git tag `vX.Y.Z`; consumers pin the tag's tarball (see README).

## 1.17.0 — 2026-09-26

**Release notifications in `release-watch.js`** (roadmap WS-P task 9, ADR-016 amendment 1). When a release goes live, OpenVibe.Host publishes `host.deploy.activated` to OpenVibe.Events (contract `host.deploy.activated@1`, openvibe-contracts 0.58.0; `ovhost deploy` and `ovhost announce`). The event is public, has subject `release` and carries `service`, `release`, `commit` and `origin`. Tabs now hear about a release within seconds instead of at their next poll:
- **One stream per tab.** release-watch opens one EventSource, without credentials, on `https://events.openvibe.network/realtime/stream?topics=host.deploy.activated`, once the page's release and service are known.
- **Which events count.** Only those for the page's service: `OVReleaseConfig.service`, the meta tag's `data-service`, else `/release.json`'s `service`.
- **Generations.** The tab ignores the release it runs, the one it already knows from `/release.json` and one already queued (a hex prefix of the other counts as the same release). It also ignores a repeated event id and a seq at or below the last one seen.
- **Coalescing.** A new release runs the usual `check(true)` after a random 0–20 s delay, so tabs do not all fetch at once. Everything arriving while that check is pending collapses into it, and after a check there are 30 s of quiet, after which whatever arrived meanwhile gets one more check. The update plan, the prompt and the safe-reload rules are unchanged.
- **Gaps.** An `event: gap` (events missed while away) also runs a coalesced check.
- **Account switches.** The events are public, so `openvibe-auth-changed` changes nothing, and a second load of the script still returns early, so there is never a second EventSource.
- **Hidden tabs.** A tab hidden for 5 minutes closes its stream: the poll and the check on becoming visible cover it, and it reopens on return with `last_event_id`.
- **Failures.** An error closes the stream at once, rather than letting the browser retry every 3 s, and it reopens after 30 s, doubling to 15 minutes, with jitter. After 6 failures in a row only polling is left until the browser comes back online.
- **Polling.** Unchanged throughout (focus, visibility, `online`, every 10 minutes). Without EventSource, or when Events cannot be reached, nothing else changes.
- **Configuration.** The default URL applies on https pages. `OVReleaseConfig.eventsUrl` or the meta tag's `data-events` sets another URL, and `false` or `"off"` turns it off. Events answers `https://*.openvibe.*` origins and those in its `REALTIME_CORS_ORIGINS`; elsewhere the stream fails and backs off.
- **State.** `OVRelease.state().realtime` reports `{ state, service, url, events, ignored, checks, failures, lastSeq }`.

`release-watch.js` is 4.6 KB brotli (was 3.2 KB). Its budget in `test/release-update.test.js` moves from 3.5 KB to 5 KB for this.

`release-compat` `openPage()` also takes `globals` (extra window properties, such as a fake `EventSource` or a `Math` with a fixed `random`). It adds `timeouts()` (the pending delays), `fireTimeouts(filter)`, `dispatch(type)` and `timeoutsSet`.

Tests are in `test/release-watch-realtime.test.js`. Additive.

## 1.16.1 — 2026-09-26

Fix: the **OV mark** (`ov-mark.js`) no longer animates forever. Its SVG animations restyle and re-lay-out on the main thread every frame, which kept every idle page with the navbar 12–29% busy (the browser check counted 8–19 endless animations per page). A mark now moves for the intro (the first 8 s of a visit in a tab, from the first time a mark is on screen; the next page of a multi-page site finishes that intro rather than starting another), while it or its link is hovered or focused (plus 1.2 s), and while it shows activity (`data-state` busy/ok from `island.js`). Otherwise its CSS animations are paused where they are and its SMIL clock is stopped, so it keeps its look. It never moves while the page is hidden, while it is off-screen (IntersectionObserver), with `data-static`, under `prefers-reduced-motion` or under the network's own reduced-motion setting (`html[data-ov-motion=reduced]`); the V's light sweep, a SMIL animation, used to keep running in all of those. Measured in headless Chrome after five page loads: 12 running animations and 16.5% CPU before, none and 0% after. `test/ov-mark.test.js`. Sites pick it up with their `openvibe-shared` pin (the file is `/shared/ov-mark.js`); pages that load it from openvibe.network get it when Network's pin moves.

## 1.16.0 — 2026-09-26

**`openvibe-shared/browser-harness`** (roadmap WS-Q task 3, WS-T tasks 3 and 4): Live's browser smoke suite, generalised for any site. It drives headless Chrome over the DevTools protocol with Node's own WebSocket (Node 22+, no dependency), one browser context per route. `run({ base, routes, widths, checks, navigation, … })` checks every route at 390, 768 and 1280 px: the HTTP status (a route can expect 404), console errors (exceptions, `console.error`, failed loads, CSP), horizontal overflow (naming the elements) and scripts requested twice. With JavaScript off it checks the visible text (200 characters), exactly one absolute canonical link (a noindex page may have none), and that JSON-LD parses and its headline or name is in the visible text. For an ItemList, at least 80% of the item names must be visible. axe-core runs at the widest width: serious and critical violations fail, moderate is reported. Once per site, A → B → A navigation runs five times, clicking a link when there is one so a single-page app navigates in place. After a forced GC it samples heap, DOM nodes, listeners and documents (`Performance.getMetrics`), plus live intervals, pending timeouts and open WebSockets (a probe installed before page scripts). A measure fails when it grows past its budget from lap 2 to the last lap and is still growing (`BUDGETS`). CPU, requests and bytes over 5 idle seconds are reported, not failed. `ignoreErrors` rules are counted per label, never dropped silently. `format()` gives text or Markdown, and `summarize()` gives per-check counts. axe-core is not vendored: an installed `axe-core` is used, else 4.13.0 comes from jsDelivr, checked against a pinned sha384 (the same bytes as the npm tarball) and cached. `test/browser-harness-chrome.test.js` runs it in real Chrome against a fixture and skips without Chrome. Additive.

Fix: the selected filter chip of the shared update log (`shipped.js`, every site's `/updates`) was white on `--accent` (3.67:1). It now uses `--accent-strong` / `--on-accent-strong` (4.5:1 or better in every theme), like the navbar's Sign In button. The harness found it.

## 1.15.0 — 2026-09-26

**`openvibe-shared/perf-budget`** (roadmap WS-T task 1): size budgets for a page's first load, measured from the running server with no browser. `measure({ base, path })` fetches the page and every same-origin script and stylesheet it names. It reports the files and their raw and brotli KB; cross-origin assets are listed as `external` and not weighed. `check(m, budgets)` lists the budgets exceeded, and `format()` is the failure message.

## 1.14.0 — 2026-09-26

**`openvibe-shared/config`, the configuration model** (roadmap WS-C task 7): `createConfigStore({ db, service, namespace, schema, validate, classify, defaults, legacy, onActivate })` keeps one namespace of a service's configuration as immutable revisions (`common.config-snapshot@1`) in the service's own better-sqlite3 database (`config_snapshots`; several namespaces per database). `get()` serves the active values from memory; `propose`/`activate`/`apply` validate (a built-in JSON Schema subset and/or `validate()`), classify every key (public, internal by default, secret) and activate in one transaction, and a throwing `onActivate` puts the last-known-good back in memory and in the database, rejects the new revision with the error and throws it. `rollback()` activates a copy of the previous good revision (or `to`) as a new revision; `history()`, `lastKnownGood()` and `summary()` are redacted: a secret is `{ redacted: true, fingerprint }`, an HMAC-SHA256 under a random 32-byte key made per namespace on first use (`config_keys`; never served, never logged), a snapshot's checksum covers the values as shown, and secret values never leave or reach the log. A marker sent back keeps the secret it stands for only when its fingerprint matches. Revision 1 comes from `defaults` or a legacy source (`legacy`, `import()`, `fromRows()` for typed key-value rows). `adminRoutes(stores, { requireAdmin })` serves `GET /api/admin/config`, `GET /api/admin/config/:namespace/history`, `POST /api/admin/config/:namespace` and `POST /api/admin/config/:namespace/rollback` with problem+json errors, on Express or plain http, without depending on either. No new dependency. Additive.

## 1.13.0 — 2026-09-25

Accessibility (roadmap WS-T task 3), from an axe survey of every site. The navbar's **Sign In** button read at 3.67:1 (white on #3b82f6) on nine sites: every theme now derives **`--accent-strong` / `--on-accent-strong`**, the accent deepened (under white) or lightened (under dark ink) just enough for 4.5:1, and the button uses them (`test/login-contrast.test.js` checks all 35 themes). The two tokens are in `theme-sync` and the loader's map. The **footer** reads `{ label, href }` items as `{ name, url }`, so a site passing the navbar's shape no longer renders empty links (Media and Games did). Additive.

## 1.12.0 — 2026-09-24

- **`openvibe-shared/serve`: a site serves its own pinned copy of the shared browser files.** Mount it with `app.use('/shared', serve.handler())` and reference files with `serve.url('navbar.js')`, which gives `/shared/navbar.js?v=<content hash>`. The current hash is cached immutably, anything else for five minutes. ETag is the hash, the files are CORS-open and cross-origin readable, and only the files `openvibe-shared/files` lists are served. A site's pin then decides what its pages run, and the Frame keeps working while openvibe.network is down.
- The navbar loads its lazy siblings from wherever it was itself loaded: `nav-icons.js`, `release-watch.js`, `ov-icons.js`, `panels.js`, `notification-ui.js`, `ov-mark.js`, `sso-client.js` and `history.js`. Before, several were always fetched from openvibe.network (or the `apiBase`); the network's copy is now only the fallback. The footer already loaded `shipped.js` this way.

## 1.11.1 — 2026-09-24

Fix: the footer's "shipped X ago" line uses the footer's own `service` (`live`, `wiki`, …). Before, it resolved the page's hostname, so a local or unmapped host showed the whole network. A site id that is not a registry id (a Tools satellite's `dev`) falls back to the hostname rather than to the whole network.

## 1.11.0 — 2026-09-24

**The OpenVibe Frame.** The shared navbar, footer and "shipped" views every OpenVibe site sits in were called the "chrome", which was borrowed jargon easily mistaken for the browser. They are now the Frame:

- `openvibe-shared/frame` is the server module (formerly `openvibe-shared/chrome-ssr`, which stays as a deprecated alias until 2.0.0).
- The navbar and footer read `https://openvibe.network/api/frame` (Network keeps `/api/chrome` as an alias for older copies) and send their page-view beacon to `/api/frame/hit`.
- They share `window.OpenVibeFrame`; `OpenVibeChrome` points at the same object.
- The browser cache key is `ov_frame_v1`.

No behaviour change.

## 1.10.0 — 2026-09-24

`openvibe-shared/chrome-ssr` gains the server-side pieces of the shared update system, so every site renders the same markup instead of its own copy:

- `shipped({ service, updates, title, limit })`: the home page block (the pill and the recent changes), with a plain link without JavaScript.
- `updatesBody({ service, siteName })`: the body of a site's `/updates` page. Without JavaScript it falls back to openvibe.network's server-rendered log.
- `shippedScript()`: the script tag.

`shipped.js` styles both. Additive.

## 1.9.0 — 2026-09-24

- **One "shipped" and update-log system for every site** (`shipped.js`). There are three views: `latest` (the "🚀 shipped 5m ago: …" pill), `list` (the recent changes plus the latest Patch notes link and an "All updates" link) and `log` (a full `/updates` page: changes grouped by day, "Load more" by cursor, this site or the whole network with a filter per site, and the Patch notes posts). Views mount from markup, `data-ov-shipped="latest|list|log"` with `data-service`, `data-limit`, `data-more` and `data-href`, when the script loads, or from code with `latest()`, `list()` (`mount()`), `log()` and `scan()`. The feed is now `https://openvibe.network/api/v1/changelog`, a cached proxy of OpenVibe.Blog's changelog that every site's CSP already allows. One request is shared per page; the "ago" text stays current; `serviceFor(host)` maps hostnames to registry ids.
- **Footer.** Every footer carries the "shipped X ago" line and an **Updates** link. The link goes to the site's own log (`updates: '/updates'`) or, by default, `openvibe.network/updates?site=<host>`. The footer loads `shipped.js` lazily from its own origin; turn it off with `shipped: false`. `detectService()` now knows the TLD sites (`openvibe.wiki` → `wiki`, `openre.stream` → `openre`).
- **Fix: an empty bordered bar in the footer.** The signed-in row's `display:flex` beat its `hidden` attribute on sites without a global `[hidden]` rule.
- **Fix: "Sign In" shown to signed-in people on sites with their own session** (openvibe.blog and the other publishing sites). When a stored token is stale or refused, the navbar now drops it and asks the site's `sessionUrl` instead of giving up. The navbar also takes a new `logoutUrl` (for example `/auth/logout?next={path}`), so Sign out ends the site's server-side session too. `loginUrl` and `logoutUrl` accept `{url}` (the full return URL) and `{path}` (its local path).

Everything is additive.

## 1.8.0 — 2026-09-24

`shipped.js` (browser file, also `openvibe-shared/shipped`): "Recently shipped" for any OpenVibe site.
`OpenVibeShipped.mount(el, { service, limit, title })` reads the network changelog OpenVibe.Blog keeps
(`GET https://openvibe.blog/api/v1/changelog`): what each site deployed, newest first, each line
linked to its commit, and a link to the latest "Patch notes" post that gathers a batch of changes.
Without `service` it shows the whole network with site labels. DOM nodes only (commit text is never
parsed as HTML), https links only, hidden when there is nothing or the fetch fails; styles follow
the theme variables. Additive.

## 1.7.0 — 2026-09-24

`openvibe-shared/trace` (Track O): one W3C trace across the services a request touches.
`trace.install(app)` (right after openvibe-contracts' `http.middleware()`) runs each request inside
an AsyncLocalStorage holding its trace and request ids, and wraps `fetch()` once so a call to a
loopback address or an OpenVibe host carries `traceparent` (the request's trace id, a new span) and
`X-OpenVibe-Request-Id`, unless it sets its own. Calls to anyone else (payment and AI providers,
user-chosen URLs) are untouched, so trace ids never leave the network; outside a request nothing is
added. Also `trace.current()`, `trace.outboundHeaders()`, `trace.run(ctx, fn)`. Additive.

## 1.6.0 — 2026-09-24

`openvibe-shared/egress`: the one rule for connecting to an address someone else chose. Live
(`server/net/egress.js`), Events (`server/egress.js`) and Tools (`apps/_shared/egress.js`) each had a
copy and they had drifted: Live allowed the 3fff::/20 documentation range and 5f00::/16, and only knew
the /96 NAT64 prefix. This module is the strictest union: `isPublicAddress`, `embeddedV4`, `expandV6`,
`normalizeHost`, `isInternalName`, a connect-time `safeLookup` (every DNS answer must be public, so there
is no rebinding window), `createSafeLookup` for tests, `assertPublicUrl` and `EgressDenied`. Node only;
the three services keep their own fetch, delivery and throttle wrappers on top of it.

Fixed: `release.collect()` counted client beacons per socket address, which behind the proxy is
127.0.0.1 for everyone, so one 30-a-minute bucket refused the whole site. It now keys by `req.ip`
(the app's trust-proxy view), or `keyOf(req)` when given.

## 1.5.1 — 2026-09-23

Touch and keyboard feedback in the shared chrome (owner feedback: phones flashed a theme-blind blue
box over anything tapped). The navbar, its dropdowns, the launcher, the drawer and the footer turn
off `-webkit-tap-highlight-color`, show a slight press (`scale`, which composes with existing
transforms) and give keyboard focus one ring in the theme accent. Rules are wrapped in `:where()`
so they carry zero specificity: the chrome's own `:focus-visible` rules and host pages still win.
With reduced motion the press is a brief dim instead of a shrink.

## 1.5.0 — 2026-09-23

Roadmap Track R (D42–D46, ADR-016): release manifests with components, open tabs updated in place,
update metrics, and a mixed-version test harness. Additive; a service that changes nothing keeps
serving exactly the manifest it served on 1.4.0.

- **`/release.json` carries the registry.release-manifest 1.1.0 fields** (openvibe-contracts
  v0.31.0): `components` (`{ id: { kind: style|content|script|server, version } }`), `assets` (logical
  path → content-addressed URL, component, sha384 integrity), `schema_generation`,
  `schema_compatible_from`, `contract_ranges` (`{ id: { version, accepts: ">=a.b.c <x.y.z", role? } }`)
  and `metrics_url`. `createRelease()` takes `components` (`assets` under `publicDir`, `files` under
  `root`; versions are content hashes), `contracts` (`^`, `~`, `x`, `>=` ranges are normalised),
  `schemaGeneration`/`schemaCompatibleFrom` (numbers or functions), `assetUrl`, `recheckMs` and
  `metricsPath`. Without a declared `shell` component its version is the release, so every release
  still reloads. The package versions are part of the shell's hash, so a Shared bump never applies
  in place.
- **The contract filter.** The served manifest keeps only the fields the service's installed
  openvibe-contracts release-manifest schema declares. Under openvibe-contracts ≤ 0.30.x that is
  the 1.0.0 set, so `/release.json` keeps validating. `full()` is the unfiltered manifest,
  `fields()` what is served, `validate()` checks the served one with the service's contracts, and
  `refresh()` re-reads git, env and files.
- **`release.mount(app, { registry })`** mounts GET `/release.json` and POST `/release-metrics`.
  Tabs' reports go into `release_client_updates_total{outcome,reason}` in the service's
  `openvibe-shared/metrics` registry, and so into `/metrics`. Outcomes are `applied` (by the kinds
  applied), `reloaded` (`user`, `required`, `window`, `contract`), `deferred` (`typing`, `dirty`,
  `protected`, `media`, `capture`, `active`) and `failed` (`style`, `style-timeout`, `content`,
  `origin`, `script`). An unknown reason counts as `other`. A report is at most 4 KB, counts at most
  50 per reason, and one address sends at most 30 a minute. Sec-GPC/DNT reports are dropped.
  `collect(registry)` is the POST handler on its own.
- **release-watch.js** keeps its rules: it prompts once, and reloads by itself only when it must
  and only when that is safe. Now it also reads the page's own manifest at load, even with the
  meta tag, and hands a release with components or contract ranges to **release-update.js** (new
  browser file, loaded on demand from the same directory). The update is applied in place when
  only style, content or server components changed and the contract ranges still hold. New
  `<link>`s are matched by path or `data-ov-asset` and load beside the old ones, which are removed
  only after every new one has loaded. `[data-ov-content="<component>"]` regions are re-fetched
  (`data-ov-src`, default the page URL) with no scripts, frames or inline handlers. Each region is
  replaced only when nothing inside it has focus, is protected or plays; otherwise it waits, and an
  unchanged `data-ov-rev` is skipped. Any failure keeps the old page and falls back to the prompt.
  Contracts outside the server's range force a reload, but still only when safe. It counts outcomes
  and beacons them (on hide, after an update, before a reload) to `OVReleaseConfig.metricsUrl`, the
  meta tag's `data-metrics` or the manifest's `metrics_url`, same origin only. It emits
  `ov:release-applied`, `ov:styles-updated` and `ov:content-updated`. The new
  `OVReleaseConfig.inPlace: false` turns in-place updates off.
- **navbar.js**: `init({ releaseWatch: { … } })` is passed to release-watch as `OVReleaseConfig`.
- **`openvibe-shared/release-compat`** (new, Node): `runMixedVersion` and `assertMixedVersion` run
  the page × server matrix from the manifests' contract ranges. Where the manifests say
  compatible, they call the real server with the other release's client. Where they say
  incompatible, they require the tab's plan to be a reload. Adjacent releases must be compatible.
  Also `replay(calls)`, `manifestFor()`, `consumerCompatible()` (service to service),
  `rollbackSafe()` (schema generations), `plan()`/`compatible()` (the tab's own logic) and
  `openPage()`, which runs release-watch in a linkedom page for in-place tests.
- Sizes (brotli q11): release-watch.js 1.7 → 3.1 KB (+1.4 KB; it loads after first paint at low
  priority). release-update.js is 2.9 KB and loads only when a release lists components. navbar.js
  is +21 bytes (27.9 KB). Both release files have a 3.5 KB budget test.
- Dev only: `linkedom` and `openvibe-contracts` (v0.30.2) are devDependencies.
  `test/fixtures/release-manifest.v1.1.0.json` is Contracts' 1.1.0 schema, used until that
  devDependency moves to v0.31.0.

## 1.4.0 — 2026-09-23

`openvibe-shared/analytics` is now the ADR-021 module (roadmap register item 26 and C-80). It
replaces three hand-copied versions in Live `server/analytics/`, Tools `apps/_shared/analytics/`
and Network `server/analytics/`. The old `analytics.js` was removed. It stored raw IPs, user ids,
cities and full user agents, and deleted raw rows only after 90 days. No deployed service still
used it.

- **Same API, ADR-021 behaviour.** `new AnalyticsTracker(db, service[, opts])`, `middleware()`,
  `trackEvent()`, `flush()`, `aggregate()`, `getStats()`, `getOverview()`, `getBotAnalysis()` and
  `destroy()` all keep their shapes. A raw row has a route template, a referer origin, a
  user-agent class, a rotating session id, a country and a signed-in flag. `ip`, `user_id` and
  `city` are always NULL. Unique visitors come from day-salted hashes, which are deleted once the
  day's rollup is final. The rate check keeps its counters in memory only.
- **Sec-GPC and DNT are honoured on the server.** A request with `Sec-GPC: 1` or `DNT: 1` is not
  recorded at all: no raw row, visitor hash, session id or rate counter. It is therefore also
  missing from the rollups, because ADR-021 provides for no separate opted-out count.
  `trackEvent(name, { headers })` does the same. `privacy.optedOut(headers)` is exported.
- **`analytics/event.v1`** is the documented raw event shape:
  `docs/schemas/analytics-event.v1.json`, exported as
  `openvibe-shared/analytics/event.v1.json`. `openvibe-shared/analytics/event` provides
  `toEvent(row)`, `validateEvent(ev)` and `checkRow(row)`. `checkRow` rejects a row that has
  ip/user_id/city set. The validator reads the schema file itself. `trackEvent` now stores NULL for
  a value outside the schema, and throws a `TypeError` for an event name outside it.
- **Retention.** The tracker schedules the 30-day raw-event prune by default. Pass
  `retention: false` if the service runs `retention.pruneRawEvents` itself. The new
  `retention.schedulePrune(db, opts)` returns `{ run, stop }`. Days above 30 are refused.
- **Service specifics are options** (formerly Network's `network.js`). `paramPrefixes` adds
  parameter words to the defaults. `pathRules` is a list of `[RegExp, replacement]` rewrites
  applied before templating. Both are accepted by the tracker and by
  `retention.scrubEvents`/`scrubRollups`/`inspect`, so legacy rows are templated like new
  ones.
- **`openvibe-shared/analytics/prune-cli`** is the prune and one-time scrub command. Each service
  wraps it in its own script and passes `Database`, `defaultDb` or a `targets` hook, extra flags
  and path options. It runs a dry run by default. `--apply` needs `--backup` or `--no-backup`. It
  backs up one database to a file or several to a directory. Backups are owner-only (0600)
  because a pre-scrub backup holds the old IPs. It checks that rollup totals are unchanged and
  can VACUUM.
- An over-long route template now loses whole segments and ends in `/*`. Before, it was cut at
  200 characters, possibly mid-segment.
- The root export (`require('openvibe-shared')`) and `openvibe-shared/analytics` keep the names
  that 1.x exported: `classifyRequest`, `parseUserAgent`, `ANALYTICS_SCHEMA` and
  `BOT_USER_AGENTS` now use the ADR-021 code. `SUSPICIOUS_PATTERNS` is a frozen, deprecated
  object that nothing reads, and it will be removed in 2.0.0.
- Package shape: [docs/adr/0001-one-package-subpath-exports.md](docs/adr/0001-one-package-subpath-exports.md)
  (proposed) keeps one package with explicit subpath exports. `exports` gains the `analytics/*`
  subpaths, and `test/package.test.js` now refuses wildcard subpaths and any module file without
  an entry.
- Dev only: `better-sqlite3` is a devDependency for the analytics tests. The package itself has
  no native dependency.

## 1.3.0 — 2026-09-23

Observability and readiness (roadmap Track O, §15.19). Additive only; both modules are Node-only
and have no dependencies.

- `openvibe-shared/metrics`: a Prometheus text-format registry (counter, gauge with optional
  scrape-time `collect()`, histogram with fixed buckets) that caps every metric's label
  combinations (past `maxSeries` they fold into one `_overflow` series, counted by
  `metrics_series_overflow_total`). `instrument(app, { service, release })` mounts the golden-signal
  middleware — `http_requests_total{method,route,status_class}`,
  `http_request_duration_seconds{method,route}`, `http_requests_in_flight` — keyed by the route
  TEMPLATE (`req.baseUrl` with id-like segments as `:id` + `req.route.path`, or a caller's
  `normalize(req)`; unmatched requests are `unmatched`, never the raw URL), process metrics
  (`process_resident_memory_bytes`, `nodejs_heap_*`, `nodejs_eventloop_lag_seconds{stat}`,
  `process_cpu_seconds_total`, `process_uptime_seconds`), `release_info{service,release}`, and
  `GET /metrics`, which answers only a direct loopback caller (127.0.0.1/::1 with no
  `X-Forwarded-For`, `X-Real-IP`, `Forwarded` or `CF-Connecting-IP`) and 404s everyone else.
- `openvibe-shared/ready`: `createReadiness({ service, release, checks, details })` → `handler` and
  `run()`. Each named check reports `status`, `required`, `latency_ms` and `checked_at` (a cached
  check keeps the time it really ran). `ready` is false (HTTP 503) only when a required check fails;
  failed optional checks are listed in `degraded` and the service stays ready (`status:
  "degraded"`). Failure reasons are one line with URL credentials, query strings and
  `token=`/`key=` values removed.

## 1.2.1 — 2026-09-23

- `release-watch.js` never reloads a tab that is playing `<video>`/`<audio>` or holds a live
  camera/microphone stream (viewers look idle while watching; broadcasters must never be cut).

## 1.2.0 — 2026-09-23

- `navbar.js` loads `release-watch.js` (from the same place it was loaded from) four seconds after
  `init()`, so every site on the shared navbar gets release prompts once it serves `/release.json`.
  A site without the route costs one 404 per page load; `init({ releaseWatch: false })` opts out.

## 1.1.1 — 2026-09-23

- `release-watch.js` works without the `<meta name="ov-release">` tag: the release `/release.json`
  reports when the script loads becomes the page's baseline, and a site that serves no
  `/release.json` is asked once and left alone. Adopting it is a route plus one script tag.

## 1.1.0 — 2026-09-23

Active-client update safety (ADR-016, contract `registry.release-manifest@1`). Additive only.

- `openvibe-shared/release` (server): `createRelease({ service })` → `handler` for
  `GET /release.json` (deployed commit, commit time, package versions, `MIN_CLIENT_RELEASE`,
  24 h mixed-version window) and `metaTag()` for the page's own release.
- `release-watch.js` (browser, served at `/shared/release-watch.js`): on focus, visibility,
  reconnect and every 10 minutes, compares the page's release with `/release.json`. A newer
  release shows one Reload toast; a required release or one older than the window reloads the tab
  only when it is hidden or idle, no text field has focus and nothing is protected
  (`form[data-dirty="true"]`, `[data-ov-protected]`, `window.OVProtected()`).

## 1.0.0 — 2026-09-22

First release from its own repository. Imported history-free from
`OpenVibe.Network/packages/openvibe-shared` at Network commit `f337eb6`; every module is
byte-identical to that commit except `navbar.js`, which only changed as listed below.
Vendored copies in Media, Tools and Community carried a stale `ov-icons.js` (and Community a
stale navbar test); canonical was correct everywhere — see `docs/divergence-2026-09-22.md`.

### Changed
- **navbar.js no longer ships every glyph.** The 87 Font Awesome solid glyph paths moved to a new
  browser file, `nav-icons.js`. navbar.js keeps the 13 glyphs it draws itself (account menu,
  admin link, wallet chip) plus the widths of the rest, and fetches `nav-icons.js?v=<content hash>`
  once, after first paint, the first time a site's link, chip or menu row names another glyph —
  from the directory navbar.js was loaded from, else `https://openvibe.network/shared/`. The slot
  is an empty `<svg>` of the glyph's exact size until the path arrives, so nothing moves; the
  finished DOM and pixels are identical to the Network copy (checked in headless Chrome). If
  `nav-icons.js` cannot load, those icons fall back to `<i class="fa-solid …">` (the behaviour
  before inline glyphs). A page that loads `nav-icons.js` before navbar.js gets every glyph
  synchronously. New option: `iconsUrl`.
  navbar.js: 151.8 KB raw / 39.0 KB brotli → 118.6 KB / 27.6 KB.
- `scripts/build-nav-icons.py` now writes `nav-icons.js`; `scripts/build-navbar-icons.js`
  regenerates navbar.js's block from it (`--check` in the tests).

### Added
- `files.js` (`require('openvibe-shared/files')`): the list of browser files a site may serve at
  `/shared/<file>`, the package directory, `isBrowserFile()` and `path()`.
- `exports` for every module (`openvibe-shared/navbar`, `/nav-icons`, `/theme-loader`, … and
  `/package.json`); every subpath the Network copy exported still resolves to the same file.
- Tests: `test/run.js`, a navbar.js size budget (29 KB brotli) and icon availability test,
  browser-bundle hygiene (no `require()` or Node globals in served files), package exports.
- `scripts/size-report.js`: raw and brotli (q11) size of every browser file.
- CI on Node 22.22.1, including an install of a tag-style tarball into an empty project.
