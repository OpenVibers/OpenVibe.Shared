# Migration plan: consumers move to the pinned OpenVibe.Shared release

Status: **prepared, not applied** (2026-09-22). Nothing here has been committed in the consumer
repos. The lead applies it after tagging `v1.0.0` in this repo.

Every consumer replaces its `file:` dependency on a vendored copy with the release tarball:

```json
"openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0"
```

It also deletes its `vendor/openvibe-shared` copy. Code that read that directory by path now
goes through `require('openvibe-shared/files')`, which lists the package's browser files and
where they are.

## Order and prerequisites

1. **Tag `v1.0.0`** in OpenVibe.Shared and push it. The repo must be public, because codeload
   serves private repos only with a token. Check that
   `curl -fsSLI https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0`
   returns 200.
2. **Network first.** It serves `https://openvibe.network/shared/*` to Media, Tools, Community
   and Sites pages. Once it deploys, those pages get the v1.0.0 navbar and footer, plus the new
   lazily fetched `nav-icons.js` next to them, with no change in those repos.
3. **Live.** It serves `/shared/*` from its own origin, and its navbar needs `nav-icons.js`
   served beside `navbar.js`. Until Live's allowlist includes that file, lazy icons 404 and fall
   back to `<i class="fa-solid">`. Live loads Font Awesome, so the icons still show.
4. **Community, Media, Tools** in any order. Their browsers already load from the Network. Their
   servers only `require()` Node modules: legal, footer SSR, app-icon, auth-client, analytics
   and icons.
5. **Sites**, optionally. It has no `package.json` today.

Common steps for each npm consumer:

```bash
rm -rf node_modules/openvibe-shared           # today a symlink into vendor/
git rm -r -q vendor/openvibe-shared           # Network: packages/openvibe-shared
# edit package.json (diff below), then:
npm install --no-audit --no-fund              # rewrites package-lock.json
npm test
git grep -n 'vendor/openvibe-shared'          # must print nothing but docs you chose to keep
```

The lockfile then holds a single entry:

```json
"node_modules/openvibe-shared": {
  "version": "1.0.0",
  "resolved": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0",
  "integrity": "sha512-…",
  "license": "MIT",
  "dependencies": { "jsonwebtoken": "^9.0.0" }
}
```

The `"vendor/openvibe-shared": {…}` workspace entry and the `"link": true` entry disappear.

On the hosts, `npm ci --omit=dev` (or `npm install` where there is no lockfile) replaces any
stale real-directory copy in `node_modules/openvibe-shared`. The "node_modules is a stale COPY"
comments stop applying.

The references below come from `git grep -n -E "vendor/openvibe-shared|packages/openvibe-shared|'vendor', 'openvibe-shared'|'packages', 'openvibe-shared'"`
over tracked files, run at the HEADs listed in `docs/divergence-2026-09-22.md`. Network's
generated `docs/roadmap-baseline/*` is left out (270 hits in `inventory.json`), because it is
regenerated.

---

## OpenVibe.Network

### References

```
README.md:265                         docs: "The `packages/openvibe-shared/` directory provides…"
docs/platform-plan.md:34-35           docs
docs/shared-contracts.md:3,5,177      docs
package.json:9                        test script runs 7 packages/openvibe-shared/test/* files
package.json:27                       "openvibe-shared": "file:./packages/openvibe-shared",
package-lock.json:24,1483,2099        lockfile entries
scripts/roadmap-baseline/generate.js:30,37,97,133,500
server/index.js:607                   res.sendFile(path.resolve(__dirname, '..', 'packages', 'openvibe-shared', 'openvibe-sw.js'))
server/index.js:612                   const sharedPath = path.resolve(__dirname, '..', 'packages', 'openvibe-shared');
deploy/nginx/openvibe.network.conf:80-86   location /shared/ { … add_header Cache-Control "public, max-age=300, …"; }
server/deploy/nginx-generator.js:33-36     { match: '/shared/', cacheTime: '1h' }
```

The `server/…` requires that use `require('openvibe-shared/...')` need no change:
`server/index.js:22,28,426`, `server/admin/routes.js:16`, `server/db/database.js:698`,
`server/deploy/routes.js:12`, `server/home/render.js:8,9,80`,
`server/notifications/notification-service.js:10`, `server/setup/routes.js:6` and
`server/url-registry.js:3`.

