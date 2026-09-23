# Vendored-copy divergence audit — 2026-09-22

Before `openvibe-shared` moved into this repository, every vendored copy was compared with the
canonical package, `OpenVibe.Network/packages/openvibe-shared` at Network commit **`f337eb6`**.
Comparisons use the **committed** trees (`git archive HEAD`), not working trees, because some
working trees carry CRLF line endings that git normalises away (see Live below).

**Result: no consumer holds a fix that canonical lacks.** Every difference is a copy that fell
behind canonical, or a line-ending artefact. Canonical was imported unchanged (except navbar.js,
per CHANGELOG 1.0.0) and nothing needed folding back in.

## Method

1. `diff -r` of each consumer's committed `vendor/openvibe-shared` against canonical.
2. For every divergent file, `git log -p -- vendor/openvibe-shared/<file>` in the consumer, and
   `git log -- packages/openvibe-shared/<file>` in Network, to date both sides.
3. To catch a local fix that a later re-sync might have overwritten: every blob ever committed
   under `vendor/openvibe-shared` in Live, Media, Tools, Community and Sites was looked up among
   the 116 blobs ever committed under `packages/openvibe-shared` in Network. A blob that never
   existed in Network is a local edit.

## Consumers at audit time

| Repo | HEAD | Copy | Differences from canonical |
|---|---|---|---|
| OpenVibe.Live (seadragon worktree = main) | `e266060` | full, no tests | none in committed content (CRLF artefact below) |
| OpenVibe.Media | `ddfefcf` | full, no tests | `ov-icons.js` (stale) |
| OpenVibe.Tools | `fd5d318` | full, no tests | `ov-icons.js` (stale) |
| OpenVibe.Community | `d7c6e60` | full, partial tests | `ov-icons.js` (stale), `test/navbar-brand.test.js` (stale) |
| OpenVibe.Sites | `185014f` | 5 files | none: `app-icon`, `chrome-ssr`, `footer`, `legal`, `seo` are byte-identical |

The vendored copies that lack `test/` and `scripts/build-nav-icons.py` are simply packaged
differently. None of those files ships to a browser or is required at runtime.

## Decisions

### Live: `vendor/openvibe-shared/user-card.js`: canonical (no content change)

- The reported divergence is **line endings only**. `diff --strip-trailing-cr` is empty, and the
  committed blob in Live equals canonical's.
- Network's working tree has CRLF in five files (`analytics.js`, `auth-client.js`, `index.js`,
  `middleware.js`, `user-card.js`), and the seadragon worktree has CRLF in `user-card.js`. Their
  index copies are LF (`git ls-files --eol` shows `i/lf w/crlf`, `core.autocrlf=input`). A
  working-tree diff between a CRLF checkout and an LF checkout therefore flags the file.
- History: Live `e371ed1` (2026-09-18, "…vendor sync") re-synced it. It changed the banner
  fallback accent from `#8b5cf6` to `#3b82f6`, which canonical already had. Before that, Live had
  only the initial import `ac0d6a4`.
- Prevention: this repository ships `.gitattributes` with `* text=auto eol=lf`, and the package
  is installed from a tarball, so no working-tree line endings are involved.

### Media, Tools, Community: `vendor/openvibe-shared/ov-icons.js`: canonical

- The three copies are identical to each other (md5 `8c50f1d5…`). Each equals canonical as of
  Network `6ce1ef4` (2026-09-21 09:57, "Ring icons: solid Font Awesome glyphs inside the OV
  ring"). They were synced one minute later: Media `6114bc6`, Tools `0346edc`, Community `de947ea`.
- Canonical then got Network **`71be248`** (2026-09-21 11:57, "Ring icons: fix solid glyphs
  rendering off-centre (transform-origin pivot bug)"). That commit moves the position and scale
  `transform` from the classed `.ovi-glyph` element onto a plain inner `<g>`. The consumers
  never re-synced after it.
- None of the three consumer histories edits the file outside those syncs. `git log -p` shows
  only `vendor sync` or `…; vendor sync` commits.
- Canonical is the fix, and the consumers carry the bug. It matters where they
  `require('openvibe-shared/icons')` on the server. Tools does this in
  `apps/gateway/server/pages/site.js`, so Tools' server-rendered solid ring glyphs
  (`icons.use()` / `icons.sprite()`) can render off-centre until Tools moves to v1.0.0.
  Browsers load `ov-icons.js` from `openvibe.network/shared/`, which is already fixed.

### Community: `vendor/openvibe-shared/test/navbar-brand.test.js`: canonical

- Community's copy comes from `ff4a6b6` (2026-09-17 20:10, "Re-sync vendored openvibe-shared").
  Canonical changed afterwards in `68597ec` and `959bcb3` (2026-09-18): links became
  `class="ovnav-link …"`, the mobile drawer arrived and icons became inline SVG.
- Its old assertions (`class="active"`, `fa-plus icon`) would fail against the navbar Community
  actually ships. It never runs, because Community's `test/run.js` reads only `test/`. Its copy
  also lacks `panels.test.js` and `shared-modules.test.js`.
- The copy is stale, with nothing to fold in. Tests now live here only.

### Local-edit scan (method step 3)

The scan found one local-only blob. Community `66c11ab` (2026-09-17 20:09, "Scaffold the
Community app…") vendored a `navbar.js` that never existed in Network. It is 7 lines away from
Network `d8b7f65`, committed at 20:08 the same evening. Community copied the Network working
tree about a minute before that commit. `d8b7f65` then added `apiBase` to the history calls and
guarded `nav.setAttribute`.

That snapshot is therefore an older draft of canonical, not a fix. Community's next syncs
(`f4533f4`, `ee2f49d`, `b9cb474`, `de947ea`) replaced it with Network blobs. No other vendored
blob in any consumer's history is missing from Network's history.

## Follow-ups

- Tools' server-rendered solid ring glyphs can stay off-centre until Tools installs v1.0.0
  (`docs/migration-plan.md`).
- Once every consumer pins this package, the `vendor/openvibe-shared` directories are deleted,
  and this class of drift can't recur.
