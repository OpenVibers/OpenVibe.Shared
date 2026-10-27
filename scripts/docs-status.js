#!/usr/bin/env node
'use strict';
/**
 * Docs currency (plan D41): a repository's pinned openvibe-* releases are written in two places
 * besides package.json — the STATUS.json fields (`contracts`, `sdk`, `shared`, `updated`) and a
 * README block delimited by `<!-- versions:start -->` / `<!-- versions:end -->`. This script reads
 * the pins and keeps those two in step, so STATUS.json and the README can never quietly describe a
 * release the repository does not pin.
 *
 *   node scripts/docs-status.js [dir]           write the current pins into STATUS.json and README.md
 *   node scripts/docs-status.js [dir] --check   report drift and exit 1 (writes nothing)
 *   curl -fsSL https://raw.githubusercontent.com/OpenVibers/OpenVibe.Shared/main/scripts/docs-status.js | node - [dir] --check
 *
 * A pin is a `https://codeload.github.com/OpenVibers/<repo>/tar.gz/refs/tags/vX.Y.Z` dependency
 * (any of the four dependency fields) for openvibe-contracts, openvibe-sdk, openvibe-shared or
 * openvibe-publishing; a range like ">=1.5.0" is not a pin and is skipped (the same rule as
 * scripts/pin-drift.js). The script owns only those three STATUS.json fields and `updated`, and the
 * README versions block: repository, stage, deployed, features and every other key are preserved,
 * and prose after a version (e.g. "(devDependency: the release manifest contract)") is kept.
 *
 * Exit 0 = the docs match the pins (or the repository pins nothing), 1 = drift.
 */
const fs = require('fs');
const path = require('path');

const START = '<!-- versions:start -->';
const END = '<!-- versions:end -->';
const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
// The pins this check understands, and the STATUS.json field each owns (null = not tracked there).
const LIBS = [
    { pkg: 'openvibe-contracts', repo: 'OpenVibe.Contracts', field: 'contracts' },
    { pkg: 'openvibe-sdk', repo: 'OpenVibe.SDK', field: 'sdk' },
    { pkg: 'openvibe-shared', repo: 'OpenVibe.Shared', field: 'shared' },
    { pkg: 'openvibe-publishing', repo: 'OpenVibe.Publishing', field: null },
];
const PIN = /OpenVibers\/(OpenVibe\.[A-Za-z]+)\/tar\.gz\/refs\/tags\/v(\d+\.\d+\.\d+)$/;
const VERSION = /(\d+\.\d+\.\d+)/;

const byPackage = new Map(LIBS.map((l) => [l.pkg, l]));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The openvibe-* pins in a parsed package.json: `{ 'openvibe-sdk': '0.20.4', ... }`. */
function pinsIn(pkg) {
    const out = {};
    for (const field of FIELDS) {
        for (const [name, spec] of Object.entries((pkg && pkg[field]) || {})) {
            const lib = byPackage.get(name);
            if (!lib) continue;
            const m = PIN.exec(String(spec));
            if (m && m[1] === lib.repo) out[name] = m[2];
        }
    }
    return out;
}

/**
 * The workspace packages' directories: the root package.json's `workspaces` (an array, or { packages }) and
 * pnpm-workspace.yaml's `packages`, with a trailing `/*` read one level deep. Negations and `**` are skipped.
 */
function workspaceDirs(dir) {
    const patterns = [];
    const root = readJson(path.join(dir, 'package.json'));
    const ws = root && (Array.isArray(root.workspaces) ? root.workspaces : root.workspaces && root.workspaces.packages);
    if (Array.isArray(ws)) patterns.push(...ws);
    const pnpm = path.join(dir, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpm)) {
        for (const m of fs.readFileSync(pnpm, 'utf8').matchAll(/^\s*-\s*['"]?([^'"\n#]+?)['"]?\s*$/gm)) patterns.push(m[1]);
    }
    // No declared workspaces (Tools keeps one package per app): the conventional folders.
    if (!patterns.length) patterns.push('apps/*', 'packages/*');
    const out = [];
    for (const pattern of patterns) {
        if (typeof pattern !== 'string' || pattern.startsWith('!') || pattern.includes('**')) continue;
        if (pattern.endsWith('/*')) {
            const base = path.join(dir, pattern.slice(0, -2));
            try {
                for (const e of fs.readdirSync(base, { withFileTypes: true })) if (e.isDirectory()) out.push(path.join(base, e.name));
            } catch { /* no such folder */ }
        } else out.push(path.join(dir, pattern));
    }
    return out;
}

const newer = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
};

/**
 * The repository's pins: its workspace packages' (the newest of each library, since a pin round moves them together)
 * with the root package.json's own over them. A workspace root that pins nothing itself (Games, Tools, Examples) used
 * to read as "pins nothing", so its STATUS.json kept naming old releases after every pin round.
 */
