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
        const t = Date.parse(iso || ''); if (!t) return '';
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
.ovh-grid:not(.ovh-recent) .ovh-ic { width: min(100% - 12px, 72px); height: auto; aspect-ratio: 1; border-radius: 29%; }
.ovh-grid:not(.ovh-recent) .ovh-app:not(.ovh-folder) .ovh-ic > .ov-icon { display: grid; place-items: center; width: 104%; height: 104%; }
.ovh-grid:not(.ovh-recent) .ovh-app:not(.ovh-folder) .ovh-ic > .ov-icon svg { width: 100%; height: 100%; }
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
.ovh.is-edit .ovh-grid:not(.ovh-recent) { touch-action: none; -webkit-user-select: none; user-select: none; }
.ovh-recent .ovh-app { min-height: 80px; }
.ovh-app { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; min-height: 88px; padding: 8px 2px 6px; border: 0; border-radius: 16px;
    background: transparent; color: inherit; font: inherit; text-decoration: none; cursor: pointer; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.ovh-app:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: -2px; }
.ovh-ic { position: relative; display: grid; place-items: center; width: 56px; height: 56px; border-radius: 17px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 6%, transparent);
    box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.1)); transition: transform .18s cubic-bezier(.2,1.4,.4,1); }
.ovh-recent .ovh-ic { width: 48px; height: 48px; border-radius: 15px; }
/* App icons: the ring goes, the glyph fills the tile, each app keeps its own hue (11-09). */
.ovh-grid .ovh-ic, .ovh-recent .ovh-ic, .ovh-card .ovh-ic, .ovh-key .ovh-ic { background: linear-gradient(150deg, hsl(var(--ovh-h, 215) 72% 58% / .34), hsl(var(--ovh-h, 215) 70% 38% / .18)); box-shadow: inset 0 0 0 1px hsl(var(--ovh-h, 215) 70% 64% / .28), 0 4px 14px hsl(var(--ovh-h, 215) 70% 30% / .18); overflow: hidden; }
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
.ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-app { touch-action: none; }
.ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-ic { animation: ovh-wiggle .32s ease-in-out infinite alternate; }
.ovh.is-edit .ovh-grid:not(.ovh-recent) .ovh-app:nth-child(2n) .ovh-ic { animation-delay: -.16s; }
.ovh-app.is-lifted { opacity: .18; transform: scale(.92); }
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
.ovh-compose { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 10px; align-items: start; margin: 6px 4px; padding: 10px; border-radius: 16px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent);
    box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.1)); }
.ovh-compose textarea { flex: 1; min-width: 0; min-height: 44px; max-height: 160px; padding: 11px 12px; border-radius: 12px; border: 1px solid var(--border, rgba(255,255,255,.14));
    background: var(--bg-primary, rgba(0,0,0,.2)); color: inherit; font: inherit; font-size: 15px; line-height: 1.4; resize: none; overflow-y: auto; }
