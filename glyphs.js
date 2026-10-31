/**
 * openvibe-shared/glyphs.js — the OpenVibe glyphs: one registry for every icon the network draws (plan L32; the owner,
 * 2026-10-31: "our own custom icon system… replace Font Awesome… with our own… through openvibe.design").
 *
 * One hand for all of them, the mark's: a 24-unit grid, 2-unit round strokes, nothing filled but a dot. The kit's icons
 * (kit.js) are the first of them; the drawings below fill in what the network asked Font Awesome for most, and FA
 * maps every Font Awesome name in use to the glyph that stands for it, so a page can drop Font Awesome as soon as its
 * names are covered. Brand logos (GitHub, YouTube, Discord…) are not ours to redraw and stay as they are.
 *
 *   const glyphs = require('openvibe-shared/glyphs');
 *   glyphs.NAMES                     every glyph's name
 *   glyphs.path(name)                its drawing (the inside of a 24-unit SVG), or ''
 *   glyphs.svg(name, { size, title })  a standalone SVG (stroke currentColor), or ''
 *   glyphs.fromFa('fa-tower-broadcast') → 'live'   the glyph for a Font Awesome name (with or without fa-), or null
 *   glyphs.FA                        { 'tower-broadcast': 'live', … }
 *   glyphs.META[name]                { by, tags } who drew it and what it is for (openvibe.design/icons)
 *
 * In a page, ov-glyphs.js (built from this file by scripts/build-glyphs.js) swaps <i class="fa-… fa-x"> for the glyph,
 * in place, and leaves a name it does not know to Font Awesome.
 */
