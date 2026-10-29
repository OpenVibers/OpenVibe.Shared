'use strict';
// tokens.js: every built-in theme becomes a DTCG document and back without losing a colour, every target compiles,
// and nothing a person typed in the studio reaches the generated code.
const assert = require('assert');
const tokens = require('../tokens');
const { BUILTIN_THEMES, PAIRS } = require('../builtin-themes');

// ── Round trip: all 50 themes ──
for (const theme of BUILTIN_THEMES) {
    const doc = tokens.fromTheme(theme);
    const back = tokens.toTheme(doc);
    for (const [css] of tokens.COLOR_MAP) {
        const want = theme.variables[css] && tokens.parseColor(theme.variables[css]);
        if (!want) continue;
        const got = tokens.parseColor(back.variables[css]);
        assert.deepStrictEqual(got, want, `${theme.slug} ${css}`);
    }
    for (const [css] of tokens.SHADOW_MAP) if (theme.variables[css] && tokens.parseShadow(theme.variables[css])) assert.ok(back.variables[css], `${theme.slug} ${css} survives`);
    assert.strictEqual(back.mode, theme.mode === 'light' ? 'light' : 'dark');
    assert.strictEqual(doc['color'].bg.base.$type, 'color');
    assert.ok(doc.radius.md.$value === '14px' && doc.motion.duration.fast.$value === '150ms' && doc.size.tap.$value === '44px', 'the kit scales ride along');
}
console.log(`✓ ${BUILTIN_THEMES.length} built-in themes round-trip`);

