'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/files — which files of this package are browser scripts.
// Sites serve exactly these at /shared/<file> (openvibe-sw.js at /openvibe-sw.js,
// same origin, scope "/"); everything else in the package is Node-only and must
// not be served. The size report and the browser-bundle test read this list too.
//
//   const shared = require('openvibe-shared/files');
//   app.get('/shared/:file', (req, res, next) => shared.isBrowserFile(req.params.file)
//       ? res.sendFile(shared.path(req.params.file)) : next());
// ═══════════════════════════════════════════════════════════════

const path = require('path');

const BROWSER = Object.freeze([
    'navbar.js',            // shared top bar (eager on every site)
    'nav-icons.js',         // navbar glyphs beyond its own, fetched by navbar.js after first paint
    'theme-loader.js',      // applies the theme before first paint
    'footer.js',            // shared footer (also required on the server by frame.js)
    'shipped.js',           // "Recently shipped" from the network changelog (openvibe.blog)
    'notification-ui.js',   // bell + notification panel
    'notification-live.js', // the bell's realtime feed over OpenVibe.Events; notification-ui loads it on demand (realtime on)
    'account-switcher.js',
    'user-card.js',
    'ov-mark.js',           // the OV brand mark drop-in
    'ov-icons.js',          // ring icons (also required on the server as openvibe-shared/icons)
    'history.js',           // cross-site history
    'sso-client.js',        // link hand-off, FedCM
    'panels.js',            // one-open-at-a-time panel coordinator
    'ui.js',                // toasts and page notices
    'route-transition.js',  // page-move bar, loading line and fade-in; web-runtime.js fetches it on the first move
    'boost.js',             // smooth same-site page moves for a server-rendered site (OVBoost; plan T11)
    'island.js',            // activity island
    'tooltip.js',
    'release-watch.js',     // keeps open tabs on a supported release (ADR-016), loaded after first paint
    'release-update.js',    // plans a new release and applies style/content in place; release-watch loads it on demand
    'web-runtime.js',       // feature loader and route lifecycle (OVWebRuntime), from Live's ov-loader
    'openvibe-sw.js',       // Web Push service worker
]);

// Stylesheets sites serve at /shared/<file> beside the scripts (generated from their module, never edited by hand).
const STYLES = Object.freeze([
    'showcase.css',         // openvibe-shared/showcase's sections + the ring icons (scripts/build-styles.js)
]);
const served = (name) => BROWSER.includes(String(name)) || STYLES.includes(String(name));

module.exports = {
    dir: __dirname,
    BROWSER,
    STYLES,
    isBrowserFile: served,
    path: (name) => {
        if (!served(name)) throw new Error(`openvibe-shared: ${name} is not a browser file`);
        return path.join(__dirname, name);
    },
};
