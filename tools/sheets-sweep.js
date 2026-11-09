#!/usr/bin/env node
'use strict';
// Phone sweep of public sheets and pop-overs. Pass URLs to narrow the fleet; JSON is written to stdout.
const h = require('../browser-harness');
const os = require('os');
const fs = require('fs');
const path = require('path');

const domains = 'network live pics video community codes chat media games exchange design news blog events help quest rent work food deals coupons trade tips vip zone run search today surf meme cam casino tours shoes connect inventory actor computer bot services space locker'.split(' ');
const urls = process.argv.slice(2).length ? process.argv.slice(2) : domains.map((name) => `https://openvibe.${name}/`);
const triggerSelector = 'button[data-ovk-sheet],button[data-ov-share-sheet],button[data-ovk-sidebar-open],button[aria-haspopup="dialog"],button[aria-haspopup="menu"],button[aria-haspopup="listbox"],button[aria-haspopup="true"],button[aria-controls*="sheet"],button[aria-controls*="modal"],details.ovk-more>summary,#hero-stats .hero-stat[data-metric],.bc-mobile-chat-fab';
const surfaceSelector = 'dialog[open],[role="dialog"][aria-modal="true"],.ovk-sheet[open],.sn-overlay,.ov-share[open],.ovnav-chips-pop.open,.openvibe-navbar-dropdown.open,details.ovk-more[open],.ov-sel-pop.is-open,.ov-sel-sheet.is-open,.ovo-side.is-open,.ovk-sidebar.is-open,.bc-camera-sheet,#bc-chat-sidebar.mobile-chat-open';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function touch(p, x, from, to) {
    const point = (y) => [{ x, y, id: 1 }];
    await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
    for (let i = 1; i <= 5; i++) await p.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(from + (to - from) * i / 5) });
    await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(120);
}
async function sweep(p, url) {
    const result = { url, triggers: [], issues: [] };
    try { await p.goto(url, { maxMs: 8000 }); } catch (e) { result.error = String(e.message || e).slice(0, 200); return result; }
    const triggers = await p.evaluate(`[...document.querySelectorAll(${JSON.stringify(triggerSelector)})].filter(e=>e.getClientRects().length).slice(0,25).map((e,i)=>({index:i,label:(e.ariaLabel||e.textContent||'').trim().slice(0,80)}))`);
    if (!triggers.length) { result.uncovered = 'No public sheet or pop-over trigger found on this page'; return result; }
    for (const t of triggers) {
        try {
            await p.goto(url, { maxMs: 8000 });
            await p.evaluate('scrollTo(0, Math.min(300, document.documentElement.scrollHeight - innerHeight))');
            await p.evaluate(`document.querySelectorAll(${JSON.stringify(triggerSelector)})[${t.index}]?.click()`);
            await wait(500);
            const opened = await p.evaluate(`(() => {
                const el=[...document.querySelectorAll(${JSON.stringify(surfaceSelector)})].find(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
                if(!el)return null; const r=el.getBoundingClientRect(); const scroll=[el,...el.querySelectorAll('*')].find(x=>x.scrollHeight>x.clientHeight+20&&getComputedStyle(x).overflowY!=='hidden');
                return {kind:el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:''), rect:{x:r.x,y:r.y,w:r.width,h:r.height},
                    pageY:scrollY, behindY:document.body.getBoundingClientRect().top, scrollable:!!scroll, scrollTop:scroll?.scrollTop||0,
                    locked:getComputedStyle(document.body).position==='fixed'||['hidden','clip'].includes(getComputedStyle(document.documentElement).overflowY)||['hidden','clip'].includes(getComputedStyle(document.body).overflowY)};
            })()`);
            if (!opened) { result.triggers.push({ ...t, opened: false }); continue; }
            await touch(p, 8, 650, 250);
            const after = await p.evaluate(`({pageY:scrollY,behindY:document.body.getBoundingClientRect().top})`);
            const pageMoved = Math.abs(after.behindY - opened.behindY) > 3 || Math.abs(after.pageY - opened.pageY) > 3;
            const isPopover = /pop|dropdown|details/.test(opened.kind);
            if (isPopover) {
                await p.evaluate('document.body.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true}))');
                await wait(100);
            }
            const outsideClosed = isPopover ? await p.evaluate(`![...document.querySelectorAll(${JSON.stringify(surfaceSelector)})].some(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')`) : null;
            await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
            await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
            await wait(500);
            const closed = await p.evaluate(`![...document.querySelectorAll(${JSON.stringify(surfaceSelector)})].some(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')`);
            const row = { ...t, opened: true, ...opened, pageMoved, outsideClosed, closed };
            result.triggers.push(row);
            if (pageMoved && !isPopover) result.issues.push(`${t.label || t.index}: page moved under open surface`);
            if (outsideClosed === false) result.issues.push(`${t.label || t.index}: outside pointerdown did not close pop-over`);
            if (!closed) result.issues.push(`${t.label || t.index}: Escape did not close surface`);
        } catch (e) { result.triggers.push({ ...t, error: String(e.message || e).slice(0, 200) }); }
    }
    return result;
}

(async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-sheets-sweep-'));
    const browser = await h.launch({ tmpDir });
    const results = [];
    try {
        for (const url of urls) {
            const context = await browser.newContext();
            const p = await h.openPage(browser, context, { width: 390, height: 844 });
            const r = await sweep(p, url); results.push(r);
            console.error(`${url}: ${r.triggers.length} triggers, ${r.issues.length} issues${r.error ? `, ${r.error}` : ''}`);
            await p.close(); await context.dispose();
        }
    } finally { await browser.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
    process.stdout.write(JSON.stringify({ width: 390, results }, null, 2) + '\n');
    if (results.some((r) => r.issues.length)) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
