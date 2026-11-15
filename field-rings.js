'use strict';
// openvibe-shared/field-rings (4.274.0; design rule one-ring-per-field): in a page, every visible text field (each input type people type into, textarea, select, contenteditable)
// at rest and focused, and the rings drawn around it: its own border, outline and box-shadow, and the border, outline or
// shadow of a box that hugs it (a pill or card within 10 px on every side). Two rings around one field is the owner's
// "double border" (11-15): a bordered field inside a bordered box, or a field that rings itself inside a box that rings.
//
//   const { RINGS } = require('openvibe-shared/field-rings');   page.evaluate(`(${RINGS})()`) → { fields, doubles: [...] }
// The browser harness runs it at the narrowest width as the `rings` check.
//
// A field that hides itself (opacity 0, clipped, 1 px) is the control's own business and is skipped.
function RINGS() {
    const TEXTISH = /^(text|search|email|url|tel|password|number|date|time|datetime-local|month|week|)$/;
    const alphaOf = (c) => {
        if (!c || c === 'transparent') return 0;
        const m = String(c).match(/rgba?\(([^)]+)\)/);
        if (!m) return 1;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return p.length >= 4 ? p[3] : 1;
    };
    const fullBorder = (cs) => ['Top', 'Right', 'Bottom', 'Left'].every((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && cs[`border${s}Style`] !== 'hidden' && alphaOf(cs[`border${s}Color`]) > 0.06);
    const outlineOf = (cs) => (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && alphaOf(cs.outlineColor) > 0.06 ? { offset: parseFloat(cs.outlineOffset) || 0 } : null);
    // A box-shadow ring: an outer shadow with a spread (a halo or a ring), not a soft drop shadow under the box.
    const shadowRing = (cs) => {
        const s = cs.boxShadow;
        if (!s || s === 'none') return false;
        return s.split(/,(?![^(]*\))/).some((part) => {
            if (/inset/.test(part)) return false;
            const color = (part.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i) || [''])[0];
            if (alphaOf(color) <= 0.06) return false;
            const nums = part.replace(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi, '').trim().split(/\s+/).map(parseFloat).filter((n) => !Number.isNaN(n));
            const [x = 0, y = 0, blur = 0, spread = 0] = nums;
            return spread > 0 && Math.abs(x) < 1 && Math.abs(y) < 1 && blur <= spread * 2 + 1;
        });
    };
    const ringsOf = (el) => {
        const cs = getComputedStyle(el);
        const r = [];
        if (fullBorder(cs)) r.push('border');
        const o = outlineOf(cs);
        if (o) r.push(o.offset >= 2 ? 'outline+gap' : 'outline');
        if (shadowRing(cs)) r.push('shadow');
        return r;
    };
    const name = (el) => {
        const cls = [...el.classList].slice(0, 2).map((c) => `.${c}`).join('');
        const t = el.getAttribute('type');
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}${t ? `[type=${t}]` : ''}`;
    };
    const visible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
    };
    /** The nearest box around the field that hugs it (each side within 10 px) and draws a ring. */
    const huggingRing = (el) => {
        const f = el.getBoundingClientRect();
        // A field on a line of text (inline-block: a textarea, an input) sits on its baseline, a few pixels above the box's
        // bottom: that is still the box hugging it.
        const lim = [10, 10, 10, /^inline/.test(getComputedStyle(el).display) ? 16 : 10];
        let a = el.parentElement;
        for (let i = 0; a && i < 4; i++, a = a.parentElement) {
            const b = a.getBoundingClientRect();
            const gaps = [f.left - b.left, f.top - b.top, b.right - f.right, b.bottom - f.bottom];
            if (gaps.some((g) => g < -1)) return null;          // the field sticks out: not its box
            if (gaps.some((g, k) => g > lim[k])) {
                // A row with an icon or a button beside the field still hugs it top and bottom (a pill), as long as the field
                // is most of the row: a toolbar with a small field among its buttons is not the field's box.
                if (!(gaps[1] <= 10 && gaps[3] <= lim[3] && b.height <= f.height + 26 && f.width >= b.width * 0.5)) return null;
            }
            const r = ringsOf(a);
            if (r.length) return { box: name(a), rings: r };
        }
        return null;
    };
    // OpenVibe's own select (.ov-sel, a button that stands in for a select) is a field too.
    const fields = [...document.querySelectorAll('input, textarea, select, .ov-sel, [contenteditable=""], [contenteditable="true"]')]
        .filter((el) => (el.tagName !== 'INPUT' || TEXTISH.test((el.getAttribute('type') || '').toLowerCase())) && !el.disabled && visible(el));
    const doubles = [];
    const seen = new Set();
    return (async () => {
        const before = document.activeElement;
        for (const el of fields.slice(0, 40)) {
            const rest = ringsOf(el);
            const boxRest = huggingRing(el);
            el.focus({ preventScroll: true });
            await new Promise((r) => setTimeout(r, 260));
            const focus = document.activeElement === el ? ringsOf(el) : rest;
            const boxFocus = document.activeElement === el ? huggingRing(el) : boxRest;
            el.blur();
            const why = [];
            if (rest.includes('border') && boxRest) why.push(`at rest: its border inside ${boxRest.box}'s ${boxRest.rings.join('+')}`);
            if (focus.length && boxFocus) why.push(`focused: its ${focus.join('+')} inside ${boxFocus.box}'s ${boxFocus.rings.join('+')}`);
            if (focus.includes('outline+gap') && focus.includes('border')) why.push('focused: its border and an outline apart from it');
            if (why.length) {
                const key = `${name(el)}|${why.join('|')}`;
                if (!seen.has(key)) { seen.add(key); doubles.push({ field: name(el), why }); }
            }
        }
        if (before && typeof before.focus === 'function') before.focus({ preventScroll: true });
        return { fields: fields.length, doubles };
    })();
}

module.exports = { RINGS };
