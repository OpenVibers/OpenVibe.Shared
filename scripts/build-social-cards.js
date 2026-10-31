#!/usr/bin/env node
'use strict';
// Render the share card (og:image, 1200×630 JPEG) of every OpenVibe site into social/<service>.jpg, and the page cards
// (openvibe-shared/social PAGES) into social/<service>-<page>.jpg.
//   node scripts/build-social-cards.js --contracts <OpenVibe.Contracts checkout> [--chrome <path>] [--only <id,id>]
// --only takes site ids (a site's page cards come with it) or page card ids.
// Needs Chrome (the drawing) and ImageMagick's `convert` (PNG → a ~60 KB progressive JPEG).
// The name, tagline, domain and accent come from each service manifest's `site` block (Contracts is the source of
// truth; this script only draws them). The mark is openvibe-shared/app-icon. The names are set in the brand face
// (ov-brand.woff2, Nunito, as the navbar draws them) and the rest in Inter, fetched once from Google Fonts; both are
// embedded, so a card never depends on the fonts of the machine that rendered it. Re-run after a tagline,
// accent or domain changes, and commit the PNGs: sites serve them from their pinned copy (openvibe-shared/serve).
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');
const icon = require('../app-icon');
const social = require('../social');

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const contracts = arg('contracts');
const chrome = arg('chrome', '/usr/bin/google-chrome');
const only = arg('only') ? new Set(arg('only').split(',')) : null;
if (!contracts) { console.error('usage: build-social-cards.js --contracts <OpenVibe.Contracts checkout> [--chrome <path>] [--only <ids>]'); process.exit(1); }

