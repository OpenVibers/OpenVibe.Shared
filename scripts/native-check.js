#!/usr/bin/env node
'use strict';
/**
 * scripts/native-check.js — the generated native code, written out so that a compiler can check it.
 *
 * tokens.js compiles a theme into Kotlin (Jetpack Compose) and Swift (SwiftUI); components.js carries a reference
 * view for each of the kit's components, in both languages. Until now those outputs were only ever read as text.
 * This script writes them out as real source files:
 *
 *   node scripts/native-check.js                     # a temporary folder
 *   node scripts/native-check.js --out build/native  # a folder of your choosing
 *
 *   <out>/kotlin/VibeTheme.kt     the theme's Compose output: the theme's tokens, its Material 3 colour schemes
 *                                 and the kit's scales (OvScale)
 *   <out>/kotlin/OvKit.kt         the kit's Compose reference views: components.js' preamble and every spec
 *   <out>/kotlin/OvKitStubs.kt    the check's stand-ins: the image loader an app brings (Coil, Glide)
 *   <out>/kotlin/KitRenderer.kt   the kit renderer: a kit document, drawn with those views
 *   <out>/swift/VibeTokens.swift  the theme's SwiftUI output: both halves (the dark and the light tokens)
 *   <out>/swift/OvKit.swift       the kit's SwiftUI reference views
 *   <out>/swift/KitRenderer.swift the kit renderer: a kit document, drawn with those views
 *   <out>/manifest.json           what was written, and where it came from
 *
 * The native CI job (.github/workflows/native.yml) compiles the Kotlin with kotlinc against the Compose runtime and
 * UI artifacts, and type-checks the Swift with swiftc against SwiftUI. A generator that writes code nobody can
 * compile fails the build here instead of waiting to be found in an app.
 *
 * The kit's reference views are snippets: they carry no imports of their own, so this script writes the imports they
 * need around them. Everything else is what the generators wrote, unchanged.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const tokens = require('../tokens');
const components = require('../components');
const { BUILTIN_THEMES, DEFAULT_THEME, PAIRS } = require('../builtin-themes');

// ── The themes the check compiles: the default theme and the light half it pairs with ──
/** The default theme and its light counterpart, as the network's own theme objects. */
function themes() {
    const dark = DEFAULT_THEME || BUILTIN_THEMES[0];
    const pair = PAIRS.find((p) => p[0] === dark.id) || PAIRS.find((p) => p[1] === dark.id) || [];
    const lightId = pair.find((id) => id !== dark.id) || (BUILTIN_THEMES.find((t) => t.mode === 'light') || dark).id;
    const light = BUILTIN_THEMES.find((t) => t.id === lightId) || dark;
    return [dark, light];
}

// ── The Compose imports the kit's reference views need ──
// The snippets are written to be read and copied, not to be compiled on their own, so they name their types without
// saying where they come from. These are the imports every snippet in components.js needs.
const COMPOSE_IMPORTS = [
    'androidx.compose.animation.AnimatedVisibility',
    'androidx.compose.foundation.BorderStroke',
    'androidx.compose.foundation.background',
    'androidx.compose.foundation.clickable',
    'androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior',
    'androidx.compose.foundation.layout.Arrangement',
    'androidx.compose.foundation.layout.Box',
    'androidx.compose.foundation.layout.Column',
    'androidx.compose.foundation.layout.ColumnScope',
    'androidx.compose.foundation.layout.PaddingValues',
    'androidx.compose.foundation.layout.Row',
    'androidx.compose.foundation.layout.RowScope',
    'androidx.compose.foundation.layout.Spacer',
    'androidx.compose.foundation.layout.aspectRatio',
    'androidx.compose.foundation.layout.fillMaxWidth',
    'androidx.compose.foundation.layout.height',
    'androidx.compose.foundation.layout.heightIn',
    'androidx.compose.foundation.layout.padding',
    'androidx.compose.foundation.layout.size',
    'androidx.compose.foundation.layout.width',
    'androidx.compose.foundation.layout.widthIn',
    'androidx.compose.foundation.lazy.LazyListScope',
    'androidx.compose.foundation.lazy.LazyRow',
    'androidx.compose.foundation.lazy.items',
    'androidx.compose.foundation.lazy.rememberLazyListState',
    'androidx.compose.foundation.shape.RoundedCornerShape',
    'androidx.compose.material.icons.Icons',
    'androidx.compose.material.icons.filled.Error',
    'androidx.compose.material.icons.filled.ExpandMore',
    'androidx.compose.material.icons.filled.Info',
    'androidx.compose.material3.Button',
    'androidx.compose.material3.ButtonDefaults',
    'androidx.compose.material3.Icon',
    'androidx.compose.material3.ListItem',
    'androidx.compose.material3.LocalTextStyle',
    'androidx.compose.material3.MaterialTheme',
    'androidx.compose.material3.OutlinedButton',
    'androidx.compose.material3.ScrollableTabRow',
    'androidx.compose.material3.Surface',
    'androidx.compose.material3.Tab',
    'androidx.compose.material3.Text',
    'androidx.compose.material3.TextButton',
    'androidx.compose.runtime.Composable',
    'androidx.compose.runtime.getValue',
    'androidx.compose.runtime.mutableStateOf',
    'androidx.compose.runtime.saveable.rememberSaveable',
    'androidx.compose.runtime.setValue',
    'androidx.compose.ui.Alignment',
    'androidx.compose.ui.Modifier',
    'androidx.compose.ui.draw.clip',
    'androidx.compose.ui.draw.rotate',
    'androidx.compose.ui.graphics.Color',
    'androidx.compose.ui.graphics.vector.ImageVector',
    'androidx.compose.ui.layout.ContentScale',
    'androidx.compose.ui.semantics.LiveRegionMode',
    'androidx.compose.ui.semantics.heading',
    'androidx.compose.ui.semantics.liveRegion',
    'androidx.compose.ui.semantics.semantics',
    'androidx.compose.ui.text.font.FontWeight',
    'androidx.compose.ui.text.style.TextAlign',
    'androidx.compose.ui.text.style.TextOverflow',
    'androidx.compose.ui.unit.dp',
    'androidx.compose.ui.unit.sp',
    'network.openvibe.theme.OvScale',
];