### Steps

1. `git rm -r packages/openvibe-shared`. From now on, changes land in OpenVibe.Shared and ship
   as a release.
2. Edit `package.json`:

```diff
-    "test": "node test/registry-bootstrap.test.js && node packages/openvibe-shared/test/theme-parity.test.js && node test/nginx-generator-live.test.js && node test/admin-refresh.test.js && node packages/openvibe-shared/test/url-resolver.test.js && node packages/openvibe-shared/test/url-resolver-deploy.test.js && node packages/openvibe-shared/test/navbar-auth.test.js && node packages/openvibe-shared/test/navbar-brand.test.js && node test/history-sso.test.js && node test/sso-check.test.js && node test/fedcm.test.js && node test/domains.test.js && node packages/openvibe-shared/test/shared-modules.test.js && node test/chrome.test.js && node packages/openvibe-shared/test/panels.test.js && node test/avatar.test.js && node test/roadmap-baseline.test.js && node test/identity-subjects.test.js && node test/principals.test.js && node test/modules.test.js && node test/registry-ecosystem.test.js && node test/service-principal.test.js",
+    "test": "node test/registry-bootstrap.test.js && node test/nginx-generator-live.test.js && node test/admin-refresh.test.js && node test/history-sso.test.js && node test/sso-check.test.js && node test/fedcm.test.js && node test/domains.test.js && node test/chrome.test.js && node test/avatar.test.js && node test/roadmap-baseline.test.js && node test/identity-subjects.test.js && node test/principals.test.js && node test/modules.test.js && node test/registry-ecosystem.test.js && node test/service-principal.test.js",
@@
-    "openvibe-shared": "file:./packages/openvibe-shared",
+    "openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0",
```

   The package's own tests now run in OpenVibe.Shared's CI.

3. Run `npm install`. It regenerates `package-lock.json`.
4. Update `server/index.js`, currently lines 601–621. `/shared/*` now serves from
   `node_modules/openvibe-shared`, through an allowlist, with a versioned alias:

```diff
-// Web-push service worker: must be served from THIS origin (scope /), so each site
-// exposes the shared worker at /openvibe-sw.js rather than loading it from Network.
-app.get('/openvibe-sw.js', (req, res) => {
-    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
-    res.setHeader('Service-Worker-Allowed', '/');
-    res.setHeader('Cache-Control', 'no-cache');
-    res.sendFile(path.resolve(__dirname, '..', 'packages', 'openvibe-shared', 'openvibe-sw.js'));
-});
-
-// Serve openvibe-shared client-side libs (notification-ui.js, navbar.js, etc.)
-// Accessible at https://openvibe.network/shared/notification-ui.js etc.
-const sharedPath = path.resolve(__dirname, '..', 'packages', 'openvibe-shared');
-app.use('/shared', express.static(sharedPath, {
-    setHeaders(res, filePath) {
-        res.setHeader('Access-Control-Allow-Origin', '*');
-        // Override helmet's same-origin policies so other domains can load these scripts
-        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
-        res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
-        res.setHeader('Cache-Control', 'public, max-age=300');
-    },
-}));
+// openvibe-shared: the OpenVibe.Shared release package.json pins, from node_modules.
+const sharedFiles = require('openvibe-shared/files');
+
+// Web-push service worker: must be served from THIS origin (scope /), so each site
+// exposes the shared worker at /openvibe-sw.js rather than loading it from Network.
+app.get('/openvibe-sw.js', (req, res) => {
+    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
+    res.setHeader('Service-Worker-Allowed', '/');
+    res.setHeader('Cache-Control', 'no-cache');
+    res.sendFile(sharedFiles.path('openvibe-sw.js'));
+});
+
+// Serve openvibe-shared client-side libs (notification-ui.js, navbar.js, etc.) to every site at
+// https://openvibe.network/shared/<file>, and the same release at /shared/v1/<file> (OpenVibe.Shared
+// README, compatibility policy). Only the package's browser files: its server modules, tests and
+// scripts are not served. A ?v= equal to the file's content hash (navbar.js asks for nav-icons.js
+// that way) is cacheable forever; anything else gets five minutes.
+const sharedRev = new Map();
+function serveShared(req, res, next) {
+    const name = req.path.slice(1);
+    if (!sharedFiles.isBrowserFile(name)) return next();
+    if (!sharedRev.has(name)) sharedRev.set(name, require('crypto').createHash('sha256').update(fs.readFileSync(sharedFiles.path(name))).digest('hex').slice(0, 12));
+    res.setHeader('Access-Control-Allow-Origin', '*');
+    // Override helmet's same-origin policies so other domains can load these scripts
+    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
+    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
+    res.setHeader('Cache-Control', req.query.v === sharedRev.get(name) ? 'public, max-age=31536000, immutable' : 'public, max-age=300, stale-while-revalidate=60');
+    res.sendFile(sharedFiles.path(name));
+}
+app.use('/shared/v1', serveShared);
+app.use('/shared', serveShared);
```

   Behaviour changes here, all intended. `/shared/package.json`, `/shared/test/*`,
   `/shared/scripts/*` and the Node modules (`/shared/auth-client.js`, `/shared/middleware.js`, …)
   stop being public. Every file any site loads is in the allowlist: `navbar`, `theme-loader`,
   `footer`, `notification-ui`, `account-switcher`, `ov-mark`, `ov-icons`, `history`,
   `sso-client`, `panels`, `ui`, `island`, and `user-card` from the README example.

   The hash map is per process. The package only changes through a deploy, which restarts the
   process.