const OUT = path.join(__dirname, '..', 'social');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function get(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            if (res.statusCode !== 200) { res.resume(); return reject(new Error(`${url}: ${res.statusCode}`)); }
            const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function interFaces() {
    // A desktop user agent gets woff2; each weight's latin subset is embedded as a data: URL.
    const css = (await get('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;800&display=block',
        { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' })).toString();
    const out = [];
    for (const [, block] of css.matchAll(/\/\* latin \*\/\s*@font-face\s*\{([^}]*)\}/g)) {
        const weight = /font-weight:\s*(\d+)/.exec(block)[1];
        const url = /url\((https:[^)]+\.woff2)\)/.exec(block)[1];
        const data = (await get(url)).toString('base64');
        out.push(`@font-face{font-family:'Inter';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2')}`);
    }
    if (!out.length) throw new Error('no latin Inter faces in the Google Fonts CSS');
    return out.join('\n');
}

/** The brand face the names are set in (ov-brand.woff2 beside navbar.js), embedded. */
function brandFace() {
    const data = fs.readFileSync(path.join(__dirname, '..', 'ov-brand.woff2')).toString('base64');
    return `@font-face{font-family:'OV Brand';font-style:normal;font-weight:700 900;font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2')}`;
}

function sites() {
    const dir = path.join(contracts, 'manifests', 'services');
    const out = [];
    const byId = new Map();
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
        const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (!m.site || !Array.isArray(m.domains) || !m.domains.length) continue;
        const site = { id: m.id, name: m.site.name, tagline: m.site.tagline, what: m.site.what || '', domain: m.domains[0], accent: social.accentOf(m.id, m.site.accent) };
        byId.set(m.id, site);
        if (only && !only.has(m.id)) continue;
        out.push(site);
    }
    for (const pg of social.PAGES) {
        const site = byId.get(pg.service);
        if (!site) throw new Error(`page card ${pg.id}: no site ${pg.service} in the manifests`);
        if (only && !only.has(pg.id) && !only.has(pg.service)) continue;
        out.push({ ...site, id: pg.id, heading: pg.heading, tagline: pg.tagline, what: pg.what, domain: `${site.domain}${pg.path}`, iconId: site.id });
    }
    return out;
}

function card(site, fonts) {
    const [a1, a2] = site.accent;
    // The product name after "OpenVibe.", unless the product carries its own name: OpenRestream reads "OpenRe" +
    // "stream" as one word, the way the navbar draws it.
    const own = /^Open(Re)(.+)$/.exec(site.name);
    const siteBrand = own
        ? `<span class="w">Open${own[1]}</span><span class="p">${esc(own[2])}</span>`
        : `<span class="w">OpenVibe</span><span class="d">.</span><span class="p">${esc(site.name)}</span>`;
    // A page card: the page's name is the headline and the site's brand takes the line beside the mark.
    const brand = site.heading ? `<span class="p">${esc(site.heading)}</span>` : siteBrand;
    const long = (site.heading || site.name).length > 9;
    return `<!doctype html><html><head><meta charset="utf-8"><style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{font-family:'Inter',sans-serif;color:#f8fafc;background:#0a0f1c;position:relative;-webkit-font-smoothing:antialiased}
.glow{position:absolute;inset:0;background:
  radial-gradient(760px 520px at 88% -8%, ${a1}38, transparent 62%),
  radial-gradient(620px 460px at -6% 112%, ${a2}2e, transparent 64%)}
.grid{position:absolute;inset:0;background-image:radial-gradient(#ffffff14 1.2px, transparent 1.3px);background-size:28px 28px;
  -webkit-mask-image:linear-gradient(115deg, transparent 30%, #000 75%);mask-image:linear-gradient(115deg, transparent 30%, #000 75%)}
.ring{position:absolute;right:-150px;top:50%;width:620px;height:620px;margin-top:-310px;border-radius:50%;
  border:44px solid ${a1};opacity:.09}
.ring2{position:absolute;right:-30px;top:50%;width:380px;height:380px;margin-top:-190px;border-radius:50%;border:2px solid ${a1};opacity:.16}
.wrap{position:absolute;inset:0;padding:60px 84px 60px;display:flex;flex-direction:column}
.top{display:flex;align-items:center;gap:22px}
.icon{width:96px;height:96px;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px -12px ${a2}88, 0 0 0 1px #ffffff1a}
.icon svg{width:96px;height:96px;display:block}
.net{font-size:26px;font-weight:600;color:#94a3b8;letter-spacing:.01em}
.net.site{font-family:'OV Brand','Inter',sans-serif;font-size:36px;font-weight:900;letter-spacing:-.01em}
.net.site .w{color:#f8fafc}.net.site .d{color:${a1}}
.net.site .p{background:linear-gradient(100deg, ${a1}, ${a2});-webkit-background-clip:text;background-clip:text;color:transparent}
.name{margin-top:36px;font-family:'OV Brand','Inter',sans-serif;font-size:${long ? 94 : 110}px;font-weight:900;letter-spacing:-.02em;line-height:1}
.name .w{color:#f8fafc}.name .d{color:${a1}}
.name .p{background:linear-gradient(100deg, ${a1}, ${a2});-webkit-background-clip:text;background-clip:text;color:transparent}
.tag{margin-top:22px;max-width:900px;font-size:42px;font-weight:600;line-height:1.18;color:#cbd5e1;letter-spacing:-.012em;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.what{margin-top:18px;max-width:900px;font-size:27px;font-weight:500;line-height:1.38;color:#8b9ab3;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between}
.dom{display:inline-flex;align-items:center;gap:14px;font-size:30px;font-weight:600;color:#e2e8f0;
  padding:12px 24px 12px 18px;border-radius:999px;background:#ffffff0d;box-shadow:inset 0 0 0 1.5px ${a1}55}
.dom i{width:14px;height:14px;border-radius:50%;background:${a1};box-shadow:0 0 18px ${a1}}
.part{font-size:24px;font-weight:500;color:#64748b}
</style></head><body>
<div class="glow"></div><div class="grid"></div><div class="ring"></div><div class="ring2"></div>
<div class="wrap">
  <div class="top"><div class="icon">${icon.svg({ site: social.iconSite(site.iconId || site.id), maskable: false })}</div>${site.heading ? `<div class="net site">${siteBrand}</div>` : '<div class="net">One account. All of OpenVibe.</div>'}</div>
  <div class="name">${brand}</div>
  <div class="tag">${esc(site.tagline)}</div>
  ${site.what ? `<div class="what">${esc(site.what)}</div>` : ''}
  <div class="foot"><span class="dom"><i></i>${esc(site.domain)}</span><span class="part">Open source · part of the OpenVibe network</span></div>
</div></body></html>`;
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const fonts = `${brandFace()}\n${await interFaces()}`;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-social-'));
    const list = sites();
    for (const site of list) {
        const html = path.join(tmp, `${site.id}.html`);
        fs.writeFileSync(html, card(site, fonts));
        const png = path.join(tmp, `${site.id}.png`);
        const jpg = path.join(OUT, `${site.id}.jpg`);
        execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
            '--window-size=1200,630', '--virtual-time-budget=3000', `--user-data-dir=${path.join(tmp, 'profile')}`,
            `--screenshot=${png}`, `file://${html}`], { stdio: 'ignore' });
        execFileSync('convert', [png, '-strip', '-quality', '82', '-sampling-factor', '4:2:0', '-interlace', 'JPEG', jpg]);
        console.log(`${site.id}: ${path.relative(process.cwd(), jpg)} (${Math.round(fs.statSync(jpg).size / 1024)} KB)`);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
