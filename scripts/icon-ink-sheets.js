'use strict';

// Local review images for ask 311. These are intentionally written outside the repository.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ink = require('./icon-ink');
const ROOT = path.join(__dirname, '..');
const SIZES = [32, 44, 56, 96];
const TARGET = 0.78;
async function render(page, html, file) {
    await page.evaluate(`document.open();document.write(${JSON.stringify(html)});document.close();`);
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
}

function baseline(dir) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-icon-before-'));
    const tar = execFileSync('git', ['archive', '--format=tar', 'origin/main'], { cwd: ROOT, maxBuffer: 128 * 1024 * 1024 });
    execFileSync('tar', ['-xf', '-', '-C', tmp], { input: tar });
    return { tmp, items: ink.buildItems(tmp, null) };
}

function doc(items, size, offset, limit) {
    const selected = items.slice(offset, offset + limit);
    const cols = Math.min(10, Math.max(4, Math.floor(1200 / (size + 22))));
    const cells = selected.map((it) => {
        const [set, ...rest] = it.key.split('/');
        const name = rest.join('/');
        const label = `${set}/${name}`;
        return `<div class="cell"><div class="tile" style="width:${size}px;height:${size}px"><img src="${it.src}" style="width:${(size * 0.58 / TARGET).toFixed(2)}px;height:${(size * 0.58 / TARGET).toFixed(2)}px"></div><div class="label">${label.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])}</div></div>`;
    }).join('');
    return `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#0c111b;color:#e7edf7;font:11px system-ui}.grid{display:grid;grid-template-columns:repeat(${cols},max-content);gap:14px}.cell{width:${size + 26}px;display:flex;align-items:center;flex-direction:column;gap:5px}.tile{display:grid;place-items:center;border-radius:20%;background:#1c2738;box-shadow:inset 0 0 0 1px #344157}.tile img{object-fit:contain;filter:invert(1)}.label{max-width:${size + 24}px;overflow-wrap:anywhere;text-align:center;line-height:1.2;color:#dbe5f5}</style><div class="grid">${cells}</div>`;
}

async function saveSheets(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const before = baseline(dir);
    try {
        const afterItems = ink.buildItems(ROOT, null);
        const groups = new Map();
        for (const items of [before.items, afterItems]) for (const it of items) {
            const key = it.key.split('/')[0];
            if (!groups.has(key)) groups.set(key, []);
        }
        for (const [label, items] of [['before', before.items], ['after', afterItems]]) {
            const grouped = new Map();
            for (const it of items) (grouped.get(it.key.split('/')[0]) || grouped.set(it.key.split('/')[0], []).get(it.key.split('/')[0])).push(it);
            const h = require(path.join(ROOT, 'browser-harness.js'));
            const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-icon-sheet-'));
            const browser = await h.launch({ tmpDir: tmp });
            try {
                const context = await browser.newContext();
                const page = await h.openPage(browser, context, { width: 1400, height: 900 });
                for (const [set, list] of grouped) for (const size of SIZES) {
                    const cap = 150;
                    for (let i = 0; i < list.length; i += cap) {
                        const file = `${label}-${set}-${size}${i ? `-${Math.floor(i / cap) + 1}` : ''}.png`;
                        await render(page, doc(list, size, i, cap), path.join(dir, file));
                    }
                }
                await context.dispose();
            } finally {
                await browser.close();
                fs.rmSync(tmp, { recursive: true, force: true });
            }
        }
    } finally {
        fs.rmSync(before.tmp, { recursive: true, force: true });
    }
    console.log(`contact sheets: ${dir} (before/after, all sets, ${SIZES.join(', ')} px)`);
}

async function saveTileDemo(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const items = ink.buildItems(ROOT, 'ovi-line');
    const selected = ['live', 'people', 'tools', 'chat'].map((name) => items.find((it) => it.key === `ovi-line/${name}`)).filter(Boolean);
    const fractions = [0.5, 0.58, 0.64];
    const rows = fractions.map((f) => `<section><h2>${(f * 100).toFixed(0)}% painted ink</h2>${selected.map((it) => `<div class="sample"><div class="tile"><img src="${it.src}" style="width:${(56 * f / TARGET).toFixed(2)}px;height:${(56 * f / TARGET).toFixed(2)}px"></div><b>${it.key.split('/')[1]}</b></div>`).join('')}</section>`).join('');
    const h = require(path.join(ROOT, 'browser-harness.js'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-icon-demo-'));
    const browser = await h.launch({ tmpDir: tmp });
    try {
        const context = await browser.newContext();
        const page = await h.openPage(browser, context, { width: 1100, height: 700 });
        await render(page, `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#0c111b;color:#e7edf7;font:14px system-ui}main{display:flex;gap:28px}section{padding:18px;background:#141d2a;border-radius:16px}h2{font-size:16px;margin:0 0 14px}.sample{display:flex;align-items:center;gap:10px;margin:10px 0}.tile{width:56px;height:56px;border-radius:18px;background:#27364b;display:grid;place-items:center}.tile img{object-fit:contain;filter:invert(1)}</style><main>${rows}</main>`, path.join(dir, 'tile-fraction-comparison.png'));
        await context.dispose();
    } finally {
        await browser.close();
        fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`tile comparison: ${path.join(dir, 'tile-fraction-comparison.png')}`);
}

module.exports = { saveSheets, saveTileDemo };
