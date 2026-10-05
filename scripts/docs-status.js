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

/** The root package.json's pins, or {} when it is absent or unreadable. */
function pinsFor(dir) {
    const file = path.join(dir, 'package.json');
    if (!fs.existsSync(file)) return {};
    try { return pinsIn(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return {}; }
}

/** The status value for a pin, keeping prose after the version: "openvibe-contracts v0.61.0 (devDependency…)". */
function statusValue(existing, name, version) {
    const fresh = `${name} v${version}`;
    if (typeof existing !== 'string' || !VERSION.test(existing)) return fresh;
    return existing.replace(VERSION, version);
}

/** STATUS.json findings for every tracked pin. */
function statusFindings(status, pins) {
    const out = [];
    for (const lib of LIBS) {
        if (!lib.field || !(lib.pkg in pins)) continue;
        const want = pins[lib.pkg];
        const existing = status[lib.field];
        if (typeof existing !== 'string' || !VERSION.test(existing)) {
            out.push({ ok: false, file: 'STATUS.json', field: lib.field, reason: `pins ${lib.pkg} v${want} but STATUS.json has no ${lib.field} version` });
            continue;
        }
        const have = VERSION.exec(existing)[1];
        if (have !== want) out.push({ ok: false, file: 'STATUS.json', field: lib.field, reason: `pins ${lib.pkg} v${want} but STATUS.json ${lib.field} says v${have}` });
        else out.push({ ok: true, file: 'STATUS.json', field: lib.field, reason: `${lib.pkg} v${want}` });
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
        if (lib.field && pins[lib.pkg]) updates[lib.field] = statusValue(status[lib.field], lib.pkg, pins[lib.pkg]);
    }
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
    // `updated` moves only when a tracked field really changed, so a rerun with no pin change writes nothing.
    const changed = tracked.some((f) => out[f] !== status[f]);
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

module.exports = { LIBS, START, END, pinsIn, pinsFor, statusValue, statusFindings, versionsInner, versionsBlock, applyBlock, readmeFindings, inspect, withStatusFields, update, main };

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
