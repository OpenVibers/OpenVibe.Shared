/**
 * openvibe-shared/ov-icons.js — the OpenVibe animated icon family.
 *
 *   <span class="ov-icon" data-icon="youtube" data-size="40"></span>
 *   <span class="ov-icon" data-icon="pdf" data-state="busy" data-progress="0.4" data-fx="orbit"></span>
 *
 * One construction for every icon so the network reads as one brand: the OV ring (with its comet)
 * around a glyph drawn in the theme accent. The ring is also a progress meter (data-progress 0–1)
 * and a status light (data-state idle|busy|ok|error), so the same icon that names a tool can show
 * what the tool is doing. Glyphs are 24×24 stroke paths centred in the ring.
 *
 *   OpenVibeIcons.names()                          every registered icon
 *   OpenVibeIcons.register(name, { glyph, fx?, accent? })
 *   OpenVibeIcons.mount(root?)                     (re)scan; new nodes are picked up automatically
 *   OpenVibeIcons.set(el, { progress, state, icon })
 *   OpenVibeIcons.svg(name, size)                  markup string, for server-side / templates
 *
 * Nothing moves at rest (the owner, 10-31 and 11-07: "things only spin if they're active"; the comet spun forever on
 * every icon until 4.128.0). The comet, the pulse and the bounce run only while data-state="busy"; at rest an icon is
 * its ring and glyph, with a small lift on hover where a pointer hovers. "draw" plays once when an icon appears.
 * Effects (data-fx, what busy looks like): orbit (default) · pulse · draw · bounce · none. Motion is opacity/stroke inside the
 * SVG and transform on the <svg> element only: no CSS transform ever touches an element inside the SVG
 * (transform-box/transform-origin on SVG children left glyphs and whole icons unpainted on phones while
 * scrolling), and hover effects apply only where a pointer can hover, so a thumb scrolling over a link
 * starts nothing. Calm slows the loops; only motion off stops them. Unknown names fall back to the OV mark "V".
 */
