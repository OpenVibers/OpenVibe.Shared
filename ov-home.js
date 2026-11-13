// ═══════════════════════════════════════════════════════════════
// OpenVibe — the menu's home screen and wall (plan 2026-11-09, ~/openvibe/OpenVibe_Menu_Home_Feed_Plan_2026-11-09.md)
//
// search.js loads this the first time the You or Feed tab paints (a sibling, by content hash) and hands it an
// element and what it knows:
//   OpenVibeHome.home(el, o)       You: your Actor, Recent, your Home grid (long-press or Edit, drag to arrange,
//                                  folders), All apps (the drawer)
//   OpenVibeHome.wallTop(el, o)    Feed: what's new with you (the composer, when Community says you can post) and
//                                  today's numbers
//   OpenVibeHome.timeline(el, o)   Feed: the network's wall, newest first, "Show more"
//
// The owner, 11-09: "make it more like a phone… hold down on an icon and move it around, just like on Android or
// iOS… the most popular sites until you set it up… recent apps at the top… tools as a folder of apps… the Actor
// built in… the feed more like a Facebook wall… who went live recently… how many people today".
//
// The arrangement is kept on this device (localStorage ovs-home) and, signed in, on Network
// (GET/PUT /api/v1/me/home-screen, network.home-screen@1); Network's copy wins when it answers. Everything a person or
// a site wrote is set as text; links are https or same-site only. No spinners: grey bars hold the place of what loads.
// ═══════════════════════════════════════════════════════════════
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeHome) return;

    const HOME_KEY = 'ovs-home';
    const INVITE_KEY = 'ovs-actor-invite';
    const LONG_MS = 450;
    const ARM_MS = 200;           // in Edit, a finger holds an app this long before it moves it (a quicker swipe scrolls)
    const HOME_MAX = 40;
    const ACTOR = 'https://openvibe.actor';
    // The Feed, the wall and the composer go through Network's frame relay (/api/frame/feed, /wall, /status): every
    // site's connect-src lets the navbar reach openvibe.network and refuses openvibe.community (11-09: the Feed fell back
    // to its old sections on every site but five). o.frameBase overrides it (tests, staging).
    const FRAME = 'https://openvibe.network/api/frame';

    // Nothing in, nothing out: an empty value resolved against the page would be the page's own address (a card with no
    // picture drew a broken image of the page itself, 11-09).
    const safe = (u) => { if (u == null || String(u).trim() === '') return null; try { const x = new URL(String(u), location.href); return x.protocol === 'https:' || x.origin === location.origin ? x.href : null; } catch { return null; } };
    const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const ago = (iso) => {
        // A time without a zone is UTC (see search.js utcOf).
        const v = String(iso || ''); const t = Date.parse(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(:\d\d(\.\d+)?)?$/.test(v) ? `${v.replace(' ', 'T')}Z` : v); if (!t) return '';
        const s = Math.max(1, Math.round((Date.now() - t) / 1000));
        if (s < 60) return 'now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`;
        const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`;
    };
    const num = (n) => { const v = Number(n) || 0; return v >= 10000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : v.toLocaleString('en-US'); };

    function styles() {
        if (document.getElementById('ovh-styles')) return;
        const st = document.createElement('style');
        st.id = 'ovh-styles';
        st.textContent = `
.ovh { list-style: none; padding: 2px 4px 6px; }
.ovh-sec { display: flex; align-items: center; gap: 8px; padding: 10px 6px 4px; font-size: 11px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--text-muted, #93a0b4); }
.ovh-sec > span { flex: 1; }
.ovh-sec button, .ovh-link { min-height: 36px; padding: 0 10px; border: 0; border-radius: 999px; background: transparent; color: var(--accent, #3b82f6); font: inherit; font-size: 13px; font-weight: 700; letter-spacing: 0; text-transform: none; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.ovh-sec button.is-done { background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); }
.ovh-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 2px; }
@media (min-width: 400px) { .ovh-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (min-width: 861px) { .ovh-grid { grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); } }
.ovh-grid { position: relative; }
/* Home fills its width (owner, 11-09: "offset … use more of the space"): the tile grows with its cell up to 72 px,
   its glyph is about half the tile, folders scale their four with it, and the grid lines up with the cards above. */
.ovh-grid:not(.ovh-recent) { gap: 4px 2px; padding: 2px 0 0; justify-items: stretch; }
.ovh-grid:not(.ovh-recent) .ovh-app { min-height: 0; padding: 6px 0 8px; gap: 7px; }
.ovh-grid:not(.ovh-recent) .ovh-ic, .ovh-own-apps .ovh-ic { width: min(100% - 12px, 72px); height: auto; aspect-ratio: 1; border-radius: 29%; }
.ovh-ic > .ov-icon { --ovi-size: 74.4%; display: grid; place-items: center; }
.ovh-ic > .ov-icon svg { width: 100%; height: 100%; }
.ovh-grid:not(.ovh-recent) .ovh-folder .ovh-ic { grid-template-columns: repeat(2, 36%); grid-auto-rows: 36%; gap: 7%; place-content: center; }
.ovh-grid:not(.ovh-recent) .ovh-folder .ovh-ic > span { width: 100%; height: 100%; border-radius: 30%; }
.ovh-grid:not(.ovh-recent) .ovh-folder .ovh-ic > span .ov-icon { display: grid; place-items: center; width: 100%; height: 100%; }
.ovh-grid:not(.ovh-recent) .ovh-folder .ovh-ic > span .ov-icon svg { width: 150%; height: 150%; }
.ovh-grid:not(.ovh-recent) .ovh-name { font-size: 12.5px; color: var(--text-primary, #e8ecf3); opacity: .86; }
.ovh-sec .ovh-edit { display: inline-grid; place-items: center; width: 36px; min-height: 36px; padding: 0; border-radius: 50%;
    background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); color: var(--text-secondary, #a8b3c4); }
.ovh-sec .ovh-edit svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ovh-sec .ovh-edit:hover { color: var(--text-primary, #e8ecf3); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 13%, transparent); }
.ovh-sec .ovh-edit.is-done { display: inline-flex; gap: 6px; width: auto; padding: 0 14px 0 11px; border-radius: 999px; background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); }
.ovh-sec .ovh-edit:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
@media (pointer: coarse) { .ovh-sec .ovh-edit { width: 44px; min-height: 44px; } .ovh-sec .ovh-edit.is-done { width: auto; } }
.ovh.is-edit .ovh-grid:not(.ovh-recent) { touch-action: pan-y; -webkit-user-select: none; user-select: none; }
.ovh-recent .ovh-app { min-height: 80px; }
.ovh-app { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; min-height: 88px; padding: 8px 2px 6px; border: 0; border-radius: 16px;
    background: transparent; color: inherit; font: inherit; text-decoration: none; cursor: pointer; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.ovh-app:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: -2px; }
.ovh-ic { position: relative; display: grid; place-items: center; width: 56px; height: 56px; border-radius: 17px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 6%, transparent);
    box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.1)); transition: transform .18s cubic-bezier(.2,1.4,.4,1); }
.ovh-recent .ovh-ic { width: 48px; height: 48px; border-radius: 15px; }
/* App icons: the ring goes, the glyph fills the tile, each app keeps its own hue (11-09). */
.ovh-grid .ovh-ic, .ovh-own-apps .ovh-ic, .ovh-recent .ovh-ic, .ovh-card .ovh-ic, .ovh-key .ovh-ic { background: linear-gradient(150deg, hsl(var(--ovh-h, 215) 72% 58% / .34), hsl(var(--ovh-h, 215) 70% 38% / .18)); box-shadow: inset 0 0 0 1px hsl(var(--ovh-h, 215) 70% 64% / .28), 0 4px 14px hsl(var(--ovh-h, 215) 70% 30% / .18); overflow: hidden; }
.ovh-ic .ovi-ring, .ovh-ic .ovi-bg, .ovh-ic .ovi-comet, .ovh-ic .ovi-prog { display: none; }
.ovh-ic .ov-icon { --ovi-glyph: hsl(var(--ovh-h, 215) 90% 82%); color: hsl(var(--ovh-h, 215) 90% 82%); }
:root[data-theme="light"] .ovh-ic .ov-icon { --ovi-glyph: hsl(var(--ovh-h, 215) 70% 32%); color: hsl(var(--ovh-h, 215) 70% 32%); }
.ovh-folder .ovh-ic { background: color-mix(in srgb, var(--text-primary, #e8ecf3) 7%, transparent); grid-template-columns: repeat(2, 22px); grid-auto-rows: 22px; gap: 3px; }
.ovh-folder .ovh-ic > span { width: 22px; height: 22px; border-radius: 7px; overflow: hidden; background: hsl(var(--ovh-h, 215) 70% 50% / .3); }
.ovh-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 650; color: var(--text-secondary, #a8b3c4); }
.ovh-folder .ovh-ic { display: grid; grid-template-columns: repeat(2, 18px); grid-auto-rows: 18px; gap: 4px; place-content: center; }
.ovh-folder .ovh-ic > span { display: grid; place-items: center; width: 18px; height: 18px; }
.ovh-glyph { display: grid; place-items: center; width: 100%; height: 100%; }
.ovh-glyph svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; color: var(--accent, #3b82f6); }
.ovh-badge { position: absolute; top: -6px; left: -6px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 0; padding: 0; cursor: pointer;
    background: var(--bg-tertiary, #2a3140); color: var(--text-primary, #e8ecf3); font: 700 16px/1 system-ui, sans-serif; box-shadow: 0 0 0 2px var(--bg-secondary, #141a24); }
.ovh-badge::after { content: ""; position: absolute; inset: -10px; }
.ovh-badge.is-add { background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); }
.ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-app { touch-action: pan-y; }
.ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-ic { animation: ovh-wiggle .32s ease-in-out infinite alternate; }
.ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-app:nth-child(2n) .ovh-ic { animation-delay: -.16s; }
.ovh-app.is-lifted { opacity: .18; transform: scale(.92); }
.ovh-app.is-armed .ovh-ic { transform: scale(1.1); box-shadow: 0 12px 26px -10px rgba(0, 0, 0, .7); transition: transform .18s cubic-bezier(.34, 1.56, .64, 1); }
.ovh-ghost .ovh-ic { width: 64px; height: 64px; border-radius: 19px; }
html[data-ov-motion=reduced] .ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-ic { animation-name: ovh-wiggle-calm !important; }
@keyframes ovh-wiggle-calm { from { transform: rotate(-.6deg); } to { transform: rotate(.6deg); } }
.ovh-ghost { position: fixed; z-index: 10040; pointer-events: none; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 19px; display: grid; place-items: center;
    background: var(--bg-secondary, #141a24); box-shadow: 0 12px 30px rgba(0,0,0,.35), inset 0 0 0 1px var(--border, rgba(255,255,255,.14)); transform: scale(1.08); }
@keyframes ovh-wiggle { from { transform: rotate(-1.6deg); } to { transform: rotate(1.6deg); } }
.ovh-hint { margin: 10px 6px 4px; font-size: 12.5px; color: var(--text-muted, #93a0b4); }
.ovh-calm { transition: opacity .2s; }
.ovh.is-edit .ovh-calm { opacity: .38; pointer-events: none; }
.ovh-headtools { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.ovh-sec .ovh-allbtn { all: unset; box-sizing: border-box; text-transform: none; letter-spacing: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 11px 0 10px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 700;
  color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 7%, transparent); transition: color .15s, background-color .15s, transform .12s; }
.ovh-sec .ovh-allbtn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ovh-sec .ovh-allbtn b { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--text-primary, #e8ecf3); }
.ovh-sec .ovh-allbtn:hover { color: var(--text-primary, #e8ecf3); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 13%, transparent); }
.ovh-sec .ovh-allbtn:active { transform: scale(.96); }
.ovh-sec .ovh-allbtn:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
@media (pointer: coarse) { .ovh-sec .ovh-allbtn { min-height: 44px; padding: 0 13px 0 12px; } }
.ovh-all[hidden], .ovh[hidden] { display: none !important; }
.ovh-all { display: flex; align-items: center; justify-content: center; gap: 8px; width: calc(100% - 8px); min-height: 44px; margin: 6px 4px 2px; border: 1px solid var(--border, rgba(255,255,255,.12));
    border-radius: 14px; background: transparent; color: var(--text-primary, #e8ecf3); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.ovh-head { display: flex; align-items: center; gap: 8px; padding: 6px 2px; }
.ovh-head b { flex: 1; font-size: 16px; }
/* 4.229.0: a place's head inside You (All apps, a folder): its name, its count and a quiet hint, coming in with the view. */
.ovh-head-t { flex: 1; min-width: 0; display: grid; gap: 1px; animation: ovh-head-in .28s cubic-bezier(.2, .8, .2, 1) both; }
.ovh-head-t b { display: inline-flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 800; letter-spacing: -.01em; color: var(--text-primary, #e6edf7); }
.ovh-head-n { min-width: 24px; padding: 0 8px; box-sizing: border-box; border-radius: 999px; background: color-mix(in srgb, var(--accent, #3b82f6) 18%, transparent); color: var(--accent-light, #93c5fd); font-size: 12.5px; font-weight: 800; line-height: 22px; text-align: center; font-variant-numeric: tabular-nums; }
.ovh-head-t small { font-size: 12.5px; color: var(--text-muted, #8a96a8); }
@keyframes ovh-head-in { from { opacity: 0; transform: translateX(-6px); } }
html[data-ov-motion=off] .ovh-head-t { animation: none; }
.ovh-back { min-height: 44px; padding: 0 12px; border: 0; border-radius: 12px; background: transparent; color: var(--accent, #3b82f6); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.ovh-filter { width: calc(100% - 8px); min-height: 44px; margin: 2px 4px 4px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--border, rgba(255,255,255,.14));
    background: var(--bg-primary, rgba(0,0,0,.2)); color: inherit; font: inherit; font-size: 15px; }
.ovh-actor { box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: calc(100% - 8px); min-height: 64px; margin: 6px 4px 4px; padding: 10px 12px; border-radius: 16px; border: 0; text-align: left; cursor: pointer;
    background: color-mix(in srgb, var(--accent, #3b82f6) 11%, var(--bg-secondary, #141a24)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 28%, transparent); color: inherit; font: inherit; }
.ovh-face { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; overflow: hidden; background: var(--accent, #3b82f6); color: #fff; font-weight: 800; font-size: 17px; }
.ovh-face img { width: 100%; height: 100%; object-fit: cover; }
.ovh-actor-txt { flex: 1; min-width: 0; display: grid; gap: 2px; }
.ovh-actor-txt b { font-size: 14.5px; }
.ovh-actor-txt small { font-size: 12.5px; color: var(--text-secondary, #a8b3c4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovh-chip { display: inline-flex; align-items: center; gap: 5px; margin-left: 6px; font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #a8b3c4); }
.ovh-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted, #8b8b96); }
.ovh-chip.is-working .ovh-dot { background: var(--success, #22c55e); animation: ovh-pulse 1.8s ease-in-out infinite; }
.ovh-chip.is-waiting .ovh-dot { background: var(--warning, #f5a524); }
.ovh-go { flex: none; color: var(--accent, #3b82f6); font-weight: 700; font-size: 13px; }
.ovh-x { flex: none; min-width: 44px; min-height: 44px; border: 0; background: transparent; color: var(--text-muted, #93a0b4); font: inherit; font-size: 12.5px; cursor: pointer; }
@keyframes ovh-pulse { 50% { opacity: .35; } }
.ovh-actor.is-invite { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 10px 12px; padding: 12px 14px; cursor: default; }
.ovh-actor.is-invite .ovh-face { width: 48px; height: 48px; border-radius: 15px; background: linear-gradient(135deg, var(--accent, #3b82f6), color-mix(in srgb, var(--accent, #3b82f6) 45%, #a855f7)); box-shadow: 0 6px 18px color-mix(in srgb, var(--accent, #3b82f6) 35%, transparent); }
.ovh-actor.is-invite .ovh-actor-txt small { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
.ovh-actor.is-invite .ovh-acts { grid-column: 2; display: flex; gap: 8px; }
.ovh-actor.is-invite .ovh-go { display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 999px; background: var(--accent, #3b82f6); color: var(--on-accent, #fff); text-decoration: none; font-size: 13.5px; }
.ovh-actor.is-invite .ovh-x { min-height: 36px; height: 36px; padding: 0 14px; border-radius: 999px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 7%, transparent); color: var(--text-secondary, #a8b3c4); font-weight: 600; }
@media (min-width: 560px) { .ovh-actor.is-invite { grid-template-columns: 48px minmax(0, 1fr) auto; } .ovh-actor.is-invite .ovh-acts { grid-column: auto; } }
.ovh-skel { display: block; height: 14px; margin: 10px 8px; border-radius: 7px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); }
.ovh-note { margin: 2px 8px 6px; font-size: 12.5px; color: var(--text-muted, #93a0b4); }
.ovh-today { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 4px 4px 6px; }
.ovh-stat { display: grid; gap: 2px; align-content: start; min-width: 0; padding: 10px; border-radius: 14px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent); }
.ovh-stat b { font-size: 18px; font-variant-numeric: tabular-nums; }
.ovh-stat small { font-size: 11.5px; color: var(--text-muted, #93a0b4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovh-stat svg { width: 100%; height: 18px; color: var(--accent, #3b82f6); }
@media (max-width: 380px) { .ovh-today { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ovh-wall { list-style: none; margin: 0; padding: 0; }
.ovh-entry { display: flex; gap: 12px; align-items: flex-start; min-height: 56px; padding: 10px 8px; border-radius: 14px; color: inherit; text-decoration: none; }
.ovh-entry + .ovh-entry { margin-top: 2px; }
@media (hover: hover) { .ovh-entry:hover, .ovh-app:hover { background: var(--bg-hover, rgba(255,255,255,.07)); } }
.ovh-entry .ovh-ic { width: 40px; height: 40px; border-radius: 12px; flex: none; }
.ovh-entry-txt { flex: 1; min-width: 0; display: grid; gap: 3px; }
.ovh-entry-txt b { font-size: 14px; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
.ovh-entry-txt small { font-size: 12px; color: var(--text-muted, #93a0b4); }
.ovh-lives { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.ovh-lives a { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border-radius: 999px; background: color-mix(in srgb, var(--live, #ef4444) 12%, transparent); color: inherit; text-decoration: none; font-size: 13px; font-weight: 650; }
.ovh-lives a::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--live, #ef4444); }

/* You (11-09, the owner: "the U tab still sucks"; 11-10: "Your home should be above Jump back in… the thing at the top
   a little more compact… links to whatever the user uses the most"): you on top in one short bar, with Display and
   Settings beside your name; then your home; then what you use most, as shortcuts under one bar; then where you were
   last, as a rail of cards. */
.ovh-me { display: flex; align-items: center; gap: 6px; margin: 2px 4px 6px; padding: 4px 4px 4px 8px; border-radius: 16px;
    background: radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--accent, #3b82f6) 20%, transparent), transparent 60%), color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 18%, var(--border, rgba(255,255,255,.08))); }
.ovh-who { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; min-height: 44px; border-radius: 12px; color: inherit; text-decoration: none; }
.ovh-av { position: relative; flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--accent, #3b82f6), color-mix(in srgb, var(--accent, #3b82f6) 50%, #a855f7)); color: #fff; font-size: 15px; font-weight: 800; }
.ovh-av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.ovh-av::after { content: ""; position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%; background: var(--success, #22c55e); box-shadow: 0 0 0 2px var(--bg-secondary, #141a24); }
.ovh-who-txt { min-width: 0; display: grid; gap: 0; line-height: 1.25; }
.ovh-who-txt b { overflow-wrap: anywhere; font-size: 15px; font-weight: 800; letter-spacing: -.01em; }
.ovh-who-txt small { overflow-wrap: anywhere; font-size: 12px; color: var(--text-secondary, #a8b3c4); }
.ovh-ib { flex: none; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; text-decoration: none;
    background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); color: var(--text-primary, #e8ecf3); transition: background .16s, color .16s, transform .16s cubic-bezier(.2,1.4,.4,1); }
.ovh-ib svg { display: block; width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ovh-ib[aria-expanded="true"] { background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); }
.ovh-ib:active { transform: scale(.9); }
.ovh-ib:focus-visible, .ovh-who:focus-visible, .ovh-card:focus-visible, .ovh-key:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
@media (hover: hover) { .ovh-ib:hover { background: color-mix(in srgb, var(--text-primary, #e8ecf3) 14%, transparent); } .ovh-ib[aria-expanded="true"]:hover { background: var(--accent-strong, var(--accent, #2563eb)); } }
.ovh-me-look { margin: -2px 4px 8px; }
.ovh-me .ovh-ib { width: 40px; }
.ovh-out:hover { color: var(--danger, #f87171); }
.ovh-own { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 4px 8px; }
.ovh .ovh-own > .ovh-own-i { font-size: 13px; font-weight: 600; line-height: 1; }
.ovh-own-i { display: inline-flex; align-items: center; min-height: 36px; padding: 0 13px; border: 0; border-radius: 999px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 6%, transparent); color: var(--text-secondary, #a8b3c4); font: 600 13px/1 inherit; text-decoration: none; cursor: pointer; transition: background-color .15s, color .15s; }
.ovh-own-i:hover, .ovh-own-i:focus-visible { background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); color: var(--text-primary, #e8ecf3); }
@media (pointer: coarse) { .ovh-own-i { min-height: 44px; } }
.ovh-rail { display: flex; gap: 8px; margin: 0 -2px; padding: 2px 6px 8px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scroll-padding: 0 6px; scrollbar-width: none;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); }
.ovh-rail::-webkit-scrollbar { display: none; }
.ovh-rail.is-end { -webkit-mask-image: none; mask-image: none; }
.ovh-card { position: relative; flex: 0 0 auto; display: grid; grid-template-columns: 40px minmax(0, 1fr); grid-template-rows: auto auto; align-content: center; column-gap: 10px; row-gap: 3px; align-items: center;
    box-sizing: border-box; width: min(74%, 240px); min-height: 68px; padding: 10px 12px 10px 10px; border-radius: 16px; scroll-snap-align: start; color: inherit; text-decoration: none;
    background: color-mix(in srgb, var(--text-primary, #e8ecf3) 5%, transparent); box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.08));
    animation: ovh-rise .38s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 40ms); }
.ovh-card .ovh-ic { grid-row: 1 / 3; width: 40px; height: 40px; border-radius: 12px; }
.ovh-card b { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 13.5px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.ovh-card small { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 11.5px; color: var(--text-muted, #93a0b4); }
.ovh-card small > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovh-card.is-live { background: color-mix(in srgb, var(--live, #ef4444) 9%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--live, #ef4444) 40%, transparent); }
.ovh-card.is-live .ovh-ic { animation: ovh-onair 2.4s ease-in-out infinite; }
.ovh-live { flex: none; padding: 2px 6px; border-radius: 6px; background: var(--live, #ef4444); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .05em; line-height: 1.2; }
@media (hover: hover) { .ovh-card:hover { background: var(--bg-hover, rgba(255,255,255,.08)); } }
@media (min-width: 861px) { .ovh-card { width: 232px; } }
.ovh-use { margin: 0 4px 8px; padding: 12px 12px 4px; border-radius: 16px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent); }
.ovh-use-bar { display: flex; gap: 3px; height: 12px; border-radius: 999px; overflow: hidden; }
.ovh-use-bar > span { flex: var(--n, 1) 1 0; min-width: 8px; background: var(--c, #3b82f6); transform-origin: left center; animation: ovh-grow .7s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 60ms); }
/* The bar's key is the apps themselves: each one its icon (a way in, not a legend), its name, and how often, with the
   bar's own colour beside the number. Five across, as the home grid is. */
.ovh-use-apps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px; margin: 8px -8px 0; }
.ovh-key { display: grid; justify-items: center; align-content: start; gap: 3px; min-width: 0; padding: 6px 0; border-radius: 14px; color: inherit; text-decoration: none; -webkit-tap-highlight-color: transparent; }
.ovh-key .ovh-ic { width: 44px; height: 44px; border-radius: 14px; transition: transform .16s cubic-bezier(.2,1.4,.4,1); }
.ovh-key b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 650; letter-spacing: -.01em; color: var(--text-secondary, #a8b3c4); }
.ovh-key small { display: inline-flex; align-items: center; gap: 4px; color: var(--text-muted, #93a0b4); font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.2; }
.ovh-key small::before { content: ""; flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--c, #3b82f6); }
.ovh-key:active .ovh-ic { transform: scale(calc(1 - .08 * var(--ov-move, 1))); }
@media (hover: hover) { .ovh-key:hover { background: var(--bg-hover, rgba(255,255,255,.07)); } .ovh-key:hover b { color: var(--text-primary, #e8ecf3); } }
.ovh-sec small { flex: none; font-size: 11px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--text-muted, #93a0b4); }
@keyframes ovh-rise { from { opacity: 0; transform: translateY(6px) scale(.98); } }
@keyframes ovh-grow { from { transform: scaleX(0); } }
@keyframes ovh-onair { 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--live, #ef4444) 55%, transparent), 0 0 18px color-mix(in srgb, var(--live, #ef4444) 35%, transparent); } }
/* Calm is gentle, not still (the owner, 11-09): shorter travel, slower breath. */
html[data-ov-motion=reduced] .ovh-card { animation-name: ovh-fade; animation-duration: .5s; }
@keyframes ovh-fade { from { opacity: 0; } }
/* The invitation, one compact row (11-09): mark, words, Set it up, and an × to put it away. */
.ovh-actor.is-invite { grid-template-columns: 44px minmax(0, 1fr) auto auto; grid-template-rows: auto auto; gap: 2px 10px; align-items: center; min-height: 0; padding: 10px 6px 12px 12px; }
.ovh-actor.is-invite .ovh-face { grid-row: 1 / 3; align-self: start; width: 44px; height: 44px; border-radius: 14px; }
.ovh-actor.is-invite .ovh-actor-txt { display: contents; }
.ovh-actor.is-invite .ovh-actor-txt b { grid-column: 2; grid-row: 1; font-size: 15px; }
.ovh-actor.is-invite .ovh-actor-txt small { grid-column: 2 / 5; grid-row: 2; -webkit-line-clamp: 3; }
.ovh-actor.is-invite .ovh-acts { display: contents; }
.ovh-actor.is-invite .ovh-go { grid-column: 3; grid-row: 1; }
.ovh-actor.is-invite .ovh-x { grid-column: 4; grid-row: 1; display: grid; place-items: center; width: 36px; min-width: 36px; padding: 0; border-radius: 50%; }
.ovh-actor.is-invite .ovh-x svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }

/* 4.223.0: You's three tabs, the one notice above them, and an empty tab said with its mark (openvibe.design rule 141). */
.ovh-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin: 10px 0 12px; padding: 4px; border-radius: 16px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 5%, transparent); }
.ovh-tab { all: unset; box-sizing: border-box; position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 0 8px; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 650; color: var(--text-secondary, #a8b3c4); }
.ovh-tab svg { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ovh-tab:hover { color: var(--text-primary, #e6edf7); }
.ovh-tab:focus-visible { outline: 2px solid var(--accent-light, var(--accent, #60a5fa)); outline-offset: -2px; }
.ovh-tab[aria-selected="true"] { color: var(--text-primary, #e6edf7); background: var(--bg-secondary, #121826); box-shadow: 0 1px 2px rgba(0,0,0,.3), inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 30%, transparent); }
.ovh-tab[aria-selected="true"] svg { color: var(--accent-light, var(--accent, #60a5fa)); }
.ovh-tab-n { min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; font: 750 11px/18px Inter, system-ui, sans-serif; letter-spacing: -.01em; text-align: center; font-variant-numeric: tabular-nums; color: #fff; box-shadow: 0 0 0 2px var(--bg-secondary, #141a24), 0 3px 8px -2px rgba(0, 0, 0, .55); animation: ovhBadgeIn .3s cubic-bezier(.34, 1.56, .64, 1); background: var(--danger, #ef4444); }
@keyframes ovhBadgeIn { from { transform: scale(.5); opacity: 0; } }
html[data-ov-motion=off] .ovh-tab-n { animation: none; }
@media (max-width: 380px) { .ovh-tab { gap: 5px; font-size: 13px; } .ovh-tab svg { width: 16px; height: 16px; } }
.ovh-notes { min-height: 120px; }
.ovh-empty { display: flex; align-items: center; gap: 14px; margin: 6px 0; padding: 14px 16px; border-radius: 14px; border: 1px dashed color-mix(in srgb, var(--text-muted, #93a0b4) 45%, transparent); }
.ovh-empty > svg { width: 22px; height: 22px; flex: none; fill: none; stroke: var(--accent-light, var(--accent, #60a5fa)); stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ovh-empty > div { display: grid; gap: 2px; } .ovh-empty b { font-size: 14.5px; } .ovh-empty span { font-size: 13px; color: var(--text-muted, #93a0b4); }
/* Your own AI is one notice under your row: a slim line, not a card (the owner: "make that a notification … up there"). */
.ovh-notice .ovh-actor.is-invite { margin: 8px 0 0; padding: 8px 8px 8px 10px; gap: 10px; min-height: 0; border-radius: 14px; }
.ovh-notice .ovh-actor.is-invite .ovh-face { width: 32px; height: 32px; border-radius: 10px; }
.ovh-notice .ovh-actor.is-invite .ovh-actor-txt small { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.ovh-notice .ovh-actor.is-invite .ovh-acts { flex-direction: row; align-items: center; }
@media (max-width: 480px) { .ovh-notice .ovh-actor.is-invite { flex-wrap: nowrap; } .ovh-notice .ovh-actor.is-invite .ovh-actor-txt small { -webkit-line-clamp: 2; } }

/* ── 4.223.0: You, redone (the owner, 11-12) ──────────────────────────────────────────────────────────────────────────
   One top (you, and your AI beside you when there is room), one tab row (Apps · Notifications · Recent, with All and
   Edit at its end), then the tab. App icons draw the glyph at 58% of the tile, placed absolutely so a hover can never
   pull it off centre; a folder's four sit in an even 2×2 with their glyphs at two thirds. Names wrap to two balanced
   lines and never end in "…". */
.ovh { container: ovh / inline-size; }
.ovh-top { display: grid; gap: 6px; margin: 2px 4px 0; }
.ovh-top > * { min-width: 0; }
.ovh-top .ovh-me, .ovh-top .ovh-notice .ovh-actor { margin: 0; width: 100%; }
@container ovh (min-width: 600px) {
  .ovh-top:has(.ovh-notice > *) { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); align-items: stretch; }
  .ovh-top .ovh-notice > .ovh-actor { height: 100%; }
}
.ovh-notice:empty { display: none; }
.ovh-notice .ovh-actor { box-sizing: border-box; min-height: 56px; padding: 8px 12px; border-radius: 16px; }
.ovh-notice .ovh-actor .ovh-face { width: 36px; height: 36px; font-size: 15px; }
/* Your row: you, then your round buttons (this site's own first). On a narrow screen the buttons go under your name. */
.ovh-me { flex-wrap: wrap; row-gap: 0; padding: 6px 6px 6px 8px; min-height: 56px; box-sizing: border-box; }
.ovh-acts { display: flex; align-items: center; gap: 4px; flex: none; }
/* 4.237.0, you: one slim row (your picture with its online dot, your name, Display, your account's menu); the menu sits
   in the top layer; what the site gives you are apps at the start of the grid. */
.ovh-mebox { margin: 2px 4px 8px; }
.ovh-mebox > .ovh-me { display: flex; align-items: center; gap: 6px; margin: 0; padding: 6px 6px 6px 8px; min-height: 0; border-radius: 18px; flex-wrap: nowrap;
  background: color-mix(in srgb, var(--text-primary, #e6edf7) 4%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-primary, #e6edf7) 8%, transparent); }
.ovh-mebox .ovh-who { flex: 1 1 auto; min-width: 0; min-height: 44px; gap: 11px; padding: 2px 6px 2px 2px; border-radius: 14px; transition: background-color .15s; }
@media (hover: hover) and (pointer: fine) { .ovh-mebox .ovh-who:hover { background: color-mix(in srgb, var(--text-primary, #e6edf7) 5%, transparent); } }
.ovh-mebox .ovh-av { width: 40px; height: 40px; }
.ovh-mebox .ovh-who-txt b { font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; overflow-wrap: normal; }
.ovh-mebox .ovh-who-txt small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; overflow-wrap: normal; }
.ovh-mebox .ovh-me .ovh-ib { flex: none; width: 42px; height: 42px; border-radius: 13px; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); }
.ovh-mebox .ovh-acct svg { transition: transform .25s cubic-bezier(.3, 1.4, .4, 1); }
.ovh-mebox .ovh-acct[aria-expanded="true"] { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); }
.ovh-mebox .ovh-acct[aria-expanded="true"] svg { transform: rotate(180deg); }
.ovh-acct-menu { min-width: 230px; padding: 6px; border-radius: 16px; background: var(--bg-secondary, #141a24); color: var(--text-primary, #e6edf7);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-primary, #e6edf7) 10%, transparent), 0 18px 40px -12px rgba(0, 0, 0, .7); }
.ovh-acct-i { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 0 12px; border-radius: 11px; cursor: pointer; font-size: 14.5px; font-weight: 650; }
.ovh-acct-i svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; color: var(--text-secondary, #a8b3c4); }
.ovh-acct-i:hover, .ovh-acct-i:focus-visible { background: color-mix(in srgb, var(--text-primary, #e6edf7) 8%, transparent); }
.ovh-acct-i.is-danger, .ovh-acct-i.is-danger svg { color: var(--danger, #f87171); }
.ovh-own-apps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 2px; margin-bottom: 4px; padding-bottom: 10px; border-bottom: 1px solid color-mix(in srgb, var(--text-primary, #e6edf7) 7%, transparent); }
.ovh-own-ic { color: hsl(var(--ovh-h, 220) 80% 72%); }
.ovh-own-ic svg { width: 46%; height: 46%; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
html[data-ov-motion=off] .ovh-mebox .ovh-acct svg { transition: none; }
.ovh-ib.is-own { color: var(--accent-light, var(--accent, #60a5fa)); background: color-mix(in srgb, var(--accent, #3b82f6) 13%, transparent); }
.ovh-ib.is-text { width: auto; padding: 0 12px; border-radius: 999px; font-size: 12.5px; font-weight: 750; white-space: nowrap; }
@container ovh (max-width: 520px) {
  .ovh-me { padding: 8px 8px 6px 10px; }
  .ovh-acts { flex: 1 1 100%; flex-wrap: wrap; gap: 6px; padding: 6px 0 0 52px; }
  .ovh-acts .ovh-out { margin-left: auto; }
}
/* The tab row: on a phone only the chosen tab says its name (the others are their glyph and count), so the row also
   holds All and Edit; from 520 px every tab says its name. It stays at the top while the apps scroll. */
.ovh-tabrow { position: sticky; top: 0; z-index: 4; display: flex; align-items: center; gap: 8px; margin: 8px 0 6px; padding: 4px;
  background: color-mix(in srgb, var(--bg-secondary, #121826) 90%, transparent); -webkit-backdrop-filter: blur(14px) saturate(1.3); backdrop-filter: blur(14px) saturate(1.3); border-radius: 16px; }
/* 4.236.0 (the owner, 11-13: "more apparent that these are tabs … apps, then notifications, then history … the edit
   button twice … use the icon only"): the three tabs are one segmented track, each with its glyph and name, the chosen
   one lit; All and Edit are two round glyphs at the end (Edit turns into the check while you arrange). */
.ovh-tabrow .ovh-tabs { flex: 1 1 auto; min-width: 0; display: flex; gap: 2px; margin: 0; padding: 3px; border-radius: 14px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-primary, #e6edf7) 7%, transparent); }
.ovh-tabrow .ovh-tab { flex: 1 1 0; min-width: 0; min-height: 40px; padding: 0 6px; gap: 6px; border-radius: 11px; justify-content: center; transition: background-color .18s, color .18s; }
.ovh-tabrow .ovh-tab .ovh-tab-t { font-size: 13.5px; font-weight: 750; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovh-tabrow .ovh-tab svg { width: 19px; height: 19px; }
.ovh-tabrow .ovh-headtools { gap: 8px; }
.ovh-headtools .ovh-edit.is-done { background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); animation: ovhDoneIn .3s cubic-bezier(.34, 1.56, .64, 1); }
@keyframes ovhDoneIn { from { transform: scale(.8) rotate(-20deg); } }
html[data-ov-motion=off] .ovh-headtools .ovh-edit.is-done { animation: none; }
.ovh-tabrow .ovh-headtools { flex: none; display: flex; align-items: center; gap: 4px; }
@container ovh (max-width: 519px) {
  .ovh-tabrow .ovh-tab { padding: 0 4px; gap: 5px; }
}
@container ovh (max-width: 340px) { .ovh-tabrow .ovh-tab:not([aria-selected="true"]) .ovh-tab-t { display: none; } }
.ovh-tabrow .ovh-allbtn, .ovh-tabrow .ovh-edit { min-height: 42px; }
.ovh-tabrow .ovh-edit { width: 42px; }
.ovh-headtools .ovh-edit.is-done { width: auto; }
/* Section heads: a marked glyph, the name, its count; buttons at the end. */
.ovh-sec { gap: 8px; padding: 12px 6px 6px; }
.ovh-sec > span { flex: 0 1 auto; min-width: 0; }
.ovh-sec-sp { flex: 1; }
.ovh-sec-ic { flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 8px; background: color-mix(in srgb, var(--accent, #3b82f6) 15%, transparent); color: var(--accent-light, var(--accent, #60a5fa)); }
.ovh-sec-ic svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
.ovh-sec-n { flex: none; min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 9%, transparent); color: var(--text-secondary, #a8b3c4); font-size: 11px; font-weight: 750; line-height: 20px; letter-spacing: 0; text-align: center; }
/* Back is a round arrow; in All apps the search sits beside it. */
.ovh-head { gap: 8px; padding: 6px 4px; }
.ovh-back { flex: none; display: inline-grid; place-items: center; width: 44px; height: 44px; min-height: 44px; padding: 0; border-radius: 50%; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); color: var(--text-primary, #e8ecf3); transition: background-color .15s, transform .12s; }
.ovh-back svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
.ovh-back:active { transform: scale(.92); }
.ovh-back:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
@media (hover: hover) { .ovh-back:hover { background: color-mix(in srgb, var(--text-primary, #e8ecf3) 15%, transparent); } }
.ovh-head .ovh-filter { flex: 1; min-width: 0; width: auto; margin: 0; }
/* The grid: four across on a phone, as many as fit from 560 px. */
.ovh-grid, .ovh-own-apps { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (min-width: 560px) { .ovh-grid, .ovh-own-apps { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); } }
/* App icons: the glyph at 58% of the tile. */
.ovh-ic > .ov-icon { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.ovh-ic > .ov-icon svg { position: absolute; left: -13%; top: -13%; width: 126%; height: 126%; margin: 0; transform: none !important; }
.ovh-grid:not(.ovh-recent) .ovh-folder .ovh-ic { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: auto; gap: 9%; padding: 14%; box-sizing: border-box; place-content: center stretch; align-content: center; }
.ovh-grid:not(.ovh-recent) .ovh-folder .ovh-ic > span { position: relative; display: block; width: 100%; height: auto; aspect-ratio: 1; align-self: center; border-radius: 30%; overflow: hidden;
  background: linear-gradient(150deg, hsl(var(--ovh-h, 215) 72% 58% / .55), hsl(var(--ovh-h, 215) 70% 38% / .35)); box-shadow: inset 0 0 0 1px hsl(var(--ovh-h, 215) 70% 66% / .3); }
.ovh-grid:not(.ovh-recent) .ovh-folder .ovh-ic > span > .ov-icon { position: absolute; inset: 0; width: 100%; height: 100%; display: block; --ovi-glyph: hsl(var(--ovh-h, 215) 92% 86%); color: hsl(var(--ovh-h, 215) 92% 86%); }
.ovh-grid:not(.ovh-recent) .ovh-folder .ovh-ic > span > .ov-icon svg { position: absolute; left: -23%; top: -23%; width: 146%; height: 146%; margin: 0; transform: none !important; }
:root[data-theme="light"] .ovh-grid .ovh-folder .ovh-ic > span > .ov-icon { --ovi-glyph: hsl(var(--ovh-h, 215) 70% 28%); color: hsl(var(--ovh-h, 215) 70% 28%); }
/* Names: two balanced lines, centred, never "…". */
.ovh-name { white-space: normal; text-overflow: clip; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-align: center; line-height: 1.2; text-wrap: balance; overflow-wrap: normal; word-break: normal; }
.ovh-grid:not(.ovh-recent) .ovh-name { font-size: 12px; letter-spacing: -.005em; }
/* A + to put an app on Home sits on its icon's corner, not in the cell's. */
.ovh-grid .ovh-app > .ovh-badge { top: 0; left: calc(50% - min(50% - 6px, 36px) - 8px); width: 24px; height: 24px; font-size: 15px; }
/* Touch, pen and mouse: a press sinks the icon at once; a mouse lifts it and lights it in its own hue. */
.ovh-ic { transition: transform .22s cubic-bezier(.2, 1.4, .4, 1), box-shadow .22s; }
.ovh-app:active .ovh-ic { transform: scale(.93); transition-duration: .08s; }
@media (hover: hover) and (pointer: fine) {
  .ovh-app:hover .ovh-ic { transform: translateY(-3px) scale(1.04); box-shadow: inset 0 0 0 1px hsl(var(--ovh-h, 215) 75% 70% / .5), 0 12px 26px -8px hsl(var(--ovh-h, 215) 75% 45% / .6); }
  .ovh-app:hover .ovh-name { opacity: 1; }
}
html[data-ov-motion=off] .ovh-ic { transition: none; }
/* Recent: where you were, in days, as cards with the whole title; two columns when there is room. */
.ovh-hist-list { display: grid; gap: 8px; padding: 0 4px; }
@container ovh (min-width: 600px) { .ovh-hist-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ovh-hist-day { grid-column: 1 / -1; margin: 8px 4px 0; font-size: 12px; font-weight: 800; letter-spacing: .02em; color: var(--text-muted, #93a0b4); }
.ovh-hist-day:first-child { margin-top: 0; }
.ovh-hrow { box-sizing: border-box; display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 70px; padding: 10px 12px; border-radius: 16px; color: inherit; text-decoration: none;
  background: color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent); box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.08));
  transition: background-color .15s, transform .15s; animation: ovh-rise .34s cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--i, 0) * 22ms); }
.ovh-hrow .ovh-ic { flex: none; width: 48px; height: 48px; border-radius: 15px; }
.ovh-htxt { min-width: 0; display: grid; gap: 3px; }
.ovh-htxt b { font-size: 14.5px; font-weight: 700; line-height: 1.28; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.ovh-htxt small { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-secondary, #a8b3c4); }
.ovh-hrow.is-live { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--live-red, #ef4444) 45%, transparent); }
.ovh-hrow:active { transform: scale(.985); }
.ovh-hrow:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) { .ovh-hrow:hover { background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); transform: translateY(-1px); } }
.ovh-hist-more[hidden] { display: none; }
@keyframes ovh-rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes ovh-rise-calm { from { opacity: 0; } }
html[data-ov-motion=reduced] .ovh-hrow { animation-name: ovh-rise-calm; animation-delay: 0s; }
html[data-ov-motion=off] .ovh-hrow { animation: none; }

/* 4.223.0, round two: All and Edit in the tab row; the tabs as one segmented control whose ink slides to the chosen tab,
   and the tab's content slides in from its side (the owner, 11-12: "animations, effects to the tabs … aligned more
   perfectly … bigger font size and better icon size"). */
.ovh-tabrow .ovh-tabs { position: relative; isolation: isolate; }
.ovh-tabrow .ovh-tab[aria-selected="true"] { background: transparent; box-shadow: none; }
.ovh-tabrow .ovh-tab { font-size: 14.5px; gap: 8px; }
.ovh-tabrow .ovh-tab svg { width: 19px; height: 19px; transition: transform .25s cubic-bezier(.3, 1.4, .4, 1); }
.ovh-tabrow .ovh-tab[aria-selected="true"] svg { transform: scale(1.08); }
@media (hover: hover) and (pointer: fine) { .ovh-tabrow .ovh-tab:not([aria-selected="true"]):hover { background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); } }
.ovh-tabrow .ovh-tab:active svg { transform: scale(.9); }
html[data-ov-motion=off] .ovh-tabrow .ovh-tab svg { transition: none; }
.ovh[data-enter] > :not(.ovh-top):not(.ovh-tabrow) { animation: ovh-pane-r .3s cubic-bezier(.2, .8, .2, 1) both; }
/* 4.238.0, labels and glyphs (the owner, 11-13: "the icons are so small, make them use more of the space, less padding …
   the text apps … a little bigger … better consistency"): every app's name (yours too) one size and weight; the glyphs
   fill more of their tiles and of the round buttons. */
.ovh-grid:not(.ovh-recent) .ovh-name, .ovh-own-apps .ovh-name { font-size: 13.5px; font-weight: 800; letter-spacing: .005em; color: color-mix(in srgb, var(--text-primary, #e8ecf3) 94%, transparent); opacity: 1; }
.ovh-own-apps .ovh-name { font-family: 'OV Brand', Nunito, Inter, -apple-system, BlinkMacSystemFont, sans-serif; }
.ovh-own-ic svg { width: 56%; height: 56%; stroke-width: 2; }
.ovh-tabrow .ovh-allbtn, .ovh-tabrow .ovh-edit { width: 48px; min-width: 48px; height: 48px; }
.ovh-tabrow .ovh-allbtn svg, .ovh-tabrow .ovh-edit svg { width: 26px; height: 26px; }
.ovh-tabrow .ovh-tab .ovh-tab-t { text-overflow: clip; }
.ovh-mebox .ovh-me .ovh-ib svg { width: 26px; height: 26px; }
/* 4.238.0, round two (the owner's phone, 11-13: "the tabs are still off center … the icons aren't big enough, not even
   nearly … and neither are the button icons"): the ink sits on its tab by the track's geometry; glyphs are 26 px on the
   tabs and 22-24 px on every round button. */
.ovh-tabrow .ovh-tab { min-height: 48px; gap: 8px; }
.ovh-tabrow .ovh-tab svg { width: 26px; height: 26px; }
/* Round three (the owner, 11-13: "hide the label of the inactive tabs … add the badges back"): the chosen tab is lit and
   widens to show its name; the others are their glyphs; the count sits on the bell's corner. */
.ovh-tabrow .ovh-tabs { gap: 4px; }
.ovh-tabrow .ovh-tab { flex: 1 1 0; min-width: 52px; min-height: 48px; padding: 0 10px; gap: 0; transition: flex-grow .36s cubic-bezier(.3, 1.2, .4, 1), background-color .25s, box-shadow .25s, color .2s; }
.ovh-tabrow .ovh-tab[aria-selected="true"]:not(.is-new), .ovh-tabrow .ovh-tab.is-was { flex-grow: 2.4; color: var(--text-primary, #e6edf7); background: var(--bg-secondary, #121826);
  box-shadow: 0 1px 2px rgba(0,0,0,.3), inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 35%, transparent), 0 6px 18px -8px color-mix(in srgb, var(--accent, #3b82f6) 60%, transparent); }
:root[data-theme="light"] .ovh-tabrow .ovh-tab[aria-selected="true"]:not(.is-new), :root[data-theme="light"] .ovh-tabrow .ovh-tab.is-was { background: #fff; }
.ovh-tabrow .ovh-tab .ovh-tab-t { display: block; max-width: 0; margin-left: 0; opacity: 0; font-size: 14.5px; font-weight: 750; transition: max-width .36s cubic-bezier(.3, 1.1, .4, 1), margin-left .36s, opacity .2s; }
.ovh-tabrow .ovh-tab[aria-selected="true"]:not(.is-new) .ovh-tab-t, .ovh-tabrow .ovh-tab.is-was .ovh-tab-t { max-width: 8em; margin-left: 8px; opacity: 1; }
.ovh-tab-g { position: relative; flex: none; display: grid; place-items: center; }
.ovh-tab-g .ovh-tab-n { position: absolute; top: -8px; left: calc(100% - 10px); margin: 0; }
html[data-ov-motion=reduced] .ovh-tabrow .ovh-tab, html[data-ov-motion=reduced] .ovh-tabrow .ovh-tab .ovh-tab-t { transition-duration: .15s; }
html[data-ov-motion=off] .ovh-tabrow .ovh-tab, html[data-ov-motion=off] .ovh-tabrow .ovh-tab .ovh-tab-t { transition: none; }
.ovh-mebox .ovh-me .ovh-ib { width: 44px; height: 44px; }
.ovh-mebox .ovh-me .ovh-ib svg { width: 24px; height: 24px; }
.ovh-actor .ovh-go.is-ic svg, .ovh-actor .ovh-go.is-answer svg { width: 24px; height: 24px; }
.ovh-tabrow .ovh-allbtn svg, .ovh-tabrow .ovh-edit svg { width: 22px; height: 22px; }
.ovh-sec .ovh-edit svg { width: 22px; height: 22px; }
.ovh-sec .ovh-allbtn svg { width: 20px; height: 20px; }
.ovh-back svg { width: 24px; height: 24px; }
.ovh-actor.is-invite .ovh-x svg, .ovh-notice .ovh-actor.is-invite .ovh-x svg { width: 20px; height: 20px; }
.ovh[data-enter="left"] > :not(.ovh-top):not(.ovh-tabrow) { animation-name: ovh-pane-l; }
@keyframes ovh-pane-r { from { opacity: 0; transform: translateX(18px); } }
@keyframes ovh-pane-l { from { opacity: 0; transform: translateX(-18px); } }
html[data-ov-motion=reduced] .ovh[data-enter] > :not(.ovh-top):not(.ovh-tabrow) { animation-name: ovh-rise-calm; }
html[data-ov-motion=off] .ovh[data-enter] > :not(.ovh-top):not(.ovh-tabrow) { animation: none; }
.ovh-tabrow .ovh-allbtn, .ovh-tabrow .ovh-edit { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; border-radius: 12px; cursor: pointer;
  font-size: 13.5px; font-weight: 700; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 6%, transparent); transition: background-color .15s, color .15s, transform .12s; -webkit-tap-highlight-color: transparent; }
.ovh-tabrow .ovh-allbtn, .ovh-tabrow .ovh-edit { position: relative; width: 44px; min-width: 44px; height: 44px; padding: 0; }
.ovh-headtools .ovh-edit.is-done { background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); }
.ovh-tabrow .ovh-allbtn svg, .ovh-tabrow .ovh-edit svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ovh-headtools .ovh-allbtn b { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--text-primary, #e8ecf3); }
.ovh-tabrow .ovh-allbtn b { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 9px; display: grid; place-items: center; font-size: 10.5px; line-height: 1;
  background: var(--bg-tertiary, #1f2937); box-shadow: 0 0 0 2px var(--bg-secondary, #141a24); }
.ovh-tabrow .ovh-allbtn:focus-visible, .ovh-tabrow .ovh-edit:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
.ovh-tabrow .ovh-allbtn:active, .ovh-tabrow .ovh-edit:active { transform: scale(.94); }
@media (hover: hover) and (pointer: fine) { .ovh-tabrow .ovh-allbtn:hover, .ovh-tabrow .ovh-edit:not(.is-done):hover { color: var(--text-primary, #e8ecf3); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 13%, transparent); } }
@container ovh (max-width: 380px) { .ovh-tabrow .ovh-allbtn span { display: none; } }

/* Your own AI, not yet set up: one slim row under you (its mark, two short lines, Set it up, ×). */
.ovh-notice .ovh-actor.is-invite { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 8px 8px 10px; }
.ovh-notice .ovh-actor.is-invite .ovh-face { flex: none; grid-row: auto; align-self: center; width: 40px; height: 40px; border-radius: 12px; }
.ovh-notice .ovh-actor.is-invite .ovh-actor-txt { display: grid; flex: 1; min-width: 0; gap: 1px; }
.ovh-notice .ovh-actor.is-invite .ovh-actor-txt small { -webkit-line-clamp: 2; font-size: 12.5px; line-height: 1.3; }
.ovh-notice .ovh-actor.is-invite .ovh-acts { flex: none; display: flex; flex-direction: row; align-items: center; gap: 4px; grid-column: auto; padding: 0; }
.ovh-notice .ovh-actor.is-invite .ovh-go { height: 38px; padding: 0 14px; }
.ovh-notice .ovh-actor.is-invite .ovh-x { display: grid; place-items: center; width: 38px; min-height: 38px; height: 38px; padding: 0; }
.ovh-notice .ovh-actor.is-invite .ovh-x svg { width: 16px; height: 16px; }

/* Names in the brand face (OV Brand, Nunito 700–900, loaded by the navbar on every site): app names, the tabs, section
   heads; the words you read (times, notes) stay in the UI face. Section heads are names now, not small capitals. */
.ovh-name, .ovh-tab, .ovh-sec > span, .ovh-allbtn, .ovh-hist-day, .ovh-htxt b, .ovh-who-txt b, .ovh-actor-txt b { font-family: 'OV Brand', Nunito, Inter, -apple-system, BlinkMacSystemFont, sans-serif; }
.ovh-grid:not(.ovh-recent) .ovh-name { font-size: 13px; font-weight: 800; letter-spacing: .005em; color: color-mix(in srgb, var(--text-primary, #e8ecf3) 92%, transparent); opacity: 1; }
.ovh-tabrow .ovh-tab { font-weight: 800; letter-spacing: .005em; }
.ovh-sec { font-size: 15px; font-weight: 800; letter-spacing: .005em; text-transform: none; color: var(--text-primary, #e8ecf3); }
.ovh-sec small { font-family: inherit; }
.ovh-hist-day { font-size: 13px; font-weight: 800; letter-spacing: .01em; color: var(--text-secondary, #a8b3c4); }
.ovh-who-txt b { font-size: 16px; font-weight: 800; letter-spacing: .005em; }
.ovh-actor-txt b { font-weight: 800; }
.ovh-grid:not(.ovh-recent) .ovh-folder .ovh-ic { gap: 7%; padding: 11%; }

/* The AI card: its face says what it is doing (a glyph on its picture's corner, or the whole face), working ones breathe
   (Calm: slower; Off: still); Open is a round arrow, Answer a pill with its glyph. */
.ovh-actor .ovh-face { position: relative; overflow: visible; }
.ovh-actor .ovh-face img { border-radius: 50%; }
.ovh-doing { position: absolute; right: -4px; bottom: -4px; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; color: #fff;
  background: linear-gradient(140deg, var(--accent, #3b82f6), color-mix(in srgb, var(--accent, #3b82f6) 45%, #a855f7)); box-shadow: 0 0 0 2px var(--bg-secondary, #141a24); }
.ovh-doing svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; }
.ovh-face.is-glyph { border-radius: 13px; background: linear-gradient(140deg, var(--accent, #3b82f6), color-mix(in srgb, var(--accent, #3b82f6) 45%, #a855f7)); }
.ovh-face.is-glyph .ovh-doing { position: static; width: 100%; height: 100%; border-radius: inherit; background: none; box-shadow: none; }
.ovh-face.is-glyph .ovh-doing svg { width: 22px; height: 22px; }
.ovh-doing.is-waiting { background: linear-gradient(140deg, #f59e0b, #ef4444); }
.ovh-face.is-glyph:has(.is-waiting) { background: linear-gradient(140deg, #f59e0b, #ef4444); }
.ovh-face.is-glyph:has(.is-working) { animation: ovh-breathe 2.4s ease-in-out infinite; }
@keyframes ovh-breathe { 50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); } }
html[data-ov-motion=reduced] .ovh-face.is-glyph:has(.is-working) { animation-duration: 5s; }
html[data-ov-motion=off] .ovh-face.is-glyph:has(.is-working) { animation: none; }
.ovh-actor .ovh-go.is-ic { flex: none; display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border-radius: 50%; color: var(--accent-light, var(--accent, #60a5fa));
  background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); transition: transform .2s cubic-bezier(.3, 1.4, .4, 1), background-color .15s; }
.ovh-actor .ovh-go.is-ic svg, .ovh-actor .ovh-go.is-answer svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.ovh-actor .ovh-go.is-answer { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px 0 11px; border-radius: 999px; background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); font-weight: 750; font-size: 13.5px; }
@media (hover: hover) and (pointer: fine) { .ovh-actor:hover .ovh-go.is-ic { transform: translate(2px, -2px); background: color-mix(in srgb, var(--accent, #3b82f6) 24%, transparent); } }

/* 4.223.1: the notice's name stays on one line ("Your own AI", not "Your own / AI"); its sentence takes the wrap. */
.ovh-notice .ovh-actor.is-invite .ovh-actor-txt b { white-space: nowrap; overflow: hidden; text-overflow: clip; }
@container ovh (max-width: 400px) { .ovh-notice .ovh-actor.is-invite .ovh-go { padding: 0 12px; font-size: 13px; } }

/* 4.238.0, the last word (later than every rule above): the round buttons' glyphs fill more of them (the owner, 11-13:
   "the icons are so small, make them use more of the space, less padding"); the bell rings once when something is new;
   the notifications tab takes the menu's whole height, its foot at the bottom ("take up the full height properly"). */
.ovh-tabrow .ovh-allbtn, .ovh-tabrow .ovh-edit { width: 48px; min-width: 48px; height: 48px; }
.ovh-tabrow .ovh-allbtn svg, .ovh-tabrow .ovh-edit svg { width: 26px; height: 26px; }
.ovh-actor .ovh-go.is-ic { width: 44px; height: 44px; }
.ovh-actor .ovh-go.is-ic svg, .ovh-actor .ovh-go.is-answer svg { width: 24px; height: 24px; }
.ovh-mebox .ovh-me .ovh-ib { width: 46px; height: 46px; }
.ovh-mebox .ovh-me .ovh-ib svg { width: 26px; height: 26px; }
.ovh-tab.has-new .ovh-tab-g > svg { transform-origin: 50% 14%; animation: ovh-ring 1.6s cubic-bezier(.36, .07, .19, .97) .3s 1 both; }
@keyframes ovh-ring { 10% { transform: rotate(16deg); } 22% { transform: rotate(-13deg); } 34% { transform: rotate(9deg); } 46% { transform: rotate(-6deg); } 58% { transform: rotate(3deg); } 70%, 100% { transform: rotate(0); } }
html[data-ov-motion=reduced] .ovh-tab.has-new .ovh-tab-g > svg { animation-duration: .9s; }
html[data-ov-motion=off] .ovh-tab.has-new .ovh-tab-g > svg { animation: none; }
.ovs-list > .ovh:has(> .ovh-notes) { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
.ovh > .ovh-notes { flex: 1 1 auto; display: flex; flex-direction: column; }
.ovh > .ovh-notes > .openvibe-notif-dock { flex: 1 1 auto; }
.ovh > .ovh-notes .openvibe-nv-foot { margin-top: auto; }
.ovh > .ovh-notes .openvibe-nv-list:has(> .openvibe-nv-empty) { flex: 1 1 auto; display: grid; place-items: center; }
.ovh-tabrow { margin: 0 0 4px; padding: 3px; gap: 6px; }
.ovh-tabrow .ovh-tabs { padding: 2px; }
.ovh-tabrow .ovh-tab { min-height: 42px; }
.ovh-tabrow .ovh-tab svg { width: 27px; height: 27px; }
.ovh-tabrow .ovh-allbtn, .ovh-tabrow .ovh-edit { width: 44px; min-width: 44px; height: 44px; }
`;
        document.head.appendChild(st);
    }

    // ── The arrangement ────────────────────────────────────────────────────────────────────────────────────────
    function readLocal() { try { const v = JSON.parse(localStorage.getItem(HOME_KEY) || 'null'); return v && Array.isArray(v.home) ? v : null; } catch { return null; } }
    function writeLocal(l) { try { localStorage.setItem(HOME_KEY, JSON.stringify(l)); } catch { /* a private window keeps it for this opening */ } }
    const homeUrl = (o) => `${o.apiBase || 'https://openvibe.network'}/api/v1/me/home-screen`;
    const signedIn = (o) => !!(o.token && o.user && !o.user.is_anon);
    // A person the bar knows, with or without a token for the network's reads (a site with its own session, Run's):
    // You's tabs are theirs either way (4.236.0; the owner, 11-13: "what happened to all the tabs … bring all that back").
    const known = (o) => !!(o.user && !o.user.is_anon);
    let putTimer = 0;
    function pushRemote(o, l) {
        if (!signedIn(o) || typeof fetch !== 'function') return;
        clearTimeout(putTimer);
        putTimer = setTimeout(() => {
            fetch(homeUrl(o), { method: 'PUT', credentials: 'omit', headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ home: l.home.slice(0, HOME_MAX), folders: l.folders }) }).catch(() => {});
        }, 600);
    }
    let remoteAsked = false;
    async function pullRemote(o) {
        if (remoteAsked || !signedIn(o) || typeof fetch !== 'function') return null;
        remoteAsked = true;
        try {
            const r = await fetch(homeUrl(o), { credentials: 'omit', headers: { Authorization: `Bearer ${o.token}` } });
            if (!r.ok) return null;
            const j = await r.json();
            return j && Array.isArray(j.home) ? { home: j.home.filter((x) => typeof x === 'string').slice(0, HOME_MAX), folders: Array.isArray(j.folders) ? j.folders : [] } : null;
        } catch { return null; }
    }

    /** Every app the menu knows, by id: sites, the person's own places (Files, Wallet…), the folders. */
    function universe(o) {
        const byId = new Map();
        (o.apps || []).forEach((a) => { if (a && a.id && safe(a.url)) byId.set(a.id, a); });
        (o.yours || []).forEach((a) => { if (a && a.id && safe(a.url)) byId.set(a.id, a); });
        return byId;
    }
    // The network's eight groups, in the menu's own order (OpenVibe.Network frame/sites.js GROUPS, the owner's
    // regrouping of 2026-11-10), as folders for the sites past the first page (until the person arranges their home).
    const GROUP_FOLDERS = [['watch', 'Watch & stream'], ['talk', 'Talk & belong'], ['play', 'Play'], ['read', 'Read & ask'], ['shop', 'Shop & money'], ['tools', 'Free tools'], ['make', 'Make with AI'], ['build', 'For developers']];
    // A group folder's id: `g-watch` …; Build keeps `build`, the id saved home screens already use.
    const folderId = (g) => (g === 'build' ? 'build' : `g-${g}`);
    // Saved before the regrouping: the old group ids map onto the new folders.
    const FOLDER_ALIAS = { 'g-streams': 'g-watch', 'g-people': 'g-talk', 'g-games': 'g-play', 'g-answers': 'g-read' };
    const normalizeFolder = (id) => (id.startsWith('folder:') ? `folder:${FOLDER_ALIAS[id.slice(7)] || id.slice(7)}` : id);
    function topSites(o) {
        const mineFirst = (o.yours || []).filter((y) => ['you:vibe', 'you:codes', 'you:files', 'you:wallet'].includes(y.id));
        const limit = Math.max(6, 12 - 2 - mineFirst.length);
        // Leave at least one app in every group for its folder: a group that is all singles has no folder to open.
        const left = new Map();
        for (const a of o.apps || []) left.set(a.group, (left.get(a.group) || 0) + 1);
        const sites = [];
        for (const a of o.apps || []) {
            if (a.group === 'build') continue;
            if ((left.get(a.group) || 0) <= 1) continue;
            left.set(a.group, left.get(a.group) - 1);
            sites.push(a.id);
            if (sites.length >= limit) break;
        }
        return sites;
    }
    function folderDefs(o) {
        const apps = o.apps || [];
        const top = new Set(topSites(o));
        const groups = GROUP_FOLDERS.map(([g, name]) => ({ id: folderId(g), name, group: g, apps: apps.filter((a) => a.group === g && !top.has(a.id)).map((a) => a.id), glyph: 'grid' }))
            .filter((f) => f.apps.length);
        return groups.concat([
            { id: 'tools', name: 'Quick tools', apps: (o.tools || []).map((t) => t.id), glyph: 'tools', more: { label: `All ${o.toolCount || (o.tools || []).length} tools`, href: 'https://openvibe.tools/' } },
        ]).filter((f) => f.apps.length);
    }
    /** Until the person arranges it: their own places first (signed in), then the most used and popular sites, then
     *  one folder per group (the menu's eight, in its order) and the quick tools. */
    function defaultHome(o) {
        const mineFirst = (o.yours || []).filter((y) => ['you:vibe', 'you:codes', 'you:files', 'you:wallet'].includes(y.id)).map((y) => y.id);
        const groupFolders = folderDefs(o).filter((f) => f.group).map((f) => `folder:${f.id}`);
        return mineFirst.concat(topSites(o), groupFolders, ['folder:tools']);
    }
    function layoutOf(o) {
        const byId = universe(o);
        const folders = folderDefs(o);
        const known = (id) => byId.has(id) || (id.startsWith('folder:') && folders.some((f) => `folder:${f.id}` === id));
        const l = readLocal();
        const home = (l ? l.home : defaultHome(o)).map(normalizeFolder).filter((id, i, a) => known(id) && a.indexOf(id) === i).slice(0, HOME_MAX);
        return { home, folders, arranged: !!l, byId };
    }

    // Line icons for the buttons beside your name (24-unit boxes, optically centred), built as nodes.
    const ICON = {
        pencil: [['path', { d: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z' }], ['path', { d: 'M13.5 6.5l4 4' }]],
        check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
        chev: [['path', { d: 'M6.5 9.5l5.5 5.5 5.5-5.5' }]],
        briefcase: [['rect', { x: 3.5, y: 7.2, width: 17, height: 12.3, rx: 2.4 }], ['path', { d: 'M8.8 7.2V5.6a1.8 1.8 0 0 1 1.8-1.8h2.8a1.8 1.8 0 0 1 1.8 1.8v1.6M3.5 12.6h17' }]],
        bell: [['path', { d: 'M12 3.5a1.22 1.22 0 0 1 1.22 1.22v0.47a5.44 5.44 0 0 1 4.22 5.25v3.38c0 0.84 0.28 1.59 0.84 2.25l0.75 0.84a0.75 0.75 0 0 1 -0.56 1.31H5.53a0.75 0.75 0 0 1 -0.56 -1.31l0.75 -0.84c0.56 -0.66 0.84 -1.41 0.84 -2.25v-3.38a5.44 5.44 0 0 1 4.22 -5.25v-0.47A1.22 1.22 0 0 1 12 3.5Z' }], ['path', { d: 'M9.94 18.97a2.16 2.16 0 0 0 4.13 0' }]],
        history: [['path', { d: 'M3.8 12.1a8.3 8.3 0 1 0 2.5-5.9L3.8 8.5M3.8 4.2v4.2h4.2' }], ['path', { d: 'M12 7.9v4.3l3.1 1.9' }]],
        attach: [['path', { d: 'M12 5v14M5 12h14' }]],
        plus: [['circle', { cx: 9.5, cy: 8.5, r: 3.2 }], ['path', { d: 'M3.5 18.5c1-2.900 3.300-4.400 6-4.400 1.300 0 2.500.300 3.500 1' }], ['path', { d: 'M18 13.500v6M15 16.500h6' }]],
        out: [['path', { d: 'M13.500 4.500h4a1.500 1.500 0 0 1 1.500 1.500v12a1.500 1.500 0 0 1-1.500 1.500h-4' }], ['path', { d: 'M9.500 8l-4 4 4 4M5.500 12h9.500' }]],
        grid: [['rect', { x: 4, y: 4, width: 6.5, height: 6.5, rx: 1.6 }], ['rect', { x: 13.5, y: 4, width: 6.5, height: 6.5, rx: 1.6 }], ['rect', { x: 4, y: 13.5, width: 6.5, height: 6.5, rx: 1.6 }], ['rect', { x: 13.5, y: 13.5, width: 6.5, height: 6.5, rx: 1.6 }]],
        look: [['path', { d: 'M12 3a9 9 0 1 0 0 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.4-.7-.4-1.1 0-1 .8-1.7 1.7-1.7h2.1A4.4 4.4 0 0 0 21 11c0-4.4-4-8-9-8Z' }],
            ['circle', { cx: 7.6, cy: 11.4, r: 1.1, fill: 'currentColor', stroke: 'none' }], ['circle', { cx: 10.4, cy: 7.4, r: 1.1, fill: 'currentColor', stroke: 'none' }], ['circle', { cx: 15, cy: 7.6, r: 1.1, fill: 'currentColor', stroke: 'none' }]],
        gear: [['circle', { cx: 12, cy: 12, r: 3 }], ['path', { d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' }]],
        x: [['path', { d: 'M6 6l12 12M18 6 6 18' }]],
        image: [['rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 3 }], ['circle', { cx: 9, cy: 10, r: 1.8 }], ['path', { d: 'M4 17.5l4.6-4.4a1.5 1.5 0 0 1 2 0l2.4 2.3 2.2-2a1.5 1.5 0 0 1 2 0l3.3 3' }]],
        eye: [['path', { d: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z' }], ['circle', { cx: 12, cy: 12, r: 2.8 }]],
        heart: [['path', { d: 'M12 20s-7.2-4.4-8.9-8.8C1.9 7.9 4 4.8 7.2 4.8c1.9 0 3.4 1 4.8 2.9 1.4-1.9 2.9-2.9 4.8-2.9 3.2 0 5.3 3.1 4.1 6.4C19.2 15.6 12 20 12 20Z' }]],
        reply: [['path', { d: 'M20.5 11.6a8 8 0 0 1-11.7 7.1L4 20l1.3-4.4a8 8 0 1 1 15.2-4Z' }]],
        people: [['circle', { cx: 9, cy: 8.5, r: 3.2 }], ['path', { d: 'M3 19.5c.8-3.2 3.1-5 6-5s5.2 1.8 6 5' }], ['circle', { cx: 16.8, cy: 9.2, r: 2.4 }], ['path', { d: 'M16.6 14.6c2.2.2 3.8 1.7 4.4 4.4' }]],
        trophy: [['path', { d: 'M8 4h8v5.2a4 4 0 0 1-8 0V4Z' }], ['path', { d: 'M8 6H5.2c0 2.3 1.2 3.8 3.1 4.1M16 6h2.8c0 2.3-1.2 3.8-3.1 4.1M12 13.2V17M8.8 20h6.4M10 17h4' }]],
        calendar: [['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 3 }], ['path', { d: 'M3.5 10h17M8 3v4M16 3v4' }]],
        chat: [['path', { d: 'M5 5h11a2.5 2.5 0 0 1 2.5 2.5v6A2.5 2.5 0 0 1 16 16H10l-4.5 3.5V16H5a2.5 2.5 0 0 1-2.5-2.5v-6A2.5 2.5 0 0 1 5 5Z' }], ['path', { d: 'M7 9.5h7M7 12.5h4' }]],
        page: [['path', { d: 'M6.5 3h7.5l4 4v14h-11.5Z' }], ['path', { d: 'M14 3v4h4M9.5 12h5M9.5 15.5h5' }]],
        play: [['path', { d: 'M8 5.5v13l10.5-6.5Z' }]],
        // 4.223.0: drawings from the glyph registry (openvibe-shared/glyphs.js).
        arrow: [['path', { d: 'M7 17L17 7M9 7h8v8' }]],
        go: [['path', { d: 'M3.2 12h16.7M13.7 5.7l6.3 6.3l-6.3 6.3' }]],
        clock: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M12 7.5V12l3 2' }]],
        back: [['path', { d: 'M20.8 12H4M10.3 5.7l-6.3 6.3l6.3 6.3' }]],
        game: [['rect', { x: 3.7, y: 7.2, width: 16.7, height: 9.7, rx: 4.4 }], ['path', { d: 'M7.6 10.7v2.7M6.4 12h2.7M15.1 11.6h0M17.4 12.9h0' }]],
        video: [['rect', { x: 3.4, y: 6.4, width: 12.3, height: 11.3, rx: 1.9 }], ['path', { d: 'M15.6 10.2l4.7-2.8v9.4l-4.7-2.8' }]],
        book: [['path', { d: 'M12 6.3C10 4.8 7 4.3 3.5 4.9v13.2c3.5-0.6 6.5-0.1 8.5 1.4c2-1.5 5-2 8.5-1.4V4.9C17 4.3 14 4.8 12 6.3Z' }], ['path', { d: 'M12 6.3v13.2' }]],
        store: [['path', { d: 'M3.7 8.8L5.3 3.7h13.4L20.3 8.8M3.7 8.8h16.5v1.6a2.8 2.8 0 0 1-5.4 0a2.8 2.8 0 0 1-5.6 0A2.8 2.8 0 0 1 3.7 10.4ZM4.8 12.9v7.2h14.5v-7.2M9.9 20.1v-4.1h4.1v4.1' }]],
        wrench: [['path', { d: 'M14.6 3.6a5.2 5.2 0 0 0-4.6 7.3L3.7 17.3V20.3h3.1l6.4-6.4a5.2 5.2 0 0 0 7.3-4.6l-3.2 1.2l-2.5-2.5l1.2-3.2Z' }]],
        code: [['path', { d: 'M7.8 7.8l-4.2 4.2l4.2 4.2M16.2 7.8l4.2 4.2l-4.2 4.2M14.2 4.6l-4.2 14.8' }]],
        spark: [['path', { d: 'M10.4 3.6l1.7 4.8L17 10.1l-4.8 1.7L10.4 16.7l-1.7-4.8L3.9 10.1l4.8-1.7ZM17 14.8l0.8 2.1L19.8 17.6l-2.1 0.8L17 20.3l-0.8-2.1L14.3 17.6l2.1-0.8Z' }]],
        user: [['circle', { cx: 12, cy: 7.4, r: 3.8 }], ['path', { d: 'M4.3 20.5c0-3.9 3.4-6.6 7.7-6.6s7.7 2.6 7.7 6.6' }]],
        star: [['path', { d: 'M12 4l2.6 5.3l5.7 0.6l-4.3 3.9l1.2 5.7L12 16.8l-5.2 2.9l1.2-5.7l-4.3-3.9l5.7-0.6Z' }]],
        toolbox: [['rect', { x: 3.5, y: 8.1, width: 17, height: 11.3, rx: 1.9 }], ['path', { d: 'M9.2 8.1V5.8A1.4 1.4 0 0 1 10.6 4.3h2.8A1.4 1.4 0 0 1 14.8 5.8V8.1M3.5 12.8h17M8.2 11.4v2.8M15.8 11.4v2.8' }]],
        compass: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'm15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1Z' }]],
        home: [['path', { d: 'M3.6 10.6L12 3.3l8.4 7.3v8.4a1 1 0 0 1-1 1h-4.2v-6.3h-6.3v6.3H4.7a1 1 0 0 1-1-1Z' }]],
        live: [['circle', { cx: 12, cy: 11.8, r: 2 }], ['path', { d: 'M8.6 8.4a4.9 4.9 0 0 0 0 7.1M15.4 8.4a4.9 4.9 0 0 1 0 7.1M6.3 6.1a8.1 8.1 0 0 0 0 11.9M17.7 6.1a8.1 8.1 0 0 1 0 11.9' }]],
        shield: [['path', { d: 'M12 3.7L5.5 6.6v5.6c0 4.1 2.8 7.1 6.5 8.4c3.7-1.3 6.5-4.2 6.5-8.4V6.6Z' }]],
    };
    function svgIcon(name) {
        const NS = 'http://www.w3.org/2000/svg';
        const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
        const def = ICON[name] || ICON.grid;
        def.forEach(([tag, at]) => { const n = document.createElementNS(NS, tag); Object.keys(at).forEach((k) => n.setAttribute(k, String(at[k]))); s.append(n); });
        return s;
    }

    // ── Drawing an icon ────────────────────────────────────────────────────────────────────────────────────────
    /** 4.229.0: a card with no person behind it (Deals, Community, Report) wears its site's app icon (design rule 142),
     *  40 px like a person's face beside it, the glyph filling it (the owner, 11-12: "icons to increase size"). */
    function appFace(site) {
        const s = h('span', 'ov-appicon'); s.setAttribute('data-icon', site || 'ov'); s.setAttribute('data-size', '40'); s.setAttribute('aria-hidden', 'true');
        return s;
    }
    function siteIcon(site, size) {
        const s = h('span', 'ov-icon'); s.setAttribute('data-icon', site || 'ov'); s.setAttribute('data-size', String(size)); s.setAttribute('data-fx', 'none');
        return s;
    }
    /** A section's glyph from its name, so every group of apps is marked (the owner, 11-12: "each section should have an icon"). */
    function groupGlyph(name) {
        const n = String(name || '').toLowerCase();
        return /your|yours/.test(n) ? 'user' : /watch|stream|video|live/.test(n) ? 'video' : /talk|belong|chat|social|community/.test(n) ? 'chat'
            : /play|game|fun/.test(n) ? 'game' : /read|ask|news|learn/.test(n) ? 'book' : /shop|money|buy|market/.test(n) ? 'store'
            : /quick/.test(n) ? 'toolbox' : /tool/.test(n) ? 'wrench' : /\bai\b|make/.test(n) ? 'spark' : /develop|build|code/.test(n) ? 'code'
            : /home|popular/.test(n) ? 'home' : /used|most/.test(n) ? 'star' : /recent|where|history/.test(n) ? 'history' : 'compass';
    }
    /** A steady hue per site (the same on every page and device), so each app has its own colour. */
    function hueOf(id) { let x = 7; const t = String(id || 'ov'); let i = 0; while (i < t.length) { x = (x * 31 + t.charCodeAt(i)) % 360; i++; } return x; }
    function appTile(o, a, { tag = 'a', size = 40, small = false } = {}) {
        const el = h(tag, 'ovh-app');
        if (tag === 'a') el.href = safe(a.url) || '#'; else el.type = 'button';
        el.setAttribute('data-id', a.id);
        // An app icon, not a ring (11-09, the owner: "icons need major improvement, make use of the full space… more
        // consistent"): the site's glyph large on a squircle tinted with its own steady hue.
        const ic = h('span', 'ovh-ic');
        ic.style.setProperty('--ovh-h', String(hueOf(a.site || a.id)));
        ic.append(siteIcon(a.site, small ? 44 : 60));
        el.append(ic, h('span', 'ovh-name', a.title));
        if (tag === 'a') el.addEventListener('click', () => { if (o.onOpen) o.onOpen(a); });
        return el;
    }
    function folderTile(o, f, byId, tag) {
        const el = h(tag, 'ovh-app ovh-folder');
        if (tag === 'button') el.type = 'button'; else { el.href = '#'; el.setAttribute('role', 'button'); }
        el.setAttribute('data-id', `folder:${f.id}`);
        el.setAttribute('aria-label', `${f.name} folder, ${f.apps.length} apps`);
        const ic = h('span', 'ovh-ic');
        // Each app's own icon (a tool's own glyph, not the folder's: four identical </> was the owner's complaint, 11-09).
        const glyphOf = (id) => { const a = byId.get(id) || (o.tools || []).find((t) => t.id === id); return a ? (a.site || a.icon || f.glyph) : f.glyph; };
        const seenG = new Set(), cells = [];
        f.apps.forEach((id) => { const g = glyphOf(id); if (cells.length < 4 && !seenG.has(g)) { seenG.add(g); cells.push([id, g]); } });
        f.apps.forEach((id) => { if (cells.length < 4 && !cells.some((c) => c[0] === id)) cells.push([id, glyphOf(id)]); });
        cells.forEach(([id, g]) => { const cell = h('span'); cell.style.setProperty('--ovh-h', String(hueOf(g + id))); cell.append(siteIcon(g, 26)); ic.append(cell); });
        el.append(ic, h('span', 'ovh-name', f.name));
        return el;
    }

    // ── You: the home screen ───────────────────────────────────────────────────────────────────────────────────
    /** Your row: you (to your profile), Display, and your account's menu (profile, settings, switch, Sign out). Drawn by
     *  the menu's top sheet (youCard) since 4.238.0, and by You where the top does not show you. */
    function meRow(o) {
        const u = o.user || {};
        const m = o.me || {};
        const meBox = h('div', 'ovh-mebox');
        const bar = h('div', 'ovh-me');
        const profile = u.username ? `https://openvibe.network/@${encodeURIComponent(u.username)}` : 'https://openvibe.network/my';
        const who = h('a', 'ovh-who'); who.href = profile; who.setAttribute('data-ov-tip', 'Your profile');
        const av = h('span', 'ovh-av');
        const pic = /^https:\/\//.test(String(u.avatar_url || '')) ? u.avatar_url : '';
        if (pic) { const img = h('img'); img.alt = ''; img.src = pic; img.decoding = 'async'; av.append(img); } else av.textContent = String(u.display_name || u.username || '?').trim().charAt(0).toUpperCase();
        const txt = h('span', 'ovh-who-txt');
        txt.append(h('b', '', u.display_name || u.username || 'You'), h('small', '', [u.username ? `@${u.username}` : '', 'Online'].filter(Boolean).join(' · ')));
        who.append(av, txt);
        const look = h('a', 'ovh-ib ovh-me-look-btn'); look.append(svgIcon('look')); look.href = 'https://openvibe.design/look'; look.setAttribute('data-ov-look-open', '');
        look.setAttribute('aria-expanded', 'false'); look.setAttribute('aria-label', 'Display: theme, text size, motion'); look.setAttribute('data-ov-tip', 'Display');
        const acct = h('button', 'ovh-ib ovh-acct'); acct.type = 'button'; acct.append(svgIcon('chev'));
        acct.setAttribute('aria-haspopup', 'menu'); acct.setAttribute('aria-expanded', 'false');
        acct.setAttribute('aria-label', 'Your account'); acct.setAttribute('data-ov-tip', 'Your account');
        bar.append(who, look, acct);

        const menu = h('div', 'ovh-acct-menu'); menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Your account'); menu.hidden = true;
        const item = (glyph, label, act, danger) => {
            const it = typeof act === 'string' ? h('a', 'ovh-acct-i') : h('button', 'ovh-acct-i');
            if (typeof act === 'string') it.href = act; else { it.type = 'button'; it.addEventListener('click', () => { close(); try { act(); } catch { /* the site's */ } }); }
            if (danger) it.classList.add('is-danger');
            it.setAttribute('role', 'menuitem');
            it.append(svgIcon(glyph), h('span', '', label));
            menu.append(it);
        };
        item('user', 'Your profile', profile);
        item('gear', 'Account and settings', 'https://openvibe.network/my');
        if (m.add && safe(m.add)) item('plus', 'Add or switch account', m.add);
        if (typeof m.out === 'function') item('out', 'Sign out', () => m.out(), true);
        let anchored = null;
        const onDown = (e) => { if (!menu.contains(e.target) && !acct.contains(e.target)) close(); };
        const onKey = (e) => { if (e.key === 'Escape') { close(); acct.focus(); } };
        function close() {
            if (menu.hidden) return;
            menu.hidden = true; acct.setAttribute('aria-expanded', 'false');
            if (anchored) { anchored.release(); anchored = null; }
            document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true);
        }
        acct.addEventListener('click', () => {
            if (!menu.hidden) { close(); return; }
            menu.hidden = false; acct.setAttribute('aria-expanded', 'true');
            const S = typeof window !== 'undefined' ? window.OVSurfaces : null;
            if (S && typeof S.anchor === 'function') anchored = S.anchor(menu, acct, { place: 'bottom-end', sheet: false });
            document.addEventListener('pointerdown', onDown, true); document.addEventListener('keydown', onKey, true);
            const first = menu.querySelector('.ovh-acct-i'); if (first) first.focus({ preventScroll: true });
        });
        const panel = h('div', 'ud-look ovh-me-look'); panel.hidden = true;
        meBox.append(bar, menu, panel);
        return meBox;
    }

    function home(el, o) {   // o is replaced by update() when the menu learns more (history, the catalogue)
        styles();
        el.classList.add('ovh');
        el.setAttribute('data-sec', 'home');
        // 4.223.0: You is three tabs (Apps first); the one a person chose stays for this tab of the browser.
        let keptTab = null; try { keptTab = sessionStorage.getItem('ovh-you-tab'); } catch { /* */ }
        const state = { view: 'home', edit: false, folder: null, filter: '', drag: null, suppress: 0, tab: o.startTab || (['apps', 'notifications', 'recent'].includes(keptTab) ? keptTab : 'apps') };
        let L = layoutOf(o);
        const save = () => { const keep = { home: L.home.slice(0, HOME_MAX), folders: L.folders.map((f) => ({ id: f.id, name: f.name, apps: f.apps.slice(0, 400) })) }; writeLocal(keep); pushRemote(o, keep); L.arranged = true; };
        const icons = () => { if (typeof o.mountIcons === 'function') { try { o.mountIcons(el); } catch { /* optional */ } } };
        let meBox = null, notesBox = null;
        // The Look panel (theme, text size, motion, icons) opens under your name, drawn by the navbar (the account menu's).
        if (typeof o.look === 'function') { try { o.look(el); } catch { /* the button stays a link to openvibe.design/look */ } }

        /** You: your picture (online), your name, and Display and Settings beside it. Made once per opening, so an open
         *  Look panel survives the repaints that come as history and the catalogue arrive. */
        // Your row (4.195.0): the old account block is not set here any more (the owner: "get rid of this thing … we
        // didn't really need [it] here, other than like adding your account"). The row has the five things a person needs of
        // an account; under it, only what has no other home in the menu.
        /**
         * You (4.237.0; the owner, 11-13: "completely redesign this card … I hate that thing … the buttons are below"):
         * one slim row, your picture, your name and that you are online, Display, and your account's menu. The menu
         * (anchored in the top layer, OVSurfaces) holds your profile, settings, switching account and signing out. What
         * this site gives you as staff or as a creator (your channel, Admin, moderation) are apps at the start of the
         * grid, not buttons here (ownApps below).
         */
        function me() { if (!meBox) meBox = meRow(o); return meBox; }

        /** What this site gives you (your channel, Admin, moderation): apps at the start of the grid, by your rank. */
        function ownApps() {
            const m = o.me || {};
            const OWN = { 'ov-channel': ['live', 'Your channel'], 'ov-admin': ['shield', 'Admin'], 'ov-mod': ['shield', 'Moderation'] };
            const own = (Array.isArray(m.own) ? m.own : []).filter((it) => it && it.label && (typeof it.onClick === 'function' || (it.href && safe(it.href)))).slice(0, 8);
            if (!own.length) return null;
            const row = h('div', 'ovh-own-apps'); row.setAttribute('aria-label', 'Yours on this site');
            own.forEach((it) => {
                const [g, name] = OWN[it.id] || [ICON[it.glyph] ? it.glyph : 'star', it.short || it.label];
                const el = it.href ? h('a', 'ovh-app ovh-own-app') : h('button', 'ovh-app ovh-own-app');
                if (it.href) el.href = it.href; else { el.type = 'button'; el.addEventListener('click', () => { try { it.onClick(); } catch { /* the site's */ } }); }
                el.setAttribute('data-ov-tip', it.label);
                const ic = h('span', 'ovh-ic ovh-own-ic'); ic.style.setProperty('--ovh-h', String(hueOf(it.id))); ic.append(svgIcon(g));
                el.append(ic, h('span', 'ovh-name', name));
                row.append(el);
            });
            return row;
        }

        /** The three tabs under your row; Notifications carries how many wait. */
        let countBound = false, tabWas = null;
        function youTabs() {
            const bar = h('div', 'ovh-tabs'); bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'You');
            if (!countBound && typeof document !== 'undefined') {
                countBound = true;
                const onCount = () => {
                    if (!el.isConnected) { document.removeEventListener('openvibe-notifications-count', onCount); countBound = false; return; }
                    const t = el.querySelector('.ovh-tab[data-tab="notifications"]'); if (!t) return;
                    let n = 0; try { n = typeof o.unread === 'function' ? Number(o.unread()) || 0 : 0; } catch { n = 0; }
                    let b = t.querySelector('.ovh-tab-n');
                    if (n > 0) { if (!b) { b = h('b', 'ovh-tab-n'); (t.querySelector('.ovh-tab-g') || t).append(b); } b.textContent = n > 99 ? '99+' : String(n); t.setAttribute('aria-label', `Notifications, ${n} new`); }
                    else if (b) { b.remove(); t.setAttribute('aria-label', 'Notifications'); }
                };
                document.addEventListener('openvibe-notifications-count', onCount);
            }
            let unread = 0; try { unread = typeof o.unread === 'function' ? Number(o.unread()) || 0 : 0; } catch { unread = 0; }
            [['apps', 'Apps', 'grid'], ['notifications', 'Notifications', 'bell', 'Alerts'], ['recent', 'History', 'history']].forEach(([id, label, ic, short]) => {
                const b = h('button', 'ovh-tab'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = id;
                b.setAttribute('aria-selected', String(state.tab === id));
                const g = h('span', 'ovh-tab-g'); g.append(svgIcon(ic));
                b.append(g, h('span', 'ovh-tab-t', short || label)); b.setAttribute('aria-label', label); b.setAttribute('data-ov-tip', label);
                if (id === 'notifications' && unread > 0) { g.append(h('b', 'ovh-tab-n', unread > 99 ? '99+' : String(unread))); b.setAttribute('aria-label', `Notifications, ${unread} new`); b.classList.add('has-new'); }
                b.addEventListener('click', () => {
                    if (state.tab === id) return;
                    tabWas = state.tab;
                    state.tab = id; try { sessionStorage.setItem('ovh-you-tab', id); } catch { /* */ } paint();
                });
                // Arrow keys move along the tabs (a tablist's own keys).
                b.addEventListener('keydown', (e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    const all = [...bar.querySelectorAll('.ovh-tab')]; const k = all.indexOf(b);
                    const next = all[(k + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
                    e.preventDefault(); next.click(); requestAnimationFrame(() => { const t = el.querySelector(`.ovh-tab[data-tab="${next.dataset.tab}"]`); if (t) t.focus(); });
                });
                b.tabIndex = state.tab === id ? 0 : -1;
                bar.append(b);
            });
            // The chosen tab is lit and widens to show its name; the others are their glyphs (the owner, 11-13: "hide the
            // label of the inactive tabs"). Switching, the last one folds as the new one opens (Calm: shorter; Off: at once).
            const order = ['apps', 'notifications', 'recent'];
            const dir = tabWas ? Math.sign(order.indexOf(state.tab) - order.indexOf(tabWas)) : 0;
            const was = tabWas && tabWas !== state.tab ? bar.querySelector(`.ovh-tab[data-tab="${tabWas}"]`) : null;
            const now = bar.querySelector(`.ovh-tab[data-tab="${state.tab}"]`);
            tabWas = null;
            if (was && now) {
                was.classList.add('is-was'); now.classList.add('is-new');
                requestAnimationFrame(() => requestAnimationFrame(() => { was.classList.remove('is-was'); now.classList.remove('is-new'); }));
            }
            if (dir) el.dataset.enter = dir > 0 ? 'right' : 'left'; else delete el.dataset.enter;
            return bar;
        }
        /** The whole notifications list, made once per opening (the menu gives the mount): a repaint keeps its place. */
        function notes() {
            if (notesBox) return notesBox;
            notesBox = h('div', 'ovh-notes');
            // Without a token here (a site with its own session) the list is on the person's account page, one tap away.
            if (!o.token) {
                notesBox.append(h('p', 'ovh-hint', 'Your notifications are on your account.'));
                const go = h('a', 'ovh-ib is-text', 'Open notifications'); go.href = 'https://openvibe.network/my#notifications';
                notesBox.append(go);
                return notesBox;
            }
            if (typeof o.notifications === 'function') { try { o.notifications(notesBox); } catch { notesBox.append(h('p', 'ovh-hint', 'Notifications did not load. Close the menu and open it again.')); } }
            else notesBox.append(h('p', 'ovh-hint', 'Notifications are on openvibe.network/my.'));
            return notesBox;
        }

        /** Recent (4.223.0; the owner, 11-12: "jump back in … shows a little more … like in the feed, longer"; "view full
         *  history doesn't even work"): every place you were, newest first, in days, each a card with its whole title. */
        function history() {
            const items = (o.back || []).filter((x) => x && safe(x.url));
            if (!items.length) return null;
            const wrap = h('div', 'ovh-hist');
            const dayOf = (at) => {
                const t = Date.parse(at || ''); if (!t) return 'Earlier';
                const d0 = new Date(); d0.setHours(0, 0, 0, 0);
                const d = new Date(t); d.setHours(0, 0, 0, 0);
                const diff = Math.round((d0 - d) / 864e5);
                return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? 'This week' : 'Earlier';
            };
            const list = h('div', 'ovh-hist-list'); list.setAttribute('role', 'list'); list.setAttribute('aria-label', 'Where you were');
            const more = h('button', 'ovh-all ovh-hist-more', 'Show more'); more.type = 'button';
            let shown = 12;
            const draw = () => {
                list.textContent = '';
                let last = '';
                items.slice(0, shown).forEach((x, i) => {
                    const d = dayOf(x.at);
                    if (d !== last) { last = d; list.append(h('div', 'ovh-hist-day', d)); }
                    const live = x.tag === 'Live';
                    const c = h('a', `ovh-hrow${live ? ' is-live' : ''}`); c.href = safe(x.url); c.setAttribute('role', 'listitem'); c.style.setProperty('--i', String(i % 12));
                    const ic = h('span', 'ovh-ic'); ic.style.setProperty('--ovh-h', String(hueOf(x.site || 'ov'))); ic.append(siteIcon(x.site || 'ov', 44));
                    const t = h('span', 'ovh-htxt');
                    t.append(h('b', '', x.title));
                    const meta = h('small');
                    if (live) meta.append(h('span', 'ovh-live', 'LIVE'));
                    const pre = String(x.metaPre || '').replace(/^Live now(?: · )?/, '');
                    const when = h('span', '', [pre, ago(x.at)].filter(Boolean).join(' · ') || x.meta || '');
                    if (x.at) { when.dataset.at = x.at; when.dataset.pre = pre; }   // search.js keeps the times current
                    meta.append(when); t.append(meta);
                    c.append(ic, t);
                    list.append(c);
                });
                more.hidden = shown >= items.length;
            };
            more.addEventListener('click', () => { shown += 12; draw(); icons(); });
            draw();
            const head = sec('Where you were', 'history');
            const full = h('a', 'ovh-link', 'Full history'); full.href = 'https://openvibe.my/history'; head.append(full);
            wrap.append(head, list, more);
            return wrap;
        }

        /** Jump back in: the last places, as cards you swipe; a stream that is live now says so. */
        function backRail() {
            const items = (o.back || []).filter((x) => x && safe(x.url)).slice(0, 8);
            if (!items.length) return null;
            const wrap = h('div');
            const head = sec('Jump back in');
            head.append(h('small', '', 'where you were last'));
            wrap.append(head);
            const rail = h('div', 'ovh-rail'); rail.setAttribute('role', 'list'); rail.setAttribute('aria-label', 'Jump back in');
            items.forEach((x, i) => {
                const live = x.tag === 'Live';
                const c = h('a', `ovh-card${live ? ' is-live' : ''}`); c.href = safe(x.url); c.setAttribute('role', 'listitem'); c.style.setProperty('--i', String(i));
                const ic = h('span', 'ovh-ic'); ic.style.setProperty('--ovh-h', String(hueOf(x.site || 'ov'))); ic.append(siteIcon(x.site || 'ov', 44));
                const meta = h('small');
                if (live) meta.append(h('span', 'ovh-live', 'LIVE'));
                const pre = String(x.metaPre || '').replace(/^Live now(?: · )?/, '');
                const when = h('span', '', [pre, ago(x.at)].filter(Boolean).join(' · ') || x.meta || '');
                if (x.at) { when.dataset.at = x.at; when.dataset.pre = pre; }   // search.js keeps the times current
                meta.append(when);
                c.append(ic, h('b', '', x.title), meta);
                rail.append(c);
            });
            const ends = () => rail.classList.toggle('is-end', rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4);
            rail.addEventListener('scroll', ends, { passive: true });
            requestAnimationFrame(ends);
            wrap.append(rail);
            const all = h('a', 'ovh-link', 'View full history'); all.href = 'https://openvibe.my/my#history';
            wrap.append(all);
            return wrap;
        }

        /** Most used: the pages you opened, by site, as one bar; its key is the apps themselves, each a way in. */
        function usage() {
            const rows = (o.usage || []).map((u) => ({ a: L.byId.get(u.id), n: u.count })).filter((r) => r.a && r.n > 0).sort((x, y) => y.n - x.n).slice(0, 5);
            if (rows.length < 2) return null;
            const wrap = h('div');
            const head = sec('Most used', 'star');
            // Your stats on Report (private by default; you choose what is public), as the section's link.
            const more = h('a', 'ovh-link', 'Your stats'); more.href = 'https://openvibe.report/me';
            head.append(more);
            wrap.append(head);
            const box = h('div', 'ovh-use');
            const bar = h('div', 'ovh-use-bar'); bar.setAttribute('role', 'img');
            bar.setAttribute('aria-label', rows.map((r) => `${r.a.title} ${r.n}`).join(', '));
            const keys = h('div', 'ovh-use-apps'); keys.setAttribute('role', 'list');
            const CHART = ['#3b82f6', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899'];   // five that tell apart in dark and light
            rows.forEach((r, i) => {
                const c = CHART[i % CHART.length];
                const seg = h('span'); seg.style.setProperty('--n', String(r.n)); seg.style.setProperty('--c', c); seg.style.setProperty('--i', String(i)); bar.append(seg);
                const k = h('a', 'ovh-key'); k.href = safe(r.a.url) || '#'; k.style.setProperty('--c', c); k.setAttribute('role', 'listitem');
                k.setAttribute('aria-label', `${r.a.title}, opened ${num(r.n)} ${r.n === 1 ? 'time' : 'times'}`);
                const ic = h('span', 'ovh-ic'); ic.style.setProperty('--ovh-h', String(hueOf(r.a.site || r.a.id))); ic.append(siteIcon(r.a.site, 44));
                k.append(ic, h('b', '', r.a.title), h('small', '', num(r.n)));
                k.addEventListener('click', () => { if (o.onOpen) o.onOpen(r.a); });
                keys.append(k);
            });
            box.append(bar, keys);
            wrap.append(box);
            return wrap;
        }

        function paintHome() {
            el.textContent = '';
            el.classList.toggle('is-edit', state.edit);
            // Edit keeps everything where it was: a long-press goes straight on to drag the app under the finger, so
            // nothing above the grid may come or go (the macOS run of #394 dropped onto the wrong place when the hint
            // pushed the grid down mid-drag). The cards above stay, quiet and inert; the hint goes under the grid.
            const calm = (x) => { x.classList.add('ovh-calm'); x.inert = state.edit; return x; };
            // The account's block wherever the bar has a person (a site with its own session may have no token for
            // the network's reads yet: sign out and the rest must still be there); else the short bar.
            const top = h('div', 'ovh-top');
            if (((o.user && !o.user.is_anon) || signedIn(o)) && !o.meInTop) top.append(calm(me()));
            if (top.childNodes.length) el.append(top);
            // 4.223.0 (the owner, 11-12: "at the top … the goosely Online bar. Under that is tabs … put the apps more front
            // facing … the first tab"; then "compact … waste of space"): one row of tabs, and on Apps the All and Edit
            // buttons at its end, so no head of its own. Edit stays pressable while the rest is quiet.
            const tab = known(o) ? state.tab : 'apps';
            const tools = tab === 'apps' ? homeTools() : null;
            if (known(o)) {
                const row = h('div', 'ovh-tabrow');
                row.append(calm(youTabs()));
                if (tools) row.append(tools);
                el.append(row);
            }
            const later = () => { icons(); };
            if (tab === 'notifications') { el.append(notes()); return later(); }
            if (tab === 'recent') {
                const u = usage(), b = history();
                if (u) el.append(u);
                if (b) el.append(b);
                if (!u && !b) { const e = h('div', 'ovh-empty'); e.append(svgIcon('history')); const w = h('div'); w.append(h('b', '', 'Nothing here yet'), h('span', '', 'The places you open and the apps you use most show up here.')); e.append(w); el.append(e); }
                return later();
            }
            if (!signedIn(o)) {
                const head = sec(L.arranged ? 'Your home' : 'Popular on OpenVibe', 'home');
                head.append(tools);
                el.append(head);
            }
            if (known(o)) { const own = ownApps(); if (own) el.append(calm(own)); }
            const grid = h('div', 'ovh-grid'); grid.setAttribute('aria-label', 'Your home');
            L.home.forEach((id, i) => grid.append(homeTile(id, i)));
            el.append(grid);
            if (state.edit) {
                el.append(h('p', 'ovh-hint', 'Hold an app, then drag it (a quick swipe scrolls), or use the arrow keys. − takes it off Home; All puts it back.'));
            }
            // Signed out there are no tabs: what you use most and where you were stay under the apps.
            if (!signedIn(o)) { const u = usage(); if (u) el.append(calm(u)); const b = backRail(); if (b) el.append(calm(b)); }
            icons();
        }

        function homeTile(id, i) {
            let t;
            if (id.startsWith('folder:')) {
                const f = L.folders.find((x) => `folder:${x.id}` === id);
                t = folderTile(o, f, L.byId, state.edit ? 'button' : 'a');
                if (!state.edit) t.addEventListener('click', (e) => { e.preventDefault(); if (Date.now() < state.suppress) return; state.view = 'folder'; state.folder = f.id; paint(); });
            } else {
                const a = L.byId.get(id);
                t = appTile(o, a, { tag: state.edit ? 'button' : 'a' });
            }
            const name = t.querySelector('.ovh-name').textContent;
            if (state.edit) {
                t.setAttribute('aria-label', `${name}, ${i + 1} of ${L.home.length}. Arrow keys move it; Delete takes it off Home.`);
                const rm = h('button', 'ovh-badge', '−'); rm.type = 'button'; rm.setAttribute('aria-label', `Take ${name} off Home`);
                rm.addEventListener('click', (e) => { e.stopPropagation(); L.home.splice(L.home.indexOf(id), 1); save(); paint(); });
                rm.addEventListener('pointerdown', (e) => e.stopPropagation());
                t.append(rm);
                t.addEventListener('keydown', (e) => keyMove(e, id));
            }
            press(t, id);
            return t;
        }

        function keyMove(e, id) {
            const i = L.home.indexOf(id); let j = i;
            const cols = Math.max(1, getComputedStyle(el.querySelector('.ovh-grid:not(.ovh-recent)')).gridTemplateColumns.split(' ').length);
            if (e.key === 'ArrowLeft') j = i - 1; else if (e.key === 'ArrowRight') j = i + 1;
            else if (e.key === 'ArrowUp') j = i - cols; else if (e.key === 'ArrowDown') j = i + cols;
            else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); L.home.splice(i, 1); save(); paint(); const n = el.querySelector('.ovh-grid:not(.ovh-recent) .ovh-app'); if (n) n.focus(); return; }
            else return;
            e.preventDefault(); e.stopPropagation();
            j = Math.max(0, Math.min(L.home.length - 1, j));
            if (j === i) return;
            L.home.splice(i, 1); L.home.splice(j, 0, id); save(); paint();
            const n = el.querySelector(`.ovh-grid:not(.ovh-recent) [data-id="${CSS.escape(id)}"]`); if (n) n.focus();
        }

        // Long-press starts Edit (and keeps hold of the app, so a finger can drag at once); in Edit a press drags.
        function press(t, id) {
            t.addEventListener('contextmenu', (e) => { if (state.edit || state.drag) e.preventDefault(); });
            t.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const start = { x: e.clientX, y: e.clientY, id: e.pointerId };
                // 4.225.0, a phone (the owner: a long press then a move lost the icon): entering Edit repaints the grid, so
                // the tile under the finger leaves the page and the grid's own touchmove guard no longer hears this touch;
                // the browser scrolled the menu and cancelled the press. The guard rides on the pressed tile itself, which
                // keeps getting the touch's events after it is replaced, until the finger lifts.
                // 4.236.0 (the owner, 11-13: "in edit mode … trying to scroll up on mobile … you can't"): in Edit a touch
                // only holds the page once it has taken an app (a hold of ARM_MS, or a sideways move); a quick swipe up or
                // down scrolls the menu as anywhere else.
                let armed = false, armTimer = 0;
                if (e.pointerType === 'touch') {
                    const hold = (ev) => { if ((armed || state.drag) && ev.cancelable) ev.preventDefault(); };
                    const done = () => { t.removeEventListener('touchmove', hold); t.removeEventListener('touchend', done); t.removeEventListener('touchcancel', done); };
                    t.addEventListener('touchmove', hold, { passive: false });
                    t.addEventListener('touchend', done);
                    t.addEventListener('touchcancel', done);
                }
                let timer = 0;
                const cancel = () => { clearTimeout(timer); clearTimeout(armTimer); window.removeEventListener('pointermove', early); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel); };
                const early = (m) => {
                    if (m.pointerId !== start.id) return;
                    const dx = m.clientX - start.x, dy = m.clientY - start.y;
                    if (Math.hypot(dx, dy) <= 8) return;
                    // A touch not yet holding an app that moves mostly up or down is a scroll: let it go.
                    if (e.pointerType === 'touch' && state.edit && !armed && Math.abs(dy) > Math.abs(dx)) { cancel(); return; }
                    cancel(); if (state.edit) beginDrag(id, m);
                };
                if (e.pointerType === 'touch' && state.edit) {
                    armTimer = setTimeout(() => {
                        armed = true;
                        try { if (navigator.vibrate) navigator.vibrate(8); } catch { /* */ }
                        const n = el.querySelector(`.ovh-grid:not(.ovh-recent) [data-id="${CSS.escape(id)}"]`); if (n) n.classList.add('is-armed');
                        window.addEventListener('pointerup', () => { const k = el.querySelector('.is-armed'); if (k) k.classList.remove('is-armed'); }, { once: true });
                    }, ARM_MS);
                }
                window.addEventListener('pointermove', early);
                window.addEventListener('pointerup', cancel);
                window.addEventListener('pointercancel', cancel);
                if (!state.edit) {
                    timer = setTimeout(() => {
                        cancel();
                        state.suppress = Date.now() + 700;
                        try { if (navigator.vibrate) navigator.vibrate(12); } catch { /* */ }
                        setEdit(true);
                        // The finger is still down: the next move drags this app.
                        const follow = (m) => { if (m.pointerId === start.id && Math.hypot(m.clientX - start.x, m.clientY - start.y) > 6) { window.removeEventListener('pointermove', follow); beginDrag(id, m); } };
                        window.addEventListener('pointermove', follow);
                        window.addEventListener('pointerup', () => window.removeEventListener('pointermove', follow), { once: true });
                    }, LONG_MS);
                }
            });
            // A long-press must not also open the app.
            t.addEventListener('click', (e) => { if (Date.now() < state.suppress && !(e.target.closest && e.target.closest('.ovh-badge'))) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
        }

        // While editing, a finger on the grid never scrolls the page (11-09, the owner: holding an icon "scrolled up and
        // down… even though I'm in edit mode").
        if (!el.__ovhTouch) { el.__ovhTouch = true; el.addEventListener('touchmove', (e) => { if (state.drag && e.target.closest && e.target.closest('.ovh-grid:not(.ovh-recent)') && e.cancelable) e.preventDefault(); }, { passive: false }); }
        function beginDrag(id, e) {
            if (state.drag) return;
            const ghost = h('div', 'ovh-ghost');
            const src = el.querySelector(`.ovh-grid:not(.ovh-recent) [data-id="${CSS.escape(id)}"] .ovh-ic`);
            if (src) { const c = src.cloneNode(true); c.style.animation = 'none'; ghost.append(c); }
            document.body.append(ghost);
            state.drag = { id, ghost };
            const at = (m) => { ghost.style.left = `${m.clientX}px`; ghost.style.top = `${m.clientY}px`; };
            at(e);
            const lift = () => { const n = el.querySelector(`.ovh-grid:not(.ovh-recent) [data-id="${CSS.escape(id)}"]`); if (n) n.classList.add('is-lifted'); };
            lift();
            // Near the top or bottom of the menu's list, the list scrolls under the finger (one page of apps can be longer
            // than the screen); nothing else scrolls while an app is held.
            const scroller = (() => { let n = el.parentElement; while (n && n !== document.body) { const st = getComputedStyle(n); if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return null; })();
            const move = (m) => {
                if (m.cancelable) m.preventDefault();
                if (scroller) { const r = scroller.getBoundingClientRect(); if (m.clientY < r.top + 56) scroller.scrollTop -= 12; else if (m.clientY > r.bottom - 56) scroller.scrollTop += 12; }
                at(m);
                // Which place the finger is over, by the grid's slots (offsetLeft/offsetTop: where each place IS, not where
                // a sliding app is drawn this frame; the old hit test read the slide in progress, so an app passing under
                // the finger took the drop and it landed one place off), and only well inside it (the middle 70% by 80%),
                // so the grid never flickers between two places.
                const grid = el.querySelector('.ovh-grid:not(.ovh-recent)');
                if (!grid) return;
                const gr = grid.getBoundingClientRect();
                const kids = [...grid.children];
                const to = kids.findIndex((n) => { const x = gr.left + n.offsetLeft, y = gr.top + n.offsetTop; return m.clientX >= x && m.clientX < x + n.offsetWidth && m.clientY >= y && m.clientY < y + n.offsetHeight; });
                const from = L.home.indexOf(id);
                if (to < 0 || to >= L.home.length || to === from) return;
                const sn = kids[to], cx = gr.left + sn.offsetLeft + sn.offsetWidth / 2, cy = gr.top + sn.offsetTop + sn.offsetHeight / 2;
                if (Math.abs(m.clientX - cx) > sn.offsetWidth * 0.35 || Math.abs(m.clientY - cy) > sn.offsetHeight * 0.4) return;
                const before = new Map([...grid.children].map((n) => [n.getAttribute('data-id'), n.getBoundingClientRect()]));
                L.home.splice(from, 1); L.home.splice(to, 0, id);
                grid.textContent = ''; L.home.forEach((x, i) => grid.append(homeTile(x, i)));
                icons(); lift();
                // Each app slides from where it was to where it now is (FLIP), so the grid moves like a phone's.
                [...grid.children].forEach((n) => {
                    const b = before.get(n.getAttribute('data-id')); if (!b) return;
                    const a = n.getBoundingClientRect(); const dx = b.left - a.left, dy = b.top - a.top;
                    if (!dx && !dy) return;
                    n.style.transition = 'none'; n.style.transform = `translate(${dx}px, ${dy}px)`;
                    requestAnimationFrame(() => { n.style.transition = 'transform .26s cubic-bezier(.2, .9, .3, 1)'; n.style.transform = ''; });
                });
            };
            const end = () => {
                window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
                ghost.remove(); state.drag = null; state.suppress = Date.now() + 300; save(); paint();
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', end);
            window.addEventListener('pointercancel', end);
        }

        function homeTools() {
            const edit = h('button', state.edit ? 'ovh-edit is-done' : 'ovh-edit');
            edit.type = 'button';
            edit.append(svgIcon(state.edit ? 'check' : 'pencil'));
            edit.setAttribute('aria-label', state.edit ? 'Done arranging Home' : 'Edit Home');
            edit.setAttribute('data-ov-tip', state.edit ? 'Done' : 'Edit Home: move apps, remove them, add folders');
            edit.setAttribute('aria-pressed', state.edit ? 'true' : 'false');
            edit.addEventListener('click', () => setEdit(!state.edit));
            // All apps sits beside Edit, small, with its count (the owner, 2026-11-10: "all apps should just be in a
            // button in the corner so it's more compact").
            const total = L.byId.size;
            const all = h('button', 'ovh-allbtn'); all.type = 'button';
            all.append(svgIcon('grid'), h('b', '', String(total)));
            all.setAttribute('aria-label', `All apps (${total})`); all.setAttribute('data-ov-tip', `All apps (${total})`);
            all.addEventListener('click', () => { state.view = 'drawer'; paint(); });
            const tools = h('div', 'ovh-headtools'); tools.append(all, edit);
            return tools;
        }
        function setEdit(on) { state.edit = on; paint(); const b = el.querySelector('.ovh-edit'); if (b && !on) b.focus(); }

        function paintFolder() {
            const f = L.folders.find((x) => x.id === state.folder);
            if (!f) { state.view = 'home'; return paintHome(); }
            el.textContent = '';
            el.append(backHead(f.name));
            const grid = h('div', 'ovh-grid'); grid.setAttribute('aria-label', f.name);
            const ranked = f.apps.map((id) => L.byId.get(id) || (o.tools || []).find((t) => t.id === id)).filter(Boolean);
            const shown = f.id === 'tools' ? ranked.slice(0, 24) : ranked;
            shown.forEach((a) => grid.append(appTile(o, a)));
            el.append(grid);
            if (f.more) { const m = h('a', 'ovh-all', f.more.label); m.append(svgIcon('go')); m.href = f.more.href; el.append(m); }
            icons();
        }

        function paintDrawer() {
            el.textContent = '';
            // 4.229.0 (the owner, 11-12: "confusing"): one search. The menu's own pill reads "Find among 64 apps" and
            // filters this list as you type (OpenVibeHome's filter()); the head is the place's name and its count.
            const head = backHead('All apps', { count: L.byId.size, hint: typeof o.onView === 'function' ? 'Type above to find one' : '' });
            el.append(head);
            let field = null;
            if (typeof o.onView !== 'function') {   // a host without the menu's pill keeps the box of its own
                field = h('input', 'ovh-filter'); field.type = 'search'; field.placeholder = `Find among ${L.byId.size} apps`; field.setAttribute('aria-label', 'Find an app'); field.value = state.filter;
                head.append(field);
            }
            const body = h('div');
            el.append(body);
            const groups = (o.groups && o.groups.length ? o.groups : [{ id: '', name: 'OpenVibe' }]).slice();
            const draw = () => {
                body.textContent = '';
                const q = state.filter.trim().toLowerCase();
                const all = [...L.byId.values()].filter((a) => !q || a.title.toLowerCase().includes(q)).sort((a, b) => a.title.localeCompare(b.title));
                const yours = all.filter((a) => a.id.startsWith('you:'));
                const sets = [];
                if (yours.length) sets.push(['Yours', yours]);
                groups.forEach((g, gi) => {
                    const list = all.filter((a) => !a.id.startsWith('you:') && (g.id ? a.group === g.id : true) && (g.id || gi === groups.length - 1 || true));
                    if (list.length) sets.push([g.name, list]);
                });
                const placed = new Set(sets.flatMap(([, list]) => list.map((a) => a.id)));
                const rest = all.filter((a) => !placed.has(a.id));
                if (rest.length) sets.push(['More', rest]);
                L.folders.forEach((f) => { if (!q || f.name.toLowerCase().includes(q)) sets.push([`${f.name} folder`, [{ folder: f }]]); });
                if (!sets.length) { body.append(h('p', 'ovh-note', 'No app has that name.')); return; }
                sets.forEach(([name, list]) => {
                    body.append(sec(name, groupGlyph(name), list.length));
                    const grid = h('div', 'ovh-grid');
                    list.forEach((a) => {
                        const id = a.folder ? `folder:${a.folder.id}` : a.id;
                        const t = a.folder ? folderTile(o, a.folder, L.byId, 'a') : appTile(o, a);
                        if (a.folder) t.addEventListener('click', (e) => { e.preventDefault(); state.view = 'folder'; state.folder = a.folder.id; paint(); });
                        if (!L.home.includes(id) && L.home.length < HOME_MAX) {
                            const add = h('button', 'ovh-badge is-add', '+'); add.type = 'button';
                            add.setAttribute('aria-label', `Put ${a.folder ? a.folder.name : a.title} on Home`);
                            add.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); L.home.push(id); save(); draw(); icons(); });
                            t.append(add);
                        }
                        grid.append(t);
                    });
                    body.append(grid);
                });
                icons();
            };
            if (field) field.addEventListener('input', () => { state.filter = field.value; draw(); });
            drawerDraw = draw;
            draw();
        }
        let drawerDraw = null;

        function backHead(title, { count = null, hint = '' } = {}) {
            const head = h('div', 'ovh-head');
            const back = h('button', 'ovh-back'); back.type = 'button'; back.append(svgIcon('back'));
            back.setAttribute('aria-label', 'Back to your home'); back.setAttribute('data-ov-tip', 'Back to your home');
            back.addEventListener('click', () => { state.view = 'home'; state.folder = null; state.filter = ''; paint(); const b = el.querySelector('.ovh-allbtn'); if (b) b.focus(); });
            const name = h('div', 'ovh-head-t');
            const b = h('b', '', title);
            if (count != null) b.append(h('span', 'ovh-head-n', String(count)));
            name.append(b);
            if (hint) name.append(h('small', '', hint));
            head.append(back, name);
            return head;
        }
        function sec(text, glyph, count) {
            const s = h('div', 'ovh-sec');
            if (glyph) { const i = h('i', 'ovh-sec-ic'); i.append(svgIcon(glyph)); s.append(i); }
            s.append(h('span', '', text));
            if (count != null) s.append(h('b', 'ovh-sec-n', String(count)));
            s.append(h('i', 'ovh-sec-sp'));
            return s;
        }

        function paint() {
            // The menu hears which view shows, so its pill can search inside it (All apps) or go back to searching OpenVibe.
            if (typeof o.onView === 'function') { try { o.onView(state.view, { apps: L.byId.size }); } catch { /* the menu's own */ } }
            if (state.view === 'folder') return paintFolder(); if (state.view === 'drawer') return paintDrawer(); return paintHome();
        }
        paint();
        // Network's copy wins when it answers and differs.
        pullRemote(o).then((r) => {
            if (!r) return;
            const now = JSON.stringify(L.home);
            const known = r.home.filter((id) => L.byId.has(id) || (id.startsWith('folder:') && L.folders.some((f) => `folder:${f.id}` === id)));
            if (!known.length || JSON.stringify(known) === now) return;
            writeLocal({ home: known, folders: r.folders });
            L = layoutOf(o);
            if (!state.drag && el.isConnected) paint();
        });
        return {
            repaint: paint,
            /** 4.229.0: which view shows ('home', 'drawer' for All apps, 'folder'), and the pill's words for All apps. */
            get view() { return state.view; },
            apps: () => L.byId.size,
            filter(q) { state.filter = String(q || ''); if (state.view === 'drawer' && drawerDraw) drawerDraw(); },
            /** Show 'drawer' (All apps) or 'home' from outside: a menu address (you/apps) opens All apps. */
            show(view) { if (view !== 'drawer' && view !== 'home') return; state.view = view; state.folder = null; state.filter = ''; paint(); },
            /** The menu learned more (history, the catalogue): redraw with it, unless the person is arranging. */
            update(next) { o = next; L = layoutOf(o); if (!state.drag && !state.edit && state.view === 'home') paint(); },
        };
    }

    // ── Your Actor, on top of You ──────────────────────────────────────────────────────────────────────────────
    /** The glyph for what an agent is doing now (the owner, 11-12: "put an icon depending on the agent status … custom for
     *  the agent"): its step's words first, then its state. A site or Actor may name one (`a.now.glyph`) from the registry. */
    function doingGlyph(a, st) {
        const named = a && a.now && a.now.glyph; if (named && ICON[named]) return named;
        const t = String((a && a.now && a.now.current_step) || '').toLowerCase();
        if (st === 'waiting') return 'chat';
        if (st === 'paused') return 'clock';
        if (/read|review|look|watch/.test(t)) return 'book';
        if (/search|find|hunt|scan|brows/.test(t)) return 'compass';
        if (/writ|draft|post|reply|edit/.test(t)) return 'pencil';
        if (/code|build|fix|deploy|test/.test(t)) return 'code';
        if (/stream|live|clip|video/.test(t)) return 'live';
        if (/buy|deal|shop|price|sell/.test(t)) return 'store';
        if (/game|play/.test(t)) return 'game';
        if (/think|plan|idea/.test(t)) return 'spark';
        return st === 'working' ? 'spark' : 'clock';
    }
    async function actor(box, o) {
        const base = String(o.actorBase || ACTOR).replace(/\/+$/, '');
        let a = null;
        try {
            const r = await fetch(`${base}/api/v1/me/actor`, { credentials: 'omit', headers: { Accept: 'application/json', Authorization: `Bearer ${o.token}` } });
            if (r.ok) a = await r.json();
        } catch { a = null; }
        if (!box.isConnected) return;
        box.textContent = '';
        if (a && a.id && a.enabled !== false) {
            const asks = Array.isArray(a.asks) ? a.asks : [];
            const st = asks.length ? 'waiting' : ['working', 'resting', 'paused'].includes(a.status) ? a.status : 'resting';
            const label = { working: 'Working', resting: 'Resting', paused: 'Paused', waiting: 'Waiting for you' }[st];
            const b = h('button', 'ovh-actor'); b.type = 'button';
            const face = h('span', 'ovh-face');
            const pic = a.avatar && /^https:\/\//.test(String(a.avatar.url || '')) ? a.avatar.url : '';
            if (pic) { const img = h('img'); img.alt = ''; img.src = pic; face.append(img); } else face.textContent = String(a.name || 'A').trim().charAt(0).toUpperCase() || 'A';
            // What it is doing, as a glyph on its face (its whole face when it has no picture).
            const doing = h('span', `ovh-doing is-${st}`); doing.append(svgIcon(doingGlyph(a, st))); doing.setAttribute('aria-hidden', 'true');
            if (!pic) { face.textContent = ''; face.classList.add('is-glyph'); }
            face.append(doing);
            const txt = h('span', 'ovh-actor-txt');
            const name = h('b', '', 'Actor');
            const chip = h('span', `ovh-chip is-${st}`); chip.append(h('span', 'ovh-dot'), document.createTextNode(label));
            name.append(chip);
            const now = a.now || {};
            txt.append(name, h('small', '', (a.name && !asks.length ? `${a.name} · ` : '') + (asks.length ? `It asks you: ${asks[0].text || ''}` : now.current_step ? String(now.current_step) : st === 'paused' ? 'Paused until you resume it' : 'Resting until its next goal is due')));
            const go = h('span', asks.length ? 'ovh-go is-answer' : 'ovh-go is-ic'); go.append(svgIcon(asks.length ? 'chat' : 'arrow'));
            if (asks.length) go.append(h('span', '', 'Answer'));
            b.setAttribute('aria-label', `${a.name || 'Your Actor'}, ${label}: ${asks.length ? 'answer it' : 'open it'}`);
            b.append(face, txt, go);
            b.addEventListener('click', () => {
                if (root.OpenVibeNavbar && typeof root.OpenVibeNavbar.openDock === 'function') { if (o.close) o.close(); try { root.OpenVibeNavbar.openDock('agent'); return; } catch { /* */ } }
                location.href = `${base}/you`;
            });
            box.append(b);
            return;
        }
        // No Actor yet: one invitation, which the person can put away.
        try { if (localStorage.getItem(INVITE_KEY) === 'off') return; } catch { /* */ }
        const card = h('div', 'ovh-actor'); card.setAttribute('role', 'group'); card.setAttribute('aria-label', 'Your own AI');
        // 11-09, the owner: the line was cut off, the icon small, the buttons plain words: the whole sentence on two lines,
        // a bigger mark, and two real buttons (beside the words on a wide menu, under them on a phone).
        card.classList.add('is-invite');
        const face = h('span', 'ovh-face'); face.append(siteIcon('actor', 30));
        const txt = h('span', 'ovh-actor-txt');
        txt.append(h('b', '', 'Your own AI'), h('small', '', 'It works for you while you watch.'));
        const acts = h('span', 'ovh-acts');
        const go = h('a', 'ovh-go', 'Set it up'); go.href = `${base}/you`;
        const no = h('button', 'ovh-x'); no.append(svgIcon('x')); no.type = 'button'; no.setAttribute('aria-label', 'Not now'); no.title = 'Not now';
        no.addEventListener('click', () => { try { localStorage.setItem(INVITE_KEY, 'off'); } catch { /* */ } box.textContent = ''; });
        acts.append(go, no);
        card.append(face, txt, acts);
        box.append(card);
        if (typeof o.mountIcons === 'function') { try { o.mountIcons(box); } catch { /* */ } }
    }

    // ── Feed: what's new with you, and today ───────────────────────────────────────────────────────────────────
    function wallTop(el, o) {
        styles();
        el.classList.add('ovh');
        el.setAttribute('data-sec', 'wall-top');
        el.textContent = '';
        const compose = h('div'); const today = h('div');
        el.append(compose, today);
        // The composer shows when Community says this person can post (pulse viewer.can_post), so it never offers a
        // post that would be refused.
        o.pulseReady.then((p) => { if (p && p.viewer && p.viewer.can_post && signedIn(o) && compose.isConnected) composer(compose, o); });
        fetch(`${o.apiBase || 'https://openvibe.network'}/api/v1/frame/today`, { credentials: 'omit', headers: { Accept: 'application/json' } })
            .then((r) => (r.ok ? r.json() : null)).then((t) => { if (t && today.isConnected) paintToday(today, t); }).catch(() => {});
    }
    // A picture for a post: scaled to at most 2560 px on its long side (phone photos are often 12 MB; Community takes 8 MB),
    // and a small preview drawn to a data: address (every site's img-src allows data:, not all allow blob:).
    async function preparePicture(file) {
        const out = { file, thumb: '' };
        try {
            const bmp = await createImageBitmap(file);
            const draw = (w, hgt) => { const c = document.createElement('canvas'); c.width = w; c.height = hgt; c.getContext('2d').drawImage(bmp, 0, 0, w, hgt); return c; };
            const t = 112 / Math.max(bmp.width, bmp.height);
            out.thumb = draw(Math.max(1, Math.round(bmp.width * t)), Math.max(1, Math.round(bmp.height * t))).toDataURL('image/jpeg', 0.8);
            const k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
            if ((k < 1 || file.size > 7.5e6) && !/gif/i.test(file.type)) {
                const blob = await new Promise((ok) => draw(Math.round(bmp.width * k), Math.round(bmp.height * k)).toBlob(ok, 'image/jpeg', 0.86));
                if (blob) out.file = new File([blob], `${String(file.name || 'picture').replace(/\.[a-z0-9]+$/i, '')}.jpg`, { type: 'image/jpeg' });
            }
        } catch { /* the original goes as it is */ }
        return out;
    }
    // The Feed's composer is the shared one (ov-composer.js 4.215.0, composer v2, preset post): the person's picture, a
    // box that grows, photos as tiles each with its description, files, emoji, voice, the ring and Post. The 11-12
    // owner: "this composer is completely ugly and broken … doesn't have the file attachment" (its own + drew an icon
    // with no stroke, so it could not be seen). What it posts is still the Feed's: pictures through the frame with their
    // descriptions, other files to Media, then the post or the status.
    function composer(box, o) {
        const first = String((o.user && (o.user.display_name || o.user.username)) || '').split(/\s+/)[0];
        const auth = { Authorization: `Bearer ${o.token}` };
        const upload = async (url, f) => {
            const fd = new FormData(); fd.append('file', f, f.name || 'file');
            const r = await fetch(url, { method: 'POST', credentials: 'omit', headers: auth, body: fd });
            const j = await r.json().catch(() => ({}));
            const id = (j.attachment && (j.attachment.media_id || j.attachment.id)) || j.id;
            if (!r.ok || !id) throw new Error(j.detail || `${f.name || 'File'} did not upload.`);
            return id;
        };
        const start = () => {
            if (!root.OpenVibeComposer || !root.OpenVibeComposer.mount || !box.isConnected || box.querySelector('#ovh-feed-composer')) return;
            const pics = new Map();
            const c = root.OpenVibeComposer.mount(box, {
                preset: 'post', id: 'ovh-feed-composer', user: o.user, maxLength: 2000, maxFiles: 10, maxMb: 300,
                placeholder: first ? `What's new, ${first}?` : "What's new?", label: "What's new",
                async onSubmit(v, api) {
                    const images = v.files.filter((f) => /^image\//.test(f.type));
                    if (images.length > 4) { api.ctx.note('Choose up to four pictures.'); return false; }
                    // 4.228.0: words and descriptions are optional (the owner, 11-12: a picture alone, as on any social
                    // app). A picture nobody described is described by AI as it posts (Network /api/frame/caption, the
                    // person's own allowance); if that cannot be done it posts without, never stops the post.
                    for (const f of images) {
                        const field = pics.get(f);
                        if (!field || field.value.trim()) continue;
                        c.send.textContent = 'Describing your picture';
                        try { await api.ctx.caption(f); } catch { /* posts without */ }
                        if (!field.value.trim() && api.ctx.alt(f)) field.value = api.ctx.alt(f);
                    }
                    const pictures = [], attachments = [];
                    for (const f of v.files) {
                        c.send.textContent = `Uploading ${f.name || 'file'}`;
                        if (/^image\//.test(f.type)) {
                            const prepared = await preparePicture(f);
                            const media_id = await upload(`${o.frameBase || FRAME}/attachments`, prepared.file);
                            pictures.push({ media_id, alt: ((pics.get(f) && pics.get(f).value) || '').trim().slice(0, 300) });
                        } else attachments.push(await upload('https://openvibe.media/api/v1/attachments', f));
                    }
                    c.send.textContent = 'Posting';
                    const url = v.files.length ? `${o.frameBase || FRAME}/posts` : `${o.frameBase || FRAME}/status`;
                    const body = v.files.length ? { text: v.text, pictures, attachments } : { text: v.text };
                    try {
                        const r = await fetch(url, { method: 'POST', credentials: 'omit', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: JSON.stringify(body) });
                        const j = await r.json().catch(() => ({}));
                        if (!r.ok) throw new Error(j.detail || 'It did not post. Try again in a moment.');
                        pics.clear();
                        api.ctx.note('Posted. It is on your profile and in the Feed.');
                        if (o.onPosted) o.onPosted(j);
                    } finally { c.send.textContent = 'Post'; }
                    return true;
                },
            });
            // Each picture asks what it shows (the Feed shows pictures with their descriptions).
            c.form.addEventListener('ovc:file-added', (e) => {
                const { file: f, chip } = e.detail;
                if (!/^image\//.test(f.type)) return;
                chip.classList.add('ovc-image');
                const alt = h('input'); alt.type = 'text'; alt.maxLength = 300; alt.placeholder = 'What it shows (or ✨ AI)';
                alt.setAttribute('aria-label', `What ${f.name || 'the picture'} shows (optional: AI writes it if you leave it)`);
                chip.append(alt); pics.set(f, alt);
            });
            // ✨ on a picture wrote its description: it goes in the picture's field unless the person wrote one.
            c.form.addEventListener('ovc:caption', (e) => {
                const field = pics.get(e.detail.file);
                if (field && !field.value.trim() && e.detail.alt) field.value = e.detail.alt;
            });
            c.form.addEventListener('ovc:file-removed', (e) => { pics.delete(e.detail.file); });
        };
        if (root.OpenVibeComposer && root.OpenVibeComposer.mount) start();
        else if (typeof o.sibling === 'function') {
            let script = document.getElementById('ov-composer-script');
            if (!script) { script = document.createElement('script'); script.id = 'ov-composer-script'; script.src = o.sibling('ov-composer.js'); script.onload = start; document.head.append(script); }
            else script.addEventListener('load', start, { once: true });
        }
    }
    function spark(series) {
        const v = (Array.isArray(series) ? series : []).map(Number).filter((x) => Number.isFinite(x)).slice(-14);
        if (v.length < 2) return null;
        const max = Math.max(...v, 1), w = 100, hgt = 18;
        const pts = v.map((x, i) => `${(i / (v.length - 1)) * w},${hgt - (x / max) * (hgt - 2) - 1}`).join(' ');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
        const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        pl.setAttribute('points', pts); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', 'currentColor'); pl.setAttribute('stroke-width', '1.6'); pl.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.append(pl);
        return svg;
    }
    function paintToday(box, t) {
        const rows = [['people', 'People'], ['streams', 'Streams'], ['posts', 'Posts'], ['videos', 'New videos']]
            .map(([k, label]) => [label, t[k] && typeof t[k] === 'object' ? t[k] : { today: t[k] }]).filter(([, v]) => v && Number.isFinite(Number(v.today)));
        if (!rows.length) return;
        const s = h('div', 'ovh-sec'); s.append(h('span', '', 'Today on OpenVibe')); box.append(s);
        const grid = h('div', 'ovh-today');
        rows.forEach(([label, v]) => {
            const c = h('div', 'ovh-stat');
            c.append(h('b', '', num(v.today)), h('small', '', label));
            const sp = spark(v.series); if (sp) c.append(sp);
            grid.append(c);
        });
        box.append(grid);
    }

    // ── Feed: the wall ─────────────────────────────────────────────────────────────────────────────────────────
    const LIVE_RE = /^(.{1,60}?) went live(?::\s*(.*))?$/;
    function pulseUrl(o, cursor) {
        const p = new URLSearchParams({ limit: '20' });
        if (signedIn(o)) p.set('for', 'me');
        if (cursor) p.set('after', cursor);
        return `${o.frameBase || FRAME}/wall?${p}`;
    }
    function loadPulse(o, cursor) {
        return fetch(pulseUrl(o, cursor), { credentials: 'omit', headers: Object.assign({ Accept: 'application/json' }, signedIn(o) ? { Authorization: `Bearer ${o.token}` } : {}) })
            .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    }
    function timeline(el, o) {
        styles();
        el.classList.add('ovh');
        el.setAttribute('data-sec', 'wall');
        el.textContent = '';
        const s = h('div', 'ovh-sec'); s.append(h('span', '', 'On OpenVibe'));
        const list = h('div', 'ovh-wall');
        for (let k = 0; k < 3; k++) list.append(h('span', 'ovh-skel'));
        el.append(s, list);
        let next = null;
        const more = h('button', 'ovh-all', 'Show more'); more.type = 'button'; more.hidden = true;
        el.append(more);
        const draw = (j, append) => {
            if (!append) list.textContent = '';
            const items = (j && Array.isArray(j.items) ? j.items : []).filter((x) => x && typeof x.title === 'string' && safe(x.url));
            // Nothing to show: the section goes, not a line saying so (11-09, the owner: "why does it say show more if there's
            // nothing new").
            if (!items.length && !append) { el.hidden = true; more.hidden = true; return; }
            el.hidden = false;
            // Went live, back to back: one row of names.
            let lives = null;
            items.forEach((x) => {
                const m = LIVE_RE.exec(x.title.trim());
                if (m) {
                    if (!lives) {
                        const row = h('div', 'ovh-entry');
                        const ic = h('span', 'ovh-ic'); ic.append(siteIcon('live', 26));
                        const txt = h('span', 'ovh-entry-txt'); txt.append(h('b', '', 'Went live recently'));
                        lives = h('span', 'ovh-lives'); txt.append(lives, h('small', '', ago(x.occurred_at || x.at)));
                        row.append(ic, txt); list.append(row);
                    }
                    if (lives.childNodes.length < 8) { const a = h('a', '', m[1]); a.href = safe(x.url); a.title = m[2] || ''; lives.append(a); }
                    return;
                }
                lives = null;
                const a = h('a', 'ovh-entry'); a.href = safe(x.url);
                const svc = String((x.ref && x.ref.service) || x.service || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
                const ic = h('span', 'ovh-ic'); ic.append(siteIcon(svc || 'ov', 26));
                const txt = h('span', 'ovh-entry-txt');
                txt.append(h('b', '', x.title.slice(0, 220)));
                const meta = [ago(x.occurred_at || x.at), x.via ? `via ${String(x.via).slice(0, 40)}` : '', x.origin === 'ai' ? 'made by AI' : ''].filter(Boolean).join(' · ');
                if (meta) txt.append(h('small', '', meta));
                a.append(ic, txt); list.append(a);
            });
            next = j && j.next_cursor ? j.next_cursor : null;
            more.hidden = !next;
            if (typeof o.mountIcons === 'function') { try { o.mountIcons(el); } catch { /* */ } }
        };
        o.pulseReady.then((j) => { if (el.isConnected) draw(j, false); });
        more.addEventListener('click', async () => { more.disabled = true; const j = await loadPulse(o, next); more.disabled = false; if (j) draw(j, true); });
    }


    // ── Feed v2: a real feed (owner, 11-09: "a real feed… you scroll through easy content… sections or a filter system…
    // clean, intuitive"). Community's GET /api/v1/feed (plan "Feed v2"): one stream of cards by kind, chips on top, more as
    // you near the end. When the API is not there yet, the pulse wall above stands (timeline()).
    // Following needs a signed-in person (the feed reads their Network follows); the rest are the feed's kinds (Community
    // #310: wiki pages, quest badges, busy chat rooms, calendar events and the people who joined, beside the media kinds).
    const KINDS = [['', 'For you'], ['following', 'Following'], ['live', 'Live'], ['video', 'Videos'], ['clip', 'Clips'], ['pic', 'Pics'], ['post', 'Posts'], ['rundown', 'Rundown'], ['meme', 'Memes'], ['game', 'Games'], ['chat', 'Chat'], ['event', 'Events'], ['work', 'Jobs'], ['deal', 'Deals'], ['report', 'Stats'], ['wiki', 'Wiki'], ['quest', 'Quests'], ['update', 'Updates']];
    function feedUrl(o, kind, cursor) {
        const p = new URLSearchParams({ limit: '12' });
        if (kind === 'following') p.set('following', '1'); else if (kind) p.set('kind', kind);
        if (cursor) p.set('cursor', cursor);
        return `${o.frameBase || FRAME}/feed?${p}`;
    }
    function loadFeed(o, kind, cursor) {
        return fetch(feedUrl(o, kind, cursor), { credentials: 'omit', headers: Object.assign({ Accept: 'application/json' }, signedIn(o) ? { Authorization: `Bearer ${o.token}` } : {}) })
            .then((r) => (r.ok ? r.json() : null)).then((j) => (j && Array.isArray(j.items) ? j : null)).catch(() => null);
    }
    // A preview is a video that starts by itself: Calm and Off both leave it to a tap (as does a data saver).
    const still = () => { try { const m = document.documentElement.getAttribute('data-ov-motion'); return m === 'off' || m === 'reduced' || (!m && matchMedia('(prefers-reduced-motion: reduce)').matches) || !!(navigator.connection && navigator.connection.saveData); } catch { return false; } };
    const count = (n) => { const v = Number(n) || 0; return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v); };
    let player = null;   // one IntersectionObserver plays the preview in view and pauses the rest
    function watchPreview(box, c) {
        const media = c.media || {};
        const preview = safe(media.preview);
        if (!preview || still() || typeof IntersectionObserver !== 'function') return;
        player = player || new IntersectionObserver((es) => es.forEach((x) => {
            const v = x.target.querySelector('video');
            if (x.isIntersecting && x.intersectionRatio >= 0.6) {
                if (!v) { const nv = document.createElement('video'); nv.muted = true; nv.loop = true; nv.playsInline = true; nv.setAttribute('playsinline', ''); nv.preload = 'none'; nv.src = x.target.getAttribute('data-preview'); nv.className = 'ovfd-video'; x.target.append(nv); nv.play().catch(() => {}); }
                else v.play().catch(() => {});
            } else if (v) v.pause();
        }), { threshold: [0, 0.6] });
        box.setAttribute('data-preview', preview);
        player.observe(box);
    }
    const glyph = (name) => { const g = svgIcon(name); g.setAttribute('class', 'ovfd-gl'); return g; };
    const when = (iso) => {
        const t = Date.parse(iso || ''); if (!t) return '';
        const d = new Date(t);
        return d.toDateString() === new Date().toDateString() ? ago(iso) : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };
    /** "Starts 2026-11-12 18:00 UTC" (Today's line when an event has no description) in the reader's own time. */
    const startsLocal = (text) => {
        const m = /^Starts (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) UTC$/.exec(String(text || ''));
        if (!m) return text;
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
        return `Starts ${d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    };
    const tidy = (v) => String(v || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
    /** A face: the person's picture, else their initial; the site's icon on its hue when nobody is behind the card. */
    function faceOf(c, cls) {
        const face = h('span', cls || 'ovfd-face');
        const av = c.actor && safe(c.actor.avatar);
        if (av && /^https:/.test(av)) { const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = av; face.append(img); }
        else if (!c.actor) { face.classList.add('is-site'); face.append(appFace(c.site || 'ov')); }
        else face.textContent = String(c.actor.name || '?').charAt(0).toUpperCase();
        return face;
    }
    /**
     * Something that happened, as one row (11-09, the owner: "all kinds of events and even global chat… everything date
     * by date"): who or what on the left, what happened in words, then the kind, the site and when. A thing to look at
     * (a video, a picture, a post) stays a card; a busy room, people joining, a badge, a calendar entry, a wiki edit
     * and a stream that is over read better as a line.
     */
    function actRow(c, { tile, title, what, icon, text, site = true }) {
        const a = h('a', `ovfd-act ovfd-k-${String(c.kind || '').replace(/[^a-z]/g, '')}`); a.href = safe(c.url);
        const body = h('span', 'ovfd-act-txt');
        body.append(h('b', '', String(title || c.title || '').slice(0, 200)));
        const meta = h('small', '');
        if (icon) meta.append(glyph(icon));
        meta.append(document.createTextNode(` ${[what, site ? (c.site_name || c.site) : '', when(c.at)].filter(Boolean).join(' · ')}`));
        body.append(meta);
        if (text) body.append(h('span', 'ovfd-act-more', String(text).slice(0, 200)));
        a.append(tile, body);
        return a;
    }
    function activity(c) {
        const kind = String(c.kind || '');
        const title = String(c.title || '');
        const who = String((c.actor && c.actor.name) || '').slice(0, 60);
        if (kind === 'member') {
            const n = (/^(\d[\d,]*)\s/.exec(title) || [])[1];
            const tile = h('span', 'ovfd-tile ovfd-tile-num'); tile.append(h('b', '', n ? `+${n}` : '+'), glyph('people'));
            return actRow(c, { tile, what: 'New on OpenVibe', icon: 'people', text: c.text, site: false });
        }
        if (kind === 'chat') {
            const m = /^#(\S{1,64}):\s*(\d+) messages this hour$/.exec(title);
            return actRow(c, { tile: faceOf({ site: c.site || 'chat' }), title: m ? `#${m[1]} is busy` : title, what: m ? `${m[2]} messages this hour` : 'Chat', icon: 'chat', text: c.text });
        }
        if (kind === 'event') {
            const m = /^(Live|Event):\s*(.+)$/.exec(title);
            const st = /^Starts (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) UTC$/.exec(String(c.text || ''));
            let tile;
            if (st) {
                const d = new Date(Date.UTC(+st[1], +st[2] - 1, +st[3], +st[4], +st[5]));
                tile = h('span', 'ovfd-tile ovfd-tile-date');
                tile.append(h('small', '', d.toLocaleDateString('en-US', { month: 'short' })), h('b', '', String(d.getDate())));
            } else tile = faceOf(c.actor ? c : { site: c.site || 'today' });
            return actRow(c, { tile, title: m ? m[2] : title, what: m && m[1] === 'Live' ? 'Stream on the calendar' : 'Event', icon: 'calendar', text: startsLocal(c.text), site: false });
        }
        if (kind === 'quest') {
            const m = /^Finished a quest:\s*(.+)$/.exec(title);
            const tile = h('span', 'ovfd-tile-wrap'); tile.append(faceOf(c), h('span', 'ovfd-badge')); tile.lastChild.append(glyph('trophy'));
            return actRow(c, { tile, title: m ? m[1] : title, what: who ? `${who} finished a quest` : 'Quest finished', icon: 'trophy' });
        }
        if (kind === 'wiki') {
            const m = /^Wiki:\s*([^/]{1,40}?)\s*\/\s*(.+)$/.exec(title);
            return actRow(c, { tile: faceOf(c), title: m ? cap(tidy(m[2])) : title, what: m ? `${who ? `${who} · ` : ''}Wiki page in ${tidy(m[1])}` : `${who ? `${who} · ` : ''}Wiki page`, icon: 'page', text: c.text, site: false });
        }
        if (kind === 'update') return actRow(c, { tile: faceOf({ site: c.site || 'ov' }), what: 'Update', text: c.text });
        if (kind === 'stream') {
            const t = title.replace(/^.{1,60}? went live:?\s*/i, '');
            return actRow(c, { tile: faceOf(c), title: t || `${who} streamed`, what: who ? `${who} streamed` : 'Stream', icon: 'play' });
        }
        return null;
    }
    const ACTS = new Set(['member', 'chat', 'event', 'quest', 'wiki', 'stream', 'update']);
    function countsRow(n) {
        const parts = [['views', 'eye', 'views'], ['watchers', 'eye', 'watched'], ['likes', 'heart', 'likes'], ['comments', 'reply', 'replies']]
            .filter(([k]) => Number(n && n[k]) > 0);
        if (!parts.length) return null;
        const row = h('span', 'ovfd-counts');
        parts.forEach(([k, g, word]) => { const s = h('span', ''); s.setAttribute('aria-label', `${num(n[k])} ${word}`); s.title = `${num(n[k])} ${word}`; s.append(glyph(g), document.createTextNode(count(n[k]))); row.append(s); });
        return row;
    }
    /** A length as people read it: 5203 → 1:26:43, 95 → 1:35; a length already written ("12:04") stays. */
    function lenOf(v) {
        const t = String(v == null ? '' : v).trim();
        if (!/^\d+(\.\d+)?$/.test(t)) return t.slice(0, 10);
        const n = Math.round(Number(t)); const hh = Math.floor(n / 3600), mm = Math.floor((n % 3600) / 60), ss = n % 60;
        return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
    }
    /** The Rundown's episodes (Live writes them from what streamers said): Network's kind `rundown`, or the older items
     *  that came as "System" with a "Rundown:" title. */
    function isRundown(c) { return c.kind === 'rundown' || (/^Rundown:\s*/i.test(String(c.title || '')) && (!c.actor || /^system$/i.test(String(c.actor.name || '')))); }
    function feedCard(c) {
        const kind = isRundown(c) ? 'rundown' : String(c.kind || 'post');
        const url = safe(c.url);
        if (!url) return null;
        if (ACTS.has(kind) && !(c.media && safe(c.media.thumb))) return activity(c);
        if (kind === 'update') {
            const a = h('a', 'ovfd-update'); a.href = url;
            const ic = h('span', 'ovh-ic'); ic.append(siteIcon(c.site || 'ov', 20));
            const t = h('span', 'ovfd-update-txt'); t.append(h('b', '', String(c.title || '').slice(0, 160)), h('small', '', [c.site_name || c.site, ago(c.at)].filter(Boolean).join(' · ')));
            a.append(ic, t); return a;
        }
        const a = h('a', `ovfd-card ovfd-k-${kind.replace(/[^a-z]/g, '')}`); a.href = url;
        if (kind === 'rundown') a.setAttribute('aria-label', `The Rundown: ${String(c.title || '').replace(/^Rundown:\s*/i, '').slice(0, 160)}`);
        const head = h('span', 'ovfd-head');
        const face = h('span', 'ovfd-face');
        const av = c.actor && safe(c.actor.avatar);
        // No person behind it (the network's trending pictures): the site's icon and the card's label, not a "?".
        if (av && /^https:/.test(av)) { const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = av; face.append(img); }
        else if (!c.actor) { face.classList.add('is-site'); face.append(appFace(c.site || 'ov')); }
        else face.textContent = String(c.actor.name || '?').charAt(0).toUpperCase();
        const who = h('span', 'ovfd-who');
        const meta = h('small', '');
        if (kind === 'rundown') {
            // 4.223.0 (the owner, 11-12: "the rundown should look visually distinct versus the live feeds"): its own face and
            // name, whom it is about, and its picture marked as the Rundown's.
            face.textContent = ''; face.className = 'ovfd-face is-rundown'; face.append(glyph('page'));
            // feed.item@1 (Contracts 0.415.0): `subject` is a person's id, so whom it is about is its actor's name.
            const about = (c.subject && typeof c.subject === 'object' && c.subject.name ? String(c.subject.name) : '') || (c.actor && c.actor.name && !/^system$/i.test(String(c.actor.name)) ? String(c.actor.name) : '')
                || (/^Rundown:\s*([^:]{1,40}?)\s*(?:prep|:)/i.exec(String(c.title || '')) || [])[1] || '';
            who.append(h('b', '', 'The Rundown'));
            meta.append(siteIcon('live', 18), document.createTextNode(` ${[about ? `about ${about}` : 'from today’s streams', when(c.at)].filter(Boolean).join(' · ')}`));
            a.classList.add('ovfd-k-rundown');
        } else {
            who.append(h('b', '', String((c.actor && c.actor.name) || c.label || c.site_name || '').slice(0, 60)));
            meta.append(siteIcon(c.site || 'ov', 18), document.createTextNode(` ${[c.site_name || '', c.actor ? when(c.at) : String(c.text || when(c.at) || '').slice(0, 60)].filter(Boolean).join(' · ')}`));
        }
        who.append(meta);
        head.append(face, who);
        if (kind === 'live' && c.live_now) { a.classList.add('is-on'); head.append(h('span', 'ovfd-livechip', 'LIVE')); }
        a.append(head);
        const media = c.media || {};
        const thumb = safe(media.thumb);
        if (thumb && /^https:/.test(thumb)) {
            const box = h('span', 'ovfd-media');
            const r = Number(media.ratio) > 0 ? Math.max(0.8, Math.min(1.91, Number(media.ratio))) : (kind === 'pic' || kind === 'meme' ? 1 : 16 / 9);
            box.style.aspectRatio = String(r);
            const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = thumb; box.append(img);
            const len = media.length || c.duration_s;
            if (len) box.append(h('span', 'ovfd-len', lenOf(len)));
            if (kind === 'rundown') { const rib = h('span', 'ovfd-ribbon'); rib.append(glyph('page'), document.createTextNode('Rundown')); box.append(rib); }
            if (kind === 'live' && c.counts && c.counts.viewers) box.append(h('span', 'ovfd-len ovfd-viewers', `${count(c.counts.viewers)} watching`));
            a.append(box);
            if (kind === 'clip' || kind === 'video' || kind === 'live') watchPreview(box, c);
        }
        let title = String(c.title || '');
        if (kind === 'post' && /^Status:\s*/.test(title) && c.text && String(c.text).startsWith(title.replace(/^Status:\s*/, '').replace(/…$/, '').slice(0, 40))) title = '';
        if (kind === 'live') title = title.replace(/^.{1,60}? went live:?\s*/i, '') || title;
        if (kind === 'rundown') title = title.replace(/^Rundown:\s*/i, '') || title;
        if (title) a.append(h('b', 'ovfd-title', title.slice(0, 200)));
        if (kind === 'report') { const st = statOf(c); if (st) a.append(st); }
        // A card without a person says its text in the line under its name already (not twice).
        const textInMeta = !c.actor && kind !== 'rundown' && !!c.text;
        if (c.text && (kind === 'post' || !thumb) && kind !== 'report' && !textInMeta) a.append(h('p', 'ovfd-text', String(c.text).slice(0, 500)));
        const many = groupList(c);
        if (many) a.append(many);
        const people = peopleOf(kind, c);
        const counts = countsRow(c.counts);
        if (people || counts) { const row = counts || h('span', 'ovfd-counts'); if (people) row.prepend(people); a.append(row); }
        return a;
    }
    /** 4.226.0, the one feed's new kinds (feed.item@1). A report is its number, large, with which way it moved. */
    function statOf(c) {
        const n = c.counts && Number(c.counts.people);
        const t = c.trend && typeof c.trend === 'object' ? c.trend : null;
        if (!Number.isFinite(n) && !t) return null;
        const box = h('span', 'ovfd-stat');
        if (Number.isFinite(n)) box.append(h('b', 'ovfd-stat-n', num(n)));
        if (c.text) box.append(h('small', 'ovfd-stat-l', String(c.text).slice(0, 120)));
        if (t && ['up', 'down', 'flat'].includes(t.direction)) {
            const pct = Number.isFinite(Number(t.pct)) ? `${Math.round(Number(t.pct))}%` : '';
            const was = Number.isFinite(Number(t.previous)) ? `was ${num(Number(t.previous))}` : '';
            const pill = h('span', `ovfd-trend is-${t.direction}`, [t.direction === 'up' ? '▲' : t.direction === 'down' ? '▼' : '=', pct].filter(Boolean).join(' '));
            pill.setAttribute('aria-label', `${t.direction === 'flat' ? 'about the same' : `${t.direction} ${pct}`}${was ? `, ${was}` : ''}`);
            box.append(pill);
            if (was) box.append(h('small', 'ovfd-stat-was', was));
        }
        return box;
    }
    /** A folded run of the same kind (new jobs, new deals): its first three, each to its own page. */
    function groupList(c) {
        const g = c.group && Array.isArray(c.group.items) ? c.group.items : [];
        if (g.length < 2) return null;
        const list = h('span', 'ovfd-group');
        const pic = (x) => { const th = x && x.media && safe(x.media.thumb); return th && /^https:/.test(th) ? th : ''; };
        const anyPic = g.slice(0, 3).some((x) => !!pic(x));
        g.slice(0, 3).forEach((x) => {
            const row = h('span', 'ovfd-group-i');
            const th = pic(x);
            // Rows line up: where one has a picture, the others hold its place.
            if (th) { const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = th; row.append(img); }
            else if (anyPic) row.append(h('i', 'ovfd-group-ph'));
            row.append(h('span', '', String(x.title || '').slice(0, 120)));
            list.append(row);
        });
        const more = Number(c.group.count) - Math.min(3, g.length);
        if (more > 0) list.append(h('small', 'ovfd-group-more', `and ${num(more)} more`));
        return list;
    }
    /** What `counts.people` means for a kind: jobs, voters, people online; nothing where it means nothing. */
    function peopleOf(kind, c) {
        const n = c.counts && Number(c.counts.people);
        if (!Number.isFinite(n) || n <= 0 || kind === 'report') return null;
        const word = kind === 'work' ? (n === 1 ? 'job' : 'jobs') : kind === 'poll' ? 'voted' : kind === 'deal' ? (n === 1 ? 'deal' : 'deals') : kind === 'member' ? 'joined' : 'people';
        const sp = h('span', ''); sp.setAttribute('aria-label', `${num(n)} ${word}`); sp.title = `${num(n)} ${word}`;
        sp.append(glyph(kind === 'work' ? 'briefcase' : kind === 'poll' ? 'check' : 'user'), document.createTextNode(`${count(n)} ${word}`));
        return sp;
    }
    /** Several streamers who went live (and are not live now), as one card: their faces, then each name to their channel. */
    function livesCard(items) {
        const box = h('div', 'ovfd-card ovfd-lives');
        const head = h('div', 'ovfd-head');
        const faces = h('span', 'ovfd-faces');
        items.slice(0, 4).forEach((x) => {
            const f = h('span', 'ovfd-face');
            const av = x.actor && safe(x.actor.avatar);
            if (av && /^https:/.test(av)) { const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = av; f.append(img); } else f.textContent = String((x.actor && x.actor.name) || '?').charAt(0).toUpperCase();
            faces.append(f);
        });
        const names = items.map((x) => String((x.actor && x.actor.name) || '').slice(0, 40)).filter(Boolean);
        const who = h('span', 'ovfd-who');
        who.append(h('b', '', names.length > 2 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more went live` : `${names.join(' and ')} went live`));
        const meta = h('small'); meta.append(siteIcon('live', 14), document.createTextNode(` Live · ${[when(items[items.length - 1].at), items.length > 1 ? when(items[0].at) : ''].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' – ')}`));
        who.append(meta);
        head.append(faces, who);
        const row = h('div', 'ovfd-lives-row');
        items.forEach((x) => {
            const l = h('a', 'ovfd-pill'); l.href = safe(x.url);
            const t = String(x.title || '').replace(/^.*?went live:\s*/i, '');
            l.append(h('b', '', String((x.actor && x.actor.name) || '').slice(0, 40)));
            if (t) l.append(h('span', '', t.slice(0, 60)));
            row.append(l);
        });
        box.append(head, row);
        return box;
    }
    function dayLine(t) {
        const d = new Date(t); const now = new Date();
        const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const diff = Math.round((start(now) - start(d)) / 86400000);
        const label = diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? d.toLocaleDateString('en-US', { weekday: 'long' })
            : d.toLocaleDateString('en-US', d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
        const line = h('div', 'ovfd-day'); line.setAttribute('role', 'separator'); line.append(h('span', '', label));
        return line;
    }
    function feed(el, o) {
        styles(); feedStyles();
        el.classList.add('ovh', 'ovfd');
        el.setAttribute('data-sec', 'wall');
        el.textContent = '';
        const examples = h('div', 'ovfd-examples'); examples.setAttribute('aria-label', 'Example feed searches');
        const resultHead = h('div', 'ovfd-results'); resultHead.hidden = true;
        const chips = h('div', 'ovfd-chips'); chips.setAttribute('role', 'tablist'); chips.setAttribute('aria-label', 'Feed');
        const list = h('div', 'ovfd-list');
        const sentinel = h('div', 'ovfd-more');
        el.append(examples, resultHead, chips, list, sentinel);
        let kind = '', cursor = null, busy = false, done = false, seq = 0, lastDay = '';
        // 4.229.0: a card already on the list is never drawn again (the owner, 11-12: "112 new deals" three times, one
        // per page of a Deals poll; Network now names a burst once, and this keeps any repeat off the screen).
        const shownIds = new Set();
        let query = '', searchSeq = 0;
        const loaded = [];
        const feedBase = `${o.frameBase || FRAME}/feed`;
        const headers = () => Object.assign({ Accept: 'application/json' }, signedIn(o) ? { Authorization: `Bearer ${o.token}` } : {});
        const fallbackExamples = ["Who's live", 'New photos', 'Clips from today', 'Videos this week'];
        const showExamples = (values) => {
            examples.textContent = '';
            [...new Set([...values, ...fallbackExamples])].slice(0, 6).forEach((value) => {
                const b = h('button', 'ovfd-ex', value); b.type = 'button';
                b.addEventListener('click', () => { if (o.onSearch) o.onSearch(value); });
                examples.append(b);
            });
        };
        showExamples(fallbackExamples);
        fetch(`${feedBase}/examples`, { credentials: 'omit', headers: headers() }).then((r) => r.ok ? r.json() : null).then((j) => {
            const values = j && Array.isArray(j.examples) ? j.examples.map((x) => x && x.text).filter((x) => typeof x === 'string' && x.trim()) : [];
            if (values.length) showExamples(values);
        }).catch(() => {});
        const matches = (x, q) => {
            const words = q.toLowerCase().replace(/^(new |who's |from |this )/g, '').split(/\s+/).filter((w) => !['the', 'today', 'week'].includes(w));
            const hay = [x.title, x.text, x.kind, x.site, x.site_name, x.actor && x.actor.name].join(' ').toLowerCase();
            if (q.toLowerCase().includes('today') && String(x.at || '').slice(0, 10) !== new Date().toISOString().slice(0, 10)) return false;
            if (q.toLowerCase().includes('this week') && Date.parse(x.at || '') < Date.now() - 7 * 864e5) return false;
            return words.filter((w) => !['from', 'this', 'week'].includes(w)).every((w) => {
                const word = w.replace(/s$/, '');
                return hay.includes(word) || word === 'photo' && x.kind === 'pic';
            });
        };
        async function search(q) {
            query = String(q || '').trim(); const current = ++searchSeq;
            resultHead.textContent = '';
            resultHead.hidden = !query; chips.hidden = !!query; sentinel.hidden = !!query;
            examples.hidden = !!query;
            if (!query) { cursor = null; done = false; busy = false; more(true); return; }
            list.textContent = '';
            resultHead.append(h('span', '', 'Searching…'));
            let found = null;
            try {
                const r = await fetch(`${feedBase}/search?q=${encodeURIComponent(query)}`, { credentials: 'omit', headers: headers() });
                if (r.ok) { const j = await r.json(); if (Array.isArray(j.items)) found = j.items; }
            } catch { /* the loaded cards remain searchable */ }
            if (current !== searchSeq) return;
            if (!found) found = loaded.filter((x) => matches(x, query));
            resultHead.textContent = '';
            resultHead.append(h('span', '', `${found.length} result${found.length === 1 ? '' : 's'}`));
            const clear = h('button', 'ovk-btn ovk-btn--quiet', '×'); clear.type = 'button'; clear.setAttribute('aria-label', 'Clear feed search');
            clear.addEventListener('click', () => { if (o.onSearch) o.onSearch(''); }); resultHead.append(clear);
            list.textContent = '';
            found.forEach((x) => { const card = feedCard(x); if (card) list.append(card); });
            if (typeof o.mountIcons === 'function') o.mountIcons(list);
        }
        const skeletons = () => { for (let k = 0; k < 3; k++) list.append(h('span', 'ovfd-skel')); };
        const clearSkels = () => list.querySelectorAll('.ovfd-skel').forEach((x) => x.remove());
        async function more(first) {
            if (busy || done) return;
            busy = true; const my = ++seq;
            if (first) { list.textContent = ''; shownIds.clear(); skeletons(); } else skeletons();
            const j = await loadFeed(o, kind, cursor);
            if (my !== seq) return;
            clearSkels();
            if (!j) {
                busy = false;
                if (first && !kind) { el.textContent = ''; if (o.feedMissing) o.feedMissing(); timeline(el, o); return; }   // the API is not there: the wall stands
                done = true; sentinel.textContent = ''; sentinel.append(h('p', 'ovh-note', 'That did not load. Pull the menu again to retry.')); return;
            }
            if (first && o.feedLive) o.feedLive();
            if (!kind) { if (first) loaded.length = 0; loaded.push(...j.items); }
            if (query) { busy = false; search(query); return; }
            // Back-to-back go-lives that are over fold into one card of faces (a wall of "X went live" was the whole feed).
            const past = (x) => x && (x.kind === 'stream' || (x.kind === 'live' && !x.live_now)) && safe(x.url);
            let run = [];
            const flush = () => { if (run.length >= 2) list.append(livesCard(run)); else run.forEach((x) => { const c = feedCard(x); if (c) list.append(c); }); run = []; };
            // Date by date (the owner, 11-09): a quiet day line where the day changes. The network's trending cards
            // (no time of their own) sit between, under the day they were woven into.
            const day = (x) => { const t = Date.parse(String((x && x.at) || '')); return Number.isFinite(t) ? new Date(t).toDateString() : ''; };
            const mark = (x) => { const d = day(x); if (!d || d === lastDay) return; flush(); lastDay = d; list.append(dayLine(Date.parse(String(x.at)))); };
            j.items.filter((x) => x && x.id && !shownIds.has(x.id) && shownIds.add(x.id)).forEach((x) => { mark(x); if (past(x) && !kind) { run.push(x); return; } flush(); const c = feedCard(x); if (c) list.append(c); });
            flush();
            if (typeof o.mountIcons === 'function') { try { o.mountIcons(list); } catch { /* */ } }
            cursor = j.next_cursor || null;
            done = !cursor;
            busy = false;
            sentinel.textContent = '';
            if (done) sentinel.append(h('p', 'ovh-note ovfd-caught', list.querySelector('.ovfd-card,.ovfd-act,.ovfd-update') ? "You're all caught up."
                : (kind === 'following' ? 'Nothing yet from the people you follow. Follow someone on their profile and what they share shows here.' : 'Nothing here yet.')));
        }
        KINDS.forEach(([k, label]) => {
            if (k === 'following' && !signedIn(o)) return;
            const b = h('button', 'ovfd-chip', label); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', k === kind ? 'true' : 'false');
            b.addEventListener('click', () => {
                if (k === kind) return;
                kind = k; cursor = null; done = false; busy = false; lastDay = '';
                chips.querySelectorAll('.ovfd-chip').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
                more(true);
            });
            chips.append(b);
        });
        if (typeof IntersectionObserver === 'function') {
            const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) more(false); }, { root: el.closest('.ovs-list') || null, rootMargin: '600px 0px' });
            io.observe(sentinel);
        }
        more(true);
        return { update() {}, search, get query() { return query; } };
    }
    function feedStyles() {
        if (document.getElementById('ovfd-styles')) return;
        const st = document.createElement('style'); st.id = 'ovfd-styles';
        st.textContent = `
.ovfd-chips{position:sticky;top:0;z-index:2;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:8px 4px;margin:0 -4px;background:var(--bg-secondary,#141a24)}
.ovfd-chips::-webkit-scrollbar{display:none}
.ovfd-examples{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 4px 6px;margin:0 -4px}.ovfd-examples::-webkit-scrollbar{display:none}.ovfd-examples[hidden]{display:none}
.ovfd-ex{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;border:0;background:color-mix(in srgb,var(--accent,#3b82f6) 12%,transparent);color:var(--accent-light,var(--accent,#60a5fa));font:inherit;font-size:13px;font-weight:650;cursor:pointer;white-space:nowrap;transition:background .15s}
.ovfd-ex::before{content:"";width:12px;height:12px;flex:none;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") center/contain no-repeat;opacity:.8}
.ovfd-ex:hover,.ovfd-ex:focus-visible{background:color-mix(in srgb,var(--accent,#3b82f6) 22%,transparent)}
.ovfd-chip{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--border,rgba(255,255,255,.12));background:transparent;color:var(--text-secondary,#a8b3c4);font:inherit;font-size:13.5px;font-weight:650;cursor:pointer}
.ovfd-chip[aria-selected=true]{background:var(--text-primary,#e8ecf3);color:var(--bg-primary,#0b1220);border-color:transparent}
.ovfd-list{display:grid;gap:10px;padding:4px 0}
@media (min-width:861px){.ovfd{max-width:720px;margin-inline:auto}}
.ovfd-stat{display:grid;grid-template-columns:auto 1fr;align-items:baseline;column-gap:10px;row-gap:2px;padding:4px 2px}
.ovfd-stat-n{font-family:'OV Brand',Nunito,Inter,sans-serif;font-size:34px;font-weight:800;line-height:1.05;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.ovfd-stat-l{font-size:13px;color:var(--text-secondary,#a8b3c4);align-self:center}
.ovfd-trend{grid-column:1;justify-self:start;font-size:12.5px;font-weight:750;padding:1px 8px;border-radius:999px;font-variant-numeric:tabular-nums}
.ovfd-trend.is-up{color:#34d399;background:color-mix(in srgb,#10b981 16%,transparent)}.ovfd-trend.is-down{color:#f87171;background:color-mix(in srgb,#ef4444 14%,transparent)}.ovfd-trend.is-flat{color:var(--text-secondary,#a8b3c4);background:color-mix(in srgb,var(--text-primary,#e8ecf3) 8%,transparent)}
.ovfd-stat-was{font-size:12px;color:var(--text-muted,#93a0b4);align-self:center}
.ovfd-group{display:grid;gap:4px;padding:2px 0}
.ovfd-group-i{display:flex;align-items:center;gap:8px;min-width:0;font-size:13.5px;color:var(--text-secondary,#a8b3c4)}
.ovfd-group-i img,.ovfd-group-ph{flex:none;width:36px;height:36px;border-radius:8px;object-fit:cover}
.ovfd-group-ph{background:color-mix(in srgb,var(--text-primary,#e8ecf3) 6%,transparent)}
.ovfd-group:not(:has(img)) .ovfd-group-i::before{content:'';flex:none;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.55}
.ovfd-group-i span{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ovfd-group-more{font-size:12px;color:var(--text-muted,#93a0b4)}
.ovfd-card{display:grid;gap:8px;padding:10px;border-radius:16px;background:color-mix(in srgb,var(--text-primary,#e8ecf3) 4%,transparent);box-shadow:inset 0 0 0 1px var(--border,rgba(255,255,255,.08));color:inherit;text-decoration:none;min-width:0}
@media (hover:hover){.ovfd-card:hover{background:color-mix(in srgb,var(--text-primary,#e8ecf3) 7%,transparent)}}
.ovfd-head{display:flex;align-items:center;gap:8px;min-width:0}
.ovfd-face{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--accent,#3b82f6);color:#fff;font-weight:800;font-size:15px}
.ovfd-face img{width:100%;height:100%;object-fit:cover}
.ovfd-face.is-site{border-radius:30%;background:none;overflow:visible}.ovfd-face.is-site>.ov-appicon{--ova-size:40px}
.ovfd-who{min-width:0;display:grid}
.ovfd-who b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ovfd-who small{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-muted,#93a0b4)}
.ovfd-livechip{margin-left:auto;padding:2px 8px;border-radius:6px;background:var(--live,#ef4444);color:#fff;font-size:11px;font-weight:800;letter-spacing:.06em;animation:ovfd-onair 2.4s ease-in-out infinite}
.ovfd-card.is-on{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--live,#ef4444) 45%,transparent);background:color-mix(in srgb,var(--live,#ef4444) 7%,transparent)}
@keyframes ovfd-onair{50%{box-shadow:0 0 0 4px color-mix(in srgb,var(--live,#ef4444) 25%,transparent)}}
.ovfd-faces{display:flex;flex:none}.ovfd-faces .ovfd-face{width:30px;height:30px;box-shadow:0 0 0 2px var(--bg-secondary,#141a24)}.ovfd-faces .ovfd-face+.ovfd-face{margin-left:-9px}
.ovfd-lives-row{display:flex;flex-wrap:wrap;gap:6px}
.ovfd-lives .ovfd-who b{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.3}
.ovfd-pill{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:36px;padding:6px 12px;border-radius:999px;background:color-mix(in srgb,var(--text-primary,#e8ecf3) 6%,transparent);color:inherit;text-decoration:none;font-size:13px;line-height:1.2}
.ovfd-pill b{flex:none;font-weight:700}.ovfd-pill span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted,#93a0b4)}
@media (hover:hover){.ovfd-pill:hover{background:color-mix(in srgb,var(--text-primary,#e8ecf3) 11%,transparent)}}
.ovfd-media{position:relative;display:block;border-radius:12px;overflow:hidden;background:var(--bg-tertiary,#1f2633)}
.ovfd-media img,.ovfd-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ovfd-len{position:absolute;right:8px;bottom:8px;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.72);color:#fff;font-size:12px;font-weight:700}
.ovfd-viewers{left:8px;right:auto}
.ovfd-title{font-size:14.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ovfd-text{margin:0;font-size:14px;line-height:1.5;color:var(--text-secondary,#a8b3c4);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.ovfd-counts{display:flex;flex-wrap:wrap;gap:14px;font-size:12.5px;font-weight:650;color:var(--text-muted,#93a0b4);font-variant-numeric:tabular-nums}
.ovfd-counts span{display:inline-flex;align-items:center;gap:5px}
.ovfd svg.ovfd-gl{flex:none;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ovfd-act{display:flex;gap:12px;align-items:flex-start;padding:10px;border-radius:16px;color:inherit;text-decoration:none;min-width:0}
@media (hover:hover){.ovfd-act:hover{background:color-mix(in srgb,var(--text-primary,#e8ecf3) 5%,transparent)}}
.ovfd-act .ovfd-face,.ovfd-tile,.ovfd-tile-wrap{flex:none;width:40px;height:40px}
.ovfd-act .ovfd-face.is-site{border-radius:12px}
.ovfd-act-txt{min-width:0;display:grid;gap:3px;padding-top:1px}
.ovfd-act-txt b{font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.ovfd-act-txt small{display:flex;align-items:center;gap:5px;min-width:0;font-size:12px;color:var(--text-muted,#93a0b4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ovfd-act-more{font-size:13px;line-height:1.45;color:var(--text-secondary,#a8b3c4);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.ovfd-tile{box-sizing:border-box;display:grid;place-items:center;border-radius:12px;font-variant-numeric:tabular-nums}
.ovfd-tile-num{position:relative;background:linear-gradient(150deg,hsl(152 62% 48% / .32),hsl(152 60% 32% / .16));color:hsl(152 70% 78%)}
.ovfd-tile-num b{font-size:15px;font-weight:800;letter-spacing:-.02em}
.ovfd-tile-num svg.ovfd-gl{position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;padding:2px;border-radius:50%;background:var(--bg-secondary,#141a24);color:hsl(152 70% 70%)}
.ovfd-tile-date{grid-template-rows:auto 1fr;place-items:stretch;overflow:hidden;background:color-mix(in srgb,var(--text-primary,#e8ecf3) 8%,transparent);text-align:center}
.ovfd-tile-date small{display:block;padding:1px 0;background:var(--live,#ef4444);color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.ovfd-tile-date b{display:grid;place-items:center;font-size:16px;font-weight:800;line-height:1}
.ovfd-tile-wrap{position:relative}
.ovfd-tile-wrap .ovfd-face{width:40px;height:40px}
.ovfd-badge{position:absolute;right:-4px;bottom:-4px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:hsl(43 92% 56%);color:#3a2600;box-shadow:0 0 0 2px var(--bg-secondary,#141a24)}
.ovfd-badge svg.ovfd-gl{width:12px;height:12px;stroke-width:2.4}
.ovfd-day{grid-column:1/-1;display:flex;align-items:center;gap:10px;margin:8px 2px 0;font-size:12px;font-weight:750;letter-spacing:.04em;color:var(--text-muted,#93a0b4)}
.ovfd-day::after{content:"";flex:1;height:1px;background:var(--border,rgba(255,255,255,.1))}
.ovfd-list>.ovfd-day:first-child{margin-top:0}
.ovfd-update{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;color:inherit;text-decoration:none}
.ovfd-update .ovh-ic{width:34px;height:34px;border-radius:10px;flex:none}
.ovfd-update-txt{min-width:0;display:grid;gap:2px}.ovfd-update-txt b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ovfd-update-txt small{font-size:12px;color:var(--text-muted,#93a0b4)}
.ovfd-skel{display:block;height:180px;border-radius:16px;background:linear-gradient(90deg,color-mix(in srgb,var(--text-primary,#e8ecf3) 5%,transparent) 0,color-mix(in srgb,var(--text-primary,#e8ecf3) 9%,transparent) 50%,color-mix(in srgb,var(--text-primary,#e8ecf3) 5%,transparent) 100%);background-size:200% 100%;animation:ovfd-shimmer 1.4s ease-in-out infinite}
.ovfd-more{min-height:1px}.ovfd-caught{text-align:center;padding:10px 0}
@keyframes ovfd-shimmer{to{background-position:-200% 0}}

/* 4.223.0 (the owner, 11-12: "these icons are tiny … fix this icon shit"): the kind glyph beside the time at 18 px and a
   site's face drawn as an app icon; lengths read as times. The Rundown has its own card: its mark, whom it is about, a
   ribbon on its picture, and the picture graded so it never reads as the stream's own card above it. */
.ovfd-who small{gap:6px;font-size:12.5px}
.ovfd-who small .ov-icon{position:relative;flex:none;width:18px;height:18px;overflow:hidden;border-radius:5px}
.ovfd-who small .ov-icon .ovi-ring,.ovfd-who small .ov-icon .ovi-bg,.ovfd-who small .ov-icon .ovi-comet,.ovfd-who small .ov-icon .ovi-prog{display:none}
.ovfd-who small .ov-icon svg{position:absolute;left:-26%;top:-26%;width:152%;height:152%;transform:none!important}
.ovfd-face{width:36px;height:36px}
.ovfd-face.is-site{position:relative}
.ovfd-face.is-site .ov-icon{position:absolute;inset:0;width:100%;height:100%;display:block;--ovi-glyph:hsl(var(--ovh-h,215) 90% 82%)}
.ovfd-face.is-site .ov-icon .ovi-ring,.ovfd-face.is-site .ov-icon .ovi-bg,.ovfd-face.is-site .ov-icon .ovi-comet,.ovfd-face.is-site .ov-icon .ovi-prog{display:none}
.ovfd-face.is-site .ov-icon svg{position:absolute;left:-13%;top:-13%;width:126%;height:126%;transform:none!important}
.ovfd-act .ovfd-face,.ovfd-tile,.ovfd-tile-wrap{width:44px;height:44px}
.ovfd-face.is-rundown{border-radius:12px;background:linear-gradient(140deg,#f59e0b,#ef4444 55%,#a855f7);color:#fff;box-shadow:0 4px 14px -4px rgba(239,68,68,.55)}
.ovfd-face.is-rundown svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}
.ovfd-k-rundown{box-shadow:inset 0 0 0 1px color-mix(in srgb,#f59e0b 38%,transparent);background:linear-gradient(180deg,color-mix(in srgb,#f59e0b 7%,transparent),transparent 60%)}
.ovfd-k-rundown .ovfd-media img{filter:saturate(1.35) contrast(1.06) sepia(.12)}
.ovfd-k-rundown .ovfd-media::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,transparent 55%,rgba(15,8,30,.55)),linear-gradient(120deg,rgba(245,158,11,.18),transparent 40%,rgba(168,85,247,.18))}
.ovfd-ribbon{position:absolute;left:10px;top:10px;z-index:1;display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 8px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.02em;color:#fff;background:linear-gradient(140deg,#f59e0b,#ef4444 60%,#a855f7);box-shadow:0 4px 12px -2px rgba(0,0,0,.45)}
.ovfd-ribbon svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.ovfd-media{position:relative}
.ovfd-len{font-variant-numeric:tabular-nums;z-index:1}
`;
        document.head.appendChild(st);
    }

    // actorCard(box, o): your Actor's card (or the invitation to make one), drawn by the menu's top since 4.238.0.
    // youCard(box, o) (4.238.0; the owner, 11-13: "merge the actors … this little online thing … move up here … the colors
    // and other settings"): the menu's top sheet: your row (Display, your account's menu) and your Actor's card.
    function youCard(box, o) {
        styles();
        box.textContent = '';
        box.append(meRow(o));
        if (o.token) { const a = h('div', 'ovh-notice'); box.append(a); actor(a, o); }
        if (typeof o.look === 'function') { try { o.look(box); } catch { /* the Display button stays a link */ } }
    }
    root.OpenVibeHome = { home, wallTop, timeline, feed, loadPulse, youCard, actorCard: (box, o) => actor(box, o), _defaultHome: defaultHome };
})(typeof window !== 'undefined' ? window : globalThis);
