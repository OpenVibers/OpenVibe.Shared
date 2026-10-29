/**
 * openvibe-shared/tokens.js — OpenVibe Tokens: a theme as a platform-neutral design-token document, and the compilers
 * that turn it into code for the web, Android, iOS, Flutter and Figma.
 *
 * The owner, 2026-10-29: "do everything in a way structure and modular so we can translate it to official and optimized
 * Android and iOS apps in the future that aren't just web browser reskin kiosks." A theme on the network is a map of CSS
 * custom properties (--bg-primary, --accent…). Here it becomes a W3C Design Tokens (DTCG) document of semantic tokens
 * (color.bg.base, color.text.primary, color.accent.base…, plus the kit's radius, space, size, type and motion scales),
 * and that one document compiles to every platform:
 *
 *   const tokens = require('openvibe-shared/tokens');
 *   const doc = tokens.fromTheme(theme)            theme: { name, slug, mode, variables } (builtin-themes, the studio)
 *   tokens.toTheme(doc)                             → { name, slug, mode, variables } (round trip, CSS names)
 *   tokens.flatten(doc)                             → [{ path: ['color', 'bg', 'base'], type: 'color', value }]
 *   tokens.compile(doc | [dark, light], target)     → source text; target: css | tailwind | compose | swiftui | flutter
 *                                                     | figma | json (tokens.TARGETS: label, file name, language)
 *
 * Compose gets an `object <Name>Tokens` and a Material 3 `darkColorScheme`/`lightColorScheme`; SwiftUI an `enum` of
 * `Color`s and sizes with its `ColorScheme`; Flutter a `ColorScheme` and constants; Figma a variables collection with a
 * mode per document. Pass a theme's dark and light halves together to get both schemes in one file.
 *
 * Values are validated, never passed through: a colour is #rgb/#rrggbb/#rrggbbaa or rgb()/rgba(), a shadow is offsets,
 * blur, spread and such a colour; anything else is dropped. Names become identifiers of letters and digits only. So a
 * theme someone wrote in the studio can never inject code into the Kotlin, Swift or Dart a developer pastes. Pure: no
 * I/O. Runs in Node and in the browser (window.OpenVibeTokens).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeTokens = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const VERSION = 1;

    // ── The network's CSS names → semantic token paths ──
    // [css name, path, $type, description]. Order is the document's order.
    const COLOR_MAP = [
        ['--bg-primary', 'color.bg.base', 'The page behind everything'],
        ['--bg-secondary', 'color.bg.surface', 'Bands and side panels'],
        ['--bg-tertiary', 'color.bg.subtle', 'Wells, tracks and quiet fills'],
        ['--bg-card', 'color.bg.raised', 'Cards, rows and sheets'],
        ['--bg-hover', 'color.bg.hover', 'A control under the pointer or finger'],
        ['--bg-input', 'color.bg.input', 'Text fields'],
        ['--text-primary', 'color.text.primary', 'Body text and titles'],
        ['--text-secondary', 'color.text.secondary', 'Supporting text'],
        ['--text-muted', 'color.text.muted', 'Hints and meta lines'],
        ['--accent', 'color.accent.base', 'Links, icons, focus rings'],
        ['--accent-light', 'color.accent.light', 'The accent a step lighter'],
        ['--accent-dark', 'color.accent.dark', 'The accent a step darker'],
        ['--accent-strong', 'color.accent.strong', 'Filled buttons'],
        ['--on-accent', 'color.accent.on', 'Text on the accent'],
        ['--on-accent-strong', 'color.accent.onStrong', 'Text on a filled button'],
        ['--accent-glow', 'color.accent.glow', 'Glows and halos'],
        ['--border', 'color.line.base', 'Dividers and outlines'],
        ['--border-light', 'color.line.strong', 'Outlines that must show'],
        ['--success', 'color.status.ok.base', 'Success fills'],
        ['--success-text', 'color.status.ok.text', 'Success text on any surface'],
        ['--warning', 'color.status.warn.base', 'Warning fills'],
        ['--warning-text', 'color.status.warn.text', 'Warning text on any surface'],
        ['--danger', 'color.status.bad.base', 'Danger fills'],
        ['--danger-text', 'color.status.bad.text', 'Danger text on any surface'],
        ['--info', 'color.status.info.base', 'Information fills'],
        ['--info-text', 'color.status.info.text', 'Information text on any surface'],
        ['--live-red', 'color.status.live.base', 'LIVE badges'],
        ['--live-red-text', 'color.status.live.text', 'LIVE text on any surface'],
    ];
    const SHADOW_MAP = [
        ['--shadow', 'shadow.base', 'Cards and menus'],
        ['--shadow-lg', 'shadow.large', 'Dialogs and sheets'],
    ];
    // Defaults for status colours a theme leaves out (as builtin-themes' STATUS_DEFAULTS).
    const STATUS_DEFAULTS = { '--success': '#22c55e', '--warning': '#f59e0b', '--danger': '#ef4444', '--info': '#38bdf8', '--live-red': '#ef4444' };

    // ── The kit's scales: the same on every theme (kit.css and room.css use these numbers) ──
    const SCALES = {
        radius: { $type: 'dimension', sm: 10, md: 14, lg: 20, pill: 999 },
        space: { $type: 'dimension', xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
        size: { $type: 'dimension', tap: 44, icon: 20, avatar: 34 },
        type: {
            family: { $type: 'fontFamily', base: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'], mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'] },
            size: { $type: 'dimension', caption: 12, meta: 13, body: 15, lead: 17, title: 20, headline: 24, display: 34 },
            weight: { $type: 'fontWeight', regular: 400, medium: 600, bold: 700, heavy: 800 },
        },
        motion: {
            duration: { $type: 'duration', fast: 150, base: 250, slow: 400 },
            easing: { $type: 'cubicBezier', standard: [0.2, 0.7, 0.2, 1] },
        },
    };

    // ── Values: parse strictly, never pass through ──
    function parseColor(v) {
        const s = String(v == null ? '' : v).trim().toLowerCase();
        let m = /^#([0-9a-f]{3})$/.exec(s);
        if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
        m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
        if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: m[2] ? Math.round(parseInt(m[2], 16) / 255 * 1000) / 1000 : 1 };
        m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+|1\.0+))?\s*\)$/.exec(s);
        if (m) {
            const [r, g, b] = [m[1], m[2], m[3]].map(Number);
            if (r > 255 || g > 255 || b > 255) return null;
            return { r, g, b, a: m[4] == null ? 1 : Number(m[4]) };
        }
        return null;
    }
    const hex2 = (n) => n.toString(16).padStart(2, '0');
    const toHex = (c) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a < 1 ? hex2(Math.round(c.a * 255)) : ''}`;
    const toCssColor = (c) => (c.a < 1 ? `rgba(${c.r},${c.g},${c.b},${c.a})` : toHex(c));

    /** "0 2px 12px rgba(0,0,0,0.45)" → { offsetX, offsetY, blur, spread, color } (px numbers), or null. */
    function parseShadow(v) {
        const s = String(v == null ? '' : v).trim();
        const m = /^(-?\d+(?:\.\d+)?)(?:px)?\s+(-?\d+(?:\.\d+)?)(?:px)?\s+(\d+(?:\.\d+)?)(?:px)?(?:\s+(-?\d+(?:\.\d+)?)(?:px)?)?\s+(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))$/.exec(s);
        if (!m) return null;
        const color = parseColor(m[5]);
        if (!color) return null;
        return { offsetX: Number(m[1]), offsetY: Number(m[2]), blur: Number(m[3]), spread: Number(m[4] || 0), color };
    }
    const shadowCss = (sh) => `${sh.offsetX}px ${sh.offsetY}px ${sh.blur}px${sh.spread ? ` ${sh.spread}px` : ''} ${toCssColor(sh.color)}`;

    // A name as an identifier: letters and digits, PascalCase, never empty, never starting with a digit.
    function ident(name, fallback = 'Theme') {
        const words = String(name || '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
        let id = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
        if (!id) id = fallback;
        if (/^\d/.test(id)) id = `T${id}`;
        return id.slice(0, 48);
    }
    // Text for a comment: one line, no comment terminators.
    const commentText = (s) => String(s || '').replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\*\//g, '* /').replace(/[^\x20-\x7e -￿]/g, '').slice(0, 160);
    const slugOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'theme';

    function setPath(obj, path, leaf) {
        const parts = path.split('.');
        let o = obj;
        for (const p of parts.slice(0, -1)) o = o[p] || (o[p] = {});
        o[parts[parts.length - 1]] = leaf;
    }
    function getPath(obj, path) {
        let o = obj;
        for (const p of path.split('.')) { if (!o || typeof o !== 'object') return undefined; o = o[p]; }
        return o;
    }

    // ── Theme ⇄ document ──
    /** A theme ({ name, slug, mode, variables, description }) as a DTCG token document. Unknown or invalid values are left out. */
    function fromTheme(theme = {}) {
        const vars = { ...STATUS_DEFAULTS, ...((theme && theme.variables) || {}) };
        const mode = theme && theme.mode === 'light' ? 'light' : 'dark';
        const doc = {
            $description: commentText(theme.description || `${theme.name || 'A theme'} (${mode})`),
            $extensions: { 'network.openvibe': { name: commentText(theme.name || 'Theme'), slug: slugOf(theme.slug || theme.name), mode, tokensVersion: VERSION } },
        };
        for (const [css, path, description] of COLOR_MAP) {
            const c = parseColor(vars[css]);
            if (c) setPath(doc, path, { $type: 'color', $value: toCssColor(c), $description: description });
        }
        for (const [css, path, description] of SHADOW_MAP) {
            const sh = parseShadow(vars[css]);
            if (sh) setPath(doc, path, { $type: 'shadow', $value: { color: toCssColor(sh.color), offsetX: `${sh.offsetX}px`, offsetY: `${sh.offsetY}px`, blur: `${sh.blur}px`, spread: `${sh.spread}px` }, $description: description });
        }
        for (const [group, def] of Object.entries(SCALES)) addScale(doc, group, def);
        return doc;
    }
    function addScale(doc, path, def) {
        const type = def.$type;
        for (const [k, v] of Object.entries(def)) {
            if (k === '$type') continue;
            const p = `${path}.${k}`;
            if (type) setPath(doc, p, { $type: type, $value: type === 'dimension' ? `${v}px` : type === 'duration' ? `${v}ms` : v });
            else addScale(doc, p, v);
        }
    }

    /** A document back to the network's CSS names: { name, slug, mode, variables }. */
    function toTheme(doc = {}) {
        const meta = (doc.$extensions && doc.$extensions['network.openvibe']) || {};
        const variables = {};
        for (const [css, path] of COLOR_MAP) {
            const t = getPath(doc, path);
            const c = t && parseColor(t.$value);
            if (c) variables[css] = toCssColor(c);
        }
        for (const [css, path] of SHADOW_MAP) {
            const t = getPath(doc, path);
            const sh = t && t.$value && shadowOf(t.$value);
            if (sh) variables[css] = shadowCss(sh);
        }
        const mode = meta.mode === 'light' ? 'light' : 'dark';
        variables['--color-scheme'] = mode;
        const accent = variables['--accent'] && parseColor(variables['--accent']);
        if (accent) variables['--accent-rgb'] = `${accent.r},${accent.g},${accent.b}`;
        return { name: meta.name || 'Theme', slug: slugOf(meta.slug || meta.name), mode, variables };
    }
    function shadowOf(v) {
        const px = (x) => { const m = /^(-?\d+(?:\.\d+)?)px$/.exec(String(x)); return m ? Number(m[1]) : NaN; };
        const color = parseColor(v.color);
        const sh = { offsetX: px(v.offsetX), offsetY: px(v.offsetY), blur: px(v.blur), spread: px(v.spread || '0px'), color };
        return color && [sh.offsetX, sh.offsetY, sh.blur, sh.spread].every(Number.isFinite) ? sh : null;
    }

    /** Every token as { path: [...], type, value, description }, in document order. */
    function flatten(doc) {
        const out = [];
        (function walk(o, path, inherited) {
            for (const [k, v] of Object.entries(o || {})) {
                if (k.startsWith('$') || !v || typeof v !== 'object') continue;
                const type = v.$type || inherited;
                if ('$value' in v) out.push({ path: path.concat(k), type, value: v.$value, description: v.$description || '' });
                else walk(v, path.concat(k), type);
            }
        })(doc, [], null);
        return out;
    }

    // ── Compilers ──
    const metaOf = (doc) => (doc && doc.$extensions && doc.$extensions['network.openvibe']) || { name: 'Theme', slug: 'theme', mode: 'dark' };
    const camel = (path) => path.map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p)).join('').replace(/[^A-Za-z0-9]/g, '');
    const pascal = (path) => { const c = camel(path); return c[0].toUpperCase() + c.slice(1); };
    const kebab = (path) => path.map((p) => p.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()).join('-');
    const num = (v) => { const m = /^(-?\d+(?:\.\d+)?)(px|ms)?$/.exec(String(v)); return m ? Number(m[1]) : null; };
    const header = (doc, lang) => {
        const m = metaOf(doc);
        const line = `${commentText(m.name)} (${m.mode}) — generated by openvibe-shared/tokens v${VERSION} from the OpenVibe theme "${m.slug}". Regenerate instead of editing.`;
        return lang === 'swift' || lang === 'kotlin' || lang === 'dart' || lang === 'js' ? `// ${line}` : `/* ${line} */`;
    };
    const docsOf = (input) => (Array.isArray(input) ? input : [input]).filter(Boolean).slice(0, 2);
    const colorTokens = (doc) => flatten(doc).filter((t) => t.type === 'color').map((t) => ({ ...t, c: parseColor(t.value) })).filter((t) => t.c);

    function css(input, { selector = ':root', aliases = true } = {}) {
        const out = [];
        for (const doc of docsOf(input)) {
            const m = metaOf(doc);
            const sel = docsOf(input).length > 1 ? `${selector}[data-theme-mode="${m.mode}"]` : selector;
            const lines = [];
            for (const t of flatten(doc)) {
                const name = `--ov-${kebab(t.path)}`;
                let v = null;
                if (t.type === 'color') { const c = parseColor(t.value); v = c && toCssColor(c); }
                else if (t.type === 'shadow') { const sh = shadowOf(t.value || {}); v = sh && shadowCss(sh); }
                else if (t.type === 'dimension' || t.type === 'duration') { const n = num(t.value); v = n == null ? null : `${n}${t.type === 'duration' ? 'ms' : 'px'}`; }
                else if (t.type === 'fontWeight') v = Number.isFinite(Number(t.value)) ? String(Number(t.value)) : null;
                else if (t.type === 'fontFamily') v = (Array.isArray(t.value) ? t.value : [t.value]).map((f) => (/^[A-Za-z0-9 -]+$/.test(f) ? (/\s/.test(f) ? `'${f}'` : f) : null)).filter(Boolean).join(', ') || null;
                else if (t.type === 'cubicBezier') v = Array.isArray(t.value) && t.value.length === 4 && t.value.every((x) => Number.isFinite(Number(x))) ? `cubic-bezier(${t.value.map(Number).join(', ')})` : null;
                if (v) lines.push(`    ${name}: ${v};`);
            }
            if (aliases) {
                lines.push('    /* The network\'s own names, for code written against them. */');
                for (const [cssName, path] of COLOR_MAP.concat(SHADOW_MAP)) if (getPath(doc, path)) lines.push(`    ${cssName}: var(--ov-${kebab(path.split('.'))});`);
                lines.push(`    color-scheme: ${m.mode === 'light' ? 'light' : 'dark'};`);
            }
            out.push(`${sel} {\n${lines.join('\n')}\n}`);
        }
        return `${header(docsOf(input)[0], 'css')}\n${out.join('\n\n')}\n`;
    }

    function tailwind(input) {
        const doc = docsOf(input)[0];
        const colors = {};
        for (const t of colorTokens(doc).filter((x) => x.path[0] === 'color')) setPath(colors, t.path.slice(1).join('.'), `var(--ov-${kebab(t.path)})`);
        const dim = (group) => Object.fromEntries(flatten(doc).filter((t) => t.path[0] === group).map((t) => [t.path.slice(1).join('-'), `var(--ov-${kebab(t.path)})`]));
        const config = { theme: { extend: { colors, borderRadius: dim('radius'), spacing: dim('space'), boxShadow: { DEFAULT: 'var(--ov-shadow-base)', lg: 'var(--ov-shadow-large)' } } } };
        return `${header(doc, 'js')}\n// Pair it with the CSS export (the variables), so a light/dark switch needs no rebuild.\nmodule.exports = ${JSON.stringify(config, null, 4)};\n`;
    }

    // Kotlin / Dart: 0xAARRGGBB.
    const argb = (c) => `0x${hex2(Math.round(c.a * 255)).toUpperCase()}${[c.r, c.g, c.b].map((n) => hex2(n).toUpperCase()).join('')}`;
    const pick = (doc, path) => { const t = getPath(doc, path); return t && parseColor(t.$value); };
    // Material 3 roles from the semantic tokens (Compose and Flutter share it).
    const M3_ROLES = [
        ['primary', 'color.accent.base'], ['onPrimary', 'color.accent.on'],
        ['primaryContainer', 'color.accent.strong'], ['onPrimaryContainer', 'color.accent.onStrong'],
        ['secondary', 'color.accent.light'], ['onSecondary', 'color.accent.on'],
        ['tertiary', 'color.status.info.base'],
        ['background', 'color.bg.base'], ['onBackground', 'color.text.primary'],
        ['surface', 'color.bg.raised'], ['onSurface', 'color.text.primary'],
        ['surfaceVariant', 'color.bg.surface'], ['onSurfaceVariant', 'color.text.secondary'],
        ['outline', 'color.line.strong'], ['outlineVariant', 'color.line.base'],
        ['error', 'color.status.bad.base'], ['onError', 'color.accent.onStrong'],
    ];

    function compose(input, { pkg = 'network.openvibe.theme' } = {}) {
        const docs = docsOf(input);
        const name = ident(metaOf(docs[0]).name);
        const safePkg = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(pkg) ? pkg : 'network.openvibe.theme';
        const parts = [`${header(docs[0], 'kotlin')}`, `package ${safePkg}`, '',
            'import androidx.compose.material3.ColorScheme', 'import androidx.compose.material3.darkColorScheme', 'import androidx.compose.material3.lightColorScheme',
            'import androidx.compose.ui.graphics.Color', 'import androidx.compose.ui.unit.dp', 'import androidx.compose.ui.unit.sp', ''];
        for (const doc of docs) {
            const m = metaOf(doc);
            const obj = `${name}${docs.length > 1 ? (m.mode === 'light' ? 'Light' : 'Dark') : ''}Tokens`;
            parts.push(`/** ${commentText(doc.$description)} */`, `object ${obj} {`);
            for (const t of colorTokens(doc)) parts.push(`    val ${pascal(t.path)} = Color(${argb(t.c)})`);
            parts.push('}', '');
            const fn = m.mode === 'light' ? 'lightColorScheme' : 'darkColorScheme';
            const roles = M3_ROLES.filter(([, path]) => pick(doc, path)).map(([role, path]) => `    ${role} = ${obj}.${pascal(path.split('.'))},`);
            parts.push(`/** Material 3 roles: MaterialTheme(colorScheme = ${name}${m.mode === 'light' ? 'Light' : 'Dark'}ColorScheme) { … } */`, `val ${name}${m.mode === 'light' ? 'Light' : 'Dark'}ColorScheme: ColorScheme = ${fn}(`, ...roles, ')', '');
        }
        // The kit's scales: the same on every theme (openvibe-shared/components' reference views use OvScale).
        parts.push('/** The OpenVibe kit\'s radius, space, size, type and motion scales: the same in every theme. */', 'object OvScale {');
        for (const t of flatten(docs[0]).filter((x) => x.type === 'dimension')) {
            const n = num(t.value);
            if (n != null) parts.push(`    val ${pascal(t.path)} = ${n}.${t.path[0] === 'type' ? 'sp' : 'dp'}`);
        }
        for (const t of flatten(docs[0]).filter((x) => x.type === 'duration' || x.type === 'fontWeight')) {
            const n = num(t.value);
            if (n != null) parts.push(`    const val ${pascal(t.path)} = ${Math.round(n)}`);
        }
        parts.push('}', '');
        return parts.join('\n');
    }

    function swiftui(input) {
        const docs = docsOf(input);
        const name = ident(metaOf(docs[0]).name);
        const f = (x) => (Math.round(x / 255 * 1000) / 1000).toString();
        const parts = [header(docs[0], 'swift'), 'import SwiftUI', ''];
        for (const doc of docs) {
            const m = metaOf(doc);
            const en = `${name}${docs.length > 1 ? (m.mode === 'light' ? 'Light' : 'Dark') : ''}Tokens`;
            parts.push(`/// ${commentText(doc.$description)}`, `public enum ${en} {`, `    public static let colorScheme: ColorScheme = .${m.mode === 'light' ? 'light' : 'dark'}`);
            for (const t of colorTokens(doc)) parts.push(`    public static let ${camel(t.path)} = Color(.sRGB, red: ${f(t.c.r)}, green: ${f(t.c.g)}, blue: ${f(t.c.b)}, opacity: ${t.c.a})`);
            parts.push('}', '');
        }
        parts.push('/// The OpenVibe kit\'s radius, space, size, type and motion scales: the same in every theme.', 'public enum OvScale {');
        for (const t of flatten(docs[0]).filter((x) => x.type === 'dimension')) {
            const n = num(t.value);
            if (n != null) parts.push(`    public static let ${camel(t.path)}: CGFloat = ${n}`);
        }
        for (const t of flatten(docs[0]).filter((x) => x.type === 'duration')) {
            const n = num(t.value);
            if (n != null) parts.push(`    public static let ${camel(t.path)}: Double = ${n / 1000}`);
        }
        parts.push('}', '');
        return parts.join('\n');
    }

    function flutter(input) {
        const docs = docsOf(input);
        const name = ident(metaOf(docs[0]).name);
        const parts = [header(docs[0], 'dart'), "import 'package:flutter/material.dart';", ''];
        for (const doc of docs) {
            const m = metaOf(doc);
            const cls = `${name}${docs.length > 1 ? (m.mode === 'light' ? 'Light' : 'Dark') : ''}Tokens`;
            parts.push(`/// ${commentText(doc.$description)}`, `class ${cls} {`, `  ${cls}._();`);
            for (const t of colorTokens(doc)) parts.push(`  static const ${camel(t.path)} = Color(${argb(t.c)});`);
            parts.push('}', '');
            const roles = M3_ROLES.filter(([role, path]) => pick(doc, path) && role !== 'surfaceVariant').map(([role, path]) => `  ${role}: ${cls}.${camel(path.split('.'))},`);
            parts.push(`const ${name[0].toLowerCase() + name.slice(1)}${m.mode === 'light' ? 'Light' : 'Dark'}Scheme = ColorScheme(`, `  brightness: Brightness.${m.mode === 'light' ? 'light' : 'dark'},`, ...roles, ');', '');
        }
        parts.push('/// The OpenVibe kit\'s radius, space, size and type scales: the same in every theme.', 'class OvScale {', '  OvScale._();');
        for (const t of flatten(docs[0]).filter((x) => x.type === 'dimension')) { const n = num(t.value); if (n != null) parts.push(`  static const double ${camel(t.path)} = ${n};`); }
        parts.push('}', '');
        return parts.join('\n');
    }

    function figma(input) {
        const docs = docsOf(input);
        const meta = metaOf(docs[0]);
        const modes = docs.map((d) => metaOf(d).mode);
        const byPath = new Map();
        docs.forEach((doc, i) => {
            for (const t of flatten(doc)) {
                const key = t.path.join('/');
                if (!byPath.has(key)) byPath.set(key, { name: key, resolvedType: t.type === 'color' ? 'COLOR' : t.type === 'dimension' || t.type === 'duration' || t.type === 'fontWeight' ? 'FLOAT' : null, description: t.description, valuesByMode: {} });
                const v = byPath.get(key);
                if (v.resolvedType === 'COLOR') { const c = parseColor(t.value); if (c) v.valuesByMode[modes[i]] = { r: +(c.r / 255).toFixed(4), g: +(c.g / 255).toFixed(4), b: +(c.b / 255).toFixed(4), a: c.a }; }
                else if (v.resolvedType === 'FLOAT') { const n = num(t.value); if (n != null) v.valuesByMode[modes[i]] = n; }
            }
        });
        const variables = [...byPath.values()].filter((v) => v.resolvedType && Object.keys(v.valuesByMode).length);
        return `${JSON.stringify({ collection: `OpenVibe · ${commentText(meta.name)}`, modes, variables, generator: `openvibe-shared/tokens v${VERSION}` }, null, 2)}\n`;
    }

    const json = (input) => `${JSON.stringify(docsOf(input).length > 1 ? { $description: 'A theme\'s dark and light halves', dark: docsOf(input).find((d) => metaOf(d).mode === 'dark') || docsOf(input)[0], light: docsOf(input).find((d) => metaOf(d).mode === 'light') || docsOf(input)[1] } : docsOf(input)[0], null, 2)}\n`;

    const TARGETS = [
        { id: 'css', label: 'CSS variables', ext: 'css', lang: 'css', build: css },
        { id: 'tailwind', label: 'Tailwind', ext: 'tailwind.config.js', lang: 'js', build: tailwind },
        { id: 'compose', label: 'Android (Jetpack Compose)', ext: 'kt', lang: 'kotlin', build: compose },
        { id: 'swiftui', label: 'iOS (SwiftUI)', ext: 'swift', lang: 'swift', build: swiftui },
        { id: 'flutter', label: 'Flutter', ext: 'dart', lang: 'dart', build: flutter },
        { id: 'figma', label: 'Figma variables', ext: 'figma.json', lang: 'json', build: figma },
        { id: 'json', label: 'Design tokens (DTCG JSON)', ext: 'tokens.json', lang: 'json', build: json },
    ];
    /** Source text for one target; file: a file name for it. Unknown target → null. */
    function compile(input, target, opts = {}) {
        const t = TARGETS.find((x) => x.id === target);
        if (!t || !docsOf(input).length) return null;
        return t.build(input, opts);
    }
    function fileName(input, target) {
        const t = TARGETS.find((x) => x.id === target);
        const base = ident(metaOf(docsOf(input)[0]).name);
        if (!t) return null;
        return t.ext.includes('.') ? `${slugOf(base)}.${t.ext}` : `${base}Theme.${t.ext}`;
    }

    return {
        VERSION, COLOR_MAP, SHADOW_MAP, SCALES, TARGETS: TARGETS.map(({ build, ...rest }) => rest),
        fromTheme, toTheme, flatten, compile, fileName, parseColor, parseShadow, ident,
    };
});
