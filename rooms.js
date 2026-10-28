/**
 * openvibe-shared/rooms — OpenVibe's rooms (plan 2026-10-28 §3.1, §3.5): one table every site reads for a room's
 * neighbourhood, its accent, its hero line and its motif, so a room looks like itself on every page that shows it.
 *
 * The accents sit every 25° of OKLCH hue. Each `dark` value passes AA against #0B0D12 (text, icons and fills on dark
 * themes, with dark text on the fill); each `light` value passes AA against white (text and filled buttons on light
 * themes, with white text). Put rooms.style(id) on the room's wrapper with the class ov-room: room.css then gives
 * --room-accent (the right one for the theme's mode), --room-strong (text on the page) and --room-on (text on a fill).
 *
 *   const rooms = require('openvibe-shared/rooms');
 *   rooms.get('surf')   → { id, name, host, hood, hue, dark, light, line, motif, icon }
 *   rooms.style('surf') → '--room-dark:#00BEF6;--room-light:#0072AB'
 *   rooms.HOODS          → { streams: 'Streams & places', … } (the menu's neighbourhoods; Network's frame is the authority)
 * In the browser: window.OpenVibeRooms, the same.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeRooms = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const HOODS = Object.freeze({
        streams: 'Streams & places', games: 'Games & laughs', answers: 'News & answers',
        make: 'Make & build', shop: 'Shop & swap', people: 'People & you', build: 'For developers',
    });

    // id, name in menus, host, neighbourhood, OKLCH hue, dark accent, light accent, hero line (≤ 8 words), kit icon, motif
    const ROWS = [
        ['fun', 'Fun', 'openvibe.fun', 'games', 350, '#F47DB9', '#A42C71', 'Something to do, alone, together, or live', 'spark', 'a city map where idea pins pop up and a quest card flips'],
        ['shoes', 'Shoes', 'open.shoes', 'shop', 25, '#FF7E76', '#B02A2D', 'Every shoe, every market, the right price', 'shoe', 'a shoe drawn as one line, price tags from several stores sliding into one all-in price'],
        ['tours', 'Tours', 'openvibe.tours', 'streams', 50, '#F98942', '#AA3900', 'Go anywhere: fly, stay, walk, watch', 'map', 'a plane\'s dotted arc landing on a map, then the walking route drawing itself'],
        ['today', 'Today', 'openvibe.today', 'answers', 75, '#E49900', '#994E00', 'Everything happening for you, today', 'calendar', 'the day\'s ring with events as dots and "now" sweeping; the brief\'s lines typing in'],
        ['meme', 'Meme', 'openvibe.meme', 'games', 100, '#C3AC00', '#7B6100', 'The internet\'s meme database, rebuilt with AI', 'image', 'a family tree of memes growing branch by branch, stickers fanning out'],
        ['domains', 'Domains', 'openvibe.domains', 'make', 125, '#94BB3B', '#4D7100', 'Name it, price it, run it', 'globe', 'a name typing itself while extensions cycle, prices settling into a sorted list'],
        ['casino', 'Casino', 'openvibe.casino', 'games', 150, '#51C672', '#007C25', 'Learn it, play it, never pay it', 'game', 'a card fan and chips, with a probability curve drawing beneath'],
        ['exchange', 'Exchange', 'openvibe.exchange', 'shop', 175, '#00CAA5', '#007F5E', 'Trade what people make', 'swap', 'two arrows looping an item between makers, and a passport card stamping "safe"'],
        ['cam', 'Cam', 'openvibe.cam', 'streams', 200, '#00C7D2', '#007C89', 'Your camera, the world\'s cams, face to face', 'video', 'a shutter iris opening onto a grid of live cams, a flash, the photo flying to a gallery'],
        ['surf', 'Surf', 'openvibe.surf', 'games', 225, '#00BEF6', '#0072AB', 'Ride maps, surf the web, surf what\'s on', 'wave', 'a first-person surf run: ramps, speed lines, the timer ticking'],
        ['report', 'Report', 'openvibe.report', 'answers', 250, '#50B0FF', '#0064BE', 'Every number on OpenVibe, honest', 'chart', 'live counters ticking, a line chart drawing itself, the after-show card sliding in'],
        ['website', 'Website', 'openvibe.website', 'make', 275, '#8EA0FF', '#4B53C2', 'Serious sites, no login needed', 'computer', 'a browser frame assembling a real site from blocks while a cursor types the prompt'],
        ['vision', 'Vision', 'openvibe.vision', 'answers', 300, '#BB91FF', '#7444B4', 'See with the best model for the job', 'eye', 'an aperture with two models\' boxes racing on the same image, cost and time ticking'],
        ['design', 'Design', 'openvibe.design', 'make', 325, '#DD84E2', '#913797', 'Make it yours, find the best AI designer', 'palette', 'the theme orb: drag it and the whole page recolours live; an A/B vote flips'],
    ];
    const ROOMS = Object.freeze(Object.fromEntries(ROWS.map(([id, name, host, hood, hue, dark, light, line, icon, motif]) =>
        [id, Object.freeze({ id, name, host, hood, hue, dark, light, line, icon, motif })])));
    const IDS = Object.freeze(ROWS.map((r) => r[0]));

    const byHost = new Map(ROWS.map((r) => [r[2], r[0]]));
    /** A room by id or host ('surf', 'openvibe.surf', 'www.open.shoes'); null when it is not a room. */
    function get(key) {
        const k = String(key || '').toLowerCase().replace(/^www\./, '');
        return ROOMS[k] || ROOMS[byHost.get(k)] || null;
    }
    /** The custom properties a room's wrapper carries (class ov-room); '' for an unknown room (the theme's accent stays). */
    function style(key) {
        const r = get(key);
        return r ? `--room-dark:${r.dark};--room-light:${r.light}` : '';
    }

    return { HOODS, ROOMS, IDS, get, style, VERSION: 1 };
});
