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
    'footer.js',            // shared footer (also required on the server by chrome-ssr.js)
    'notification-ui.js',   // bell + notification panel
    'account-switcher.js',
    'user-card.js',
    'ov-mark.js',           // the OV brand mark drop-in
    'ov-icons.js',          // ring icons (also required on the server as openvibe-shared/icons)
    'history.js',           // cross-site history
    'sso-client.js',        // link hand-off, FedCM
    'panels.js',            // one-open-at-a-time panel coordinator
    'ui.js',                // toasts and page notices
    'island.js',            // activity island
    'tooltip.js',
    'openvibe-sw.js',       // Web Push service worker
]);

module.exports = {
    dir: __dirname,
    BROWSER,
    isBrowserFile: (name) => BROWSER.includes(String(name)),
    path: (name) => {
        if (!BROWSER.includes(String(name))) throw new Error(`openvibe-shared: ${name} is not a browser file`);
        return path.join(__dirname, name);
    },
};
