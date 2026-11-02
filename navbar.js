// OpenVibe — the shared navbar (the OpenVibe Frame's top bar). Options and behaviour: README.md, "The navbar".

(function (root) {
    'use strict';

    let _config = {
        service: 'network', token: null, user: null, apiBase: 'https://openvibe.network', billingBase: null,
        onLogin: null, onLogout: null, loginUrl: null, sessionUrl: null, logoutUrl: null,
        brand: null, brandName: null, brandIcon: null, compact: 'auto',
        links: null, menu: null, recent: true,
        history: null, silentLogin: null, fedcm: 'optional', fedcmLogin: null,   // README.md, "The navbar"
    };
    const _runtimeMenu = { before: [], after: [] };
    let _runtimeLinks = null;
    let _navEl = null;

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
            .openvibe-navbar::before { content: ""; position: absolute; inset: 0 0 -28px; pointer-events: none; z-index: -1; opacity: 0; transition: opacity .45s cubic-bezier(.2,.7,.2,1); background: linear-gradient(180deg, rgba(4,7,14,.62), rgba(4,7,14,.28) 55%, rgba(4,7,14,0)); }
            .openvibe-navbar:not(.ovnav-top) { background-color: color-mix(in srgb, var(--bg-secondary, #252530) 84%, transparent); -webkit-backdrop-filter: saturate(1.5) blur(16px); backdrop-filter: saturate(1.5) blur(16px); box-shadow: 0 12px 32px -14px rgba(0,0,0,.6); }
            .openvibe-navbar.ovnav-top { background-color: transparent; border-bottom-color: transparent; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
            /* The bar is sticky, but a #navbar-mount wrapper exactly its height gave it no room to stick in: the wrapper sticks. */
            #navbar-mount { position: sticky; top: 0; z-index: 10000; }
            body.ov-nav-overlay .openvibe-navbar.ovnav-top::before { opacity: 1; }
            body.ov-nav-overlay > #navbar-mount, body.ov-nav-overlay > .openvibe-navbar { margin-bottom: calc(-1 * var(--ovnav-real-h, 52px)); }
            body.ov-panel-open .openvibe-navbar.ovnav-top { background-color: var(--bg-secondary, #252530); border-bottom-color: var(--border, #333340); }
            @media (prefers-reduced-motion: reduce) { .openvibe-navbar, .openvibe-navbar::before { transition: none; } }
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
            .openvibe-navbar .openvibe-navbar-brand .flame { display: inline-grid; place-items: center; width: auto; min-width: 30px; height: 30px; padding: 0 4px; box-sizing: border-box; border-radius: 9px; transition: background .15s; }
            .openvibe-navbar .openvibe-navbar-brand .flame:hover { background: var(--accent-glow, rgba(59,130,246,.14)); }
            .openvibe-navbar .openvibe-navbar-brand .name { align-items: center; gap: 0; font-family: 'OV Brand', Nunito, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 19px; letter-spacing: -.25px; }
            .openvibe-navbar .openvibe-navbar-brand .name a { padding: 3px 1px; border-radius: 6px; transition: color .15s, background .15s; }
            .openvibe-navbar .openvibe-navbar-brand .name a.b-sub { color: var(--text-primary, #e6edf7); font-weight: 900; }
            .openvibe-navbar .openvibe-navbar-brand .name a.b-core { color: var(--text-primary, #e6edf7); font-weight: 800; }
            .openvibe-navbar .openvibe-navbar-brand .name a.b-tld { color: var(--accent-light, var(--accent, #60a5fa)); font-weight: 800; }
            .openvibe-navbar .openvibe-navbar-brand.has-sub .name a.b-core, .openvibe-navbar .openvibe-navbar-brand.has-sub .name a.b-tld { color: var(--text-secondary, #a8b3c4); font-weight: 700; }
            .openvibe-navbar .openvibe-navbar-brand .name a:hover { color: var(--accent-light, var(--accent, #60a5fa)); background: var(--accent-glow, rgba(59,130,246,.12)); }
            .openvibe-navbar .openvibe-navbar-brand .b-dot { margin: 0; padding: 0; opacity: .5; }
            .openvibe-navbar .openvibe-navbar-brand.joined .name a.b-core { padding-right: 0; }
            .openvibe-navbar .openvibe-navbar-brand.joined .name a.b-tld { padding-left: 0; }
            .openvibe-navbar .openvibe-navbar-brand a:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
            /* A finger needs about 44px: on touch screens the wordmark's links reach the navbar's height and the mark
               gets a clear ring, without moving anything (they were 22px and 30px tall). */
            @media (pointer: coarse) {
                .openvibe-navbar .openvibe-navbar-brand .name a { padding-top: 14px; padding-bottom: 14px; margin-top: -11px; margin-bottom: -11px; }
                .openvibe-navbar .openvibe-navbar-brand .flame { position: relative; }
                .openvibe-navbar .openvibe-navbar-brand .flame::after { content: ''; position: absolute; inset: -8px; }
                /* 4.46.0 (the fleet tap audit): Sign In, the menu and the orb reach 44px to a finger, still drawn as before. */
                .openvibe-navbar .openvibe-navbar-login, .openvibe-navbar .ovnav-burger, .openvibe-navbar .ovnav-orb { position: relative; }
                .openvibe-navbar .openvibe-navbar-login::after { content: ''; position: absolute; inset: -6px 0; }
                .openvibe-navbar .ovnav-burger::after { content: ''; position: absolute; inset: -3px -5px; }
                /* The orb grows up and down only a little sideways: the site's name sits 8px from it and keeps its own taps. */
                .openvibe-navbar .ovnav-orb::after { content: ''; position: absolute; inset: -6px -4px; }
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
            .openvibe-navbar .ovnav-chip.ovnav-chip--all { display: none; gap: 0; padding: 0 1px; font-size: 12.5px; --chip-c: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); border-color: color-mix(in srgb, var(--text-primary, #e6edf7) 13%, transparent); }
            .openvibe-navbar .ovnav-chip--all:hover, .openvibe-navbar .ovnav-chip--all[aria-expanded="true"] { background: color-mix(in srgb, var(--text-primary, #e6edf7) 11%, transparent); }
            .ovnav-chip-mini { display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; color: var(--text-primary, #e6edf7); }
            .ovnav-chip-mini + .ovnav-chip-mini { border-left: 1px solid color-mix(in srgb, var(--text-primary, #e6edf7) 16%, transparent); }
            .ovnav-chip-mini .ovnav-ic { color: var(--chip-c, inherit); }
            .ovnav-chip-mini[data-tone="gold"] { --chip-c: #fbbf24; } .ovnav-chip-mini[data-tone="green"] { --chip-c: #4ade80; }
            .ovnav-chip-mini .ovnav-ic { width: 14px; height: 14px; }
            .ovnav-chips-pop { position: absolute; top: calc(100% + 6px); right: 8px; z-index: 1002; min-width: 220px; padding: 6px; border-radius: 14px; display: none; flex-direction: column; gap: 2px;
                background: var(--bg-elevated, var(--bg-secondary, #111826)); border: 1px solid var(--border, rgba(255,255,255,.12)); box-shadow: 0 18px 40px rgba(0,0,0,.45); }
            .ovnav-chips-pop.open { display: flex; animation: openvibe-slide-down .18s ease; }
            .ovnav-chips-pop button { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; font-size: 14px; color: var(--text-primary, #e6edf7); }
            .ovnav-chips-pop button:hover, .ovnav-chips-pop button:focus-visible { background: var(--accent-glow, rgba(59,130,246,.14)); }
            .ovnav-chips-pop button .ovnav-ic { color: var(--chip-c, inherit); width: 16px; height: 16px; }
            .ovnav-chips-pop button[data-tone="gold"] { --chip-c: #fbbf24; } .ovnav-chips-pop button[data-tone="green"] { --chip-c: #4ade80; }
            .ovnav-chips-pop b { margin-left: auto; font-variant-numeric: tabular-nums; }
            @media (max-width: 560px) {
                .openvibe-navbar-right.has-chips-all .ovnav-chip[data-chip-id] { display: none; }
                .openvibe-navbar-right.has-chips-all .ovnav-chip--all { display: inline-flex; }
            }
            @media (max-width: 860px) { .openvibe-navbar .ovnav-burger { display: inline-flex; } .openvibe-navbar .openvibe-navbar-links, .openvibe-navbar .openvibe-navbar-spacer { display: none; } .openvibe-navbar .openvibe-navbar-right { margin-left: auto; } .openvibe-navbar .ovnav-chip .ovnav-ic + .ovnav-chip-v:empty { display: none; } }
            @media (max-width: 420px) { .openvibe-navbar .ovnav-chip { padding: 0 8px; height: 30px; font-size: 12px; } }
            /* A narrow phone never draws the site's name over the bar's buttons (owner, 2026-10-28: on openvibe.games, signed
               in, the name ran under the launcher and the magnifier). The name gives way with an ellipsis, and up to 440px
               the folded balances show the first one only (a tap lists them all). */
            .openvibe-navbar .openvibe-navbar-brand { flex: 0 1 auto; }
            .openvibe-navbar .openvibe-navbar-brand .flame { flex: none; }
            .openvibe-navbar .openvibe-navbar-brand .name { display: block; min-width: 0; white-space: nowrap; overflow-x: clip; text-overflow: ellipsis; }
            /* Both balances on every phone (the owner, 2026-10-28: "you can only see one… use the full space"): the pill
               tightens instead of folding to one. */
            @media (max-width: 440px) { .ovnav-chip-mini { padding: 0 5px; gap: 3px; } .openvibe-navbar .ovnav-chip.ovnav-chip--all { font-size: 12px; } .ovnav-chip-mini .ovnav-ic { width: 13px; height: 13px; } }
            @media (max-width: 400px) { .openvibe-navbar .openvibe-navbar-right { gap: 1px; } .ovnav-chip-mini { padding: 0 3px; gap: 2px; } .openvibe-navbar .ovnav-chip.ovnav-chip--all { font-size: 11.5px; letter-spacing: -.2px; } .openvibe-navbar .openvibe-navbar-brand { gap: 4px; }
                .openvibe-navbar { padding-left: 8px; padding-right: 6px; gap: 2px; } .openvibe-navbar .ovnav-burger { width: 34px; } .openvibe-navbar .openvibe-navbar-avatar { width: 32px; height: 32px; box-sizing: border-box; }
                .openvibe-navbar .openvibe-navbar-brand .name { font-size: 16.5px; letter-spacing: -.25px; } .openvibe-navbar .openvibe-navbar-brand .flame { min-width: 28px; height: 28px; padding: 0 2px; } .openvibe-navbar .openvibe-navbar-brand .flame .ov-mark { width: 28px !important; } }
            /* Under 350px the mark alone names the site, so both balances keep their icons (a number alone says nothing). */
            @media (max-width: 350px) { .openvibe-navbar .openvibe-navbar-brand .name { display: none; } }
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
            .openvibe-navbar-links a {
                padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 500;
                color: var(--text-secondary, #b0b0b8); text-decoration: none;
                transition: all .15s;
            }
            .openvibe-navbar-links a:hover { background: var(--bg-hover, #2f2f3d); color: var(--text-primary, #e0e0e0); }
            .openvibe-navbar-links a.active { background: var(--bg-tertiary, #2a2a38); color: var(--accent-light, #60a5fa); }

            .openvibe-navbar-spacer { flex: 1; }

            .openvibe-navbar-right { display: flex; align-items: center; gap: 6px; }
            /* The OpenVibe menu's button (4.25.0; the owner, 2026-10-28: "the little diamond thing… an icon that has cool
               animations and effects… next to the logo"): nine dots set as a diamond beside the brand. Hovered, a ripple
               runs out from the centre and the dots take the accent's colours; while the menu loads they wave; while it is
               open the diamond turns into an ×. Transform, opacity and fill only, and nothing moves while it rests. */
            .openvibe-navbar .ovnav-orb { all: unset; box-sizing: border-box; position: relative; display: inline-grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 11px; cursor: pointer; color: var(--text-secondary, #a8b3c4); --ovo-a: var(--accent-light, var(--accent, #60a5fa)); --ovo-b: color-mix(in oklab, var(--accent, #3b82f6) 45%, #e879f9); }
            .openvibe-navbar .ovnav-orb::before { content: ""; position: absolute; inset: -3px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--accent, #3b82f6) 38%, transparent), transparent); opacity: 0; transform: scale(.5); transition: opacity .25s, transform .4s cubic-bezier(.2,1.4,.3,1); pointer-events: none; }
            .openvibe-navbar .ovnav-orb:hover::before, .openvibe-navbar .ovnav-orb:focus-visible::before, .openvibe-navbar .ovnav-orb[aria-expanded="true"]::before { opacity: 1; transform: none; }
            .openvibe-navbar .ovnav-orb svg { position: relative; display: block; overflow: visible; }
            .ovnav-orb .ovo-g { transform-origin: 12px 12px; transform: rotate(45deg) scale(.8); transition: transform .55s cubic-bezier(.2,1.35,.3,1); }
            .ovnav-orb .ovo-d { fill: currentColor; transform-box: fill-box; transform-origin: center; transition: fill .3s, opacity .3s, transform .35s cubic-bezier(.2,1.4,.3,1); }
            .ovnav-orb .ovo-r2 { opacity: .6; }
            .ovnav-orb .ovo-r0 { fill: var(--ovo-a); }
            .ovnav-orb:is(:hover, :focus-visible) .ovo-r1 { fill: var(--ovo-a); }
            .ovnav-orb:is(:hover, :focus-visible) .ovo-r2 { fill: var(--ovo-b); opacity: 1; }
            .ovnav-orb:is(:hover, :focus-visible) .ovo-r0 { fill: var(--text-primary, #e6edf7); }
            .ovnav-orb:is(:hover, .ovo-intro) .ovo-d { animation: ovo-ripple .7s cubic-bezier(.3,.7,.3,1) both; }
            .ovnav-orb.is-busy .ovo-d { animation: ovo-wave .9s ease-in-out infinite; }
            .ovnav-orb .ovo-d.ovo-r1 { animation-delay: .07s; } .ovnav-orb .ovo-d.ovo-r2 { animation-delay: .14s; }
            .openvibe-navbar .ovnav-orb[aria-expanded="true"] { color: var(--text-primary, #e6edf7); }
            .ovnav-orb[aria-expanded="true"] .ovo-g { transform: rotate(180deg) scale(.86); }
            .ovnav-orb[aria-expanded="true"] .ovo-d { animation: none; }
            .ovnav-orb[aria-expanded="true"] .ovo-r1 { opacity: 0; transform: scale(0); }
            .ovnav-orb[aria-expanded="true"] :is(.ovo-r0, .ovo-r2) { fill: var(--ovo-a); opacity: 1; }
            @keyframes ovo-ripple { 0%, 100% { transform: scale(1); } 45% { transform: scale(1.55); } }
            @keyframes ovo-wave { 0%, 100% { transform: scale(.7); opacity: .5; } 50% { transform: scale(1.25); opacity: 1; } }
            @media (prefers-reduced-motion: reduce) { .ovnav-orb .ovo-g, .ovnav-orb .ovo-d, .ovnav-orb::before { transition: none; animation: none !important; } }
            html[data-ov-motion="reduced"] .ovnav-orb .ovo-d { animation: none !important; }
            .openvibe-navbar .openvibe-navbar-brand .ovnav-orb { margin-left: 1px; }
            @media (max-width: 400px) { .openvibe-navbar .ovnav-orb { width: 28px; height: 32px; } }
            /* Messages (4.25.0; the owner, 2026-10-28: the floating DM button was "buggy as hell on mobile… app style"): a
               site that has messages puts them in the bar beside the bell, with the unread count, instead of a bubble
               over the page. */
            .openvibe-navbar .ovnav-msgs { all: unset; box-sizing: border-box; position: relative; display: inline-grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 11px; cursor: pointer; color: var(--text-secondary, #a8b3c4); }
            .openvibe-navbar .ovnav-msgs:hover, .openvibe-navbar .ovnav-msgs:focus-visible { background: var(--accent-glow, rgba(59,130,246,.14)); color: var(--text-primary, #e6edf7); }
            .openvibe-navbar .ovnav-msgs .ovnav-ic { width: 22px; height: 22px; }
            .ovnav-ovg { width: 1.15em; height: 1.15em; flex: none; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; overflow: visible; vertical-align: -.2em; }
            .ovnav-chip .ovnav-ovg, .ovnav-chip-mini .ovnav-ovg, .ovnav-chips-pop .ovnav-ovg { stroke-width: 2.3; }
            .ovnav-ovg > .ovg-s { display: none; fill: currentColor; stroke: none; }
            .ovnav-ovg > .ovg-s .ln { fill: none; stroke: currentColor; stroke-width: 2.6px; }
            html[data-ov-icons=solid] .ovnav-ovg.has-s, .ovnav-ab.is-here .ovnav-ovg.has-s { stroke-width: 0; }
            html[data-ov-icons=solid] .ovnav-ovg.has-s > .ovg-s, .ovnav-ab.is-here .ovnav-ovg.has-s > .ovg-s { display: inline; }
            .openvibe-navbar .ovnav-msgs b { position: absolute; top: -1px; right: -3px; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: var(--live-red, #ef4444); color: #fff; font: 700 10px/16px Inter, system-ui, sans-serif; text-align: center; box-shadow: 0 0 0 2px var(--bg-secondary, #111826); }
            .openvibe-navbar .ovnav-msgs b:empty { display: none; }
            @media (max-width: 400px) { .openvibe-navbar .ovnav-msgs { width: 32px; height: 32px; } }

            .openvibe-navbar-avatar {
                width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
                border: 2px solid var(--border, #333340); transition: border-color .2s;
                object-fit: cover;
            }
            .openvibe-navbar-avatar:hover { border-color: var(--accent, #3b82f6); }

            .openvibe-navbar-login {
                padding: 6px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;
                /* --accent-strong / --on-accent-strong (builtin-themes.js deriveTokens) read at 4.5:1 or better in
                   every theme (WCAG AA); the accent itself did not (white on #3b82f6 is 3.67:1). */
                background: var(--accent-strong, #1d4ed8); color: var(--on-accent-strong, #fff); border: none; cursor: pointer;
                transition: filter .15s; text-decoration: none; display: inline-flex; align-items: center;
            }
            .openvibe-navbar-login:hover { filter: brightness(1.12); }

            .openvibe-navbar-dropdown {
                position: absolute; top: 48px; right: 8px;
                width: min(320px, calc(100vw - 16px)); background: var(--bg-card, #22222c);
                border: 1px solid var(--border, #333340); border-radius: 10px;
                box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.5));
                display: none; flex-direction: column; overflow: hidden;
                animation: openvibe-slide-down .2s ease;
            }
            .openvibe-navbar-dropdown.open { display: flex; }
            /* The panel scrolls as a whole; its sections keep their height. A flex column lets children shrink by
               default, which squeezed the accounts block into a sliver with its own scrollbar when the panel was
               height-limited (phones). */
            .openvibe-navbar-dropdown > * { flex-shrink: 0; }
            /* Panels never leave the screen: dvh is the VISIBLE height on phones (100vh reaches behind the address
               bar), the panel scrolls inside itself, and it is never wider than the viewport. */
            .openvibe-navbar-dropdown {
                max-width: calc(100vw - 16px);
                max-height: calc(100vh - 64px); max-height: calc(100dvh - 64px - env(safe-area-inset-bottom, 0px));
                overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; scrollbar-width: thin;
            }
            @keyframes openvibe-slide-down { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

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

            /* Touch and keyboard feedback. Phones flash a square, theme-blind blue box over anything
               tapped (-webkit-tap-highlight-color); the Frame turns it off and shows a slight press
               instead, and keyboard focus gets one ring in the theme accent. :where() keeps it at zero
               specificity, so the Frame's own :focus-visible rules and a host page's rules still win.
               \`scale\` is its own property, so it composes with any transform already in use. */
            .openvibe-navbar, .openvibe-navbar-dropdown, .ovnav-drawer { -webkit-tap-highlight-color: transparent; }
            :where(.openvibe-navbar, .openvibe-navbar-dropdown, .ovnav-drawer) :where(a, button, [role="button"]):not(:disabled):active { scale: .96; }
            :where(.openvibe-navbar, .openvibe-navbar-dropdown, .ovnav-drawer) :where(a, button, [role="button"], [tabindex]:not([tabindex="-1"])):focus-visible {
                outline: 2px solid var(--accent-light, var(--accent, #3b82f6)); outline-offset: 2px;
            }
            @media (prefers-reduced-motion: reduce) {
                :where(.openvibe-navbar, .openvibe-navbar-dropdown, .ovnav-drawer) :where(a, button, [role="button"]):not(:disabled):active { scale: none; opacity: .82; }
            }
        `;
        document.head.appendChild(s);
    }

    // ── Icons ────────────────────────────────────────────────
    // The navbar draws its own icons. It used to borrow the page's Font Awesome, so on pages that do not load
    // that font every menu row had an empty slot. Known names get an inline SVG; an unknown name still falls
    // back to the page's icon font, so sites that pass their own Font Awesome icons keep working.
    // BEGIN generated by scripts/build-navbar-icons.js from nav-icons.js; do not edit by hand
    // The glyphs the navbar draws itself: [0, line, solid] is an OpenVibe glyph (24-unit grid); [w, path] a Font
    // Awesome Free 6 solid glyph (CC BY 4.0, fontawesome.com/license/free) in a 0 0 <w> 512 viewBox. The rest of the set is nav-icons.js.
    const NAV_ICONS = {
        'fa-bell': [0, '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20a2 2 0 0 0 4 0"/>', '<path d="M5.8 16.2V11a6.2 6.2 0 0 1 12.4 0v5.2l1.7 2.3H4.1ZM9.9 19.6h4.2a2.1 2.1 0 0 1-4.2 0Z"/>'],
        'fa-clock-rotate-left': [0, '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6M4 4.5v4.1h4.1"/><path d="M12 8v4.2l3 1.8"/>', '<path d="M6.06 6.06A8.4 8.4 0 1 1 3.6 12h2.8a5.6 5.6 0 1 0 1.64-3.96ZM3 3.2v6.6h6.6ZM11 8.2h2v3.4l2.5 1.5-1 1.7-3.5-2.1Z"/>'],
        'fa-coins': [0, '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5v11"/>', '<path fill-rule="evenodd" d="M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4ZM11 6h2v1.2c1.1.2 2 .8 2.5 1.7l-1.7 1c-.3-.6-1-1-1.8-1-.9 0-1.5.4-1.5 1s.5.8 1.8 1.1c1.8.4 3.4 1 3.4 3 0 1.4-1 2.4-2.7 2.7V18h-2v-1.3c-1.2-.2-2.2-.9-2.7-1.9l1.7-1c.4.7 1.1 1.1 2 1.1 1 0 1.6-.4 1.6-1s-.6-.8-1.9-1.1c-1.7-.4-3.3-1-3.3-2.9 0-1.3 1-2.3 2.6-2.6Z"/>'],
        'fa-palette': [0, '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6s.8-1.7 2-1.7H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7.3" r="1.2"/><circle cx="14.5" cy="7.3" r="1.2"/>', '<path fill-rule="evenodd" d="M12 2.7a9.3 9.3 0 1 0 0 18.6c1.3 0 2-.9 2-1.9 0-1.2-1-1.5-1-2.5s.8-1.6 2-1.6H17a4.3 4.3 0 0 0 4.3-4.3C21.3 6.5 17.2 2.7 12 2.7ZM7.5 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm2.5-3.7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm4.5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"/>'],
        'fa-people-group': [0, '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14.8c1.9.6 3 2.4 3 5.2"/>', '<circle cx="9" cy="7.9" r="3.6"/><path d="M2.4 20.8c0-3.8 3-6.5 6.6-6.5s6.6 2.7 6.6 6.5Z"/><circle cx="16.6" cy="7.4" r="2.9"/><path d="M16.8 13.4c2.9.4 4.8 2.8 4.8 6.4V20.8h-4.4c0-2.9-1-5.2-2.8-6.7Z"/>'],
        'fa-plus': [0, '<path d="M12 5v14M5 12h14"/>', ''],
        'fa-right-from-bracket': [0, '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>', ''],
        'fa-shield-halved': [0, '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z"/>', '<path d="M12 2.6 4.6 5.8V12c0 4.6 3.1 8 7.4 9.5 4.3-1.5 7.4-4.9 7.4-9.5V5.8Z"/>'],
        'fa-text-height': [0, '<path d="M5.5 20 11 4h2l5.5 16M7.6 14h8.8"/>', '<path fill-rule="evenodd" d="M10.3 3.4h3.4l6.3 17.2h-3.1l-1.5-4.3H8.6l-1.5 4.3H4ZM9.5 13.7h5L12 6.4Z"/>'],
        'fa-tower-broadcast': [0, '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>', '<circle cx="12" cy="12" r="3.1"/><path class="ln" d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>'],
        'fa-user-secret': [0, '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>', '<circle cx="12" cy="7.8" r="4.1"/><path d="M4.2 21c0-4.3 3.5-7.2 7.8-7.2s7.8 2.9 7.8 7.2Z"/>'],
        'fa-wallet': [0, '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v4M4 7.5V18a2 2 0 0 0 2 2h14V9H6.5A2.5 2.5 0 0 1 4 7.5Z"/><path d="M16 14.5h.01"/>', '<path fill-rule="evenodd" d="M6.5 4.6H18v4h1.4a.8.8 0 0 1 .8.8v10.8H6a2.2 2.2 0 0 1-2.2-2.2V7.3a2.7 2.7 0 0 1 2.7-2.7Zm0 1.8a.9.9 0 0 0 0 1.8h9.7V6.4ZM16 13.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/>'],
        'fa-wand-magic-sparkles': [0, '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>', '<path d="M12 2.6l2 5.6 5.6 2-5.6 2L12 17.8l-2-5.6-5.6-2 5.6-2ZM19 14.6l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9Z"/>'],
        'fa-chevron-down': [0, '<path d="m6 9 6 6 6-6"/>', ''],
        'fa-gear': [0, '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>', '<path fill-rule="evenodd" d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"/>'],
        'fa-circle-half-stroke': [0, '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 7.5h7M12 12h9M12 16.5h7"/>', ''],
        'fa-moon': [0, '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>', '<path d="M20.4 14.4A8.5 8.5 0 1 1 9.6 3.6a7 7 0 0 0 10.8 10.8Z"/>'],
        'fa-sun': [0, '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', '<circle cx="12" cy="12" r="4.6"/><path class="ln" d="M12 2.2v1.6M12 20.2v1.6M5 5l1.1 1.1M17.9 17.9 19 19M2.2 12h1.6M20.2 12h1.6M5 19l1.1-1.1M17.9 6.1 19 5"/>'],
        'fa-comment-dots': [0, '<path d="M4 5h16v11H8l-4 4Z"/>', '<path d="M3.5 5.6A1.6 1.6 0 0 1 5.1 4h13.8a1.6 1.6 0 0 1 1.6 1.6v9.8a1.6 1.6 0 0 1-1.6 1.6H8.6L3.5 21Z"/>'],
        'fa-brain': [0, '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1.2V5.5A2 2 0 0 0 9 4ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1.2"/>', '<path d="M9 3.8a3.1 3.1 0 0 0-3.1 3 3 3 0 0 0-2.1 5.2 3 3 0 0 0 2.1 5.1 3.1 3.1 0 0 0 5.5 1.3V5.5A2.2 2.2 0 0 0 9 3.8Z"/><path d="M15 3.8a3.1 3.1 0 0 1 3.1 3 3 3 0 0 1 2.1 5.2 3 3 0 0 1-2.1 5.1 3.1 3.1 0 0 1-5.5 1.3V5.5A2.2 2.2 0 0 1 15 3.8Z"/>'],
    };
    // Every other glyph in nav-icons.js, grouped by advance width (sizes its slot before the path arrives); 0 is an OpenVibe glyph.
    const NAV_ICONS_LAZY = {
        0: 'fa-book fa-camera fa-comments fa-gamepad fa-gauge-high fa-hand-fist fa-house fa-id-card fa-link fa-list-check fa-network-wired fa-paste fa-people-arrows fa-scissors fa-screwdriver-wrench fa-shirt fa-user fa-video fa-arrow-up-right-from-square fa-chevron-right fa-bars fa-xmark fa-magnifying-glass fa-file-pdf fa-arrow-down fa-arrow-right fa-clock fa-envelope fa-star fa-heart fa-play fa-circle-info fa-triangle-exclamation fa-check fa-globe fa-code fa-robot fa-photo-film fa-tower-cell fa-diagram-project fa-toolbox fa-money-bill-wave fa-crown fa-server fa-newspaper fa-tag fa-ticket fa-chart-line fa-pen-nib fa-key fa-plug fa-bolt fa-satellite-dish fa-microchip fa-circle-nodes fa-download fa-upload fa-image fa-music fa-file-lines fa-font fa-location-dot fa-lock fa-wave-square fa-map fa-utensils fa-user-shield fa-gauge fa-pen fa-earth-americas fa-hashtag fa-inbox fa-folder fa-puzzle-piece fa-shield fa-display fa-microphone fa-infinity fa-list fa-flag-checkered fa-tv fa-compass',
    };
    const NAV_ICONS_REV = 'd9a4febbbad7';   // sha256(nav-icons.js), first 12 hex: its ?v= (cacheable forever)
    // END generated
    // The files loaded from beside this one, by content (scripts/sibling-revs.js): a release changes their URLs.
    const SIBLING_REV = { 'ov-mark.js': '1e91c9c0f347', 'ov-glyphs.js': '2c505c7b96a3', 'ov-brand.woff2': '3b4e6a8a5878', 'ov-look.js': '2a6c53a7b176', 'ov-fx.js': '46fce1e2b8db', 'ov-labels.js': 'a30b178391f5' };
    // The navbar's icons are filled paths (no Font Awesome CSS needed): the ones above ship here, the rest
    // (nav-icons.js) load after first paint when a link, chip or menu row names one, into an empty <svg> of their
    // size. Anything unknown, or nav-icons.js failing, falls back to <i class="fa-solid">.
    const _selfSrc = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
    let _lazyWidth = null;
    let _iconState = 0;     // 0 idle, 1 loading, 2 loaded, 3 unavailable
    // "Ask Vibe": the page's selected text (≤1000) and https address (no hash, ≤400) into a new chat with Vibe (openvibe.chat).
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
    const siblingV = (name) => `${sibling(name)}${SIBLING_REV[name] ? `?v=${SIBLING_REV[name]}` : ''}`;
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
            const sc = document.createElement('script'); sc.src = sibling('release-watch.js'); sc.async = true;
            try { sc.fetchPriority = 'low'; } catch { /* */ }
            document.head.appendChild(sc);
        } catch { /* optional */ }
    }

    // ─── Brand from hostname ───────────────────────────────────
    // Every property is <sub?>.openvibe.<tld> (plus openre.stream). The navbar spells the
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
        const subText = b.subLabel || (sub ? subLabel(sub) : null);
        const tldText = b.tldLabel || (joined ? tld : TLD_LABELS[tld] || titleCase(tld));
        const site = joined ? `${core}${tldText}` : `${core}.${tldText}`;
        const name = b.name || [subText, site].filter(Boolean).join('.');
        const icon = b.icon || _config.brandIcon || null;
        const variant = b.variant || (joined ? 'stream' : tld);
        return { sub, subText, core, tld, tldText, joined, site, name, short: subText || site, icon, variant, tag: b.tag || null, href: b.href || '/' };
    }

    /** Where each brand segment goes: sub → this tool, OpenVibe → the network, TLD → the site's apex. */
    function brandLinks(brand) {
        const apex = brand.joined ? 'https://openre.stream/' : `https://openvibe.${brand.tld}/`;
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
            ? seg('b-sub', brand.subText, to.sub, brand.name) + dot + seg('b-core', brand.core, to.core, brand.joined ? brand.site : 'OpenVibe Network') + join + seg('b-tld', brand.tldText, to.tld, `All of ${brand.site}`)
            : seg('b-core', brand.core, to.core, brand.name) + join + seg('b-tld', brand.tldText, to.tld, brand.name);
        const mark = brand.icon
            ? `<i class="fa-solid ${escapeAttr(brand.icon)}"></i>`
            : `<span class="ov-mark" data-size="34" data-wide data-variant="${escapeAttr(brand.variant)}"></span>`;
        return `<div class="openvibe-navbar-brand${brand.subText ? ' has-sub' : ''}${brand.joined ? ' joined' : ''}">
                ${_config.switcher === false
        ? `<a class="flame" href="${escapeAttr(brand.href)}" aria-label="${escapeAttr(brand.name)} home">${mark}</a>`
        : `<button type="button" class="flame" id="openvibe-switch-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="Switch to another OpenVibe site" title="Every OpenVibe site">${mark}</button>`}
                <span class="name">${text}${brand.tag ? `<span class="b-tag">${escapeAttr(brand.tag)}</span>` : ''}</span>
                ${_config.search === false ? '' : orbHTML()}
            </div>`;
    }

    // The OpenVibe menu's button: nine dots as a diamond (the old launcher's, which the owner liked), the centre in the
    // accent. Rings: 0 the centre, 1 the edges, 2 the corners (the ripple's order; corners and centre make the ×).
    const ORB_DOTS = [[12, 12, 0], [12, 5, 1], [19, 12, 1], [12, 19, 1], [5, 12, 1], [5, 5, 2], [19, 5, 2], [19, 19, 2], [5, 19, 2]];
    function orbHTML() {
        const dots = ORB_DOTS.map(([x, y, r]) => `<circle class="ovo-d ovo-r${r}" cx="${x}" cy="${y}" r="${r ? 2.15 : 2.5}"/>`).join('');
        return `<button type="button" class="ovnav-search ovnav-orb" id="openvibe-search-btn" aria-label="OpenVibe menu: search, every site and tool (/)" title="Search and every OpenVibe site (/)" aria-haspopup="dialog" aria-expanded="false"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g class="ovo-g">${dots}</g></svg></button>`;
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
                    legal: https(lg.terms) && https(lg.privacy) && https(lg.dmca) ? { terms: lg.terms, privacy: lg.privacy, dmca: lg.dmca } : null } };
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

    /** One anonymous page-view count per page load (host only), which is what orders the network's
     *  navigation. Skipped when the browser asks not to be tracked. */
    let _counted = false;
    function countView() {
        if (_counted || _config.countViews === false) return; _counted = true;
        try {
            if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
            if (!/^https:$/.test(location.protocol)) return;
            const url = 'https://openvibe.network/api/frame/hit';
            if (navigator.sendBeacon) navigator.sendBeacon(url);
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
    /** The chips folded into one (shown instead of them on a phone): each chip's icon and short value. */
    let _msgCount = 0;
    const msgLabel = () => `Messages${_msgCount ? ` (${_msgCount} unread)` : ''}`;
    function messagesHTML() {
        const m = _config.messages || {};
        const href = typeof m.href === 'string' ? m.href : 'https://openvibe.chat/messages';
        const n = _msgCount ? (_msgCount > 99 ? '99+' : String(_msgCount)) : '';
        return `<a class="ovnav-msgs" id="openvibe-messages-btn" href="${escapeAttr(href)}" title="${escapeAttr(m.label || 'Messages')}" aria-label="${escapeAttr(msgLabel())}">${navIcon('fa-comment-dots')}<b>${n}</b></a>`;
    }
    function bindMessages(nav) {
        const a = nav.querySelector('#openvibe-messages-btn'); if (!a || typeof a.addEventListener !== 'function') return;
        a.addEventListener('click', (e) => {
            const m = _config.messages || {};
            if (typeof m.onOpen !== 'function' || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault(); try { m.onOpen(e); } catch { /* the link still works */ }
        });
    }

    function chipsAllHTML(chips) {
        const list = (Array.isArray(chips) ? chips : []).filter((c) => c && !c.hidden);
        if (list.length < 2) return '';
        return `<button type="button" class="ovnav-chip ovnav-chip--all" id="openvibe-chips-all" aria-haspopup="true" aria-expanded="false" aria-label="Your balances: ${escapeAttr(list.map((c) => `${chipLabel(c)} ${c.value == null ? '' : c.value}`).join(', '))}">${list.map((c) => `<span class="ovnav-chip-mini" data-chip-mini="${escapeAttr(c.id)}"${c.tone ? ` data-tone="${escapeAttr(c.tone)}"` : ''}>${c.icon ? navIcon(c.icon) : ''}<span class="ovnav-chip-mv">${escapeAttr(shortValue(c.value))}</span></span>`).join('')}</button>`;
    }
    function bindChipsAll(nav) {
        const btn = nav.querySelector('#openvibe-chips-all'); if (!btn || typeof btn.addEventListener !== 'function') return;
        const right = typeof btn.closest === 'function' ? btn.closest('.openvibe-navbar-right') : null;
        if (right && right.classList) right.classList.add('has-chips-all');
        let pop = null;
        const close = () => { if (pop) pop.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (pop && pop.classList.contains('open')) return close();
            if (!pop) { pop = document.createElement('div'); pop.className = 'ovnav-chips-pop'; pop.setAttribute('role', 'menu'); nav.appendChild(pop); regPanel(pop, 'chips', close); }
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
        try { const sc = document.createElement('script'); sc.id = 'ov-icons-loader'; sc.src = sibling('ov-icons.js'); sc.async = true; document.head.appendChild(sc); } catch { /* */ }
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
        const closeDrawer = () => { if (drawer) drawer.classList.remove('open'); if (burger) burger.setAttribute('aria-expanded', 'false'); };
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
        document.addEventListener('click', (e) => { if (!e.target.closest || !e.target.closest('.ovnav-dd')) nav.querySelectorAll('.ovnav-dd.open').forEach(x => x.classList.remove('open')); }, onDocument());
        // Dropdowns hang below the links row, which scrolls sideways and would clip them: fixed, under the link (less a filtered bar's offset).
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
            burger.addEventListener('click', (e) => { e.stopPropagation(); const open = drawer.classList.toggle('open'); burger.setAttribute('aria-expanded', String(open)); if (open) loadOvIcons(drawer); });
            drawer.addEventListener('click', (e) => {
                const all = e.target.closest && e.target.closest('[data-open-launcher]'); if (!all) return;
                e.preventDefault(); e.stopPropagation(); closeDrawer();
                openSearch('', 'sites');
            });
            document.addEventListener('click', (e) => { if (drawer.classList.contains('open') && !drawer.contains(e.target) && !burger.contains(e.target)) closeDrawer(); }, onDocument());
            regPanel(drawer, 'nav-drawer', closeDrawer);
        }
    }

    /** Dropdown, launcher and notifications share one coordinator (panels.js): one open at a time, Escape, rotation.
     *  Panels are registered where they are created (no page-wide observers); registrations queue until the script loads. */
    const _panelQueue = [];
    function regPanel(el, id, close) {
        if (!el) return;
        const opts = Object.assign({ el, openClass: 'open', id, close }, onDocument());
        if (root.OpenVibePanels) return root.OpenVibePanels.register(opts);
        _panelQueue.push(opts);
        if (document.getElementById('ov-panels-loader')) return;
        const sc = document.createElement('script'); sc.id = 'ov-panels-loader'; sc.src = sibling('panels.js'); sc.async = true;
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
        if (both && 'vibes' in both) { if (both.vibes != null) showVibes(Number(both.vibes)); return; }
        // An older Network: Billing itself (409 until it is the ledger: no chip then).
        await fetch(`${_config.billingBase || 'https://billing.openvibe.network'}/api/me/vibes`, { headers: auth, credentials: 'omit' })
            .then(async (r) => { if (r.ok) showVibes(Number((await r.json()).credit)); }).catch(() => {});
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
                + `<div class="ovnav-net-grid">${pick.map(n => `<a class="ovnav-net" href="${escapeAttr(n.url)}" title="${escapeAttr(n.tagline)}"><span class="ov-icon" data-icon="${escapeAttr(n.icon || n.id)}" data-size="22" data-fx="none"></span><span>${escapeAttr(n.name)}</span></a>`).join('')}</div>`;
        }
        return `<span class="ovnav-sep" aria-hidden="true"></span>` + pick.map(n => `<a class="ovnav-net" href="${escapeAttr(n.url)}" title="${escapeAttr(n.tagline)}">${escapeAttr(n.name)}</a>`).join('');
    }

    /** Display settings for guests, at the foot of the phone menu (members have them in the account menu); theme-loader.js owns the state. */
    function bindDisplayControls(box) {
        const L = root.OpenVibeThemeLoader; if (!box || !L || !L.display) return;
        const paint = () => {
            const d = L.display.get();
            const seg = (key, val, label, title) => `<button type="button" data-k="${key}" data-v="${val}" aria-pressed="${String(d[key]) === val}" title="${title}">${label}</button>`;
            const sch = L.scheme ? L.scheme.get() : null;
            const ss = (val, label, title) => `<button type="button" data-s="${val}" aria-pressed="${sch === val}" title="${title}">${label}</button>`;
            box.innerHTML = `<span class="ovnav-dl">Display</span>${sch ? `<span class="ovnav-seg" role="group" aria-label="Light or dark">${ss('light', 'Light', 'Light theme')}${ss('dark', 'Dark', 'Dark theme')}${ss('auto', 'Auto', 'Follow this device')}</span>` : ''}<span class="ovnav-seg" role="group" aria-label="Text size">${seg('text', '100', 'A', 'Default text size')}${seg('text', '112', 'A+', 'Larger text')}${seg('text', '125', 'A++', 'Largest text')}</span>
                <span class="ovnav-seg" role="group" aria-label="Motion">${seg('motion', 'auto', 'Motion', 'Animations on')}${seg('motion', 'reduced', 'Calm', 'Reduce animations')}</span>${seasonState() ? `<span class="ovnav-seg" role="group" aria-label="Seasonal themes">${seg('seasonal', 'on', seasonState().s.name, 'Seasonal themes on')}${seg('seasonal', 'off', 'Off', 'Seasonal themes off')}</span>` : ''}<a href="https://openvibe.design/look" data-ov-look-open aria-expanded="false">Look</a><div class="ud-look" hidden></div>`;
            box.hidden = false;
        };
        box.addEventListener('click', (e) => {
            const s2 = e.target.closest('button[data-s]'); if (s2 && L.scheme) { L.scheme.set(s2.dataset.s); paint(); return; }
            const b = e.target.closest('button[data-k]'); if (!b) return; L.display.set({ [b.dataset.k]: b.dataset.v }); paint();
        });
        if (typeof root.addEventListener === 'function') { root.addEventListener('ov:theme', paint, onDocument()); root.addEventListener('ov:display', paint, onDocument()); }
        paint();
    }

    // ── Notification bell (mounted by the navbar itself) ─────
    function mountBell(nav, u) {
        if (_config.notifications === false || !u || u.is_anon || !_config.token) return;
        const mount = nav.querySelector('#openvibe-bell-mount'); if (!mount || mount.childElementCount) return;
        const go = () => {
            const N = root.OpenVibeNotifications; if (!N || mount.childElementCount) return;
            try { if (!N.__ovNavInit) { N.init({ token: _config.token, apiBase: 'https://openvibe.network', realtime: _config.notificationsRealtime === true }); N.__ovNavInit = true; } N.createBell(mount); } catch { /* */ }
        };
        if (root.OpenVibeNotifications) return go();
        if (document.getElementById('ov-notify-loader')) return;
        const sc = document.createElement('script'); sc.id = 'ov-notify-loader'; sc.src = sibling('notification-ui.js'); sc.async = true; sc.onload = () => setTimeout(go, 0); document.head.appendChild(sc);
    }

    // ── The Dock (Dock plan K-D1): your agents and activity at the screen's edge. dock.js draws its pill and the Dock;
    // for a signed-in person it loads after the bell, from beside this file. A Network without the route yet (dock.js
    // keeps { off } for a day) is not asked again. dockApiBase and dockChatBase override the Network and Chat (tests, staging).
    const dockBase = () => String(_config.dockApiBase || 'https://openvibe.network').replace(/\/+$/, '');
    const dockOpts = () => ({ token: () => _config.token, apiBase: dockBase(), chatBase: _config.dockChatBase, me: _config.user && _config.user.username, sibling });
    const DOCK_GLYPH = '<svg class="ovnav-ic" viewBox="0 0 512 512" style="width:1em" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M80 64h352a48 48 0 0 1 48 48v288a48 48 0 0 1-48 48H80a48 48 0 0 1-48-48V112a48 48 0 0 1 48-48Zm8 56v272h336V120ZM264 312h112a28 28 0 0 1 0 56H264a28 28 0 0 1 0-56Z"/></svg>';
    function loadDock(then) {
        if (root.OpenVibeDock) return then();
        let sc = document.getElementById('ov-dock-loader');
        if (!sc) { sc = document.createElement('script'); sc.id = 'ov-dock-loader'; sc.src = sibling('dock.js'); sc.async = true; document.head.appendChild(sc); }
        sc.addEventListener('load', () => setTimeout(() => { try { then(); } catch { /* */ } }, 0));
    }
    function mountDock(u) {
        const on = _config.dock !== false && !!u && !u.is_anon && !!_config.token;
        if (root.OpenVibeDock) return root.OpenVibeDock.mount(on ? dockOpts() : null);
        try { const k = JSON.parse(localStorage.getItem('ov-dock') || 'null'); if (!on || (k && k.off > Date.now())) return; } catch { if (!on) return; }
        loadDock(() => root.OpenVibeDock.mount(dockOpts()));
    }
    /** Open the Dock on a tab: 'agent' | 'activity'. */
    function openDock(tab) { loadDock(() => { root.OpenVibeDock.mount(dockOpts()); root.OpenVibeDock.open({ tab }); }); }

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

    /** One top-level link. Supports { label, href, icon, id, elId, page, hidden, external, dot, dotId, children: [...] }. */
    function linkHTML(l, inDrawer) {
        const attrs = `${l.id ? ` data-link-id="${escapeAttr(l.id)}"` : ''}${l.elId ? ` id="${escapeAttr((inDrawer ? 'drawer-' : '') + l.elId)}"` : ''}${l.page ? ` data-page="${escapeAttr(l.page)}"` : ''}${l.hidden ? ' hidden' : ''}${l.external ? ' target="_blank" rel="noopener"' : ''}`;
        const kids = Array.isArray(l.children) ? l.children.filter(Boolean) : [];
        const inner = `${l.icon ? `<span class="icon">${navIcon(l.icon)}</span>` : ''}<span class="ovnav-l">${escapeAttr(l.label)}</span>${l.dot !== undefined ? `<span class="ovnav-dot"${l.dotId && !inDrawer ? ` id="${escapeAttr(l.dotId)}"` : ''}${l.dot ? '' : ' hidden'}></span>` : ''}`;
        const a = `<a href="${escapeAttr(l.href || '#')}" class="ovnav-link${l.active ? ' active' : ''}"${attrs}>${inner}${kids.length && !inDrawer ? '<span class="ovnav-caret" aria-hidden="true">▾</span>' : ''}</a>`;
        if (!kids.length) return a;
        const menu = kids.map(k => `<a href="${escapeAttr(k.href || '#')}" class="ovnav-link ovnav-sublink"${k.id ? ` data-link-id="${escapeAttr(k.id)}"` : ''}${k.hidden ? ' hidden' : ''}>${k.icon ? `<span class="icon">${navIcon(k.icon)}</span>` : ''}<span class="ovnav-l">${escapeAttr(k.label)}</span></a>`).join('');
        return inDrawer ? a + menu : `<div class="ovnav-dd"${l.hidden ? ' hidden' : ''}>${a}<div class="ovnav-dd-menu">${menu}</div></div>`;
    }
    const flatLinks = (list) => list.reduce((out, l) => out.concat([l], Array.isArray(l.children) ? l.children : []), []);

    function currentLinks() {
        const list = _runtimeLinks || _config.links || SERVICE_LINKS[_config.service] || [];
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
                    if (user && (user.username || user.id)) return { user, token: null };
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
            const sc = document.createElement('script'); sc.async = true; sc.src = sibling('sso-client.js');
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
     * Signed in to the network but not here: the 'account' hint cookie goes straight to the silent sign-in (one quick
     * redirect); otherwise a hidden iframe asks GET /sso/check and redirects only on yes (partitioned cookies: no).
     * At most once per tab per 10 minutes; never after a sign-out ('guest'); never for bots.
     */
    function maybeSilentLogin() {
        if (!_config.silentLogin || typeof location === 'undefined') return false;
        const hint = ssoHint();
        if (hint === 'guest') return false;
        if (/bot|crawl|spider|slurp|headless/i.test(navigator.userAgent || '')) return false;
        if (/[?&]sso=none\b/.test(location.search)) return false;
        try {
            const last = +sessionStorage.getItem('ov_silent_sso_at') || 0;
            if (Date.now() - last < 10 * 60 * 1000) return false;
            sessionStorage.setItem('ov_silent_sso_at', String(Date.now()));
        } catch { return false; }
        if (hint === 'account') return silentLoginNow();
        checkNetworkSession().then((state) => {
            if (state && state.signedIn) return silentLoginNow();
            // No answer or "not signed in" — either a guest, or a browser that keeps the network's
            // cookie away from iframes. FedCM asks the browser itself; the network's login status
            // makes it a no-op for guests, a native chip (then silent re-auth) for signed-in users.
            if (_config.fedcm === false) return;
            loadSsoClient().then(async (sso) => {
                if (!sso || !sso.fedcmAvailable()) return;
                const r = await sso.fedcm({ apiBase: _config.apiBase, fedcmLogin: _config.fedcmLogin || undefined, mediation: _config.fedcm === 'silent' ? 'silent' : 'optional' });
                if (r && r.ok) { try { sessionStorage.removeItem('ov_silent_sso_at'); } catch { /* */ } location.reload(); }
            });
        });
        return false;
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
            sc.src = sibling('history.js');
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
        return `<img class="${escapeAttr(className)}" src="${escapeAttr(src)}"${retry} data-fallback-src="${escapeAttr(fallback)}" alt="${alt}"${idAttr}>`;
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
        { id: 'coins', icon: 'fa-coins', tone: 'gold', label: 'OpenCoins', title: 'OpenCoins', href: 'https://openvibe.network/my#coins' },
        { id: 'vibes', icon: 'fa-wallet', tone: 'green', label: 'Vibes', title: 'Your Vibes', href: 'https://openvibe.live/#vibes' },
    ];
    let _walletFor = null, _walletAt = 0, _walletWatch = false;
    const walletKey = (u) => `ov-wallet:${u.subject || u.id || u.username || ''}`;
    function savedWallet(u) { try { return JSON.parse(localStorage.getItem(walletKey(u)) || '{}') || {}; } catch { return {}; } }
    function syncWalletChips() {
        if (!_config.wallet) return;
        const u = _config.user;
        let chips = (_config.chips || []).filter((c) => !(c && c.__wallet));
        if (u && !u.is_anon) {
            const saved = savedWallet(u), have = new Set(chips.map((c) => c && c.id));
            chips = WALLET_CHIPS.filter((w) => !have.has(w.id)).map((w) => Object.assign({}, w, {
                __wallet: true, value: saved[w.id] == null ? '' : saved[w.id], hidden: saved[w.id] == null,
                onClick: () => { try { root.location.href = w.href; } catch { /* */ } },
            })).concat(chips);
        }
        _config.chips = chips;
    }
    function loadWalletChips() {
        const u = _config.user;
        if (!_config.wallet || !u || u.is_anon || !_config.token || typeof fetch !== 'function') return;
        const key = walletKey(u);
        if (_walletFor === key && Date.now() - _walletAt < 60000) return;
        _walletFor = key; _walletAt = Date.now();
        if (!_walletWatch && typeof document !== 'undefined' && document.addEventListener) {
            _walletWatch = true;
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadWalletChips(); });
        }
        const auth = { Authorization: `Bearer ${_config.token}` };
        const saved = savedWallet(u);
        let shown = false;
        const put = (id, n) => {
            const mine = (_config.chips || []).find((c) => c && c.id === id && c.__wallet);
            if (!mine) return;
            if (n == null) { delete saved[id]; if (!mine.hidden) { mine.hidden = true; shown = true; } return; }
            saved[id] = n.toLocaleString();
            if (mine.hidden) shown = true;
            OpenVibeNavbar.setChip(id, saved[id], { hidden: false });
        };
        const num = (v) => (isFinite(v) ? v : null);
        // Both from the Network (it asks Billing); an older Network without vibes: Billing itself (409 = not the ledger).
        let vibesKnown = false;
        const coins = fetch(`${_config.apiBase}/api/coins/me?with=vibes`, { headers: auth, credentials: 'include' })
            .then(async (r) => { if (!r.ok) return; const j = await r.json(); put('coins', num(Number(j.balance ?? (j.wallet && j.wallet.balance)))); if ('vibes' in j && j.vibes != null) { vibesKnown = true; put('vibes', num(Number(j.vibes))); } });
        const vibes = coins.catch(() => {}).then(() => (vibesKnown ? null : fetch(`${_config.billingBase || 'https://billing.openvibe.network'}/api/me/vibes`, { headers: auth, credentials: 'omit' })
            .then(async (r) => { if (r.ok) put('vibes', num(Number((await r.json()).credit))); else if (r.status === 409) put('vibes', null); })));
        Promise.all([coins.catch(() => {}), vibes.catch(() => {})]).then(() => {
            try { localStorage.setItem(walletKey(u), JSON.stringify(saved)); } catch { /* */ }
            // A chip that appeared or went away changes the folded phone chip: draw the bar once more.
            if (shown && _config.user === u && _navEl) render();
        });
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
        if (_config.glyphs !== false) watchGlyphs(); watchLabels(); watchScrollers();
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
                ${u && !isAnon && _config.messages ? messagesHTML() : ''}
                <div id="openvibe-bell-mount"></div>
                ${u ? avatarImg(u, 64, 'openvibe-navbar-avatar', 'openvibe-avatar-btn') :
                    `<a class="openvibe-navbar-login" id="openvibe-login-btn" href="${escapeAttr(loginHref)}">Sign In</a>`}
                ${links.length ? '<button type="button" class="ovnav-burger" id="openvibe-burger" aria-label="Menu" aria-haspopup="true" aria-expanded="false"><span></span><span></span><span></span></button>' : ''}
            </div>
            ${links.length ? `<div class="ovnav-drawer" id="openvibe-drawer" role="menu">${links.map(l => linkHTML(l, true)).join('')}<div class="ovnav-drawer-net">${networkLinksHTML(links, true)}</div>${u ? '' : '<div class="ovnav-display" hidden></div>'}</div>` : ''}
        `;
        if (_config.className) String(_config.className).split(/\s+/).filter(Boolean).forEach(c => nav.classList.add(c));
        bindLinks(nav, links);
        bindMessages(nav);
        hookSearch(nav);
        hookSwitcher(nav);
        bindChips(nav);
        bindChipsAll(nav);
        queueIcons();
        queueFx();
        countView();
        // Pages that wire the bell themselves run right after init(); give them the first go.
        setTimeout(() => { mountBell(nav, u); mountDock(u); }, 0);

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

            // The menu (4.23.0, the owner 2026-10-28: "more compactness… data-driven"): you, with + and the gear; your
            // places as icons in the order you use them (eight, then More); the site's sections; one row for light/dark,
            // text size, motion, themes and sign out. Notifications are the bell's; history and Ask Vibe, search's.
            const bell = _config.notifications !== false && !!_config.token && !isAnon;
            const places = before.concat(after).filter((it) => it && !it.sep).concat(menuCfg.defaults === false ? [] : [
                !isAnon && u.username ? { id: 'ov-channel', label: 'My channel', short: 'Channel', drawn: navIcon('fa-tower-broadcast'), href: `https://openvibe.live/@${encodeURIComponent(u.username)}` } : null,
                { id: 'ov-history', label: 'History', drawn: navIcon('fa-clock-rotate-left'), href: 'https://openvibe.network/my#history' },
                bell ? null : { id: 'ov-notifications', label: 'Notifications', short: 'Alerts', drawn: navIcon('fa-bell'), href: 'https://openvibe.network/my#notifications' },
                !isAnon ? { id: 'ov-ask', label: 'Ask Vibe', drawn: navIcon('fa-brain'), href: 'https://openvibe.chat/vibe', mark: 'data-ov-ask' } : null,
                !isAnon ? { id: 'ov-work', label: 'Work together', short: 'Work', drawn: navIcon('fa-people-group'), href: 'https://openvibe.chat/work', mark: 'data-ov-work' } : null,
                bell && _config.dock !== false ? { id: 'ov-dock', label: 'The Dock: your agents and activity on every page', short: 'Dock', drawn: DOCK_GLYPH, mark: 'data-ov-dock' } : null,
                admin ? { id: 'ov-admin', label: 'Admin', drawn: navIcon('fa-shield-halved'), href: 'https://openvibe.network/admin' } : null,
            ].filter(Boolean));
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
                        <button type="button" class="ud-ib ud-txt" data-ov-display="text" title="Text size" aria-label="Text size"><span class="icon">${navIcon('fa-text-height')}</span><b class="ud-val"></b></button>
                        <button type="button" class="ud-ib" data-ov-display="motion" title="Animations" aria-label="Animations"><span class="icon">${navIcon('fa-wand-magic-sparkles')}</span><b class="ud-val"></b></button>
                        <a class="ud-ib" href="https://openvibe.design/look" data-ov-look-open aria-expanded="false" title="Look: themes, the season, and more on openvibe.design" aria-label="Look"><span class="icon">${navIcon('fa-palette')}</span></a>
                    </div>
                    <div class="ud-look" hidden></div>
                </div>
            `;
            dropdown.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('[data-use]'); if (t) countUse(t.getAttribute('data-use')); });
            nav.appendChild(dropdown);
            bindMenuItems(dropdown, before.concat(after, sectionItems(menuCfg.sections)));
            dropdown.addEventListener('click', (e) => { if (!e.target.closest || !e.target.closest('[data-ov-dock]')) return; dropdown.classList.remove('open'); openDock(); });
            bindChips(dropdown);
            if (typeof _config.onNavigate === 'function') dropdown.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented || a.target === '_blank' || e.metaKey || e.ctrlKey) return; const path = sitePath(a); if (path != null) { if (_config.onNavigate(path, e) === false) e.preventDefault(); dropdown.classList.remove('open'); } });
            bindDisplayRows(dropdown);
            bindLook(dropdown);
            regPanel(dropdown, 'user-menu');

            // Avatar click toggles dropdown (the selection for Ask Vibe is read on pointerdown: the press can clear it)
            const avatarBtn = nav.querySelector('#openvibe-avatar-btn'); let sel = null;
            avatarBtn.addEventListener('pointerdown', () => { sel = selectedText(); });
            avatarBtn.addEventListener('click', () => {
                dropdown.classList.toggle('open');
                const ask = dropdown.querySelector('[data-ov-ask]'); if (ask) ask.href = askVibeHref(sel ?? selectedText()); sel = null;
                if (dropdown.classList.contains('open')) { loadWallet(dropdown); dropdown.scrollTop = 0; loadOvIcons(dropdown); }
            });

            // Close on outside click
            document.addEventListener('click', e => {
                if (!nav.contains(e.target)) dropdown.classList.remove('open');
            }, onDocument());

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
            mount.appendChild(nav);
        } else {
            document.body.prepend(nav);
        }
        _navEl = nav;
        attachAvatarFallbacks(nav);
        hookTop();
        loadWalletChips();
        renderAppBar();
        return nav;
    }

    // ── The phone app bar (appbar.js, loaded only when the site sets appBar): its main places as a bottom tab bar ──
    let _appBarLoading = false;
    const rawLinks = () => _runtimeLinks || _config.links || SERVICE_LINKS[_config.service] || [];

    // Search (search.js, loaded on first use). _config.search: false, or { owner, label, page }.
    let _searchLoading = false;
    /** The OpenVibe menu (search.js, loaded on first use): search, every site and every tool. tab: 'you' | 'sites' | 'tools'. */
    function openSearch(q, tab) {
        const orb = _navEl && _navEl.querySelector('#openvibe-search-btn');
        // The menu drops from the orb, under the bar (the bar stays, and the orb's × closes it).
        const anchor = () => {
            if (!_navEl || !orb || !orb.getBoundingClientRect) return null;
            const bar = _navEl.getBoundingClientRect(), at = orb.getBoundingClientRect();
            return bar.bottom > 0 && bar.bottom < 200 ? { top: bar.bottom, left: at.left - 6 } : null;
        };
        const go = () => {
            if (orb) orb.classList.remove('is-busy');
            if (!root.OpenVibeSearch) return;
            if (_navEl) _navEl.classList.remove('ovnav-hide');
            root.OpenVibeSearch.open({ service: _config.service, scope: Object.assign({ owner: _config.service }, _config.search || {}), links: flatLinks(rawLinks()), q, tab,
                frame: OVFrame.get(), token: _config.token, apiBase: _config.apiBase, user: _config.user, icons: (scope) => loadOvIcons(scope), anchor: anchor(), navIcon,
                onClose: () => { const b = _navEl && _navEl.querySelector('#openvibe-search-btn'); if (b) b.setAttribute('aria-expanded', 'false'); } });
            const b = _navEl && _navEl.querySelector('#openvibe-search-btn'); if (b) b.setAttribute('aria-expanded', 'true');
        };
        if (root.OpenVibeSearch) return go();
        if (_searchLoading) return;
        _searchLoading = true;
        if (orb) orb.classList.add('is-busy');
        try { const sc = document.createElement('script'); sc.src = sibling('search.js'); sc.async = true; sc.onload = go; sc.onerror = () => { _searchLoading = false; if (orb) orb.classList.remove('is-busy'); }; document.head.appendChild(sc); } catch { _searchLoading = false; }
    }
    const menuOpen = () => !!(typeof document !== 'undefined' && document.querySelector && document.querySelector('.ovs.is-open'));

    // ── The site switcher (site-switcher.js, 4.48.0): the OpenVibe mark opens a compact grid of every site ──
    // Recent and pinned follow the account (Network /api/themes/me/sites) when signed in; the name stays the home link.
    let _switcherLoading = false;
    function openSwitcher() {
        const btn = _navEl && _navEl.querySelector('#openvibe-switch-btn');
        const anchor = () => {
            if (!_navEl || !btn || !btn.getBoundingClientRect) return null;
            const bar = _navEl.getBoundingClientRect(), at = btn.getBoundingClientRect();
            return bar.bottom > 0 && bar.bottom < 200 ? { top: bar.bottom, left: at.left - 6 } : null;
        };
        const go = () => {
            const S = root.OpenVibeSiteSwitcher;
            if (!S) return;
            if (menuOpen() && root.OpenVibeSearch) root.OpenVibeSearch.close();
            if (_navEl) _navEl.classList.remove('ovnav-hide');
            S.open({ service: _config.service, frame: OVFrame.get((d) => S.update(d)), token: _config.token, apiBase: 'https://openvibe.network', user: _config.user,
                icons: (scope) => loadOvIcons(scope), anchor: anchor(),
                onClose: () => { const b = _navEl && _navEl.querySelector('#openvibe-switch-btn'); if (b) b.setAttribute('aria-expanded', 'false'); } });
            const b = _navEl && _navEl.querySelector('#openvibe-switch-btn'); if (b) b.setAttribute('aria-expanded', 'true');
        };
        if (root.OpenVibeSiteSwitcher) return go();
        if (_switcherLoading) return;
        _switcherLoading = true;
        try { const sc = document.createElement('script'); sc.src = sibling('site-switcher.js'); sc.async = true; sc.onload = go; sc.onerror = () => { _switcherLoading = false; }; document.head.appendChild(sc); } catch { _switcherLoading = false; }
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
    function hookSwitcher(nav) {
        const b = nav.querySelector('#openvibe-switch-btn');
        if (!b) return;
        b.addEventListener('click', () => { if (root.OpenVibeSiteSwitcher && root.OpenVibeSiteSwitcher.isOpen()) root.OpenVibeSiteSwitcher.close(); else openSwitcher(); });
        for (const ev of ['pointerenter', 'touchstart', 'focus']) b.addEventListener(ev, () => { loadOvIcons(); OVFrame.get(); }, { once: true, passive: true });
        if (root.OpenVibeSiteSwitcher && root.OpenVibeSiteSwitcher.isOpen()) b.setAttribute('aria-expanded', 'true');
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
            const orbNow = () => _navEl && _navEl.querySelector && _navEl.querySelector('#openvibe-search-btn');
            if (!seen && b.classList) { _orbIntro = true; setTimeout(() => { const o = orbNow(); if (o) o.classList.add('ovo-intro'); setTimeout(() => { const o2 = orbNow(); if (o2) o2.classList.remove('ovo-intro'); }, 1100); }, 700); }
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
        try { const sc = document.createElement('script'); sc.src = sibling('appbar.js'); sc.async = true; sc.onload = () => renderAppBar(); document.head.appendChild(sc); } catch { /* no bar */ }
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
                sr.textContent = JSON.stringify({ prefetch: [{ where: { and: [{ href_matches: '/*' }, { not: { href_matches: ['/auth/*', '/api/*', '/logout*', '/*logout*', '/signout*', '/internal/*', '/*.zip', '/*.pdf'] } }, { not: { selector_matches: '[data-no-prefetch], [download], [rel~=nofollow]' } }] }, eagerness: 'moderate' }] });
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

        init(opts = {}) {
            Object.assign(_config, opts);
            injectStyles();
            hookBoost();
            hookMoves();
            const el = render();
            upgradeIconsWhenFontsReady();
            if (typeof document !== 'undefined') setTimeout(loadReleaseWatch, 4000);
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

        /** Messages beside the bell: messages: { href?, onOpen?(), label? } in init (or here), and the unread count. */
        setMessages(count, spec) {
            if (spec !== undefined) { _config.messages = spec; if (_navEl) render(); }
            _msgCount = Math.max(0, Number(count) || 0);
            const b = typeof document !== 'undefined' && document.querySelector('#openvibe-messages-btn b');
            if (b) { b.textContent = _msgCount ? (_msgCount > 99 ? '99+' : String(_msgCount)) : ''; b.parentElement.setAttribute('aria-label', msgLabel()); }
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
        setUser(user, token) { _config.user = user || null; if (token !== undefined) _config.token = token; _walletLoaded = false; return render(); },
        /** Single-page apps: mark the link whose `page` matches as active. */
        setActive(page) { _activePage = page || null; renderAppBar(); if (!_navEl) return; _navEl.querySelectorAll('.ovnav-link[data-page]').forEach(a => a.classList.toggle('active', a.getAttribute('data-page') === _activePage)); },
        /** Change a status chip's text (navbar and menu header): setChip('coins', '1,234'). */
        setChip(id, value, patch) {
            const lists = [_config.chips || [], (_config.menu && _config.menu.headerChips) || []];
            lists.forEach(l => l.forEach(c => { if (c && c.id === id) { c.value = value; if (patch) Object.assign(c, patch); } }));
            document.querySelectorAll(`[data-chip-id="${id}"]`).forEach(el => { const v = el.querySelector('.ovnav-chip-v'); if (v) v.textContent = value == null ? '' : String(value); if (patch && 'hidden' in patch) el.hidden = !!patch.hidden; });
            document.querySelectorAll(`[data-chip-mini="${id}"] .ovnav-chip-mv`).forEach(el => { el.textContent = shortValue(value); });
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

        /** Open the Dock (your agents and activity), on a tab: 'agent' | 'activity'. Signed-in people only. */
        openDock(tab) { if (_config.token && _config.dock !== false) openDock(tab); },

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
        _wallet: { loadWallet, configure: (c) => { Object.assign(_config, c); _walletLoaded = false; } },
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = OpenVibeNavbar;
    else root.OpenVibeNavbar = OpenVibeNavbar;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