// The image loader an app brings (Coil, Glide) is not a Compose artifact, so the check stands in for it: the
// reference view only needs the call to type-check, not to fetch a picture.
const COMPOSE_STUBS = `// The check's stand-ins: what an app brings with it, not what the Compose artifacts carry.
// The kit's card view draws a picture through an image loader (Coil, Glide); the CI does not pull one in, it only
// needs the call to type-check.
package network.openvibe.kit

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale

@Composable
fun AsyncImage(model: Any?, contentDescription: String?, modifier: Modifier = Modifier, contentScale: ContentScale = ContentScale.Fit) {
}
`;

/** The Compose file with the kit's reference views: the preamble, then every spec's snippet. */
function composeKit() {
    const parts = [
        '// The OpenVibe kit for Jetpack Compose: the reference views of components.js, with the imports they need.',
        '// Generated by scripts/native-check.js — do not edit; fix components.js instead.',
        'package network.openvibe.kit',
        '',
        ...COMPOSE_IMPORTS.map((i) => `import ${i}`),
        '',
        components.PREAMBLE.compose,
        '',
    ];
    for (const spec of components.SPECS) parts.push(`// ${spec.name} (${spec.id})`, spec.native.compose, '');
    return `${parts.join('\n')}\n`;
}

/** The SwiftUI file with the kit's reference views: the preamble, then every spec's snippet. */
function swiftKit() {
    const parts = [
        '// The OpenVibe kit for SwiftUI: the reference views of components.js, with the imports they need.',
        '// Generated by scripts/native-check.js — do not edit; fix components.js instead.',
        'import SwiftUI',
        'import Foundation',
        '',
        components.PREAMBLE.swiftui,
        '',
    ];
    for (const spec of components.SPECS) parts.push(`// ${spec.name} (${spec.id})`, spec.native.swiftui, '');
    return `${parts.join('\n')}\n`;
}

/**
 * The renderers: the kit's own sources, checked in under scripts/native/, copied into the folder the compiler
 * reads so they are compiled (Kotlin) and type-checked (Swift) with the tokens and the reference views.
 */
function renderers() {
    const dir = path.join(__dirname, 'native');
    return [
        { path: 'kotlin/KitRenderer.kt', text: fs.readFileSync(path.join(dir, 'compose', 'KitRenderer.kt'), 'utf8') },
        { path: 'swift/KitRenderer.swift', text: fs.readFileSync(path.join(dir, 'swiftui', 'KitRenderer.swift'), 'utf8') },
    ];
}

/**
 * The native sources, as { path, text }: the theme's Kotlin and Swift, and the kit's.
 * The theme is compiled as a pair (its dark half and its light half), so both colour schemes land in one file —
 * the way an app carries them.
 * The paths are written with slashes, so the manifest reads the same on every machine.
 */
function sources() {
    const [dark, light] = themes();
    const docs = [tokens.fromTheme(dark), tokens.fromTheme(light)];
    const name = tokens.ident(dark.name || 'Theme');
    return {
        themes: { dark: dark.id, light: light.id, name },
        files: [
            { path: `kotlin/${name}Theme.kt`, text: tokens.compile(docs, 'compose') },
            { path: 'kotlin/OvKit.kt', text: composeKit() },
            { path: 'kotlin/OvKitStubs.kt', text: COMPOSE_STUBS },
            { path: `swift/${name}Tokens.swift`, text: tokens.compile(docs, 'swiftui') },
            { path: 'swift/OvKit.swift', text: swiftKit() },
            ...renderers(),
        ],
    };
}

/** Write the sources into a folder. Returns { out, files } (the files written, with their sizes). */
function write(out) {
    const { themes: which, files } = sources();
    const written = [];
    for (const f of files) {
        const full = path.join(out, ...f.path.split('/'));
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, f.text);
        written.push({ path: f.path, bytes: Buffer.byteLength(f.text) });
    }
    const manifest = {
        generator: 'openvibe-shared/scripts/native-check.js',
        themes: which,
        files: written,
    };
    fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return { out, themes: which, files: written };
}

function main(argv) {
    let out = path.join(os.tmpdir(), 'openvibe-native-check');
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--out') out = path.resolve(argv[++i] || out);
        else if (argv[i].startsWith('--out=')) out = path.resolve(argv[i].slice(6));
        else if (argv[i] === '--help' || argv[i] === '-h') {
            console.log('usage: node scripts/native-check.js [--out <folder>]');
            return 0;
        }
    }
    const { out: dir, themes: which, files } = write(out);
    console.log(`native-check: ${which.dark} (dark) and ${which.light} (light) → ${dir}`);
    for (const f of files) console.log(`  ${f.path} (${f.bytes} bytes)`);
    return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { sources, write, themes, renderers, main };
