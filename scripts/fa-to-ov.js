#!/usr/bin/env node
'use strict';
/**
 * scripts/fa-to-ov.js — rewrite a repository's Font Awesome icon markup into OpenVibe's own (4.231.0):
 *
 *   <i class="fa-solid fa-eye me-2"></i>   →  <i class="ovg-fill me-2" data-ov-icon="eye"></i>
 *   <i class="fa-brands fa-github"></i>    →  <i data-ov-brand="github"></i>
 *   <i class="fa-solid fa-spinner fa-spin">→  <i class="ovg-fill" data-ov-icon="busy">
 *
 * Only a static <i> or <span> start tag whose class names a Font Awesome icon the glyphs map is rewritten, in HTML
 * and in the markup strings of JS and templates, keeping the attribute's own quote. Everything else is listed for a
 * person, never guessed:
 *   dynamic   a class built at run time (${…}, {{…}}, <%…%>)
 *   manual    an animation, a stack, a list or a border (fa-beat, fa-stack, fa-ul …)
 *   unknown   a name the glyphs do not have (draw it in glyphs.js, or map it in glyphs.FA)
 *   brand     a logo brands.js does not have
 *   js-class  a Font Awesome class in a JS string that is not markup (className = 'fa-solid fa-eye', icon: 'fa-eye')
 *   css       a stylesheet rule that names a Font Awesome class
 *
 *   node node_modules/openvibe-shared/scripts/fa-to-ov.js [dir …]            what it would change, and the list
 *   node node_modules/openvibe-shared/scripts/fa-to-ov.js --write [dir …]    change the files
 *   … --json                                                                 the same as JSON
 *
 * Directories default to public, server, src, apps, views and templates under the current one; node_modules, vendor,
 * test, tests, .git and generated bundles are skipped. Running it twice changes nothing the second time.
 */
const fs = require('fs');
const path = require('path');
const glyphs = require('../glyphs');
const brands = require('../brands');