function pinsFor(dir) {
    const out = {};
    for (const d of workspaceDirs(dir)) {
        for (const [name, version] of Object.entries(pinsIn(readJson(path.join(d, 'package.json'))))) {
            if (!out[name] || newer(version, out[name])) out[name] = version;
        }
    }
    return Object.assign(out, pinsIn(readJson(path.join(dir, 'package.json'))));
}

/** Every "openvibe-<lib> vX.Y.Z" a STATUS string names, moved to that library's pin (one field may name several). */
function withNamedPins(text, pins) {
    return String(text).replace(/\b(openvibe-[a-z]+) v(\d+\.\d+\.\d+)/g, (all, name) => (pins[name] ? `${name} v${pins[name]}` : all));
}

/** The status value for a pin, keeping prose after the version: "openvibe-contracts v0.61.0 (devDependency…)". */
function statusValue(existing, name, version) {
    const fresh = `${name} v${version}`;
    if (typeof existing !== 'string' || !VERSION.test(existing)) return fresh;
    return existing.replace(VERSION, version);
}

/** Whether another tracked STATUS field names this library ("…, openvibe-sdk v0.65.0, …" in `contracts`). */
function namedElsewhere(status, lib) {
    const re = new RegExp(`\\b${escapeRe(lib.pkg)} v\\d+\\.\\d+\\.\\d+`);
    return LIBS.some((l) => l.field && l.field !== lib.field && typeof status[l.field] === 'string' && re.test(status[l.field]));
}

/** STATUS.json findings for every tracked pin. */
function statusFindings(status, pins) {
    const out = [];
    for (const lib of LIBS) {
        if (!lib.field || !(lib.pkg in pins)) continue;
        const want = pins[lib.pkg];
        const existing = status[lib.field];
        if (existing === undefined && namedElsewhere(status, lib)) continue;   // checked with the field that names it
        if (typeof existing !== 'string' || !VERSION.test(existing)) {
            out.push({ ok: false, file: 'STATUS.json', field: lib.field, reason: `pins ${lib.pkg} v${want} but STATUS.json has no ${lib.field} version` });
            continue;
        }
        const have = VERSION.exec(existing)[1];
        if (have !== want) out.push({ ok: false, file: 'STATUS.json', field: lib.field, reason: `pins ${lib.pkg} v${want} but STATUS.json ${lib.field} says v${have}` });
        else out.push({ ok: true, file: 'STATUS.json', field: lib.field, reason: `${lib.pkg} v${want}` });
    }
    // Other libraries a tracked field names ("openvibe-contracts v0.214.0, openvibe-sdk v0.65.0, …" in one field).
    for (const field of LIBS.filter((l) => l.field).map((l) => l.field)) {
        if (typeof status[field] !== 'string') continue;
        for (const [, name, have] of status[field].matchAll(/\b(openvibe-[a-z]+) v(\d+\.\d+\.\d+)/g)) {
            if (pins[name] && pins[name] !== have && !(byPackage.get(name) && byPackage.get(name).field === field)) {
                out.push({ ok: false, file: 'STATUS.json', field, reason: `pins ${name} v${pins[name]} but STATUS.json ${field} names v${have}` });
            }
        }
    }
    return out;
}

/** The README versions block's inner text for the current pins. */
function versionsInner(pins) {
    return LIBS.filter((l) => pins[l.pkg]).map((l) => `- ${l.pkg}: v${pins[l.pkg]}`).join('\n');
}

/** The whole delimited block. */
function versionsBlock(pins) {
    return `${START}\n${versionsInner(pins)}\n${END}`;
}

/** Indexes of the markers in a README, or null when the block is absent. */
function blockSpan(readme) {
    const s = readme.indexOf(START);
    const e = readme.indexOf(END);
    return s !== -1 && e > s ? { s, e } : null;
}

/** Add, replace or (with no pins) remove the versions block; every other byte is kept. */
function applyBlock(readme, pins) {
    const span = blockSpan(readme);
    const block = Object.keys(pins).length ? versionsBlock(pins) : null;
    if (!block) {
        if (!span) return readme;
        const before = readme.slice(0, span.s).replace(/\s+$/, '');
        const after = readme.slice(span.e + END.length).replace(/^\s+/, '');
        return after ? `${before}\n\n${after}` : `${before}\n`;
    }
    if (span) return readme.slice(0, span.s) + block + readme.slice(span.e + END.length);
    return `${readme.replace(/\s*$/, '')}\n\n${block}\n`;
}

