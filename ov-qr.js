'use strict';
/**
 * ov-qr.js — a QR code from a link, on the device. The Share sheet shows one for the thing being shared; the link may
 * hold a key after #, so nothing here touches the network and no dependency is loaded.
 *
 *   OVQR.matrix('https://openvibe.network/x#key', { ecc: 'M' }) → { size: 29, dark(x, y) → true|false }
 *   OVQR.svg('https://openvibe.network/x', { ecc, margin, dark, light, title }) → an SVG string
 *
 * Byte mode (the text as UTF-8), the smallest of versions 1 to 40 that fits, all eight masks with the standard penalty
 * rules, and the format and version information. A text that does not fit version 40 throws a RangeError.
 *
 * Ported from Nayuki's QR Code generator (MIT), https://www.nayuki.io/page/qr-code-generator-library
 * Copyright (c) Project Nayuki. Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * the above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 * Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.OVQR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const ECC = {
        L: { ordinal: 0, formatBits: 1 },
        M: { ordinal: 1, formatBits: 0 },
        Q: { ordinal: 2, formatBits: 3 },
        H: { ordinal: 3, formatBits: 2 },
    };
    // Error-correction codewords per block and the number of blocks, indexed by [level][version].
    const ECC_CODEWORDS_PER_BLOCK = [
        [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
        [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    ];
    const NUM_ERROR_CORRECTION_BLOCKS = [
        [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
        [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
        [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
        [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
    ];
    const PENALTY_N1 = 3;
    const PENALTY_N2 = 3;
    const PENALTY_N3 = 40;
    const PENALTY_N4 = 10;

    // Returns the text's UTF-8 bytes (a lone surrogate becomes U+FFFD, as TextEncoder does).
    function utf8Bytes(text) {
        const out = [];
        for (let i = 0; i < text.length; i++) {
            let c = text.charCodeAt(i);
            if (c >= 0xD800 && c <= 0xDBFF && i + 1 < text.length) {
                const d = text.charCodeAt(i + 1);
                if (d >= 0xDC00 && d <= 0xDFFF) {
                    c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00);
                    i++;
                }
            }
            if (c >= 0xD800 && c <= 0xDFFF) c = 0xFFFD;
            if (c < 0x80) out.push(c);
            else if (c < 0x800) out.push(0xC0 | (c >>> 6), 0x80 | (c & 0x3F));
            else if (c < 0x10000) out.push(0xE0 | (c >>> 12), 0x80 | ((c >>> 6) & 0x3F), 0x80 | (c & 0x3F));
            else out.push(0xF0 | (c >>> 18), 0x80 | ((c >>> 12) & 0x3F), 0x80 | ((c >>> 6) & 0x3F), 0x80 | (c & 0x3F));
        }
        return out;
    }

    // Appends the low len bits of val to bb.
    function appendBits(val, len, bb) {
        for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
    }

    function getBit(x, i) {
        return ((x >>> i) & 1) !== 0;
    }

    // Data bits available in a version after the function modules, including remainder bits.
    function numRawDataModules(ver) {
        let result = (16 * ver + 128) * ver + 64;
        if (ver >= 2) {
            const numAlign = Math.floor(ver / 7) + 2;
            result -= (25 * numAlign - 10) * numAlign - 55;
            if (ver >= 7) result -= 36;
        }
        return result;
    }

    function numDataCodewords(ver, level) {
        return Math.floor(numRawDataModules(ver) / 8) -
            ECC_CODEWORDS_PER_BLOCK[level.ordinal][ver] * NUM_ERROR_CORRECTION_BLOCKS[level.ordinal][ver];
    }

    function byteCountBits(ver) {
        return ver <= 9 ? 8 : 16;
    }

    function reedSolomonComputeDivisor(degree) {
        const result = [];
        for (let i = 0; i < degree - 1; i++) result.push(0);
        result.push(1);
        let root = 1;
        for (let i = 0; i < degree; i++) {
            for (let j = 0; j < result.length; j++) {
                result[j] = reedSolomonMultiply(result[j], root);
                if (j + 1 < result.length) result[j] ^= result[j + 1];
            }
            root = reedSolomonMultiply(root, 0x02);
        }
        return result;
    }

    function reedSolomonComputeRemainder(data, divisor) {
        const result = divisor.map(() => 0);
        for (const b of data) {
            const factor = b ^ result.shift();
            result.push(0);
            divisor.forEach((coef, i) => { result[i] ^= reedSolomonMultiply(coef, factor); });
        }
        return result;
    }

    function reedSolomonMultiply(x, y) {
        let z = 0;
        for (let i = 7; i >= 0; i--) {
            z = (z << 1) ^ ((z >>> 7) * 0x11D);
            z ^= ((y >>> i) & 1) * x;
        }
        return z;
    }

    class QrCode {
        constructor(version, level, dataCodewords) {
            this.version = version;
            this.level = level;
            this.size = version * 4 + 17;
            this.modules = [];
            this.isFunction = [];
            for (let i = 0; i < this.size; i++) {
                this.modules.push(new Array(this.size).fill(false));
                this.isFunction.push(new Array(this.size).fill(false));
            }
            this.drawFunctionPatterns();
            this.drawCodewords(this.addEccAndInterleave(dataCodewords));
            // The standard penalty rules choose the mask; ties keep the lower number.
            let bestMask = 0;
            let bestPenalty = Infinity;
            for (let mask = 0; mask < 8; mask++) {
                this.applyMask(mask);
                this.drawFormatBits(mask);
                const penalty = this.getPenaltyScore();
                if (penalty < bestPenalty) {
                    bestPenalty = penalty;
                    bestMask = mask;
                }
                this.applyMask(mask);
            }
            this.mask = bestMask;
            this.applyMask(bestMask);
            this.drawFormatBits(bestMask);
            this.isFunction = [];
        }

        drawFunctionPatterns() {
            for (let i = 0; i < this.size; i++) {
                this.setFunctionModule(6, i, i % 2 === 0);
                this.setFunctionModule(i, 6, i % 2 === 0);
            }
            this.drawFinderPattern(3, 3);
            this.drawFinderPattern(this.size - 4, 3);
            this.drawFinderPattern(3, this.size - 4);
            const positions = this.alignmentPatternPositions();
            const n = positions.length;
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) {
                        this.drawAlignmentPattern(positions[i], positions[j]);
                    }
                }
            }
            this.drawFormatBits(0);
            this.drawVersion();
        }

        drawFormatBits(mask) {
            const data = (this.level.formatBits << 3) | mask;
            let rem = data;
            for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
            const bits = ((data << 10) | rem) ^ 0x5412;
            for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
            this.setFunctionModule(8, 7, getBit(bits, 6));
            this.setFunctionModule(8, 8, getBit(bits, 7));
            this.setFunctionModule(7, 8, getBit(bits, 8));
            for (let i = 9; i < 15; i++) this.setFunctionModule(14 - i, 8, getBit(bits, i));
            for (let i = 0; i < 8; i++) this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
            for (let i = 8; i < 15; i++) this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
            this.setFunctionModule(8, this.size - 8, true);
        }

        drawVersion() {
            if (this.version < 7) return;
            let rem = this.version;
            for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
            const bits = (this.version << 12) | rem;
            for (let i = 0; i < 18; i++) {
                const dark = getBit(bits, i);
                const a = this.size - 11 + (i % 3);
                const b = Math.floor(i / 3);
                this.setFunctionModule(a, b, dark);
                this.setFunctionModule(b, a, dark);
            }
        }

        drawFinderPattern(x, y) {
            for (let dy = -4; dy <= 4; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                    const xx = x + dx;
                    const yy = y + dy;
                    if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
                        this.setFunctionModule(xx, yy, Math.max(Math.abs(dx), Math.abs(dy)) !== 2 && Math.max(Math.abs(dx), Math.abs(dy)) !== 4);
                    }
                }
            }
        }

        drawAlignmentPattern(x, y) {
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
                }
            }
        }

        setFunctionModule(x, y, dark) {
            this.modules[y][x] = dark;
            this.isFunction[y][x] = true;
        }

        alignmentPatternPositions() {
            if (this.version === 1) return [];
            const n = Math.floor(this.version / 7) + 2;
            const step = this.version === 32 ? 26 : Math.ceil((this.version * 4 + 4) / (n * 2 - 2)) * 2;
            const result = [6];
            for (let pos = this.size - 7; result.length < n; pos -= step) result.splice(1, 0, pos);
            return result;
        }

        addEccAndInterleave(data) {
            const ver = this.version;
            const level = this.level;
            const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[level.ordinal][ver];
            const blockEccLen = ECC_CODEWORDS_PER_BLOCK[level.ordinal][ver];
            const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
            const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
            const shortBlockLen = Math.floor(rawCodewords / numBlocks);
            const blocks = [];
            const rsDiv = reedSolomonComputeDivisor(blockEccLen);
            for (let i = 0, k = 0; i < numBlocks; i++) {
                const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
                k += dat.length;
                const ecc = reedSolomonComputeRemainder(dat, rsDiv);
                if (i < numShortBlocks) dat.push(0);
                blocks.push(dat.concat(ecc));
            }
            const result = [];
            for (let i = 0; i < blocks[0].length; i++) {
                blocks.forEach((block, j) => {
                    if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
                });
            }
            return result;
        }

        drawCodewords(data) {
            let i = 0;
            for (let right = this.size - 1; right >= 1; right -= 2) {
                if (right === 6) right = 5;
                for (let vert = 0; vert < this.size; vert++) {
                    for (let j = 0; j < 2; j++) {
                        const x = right - j;
                        const upward = ((right + 1) & 2) === 0;
                        const y = upward ? this.size - 1 - vert : vert;
                        if (!this.isFunction[y][x] && i < data.length * 8) {
                            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
                            i++;
                        }
                    }
                }
            }
        }

        applyMask(mask) {
            for (let y = 0; y < this.size; y++) {
                for (let x = 0; x < this.size; x++) {
                    let invert;
                    switch (mask) {
                        case 0: invert = (x + y) % 2 === 0; break;
                        case 1: invert = y % 2 === 0; break;
                        case 2: invert = x % 3 === 0; break;
                        case 3: invert = (x + y) % 3 === 0; break;
                        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
                        case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
                        case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
                        default: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
                    }
                    if (!this.isFunction[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
                }
            }
        }

        getPenaltyScore() {
            let result = 0;
            for (let y = 0; y < this.size; y++) {
                let runColor = false;
                let runLen = 0;
                const history = [0, 0, 0, 0, 0, 0, 0];
                for (let x = 0; x < this.size; x++) {
                    if (this.modules[y][x] === runColor) {
                        runLen++;
                        if (runLen === 5) result += PENALTY_N1;
                        else if (runLen > 5) result++;
                    } else {
                        this.addRunHistory(runLen, history);
                        if (!runColor) result += this.countFinderPatterns(history) * PENALTY_N3;
                        runColor = this.modules[y][x];
                        runLen = 1;
                    }
                }
                result += this.finishRuns(runColor, runLen, history) * PENALTY_N3;
            }
            for (let x = 0; x < this.size; x++) {
                let runColor = false;
                let runLen = 0;
                const history = [0, 0, 0, 0, 0, 0, 0];
                for (let y = 0; y < this.size; y++) {
                    if (this.modules[y][x] === runColor) {
                        runLen++;
                        if (runLen === 5) result += PENALTY_N1;
                        else if (runLen > 5) result++;
                    } else {
                        this.addRunHistory(runLen, history);
                        if (!runColor) result += this.countFinderPatterns(history) * PENALTY_N3;
                        runColor = this.modules[y][x];
                        runLen = 1;
                    }
                }
                result += this.finishRuns(runColor, runLen, history) * PENALTY_N3;
            }
            for (let y = 0; y < this.size - 1; y++) {
                for (let x = 0; x < this.size - 1; x++) {
                    const color = this.modules[y][x];
                    if (color === this.modules[y][x + 1] && color === this.modules[y + 1][x] && color === this.modules[y + 1][x + 1]) {
                        result += PENALTY_N2;
                    }
                }
            }
            let dark = 0;
            for (const row of this.modules) for (const cell of row) if (cell) dark++;
            const total = this.size * this.size;
            const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
            result += k * PENALTY_N4;
            return result;
        }

        countFinderPatterns(history) {
            const n = history[1];
            const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
            return (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
                (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0);
        }

        finishRuns(runColor, runLen, history) {
            if (runColor) {
                this.addRunHistory(runLen, history);
                runLen = 0;
            }
            runLen += this.size;
            this.addRunHistory(runLen, history);
            return this.countFinderPatterns(history);
        }

        addRunHistory(runLen, history) {
            if (history[0] === 0) runLen += this.size;
            history.pop();
            history.unshift(runLen);
        }
    }

    function encode(text, level) {
        const bytes = utf8Bytes(String(text));
        let version = 0;
        for (let v = 1; v <= 40; v++) {
            const capacity = numDataCodewords(v, level) * 8;
            if (4 + byteCountBits(v) + bytes.length * 8 <= capacity) {
                version = v;
                break;
            }
        }
        if (!version) throw new RangeError('text does not fit a QR code (version 40)');
        const capacity = numDataCodewords(version, level) * 8;
        const bb = [];
        appendBits(0x4, 4, bb);
        appendBits(bytes.length, byteCountBits(version), bb);
        for (const b of bytes) appendBits(b, 8, bb);
        appendBits(0, Math.min(4, capacity - bb.length), bb);
        appendBits(0, (8 - (bb.length % 8)) % 8, bb);
        for (let pad = 0xEC; bb.length < capacity; pad ^= 0xEC ^ 0x11) appendBits(pad, 8, bb);
        const data = [];
        while (data.length * 8 < bb.length) data.push(0);
        bb.forEach((bit, i) => { data[i >>> 3] |= bit << (7 - (i & 7)); });
        return new QrCode(version, level, data);
    }

    function levelOf(ecc) {
        const key = String(ecc == null ? 'M' : ecc).toUpperCase();
        const level = ECC[key];
        if (!level) throw new RangeError('ecc must be L, M, Q or H');
        return level;
    }

    function matrix(text, { ecc = 'M' } = {}) {
        const qr = encode(text, levelOf(ecc));
        return {
            size: qr.size,
            dark: (x, y) => x >= 0 && x < qr.size && y >= 0 && y < qr.size && qr.modules[y][x],
        };
    }

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function svg(text, { ecc = 'M', margin = 4, dark = 'currentColor', light = 'transparent', title = '' } = {}) {
        const qr = encode(text, levelOf(ecc));
        let m = Number(margin);
        if (!Number.isFinite(m) || m < 0) throw new RangeError('margin must be a non-negative number');
        m = Math.floor(m);
        const dim = qr.size + m * 2;
        const runs = [];
        for (let y = 0; y < qr.size; y++) {
            for (let x = 0; x < qr.size;) {
                if (!qr.modules[y][x]) { x++; continue; }
                const start = x;
                while (x < qr.size && qr.modules[y][x]) x++;
                runs.push(`M${start + m} ${y + m}h${x - start}v1h-${x - start}z`);
            }
        }
        const label = title ? ` role="img" aria-label="${esc(title)}"` : ' aria-hidden="true"';
        const out = [
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges"${label}>`,
            title ? `<title>${esc(title)}</title>` : '',
            light !== 'transparent' ? `<rect width="${dim}" height="${dim}" fill="${esc(light)}"/>` : '',
            `<path fill="${esc(dark)}" d="${runs.join('')}"/>`,
            '</svg>',
        ];
        return out.join('');
    }

    return { matrix, svg };
});
