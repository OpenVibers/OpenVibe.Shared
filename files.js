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
    'ov-ai-choice.js',      // the model chip and its choice sheet (openvibe-shared/ov-ai-choice)
    'navbar.js',            // shared top bar (eager on every site)
    'nav-icons.js',         // navbar glyphs beyond its own, fetched by navbar.js after first paint
    'theme-loader.js',      // applies the theme before first paint
    'footer.js',            // shared footer (also required on the server by frame.js)
    'shipped.js',           // "Recently shipped" from the network changelog (openvibe.blog)
    'notification-ui.js',   // bell + notification panel
    'notification-live.js', // the bell's realtime feed over OpenVibe.Events; notification-ui loads it on demand (realtime on)
    'action-center.js',     // the ✦ Action Center; notification-ui loads it on the first click
    'dock.js',              // the Dock and its pill; navbar.js loads it for a signed-in person
    'dock-mount.js',        // the Dock body inside another sheet; dock.js loads it on first mountInto
    'dock-runs.js',         // the Dock's content-aware Agents rows and overview, loaded with that tab
    'ai-marks-client.js',   // maker marks on a run receipt, loaded only in Agents
    'presence.js', 'purse.js', 'machines.js', 'ov-drop.js', 'mini.js', 'ov-tip.js', 'overlay.js', 'nav-slots.js',          // your online status: the dot, the heartbeat, the picker; navbar.js loads it for a signed-in person
    'dock-vibe.js',         // the Dock's Vibe tab (L48 V2); dock.js loads it the first time the tab opens
    'dock-timer.js',        // the Dock's timer (L48 R2); dock.js loads it while a timer runs or its menu opens
    'dock-share.js',        // the Dock's Send to… (4.144.0); dock.js loads it the first time something is sent
    'dock-card.js',         // a known OpenVibe link's card under a Dock message (4.147.0); loaded the first time one shows
    'ov-canvas.js',         // an agent's live panel (actor.canvas@1, 4.145.0); a page that shows canvases loads it
    'dock-actor.js',        // the Dock's Actor block (Actor v3 A3); dock.js loads it the first time the Actor tab opens
    'dock-code.js',         // the Code part (4.202.0): start a coding task, your latest ones; dock.js loads it for Code
    'dock-agent.js',        // the Dock's agent view (K-D3); dock.js loads it the first time the Agents tab opens
    'dock-timeline.js',     // the Dock's one timeline (A6); dock.js loads it with the Agent panel
    'account-switcher.js',
    'user-card.js',
    'ov-mark.js',           // the OV brand mark drop-in
    'ov-glyphs.js',         // the network's own icons in place of Font Awesome's (built from glyphs.js; navbar.js loads it)
    'brands.js',            // brand logos (Simple Icons, CC0), fetched by ov-glyphs.js the first time a page shows one (4.72.0)
    'ov-look.js',           // the Look panel: themes, the season, more on openvibe.design (navbar.js loads it on first open)
    'ov-fx.js',             // the network's effects (data-fx): glint, glow, lift, press, ripple, tilt, reveal, count, confetti
    'ov-labels.js',         // content labels (L1): each viewer's show / blur / hide; navbar.js loads it when a page has [data-ov-labels]
    'ov-forms.js',          // OpenVibe's own select (a menu on a computer, a sheet on a phone); navbar.js loads it when a page has a form control
    'ov-qr.js',             // a QR code from a link, on the device: the Share sheet's QR code (ov-share.js loads it on first use)
    'ov-locker-core.js',    // openvibe-sdk/locker for the browser, generated (scripts/build-locker-core.js): WebCrypto only, the SDK's own vectors
    'ov-locker.js',         // Locker in the browser (plan Q2): a locked item's card, making and unlocking your locker; crypto in ov-locker-core.js
    'ov-wallet.js',
    'ov-share.js',          // the one Share sheet (plan track Q): who can open a thing, people by @name, transfer; navbar.js loads it on the first press of a [data-ov-share-sheet] button
    'ov-upload.js',         // shared file picker, upload queue and ov-progress
    'messages.js',          // Chat's two views: room lines and texting bubbles (openvibe-shared/messages)
    'ov-thread.js',         // one conversation UI (L55 C4): the drawer, search, composer, copy, streaming turns; markup from openvibe-shared/thread, drawn with thread.css
    'ov-composer.js',       // the one composer (4.202.0): files, / and @, voice, drafts, your settings; ov-thread.js loads it
    'ov-combo.js',          // the one dropdown for a field (4.202.0): async sources, sections, Create; ov-thread.js loads it
    'ov-icons.js',          // ring icons (also required on the server as openvibe-shared/icons)
    'ov-home.js',           // the menu's home screen and wall (search.js loads it for You and Feed)
    'history.js',           // cross-site history
    'sso-client.js',        // link hand-off, FedCM
    'panels.js',            // one-open-at-a-time panel coordinator
    'surfaces.js',          // scroll locking and gestures for sheets; outside pointer for pop-overs
    'ui.js',                // toasts and page notices
    'route-transition.js',  // page-move bar, loading line and fade-in; web-runtime.js fetches it on the first move
    'boost.js',             // smooth same-site page moves for a server-rendered site (OVBoost; plan T11)
    'island.js',            // activity island
    'items.js',             // what people wear (OpenVibe.Inventory name effects, plan T21); draw with items.css
    'profile-panel.js',     // a person's stuff on any site (worn items, badges, achievements), from the Network profile
    'tooltip.js',
    'player.js',            // the network's one video player look: enhances video[data-ov-player]; draw with player.css
    'ov-sync.js',           // one timeline for many players (seven domains B4): OVSync.attach(media, { room, socket }); no dependencies
    'vibes-pay.js',         // Vibes Pay: OpenVibe.vibes.pay() and <button data-ov-vibes-pay> (MONEY.md, D12); 4.111.0
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
    'ov-forms.css',         // the look of ov-forms.js's select, the site-coloured checkboxes, switches and sliders, .ov-field (docs/forms.md)
    'ov-locker.css',        // ov-locker.js's look: the locked card, the locker sheets, the recovery kit (docs/locker.md)
    'ov-wallet.css',
    'ov-ai-choice.css',     // the model chip and its choice sheet (ov-ai-choice.js)
    'ov-share.css',         // ov-share.js's look: the sheet, the recipient's offer banner, the not-on-the-list gate (docs/share.md)
    'ov-upload.css',        // picker, queue and ov-progress states
    'messages.css',         // the room and bubble views' look
    'room.css',             // kit.card, kit.rail and a room's accent (4.29.1; load after kit.css where cards, rails or sc.room() are)
    'thread.css',           // the conversation UI's look (openvibe-shared/thread, ov-thread.js; plan L55 C4)
    'kit-layout.css',       // the fluid scale, the layout primitives (.ov-stack, .ov-switcher…) and the opt-in .ov-base (4.78.0; after kit.css)
    'kit-data.css',         // Kit 2's look: steps, tables, charts, rankings, meters, drop zones, receipts (4.37.0; after kit.css)
    'agent-session.css',    // agent-session.js's look (4.32.0; the script links it from beside itself unless the page does)
    'ov-glyphs-font.css',   // the glyphs as a font: <i class="ovi ovi-eye"> (4.62.0; built with the font, scripts/build-glyph-fonts.py)
    'ov-glyphs-fa.css',     // Font Awesome's class names on the glyph font, for a site that drops Font Awesome's own (4.62.0)
]);
// Fonts sites serve at /shared/<file>: the brand face the names are set in (navbar.js declares it from beside itself),
// and the glyph font.
const FONTS = Object.freeze([
    'ov-brand.woff2',       // Nunito (SIL OFL 1.1, OFL-Nunito.txt), Latin, weights 700-900: the OpenVibe names (4.59.0)
    'ov-glyphs.woff2',      // the OpenVibe glyphs as a font (4.62.0; TTF and OTF for desktop apps are in glyph-fonts/)
    'ov-glyphs-thin.woff2', 'ov-glyphs-light.woff2', 'ov-glyphs-bold.woff2', 'ov-glyphs-solid.woff2',
]);
// Pictures sites serve at /shared/<file>.
const IMAGES = Object.freeze([
    'ov-glyphs.svg',        // every glyph as a <symbol>: <svg><use href="/shared/ov-glyphs.svg#ovg-eye"/></svg> (4.62.0)
]);
const served = (name) => BROWSER.includes(String(name)) || STYLES.includes(String(name)) || FONTS.includes(String(name)) || IMAGES.includes(String(name));

module.exports = {
    dir: __dirname,
    BROWSER,
    STYLES,
    FONTS,
    IMAGES,
    isBrowserFile: served,
    path: (name) => {
        if (!served(name)) throw new Error(`openvibe-shared: ${name} is not a browser file`);
        return path.join(__dirname, name);
    },
};
