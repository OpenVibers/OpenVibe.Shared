#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function main(args) {
    const [name, flag, dir] = args;
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(name || '') ||
        (flag !== undefined && flag !== '--dir') ||
        (flag === '--dir' && (!dir || args.length !== 3)) ||
        (flag === undefined && args.length !== 1)) {
        throw new Error('usage: npm run create-site -- <name> [--dir <path>]; name must match ^[a-z][a-z0-9-]{1,39}$');
    }

    const target = path.resolve(dir || name);
    if (fs.existsSync(target) && fs.readdirSync(target).length) {
        throw new Error(`target is not empty: ${target}`);
    }

    const source = path.join(__dirname, '..', 'templates', 'site');
    fs.cpSync(source, target, { recursive: true, force: false, errorOnExist: true });
    function replace(dirPath) {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            const file = path.join(dirPath, entry.name);
            if (entry.isDirectory()) replace(file);
            else fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('__NAME__', name));
        }
    }
    replace(target);
    console.log(`Created ${target}`);
}

try { main(process.argv.slice(2)); }
catch (err) { console.error(err.message); process.exitCode = 1; }
