'use strict';
// ov-qr.js: a QR code from a link, on the device (the Share sheet's QR code). Byte mode, versions 1-40, all four error
// correction levels and all eight masks. The encoder is checked against bwip-js 4.11.4's raw qrcode output: the same
// version, error correction level and mask must give the same modules, byte for byte.
//   node test/ov-qr.test.js
// bwip-js is not a dependency of this package (a QR decoder belongs to the tool that needs it): the cross-check finds
// the copy in OpenVibe.Tools, or one named by OV_BWIP_JS, and is skipped when neither is present.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const OVQR = require('../ov-qr');

const ROOT = path.join(__dirname, '..');
const ECCS = ['L', 'M', 'Q', 'H'];
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

// The format-information module positions, in bit order (drawFormatBits), so a matrix's mask can be read back.
const FORMAT_POS = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
function maskOf(matrix, ecc) {
    let bits = 0;
    for (let i = 0; i < 15; i++) {
        const [x, y] = FORMAT_POS[i];
        if (matrix.dark(x, y)) bits |= 1 << i;
    }
    for (let mask = 0; mask < 8; mask++) {
        const data = (FORMAT_BITS[ecc] << 3) | mask;
        let rem = data;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        if ((((data << 10) | rem) ^ 0x5412) === bits) return mask;
    }
    return -1;
}

// A deterministic 300-string sample: ASCII, UTF-8 with emoji, a single character, the empty string, and URLs from 20 to
// 900 characters. They keep lowercase letters in every string (and runs of digits or capitals short), so bwip-js encodes
// them in byte mode too and the raw matrices can be compared directly.
function rng(seed) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function sampleStrings() {
    const r = rng(0x5152);
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const punct = "-._~:/?#[]@!$&'()*+,;=%";
    const emoji = ['😀', '🌍', '🎉', '🔐', '🦄', '🚀', '🧩', '🍕', '❤️', '👩‍💻'];
    const pick = (s) => s[Math.floor(r() * s.length)];
    const ascii = (len) => {
        let s = '';
        for (let i = 0; i < len; i++) {
            const p = r();
            if (p < 0.9) s += pick(lower);
            else if (p < 0.94) s += pick(digits);
            else if (p < 0.97) s += pick(upper);
            else s += pick(punct);
        }
        return s;
    };
    const url = (len) => {
        const tops = ['openvibe.network', 'openvibe.chat', 'openvibe.blog', 'openvibe.design', 'openvibe.tools', 'openvibe.games'];
        let s = `https://${pick(tops)}/`;
        while (s.length < len) {
            const p = r();
            if (p < 0.74) s += pick(lower);
            else if (p < 0.82) s += pick(digits);
            else if (p < 0.86) s += pick(upper);
            else if (p < 0.94) s += pick(punct);
            else s += r() < 0.5 ? '-' : '/';
        }
        return s;
    };
    const strings = [''];
    for (let i = 0; i < 30; i++) strings.push(ascii(1 + Math.floor(r() * 60)));
    for (let i = 0; i < 30; i++) {
        let s = '';
        const n = 1 + Math.floor(r() * 20);
        for (let j = 0; j < n; j++) s += r() < 0.5 ? pick(lower) : pick(emoji);
        strings.push(s);
    }
    for (let i = 0; i < 10; i++) strings.push(pick(lower));
    for (let i = 0; i < 198; i++) strings.push(url(20 + Math.floor(r() * 230)));
    strings.push('https://x.co/abcdefg');
    for (let i = 0; i < 20; i++) strings.push(url(300 + Math.floor(r() * 300)));
    for (let i = 0; i < 9; i++) strings.push(url(600 + Math.floor(r() * 301)));
    strings.push(url(900));
    return strings;
}

// The API and the shapes a caller can rely on.
{
    const m = OVQR.matrix('a', { ecc: 'M' });
    assert.strictEqual(m.size, 21, 'one byte is version 1');
    assert.strictEqual(typeof m.dark(0, 0), 'boolean');
    assert.strictEqual(m.dark(-1, 0), false, 'outside the code is light');
    assert.strictEqual(m.dark(0, -1), false);
    assert.strictEqual(m.dark(m.size, 0), false);
    assert.strictEqual(m.dark(0, m.size), false);
    assert.strictEqual(OVQR.matrix('a', { ecc: 'L' }).size, 21);
    assert.strictEqual(OVQR.matrix('a', { ecc: 'Q' }).size, 21);
    assert.strictEqual(OVQR.matrix('a', { ecc: 'H' }).size, 21);
    assert.strictEqual(OVQR.matrix('a').size, 21, 'M is the default level');
    assert.strictEqual(OVQR.matrix('é').size, 21, 'two UTF-8 bytes');
    assert.strictEqual(OVQR.matrix('😀').size, 21, 'four UTF-8 bytes');
    assert.strictEqual(OVQR.matrix('').size, 21, 'the empty string is a zero-length byte segment');
    assert.throws(() => OVQR.matrix('a', { ecc: 'X' }), RangeError, 'an unknown level is a RangeError');
    assert.strictEqual(OVQR.matrix('a', { ecc: 'l' }).size, 21, 'lowercase is accepted for a human caller');
}

