'use strict';
// scripts/native/: the kit renderers — a kit document, drawn natively on Android and iOS.
//
// The renderers are the kit's proof that a kit document is not a web page in a frame: the same document is drawn by
// kit.js on the web, by KitView on Android and by KitView on iOS. These checks keep them honest:
//   - the sample document passes the kit's own validator, and the web draws it;
//   - every component in SPECS has a native view that both renderers call, so a new spec without native support
//     fails here instead of in an app.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const components = require('../components');
const kit = require('../kit');
const { sources } = require('../scripts/native-check');

const root = path.join(__dirname, '..');
const kotlin = fs.readFileSync(path.join(root, 'scripts/native/compose/KitRenderer.kt'), 'utf8');
const swift = fs.readFileSync(path.join(root, 'scripts/native/swiftui/KitRenderer.swift'), 'utf8');

// ── The sample document: a hero, a card rail, a list, stats and a notice ──
const sample = JSON.parse(fs.readFileSync(path.join(root, 'scripts/native/sample-doc.json'), 'utf8'));
const checked = components.validate(sample);
assert.ok(checked.ok, `the sample document is valid: ${checked.errors.join('; ')}`);

const types = new Set();
(function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') types.add(node.type);
    for (const child of node.children || []) walk(child);
})(sample);
for (const type of ['section', 'button', 'rail', 'card', 'list', 'row', 'stats', 'notice']) {
    assert.ok(types.has(type), `the sample document has a ${type}`);
}

// The same document, drawn by the web.
const html = components.render(sample, kit);
assert.ok(html.includes('OpenVibe'), 'the web draws the sample document');
assert.ok(html.length > 200, 'the web draws something');

// ── The renderers: every component in SPECS is drawn, in both languages ──
for (const spec of components.SPECS) {
    const view = `Ov${spec.id[0].toUpperCase()}${spec.id.slice(1)}`;
    assert.ok(kotlin.includes(view), `${spec.id}: the Compose renderer draws it (${view})`);
    assert.ok(kotlin.includes(`"${spec.id}"`), `${spec.id}: the Compose renderer knows the type`);
    assert.ok(swift.includes(view), `${spec.id}: the SwiftUI renderer draws it (${view})`);
    assert.ok(swift.includes(`"${spec.id}"`), `${spec.id}: the SwiftUI renderer knows the type`);
}

// The renderers wear the generated tokens, not hard-coded colours.
assert.match(kotlin, /MaterialTheme\.colorScheme/, 'the Compose renderer wears the theme\'s colour scheme');
assert.match(kotlin, /OvScale/, 'the Compose renderer wears the theme\'s scales');
assert.match(swift, /OvScale/, 'the SwiftUI renderer wears the theme\'s scales');

// Both renderers read a kit document, and both take a tap back to the app.
assert.match(kotlin, /fun KitView\(/, 'the Compose renderer has a KitView');
assert.match(kotlin, /sealed class KitNode/, 'the Compose renderer has a sealed KitNode');
assert.match(swift, /struct KitView: View/, 'the SwiftUI renderer has a KitView');
assert.match(swift, /enum KitNode: Codable/, 'the SwiftUI renderer decodes a KitNode');
assert.match(swift, /JSONDecoder|Codable/, 'the SwiftUI renderer decodes with Codable');

// ── The native check compiles both renderers with the tokens and the specs ──
const byPath = new Map(sources().files.map((f) => [f.path, f.text]));
assert.ok(byPath.has('kotlin/KitRenderer.kt'), 'the Compose renderer is written for the compiler');
assert.ok(byPath.has('swift/KitRenderer.swift'), 'the SwiftUI renderer is written for the compiler');
assert.strictEqual(byPath.get('kotlin/KitRenderer.kt'), kotlin, 'the Compose renderer is the checked-in one');
assert.strictEqual(byPath.get('swift/KitRenderer.swift'), swift, 'the SwiftUI renderer is the checked-in one');

console.log(`✓ the sample document is valid and the web draws it: ${[...types].join(', ')}`);
console.log(`✓ the renderers draw every component: ${components.SPECS.map((s) => s.id).join(', ')}`);
console.log('native-kit-renderer: all checks passed');
