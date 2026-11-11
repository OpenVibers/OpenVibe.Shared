// OpenVibe — the shared navbar (the OpenVibe Frame's top bar). Options and behaviour: README.md, "The navbar".

(function (root) {
    'use strict';

    let _config = {
        service: 'network', token: null, user: null, apiBase: 'https://openvibe.network', frameBase: null,
        onLogin: null, onLogout: null, loginUrl: null, sessionUrl: null, logoutUrl: null,
        brand: null, brandName: null, brandIcon: null, compact: 'auto',
        links: null, menu: null, recent: true,
        history: null, silentLogin: null, fedcm: 'optional', fedcmLogin: null,   // README.md, "The navbar"
    };
    const _runtimeMenu = { before: [], after: [] };
    let _own = [];   // the You tab's small items
    let _runtimeLinks = null;
    let _navEl = null;
    // A site's own buttons (lead before the brand, actions before the bell): nav-slots.js.
    let _lead = null;
    const _actions = new Map();

    function injectStyles() {
        if (document.getElementById('openvibe-navbar-styles')) return;
        const s = document.createElement('style');
        s.id = 'openvibe-navbar-styles';
        s.textContent = `
            .openvibe-navbar {
                position: sticky; top: 0; z-index: 10000;
                height: 52px; display: flex; align-items: center; padding: 0 clamp(8px, 1.6vw, 16px); gap: 6px;
                background: var(--bg-secondary, #252530);
                border-bottom: 1px solid var(--border, #333340);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                color: var(--text-primary, #e0e0e0);
            }
            /* At the very top the bar fades into the page (no background, no border); a scroll brings the frosted bar back.
               A page whose hero runs under the bar opts in with body.ov-nav-overlay: the bar then sits over the hero, with a
               soft scrim for the text. ovnav-top is kept by the navbar itself on every render and scroll. */
            .openvibe-navbar { transition: background-color .45s cubic-bezier(.2,.7,.2,1), border-color .45s cubic-bezier(.2,.7,.2,1), box-shadow .45s cubic-bezier(.2,.7,.2,1), -webkit-backdrop-filter .45s, backdrop-filter .45s, transform .32s cubic-bezier(.2,.7,.2,1); }
            /* On a phone the bar steps away while you read down the page and comes back the moment you scroll up (4.25.0;
               the owner, 2026-10-28: the bar's at-the-top effect "doesn't work on mobile… the whole thing needs to be
               improved"). Never while one of its menus is open. A site turns it off with autoHide: false. */
            .openvibe-navbar.ovnav-hide { transform: translateY(calc(-100% - 10px)); box-shadow: none; }
            #navbar-mount:has(> .ovnav-hide) { pointer-events: none; }
            /* The top bar while a page changes (4.159.0): the OpenVibe gradient with a soft glow and a bright head that runs. */
            .ovrt-bar { position: fixed; left: 0; top: 0; height: 3px; width: 100%; z-index: 2147483000; pointer-events: none; transform-origin: 0 50%; transform: scaleX(0); opacity: 0;
                background: linear-gradient(90deg, var(--accent, #3b82f6), var(--accent-light, #60a5fa) 60%, var(--accent-2, #a78bfa));
                box-shadow: 0 0 10px color-mix(in srgb, var(--accent, #3b82f6) 70%, transparent), 0 0 3px var(--accent-light, #60a5fa); border-radius: 0 3px 3px 0; }
            .ovrt-bar::after { content: ''; position: absolute; right: 0; top: -2px; width: 90px; height: 7px; border-radius: 50%; background: var(--accent-light, #93c5fd); filter: blur(4px); opacity: .9; }
            .ovrt-bar.is-run { opacity: 1; transform: scaleX(.88); transition: transform 3s cubic-bezier(.08, .7, .2, 1), opacity .1s; }
            .ovrt-bar.is-done { opacity: 0; transform: scaleX(1); transition: transform .2s ease, opacity .35s .15s; }
            html[data-ov-motion=off] .ovrt-bar::after{display: none}
            .openvibe-navbar::before { content: ""; position: absolute; inset: 0 0 -28px; pointer-events: none; z-index: -1; opacity: 0; transition: opacity .45s cubic-bezier(.2,.7,.2,1); background: linear-gradient(180deg, rgba(4,7,14,.62), rgba(4,7,14,.28) 55%, rgba(4,7,14,0)); }
            .openvibe-navbar:not(.ovnav-top) { background-color: color-mix(in srgb, var(--bg-secondary, #252530) 84%, transparent); -webkit-backdrop-filter: saturate(1.5) blur(16px); backdrop-filter: saturate(1.5) blur(16px); box-shadow: 0 12px 32px -14px rgba(0,0,0,.6); }
            .openvibe-navbar.ovnav-top { background-color: transparent; border-bottom-color: transparent; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
            /* The bar is sticky, but a #navbar-mount wrapper exactly its height gave it no room to stick in: the wrapper sticks. */
            #navbar-mount { position: sticky; top: 0; z-index: 10000; }
            body.ov-nav-overlay .openvibe-navbar.ovnav-top::before { opacity: 1; }
            body.ov-nav-overlay > #navbar-mount, body.ov-nav-overlay > .openvibe-navbar { margin-bottom: calc(-1 * var(--ovnav-real-h, 52px)); }
            body.ov-panel-open .openvibe-navbar.ovnav-top { background-color: var(--bg-secondary, #252530); border-bottom-color: var(--border, #333340); }
            /* Names: the brand face (ov-brand.woff2: Nunito, Latin, 700-900). */
            @font-face { font-family: 'OV Brand'; src: url(${siblingV('ov-brand.woff2')}) format('woff2'); font-weight: 700 900; font-style: normal; font-display: swap; unicode-range: U+0020-007E, U+00A0, U+00B7, U+00E9, U+2013-2014, U+2018-2019, U+201C-201D, U+2026; }
            .openvibe-navbar-brand { display: flex; align-items: center; gap: 9px; text-decoration: none; color: inherit; margin-right: 8px; min-width: 0; }
            /* Brand group: mark + linked wordmark + launcher read as one control. Every property a host
               page might set on bare "nav a" / "a" is reset here, so the brand looks the same everywhere. */
            .openvibe-navbar .openvibe-navbar-brand a, .openvibe-navbar .openvibe-navbar-brand a:hover { all: unset; cursor: pointer; color: inherit; font: inherit; }
            :where(.openvibe-navbar-brand) button.flame { all: unset; cursor: pointer; color: inherit; font: inherit; }
            .openvibe-navbar .openvibe-navbar-brand .flame[aria-expanded="true"] { background: var(--accent-glow, rgba(59,130,246,.18)); }
            .openvibe-navbar .openvibe-navbar-brand button.flame:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
            [data-ov-scroll-focus]:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
            .openvibe-navbar .openvibe-navbar-brand { gap: 6px; padding: 2px; border-radius: 12px; margin-right: 0; }
            .openvibe-navbar .openvibe-navbar-brand .flame { display: inline-grid; place-items: center; width: auto; min-width: 30px; height: 34px; padding: 0 4px; box-sizing: border-box; border-radius: 9px; transition: background .15s; }
            .openvibe-navbar .openvibe-navbar-brand .flame:hover { background: var(--accent-glow, rgba(59,130,246,.14)); }
            .openvibe-navbar .openvibe-navbar-brand .name { align-items: center; gap: 0; font-family: 'OV Brand', Nunito, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 19px; letter-spacing: -.25px; }
            .openvibe-navbar .openvibe-navbar-brand .name a { padding: 3px 1px; border-radius: 6px; transition: color .15s, background .15s; }
            .openvibe-navbar .openvibe-navbar-brand .name a.b-sub { color: var(--text-primary, #e6edf7); font-weight: 900; }
            .openvibe-navbar .openvibe-navbar-brand .name a.b-core { color: var(--text-primary, #e6edf7); font-weight: 800; }
            .openvibe-navbar .openvibe-navbar-brand .name a.b-tld { color: var(--accent-light, var(--accent, #60a5fa)); font-weight: 800; }
            .openvibe-navbar .openvibe-navbar-brand .name a.has-drop::after { content: ""; flex: none; display: inline-block; width: 5px; height: 5px; margin: 0 2px 3px 6px; border: solid currentColor; border-width: 0 1.8px 1.8px 0; transform: rotate(45deg); opacity: .65; transition: transform .2s; }
            .openvibe-navbar .openvibe-navbar-brand .name { overflow-clip-margin: 8px; }
            .openvibe-navbar .openvibe-navbar-brand .name a.has-drop { border-radius: 8px; transition: color .15s, background .15s, box-shadow .26s cubic-bezier(.2,1.4,.3,1); }
            .openvibe-navbar .openvibe-navbar-brand .name a.has-drop:hover { --ovn-t: color-mix(in srgb, var(--accent, #3b82f6) 10%, transparent); background: var(--ovn-t); box-shadow: 0 0 0 6px var(--ovn-t); }
            .openvibe-navbar .openvibe-navbar-brand .name a.has-drop[aria-expanded="true"] { --ovn-t: color-mix(in srgb, var(--accent, #3b82f6) 17%, transparent); background: var(--ovn-t); box-shadow: 0 0 0 6px var(--ovn-t), 0 0 0 7px color-mix(in srgb, var(--accent, #3b82f6) 32%, transparent); }
            .openvibe-navbar .openvibe-navbar-brand .name a.has-drop[aria-expanded="true"]::after { transform: translateY(2px) rotate(225deg); }
            .openvibe-navbar .openvibe-navbar-brand.has-sub .name a.b-core, .openvibe-navbar .openvibe-navbar-brand.has-sub .name a.b-tld { color: var(--text-secondary, #a8b3c4); font-weight: 700; }
            .openvibe-navbar .ovnav-brand { all: unset; box-sizing: border-box; position: relative; display: inline-flex; align-items: center; gap: 7px; min-width: 0; height: 40px; padding: 0 12px 0 4px; border-radius: 12px; cursor: pointer; color: inherit; transition: background-color .15s, box-shadow .26s cubic-bezier(.2,1.4,.3,1); }
            .openvibe-navbar .ovnav-brand::before { content: ""; position: absolute; inset: -3px 0; }
            .openvibe-navbar .ovnav-brand::after { content: ""; flex: none; width: 6px; height: 6px; margin: 0 0 3px 2px; border: solid currentColor; border-width: 0 2px 2px 0; transform: rotate(45deg); opacity: .6; transition: transform .2s; }
            .openvibe-navbar .ovnav-brand:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 10%, transparent); }
            .openvibe-navbar .ovnav-brand[aria-expanded="true"] { background: color-mix(in srgb, var(--accent, #3b82f6) 17%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 32%, transparent); }
            .openvibe-navbar .ovnav-brand[aria-expanded="true"]::after { transform: translateY(2px) rotate(225deg); }
            .openvibe-navbar .ovnav-brand:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
            .openvibe-navbar .ovnav-brand .flame, .openvibe-navbar .ovnav-brand .flame:hover { background: none; }
            .openvibe-navbar .openvibe-navbar-brand .name .b-sub { color: var(--text-primary, #e6edf7); font-weight: 900; }
            .openvibe-navbar .openvibe-navbar-brand .name .b-core { color: var(--text-primary, #e6edf7); font-weight: 800; }
            .openvibe-navbar .openvibe-navbar-brand .name .b-tld { color: var(--accent-light, var(--accent, #60a5fa)); font-weight: 800; }
            .openvibe-navbar .openvibe-navbar-brand.has-sub .name .b-core, .openvibe-navbar .openvibe-navbar-brand.has-sub .name .b-tld { color: var(--text-secondary, #a8b3c4); font-weight: 700; }
            .openvibe-navbar .openvibe-navbar-brand .name a:hover { color: var(--accent-light, var(--accent, #60a5fa)); background: var(--accent-glow, rgba(59,130,246,.12)); }
            .openvibe-navbar .openvibe-navbar-brand .b-dot { margin: 0; padding: 0; opacity: .5; }
            .openvibe-navbar .openvibe-navbar-brand.joined .name .b-core { padding-right: 0; }
            .openvibe-navbar .openvibe-navbar-brand.joined .name .b-tld { padding-left: 0; }
            .openvibe-navbar .openvibe-navbar-brand a:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
            /* A finger needs about 44px: on touch screens the wordmark's links reach the navbar's height and the mark
               gets a clear ring, without moving anything (they were 22px and 30px tall). */
            @media (pointer: coarse) {
                .openvibe-navbar .openvibe-navbar-brand .name a { padding-top: 14px; padding-bottom: 14px; margin-top: -11px; margin-bottom: -11px; }
                .openvibe-navbar .openvibe-navbar-brand .name .b-tld { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; box-sizing: border-box; }
                .openvibe-navbar .openvibe-navbar-brand .flame { position: relative; }
                .openvibe-navbar .openvibe-navbar-brand .flame::after { content: ''; position: absolute; inset: -8px -4px -8px -12px; }
                .openvibe-navbar .openvibe-navbar-login, .openvibe-navbar .ovnav-burger, .openvibe-navbar .ovnav-orb { position: relative; }
                /* Sign in is a 36px circle: its taps grow to the right and a little to the left, off the menu button's. */
                .openvibe-navbar .openvibe-navbar-login::after { content: ''; position: absolute; inset: -5px -8px -5px -3px; }
                .openvibe-navbar .ovnav-burger::after { content: ''; position: absolute; inset: -3px -5px; }
                /* The orb grows up and down, and sideways mostly to the right: the site's name sits 8px to its left and keeps
                   its own taps (4px there); the extra width goes to the open bar on its right (12px), so it measures 44px
                   wide on a phone (it was 36.9 in the 11-03 re-audit). */
                .openvibe-navbar .ovnav-orb::after { content: ''; position: absolute; inset: -6px -12px -6px -4px; }
            }
            .openvibe-navbar .ovnav-dd { position: relative; display: inline-flex; flex: none; }
            .openvibe-navbar .ovnav-dd-menu { display: none; position: fixed; top: 56px; left: 0; min-width: 180px; padding: 5px; border-radius: 12px; z-index: 1002; background: var(--bg-elevated, var(--bg-secondary, #111826)); border: 1px solid var(--border, rgba(255,255,255,.12)); box-shadow: 0 18px 44px rgba(0,0,0,.45); flex-direction: column; gap: 2px; }
            .openvibe-navbar .ovnav-dd:hover .ovnav-dd-menu, .openvibe-navbar .ovnav-dd.open .ovnav-dd-menu, .openvibe-navbar .ovnav-dd:focus-within .ovnav-dd-menu { display: flex; }
            .openvibe-navbar .ovnav-chip { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 11px; border-radius: 999px; font: 700 13px/1 inherit; color: var(--chip-c, var(--text-primary, #e6edf7)); background: color-mix(in srgb, var(--chip-c, var(--accent, #3b82f6)) 12%, transparent); border: 1px solid color-mix(in srgb, var(--chip-c, var(--accent, #3b82f6)) 38%, transparent); font-variant-numeric: tabular-nums; }
            .ovnav-chip[data-tone="gold"] { --chip-c: #fbbf24; } .ovnav-chip[data-tone="green"] { --chip-c: #4ade80; } .ovnav-chip[hidden] { display: none !important; }
            /* A single balance chip (computers): the same calm surface, the icon in its colour, the number in the text's. */
            .openvibe-navbar .ovnav-chip[data-tone] { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); border-color: color-mix(in srgb, var(--text-primary, #e6edf7) 13%, transparent); }
            .openvibe-navbar .ovnav-chip[data-tone] .ovnav-ic { color: var(--chip-c); width: 15px; height: 15px; }
            .openvibe-navbar .ovnav-chip[data-tone]:hover { background: color-mix(in srgb, var(--chip-c) 12%, transparent); border-color: color-mix(in srgb, var(--chip-c) 35%, transparent); }
            .openvibe-navbar-dropdown .ud-chips { display: flex; gap: 6px; flex-wrap: nowrap; margin-top: 6px; }
            .openvibe-navbar-dropdown-header .info { min-width: 0; flex: 1; }
            .openvibe-navbar-dropdown-header a.ud-me { color: inherit; text-decoration: none; display: block; line-height: 0; }
            .openvibe-navbar-dropdown-header a.name.ud-me { line-height: inherit; display: block; }
            .openvibe-navbar-dropdown-header a.name.ud-me:hover, .openvibe-navbar-dropdown-header a.name.ud-me:focus-visible { text-decoration: underline; }
            .openvibe-navbar-dropdown .ovnav-chip--menu { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; font: 700 12px/1.2 inherit; color: var(--chip-c, #fbbf24); background: color-mix(in srgb, var(--chip-c, #fbbf24) 12%, transparent); border: 1px solid color-mix(in srgb, var(--chip-c, #fbbf24) 34%, transparent); }
            /* 4.119.0: the featured link's phone button */
            .openvibe-navbar .ovnav-featured-phone { all: unset; box-sizing: border-box; position: relative; cursor: pointer; display: none; width: 38px; height: 38px; border-radius: 999px; align-items: center; justify-content: center; flex: none; color: var(--accent-light, #60a5fa); background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 35%, transparent); }
            .openvibe-navbar .ovnav-featured-phone::after { content: ''; position: absolute; inset: -5px; }
            .openvibe-navbar .ovnav-featured-phone :is(.ovnav-ic, svg, i) { width: 17px; height: 17px; font-size: 16px; }
            .openvibe-navbar .ovnav-featured-phone:focus-visible { outline: 2px solid var(--accent-light, #60a5fa); outline-offset: 2px; }
            .openvibe-navbar .ovnav-burger { all: unset; box-sizing: border-box; position: relative; cursor: pointer; display: none; width: 38px; height: 38px; border-radius: 11px; flex-direction: column; align-items: center; justify-content: center; gap: 4px; flex: none; }
            .openvibe-navbar .ovnav-burger span { display: block; width: 18px; height: 2px; border-radius: 2px; background: currentColor; transition: transform .2s, opacity .2s; }
            .openvibe-navbar .ovnav-burger[aria-expanded="true"] span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
            .openvibe-navbar .ovnav-burger[aria-expanded="true"] span:nth-child(2) { opacity: 0; }
            .openvibe-navbar .ovnav-burger[aria-expanded="true"] span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
            .openvibe-navbar .ovnav-burger:hover, .openvibe-navbar .ovnav-burger[aria-expanded="true"] { background: var(--accent-glow, rgba(59,130,246,.14)); }
            .ovnav-drawer { display: none; position: absolute; top: calc(100% + 6px); right: 8px; width: min(300px, calc(100vw - 16px)); padding: 7px; border-radius: 16px; z-index: 1001; flex-direction: column; gap: 2px;
                background: var(--bg-elevated, var(--bg-secondary, #111826)); border: 1px solid var(--border, rgba(255,255,255,.12)); box-shadow: 0 22px 48px rgba(0,0,0,.45);
                max-height: calc(100vh - var(--ovnav-h, 56px) - 16px); max-height: calc(100dvh - var(--ovnav-h, 56px) - 16px - env(safe-area-inset-bottom, 0px)); overflow-y: auto; overscroll-behavior: contain; }
            .ovnav-drawer.open { display: flex; animation: openvibe-slide-down .2s ease; }
            .ovnav-drawer a { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 10px; color: var(--text-primary, #e6edf7); text-decoration: none; font-size: 14.5px; font-weight: 600; }
            .ovnav-drawer a.ovnav-sublink { padding-left: 34px; font-weight: 500; color: var(--text-secondary, #a8b3c4); }
            /* A featured link in the phone's menu: the same one accent, as a quiet line rather than a pill. */
            .ovnav-drawer a.ovnav-link--featured { color: var(--accent-light, #60a5fa); font-weight: 650; }
            .ovnav-drawer a.ovnav-link--featured .icon { color: var(--accent-light, #60a5fa); }
            .ovnav-drawer a.active { background: var(--accent-glow, rgba(59,130,246,.14)); }
            @media (hover: hover) { .ovnav-drawer a:hover { background: var(--accent-glow, rgba(59,130,246,.14)); } }
            .ovnav-drawer a[hidden] { display: none; }
            .ovnav-drawer .ud-label { padding: 10px 12px 3px; font-size: 10.5px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase; color: var(--text-muted, #7d8aa0); }
            .ovnav-drawer-net:empty { display: none; } .ovnav-drawer-net { border-top: 1px solid var(--border, rgba(255,255,255,.08)); margin-top: 4px; }
            .ovnav-drawer-net a.ovnav-net { display: flex !important; }
            /* "Across OpenVibe" in the menu (owner, 2026-10-27: icons, and set apart from the site's own links): a tinted
               section, its own header with "All sites", a grid of the other sites, each with its mark. */
            .ovnav-drawer-net:not(:empty) { margin: 8px 0 0; padding: 6px; border: 0; border-radius: 13px; background: color-mix(in srgb, var(--accent, #3b82f6) 7%, transparent); }
            .ovnav-drawer-net .ovnav-net-head { display: flex; align-items: center; gap: 8px; padding: 6px 6px 8px; }
            .ovnav-drawer-net .ovnav-net-head .ud-label { padding: 0; flex: 1; }
            .ovnav-drawer-net .ovnav-net-all { all: unset; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--accent-light, var(--accent, #60a5fa)); padding: 3px 6px; border-radius: 7px; }
            .ovnav-drawer-net .ovnav-net-all:hover, .ovnav-drawer-net .ovnav-net-all:focus-visible { background: var(--accent-glow, rgba(59,130,246,.14)); }
            .ovnav-drawer-net .ovnav-net-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; }
            .ovnav-display { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; padding: 10px 6px 4px; border-top: 1px solid var(--border, rgba(255,255,255,.08)); font-size: 12px; color: var(--text-muted, #7d8aa0); }
            .ovnav-display[hidden] { display: none; }
            .ovnav-display .ovnav-dl { flex-basis: 100%; font-size: 10.5px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase; }
            .ovnav-display .ovnav-seg { display: inline-flex; border: 1px solid var(--border, rgba(255,255,255,.12)); border-radius: 9px; overflow: hidden; }
            .ovnav-display .ovnav-seg button { all: unset; cursor: pointer; padding: 6px 9px; font-size: 12px; font-weight: 650; color: var(--text-secondary, #a8b3c4); }
            .ovnav-display .ovnav-seg button[aria-pressed="true"] { background: var(--accent-strong, var(--accent, #3472d8)); color: var(--on-accent-strong, var(--on-accent, #fff)); }
            .ovnav-display .ovnav-seg button:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: -2px; }
            .ovnav-drawer .ovnav-display a { display: inline; padding: 6px 4px; margin-left: auto; font-size: 12px; color: var(--accent-light, var(--accent, #60a5fa)); }
            .ovnav-display a.ovnav-disp-row { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; margin: 0; padding: 4px 6px; border-radius: 14px; color: var(--text-primary, #e6edf7); text-decoration: none; }
            .ovnav-display a.ovnav-disp-row:hover { background: var(--bg-hover, rgba(255,255,255,.06)); }
            .ovnav-disp-ic { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(150deg, hsl(285 72% 58% / .34), hsl(285 70% 38% / .18)); color: hsl(285 90% 82%); }
            .ovnav-disp-row > span:nth-child(2) { flex: 1; display: grid; gap: 1px; } .ovnav-disp-row b { font-size: 14px; } .ovnav-disp-row small { font-size: 12px; color: var(--text-muted, #7d8aa0); }
            .ovnav-disp-row[aria-expanded="true"] > svg:last-child { transform: rotate(180deg); }
            .ovnav-display .ovnav-disp { display: flex; align-items: center; gap: 8px; width: 100%; }
            .ovnav-display .ovnav-disp .ovnav-dl { flex-basis: auto; margin-right: auto; }
            .ovnav-display .ovnav-seg-ic button { display: inline-grid; place-items: center; width: 40px; height: 34px; padding: 0; }
            .ovnav-display .ovnav-seg-ic svg { width: 17px; height: 17px; }
            .ovnav-display a.ovnav-disp-more { display: inline-flex; align-items: center; gap: 6px; height: 34px; margin: 0; padding: 0 12px; border-radius: 9px; background: color-mix(in srgb, var(--accent, #3b82f6) 13%, transparent); color: var(--accent-light, #60a5fa); font-size: 12.5px; font-weight: 650; text-decoration: none; }
            .ovnav-display a.ovnav-disp-more svg { width: 16px; height: 16px; }
            .ovnav-display .ud-look { flex-basis: 100%; }
            .ovnav-drawer .ovnav-drawer-net a.ovnav-net { gap: 9px; padding: 8px; font-size: 13.5px; min-width: 0; }
            .ovnav-drawer .ovnav-drawer-net a.ovnav-net > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            /* Icons have their size and a faint ring before ov-icons.js draws them: nothing moves or pops when they arrive. */
            .ovnav-drawer .ov-icon { display: inline-block; flex: none; width: 24px; height: 24px; border-radius: 50%; }
            .ovnav-drawer .ov-icon[data-size="22"] { width: 22px; height: 22px; }
            .ovnav-drawer .ov-icon:empty { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent, #3b82f6) 26%, transparent); background: color-mix(in srgb, var(--accent, #3b82f6) 10%, transparent); }
            /* Several balance chips fold into one on a phone (owner, 2026-10-27: the two currencies pushed out the site
               switcher next to the logo); a tap lists each in full. */
            /* The balances (owner, 2026-10-28: "the coins and vibes badges look a little weird… polish… use the space"): one
               calm pill on the bar's own surface, each balance a coloured icon and a plain number, a hairline between. */
            /* The balances: one pill, one showing (purse.js turns between them). */
            .openvibe-navbar .ovnav-chip.ovnav-chip--all { display: inline-grid; gap: 0; padding: 0 1px; font-size: 13px; --chip-c: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); border-color: color-mix(in srgb, var(--text-primary, #e6edf7) 13%, transparent); }
            .openvibe-navbar .ovnav-chip--all:hover, .openvibe-navbar .ovnav-chip--all[aria-expanded="true"] { background: color-mix(in srgb, var(--text-primary, #e6edf7) 11%, transparent); }
            .ovnav-chip-mini { grid-area: 1 / 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 0 7px; color: var(--text-primary, #e6edf7); opacity: 0; }
            .ovnav-chip-mini.is-on { opacity: 1; }
            .ovnav-chip-mini .ovnav-ic { color: var(--chip-c, inherit); width: 15px; height: 15px; }
            .ovnav-chip-mini[data-tone="gold"] { --chip-c: #fbbf24; } .ovnav-chip-mini[data-tone="green"] { --chip-c: #4ade80; }
            .openvibe-navbar-right.has-chips-all .ovnav-chip[data-chip-id] { display: none; }
            .ovnav-chips-pop { position: absolute; top: calc(100% + 6px); right: 8px; z-index: 1002; min-width: 220px; padding: 6px; border-radius: 14px; display: none; flex-direction: column; gap: 2px;
                background: var(--bg-elevated, var(--bg-secondary, #111826)); border: 1px solid var(--border, rgba(255,255,255,.12)); box-shadow: 0 18px 40px rgba(0,0,0,.45); }
            .ovnav-chips-pop.open { display: flex; animation: openvibe-slide-down .18s ease; }
            .ovnav-chips-pop button { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; font-size: 14px; color: var(--text-primary, #e6edf7); }
            .ovnav-chips-pop button:hover, .ovnav-chips-pop button:focus-visible { background: var(--accent-glow, rgba(59,130,246,.14)); }
            .ovnav-chips-pop button .ovnav-ic { color: var(--chip-c, inherit); width: 16px; height: 16px; }
            .ovnav-chips-pop button[data-tone="gold"] { --chip-c: #fbbf24; } .ovnav-chips-pop button[data-tone="green"] { --chip-c: #4ade80; }
            .ovnav-chips-pop b { margin-left: auto; font-variant-numeric: tabular-nums; }
            @media (max-width: 860px) { .openvibe-navbar .ovnav-burger, .openvibe-navbar .ovnav-featured-phone { display: inline-flex; } .openvibe-navbar .openvibe-navbar-links, .openvibe-navbar .openvibe-navbar-spacer { display: none; } .openvibe-navbar .openvibe-navbar-right { margin-left: auto; } .openvibe-navbar .ovnav-chip .ovnav-ic + .ovnav-chip-v:empty { display: none; } }
            @media (max-width: 420px) { .openvibe-navbar .ovnav-chip { padding: 0 8px; height: 30px; font-size: 12px; } }
            /* A narrow phone never draws the site's name over the bar's buttons (owner, 2026-10-28: on openvibe.games, signed
               in, the name ran under the launcher and the magnifier). The name gives way with an ellipsis, and up to 440px
               the folded balances show the first one only (a tap lists them all). */
            .openvibe-navbar .openvibe-navbar-brand { flex: 0 1 auto; }
            .openvibe-navbar .openvibe-navbar-brand .flame { flex: none; }
            .openvibe-navbar .openvibe-navbar-brand .name { display: block; min-width: 0; white-space: nowrap; overflow-x: clip; text-overflow: ellipsis; }
            /* Both balances on every phone (the owner, 2026-10-28: "you can only see one… use the full space"): the pill
               tightens instead of folding to one. */
            @media (max-width: 400px) { .openvibe-navbar .openvibe-navbar-right { gap: 1px; } .openvibe-navbar .openvibe-navbar-brand { gap: 4px; }
                .openvibe-navbar { padding-left: 8px; padding-right: 6px; gap: 2px; } .openvibe-navbar .ovnav-burger { width: 34px; } .openvibe-navbar .ovnav-featured-phone { width: 34px; height: 34px; } .openvibe-navbar .openvibe-navbar-avatar { width: 32px; height: 32px; box-sizing: border-box; }
                .openvibe-navbar .openvibe-navbar-brand .name { font-size: 16.5px; letter-spacing: -.25px; } .openvibe-navbar .openvibe-navbar-brand .flame { min-width: 28px; height: 28px; padding: 0 2px; } .openvibe-navbar .openvibe-navbar-brand .flame .ov-mark { width: 34px !important; } }
            /* Under 350px the mark alone names the site, so both balances keep their icons (a number alone says nothing). */
            @media (max-width: 350px) { .openvibe-navbar .openvibe-navbar-brand .name { display: none; } }
            /* The site's name reads whole on a signed-in phone (the owner, 2026-11-02: "the label or the branding of the
               website you're on seems to get cut off", openvibe.live showing "Li…" beside 161k | 400, the messages, the bell
               and the picture). Up to 480px the two balances stack in one pill, each with its icon (both still show, as asked
               on 10-28): the pill is about 53px instead of 90-103px, and the name has that room. */
            .openvibe-navbar-brand .flame { font-size: 18px; text-decoration: none; color: var(--accent, #3b82f6); display: inline-grid; place-items: center; width: 28px; height: 28px; flex: none; }
            .openvibe-navbar-brand .name { display: inline-flex; align-items: baseline; font-size: 15px; font-weight: 700; letter-spacing: -.3px; white-space: nowrap; line-height: 1; }
            /* Segments: subdomain · OpenVibe · TLD. The part that names *this* site is the loud one. */
            .openvibe-navbar-brand .b-sub { color: var(--text-primary, #e0e0e0); }
            .openvibe-navbar-brand .b-core { color: var(--text-primary, #e0e0e0); }
            .openvibe-navbar-brand .b-tld { color: var(--accent-light, var(--accent, #60a5fa)); }
            .openvibe-navbar-brand.has-sub .b-core { color: var(--text-secondary, #b0b0b8); font-weight: 600; }
            .openvibe-navbar-brand.has-sub .b-tld { color: var(--text-secondary, #b0b0b8); font-weight: 600; }
            .openvibe-navbar-brand .b-dot { color: var(--accent, #3b82f6); opacity: .75; margin: 0 1px; font-weight: 800; }
            .openvibe-navbar-brand .b-sub, .openvibe-navbar-brand .b-core, .openvibe-navbar-brand .b-tld { transition: color .2s, opacity .2s; }
            .openvibe-navbar-brand:hover .b-tld, .openvibe-navbar-brand:hover .b-sub { color: var(--accent-light, #60a5fa); }
            .openvibe-navbar-brand:hover .b-dot { opacity: 1; }
            .openvibe-navbar-brand .b-tag { font-size: 9px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--accent-light, #60a5fa); background: var(--accent-glow, rgba(59,130,246,.14)); border-radius: 4px; padding: 2px 5px; margin-left: 6px; align-self: center; }
            /* Compact: drop the trailing segments on narrow viewports, keep what identifies the page. */
            .openvibe-navbar[data-compact="always"] .openvibe-navbar-brand.has-sub .b-core,
            .openvibe-navbar[data-compact="always"] .openvibe-navbar-brand.has-sub .b-tld,
            .openvibe-navbar[data-compact="always"] .openvibe-navbar-brand.has-sub .b-dot { display: none; }
            @media (max-width: 860px) {
                .openvibe-navbar[data-compact="auto"] .openvibe-navbar-brand.has-sub .b-core,
                .openvibe-navbar[data-compact="auto"] .openvibe-navbar-brand.has-sub .b-tld,
                .openvibe-navbar[data-compact="auto"] .openvibe-navbar-brand.has-sub .b-dot { display: none; }
            }
            @media (min-width: 401px) and (max-width: 480px) {
                .openvibe-navbar .openvibe-navbar-brand .flame .ov-mark { width: 28px !important; }
                .openvibe-navbar .openvibe-navbar-brand .name { font-size: 17px; letter-spacing: -.25px; }
                .openvibe-navbar .openvibe-navbar-brand { gap: 4px; }
            }
            @media (max-width: 480px) {
                .openvibe-navbar[data-compact="auto"] .openvibe-navbar-brand:not(.has-sub):not(.joined) .b-core,
                .openvibe-navbar[data-compact="auto"] .openvibe-navbar-brand:not(.has-sub):not(.joined) .b-dot { display: none; }
                .openvibe-navbar[data-compact="auto"] .openvibe-navbar-brand .b-tag { display: none; }
            }
            .openvibe-navbar-links a .icon { margin-right: 5px; opacity: .8; }
            .openvibe-navbar-dropdown-menu .ud-label { padding: 8px 10px 3px; font-size: 10.5px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase; color: var(--text-muted, #7d8aa0); }
            .openvibe-navbar-dropdown-menu .ud-val { margin-left: auto; font-weight: 600; font-size: 12.5px; color: var(--text-secondary, #a8b3c4); }
            .openvibe-navbar-dropdown-menu .icon { display: inline-grid; place-items: center; width: 22px; flex: none; }
            .openvibe-navbar-dropdown-header { background: linear-gradient(180deg, color-mix(in srgb, var(--accent, #3b82f6) 10%, transparent), transparent); }
            .openvibe-navbar-dropdown-header img { border-radius: 50%; box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); }
            .openvibe-navbar-dropdown-header .ud-wallet { display: inline-block; margin-right: 6px; }
            .openvibe-navbar-dropdown-header .ud-wallet[hidden] { display: none; }
            .openvibe-navbar-dropdown-header .ud-vibes a { color: #4ade80; background: rgba(74,222,128,.12); border-color: rgba(74,222,128,.3); }
            .openvibe-navbar-dropdown-header .ud-wallet a { display: inline-flex; align-items: center; gap: 5px; margin-top: 5px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; text-decoration: none; color: #fbbf24; background: rgba(251,191,36,.12); border: 1px solid rgba(251,191,36,.3); }
            .openvibe-navbar-dropdown-menu .sep { height: 1px; background: var(--border, #333340); margin: 4px -8px; }

            .openvibe-navbar-links { display: flex; align-items: center; gap: 2px; margin-left: 2px; }
            .openvibe-navbar-links > *, .openvibe-navbar-right { flex: none; white-space: nowrap; }
            @media (min-width: 861px) { .openvibe-navbar .openvibe-navbar-brand { flex: none; } }
            .openvibe-navbar-links > .ovnav-out { display: none; }
            .openvibe-navbar-links a {
                padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 500;
                color: var(--text-secondary, #b0b0b8); text-decoration: none;
                transition: all .15s;
            }
            .openvibe-navbar-links a:hover { background: var(--bg-hover, #2f2f3d); color: var(--text-primary, #e0e0e0); }
            .openvibe-navbar-links a.active { background: var(--bg-tertiary, #2a2a38); color: var(--accent-light, #60a5fa); }
            /* A featured link (4.117.0): one quiet accent pill with its glyph, for the piece a site is
               built around (the Node on the Network). Deliberate, not loud: one hairline, one tint, the
               glyph, and nothing that moves. */
            .openvibe-navbar-links a.ovnav-link--featured {
                display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px 5px 10px;
                border-radius: 999px; font-weight: 650; color: var(--accent-light, #60a5fa);
                border: 1px solid color-mix(in srgb, var(--accent, #3b82f6) 30%, transparent);
                background: color-mix(in srgb, var(--accent, #3b82f6) 9%, transparent);
                transition: none;
            }
            .openvibe-navbar-links a.ovnav-link--featured:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 15%, transparent); color: var(--accent-light, #60a5fa); }
            .openvibe-navbar-links a.ovnav-link--featured .icon { opacity: 1; margin-right: 0; color: var(--accent-light, #60a5fa); }
            .openvibe-navbar-links a.ovnav-link--featured .ovnav-ic { width: 15px; height: 15px; }

            .openvibe-navbar-spacer { flex: 1; }

            .openvibe-navbar-right { display: flex; align-items: center; gap: 6px; }
            /* The person (or Sign In) is last, after the menu button, with a little air between them. */
            .openvibe-navbar .ovnav-burger + :is(.openvibe-navbar-avatar, .openvibe-navbar-login) { margin-left: 3px; }
            .openvibe-navbar .ovnav-burger + .openvibe-navbar-login { margin-left: 6px; }
            /* The OpenVibe menu's button (4.187.0; the owner's pick of 2026-11-10: a search bar over three apps). Under
               the pointer its parts lift in turn; while the menu loads the apps breathe; open, the bar and the apps cross
               into the close mark. Transform, opacity and fill only, and nothing moves while it rests. */
            .openvibe-navbar .ovnav-orb { all: unset; box-sizing: border-box; position: relative; display: inline-grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 11px; cursor: pointer; color: var(--text-secondary, #a8b3c4); --ovo-a: var(--accent-light, var(--accent, #60a5fa)); --ovo-b: color-mix(in oklab, var(--accent, #3b82f6) 45%, #e879f9); }
            .openvibe-navbar .ovnav-orb::before { content: ""; position: absolute; inset: -3px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--accent, #3b82f6) 38%, transparent), transparent); opacity: 0; transform: scale(.5); transition: opacity .25s, transform .4s cubic-bezier(.2,1.4,.3,1); pointer-events: none; }
            .openvibe-navbar .ovnav-orb:hover::before, .openvibe-navbar .ovnav-orb:focus-visible::before, .openvibe-navbar .ovnav-orb[aria-expanded="true"]::before { opacity: 1; transform: none; }
            .openvibe-navbar .ovnav-orb svg { position: relative; display: block; overflow: visible; }
            .ovmb { display: block; overflow: visible; }
            .ovmb-bar { fill: transparent; stroke: currentColor; stroke-width: 1.9; }
            .ovmb-app { fill: currentColor; }
            .ovmb-dot, .ovmb-a1 { fill: var(--ovo-a, var(--accent-light, #60a5fa)); }
            .ovmb :is(.ovmb-bar, .ovmb-dot, .ovmb-app) { transform-box: fill-box; transform-origin: center; transition: transform .5s cubic-bezier(.2,1.3,.3,1), fill .3s, stroke-width .3s, opacity .25s; }
            .ovmb-a0 { transition-delay: .03s; } .ovmb-a1 { transition-delay: .06s; } .ovmb-a2 { transition-delay: .09s; }
            /* Under the pointer (and once, the first time it is seen): the bar and the three apps lift in turn. */
            :is(.ovnav-orb, .ovs-orb):is(:hover, .ovo-intro) .ovmb:not(.is-x) :is(.ovmb-bar, .ovmb-dot, .ovmb-app) { animation: ovmb-wave .7s ease-in-out both; }
            .ovmb .ovmb-a0 { animation-delay: .08s; } .ovmb .ovmb-a1 { animation-delay: .15s; } .ovmb .ovmb-a2 { animation-delay: .22s; }
            :is(.ovnav-orb, .ovs-orb):is(:hover, :focus-visible) .ovmb-app { fill: var(--ovo-a, var(--accent-light, #60a5fa)); }
            :is(.ovnav-orb, .ovs-orb):is(:hover, :focus-visible) .ovmb-a1 { fill: var(--ovo-b, #e879f9); }
            /* While the menu loads: the apps breathe in turn. */
            .ovnav-orb.is-busy .ovmb-app { animation: ovmb-busy .9s ease-in-out infinite; }
            /* Open: the bar is one stroke of the close mark, the three apps the other. */
            :is(.ovnav-orb[aria-expanded="true"], .ovnav-orb.is-dock, .ovs-orb.is-x) .ovmb :is(.ovmb-bar, .ovmb-dot, .ovmb-app), .ovmb.is-x :is(.ovmb-bar, .ovmb-dot, .ovmb-app) { animation: none; }
            :is(.ovnav-orb[aria-expanded="true"], .ovnav-orb.is-dock, .ovs-orb.is-x) .ovmb .ovmb-bar, .ovmb.is-x .ovmb-bar { transform: translateY(4px) rotate(45deg) scale(.9, .43); fill: var(--ovo-a, var(--accent-light, #60a5fa)); stroke-width: 0; }
            :is(.ovnav-orb[aria-expanded="true"], .ovnav-orb.is-dock, .ovs-orb.is-x) .ovmb .ovmb-dot, .ovmb.is-x .ovmb-dot { transform: translate(4.6px, 4px) scale(0); opacity: 0; }
            :is(.ovnav-orb[aria-expanded="true"], .ovnav-orb.is-dock, .ovs-orb.is-x) .ovmb .ovmb-app, .ovmb.is-x .ovmb-app { fill: var(--ovo-a, var(--accent-light, #60a5fa)); }
            :is(.ovnav-orb[aria-expanded="true"], .ovnav-orb.is-dock, .ovs-orb.is-x) .ovmb .ovmb-a0, .ovmb.is-x .ovmb-a0 { transform: translate(2.4px, -1.2px) rotate(-45deg) scale(1.3, .6); }
            :is(.ovnav-orb[aria-expanded="true"], .ovnav-orb.is-dock, .ovs-orb.is-x) .ovmb .ovmb-a1, .ovmb.is-x .ovmb-a1 { transform: translate(0, -4.6px) rotate(-45deg) scale(1.3, .6); }
            :is(.ovnav-orb[aria-expanded="true"], .ovnav-orb.is-dock, .ovs-orb.is-x) .ovmb .ovmb-a2, .ovmb.is-x .ovmb-a2 { transform: translate(-2.4px, -8px) rotate(-45deg) scale(1.3, .6); }
            /* A close mark that arrives already made (the Dock's sheet) forms from the button it came from. */
            .ovmb.is-forming :is(.ovmb-bar, .ovmb-app) { animation: ovmb-form .5s cubic-bezier(.2,1.3,.3,1) both; }
            @keyframes ovmb-form { from { transform: none; } }
            .ovnav-orb:not([aria-expanded="true"]):not(.is-dock) .ovmb:not(.is-x) .ovmb-app { animation: ovmb-idle 9s ease-in-out 3s infinite; }
            .ovnav-orb .ovmb .ovmb-a1 { animation-delay: 3.09s !important; } .ovnav-orb .ovmb .ovmb-a2 { animation-delay: 3.18s !important; }
            @keyframes ovmb-idle { 0%, 4%, 100% { transform: none; } 2% { transform: translateY(calc(-2.2px * var(--ov-move, 1))); } }
            @keyframes ovmb-wave { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(calc(-2.6px * var(--ov-move, 1))); } }
            @keyframes ovmb-busy { 0%, 100% { transform: scale(.72); opacity: .5; } 50% { transform: scale(1.18); opacity: 1; } }
            .openvibe-navbar .ovnav-orb[aria-expanded="true"] { color: var(--text-primary, #e6edf7); }
            .openvibe-navbar :is(.ovnav-orb, .openvibe-bell, .openvibe-navbar-avatar) { transition: transform .18s cubic-bezier(.2, 1.4, .3, 1), background-color .15s, color .15s; }
            .openvibe-navbar :is(.ovnav-orb, .openvibe-bell, .openvibe-navbar-avatar):active { transform: scale(.9); }
            .openvibe-navbar .openvibe-navbar-brand .ovnav-orb { margin-left: 1px; }
            /* The menu button is the orb, at the bar's right on every width (4.148.0 a phone; 4.193.0 a computer too: the
               owner, "on the right, even on desktop"). The orb beside the name is not drawn where this one is. */
            .openvibe-navbar .ovnav-orb.ovnav-burger { display: inline-grid; }
            .openvibe-navbar:has(.ovnav-burger) .ovnav-orb:not(.ovnav-burger) { display: none; }
            /* At the bar's right edge its tap area grows to the left (the brand orb's reached 12 px right, past the screen). */
            .openvibe-navbar .ovnav-orb.ovnav-burger::after { inset: -6px -4px -6px -10px; }
            .openvibe-navbar .ovnav-orb.ovnav-burger:hover, .openvibe-navbar .ovnav-orb.ovnav-burger[aria-expanded="true"] { background: none; }
            @media (max-width: 860px) { .openvibe-navbar .ovnav-orb.ovnav-burger { display: inline-grid; } }
            @media (max-width: 400px) { .openvibe-navbar .ovnav-orb { width: 28px; height: 32px; } }
            /* Messages (4.25.0; the owner, 2026-10-28: the floating DM button was "buggy as hell on mobile… app style"): a
               site that has messages puts them in the bar beside the bell, with the unread count, instead of a bubble
               over the page. */
            .ovnav-ovg { width: 1.15em; height: 1.15em; flex: none; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; overflow: visible; vertical-align: -.2em; }
            .ovnav-chip .ovnav-ovg, .ovnav-chip-mini .ovnav-ovg, .ovnav-chips-pop .ovnav-ovg { stroke-width: 2.3; }
            .ovnav-ovg > .ovg-s { display: none; fill: currentColor; stroke: none; }
            .ovnav-ovg > .ovg-s .ln { fill: none; stroke: currentColor; stroke-width: 2.6px; }
            html[data-ov-icons=solid] .ovnav-ovg.has-s, .ovnav-ab.is-here .ovnav-ovg.has-s { stroke-width: 0; }
            html[data-ov-icons=solid] .ovnav-ovg.has-s > .ovg-s, .ovnav-ab.is-here .ovnav-ovg.has-s > .ovg-s { display: inline; }

            .openvibe-navbar-avatar {
                width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
                border: 2px solid var(--border, #333340); transition: border-color .2s;
                object-fit: cover;
            }
            .openvibe-navbar-avatar:hover { border-color: var(--accent, #3b82f6); }
            .openvibe-navbar .ovnav-avatar-wrap { position: relative; display: inline-flex; flex: none; }
            .openvibe-navbar .ovnav-avatar-count { position: absolute; top: -5px; right: -6px; min-width: 17px; height: 17px; padding: 0 4px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 999px; background: var(--live-red, #e5484d); color: #fff; font-family: inherit; font-size: 10px; font-weight: 700; line-height: 1; }
            .openvibe-navbar .ovnav-avatar-count[hidden] { display: none; }

            /* Sign in: a filled circle where the person's picture will be; a figure and an arrow coming in take turns. */
            .openvibe-navbar-login { display: inline-grid; place-items: center; background: var(--accent-strong, #1d4ed8); color: var(--on-accent-strong, #fff); border: none; cursor: pointer; text-decoration: none; transition: filter .15s, box-shadow .25s, transform .18s cubic-bezier(.2, 1.4, .3, 1); }
            .openvibe-navbar-login:hover, .openvibe-navbar-login:focus-visible { filter: brightness(1.12); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent, #3b82f6) 28%, transparent); }
            .openvibe-navbar-login:active { transform: scale(.9); }
            .ovsi { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; overflow: visible; }
            .ovsi-p { animation: ovsi-p 6s ease-in-out 2s infinite; }
            .ovsi-a { opacity: 0; animation: ovsi-a 6s ease-in-out 2s infinite; }
            :hover > .ovsi .ovsi-p { animation: none; opacity: 0; }
            :hover > .ovsi .ovsi-a { animation: none; opacity: 1; }
            html[data-ov-motion=off] .ovsi :is(.ovsi-p, .ovsi-a) { animation: none; }
            .ovsi-o { opacity: 0; stroke-dasharray: 30 39; }
            .is-going .ovsi-o { opacity: 1; animation: ovsi-go 1s linear infinite; }
            .is-going .ovsi-p { opacity: .55; }
            @keyframes ovsi-p { 0%, 62%, 100% { opacity: 1; transform: none; } 70%, 92% { opacity: 0; transform: translateX(4px); } }
            @keyframes ovsi-a { 0%, 62%, 100% { opacity: 0; transform: translateX(-5px); } 70%, 92% { opacity: 1; transform: none; } }
            @keyframes ovsi-go { to { stroke-dashoffset: -69; } }
            /* 4.148.0 (the owner, 11-08: "the things need to be more consistent in the nav bar in size"): one height for
               every control at the bar's right, 36 px (34 px on a phone under 400 px): Sign In, the orb, messages, the
               picture, the balances and a featured link. The orb draws its dots at 26 px (24) so it reads as large as
               Sign In beside it; Sign In's corners follow the orb's. */
            .openvibe-navbar .ovnav-orb { width: 36px; height: 36px; }
            .openvibe-navbar .ovnav-orb svg { width: 26px; height: 26px; }
            .openvibe-navbar .ovnav-featured-phone { width: 36px; height: 36px; }
            .openvibe-navbar .openvibe-navbar-avatar { width: 36px; height: 36px; box-sizing: border-box; }
            .openvibe-navbar .ovnav-chip { height: 36px; }
            .openvibe-navbar .openvibe-navbar-login { box-sizing: border-box; width: 36px; height: 36px; padding: 0; border-radius: 50%; }
            @media (max-width: 400px) {
                .openvibe-navbar .ovnav-orb, .openvibe-navbar .ovnav-featured-phone, .openvibe-navbar .openvibe-navbar-avatar { width: 34px; height: 34px; }
                .openvibe-navbar .ovnav-orb svg { width: 24px; height: 24px; }
                .openvibe-navbar .ovnav-chip, .openvibe-navbar .openvibe-navbar-login { height: 34px; }
                .openvibe-navbar .openvibe-navbar-login { width: 34px; }
            }

            /* The account's block (4.188.0): not a popup. It rests in the bar out of sight and is a block of the menu's
               You tab while the menu is open: no position, no shadow, no height of its own. */
            .openvibe-navbar-dropdown { display: none; flex-direction: column; border: 1px solid var(--border, #333340); }
            .openvibe-navbar-dropdown > * { flex-shrink: 0; }
            .ovh-account > .openvibe-navbar-dropdown.ovnav-account .openvibe-navbar-dropdown-header .ud-hbtn { min-width: 44px; min-height: 44px; }
            .ovh-account > .openvibe-navbar-dropdown.ovnav-account { display: flex; overflow: hidden; margin: 2px 4px 10px; border-radius: 16px;
                background: color-mix(in srgb, var(--text-primary, #e6edf7) 4%, transparent); border-color: color-mix(in srgb, var(--text-primary, #e6edf7) 10%, transparent); }
            @keyframes openvibe-slide-down { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .ov-pop { transform-origin: var(--ov-pop-x, 50%) var(--ov-pop-y, 0); animation: ov-pop .34s cubic-bezier(.2, 1.1, .3, 1) both !important; }
            .ov-pop-out { transform-origin: var(--ov-pop-x, 50%) var(--ov-pop-y, 0); animation: ov-pop-out .16s ease-in both !important; pointer-events: none; }
            @keyframes ov-pop { 0% { opacity: 0; transform: scale(.88); clip-path: circle(0 at var(--ov-pop-x, 50%) var(--ov-pop-y, 0)); filter: blur(5px); } 55% { opacity: 1; filter: blur(0); } 100% { opacity: 1; transform: none; clip-path: circle(150% at var(--ov-pop-x, 50%) var(--ov-pop-y, 0)); } }
            @keyframes ov-pop-out { to { opacity: 0; transform: scale(.94); filter: blur(3px); } }
            @keyframes ov-fade { from { opacity: 0; } }
            @keyframes ov-pop-calm { from { opacity: 0; transform: scale(.97); } }
            html[data-ov-motion=reduced] .ov-pop { animation-name: ov-pop-calm !important; animation-duration: .18s !important; }
            html[data-ov-motion=reduced] .ov-pop-out { animation-name: ov-fade !important; animation-duration: .12s !important; animation-direction: reverse !important; }

            .openvibe-navbar-dropdown-header {
                padding: 12px 10px 12px 14px; border-bottom: 1px solid var(--border, #333340);
                display: flex; align-items: center; gap: 11px;
            }
            .openvibe-navbar-dropdown-header img { width: 40px; height: 40px; border-radius: 50%; }
            .openvibe-navbar-dropdown-header .ud-hacts { display: flex; gap: 2px; align-self: flex-start; }
            .openvibe-navbar-dropdown .ud-hbtn { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: var(--text-secondary, #a8b3c4); text-decoration: none; }
            .openvibe-navbar-dropdown .ud-hbtn:hover, .openvibe-navbar-dropdown .ud-hbtn:focus-visible { background: var(--bg-hover, rgba(255,255,255,.08)); color: var(--text-primary, #e6edf7); }
            .openvibe-navbar-dropdown .ud-hbtn .icon { font-size: 15px; }
            .openvibe-navbar-dropdown-header .info { line-height: 1.3; }
            .openvibe-navbar-dropdown-header .info .name { font-size: 14px; font-weight: 600; }
            .openvibe-navbar-dropdown-header .info .email { font-size: 11px; color: var(--text-muted, #707080); }
            .openvibe-navbar-dropdown-header .info .anon-tag { font-size: 10px; color: var(--accent-light, #60a5fa); }

            /* Other accounts: a row of small pills under the name (one tap switches); Anonymous is one of them. */
            .openvibe-navbar-dropdown-accounts {
                display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--border, #333340);
                overflow-x: auto; scrollbar-width: none;
            }
            .openvibe-navbar-dropdown-accounts .account-item {
                display: inline-flex; align-items: center; gap: 6px; flex: none; max-width: 150px; height: 32px; padding: 0 10px 0 4px;
                border-radius: 999px; border: 1px solid var(--border, rgba(255,255,255,.12)); cursor: pointer; font-size: 12.5px; font-weight: 600;
                color: var(--text-primary, #e0e0e0); text-decoration: none; transition: background .12s;
            }
            .openvibe-navbar-dropdown-accounts .account-item > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .openvibe-navbar-dropdown-accounts .account-item.ud-anon { padding-left: 9px; max-width: none; color: var(--text-secondary, #a8b3c4); }
            .openvibe-navbar-dropdown-accounts .account-item:hover, .openvibe-navbar-dropdown-accounts .account-item:focus-visible { background: var(--bg-hover, #2f2f3d); }
            .openvibe-navbar-dropdown-accounts .account-item img { width: 24px; height: 24px; border-radius: 50%; }
            .openvibe-navbar-dropdown-accounts .account-item.active { color: var(--accent-light, #60a5fa); font-weight: 600; }

            .openvibe-navbar-dropdown-menu { padding: 6px 8px; }
            .openvibe-navbar-dropdown-menu a, .openvibe-navbar-dropdown-menu button {
                display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box;
                padding: 7px 8px; border-radius: 8px; font-size: 13px; font-weight: 500;
                background: none; border: none; color: var(--text-primary, #e0e0e0);
                cursor: pointer; text-align: left; text-decoration: none;
                transition: background .12s;
            }
            .openvibe-navbar-dropdown-menu a:hover, .openvibe-navbar-dropdown-menu button:hover { background: var(--bg-hover, #2f2f3d); }
            .openvibe-navbar-dropdown-menu .danger { color: var(--live-red-text, var(--live-red, #e74c3c)); }
            /* Light / Dark / Auto (theme-loader.js scheme): three equal segments, the one in use filled. */
            /* Your places: a grid of icons over short names, four across (the menu was 13 rows and a display block). */
            .openvibe-navbar-dropdown-menu .ud-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 2px 0 4px; }
            .openvibe-navbar-dropdown-menu .ud-grid .ud-tile { flex-direction: column; justify-content: flex-start; gap: 6px; min-height: 66px; padding: 9px 2px 7px; text-align: center; border-radius: 12px; font-size: 11.5px; font-weight: 600; line-height: 1.2; }
            .openvibe-navbar-dropdown-menu .ud-grid .ud-tile[hidden] { display: none; }
            .openvibe-navbar-dropdown-menu .ud-grid .ud-tile .icon { width: 38px; height: 30px; border-radius: 10px; font-size: 16px; background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent); color: var(--accent-light, var(--accent, #60a5fa)); }
            .openvibe-navbar-dropdown-menu .ud-grid .ud-tile:hover .icon { background: color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); color: var(--accent-light, var(--accent, #60a5fa)); }
            .openvibe-navbar-dropdown-menu .ud-tl { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 100%; }
            .openvibe-navbar-dropdown-menu .ud-grid .ud-tile .ud-val { margin: 0; font-size: 10.5px; }
            .openvibe-navbar-dropdown-menu .ud-more { border-top: 1px solid var(--border, rgba(255,255,255,.08)); margin: 2px -8px 0; padding: 2px 8px; }
            .openvibe-navbar-dropdown-menu .ud-more summary { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; cursor: pointer; list-style: none; font-size: 13px; font-weight: 600; color: var(--text-secondary, #a8b3c4); }
            .openvibe-navbar-dropdown-menu .ud-more summary::-webkit-details-marker { display: none; }
            .openvibe-navbar-dropdown-menu .ud-more summary:hover { background: var(--bg-hover, #2f2f3d); }
            .openvibe-navbar-dropdown-menu .ud-more[open] summary .icon { transform: rotate(180deg); }
            .openvibe-navbar-dropdown-menu .ud-more .ud-n { margin-left: auto; font-size: 11.5px; color: var(--text-muted, #7d8aa0); }
            /* The tiles never leave one alone on a row: five or fewer share one row, six make two of three, seven and
               eight two of four (the owner's phone, 2026-10-28: an Admin tile on a row of its own). */
            .openvibe-navbar-dropdown-menu .ud-grid:has(> .ud-tile:nth-child(3):last-child) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .openvibe-navbar-dropdown-menu .ud-grid:has(> .ud-tile:nth-child(5):last-child) { grid-template-columns: repeat(5, minmax(0, 1fr)); }
            .openvibe-navbar-dropdown-menu .ud-grid:has(> .ud-tile:nth-child(6):last-child) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .openvibe-navbar-dropdown-menu .ud-grid .ud-tile { min-height: 60px; padding: 7px 2px 6px; gap: 5px; }
            .openvibe-navbar-dropdown-header .ud-me img { width: 52px; height: 52px; }
            /* The balances in the header: OpenCoins and Vibes side by side, each a coloured icon, a number and its name. */
            .openvibe-navbar-dropdown-header .ud-wallet a small { font-weight: 600; opacity: .75; font-size: 10.5px; }
            /* On a phone the menu is a sheet the width of the screen under the bar, not a narrow card off to the right. */
            @media (max-width: 560px) {
                .openvibe-navbar .openvibe-navbar-dropdown { left: 8px; right: 8px; width: auto; max-width: none; border-radius: 18px; }
                .openvibe-navbar-dropdown-header { padding: 14px 10px 12px 14px; }
                .openvibe-navbar-dropdown-header img { width: 48px; height: 48px; }
                .openvibe-navbar-dropdown-header .info .name { font-size: 16px; }
                .openvibe-navbar-dropdown-menu .ud-grid .ud-tile { min-height: 72px; font-size: 12px; }
                .openvibe-navbar-dropdown-accounts .account-item { max-width: 46vw; }
            }
            /* One row at the foot: Light, Dark, Auto, text size, motion, themes, and Sign out. */
            .openvibe-navbar-dropdown-menu .ud-foot { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin: 4px -8px -6px; padding: 8px; border-top: 1px solid var(--border, rgba(255,255,255,.08)); background: color-mix(in srgb, var(--text-primary, #e6edf7) 3%, transparent); }
            .openvibe-navbar-dropdown-menu .ud-foot .ud-ib { width: auto; min-width: 34px; height: 34px; padding: 0 8px; justify-content: center; gap: 3px; border-radius: 10px; color: var(--text-secondary, #a8b3c4); }
            .openvibe-navbar-dropdown-menu .ud-foot > .ud-ib { flex: 1 1 0; }
            .openvibe-navbar-dropdown-menu .ud-foot > .ud-disp { flex: 0 0 auto; gap: 7px; padding: 0 12px; font-size: 13px; font-weight: 650; }
            .openvibe-navbar-dropdown-menu .ud-foot .ud-ib .icon { width: 18px; color: inherit; }
            .openvibe-navbar-dropdown-menu .ud-foot .ud-ib .ud-val { margin: 0; font-size: 11px; font-weight: 700; color: inherit; }
            .openvibe-navbar-dropdown-menu .ud-foot .ud-ib .ud-val:empty { display: none; }
            .openvibe-navbar-dropdown-menu .ud-foot .ud-ib[aria-pressed="true"] { color: var(--accent-light, var(--accent, #60a5fa)); }
            .openvibe-navbar-dropdown-menu .ud-foot .ud-scheme .ud-ib[aria-pressed="true"] { background: var(--accent-strong, var(--accent, #3472d8)); color: var(--on-accent-strong, var(--on-accent, #fff)); }
            .openvibe-navbar-dropdown .ud-hbtn.ud-out { all: unset; box-sizing: border-box; cursor: pointer; display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: var(--text-secondary, #a8b3c4); }
            .openvibe-navbar-dropdown .ud-hbtn.ud-out:hover, .openvibe-navbar-dropdown .ud-hbtn.ud-out:focus-visible { color: var(--live-red-text, var(--live-red, #f87171)); background: color-mix(in srgb, var(--live-red, #ef4444) 14%, transparent); }
            .openvibe-navbar-dropdown-menu .ud-look, .ovnav-display .ud-look { flex-basis: 100%; }
            .openvibe-navbar-dropdown-menu .ud-scheme { display: inline-flex; gap: 2px; padding: 2px; border-radius: 11px; background: var(--bg-tertiary, rgba(255,255,255,.06)); }
            .openvibe-navbar-dropdown-menu .ud-scheme[hidden] { display: none; }
            .openvibe-navbar-dropdown-menu .ud-scheme button { width: 32px; min-width: 0; height: 30px; padding: 0; justify-content: center; border-radius: 9px; color: var(--text-secondary, #a8b3c4); }
            .openvibe-navbar-dropdown-menu .ud-scheme button[aria-pressed="true"] { background: var(--accent-strong, var(--accent, #3472d8)); color: var(--on-accent-strong, var(--on-accent, #fff)); }
            .openvibe-navbar-dropdown-menu .ud-scheme button:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
            .openvibe-navbar-dropdown-menu .ud-scheme .icon { width: auto; font-size: 14px; }
            /* One box for every icon in the menu: a glyph keeps its height and is centred, whatever its width (an id card
               is wider than a bell), so the rows' icons line up and read as one set. */
            .openvibe-navbar-dropdown-menu .icon { width: 20px; height: 16px; font-size: 15px; color: var(--text-secondary, #a8b3c4); }
            .openvibe-navbar-dropdown-menu .icon .ovnav-ic { width: 1.25em !important; height: 1em; }
            .openvibe-navbar-dropdown-menu a:hover .icon, .openvibe-navbar-dropdown-menu button:hover .icon { color: var(--text-primary, #e0e0e0); }
            .openvibe-navbar-dropdown-menu .danger .icon { color: inherit; }
            .openvibe-navbar-dropdown-menu .ud-go { font-size: 16px; font-weight: 700; color: var(--text-muted, #7d8aa0); }

            .openvibe-navbar .openvibe-network-badge {
                font-size: 10px; padding: 2px 8px; border-radius: 4px;
                background: rgba(59,130,246,0.1); color: var(--accent-light, #60a5fa);
                font-weight: 500; cursor: pointer; border: 1px solid transparent;
                transition: all .15s;
            }
            .openvibe-navbar .openvibe-network-badge:hover { border-color: var(--accent-dark, #2563eb); }

            @media (max-width: 600px) {
                .openvibe-navbar-links { display: none; }
                .openvibe-navbar .openvibe-network-badge { display: none; }
            }

            /* No square tap flash: a slight press (scale composes with transforms) and one accent focus ring, at zero specificity. */
            .openvibe-navbar, .openvibe-navbar-dropdown, .ovnav-drawer { -webkit-tap-highlight-color: transparent; }
            :where(.openvibe-navbar, .openvibe-navbar-dropdown, .ovnav-drawer) :where(a, button, [role="button"]):not(:disabled):active { scale: .96; }
            :where(.openvibe-navbar, .openvibe-navbar-dropdown, .ovnav-drawer) :where(a, button, [role="button"], [tabindex]:not([tabindex="-1"])):focus-visible {
                outline: 2px solid var(--accent-light, var(--accent, #3b82f6)); outline-offset: 2px;
            }
            html[data-ov-motion=off] :where(.openvibe-navbar, .openvibe-navbar-dropdown, .ovnav-drawer) :where(a, button, [role="button"]):not(:disabled):active{scale: none;opacity: .82}
        `;
        document.head.appendChild(s);
    }

    // ── Icons ────────────────────────────────────────────────
    // The navbar draws its own icons. It used to borrow the page's Font Awesome, so on pages that do not load
    // that font every menu row had an empty slot. Known names get an inline SVG; an unknown name still falls
    // back to the page's icon font, so sites that pass their own Font Awesome icons keep working.
    // BEGIN generated by scripts/build-navbar-icons.js from nav-icons.js; do not edit by hand
    // The glyphs the navbar draws itself: [0, line, solid] is an OpenVibe glyph (24-unit grid); [w, path] a Font
    // Awesome Free 6 solid glyph (CC BY 4.0, fontawesome.com/license/free) in a 0 0 512 512 viewBox, one ink size. The rest of the set is nav-icons.js.
    const NAV_ICONS = {
        'fa-bell': [0, '<path d="M6 14.5V9.5a6 6 0 0 1 12 0v5l1.5 2h-15.5ZM10 18.5a2 2 0 0 0 4 0"/>', '<path d="M5 15.5V9.5a7 7 0 0 1 13.5 0v5.5l2 2.5H3.5ZM9.5 19.5h4.5a2.5 2.5 0 0 1-4.5 0Z"/>'],
        'fa-clock-rotate-left': [0, '<path d="M4 12a8.5 8.5 0 1 0 2.5-6L4 8.5M4 4v4h4"/><path d="M12 8v4.5l3 2"/>', '<path d="M6 6A9 9 0 1 1 3 12h3a6 6 0 1 0 2-4.5ZM2.5 2.5v7h7ZM11 8h2v3.5l2.5 1.5l-1 2l-4-2.5Z"/>'],
        'fa-coins': [0, '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9c-0.5-1-1.5-1-2.5-1-1.5 0-2.5 1-2.5 2s1 1.5 2.5 2 2.5 1 2.5 2-1 2-2.5 2c-1 0-2-0.5-2.5-1M12 6.5v11"/>', '<path fill-rule="evenodd" d="M13 2.5a9.5 9.5 0 1 0 0 18.5a9.5 9.5 0 0 0 0-18.5ZM12 6h2v1c1 0 2 1 2.5 1.5l-1.5 1c-0.5-0.5-1-1-2-1c-1 0-1.5 0.5-1.5 1s0.5 1 2 1c2 0.5 3.5 1 3.5 3c0 1.5-1 2.5-3 3V18h-2v-1.5c-1 0-2.5-1-3-2l1.5-1c0.5 0.5 1 1 2 1c1 0 1.5-0.5 1.5-1s-0.5-1-2-1c-1.5-0.5-3.5-1-3.5-3c0-1.5 1-2.5 2.5-2.5Z"/>'],
        'fa-id-card': [0, '<rect x="3.7" y="5.5" width="16.7" height="13" rx="1.9"/><circle cx="9.2" cy="11" r="1.9"/><path d="M6.5 15.5c0.5-1.5 1.5-2 3-2s2.5 1 3 2M15 10h3M15 13.5h3"/>', '<path fill-rule="evenodd" d="M5 4.5h14.5a2.5 2.5 0 0 1 2.5 2.5v10.5a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17V7A2.5 2.5 0 0 1 5 4.5Zm4 4a2 2 0 1 0 0 4.5a2 2 0 0 0 0-4.5Zm-3 7.5h6.5c-0.5-1.5-2-2.5-3-2.5s-2.5 1-3 2.5Zm9-7v1.5h4V9.5Zm0 3.5v1.5h4v-1.5Z"/>'],
        'fa-palette': [0, '<path d="M12 4a8.5 8.5 0 1 0 0 17c1 0 1.5-1 1.5-1.5c0-1-1-1.5-1-2.5s1-1.5 2-1.5H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7 17 4 12 4Z"/><circle cx="8" cy="11.4" r="1.1"/><circle cx="10.3" cy="7.9" r="1.1"/><circle cx="14.5" cy="7.9" r="1.1"/>', '<path fill-rule="evenodd" d="M12 2.5a9.5 9.5 0 1 0 0 19c1.5 0 2-1 2-2c0-1-1-1.5-1-2.5s1-1.5 2-1.5H17.5a4.5 4.5 0 0 0 4.5-4.5C21.5 6.5 17.5 2.5 12 2.5ZM8 9.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Zm2.5-3.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Zm4.5 0a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Z"/>'],
        'fa-people-group': [0, '<circle cx="9.2" cy="7.9" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M15.5 5a3 3 0 0 1 0 6M17.5 14.5c2 0.5 3 2.5 3 5"/>', '<circle cx="9.1" cy="7.1" r="3.5"/><path d="M2.5 19.5c0-3.5 3-6.5 6.5-6.5s6.5 2.5 6.5 6.5Z"/><circle cx="16.5" cy="6.6" r="2.8"/><path d="M16.5 12.5c3 0.5 4.5 2.5 4.5 6V19.5h-4.5c0-3-1-5-2.5-6.5Z"/>'],
        'fa-plus': [0, '<path d="M12 3.5v17M3.5 12h17"/>', ''],
        'fa-right-from-bracket': [0, '<path d="M12.5 3.5h4a2 2 0 0 1 2 2v12.5a2 2 0 0 1-2 2h-4M8.5 16l-4-4l4-4M4 12h10.5"/>', ''],
        'fa-shield-halved': [0, '<path d="M12 3.5L5.5 6.5v5.5c0 4 3 7 6.5 8.5c3.5-1.5 6.5-4 6.5-8.5V6.5Z"/>', '<path d="M12 2.5 4.5 6V12c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6Z"/>'],
        'fa-tower-broadcast': [0, '<circle cx="12" cy="11.8" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M6.5 6a8 8 0 0 0 0 12M17.5 6a8 8 0 0 1 0 12"/>', '<circle cx="12" cy="12" r="2.5"/><path class="ln" d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M6 6a8 8 0 0 0 0 11.5M18 6a8 8 0 0 1 0 11.5"/>'],
        'fa-user-secret': [0, '<circle cx="12" cy="7.4" r="3.8"/><path d="M4.5 20.5c0-4 3.5-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>', '<circle cx="12" cy="6.7" r="4.5"/><path d="M3.5 21c0-4.5 4-8 8.5-8s8.5 3 8.5 8Z"/>'],
        'fa-wallet': [0, '<path d="M3.5 7A2.5 2.5 0 0 1 6 4H18.5v4M3.5 7V18a2 2 0 0 0 2 2h15V8.5H6A2.5 2.5 0 0 1 3.5 7Z"/><path d="M16 14h0"/>', '<path fill-rule="evenodd" d="M5.5 3H19v4.5h1.5a1 1 0 0 1 1 1v12.5H5a2.5 2.5 0 0 1-2.5-2.5V6a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0 0 2h11V5ZM16.5 13a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3Z"/>'],
        'fa-chevron-down': [0, '<path d="M3.5 8l8.5 8.5l8.5-8.5"/>', ''],
        'fa-gear': [0, '<circle cx="12" cy="12.1" r="2.3"/><path d="M17.5 14.5a1.5 1.5 0 0 0 0 1.5l0 0a1.5 1.5 0 1 1-2.5 2.5l0 0a1.5 1.5 0 0 0-1.5 0a1.5 1.5 0 0 0-1 1.5V19a1.5 1.5 0 1 1-3.5 0v0a1.5 1.5 0 0 0-1-1.5a1.5 1.5 0 0 0-1.5 0l0 0a1.5 1.5 0 1 1-2.5-2.5l0 0a1.5 1.5 0 0 0 0-1.5a1.5 1.5 0 0 0-1.5-1H5.5a1.5 1.5 0 1 1 0-3.5h0a1.5 1.5 0 0 0 1.5-1a1.5 1.5 0 0 0 0-1.5l0 0a1.5 1.5 0 1 1 2.5-2.5l0 0a1.5 1.5 0 0 0 1.5 0H10a1.5 1.5 0 0 0 1-1.5V5.5a1.5 1.5 0 1 1 3.5 0v0a1.5 1.5 0 0 0 1 1.5a1.5 1.5 0 0 0 1.5 0l0 0a1.5 1.5 0 1 1 2.5 2.5l0 0a1.5 1.5 0 0 0 0 1.5V10a1.5 1.5 0 0 0 1.5 1H18.5a1.5 1.5 0 1 1 0 3.5h0a1.5 1.5 0 0 0-1.5 1Z"/>', '<path fill-rule="evenodd" d="M18 14.5a1.5 1.5 0 0 0 0.5 1.5l0 0a1.5 1.5 0 1 1-2.5 2.5l0 0a1.5 1.5 0 0 0-1.5-0.5a1.5 1.5 0 0 0-1 1.5V19.5a1.5 1.5 0 1 1-4 0v0a1.5 1.5 0 0 0-1-1.5a1.5 1.5 0 0 0-1.5 0.5l0 0a1.5 1.5 0 1 1-2.5-2.5l0 0a1.5 1.5 0 0 0 0.5-1.5a1.5 1.5 0 0 0-1.5-1H4.5a1.5 1.5 0 1 1 0-4h0a1.5 1.5 0 0 0 1.5-1a1.5 1.5 0 0 0-0.5-1.5l0 0a1.5 1.5 0 1 1 2.5-2.5l0 0a1.5 1.5 0 0 0 1.5 0.5H9.5a1.5 1.5 0 0 0 1-1.5V4.5a1.5 1.5 0 1 1 4 0v0a1.5 1.5 0 0 0 1 1.5a1.5 1.5 0 0 0 1.5-0.5l0 0a1.5 1.5 0 1 1 2.5 2.5l0 0a1.5 1.5 0 0 0-0.5 1.5V9.5a1.5 1.5 0 0 0 1.5 1H19.5a1.5 1.5 0 1 1 0 4h0a1.5 1.5 0 0 0-1.5 1ZM12 9.5a3 3 0 1 0 0 6.5a3 3 0 0 0 0-6.5Z"/>'],
        'fa-circle-half-stroke': [0, '<circle cx="11.7" cy="12" r="8.4"/><path d="M11.5 3.5v16.5M11.5 8h6.5M11.5 12h8.5M11.5 16h6.5"/>', '<path fill-rule="evenodd" d="M12.5 2.5a9.5 9.5 0 1 0 0 18.5a9.5 9.5 0 0 0 0-18.5Zm0 2a7 7 0 0 1 0 14.5Z"/>'],
        'fa-moon': [0, '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"/>', '<path d="M21.5 14.5A9.5 9.5 0 1 1 9.5 2.5a8 8 0 0 0 12.5 12.5Z"/>'],
        'fa-sun': [0, '<circle cx="11.9" cy="11.9" r="3.4"/><path d="M12 3.5v2M12 18.5v2M6 6l1 1M16.5 16.5l1 1M3.5 12h2M18.5 12h2M6 18l1-1M16.5 7l1-1"/>', '<circle cx="12" cy="12" r="3.8"/><path class="ln" d="M12 4v1.5M12 18.5v1.5M6.5 6l1 1M17 17L18 18M4 12h1.5M18.5 12h1.5M6.5 18l1-1M17 7L18 6"/>'],
        'fa-brain': [0, '<path d="M9 4a3 3 0 0 0-3 3a3 3 0 0 0-2 5a3 3 0 0 0 2 5a3 3 0 0 0 6 1V6A2 2 0 0 0 9 4ZM15 4a3 3 0 0 1 3 3a3 3 0 0 1 2 5a3 3 0 0 1-2 5a3 3 0 0 1-6 1"/>', '<path d="M9 4a3 3 0 0 0-3 3a3 3 0 0 0-2 5.5a3 3 0 0 0 2 5a3 3 0 0 0 5.5 1.5V5.5A2.5 2.5 0 0 0 9 4Z"/><path d="M15 4a3 3 0 0 1 3 3a3 3 0 0 1 2 5.5a3 3 0 0 1-2 5a3 3 0 0 1-5.5 1.5V5.5A2.5 2.5 0 0 1 15 4Z"/>'],
    };
    // Every other glyph in nav-icons.js, grouped by advance width (sizes its slot before the path arrives); 0 is an OpenVibe glyph.
    const NAV_ICONS_LAZY = {
        0: 'fa-book fa-camera fa-comments fa-gamepad fa-gauge-high fa-hand-fist fa-house fa-link fa-list-check fa-network-wired fa-paste fa-people-arrows fa-scissors fa-screwdriver-wrench fa-shirt fa-text-height fa-user fa-video fa-wand-magic-sparkles fa-arrow-up-right-from-square fa-chevron-right fa-bars fa-xmark fa-magnifying-glass fa-file-pdf fa-arrow-down fa-arrow-right fa-clock fa-envelope fa-star fa-heart fa-play fa-circle-info fa-triangle-exclamation fa-check fa-globe fa-code fa-robot fa-photo-film fa-tower-cell fa-diagram-project fa-toolbox fa-comment-dots fa-money-bill-wave fa-crown fa-server fa-newspaper fa-tag fa-ticket fa-chart-line fa-pen-nib fa-key fa-plug fa-bolt fa-satellite-dish fa-microchip fa-circle-nodes fa-download fa-upload fa-image fa-music fa-file-lines fa-font fa-location-dot fa-lock fa-wave-square fa-map fa-utensils fa-user-shield fa-gauge fa-pen fa-earth-americas fa-hashtag fa-inbox fa-folder fa-puzzle-piece fa-shield fa-display fa-microphone fa-infinity fa-list fa-flag-checkered fa-tv fa-compass',
    };
    const NAV_ICONS_REV = '14197adc3df5';   // sha256(nav-icons.js), first 12 hex: its ?v= (cacheable forever)
    // END generated
    // The files loaded from beside this one, by content (scripts/sibling-revs.js): a release changes their URLs.
    // The navbar's icons are filled paths (no Font Awesome CSS needed): the ones above ship here, the rest
    // (nav-icons.js) load after first paint when a link, chip or menu row names one, into an empty <svg> of their
    // size. Anything unknown, or nav-icons.js failing, falls back to <i class="fa-solid">.
    const _selfSrc = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
    let _lazyWidth = null;
    let _iconState = 0;     // 0 idle, 1 loading, 2 loaded, 3 unavailable
    // "Ask Vibe": the selected text (≤1000) and the page's address (≤400) into a new chat with Vibe.
    function selectedText() { try { const s = root.getSelection(); return s && !s.isCollapsed ? String(s).replace(/\s+/g, ' ').trim().slice(0, 1000) : ''; } catch { return ''; } }
    function askVibeHref(t) {
        const c = 'https://openvibe.chat/vibe', u = new URL(location.href); u.hash = '';
        return t ? `${c}?ask=${encodeURIComponent(t)}${u.protocol === 'https:' && u.href.length <= 400 ? `&from=${encodeURIComponent(u.href)}` : ''}` : c;
    }
    function lazyWidth(name) {
        if (!_lazyWidth) { _lazyWidth = {}; for (const w in NAV_ICONS_LAZY) NAV_ICONS_LAZY[w].split(' ').forEach(n => { _lazyWidth[n] = Number(w); }); }
        return Object.prototype.hasOwnProperty.call(_lazyWidth, name) ? _lazyWidth[name] : -1;   // 0: an OpenVibe glyph (24×24)
    }
    function adoptIcons() {
        const set = root.OpenVibeNavIcons;
        if (!set || typeof set !== 'object') return false;
        Object.assign(NAV_ICONS, set); _iconState = 2;
        return true;
    }
    /**
     * A shared browser file next to this navbar.js: the same origin and the same release (a site that
     * serves its own pinned copy at /shared/ gets its own), else the network's copy.
     */
    // The files loaded from beside this one, by content (scripts/sibling-revs.js): a release changes their URLs.
    const SIBLING_REV = { 'ov-mark.js': 'f34f731c3a94', 'ov-glyphs.js': '771efd0e3963', 'ov-brand.woff2': '3b4e6a8a5878', 'ov-look.js': 'dd84a30bb646', 'ov-fx.js': '947820d69097', 'ov-labels.js': 'd40f7ca14bc4', 'ov-forms.js': '2eb9e2604c3e', 'ov-forms.css': '06208fe89eac', 'ov-share.js': 'd419508a797e', 'ov-share.css': 'd609a71f611a', 'search.js': '8eec18660ff4', 'dock.js': '31d1cac08de5', 'presence.js': '5f195d41f8c5', 'panels.js': 'd90bfe987d81', 'surfaces.js': 'a94e76bd1200', 'notification-ui.js': '4b39796c5145', 'history.js': 'f9fb9e096c65', 'bottom.js': 'b9f708d04350', 'appbar.js': 'c21485176ae9', 'release-watch.js': '25f02a3f0684', 'ov-icons.js': 'aaa688bf6fc7', 'sso-client.js': '52439265b980', 'overlay.js': '466423e72fb6', 'ov-home.js': 'ea69b8a08868', 'nav-slots.js': '7b11e6916732', 'ov-wallet.js': 'e84894600223', 'ov-wallet.css': 'be8daa24c3a8', 'purse.js': '749120bfd24b', 'ov-drop.js': '445689a5eb80', 'ov-tip.js': '1d918e7de69d', 'soft.js': '98ab9b8080b1' };
    const siblingV = (name) => `${sibling(name)}${SIBLING_REV[name] ? `?v=${SIBLING_REV[name]}` : ''}`;

    // ov-tip.js loads at the first hover over a tooltip's owner.
    function tipWait() {
        if (root.__ovTip || !document.addEventListener) return;
        root.__ovTip = 1;
        const tip = (e) => {
            if (!e.target.closest('[data-ov-tip]')) return;
            document.removeEventListener('pointerover', tip);
            if (!root.OVTip) { const sc = document.createElement('script'); sc.src = siblingV('ov-tip.js'); sc.async = true; document.head.appendChild(sc); }
        };
        document.addEventListener('pointerover', tip, { passive: true });
    }
    // ov-glyphs.js, when a page shows a Font Awesome-style icon: now, or the first time one appears. One watch per page,
    // made here and not in the bar's render, so it holds nothing of a bar that a page move (Boost) re-renders. A
    // mutation only schedules one look 250 ms later, and the watch ends once the glyphs are loading.
    const GLYPH_ICONS = 'i[class*="fa-"],span[class*="fa-"],link[href*="fontawesome"],link[href*="font-awesome"]';
    let glyphWatch = null;
    function loadGlyphs() {
        if (root.OVGlyphs || document.getElementById('ov-glyphs-loader') || document.querySelector('script[src*="/ov-glyphs.js"]')) return true;
        if (!document.querySelector(GLYPH_ICONS)) return false;
        try { const sc = document.createElement('script'); sc.id = 'ov-glyphs-loader'; sc.src = siblingV('ov-glyphs.js'); sc.async = true; document.head.appendChild(sc); } catch { /* */ }
        return true;
    }
    function watchGlyphs() {
        if (glyphWatch || !document.querySelector || loadGlyphs() || typeof MutationObserver !== 'function' || !document.body) return;
        let soon = 0;
        glyphWatch = new MutationObserver(() => {
            if (soon) return;
            soon = setTimeout(() => { soon = 0; if (loadGlyphs() && glyphWatch) { glyphWatch.disconnect(); glyphWatch = true; } }, 250);
        });
        glyphWatch.observe(document.body, { childList: true, subtree: true });
    }
    // ov-labels.js (content labels, L1), when a page shows something labelled: now, or the first time one appears.
    let labelWatch = null;
    function loadLabels() {
        if (root.OVLabels || document.getElementById('ov-labels-loader')) return true;
        if (!document.querySelector('[data-ov-labels]')) return false;
        try { const sc = document.createElement('script'); sc.id = 'ov-labels-loader'; sc.src = siblingV('ov-labels.js'); sc.async = true; document.head.appendChild(sc); } catch { /* */ }
        return true;
    }
    function watchLabels() {
        if (labelWatch || !document.querySelector || loadLabels() || typeof MutationObserver !== 'function' || !document.body) return;
        let soon = 0;
        labelWatch = new MutationObserver(() => {
            if (soon) return;
            soon = setTimeout(() => { soon = 0; if (loadLabels() && labelWatch) { labelWatch.disconnect(); labelWatch = true; } }, 250);
        });
        labelWatch.observe(document.body, { childList: true, subtree: true });
    }
    // ov-forms.js and ov-forms.css (4.109.0, the owner 2026-11-03: "a custom system for those select inputs … shared
    // across the network and all websites rather than using default stuff"): OpenVibe's own select and form controls,
    // loaded once the page settles, for a page with a select or a checkbox, radio, slider or file input — now, or the
    // first time one appears. <html data-ov-forms="off"> keeps the browser's own; data-ov-native keeps one control's.
    const FORM_CONTROLS = 'select,input[type="checkbox"],input[type="radio"],input[type="range"],input[type="file"]';
    let formWatch = null;
    // Only a control that is drawn counts (4.141.0): a closed dialog's or a hidden box's select does not, so a page whose
    // shell carries hidden modal forms (Live's) no longer fetches 17 KB it may never use. The hidden ones are watched,
    // and the kit loads when one is drawn (a dialog opens, a fold unfolds).
    let formSeen = null;
    function formsWanted() {
        const all = document.querySelectorAll(FORM_CONTROLS);
        if (!all.length) return false;
        for (let i = 0; i < all.length && i < 200; i++) if (all[i].getClientRects().length) return true;
        if (typeof IntersectionObserver === 'function') {
            formSeen = formSeen || new IntersectionObserver((es) => {
                if (!es.some((e) => e.isIntersecting || e.boundingClientRect.width)) return;
                formSeen.disconnect(); formSeen = null; loadForms();
            });
            for (let i = 0; i < all.length && i < 60; i++) formSeen.observe(all[i]);
        }
        return false;
    }
    function loadForms() {
        if (root.OVForms || document.getElementById('ov-forms-loader')) return true;
        if (document.documentElement.getAttribute('data-ov-forms') === 'off') return true;
        if (!formsWanted()) return false;
        try {
            if (!document.querySelector('link[href*="ov-forms.css"]')) {
                const ln = document.createElement('link'); ln.rel = 'stylesheet'; ln.href = siblingV('ov-forms.css'); document.head.appendChild(ln);
            }
            const sc = document.createElement('script'); sc.id = 'ov-forms-loader'; sc.src = siblingV('ov-forms.js'); sc.async = true; document.head.appendChild(sc);
        } catch { /* */ }
        return true;
    }
    // ov-share.js and ov-share.css (4.114.0, plan track Q): the one Share sheet, fetched the first time someone presses a
    // [data-ov-share-sheet] button, so a site gets it by putting the button on its page and nothing loads before that.
    function shareClick(e) {
        const b = e.target && e.target.closest ? e.target.closest('[data-ov-share-sheet]') : null;
        if (!b || root.OVShare || b.disabled) return;
        e.preventDefault();
        if (document.getElementById('ov-share-loader')) return;
        try {
            if (!document.querySelector('link[href*="ov-share.css"]')) {
                const ln = document.createElement('link'); ln.rel = 'stylesheet'; ln.href = siblingV('ov-share.css'); document.head.appendChild(ln);
            }
            const sc = document.createElement('script'); sc.id = 'ov-share-loader'; sc.src = siblingV('ov-share.js'); sc.async = true;
            sc.onload = () => { if (root.OVShare) root.OVShare.open(root.OVShare.fromButton(b)); };
            document.head.appendChild(sc);
        } catch { /* */ }
    }
    function watchForms() {
        if (formWatch || !document.querySelector || typeof MutationObserver !== 'function' || !document.body) return;
        const go = () => {
            if (loadForms()) return;
            let soon = 0;
            formWatch = new MutationObserver(() => {
                if (soon) return;
                soon = setTimeout(() => { soon = 0; if (loadForms() && formWatch) { formWatch.disconnect(); formWatch = true; } }, 250);
            });
            formWatch.observe(document.body, { childList: true, subtree: true });
        };
        formWatch = true;
        if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(() => { formWatch = null; go(); }, { timeout: 2000 });
        else { const t = setTimeout(() => { formWatch = null; go(); }, 1200); if (t && typeof t.unref === 'function') t.unref(); }
    }
    // A box that scrolls (a code block, a wide table, a list held to a height) with nothing focusable inside it cannot be
    // scrolled from a keyboard (WCAG 2.1.1; axe scrollable-region-focusable flagged pages on six sites, 2026-11-02). Each
    // such box gets tabindex="0", so Tab reaches it and the arrow keys scroll it. A box with a link or a button inside is
    // reachable already and is left alone; a page's own tabindex always wins. Run when the page settles, again a little
    // later for content that loads after it, and after a resize changes what overflows.
    const SCROLL_FOCUSABLE = 'a[href],button,input,select,textarea,summary,iframe,[tabindex],[contenteditable="true"]';
    function focusScrollers() {
        if (!document.body || !document.body.getElementsByTagName) return 0;
        let n = 0;
        const all = document.body.getElementsByTagName('*');
        for (let i = 0; i < all.length; i++) {
            const el = all[i];
            // Cheap first: only a box whose content is bigger than it is, and that has no tabindex of its own.
            if (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) continue;
            if (el.hasAttribute('tabindex') || el.closest('#openvibe-navbar, .openvibe-navbar, .ovf, footer')) continue;
            const cs = getComputedStyle(el);
            const sx = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
            const sy = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
            if (!sx && !sy) continue;
            if (el.querySelector(SCROLL_FOCUSABLE)) continue;
            el.setAttribute('tabindex', '0');
            el.setAttribute('data-ov-scroll-focus', '');
            n++;
        }
        return n;
    }
    let scrollWatch = false;
    function watchScrollers() {
        if (scrollWatch || typeof window === 'undefined' || !document.body) return;
        scrollWatch = true;
        const idle = (fn, t) => (typeof root.requestIdleCallback === 'function' ? root.requestIdleCallback(fn, { timeout: t }) : setTimeout(fn, Math.min(t, 1500)));
        const run = () => { try { if (typeof getComputedStyle === 'function') focusScrollers(); } catch { /* never a page's problem */ } };
        idle(run, 3000);
        setTimeout(() => idle(run, 2000), 4000);
        let soon = 0;
        if (typeof window.addEventListener === 'function') window.addEventListener('resize', () => { clearTimeout(soon); soon = setTimeout(run, 400); }, { passive: true });
    }
    function sibling(name) {
        const m = /^(https?:\/\/[^?#]*\/)navbar\.js(?:[?#]|$)/.exec(_selfSrc);
        return `${m ? m[1] : 'https://openvibe.network/shared/'}${name}`;
    }
    /** nav-icons.js next to this navbar.js (same origin, same release), else the network's copy. */
    function iconsUrl() {
        if (_config.iconsUrl) return _config.iconsUrl;
        return `${sibling('nav-icons.js')}?v=${NAV_ICONS_REV}`;
    }
    function iconSlots() {
        const out = new Set();
        [_navEl, typeof document !== 'undefined' ? document : null].forEach((r) => {
            try { if (r && r.querySelectorAll) r.querySelectorAll('svg[data-ovnav-ic]').forEach(el => out.add(el)); } catch { /* */ }
        });
        return out;
    }
    function fillIcons() {
        iconSlots().forEach((el) => {
            const g = NAV_ICONS[el.getAttribute('data-ovnav-ic')]; if (!g) return;
            el.removeAttribute('data-ovnav-ic'); el.removeAttribute('data-ovnav-cls');
            if (g[0] === 0) { el.innerHTML = g[1] + (g[2] ? `<g class="ovg-s">${g[2]}</g>` : ''); if (g[2]) el.classList.add('has-s'); }
            else el.innerHTML = `<path fill="currentColor" d="${g[1]}"/>`;
        });
    }
    function iconsUnavailable() {
        _iconState = 3;
        iconSlots().forEach((el) => { try { el.outerHTML = `<i class="fa-solid ${escapeAttr(el.getAttribute('data-ovnav-cls'))}"></i>`; } catch { /* */ } });
    }
    function loadIcons() {
        if (_iconState) return; _iconState = 1;
        let started = false;
        const start = () => {
            if (started) return; started = true;
            if (adoptIcons()) return fillIcons();
            try {
                const sc = document.createElement('script'); sc.id = 'ov-nav-icons-loader'; sc.src = iconsUrl(); sc.async = true;
                try { sc.fetchPriority = 'low'; } catch { /* */ }
                sc.onload = () => { if (adoptIcons()) fillIcons(); else iconsUnavailable(); };
                sc.onerror = iconsUnavailable;
                document.head.appendChild(sc);
            } catch { iconsUnavailable(); }
        };
        // After first paint: the frame that shows the navbar goes out before the request does.
        try { requestAnimationFrame(() => setTimeout(start, 0)); } catch { /* */ }
        setTimeout(start, 300);     // background tabs get no animation frames
    }
    // One hand in the bar (4.71.0; the owner, 2026-11-01: "both solid and border-line icons… weird"): every glyph the
    // OpenVibe set has is drawn from it (openvibe-shared/glyphs, the line drawing and, where there is one, the solid one);
    // an entry [0, line, solid] in NAV_ICONS. The bar is line; it goes solid where the person prefers solid icons
    // (display setting `icons`, <html data-ov-icons>), and the app bar's tab you are on wears the solid one.
    const ovSvg = (g, extra = '') => `<svg class="ovnav-ic ovnav-ovg${g && g[2] ? ' has-s' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"${extra}>${g ? g[1] + (g[2] ? `<g class="ovg-s">${g[2]}</g>` : '') : ''}</svg>`;
    function navIcon(cls) {
        if (!cls) return '';
        const key = String(cls).split(/\s+/).find(c => NAV_ICONS[c] || (_iconState !== 3 && lazyWidth(c) >= 0));
        if (!key) return `<i class="fa-solid ${escapeAttr(cls)}"></i>`;
        const g = NAV_ICONS[key] || (adoptIcons() ? NAV_ICONS[key] : null);
        const w = g ? g[0] : lazyWidth(key);
        if (w === 0) {
            if (g) return ovSvg(g);
            loadIcons();
            return ovSvg(null, ` data-ovnav-ic="${key}" data-ovnav-cls="${escapeAttr(cls)}"`);
        }
        const svg = `<svg class="ovnav-ic" viewBox="0 0 ${w} 512" style="width:${(w / 512).toFixed(3)}em" aria-hidden="true" focusable="false"`;
        if (g) return `${svg}><path fill="currentColor" d="${g[1]}"/></svg>`;
        loadIcons();
        return `${svg} data-ovnav-ic="${key}" data-ovnav-cls="${escapeAttr(cls)}"></svg>`;
    }
    function upgradeIconsWhenFontsReady() { /* icons no longer depend on webfonts */ }

    // Release watch (ADR-016): a few seconds after the page settles, load release-watch.js from the
    // same place as this navbar, so every site that serves /release.json keeps open tabs current with
    // no page changes. Opt out with init({ releaseWatch: false }); an object is its OVReleaseConfig
    // ({ metricsUrl, url, inPlace }).
    function loadReleaseWatch() {
        try {
            const rw = _config.releaseWatch;
            if (rw === false || root.OVRelease || document.querySelector('script[src*="release-watch.js"]')) return;
            if (rw && typeof rw === 'object' && !root.OVReleaseConfig) root.OVReleaseConfig = rw;
            const sc = document.createElement('script'); sc.src = siblingV('release-watch.js'); sc.async = true;
            try { sc.fetchPriority = 'low'; } catch { /* */ }
            document.head.appendChild(sc);
        } catch { /* optional */ }
    }

    // ─── Brand from hostname ───────────────────────────────────
    // Every property is <sub?>.openvibe.<tld> (plus openre.stream and open.<tld>). The navbar spells the
    // whole name — Pastes.OpenVibe.Tools, not "Paste.OpenVibe" — because the subdomain and
    // the TLD are what tell a visitor where they are in the network.
    const TLD_LABELS = {
        live: 'Live', tools: 'Tools', network: 'Network', media: 'Media', games: 'Games',
        community: 'Community', chat: 'Chat', codes: 'Codes', blog: 'Blog', wiki: 'Wiki',
        news: 'News', reviews: 'Reviews', tips: 'Tips', vip: 'VIP', trade: 'Trade', host: 'Host',
        deals: 'Deals', coupons: 'Coupons', space: 'Space', services: 'Services', events: 'Events', bot: 'Bot',
    };
    const SUB_LABELS = {
        json: 'JSON', yaml: 'YAML', xml: 'XML', csv: 'CSV', sql: 'SQL', html: 'HTML', jwt: 'JWT',
        uuid: 'UUID', guid: 'GUID', url: 'URL', b64: 'B64', sha256: 'SHA256', og: 'OG', md: 'MD',
        yt: 'YT', ip: 'IP', myip: 'MyIP', ipv4: 'IPv4', ipv6: 'IPv6', geoip: 'GeoIP', asn: 'ASN',
        rdns: 'rDNS', dns: 'DNS', mx: 'MX', txt: 'TXT', ns: 'NS', spf: 'SPF', dkim: 'DKIM',
        dmarc: 'DMARC', mtr: 'MTR', ssl: 'SSL', tls: 'TLS', ptr: 'PTR', smtp: 'SMTP', http: 'HTTP',
        httpstatus: 'HTTPStatus', rdap: 'RDAP', isp: 'ISP', pdf: 'PDF', mergepdf: 'MergePDF',
        splitpdf: 'SplitPDF', compresspdf: 'CompressPDF', rotatepdf: 'RotatePDF',
        reorderpdf: 'ReorderPDF', watermarkpdf: 'WatermarkPDF', protectpdf: 'ProtectPDF',
        unlockpdf: 'UnlockPDF', image2pdf: 'Image2PDF', jpg2pdf: 'JPG2PDF', png2pdf: 'PNG2PDF',
        pdf2jpg: 'PDF2JPG', pdf2png: 'PDF2PNG', png: 'PNG', jpg: 'JPG', jpeg: 'JPEG', webp: 'WebP',
        avif: 'AVIF', heic: 'HEIC', heif: 'HEIF', svg: 'SVG', gif: 'GIF', ico: 'ICO', tiff: 'TIFF',
        bmp: 'BMP', mp3: 'MP3', wav: 'WAV', flac: 'FLAC', ogg: 'OGG', m4a: 'M4A', aac: 'AAC',
        opus: 'Opus', wma: 'WMA', aiff: 'AIFF', ac3: 'AC3', eq: 'EQ', equalizer: 'EQ', mxn: 'MXN',
        ascii: 'ASCII', smallcaps: 'SmallCaps', titlecase: 'TitleCase', textlogo: 'TextLogo',
        textart: 'TextArt', channelart: 'ChannelArt', lowerthird: 'LowerThird', copypaste: 'CopyPaste',
        dnspropagation: 'DNSPropagation', opengraph: 'OpenGraph', whip: 'WHIP', ingest: 'Ingest',
        play: 'Play', my: 'My', auth: 'Auth', api: 'API', admin: 'Admin', docs: 'Docs', dev: 'Dev',
        net: 'Net', img: 'Img', pastes: 'Pastes', paste: 'Pastes', maps: 'Maps', food: 'Food',
        text: 'Text', logo: 'Logo', audio: 'Audio', ai: 'AI', cdn: 'CDN', status: 'Status',
    };
    const SERVICE_TLD = { live: 'live', tools: 'tools', games: 'games', media: 'media', network: 'network', community: 'community', space: 'space' };
    const SERVICE_SUB = { net: 'net', dev: 'dev', paste: 'pastes', maps: 'maps', food: 'food', img: 'img', yt: 'yt', audio: 'audio', text: 'text', logo: 'logo', docs: 'docs' };

    function titleCase(w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : ''; }
    // Descriptive hosts ('youtube-downloader') are for search engines; the brand shows the name people use.
    const LONG_SUBS = { 'youtube-downloader': 'YT', youtubedownloader: 'YT', 'youtube-download': 'YT', youtube: 'YT', ytdl: 'YT' };
    function subLabel(sub) { return SUB_LABELS[sub] || SUB_LABELS[LONG_SUBS[sub] && LONG_SUBS[sub].toLowerCase()] || LONG_SUBS[sub] || titleCase(String(sub).replace(/-/g, ' ')).replace(/ /g, ''); }

    /**
     * { sub, core, tld, name, short, icon, variant } for the current page.
     *   sub   'Pastes' | null           tld  'Tools'        core 'OpenVibe'
     *   name  'Pastes.OpenVibe.Tools'   short 'Pastes' (what compact mode keeps)
     *   variant  the ov-mark flavour: the TLD id ('live', 'tools', …) — every site gets its own twist
     */
    function resolveBrand() {
        const b = Object.assign({}, _config.brand || {});
        const host = currentHost().toLowerCase();
        // OpenRestream lives at openre.stream: its brand is one word, "OpenRe" + "stream" with no dot between, so it
        // reads as OpenRestream while the two colours still show the domain.
        let sub = null, tld = null, core = 'OpenVibe', joined = false;
        let m = host.match(/^(?:(.+)\.)?openvibe\.([a-z]+)$/);
        if (m) { sub = m[1] && m[1] !== 'www' ? m[1] : null; tld = m[2]; }
        else if ((m = host.match(/^(?:(.+)\.)?openre\.stream$/))) { sub = m[1] && m[1] !== 'www' ? m[1] : null; core = 'OpenRe'; tld = 'stream'; joined = true; }
        // A site on its own open.<tld> domain (open.shoes) is named for it: Open.Shoes, not OpenVibe.Shoes.
        else if ((m = host.match(/^(?:(.+)\.)?open\.([a-z]+)$/))) { sub = m[1] && m[1] !== 'www' ? m[1] : null; core = 'Open'; tld = m[2]; }
        // Off-network hosts (localhost, previews): fall back to the service id.
        if (!tld) { tld = SERVICE_TLD[_config.service] || (SERVICE_SUB[_config.service] ? 'tools' : 'network'); sub = SERVICE_SUB[_config.service] || null; }
        // Legacy brandName ("Paste.OpenVibe", "OpenVibe.Live") still steers the segments.
        if (_config.brandName && !b.sub && !b.tld) {
            const parts = String(_config.brandName).split('.');
            if (parts.length >= 2 && /^openvibe$/i.test(parts[0])) tld = parts[1].toLowerCase();
            else if (parts.length >= 2 && /^openvibe$/i.test(parts[1])) sub = parts[0].toLowerCase();
            else if (parts.length === 1) sub = parts[0].toLowerCase();
        }
        if (b.sub !== undefined) sub = b.sub ? String(b.sub).toLowerCase() : null;
        if (b.tld) tld = String(b.tld).toLowerCase();
        if (b.core && !joined) core = String(b.core);
        const subText = b.subLabel || (sub ? subLabel(sub) : null);
        const tldText = b.tldLabel || (joined ? tld : TLD_LABELS[tld] || titleCase(tld));
        const site = joined ? `${core}${tldText}` : `${core}.${tldText}`;
        const name = b.name || [subText, site].filter(Boolean).join('.');
        const icon = b.icon || _config.brandIcon || null;
        const variant = b.variant || (joined ? 'stream' : tld);
        // The site's own front door: openre.stream, open.shoes, openvibe.<tld>.
        const apex = b.apex || (joined ? 'https://openre.stream/' : `https://${core.toLowerCase()}.${tld}/`);
        return { sub, subText, core, tld, tldText, joined, site, name, short: subText || site, icon, variant, tag: b.tag || null, href: b.href || '/', apex };
    }

    /** Where each brand segment goes: sub → this tool, OpenVibe → the network, TLD → the site's apex. */
    function brandLinks(brand) {
        const apex = brand.apex || (brand.joined ? 'https://openre.stream/' : `https://openvibe.${brand.tld}/`);
        if (!brand.subText) return { sub: brand.href, core: brand.href, tld: brand.href, apex };
        return { sub: brand.href, core: brand.joined ? apex : 'https://openvibe.network/', tld: apex, apex };
    }

    // ── The season (theme-loader.js Seasons) ────────────────────────────────────────
    // The OpenVibe mark wears it (ov-mark.js); the menus carry the switch (the account menu's "Seasonal themes" row and
    // the display box). → { s, on, off } during a season, else null.
    function seasonState() {
        const L = root.OpenVibeThemeLoader, s = L && L.seasons && L.seasons.now();
        return s ? { s, on: !!L.seasons.showing(), off: L.display.get().seasonal === 'off' } : null;
    }

    function brandHTML(brand) {
        const to = brandLinks(brand);
        const seg = (cls, text, href, title) => `<a href="${escapeAttr(href)}"${title ? ` title="${escapeAttr(title)}"` : ''} class="${cls}">${escapeAttr(text)}</a>`;
        const dot = '<span class="b-dot">.</span>';
        const join = brand.joined ? '' : dot;
        const text = brand.subText
            ? seg('b-sub', brand.subText, to.sub, brand.name) + dot + seg('b-core', brand.core, to.core, brand.core === 'OpenVibe' ? 'OpenVibe Network' : brand.site) + join + seg('b-tld', brand.tldText, to.tld, `All of ${brand.site}`)
            : seg('b-core', brand.core, to.core, brand.name) + join + seg('b-tld', brand.tldText, to.tld, brand.name);
        const mark = brand.icon
            ? `<i class="fa-solid ${escapeAttr(brand.icon)}"></i>`
            : `<span class="ov-mark" data-size="42" data-wide data-variant="${escapeAttr(brand.variant)}"></span>`;   // 42 since 4.188.0 (was 34: beside a short name it read as smaller than the word)
        const tag = brand.tag ? `<span class="b-tag">${escapeAttr(brand.tag)}</span>` : '';
        // 347: the mark and the name are one button (the site's pages, then every site).
        const one = (cls, t) => `<span class="${cls}">${escapeAttr(t)}</span>`;
        const words = brand.subText ? one('b-sub', brand.subText) + dot + one('b-core', brand.core) + join + one('b-tld', brand.tldText) : one('b-core', brand.core) + join + one('b-tld', brand.tldText);
        return `<div class="openvibe-navbar-brand${brand.subText ? ' has-sub' : ''}${brand.joined ? ' joined' : ''}">
                ${_config.switcher === false
        ? `<a class="flame" href="${escapeAttr(brand.href)}" aria-label="${escapeAttr(brand.name)} home">${mark}</a><span class="name">${text}${tag}</span>`
        : `<button type="button" class="ovnav-brand" id="openvibe-brand-btn" aria-haspopup="menu" aria-expanded="false" aria-label="${escapeAttr(brand.name)}: its pages and every OpenVibe site"><span class="flame">${mark}</span><span class="name">${words}${tag}</span></button>`}
                ${_config.search === false ? '' : orbHTML()}
            </div>`;
    }

    // The on-screen keyboard: html.ov-kb-open and --ov-kb (its height, against the tallest view seen without one).
    let _kbWatch = false;
    function watchKeyboard() {
        if (_kbWatch || typeof window === 'undefined' || !window.visualViewport || typeof document === 'undefined') return;
        _kbWatch = true;
        const vv = window.visualViewport; const html = document.documentElement;
        let raf = 0; let base = 0; let turned = typeof screen !== 'undefined' && screen.orientation ? screen.orientation.type : '';
        const typing = () => { const a = document.activeElement; return !!a && (a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(button|checkbox|radio|range|color|file|submit|reset|image|hidden)$/i.test(a.type || ''))); };
        const paint = () => {
            raf = 0;
            const o = typeof screen !== 'undefined' && screen.orientation ? screen.orientation.type : '';
            if (o !== turned) { turned = o; base = 0; }
            const t = typing();
            if (!t) base = Math.max(base, vv.height);
            const kb = Math.max(0, Math.round(Math.max(base, window.innerHeight) - vv.height - vv.offsetTop));
            const on = t && kb > 120;
            if (html.classList.contains('ov-kb-open') !== on) html.classList.toggle('ov-kb-open', on);
            html.style.setProperty('--ov-kb', `${on ? kb : 0}px`);
        };
        const later = () => { if (!raf) raf = requestAnimationFrame(paint); };
        vv.addEventListener('resize', later); vv.addEventListener('scroll', later);
        document.addEventListener('focusin', later); document.addEventListener('focusout', () => setTimeout(later, 60));
        later();
    }

    // Panels grow out of their trigger: OpenVibeNavbar.pop(el, trigger) / .unpop(el, done).
    function popFrom(el, from) {
        try {
            const r = el.getBoundingClientRect(), f = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
            el.style.setProperty('--ov-pop-x', `${Math.round(f ? f.left + f.width / 2 - r.left : r.width / 2)}px`);
            el.style.setProperty('--ov-pop-y', `${Math.round(f ? f.top + f.height / 2 - r.top : 0)}px`);
            el.classList.remove('ov-pop', 'ov-pop-out'); void el.offsetWidth; el.classList.add('ov-pop');
        } catch { /* */ }
    }
    function unpop(el, done) {
        let ended = false; const end = () => { if (ended) return; ended = true; el.classList.remove('ov-pop-out'); if (done) done(); };
        el.classList.remove('ov-pop'); el.classList.add('ov-pop-out');
        el.addEventListener('animationend', end, { once: true }); setTimeout(end, 220);
    }
    // A site's buttons: nav-slots.js draws them, loaded on first use; each render paints them again.
    function paintSlots() {
        if (!_navEl || typeof document === 'undefined') return;
        if (root.OpenVibeNavSlots) { root.OpenVibeNavSlots.paint(_navEl, _lead, _actions); return; }
        if (!_lead && !_actions.size) return;
        if (document.getElementById('ov-slots-loader')) return;
        try { const sc = document.createElement('script'); sc.id = 'ov-slots-loader'; sc.src = siblingV('nav-slots.js'); sc.async = true; sc.onload = () => paintSlots(); document.head.appendChild(sc); } catch { /* */ }
    }

    // The OpenVibe menu's button (the owner's pick, 2026-11-10: the Arena's M57, "Search and apps"): the menu itself,
    // small: a search bar over three apps. Open, the bar turns into one stroke of the close mark and the three apps
    // line up as the other, so the button that opens the menu is, in the same place, the one that closes it. One
    // drawing for the bar, the menu's sheet and the Dock's (root.OpenVibeOrb); its styles are below (.ovmb).
    const ORB_PARTS = '<rect class="ovmb-bar" x="4" y="5.2" width="16" height="5.6" rx="2.8"/><circle class="ovmb-dot" cx="7.4" cy="8" r="1.15"/>'
        + '<rect class="ovmb-app ovmb-a0" x="4.2" y="14.6" width="4" height="4" rx="1.3"/><rect class="ovmb-app ovmb-a1" x="10" y="14.6" width="4" height="4" rx="1.3"/><rect class="ovmb-app ovmb-a2" x="15.8" y="14.6" width="4" height="4" rx="1.3"/>';
    function orbSVG(size = 22, open = false) {
        return `<svg class="ovmb${open ? ' is-x' : ''}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ORB_PARTS}</svg>`;
    }
    root.OpenVibeOrb = { svg: orbSVG };
    function orbHTML() {
        return `<button type="button" class="ovnav-search ovnav-orb" id="openvibe-search-btn" aria-label="OpenVibe menu: search, every site and tool (/)" data-ov-tip="Menu" data-ov-tip-sub="Search, this site, every OpenVibe site" aria-haspopup="dialog" aria-expanded="false">${orbSVG()}</button>`;
    }


    // ── Frame data (https://openvibe.network/api/frame) ─────────────────────────────
    // Sites ordered by real use, footer copy and per-site legal links. Cached per host for 30
    // minutes in localStorage and refreshed in the background, so pages paint from cache and the
    // order never jumps while someone is looking at it. Defined once, shared by navbar + footer.
    const OVFrame = root.OpenVibeFrame || root.OpenVibeChrome || (root.OpenVibeFrame = root.OpenVibeChrome = (function () {
        const KEY = 'ov_frame_v2', TTL = 30 * 60000;   // v2: every site, with its launcher group
        let inflight = null;
        const host = () => (typeof location !== 'undefined' ? location.hostname : '');
        const https = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
        function clean(d) {
            if (!d || !Array.isArray(d.nav)) return null;
            const link = (l) => (l && typeof l.name === 'string' && https(l.url) ? { id: String(l.id || ''), name: l.name.slice(0, 60), url: l.url, icon: String(l.icon || ''), tagline: String(l.tagline || '').slice(0, 80), group: String(l.group || '').slice(0, 20) } : null);
            const f = d.footer || {}, lg = f.legal || {};
            return { nav: d.nav.map(link).filter(Boolean).slice(0, 60), groups: (Array.isArray(d.groups) ? d.groups : []).filter(g => g && typeof g.id === 'string' && typeof g.name === 'string').slice(0, 10).map(g => ({ id: g.id.slice(0, 20), name: g.name.slice(0, 40) })), soon: (d.soon || []).map(link).filter(Boolean).slice(0, 24),
                footer: { blurb: String(f.blurb || '').slice(0, 200), discover: (f.discover || []).map(link).filter(Boolean).slice(0, 6), popular: (f.popular || []).map(link).filter(Boolean).slice(0, 10),
                    legal: https(lg.terms) && https(lg.privacy) && https(lg.dmca) ? { terms: lg.terms, privacy: lg.privacy, dmca: lg.dmca } : null },
                // The menu's fields (dropped here until 4.132.0); search.js checks each entry.
                cards: Array.isArray(d.cards) ? d.cards.slice(0, 12) : [], next: d.next && typeof d.next === 'object' ? d.next : null,
                discover_ids: Array.isArray(d.discover_ids) ? d.discover_ids.slice(0, 40) : [], menu: d.menu && https(d.menu.beacon) ? { beacon: d.menu.beacon } : null };
        }
        function cached() { try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); return c && c.host === host() && c.data ? c : null; } catch { return null; } }
        function refresh() {
            if (inflight || typeof fetch === 'undefined') return inflight || Promise.resolve(null);
            inflight = fetch('https://openvibe.network/api/frame?host=' + encodeURIComponent(host()), { credentials: 'omit' })
                .then(r => (r.ok ? r.json() : null)).then(clean)
                .then(d => { if (d) { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), host: host(), data: d })); } catch { /* */ } } return d; })
                .catch(() => null);
            return inflight;
        }
        /** Cached data now (or null); `onFirst` fires once when a first-ever fetch lands. */
        function get(onFirst) {
            const c = cached();
            if (!c || Date.now() - c.at > TTL) { const p = refresh(); if (!c && onFirst) p.then(d => { if (d) onFirst(d); }); }
            return c ? c.data : null;
        }
        return { get, refresh };
    })());

    // A render's document/window listeners and panels; the next render (each boost page move) aborts them, so the old bar can go.
    let _renderAbort = null;
    const onDocument = () => (_renderAbort ? { signal: _renderAbort.signal } : undefined);

    /** One anonymous page-view count per page load (host only), which orders the network's navigation; skipped when
     *  the browser asks not to be tracked. `?in=1` says this browser is signed in, never who; it waits 2.5 s for that. */
    let _counted = false;
    function countView() {
        if (_counted || _config.countViews === false) return; _counted = true;
        try {
            if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || !/^https:$/.test(location.protocol)) return;
            const hit = 'https://openvibe.network/api/frame/hit';
            let sent = false;
            const send = () => { if (sent) return; sent = true; try { if (navigator.sendBeacon) navigator.sendBeacon(_config.user && !_config.user.is_anon ? `${hit}?in=1` : hit); } catch { /* */ } };
            // A page that knows its person, and a browser with no token at all (a guest), count now; only a browser
            // that may be signed in waits for the shared sign-in state, never longer than 2.5 s.
            if (_config.user || _config.auth === 'external' || !resolveToken()) return send();
            document.addEventListener('openvibe-navbar-auth', send, { once: true });
            setTimeout(send, 2500);
        } catch { /* */ }
    }

    /** Status chips beside the bell (balances, counters): [{ id, icon, value, valueId, title, tone, onClick, hidden }]. */
    function chipsHTML(chips, cls) {
        return (Array.isArray(chips) ? chips : []).filter(Boolean).map(c => `<button type="button" class="${cls || 'ovnav-chip'}" data-chip-id="${escapeAttr(c.id)}"${c.tone ? ` data-tone="${escapeAttr(c.tone)}"` : ''}${c.title ? ` title="${escapeAttr(c.title)}"` : ''}${c.hidden ? ' hidden' : ''}>${c.icon ? navIcon(c.icon) : ''}<span class="ovnav-chip-v"${c.valueId ? ` id="${escapeAttr((cls ? 'menu-' : '') + c.valueId)}"` : ''}>${escapeAttr(c.value == null ? '' : c.value)}</span></button>`).join('');
    }
    /** "160,774" → "161k", for the folded chip; anything that is not a number stays as it is. */
    function shortValue(v) {
        const s = v == null ? '' : String(v); const n = Number(s.replace(/[,\s]/g, ''));
        if (!s || !isFinite(n)) return s;
        const a = Math.abs(n);
        if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
        if (a >= 1e4) return `${Math.round(n / 1e3)}k`;
        if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
        return String(Math.round(n));
    }
    const chipLabel = (c) => c.label || String(c.title || c.id).split(':')[0];
    // New messages are counted on the bell (4.187.0; the owner, 2026-11-10: "instead of having messaging and
    // notifications, just have the notifications … it'll show you new messages as well"): there is no Messages button.
    let _accountEl = null;   // the account's block, built at render, hosted by the menu's You tab
    let _msgCount = 0;
    // New messages, for the bell's count: Chat's GET /api/dm/unread, at most once a minute (README, "The navbar").
    let _unreadAt = 0;
    function loadUnread() {
        const m = _config.messages, u = _config.user;
        if (!m || !m.__default || !u || u.is_anon || !_config.token || typeof fetch !== 'function' || Date.now() - _unreadAt < 60000) return;
        _unreadAt = Date.now();
        fetch(`${String(_config.dockChatBase || 'https://openvibe.chat').replace(/\/+$/, '')}/api/dm/unread`, { headers: { Authorization: `Bearer ${_config.token}` }, credentials: 'omit' })
            .then((r) => (r.ok ? r.json() : null)).then((b) => { if (b && _config.messages.__default) OpenVibeNavbar.setMessages(Number(b.unread) || 0); }).catch(() => {});
    }

    function chipsAllHTML(chips) {
        const list = (Array.isArray(chips) ? chips : []).filter((c) => c && !c.hidden);
        if (list.length < 2 && !(list[0] && ['coins', 'vibes', 'balance'].includes(list[0].id))) return '';
        return `<button type="button" class="ovnav-chip ovnav-chip--all" id="openvibe-chips-all" aria-haspopup="true" aria-expanded="false" aria-label="Your balances: ${escapeAttr(list.map((c) => `${chipLabel(c)} ${c.value == null ? '' : c.value}`).join(', '))}">${list.map((c, i) => `<span class="ovnav-chip-mini${i ? '' : ' is-on'}" data-chip-mini="${escapeAttr(c.id)}" data-v="${escapeAttr(c.value == null ? '' : c.value)}"${c.tone ? ` data-tone="${escapeAttr(c.tone)}"` : ''}>${c.icon ? navIcon(c.icon) : ''}<span class="ovnav-chip-mv">${escapeAttr(shortValue(c.value))}</span></span>`).join('')}</button>`;
    }
    function bindChipsAll(nav) {
        const btn = nav.querySelector('#openvibe-chips-all'); if (!btn || typeof btn.addEventListener !== 'function') return;
        const right = typeof btn.closest === 'function' ? btn.closest('.openvibe-navbar-right') : null;
        if (right && right.classList) right.classList.add('has-chips-all');
        if (root.OpenVibePurse) root.OpenVibePurse.mount(btn);
        else if (!document.getElementById('ov-purse-loader')) { const sc = document.createElement('script'); sc.id = 'ov-purse-loader'; sc.src = siblingV('purse.js'); sc.async = true; document.head.appendChild(sc); }
        let pop = null;
        const close = () => { if (pop) pop.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (_config.wallet) { close(); openWallet(); return; }
            if (pop && pop.classList.contains('open')) return close();
            if (!pop) { pop = document.createElement('div'); pop.className = 'ovnav-chips-pop'; pop.setAttribute('role', 'menu'); nav.appendChild(pop); regPanel(pop, 'chips', close, btn); }
            const list = (_config.chips || []).filter((c) => c && !c.hidden);
            pop.innerHTML = list.map((c) => `<button type="button" role="menuitem" data-chip-row="${escapeAttr(c.id)}"${c.tone ? ` data-tone="${escapeAttr(c.tone)}"` : ''}>${c.icon ? navIcon(c.icon) : ''}<span>${escapeAttr(chipLabel(c))}</span><b>${escapeAttr(c.value == null ? '' : c.value)}</b></button>`).join('');
            pop.querySelectorAll('[data-chip-row]').forEach((row) => row.addEventListener('click', (ev) => {
                ev.stopPropagation(); close();
                const c = list.find((x) => x.id === row.getAttribute('data-chip-row'));
                if (c && typeof c.onClick === 'function') c.onClick(ev);
            }));
            pop.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
            const first = pop.querySelector('button'); if (first) first.focus();
        });
    }
    /** ov-icons.js draws every .ov-icon: loaded once after the page settles, or at once on intent; slots keep their size. */
    let _iconsQueued = false;
    function loadOvIcons(scope) {
        if (root.OpenVibeIcons) { if (scope && root.OpenVibeIcons.mount) root.OpenVibeIcons.mount(scope); return; }
        if (document.getElementById('ov-icons-loader')) return;
        try { const sc = document.createElement('script'); sc.id = 'ov-icons-loader'; sc.src = siblingV('ov-icons.js'); sc.async = true; document.head.appendChild(sc); } catch { /* */ }
    }
    function queueIcons() {
        if (_iconsQueued || root.OpenVibeIcons) return;
        _iconsQueued = true;
        const go = () => loadOvIcons();
        if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(go, { timeout: 4000 });
        else { const t = setTimeout(go, 2500); if (t && typeof t.unref === 'function') t.unref(); }
    }
    /** ov-fx.js (4.66.0): the network's effects, loaded once the page settles, only for a page that has data-fx. */
    function queueFx() {
        const go = () => {
            if (root.OVFx || typeof document.querySelector !== 'function' || document.getElementById('ov-fx-loader') || !document.querySelector('[data-fx]')) return;
            try { const sc = document.createElement('script'); sc.id = 'ov-fx-loader'; sc.src = siblingV('ov-fx.js'); sc.async = true; document.head.appendChild(sc); } catch { /* */ }
        };
        if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(go, { timeout: 3000 });
        else { const t = setTimeout(go, 1500); if (t && typeof t.unref === 'function') t.unref(); }
    }
    function bindChips(scope) {
        (_config.chips || []).concat((_config.menu && _config.menu.headerChips) || []).forEach((c) => {
            if (!c || typeof c.onClick !== 'function') return;
            scope.querySelectorAll(`[data-chip-id="${c.id}"]`).forEach(el => { if (!el.__b) { el.__b = true; el.addEventListener('click', (e) => { e.stopPropagation(); c.onClick(e); }); } });
        });
    }

    /** A link on this site as the path a router takes (/@name?tab=x#y), or null for another site. The account menu's
     *  links are full addresses (https://openvibe.live/@name on every site), and a router handed one put it under '/'
     *  (Live, 2026-10-28: "My channel" opened /https://openvibe.live/@name). */
    function sitePath(a) {
        try { const u = new URL(a.href, location.href); return u.origin === location.origin ? `${u.pathname}${u.search}${u.hash}` : null; } catch { return null; }
    }

    /** Link behaviour: per-link onClick, in-app navigation (onNavigate), dropdowns, the mobile drawer. */
    function bindLinks(nav, links) {
        const byId = new Map(flatLinks(links).filter(l => l.id).map(l => [l.id, l]));
        const drawer = nav.querySelector('#openvibe-drawer'), burger = nav.querySelector('#openvibe-burger');
        // The menu's own Close is the burger's ✕ on a phone (search.js hides its in-box Close then).
        try { document.documentElement.classList.toggle('ovnav-has-burger', !!burger); } catch { /* */ }
        const closeDrawer = () => { if (drawer) drawer.classList.remove('open'); if (burger) burger.setAttribute('aria-expanded', 'false'); };
        // A finger or pointer on its way to the menu fetches it now (warmMenu above).
        ['pointerenter', 'pointerdown', 'focusin'].forEach((t) => nav.addEventListener(t, (e) => { if (e.target && e.target.closest && e.target.closest('#openvibe-burger, #openvibe-search-btn')) warmMenu(); }, { passive: true, capture: t === 'pointerenter' }));
        nav.addEventListener('click', (e) => {
            const a = e.target.closest && e.target.closest('a.ovnav-link, .ovnav-net'); if (!a || !nav.contains(a)) return;
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const item = byId.get(a.getAttribute('data-link-id'));
            // A parent of a dropdown opens it on touch (there is no hover); a second tap follows the link.
            const dd = a.parentElement && a.parentElement.classList.contains('ovnav-dd') ? a.parentElement : null;
            if (dd && a.getAttribute('data-link-id') === 'ovnav-more') { e.preventDefault(); const o = !dd.classList.contains('open'); nav.querySelectorAll('.ovnav-dd.open').forEach(x => x.classList.remove('open')); if (o) { dd.classList.add('open'); placeDd(dd); } return; }
            if (dd && matchMedia('(hover: none)').matches && !dd.classList.contains('open')) { e.preventDefault(); nav.querySelectorAll('.ovnav-dd.open').forEach(x => x.classList.remove('open')); dd.classList.add('open'); placeDd(dd); return; }
            if (item && typeof item.onClick === 'function') { const r = item.onClick(e); if (r === false) e.preventDefault(); closeDrawer(); if (e.defaultPrevented) return; }
            if (typeof _config.onNavigate === 'function' && a.target !== '_blank') {
                const path = sitePath(a);
                if (path != null && _config.onNavigate(path, e) === false) e.preventDefault();
            }
            closeDrawer();
        });
        nav.querySelectorAll('.ovnav-dd').forEach((dd) => regPanel(dd, 'nav-dropdown', () => dd.classList.remove('open'), dd.querySelector(':scope > a')));
        // Dropdowns are fixed under their link: the links row scrolls sideways and would clip them.
        const placeDd = (dd) => {
            const m = dd && dd.querySelector(':scope>.ovnav-dd-menu'); if (!m) return;
            let cb = dd.parentElement, o = { top: 0, left: 0 };
            for (; cb && cb !== document.body; cb = cb.parentElement) { const c = getComputedStyle(cb); if (c.transform + c.filter + (c.backdropFilter || 'none') !== 'nonenonenone') { o = cb.getBoundingClientRect(); break; } }
            const r = dd.getBoundingClientRect();
            m.style.top = `${r.bottom - o.top}px`; m.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 188)) - o.left}px`;
        };
        const place = (e) => placeDd(e.target.closest && e.target.closest('.ovnav-dd'));
        nav.addEventListener('pointerover', place); nav.addEventListener('focusin', place);
        if (burger && drawer) {
            if (!_config.user) { bindDisplayControls(drawer.querySelector('.ovnav-display')); bindLook(drawer); }   // guests: members have them in the account menu
            // One menu (the owner, 11-07: "combining this menu and the other menu … the main button on the right-hand side"):
            // the burger opens the OpenVibe menu, from the burger, leading with this site's pages. The old drawer stays for a
            // site that turns the menu off (search: false) or asks for it (drawer: 'legacy').
            burger.addEventListener('click', (e) => {
                e.stopPropagation();
                if (_config.search !== false && _config.drawer !== 'legacy') { if (menuOpen() && root.OpenVibeSearch) root.OpenVibeSearch.close(); else openSearch('', 'here', burger); return; }
                const open = drawer.classList.toggle('open'); burger.setAttribute('aria-expanded', String(open)); if (open) loadOvIcons(drawer);
            });
            drawer.addEventListener('click', (e) => {
                const all = e.target.closest && e.target.closest('[data-open-launcher]'); if (!all) return;
                e.preventDefault(); e.stopPropagation(); closeDrawer();
                openSearch('', 'sites');
            });
            document.addEventListener('click', (e) => { if (drawer.classList.contains('open') && !drawer.contains(e.target) && !burger.contains(e.target)) closeDrawer(); }, onDocument());
            regPanel(drawer, 'nav-drawer', closeDrawer, burger);
        }
    }

    /** Dropdown, launcher and notifications share one coordinator (panels.js): one open at a time, Escape, rotation.
     *  Panels are registered where they are created (no page-wide observers); registrations queue until the script loads. */
    const _panelQueue = [];
    function regPanel(el, id, close, trigger) {
        if (!el) return;
        const opts = Object.assign({ el, openClass: 'open', id, close, trigger }, onDocument());
        if (root.OpenVibePanels) return root.OpenVibePanels.register(opts);
        _panelQueue.push(opts);
        if (document.getElementById('ov-panels-loader')) return;
        const sc = document.createElement('script'); sc.id = 'ov-panels-loader'; sc.src = siblingV('panels.js'); sc.async = true;
        sc.onload = () => { while (_panelQueue.length) root.OpenVibePanels && root.OpenVibePanels.register(_panelQueue.shift()); };
        document.head.appendChild(sc);
    }

    /** Sites in the user menu: most used first (Frame data), never the one we are on. */
    /** Light / Dark / Auto: the theme's other half, or the device's (theme-loader.js scheme). */
    function bindScheme(scope) {
        const L = root.OpenVibeThemeLoader, box = scope.querySelector('.ud-scheme');
        if (!box || !L || !L.scheme) return;
        const paint = () => { const now = L.scheme.get(); box.querySelectorAll('[data-ov-scheme]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-ov-scheme') === now))); };
        box.addEventListener('click', (e) => { const b = e.target.closest('[data-ov-scheme]'); if (!b) return; e.stopPropagation(); L.scheme.set(b.getAttribute('data-ov-scheme')); paint(); });
        ['ov:theme', 'ov:display'].forEach((ev) => root.addEventListener(ev, paint, onDocument()));
        box.hidden = false; paint();
    }

    /** The Look panel (ov-look.js, 4.64.0): the palette opens it in place; without the script the link goes to Design. */
    function bindLook(scope) {
        scope.addEventListener('click', (e) => {
            const a = e.target.closest && e.target.closest('[data-ov-look-open]'); if (!a) return;
            const box = a.parentElement && a.parentElement.parentElement && a.parentElement.parentElement.querySelector('.ud-look') || scope.querySelector('.ud-look'); if (!box) return;
            e.preventDefault(); e.stopPropagation();
            const open = box.hidden; box.hidden = !open; a.setAttribute('aria-expanded', String(open));
            if (open) popFrom(box, a);
            if (!open || box.__ovlk) return;
            const go = () => { if (root.OVLook) root.OVLook.mount(box, { signedIn: !!_config.user, season: !!_config.user }); else location.href = a.href; };
            if (root.OVLook) return go();
            const sc = document.createElement('script'); sc.src = siblingV('ov-look.js'); sc.async = true; sc.onload = go; sc.onerror = () => { location.href = a.href; }; document.head.appendChild(sc);
        });
    }

    /** Display rows (text size, animations) cycle their value; state lives in theme-loader.js. */
    function bindDisplayRows(dropdown) {
        bindScheme(dropdown);
        const L = root.OpenVibeThemeLoader; const rows = dropdown.querySelectorAll('[data-ov-display]');
        if (!L || !L.display) { rows.forEach(r => { r.hidden = true; }); return; }
        const LABEL = { text: { 100: '', 112: '+', 125: '++' }, motion: { auto: '', reduced: 'Calm' }, seasonal: { on: 'On', off: 'Off' } };
        const SAY = { text: { 100: 'default', 112: 'large', 125: 'largest' }, motion: { auto: 'on', reduced: 'calm' } };
        const paint = () => { const d = L.display.get(); rows.forEach(r => { const k = r.getAttribute('data-ov-display'); r.querySelector('.ud-val').textContent = LABEL[k][d[k]] || ''; const say = `${k === 'text' ? 'Text size' : 'Animations'}: ${(SAY[k] || {})[d[k]] || d[k]}`; r.title = say; r.setAttribute('aria-label', say); r.setAttribute('aria-pressed', String(k === 'motion' ? d[k] === 'reduced' : d[k] !== 100 && d[k] !== '100')); }); };
        rows.forEach(r => r.addEventListener('click', (e) => { e.stopPropagation(); const k = r.getAttribute('data-ov-display'), o = L.display.options[k], cur = L.display.get()[k]; L.display.set({ [k]: o[(o.indexOf(cur) + 1) % o.length] }); paint(); }));
        root.addEventListener('ov:display', paint, onDocument()); paint();
    }

    /** OpenCoins (Network) and Vibes (OpenVibe.Billing) in the menu header: one request each when the menu first opens. */
    let _walletLoaded = false;
    async function loadWallet(dropdown) {
        // The bar's chips (a site's own, or wallet: true) show the balances already: the menu does not ask twice.
        const inBar = !!_config.wallet || (Array.isArray(_config.chips) && _config.chips.some(c => c && (c.id === 'coins' || c.id === 'vibes')));
        if (_walletLoaded || !_config.token || inBar || (_config.menu && _config.menu.headerChips)) return; _walletLoaded = true;
        const auth = { Authorization: `Bearer ${_config.token}` };
        const chip = (id, html) => { const el = dropdown.querySelector(id); if (el) { el.innerHTML = html; el.hidden = false; } };
        const showVibes = (v) => { if (isFinite(v)) chip('#openvibe-vibes', `<a href="https://openvibe.live/#vibes" title="Your Vibes">${navIcon('fa-wallet')} ${v.toLocaleString()} <small>Vibes</small></a>`); };
        // Both balances from the Network in one request (it asks Billing): every site's connect-src allows
        // openvibe.network and none allowed billing.openvibe.network, so Vibes never showed (2026-10-28).
        const both = await fetch(`${_config.apiBase}/api/coins/me?with=vibes`, { headers: auth, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (both) {
            const bal = Number(both.balance ?? (both.wallet && both.wallet.balance));
            if (isFinite(bal)) chip('#openvibe-wallet', `<a href="https://openvibe.network/my#coins" title="OpenCoins">${navIcon('fa-coins')} ${bal.toLocaleString()} <small>OpenCoins</small></a>`);
        }
        // Vibes only from the Network: no site's CSP allows billing.openvibe.network (no direct fallback since 4.172.0).
        if (both && both.vibes != null) showVibes(Number(both.vibes));
    }

    /** The network's most used sites, after the page's own links (networkLinks: false turns it off). */
    function networkLinksHTML(pageLinks, inDrawer) {
        if (_config.networkLinks === false) return '';
        const frame = OVFrame.get((d) => { if (d && _navEl && !_navEl.querySelector('.ovnav-net')) { try { render(); } catch { /* */ } } });
        if (!frame) return '';
        const here = currentHost().toLowerCase();
        const taken = new Set((pageLinks || []).map(l => { try { return new URL(l.href, location.href).hostname; } catch { return ''; } }));
        const max = inDrawer ? 8 : (typeof _config.networkLinks === 'number' ? _config.networkLinks : _config.networkLinks === true ? 4 : 0);
        if (!max) return '';
        const pick = frame.nav.filter(n => { try { const h = new URL(n.url).hostname; return h !== here && !here.endsWith('.' + h) && !taken.has(h); } catch { return false; } }).slice(0, max);
        if (!pick.length) return '';
        if (inDrawer) {
            return `<div class="ovnav-net-head"><span class="ov-icon" data-icon="ov" data-size="22" data-fx="none"></span><span class="ud-label">Across OpenVibe</span>${_config.launcher === false ? '' : '<button type="button" class="ovnav-net-all" data-open-launcher>All sites</button>'}</div>`
                + `<div class="ovnav-net-grid">${pick.map(n => `<a class="ovnav-net" data-ov-net-link href="${escapeAttr(n.url)}" title="${escapeAttr(n.tagline)}"><span class="ov-icon" data-icon="${escapeAttr(n.icon || n.id)}" data-size="22" data-fx="none"></span><span>${escapeAttr(n.name)}</span></a>`).join('')}</div>`;
        }
        return `<span class="ovnav-sep" aria-hidden="true"></span>` + pick.map(n => `<a class="ovnav-net" data-ov-net-link href="${escapeAttr(n.url)}" title="${escapeAttr(n.tagline)}">${escapeAttr(n.name)}</a>`).join('');
    }

    /** The menu's Display row: light, dark or auto as icons, and Settings opening the Look panel (text size, motion, theme,
     *  icons) in place, the same as the account menu's (11-09, the owner: "moved to a settings menu… more compact"). */
    function bindDisplayControls(box) {
        const L = root.OpenVibeThemeLoader; if (!box || !L || !L.display) return;
        const say = () => { const sch = L.scheme ? L.scheme.get() : null; const d = L.display.get(); return [{ light: 'Light', dark: 'Dark', auto: 'Auto' }[sch] || '', d.motion === 'reduced' ? 'Calm' : '', String(d.text) !== '100' ? 'Large text' : ''].filter(Boolean).join(' · '); };
        box.innerHTML = `<a class="ovnav-disp-row" href="https://openvibe.design/look" data-ov-look-open aria-expanded="false"><span class="ovnav-disp-ic">${navIcon('fa-palette')}</span><span><b>Display and theme</b><small data-disp-say></small></span>${navIcon('fa-chevron-down')}</a><div class="ud-look" hidden></div>`;
        const paint = () => { const s = box.querySelector('[data-disp-say]'); if (s) s.textContent = say(); };
        bindLook(box);
        if (typeof root.addEventListener === 'function') { root.addEventListener('ov:theme', paint, onDocument()); root.addEventListener('ov:display', paint, onDocument()); }
        paint();
        box.hidden = false;
    }

    // ── Notifications (count and list are mounted in You) ─────
    function mountNotifications(nav, u) {
        if (_config.notifications === false || !u || u.is_anon || !_config.token) return;
        const avatar = nav.querySelector('#openvibe-avatar-btn');
        const badge = avatar?.parentElement?.querySelector('.ovnav-avatar-count');
        if (badge) badge.hidden = true;
        const go = () => {
            const N = root.OpenVibeNotifications; if (!N) return;
            try {
                if (!N.__ovNavInit) { N.init({ token: _config.token, apiBase: 'https://openvibe.network', realtime: _config.notificationsRealtime === true }); N.__ovNavInit = true; }
                const paint = () => { if (!badge) return; const n = Number(N.unread()) || 0; badge.textContent = n > 99 ? '99+' : String(n); badge.hidden = !n; };
                paint(); document.addEventListener('openvibe-notifications-count', paint);
            } catch { /* */ }
        };
        if (root.OpenVibeNotifications) return go();
        if (document.getElementById('ov-notify-loader')) return;
        const sc = document.createElement('script'); sc.id = 'ov-notify-loader'; sc.src = siblingV('notification-ui.js'); sc.async = true; sc.onload = () => setTimeout(go, 0); document.head.appendChild(sc);
    }

    // ── The Dock (Dock plan K-D1): your agents and activity at the screen's edge. dock.js draws its pill and the Dock;
    // for a signed-in person it loads alongside notifications. A Network without the route yet (dock.js
    // keeps { off } for a day) is not asked again. dockApiBase and dockChatBase override the Network and Chat (tests, staging).
    const dockBase = () => String(_config.dockApiBase || 'https://openvibe.network').replace(/\/+$/, '');
    const dockOpts = () => ({ token: () => _config.token, apiBase: dockBase(), chatBase: _config.dockChatBase, agentBase: _config.dockAgentBase, me: _config.user && _config.user.username, sibling });
    const DOCK_GLYPH = '<svg class="ovnav-ic" viewBox="0 0 512 512" style="width:1em" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M80 64h352a48 48 0 0 1 48 48v288a48 48 0 0 1-48 48H80a48 48 0 0 1-48-48V112a48 48 0 0 1 48-48Zm8 56v272h336V120ZM264 312h112a28 28 0 0 1 0 56H264a28 28 0 0 1 0-56Z"/></svg>';
    function loadDock(then) {
        if (root.OpenVibeDock) return then();
        let sc = document.getElementById('ov-dock-loader');
        if (!sc) { sc = document.createElement('script'); sc.id = 'ov-dock-loader'; sc.src = siblingV('dock.js'); sc.async = true; document.head.appendChild(sc); }
        sc.addEventListener('load', () => setTimeout(() => { try { then(); } catch { /* */ } }, 0));
    }
    let _dockOn = false;
    function mountDock(u) {
        const on = _config.dock !== false && !!u && !u.is_anon && !!_config.token;
        _dockOn = on;
        if (root.OpenVibeDock) return root.OpenVibeDock.mount(on ? dockOpts() : null);
        try { const k = JSON.parse(localStorage.getItem('ov-dock') || 'null'); if (!on || (k && k.off > Date.now())) return; } catch { if (!on) return; }
        loadDock(() => root.OpenVibeDock.mount(dockOpts()));
    }
    // Your online status (presence.js, 4.131.0): its dot on your picture, a heartbeat, the picker. presence: false turns it off.
    function mountPresence(u) {
        if (_config.presence === false || !u || u.is_anon || !_config.token) return;
        const go = () => root.OpenVibePresence && root.OpenVibePresence.start({ token: () => _config.token, apiBase: dockBase(), user: u });
        if (root.OpenVibePresence) return go();
        if (document.getElementById('ov-presence-loader')) return;
        const sc = document.createElement('script'); sc.id = 'ov-presence-loader'; sc.src = siblingV('presence.js'); sc.async = true; sc.onload = go; document.head.appendChild(sc);
    }
    // Floating cards (overlay.js, 4.152.0): a live picture, a chat or an agent that follows the person across pages and
    // OpenVibe sites. Loaded only when a card is coming (a link carried one in its #ovo=, or one was open before this
    // page's reload) or a page asks for one with OpenVibeNavbar.overlay(…).
    function loadOverlay(then) {
        if (root.OVOverlay) { if (then) then(root.OVOverlay); return; }
        let sc = document.getElementById('ov-overlay-loader');
        if (!sc) { sc = document.createElement('script'); sc.id = 'ov-overlay-loader'; sc.src = siblingV('overlay.js'); sc.async = true; document.head.appendChild(sc); }
        if (then) sc.addEventListener('load', () => { if (root.OVOverlay) then(root.OVOverlay); }, { once: true });
    }
    function watchOverlays() {
        let waiting = false;
        try { waiting = /(?:^#|&)ovo=/.test(root.location.hash || '') || !!sessionStorage.getItem('ov-overlay'); } catch { /* private mode */ }
        if (waiting) loadOverlay();
    }
    // Faster to the next OpenVibe site: when a pointer or finger reaches for a link to another one, connect to it then.
    function warmLinks() {
        if (root.__ovWarm || typeof document.addEventListener !== 'function') return;
        root.__ovWarm = true;
        const done = new Set();
        const warm = (e) => {
            const a = e.target && e.target.closest && e.target.closest('a[href]');
            if (!a) return;
            let u; try { u = new URL(a.href, root.location.href); } catch { return; }
            if (u.protocol !== 'https:' || u.origin === root.location.origin || done.has(u.origin) || !/(^|\.)openvibe\.[a-z]+$/.test(u.hostname) || done.size > 12) return;
            done.add(u.origin);
            const l = document.createElement('link'); l.rel = 'preconnect'; l.href = u.origin; l.crossOrigin = ''; document.head.appendChild(l);
            const d = document.createElement('link'); d.rel = 'dns-prefetch'; d.href = u.origin; document.head.appendChild(d);
        };
        document.addEventListener('pointerover', warm, { passive: true, capture: true });
        document.addEventListener('touchstart', warm, { passive: true, capture: true });
        document.addEventListener('focusin', warm, { passive: true, capture: true });
        // A link that leaves this page shows the top bar at once (the owner, 11-09: "a progress indicator at the very
        // top… a glow… OpenVibe looking"); Boost's own moves draw the same bar (route-transition.js). Listening on the
        // window, after the page's own handlers: a click a page or Boost took (defaultPrevented) draws nothing here.
        if (typeof root.addEventListener !== 'function') return;
        root.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = e.target && e.target.closest && e.target.closest('a[href]');
            if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
            let u; try { u = new URL(a.href, root.location.href); } catch { return; }
            const here = root.location;
            if (!/^https?:$/.test(u.protocol) || (u.origin === here.origin && u.pathname === here.pathname && u.search === here.search)) return;
            let b = document.getElementById('ovnav-leave');
            if (!b) { b = document.createElement('div'); b.id = 'ovnav-leave'; b.className = 'ovrt-bar'; b.setAttribute('aria-hidden', 'true'); document.body.appendChild(b); }
            b.classList.remove('is-done'); void b.offsetWidth; b.classList.add('is-run');
        });
        // Back from the next page (the browser's page cache): the bar is gone.
        root.addEventListener('pageshow', () => { const b = document.getElementById('ovnav-leave'); if (b) b.classList.remove('is-run'); });
    }
    // The Dock on a tab ('agent' | 'activity'); opts.task marks that step and brings it into view.
    function openDock(tab, opts) { loadDock(() => { root.OpenVibeDock.mount(dockOpts()); root.OpenVibeDock.open(Object.assign({ tab }, opts || {})); }); }
    // Ask your agent (4.135.0): Vibe opens with the question in its box; signed out, sign in first.
    function askAgent(text) {
        if (!_config.token || _config.dock === false) { const u = resolveLoginHref(currentHost(), location.href); if (u) location.href = u; return; }
        loadDock(() => { root.OpenVibeDock.mount(dockOpts()); root.OpenVibeDock.ask({ text }); });
    }
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('[data-ov-ask]'); if (!b) return; e.preventDefault(); askAgent(b.getAttribute('data-ov-ask') || ''); });

    /** Custom sections for the user menu: [{ label, items: [{ label, icon, href, id, elId, hidden, danger, value, onClick }] }]. */
    function sectionsHTML(sections) {
        return (Array.isArray(sections) ? sections : []).filter(sec => sec && Array.isArray(sec.items) && sec.items.length).map(sec =>
            `<div class="ud-sec"${sec.id ? ` data-sec-id="${escapeAttr(sec.id)}"` : ''}${sec.hidden ? ' hidden' : ''}>${sec.label ? `<div class="ud-label">${escapeAttr(sec.label)}</div>` : ''}${sec.items.map(menuItemHTML).join('')}</div><div class="sep"></div>`).join('');
    }
    const sectionItems = (sections) => (Array.isArray(sections) ? sections : []).reduce((o, sec) => o.concat((sec && sec.items) || []), []);

    // What this person opens from the menu, counted on this device (no request, nothing leaves the browser): the grid
    // puts their most used first once a place has been opened twice; until then the site's own order stands.
    const USE_KEY = 'ov-menu-use';
    const useKey = (item) => String(item.id || item.href || item.label || '').slice(0, 80);
    function useCounts() { try { return JSON.parse(localStorage.getItem(USE_KEY) || '{}') || {}; } catch { return {}; } }
    function countUse(key) {
        if (!key) return;
        try { const c = useCounts(); c[key] = Math.min(9999, (Number(c[key]) || 0) + 1); const keys = Object.keys(c); if (keys.length > 60) keys.sort((x, y) => c[x] - c[y]).slice(0, keys.length - 60).forEach((k) => delete c[k]); localStorage.setItem(USE_KEY, JSON.stringify(c)); } catch { /* private mode */ }
    }
    function byUse(items) {
        const c = useCounts(), n = (it) => { const v = Number(c[useKey(it)]) || 0; return v >= 2 ? v : 0; };
        return items.map((it, i) => [it, i]).sort((x, y) => (x[0].hidden ? 1 : 0) - (y[0].hidden ? 1 : 0) || n(y[0]) - n(x[0]) || x[1] - y[1]).map(([it]) => it);
    }
    /** One place in the account menu's grid: an icon over a short name (item.short, else its label). */
    function tileHTML(item) {
        const attrs = ` class="ud-tile${item.danger ? ' danger' : ''}" data-use="${escapeAttr(useKey(item))}" title="${escapeAttr(item.label)}"${item.id ? ` data-menu-id="${escapeAttr(item.id)}"` : ''}${item.elId ? ` id="${escapeAttr(item.elId)}"` : ''}${item.hidden ? ' hidden' : ''}${item.mark ? ` ${item.mark}` : ''}`;
        const inner = `<span class="icon">${item.drawn || navIcon(item.icon || 'fa-circle-info')}</span><span class="ud-tl">${escapeAttr(item.short || item.label)}</span>${item.value !== undefined ? `<b class="ud-val">${escapeAttr(item.value)}</b>` : ''}`;
        return item.href ? `<a href="${escapeAttr(item.href)}"${attrs}${item.external ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>` : `<button type="button"${attrs}>${inner}</button>`;
    }

    function menuItemHTML(item) {
        if (!item) return '';
        if (item.sep) return '<div class="sep"></div>';
        const icon = item.drawn ? `<span class="icon">${item.drawn}</span>` : item.icon ? `<span class="icon">${navIcon(item.icon)}</span>` : '<span class="icon"></span>';
        const cls = item.danger ? ' class="danger"' : '';
        const id = `${item.id ? ` data-menu-id="${escapeAttr(item.id)}"` : ''}${item.elId ? ` id="${escapeAttr(item.elId)}"` : ''}${item.hidden ? ' hidden' : ''} data-use="${escapeAttr(useKey(item))}"${item.mark ? ` ${item.mark}` : ''}`;
        const val = item.value !== undefined ? `<b class="ud-val">${escapeAttr(item.value)}</b>` : '';
        if (item.href) return `<a href="${escapeAttr(item.href)}"${cls}${id}${item.external ? ' target="_blank" rel="noopener"' : ''}>${icon} ${escapeAttr(item.label)}${val}</a>`;
        return `<button type="button"${cls}${id}>${icon} ${escapeAttr(item.label)}${val}</button>`;
    }

    function bindMenuItems(container, items) {
        for (const item of items) {
            if (!item || !item.id || typeof item.onClick !== 'function') continue;
            container.querySelector(`[data-menu-id="${item.id}"]`)?.addEventListener('click', (e) => { if (!item.href) e.preventDefault(); const r = item.onClick(e); if (r === false) e.preventDefault(); if (item.keepOpen !== true) container.closest('.openvibe-navbar-dropdown')?.classList.remove('open'); });
        }
    }

    /** One top-level link. Supports { label, href, icon, id, elId, page, hidden, external, dot, dotId,
        featured, children: [...] }. featured: true draws it as the site's one accent pill (4.117.0). */
    function linkHTML(l, inDrawer) {
        const attrs = `${l.id ? ` data-link-id="${escapeAttr(l.id)}"` : ''}${l.elId ? ` id="${escapeAttr((inDrawer ? 'drawer-' : '') + l.elId)}"` : ''}${l.page ? ` data-page="${escapeAttr(l.page)}"` : ''}${l.hidden ? ' hidden' : ''}${l.external ? ' target="_blank" rel="noopener"' : ''}`;
        const kids = Array.isArray(l.children) ? l.children.filter(Boolean) : [];
        const inner = `${l.icon ? `<span class="icon">${navIcon(l.icon)}</span>` : ''}<span class="ovnav-l">${escapeAttr(l.label)}</span>${l.dot !== undefined ? `<span class="ovnav-dot"${l.dotId && !inDrawer ? ` id="${escapeAttr(l.dotId)}"` : ''}${l.dot ? '' : ' hidden'}></span>` : ''}`;
        const a = `<a href="${escapeAttr(l.href || '#')}" class="ovnav-link${l.active ? ' active' : ''}${l.featured ? ' ovnav-link--featured' : ''}"${attrs}>${inner}${kids.length && !inDrawer ? '<span class="ovnav-caret" aria-hidden="true">▾</span>' : ''}</a>`;
        if (!kids.length) return a;
        const menu = kids.map(k => `<a href="${escapeAttr(k.href || '#')}" class="ovnav-link ovnav-sublink"${k.id ? ` data-link-id="${escapeAttr(k.id)}"` : ''}${k.hidden ? ' hidden' : ''}>${k.icon ? `<span class="icon">${navIcon(k.icon)}</span>` : ''}<span class="ovnav-l">${escapeAttr(k.label)}</span></a>`).join('');
        return inDrawer ? a + menu : `<div class="ovnav-dd"${l.hidden ? ' hidden' : ''}>${a}<div class="ovnav-dd-menu">${menu}</div></div>`;
    }
    /** 4.119.0: a featured link with an icon keeps a button on the phone's bar. */
    function featuredPhoneHTML(links) {
        const f = (links || []).find(l => l && l.featured && !l.hidden && l.icon);
        if (!f) return '';
        return `<a class="ovnav-featured-phone${f.active ? ' active' : ''}" href="${escapeAttr(f.href || '#')}" aria-label="${escapeAttr(f.label)}" title="${escapeAttr(f.label)}"${f.active ? ' aria-current="page"' : ''}>${navIcon(f.icon)}</a>`;
    }
    const flatLinks = (list) => list.reduce((out, l) => out.concat([l], Array.isArray(l.children) ? l.children : []), []);

    /** The drawer's order: a featured link leads the menu (the phone's first entry), the rest keep theirs. */
    function drawerOrder(list) {
        const items = (list || []).filter(Boolean);
        return items.filter(l => l.featured && !l.hidden).concat(items.filter(l => !(l.featured && !l.hidden)));
    }

    function currentLinks() {
        const list = _runtimeLinks || _config.links || linksFor(_config.service);
        const path = (typeof location !== 'undefined' && location.pathname) || '/';
        const activePage = _activePage;
        return list.map((l) => Object.assign({}, l, { active: l.active !== undefined ? l.active : (activePage ? l.page === activePage : (l.href === path && path !== '/')) }));
    }

    let _activePage = null;   // setActive(): single-page apps tell the navbar where they are
    const SERVICE_LINKS = {
        live: [
            { label: 'Watch', href: '/' },
            { label: 'Chat', href: '/chat' },
            { label: 'VODs', href: '/vods' },
            { label: 'Game', href: '/game' },
        ],
        tools: [
            { label: 'Home', href: '/' },
        ],
        games: [
            { label: 'Play', href: '/game' },
            { label: 'Canvas', href: '/canvas' },
            { label: 'Leaderboard', href: '/leaderboard' },
        ],
        media: [
            { label: 'Home', href: '/' },
            { label: 'Network', href: 'https://openvibe.network' },
            { label: 'Live', href: 'https://openvibe.live' },
            { label: 'Tools', href: 'https://openvibe.tools' },
        ],
        network: [
            { label: 'Home', href: '/' },
            { label: 'My Account', href: '/my' },
            { label: 'Themes', href: '/themes' },
        ],
        maps: [
            { label: 'Map', href: '/' },
            { label: 'Camps', href: '/camps' },
        ],
        food: [
            { label: 'Food Banks', href: '/' },
            { label: 'Meal Plan', href: '/#meal-plan' },
        ],
        img: [
            { label: 'Convert', href: 'https://convert.openvibe.tools' },
            { label: 'Compress', href: 'https://compress.openvibe.tools' },
            { label: 'Resize', href: 'https://resize.openvibe.tools' },
            { label: 'Crop', href: 'https://crop.openvibe.tools' },
        ],
        yt: [
            { label: 'Download', href: '/' },
        ],
        audio: [
            { label: 'Convert', href: 'https://audio.openvibe.tools' },
            { label: 'Trim', href: 'https://trim.openvibe.tools' },
            { label: 'Pitch', href: 'https://pitch.openvibe.tools' },
            { label: 'Reverb', href: 'https://reverb.openvibe.tools' },
        ],
        text: [
            { label: 'Fancy', href: 'https://fancy.openvibe.tools' },
            { label: 'Zalgo', href: 'https://zalgo.openvibe.tools' },
            { label: 'ASCII', href: 'https://ascii.openvibe.tools' },
            { label: 'Symbols', href: 'https://symbols.openvibe.tools' },
        ],
        logo: [
            { label: 'Title', href: 'https://title.openvibe.tools' },
            { label: 'Wordmark', href: 'https://wordmark.openvibe.tools' },
            { label: 'Badge', href: 'https://badge.openvibe.tools' },
            { label: 'Thumbnail', href: 'https://thumbnail.openvibe.tools' },
        ],
        docs: [
            { label: 'Merge', href: 'https://mergepdf.openvibe.tools' },
            { label: 'Split', href: 'https://splitpdf.openvibe.tools' },
            { label: 'Compress', href: 'https://compresspdf.openvibe.tools' },
            { label: 'Images→PDF', href: 'https://image2pdf.openvibe.tools' },
        ],
        net: [
            { label: 'Lookup', href: 'https://lookup.openvibe.tools' },
            { label: 'My IP', href: 'https://myip.openvibe.tools' },
            { label: 'DNS', href: 'https://dns.openvibe.tools' },
            { label: 'Ping', href: 'https://ping.openvibe.tools' },
            { label: 'SSL', href: 'https://ssl.openvibe.tools' },
        ],
        dev: [
            { label: 'JSON', href: 'https://json.openvibe.tools' },
            { label: 'Base64', href: 'https://base64.openvibe.tools' },
            { label: 'JWT', href: 'https://jwt.openvibe.tools' },
            { label: 'Regex', href: 'https://regex.openvibe.tools' },
            { label: 'Diff', href: 'https://diff.openvibe.tools' },
        ],
    };

    // The server shell calls this same table so its HTML matches the browser defaults.
    function linksFor(service) {
        return (SERVICE_LINKS[service] || []).map(link => ({ ...link }));
    }

    // Accounts seen here (no tokens).
    const SEEN_KEY = 'openvibe_seen_accounts';
    function readList(key) { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
    function getAccounts() {
        const ids = new Set();
        return readList('openvibe_accounts').concat(readList(SEEN_KEY)).filter((a) => {
            if (!a || a.id == null || ids.has(String(a.id))) return false;
            ids.add(String(a.id));
            return true;
        });
    }
    function rememberAccount(u) {
        if (!u || u.is_anon || u.id == null || !u.username) return;
        try {
            const seen = readList(SEEN_KEY).filter((a) => a && String(a.id) !== String(u.id));
            seen.unshift({ id: u.id, username: u.username, display_name: u.display_name || u.username, avatar_url: u.avatar_url || null });
            localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(0, 10)));
        } catch { /* storage unavailable */ }
    }
    function signInBack() {
        if (onNetworkDomain()) return window.location.href;
        try { return new URL(resolveLoginHref(currentHost(), window.location.href), window.location.href).toString(); }
        catch { return window.location.href; }
    }
    function switchHref(account) {
        const q = new URLSearchParams({ switch_to: String(account.id), return: signInBack() });
        if (account.username) q.set('login_hint', String(account.username));
        return `${_config.apiBase}/login?${q.toString()}`;
    }
    function addAccountHref() {
        return `${_config.apiBase}/login?${new URLSearchParams({ add_account: '1', return: signInBack() }).toString()}`;
    }

    // ─── SSO auth resolution ───────────────────────────────────
    // ov_token is host-only on openvibe.network and Domain=.openvibe.tools on the tools (CONTRACTS.md). The tools'
    // apex owns the OAuth client (/auth/*); its subdomains only read the cookie, so sign-in/out goes through the apex.
    // Order: the cookie, localStorage, the page's token, then config.sessionUrl.
    const TOOLS_APEX = 'openvibe.tools';
    const TOKEN_KEY = 'ov_token';

    function currentHost() {
        return (typeof location !== 'undefined' && location.hostname) || '';
    }

    function onToolsDomain(host) {
        const h = host !== undefined ? host : currentHost();
        return h === TOOLS_APEX || h.endsWith('.' + TOOLS_APEX);
    }

    function onNetworkDomain(host) {
        const h = host !== undefined ? host : currentHost();
        try { return h !== '' && h === new URL(_config.apiBase).hostname; } catch { return false; }
    }

    function parseCookieToken(cookieStr) {
        const m = String(cookieStr || '').match(/(?:^|;\s*)ov_token=([^;]*)/);
        if (!m || !m[1]) return null;
        try { return decodeURIComponent(m[1]); } catch { return m[1]; }
    }

    function getCookieToken() {
        if (typeof document === 'undefined') return null;
        return parseCookieToken(document.cookie);
    }

    function getStoredToken() {
        try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
    }

    function resolveToken() {
        return getCookieToken() || getStoredToken() || _config.token || null;
    }

    /** Where "Sign In" goes on this host. */
    function resolveLoginHref(host, returnUrl) {
        if (_config.loginUrl) return fillUrl(_config.loginUrl, returnUrl);
        if (onToolsDomain(host)) {
            // *.openvibe.tools signs in through the gateway apex (its OAuth state; ov_token on Domain=.openvibe.tools).
            return `https://${TOOLS_APEX}/auth/login?next=${encodeURIComponent(returnUrl)}`;
        }
        if (onNetworkDomain(host)) return `/login?return=${encodeURIComponent(returnUrl)}`;
        return `${_config.apiBase}/login?return=${encodeURIComponent(returnUrl)}`;
    }

    function setAuthCookie(token) {
        if (typeof document === 'undefined') return;
        const maxAge = 24 * 60 * 60; // matches the 24h access JWT
        if (onToolsDomain()) {
            document.cookie = `ov_token=${token};path=/;max-age=${maxAge};domain=.${TOOLS_APEX};SameSite=Lax;Secure`;
        } else {
            const secure = (typeof location !== 'undefined' && location.protocol === 'https:') ? ';Secure' : '';
            document.cookie = `ov_token=${token};path=/;max-age=${maxAge};SameSite=Lax${secure}`;
        }
    }

    function clearAuthState() {
        if (typeof document !== 'undefined') {
            document.cookie = 'ov_token=;path=/;max-age=0;SameSite=Lax';
            if (onToolsDomain()) {
                document.cookie = `ov_token=;path=/;max-age=0;domain=.${TOOLS_APEX};SameSite=Lax`;
            }
        }
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('openvibe_anon_token');
            localStorage.removeItem('openvibe_active_account');
        } catch { /* storage unavailable */ }
    }

    function persistToken(token) {
        try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
        setAuthCookie(token);
    }

    /** GET {apiBase}/api/auth/me with the Bearer token. */
    async function fetchMe(token) {
        try {
            const res = await fetch(`${_config.apiBase}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                return { ok: true, user: (data && (data.user || data)) || null };
            }
            return { ok: false, unauthorized: res.status === 401 || res.status === 403 };
        } catch {
            return { ok: false, unauthorized: false };
        }
    }

    /** loginUrl/logoutUrl templates: {url} = the full return URL, {path} = its path + query (for sites that only accept local next=). */
    function fillUrl(template, returnUrl) {
        const full = returnUrl || (typeof location !== 'undefined' ? location.href : '/');
        let path = '/';
        try { const u = new URL(full, typeof location !== 'undefined' ? location.href : 'https://openvibe.network/'); path = u.pathname + u.search; } catch { /* */ }
        return String(template).replace('{url}', encodeURIComponent(full)).replace('{path}', encodeURIComponent(path));
    }

    /** Same-origin session refresh — mounted by the tools gateway (POST /auth/refresh). */
    async function gatewayRefresh() {
        try {
            const res = await fetch('/auth/refresh', { method: 'POST', credentials: 'same-origin' });
            if (!res.ok) return null;
            const data = await res.json();
            return data && data.token ? data : null;
        } catch { return null; }
    }

    /** Network-side refresh — accepts tokens expired up to 7 days ago (grace). */
    async function networkRefresh(token) {
        try {
            const res = await fetch(`${_config.apiBase}/api/auth/refresh`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data && data.token ? data : null;
        } catch { return null; }
    }

    /**
     * Resolve the signed-in user from the shared SSO state.
     * With a token: validate it against the Network. If it is rejected, make
     * ONE refresh attempt (same-origin gateway refresh first on tools hosts,
     * then the Network's grace refresh) before giving up — never leave a
     * stale "Sign In" when a recoverable session exists.
     */
    async function resolveSessionUser() {
        const token = resolveToken();
        if (token) {
            const me = await fetchMe(token);
            if (me.ok && me.user) return { user: me.user, token };
            if (me.unauthorized) {
                if (onToolsDomain()) {
                    const r = await gatewayRefresh();
                    if (r) {
                        const user = r.user || (await fetchMe(r.token)).user;
                        if (user) { persistToken(r.token); return { user, token: r.token }; }
                    }
                }
                const n = await networkRefresh(token);
                if (n) {
                    const user = n.user || (await fetchMe(n.token)).user;
                    if (user) { persistToken(n.token); return { user, token: n.token }; }
                }
                // A stored token nobody accepts any more: drop it, so it cannot keep hiding a
                // good session (the site's own below, or the next sign-in).
                try { if (localStorage.getItem('ov_token') === token) localStorage.removeItem('ov_token'); } catch { /* */ }
            }
            if (!_config.sessionUrl) return null;
        }
        // No usable token — ask the page's own session endpoint if it has one (a site with a
        // server-side session, such as openvibe.blog, knows who is signed in even when this
        // browser's stored token is stale or was never shared with the page).
        if (_config.sessionUrl) {
            try {
                const res = await fetch(_config.sessionUrl, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    const user = (data && (data.user || data)) || null;
                    if (user && (user.username || user.id)) {
                        let token = data && data.token || null;
                        // Sites with HTTP-only access cookies expose a verified access token through a
                        // same-origin, no-store endpoint for the Dock and the notification bell.
                        if (!token && _config.tokenUrl) {
                            try {
                                const tokenRes = await fetch(_config.tokenUrl, { credentials: 'same-origin', cache: 'no-store' });
                                if (tokenRes.ok) token = (await tokenRes.json()).token || null;
                            } catch { /* the account menu still works without the Dock */ }
                        }
                        return { user, token };
                    }
                }
            } catch { /* signed out */ }
        }
        return null;
    }

    let _authInFlight = null;

    function ssoHint() {
        const m = (typeof document !== 'undefined' ? document.cookie : '').match(/(?:^|;\s*)ov_sso_hint=([^;]*)/);
        if (m) return m[1];
        try { return localStorage.getItem('ov_sso_hint'); } catch { return null; }
    }

    /** One silent sign-in per tab, only after an earlier sign-in here (never after 'guest', never for bots): silent=1. */
    let _ssoClientLoading = null;
    function loadSsoClient() {
        if (root.OpenVibeSSO) return Promise.resolve(root.OpenVibeSSO);
        if (_ssoClientLoading) return _ssoClientLoading;
        _ssoClientLoading = new Promise((resolve) => {
            const sc = document.createElement('script'); sc.async = true; sc.src = siblingV('sso-client.js');
            sc.onload = () => resolve(root.OpenVibeSSO || null); sc.onerror = () => resolve(null);
            document.head.appendChild(sc);
        });
        return _ssoClientLoading;
    }

    /** Signed in here: cross-site links carry the session along (see sso-client.js). */
    function enableHandoff() {
        loadSsoClient().then((sso) => { try { sso && sso.handoffLinks({ signedIn: !!_config.user && !_config.user.is_anon }); } catch { /* */ } });
    }

    function silentLoginNow() {
        const url = String(_config.silentLogin).replace('{url}', encodeURIComponent(location.href));
        location.replace(url);
        return true;
    }

    /**
     * Use a top-level prompt=none round trip so Network's session is first-party even when
     * third-party cookies are blocked. An iframe's negative answer cannot distinguish a guest
     * from a signed-in person in those browsers, and first-use FedCM needs interaction.
     * At most once per tab per 10 minutes; never after a sign-out ('guest'); never for bots.
     * The SDK returns guests with sso=none instead of showing an interactive login page.
     */
    function maybeSilentLogin() {
        if (!_config.silentLogin || typeof location === 'undefined') return false;
        if (ssoHint() === 'guest') return false;
        if (/bot|crawl|spider|slurp|headless/i.test(navigator.userAgent || '')) return false;
        if (/[?&]sso=none\b/.test(location.search)) return false;
        try {
            const last = +sessionStorage.getItem('ov_silent_sso_at') || 0;
            if (Date.now() - last < 10 * 60 * 1000) return false;
            sessionStorage.setItem('ov_silent_sso_at', String(Date.now()));
        } catch { return false; }
        // The top-level round trip sees Network's session even where third-party cookies are blocked (phones), but it
        // costs a redirect. Take it when there is a reason to think this person has one: this site signed them in
        // before ('account'), or they came here from another OpenVibe site (the owner, 11-08: signed in to the network,
        // opened openvibe.link from the menu, saw Sign In). A first visit from a search engine keeps the quiet iframe
        // check and FedCM instead, and Sign in is one tap.
        if (ssoHint() === 'account' || fromOpenVibe()) return silentLoginNow();
        checkNetworkSession().then((state) => {
            if (state && state.signedIn) return silentLoginNow();
            if (_config.fedcm === false) return;
            loadSsoClient().then(async (sso) => {
                if (!sso || !sso.fedcmAvailable()) return;
                const r = await sso.fedcm({ apiBase: _config.apiBase, fedcmLogin: _config.fedcmLogin || undefined, mediation: _config.fedcm === 'silent' ? 'silent' : 'optional' });
                if (r && r.ok) { try { sessionStorage.removeItem('ov_silent_sso_at'); } catch { /* */ } location.reload(); }
            });
        });
        return false;
    }
    /** This page was opened from another OpenVibe site (its referrer's host is first-party, and not this one). */
    function fromOpenVibe() {
        try {
            const r = new URL(document.referrer);
            return r.protocol === 'https:' && r.hostname !== location.hostname && /(^|\.)(openvibe\.[a-z]+|open\.shoes|openre\.stream)$/.test(r.hostname);
        } catch { return false; }
    }

    /** Ask the network (hidden iframe + postMessage) whether this browser is signed in there. */
    function checkNetworkSession(timeoutMs = 4000) {
        return new Promise((resolve) => {
            let done = false, frame = null, timer = null;
            const finish = (v) => { if (done) return; done = true; clearTimeout(timer); window.removeEventListener('message', onMsg); try { frame?.remove(); } catch { /* */ } resolve(v); };
            const onMsg = (e) => {
                if (e.origin !== _config.apiBase || !e.data || e.data.type !== 'ov-sso') return;
                finish({ signedIn: !!e.data.signedIn, username: e.data.username || null });
            };
            try {
                window.addEventListener('message', onMsg);
                frame = document.createElement('iframe');
                frame.setAttribute('aria-hidden', 'true'); frame.setAttribute('tabindex', '-1');
                frame.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none';
                frame.src = `${_config.apiBase}/sso/check?origin=${encodeURIComponent(location.origin)}`;
                (document.body || document.documentElement).appendChild(frame);
                timer = setTimeout(() => finish(null), timeoutMs);
            } catch { finish(null); }
        });
    }

    function recordHistory() {
        const h = _config.history;
        if (!h || !_config.user || _config.user.is_anon) return;
        const rec = Object.assign({ url: location.href, title: document.title, service: resolveBrand().tld }, h);
        const H = root.OpenVibeHistory;
        if (H && typeof H.record === 'function') { H.record(rec, { token: _config.token, apiBase: _config.apiBase }); return; }
        if (!document.getElementById('ov-history-loader')) {
            const sc = document.createElement('script'); sc.id = 'ov-history-loader'; sc.async = true;
            sc.src = siblingV('history.js');
            sc.onload = () => { try { root.OpenVibeHistory.record(rec, { token: _config.token, apiBase: _config.apiBase }); } catch { /* */ } };
            document.head.appendChild(sc);
        } else {
            document.getElementById('ov-history-loader').addEventListener('load', () => { try { root.OpenVibeHistory.record(rec, { token: _config.token, apiBase: _config.apiBase }); } catch { /* */ } });
        }
    }

    function refreshAuthState() {
        if (_authInFlight) return _authInFlight;
        _authInFlight = resolveSessionUser()
            .then((session) => {
                _authInFlight = null;
                if (session && session.user) {
                    _config.user = session.user;
                    if (session.token) _config.token = session.token;
                    render();
                    recordHistory();
                    enableHandoff();
                } else {
                    maybeSilentLogin();
                }
                try {
                    document.dispatchEvent(new CustomEvent('openvibe-navbar-auth', {
                        detail: { user: session ? session.user : null, token: session ? session.token : null },
                    }));
                } catch { /* non-DOM environment */ }
                return session ? session.user : null;
            })
            .catch(() => { _authInFlight = null; return null; });
        return _authInFlight;
    }

    function escapeAttr(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }
    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getAvatarInitial(user) {
        const source = user?.display_name || user?.username || 'O';
        return String(source).trim().charAt(0).toUpperCase() || 'O';
    }

    function makeAvatarPlaceholder(user, size = 64) {
        const initial = getAvatarInitial(user);
        const bg = user?.profile_color || '#3b82f6';
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <rect width="100%" height="100%" rx="${Math.round(size / 2)}" fill="${bg}"/>
                <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${Math.round(size * 0.42)}" font-weight="700" fill="#ffffff">${initial}</text>
            </svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
    }

    // The account's picture now (the Network's /avatar/<username>): a record can predate its picture (CHANGELOG 4.12.0).
    function currentAvatarUrl(user, size) {
        if (!user || user.is_anon || user.id === 'anon' || !user.username) return null;
        const network = /(^|\.)openvibe\.network$/.test(currentHost()) ? '' : 'https://openvibe.network';
        return `${network}/avatar/${encodeURIComponent(user.username)}?s=${size}`;
    }

    function avatarSrc(user, size = 64) {
        const url = user?.avatar_url;
        if (/^https:\/\/openvibe\.media\/o\/med_\w+$/.test(url || '')) return `${url}?w=${size}&fmt=webp`;
        if (/^https:\/\/openvibe\.media\//.test(url || '')) return url;
        return currentAvatarUrl(user, size) || makeAvatarPlaceholder(user, size);
    }

    function avatarImg(user, size = 64, className = 'openvibe-navbar-avatar', id = '') {
        const fallback = makeAvatarPlaceholder(user, size);
        const src = avatarSrc(user, size);
        const current = currentAvatarUrl(user, size);
        const retry = current && current !== src ? ` data-retry-src="${escapeAttr(current)}"` : '';
        const idAttr = id ? ` id="${escapeAttr(id)}"` : '';
        const alt = escapeAttr(user?.display_name || user?.username || 'Avatar');
        return `<img class="${escapeAttr(className)}" src="${escapeAttr(src)}"${retry} data-fallback-src="${escapeAttr(fallback)}" alt="${alt}"${idAttr} width="${escapeAttr(size)}" height="${escapeAttr(size)}" decoding="async">`;
    }

    // A picture that does not load: the current one once (data-retry-src), then the initial.
    function attachAvatarFallbacks(rootEl) {
        rootEl?.querySelectorAll('img[data-fallback-src]').forEach((img) => {
            const onError = () => {
                const retry = img.dataset.retrySrc;
                if (retry) { delete img.dataset.retrySrc; img.src = retry; return; }
                img.removeEventListener('error', onError);
                const fallback = img.dataset.fallbackSrc;
                if (fallback && img.src !== fallback) img.src = fallback;
            };
            img.addEventListener('error', onError);
            if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) onError();
        });
    }

    /**
     * wallet: true — OpenCoins and Vibes as chips in the bar on any site (owner, 2026-10-27). A site's own chips with
     * those ids (Live) win. The last balances are kept per person so the chips paint at once; they refresh from the
     * Network and Billing in the background and when the tab returns after a minute; on a phone they fold into one.
     */
    const WALLET_CHIPS = [
        { id: 'coins', icon: 'fa-coins', tone: 'gold', label: 'OpenCoins', title: 'Open Wallet' },
        { id: 'vibes', icon: 'fa-wallet', tone: 'green', label: 'Vibes', title: 'Open Wallet' },
        { id: 'balance', icon: 'fa-wallet', label: 'Balance', title: 'Open Wallet' },
    ];
    let _walletFor = null, _walletAt = 0, _walletWatch = false, _walletData = null, _walletScript = null;
    const walletKey = (u) => `${u.subject || u.id || u.username || ''}:${_config.token || ''}`;
    function walletAmount(b) {
        const n = Number(b.amount) / Math.pow(10, b.scale || 0);
        return b.currency === 'USD' ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n) : n.toLocaleString();
    }
    function walletOrder(data) {
        const order = ['coins', 'vibes', 'balance'];
        if (!data) return order.slice(0, 1);
        const value = (id) => Number(data.balances[id].amount) / Math.pow(10, data.balances[id].scale) / (id === 'vibes' ? data.bits_per_usd || 100 : 1);
        const have = order.filter((id) => value(id) > 0).sort((a, b) => value(b) - value(a));
        if (data.used_ai_this_month && BigInt(data.balances.balance.amount) === 0n) have.unshift('balance');
        return have.length ? have : order.slice(0, 1);
    }
    function syncWalletChips() {
        if (!_config.wallet) return;
        const u = _config.user;
        let chips = (_config.chips || []).filter((c) => !(c && (c.__wallet || ['coins', 'vibes', 'balance'].includes(c.id))));
        // false: unreadable, nothing kept: no chips, never a "…" that stays.
        const data = u && !u.is_anon && _walletFor === walletKey(u) ? _walletData : null;
        if (u && !u.is_anon && data !== false) {
            chips = walletOrder(data).map((id) => Object.assign({}, WALLET_CHIPS.find((w) => w.id === id), {
                __wallet: true, value: data ? walletAmount(data.balances[id]) : '…', hidden: false, onClick: openWallet,
            })).concat(chips);
        }
        _config.chips = chips;
    }
    async function openWallet() {
        if (!_config.user || _config.user.is_anon) return;
        if (!root.OpenVibeWallet) {
            if (!_walletScript) _walletScript = new Promise((resolve, reject) => {
                const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = siblingV('ov-wallet.css'); document.head.appendChild(css);
                const js = document.createElement('script'); js.src = siblingV('ov-wallet.js'); js.onload = resolve;
                js.onerror = () => { _walletScript = null; css.remove(); js.remove(); reject(new Error('Wallet could not load')); }; document.head.appendChild(js);
            });
            try { await _walletScript; } catch { if (_walletScript === null) root.location.assign('https://openvibe.network/wallet'); return; }
        }
        return root.OpenVibeWallet.open({ getToken: () => _config.token || null, cookieSession: !_config.token, frameBase: _config.frameBase || 'https://openvibe.network/api/frame',
            onWallet: (data) => { if (!_config.user) return; _walletFor = walletKey(_config.user); _walletData = data; _walletAt = Date.now(); if (_navEl) render(); } });
    }
    function loadWalletChips() {
        const u = _config.user;
        if (!_config.wallet || !u || u.is_anon || typeof fetch !== 'function') return;
        const key = walletKey(u), token = _config.token || null;
        if (_walletFor === key && Date.now() - _walletAt < 60000) return;
        if (_walletFor !== key) _walletData = null;
        _walletFor = key; _walletAt = Date.now();
        if (!_walletWatch && typeof document !== 'undefined' && document.addEventListener) {
            _walletWatch = true;
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { loadWalletChips(); loadUnread(); } });
        }
        // No token (httpOnlyAccess sites): the Network cookie reads it. Unreadable with nothing kept hides the chips.
        const same = () => _config.user === u && (_config.token || null) === token;
        const failed = () => { if (!same() || _walletData) return; _walletData = false; if (_navEl) render(); };
        fetch(`${(_config.frameBase || 'https://openvibe.network/api/frame').replace(/\/+$/, '')}/wallet/api/v1/me/wallet`,
            token ? { headers: { Authorization: `Bearer ${token}` }, credentials: 'omit' } : { credentials: 'include' })
            .then(async (r) => { if (!r.ok) return failed(); const data = await r.json(); if (!same()) return;
                _walletData = data; if (_navEl) render(); }).catch(failed);
    }

    function render() {
        syncWalletChips();
        // A site may put state classes on the bar (Live's transparent hero mode). A re-render must not lose them.
        let carried = []; try { carried = Array.from((_navEl && _navEl.classList) || []).filter(c => c !== 'openvibe-navbar'); } catch { carried = []; }
        if (_navEl) _navEl.remove();
        if (_renderAbort) { _renderAbort.abort(); _panelQueue.length = 0; }
        _renderAbort = typeof AbortController === 'function' ? new AbortController() : null;

        const nav = document.createElement('nav');
        nav.className = 'openvibe-navbar';
        carried.forEach(c => { try { nav.classList.add(c); } catch { /* */ } });
        const svc = _config.service;

        const brand = resolveBrand();
        if (typeof nav.setAttribute === 'function') { nav.setAttribute('data-compact', _config.compact || 'auto'); nav.setAttribute('data-service', svc); }
        const links = currentLinks();

        const u = _config.user;
        rememberAccount(u);
        const accounts = getAccounts();
        const isAnon = u && u.is_anon;
        const loginHref = resolveLoginHref(currentHost(), window.location.href);
        const switcher = !!root.OpenVibeAccountSwitcher;   // in place on openvibe.network

        // The OV brand mark is a drop-in (mounts every .ov-mark); never a second copy of a page's own tag.
        if (!window.__ovMark && !document.getElementById('ov-mark-loader') && !(document.querySelector && document.querySelector('script[src*="/ov-mark.js"]'))) {
            try { const sc = document.createElement('script'); sc.id = 'ov-mark-loader'; sc.src = siblingV('ov-mark.js'); sc.async = true; document.head.appendChild(sc); } catch { /* */ }
        }
        // The network's own icons in place of Font Awesome's (ov-glyphs.js, L32) on a page that uses Font Awesome: now,
        // or the first time the page's own script adds one (L54 K4: a page with no icon at first pays nothing).
        if (_config.glyphs !== false) watchGlyphs(); watchLabels(); watchScrollers(); if (_config.forms !== false) watchForms();
        if (!root.__ovShareClick) { root.__ovShareClick = true; document.addEventListener('click', shareClick); }
        watchOverlays(); warmLinks();
        nav.innerHTML = `
            ${brandHTML(brand)}
            <div class="openvibe-navbar-links">
                ${links.filter(l => !l.more).map(l => linkHTML(l, false)).join('')}${links.some(l => l.more && !l.hidden) ? linkHTML({ id: 'ovnav-more', label: 'More', href: '#', children: links.filter(l => l.more) }, false) : ''}
                ${networkLinksHTML(links)}
                ${u && u.role === 'admin' && _config.adminLink !== false && !flatLinks(links).some(l => l.id === 'admin') ? `<a href="https://openvibe.network/admin">${navIcon('fa-shield-halved')} Admin</a>` : ''}
            </div>
            <div class="openvibe-navbar-spacer"></div>
            <div class="openvibe-navbar-right">
                ${u ? chipsHTML(_config.chips) + chipsAllHTML(_config.chips) : ''}
                ${featuredPhoneHTML(links)}
                ${links.length ? `<button type="button" class="ovnav-burger ovnav-orb" id="openvibe-burger" aria-label="Menu: this site, search and every OpenVibe site" data-ov-tip="Menu" data-ov-tip-sub="This site, search, every OpenVibe site" aria-haspopup="dialog" aria-expanded="false">${orbSVG()}</button>` : ''}
                ${u ? `<span class="ovnav-avatar-wrap">${avatarImg(u, 64, 'openvibe-navbar-avatar', 'openvibe-avatar-btn')}<b class="ovnav-avatar-count" hidden></b></span>` :
                    `<a class="openvibe-navbar-login" id="openvibe-login-btn" href="${escapeAttr(loginHref)}" aria-label="Sign in" data-ov-tip="Sign in"><svg class="ovsi" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle class="ovsi-o" cx="12" cy="12" r="11"/><g class="ovsi-p"><circle cx="12" cy="8.8" r="3.2"/><path d="M5.900 18.400c1.100-2.700 3.300-4.100 6.100-4.100s5 1.400 6.100 4.100"/></g><path class="ovsi-a" d="M5.500 12h8.500M11 8.500l3.500 3.500-3.500 3.500M15.500 6.500h2.500v11h-2.500"/></svg></a>`}
            </div>
            ${links.length ? `<div class="ovnav-drawer" id="openvibe-drawer" role="menu">${drawerOrder(links).map(l => linkHTML(l, true)).join('')}<div class="ovnav-drawer-net">${networkLinksHTML(links, true)}</div>${u ? '' : '<div class="ovnav-display" hidden></div>'}</div>` : ''}
        `;
        if (_config.className) String(_config.className).split(/\s+/).filter(Boolean).forEach(c => nav.classList.add(c));
        bindLinks(nav, links);
        hookSearch(nav);
        hookSwitcher(nav); hookPages(nav); hookSignIn(nav); hookFit(nav);
        // The tooltip's file is fetched when a pointer first comes over the bar, not with the page.
        tipWait();
        bindChips(nav);
        bindChipsAll(nav);
        queueIcons();
        queueFx();
        countView();
        // Pages that wire the bell themselves run right after init(); give them the first go.
        setTimeout(() => { mountNotifications(nav, u); mountDock(u); mountPresence(u); }, 0);

        // Dropdown
        if (u) {
            const dropdown = document.createElement('div');
            dropdown.className = 'openvibe-navbar-dropdown';
            dropdown.id = 'openvibe-user-dropdown';

            const otherAccounts = accounts.filter(a => isAnon ? !a.is_anon : String(a.id) !== String(u.id));
            // The avatar and name lead to the person's profile (an anonymous visitor's account page): people press them.
            const meHref = !isAnon && u.username ? `https://openvibe.network/@${encodeURIComponent(u.username)}` : 'https://openvibe.network/my';
            const menuCfg = _config.menu || {};
            const before = ((_config.menu && _config.menu.before) || []).concat(_runtimeMenu.before);
            const after = ((_config.menu && _config.menu.after) || []).concat(_runtimeMenu.after);
            // The bar shows the balances (a site's chips, or wallet: true): the menu does not repeat them.
            const barWallet = !!_config.wallet || (Array.isArray(_config.chips) && _config.chips.some(c => c && (c.id === 'coins' || c.id === 'vibes')));
            const admin = u.role === 'admin' || !!(u.capabilities && (u.capabilities.is_owner || u.capabilities.admin_panel));

            const bell = _config.notifications !== false && !!_config.token && !isAnon;
            const places = before.concat(after).filter((it) => it && !it.sep).concat(menuCfg.defaults === false ? [] : [
                !isAnon && u.username ? { id: 'ov-channel', label: 'My channel', short: 'Channel', drawn: navIcon('fa-tower-broadcast'), href: `https://openvibe.live/@${encodeURIComponent(u.username)}` } : null,
                { id: 'ov-history', label: 'History', drawn: navIcon('fa-clock-rotate-left'), href: 'https://openvibe.network/my#history' },
                bell ? null : { id: 'ov-notifications', label: 'Notifications', short: 'Alerts', drawn: navIcon('fa-bell'), href: 'https://openvibe.network/my#notifications' },
                !isAnon ? { id: 'ov-ask', label: 'Ask Vibe', drawn: navIcon('fa-brain'), href: 'https://openvibe.chat/vibe', mark: 'data-ov-ask' } : null,
                !isAnon ? { id: 'ov-work', label: 'Work together', short: 'Work', drawn: navIcon('fa-people-group'), href: 'https://openvibe.chat/work', mark: 'data-ov-work' } : null,
                bell && _config.dock !== false ? { id: 'ov-dock', label: 'The Dock: your agents and activity on every page', short: 'Dock', drawn: DOCK_GLYPH, mark: 'data-ov-dock' } : null,
                admin ? { id: 'ov-admin', label: 'Admin', drawn: navIcon('fa-shield-halved'), href: 'https://openvibe.network/admin' } : null,
                !isAnon ? { id: 'ov-wallet', label: 'Wallet', drawn: navIcon('fa-wallet'), href: 'https://openvibe.network/my#wallet' } : null,
                !isAnon && u.username ? { id: 'ov-profile', label: 'Profile', drawn: navIcon('fa-id-card'), href: `https://openvibe.network/@${encodeURIComponent(u.username)}` } : null,
            ].filter(Boolean));
            _own = places.filter((p) => !/^ov-(hi|no|as|wo|do|wa|pr)/.test(p.id || ''));
            const ranked = byUse(places), grid = ranked.slice(0, 8), more = ranked.slice(8);
            const others = otherAccounts.filter(a => switcher || !a.is_anon);
            const iconBtn = (cls, drawn, label, extra) => `<button type="button" class="ud-ib${cls}" title="${label}" aria-label="${label}"${extra || ''}><span class="icon">${drawn}</span></button>`;

            dropdown.innerHTML = `
                <div class="openvibe-navbar-dropdown-header">
                    <a class="ud-me" href="${escapeAttr(meHref)}" tabindex="-1" aria-hidden="true">${avatarImg(u, 72, '', '')}</a>
                    <div class="info">
                        <a class="name ud-me" href="${escapeAttr(meHref)}" title="${isAnon ? 'Your account' : 'Your profile'}">${escapeHtml(u.display_name || u.username)}</a>
                        <div class="email">${isAnon ? `Anonymous #${u.anon_number || '?'}` : '@' + escapeHtml(u.username || '')}</div>
                        ${barWallet ? '' : menuCfg.headerChips ? `<div class="ud-chips">${chipsHTML(menuCfg.headerChips, 'ovnav-chip ovnav-chip--menu')}</div>` : '<div class="ud-wallet" id="openvibe-wallet" hidden></div><div class="ud-wallet ud-vibes" id="openvibe-vibes" hidden></div>'}
                    </div>
                    <div class="ud-hacts">
                        ${_config.accounts === false ? '' : `<a class="ud-hbtn add-account" id="openvibe-add-account" href="${escapeAttr(addAccountHref())}" title="Add another account" aria-label="Add another account"><span class="icon">${navIcon('fa-plus')}</span></a>`}
                        <a class="ud-hbtn" href="https://openvibe.network/my" title="Account &amp; settings" aria-label="Account &amp; settings"><span class="icon">${navIcon('fa-gear')}</span></a>
                        <button id="openvibe-logout-btn" type="button" class="ud-hbtn ud-out" title="Sign out" aria-label="Sign out"><span class="icon">${navIcon('fa-right-from-bracket')}</span></button>
                    </div>
                </div>
                ${_config.accounts === false || (!others.length && !switcher) ? '' : `<div class="openvibe-navbar-dropdown-accounts" role="group" aria-label="Switch account">
                    ${others.map(a => { const t = switcher ? 'div' : 'a'; return `<${t} class="account-item" ${switcher ? `data-account-id="${escapeAttr(String(a.id))}" role="button" tabindex="0"` : `href="${escapeAttr(switchHref(a))}"`} title="Switch to ${escapeAttr(a.display_name || a.username || '')}">${avatarImg(a, 48, '', '')}<span>${escapeHtml(a.display_name || a.username || '')}${a.is_anon ? ' (anon)' : ''}</span></${t}>`; }).join('')}
                    ${switcher && !isAnon ? `<div class="account-item ud-anon" data-account-id="anon" role="button" tabindex="0" title="Browse without your name"><span class="icon">${navIcon('fa-user-secret')}</span><span>Anonymous</span></div>` : ''}
                </div>`}
                <div class="openvibe-navbar-dropdown-menu">
                    ${grid.length ? `<div class="ud-grid">${grid.map(tileHTML).join('')}</div>` : ''}
                    ${more.length ? `<details class="ud-more"><summary><span class="icon">${navIcon('fa-chevron-down')}</span> More <span class="ud-n">${more.length}</span></summary>${more.map(menuItemHTML).join('')}</details>` : ''}
                    ${sectionsHTML(menuCfg.sections)}
                    <div class="ud-foot">
                        <div class="ud-scheme" role="group" aria-label="Light or dark" hidden>${iconBtn('', navIcon('fa-sun'), 'Light', ' data-ov-scheme="light" aria-pressed="false"')}${iconBtn('', navIcon('fa-moon'), 'Dark', ' data-ov-scheme="dark" aria-pressed="false"')}${iconBtn('', navIcon('fa-circle-half-stroke'), 'Auto: follow this device', ' data-ov-scheme="auto" aria-pressed="false"')}</div>
                        <a class="ud-ib ud-disp" href="https://openvibe.design/look" data-ov-look-open aria-expanded="false" title="Theme, text size, motion and icons" aria-label="Display settings"><span class="icon">${navIcon('fa-palette')}</span><span>Display</span></a>
                    </div>
                    <div class="ud-look" hidden></div>
                </div>
            `;
            dropdown.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('[data-use]'); if (t) countUse(t.getAttribute('data-use')); });
            // 4.188.0: not a popup under the picture. It rests in the bar, out of sight (so a site that looks for its
            // sign-out button or its own item still finds it), and the menu's You tab hosts it while the menu is open
            // (openSearch's account(); onClose brings it back).
            dropdown.classList.add('ovnav-account');
            nav.appendChild(dropdown);
            _accountEl = dropdown;
            bindMenuItems(dropdown, before.concat(after, sectionItems(menuCfg.sections)));
            dropdown.addEventListener('click', (e) => { if (!e.target.closest || !e.target.closest('[data-ov-dock]')) return; dropdown.classList.remove('open'); openDock(); });
            bindChips(dropdown);
            if (typeof _config.onNavigate === 'function') dropdown.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented || a.target === '_blank' || e.metaKey || e.ctrlKey) return; const path = sitePath(a); if (path != null) { if (_config.onNavigate(path, e) === false) e.preventDefault(); dropdown.classList.remove('open'); } });
            bindDisplayRows(dropdown);
            bindLook(dropdown);

            // The picture opens the menu on You, where the account's things are (the selection for Ask Vibe is read on
            // pointerdown: the press can clear it).
            const avatarBtn = nav.querySelector('#openvibe-avatar-btn'); let sel = null;
            avatarBtn.addEventListener('pointerdown', () => { sel = selectedText(); });
            avatarBtn.addEventListener('click', () => {
                const ask = dropdown.querySelector('[data-ov-ask]'); if (ask) ask.href = askVibeHref(sel ?? selectedText()); sel = null;
                if (menuOpen() && root.OpenVibeSearch) { root.OpenVibeSearch.close(); return; }
                const active = document.querySelector('.ovs.is-open');
                if (active && active.querySelector('.ovs-starttabs [data-tab="you"][aria-selected="true"]')) root.OpenVibeSearch.close();
                else openSearch('', 'you', avatarBtn, 'notifications');
            });


            dropdown.querySelectorAll('[data-account-id]').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.accountId;
                    document.dispatchEvent(new CustomEvent('openvibe-switch-account', { detail: { accountId: id } }));
                    dropdown.classList.remove('open');
                });
            });

            dropdown.querySelector('#openvibe-logout-btn')?.addEventListener('click', () => {
                dropdown.classList.remove('open');
                if (_config.onLogout) _config.onLogout();
                else {
                    clearAuthState();
                    _config.user = null;
                    _config.token = null;
                    try { root.OpenVibeSSO && root.OpenVibeSSO.preventSilent(); } catch { /* */ }
                    try { localStorage.setItem('ov_sso_hint', 'guest'); } catch { /* */ }
                    if (_config.logoutUrl) {
                        // The site ends its own server-side session too, then sends us back.
                        window.location.href = fillUrl(_config.logoutUrl, window.location.href);
                    } else if (onToolsDomain()) {
                        // The gateway also clears the Domain=.openvibe.tools cookie
                        // and the httpOnly refresh cookie, then sends us back here.
                        window.location.href = `https://${TOOLS_APEX}/auth/logout?next=${encodeURIComponent(window.location.href)}`;
                    } else {
                        window.location.reload();
                    }
                }
            });
        } else {
            nav.querySelector('#openvibe-login-btn')?.addEventListener('click', (event) => {
                if (!_config.onLogin) return;
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                _config.onLogin();
            });
        }

        // Insert into page — use navbar-mount placeholder if available, otherwise prepend to body
        const mount = document.getElementById('navbar-mount');
        if (mount) {
            // Replace the crawlable server nav atomically; never leave duplicate landmarks.
            if (mount.replaceChildren) mount.replaceChildren(nav);
            else { while (mount.firstChild) mount.removeChild(mount.firstChild); mount.appendChild(nav); }
        } else {
            document.body.prepend(nav);
        }
        _navEl = nav;
        paintSlots();
        watchKeyboard();
        loadBottom();
        attachAvatarFallbacks(nav);
        hookTop();
        loadWalletChips();
        loadUnread();
        renderAppBar();
        return nav;
    }

    // bottom.js: the visible viewport for the bar, the small player, the Dock's pill and the composer.
    let _bottomLoading = false;
    function loadBottom() {
        if (_bottomLoading || root.OpenVibeBottom) return;
        _bottomLoading = true;
        try { const sc = document.createElement('script'); sc.id = 'ovb-loader'; sc.src = siblingV('bottom.js'); sc.async = true; document.head.appendChild(sc); } catch { _bottomLoading = false; }
    }

    // ── The phone app bar (appbar.js, loaded only when the site sets appBar): its main places as a bottom tab bar ──
    let _appBarLoading = false;
    const rawLinks = () => _runtimeLinks || _config.links || linksFor(_config.service);

    // Search (search.js, loaded on first use). _config.search: false, or { owner, label, page }.
    let _searchLoading = false;
    // Warm the menu (4.137.0): search.js by its hashed URL is cached for good, so fetching it early costs one download per
    // release. At idle after the page settles (not on Save-Data or 2G), and at once when a finger or pointer reaches the
    // burger or the orb; the first open then has nothing to wait for.
    let _menuWarm = false;
    function warmMenu() {
        if (_menuWarm || root.OpenVibeSearch || typeof document === 'undefined') return;
        _menuWarm = true;
        try { const l = document.createElement('link'); l.rel = 'prefetch'; l.as = 'script'; l.href = siblingV('search.js'); document.head.appendChild(l); } catch { /* */ }
    }
    function warmMenuLater() {
        try { const c = root.navigator && root.navigator.connection; if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return; } catch { /* */ }
        const go = () => warmMenu();
        if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(go, { timeout: 8000 }); else setTimeout(go, 6000);
    }
    /** The OpenVibe menu (search.js, loaded on first use): search, every site and every tool. tab: 'you' | 'sites' | 'tools'. */
    function openSearch(q, tab, fromEl, section) {
        // The orb that waves while the menu loads: the one pressed (the phone's menu button is an orb too, 4.148.0).
        const orb = (fromEl && fromEl.classList && fromEl.classList.contains('ovnav-orb') ? fromEl : null) || (_navEl && _navEl.querySelector('#openvibe-search-btn'));
        // The menu drops from the button that opened it (the orb, or the burger), under the bar.
        const from = fromEl || orb;
        const anchor = () => {
            if (!_navEl || !from || !from.getBoundingClientRect) return null;
            const bar = _navEl.getBoundingClientRect(), at = from.getBoundingClientRect();
            return bar.bottom > 0 && bar.bottom < 200 ? { top: bar.bottom, left: at.left - 6, cx: at.left + at.width / 2, cy: at.top + at.height / 2 } : null;
        };
        const go = () => {
            if (orb) orb.classList.remove('is-busy');
            if (!root.OpenVibeSearch) return;
            if (_navEl) _navEl.classList.remove('ovnav-hide');
            root.OpenVibeSearch.open({ service: _config.service, scope: Object.assign({ owner: _config.service }, _config.search || {}), links: flatLinks(rawLinks()), q, tab, from: fromEl || null, section,
                frame: OVFrame.get(), token: _config.token, apiBase: _config.apiBase, user: _config.user, icons: (scope) => loadOvIcons(scope), anchor: anchor(), navIcon, sibling: siblingV,
                // Display (theme, text size, motion) at the menu's foot, drawn by the same controls the drawer had.
                display: (el) => { const box = document.createElement('div'); box.className = 'ovnav-display ovs-display'; el.appendChild(box); bindDisplayControls(box); },
                look: bindLook,
                dock: _config.dock !== false && _config.user && !_config.user.is_anon && _config.token ? (t) => { if (root.OpenVibeSearch) root.OpenVibeSearch.close(); openDock(t); } : null,
                dockMore: (action) => { if (root.OpenVibeDock && root.OpenVibeDock.more) root.OpenVibeDock.more(action); },
                ask: (text) => { if (root.OpenVibeSearch) root.OpenVibeSearch.close(); loadDock(() => { root.OpenVibeDock.mount(dockOpts()); root.OpenVibeDock.ask({ text }); }); },
                me: _accountEl ? { add: _config.accounts === false ? '' : addAccountHref(), out: () => { const b = _accountEl.querySelector('#openvibe-logout-btn'); if (b) b.click(); }, own: _own } : null,
                onClose: () => { if (_accountEl && _navEl && _accountEl.parentNode !== _navEl) _navEl.appendChild(_accountEl); const b = _navEl && _navEl.querySelector('#openvibe-search-btn'); if (b) b.setAttribute('aria-expanded', 'false'); const g = _navEl && _navEl.querySelector('#openvibe-burger'); if (g) g.setAttribute('aria-expanded', 'false'); } });
            const b = fromEl || (_navEl && _navEl.querySelector('#openvibe-search-btn')); if (b) b.setAttribute('aria-expanded', 'true');
        };
        if (root.OpenVibeSearch) return go();
        if (_searchLoading) return;
        _searchLoading = true;
        if (orb) orb.classList.add('is-busy');
        try { const sc = document.createElement('script'); sc.src = siblingV('search.js'); sc.async = true; sc.onload = go; sc.onerror = () => { _searchLoading = false; if (orb) orb.classList.remove('is-busy'); }; document.head.appendChild(sc); } catch { _searchLoading = false; }
    }
    const menuOpen = () => !!(typeof document !== 'undefined' && document.querySelector && document.querySelector('.ovs.is-open'));

    // Every site: the menu on its first tab, scrolled to the sites, out of the menu button on screen.
    function openSwitcher() {
        if (menuOpen() && root.OpenVibeSearch) { root.OpenVibeSearch.close(); return; }
        const orbs = _navEl && _navEl.querySelectorAll ? [..._navEl.querySelectorAll('#openvibe-burger.ovnav-orb, #openvibe-search-btn')] : [];
        openSearch('', 'sites', orbs.find((o) => o.getBoundingClientRect && o.getBoundingClientRect().width > 0) || null);
    }
    // A signed-in person's visit moves this site to the front of their Recent, at most once in 30 minutes, and never
    // under Global Privacy Control or Do Not Track (as the page-view beacon).
    let _visitSent = false;
    function recordVisit() {
        if (_visitSent || !_config.token || !_config.service || typeof fetch === 'undefined' || typeof navigator === 'undefined') return;
        if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
        _visitSent = true;
        const key = 'ov_sw_visit_' + _config.service;
        try { if (Date.now() - Number(localStorage.getItem(key) || 0) < 30 * 60000) return; localStorage.setItem(key, String(Date.now())); } catch { /* storage off: still record */ }
        fetch('https://openvibe.network/api/themes/me/sites/visit', { method: 'POST', headers: { Authorization: `Bearer ${_config.token}`, 'Content-Type': 'application/json' }, credentials: 'include', keepalive: true, body: JSON.stringify({ site: _config.service }) }).catch(() => {});
    }
    // The site's name opens its pages (ov-drop.js); with a modifier key it is a link.
    function hookPages(nav) {
        const a = nav.querySelector('#openvibe-brand-btn');
        if (!a) return;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const go = () => root.OVDrop && root.OVDrop.pages(a, flatLinks(rawLinks()), navIcon, _config.search === false ? null : { label: 'All OpenVibe sites', onClick: openSwitcher });
            if (root.OVDrop) return go();
            if (document.getElementById('ov-drop-loader')) return;
            const sc = document.createElement('script'); sc.id = 'ov-drop-loader'; sc.src = siblingV('ov-drop.js'); sc.async = true; sc.onload = go; document.head.appendChild(sc);
        });
    }
    function hookSignIn(nav) {
        const b = nav.querySelector('#openvibe-login-btn');
        if (!b || !b.classList || typeof b.addEventListener !== 'function') return;
        b.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; b.classList.add('is-going'); setTimeout(() => b.classList.remove('is-going'), 6000); });
    }
    // Links leave from the end until the bar holds one row (they stay in the menu); the site's "More" leaves last.
    function fitLinks() {
        const nav = (this && this.nodeType === 1 ? this : null) || _navEl, box = nav && nav.querySelector && nav.querySelector('.openvibe-navbar-links');
        if (!box || !box.children || !nav.clientWidth) return;
        const kids = Array.from(box.children);
        kids.forEach((k) => k.classList.remove('ovnav-out'));
        const more = (k) => !!(k.querySelector && k.querySelector('[data-link-id="ovnav-more"]'));
        const order = kids.filter((k) => !more(k)).reverse().concat(kids.filter(more));
        for (let i = 0; i < order.length && nav.scrollWidth > nav.clientWidth + 1; i += 1) order[i].classList.add('ovnav-out');
    }
    let _fitWatch = null, _fitSeen = null;
    function hookFit(nav) {
        fitLinks.call(nav);
        if (typeof ResizeObserver !== 'function' || typeof MutationObserver !== 'function') return;
        if (_fitWatch) { _fitWatch.disconnect(); _fitSeen.disconnect(); }
        let t = 0;
        const soon = () => { clearTimeout(t); t = setTimeout(() => fitLinks.call(nav), 60); };
        _fitWatch = new ResizeObserver(soon); _fitWatch.observe(nav);
        _fitSeen = new MutationObserver((list) => { if (list.some((m) => !(m.target.closest && m.target.closest('.openvibe-navbar-links')))) soon(); });
        _fitSeen.observe(nav, { childList: true, subtree: true, characterData: true });
        if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(soon, () => {});
    }
    function hookSwitcher(nav) {
        const b = nav.querySelector('#openvibe-switch-btn, #openvibe-brand-btn');
        if (!b) return;
        if (b.id === 'openvibe-switch-btn') b.addEventListener('click', () => openSwitcher());
        for (const ev of ['pointerenter', 'touchstart', 'focus']) b.addEventListener(ev, () => { loadOvIcons(); OVFrame.get(); }, { once: true, passive: true });
        // Once the page is idle: the visit never competes with the first paint or the sign-in check.
        if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(() => recordVisit(), { timeout: 8000 });
        else setTimeout(recordVisit, 3000);
    }
    let _orbIntro = false;
    let _searchKeys = false;
    function hookSearch(nav) {
        const b = nav.querySelector('#openvibe-search-btn');
        if (b) {
            b.addEventListener('click', () => { if (menuOpen() && root.OpenVibeSearch) root.OpenVibeSearch.close(); else openSearch(); });
            for (const ev of ['pointerenter', 'touchstart', 'focus']) b.addEventListener(ev, () => { loadOvIcons(); OVFrame.get(); }, { once: true, passive: true });
            if (menuOpen()) b.setAttribute('aria-expanded', 'true');
            // One ripple a tab, a moment after the first paint: here is the menu.
            let seen = _orbIntro; try { seen = seen || sessionStorage.getItem('ov-orb-intro') === '1'; sessionStorage.setItem('ov-orb-intro', '1'); } catch { /* */ }
            // The timers look the orb up when they fire: holding this one would keep a swapped-out bar alive (boost).
            const orbsNow = () => (_navEl && _navEl.querySelectorAll ? [..._navEl.querySelectorAll('#openvibe-search-btn, #openvibe-burger.ovnav-orb')] : []);
            if (!seen && b.classList) { _orbIntro = true; setTimeout(() => { orbsNow().forEach((o) => o.classList.add('ovo-intro')); setTimeout(() => { orbsNow().forEach((o) => o.classList.remove('ovo-intro')); }, 1100); }, 700); }
        }
        if (_searchKeys || _config.search === false || typeof document === 'undefined') return;
        _searchKeys = true;
        document.addEventListener('keydown', (e) => {
            const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
            if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) { e.preventDefault(); openSearch(); }
        });
    }
    function renderAppBar() {
        if (typeof document === 'undefined' || !document.body) return;
        const ab = root.OpenVibeAppBar;
        if (ab) { ab.render({ config: _config, links: rawLinks(), activePage: _activePage, nav: _navEl, navIcon, escapeAttr, escapeHtml, flatLinks }); return; }
        if (!_config.appBar || _appBarLoading) return;
        _appBarLoading = true;
        try { const sc = document.createElement('script'); sc.src = siblingV('appbar.js'); sc.async = true; sc.onload = () => renderAppBar(); document.head.appendChild(sc); } catch { /* no bar */ }
    }

    // The bar's at-the-top state (ovnav-top, see injectStyles), on every render and scroll. One window listener pair for
    // the page's life, a frame at most per update; --ovnav-real-h is the bar's height for overlay pages.
    let _topHooked = false, _lastY = 0;
    function syncTop() {
        if (!_navEl) return;
        const y = root.scrollY || (document.documentElement && document.documentElement.scrollTop) || 0;
        _navEl.classList.toggle('ovnav-top', y <= 4);
        // Phones: away while reading down, back on the first scroll up; never with one of its menus open or focus in it.
        if (_config.autoHide !== false) {
            const phone = !!(root.matchMedia && root.matchMedia('(max-width: 760px)').matches);
            const busy = !!(_navEl.querySelector('.open, [aria-expanded="true"]') || (document.body && document.body.classList.contains('ov-panel-open')) || menuOpen()
                || (document.activeElement && document.activeElement !== document.body && _navEl.contains(document.activeElement)));
            const dy = y - _lastY;
            if (!phone || y < 90 || busy) _navEl.classList.remove('ovnav-hide');
            else if (dy > 10) _navEl.classList.add('ovnav-hide');
            else if (dy < -6) _navEl.classList.remove('ovnav-hide');
        }
        _lastY = y;
        // A fixed bar (a site that positions it itself, like Live) takes no room, so an overlay page needs no pull-up.
        const fixed = root.getComputedStyle && root.getComputedStyle(_navEl).position === 'fixed';
        const de = document.documentElement;
        if (de && de.style) de.style.setProperty('--ovnav-real-h', `${fixed ? 0 : (_navEl.offsetHeight || 52)}px`);
    }
    function hookTop() {
        syncTop();
        if (_topHooked || typeof root.addEventListener !== 'function') return;
        _topHooked = true;
        let raf = 0;
        const later = () => { if (!raf) raf = (root.requestAnimationFrame || setTimeout)(() => { raf = 0; syncTop(); }); };
        root.addEventListener('scroll', later, { passive: true });
        root.addEventListener('resize', later, { passive: true });
    }

    // The page a link leads to is this page, or this page sits under it (/tasks marks /tasks/42; / marks only /).
    const leadsHere = (href, path) => {
        let p = null;
        try { p = new URL(href, location.href); } catch { return false; }
        if (p.origin !== location.origin) return false;
        return p.pathname === path || (p.pathname !== '/' && path.startsWith(`${p.pathname.replace(/\/+$/, '')}/`));
    };
    const remark = (list, path) => list.map((l) => {
        const out = l.active === undefined ? l : Object.assign({}, l, { active: leadsHere(l.href || '', path) });
        return Array.isArray(l.children) ? Object.assign({}, out, { children: remark(l.children, path) }) : out;
    });

    // openvibe-shared/boost swapped the page in place: this is a new page for the history and the
    // active-link state, and a login from here returns here.
    let _boostHooked = false;
    function hookBoost() {
        if (_boostHooked || typeof document === 'undefined') return;
        _boostHooked = true;
        document.addEventListener('ov:boost:load', () => {
            if (_config.history) _config.history = Object.assign({}, _config.history, { title: document.title, url: location.href });
            // A site that marked its links on the server marked them for the page it served; after a swap the mark moves
            // to the new page, or the old page's link stays lit beside the new one (Codes, 2026-10-30).
            if (Array.isArray(_config.links)) _config.links = remark(_config.links, location.pathname || '/');
            try { render(); } catch { /* keep the old bar */ }
            if (_config.user) recordHistory();
        });
    }

    // ── Moving between pages (4.70.0, plan L52; the owner, 2026-11-01: "make navigation feel better… the logo changing
    // while it loads… smarter loading") ──
    // The mark is the loading indicator: it works from the tap until the next page is in (OVMark.navStart/navEnd; a
    // single-page app calls OpenVibeNavbar.busy). Same-site pages are fetched ahead on hover or press (speculation rules,
    // where the browser has them), never sign-in, sign-out, the API or a download.
    let _movesHooked = false;
    function hookMoves() {
        if (_movesHooked || typeof document === 'undefined' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
        _movesHooked = true;
        // A boosted site prefetches through boost.js already (and Chrome's prefetch beside it kept parsed pages alive).
        if (_config.speculate !== false && !root.OVBoost && !document.querySelector('meta[name="ov-boost"]') && typeof HTMLScriptElement !== 'undefined' && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules') && !document.querySelector('script[type="speculationrules"]')) {
            try {
                const sr = document.createElement('script');
                sr.type = 'speculationrules';
                // A page whose policy names a nonce (Chat, Search…) runs inline speculation rules only with it: Chrome 156
                // ignores 'inline-speculation-rules' beside a nonce (2026-11-02). The page's own nonce is read from any of
                // its nonced scripts (the attribute is blanked once parsed; the property keeps it).
                const nonce = [].slice.call(document.scripts || []).map((x) => x.nonce).find(Boolean);
                if (nonce) sr.nonce = nonce;
                // The rules (the owner, 2026-11-09: "how come when you change sites it doesn't load more asynchronously and
                // dynamically, so it's faster across sites?"): a same-site page is prefetched, and — where the browser has
                // prerendering — rendered in the background before the click lands; a link to another OpenVibe site is
                // prefetched too, so the next site is already warm when the person arrives.
                const sameSite = { and: [{ href_matches: '/*' }, { not: { href_matches: ['/auth/*', '/api/*', '/logout*', '/*logout*', '/signout*', '/internal/*', '/*.zip', '/*.pdf'] } }, { not: { selector_matches: '[data-no-prefetch], [download], [rel~=nofollow]' } }] };
                const rules = { prefetch: [{ where: sameSite, eagerness: 'moderate' }] };
                // Prerendering a page the site's own router draws would be work thrown away: a site says no with
                // prerender: false, and marks the links it draws itself with data-no-prefetch.
                if (_config.prerender !== false) rules.prerender = [{ where: sameSite, eagerness: 'moderate' }];
                // Another OpenVibe site: the browser fetches it when the pointer arrives (Chrome leaves a site alone when
                // the person has cookies on it, which is right: that page is theirs, not a public copy).
                rules.prefetch.push({ where: { selector_matches: '[data-ov-net-link]' }, eagerness: 'moderate' });
                sr.textContent = JSON.stringify(rules);
                document.head.appendChild(sr);
            } catch { /* an old browser: links load as they always did */ }
        }
        // A plain same-site link on a server-rendered page: the mark starts working at once; the next page's mark takes over.
        document.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = e.target && e.target.closest && e.target.closest('a[href]');
            if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
            let u; try { u = new URL(a.href, location.href); } catch { return; }
            if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
            setTimeout(() => { if (!e.defaultPrevented) busy(true); }, 0);   // after the page's own handler (an SPA's router) had its say
        }, true);
        // Back from the browser's page cache: whatever was loading is done.
        window.addEventListener('pageshow', (ev) => { if (ev && ev.persisted) busy(false); });
    }
    // ── The shared worker (openvibe-sw.js): the shell's cache, and the push notifications it always carried ──
    // A site opts in: OpenVibeNavbar.init({ sw: true }). The worker is the same file the notification bell registers for
    // push, so there is one registration at scope "/" and nothing is unregistered by accident.
    let _workerHooked = false;
    function hookWorker() {
        const spec = _config.sw;
        if (_workerHooked || !spec) return;
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        if (typeof window !== 'undefined' && window.isSecureContext === false) return;
        _workerHooked = true;
        const opts = (spec === true) ? {} : (spec || {});
        const url = opts.path || '/openvibe-sw.js';
        const scope = opts.scope || '/';
        // After the load: registering early would compete with the page's own files for the network.
        const go = () => { try { navigator.serviceWorker.register(url, { scope }).catch(() => { /* no worker, no cache */ }); } catch { /* */ } };
        if (document.readyState === 'complete') go();
        else window.addEventListener('load', go, { once: true });
    }
    let _busyTimer = 0, _busyOn = false;
    function busy(on) {
        clearTimeout(_busyTimer);
        if (!on && !_busyOn) return;   // only ends what it started (the mark keeps nothing it was not asked to)
        _busyOn = !!on;
        // A link that turns out to be a download never leaves the page: the mark gives up after ten seconds.
        if (on) _busyTimer = setTimeout(() => busy(false), 10000);
        try { if (window.OVMark) { if (on) window.OVMark.navStart(); else window.OVMark.navEnd(); } } catch { /* */ }
    }

    const OpenVibeNavbar = {
        /** The mark works while something loads (an SPA's route, a long action): busy(true), then busy(false). */
        busy(on) { busy(!!on); },
        /** A floating card (overlay.js): OpenVibeNavbar.overlay({ id, src, title, href, live, side }) → Promise<handle|null>. */
        overlay(desc) { return new Promise((ok) => loadOverlay((O) => ok(O.open(desc)))); },
        /** The overlay host itself, loaded (for declare / close / list): Promise<OVOverlay>. */
        overlays() { return new Promise((ok) => loadOverlay(ok)); },

        init(opts = {}) {
            Object.assign(_config, opts);
            // Balances and Messages on every site unless it says false or brings its own (4.130.0).
            if (opts.wallet === undefined) _config.wallet = true;
            if (opts.messages === undefined) _config.messages = { __default: true };
            injectStyles();
            if (!root.OVSurfaces && !document.getElementById('ov-surfaces-loader')) {
                const sc = document.createElement('script'); sc.id = 'ov-surfaces-loader'; sc.src = siblingV('surfaces.js'); sc.async = true; document.head.appendChild(sc);
            }
            hookBoost();
            hookMoves();
            hookWorker();
            const el = render();
            upgradeIconsWhenFontsReady();
            if (typeof document !== 'undefined') setTimeout(loadReleaseWatch, 4000);
            if (typeof document !== 'undefined') setTimeout(warmMenuLater, 3000);
            // A page that passes a user keeps control; otherwise the user comes from the shared SSO state, then a re-render.
            // auth: 'external' — the site signs people in itself (Live) and tells us with setUser().
            if (_config.auth === 'external') { if (_config.user) { recordHistory(); enableHandoff(); } }
            else if (!_config.user) refreshAuthState();
            else { recordHistory(); enableHandoff(); }
            return el;
        },

        /** Record something the signed-in user did here ({type, title, url, icon}) in their network history. */
        record(entry) { const h = _config.history; _config.history = Object.assign({}, h || {}, entry || {}); recordHistory(); _config.history = h; },

        /** Re-resolve the signed-in user from the shared SSO state. */
        refreshAuth() { return refreshAuthState(); },

        /** Update user (after account switch). */
        setUser(user) {
            _config.user = user;
            render();
        },

        /** Replace this site's top links at runtime ([{label, href, icon?, active?, external?}]). */
        setLinks(links) { _runtimeLinks = Array.isArray(links) ? links : null; if (_navEl) render(); },

        /** Open the search panel (search.js), with an optional query already in it. */
        openSearch(q, tab) { openSearch(q, tab); },
        openMenu(tab) { openSearch('', tab || 'you'); },
        openSwitcher() { openSwitcher(); },

        /** The phone app bar: true (from the links that have icons), a list of { label, href, icon, id, page, dot }, or false. */
        setAppBar(spec) { _config.appBar = spec; renderAppBar(); },

        /** New messages: the count joins the bell's (there is no Messages button); a spec keeps `messages` on or off. */
        setMessages(count, spec) {
            if (spec !== undefined) _config.messages = spec;
            _msgCount = Math.max(0, Number(count) || 0);
            const N = root.OpenVibeNotifications;
            if (N && typeof N.setMessages === 'function') N.setMessages(_msgCount);
        },

        /** Add a row to the account dropdown: {label, href|onClick, icon, danger, external, position:'before'|'after'}. */
        addMenuItem(item) {
            if (!item || !item.label) return;
            const it = Object.assign({ id: item.id || `mi-${Math.random().toString(36).slice(2, 8)}` }, item);
            (it.position === 'before' ? _runtimeMenu.before : _runtimeMenu.after).push(it);
            if (_navEl && _config.user) render();
            return it.id;
        },

        removeMenuItem(id) {
            for (const k of ['before', 'after']) _runtimeMenu[k] = _runtimeMenu[k].filter(i => i.id !== id);
            if (_navEl && _config.user) render();
        },

        /** Is this browser signed in to the network? ({ signedIn, username } or null when unknown). */
        checkNetworkSession,

        /** The resolved brand for this page ({ sub, core, tld, name, short, variant }). */
        brand() { return resolveBrand(); },

        /** The signed-in user changed (sites with auth: 'external'). Pass null for signed out. */
        openWallet,
        refreshWallet() { _walletAt = 0; loadWalletChips(); },
        setUser(user, token) { if (root.OpenVibeWallet && (_config.user !== user || (token !== undefined && token !== _config.token))) root.OpenVibeWallet.close(); _config.user = user || null; if (token !== undefined) _config.token = token; _walletLoaded = false; return render(); },
        /** Single-page apps: mark the link whose `page` matches as active. */
        setActive(page) { _activePage = page || null; renderAppBar(); if (!_navEl) return; _navEl.querySelectorAll('.ovnav-link[data-page]').forEach(a => a.classList.toggle('active', a.getAttribute('data-page') === _activePage)); },
        /** Change a status chip's text (navbar and menu header): setChip('coins', '1,234'). */
        setChip(id, value, patch) {
            const lists = [_config.chips || [], (_config.menu && _config.menu.headerChips) || []];
            lists.forEach(l => l.forEach(c => { if (c && c.id === id) { c.value = value; if (patch) Object.assign(c, patch); } }));
            document.querySelectorAll(`[data-chip-id="${id}"]`).forEach(el => { const v = el.querySelector('.ovnav-chip-v'); if (v) v.textContent = value == null ? '' : String(value); if (patch && 'hidden' in patch) el.hidden = !!patch.hidden; });
            document.querySelectorAll(`[data-chip-mini="${id}"] .ovnav-chip-mv`).forEach(el => { el.textContent = shortValue(value); });
            if (root.OpenVibePurse) root.OpenVibePurse.set(id, value);
            document.querySelectorAll(`[data-chip-row="${id}"] b`).forEach(el => { el.textContent = value == null ? '' : String(value); });
            const all = document.getElementById('openvibe-chips-all');
            if (all) all.setAttribute('aria-label', `Your balances: ${(_config.chips || []).filter((c) => c && !c.hidden).map((c) => `${chipLabel(c)} ${c.value == null ? '' : c.value}`).join(', ')}`);
        },
        /** Patch a top-level or dropdown link by id: updateLink('broadcast', { hidden: false, dot: true, label }). */
        updateLink(id, patch) {
            const list = _runtimeLinks || _config.links || [];
            const l = flatLinks(list).find(x => x && x.id === id); if (!l) return; Object.assign(l, patch || {});
            if (!_navEl) return;
            _navEl.querySelectorAll(`[data-link-id="${id}"]`).forEach(a => {
                if ('hidden' in patch) { a.hidden = !!patch.hidden; const dd = a.parentElement; if (dd && dd.classList.contains('ovnav-dd')) dd.hidden = !!patch.hidden; }
                if ('label' in patch) { const t = a.querySelector('.ovnav-l'); if (t) t.textContent = patch.label; }
                if ('href' in patch) a.setAttribute('href', patch.href);
                if ('dot' in patch) { const d = a.querySelector('.ovnav-dot'); if (d) d.hidden = !patch.dot; }
            });
        },
        /** Patch a custom menu item by id: updateMenuItem('admin', { hidden: false, value: '3' }). */
        updateMenuItem(id, patch) {
            const item = sectionItems(_config.menu && _config.menu.sections).find(x => x && x.id === id); if (item) Object.assign(item, patch || {});
            document.querySelectorAll(`.openvibe-navbar-dropdown [data-menu-id="${id}"]`).forEach(el => { if ('hidden' in patch) el.hidden = !!patch.hidden; if ('value' in patch) { const v = el.querySelector('.ud-val'); if (v) v.textContent = patch.value; } });
        },

        /** The activity island (island.js), loaded on first use: OpenVibeNavbar.activity.start({...}). */
        get activity() { return root.OpenVibeIsland || null; },
        set activity(_v) { /* island.js binds itself; nothing to store */ },

        setToken(token) { _config.token = token; },
        /** Who is signed in and the token for Network (read only): for the files loaded beside the navbar (ov-labels.js). */
        get session() { return { user: _config.user || null, token: _config.token || null, apiBase: _config.apiBase }; },

        /** Give every box that scrolls with nothing focusable inside it tabindex="0" now (the bar does it when the page
         *  settles; a page that draws such a box later may call this). Returns how many it marked. */
        focusScrollers() { try { return focusScrollers(); } catch { return 0; } },

        /** A button before the brand: { icon | path, label, controls, sidebar, phoneOnly, pressed, href, onClick }; null removes it. README: Navbar slots. */
        lead(spec) {
            _lead = spec ? { ...spec } : null;
            paintSlots();
            return { set(patch) { if (_lead) { Object.assign(_lead, patch || {}); paintSlots(); } }, remove() { _lead = null; paintSlots(); } };
        },
        /** An icon button before the bell: lead()'s spec plus id and badge. */
        action(spec) {
            if (!spec || !spec.id || !/^[a-z0-9-]{1,40}$/.test(spec.id)) throw new Error('OpenVibeNavbar.action needs an id: a-z, 0-9 and -');
            _actions.set(spec.id, { ...spec });
            paintSlots();
            return { set(patch) { const a = _actions.get(spec.id); if (a) { Object.assign(a, patch || {}); paintSlots(); } }, remove() { _actions.delete(spec.id); paintSlots(); } };
        },

        /** The Dock on a tab, signed in only; opts.task points at that step (see openDock above). */
        openDock(tab, opts) { if (_config.token && _config.dock !== false) openDock(tab, opts); },
        pop: popFrom,
        unpop,
        askAgent(text) { askAgent(text); },

        /** Get the bell mount point for OpenVibeNotifications. */
        getBellMount() {
            return _navEl?.querySelector('#openvibe-bell-mount') || null;
        },

        getElement() { return _navEl; },

        destroy() {
            _navEl?.remove();
            _navEl = null;
        },

        /** Internal auth helpers — exposed for tests, not a public API. */
        _auth: {
            parseCookieToken,
            onToolsDomain,
            onNetworkDomain,
            resolveLoginHref,
            resolveToken,
            resolveSessionUser,
            clearAuthState,
            persistToken,
            fillUrl,
        },
        _ask: { selectedText, askVibeHref },
        _wallet: { loadWallet, walletOrder, syncWalletChips, loadWalletChips, configure: (c) => { Object.assign(_config, c); _walletLoaded = false; } },
        _defaults: { linksFor },
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = OpenVibeNavbar;
    else root.OpenVibeNavbar = OpenVibeNavbar;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