5. Update `deploy/nginx/openvibe.network.conf`. Remove the proxy's own `Cache-Control`. With
   `add_header`, nginx sends a second `Cache-Control` next to the app's, and the immutable one
   would be ignored:

```diff
     location /shared/ {
         proxy_pass http://127.0.0.1:4000;
         proxy_http_version 1.1;
         proxy_set_header Host $host;
-        # Shared browser modules are loaded by every OpenVibe site from here. Five minutes at the
-        # edge: a navbar/footer change reaches the whole network within minutes instead of an hour.
-        add_header Cache-Control "public, max-age=300, stale-while-revalidate=60";
+        # Shared browser modules are loaded by every OpenVibe site from here. The app sets
+        # Cache-Control: five minutes (+60s stale) by default, a year for a ?v= content-hash URL.
     }
```

   Also update `server/deploy/nginx-generator.js:33-36`: drop `cacheTime: '1h'` from
   `{ match: '/shared/' }`, because `expires 1h` adds a conflicting header as well. Re-run
   `node test/nginx-generator-live.test.js`, and adjust it if it asserts that `cacheTime`.

6. Update `scripts/roadmap-baseline/generate.js`. The canonical package now lives in the
   sibling repo, and consumers carry it in `node_modules`:

```diff
-    { name: 'OpenVibe.Network', service: 'network', scan: ['server', 'packages/openvibe-shared'] },
+    { name: 'OpenVibe.Network', service: 'network', scan: ['server'] },
+    { name: 'OpenVibe.Shared', service: 'shared', scan: ['.'] },
@@
-const CANONICAL_SHARED = path.join(NETWORK_DIR, 'packages/openvibe-shared');
+const CANONICAL_SHARED = path.join(ROOT, 'OpenVibe.Shared');
```

   At line 97, "Tables created by the vendored shared package", read
   `path.join(dir, 'node_modules/openvibe-shared')` when `vendor/openvibe-shared` is absent. At
   line 133, "Vendored shared-package drift", report each repo's pinned tag, read from
   `package.json` `dependencies['openvibe-shared']`, instead of hashing vendored files. Then
   regenerate `docs/roadmap-baseline/` and run `node test/roadmap-baseline.test.js`.