// Versions 1 to 40: the largest text each level can hold in byte mode still fits version 40; one byte more does not.
{
    const bound = (n, ecc) => OVQR.matrix('a'.repeat(n), { ecc }).size;
    assert.strictEqual(bound(2953, 'L'), 177);
    assert.strictEqual(bound(2331, 'M'), 177);
    assert.strictEqual(bound(1663, 'Q'), 177);
    assert.strictEqual(bound(1273, 'H'), 177);
    for (const [n, ecc] of [[2954, 'L'], [2332, 'M'], [1664, 'Q'], [1274, 'H'], [3000, 'L']]) {
        assert.throws(() => OVQR.matrix('a'.repeat(n), { ecc }), RangeError, `${n} bytes at ${ecc} does not fit version 40`);
        assert.throws(() => OVQR.svg('a'.repeat(n), { ecc }), RangeError, `svg: ${n} bytes at ${ecc} does not fit`);
    }
}

// svg(): one path for the dark modules, a viewBox in modules, a background only when asked, an escaped title.
{
    const m = OVQR.matrix('https://openvibe.network/x#key', { ecc: 'M' });
    const plain = OVQR.svg('https://openvibe.network/x#key', { ecc: 'M' });
    assert.match(plain, new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.size + 8} ${m.size + 8}" width="${m.size + 8}" height="${m.size + 8}" shape-rendering="crispEdges" aria-hidden="true">`));
    assert.strictEqual((plain.match(/<path /g) || []).length, 1, 'one path');
    assert.ok(plain.includes('fill="currentColor"'));
    assert.ok(!plain.includes('<rect'), 'no background by default');
    assert.ok(!plain.includes('<title>'), 'no title by default');

    const shown = OVQR.svg('a', { margin: 2, dark: '#123456', light: '#ffffff', title: '<b>"A&B"</b>' });
    assert.match(shown, /role="img" aria-label="&lt;b&gt;&quot;A&amp;B&quot;&lt;\/b&gt;"/);
    assert.ok(shown.includes('<title>&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;</title>'), 'the title is escaped');
    assert.ok(!shown.includes('<b>'), 'no markup from the title');
    assert.ok(shown.includes(`<rect width="${OVQR.matrix('a').size + 4}" height="${OVQR.matrix('a').size + 4}" fill="#ffffff"/>`));
    assert.ok(shown.includes('fill="#123456"'));
    assert.ok(OVQR.svg('a', { margin: 0 }).includes(`viewBox="0 0 ${OVQR.matrix('a').size} ${OVQR.matrix('a').size}"`));
    assert.throws(() => OVQR.svg('a', { margin: -1 }), RangeError, 'a negative margin is a RangeError');
    assert.throws(() => OVQR.svg('a', { ecc: 'X' }), RangeError, 'an unknown level is a RangeError');
}

// bwip-js 4.11.4's raw qrcode output, with our version and mask pinned. levels do not get boosted (fixedeclevel).
function findBwip() {
    const candidates = [
        process.env.OV_BWIP_JS,
        path.join(process.env.HOME || '', 'openvibe/work/OpenVibe.Tools/apps/gateway/node_modules/bwip-js'),
        'bwip-js',
    ].filter(Boolean);
    for (const candidate of candidates) {
        try {
            return { bwipjs: require(candidate), dir: candidate };
        } catch (e) {
            // Try the next one.
        }
    }
    return null;
}

const strings = sampleStrings();
assert.strictEqual(strings.length, 300, '300 sample strings');
assert.ok(strings.some((s) => s.length === 0), 'the empty string is in the sample');
assert.ok(strings.some((s) => s.length === 1), 'a one-character string is in the sample');
assert.ok(strings.some((s) => s.startsWith('https://') && s.length === 20), 'a URL of 20 characters is in the sample');
assert.ok(strings.some((s) => s.length >= 900), 'a URL of 900 characters is in the sample');
assert.ok(strings.some((s) => /[\u{1F300}-\u{1FAFF}]/u.test(s)), 'an emoji string is in the sample');