.ovh-post { flex: none; min-height: 44px; padding: 0 16px; border: 0; border-radius: 12px; background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); font: inherit; font-weight: 700; cursor: pointer; }
.ovh-post:disabled { opacity: .5; cursor: default; }
.ovh-compose-main { display: grid; gap: 8px; min-width: 0; }
.ovh-compose-bar { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ovh-compose-bar .ovh-post { margin-left: auto; }
.ovh-compose-hint { flex: 1; min-width: 0; font-size: 12px; color: var(--text-muted, #93a0b4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovh-pic-btn { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: var(--accent-light, var(--accent, #60a5fa)); cursor: pointer; }
.ovh-pic-btn:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent); }
.ovh-pic-btn:disabled { opacity: .4; cursor: default; background: transparent; }
.ovh-pic-btn svg, .ovh-pic-x svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ovh-pics { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.ovh-pics[hidden] { display: none; }
.ovh-pic { display: grid; grid-template-columns: 56px minmax(0, 1fr) 40px; gap: 8px; align-items: center; }
.ovh-pic img { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); }
.ovh-pic input { min-width: 0; min-height: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--border, rgba(255,255,255,.14)); background: var(--bg-primary, rgba(0,0,0,.2)); color: inherit; font: inherit; font-size: 14px; }
.ovh-pic-x { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: var(--text-muted, #93a0b4); cursor: pointer; }
.ovh-pic-x svg { width: 18px; height: 18px; }
.ovh-pic-x:hover { background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); color: var(--text-primary, #e8ecf3); }
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
.ovh-who-txt b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 800; letter-spacing: -.01em; }
.ovh-who-txt small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--text-secondary, #a8b3c4); }
.ovh-ib { flex: none; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; text-decoration: none;
    background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); color: var(--text-primary, #e8ecf3); transition: background .16s, color .16s, transform .16s cubic-bezier(.2,1.4,.4,1); }
.ovh-ib svg { display: block; width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ovh-ib[aria-expanded="true"] { background: var(--accent-strong, var(--accent, #2563eb)); color: var(--on-accent-strong, #fff); }
.ovh-ib:active { transform: scale(.9); }
.ovh-ib:focus-visible, .ovh-who:focus-visible, .ovh-card:focus-visible, .ovh-key:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
@media (hover: hover) { .ovh-ib:hover { background: color-mix(in srgb, var(--text-primary, #e8ecf3) 14%, transparent); } .ovh-ib[aria-expanded="true"]:hover { background: var(--accent-strong, var(--accent, #2563eb)); } }
.ovh-me-look { margin: -2px 4px 8px; }
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
`;
        document.head.appendChild(st);
    }

    // ── The arrangement ────────────────────────────────────────────────────────────────────────────────────────
    function readLocal() { try { const v = JSON.parse(localStorage.getItem(HOME_KEY) || 'null'); return v && Array.isArray(v.home) ? v : null; } catch { return null; } }
    function writeLocal(l) { try { localStorage.setItem(HOME_KEY, JSON.stringify(l)); } catch { /* a private window keeps it for this opening */ } }
    const homeUrl = (o) => `${o.apiBase || 'https://openvibe.network'}/api/v1/me/home-screen`;
    const signedIn = (o) => !!(o.token && o.user && !o.user.is_anon);
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
    // The network's groups, as folders for the sites past the first page (until the person arranges their home).
    const GROUP_FOLDERS = [['streams', 'Watch'], ['people', 'People'], ['make', 'Make'], ['answers', 'Read'], ['games', 'Play'], ['shop', 'Shop']];
    function topSites(o) {
        const mineFirst = (o.yours || []).filter((y) => ['you:vibe', 'you:codes', 'you:files', 'you:wallet'].includes(y.id));
        const sites = (o.apps || []).filter((a) => a.group !== 'build').map((a) => a.id);
        return sites.slice(0, Math.max(6, 12 - 2 - mineFirst.length));
    }
    function folderDefs(o) {
        const apps = o.apps || [];
        const top = new Set(topSites(o));
        const groups = GROUP_FOLDERS.map(([g, name]) => ({ id: `g-${g}`, name, apps: apps.filter((a) => a.group === g && !top.has(a.id)).map((a) => a.id), glyph: 'grid' }))
            .filter((f) => f.apps.length >= 2);
        return groups.concat([
            { id: 'tools', name: 'Quick tools', apps: (o.tools || []).map((t) => t.id), glyph: 'tools', more: { label: `All ${o.toolCount || (o.tools || []).length} tools`, href: 'https://openvibe.tools/' } },
            { id: 'build', name: 'Build', apps: apps.filter((a) => a.group === 'build').map((a) => a.id), glyph: 'code' },
        ]).filter((f) => f.apps.length);
    }
    /** Until the person arranges it: their own places first (signed in), then the most used and popular sites. */
    function defaultHome(o) {
        const mineFirst = (o.yours || []).filter((y) => ['you:vibe', 'you:codes', 'you:files', 'you:wallet'].includes(y.id)).map((y) => y.id);
        const groupFolders = folderDefs(o).filter((f) => f.id.startsWith('g-')).map((f) => `folder:${f.id}`);
        return mineFirst.concat(topSites(o), groupFolders, ['folder:tools', 'folder:build']);
    }
    function layoutOf(o) {
        const byId = universe(o);
        const folders = folderDefs(o);
        const known = (id) => byId.has(id) || (id.startsWith('folder:') && folders.some((f) => `folder:${f.id}` === id));
        const l = readLocal();
        const home = (l ? l.home : defaultHome(o)).filter((id, i, a) => known(id) && a.indexOf(id) === i).slice(0, HOME_MAX);
        return { home, folders, arranged: !!l, byId };
    }

    // Line icons for the buttons beside your name (24-unit boxes, optically centred), built as nodes.
    const ICON = {
        pencil: [['path', { d: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z' }], ['path', { d: 'M13.5 6.5l4 4' }]],
        check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
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
    };
    function svgIcon(name) {
        const NS = 'http://www.w3.org/2000/svg';
        const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
        ICON[name].forEach(([tag, at]) => { const n = document.createElementNS(NS, tag); Object.keys(at).forEach((k) => n.setAttribute(k, String(at[k]))); s.append(n); });
        return s;
    }

    // ── Drawing an icon ────────────────────────────────────────────────────────────────────────────────────────
    function siteIcon(site, size) {
        const s = h('span', 'ov-icon'); s.setAttribute('data-icon', site || 'ov'); s.setAttribute('data-size', String(size)); s.setAttribute('data-fx', 'none');
        return s;
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
    function home(el, o) {   // o is replaced by update() when the menu learns more (history, the catalogue)
        styles();
        el.classList.add('ovh');
        el.setAttribute('data-sec', 'home');
        const state = { view: 'home', edit: false, folder: null, filter: '', drag: null, suppress: 0 };
        let L = layoutOf(o);
        const save = () => { const keep = { home: L.home.slice(0, HOME_MAX), folders: L.folders.map((f) => ({ id: f.id, name: f.name, apps: f.apps.slice(0, 400) })) }; writeLocal(keep); pushRemote(o, keep); L.arranged = true; };
        const icons = () => { if (typeof o.mountIcons === 'function') { try { o.mountIcons(el); } catch { /* optional */ } } };
        let actorBox = null, meBox = null;
        // The Look panel (theme, text size, motion, icons) opens under your name, drawn by the navbar (the account menu's).
        if (typeof o.look === 'function') { try { o.look(el); } catch { /* the button stays a link to openvibe.design/look */ } }

        /** You: your picture (online), your name, and Display and Settings beside it. Made once per opening, so an open
         *  Look panel survives the repaints that come as history and the catalogue arrive. */
        // The account's block (navbar.js builds it: who you are, add account, settings, sign out, your other accounts,
        // this site's own items): the You tab is where it lives since 4.188.0. Without a bar to give it, the short bar below.
        let accountBox = null;
        function account() {
            if (typeof o.account !== 'function') return null;
            accountBox = accountBox || h('div', 'ovh-account');
            let ok = false;
            try { ok = o.account(accountBox) !== false; } catch { ok = false; }
            return ok ? accountBox : null;
        }
        function me() {
            if (meBox) return meBox;
            const u = o.user || {};
            meBox = h('div');
            const bar = h('div', 'ovh-me');
            const who = h('a', 'ovh-who'); who.href = u.username ? `https://openvibe.network/@${encodeURIComponent(u.username)}` : 'https://openvibe.network/my';
            const av = h('span', 'ovh-av');
            const pic = /^https:\/\//.test(String(u.avatar_url || '')) ? u.avatar_url : '';
            if (pic) { const img = h('img'); img.alt = ''; img.src = pic; img.decoding = 'async'; av.append(img); } else av.textContent = String(u.display_name || u.username || '?').trim().charAt(0).toUpperCase();
            const txt = h('span', 'ovh-who-txt');
            txt.append(h('b', '', u.display_name || u.username || 'You'), h('small', '', [u.username ? `@${u.username}` : '', 'Online'].filter(Boolean).join(' · ')));
            who.append(av, txt);
            const look = h('a', 'ovh-ib'); look.append(svgIcon('look')); look.href = 'https://openvibe.design/look'; look.setAttribute('data-ov-look-open', '');
            look.setAttribute('aria-expanded', 'false'); look.setAttribute('aria-label', 'Display: theme, text size, motion'); look.title = 'Display';
            const gear = h('a', 'ovh-ib'); gear.append(svgIcon('gear')); gear.href = 'https://openvibe.network/my'; gear.setAttribute('aria-label', 'Account and settings'); gear.title = 'Account and settings';
            bar.append(who, look, gear);
            const panel = h('div', 'ud-look ovh-me-look'); panel.hidden = true;
            meBox.append(bar, panel);
            return meBox;
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
            return wrap;
        }

        /** Most used: the pages you opened, by site, as one bar; its key is the apps themselves, each a way in. */
        function usage() {
            const rows = (o.usage || []).map((u) => ({ a: L.byId.get(u.id), n: u.count })).filter((r) => r.a && r.n > 0).sort((x, y) => y.n - x.n).slice(0, 5);
            if (rows.length < 2) return null;
            const wrap = h('div');
            const head = sec('Most used');
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
            { const a = account(); if (a) el.append(calm(a)); else if (signedIn(o)) el.append(calm(me())); }
            if (signedIn(o)) { actorBox = actorBox || h('div'); el.append(actorBox); }
            const head = sec(L.arranged || signedIn(o) ? 'Your home' : 'Popular on OpenVibe');
            const edit = h('button', state.edit ? 'ovh-edit is-done' : 'ovh-edit');
            edit.type = 'button';
            edit.append(svgIcon(state.edit ? 'check' : 'pencil'));
            if (state.edit) edit.append(h('span', '', 'Done'));
            edit.setAttribute('aria-label', state.edit ? 'Done arranging Home' : 'Edit Home');
            edit.title = state.edit ? 'Done' : 'Edit Home: move apps, remove them, add folders';
            edit.setAttribute('aria-pressed', state.edit ? 'true' : 'false');
            edit.addEventListener('click', () => setEdit(!state.edit));
            // All apps sits beside Edit, small, with its count (the owner, 2026-11-10: "all apps should just be in a
            // button in the corner so it's more compact"): it was a bar the width of the sheet under the grid.
            const total = L.byId.size;
            const all = h('button', 'ovh-allbtn'); all.type = 'button';
            all.append(svgIcon('grid'), h('span', '', 'All'), h('b', '', String(total)));
            all.setAttribute('aria-label', `All apps (${total})`); all.title = `All apps (${total})`;
            all.addEventListener('click', () => { state.view = 'drawer'; paint(); });
            const tools = h('div', 'ovh-headtools'); tools.append(all, edit);
            head.append(tools);
            el.append(head);
            const grid = h('div', 'ovh-grid'); grid.setAttribute('aria-label', 'Your home');
            L.home.forEach((id, i) => grid.append(homeTile(id, i)));
            el.append(grid);
            if (state.edit) el.append(h('p', 'ovh-hint', 'Drag an app to move it, or use the arrow keys. − takes it off Home; All puts it back.'));
            // Under your home: what you use most (shortcuts), then where you were last (history).
            { const u = usage(); if (u) el.append(calm(u)); const b = backRail(); if (b) el.append(calm(b)); }
            icons();
            if (signedIn(o) && actorBox && !actorBox.childNodes.length) actor(actorBox, o);
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
                let timer = 0;
                const cancel = () => { clearTimeout(timer); window.removeEventListener('pointermove', early); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel); };
                const early = (m) => { if (m.pointerId === start.id && Math.hypot(m.clientX - start.x, m.clientY - start.y) > 8) { cancel(); if (state.edit) beginDrag(id, m); } };
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
        if (!el.__ovhTouch) { el.__ovhTouch = true; el.addEventListener('touchmove', (e) => { if ((state.edit || state.drag) && e.target.closest && e.target.closest('.ovh-grid:not(.ovh-recent)') && e.cancelable) e.preventDefault(); }, { passive: false }); }
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

        function setEdit(on) { state.edit = on; paint(); const b = el.querySelector('.ovh-sec button'); if (b && !on) b.focus(); }

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
            if (f.more) { const m = h('a', 'ovh-all', `${f.more.label} →`); m.href = f.more.href; el.append(m); }
            icons();
        }

        function paintDrawer() {
            el.textContent = '';
            el.append(backHead('All apps'));
            const field = h('input', 'ovh-filter'); field.type = 'search'; field.placeholder = 'Find an app'; field.setAttribute('aria-label', 'Find an app'); field.value = state.filter;
            el.append(field);
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
                    body.append(sec(`${name} (${list.length})`));
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
            field.addEventListener('input', () => { state.filter = field.value; draw(); });
            draw();
        }

        function backHead(title) {
            const head = h('div', 'ovh-head');
            const back = h('button', 'ovh-back', '← Home'); back.type = 'button';
            back.addEventListener('click', () => { state.view = 'home'; state.folder = null; paint(); const b = el.querySelector('.ovh-allbtn'); if (b) b.focus(); });
            head.append(back, h('b', '', title));
            return head;
        }
        function sec(text) { const s = h('div', 'ovh-sec'); s.append(h('span', '', text)); return s; }

        function paint() { if (state.view === 'folder') return paintFolder(); if (state.view === 'drawer') return paintDrawer(); return paintHome(); }
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
            /** The menu learned more (history, the catalogue): redraw with it, unless the person is arranging. */
            update(next) { o = next; L = layoutOf(o); if (!state.drag && !state.edit && state.view === 'home') paint(); },
        };
    }

    // ── Your Actor, on top of You ──────────────────────────────────────────────────────────────────────────────
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
            const txt = h('span', 'ovh-actor-txt');
            const name = h('b', '', a.name || 'Your Actor');
            const chip = h('span', `ovh-chip is-${st}`); chip.append(h('span', 'ovh-dot'), document.createTextNode(label));
            name.append(chip);
            const now = a.now || {};
            txt.append(name, h('small', '', asks.length ? `It asks you: ${asks[0].text || ''}` : now.current_step ? String(now.current_step) : st === 'paused' ? 'Paused until you resume it' : 'Resting until its next goal is due'));
            b.append(face, txt, h('span', 'ovh-go', asks.length ? 'Answer' : 'Open'));
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
        txt.append(h('b', '', 'Your own AI'), h('small', '', 'It works for you while you watch: finds work, posts and runs your channel.'));
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
    function composer(box, o) {
        const form = h('form', 'ovh-compose');
        const face = h('span', 'ovh-face');
        const pic = o.user && /^https:\/\//.test(String(o.user.avatar_url || o.user.avatar || '')) ? (o.user.avatar_url || o.user.avatar) : '';
        if (pic) { const img = h('img'); img.alt = ''; img.src = pic; face.append(img); } else face.textContent = String((o.user && (o.user.display_name || o.user.username)) || 'Y').charAt(0).toUpperCase();
        const first = String((o.user && (o.user.display_name || o.user.username)) || '').split(/\s+/)[0];
        const main = h('div', 'ovh-compose-main');
        const ta = h('textarea'); ta.name = 'text'; ta.maxLength = 500; ta.rows = 1; ta.placeholder = first ? `What's new, ${first}?` : "What's new?"; ta.setAttribute('aria-label', "What's new");
        // Pictures (owner, 11-09: "you can make posts and put images"): up to four, each with a line saying what it shows,
        // which Community requires (alt text, for people who cannot see it).
        const pics = []; const list = h('ul', 'ovh-pics'); list.hidden = true;
        const bar = h('div', 'ovh-compose-bar');
        const add = h('button', 'ovh-pic-btn'); add.type = 'button'; add.setAttribute('aria-label', 'Add pictures'); add.title = 'Add pictures (up to 4)'; add.append(svgIcon('image'));
        const file = h('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp,image/gif'; file.multiple = true; file.hidden = true;
        const hint = h('small', 'ovh-compose-hint');
        const post = h('button', 'ovh-post', 'Post'); post.type = 'submit'; post.disabled = true;
        const ready = () => {
            const missing = pics.some((p) => !p.alt.value.trim());
            post.disabled = !ta.value.trim() || missing;
            hint.textContent = missing ? 'Describe each picture' : '';
            add.disabled = pics.length >= 4;
            list.hidden = !pics.length;
        };
        ta.addEventListener('input', () => { ready(); ta.style.height = 'auto'; ta.style.height = `${Math.min(160, ta.scrollHeight + 2)}px`; });
        add.addEventListener('click', () => file.click());
        file.addEventListener('change', async () => {
            const chosen = [...(file.files || [])].slice(0, 4 - pics.length); file.value = '';
            for (const f of chosen) {
                if (!/^image\//.test(f.type)) continue;
                const pr = await preparePicture(f);
                if (pr.file.size > 8 * 1024 * 1024) { note.hidden = false; note.textContent = `${f.name} is over 8 MB.`; continue; }
                const li = h('li', 'ovh-pic');
                const im = h('img'); im.alt = ''; if (pr.thumb) im.src = pr.thumb;
                const alt = h('input'); alt.type = 'text'; alt.maxLength = 300; alt.placeholder = 'What does it show?'; alt.setAttribute('aria-label', `What ${f.name} shows`);
                const x = h('button', 'ovh-pic-x'); x.type = 'button'; x.setAttribute('aria-label', 'Remove this picture'); x.title = 'Remove'; x.append(svgIcon('x'));
                const entry = { file: pr.file, alt, li };
                x.addEventListener('click', () => { pics.splice(pics.indexOf(entry), 1); li.remove(); ready(); });
                alt.addEventListener('input', ready);
                li.append(im, alt, x); list.append(li); pics.push(entry);
            }
            ready();
            const empty = pics.find((p) => !p.alt.value.trim()); if (empty) empty.alt.focus();
        });
        bar.append(add, file, hint, post);
        main.append(ta, list, bar);
        form.append(face, main);
        const note = h('p', 'ovh-note'); note.hidden = true;
        const auth = { Authorization: `Bearer ${o.token}` };
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = ta.value.trim(); if (!text || post.disabled) return;
            post.disabled = true; add.disabled = true; note.hidden = true;
            const label = post.textContent;
            try {
                let r;
                if (pics.length) {
                    const named = [];
                    for (let k = 0; k < pics.length; k++) {
                        post.textContent = pics.length > 1 ? `Picture ${k + 1} of ${pics.length}` : 'Sending the picture';
                        const fd = new FormData(); fd.append('file', pics[k].file, pics[k].file.name || 'picture.jpg');
                        const up = await fetch(`${o.frameBase || FRAME}/attachments`, { method: 'POST', credentials: 'omit', headers: auth, body: fd });
                        const uj = await up.json().catch(() => ({}));
                        const id = uj && uj.attachment && uj.attachment.media_id;
                        if (!up.ok || !id) throw new Error(uj.detail || 'A picture did not upload. Try again in a moment.');
                        named.push({ media_id: id, alt: pics[k].alt.value.trim() });
                    }
                    post.textContent = 'Posting';
                    r = await fetch(`${o.frameBase || FRAME}/posts`, { method: 'POST', credentials: 'omit', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: JSON.stringify({ text, pictures: named }) });
                } else {
                    r = await fetch(`${o.frameBase || FRAME}/status`, { method: 'POST', credentials: 'omit', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: JSON.stringify({ text }) });
                }
                const j = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(j.detail || 'It did not post. Try again in a moment.');
                ta.value = ''; ta.style.height = ''; pics.splice(0).forEach((p) => p.li.remove());
                note.hidden = false; note.textContent = 'Posted. It is on your profile and in the Feed.';
                if (o.onPosted) o.onPosted(j);
            } catch (err) { note.hidden = false; note.textContent = String(err.message || err); }
            post.textContent = label; ready();
        });
        box.append(form, note);
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
    const KINDS = [['', 'For you'], ['following', 'Following'], ['live', 'Live'], ['video', 'Videos'], ['clip', 'Clips'], ['pic', 'Pics'], ['post', 'Posts'], ['meme', 'Memes'], ['game', 'Games'], ['chat', 'Chat'], ['event', 'Events'], ['wiki', 'Wiki'], ['quest', 'Quests'], ['update', 'Updates']];
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
        else if (!c.actor) { face.classList.add('is-site'); face.style.setProperty('--ovh-h', String(hueOf(c.site || 'ov'))); face.append(siteIcon(c.site || 'ov', 22)); }
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
        const parts = [['views', 'eye', 'views'], ['likes', 'heart', 'likes'], ['comments', 'reply', 'replies']]
            .filter(([k]) => Number(n && n[k]) > 0);
        if (!parts.length) return null;
        const row = h('span', 'ovfd-counts');
        parts.forEach(([k, g, word]) => { const s = h('span', ''); s.setAttribute('aria-label', `${num(n[k])} ${word}`); s.title = `${num(n[k])} ${word}`; s.append(glyph(g), document.createTextNode(count(n[k]))); row.append(s); });
        return row;
    }
    function feedCard(c) {
        const kind = String(c.kind || 'post');
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
        const head = h('span', 'ovfd-head');
        const face = h('span', 'ovfd-face');
        const av = c.actor && safe(c.actor.avatar);
        // No person behind it (the network's trending pictures): the site's icon and the card's label, not a "?".
        if (av && /^https:/.test(av)) { const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = av; face.append(img); }
        else if (!c.actor) { face.classList.add('is-site'); face.style.setProperty('--ovh-h', String(hueOf(c.site || 'ov'))); face.append(siteIcon(c.site || 'ov', 20)); }
        else face.textContent = String(c.actor.name || '?').charAt(0).toUpperCase();
        const who = h('span', 'ovfd-who');
        who.append(h('b', '', String((c.actor && c.actor.name) || c.label || c.site_name || '').slice(0, 60)));
        const meta = h('small', '');
        meta.append(siteIcon(c.site || 'ov', 14), document.createTextNode(` ${[c.site_name || '', c.actor ? when(c.at) : String(c.text || when(c.at) || '').slice(0, 60)].filter(Boolean).join(' · ')}`));
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
            if (media.length) box.append(h('span', 'ovfd-len', String(media.length).slice(0, 10)));
            if (kind === 'live' && c.counts && c.counts.viewers) box.append(h('span', 'ovfd-len ovfd-viewers', `${count(c.counts.viewers)} watching`));
            a.append(box);
            if (kind === 'clip' || kind === 'video' || kind === 'live') watchPreview(box, c);
        }
        let title = String(c.title || '');
        if (kind === 'post' && /^Status:\s*/.test(title) && c.text && String(c.text).startsWith(title.replace(/^Status:\s*/, '').replace(/…$/, '').slice(0, 40))) title = '';
        if (kind === 'live') title = title.replace(/^.{1,60}? went live:?\s*/i, '') || title;
        if (title) a.append(h('b', 'ovfd-title', title.slice(0, 200)));
        if (c.text && (kind === 'post' || !thumb)) a.append(h('p', 'ovfd-text', String(c.text).slice(0, 500)));
        const counts = countsRow(c.counts);
        if (counts) a.append(counts);
        return a;
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
        const chips = h('div', 'ovfd-chips'); chips.setAttribute('role', 'tablist'); chips.setAttribute('aria-label', 'Feed');
        const list = h('div', 'ovfd-list');
        const sentinel = h('div', 'ovfd-more');
        el.append(chips, list, sentinel);
        let kind = '', cursor = null, busy = false, done = false, seq = 0, lastDay = '';
        const skeletons = () => { for (let k = 0; k < 3; k++) list.append(h('span', 'ovfd-skel')); };
        const clearSkels = () => list.querySelectorAll('.ovfd-skel').forEach((x) => x.remove());
        async function more(first) {
            if (busy || done) return;
            busy = true; const my = ++seq;
            if (first) { list.textContent = ''; skeletons(); } else skeletons();
            const j = await loadFeed(o, kind, cursor);
            if (my !== seq) return;
            clearSkels(); busy = false;
            if (!j) {
                if (first && !kind) { el.textContent = ''; if (o.feedMissing) o.feedMissing(); timeline(el, o); return; }   // the API is not there: the wall stands
                done = true; sentinel.textContent = ''; sentinel.append(h('p', 'ovh-note', 'That did not load. Pull the menu again to retry.')); return;
            }
            if (first && o.feedLive) o.feedLive();
            // Back-to-back go-lives that are over fold into one card of faces (a wall of "X went live" was the whole feed).
            const past = (x) => x && (x.kind === 'stream' || (x.kind === 'live' && !x.live_now)) && safe(x.url);
            let run = [];
            const flush = () => { if (run.length >= 2) list.append(livesCard(run)); else run.forEach((x) => { const c = feedCard(x); if (c) list.append(c); }); run = []; };
            // Date by date (the owner, 11-09): a quiet day line where the day changes. The network's trending cards
            // (no time of their own) sit between, under the day they were woven into.
            const day = (x) => { const t = Date.parse(String((x && x.at) || '')); return Number.isFinite(t) ? new Date(t).toDateString() : ''; };
            const mark = (x) => { const d = day(x); if (!d || d === lastDay) return; flush(); lastDay = d; list.append(dayLine(Date.parse(String(x.at)))); };
            j.items.forEach((x) => { mark(x); if (past(x) && !kind) { run.push(x); return; } flush(); const c = feedCard(x); if (c) list.append(c); });
            flush();
            if (typeof o.mountIcons === 'function') { try { o.mountIcons(list); } catch { /* */ } }
            cursor = j.next_cursor || null;
            done = !cursor;
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
        return { update() {} };
    }
    function feedStyles() {
        if (document.getElementById('ovfd-styles')) return;
        const st = document.createElement('style'); st.id = 'ovfd-styles';
        st.textContent = `
.ovfd-chips{position:sticky;top:0;z-index:2;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:8px 4px;margin:0 -4px;background:var(--bg-secondary,#141a24)}
.ovfd-chips::-webkit-scrollbar{display:none}
.ovfd-chip{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--border,rgba(255,255,255,.12));background:transparent;color:var(--text-secondary,#a8b3c4);font:inherit;font-size:13.5px;font-weight:650;cursor:pointer}
.ovfd-chip[aria-selected=true]{background:var(--text-primary,#e8ecf3);color:var(--bg-primary,#0b1220);border-color:transparent}
.ovfd-list{display:grid;gap:10px;padding:4px 0}
@media (min-width:861px){.ovfd{max-width:720px;margin-inline:auto}}
.ovfd-card{display:grid;gap:8px;padding:10px;border-radius:16px;background:color-mix(in srgb,var(--text-primary,#e8ecf3) 4%,transparent);box-shadow:inset 0 0 0 1px var(--border,rgba(255,255,255,.08));color:inherit;text-decoration:none;min-width:0}
@media (hover:hover){.ovfd-card:hover{background:color-mix(in srgb,var(--text-primary,#e8ecf3) 7%,transparent)}}
.ovfd-head{display:flex;align-items:center;gap:8px;min-width:0}
.ovfd-face{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:50%;overflow:hidden;background:var(--accent,#3b82f6);color:#fff;font-weight:800;font-size:13px}
.ovfd-face img{width:100%;height:100%;object-fit:cover}
.ovfd-face.is-site{border-radius:10px;background:linear-gradient(150deg,hsl(var(--ovh-h,215) 72% 58% / .34),hsl(var(--ovh-h,215) 70% 38% / .18))}.ovfd-face.is-site .ov-icon{color:hsl(var(--ovh-h,215) 90% 82%)}
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
`;
        document.head.appendChild(st);
    }

    root.OpenVibeHome = { home, wallTop, timeline, feed, loadPulse, _defaultHome: defaultHome };
})(typeof window !== 'undefined' ? window : globalThis);