7. Update the docs. In `README.md:263-282` ("Shared Client Libraries"), change "The
   `packages/openvibe-shared/` directory provides…" to "The `openvibe-shared` package
   ([OpenVibers/OpenVibe.Shared](https://github.com/OpenVibers/OpenVibe.Shared), pinned in
   package.json) provides… served at `/shared/` (and `/shared/v1/`)". Add `nav-icons.js` to the
   table ("navbar glyphs, loaded by navbar.js"). In `docs/platform-plan.md:34-35` and
   `docs/shared-contracts.md:3,5`, replace "lives in `OpenVibe.Network/packages/openvibe-shared`
   … vendored (rsync, never edited)" with "lives in OpenVibe.Shared, consumed as a pinned
   release tarball". In `docs/shared-contracts.md:177`, the path becomes
   `node scripts/measure-icons.js` (in OpenVibe.Shared).
8. Verify:
   - `curl -sI https://openvibe.network/shared/navbar.js` returns 200 with `max-age=300`.
   - `curl -sI "https://openvibe.network/shared/nav-icons.js?v=$(node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync(require('openvibe-shared/files').path('nav-icons.js'))).digest('hex').slice(0,12))")"`
     returns 200 with `immutable`.
   - `curl -sI https://openvibe.network/shared/v1/footer.js` returns 200.
   - `curl -sI https://openvibe.network/shared/auth-client.js` returns 404, or the SPA fallback.
   - A Media, Tools or Community page shows the navbar icons, and DevTools shows
     `nav-icons.js?v=…` loaded after first paint.

---

## OpenVibe.Live

### References

```
package.json:47                        "openvibe-shared": "file:./vendor/openvibe-shared",
package-lock.json:29,2832,3779         lockfile entries
server/index.js:446                    () => path.resolve(__dirname, '../vendor/openvibe-shared'),
server/index.js:449-450                OpenVibeApp/packages fallbacks
scripts/perf/check-budgets.js:32,36    budget check reads vendor/ by path
test/features-registry.test.js:24      fileFor() reads vendor/ by path
public/js/ov-navbar-live.js:1          comment
public/js/app.js:1483                  comment
AGENTS.md:59  README.md:21  SETUP.md:14,30  docs/architecture.md:12  SECURITY_AUDIT.md:98   docs
.gitignore:31-32                       leftover "public/shared/" (nothing writes it any more)
```

`server/index.js:124` (`require('openvibe-shared/analytics')`) and `server/config.js:9`
(`require('openvibe-shared/url-resolver')`) need no change.

### Steps

1. Run `rm -rf node_modules/openvibe-shared && git rm -r vendor/openvibe-shared`.
2. Edit `package.json`, then run `npm install`:

```diff
-    "openvibe-shared": "file:./vendor/openvibe-shared",
+    "openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0",
```

3. Update `server/index.js`, currently lines 434–505. The package lists its own browser files,
   and that list includes the new `nav-icons.js`. The server serves them from
   `node_modules/openvibe-shared` with no candidate search:

```diff
 // ── Static Files ─────────────────────────────────────────────
-// Serve openvibe-shared browser assets at /shared/ — serve directly from the
-// resolved source directory to avoid write operations (the public/ directory
-// is read-only under systemd ProtectSystem=strict on production).
-const SHARED_BROWSER_FILES = ['theme-loader.js', 'notification-ui.js', 'account-switcher.js', 'openvibe-sw.js', 'footer.js', 'ov-mark.js', 'tooltip.js', 'history.js', 'navbar.js', 'sso-client.js', 'ov-icons.js', 'island.js', 'ui.js', 'panels.js'];
-let sharedServePath = null;
-
-(function resolveSharedAssets() {
-    const candidates = [
-        // The vendored copy is the source of truth (synced from OpenVibe.Network). On the
-        // server node_modules/openvibe-shared is a stale COPY, not a symlink, so it must
-        // never win over vendor/.
-        () => path.resolve(__dirname, '../vendor/openvibe-shared'),
-        () => path.dirname(require.resolve('openvibe-shared/package.json')),
-        () => path.resolve(__dirname, '../node_modules/openvibe-shared'),
-        () => path.resolve(__dirname, '..', '..', 'OpenVibeApp', 'packages', 'openvibe-shared'),
-        () => path.resolve(__dirname, '..', '..', 'packages', 'openvibe-shared'),
-    ];
-    for (const getPath of candidates) {
-        try {
-            const p = getPath();
-            if (p && fs.existsSync(p)) {
-                // Verify at least one required browser file exists
-                const found = SHARED_BROWSER_FILES.filter(f => fs.existsSync(path.join(p, f)));
-                if (found.length > 0) {
-                    sharedServePath = p;
-                    assets.setSharedDir(p);
-                    console.log(`[Server] /shared: serving ${found.length}/${SHARED_BROWSER_FILES.length} browser file(s) from ${p}`);
-                    const missing = SHARED_BROWSER_FILES.filter(f => !found.includes(f));
-                    if (missing.length) console.warn(`[Server] /shared: missing files: ${missing.join(', ')}`);
-                    return;
-                }
-            }
-        } catch (_) {}
-    }
-    console.error('[Server] /shared: openvibe-shared source not found — shared browser assets will return 404');
-})();
-
-if (sharedServePath) {
+// Serve openvibe-shared browser assets at /shared/ — straight from node_modules/openvibe-shared,
+// the OpenVibe.Shared release package.json pins (the public/ directory is read-only under
+// systemd ProtectSystem=strict on production). The package lists its own browser files.
+const sharedFiles = require('openvibe-shared/files');
+const SHARED_BROWSER_FILES = sharedFiles.BROWSER;
+const sharedServePath = sharedFiles.dir;
+assets.setSharedDir(sharedServePath);
+console.log(`[Server] /shared: serving ${SHARED_BROWSER_FILES.length} browser file(s) from ${sharedServePath}`);
+
+{
     // Web-push service worker must be same-origin with scope "/" → expose it at the root.
     app.get('/openvibe-sw.js', (req, res) => {
@@  (lines 474-499 unchanged: /openvibe-sw.js, whitelist, ?v= immutable, sendFile)
-} else {
-    console.error('[Server] /shared: serving unavailable — shared browser assets will return 404');
-    app.use('/shared', (req, res) => {
-        res.status(404).type('text/plain').send('Shared assets unavailable');
-    });
 }
```

   The unchanged middle already makes `nav-icons.js?v=<hash>` immutable, because
   `req.query.v === assets.hashOf('/shared/nav-icons.js')`. navbar.js asks for exactly that
   hash (`NAV_ICONS_REV`, sha256 truncated to 12 hex characters, the same as `assets.js`).
   `user-card.js` is now served too. It is public on the Network already.

4. Update `scripts/perf/check-budgets.js`:

```diff
 const assets = require(path.join(ROOT, 'server/web/assets'));
-try { assets.setSharedDir(path.join(ROOT, 'vendor/openvibe-shared')); } catch { /* */ }
+const SHARED_DIR = require('openvibe-shared/files').dir;
+try { assets.setSharedDir(SHARED_DIR); } catch { /* */ }
 const html = assets.renderRoute(assets.document('index.html').html, '/');
 const fileFor = (url) => {
     const p = url.split('?')[0];
-    return p.startsWith('/shared/') ? path.join(ROOT, 'vendor/openvibe-shared', path.basename(p)) : path.join(ROOT, 'public', p);
+    return p.startsWith('/shared/') ? path.join(SHARED_DIR, path.basename(p)) : path.join(ROOT, 'public', p);
 };
```

   Expected after v1.0.0: `eagerJsBrotliKB` goes from 263.8 (failing) to **252.4 / 260**, and
   `eagerJsRawKB` from 1147.1 to 1113.9. This was measured with the v1.0.0 `navbar.js`
   substituted into the budget script.

5. Update `test/features-registry.test.js:24`:

```diff
-const fileFor = (url) => url.startsWith('/shared/') ? path.join(ROOT, 'vendor/openvibe-shared', path.basename(url)) : path.join(PUB, url);
+const fileFor = (url) => url.startsWith('/shared/') ? require('openvibe-shared/files').path(path.basename(url)) : path.join(PUB, url);
```

   `files.path()` throws for a non-browser file. That is stricter than before, and correct,
   because a feature must not reference one.

6. Update comments and docs:
   - `public/js/ov-navbar-live.js:1`: "(vendor/openvibe-shared/navbar.js, served at
     /shared/navbar.js)" becomes "(openvibe-shared/navbar.js from OpenVibe.Shared, served at
     /shared/navbar.js)".
   - `public/js/app.js:1483`: "(vendor/openvibe-shared/panels.js" becomes
     "(openvibe-shared/panels.js".
   - `AGENTS.md:59`: "**openvibe-shared:** Pinned release of OpenVibers/OpenVibe.Shared
     (`"openvibe-shared": "https://codeload…/refs/tags/vX.Y.Z"`), served at `/shared/*` from
     `node_modules`. Change it there and bump the tag; never edit `node_modules`."
   - `README.md:21`, `SETUP.md:14,30` and `docs/architecture.md:12`: same wording.
   - `SECURITY_AUDIT.md:98`: `vendor/openvibe-shared/analytics.js` becomes
     `openvibe-shared/analytics.js`, with remediation "change in OpenVibe.Shared, release, bump
     the pin".
   - `.gitignore:31-32`: delete the leftover `public/shared/` lines. This is optional.
