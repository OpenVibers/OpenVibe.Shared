# Shared ADR 0001: one package with subpath exports

**Status:** Proposed 2026-09-23, for review with v1.4.0. This is a Shared-local decision under
network ADR-008 (OpenVibe.Contracts `docs/adr/ADR-008-shared-packages.md`). It answers roadmap
register item 26: split Shared into packages, or accept one package in an ADR.

## Context

The charter names eleven logical packages: `@openvibe/tokens`, `ui`, `chrome`, `auth-ui`, `seo`,
`legal`, `icons`, `release-client`, `web-runtime`, `server-web` and `testing-web`. Today everything
ships as one package, `openvibe-shared`. The facts behind the decision:

- **Distribution is a tag tarball.** Consumers pin
  `codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/vX.Y.Z`, and the repository root
  is the package root. One repository can serve only one package this way. A split would need a
  registry, or one repository per package.
- **Consumers take most of it.** Each of the 19 consumers in the README pins one version, and
  most use chrome, legal, SEO, icons and themes together. The browser files depend on each
  other at runtime: `navbar.js` loads `nav-icons.js` and `release-watch.js` from its own directory,
  and `theme-loader.js` must match the navbar's token names. Separate versions of these files
  would reintroduce the skew ADR-008 was written to end.
- **Selective loading already works.** `exports` gives each module its own subpath, and the sites
  have no bundler. `require('openvibe-shared/legal')` loads only `legal.js` and its own
  requires. Browser pages load only the files they name. A split would not reduce what a site
  loads.
- **The package is small.** Its one runtime dependency is `jsonwebtoken`. The analytics module
  is dependency-free: the caller passes in `better-sqlite3`.
- **There is one release process.** A split means N changelogs and N tags per change, and a
  compatibility matrix between them. There is no second team or release cadence to justify
  that.

## Decision

Keep **one package, `openvibe-shared`, with explicit subpath exports**:

1. **`package.json` `exports` is the public surface.** Every entry is an explicit path. There
   are no wildcards (`./*`), so publishing a subpath is always a deliberate choice. A file with
   no entry is private. `test/package.test.js` checks that every module file, including
   `analytics/*.js`, has an entry and that every entry resolves.
2. **Related modules share a folder and a subpath prefix.** Example: `openvibe-shared/analytics`
   plus `analytics/privacy`, `analytics/tracker`, `analytics/retention`, `analytics/schema`,
   `analytics/event`, `analytics/prune-cli` and `analytics/event.v1.json`. Put new families the
   same way, for example `openvibe-shared/seo/...`. Existing flat subpaths such as `./navbar`
   and `./legal` stay where they are, because moving them would be a major release.
3. **The charter's package names become groups of subpaths.** They are not separate packages.

   | Group | Subpaths |
   |---|---|
   | tokens | `theme-sync`, `theme-loader`, `builtin-themes` |
   | chrome / ui | `navbar`, `nav-icons`, `footer`, `chrome-ssr`, `panels`, `ui`, `island`, `tooltip`, `user-card`, `account-switcher`, `notification-ui`, `history` |
   | icons | `icons` (= `ov-icons`), `ov-mark`, `app-icon` |
   | seo | `seo` |
   | legal | `legal` |
   | auth-ui | `sso-client`, `auth-client`, `middleware` |
   | release-client | `release`, `release-watch`, `openvibe-sw` |
   | server-web | `metrics`, `ready`, `analytics/*`, `files`, `url-resolver`, `brand`, `notifications` |

4. **Semver applies to the package as a whole.** Removing or renaming any subpath or export is
   a major release. This is the existing compatibility policy.

## When to revisit

Split out one part, as its own repository and tag, only if one of these becomes true:

- A module needs a heavy or native runtime dependency that most consumers would not want.
  Example: analytics bundling `better-sqlite3` instead of receiving it from the caller.
- A part gains an outside audience that needs its own semver line. Example: a published
  third-party SDK.
- Shared starts publishing to an npm registry. Scoped packages would then cost little, and a
  split could be revisited as a whole.

## Consequences

- Consumers keep one pin and one lockfile entry. Moving a copied module into Shared, as with
  analytics in v1.4.0, is one new subpath and not a new dependency.
- The charter's `@openvibe/*` names describe how the package is organised. They are not
  install targets. Update the charter and README text to match once this is accepted.
- Rollback is to split later. The explicit `exports` map already lists each group's files.
