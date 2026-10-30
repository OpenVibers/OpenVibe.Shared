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
    'action-center.js',     // the ✦ Action Center; notification-ui loads it on the first click
    'dock.js',              // the Dock and its pill; navbar.js loads it for a signed-in person
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
    'items.js',             // what people wear (OpenVibe.Inventory name effects, plan T21); draw with items.css
    'profile-panel.js',     // a person's stuff on any site (worn items, badges, achievements), from the Network profile
    'tooltip.js',
    'player.js',            // the network's one video player look: enhances video[data-ov-player]; draw with player.css
    'release-watch.js',     // keeps open tabs on a supported release (ADR-016), loaded after first paint
    'release-update.js',    // plans a new release and applies style/content in place; release-watch loads it on demand
    'web-runtime.js',       // feature loader and route lifecycle (OVWebRuntime), from Live's ov-loader
    'appbar.js',            // the phone app bar; navbar.js loads it only for a site that sets appBar
    'kit.js',               // the OpenVibe Kit's builders in the page (for pages that draw themselves; with kit-web.js)
    'kit-web.js',           // the OpenVibe Kit's behaviour (copy, menus, Enter to send, confirms, sheets): all a server-rendered site loads
    'kit-data-web.js',      // Kit 2's behaviour: chart readouts, scatter labels, drop zones (4.37.0; with kit-data.css)
    'tokens.js',            // OpenVibe Tokens: a theme as DTCG tokens, compiled to CSS, Tailwind, Compose, SwiftUI, Flutter, Figma (4.40.0)
    'components.js',        // the kit's components as a contract (anatomy, tokens, states, a11y), kit documents, native reference views (4.42.0)
    'search.js',            // search everything from the navbar's magnifier, / or Ctrl+K; navbar.js loads it on first use
    'loading.js',           // the one loading look: a poster-backed overlay with status and progress, and skeleton rows
    'agent-session.js',     // a coding agent's session as people read it: steps grouped, live output, diffs, helpers, hand-offs
    'motion.js',            // reveal on scroll, number ticker, typed hints (4.28.0; the server writes the end state)
    'rooms.js',             // the rooms' accents, lines and motifs (OpenVibeRooms; 4.28.0)
    'openvibe-sw.js',       // Web Push service worker
]);

// Stylesheets sites serve at /shared/<file> beside the scripts.
const STYLES = Object.freeze([
    'showcase.css',         // openvibe-shared/showcase's sections + the ring icons (generated: scripts/build-styles.js)
    'items.css',            // Live's name effects for items.js (live.name_effect.css@1)
    'profile-panel.css',    // the panel profile-panel.js draws
    'player.css',           // player.js's controls
    'kit.css',              // the OpenVibe Kit's look (kit.js / openvibe-shared/kit build the markup; docs/kit.md)
    'room.css',             // kit.card, kit.rail and a room's accent (4.29.1; load after kit.css where cards, rails or sc.room() are)
    'kit-data.css',         // Kit 2's look: steps, tables, charts, rankings, meters, drop zones, receipts (4.37.0; after kit.css)
    'agent-session.css',    // agent-session.js's look (4.32.0; the script links it from beside itself unless the page does)
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