7. Deploy. `deploy/scripts/deploy.sh` treats `package.json` and `package-lock.json` as
   "deps + server", so the release runs `npm ci --omit=dev`, which installs the tarball, and
   then restarts. A restart drops live RTMP publishers, so check `/api/streams` first and use
   `deploy.sh --wait-idle`.
8. Verify:
   - `npm test` passes, including `perf:budget`.
   - `curl -sI https://openvibe.live/shared/nav-icons.js?v=<hash>` returns an immutable 200.
   - The home page's navbar icons render. `nav-icons.js` loads after first paint.

---

## OpenVibe.Community

### References

```
package.json:25                 "openvibe-shared": "file:./vendor/openvibe-shared"
package-lock.json:21,1075,1567  lockfile entries
README.md:203                   "vendor/openvibe-shared  unmodified copy of OpenVibe.Network/packages/openvibe-shared"
```

Browsers load `https://openvibe.network/shared/{theme-loader,navbar,footer}.js` absolutely (the
`NETWORK_URL` constant at `server/render/layout.js:16`, used at lines 120–125). Server requires
are `server/app.js:82` (legal), `server/auth/routes.js:37` (auth-client) and
`server/render/layout.js:118,133` (app-icon, footer). Neither needs a change.

The vendored copy's tracked `test/` files never ran and are deleted with it.

