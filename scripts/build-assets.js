#!/usr/bin/env node
'use strict';
// Copy a site's static files to content-addressed names and write a lookup manifest.
// Usage: openvibe-build-assets <source-dir> <output-dir>
const fs = require('fs');
const path = require('path');
const { hashAsset } = require('../assets');

function build(sourceDir, outputDir) {
    const source = path.resolve(sourceDir);
    const output = path.resolve(outputDir);
    if (!fs.statSync(source).isDirectory()) throw new Error('source must be a directory');
    if (output === source || output.startsWith(source + path.sep)) {
        throw new Error('output must be outside the source directory');
    }
    const manifest = {};
    function visit(dir, relative = '') {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const name = relative ? `${relative}/${entry.name}` : entry.name;
            const input = path.join(dir, entry.name);
            if (entry.isDirectory()) { visit(input, name); continue; }
            if (!entry.isFile()) continue;
            const bytes = fs.readFileSync(input);
            const ext = path.extname(entry.name);
            const stem = entry.name.slice(0, entry.name.length - ext.length);
            const hashed = `${stem}.${hashAsset(bytes)}${ext}`;
            const target = relative ? `${relative}/${hashed}` : hashed;
            const destination = path.join(output, ...target.split('/'));
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, bytes);
            manifest[name] = target;
        }
    }
    visit(source);
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
}

if (require.main === module) {
    if (process.argv.length !== 4) {
        console.error('Usage: openvibe-build-assets <source-dir> <output-dir>');
        process.exitCode = 1;
    } else {
        try { build(process.argv[2], process.argv[3]); }
        catch (err) { console.error(`build-assets: ${err.message}`); process.exitCode = 1; }
    }
}

module.exports = { build };