/** README findings for the pinned releases. */
function readmeFindings(readme, pins) {
    const wanted = LIBS.filter((l) => pins[l.pkg]);
    if (!wanted.length) return [];
    const span = blockSpan(readme);
    if (!span) return [{ ok: false, file: 'README.md', field: 'versions', reason: `is missing the ${START} / ${END} block (run without --check to append it)` }];
    const body = readme.slice(span.s, span.e + END.length);
    const missing = wanted.filter((l) => !new RegExp(`${escapeRe(l.pkg)}\\s*:\\s*v?${escapeRe(pins[l.pkg])}`).test(body));
    if (missing.length) return [{ ok: false, file: 'README.md', field: 'versions', reason: `block is stale for ${missing.map((l) => l.pkg).join(', ')}` }];
    return [{ ok: true, file: 'README.md', field: 'versions', reason: `${wanted.length} pinned release(s)` }];
}

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Read the two documents and report drift; writes nothing. */
function inspect(dir = '.') {
    const pins = pinsFor(dir);
    const statusPath = path.join(dir, 'STATUS.json');
    const readmePath = path.join(dir, 'README.md');
    const status = fs.existsSync(statusPath) ? readJson(statusPath) : null;
    const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : null;
    const findings = [];
    if (status) findings.push(...statusFindings(status, pins));
    else if (Object.keys(pins).length) findings.push({ ok: false, file: 'STATUS.json', field: '-', reason: 'does not exist but the repository pins openvibe-* libraries' });
    if (readme !== null) findings.push(...readmeFindings(readme, pins));
    return { pins, status, readme, findings };
}

/** Rebuild STATUS.json's tracked fields in place: missing ones inserted beside the first tracked key. */
function withStatusFields(status, pins, today) {
    const tracked = LIBS.filter((l) => l.field).map((l) => l.field);
    const updates = {};
    for (const lib of LIBS) {
        if (lib.field && pins[lib.pkg] && !(status[lib.field] === undefined && namedElsewhere(status, lib))) {
            updates[lib.field] = statusValue(status[lib.field], lib.pkg, pins[lib.pkg]);
        }
    }
    for (const field of tracked) {
        const value = updates[field] !== undefined ? updates[field] : status[field];
        if (typeof value === 'string') updates[field] = withNamedPins(value, pins);
    }
    for (const field of tracked) if (status[field] === undefined && updates[field] === undefined) delete updates[field];
    const out = {};
    let placed = false;
    for (const [key, value] of Object.entries(status)) {
        if (key === 'updated') continue;
        if (tracked.includes(key)) {
            if (!placed) { for (const f of tracked) if (updates[f] !== undefined) out[f] = updates[f]; placed = true; }
            out[key] = updates[key] !== undefined ? updates[key] : value;
            continue;
        }
        out[key] = value;
    }
    if (!placed) for (const f of tracked) if (updates[f] !== undefined) out[f] = updates[f];
    // A `packages` list ("openvibe-shared v2.15.0", …) names the pins too: each entry of a pinned library follows it
    // (Wiki#19 failed its status-pins check on a stale entry the fields above had already moved past).
    if (Array.isArray(status.packages)) {
        out.packages = status.packages.map((entry) => {
            const m = /^(openvibe-[a-z]+) v\d+\.\d+\.\d+/.exec(String(entry));
            return m && pins[m[1]] ? statusValue(entry, m[1], pins[m[1]]) : entry;
        });
    }
    // `updated` moves only when a tracked field really changed, so a rerun with no pin change writes nothing.
    const changed = tracked.some((f) => out[f] !== status[f]) || JSON.stringify(out.packages) !== JSON.stringify(status.packages);
    out.updated = changed || status.updated === undefined ? today : status.updated;
    return out;
}

/** Write the pins into STATUS.json and README.md; returns the files written. */
function update(dir = '.', { today = new Date().toISOString().slice(0, 10) } = {}) {
    const { pins, status, readme } = inspect(dir);
    const changed = [];
    const statusPath = path.join(dir, 'STATUS.json');
    if (status) {
        const next = JSON.stringify(withStatusFields(status, pins, today), null, 2) + '\n';
        const current = fs.readFileSync(statusPath, 'utf8');
        if (next !== current) { fs.writeFileSync(statusPath, next); changed.push('STATUS.json'); }
    }
    const readmePath = path.join(dir, 'README.md');
    if (readme !== null) {
        const next = applyBlock(readme, pins);
        if (next !== readme) { fs.writeFileSync(readmePath, next); changed.push('README.md'); }
    }
    return changed;
}

function main(dir = '.', { check = false } = {}) {
    if (check) return inspect(dir);
    const changed = update(dir);
    return { ...inspect(dir), changed };
}

module.exports = { LIBS, START, END, pinsIn, pinsFor, workspaceDirs, withNamedPins, statusValue, statusFindings, versionsInner, versionsBlock, applyBlock, readmeFindings, inspect, withStatusFields, update, main };

if (require.main === module || !module.parent) {
    const args = process.argv.slice(2);
    const check = args.includes('--check');
    const dir = args.find((a) => a !== '--check') || '.';
    const r = main(dir, { check });
    if (r.changed && r.changed.length) console.log(`docs-status: wrote ${r.changed.join(', ')}`);
    for (const f of r.findings) console.log(`${f.ok ? 'ok  ' : 'FAIL'} ${f.file} ${f.field}: ${f.reason}`);
    const bad = r.findings.filter((f) => !f.ok);
    console.log(bad.length ? `docs-status: ${bad.length} drifted` : 'docs-status: docs are current');
    process.exit(bad.length ? 1 : 0);
}
