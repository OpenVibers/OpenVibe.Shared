'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/social — every OpenVibe site's share card (og:image / twitter:image).
//
// The cards are 1200×630 JPEGs in social/<service>.jpg, drawn by scripts/build-social-cards.js from the service
// manifests' `site` blocks (name, tagline, first domain, accent) with the app-icon mark; a site's big pages have page
// cards, social/<service>-<page>.jpg (live-rundown, live-content, …), listed in PAGES below. A site serves its pinned
// copy at /shared/social/<service>.jpg through openvibe-shared/serve, so a card never depends on another host.
//
//   social.has(service)                 is there a card for this service id
//   social.url(service, base?)          '/shared/social/<service>.jpg?v=<content hash>', or null without a card
//   social.isCard(name)                 'social/<id>.jpg' names serve.js may answer
//   social.path(name)                   the file on disk (throws for anything that is not a card)
//   social.accentOf(service, accent?)   the two accent stops the card uses (build script)
//   social.iconSite(service)            the app-icon variant for the service's mark (build script)
//   social.pageOf(id) / social.PAGES     the page cards: which page and site a card id names (null for a site's card)
//
// shell.page() uses social.url(o.service) for og:image when the page names no image of its own.
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { hashAsset } = require('./assets');
const icon = require('./app-icon');

const DIR = path.join(__dirname, 'social');
const NAME_RE = /^social\/([a-z0-9][a-z0-9-]{0,40})\.jpg$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const hashes = new Map();

function isCard(name) {
    const m = NAME_RE.exec(String(name || ''));
    return Boolean(m) && fs.existsSync(path.join(DIR, `${m[1]}.jpg`));
}

function cardPath(name) {
    if (!isCard(name)) throw new Error(`openvibe-shared/social: ${name} is not a share card`);
    return path.join(__dirname, name);
}

// Page cards (social/<service>-<page>.jpg): a site's big pages, shared on their own, get a card that names the page in
// place of the site, with the site's brand beside the mark and the page's address in the pill. Drawn by
// scripts/build-social-cards.js from this list; every other card is a site's.
const PAGES = [
    { id: 'live-rundown', service: 'live', heading: 'The Rundown', path: '/rundown', tagline: 'What streamers talked about',
        what: "Topics, takes and episodes from OpenVibe.Live streams, in the streamers' own words, with a link to every moment." },
    { id: 'live-content', service: 'live', heading: 'Content', path: '/content', tagline: 'Recordings, clips and pastes',
        what: 'What people made on OpenVibe.Live: recorded streams, the moments viewers clipped, and the code and notes they shared.' },
    { id: 'live-moments', service: 'live', heading: 'AI Moments', path: '/moments', tagline: 'Highlights the AI picked',
        what: 'Auto-clips of the moments chat erupted, standout frames and after-show recaps, each one labelled AI-made.' },
    { id: 'live-chat', service: 'live', heading: 'Chat', path: '/chat', tagline: 'The global chat room',
        what: 'One chat room for everyone on OpenVibe.Live, across every stream, open to the whole network.' },
];
/** The page a card id names ({ id, service, heading, … }), or null for a site's own card. */
const pageOf = (id) => PAGES.find((pg) => pg.id === id) || null;

const has = (service) => ID_RE.test(String(service || '')) && isCard(`social/${service}.jpg`);

function url(service, base = '/shared') {
    if (!has(service)) return null;
    const name = `social/${service}.jpg`;
    if (!hashes.has(name)) hashes.set(name, hashAsset(fs.readFileSync(cardPath(name))));
    return `${String(base).replace(/\/+$/, '')}/${name}?v=${hashes.get(name)}`;
}

// The mark's tint: app-icon has variants for a few sites; the rest wear the network's.
const iconSite = (service) => (Object.prototype.hasOwnProperty.call(icon.SITES, service) ? service : service === 'media-hub' ? 'media' : 'network');

/** A deeper stop of the same hue (lightness down 16 points, saturation up 6), so a gradient never turns muddy. */
function deepen(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const L = Math.max(0, l - 0.16), S = Math.min(1, s + 0.06);
    const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((h % 6) + 6) % 2 - 1)), m = L - c / 2;
    const [R, G, B] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    return `#${[R, G, B].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** [light, deep] accent stops: the manifest's accent and a deeper stop of it, else the app-icon variant's. */
function accentOf(service, accent) {
    return /^#[0-9a-f]{6}$/i.test(accent || '') ? [accent.toLowerCase(), deepen(accent)] : icon.SITES[iconSite(service)].accent;
}

module.exports = { has, url, isCard, path: cardPath, accentOf, iconSite, pageOf, PAGES, DIR };