(function (root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./kit') : root.OpenVibeKit);
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeGlyphs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (kit) {
    'use strict';
    // ── The drawings that join the kit's: 24-unit grid, strokes only (round caps and joins), a dot is a 0.01 line ──
    const DRAWN = {
        scissors: '<circle cx="6" cy="7" r="2.6"/><circle cx="6" cy="17" r="2.6"/><path d="M8.2 8.6 20 18M8.2 15.4 20 6"/>',
        tree: '<path d="M12 3 6.5 10.5h3L5 17h14l-4.5-6.5h3ZM12 17v4"/>',
        pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10" r="2.4"/>',
        volume: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>',
        mute: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z"/><path d="m16 10 4 4M20 10l-4 4"/>',
        tent: '<path d="M2.5 20h19M12 5 4 20M12 5l8 15M12 13.5 9 20M12 13.5l3 6.5"/>',
        food: '<path d="M7 3v7M5 3v4.5a2 2 0 0 0 4 0V3M7 10v11M17 21V3c-2 1.2-3.2 3.6-3.2 7v3H17"/>',
        train: '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9 13h.01M15 13h.01M8.5 21l2-3.5M15.5 21l-2-3.5"/>',
        water: '<path d="M2.5 9c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.8-2 2.4 2 4.7 2M2.5 15c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.8-2 2.4 2 4.7 2"/>',
        dish: '<path d="M5 9.5A9.5 9.5 0 0 0 14.5 19Z"/><path d="m9.5 14.5 4.5-4.5M14.5 4.5a5 5 0 0 1 5 5M14.5 8a1.5 1.5 0 0 1 1.5 1.5"/>',
        history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6M4 4.5v4.1h4.1"/><path d="M12 8v4.2l3 1.8"/>',
        film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
        circle: '<circle cx="12" cy="12" r="8.5"/>',
        sliders: '<path d="M4 7h9.5M18.5 7H20M4 17h3.5M12.5 17H20"/><circle cx="16" cy="7" r="2.3"/><circle cx="10" cy="17" r="2.3"/>',
        leaf: '<path d="M5 19c0-8.5 5-13.6 15-15-.9 9.9-6 15-15 15ZM5 19l8-8"/>',
        clipboard: '<rect x="5.5" y="5" width="13" height="16" rx="2"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>',
        gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 14.5 4-5.5"/><circle cx="12" cy="14.5" r="1.3"/>',
        save: '<path d="M5 4h11l3 3v13H5Z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
        plug: '<path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0ZM12 16.5V21"/>',
        compress: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
        expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
        care: '<path d="M3 15.5h3l4 3h5.5a2 2 0 0 0 0-4H12M7 15.5l2.2-2h3.3"/><path d="M15.5 10s-3.2-2-3.2-4.4a1.9 1.9 0 0 1 3.2-1.3 1.9 1.9 0 0 1 3.2 1.3c0 2.4-3.2 4.4-3.2 4.4Z"/>',
        city: '<path d="M3 21h18M5 21V9h5v12M10 21V4h6v17M16 21v-8h3.5v8M7.5 12h.01M7.5 15.5h.01M13 7.5h.01M13 11h.01M13 14.5h.01"/>',
        wrench: '<path d="M14.5 4a5 5 0 0 0-4.4 7L4 17.1V20h2.9l6.1-6.1a5 5 0 0 0 7-4.4l-3 1.1-2.4-2.4 1.1-3Z"/>',
        music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
        'eye-off': '<path d="M3 12s3.5-6.5 9-6.5c1.6 0 3 .5 4.3 1.2M21 12s-3.5 6.5-9 6.5c-1.6 0-3-.5-4.3-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M4 4l16 16"/>',
        plane: '<path d="M20.5 3.5 3.5 10.5l6.8 3.2 3.2 6.8Z"/><path d="m10.3 13.7 10.2-10.2"/>',
        fire: '<path d="M12 21a6 6 0 0 0 6-6c0-3.8-2.6-6-3.7-9-1.8 2-2.3 4-2.3 4S10.8 8 9.8 6.2C7.6 8.7 6 11.6 6 15a6 6 0 0 0 6 6Z"/>',
        nodes: '<circle cx="12" cy="5" r="2.2"/><circle cx="5.5" cy="18" r="2.2"/><circle cx="18.5" cy="18" r="2.2"/><path d="M11 7 6.5 16M13 7l4.5 9M7.7 18h8.6"/>',
        bridge: '<path d="M2 15.5h20M4.5 15.5V10M19.5 15.5V10M2 9.5c4 0 6-3 10-3s6 3 10 3M8.5 15.5V12M15.5 15.5V12M12 15.5V8"/>',
        'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.4 2.8 2.8L16 9.6"/>',
        'x-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
        'alert-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
        news: '<path d="M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Z"/><path d="M17 9h3v10a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h3.5"/>',
        camera: '<path d="M3.5 8h3.4l1.8-2.8h6.6L17.1 8h3.4v11.5h-17Z"/><circle cx="12" cy="13.3" r="3.4"/>',
        crown: '<path d="M3 8.5 7.5 12.5 12 5.5l4.5 7 4.5-4L19 19H5Z"/>',
        wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v4M4 7.5V18a2 2 0 0 0 2 2h14V9H6.5A2.5 2.5 0 0 1 4 7.5Z"/><path d="M16 14.5h.01"/>',
        chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
        id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 1.7-2.3 3-2.3s2.5.8 3 2.3M15 10h3M15 13.5h3"/>',
        brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1.2V5.5A2 2 0 0 0 9 4ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1.2"/>',
        snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
        mountain: '<path d="M3 20 9.5 8.5l4 6.5 2.5-3.5L21 20Z"/>',
        'mic-off': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 11.6 5.3M19 11c0 .8-.1 1.6-.4 2.3M12 18v3M4 4l16 16"/>',
        database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
        layers: '<path d="m12 3.5 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
        hash: '<path d="M5 9h15M4 15h15M10 3.5 8 20.5M16 3.5l-2 17"/>',
        text: '<path d="M5.5 20 11 4h2l5.5 16M7.6 14h8.8"/>',
        enter: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l4 4-4 4M14 12H4"/>',
        language: '<path d="M4 5h9M8.5 3v2M6 5c.5 3 2.5 6 6 7.5M11 5c-.6 3.4-2.8 6.8-6.5 8.5M12 21l4-9 4 9M13.4 18h5.2"/>',
        idea: '<path d="M9 18h6M10 21h4M8.6 14.6A6 6 0 1 1 15.4 14.6c-.7.6-1.4 1.5-1.4 2.4h-4c0-.9-.7-1.8-1.4-2.4Z"/>',
        dollar: '<path d="M16 7.5C15.3 6 13.8 5 12 5 9.5 5 8 6.3 8 8s1.7 2.6 4 3 4 1.4 4 3.3-1.6 3.2-4 3.2c-1.9 0-3.4-1-4-2.5M12 3v18"/>',
        target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
        'arrow-right': '<path d="M4 12h16M14 6l6 6-6 6"/>', 'arrow-left': '<path d="M20 12H4M10 6l-6 6 6 6"/>',
        'arrow-up': '<path d="M12 20V4M6 10l6-6 6 6"/>', 'arrow-down': '<path d="M12 4v16M6 14l6 6 6-6"/>',
        shirt: '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3Z"/>',
        route: '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.4 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.6"/>',
        reply: '<path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6v1"/>',
        smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
        archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
        'user-check': '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 11l2 2 4-4"/>',
        ticket: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4Z"/><path d="M14 7v10"/>',
        tack: '<path d="M9 3h6l-1 5 3 3H7l3-3ZM12 11v10"/>',
        store: '<path d="M4 9 5.5 4h13L20 9M4 9h16v1.5a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 10.5ZM5 13v7h14v-7M10 20v-4h4v4"/>',
        keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M8 14h8"/>',
        gavel: '<path d="m14 4.5 5.5 5.5M10.5 8l5.5 5.5M12.3 6.3l-6 6 5.4 5.4 6-6M3 21l6.3-6.3M14 21h7"/>',
        drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
        wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
        branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5.5-6.5 4-11 8.5"/>',
        // 4.63.0: the Font Awesome names the network still used most (openvibe.design/icons' "Still Font Awesome", 10-31).
        restroom: '<circle cx="7" cy="4.8" r="1.8"/><circle cx="17" cy="4.8" r="1.8"/><path d="M12 3v18M5.5 21v-5.5H4.5V10.5A1.5 1.5 0 0 1 6 9h2a1.5 1.5 0 0 1 1.5 1.5v5H8.5V21M16 21v-4h-2.5l2-6.6a1 1 0 0 1 1-.9h1a1 1 0 0 1 1 .9l2 6.6H18v4"/>',
        shelter: '<path d="M2.5 10.5 12 3l9.5 7.5M5 9v12M19 9v12"/><circle cx="12" cy="11" r="1.8"/><path d="M9.5 21v-4.5a2.5 2.5 0 0 1 5 0V21"/>',
        'hot-tub': '<circle cx="8" cy="5.5" r="1.8"/><path d="M3 12h18v3.5a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 15.5ZM6 12v-1.5A2.5 2.5 0 0 1 8.5 8H9M13.5 9.5c.8-1-.8-2 0-3M17.5 9.5c.8-1-.8-2 0-3"/>',
        umbrella: '<path d="M3 12a9 9 0 0 1 18 0ZM12 12v6.5a2 2 0 0 1-4 0M12 3v.01"/>',
        parking: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5"/>',
        skull: '<path d="M12 3a7 7 0 0 0-7 7c0 2.3 1.1 3.9 2.5 5v3h9v-3c1.4-1.1 2.5-2.7 2.5-5a7 7 0 0 0-7-7Z"/><circle cx="9.5" cy="10.5" r="1.4"/><circle cx="14.5" cy="10.5" r="1.4"/><path d="M10.5 18v3M13.5 18v3"/>',
        group: '<path d="M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4"/><rect x="7" y="7" width="6" height="5" rx="1"/><rect x="11" y="12" width="6" height="5" rx="1"/>',
        medical: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M12 10.5v6M9 13.5h6"/>',
        shapes: '<circle cx="7.5" cy="7.5" r="3.5"/><path d="m16.5 3.5 4 7h-8ZM14 14h6v6h-6ZM3.5 20l3.5-6 3.5 6Z"/>',
        headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5"/>',
        drive: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M3.5 13 6.5 5h11l3 8M17 16.5h.01M14 16.5h.01"/>',
        'check-double': '<path d="m2.5 12.5 4 4L15 8M11 16.5l1 1L21.5 8"/>',
        tv: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="m8 3 4 4 4-4"/>',
        toolbox: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M3 13h18M8 11.5v3M16 11.5v3"/>',
        table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 15h18M9 9.5V20M15 9.5V20"/>',
        scale: '<path d="M12 3.5V21M8 21h8M4.5 7h15M12 3.5h.01M2.5 14 5 7.5 7.5 14M16.5 14 19 7.5l2.5 6.5M2.5 14a2.5 2.5 0 0 0 5 0M16.5 14a2.5 2.5 0 0 0 5 0"/>',
        road: '<path d="M8 3 4 21M16 3l4 18M12 4v2.5M12 10.5v3M12 17.5V20"/>',
        money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v.01M18 14.5v.01"/>',
        'heart-pulse': '<path d="M19.8 12.5c-1.9 4-7.8 7.5-7.8 7.5s-5.9-3.5-7.8-7.5M3.4 9.5A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8.6 2.5"/><path d="M2.5 12h4.5l1.5-2.5 2.5 5 2-3.5h8.5"/>',
        heading: '<path d="M6 4v16M18 4v16M6 12h12M4 4h4M16 4h4M4 20h4M16 20h4"/>',
        fist: '<path d="M7.5 11V7.5a1.5 1.5 0 0 1 3 0V10M10.5 9.5v-3a1.5 1.5 0 0 1 3 0v3M13.5 9.5v-2a1.5 1.5 0 0 1 3 0V10M16.5 10V9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7H12a5.5 5.5 0 0 1-5.5-5.5V13A2 2 0 0 1 8.5 11h2a1.5 1.5 0 0 1 0 3H9"/>',
        'fast-forward': '<path d="M3.5 6.5v11L11 12ZM12.5 6.5v11L20 12Z"/>',
        rewind: '<path d="M20.5 6.5v11L13 12ZM11.5 6.5v11L4 12Z"/>',
        'file-code': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M10 12.5 8 14.5l2 2M14 12.5l2 2-2 2"/>',
        dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" stroke-width="2.6"/>',
        contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 7.5h7M12 12h9M12 16.5h7"/>',
        briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h7.5M13.5 12.5H21M10.5 11.5h3v2.5h-3Z"/>',
        timeline: '<path d="M3 12h1M8 12h2M14 12h2M20 12h1"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 10V5.5M12 14v4.5M18 10V5.5"/>',
        seedling: '<path d="M12 21v-9M12 12C12 8 9.5 5.5 5 5.5c0 4 2.5 6.5 7 6.5ZM12 14.5c0-4 2.5-6.5 7-6.5 0 4-2.5 6.5-7 6.5Z"/>',
        rocket: '<path d="M12 15.5 8.5 12C10 6.5 14 3.5 20.5 3.5 20.5 10 17.5 14 12 15.5ZM8.5 12 5 11.5 7.5 8h4M12 15.5l.5 3.5 3.5-2.5v-4M6.5 17.5c-1.5 0-3 1.5-3 3 1.5 0 3-1.5 3-3Z"/><circle cx="15.5" cy="8.5" r="1.5"/>',
        'list-ordered': '<path d="M10 6h11M10 12h11M10 18h11M4 4.5 5 4v4.5M4 8.5h2M4 13a1 1 0 0 1 2 .3c0 1.1-2 1.7-2 2.7h2.2"/>',
        lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>',
        infinity: '<path d="M12 12c-2-2.7-3.7-4-5.5-4a4 4 0 0 0 0 8c1.8 0 3.5-1.3 5.5-4Zm0 0c2 2.7 3.7 4 5.5 4a4 4 0 0 0 0-8c-1.8 0-3.5 1.3-5.5 4Z"/>',
        inbox: '<path d="M3 13.5 5.5 5h13l2.5 8.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1ZM3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>',
        door: '<path d="M14 4.5 6 3v18l8-1.5ZM14 5h3.5a1 1 0 0 1 1 1v15M3 21h18M11 12h.01"/>',
        card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
        storm: '<path d="M7 17.5a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18.5 10a3.8 3.8 0 0 1-.5 7.5"/><path d="m13 13-2.5 4h3L11 21"/>',
        // A spinner is never drawn as one (the owner, 2026-10-31: nothing spins): three dots that take turns (ov-glyphs.js).
        busy: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3.4"/>',
    };
    const BY = { kit: 'the OpenVibe Kit', opus: 'drawn by Opus for the glyph set (2026-10-31)' };
    const ALL = { ...(kit && kit.PATHS ? kit.PATHS : {}), ...DRAWN };
    const NAMES = Object.freeze(Object.keys(ALL).sort());
    const META = Object.freeze(Object.fromEntries(NAMES.map((n) => [n, { by: DRAWN[n] ? BY.opus : BY.kit, tags: [] }])));

    // ── Font Awesome's names, as the network uses them, mapped to the glyph that stands for each ──
    const FA = Object.freeze({
        'wand-magic-sparkles': 'spark', 'wand-magic': 'spark', sparkles: 'spark', 'star-of-life': 'spark', eye: 'eye', 'eye-slash': 'eye-off',
        'tower-broadcast': 'live', 'broadcast-tower': 'live', 'satellite-dish': 'dish', 'tower-cell': 'live', 'signal': 'wifi', wifi: 'wifi',
        xmark: 'close', times: 'close', 'circle-xmark': 'x-circle', 'xmark-circle': 'x-circle', video: 'video', 'video-slash': 'video', camera: 'camera',
        robot: 'robot', scissors: 'scissors', cut: 'scissors', copy: 'copy', paste: 'clipboard', clipboard: 'clipboard', 'clipboard-list': 'clipboard',
        bolt: 'zap', 'bolt-lightning': 'zap', check: 'check', 'check-circle': 'check-circle', 'circle-check': 'check-circle',
        comments: 'chat', comment: 'chat', 'comment-dots': 'chat', message: 'chat', play: 'play', 'circle-play': 'play', pause: 'pause', stop: 'stop',
        tree: 'tree', spinner: 'busy', 'circle-notch': 'busy', 'map-pin': 'pin', 'location-dot': 'pin', 'location-pin': 'pin', map: 'map', route: 'route',
        globe: 'globe', 'earth-americas': 'globe', 'earth-europe': 'globe', language: 'language', code: 'code', terminal: 'terminal', 'code-branch': 'branch', 'code-fork': 'branch',
        coins: 'coin', coin: 'coin', 'hand-holding-dollar': 'coin', 'dollar-sign': 'dollar', wallet: 'wallet', clock: 'clock', 'clock-rotate-left': 'history', 'rotate-left': 'retry',
        rotate: 'retry', 'rotate-right': 'retry', 'arrows-rotate': 'retry', 'arrow-rotate-right': 'retry', 'shield-halved': 'shield', shield: 'shield', 'user-shield': 'shield',
        plus: 'plus', minus: 'minus', lock: 'lock', unlock: 'lock', key: 'key', 'arrow-right': 'arrow-right', 'arrow-left': 'arrow-left', 'arrow-up': 'arrow-up', 'arrow-down': 'arrow-down',
        'chevron-right': 'chevron', 'chevron-left': 'back', 'chevron-down': 'down', 'chevron-up': 'up', 'angle-right': 'chevron', 'angle-down': 'down',
        star: 'star', 'volume-high': 'volume', 'volume-low': 'volume', 'volume-xmark': 'mute', 'volume-off': 'mute', 'triangle-exclamation': 'alert',
        'circle-exclamation': 'alert-circle', 'circle-info': 'info', 'circle-question': 'help', question: 'help', link: 'link', image: 'image', images: 'image',
        'file-image': 'image', 'photo-film': 'film', film: 'film', user: 'user', 'user-secret': 'user', 'user-astronaut': 'user', 'user-plus': 'invite',
        'user-check': 'user-check', users: 'members', 'people-group': 'members', 'user-group': 'members', server: 'server', database: 'database',
        'magnifying-glass': 'search', search: 'search', campground: 'tent', utensils: 'food', train: 'train', heart: 'heart', 'hand-holding-heart': 'care', water: 'water',
        'person-swimming': 'water', house: 'home', 'house-chimney': 'home', download: 'download', upload: 'upload', 'cloud-arrow-up': 'upload', circle: 'circle',
        sliders: 'sliders', 'sliders-h': 'sliders', leaf: 'leaf', gamepad: 'game', microphone: 'mic', 'microphone-slash': 'mic-off',
        'arrow-up-right-from-square': 'open', 'up-right-from-square': 'open', 'external-link': 'open', palette: 'palette', bell: 'bell', 'gauge-high': 'gauge', gauge: 'gauge',
        'floppy-disk': 'save', trash: 'trash', 'trash-can': 'trash', 'chart-line': 'chart', plug: 'plug', compress: 'compress', expand: 'expand',
        'up-right-and-down-left-from-center': 'expand', pen: 'pencil', 'pen-nib': 'pencil', pencil: 'pencil', 'pen-to-square': 'pencil', city: 'city', ban: 'ban',
        'screwdriver-wrench': 'wrench', wrench: 'wrench', music: 'music', gear: 'gear', gears: 'gear', 'paper-plane': 'plane', fire: 'fire',
        'circle-nodes': 'nodes', 'network-wired': 'nodes', 'diagram-project': 'nodes', sitemap: 'nodes', bridge: 'bridge', envelope: 'mail', sun: 'sun', moon: 'moon',
        'list-check': 'steps', list: 'list', 'list-ul': 'list', bars: 'menu', display: 'computer', desktop: 'computer', laptop: 'computer', 'wave-square': 'wave',
        newspaper: 'news', 'file-lines': 'file', file: 'file', 'file-pdf': 'file', 'file-audio': 'file', folder: 'folder', book: 'book', 'book-open': 'book', crown: 'crown',
        microchip: 'chip', 'id-card': 'id', brain: 'brain', cloud: 'cloud', 'cloud-sun': 'cloud', 'cloud-rain': 'cloud', 'cloud-showers-heavy': 'cloud', snowflake: 'snow',
        mountain: 'mountain', 'mountain-sun': 'mountain', 'layer-group': 'layers', hashtag: 'hash', font: 'text', 'text-height': 'text',
        'right-from-bracket': 'leave', 'right-to-bracket': 'enter', 'arrow-right-from-bracket': 'leave', 'arrow-right-to-bracket': 'enter',
        gift: 'gift', lightbulb: 'idea', 'cart-shopping': 'cart', cart: 'cart', bullseye: 'target', trophy: 'trophy', tag: 'tag', tags: 'tag', shirt: 'shirt', reply: 'reply',
        'face-smile': 'smile', 'box-archive': 'archive', ticket: 'ticket', thumbtack: 'tack', store: 'store', keyboard: 'keyboard', gavel: 'gavel', droplet: 'drop',
        flag: 'flag', calendar: 'calendar', 'calendar-days': 'calendar', phone: 'phone', 'mobile-screen': 'phone', 'hand': 'hand', 'hand-pointer': 'hand', grid: 'grid',
        'table-cells': 'grid', 'chart-simple': 'chart', 'chart-bar': 'chart', 'filter': 'filter', 'ellipsis': 'more', 'ellipsis-vertical': 'more', 'share-nodes': 'nodes',
        // 4.63.0
        restroom: 'restroom', 'person-shelter': 'shelter', 'hot-tub-person': 'hot-tub', 'hot-tub': 'hot-tub', umbrella: 'umbrella', 'umbrella-beach': 'umbrella',
        'square-parking': 'parking', parking: 'parking', 'skull-crossbones': 'skull', skull: 'skull', 'object-group': 'group', 'kit-medical': 'medical',
        'briefcase-medical': 'medical', 'suitcase-medical': 'medical', 'info-circle': 'info', icons: 'shapes', shapes: 'shapes', headphones: 'headphones',
        'headphones-simple': 'headphones', headset: 'headphones', 'hard-drive': 'drive', hdd: 'drive', 'check-double': 'check-double', tv: 'tv',
        television: 'tv', toolbox: 'toolbox', table: 'table', 'table-list': 'table', 'scale-balanced': 'scale', 'balance-scale': 'scale',
        road: 'road', 'people-arrows': 'members', 'money-bill': 'money', 'money-bill-1': 'money', 'money-bill-wave': 'money', 'money-bill-transfer': 'money',
        'money-check': 'money', 'heart-pulse': 'heart-pulse', heartbeat: 'heart-pulse', heading: 'heading', 'hand-fist': 'fist', 'fist-raised': 'fist',
        forward: 'fast-forward', 'forward-fast': 'fast-forward', backward: 'rewind', 'backward-fast': 'rewind', 'file-code': 'file-code', dice: 'dice',
        'dice-five': 'dice', 'dice-six': 'dice', 'circle-half-stroke': 'contrast', adjust: 'contrast', briefcase: 'briefcase', suitcase: 'briefcase',
        timeline: 'timeline', seedling: 'seedling', rocket: 'rocket', 'right-left': 'swap', 'arrow-right-arrow-left': 'swap', 'exchange-alt': 'swap',
        'person-hiking': 'mountain', hiking: 'mountain', 'microphone-lines': 'mic', 'list-ol': 'list-ordered', 'life-ring': 'lifebuoy', infinity: 'infinity',
        inbox: 'inbox', 'folder-open': 'folder', 'faucet-drip': 'drop', faucet: 'drop', 'face-grin-stars': 'smile', 'door-open': 'door',
        'door-closed': 'door', 'credit-card': 'card', 'cloud-bolt': 'storm',
    });

    const path = (name) => (Object.prototype.hasOwnProperty.call(ALL, name) ? ALL[name] : '');
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function svg(name, { size = 24, title = '' } = {}) {
        const d = path(name);
        if (!d) return '';
        const label = title ? ` role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>` : ' aria-hidden="true">';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${Number(size) || 24}" height="${Number(size) || 24}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${label}${d}</svg>`;
    }
    const fromFa = (fa) => { const n = String(fa || '').replace(/^fa-/, ''); return Object.prototype.hasOwnProperty.call(FA, n) && path(FA[n]) ? FA[n] : null; };

    return { NAMES, META, FA, DRAWN: Object.freeze(Object.keys(DRAWN)), path, svg, fromFa };
});
