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
    return page(body, 'OpenVibe Kit');
}

function page(body, title) {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<script src="theme-loader.js"></script>
<link rel="stylesheet" href="kit.css">
<link rel="stylesheet" href="kit-data.css">
<style>body { margin: 0; background: var(--bg-primary, #0b0f17); color: var(--text-primary, #e8ecf3); font-family: 'Inter', system-ui, sans-serif; }</style>
</head><body>
<div id="navbar-mount"></div>
<main class="ovk-page">${body}</main>
<script src="navbar.js"></script>
<script src="kit-web.js"></script>
<script src="kit-data-web.js"></script>
<script>OpenVibeNavbar.init({ service: 'chat', user: null, links: [
  { label: 'Vibe', href: '/vibe', icon: 'fa-wand-magic-sparkles' }, { label: 'Chat', href: '/', icon: 'fa-comments' },
  { label: 'Rooms', href: '/rooms', icon: 'fa-people-group' }, { label: 'Settings', href: '/kit', icon: 'fa-gear' },
  { label: 'Messages', href: '/messages', icon: 'fa-comment-dots', dot: true }, { label: 'Servers', href: '/servers', icon: 'fa-server' } ], appBar: true });</script>
</body></html>`;
}

/** Kit 2's pieces (4.36.0) on one page, with the kinds of numbers the sites really show. */
function gallery2() {
    const k = kit;
    const day = 86400000, t0 = Date.UTC(2026, 6, 31);
    const price = [];
    let v = 129;
    for (let i = 0; i <= 90; i++) { v = Math.max(79, v + Math.sin(i / 6) * 2.2 + (i === 40 ? -18 : 0) + (i === 72 ? 9 : 0) - 0.15); price.push([t0 + i * day, Math.round(v * 100) / 100]); }
    const list = price.map(([t, x]) => [t, Math.round((x * 1.12 + 14) * 100) / 100]);
    const perDay = Array.from({ length: 30 }, (_, i) => [t0 + 60 * day + i * day, Math.round(40 + 30 * Math.sin(i / 3) + i * 2.4 + (i % 7 === 5 ? 35 : 0))]);
    const models = [
        { label: 'gpt-6-sol', x: 0.42, y: 1086, best: true, mark: true }, { label: 'claude-sonnet-5-5', x: 0.31, y: 1071, best: true, mark: true },
        { label: 'deepseek-v4-flash', x: 0.014, y: 1012, best: true, mark: true }, { label: 'gemini-3-flash', x: 0.05, y: 1024, best: true, mark: true },
        { label: 'gpt-5-nano', x: 0.004, y: 948, best: true, mark: true }, { label: 'llama-5-70b', x: 0.09, y: 979 }, { label: 'mistral-m3', x: 0.12, y: 990 },
        { label: 'qwen-4-max', x: 0.21, y: 1031 }, { label: 'MiniMax-M3.1', x: 0.03, y: 1003 },
    ];
    const body = `
${k.head({ title: 'Kit 2', sub: 'Steps, tables, charts, rankings, meters, drop zones and receipts', back: { href: '/kit', label: 'The kit' } })}
${k.steps({ label: 'Opt in as a merchant', current: 1, items: [{ label: 'Opt in', href: '#1' }, { label: 'Verify the domain', note: 'a DNS record' }, { label: 'Choose what we read' }, { label: 'Live' }] })}
${k.chart({ type: 'line', title: 'Price over 90 days', note: 'Logitech MX Keys S · checked 4 times a day', x: { time: true }, y: { fmt: 'money', zero: false }, series: [{ name: 'Price', points: price }, { name: 'List price', points: list }] })}
${k.chart({ type: 'scatter', title: 'Quality against cost', note: 'Elo in blind votes, against dollars per 1,000 answers · dashed: the best for the money', x: { label: 'Cost per 1,000 answers', fmt: 'money' }, y: { label: 'Elo', fmt: 'int', zero: false }, points: models, height: 260 })}
${k.chart({ type: 'bar', title: 'Clips a day', note: 'Last 30 days', x: { time: true }, y: { fmt: 'int' }, series: [{ name: 'Clips', points: perDay }], height: 180 })}
${k.rank({ label: 'Leaderboard: chat replies', base: 900, fmt: 'int', items: [
        { name: 'gpt-6-sol', href: '#m1', note: 'OpenAI · 4,812 votes', value: 1086, interval: 14, delta: 1 },
        { name: 'claude-sonnet-5-5', href: '#m2', note: 'Anthropic · 4,390 votes', value: 1071, interval: 15, delta: -1 },
        { name: 'qwen-4-max', href: '#m3', note: 'Alibaba · 1,204 votes', value: 1031, interval: 28, delta: 'new' },
        { name: 'gemini-3-flash', href: '#m4', note: 'Google · 3,977 votes', value: 1024, interval: 16 },
        { name: 'deepseek-v4-flash', href: '#m5', note: 'DeepSeek · 6,201 votes', value: 1012, interval: 12, delta: 2 } ] })}
${k.table({ caption: 'The API', label: 'The API', columns: [{ key: 'path', label: 'Endpoint', primary: true, html: true }, { key: 'what', label: 'What it does' }, { key: 'auth', label: 'Sign-in' }, { key: 'rate', label: 'Per minute', num: true, fmt: 'int' }], rows: [
        { path: '<code>GET /api/v1/text/fancy</code>', what: 'Every style of a line of text', auth: 'none', rate: 120 },
        { path: '<code>POST /api/v1/files/convert</code>', what: 'One file into another format', auth: 'an app token', rate: 30 },
        { path: '<code>GET /api/v1/dns/:name</code>', what: 'A name’s records, now and before', auth: 'none', rate: 60 } ] })}
<form method="post" action="#read" enctype="multipart/form-data">
${k.drop({ name: 'image', accept: 'image/*', label: 'Drop a picture, or choose one', hint: 'JPEG, PNG or HEIC, up to 12 MB · paste works too', camera: true })}
</form>
${k.receipt({ title: 'What it says', actions: [k.iconButton({ type: 'button', icon: 'copy', label: 'Copy the text' }), k.iconButton({ type: 'button', icon: 'retry', label: 'Read it again' })],
        body: '<p>OPEN 7 DAYS · 10AM – 9PM<br>Fresh noodles made here every morning</p>',
        facts: [['Model', 'vision-ocr-2'], ['Cost', k.num(0.0021, 'money')], ['Time', k.num(840, 'ms')], ['Confidence', { html: k.meter({ value: 92, label: 'Confidence', text: '92%' }) + ' 92%' }], ['Kept', 'not stored']] })}
${k.section({ title: 'Your quota', body: `<div class="ovk-set-row"><span class="ovk-set-text">AI answers this month<small>7,410 of 10,000</small></span><span style="width:40%">${k.meter({ value: 7410, max: 10000, label: 'AI answers this month', tone: 'auto' })}</span></div><div class="ovk-set-row"><span class="ovk-set-text">Storage<small>9.4 of 10 GB</small></span><span style="width:40%">${k.meter({ value: 9.4, max: 10, label: 'Storage', tone: 'auto' })}</span></div>` })}`;
    return page(body, 'OpenVibe Kit 2');
}

async function shots(dir, chromePath) {
    const root = path.join(__dirname, '..');
    const pages = { kit: gallery(), kit2: gallery2() };
    const server = http.createServer((req, res) => {
        const name = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1));
        if (!name || pages[name]) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(pages[name || 'kit']); }
        const file = path.join(root, path.basename(name));
        if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': file.endsWith('.css') ? 'text/css' : 'text/javascript' });
        fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), '/home/workstation/openvibe/work/OpenVibe.Games'] }));
    const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : {});
    fs.mkdirSync(dir, { recursive: true });
    const only = process.argv.includes('--kit2') ? ['kit2'] : ['kit', 'kit2'];
    for (const name of only) for (const scheme of ['dark', 'light']) for (const [w, h, mobile] of [[320, 700, true], [390, 844, true], [768, 1024, true], [1280, 900, false]]) {
        if (name === 'kit' && (scheme === 'light' || w === 320)) continue;
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, colorScheme: scheme });
        // Light: the default theme's light half (vibe → cloud), as the account menu's Light switch would save it.
        if (scheme === 'light') await ctx.addInitScript(() => { try { localStorage.setItem('ov_theme', JSON.stringify({ id: 'cloud' })); } catch (e) { /* */ } });
        const p = await ctx.newPage();
        await p.goto(`${origin}/${name}`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(400);
        const tag = `${name}-${w}${name === 'kit' ? '' : `-${scheme}`}`;
        await p.screenshot({ path: path.join(dir, `${tag}.png`), fullPage: true });
        await p.evaluate(() => window.scrollTo(0, 900));
        await p.waitForTimeout(250);
        await p.screenshot({ path: path.join(dir, `${tag}-scrolled.png`) });
        const m = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight, appbar: !!document.querySelector('.ovnav-appbar') && getComputedStyle(document.querySelector('.ovnav-appbar')).display !== 'none' }));
        console.log(`${tag}: sideways ${m.overflow}, height ${m.height}, app bar ${m.appbar ? 'shown' : 'hidden'}`);
        await ctx.close();
    }
    await browser.close();
    server.close();
}

if (require.main === module) {
    const a = process.argv.slice(2);
    const i = a.indexOf('--shots');
    if (i >= 0) shots(a[i + 1] || 'kit-shots', a.includes('--chrome') ? a[a.indexOf('--chrome') + 1] : null).catch((e) => { console.error(e); process.exit(1); });
    else process.stdout.write(a.includes('--kit2') ? gallery2() : gallery());
}
module.exports = { gallery };
