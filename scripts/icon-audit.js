#!/usr/bin/env node
'use strict';
/**
 * Every icon name the network asks for, and whether it resolves (plan L32, I1). Reads each OpenVibers repository's
 * main (a local checkout under --root, or a shallow clone in --cache) and reports the names no glyph, Font Awesome
 * alias or brand draws:
 *
 *   fa-binoculars                 an <i class="fa-solid fa-binoculars">, an alias only FA knows
 *   kit.icon('compass')           the kit's own builder
 *   glyphs.svg('x') / path(…)     the Shared registry
 *   icon: 'x'                     a NAV row, a menu, a manifest field
 *
 * An icon a page names has to resolve somewhere: glyphs.path(name) for a glyph, glyphs.fromFa('fa-'+name) for a
 * Font Awesome name, brands.fromFa(name) for a brand logo. Anything else is a broken icon: it draws an empty <svg>
 * (or Font Awesome's missing glyph). Exit 1 when one is found, so a site can run it in CI from the Shared package:
 *
 *   node node_modules/openvibe-shared/scripts/icon-audit.js --root .
 *   node scripts/icon-audit.js                 every OpenVibers repo from the local checkouts
 *   node scripts/icon-audit.js --clone         shallow-clone the ones no local checkout has
 *   node scripts/icon-audit.js --repos OpenVibe.Exchange,OpenVibe.Network --json out.json
 *
 * Tests and fixtures are skipped: they name icons on purpose to prove an unknown one is left alone. Generated
 * files, lockfiles and vendored code are skipped too. Nothing is written outside --json/--cache.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const glyphs = require(path.join(ROOT, 'glyphs'));
let brands = null;
try { brands = require(path.join(ROOT, 'brands')); } catch { brands = null; }
const brand = (name) => !!(brands && brands.fromFa && brands.fromFa(name));
// Site marks are their own registry (openvibe-shared/ov-icons.js): "pics", "homes" and "quests" are sites, not glyphs.
const siteIcons = require(path.join(ROOT, 'ov-icons.js'));
const siteFallback = siteIcons.resolve('zz-not-an-icon');
const site = (name) => siteIcons.resolve(name) !== siteFallback;

// Font Awesome's own class names (weights, sizes, animation, layout): not icons.
const CLASS_WORDS = new Set(('solid regular light thin duotone brands sharp fw ul li border inverse stack layers layers-text ' +
    'layers-counter pull-left pull-right spin pulse spin-pulse beat beat-fade bounce fade flip shake ' +
    '2xs xs sm lg xl 2xl 1x 2x 3x 4x 5x 6x 7x 8x 9x 10x rotate-90 rotate-180 rotate-270 rotate-by ' +
    'flip-horizontal flip-vertical flip-both').split(' '));
const TEXT_EXT = /\.(?:js|mjs|cjs|jsx|ts|tsx|json|ya?ml|html?|hbs|ejs|njk|pug|vue|svelte|php|rb|py|go|rs|java|kt|swift|cs)$/i;
const SKIP = /(^|\/)(?:node_modules|vendor|third[-_]?party|dist|build|coverage|\.git)(\/|$)|(?:^|\/)(?:test|tests|__tests__|spec|fixtures?|examples?)\/|\.min\.(?:js|css)$|\.(?:map|lock)$|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$/i;
// The files that define the registry, its fonts and this audit: their fa-* names are data, not a page asking for an icon.
const DEFINES = /(^|\/)(?:glyphs|brands|ov-glyphs[^/]*|fa-usage|glyph-codepoints)(\.|\/|$)|(^|\/)scripts\/(?:build-nav-icons\.py|icon-audit\.js)$/i;
// An `icon:` field is a shared glyph name in a NAV, a menu or a manifest (the site marks are resolved below); other
// files have their own icon functions and vocabularies, so their fields are not this registry's.
const NAMED_FIELD = /(nav|menu|manifest|sites|layout|products)\.(?:js|json|ts|tsx|ya?ml)$|(^|\/)[^/]+\.(?:json|ya?ml)$/i;

function arg(name, fallback = null) {
    const i = process.argv.indexOf(`--${name}`);
    if (i < 0) return fallback;
    const v = process.argv[i + 1];
    return v && !v.startsWith('--') ? v : true;
}

function repositories(root) {
    // A site's CI: --root . is the repository itself, so audit that one checkout.
    if (fs.existsSync(path.join(root, '.git'))) return [{ name: path.basename(root), branch: 'main', dir: root }];
    const only = arg('repos');
    if (only && only !== true) return String(only).split(',').map((s) => s.trim()).filter(Boolean);
    try {
        const out = execFileSync('gh', ['repo', 'list', 'OpenVibers', '--limit', '300', '--json', 'name,defaultBranchRef'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        const list = JSON.parse(out).map((r) => ({ name: r.name, branch: (r.defaultBranchRef && r.defaultBranchRef.name) || 'main' }));
        if (list.length) return list;
    } catch { /* no gh, or no network: read what --root has */ }
    return fs.existsSync(root)
        ? fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && /^OpenVibe/i.test(d.name) && fs.existsSync(path.join(root, d.name, '.git'))).map((d) => ({ name: d.name, branch: 'main' }))
        : [];
}