### Steps

1. Run `rm -rf node_modules/openvibe-shared && git rm -r vendor/openvibe-shared`.
2. Edit `package.json`, then run `npm install`:

```diff
-    "openvibe-shared": "file:./vendor/openvibe-shared"
+    "openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0"
```

3. `README.md:203`: the line becomes
   `node_modules/openvibe-shared  pinned OpenVibe.Shared release (package.json); never edit`.
   README line 173 ("serve the current `openvibe-shared`…") still reads correctly.
4. `npm test`. `test/ssr.test.js:19-21` asserts the absolute Network URLs, which are unchanged.
   Community's CI (`.github/workflows/ci.yml`, `npm ci`) fetches the tarball from codeload.
5. There is no deploy script. On the host, `git pull && npm ci --omit=dev && systemctl restart openvibe-community`.

---

## OpenVibe.Media

### References

```
package.json:22                 "openvibe-shared": "file:./vendor/openvibe-shared",
package-lock.json:20,1973,2587  lockfile entries
README.md:42                    "vendor/openvibe-shared/  vendored shared helpers (do not edit; re-sync from canonical)"
```

Browsers load `${NETWORK_URL}/shared/{theme-loader,navbar,footer}.js`
(`server/public/page-chrome.js:14,82,146-147`) and
`https://openvibe.network/shared/theme-loader.js` (`server/public/browse.js:240`). Server
requires are `server/index.js:42`, `server/user-auth.js:37`,
`server/public/browse.js:269,271,276` and `server/public/page-chrome.js:81,187,191`. None of them
needs a change.

### Steps

1. Run `rm -rf node_modules/openvibe-shared && git rm -r vendor/openvibe-shared`.
2. Edit `package.json`, then run `npm install`:

```diff
-    "openvibe-shared": "file:./vendor/openvibe-shared",
+    "openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0",
```

3. `README.md:42`: the line becomes
   `node_modules/openvibe-shared/  pinned OpenVibe.Shared release (package.json); never edit`.
4. `npm test`. `test/public-pages.test.js:40,42` asserts the absolute Network URLs, which are
   unchanged.
5. Deploy: pull, `npm ci --omit=dev`, restart. This picks up the ov-icons centring fix from
   `docs/divergence-2026-09-22.md` for server-side icons.

---

## OpenVibe.Tools

Tools has no root dependency. Each app under `apps/*` has its own `package.json`, and
`deploy/scripts/deploy.sh` rsyncs `vendor/openvibe-shared` into every app's
`node_modules/openvibe-shared`, because npm copies `file:` dependencies on the host. After the
change, each app installs its own copy of the tarball, and npm's cache means it is downloaded
once. There is no rsync and no symlink.

### References

