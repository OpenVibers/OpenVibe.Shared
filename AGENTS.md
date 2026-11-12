# AGENTS.md — OpenVibe.Shared

## Project overview

`openvibe-shared` is the versioned UI and server-helpers package every OpenVibe site renders: the
OpenVibe Frame (navbar, the menu with its Chat and Vibe places, footer, panels), themes and design tokens, glyphs and app icons, SEO,
legal pages, analytics, readiness/metrics, egress and the web runtime. It is a library (MIT), not a
service: it owns no database, port or process, and nothing is deployed from this repository.

- **Package root is the repository root.** `package.json` is at the root, so GitHub's tarball of a
  tag installs directly. Entry: `index.js` (CommonJS exports for server code).
- **Browser files** are plain scripts served by a consumer at `/shared/<file>`; `files.js` is the
  complete list of what may be served and must include every new browser file in the same release.
  `serve.js` (`openvibe-shared/serve`) serves them with content-hashed URLs (`?v=`), ETags and
  serve-time minification, plus `social/`, `icons/` and `manifest/<service>.webmanifest`.
- **Server modules** are required by name: `openvibe-shared/shell`, `seo`, `legal`, `ready`,
  `metrics`, `config`, `csp`, `analytics`, `assets`, `agent-layer`, `test-runner`, `egress`,
  `trace`, `indexnow`, `release`.
- **Design docs:** `docs/` (`docs/kit.md`, `docs/agent-layer.md`, `docs/agent-session.md`,
  `docs/tokens.md`, `docs/forms.md`, `docs/player-startup.md`, `docs/home-pages.md`,
  `docs/migration-plan.md`); architecture decisions in `docs/adr/`.
- **Build helpers:** `scripts/build-styles.js` (CSS bundles), `scripts/build-theme-loader.js`
  (generated theme block), `scripts/build-icons.js`, `scripts/build-glyphs.js` (`ov-glyphs.js` and the sprite),
  `scripts/build-navbar-icons.js` (the bar's set and the ring icons' solids, from `glyphs.js`),
  `scripts/fa-to-ov.js` (a repository's Font Awesome markup into `data-ov-icon`), `scripts/create-site.js` (a new
  site scaffold), `scripts/size-report.js`.

## Who calls it, what it calls

Every site pins a release tag
(`"openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/vX.Y.Z"`)
and mounts `require('openvibe-shared/serve').handler()` at `/shared`. Network also serves
`https://openvibe.network/shared/*` from the tag it pins. The package has one runtime dependency
(`jsonwebtoken`, for `auth-client`); `openvibe-contracts` is a devDependency the release tests
validate against.