// ── Every target compiles, for one theme and for a dark + light pair ──
const vibe = tokens.fromTheme(BUILTIN_THEMES.find((t) => t.slug === 'vibe'));
const lightSlug = (PAIRS.find((p) => p.includes('vibe')) || []).find((s) => s !== 'vibe') || 'vibe-light';
const vibeLight = tokens.fromTheme(BUILTIN_THEMES.find((t) => t.slug === lightSlug) || BUILTIN_THEMES.find((t) => t.mode === 'light'));
for (const { id } of tokens.TARGETS) {
    const one = tokens.compile(vibe, id);
    const two = tokens.compile([vibe, vibeLight], id);
    assert.ok(one && one.length > 200 && two && two.length > one.length * 0.9, `${id} compiles`);
    assert.ok(tokens.fileName(vibe, id), `${id} has a file name`);
}
const css = tokens.compile(vibe, 'css');
assert.match(css, /--ov-color-bg-base: #0a0f1c;/);
assert.match(css, /--bg-primary: var\(--ov-color-bg-base\);/, 'the network\'s own names stay as aliases');
assert.match(css, /--ov-radius-md: 14px;/);
assert.match(tokens.compile([vibe, vibeLight], 'css'), /:root\[data-theme-mode="light"\] \{/, 'a pair gets one block per mode');
const kt = tokens.compile([vibe, vibeLight], 'compose');
assert.match(kt, /^package network\.openvibe\.theme$/m);
assert.match(kt, /val ColorBgBase = Color\(0xFF0A0F1C\)/);
assert.match(kt, /val VibeDarkColorScheme: ColorScheme = darkColorScheme\(/);
assert.match(kt, /val VibeLightColorScheme: ColorScheme = lightColorScheme\(/);
assert.match(kt, /primary = VibeDarkTokens\.ColorAccentBase,/);
assert.match(kt, /val RadiusMd = 14\.dp/);
assert.match(kt, /val TypeSizeBody = 15\.sp/);
const swift = tokens.compile(vibe, 'swiftui');
assert.match(swift, /^import SwiftUI$/m);
assert.match(swift, /public enum VibeTokens \{/);
assert.match(swift, /public static let colorScheme: ColorScheme = \.dark/);
assert.match(swift, /public static let colorAccentBase = Color\(\.sRGB, red: 0\.231, green: 0\.51, blue: 0\.965, opacity: 1\)/);
assert.match(swift, /public static let motionDurationFast: Double = 0\.15/);
const dart = tokens.compile(vibe, 'flutter');
assert.match(dart, /static const colorBgBase = Color\(0xFF0A0F1C\);/);
assert.match(dart, /const vibeDarkScheme = ColorScheme\(\n {2}brightness: Brightness\.dark,/);
const fig = JSON.parse(tokens.compile([vibe, vibeLight], 'figma'));
assert.deepStrictEqual(fig.modes, ['dark', 'light']);
const bg = fig.variables.find((v) => v.name === 'color/bg/base');
assert.ok(bg && bg.resolvedType === 'COLOR' && bg.valuesByMode.dark.r < 0.1 && bg.valuesByMode.light, 'Figma: one variable, a value per mode');
const tw = tokens.compile(vibe, 'tailwind');
assert.match(tw, /"base": "var\(--ov-color-bg-base\)"/);
const dtcg = JSON.parse(tokens.compile(vibe, 'json'));
assert.strictEqual(dtcg.color.accent.base.$value, '#3b82f6');
assert.strictEqual(tokens.compile(vibe, 'nope'), null);
console.log('✓ css, tailwind, compose, swiftui, flutter, figma and json compile');

// ── Nothing typed reaches the code ──
const evil = tokens.fromTheme({
    name: 'Evil */ import os; val x = 1 // "\n\u2028 }',
    slug: '../../etc',
    description: 'line one\n*/ fun pwn() {}',
    mode: 'dark',
    variables: {
        '--bg-primary': '#000; } body { background: url(https://evil.example) }',
        '--text-primary': 'expression(alert(1))',
        '--accent': 'rgb(300, 0, 0)',
        '--border': '#123456',
        '--shadow': '0 2px 12px rgba(0,0,0,0.45); background: red',
    },
});
assert.strictEqual(evil.color.bg?.base, undefined, 'a value with code after it is dropped');
assert.strictEqual(evil.color.text?.primary, undefined);
assert.strictEqual(evil.color.accent?.base, undefined, 'an out-of-range channel is dropped');
assert.strictEqual(evil.color.line.base.$value, '#123456');
assert.strictEqual(evil.shadow, undefined, 'a shadow with a declaration after it is dropped');
assert.strictEqual(evil.$extensions['network.openvibe'].slug, 'etc');
// The theme's name and description may appear inside comments (one line, "*/" broken), never as code.
const code = (src, id) => (id === 'json' || id === 'figma' ? '' : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''));
for (const { id } of tokens.TARGETS) {
    const out = tokens.compile(evil, id);
    assert.ok(!/evil\.example|expression\(|background: red/.test(out), `${id}: a dropped value appears nowhere`);
    assert.ok(!/import os|fun pwn|val x = 1/.test(code(out, id)), `${id}: the name stays inside comments`);
    assert.ok(!/[\u2028\u2029]/.test(out), `${id}: no line separators`);
    if (id === 'json' || id === 'figma') JSON.parse(out);
    if (id === 'compose' || id === 'swiftui' || id === 'flutter') assert.match(out, /(object|enum|class) EvilImportOsValX1Tokens/, `${id}: the name is an identifier`);
}
assert.strictEqual(tokens.ident('123 go'), 'T123Go');
assert.strictEqual(tokens.ident('   '), 'Theme');
assert.strictEqual(tokens.ident('Café Noir'), 'CafeNoir');
assert.deepStrictEqual(tokens.parseColor('#abc'), { r: 170, g: 187, b: 204, a: 1 });
assert.deepStrictEqual(tokens.parseColor('#11223380'), { r: 17, g: 34, b: 51, a: 0.502 });
assert.strictEqual(tokens.parseColor('red'), null, 'named colours are not accepted (one spelling everywhere)');
assert.strictEqual(tokens.compile(tokens.fromTheme({ name: 'x', variables: { '--accent': '#fff' } }), 'compose', { pkg: 'a; import evil' }).split('\n')[1], 'package network.openvibe.theme', 'a bad package name falls back');
console.log('✓ names, values and package names are validated; nothing typed reaches generated code');
console.log('tokens: all checks passed');
