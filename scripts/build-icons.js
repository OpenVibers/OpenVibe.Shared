#!/usr/bin/env node
'use strict';
// Render the installable app icon sets (192/512, any + maskable) into icons/, one per app-icon tint variant
// (icons/<variant>[-maskable]-<size>.png; most sites share the network's), and write icons/sites.json — each
// service's name, tagline and the variant the share cards use (social.iconSite) — for the manifest serve.js builds.
//   node scripts/build-icons.js --contracts <OpenVibe.Contracts checkout> --sharp <path to sharp module>
// sharp is not a dependency of this package, so the caller names its module. The service list is the share
// cards in social/ (the sites that already have one); the name and tagline come from each Contracts service
// manifest's `site` block, the same source build-social-cards.js reads. Re-run after a name, tagline or icon
// change, and commit the PNGs and sites.json: sites serve them from their pinned copy.
const fs = require('fs');
const path = require('path');
const icon = require('../app-icon');
const social = require('../social');

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const contracts = arg('contracts');
const sharpPath = arg('sharp');
if (!contracts || !sharpPath) { console.error('usage: build-icons.js --contracts <OpenVibe.Contracts checkout> --sharp <path to sharp module>'); process.exit(1); }
const sharp = require(path.resolve(sharpPath));

const OUT = path.join(__dirname, '..', 'icons');
const SERVICES = path.join(contracts, 'manifests', 'services');

function serviceIds() {
    // A page card (live-chat, live-rundown, …) belongs to its site, which has the icons and the manifest.
    return fs.readdirSync(social.DIR).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)).filter((id) => !social.pageOf(id)).sort();
}

function siteOf(id) {
    // A domain card (openvibe.pics, …) names itself; its icon is its service's (social.iconSite).
    const d = social.domainOf(id);
    if (d) return { id, name: d.name, tagline: d.tagline };
    const m = JSON.parse(fs.readFileSync(path.join(SERVICES, `${id}.json`), 'utf8'));
    if (!m.site) throw new Error(`${id}: no site block`);
    return { id, name: m.site.name, tagline: m.site.tagline || '', domains: m.domains || [] };
}

/** The product's full name: "OpenVibe." + the site name, unless it already carries its own ("OpenRestream") or lives on
 *  its own open.<tld> domain (open.shoes → "Open.Shoes"). */
function productName(name, domains = []) {
    if (/^Open(Re)(.+)$/.test(name)) return name;
    return /^open\.[a-z]+$/.test(domains[0] || '') ? `Open.${name}` : `OpenVibe.${name}`;
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
    const sites = {};
    const variants = new Set();
    for (const id of serviceIds()) {
        const site = siteOf(id);
        const variant = social.iconSite(id);
        sites[id] = { name: productName(site.name, site.domains), description: site.tagline, icon: variant };
        variants.add(variant);
    }
    for (const variant of [...variants].sort()) {
        for (const maskable of [false, true]) {
            for (const s of [192, 512]) {
                const file = path.join(OUT, `${variant}-${maskable ? 'maskable-' : ''}${s}.png`);
                await sharp(Buffer.from(icon.svg({ site: variant, maskable })), { density: 300 }).resize(s, s).png({ compressionLevel: 9, palette: true, quality: 100 }).toFile(file);
            }
        }
        console.log(`icons/${variant}-{192,512,maskable-192,maskable-512}.png`);
    }
    fs.writeFileSync(path.join(OUT, 'sites.json'), JSON.stringify(sites, null, 2) + '\n');
    console.log(`icons/sites.json: ${Object.keys(sites).length} services`);
})().catch((e) => { console.error(e); process.exit(1); });
