#!/usr/bin/env node
'use strict';
// openvibe-shared/scripts/audit-page-end — plan 280 ("That huge wasted space … in between that and the footer …
// It's just waste"): measure the gap between the last thing on a site's home page and its footer, at 390 and 1280,
// and list every site over the rule: content ends, then 32 px on a computer (24 on a phone), then the footer.
//
//   node scripts/audit-page-end.js                       every site, 390 and 1280
//   node scripts/audit-page-end.js --footer-rule         with the Shared rule (32/24) applied, to see what is left
//   node scripts/audit-page-end.js --hosts openvibe.wiki,openvibe.games --width 390
//   node scripts/audit-page-end.js --json research/page-end.json --strict
//
// A gap is the top of the footer minus the bottom of the lowest visible piece of content before it (text a person
// reads, or a picture/video), in the page's own coordinates. A site's bottom padding, a spacer or a margin on the
// last block shows up here; the footer's own margin-top is the Shared rule and is not site dead space.
// Real Chrome through ../browser-harness (CHROME_BIN or the usual paths). Reads only: no site is changed.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const h = require('../browser-harness');

// The first-party homes (the Network's own zones), the same ring the footer and the menu list.
const SITES = [
    'openvibe.network', 'openvibe.live', 'openvibe.tools', 'openvibe.media', 'openvibe.games', 'openvibe.community',
    'openvibe.space', 'openvibe.chat', 'openvibe.codes', 'openvibe.blog', 'openvibe.wiki', 'openvibe.news',
    'openvibe.reviews', 'openvibe.tips', 'openvibe.vip', 'openvibe.trade', 'openvibe.host', 'openvibe.deals',
    'openvibe.coupons', 'openre.stream', 'open.shoes', 'openvibe.today', 'openvibe.vision', 'openvibe.domains',
    'openvibe.report', 'openvibe.meme', 'openvibe.casino', 'openvibe.surf', 'openvibe.fun', 'openvibe.tours',
    'openvibe.exchange', 'openvibe.cam', 'openvibe.design',
];
const RULE = { computer: 32, phone: 24 };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const widths = (value('width', '') ? [Number(value('width'))] : [1280, 390]).filter((n) => Number.isFinite(n) && n > 0);
const hosts = (value('hosts', '') ? value('hosts', '').split(',') : SITES).map((s) => s.trim()).filter(Boolean);
const footerRule = flag('footer-rule');
const strict = flag('strict');
const out = value('json', '');
const quiet = flag('quiet');

// What the page answers: where the footer starts, the lowest visible content before it, and the site's own padding
// around the end of the page (the context that says where the dead space comes from).
const MEASURE = `(() => {
    const toFixed = (n) => Math.round(n * 10) / 10;
    const footers = [...document.querySelectorAll('footer, #ov-footer')].filter((f) => {
        const r = f.getBoundingClientRect();
        return r.height > 0 && getComputedStyle(f).display !== 'none' && getComputedStyle(f).visibility !== 'hidden';
    });
    if (!footers.length) return { footer: false };
    const footer = footers[footers.length - 1];
    const footerTop = footer.getBoundingClientRect().top + scrollY;
    let last = 0, who = '';
    for (const el of document.body.querySelectorAll('*')) {
        if (el.closest('footer, #ov-footer, nav, .openvibe-navbar, .ovnav-appbar, .ovmini, .ovdk, .ovdk-pill, script, style, link, meta, noscript, template, [aria-hidden="true"]')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || cs.position === 'sticky') continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const bottom = r.bottom + scrollY;
        if (bottom > footerTop + 1) continue;
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        const media = el.matches('img,picture,video,canvas') || [...el.children].some((c) => c.matches('img,picture,video,canvas'));
        if (!ownText && !media) continue;
        if (bottom > last) { last = bottom; who = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/)[0] : ''); }
    }
    const main = document.querySelector('main') || document.body;
    return {
        footer: true, gap: toFixed(Math.max(0, footerTop - last)), who,
        footerTop: toFixed(footerTop), lastBottom: toFixed(last),
        footerMargin: getComputedStyle(footer).marginTop,
        mainPad: getComputedStyle(main).paddingBottom,
        bodyPad: getComputedStyle(document.body).paddingBottom,
        scrollHeight: document.documentElement.scrollHeight,
    };
})()`;

const ink = (on) => (process.stdout.isTTY ? (s) => `\u001b[${on}m${s}\u001b[0m` : (s) => s);
const dim = ink(2), bold = ink(1), red = ink(31);

(async () => {
    if (!h.findChrome()) {
        console.log('audit-page-end: skipped (no Chrome; set CHROME_BIN)');
        process.exit(0);
    }
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-page-end-')) });
    const rows = [];
    try {
        for (const host of hosts) {
            for (const width of widths) {
                const rule = width <= 760 ? RULE.phone : RULE.computer;
                const page = await h.openPage(browser, await browser.newContext(), { width, height: width <= 760 ? 844 : 900 });
                let row;
                try {
                    await page.goto(`https://${host}/`, { maxMs: 25000, quietMs: 700 });
                    if (footerRule) await page.evaluate(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify('@media (max-width: 760px) { footer.ovf, #ov-footer { margin-top: 24px !important; } } @media (min-width: 761px) { footer.ovf, #ov-footer { margin-top: 32px !important; } }')}; document.head.appendChild(s); })()`);
                    const m = await page.evaluate(MEASURE);
                    row = { host, width, rule, ...m, over: m.footer ? Math.max(0, m.gap - rule) : null };
                } catch (e) {
                    row = { host, width, rule, error: e.message.slice(0, 120) };
                }
                await page.close();
                rows.push(row);
                if (!quiet) {
                    if (row.error) console.log(`${host.padEnd(20)} ${String(width).padStart(4)}  ${red('unreachable')} ${dim(row.error)}`);
                    else if (!row.footer) console.log(`${host.padEnd(20)} ${String(width).padStart(4)}  ${red('no footer found')}`);
                    else {
                        const over = row.gap > rule + 1;
                        console.log(`${host.padEnd(20)} ${String(width).padStart(4)}  gap ${String(row.gap).padStart(6)}px  rule ${String(rule).padStart(2)}px  ${over ? red(`+${row.over}px over`) : bold('ok')}  ${dim(`last ${row.who || '?'} · main pad ${row.mainPad} · footer margin ${row.footerMargin}`)}`);
                    }
                }
            }
        }
    } finally { await browser.close(); }
    if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), footerRule, widths, rows }, null, 1)); console.log(`audit-page-end: wrote ${out}`); }
    const measured = rows.filter((r) => r.footer && !r.error);
    const over = measured.filter((r) => r.gap > r.rule + 1);
    console.log(`audit-page-end: ${measured.length}/${rows.length} measured, ${over.length} over the rule${footerRule ? ' (Shared rule applied)' : ''}${over.length ? ': ' + [...new Set(over.map((r) => r.host))].join(', ') : ''}`);
    if (strict && over.length) process.exit(1);
})().catch((e) => { console.error('audit-page-end:', e.stack || e.message); process.exit(2); });
