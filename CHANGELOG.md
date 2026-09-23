# Changelog

All notable changes to `openvibe-shared`. Versions follow [semver](https://semver.org/): a
breaking change to any exported module, browser global or served file name is a new major.
A release is the git tag `vX.Y.Z`; consumers pin the tag's tarball (see README).

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
