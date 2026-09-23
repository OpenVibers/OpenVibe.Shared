# OpenVibe.Shared

> Versioned UI, chrome, SEO, legal and release-client packages every OpenVibe site renders.

**Status:** alpha. The `openvibe-shared` package lives here; the latest tag is v1.3.0 (Wave 2, metrics
and readiness from Track O). Every deployed consumer installs a tagged release and none keeps a
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
| Browser scripts, served at `/shared/<file>` (listed in `files.js`) | `navbar.js`, `nav-icons.js`, `theme-loader.js`, `footer.js`, `notification-ui.js`, `account-switcher.js`, `user-card.js`, `ov-mark.js`, `ov-icons.js`, `history.js`, `sso-client.js`, `panels.js`, `ui.js`, `island.js`, `tooltip.js`, `openvibe-sw.js` |
| Node modules (`require('openvibe-shared/<name>')`) | `index` (`.`), `analytics`, `app-icon`, `auth-client`, `brand`, `builtin-themes`, `chrome-ssr`, `legal`, `middleware`, `notifications`, `seo`, `theme-sync`, `url-resolver`, `files`, `release`, `metrics`, `ready`; `footer` and `icons` (= `ov-icons.js`) work on both sides |
| Generators | `scripts/build-nav-icons.py` (Font Awesome glyphs → `nav-icons.js`, `ov-icons.js`), `scripts/build-navbar-icons.js` (navbar.js's built-in glyphs), `scripts/build-theme-loader.js`, `scripts/build-app-icons.js` |

Every module file has an `exports` entry, so `require('openvibe-shared/navbar')`,
`require.resolve('openvibe-shared/package.json')` and the rest all resolve.

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

- **navbar.js size budget**: 29 KB brotli (`test/nav-icons.test.js`).
- **Built-in icons**: every icon the default navbar renders must be built in and drawn with no
  fetch.
- **Generated blocks**: the generated navbar and theme-loader blocks must be up to date.
- **Browser bundles**: browser files must be free of `require()` and Node globals
  (`test/browser-bundles.test.js`).
- **Exports**: every export must resolve.

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
- `@openvibe/tokens|ui|chrome|auth-ui|seo|legal|icons|release-client|web-runtime|server-web|testing-web`
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
