'use strict';
// scripts/native-check.js: the generated Kotlin and Swift, written out so that a compiler can check them. This test
// checks what the script writes (the native CI job compiles it: .github/workflows/native.yml).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const components = require('../components');
const { sources, write, themes } = require('../scripts/native-check');

// ── The themes: the default one and the light half it pairs with ──
const [dark, light] = themes();
assert.ok(dark && light, 'a theme and its light half');
assert.strictEqual(dark.mode, 'dark');
assert.strictEqual(light.mode, 'light');
assert.notStrictEqual(dark.id, light.id, 'two different themes');

// ── The files: the theme's Kotlin and Swift, and the kit's ──
const { files } = sources();
const byPath = new Map(files.map((f) => [f.path, f.text]));
for (const p of ['kotlin/VibeTheme.kt', 'kotlin/OvKit.kt', 'kotlin/OvKitStubs.kt', 'swift/VibeTokens.swift', 'swift/OvKit.swift']) {
    assert.ok(byPath.has(p), `${p} is written`);
}
for (const [p, text] of byPath) {
    assert.ok(text.length > 200, `${p} has content`);
    assert.ok(text.endsWith('\n'), `${p} ends with a newline`);
    assert.ok(!text.includes('\r'), `${p} has no carriage returns`);
}

// The theme's Kotlin: both halves, the Material 3 colour schemes and the scales.
const ktTheme = byPath.get('kotlin/VibeTheme.kt');
assert.match(ktTheme, /^package network\.openvibe\.theme$/m);
assert.match(ktTheme, /object VibeDarkTokens \{/);
assert.match(ktTheme, /object VibeLightTokens \{/);
assert.match(ktTheme, /val VibeDarkColorScheme: ColorScheme = darkColorScheme\(/);
assert.match(ktTheme, /val VibeLightColorScheme: ColorScheme = lightColorScheme\(/);
assert.match(ktTheme, /object OvScale \{/);

// The theme's Swift: both halves and the scales.
const swiftTheme = byPath.get('swift/VibeTokens.swift');
assert.match(swiftTheme, /^import SwiftUI$/m);
assert.match(swiftTheme, /public enum VibeDarkTokens \{/);
assert.match(swiftTheme, /public enum VibeLightTokens \{/);
assert.match(swiftTheme, /public enum OvScale \{/);

// The kit's Kotlin: the preamble, every spec's view, and the imports they need.
const ktKit = byPath.get('kotlin/OvKit.kt');
assert.match(ktKit, /^package network\.openvibe\.kit$/m);
assert.match(ktKit, /enum class OvKind \{ Primary, Quiet, Danger \}/);
assert.match(ktKit, /enum class OvNoticeKind \{ Ok, Info, Warn, Error \}/);
assert.match(ktKit, /import androidx\.compose\.material3\.MaterialTheme/);
assert.match(ktKit, /import network\.openvibe\.theme\.OvScale/);
for (const spec of components.SPECS) {
    assert.ok(ktKit.includes(spec.native.compose), `${spec.id}: its Compose view is written`);
    assert.ok(new RegExp(`fun Ov${spec.id[0].toUpperCase()}${spec.id.slice(1)}\\(`).test(ktKit), `${spec.id}: its Compose view is named`);
}

// The kit's Swift: the preamble (which theme the app wears) and every spec's view.
const swiftKit = byPath.get('swift/OvKit.swift');
assert.match(swiftKit, /^import SwiftUI$/m);
assert.match(swiftKit, /typealias OvTokens = VibeDarkTokens/);
assert.match(swiftKit, /enum OvKind \{ case primary, quiet, danger \}/);
for (const spec of components.SPECS) {
    assert.ok(swiftKit.includes(spec.native.swiftui), `${spec.id}: its SwiftUI view is written`);
    assert.ok(swiftKit.includes(`struct Ov${spec.id[0].toUpperCase()}${spec.id.slice(1)}`), `${spec.id}: its SwiftUI view is named`);
}

// ── Writing them out ──
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openvibe-native-test-'));
const out = write(dir);
assert.strictEqual(out.out, dir);
assert.ok(out.files.length === files.length);
for (const f of out.files) {
    const full = path.join(dir, f.path);
    assert.ok(fs.existsSync(full), `${f.path} is on disk`);
    assert.strictEqual(fs.readFileSync(full, 'utf8'), byPath.get(f.path), `${f.path} is what the generator wrote`);
}
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
assert.strictEqual(manifest.themes.dark, dark.id);
assert.strictEqual(manifest.themes.light, light.id);
assert.strictEqual(manifest.files.length, files.length);
fs.rmSync(dir, { recursive: true, force: true });

console.log(`✓ the native sources are written: ${files.map((f) => f.path).join(', ')}`);
console.log('native-check: all checks passed');