```
package.json:7                     "install:all": "npm --prefix vendor/openvibe-shared install && npm --prefix apps/gateway install && …"
deploy/scripts/deploy.sh:2-3,11    header comment + rsync of vendor/openvibe-shared into each app
apps/gateway/server/index.js:282   res.sendFile(path.resolve(__dirname, '..', '..', '..', 'vendor', 'openvibe-shared', 'openvibe-sw.js'));
apps/audio/package.json:21         "openvibe-shared": "file:../../vendor/openvibe-shared",
apps/docs/package.json:20          "openvibe-shared": "file:../../vendor/openvibe-shared",
apps/food/package.json:19          "openvibe-shared": "file:../../vendor/openvibe-shared"
apps/gateway/package.json:20       "openvibe-shared": "file:../../vendor/openvibe-shared"
apps/img/package.json:20           "openvibe-shared": "file:../../vendor/openvibe-shared",
apps/maps/package.json:14          "openvibe-shared": "file:../../vendor/openvibe-shared",
apps/text/package.json:19          "openvibe-shared": "file:../../vendor/openvibe-shared"
apps/yt/package.json:20            "openvibe-shared": "file:../../vendor/openvibe-shared",
apps/gateway/package-lock.json:19,22,752   lockfile entries
apps/maps/package-lock.json:22,25,1287     lockfile entries
apps/text/package-lock.json:19,22,873      lockfile entries
README.md:26                       "└── openvibe-shared  # vendored shared package (canonical copy lives in OpenVibe.Network)"
apps/audio/README.md:34,52         "openvibe-shared package (vendored at `vendor/openvibe-shared`)"
```

Browser pages load `https://openvibe.network/shared/*` absolutely: `apps/*/public/index.html`,
gateway `public/{audio,img,dev,net}.html`, `server/pages/site.js:120`, and 31
`apps/text/public/*.html` pages. They need no change. Server requires such as
`openvibe-shared/analytics` in every app, and gateway's brand, legal, auth-client, app-icon,
icons, seo and footer, need no change either.

### Steps

1. `git rm -r vendor/openvibe-shared`. The untracked `vendor/openvibe-shared/node_modules` left
   by `install:all` goes too: `rm -rf vendor`.
2. In each of the 8 app `package.json` files, keep the trailing comma where the file has one:

```diff
-    "openvibe-shared": "file:../../vendor/openvibe-shared",
+    "openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0",
```

   Then run
   `for a in apps/*/; do [ -f "$a/package.json" ] && (cd "$a" && rm -rf node_modules/openvibe-shared && npm install --no-audit --no-fund); done`.
   That regenerates the three tracked lockfiles (gateway, maps and text).
3. Update the root `package.json:7`:

```diff
-    "install:all": "npm --prefix vendor/openvibe-shared install && npm --prefix apps/gateway install && npm --prefix apps/maps install && …",
+    "install:all": "npm --prefix apps/gateway install && npm --prefix apps/maps install && …",
```

   Only the leading `npm --prefix vendor/openvibe-shared install && ` is removed.

4. Update `deploy/scripts/deploy.sh`:

```diff
 #!/usr/bin/env bash
-# Deploy OpenVibe.Tools on the host: pull, refresh the vendored shared package inside each app's
-# node_modules (npm copies file: dependencies on this host, so a pull alone leaves them stale),
-# install new dependencies when a package.json changed, restart the units, check health.
+# Deploy OpenVibe.Tools on the host: pull, install dependencies in each app whose package.json
+# changed (that includes a new openvibe-shared release tag), restart the units, check health.
 set -euo pipefail
 cd "$(dirname "$0")/../.."
 BEFORE=$(git rev-parse HEAD); git pull -q --ff-only; AFTER=$(git rev-parse HEAD)
 for app in apps/*/; do
   [ -f "$app/package.json" ] || continue
   if git diff --name-only "$BEFORE" "$AFTER" -- "$app/package.json" | grep -q . || [ ! -d "$app/node_modules" ]; then (cd "$app" && npm install --omit=dev --no-audit --no-fund --silent); fi
-  d="$app/node_modules/openvibe-shared"; [ -L "$d" ] || { mkdir -p "$d"; rsync -a --delete --exclude node_modules vendor/openvibe-shared/ "$d/"; }
 done
```

   The first deploy after this change touches every app's `package.json`, so every app runs
   `npm install`. That replaces the rsynced real-directory copy with the tarball. If an app's
   `node_modules/openvibe-shared` is a leftover symlink into `vendor/`, delete it before that
   deploy.

