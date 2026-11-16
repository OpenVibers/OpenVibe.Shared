'use strict';
/**
 * Icons that are not centred in their box (4.284.0; the owner, 11-16: "still offset icons in some places. You really need
 * to fix this forever and across all sites"). openvibe.design rule `icons-fill-their-place`: an icon is a centred cell of
 * its place, never nudged by padding.
 *
 *   const { offsetIcons } = require('openvibe-shared/scripts/icon-center');
 *   const found = await page.evaluate(offsetIcons, { limit: 1.5 });   // Playwright or the harness: [{ box, dx, dy, drawn }]
 *
 * In the page, it looks at every framed box whose only content is one icon (a button, a link, a summary or a tile with a
 * background or a border: what the eye reads as the icon's frame) and measures the icon's centre against the box's.
 * `drawn` adds where the glyph's strokes sit inside its own viewBox (a glyph drawn off-centre looks offset in a centred
 * box). A box is reported when either is past `limit` pixels. Text buttons are left alone: their icon sits beside words.
 *
 *   node scripts/icon-center.js <url> [<url> …] [--widths 390,1280]   the same check from the command line (Chrome)
 */
function offsetIcons(opts) {
    const limit = (opts && opts.limit) || 1.5;
    const out = [];
    const ICON = 'svg, i[class*="fa-"], [data-ov-icon], .ov-icon, img[role="presentation"], img[alt=""]';
    const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
    const framed = (el) => {
        const s = getComputedStyle(el);
        const bg = s.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor);
        const border = ['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(s[`border${k}Width`]) > 0 && !/rgba\(0, 0, 0, 0\)|transparent/.test(s[`border${k}Color`]));
        return bg || border || s.backgroundImage !== 'none' || s.boxShadow !== 'none';
    };
    const words = (el) => {
        for (const n of el.childNodes) {
            if (n.nodeType === 3 && n.textContent.trim()) return true;
            if (n.nodeType !== 1 || n.matches(ICON) || n.querySelector(ICON) && !n.innerText.trim()) continue;
            const s = getComputedStyle(n);
            if (s.position === 'absolute' && (parseFloat(s.width) <= 1 || s.clip !== 'auto')) continue;   // a visually hidden name
            if (n.innerText && n.innerText.trim() && visible(n)) return true;
        }
        return false;
    };
    const name = (el) => {
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
        return `${el.tagName.toLowerCase()}${id}${cls}${el.getAttribute('aria-label') ? ` "${el.getAttribute('aria-label').slice(0, 24)}"` : ''}`;
    };
    const seen = new Set();
    for (const box of document.querySelectorAll('button, a, summary, [role="button"], [class*="-ic"], [class*="icon"]')) {
        if (seen.has(box) || !visible(box)) continue;
        const b = box.getBoundingClientRect();
        if (b.width > 72 || b.height > 72 || b.width < 16) continue;
        const icons = [...box.querySelectorAll(ICON)].filter((i) => visible(i) && (!i.parentElement || !i.parentElement.closest(ICON) || !box.contains(i.parentElement.closest(ICON))));
        if (icons.length !== 1 || words(box) || !framed(box)) continue;
        seen.add(box);
        const ic = icons[0];
        const r = ic.getBoundingClientRect();
        if (r.width < 6) continue;
        let dx = (r.left + r.width / 2) - (b.left + b.width / 2);
        let dy = (r.top + r.height / 2) - (b.top + b.height / 2);
        let drawn = null;
        if (ic.tagName.toLowerCase() === 'svg' && typeof ic.getBBox === 'function') {
            try {
                const bb = ic.getBBox();
                const vb = ic.viewBox && ic.viewBox.baseVal && ic.viewBox.baseVal.width ? ic.viewBox.baseVal : { x: 0, y: 0, width: r.width, height: r.height };
                const k = Math.min(r.width / vb.width, r.height / vb.height);
                if (bb.width > 0 && bb.height > 0) {
                    drawn = [((bb.x + bb.width / 2) - (vb.x + vb.width / 2)) * k, ((bb.y + bb.height / 2) - (vb.y + vb.height / 2)) * k];
                }
            } catch { /* not rendered */ }
        }
        const tx = dx + (drawn ? drawn[0] : 0), ty = dy + (drawn ? drawn[1] : 0);
        if (Math.abs(dx) > limit || Math.abs(dy) > limit || Math.abs(tx) > limit * 1.6 || Math.abs(ty) > limit * 1.6) {
            out.push({ box: name(box), dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10, drawn: drawn ? drawn.map((v) => Math.round(v * 10) / 10) : null });
        }
        if (out.length >= 40) break;
    }
    return out;
}

module.exports = { offsetIcons };

if (require.main === module) {
    const args = process.argv.slice(2);
    const urls = args.filter((a) => /^https?:/.test(a));
    const wi = args.indexOf('--widths');
    const widths = wi >= 0 ? String(args[wi + 1]).split(',').map(Number) : [390, 1280];
    if (!urls.length) { console.error('usage: node scripts/icon-center.js <url> [<url> …] [--widths 390,1280]'); process.exit(2); }
    const h = require('../browser-harness');
    (async () => {
        const browser = await h.launch({});
        let bad = 0;
        try {
            for (const url of urls) {
                for (const width of widths) {
                    const p = await h.openPage(browser, await browser.newContext(), { width, height: 900 });
                    await p.goto(url, { maxMs: 15000 });
                    await new Promise((r) => setTimeout(r, 1500));
                    const found = await p.evaluate(`(${offsetIcons.toString()})({ limit: 1.5 })`);
                    bad += found.length;
                    console.log(`${url} @${width}: ${found.length ? found.map((f) => `${f.box} dx ${f.dx} dy ${f.dy}${f.drawn ? ` drawn ${f.drawn.join(',')}` : ''}`).join(' | ') : 'every icon centred'}`);
                }
            }
        } finally { await browser.close(); }
        process.exit(bad ? 1 : 0);
    })().catch((e) => { console.error(e); process.exit(1); });
}
