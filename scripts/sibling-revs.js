#!/usr/bin/env node
'use strict';
// Writes navbar.js's SIBLING_REV: the content hash (openvibe-shared/assets hashAsset) of each file the navbar loads from
// beside itself, so a release gives each a new URL (?v=) that sites serve as immutable, and nobody is left on a copy an
// edge cached before the deploy (the Pair's first hour, 2026-10-31). Re-run after any of them changes:
// node scripts/sibling-revs.js (test/sibling-revs.test.js checks the constant is current).
const fs = require('fs');
const path = require('path');
const { hashAsset } = require('../assets');

const ROOT = path.join(__dirname, '..');
// 4.137.0: every file the navbar loads from beside itself, not ten of them. search.js, dock.js, presence.js and the rest
// went out without ?v=, so a release reached phones up to a day late (max-age=300, stale-while-revalidate=86400): the
// owner still saw the old menu hours after the new one shipped (11-07).
const FILES = ['ov-mark.js', 'ov-glyphs.js', 'ov-brand.woff2', 'ov-look.js', 'ov-fx.js', 'ov-labels.js', 'ov-forms.js', 'ov-forms.css', 'ov-share.js', 'ov-share.css',
    'search.js', 'dock.js', 'presence.js', 'panels.js', 'surfaces.js', 'notification-ui.js', 'history.js', 'bottom.js', 'appbar.js', 'release-watch.js', 'ov-icons.js', 'sso-client.js', 'overlay.js', 'ov-home.js', 'nav-slots.js',
    // 4.173.0: the wallet sheet (4.170.0) went out without ?v=, so a fix to it reached phones up to a day late.
    'ov-wallet.js', 'ov-wallet.css',
    // 4.189.0: the balances pill's icons and effects.
    'purse.js',
    // 4.191.0: the one dropdown (the site's name opens its pages).
    'ov-drop.js',
    // 4.193.0: the one tooltip (Sign in, the menu button, short labels).
    'ov-tip.js',
    // 2026-11-10: soft pages (intent prefetch, cross-document view transitions); not loaded by navbar.js yet.
    'soft.js'];
// The files dock.js and notification-ui.js load from beside themselves: their own tables, in their own files.
const OWN = { 'dock.js': { name: 'DOCK_REV', files: ['dock-vibe.js', 'dock-code.js', 'dock-mount.js', 'dock-runs.js', 'ai-marks-client.js', 'action-center.js', 'dock-timeline.js', 'dock-actor.js', 'dock-agent.js', 'dock-timer.js', 'dock-share.js', 'dock-card.js', 'dock-chat-edits.js'] },
    'notification-ui.js': { name: 'NOTIFY_REV', files: ['notification-live.js'] },
    'footer.js': { name: 'FOOTER_REV', files: ['shipped.js'] }, 'ov-thread.js': { name: 'THREAD_REV', files: ['ov-composer.js', 'ov-combo.js'] }, 'ov-composer.js': { name: 'COMPOSER_REV', files: ['ov-window.js'] }, 'ov-user.js': { name: 'USER_REV', files: ['ov-window.js'] }, 'ov-wallet.js': { name: 'WALLET_REV', files: ['ov-window.js'] }, 'boost.js': { name: 'BOOST_REV', files: ['route-transition.js'] } };
const table = (name, files) => `    const ${name} = { ${files.map((f) => `'${f}': '${hashAsset(fs.readFileSync(path.join(ROOT, f)))}'`).join(', ')} };`;
function writeOwn() {
    for (const [file, { name, files }] of Object.entries(OWN)) {
        const p = path.join(ROOT, file);
        const src = fs.readFileSync(p, 'utf8');
        const re = new RegExp(`^( *)const ${name} = \\{[^\\n]*\\};$`, 'm');
        if (!re.test(src)) throw new Error(`${file} has no ${name} line to update`);
        fs.writeFileSync(p, src.replace(re, (m, indent) => indent + table(name, files).trimStart()));
    }
}
const revs = () => Object.fromEntries(FILES.map((f) => [f, hashAsset(fs.readFileSync(path.join(ROOT, f)))]));
const line = (r) => `    const SIBLING_REV = { ${FILES.map((f) => `'${f}': '${r[f]}'`).join(', ')} };`;

if (require.main === module) {
    writeOwn();
    const p = path.join(ROOT, 'navbar.js');
    const src = fs.readFileSync(p, 'utf8');
    const next = src.replace(/^ {4}const SIBLING_REV = \{[^\n]*\};$/m, line(revs()));
    if (next === src && !src.includes(line(revs()))) throw new Error('navbar.js has no SIBLING_REV line to update');
    fs.writeFileSync(p, next);
    console.log(line(revs()).trim());
}
module.exports = { FILES, OWN, revs, line, table };
