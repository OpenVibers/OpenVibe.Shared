'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/app-icon — one app icon design for every OpenVibe site.
//
// The icon is the OpenVibe mark (openvibe-shared/mark: the Pair, a ring O and a round V) on the network's deep navy,
// with a soft glow behind it. No text: a home-screen icon is a few millimetres wide.
//   svg({ site, maskable })   full-bleed square SVG. maskable keeps the mark inside the 40 % radius
//                             safe zone, so round, squircle and teardrop masks never clip it.
//   favicon({ site })         the heavy form on a rounded tile, tuned for 16–32 px.
//   manifest({ site, name, shortName, description, startUrl })  web app manifest with shared colours.
//   SITES                     accent (the glow and the share cards) and the light in the O per site: Live's is the
//                             red record light, as in ov-mark.js's variants; white means none.
// PNG sets are rendered from these by scripts/build-app-icons.js.
// ═══════════════════════════════════════════════════════════════
const BG = '#0a0f1c', BG_EDGE = '#060912';
const SITES = {
    network: { accent: ['#60a5fa', '#2563eb'], dot: '#ffffff' },
    live: { accent: ['#60a5fa', '#2563eb'], dot: '#ef4444' },
    tools: { accent: ['#38bdf8', '#2563eb'], dot: '#ffffff' },
    community: { accent: ['#34d399', '#2563eb'], dot: '#ffffff' },
    games: { accent: ['#a78bfa', '#2563eb'], dot: '#facc15' },
    media: { accent: ['#fbbf24', '#2563eb'], dot: '#ffffff' },
    space: { accent: ['#818cf8', '#4f46e5'], dot: '#ffffff' },
    ai: { accent: ['#22d3ee', '#2563eb'], dot: '#ffffff' },
};
const of = (site) => SITES[site] || SITES.network;

const MARK = require('./mark');

// The mark centred on 0,0 (openvibe-shared/mark draws it centred on 50,50 in a 100-unit box), scaled.
function mark(site, scale, form = 'pair') {
    const c = of(site), g = MARK.geo(form), { body } = MARK.art({ form, id: 'ov', depth: true });
    const light = c.dot && c.dot.toLowerCase() !== '#ffffff' ? `<circle cx="${g.cx}" cy="${g.cy}" r="${+((g.r - g.sw / 2) * 0.62).toFixed(2)}" fill="${c.dot}"/>` : '';
    return `<g transform="scale(${scale}) translate(-50 -50)"><ellipse cx="50" cy="50" rx="52" ry="40" fill="url(#glow)"/>${body}${light}</g>`;
}

function defs(site, form = 'pair') {
    const [a] = of(site).accent;
    return `<defs>${MARK.art({ form, id: 'ov', depth: true }).defs}
<radialGradient id="glow"><stop offset="0" stop-color="${a}" stop-opacity=".3"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
<radialGradient id="bg" cx=".5" cy=".38" r=".8"><stop offset="0" stop-color="#16223a"/><stop offset=".6" stop-color="${BG}"/><stop offset="1" stop-color="${BG_EDGE}"/></radialGradient></defs>`;
}

/** Full-bleed square. `maskable`: mark radius ≤ 40 % of the half-width; otherwise it fills more of the tile. */
function svg({ site = 'network', maskable = true, size = 512 } = {}) {
    // The mark's farthest point (the V's caps) is 50 units from its centre: × 4 is 200 of the 256 half-width, inside
    // the maskable safe zone (40 % of the width, 204.8). A rounded tile carries it at three quarters of its width.
    const scale = maskable ? 4 : 4.2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-256 -256 512 512" width="${size}" height="${size}">${defs(site)}
<rect x="-256" y="-256" width="512" height="512" fill="url(#bg)"${maskable ? '' : ' rx="112"'}/>${mark(site, scale)}</svg>`;
}

/** Small sizes: the heavy form, as wide as the tile allows, and the tile rounded because nothing masks a favicon. */
function favicon({ site = 'network' } = {}) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-32 -32 64 64">${defs(site, 'heavy')}<rect x="-32" y="-32" width="64" height="64" rx="15" fill="url(#bg)"/>${mark(site, 0.58, 'heavy')}</svg>`;
}

function manifest({ site = 'network', name, shortName, description, startUrl = '/', iconBase = '/assets' }) {
    const sizes = [72, 192, 512];
    return {
        name, short_name: shortName || name, description, start_url: startUrl, scope: '/', display: 'standalone',
        background_color: BG, theme_color: '#3b82f6',
        icons: [...sizes.map(s => ({ src: `${iconBase}/logo-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' })),
            ...[192, 512].map(s => ({ src: `${iconBase}/logo-maskable-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'maskable' })),
            { src: `${iconBase}/logo.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    };
}

// First paint must never depend on another server. These two inline tags give every page the network's
// dark canvas and the visitor's cached theme immediately; theme-loader.js (deferred, from the Network)
// reconciles with the account afterwards. If the Network is slow or restarting, the page is still
// styled and readable instead of blank white.
const CRITICAL = `<style id="ov-critical">html{background:${BG};color:#e6edf7;color-scheme:dark}</style>`
    + `<script>(function(){try{var r=localStorage.getItem('ov_theme');if(!r)return;var t=JSON.parse(r),v=t&&t.variables;if(!v)return;var e=document.documentElement;for(var k in v)if(k.charAt(0)==='-')e.style.setProperty(k,v[k]);if(v['--bg-primary'])e.style.background=v['--bg-primary'];if(v['--text-primary'])e.style.color=v['--text-primary'];if(v['--color-scheme']==='light'||v['--color-scheme']==='dark')e.style.colorScheme=v['--color-scheme'];if(t.id)e.setAttribute('data-theme',t.id)}catch(_){}})();</script>`;

/** <head> tags every site shares: SVG favicon (inline, no request), theme colour, and the PNG touch icon when the site ships one. */
function headTags({ site = 'network', iconBase = null } = {}) {
    const uri = 'data:image/svg+xml,' + encodeURIComponent(favicon({ site })).replace(/'/g, '%27');
    return [`<link rel="icon" type="image/svg+xml" data-ov-icon="${String(site).replace(/[^a-z]/g, '')}" href="${uri}">`, '<meta name="theme-color" content="#0d131d">', '<meta name="color-scheme" content="dark">', CRITICAL,
        iconBase ? `<link rel="apple-touch-icon" href="${iconBase}/logo-192.png">` : '', iconBase ? `<link rel="manifest" href="/manifest.webmanifest">` : ''].filter(Boolean).join('\n');
}

module.exports = { svg, favicon, manifest, headTags, CRITICAL, SITES, BG };