const found = findBwip();
if (!found) {
    console.log('QR cross-check: skipped (bwip-js 4.11.4 not installed; set OV_BWIP_JS to the package directory)');
} else {
    const bwipjs = found.bwipjs;
    const bwipVersion = (() => {
        try { return require(path.join(found.dir, 'package.json')).version; } catch (e) { return 'unknown'; }
    })();
    const bwipRaw = (text, ecc, version, mask) => {
        const raw = bwipjs.raw({ bcid: 'qrcode', text, eclevel: ecc, version, mask: mask + 1, fixedeclevel: true });
        const row = raw[0];
        const size = Math.round(Math.sqrt(row.pixs.length));
        return { size, dark: (x, y) => row.pixs[y * size + x] === 1 };
    };
    let compared = 0;
    for (const text of strings) {
        for (const ecc of ECCS) {
            const m = OVQR.matrix(text, { ecc });
            assert.strictEqual((m.size - 17) % 4, 0, 'a whole version');
            const mask = maskOf(m, ecc);
            assert.ok(mask >= 0, `format information names a mask for ${JSON.stringify(text.slice(0, 30))} at ${ecc}`);
            if (text === '') continue; // bwip-js rejects empty input; the zero-length segment is checked above.
            const b = bwipRaw(text, ecc, (m.size - 17) / 4, mask);
            const where = `${JSON.stringify(text.slice(0, 40))} at ${ecc}, version ${(m.size - 17) / 4}, mask ${mask}`;
            assert.strictEqual(b.size, m.size, `bwip-js chose another version for ${where}`);
            let diff = 0;
            for (let y = 0; y < m.size; y++) {
                for (let x = 0; x < m.size; x++) if (m.dark(x, y) !== b.dark(x, y)) diff++;
            }
            assert.strictEqual(diff, 0, `bwip-js's matrix differs at ${diff} modules for ${where}`);
            compared++;
            if (compared % 300 === 0) console.log(`QR: ${compared} matrices equal bwip-js ${bwipVersion} so far`);
        }
    }
    assert.strictEqual(compared, 1196, '300 strings x 4 levels minus the 4 empty-string matrices');

    // bwip-js's own smallest-version choice must be ours: a sample across the range, without pinning the version.
    const versionSamples = [strings[1], strings[60], strings[200], strings[299]];
    let versionsChecked = 0;
    for (const text of versionSamples) {
        for (const ecc of ECCS) {
            const m = OVQR.matrix(text, { ecc });
            const raw = bwipjs.raw({ bcid: 'qrcode', text, eclevel: ecc, fixedeclevel: true });
            const size = Math.round(Math.sqrt(raw[0].pixs.length));
            assert.strictEqual(size, m.size, `bwip-js's smallest version differs for ${JSON.stringify(text.slice(0, 40))} at ${ecc}: ${size} vs ${m.size}`);
            versionsChecked++;
        }
    }
    for (const [text, ecc] of [['a'.repeat(2953), 'L'], ['a'.repeat(1273), 'H']]) {
        const m = OVQR.matrix(text, { ecc });
        const raw = bwipjs.raw({ bcid: 'qrcode', text, eclevel: ecc, fixedeclevel: true });
        const size = Math.round(Math.sqrt(raw[0].pixs.length));
        assert.strictEqual(size, 177, `version 40 is the smallest for ${text.length} bytes at ${ecc}`);
        assert.strictEqual(size, m.size);
        versionsChecked++;
    }
    console.log(`QR: ${compared} matrices equal bwip-js ${bwipVersion} byte for byte (raw, same version and mask); ${versionsChecked} more match bwip-js's own smallest version; empty string checked as version 1`);
}

// The module is a browser file, is exported, and carries no dependency or network use.
{
    const files = fs.readFileSync(path.join(ROOT, 'files.js'), 'utf8');
    assert.ok(files.includes("'ov-qr.js',"), 'ov-qr.js is served');
    const pkg = require('../package.json');
    assert.strictEqual(pkg.exports['./ov-qr'], './ov-qr.js');
    const src = fs.readFileSync(path.join(ROOT, 'ov-qr.js'), 'utf8');
    assert.ok(!/\brequire\s*\(/.test(src), 'no dependency in the browser file');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(src), 'the link never leaves the device');
    assert.ok(src.includes('Nayuki'), 'the port is credited');
}

console.log(`ov-qr: ${OVQR.matrix('a').size} modules at one byte, 177 at version 40; SVG one path, escaped title; ${strings.length} sample strings`);