/** The `git grep` pattern: every way a page names an icon, in one pass per repository. */
const PATTERN = String.raw`fa-[a-z0-9-]+|kit\.icon\(|glyphs\.(path|solid|svg|inner)\(|icon:[[:space:]]*['"]`;

/** Does this repository's main load Font Awesome? Then a valid FA name draws there; the drop-in leaves it to FA. */
function loadsFontAwesome(repo, branch) {
    let out = spawnSync('git', ['-C', repo, 'grep', '-I', '-l', '-E', 'fontawesome|font-awesome', branch], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if (out.status > 1) out = spawnSync('git', ['-C', repo, 'grep', '-I', '-l', '-E', 'fontawesome|font-awesome', 'HEAD'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    return out.status === 0 && String(out.stdout || '').trim().length > 0;
}

function grep(repo, branch) {
    const ref = `${branch}`;
    const run = (refName) => spawnSync('git', ['-C', repo, 'grep', '-I', '-n', '-E', PATTERN, refName], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let out = run(ref);
    if (out.status > 1 && /unknown revision|bad revision|ambiguous argument/i.test(String(out.stderr || ''))) out = run('HEAD');
    if (out.status > 1) throw new Error(String(out.stderr || 'git grep failed').trim().slice(0, 300));
    return String(out.stdout || '');
}

function cloneInto(cache, name, branch) {
    fs.mkdirSync(cache, { recursive: true });
    const dir = path.join(cache, name);
    if (!fs.existsSync(path.join(dir, '.git'))) {
        const r = spawnSync('git', ['clone', '--depth', '1', '--single-branch', '--branch', branch, `https://github.com/OpenVibers/${name}.git`, dir], { encoding: 'utf8' });
        if (r.status !== 0) throw new Error(String(r.stderr || 'clone failed').trim().split('\n').slice(-1)[0]);
        return { dir, branch: 'HEAD' };
    }
    return { dir, branch: 'origin/HEAD' };
}

function linesOf(out, repoName) {
    const found = [];
    for (const line of out.split('\n')) {
        if (!line) continue;
        // git grep on a ref prefixes the ref: <ref>:<file>:<line>:<text>.
        const m = /^([^:]+):(.+?):(\d+):(.*)$/.exec(line);
        if (!m) continue;
        const [, , file, lineNo, text] = m;
        if (SKIP.test(file) || DEFINES.test(file) || !TEXT_EXT.test(file)) continue;
        found.push({ repo: repoName, file, line: Number(lineNo), text });
    }
    return found;
}

/** The names on one line, with how it named them. */
function namesOn(text, file) {
    const out = [];
    // --fa-animation-duration and data-fa-… are Font Awesome's own variables, not icon names; neither is a font file.
    for (const m of text.matchAll(/(?<![-\w.])fa-([a-z0-9-]+)/g)) {
        const name = m[1];
        if (!CLASS_WORDS.has(name) && /[a-z0-9]$/.test(name) && !/-\d{2,}$/.test(name)) out.push({ kind: 'fa', name });
    }
    for (const m of text.matchAll(/(?:kit|OpenVibeKit)\.icon\(\s*['"]([a-z0-9-]+)['"]/g)) out.push({ kind: 'kit.icon', name: m[1] });
    for (const m of text.matchAll(/glyphs\.(?:path|solid|svg|inner)\(\s*['"]([a-z0-9-]+)['"]/g)) out.push({ kind: 'glyphs', name: m[1] });
    if (NAMED_FIELD.test(file)) for (const m of text.matchAll(/\bicon:\s*(['"])([a-z0-9-]+)\1/g)) {
        out.push(m[2].startsWith('fa-') ? { kind: 'fa', name: m[2].slice(3) } : { kind: 'icon field', name: m[2] });
    }
    return out;
}

function resolves({ kind, name }, faPage = false) {
    if (kind === 'fa') return !!(faPage || glyphs.fromFa(`fa-${name}`) || brand(name));
    return !!(glyphs.path(name) || glyphs.fromFa(`fa-${name}`) || brand(name) || (kind === 'icon field' && site(name)));
}

function main() {
    const root = String(arg('root') || path.join(os.homedir(), 'openvibe', 'work'));
    const cache = String(arg('cache') || path.join(os.homedir(), '.cache', 'ov-icon-audit'));
    const json = arg('json');
    const doClone = arg('clone') === true || arg('clone') === '1';
    const repos = repositories(root);
    const unresolved = new Map();
    const read = [];
    const missing = [];
    let checked = 0;

    for (const entry of repos) {
        const name = typeof entry === 'string' ? entry : entry.name;
        const branch = (entry && entry.branch) || 'main';
        let dir = (entry && entry.dir) || path.join(root, name);
        let ref = branch;
        if (!fs.existsSync(path.join(dir, '.git'))) {
            if (!doClone) { missing.push(name); continue; }
            try { ({ dir, branch: ref } = cloneInto(cache, name, branch)); }
            catch (err) { missing.push(`${name} (${err.message})`); continue; }
        }
        let out, faPage = false;
        try { out = grep(dir, ref); faPage = loadsFontAwesome(dir, ref); } catch (err) { missing.push(`${name} (${err.message})`); continue; }
        read.push(name);
        const lines = linesOf(out, name);
        checked += lines.length;
        for (const l of lines) {
            for (const n of namesOn(l.text, l.file)) {
                if (resolves(n, faPage)) continue;
                const key = n.name;
                if (!unresolved.has(key)) unresolved.set(key, { name: n.name, kinds: new Set(), where: [] });
                const u = unresolved.get(key);
                u.kinds.add(n.kind);
                if (u.where.length < 12) u.where.push({ repo: l.repo, file: l.file, line: l.line, kind: n.kind });
            }
        }
    }

    const rows = [...unresolved.values()].sort((a, b) => b.where.length - a.where.length || (a.name < b.name ? -1 : 1));
    const byRepo = new Map();
    for (const u of rows) for (const w of u.where) byRepo.set(w.repo, (byRepo.get(w.repo) || 0) + 1);
    console.log(`icon audit: ${read.length}/${repos.length} repositories read${missing.length ? `, ${missing.length} missing${doClone ? '' : ' (use --clone)'}` : ''}; ${checked} icon-naming lines`);
    if (!rows.length) console.log('every icon name resolves');
    else {
        console.log(`${rows.length} unresolved icon name${rows.length === 1 ? '' : 's'} in ${byRepo.size} repositor${byRepo.size === 1 ? 'y' : 'ies'}:`);
        for (const u of rows) {
            console.log(`  ${u.name}  [${[...u.kinds].join(', ')}]`);
            for (const w of u.where.slice(0, 4)) console.log(`      ${w.repo}/${w.file}:${w.line} (${w.kind})`);
            if (u.where.length > 4) console.log(`      … ${u.where.length - 4} more`);
        }
    }
    if (missing.length) console.log(`skipped: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? `, and ${missing.length - 12} more` : ''}`);
    if (json && json !== true) {
        fs.writeFileSync(String(json), JSON.stringify({ read, missing, checked, unresolved: rows.map((u) => ({ name: u.name, kinds: [...u.kinds], where: u.where })) }, null, 2));
        console.log(`wrote ${json}`);
    }
    process.exit(rows.length ? 1 : 0);
}

main();
