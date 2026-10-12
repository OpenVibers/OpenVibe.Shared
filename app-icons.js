'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/app-icons — every OpenVibe site's installable app icon set.
//
// The icons are pre-rendered PNGs in icons/<variant>[-maskable]-<size>.png (192 and 512), one set per app-icon
// tint variant (most sites share the network's), drawn by scripts/build-icons.js from app-icon.svg({ site: variant,
// maskable }); icons/sites.json names each service's variant (social.iconSite). A site serves its
// pinned copy at /shared/icons/<name> through openvibe-shared/serve, and the web app manifest served at
// /shared/manifest/<service>.webmanifest points at the same hashed URLs. (The `icons` subpath is already the
// ring-icon module `ov-icons.js`, so the per-site icon set lives here.)
//
//   appIcons.has(service)                is there an icon set for this service id
//   appIcons.url(service, size, { maskable })   '/shared/icons/<variant>[-maskable]-<size>.png?v=<hash>', or null
//   appIcons.site(service)               { name, description, icon } from icons/sites.json, or null
//   appIcons.isIcon(name)                'icons/<variant>[-maskable]-<size>.png' names serve.js may answer
//   appIcons.path(name)                  the file on disk (throws for anything that is not an icon)
//
// shell.page() uses appIcons.url(service, 192) for the apple-touch-icon when the page names its service.
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { hashAsset } = require('./assets');

const DIR = path.join(__dirname, 'icons');
const NAME_RE = /^icons\/([a-z0-9][a-z0-9-]{0,40})-(maskable-)?(192|512)\.png$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const hashes = new Map();
let sites = null;
/** icons/sites.json: { <service>: { name, description, icon: <variant> } }, read once. */
function site(service) {
    if (!sites) { try { sites = JSON.parse(fs.readFileSync(path.join(DIR, 'sites.json'), 'utf8')); } catch { sites = {}; } }
    const id = String(service || '');
    return ID_RE.test(id) && Object.prototype.hasOwnProperty.call(sites, id) ? sites[id] : null;
}

function isIcon(name) {
    const m = NAME_RE.exec(String(name || ''));
    return Boolean(m) && fs.existsSync(path.join(DIR, `${m[1]}-${m[2] || ''}${m[3]}.png`));
}

function iconPath(name) {
    if (!isIcon(name)) throw new Error(`openvibe-shared/app-icons: ${name} is not an app icon`);
    return path.join(__dirname, name);
}

const has = (service) => { const s = site(service); return Boolean(s && s.icon && isIcon(`icons/${s.icon}-192.png`)); };

function url(service, size, { maskable = false } = {}) {
    const meta = site(service);
    if (!meta || !meta.icon) return null;
    const s = Number(size);
    if (s !== 192 && s !== 512) return null;
    const name = `icons/${meta.icon}-${maskable ? 'maskable-' : ''}${s}.png`;
    if (!isIcon(name)) return null;
    if (!hashes.has(name)) hashes.set(name, hashAsset(fs.readFileSync(iconPath(name))));
    return `/shared/${name}?v=${hashes.get(name)}`;
}

module.exports = { has, url, site, isIcon, path: iconPath, DIR };
