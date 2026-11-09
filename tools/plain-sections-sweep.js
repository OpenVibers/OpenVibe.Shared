#!/usr/bin/env node
'use strict';
// Read-only browser audit. PLAYWRIGHT_PATH may point to an installed Playwright module.
// node tools/plain-sections-sweep.js [https://site/path ...] > plain-sections.json
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

async function sites() {
    const response = await fetch('https://openvibe.network/api/frame?host=openvibe.network');
    if (!response.ok) throw new Error(`Frame returned ${response.status}`);
    const frame = await response.json();
    const urls = new Set();
    function walk(value) {
        if (!value || typeof value !== 'object') return;
        if (typeof value.url === 'string' && value.url.startsWith('https://')) urls.add(new URL(value.url).origin + '/');
        Object.values(value).forEach(walk);
    }
    walk(frame.nav);
    return [...urls].sort();
}

async function visit(browser, url) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
        const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        if (!response || response.status() >= 400) return { url, error: `HTTP ${response && response.status()}` };
        return await page.evaluate(() => {
            const root = document.querySelector('main') || document.body;
            const visible = (el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden';
            const text = (el) => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 180);
            const glyph = 'svg,img,i,[class*="glyph"],[class*="icon"],.ovk-i';
            const headings = [...root.querySelectorAll('h2,h3')].filter(visible).filter((el) => {
                // Linked item titles and authored article text are content, not UI section headings.
                if (el.closest('a,article,nav,footer,.markdown,.prose,.post-body,.post-content') || el.querySelector('a[href]')) return false;
                const row = el.closest('header,.ovk-section-head,.section-heading,.section-head') || el;
                return !row.querySelector(glyph);
            }).map(text);
            const empty = [...root.querySelectorAll('p,li,div')].filter(visible).filter((el) => el.children.length === 0 && /^No\b.{0,90}\byet[.!]?$/i.test(text(el)) && !el.closest('.ovk-empty')).map(text);
            const actions = [...root.querySelectorAll('a[href]')].filter(visible).filter((el) => /^(manage|see all|view all|browse|explore|create|add|start|upload)\b/i.test(text(el)) && getComputedStyle(el).textDecorationLine.includes('underline') && !el.matches('.ovk-btn,[role="button"]')).map((el) => ({ text: text(el), href: el.getAttribute('href') }));
            const links = [...new Set([...root.querySelectorAll('a[href]')].filter(visible).map((el) => el.href).filter((href) => {
                const u = new URL(href);
                return u.origin === location.origin && u.pathname !== '/' && !/auth|login|logout|signin|signout|delete|remove|\/api\/|\.(json|xml|png|jpg|pdf|zip)$/i.test(u.pathname) && !u.search;
            }).map((href) => href.split('#')[0]))].slice(0, 3);
            return { url: location.href, headings, empty, actions, score: headings.length + empty.length + actions.length, links };
        });
    } catch (error) {
        return { url, error: error.message.split('\n')[0] };
    } finally { await page.close(); }
}

async function main() {
    const urls = process.argv.slice(2);
    const queue = urls.length ? urls : await sites();
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
    const results = [];
    try {
        const homes = queue.slice();
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (homes.length) results.push(await visit(browser, homes.shift()));
        }));
        const inner = [...new Set(results.flatMap((row) => row.links || []))].filter((url) => !queue.includes(url));
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (inner.length) results.push(await visit(browser, inner.shift()));
        }));
    } finally { await browser.close(); }
    results.sort((a, b) => (b.score || 0) - (a.score || 0) || a.url.localeCompare(b.url));
    console.log(JSON.stringify(results, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