In the browser the shared files call OpenVibe.Network (session, theme and notification APIs,
realtime tickets, the changelog) and OpenVibe.Events (the notification bell's realtime stream).
On the server the helpers are configured by each consumer and call whatever that consumer passes
in — Shared owns no capability, grant or table.

## Commands

```bash
npm ci
npm test                         # every test/*.test.js, Node 22.22.1 in CI
npm test -- navbar icons         # only files whose name contains a word
npm test -- --strict             # a skipped file fails the run
npm run size                     # raw + brotli (q11) size of every browser file
node scripts/build-theme-loader.js
node scripts/build-styles.js
node scripts/build-navbar-icons.js   # the bar's icons and the ring solids, from glyphs.js
node scripts/create-site.js my-site
```

Tests are plain Node with stubbed browser globals; `*-chrome.test.js` starts headless Chrome and is
skipped (and shown as ○, never passed) when Chrome is absent. `test/run.js` uses
`test-runner.js` with 90 s per file, Chrome files serial, and one retry for a Chrome file.

## Architecture at a glance

- **Frame:** `navbar.js`, `footer.js`, `frame.js`, `shell.js`, `appbar.js`, `bottom.js`,
  `dock*.js`, `panels.js`, `island.js`.
- **Theme:** `theme-loader.js` (runs before first paint), `theme-sync.js`, `builtin-themes.js`,
  `kit.js`/`kit.css`, `tokens.js`; Network owns theme authority.
- **Icons and marks:** `glyphs.js` (one registry: `NAMES`, `path`, `svg`, `fromFa`), `ov-glyphs.js`,
  `nav-icons.js`, generated `ov-glyphs*.css`/fonts, `mark.js`/`ov-mark.js`, `app-icons.js`.
- **Release client:** `release-watch.js`, `release-update.js`, `release.json` handling
  (`docs/adr`, ADR-016) — active-tab update coordination, mixed-version tests.
- **Web runtime:** `web-runtime.js` (`OVWebRuntime`, feature loading and route scopes),
  `boost.js`, `soft.js`, `route-transition.js`, `cache-policy.js`, `openvibe-sw.js`/`sw.js`.
- **Server:** `seo.js` (head, sitemap, robots, llms.txt), `legal.js`, `csp.js`, `ready.js`,
  `metrics.js`, `analytics/`, `egress.js`, `trace.js`, `config*.js`, `agent-layer.js`.

## Conventions

- **CommonJS, 4-space indent, single quotes, semicolons.** No linter or formatter.
- **Browser files must not `require()` or name Node globals** (`test/browser-bundles.test.js`);
  server-only code lives behind a subpath, never in a browser file.
- **Every public module file has an export**, and every export resolves; `config-core.js` and
  `analytics/core.js` are deliberately private.
- **New browser file = add it to `files.js`** and, when it ships a public name, to the compatibility
  policy in the README; `test/browser-files-complete.test.js` and the size report read the list.
- **Generated blocks are committed:** navbar and theme-loader generated blocks are regenerated by
  their scripts and checked by tests. Never hand-edit a generated CSS/JS block.
- **Content-hashed assets only** (`assets.js`, `serve.url`); never add `?v=` by hand.
- **Glyph rules:** draw icons from the one registry (`glyphs.js`) with OpenVibe's own markup:
  `<i data-ov-icon="eye">`, `<i data-ov-brand="github">` (`glyphs.markup()` on a server, `OVGlyphs.icon()` in a
  page). Never add Font Awesome markup; `scripts/fa-to-ov.js` rewrites what is left, and a later release drops the
  Font Awesome names entirely. No drawing comes from another icon set.
- **CSS is phone first:** the Frame and Kit styles start at the 390 px layout; test a phone width
  before a desktop one.
- **Motion rule ("Calm reduces, only Off removes"):** reduced motion reduces animation; it does not
  hide content or controls.

## Key pitfalls

- **Releases are immutable.** Bump `package.json` + `CHANGELOG.md` (`Release vX.Y.Z`), commit, tag
  `vX.Y.Z`, push main and the tag. Never move or delete a tag: consumer lockfiles pin its
  integrity. Upgrade Network first, then the sites.
- **Size budgets are tests:** `navbar.js` 29 KB brotli, `release-watch.js` 5 KB,
  `release-update.js` 3.5 KB, `web-runtime.js` 6.5 KB. Adding a script to the eager path is a
  budget change, not a free edit.
- **The previous major stays servable** at `/shared/v<major>/<file>`; an unversioned path never
  jumps a major silently (compatibility policy in the README).
- **CSP:** consumers build headers with `csp.js`; a browser file must not need `eval`, inline script
  or a new origin without adding it to the policy and the CSP tests.
- **Analytics stores no personal data** and must honour opt-out (`test/analytics-privacy.test.js`);
  request telemetry is aggregated by route template, never raw URL.
- **`egress.js` is the only outbound fetch for user-chosen URLs** (SSRF-safe, connect-time DNS);
  `trace.js` forwards W3C trace headers only to loopback and OpenVibe hosts.
- **No build step for consumers:** everything under `/shared` is served from the installed package;
  a new dependency must be browser-safe or it cannot go in `files.js`.

## Testing

`npm test` runs every `test/*.test.js` in its own process; tests use `assert`, linkedom/stubbed
browser globals and local fixtures, never a live site. Release-guarding tests cover the size
budgets, the release manifest and mixed-version matrix, built-in icons, generated blocks, browser
files free of Node code, export resolution and analytics privacy. Chrome tests need a local Chrome;
`OV_SKIP_BROWSER=1` skips them. `npm run size` prints the raw and brotli sizes when a budget is close.
