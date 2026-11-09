'use strict';
// Browser geometry is intentional: getBBox accounts for SVG paths, arcs and browser path semantics consistently.
const assert = require('assert');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');
const glyphs = require('../glyphs');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('glyph-metrics: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

// These compositions are intentionally directional or asymmetric by design; all other line drawings share the centre.
const EXCEPTIONS = new Set(['arrow-down', 'arrow-left', 'arrow-right', 'arrow-up', 'back', 'chevron', 'down', 'enter', 'leave', 'play', 'reply', 'rewind', 'skip', 'spark', 'fast-forward']);
const DATA = glyphs.NAMES.map((name) => ({ name, line: glyphs.path(name), solid: glyphs.solid(name) || '' }));

(async () => {
    const tmpDir = require('fs').mkdtempSync(path.join(os.tmpdir(), 'ov-glyph-metrics-'));
    const browser = await h.launch({ tmpDir });
    const context = await browser.newContext();
    try {
        const page = await h.openPage(browser, context, { width: 600 });
        const results = await page.evaluate(`(async () => { const items = ${JSON.stringify(DATA)}; return Promise.all(items.map(async ({ name, line, solid }) => {
            const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            root.setAttribute('viewBox', '0 0 24 24'); root.setAttribute('width', '240'); root.setAttribute('height', '240');
            root.setAttribute('fill', 'none'); root.setAttribute('stroke', '#000'); root.setAttribute('stroke-width', '20');
            root.setAttribute('stroke-linecap', 'round'); root.setAttribute('stroke-linejoin', 'round');
            root.innerHTML = line;
            document.body.append(root);
            const box = root.getBBox();
            root.remove();
            const raster = (inside, style) => new Promise((resolve) => {
                const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="240" height="240"' + style + '>' + inside + '</svg>';
                const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 240; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const p = x.getImageData(0, 0, 240, 240).data; let ink = 0, x0 = 240, y0 = 240, x1 = -1, y1 = -1; for (let k = 0; k < p.length; k += 4) if (p[k + 3]) { ink++; const i = k / 4, px = i % 240, py = Math.floor(i / 240); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); } resolve({ ink, box: ink ? [x0 / 10, y0 / 10, (x1 - x0 + 1) / 10, (y1 - y0 + 1) / 10] : [0, 0, 0, 0] }); };
                img.onerror = () => resolve({ ink: 0, box: [0, 0, 0, 0] });
            });
            const lineRaster = await raster(line, ' fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"');
            const solidRaster = solid ? await raster('<style>.ln{fill:none;stroke:#000;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}</style>' + solid, ' fill="#000" stroke="none"') : { ink: 0 };
            return { name, box: lineRaster.box, lineInk: lineRaster.ink, solidInk: solidRaster.ink };
        })); })()`, 60000);
        const measured = results;
        const failures = [];
        for (const item of measured) {
            const [x, y, w, ht] = item.box;
            const cx = x + w / 2, cy = y + ht / 2;
            const long = Math.max(w, ht), short = Math.min(w, ht);
            if (!EXCEPTIONS.has(item.name) && (Math.abs(cx - 12) > 0.75 || Math.abs(cy - 12) > 0.75)) failures.push(`${item.name}: centre ${cx.toFixed(2)},${cy.toFixed(2)}`);
            if (long < 15 || long > 21.5 || short <= 0) failures.push(`${item.name}: ink box ${w.toFixed(2)}x${ht.toFixed(2)}`);
            if (item.solidInk && item.solidInk > 2.6 * Math.max(1, item.lineInk)) failures.push(`${item.name}: solid ink ${item.solidInk} > 2.6x line ink ${item.lineInk}`);
        }
        assert.deepStrictEqual(failures, [], failures.join('\n'));
        console.log(`glyph-metrics: ${measured.length} line drawings centered and sized; solid ink within limit`);
    } finally {
        await context.dispose(); await browser.close();
        assert.deepStrictEqual(require('fs').readdirSync(tmpDir), [], 'Chrome temp profile cleanup'); require('fs').rmdirSync(tmpDir);
    }
})().catch((err) => { console.error(err); process.exit(1); });