5. Update `apps/gateway/server/index.js:282`:

```diff
-    res.sendFile(path.resolve(__dirname, '..', '..', '..', 'vendor', 'openvibe-shared', 'openvibe-sw.js'));
+    res.sendFile(require('openvibe-shared/files').path('openvibe-sw.js'));
```

6. Update the docs. `README.md:26` becomes `(openvibe-shared is a pinned OpenVibe.Shared
   release in each app's package.json; no vendor/ copy)`, and `apps/audio/README.md:34,52`
   becomes "openvibe-shared (pinned OpenVibe.Shared release)". `README.md:116` ("Browser pages
   load shared JS absolutely from `https://openvibe.network/shared/`") stays true.
7. Verify with `npm --prefix apps/gateway test` and `npm --prefix apps/yt test`. Then run
   `node -e "require('openvibe-shared/icons')"` in each app directory. After deploy, check that
   `/api/health` is healthy and that gateway ring icons are centred. That comes from the
   ov-icons fix Tools lacked.

---

## OpenVibe.Sites (optional, no package.json today)

### References

```
build.js:16        comment "Vendored from OpenVibe.Network/packages/openvibe-shared (copy, never edit)"
build.js:17        const legal = require('./vendor/openvibe-shared/legal');
build.js:63-64     require('./vendor/openvibe-shared/app-icon').headTags(…) / .CRITICAL
build.js:193       require('./vendor/openvibe-shared/footer').ssr(…)
build.js:210       require('./vendor/openvibe-shared/app-icon').manifest(…)
vendor/openvibe-shared/{app-icon,chrome-ssr,footer,legal,seo}.js   (5-file subset, byte-identical to v1.0.0)
```

### Steps

1. Add `package.json`:

```json
{
  "name": "openvibe-sites",
  "private": true,
  "description": "Placeholder and hub pages for the planned OpenVibe domains (static build)",
  "scripts": { "build": "node build.js" },
  "dependencies": {
    "openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v1.0.0"
  }
}
```

   Run `npm install` and commit `package-lock.json`. `.gitignore` already lists `node_modules/`.

2. Update `build.js`:

```diff
-// Vendored from OpenVibe.Network/packages/openvibe-shared (copy, never edit): the network's legal documents.
-const legal = require('./vendor/openvibe-shared/legal');
+// The network's legal documents, from the pinned OpenVibe.Shared release (package.json).
+const legal = require('openvibe-shared/legal');
@@
-${require('./vendor/openvibe-shared/app-icon').headTags({ site: 'network' }).split('\n')[0]}
-${require('./vendor/openvibe-shared/app-icon').CRITICAL}
+${require('openvibe-shared/app-icon').headTags({ site: 'network' }).split('\n')[0]}
+${require('openvibe-shared/app-icon').CRITICAL}
@@
-${require('./vendor/openvibe-shared/footer').ssr({ service: 'network', variant: 'full' })}
+${require('openvibe-shared/footer').ssr({ service: 'network', variant: 'full' })}
@@
-function manifest(site) { return JSON.stringify(require('./vendor/openvibe-shared/app-icon').manifest({ …
+function manifest(site) { return JSON.stringify(require('openvibe-shared/app-icon').manifest({ …
```

3. Run `git rm -r vendor/openvibe-shared`, then `node build.js`. `git status dist/` must show no
   changes, because the five modules are byte-identical to v1.0.0.
4. Update `deploy/scripts/deploy.sh`: add `npm ci --omit=dev --no-audit --no-fund` before
   `node build.js`. The host needs outbound HTTPS to codeload.github.com.

The published `dist/` HTML hard-codes `https://openvibe.network/shared/navbar.js`. That is one
reason the Network keeps `/shared/<file>` on the v1 line (README, compatibility policy).

---

## After all consumers moved

- `git grep -n 'vendor/openvibe-shared'` is empty in every repo, apart from historical docs.
  `find ~/OpenVibers -path '*/vendor/openvibe-shared' -type d` finds nothing.
- Every future shared change follows the same path: a PR to OpenVibe.Shared, a `vX.Y.Z` tag,
  then a pin bump in Network first and in the other consumers after.
