#!/usr/bin/env node
'use strict';
/**
 * The OpenVibe Kit's gallery: one page with every piece (kit.js / kit.css) and the navbar's app bar, built only from
 * the kit's own builders, so it is both the visual test and the picture docs/kit.md describes.
 *
 *   node scripts/kit-gallery.js > gallery.html                    the page (it loads ./navbar.js, ./kit.js, ./kit.css…)
 *   node scripts/kit-gallery.js --shots <dir> [--chrome <path>]   serves this folder, screenshots it at 390, 768 and
 *                                                                 1280 px wide, and prints sideways scroll per width
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const kit = require('../kit');

function gallery() {
    const k = kit;
    const settingsTabs = k.tabs({ base: '/kit', items: [{ key: 'look', label: 'Look' }, { key: 'privacy', label: 'Privacy' }, { key: 'sound', label: 'Sound', count: 2 }, { key: 'data', label: 'Data and AI' }], active: 'look' });
    const now = Date.now();
    const rows = [
        k.row({ href: '/r/night-owls', mark: k.mark({ name: 'Night Owls' }), title: 'Night Owls', meta: k.when(now - 6e5).text, sub: 'Ann: see you at nine?', unread: 3 }),
        k.row({ href: '/r/raiders', mark: k.mark({ name: 'Saturday Raiders', square: true }), title: 'Saturday Raiders', badge: k.badge('official', 'accent'), meta: 'Yesterday', sub: 'Raids on Saturday nights' }),
        k.row({ href: '/@goosely', mark: k.mark({ name: 'Goosely' }), title: 'Goosely', badge: k.badge('live', 'live'), meta: 'Mon', sub: 'Seattle Maybe 🤔 · 41 watching' }),
    ];
    const members = [
        k.row({ mark: k.mark({ name: 'Ann Lee' }), title: 'Ann Lee', sub: '@ann · seen 14:05', trail: '<form class="ovk-inline"><select aria-label="Role"><option>member</option><option>moderator</option></select>' + k.iconButton({ icon: 'check', label: 'Set' }) + '</form>' }),
        k.row({ mark: k.mark({ name: 'Bo' }), title: 'Bo', sub: '@bo · seen Yesterday', trail: '<span class="ovk-muted">owner</span>' }),
    ];
    const body = `
${k.head({ title: 'Settings', sub: 'Saved to your account, on every OpenVibe site', back: { href: '/', label: 'Home' }, actions: [k.iconButton({ href: '#help', icon: 'help', label: 'Help' }), k.more({ label: 'More', items: [{ href: '#export', label: 'Export', icon: 'download' }, { action: '#reset', label: 'Reset everything', icon: 'trash', danger: true, confirm: 'Reset everything?' }] })], tabs: settingsTabs })}
${k.notice({ kind: 'ok', text: 'Saved. These settings follow you to every device.' })}
${k.stats([[12345, 'messages this week'], [48, 'people chatting'], [7, 'rooms live'], [1200000, 'messages in all']])}
${k.find({ action: '/search', placeholder: 'Search rooms and people' })}
${k.list(rows, { title: 'Your rooms', more: { href: '/rooms', label: 'All' } })}
<form class="ovk-form" onsubmit="return false">
${k.section({ title: 'Messages look', body: k.switchRow({ name: 'timestamps', label: 'Times next to messages', on: true }) + k.switchRow({ name: 'compact', label: 'Compact messages', hint: 'Less space between lines' }) + k.seg({ name: 'size', label: 'Text size', options: [['s', 'Small'], ['m', 'Default'], ['l', 'Large']], value: 'm' }) + k.rangeRow({ name: 'vol', label: 'Speech volume', value: 70 }) + k.selectRow({ name: 'who', label: 'Who can message you', options: [['all', 'Everyone'], ['none', 'Nobody']], value: 'all' }) + k.chips({ name: 'src', label: 'Read messages from', options: [['ov', 'OpenVibe', true], ['tw', 'Twitch', true], ['yt', 'YouTube', false]] })})}
${k.saveBar({ label: 'Save settings' })}
</form>
${k.section({ title: 'Members', count: 2, note: 'Members write; moderators delete messages and manage members.', body: k.find({ action: '#add', method: 'post', name: 'username', placeholder: 'Add by username', icon: 'plus', inset: true }) + k.list(members, { flush: true }) })}
${k.fold({ id: 'embed', title: 'Put this room on your site', meta: 'two ways', body: k.snippet({ code: '<script src="https://openvibe.chat/widget.js" data-room="night-owls" async></script>', id: 'snip-1' }) })}
${k.fold({ title: 'Delete the room', tone: 'danger', body: '<p class="ovk-muted">Everything in it goes, for everyone.</p>' + k.action({ action: '#delete', label: 'Delete the room', kind: 'danger', confirm: 'Delete the room?' }) })}
${k.empty({ icon: 'chat', title: 'No public rooms yet', text: 'Start the first one: public, or private to the people you invite.', action: { href: '#new', label: 'Start a room', icon: 'plus' } })}
<p>${k.button({ href: '#a', label: 'Primary' })} ${k.button({ href: '#b', label: 'Quiet', kind: 'quiet' })} ${k.button({ href: '#c', label: 'Small', kind: 'quiet', small: true, icon: 'plus' })} ${k.button({ type: 'button', label: 'Danger', kind: 'danger' })}</p>
${k.dock({ action: '#send', placeholder: 'Message #general' })}`;
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>OpenVibe Kit</title>
<script src="theme-loader.js"></script>
<link rel="stylesheet" href="kit.css">
<style>body { margin: 0; background: var(--bg-primary, #0b0f17); color: var(--text-primary, #e8ecf3); font-family: 'Inter', system-ui, sans-serif; }</style>
</head><body>
<div id="navbar-mount"></div>
<main class="ovk-page">${body}</main>
<script src="navbar.js"></script>
<script src="kit-web.js"></script>
<script>OpenVibeNavbar.init({ service: 'chat', user: null, links: [
  { label: 'Vibe', href: '/vibe', icon: 'fa-wand-magic-sparkles' }, { label: 'Chat', href: '/', icon: 'fa-comments' },
  { label: 'Rooms', href: '/rooms', icon: 'fa-people-group' }, { label: 'Settings', href: '/kit', icon: 'fa-gear' },
  { label: 'Messages', href: '/messages', icon: 'fa-comment-dots', dot: true }, { label: 'Servers', href: '/servers', icon: 'fa-server' } ], appBar: true });</script>
</body></html>`;
}

async function shots(dir, chromePath) {
    const root = path.join(__dirname, '..');
    const page = gallery();
    const server = http.createServer((req, res) => {
        const name = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1));
        if (!name || name === 'kit') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
        const file = path.join(root, path.basename(name));
        if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': file.endsWith('.css') ? 'text/css' : 'text/javascript' });
        fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}/kit`;
    const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), '/home/workstation/openvibe/work/OpenVibe.Games'] }));
    const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : {});
    fs.mkdirSync(dir, { recursive: true });
    for (const [w, h, mobile] of [[390, 844, true], [768, 1024, true], [1280, 900, false]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, colorScheme: 'dark' });
        const p = await ctx.newPage();
        await p.goto(base, { waitUntil: 'networkidle' });
        await p.waitForTimeout(400);
        await p.screenshot({ path: path.join(dir, `kit-${w}.png`), fullPage: true });
        await p.evaluate(() => window.scrollTo(0, 900));
        await p.waitForTimeout(250);
        await p.screenshot({ path: path.join(dir, `kit-${w}-scrolled.png`) });
        const m = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight, appbar: !!document.querySelector('.ovnav-appbar') && getComputedStyle(document.querySelector('.ovnav-appbar')).display !== 'none' }));
        console.log(`${w}px: sideways ${m.overflow}, height ${m.height}, app bar ${m.appbar ? 'shown' : 'hidden'}`);
        await ctx.close();
    }
    await browser.close();
    server.close();
}

if (require.main === module) {
    const a = process.argv.slice(2);
    const i = a.indexOf('--shots');
    if (i >= 0) shots(a[i + 1] || 'kit-shots', a.includes('--chrome') ? a[a.indexOf('--chrome') + 1] : null).catch((e) => { console.error(e); process.exit(1); });
    else process.stdout.write(gallery());
}
module.exports = { gallery };