const EXT = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.ejs', '.hbs', '.njk', '.vue', '.svelte', '.css']);
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'test', 'tests', '.git', 'dist', 'build', 'coverage']);
const DEFAULT_DIRS = ['public', 'server', 'src', 'apps', 'views', 'templates'];
const TAG = /<(i|span)\b([^<>]*)>/g;
const CLASS_ATTR = /(\s)class=(["'])([^"'<>]*)\2/;
const FA_WORD = /(^|\s)(fa|fas|far|fab|fa-[a-z0-9-]+)(?=\s|$)/;
const DYNAMIC = /\$\{|\{\{|<%|\+\s*['"`]|['"`]\s*\+/;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** One file's text, rewritten: { text, changes: [{ line, from, to }], reports: [{ line, kind, what }] }. */
function rewrite(text, { css = false } = {}) {
    const changes = [];
    const reports = [];
    if (css) {
        const re = /\.(fa-[a-z0-9-]+|fa\b|fas\b|far\b|fab\b)/g;
        let m;
        const seen = new Set();
        while ((m = re.exec(text))) {
            const line = lineOf(text, m.index);
            if (seen.has(line)) continue;
            seen.add(line);
            reports.push({ line, kind: 'css', what: text.split('\n')[line - 1].trim().slice(0, 160) });
        }
        return { text, changes, reports };
    }
    const out = text.replace(TAG, (tag, name, attrs, offset) => {
        const cm = CLASS_ATTR.exec(attrs);
        if (!cm || !FA_WORD.test(cm[3])) {
            if (/class=/.test(attrs) && /\bfa-[a-z]/.test(attrs) && DYNAMIC.test(attrs)) reports.push({ line: lineOf(text, offset), kind: 'dynamic', what: tag.slice(0, 160) });
            return tag;
        }
        const line = lineOf(text, offset);
        if (/data-ov-(icon|brand)=/.test(attrs)) return tag;
        if (DYNAMIC.test(attrs)) { reports.push({ line, kind: 'dynamic', what: tag.slice(0, 160) }); return tag; }
        const r = glyphs.fromFaClasses(cm[3]);
        if (r.manual.length) { reports.push({ line, kind: 'manual', what: `${tag.slice(0, 120)} (${r.manual.join(' ')})` }); return tag; }
        let attr;
        if (r.brand) {
            const slug = brands.FA[r.brand] || (brands.BRANDS[r.brand] ? r.brand : null);
            if (!slug) { reports.push({ line, kind: 'brand', what: `fa-${r.brand}` }); return tag; }
            attr = `data-ov-brand=${cm[2]}${slug}${cm[2]}`;
        } else if (r.icon) {
            attr = `data-ov-icon=${cm[2]}${r.icon}${cm[2]}`;
        } else {
            reports.push({ line, kind: 'unknown', what: r.unknown || cm[3] });
            return tag;
        }
        const keep = r.brand ? r.cls.filter((c) => c !== 'ovg-fill') : r.cls;
        const cls = keep.length ? `${cm[1]}class=${cm[2]}${keep.join(' ')}${cm[2]} ${attr}` : `${cm[1]}${attr}`;
        const next = `<${name}${attrs.replace(cm[0], cls)}>`;
        changes.push({ line, from: tag, to: next });
        return next;
    });
    // Font Awesome classes left in JS strings that are not markup (className, classList, icon: 'fa-…').
    const re = /(['"`])((?:fa|fas|far|fab|fa-[a-z0-9-]+)(?:\s+[a-z0-9-]+)*)\1/g;
    let m;
    while ((m = re.exec(out))) {
        if (!/\bfa-[a-z0-9]/.test(m[2])) continue;
        const before = out.slice(Math.max(0, m.index - 1), m.index);
        if (before === '=') continue;   // an attribute value inside markup: handled (or reported) above
        reports.push({ line: lineOf(out, m.index), kind: 'js-class', what: m[0].slice(0, 120) });
    }
    return { text: out, changes, reports };
}

function walk(dir, files) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
    for (const e of entries) {
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name), files); continue; }
        if (!e.isFile() || !EXT.has(path.extname(e.name))) continue;
        if (/\.min\.(js|css)$|\.bundle\.js$/.test(e.name)) continue;
        files.push(path.join(dir, e.name));
    }
    return files;
}

function run(argv) {
    const write = argv.includes('--write');
    const json = argv.includes('--json');
    const dirs = argv.filter((a) => !a.startsWith('--'));
    const roots = (dirs.length ? dirs : DEFAULT_DIRS).filter((d) => fs.existsSync(d));
    const result = { changed: 0, files: [], reports: [] };
    for (const file of roots.flatMap((d) => walk(d, []))) {
        const text = fs.readFileSync(file, 'utf8');
        if (!/\bfa[sbr]?\b|fa-[a-z]/.test(text)) continue;
        const r = rewrite(text, { css: path.extname(file) === '.css' });
        for (const rep of r.reports) result.reports.push({ file, ...rep });
        if (!r.changes.length) continue;
        result.changed += r.changes.length;
        result.files.push({ file, changes: r.changes.length });
        if (write) fs.writeFileSync(file, r.text);
    }
    if (json) { console.log(JSON.stringify(result, null, 1)); return result; }
    console.log(`${write ? 'rewrote' : 'would rewrite'} ${result.changed} icons in ${result.files.length} files`);
    for (const f of result.files) console.log(`  ${f.file}: ${f.changes}`);
    const kinds = {};
    for (const r of result.reports) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
    console.log(`for a person: ${result.reports.length}${Object.keys(kinds).length ? ` (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}`);
    for (const r of result.reports) console.log(`  ${r.file}:${r.line} ${r.kind}: ${r.what}`);
    return result;
}

if (require.main === module) run(process.argv.slice(2));
module.exports = { rewrite, run };