(function (root) {
    'use strict';
    if (root.OpenVibeIcons) return;

    const P = (d) => `<path d="${d}"/>`;
    // Glyphs: stroke-only, 24×24 box, designed to sit inside the ring.
    const GLYPHS = {
        ov: '<path d="M3.5 4.4L12 19.8l8.5-15.5"/>',
        network: '<circle cx="12" cy="6.1" r="2"/><circle cx="5.5" cy="17.1" r="2"/><circle cx="18.5" cy="17.1" r="2"/><path d="M12 8.1v3.5M12 11.6L6.8 15.5M12 11.6l5.2 3.9"/>',
        live: '<circle cx="12" cy="12" r="1.9"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.7M15.8 8.2a5.4 5.4 0 0 1 0 7.7M5.9 6a8.5 8.5 0 0 0 0 11.9M18.1 6a8.5 8.5 0 0 1 0 11.9"/>',
        tools: '<path d="M16.9 4a5.2 5.2 0 0 0-6.7 6.7L4 16.8a2.2 2.2 0 0 0 3.2 3.2l6.2-6.2a5.2 5.2 0 0 0 6.7-6.7l-3.3 3.3l-2.6-0.7l-0.7-2.6Z"/>',
        media: '<rect x="3.5" y="5.6" width="17" height="12.7" rx="2.1"/><path d="M9.9 9.3v5.3l4.8-2.7Z"/>',
        games: '<path d="M7.2 7.7h9.5a3.9 3.9 0 0 1 3.8 4.7l-0.6 2.5a1.9 1.9 0 0 1-3.3 0.8L15.3 14.4h-6.7l-1.2 1.2a1.9 1.9 0 0 1-3.3-0.8l-0.6-2.5A3.9 3.9 0 0 1 7.2 7.7ZM8.1 10.1v2.8M6.7 11.5h2.8"/><circle cx="15.3" cy="10.6" r="0.6"/><circle cx="17.2" cy="12.5" r="0.6"/>',
        community: '<circle cx="8.9" cy="8.5" r="2.7"/><circle cx="16.7" cy="9.5" r="2.1"/><path d="M3.4 18.3a5.5 5.5 0 0 1 10.9 0M14.7 13.9a4.2 4.2 0 0 1 5.9 4"/>',
        chat: '<path d="M5 5.9h14.2a1.5 1.5 0 0 1 1.5 1.5v7.1A1.5 1.5 0 0 1 19.2 15.8h-7.1l-4.1 3v-3H5A1.5 1.5 0 0 1 3.5 14.3V7.2A1.5 1.5 0 0 1 5 5.9ZM7.8 9.7h8.1M7.8 12.5h5.1"/>',
        codes: '<path d="M8.6 7.5L3.5 12L8.6 16.5M15.4 7.5l5.1 4.5l-5.1 4.5M13.4 5.2l-2.7 13.6"/>',
        bot: '<rect x="5.4" y="9.5" width="13.2" height="9.4" rx="2.5"/><circle cx="12" cy="5.5" r="1.1"/><path d="M12 6.6V9.5M9.6 13.5v1.5M14.4 13.5v1.5M3.5 13.1v2.5M20.5 13.1v2.5"/>',
        code: '<path d="M8.6 7.5L3.5 12L8.6 16.5M15.4 7.5l5.1 4.5l-5.1 4.5M13.4 5.2l-2.7 13.6"/>',
        blog: '<path d="M3.5 20.5l1.5-5.1L16.8 3.5l3.6 3.6l-11.9 11.9ZM14.4 5.9l3.6 3.6"/>',
        wiki: '<path d="M3.5 4.1h7.3a2.4 2.4 0 0 1 2.4 2.4V20.5a2.4 2.4 0 0 0-2.4-2.4H3.5ZM20.5 4.1h-4.9a2.4 2.4 0 0 0-2.4 2.4V20.5a2.4 2.4 0 0 1 2.4-2.4h4.9Z"/>',
        news: '<rect x="3.5" y="5.1" width="13.8" height="13.8" rx="1.6"/><path d="M17.4 8.9h3.2v8.5a1.6 1.6 0 0 1-3.2 0M6.7 8.9h7.4M6.7 12.1h7.4M6.7 15.2h4.2"/>',
        reviews: '<path d="M12 3.6l2.6 5.4l5.9 0.8l-4.2 4.1l1.1 5.9l-5.3-2.8l-5.3 2.8l1.1-5.9L3.6 9.8l5.9-0.8Z"/>',
        tips: '<path d="M12 20.5s-8.5-5-8.5-11.2A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.5 3.1C20.5 15.5 12 20.5 12 20.5Z"/>',
        vip: '<path d="M3.5 15.9L5.2 6.3l4.3 4L12 4.6l2.5 5.7L18.8 6.3l1.7 9.6ZM4.1 18.7h15.9"/>',
        trade: '<path d="M3.2 18h17.1M5.6 14l4.1-4.6l3.5 2.8l5.2-6.9M18.1 5.2h-3.5M18.1 5.2v3.5"/>',
        host: '<rect x="3.5" y="4.1" width="17" height="6.2" rx="1.4"/><rect x="3.5" y="13.7" width="17" height="6.2" rx="1.4"/><circle cx="6.9" cy="7.2" r="0.7"/><circle cx="6.9" cy="16.8" r="0.7"/>',
        deals: '<path d="M3.8 11.7V3.8h7.9l9.1 9.1l-7.9 7.9ZM7.9 7.9h0"/>',
        coupons: '<path d="M3.6 7.8h17v2.7a1.6 1.6 0 0 0 0 3.2v2.7H3.6V13.6a1.6 1.6 0 0 0 0-3.2ZM9.9 7.8v8.5"/>' ,
        stream: '<path d="M3.5 19.8L12 5.8l8.5 14M7.1 14.3h9.7"/><circle cx="12" cy="5.8" r="1.7"/>',
        youtube: '<rect x="3.5" y="6.5" width="17" height="11" rx="3"/>' + P('M10.5 9.8v4.4l3.8-2.2z'),
        video: '<rect x="3.5" y="6.5" width="17" height="11" rx="3"/>' + P('M10.5 9.8v4.4l3.8-2.2z'),
        download: '<path d="M12 3v11.9M7.2 10.8l4.8 4.8l4.8-4.8M3.7 20.2h16.6"/>',
        upload: '<path d="M12 15.9v-12.1M7.1 8l4.9-4.9l4.9 4.9M3.5 20.1h17"/>',
        image: '<rect x="3.5" y="4.4" width="17.1" height="15.1" rx="2.1"/><circle cx="8.8" cy="9.7" r="1.6"/><path d="M4 17.4l4.9-4.9l3.8 3.8l2.7-2.7l4.9 4.9"/>',
        audio: '<path d="M8.8 17.7V5.8l11.3-2.5V15.2"/><circle cx="6" cy="17.7" r="2.7"/><circle cx="17.3" cy="15.2" r="2.7"/>',
        pdf: '<path d="M6.1 3.5h7.9l4.5 4.5V19.9a0.6 0.6 0 0 1-0.6 0.6h-11.9A0.6 0.6 0 0 1 5.5 19.9V4a0.6 0.6 0 0 1 0.6-0.6ZM14 3.5v4.5h4.5M8.4 13.1h6.8M8.4 16.5h4.5"/>',
        docs: '<path d="M6.1 3.5h7.9l4.5 4.5V19.9a0.6 0.6 0 0 1-0.6 0.6h-11.9A0.6 0.6 0 0 1 5.5 19.9V4a0.6 0.6 0 0 1 0.6-0.6ZM14 3.5v4.5h4.5M8.4 13.1h6.8M8.4 16.5h4.5"/>',
        text: '<path d="M3.5 5.8V3.9h17V5.8M12 3.9v17M8.7 20.9h6.5"/>',
        logo: '<path d="M10.5 3.5l1.9 4.5l4.5 1.9l-4.5 1.9L10.5 16.2l-1.9-4.5L4.2 9.9l4.5-1.9ZM16.9 15.2l0.8 1.8l1.8 0.8l-1.8 0.8l-0.8 1.8l-0.8-1.8l-1.8-0.8l1.8-0.8Z"/>',
        json: '<path d="M8.3 4c-2.5 0-2.5 1.9-2.5 3.7s0 4.3-2.5 4.3c2.5 0 2.5 2.5 2.5 4.3s0 3.7 2.5 3.7M15.7 4c2.5 0 2.5 1.9 2.5 3.7s0 4.3 2.5 4.3c-2.5 0-2.5 2.5-2.5 4.3s0 3.7-2.5 3.7"/>',
        dns: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.8 2.3 2.8 14.7 0 17M12 3.5c-2.8 2.3-2.8 14.7 0 17"/>',
        ip: '<path d="M12.1 20.9s-6.7-5.7-6.7-11.1a6.7 6.7 0 0 1 13.3 0c0 5.3-6.7 11.1-6.7 11.1Z"/><circle cx="12.1" cy="9.7" r="2.4"/>',
        ssl: '<rect x="5" y="10.2" width="14.1" height="10" rx="2.1"/><path d="M7.9 10.2V7.2a4.1 4.1 0 0 1 8.2 0V10.2M12 14.3v2.3"/>',
        ping: P('M3.5 12h4l2-5 3.5 10 2.5-7 1.5 2h3.5'),
        whois: '<circle cx="10.4" cy="10.4" r="6.7"/><path d="M15.5 15.5L20.7 20.7M7.9 9.2a2.4 2.4 0 0 1 4.9 0c0 1.8-2.4 1.9-2.4 3.6M10.4 15.3h0"/>',
        search: '<circle cx="10.4" cy="10.4" r="6.7"/><path d="M15.5 15.5L20.7 20.7"/>',
        map: '<path d="M3.5 6.3l5.7-2.3l5.7 2.3l5.7-2.3v13.6l-5.7 2.3l-5.7-2.3l-5.7 2.3ZM9.2 4.1v13.6M14.8 6.3v13.6"/>',
        food: '<path d="M6.5 3.8v6.9a2.3 2.3 0 0 0 4.6 0v-6.9M8.7 3.8v17.1M17.5 3.8c-2.3 1.7-2.8 4.6-2.8 7.5h2.8ZM17.5 11.2v9.7"/>',
        // Page furniture the product homes name (2026-10-10, 2.21.1).
        gauge: '<path d="M3.3 16.5a8.6 8.6 0 1 1 17.1 0M11.9 16.5l4.1-5.2"/><circle cx="11.9" cy="16.5" r="0.8"/>',
        link: '<path d="M9.6 14.4a4.2 4.2 0 0 0 6.1 0l3.6-3.6a4.2 4.2 0 0 0-6.1-6.1l-1.2 1.2M14.4 9.6a4.2 4.2 0 0 0-6.1 0l-3.6 3.6a4.2 4.2 0 0 0 6.1 6.1l1.2-1.2"/>',
        shield: '<path d="M12 3.5L19.5 6.3v5.8c0 4.6-3.2 7.6-7.5 8.6c-4.3-1-7.5-4.1-7.5-8.6V6.3Z"/>',
        plug: '<path d="M8.7 3.9V7.9M15.5 3.9V7.9M6.4 7.9h11.3v3.4a5.7 5.7 0 0 1-11.3 0ZM12.1 16.9v4"/>',
        // Products (2026-10-10): the sites that had only the "V"; a solid twin where its glyph has one (RING_SOLIDS, scripts/build-navbar-icons.js).
        work: '<rect x="3.5" y="7.6" width="17" height="11.7" rx="2.1"/><path d="M8.8 7.6V6A1.6 1.6 0 0 1 10.4 4.4h3.2A1.6 1.6 0 0 1 15.2 6V7.6M3.5 12.9h17"/>',
        rent: '<circle cx="7.5" cy="11.8" r="3.8"/><path d="M11.4 11.8H20.7M17.4 11.8v3.3M20.7 11.8v2.7"/>',
        help: '<circle cx="12" cy="12.1" r="8.5"/><circle cx="12" cy="17" r="0.7"/><path d="M9.4 9.6a2.7 2.7 0 1 1 3.6 2.4c-0.7 0.3-1.1 0.8-1.1 1.6v0.6"/>',
        quest: '<path d="M7 3.8h9.8v5a5 5 0 0 1-9.8 0ZM7 5.6H4a3 3 0 0 0 3.2 4.3M17 5.6h3a3 3 0 0 1-3.2 4.3M12 13.6v3.7M8.3 21h7.4M9.6 17.3h5"/>',
        inventory: '<path d="M3.5 7.5L12 3.5l8.5 4v9.1L12 20.5l-8.5-4ZM3.5 7.5L12 11.5l8.5-4M12 11.5v9.1"/>',
        play: '<path d="M3.5 19.8h17M5 19.8v-5h4.5v5M9.5 19.8v-8.5h5V19.8M14.5 19.8v-6.5H19V19.8M12 3.6l0.9 1.8l2 0.3l-1.4 1.4l0.3 2l-1.8-0.9l-1.8 0.9l0.3-2l-1.4-1.4l2-0.3Z"/>',
        drive: '<rect x="3.3" y="12.3" width="17.1" height="6.5" rx="1.6"/><circle cx="16.8" cy="15.6" r="0.7"/><path d="M4.3 12.3l2.1-7.5h10.8l2.1 7.5"/>',
        services: '<rect x="3.5" y="12.2" width="7.4" height="7.4" rx="1.1"/><rect x="13.1" y="12.2" width="7.4" height="7.4" rx="1.1"/><rect x="8.3" y="3.7" width="7.4" height="7.4" rx="1.1"/>',
        space: '<circle cx="12" cy="10.1" r="1.6"/><path d="M12 3.5c3.3 2.2 4.9 5.5 4.9 9.9l-2.2 3.3h-5.5l-2.2-3.3c0-4.4 1.6-7.7 4.9-9.9ZM9.3 16.6l-2.2 3.8M14.7 16.6l2.2 3.8"/>',
        watch: '<circle cx="12" cy="12" r="2.5"/>' + P('M3.5 12s3-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3 5.5-8.5 5.5S3.5 12 3.5 12z'),
        actor: '<circle cx="10.1" cy="8.8" r="3.3"/><path d="M3.5 20.4a6.7 6.7 0 0 1 13.4 0M18.4 4.2l0.7 1.5l1.5 0.7l-1.5 0.7l-0.7 1.5l-0.7-1.5l-1.5-0.7l1.5-0.7Z"/>',
        // The three doors of 2026-11-13 (openvibe.expert, openvibe.markets, openvibe.finance): Expert is a person with
        // a spark inside the head (an agent with a soul), Markets is a magnifier over a grid of listings (one search over
        // every marketplace), Finance is a wallet (a person's own money). Each on its own hue: the hue follows the name.
        expert: '<circle cx="12" cy="7.2" r="3.8"/><path d="M12 4.8l0.8 1.7l1.7 0.8l-1.7 0.8l-0.8 1.7l-0.8-1.7l-1.7-0.8l1.7-0.8Z"/><path d="M3.9 20.6a8.1 8.1 0 0 1 16.2 0"/>',
        markets: '<circle cx="10" cy="10" r="6.8"/><path d="M15 15l5.4 5.4M6.2 8.2h5.6M6.2 11.6h5.6M6.2 15h3.4"/>',
        finance: '<rect x="3.5" y="6.4" width="17" height="11.6" rx="2.4"/><path d="M3.5 9.9h17"/><circle cx="16.4" cy="14" r="1.2"/>',
        events: '<path d="M13.5 3.5L6.5 13.5h5l-1 7l7-10h-5Z"/>',
        ai: '<rect x="6.3" y="6.3" width="11.3" height="11.3" rx="1.7"/><path d="M9.7 3.5V6.3M14.3 3.5V6.3M9.7 17.7v2.8M14.3 17.7v2.8M3.5 9.7H6.3M3.5 14.3H6.3M17.7 9.7h2.8M17.7 14.3h2.8"/>',
        run: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/>' + P('M7.5 10l2.5 2-2.5 2M12 14.5h4'),
        billing: '<path d="M3.5 7.4h14.7a2.3 2.3 0 0 1 2.3 2.3v7.9a2.3 2.3 0 0 1-2.3 2.3h-12.5a2.3 2.3 0 0 1-2.3-2.3ZM3.5 7.4l11.3-3.4v3.4M15.9 13.6h2.3"/>',
        feeds: '<circle cx="5.6" cy="18.3" r="1.9"/><path d="M4.3 9.8a9.9 9.9 0 0 1 9.9 9.9M4.3 3.3A16.4 16.4 0 0 1 20.7 19.7"/>',
        // Their own glyphs (11-07; until then each borrowed a neighbour's: Cam showed Video's, Casino and Surf the gamepad,
        // Fun Quest's trophy), so every site in the menu reads at a glance.
        cam: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/>' + P('M8.6 7.5 10 5h4l1.4 2.5') + '<circle cx="12" cy="13.5" r="3.3"/><circle cx="17.3" cy="10.2" r=".6"/>',
        casino: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.6"/><circle cx="8.4" cy="8.4" r="0.8"/><circle cx="15.6" cy="8.4" r="0.8"/><circle cx="12" cy="12" r="0.8"/><circle cx="8.4" cy="15.6" r="0.8"/><circle cx="15.6" cy="15.6" r="0.8"/>',
        surf: '<path d="M3.5 15.8c2 0 2.5-1.4 4.3-1.4S9.8 15.8 12.1 15.8s2.5-1.4 4.3-1.4S18.7 15.8 20.6 15.8M3.5 19.1c2 0 2.5-1.3 4.3-1.3s2.3 1.3 4.4 1.3s2.5-1.3 4.3-1.3s2.3 1.3 4.4 1.3M5.5 12.3C6.5 7.7 10.2 4.2 15.7 4.2c-2.4 1.4-3.6 3.8-3.2 6.7"/>',
        fun: '<path d="M3.6 20.3L8 8.1l7.8 7.8ZM8 8.1l7.8 7.8M13.7 3.3v2.1M17.9 6l1.5-1.5M20.6 10.3h-2.1M16.6 9.1c1-1 2.5-1.3 3.6-0.5"/>',
        meme: '<circle cx="12" cy="11.9" r="8.5"/><path d="M8.1 13.3a3.9 3.9 0 0 0 7.7 0ZM8.3 9.1l1.8 1.1M15.7 9.1l-1.8 1.1"/>',
        tours: '<circle cx="12" cy="12" r="8.5"/><path d="M15.4 8.6l-2 4.8L8.6 15.4l2-4.8Z"/>',
        vision: P('M3.5 12S6.5 6.5 12 6.5 20.5 12 20.5 12 17.5 17.5 12 17.5 3.5 12 3.5 12z') + '<circle cx="12" cy="12" r="2.6"/>',
        shoes: '<path d="M3.5 15.5V10.9l3-1.4l2 1.4l2.3-2.9l4.4 3.8c1.7 1.4 3.3 1.9 5.5 2.1v1.6ZM3.5 15.5h17.1M9.4 11.7l1 1M11.4 10.5l1 1"/>',
        today: '<rect x="4" y="5.4" width="16.1" height="15.1" rx="2.7"/><path d="M4 9.9h16.1M8.2 3.3v3.4M15.9 3.3v3.4"/><circle cx="12.1" cy="15.4" r="1.9"/>',
        report: '<path d="M3.4 20.2h17M6.5 16.5v-4.9M10.7 16.5V6.8M15 16.5v-7.3M19.3 16.5V3.2"/>',
        design: '<path d="M12 3.6l5.3 7.5l-5.3 9.6l-5.3-9.6ZM12 3.6v7.7"/><circle cx="12" cy="12.7" r="1.3"/>',
        domains: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.7 5.2 3.7 8.5S14.5 18.1 12 20.5c-2.5-2.4-3.7-5.2-3.7-8.5S9.5 5.9 12 3.5Z"/>',
        exchange: '<path d="M3.5 8.1h17l-4.2-4.2M20.5 15.9h-17l4.2 4.2"/>',
        bench: '<path d="M3.5 18.5h17M8.6 18.5v-8.5h6.8v8.5M3.5 18.5v-5.1H8.6M15.4 13.4h5.1v5.1"/><circle cx="12" cy="5.7" r="0.8"/>',
        pics: '<rect x="5.9" y="3.5" width="14.7" height="12.5" rx="1.7"/><path d="M3.6 7.5v10.8a2.3 2.3 0 0 0 2.3 2.3H16.7M8.2 13.7l3.4-3.4l2.8 2.8l1.7-1.7l2.8 2.8"/>',
        homes: '<path d="M3.5 10.5L12 3.7l8.5 6.8M5.8 8.8V19.6h12.5V8.8M9.7 19.6v-5.7h4.5v5.7"/>',
        website: '<rect x="3.6" y="5.3" width="17" height="14" rx="2"/><circle cx="6.6" cy="7.3" r="0.7"/><circle cx="8.9" cy="7.3" r="0.7"/><path d="M3.6 9.3h17"/>',
        zone: '<ellipse cx="12" cy="6.2" rx="7.4" ry="2.7"/><path d="M4.6 6.2v11.7c0 1.5 3.3 2.7 7.4 2.7s7.4-1.2 7.4-2.7v-11.7M4.6 12.1c0 1.5 3.3 2.7 7.4 2.7s7.4-1.2 7.4-2.7"/>',
        fund: '<circle cx="15.2" cy="7" r="2.6"/><path d="M3 13.9h3.1L9.9 12.4h4.3a1.6 1.6 0 0 1 0 3.1h-3.1M6.2 19.3l3.1-1.6H15.2l4.8-4.3a1.5 1.5 0 0 0-2.1-2.1l-3.1 2.6"/>',
        paste: '<rect x="5.6" y="5.4" width="12.9" height="15.1" rx="1.9"/><path d="M9.6 5.4V4.4a1.1 1.1 0 0 1 1.1-1.1h3.2a1.1 1.1 0 0 1 1.1 1.1v1.1M9 10.8h6.5M9 14h6.5M9 17.3h3.2"/>',
        account: '<circle cx="12" cy="7.6" r="4.2"/><path d="M3.6 20.7a8.4 8.4 0 0 1 16.9 0"/>',
        // 4.182.0: the products that had no mark of their own drew the fallback "V" in every site grid (Live's and
        // Network's homes showed five of them), and so did a few things sites name as marks (a shoe, a heart, a
        // calendar, a camera). Each has its glyph now.
        computer: '<rect x="3.5" y="4.8" width="17" height="11.3" rx="2"/><path d="M9.2 19.5h5.7M12 16.1v3.4"/>',
        mail: '<rect x="3.5" y="6.2" width="17" height="11.7" rx="2.1"/><path d="M4.6 8.4l7.4 5.3l7.4-5.3"/>',
        lock: '<rect x="5" y="10.2" width="13.9" height="10.1" rx="2.3"/><path d="M8.1 10.2V7.1a3.8 3.8 0 0 1 7.6 0V10.2"/>',
        git: '<circle cx="7.1" cy="5.6" r="2.1"/><circle cx="7.1" cy="18.5" r="2.1"/><circle cx="17.6" cy="7.9" r="2.1"/><path d="M7.1 7.7v8.7M17.6 10c0 4.7-5.9 3.7-9.6 7"/>',
        barcode: '<path d="M3.3 6v12M7.3 6v12M10.6 6v12M14.6 6v12M17.3 6v12M20.5 6v12"/>',
        party: '<rect x="3.5" y="4.1" width="17" height="10.8" rx="2"/><circle cx="8.1" cy="18.6" r="1.5"/><circle cx="16" cy="18.6" r="1.5"/><path d="M10.4 7.5v4.1l3.5-2Z"/>',
        studio: '<circle cx="15.5" cy="7.1" r="2.2"/><circle cx="8.3" cy="12" r="2.2"/><circle cx="16.8" cy="16.9" r="2.2"/><path d="M3.4 7.1h10M17.8 7.1H20.5M3.4 12h2.7M10.5 12H20.5M3.4 16.9h11.2M19 16.9H20.5"/>',
        home: '<path d="M3.5 11.3L12 4.1l8.5 7.3M5.9 10.1V19.2h12.1v-9.1M10.2 19.2v-4.9h3.6v4.9"/>',
        heart: '<path d="M12 20.7s-8.5-5.2-8.5-11.8a4.7 4.7 0 0 1 8.5-2.9a4.7 4.7 0 0 1 8.5 2.9c0 6.5-8.5 11.8-8.5 11.8Z"/>',
        calendar: '<rect x="3.8" y="5.9" width="16.4" height="14.7" rx="2.3"/><path d="M3.8 10.5h16.4M8.5 3.5v4.1M15.5 3.5v4.1"/>',
        camera: '<circle cx="12" cy="12.9" r="3.4"/><path d="M3.5 7.4h3.6l1.8-2.8h6.1L16.9 7.4h3.6v11.5H3.5Z"/>',
        shoe: '<path d="M3.6 14.8v-4.8l3.5-0.5l2.6-3.5l2.8 1.2l-0.8 2.3l3.5 1.9l4.1 0.9a1.8 1.8 0 0 1 1.3 1.7v0.8ZM3.6 17.3h17"/>',
        bell: '<path d="M5 16h14.1l-1.5-2.6V8.9a5.5 5.5 0 0 0-11 0v4.5ZM10.1 19.2a2 2 0 0 0 3.8 0"/>',
        history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.8l3.2 2"/>',
        theme: '<path d="M12.2 3.6a8.6 8.6 0 1 0 0 17.2c1.2 0 1.8-1 1.4-1.9c-0.6-1.2 0.3-2.7 1.7-2.7h1.8a3.6 3.6 0 0 0 3.6-3.6C20.8 7.7 16.9 3.6 12.2 3.6Z"/><circle cx="8" cy="11.1" r="0.8"/><circle cx="11.5" cy="7.7" r="0.8"/><circle cx="15.6" cy="8.8" r="0.8"/>',
        check: '<path d="M3.5 12.4l5.7 5.7l11.3-12.8"/>',
        error: '<path d="M12 3.8v10.9M12 21h0"/>',
        clip: '<path d="M3.5 3.5l17 17M3.5 20.5L20.5 3.5"/>' ,
    };
    // [dx, dy] in glyph units that move each glyph's drawn bounds onto the centre of the ring. Generated.
    const OFFSETS = {"ov":[0,-0.05],"logo":[0.15,0.05],"computer":[0,-0.15],"mail":[0,-0.05],"lock":[0.05,0.2],"git":[-0.35,-0.05],"barcode":[0.1,0],"party":[0,-0.1],"studio":[0.05,0],"home":[0,0.35],"heart":[0,-0.38],"calendar":[0,-0.05],"camera":[0,0.25],"shoe":[-0.1,0.35]};
    const ALIASES = { yt: 'youtube', net: 'dns', dev: 'code', img: 'image', sound: 'audio', document: 'pdf', pastes: 'paste', openre: 'stream', maps: 'map', user: 'account', notifications: 'bell', 'media-hub': 'drive', mediahub: 'drive', sources: 'feeds', agent: 'actor', jobs: 'work', homes: 'homes', page: 'docs', db: 'zone', database: 'zone', location: 'ip', gamepad: 'games', robot: 'bot', deploy: 'upload', copy: 'paste', activity: 'ping',
        // The 2026-10-28 rooms, on the nearest glyph until each has its own (rooms.js): never the fallback mark.
        domains: 'dns', design: 'theme', today: 'history', report: 'gauge', surf: 'games', casino: 'games', fun: 'quest', meme: 'image', exchange: 'trade', cam: 'video', tours: 'map', vision: 'ai', shoes: 'deals',
        // OpenVibe Connect (Website Connect v0, 2026-11-02): a port on your machine, on the web.
        connect: 'plug',
        // 4.182.0: other names the same products go by.
        my: 'account', locker: 'lock', email: 'mail', restream: 'stream', node: 'link', desktop: 'computer' };
    const registry = Object.create(null);
    for (const [k, g] of Object.entries(GLYPHS)) registry[k] = { glyph: g };

    /** The app icon's own rules (design rule 142). A page drawn on the server puts these in its stylesheet once
     * (OpenVibeIcons.APP_CSS) and its appHtml() icons are whole before any script runs. */
    const APP_CSS = `
.ov-appicon{--ova-h:215;--ova-size:56px;position:relative;display:inline-block;flex:none;width:var(--ova-size);height:var(--ova-size);border-radius:30%;overflow:hidden;vertical-align:middle;background:linear-gradient(150deg,hsl(var(--ova-h) 72% 58% / .36),hsl(var(--ova-h) 70% 38% / .2));box-shadow:inset 0 0 0 1px hsl(var(--ova-h) 70% 64% / .3)}
.ov-appicon>.ov-icon{position:absolute;inset:0;width:100%;height:100%;display:block;--ovi-glyph:hsl(var(--ova-h) 92% 84%);color:hsl(var(--ova-h) 92% 84%)}
.ov-appicon>.ov-icon svg{position:absolute;left:-13%;top:-13%;width:126%;height:126%;margin:0;transform:none!important}
.ov-appicon .ovi-ring,.ov-appicon .ovi-bg,.ov-appicon .ovi-comet,.ov-appicon .ovi-prog{display:none}
:root[data-theme="light"] .ov-appicon>.ov-icon{--ovi-glyph:hsl(var(--ova-h) 70% 30%);color:hsl(var(--ova-h) 70% 30%)}
.ov-appicon[data-size="20"]{--ova-size:20px}
.ov-appicon[data-size="26"]{--ova-size:26px}
.ov-appicon[data-size="32"]{--ova-size:32px}
.ov-appicon[data-size="44"]{--ova-size:44px}
.ov-appicon[data-size="56"]{--ova-size:56px}
.ov-appicon[data-size="64"]{--ova-size:64px}`;
    const CSS = `${APP_CSS}
.ov-icon{--ovi-size:32px;display:inline-grid;place-items:center;width:var(--ovi-size);height:var(--ovi-size);flex:none;vertical-align:middle;line-height:0;color:var(--ovi-accent,var(--accent,#3b82f6));position:relative}
.ov-icon svg{width:100%;height:100%;overflow:visible;display:block;transition:transform .25s cubic-bezier(.2,1.4,.3,1)}
.ov-icon .ovi-bg{fill:currentColor;opacity:.1;transition:opacity .25s}
.ov-icon .ovi-ring{fill:none;stroke:currentColor;stroke-width:2.4;opacity:.26}
.ov-icon .ovi-comet{fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-dasharray:26 99.66;display:none}
.ov-icon .ovi-prog{fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-dasharray:125.7;stroke-dashoffset:125.7;transition:stroke-dashoffset .35s cubic-bezier(.2,.8,.2,1),opacity .2s;opacity:0}
.ov-icon .ovi-glyph{fill:none;stroke:var(--ovi-glyph,var(--text-primary,#e6edf7));stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;transition:stroke .2s}
.ov-icon .ovi-glyph--solid{fill:var(--ovi-glyph,var(--text-primary,#e6edf7));stroke:none;transition:fill .2s}
.ov-icon .ovi-glyph circle[r=".6"],.ov-icon .ovi-glyph circle[r=".7"]{fill:currentColor;stroke:none}
.ov-icon[style*="--ovi-size:2"] .ovi-glyph,.ov-icon[data-size^="2"] .ovi-glyph{stroke-width:2.3}
.ov-icon[style*="--ovi-size:2"] .ovi-ring,.ov-icon[data-size^="2"] .ovi-ring{stroke-width:3;opacity:.34}
@media (hover:hover){.ov-icon:hover svg,a:hover>.ov-icon svg,button:hover>.ov-icon svg{transform:scale(1.06)}.ov-icon:hover .ovi-bg,a:hover>.ov-icon .ovi-bg{opacity:.18}}
.ov-icon[data-fx=none] .ovi-comet{display:none}
.ov-icon[data-fx=pulse] .ovi-comet{display:none}
.ov-icon[data-fx=pulse][data-state=busy] .ovi-bg{animation:oviPulse 2s ease-in-out infinite}
.ov-icon[data-fx=draw] .ovi-glyph path{stroke-dasharray:80;animation:oviDraw 1.2s cubic-bezier(.2,.8,.2,1) both}
.ov-icon[data-fx=bounce][data-state=busy] svg{animation:oviBounce 1.8s cubic-bezier(.3,1.4,.4,1) infinite}
.ov-icon[data-progress] .ovi-prog{opacity:1}
.ov-icon[data-progress] .ovi-comet{opacity:0}
.ov-icon[data-state=busy] .ovi-comet{display:inline;animation:oviSpin 1.1s linear infinite;opacity:1;stroke-dasharray:40 85.66}
.ov-icon[data-state=busy][data-fx=none] .ovi-comet,.ov-icon[data-state=busy][data-fx=pulse] .ovi-comet{display:none}
.ov-icon[data-state=busy][data-progress] .ovi-comet{opacity:.35}
.ov-icon[data-state=ok]{--ovi-accent:var(--success,#22c55e)}
.ov-icon[data-state=error]{--ovi-accent:var(--danger,#ef4444)}
.ov-icon[data-state=ok] .ovi-comet,.ov-icon[data-state=error] .ovi-comet{display:none}
.ov-icon[data-state=ok] .ovi-ring,.ov-icon[data-state=error] .ovi-ring{opacity:.9}
.ov-icon[data-state=ok] svg{animation:oviPop .5s cubic-bezier(.2,1.6,.3,1)}
.ov-icon[data-state=error] svg{animation:oviShake .4s ease}
@keyframes oviSpin{from{stroke-dashoffset:0}to{stroke-dashoffset:-125.66}}
@keyframes oviPulse{0%,100%{opacity:.08}50%{opacity:.24}}
@keyframes oviDraw{from{stroke-dashoffset:80}to{stroke-dashoffset:0}}
@keyframes oviBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6%)}}
@keyframes oviPop{0%{transform:scale(.8)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes oviShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6%)}75%{transform:translateX(6%)}}
html[data-ov-motion=off] .ov-icon .ovi-comet{display:none}`;

    // BEGIN generated ring solids (scripts/build-navbar-icons.js from glyphs.js)
    // The solid drawing of the glyph that stands for each product (24-unit grid, openvibe-shared/glyphs).
    const SOLID = {
        // network: the glyph nodes
        network: '<circle cx="12" cy="5.2" r="3"/><circle cx="5.6" cy="18" r="3"/><circle cx="18.4" cy="18" r="3"/><path class="ln" d="M10.9 7.6L6.8 15.5M13.1 7.6l4.1 7.9M8.4 18h7.1"/>',
        // live: the glyph live
        live: '<circle cx="12" cy="12" r="2.5"/><path class="ln" d="M8.5 8.5a4.9 4.9 0 0 0 0 6.9M15.5 8.5a4.9 4.9 0 0 1 0 6.9M6.2 6.2a8.2 8.2 0 0 0 0 11.5M17.8 6.2a8.2 8.2 0 0 1 0 11.5"/>',
        // tools: the glyph wrench
        tools: '<path d="M14.9 2.5a6 6 0 0 0-5.5 8.3L2.7 17.5V21.3H6.5l6.7-6.7a6 6 0 0 0 8.3-5.5l-3.5 1.3l-2.9-2.9l1.3-3.5Z"/>',
        // media: the glyph film
        media: '<path fill-rule="evenodd" d="M4.8 3.6h14.4a2.3 2.3 0 0 1 2.3 2.3v12.3a2.3 2.3 0 0 1-2.3 2.3H4.8A2.3 2.3 0 0 1 2.5 18.2V5.8A2.3 2.3 0 0 1 4.8 3.6Zm3.8 2v12.9h6.8V5.5ZM4.4 6v2h2.1V6Zm0 5v1.8h2.1v-1.8Zm0 4.9v2h2.1v-2Zm13.1-10v2h2.1V6Zm0 5v1.8h2.1v-1.8Zm0 4.9v2h2.1v-2Z"/>',
        // games: the glyph game
        games: '<path fill-rule="evenodd" d="M7.6 6.3h8.8a5.8 5.8 0 0 1 0 11.5H7.6a5.8 5.8 0 0 1 0-11.5Zm-1.4 3.7v1.6H4.7v1.8h1.6v1.6H7.9v-1.6h1.6v-1.8H7.9v-1.6Zm9.2 1a1.2 1.2 0 1 0 0 2.3a1.2 1.2 0 0 0 0-2.3Zm2.5 1.6a1.2 1.2 0 1 0 0 2.3a1.2 1.2 0 0 0 0-2.3Z"/>',
        // community: the glyph members
        community: '<circle cx="9.1" cy="7.1" r="3.5"/><path d="M2.6 19.6c0-3.7 2.9-6.3 6.4-6.3s6.4 2.6 6.4 6.3Z"/><circle cx="16.5" cy="6.6" r="2.8"/><path d="M16.7 12.4c2.8 0.4 4.7 2.7 4.7 6.2V19.6h-4.3c0-2.8-1-5.1-2.7-6.5Z"/>',
        // chat: the glyph chat
        chat: '<path d="M2.7 4.7A1.8 1.8 0 0 1 4.5 3h15.2a1.8 1.8 0 0 1 1.8 1.8v10.9a1.8 1.8 0 0 1-1.8 1.8H8.3L2.7 21.8Z"/>',
        // domains: the glyph globe
        domains: '<path d="M2.6 11.1A9.5 9.5 0 0 1 12 2.6a4.5 9.5 0 0 0-4.5 8.5ZM21.4 11.1A9.5 9.5 0 0 0 12 2.6a4.5 9.5 0 0 1 4.5 8.5ZM2.6 12.9A9.5 9.5 0 0 0 12 21.5a4.5 9.5 0 0 1-4.5-8.5ZM21.4 12.9A9.5 9.5 0 0 1 12 21.5a4.5 9.5 0 0 0 4.5-8.5ZM12 2.6a2.7 9.5 0 0 0-2.7 8.5h5.3A2.7 9.5 0 0 0 12 2.6ZM12 21.5a2.7 9.5 0 0 1-2.7-8.5h5.3A2.7 9.5 0 0 1 12 21.5Z"/>',
        // bench: the glyph flag
        bench: '<path class="ln" d="M7.2 20.5V4.3"/><path d="M7.8 4.1h10.9l-2 4.1l2 4.1H7.8Z"/>',
    };
    // END generated ring solids
    // A product's solid: the solid drawing of the glyph that stands for it, on the same 24-unit grid as the line
    // drawings (4.231.0). Its .ln parts are lines inside the solid, drawn as strokes.
    // Names without a solid keep their line drawing (the brand "V", YouTube, logo, ...).
    const LN = ' fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--ovi-glyph,var(--text-primary,#e6edf7))"';
    function glyphMarkup(key, def, forSprite) {
        const solid = SOLID[key];
        if (!solid) return forSprite ? def.glyph : `<g class="ovi-glyph">${def.glyph}</g>`;
        const paint = forSprite ? ' fill="currentColor" stroke="none" style="fill:var(--ovi-glyph,var(--text-primary,#e6edf7))"' : '';
        return `<g class="ovi-glyph ovi-glyph--solid"${paint}>${solid.replace(/ class="ln"/g, ` class="ln"${LN}`)}</g>`;
    }

    function resolve(name) {
        const n = String(name || 'ov').toLowerCase();
        return registry[n] ? n : (registry[ALIASES[n]] ? ALIASES[n] : 'ov');
    }

    /** Markup for one icon (usable server-side: no DOM needed). Glyph is scaled 24→22 and centred in the 48 box. */
    function svg(name, size) {
        const key = resolve(name); const def = registry[key];
        const off = def.offset || OFFSETS[key] || [0, 0];   // measured optical centring, see scripts/measure-icons.js
        const s = size ? ` width="${size}" height="${size}"` : '';
        return `<svg viewBox="0 0 48 48"${s} aria-hidden="true" focusable="false"><circle class="ovi-bg" cx="24" cy="24" r="21"/><circle class="ovi-ring" cx="24" cy="24" r="20"/><circle class="ovi-comet" cx="24" cy="24" r="20"/><path class="ovi-prog" d="M24 4a20 20 0 1 1 0 40a20 20 0 1 1 0-40"/><g transform="translate(${(13 + off[0] * .9167).toFixed(2)} ${(13 + off[1] * .9167).toFixed(2)}) scale(.9167)">${glyphMarkup(key, def, false)}</g></svg>`;
    }

    // ── Sprite mode (server-rendered lists) ──────────────────────────────────────────────
    // A page that shows 170 icons should not ship 170 copies of the same ring and glyph. sprite(names) emits each
    // icon once as a <symbol>; use(name) references it. Colours come from currentColor and inherited custom
    // properties, so a referenced icon is themed exactly like an inline one. Static by design (no comet, no
    // progress): pages use it for listings and keep the full inline icon where state or motion matters.
    function sprite(names) {
        const seen = new Set();
        const symbols = (names || []).map(resolve).filter(n => !seen.has(n) && seen.add(n)).map((key) => {
            const def = registry[key]; const off = def.offset || OFFSETS[key] || [0, 0];
            return `<symbol id="ovi-${key}" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="currentColor" opacity=".1"/><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".3"/><g transform="translate(${(13 + off[0] * .9167).toFixed(2)} ${(13 + off[1] * .9167).toFixed(2)}) scale(.9167)" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--ovi-glyph,var(--text-primary,#e6edf7))">${glyphMarkup(key, def, true)}</g></symbol>`;
        }).join('');
        return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${symbols}</svg>`;
    }
    function use(name, size) {
        const key = resolve(name);
        return `<span class="ov-icon" data-icon="${key}" data-ovi="${key}" data-fx="none" style="--ovi-size:${parseInt(size, 10) || 32}px" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><use href="#ovi-${key}"/></svg></span>`;
    }

    function applyProgress(el) {
        const raw = el.getAttribute('data-progress');
        const prog = el.querySelector('.ovi-prog');
        if (!prog) return;
        if (raw == null || raw === '') { prog.style.strokeDashoffset = ''; return; }
        const p = Math.max(0, Math.min(1, parseFloat(raw) || 0));
        prog.style.strokeDashoffset = String(125.7 * (1 - p));
    }

    function mountOne(el) {
        const name = resolve(el.getAttribute('data-icon'));
        if (el.getAttribute('data-ovi') === name) { applyProgress(el); return; }
        el.setAttribute('data-ovi', name);
        const size = parseInt(el.getAttribute('data-size'), 10);
        if (size) el.style.setProperty('--ovi-size', size + 'px');
        const def = registry[name];
        if (def.accent) el.style.setProperty('--ovi-accent', def.accent);
        if (def.fx && !el.hasAttribute('data-fx')) el.setAttribute('data-fx', def.fx);
        el.innerHTML = svg(name);
        if (!el.hasAttribute('role')) el.setAttribute('aria-hidden', 'true');
        applyProgress(el);
    }

    function mount(rootEl) { (rootEl || document).querySelectorAll('.ov-appicon[data-icon]').forEach(fillApp); (rootEl || document).querySelectorAll('.ov-icon').forEach(mountOne); }

    /** A site's (or an app's) steady hue: the same on every page and device (the menu's and Home's own). */
    function hue(id) { let x = 7; const t = String(id || 'ov'); let i = 0; while (i < t.length) { x = (x * 31 + t.charCodeAt(i)) % 360; i++; } return x; }
    /** 4.225.0 (design rule 142): an app icon, the same as the menu's and Home's: the app's own hue on a rounded square,
     * its glyph at 58% of it. In markup, <span class="ov-appicon" data-icon="live" data-size="64"></span>; or
     * OpenVibeIcons.app('live', { size: 64, label: 'Live' }). Without a label it is decoration (aria-hidden). */
    function fillApp(el) {
        const name = String(el.getAttribute('data-icon') || 'ov');
        if (el.getAttribute('data-ova') === name) return;
        el.setAttribute('data-ova', name);
        el.style.setProperty('--ova-h', String(el.hasAttribute('data-hue') ? Number(el.getAttribute('data-hue')) % 360 : hue(name)));
        const size = parseInt(el.getAttribute('data-size'), 10);
        if (size) el.style.setProperty('--ova-size', `${size}px`);
        const label = el.getAttribute('data-label');
        if (label) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', label); } else el.setAttribute('aria-hidden', 'true');
        el.textContent = '';
        const g = document.createElement('span'); g.className = 'ov-icon'; g.setAttribute('data-icon', name); g.setAttribute('data-fx', 'none');
        el.appendChild(g);
        mountOne(g);
    }
    /** 4.227.0: the same app icon as markup, for a page drawn on the server (no DOM needed): its hue and size inline and
     * its glyph already drawn, so ov-icons.js finds nothing to fill and nothing moves when it arrives. */
    function appHtml(site, { size = 56, label = '', hue: h = null } = {}) {
        const name = String(site || 'ov'); const key = resolve(name);
        const n = Math.min(Math.max(parseInt(size, 10) || 56, 12), 256);
        const e = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const given = h != null && h !== '' && Number.isFinite(Number(h));
        const hh = given ? Math.abs(Math.round(Number(h))) % 360 : hue(name);
        const a11y = label ? ` data-label="${e(label)}" role="img" aria-label="${e(label)}"` : ' aria-hidden="true"';
        return `<span class="ov-appicon" data-icon="${e(name)}" data-ova="${e(name)}" data-size="${n}"${given ? ` data-hue="${hh}"` : ''} style="--ova-h:${hh};--ova-size:${n}px"${a11y}>`
            + `<span class="ov-icon" data-icon="${key}" data-ovi="${key}" data-fx="none" aria-hidden="true">${svg(key)}</span></span>`;
    }
    function app(site, { size = 56, label = '', hue: h = null } = {}) {
        const el = document.createElement('span'); el.className = 'ov-appicon';
        el.setAttribute('data-icon', String(site || 'ov'));
        if (size) el.setAttribute('data-size', String(size));
        if (label) el.setAttribute('data-label', String(label));
        if (h != null) el.setAttribute('data-hue', String(h));
        fillApp(el);
        return el;
    }

    function set(el, patch) {
        if (!el || !patch) return;
        if (patch.icon) el.setAttribute('data-icon', patch.icon);
        if ('state' in patch) { if (patch.state) el.setAttribute('data-state', patch.state); else el.removeAttribute('data-state'); }
        if ('progress' in patch) { if (patch.progress == null) el.removeAttribute('data-progress'); else el.setAttribute('data-progress', String(patch.progress)); }
        mountOne(el);
    }

    function register(name, def) {
        if (!name || !def || !def.glyph) return;
        registry[String(name).toLowerCase()] = { glyph: def.glyph, fx: def.fx || null, accent: def.accent || null, offset: Array.isArray(def.offset) ? def.offset : null };
        if (typeof document !== 'undefined') document.querySelectorAll(`.ov-icon[data-icon="${name}"]`).forEach((el) => { el.removeAttribute('data-ovi'); mountOne(el); });
    }

    const api = { names: () => Object.keys(registry), register, mount, set, svg, sprite, use, resolve, app, appHtml, hue, CSS, APP_CSS };
    root.OpenVibeIcons = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof document === 'undefined') return;

    function init() {
        if (!document.getElementById('ov-icons-css')) { const st = document.createElement('style'); st.id = 'ov-icons-css'; st.textContent = CSS; document.head.appendChild(st); }
        mount();
        try {
            new MutationObserver((muts) => {
                for (const m of muts) {
                    if (m.type === 'attributes') {
                        if (m.target.classList && m.target.classList.contains('ov-appicon')) { m.target.removeAttribute('data-ova'); fillApp(m.target); continue; }
                        if (m.target.classList && m.target.classList.contains('ov-icon')) mountOne(m.target);
                        continue;
                    }
                    m.addedNodes.forEach((n) => {
                        if (n.nodeType !== 1) return;
                        if (n.classList.contains('ov-appicon') && n.hasAttribute('data-icon')) { fillApp(n); return; }
                        if (n.classList.contains('ov-icon')) { mountOne(n); return; }
                        if (n.querySelector) { n.querySelectorAll('.ov-appicon[data-icon]').forEach(fillApp); n.querySelectorAll('.ov-icon').forEach(mountOne); }
                    });
                }
            }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-icon', 'data-progress'] });
        } catch { /* */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
