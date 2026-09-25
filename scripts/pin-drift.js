#!/usr/bin/env node
'use strict';
/**
 * Pin drift (roadmap WS-C task 5): every OpenVibers repository pins the shared libraries by release tag
 * (`https://codeload.github.com/OpenVibers/<repo>/tar.gz/refs/tags/vX.Y.Z`). CI fails when a pin
 *
 *   - names a tag that is not published in that repository (an unpublished pin), or
 *   - is a major behind, or
 *   - is more than one minor behind a release that has been out for more than GRACE_DAYS (14): 0.40 fails
 *     once 0.42 is two weeks old. The grace keeps CI green on the day a library ships and still catches
 *     pins left behind. Release dates come from the library's CHANGELOG.md on main ("## 0.42.0 — 2026-09-25"
 *     or "## 0.9.1 (2026-09-24)"); a release with no date there counts as old.
 *
 *   node scripts/pin-drift.js [dir]                    every package.json under dir (git-tracked), default .
 *   curl -fsSL https://raw.githubusercontent.com/OpenVibers/OpenVibe.Shared/main/scripts/pin-drift.js | node - [dir]
 *
 * Checks openvibe-contracts, openvibe-shared, openvibe-sdk and openvibe-publishing in dependencies,
 * devDependencies, optionalDependencies and peerDependencies; ranges that are not tag URLs (a peer range
 * like ">=1.5.0") are not pins and are skipped. Tags come from `git ls-remote --tags` (no token needed).
 * Exit 0 = no drift, 1 = drift, 2 = could not check (network).
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const LIBS = { 'openvibe-contracts': 'OpenVibe.Contracts', 'openvibe-shared': 'OpenVibe.Shared', 'openvibe-sdk': 'OpenVibe.SDK', 'openvibe-publishing': 'OpenVibe.Publishing' };
const PIN = /OpenVibers\/(OpenVibe\.[A-Za-z]+)\/tar\.gz\/refs\/tags\/v(\d+)\.(\d+)\.(\d+)$/;

const GRACE_DAYS = 14;
const parse = (t) => { const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(t); return m ? m.slice(1).map(Number) : null; };
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** "1.2.3" → release date (ms) from a CHANGELOG.md. */
function releaseDates(changelog) {
    const out = new Map();
    for (const m of String(changelog || '').matchAll(/^##\s*\[?v?(\d+\.\d+\.\d+)\]?\s*(?:—|-|–|\()\s*(\d{4}-\d{2}-\d{2})/gm)) out.set(m[1], Date.parse(`${m[2]}T00:00:00Z`));
    return out;
}

/** A pin's verdict against the published tags (and their release dates). → { ok, reason } */
function judge(pin, published, { dates = new Map(), now = Date.now(), graceDays = GRACE_DAYS } = {}) {
    const tags = published.map(parse).filter(Boolean).sort(cmp);
    if (!tags.length) return { ok: false, reason: 'no published tags' };
    if (!tags.some((t) => cmp(t, pin) === 0)) return { ok: false, reason: `v${pin.join('.')} is not a published tag` };
    const latest = tags[tags.length - 1];
    if (pin[0] < latest[0]) return { ok: false, reason: `v${pin.join('.')} is a major behind v${latest.join('.')}` };
    // The releases two or more minors ahead of the pin that have been out longer than the grace period.
    const old = tags.filter((t) => t[0] === pin[0] && t[1] - pin[1] > 1).filter((t) => {
        const at = dates.get(t.join('.'));
        return !(Number.isFinite(at) && now - at <= graceDays * 86400000);
    });
    if (old.length) return { ok: false, reason: `v${pin.join('.')} is ${latest[1] - pin[1]} minors behind v${latest.join('.')} (v${old[old.length - 1].join('.')} is over ${graceDays} days old)` };
    if (latest[1] - pin[1] > 1) return { ok: true, reason: `latest v${latest.join('.')}; behind by ${latest[1] - pin[1]} minors, within the ${graceDays}-day grace` };
    return { ok: true, reason: `latest v${latest.join('.')}` };
}

function packageFiles(dir) {
    try {
        return cp.execSync("git ls-files -- '*package.json' 'package.json'", { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter((f) => f && !f.includes('node_modules/')).map((f) => path.join(dir, f));
    } catch { return fs.existsSync(path.join(dir, 'package.json')) ? [path.join(dir, 'package.json')] : []; }
}

function pinsIn(file) {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const out = [];
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
        for (const [name, spec] of Object.entries(pkg[field] || {})) {
            if (!LIBS[name]) continue;
            const m = PIN.exec(String(spec));
            if (m && m[1] === LIBS[name]) out.push({ file, field, name, repo: m[1], pin: [Number(m[2]), Number(m[3]), Number(m[4])] });
        }
    }
    return out;
}

function main(dir = '.', { tagsOf, datesOf, now = Date.now() } = {}) {
    const cache = new Map();
    const dateCache = new Map();
    const dates = datesOf || ((repo) => {
        if (!dateCache.has(repo)) {
            let text = '';
            try { text = cp.execSync(`curl -fsSL --max-time 20 https://raw.githubusercontent.com/OpenVibers/${repo}/main/CHANGELOG.md`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* no dates: every release counts as old */ }
            dateCache.set(repo, releaseDates(text));
        }
        return dateCache.get(repo);
    });
    const tags = tagsOf || ((repo) => {
        if (!cache.has(repo)) {
            const raw = cp.execSync(`git ls-remote --tags https://github.com/OpenVibers/${repo}.git`, { encoding: 'utf8', timeout: 30000 });
            cache.set(repo, [...new Set(raw.split('\n').map((l) => (l.split('refs/tags/')[1] || '').replace(/\^\{\}$/, '')).filter(Boolean))]);
        }
        return cache.get(repo);
    });
    const results = [];
    for (const file of packageFiles(dir)) for (const p of pinsIn(file)) results.push({ ...p, ...judge(p.pin, tags(p.repo), { dates: dates(p.repo), now }) });
    return results;
}

module.exports = { judge, pinsIn, main, releaseDates, LIBS, GRACE_DAYS };

if (require.main === module || !module.parent) {
    let results;
    try { results = main(process.argv[2] || '.'); } catch (err) { console.error(`pin-drift: could not read tags (${err.message})`); process.exit(2); }
    for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${path.relative(process.cwd(), r.file) || r.file} ${r.name} v${r.pin.join('.')}: ${r.reason}`);
    const bad = results.filter((r) => !r.ok);
    console.log(bad.length ? `pin-drift: ${bad.length} of ${results.length} pin(s) drifted` : `pin-drift: ${results.length} pin(s), no drift`);
    process.exit(bad.length ? 1 : 0);
}
