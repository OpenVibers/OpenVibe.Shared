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
        // Products (2026-10-10): the sites that had only the "V"; each has a solid twin (build-nav-icons.py).
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

    // BEGIN generated solid glyphs (scripts/build-nav-icons.py)
    // Font Awesome Free 6 solid glyphs (CC BY 4.0) for the ring icons; viewBox 0 0 512 512,
    // normalised to one ink size (scripts/build-nav-icons.py).
    const SOLID = {
        network: [512, 'M397 179Q418 173 431 156Q445 140 446 117Q445 90 427 72Q409 55 382 54Q356 55 338 72Q321 89 319 115L174 173Q156 156 130 155Q103 156 85 173Q67 191 66 218Q67 245 85 263Q103 280 130 281Q144 281 156 275L272 376Q269 385 269 395Q269 422 287 440Q305 457 332 458Q359 457 377 440Q394 422 395 395Q393 361 367 343L397 179ZM190 237Q193 229 193 220L338 162Q342 166 347 170L318 333Q311 335 305 338L190 237Z'],
        live: [576, 'M110 107Q99 135 99 166Q99 198 110 225Q113 234 110 242Q106 251 98 255Q89 258 80 255Q72 251 69 242Q54 207 54 166Q54 126 69 90Q72 82 80 79Q89 75 98 78Q106 82 110 90Q113 98 110 107ZM443 90Q458 126 458 166Q458 207 443 242Q440 251 432 254Q423 258 414 255Q406 251 402 243Q399 234 402 225Q413 198 413 166Q413 135 402 107Q399 98 402 90Q406 82 414 78Q423 74 432 78Q440 82 443 90ZM301 166Q300 192 278 205V413Q278 423 272 430Q266 436 256 436Q246 436 240 430Q234 423 234 413V205Q212 192 211 166Q212 147 224 135Q237 122 256 121Q275 122 288 135Q300 147 301 166ZM174 130Q166 147 166 166Q166 186 174 202Q177 211 174 220Q170 228 162 232Q153 235 145 232Q137 229 132 220Q121 195 121 166Q121 138 132 112Q137 104 145 100Q153 97 162 101Q170 104 174 113Q177 121 174 130ZM380 112Q391 138 391 166Q391 195 380 220Q375 229 367 232Q359 235 350 232Q342 228 338 220Q335 211 338 202Q346 186 346 166Q346 147 338 130Q335 121 338 113Q342 104 350 101Q359 97 367 100Q375 104 380 112Z'],
        tools: [512, 'M116 58Q103 49 91 59L59 91Q49 103 58 116L121 198Q126 205 136 205H179L265 292Q256 309 259 329Q262 348 276 363L364 451Q372 458 382 458Q393 458 401 451L451 401Q458 393 458 382Q458 372 451 364L363 276Q348 262 329 259Q309 256 292 265L205 179V136Q205 126 198 121L116 58ZM70 367Q54 382 54 405Q55 427 70 442Q85 457 108 458Q130 458 145 442L239 349Q229 324 235 298L187 249L70 367ZM458 168Q458 155 456 144Q454 137 448 135Q442 134 437 139L386 189Q382 193 377 193H332Q320 192 319 180V135Q319 130 323 126L374 75Q378 70 377 64Q375 59 369 56Q357 54 344 54Q296 55 264 87Q232 119 231 168V168L298 235Q320 230 341 235Q363 242 380 258L393 271Q422 257 440 229Q457 202 458 168ZM98 395Q100 378 117 376Q134 378 136 395Q134 412 117 414Q100 412 98 395Z'],
        media: [640, 'M216 94H418H216H418Q435 95 446 106Q458 118 458 135V276Q458 293 446 305Q435 316 418 317H216Q198 316 187 305Q176 293 175 276V135Q176 118 187 106Q198 95 216 94ZM355 162Q350 155 342 155Q334 155 329 162L294 215L283 201Q278 195 271 195Q264 195 259 201L219 252Q213 259 217 267Q221 276 231 276H281H403Q411 276 416 268Q420 260 415 253L355 162ZM266 155Q266 146 260 140Q255 135 246 135Q237 135 231 140Q226 146 226 155Q226 164 231 169Q237 175 246 175Q255 175 260 169Q266 164 266 155ZM94 175H155H94H155V337V357Q155 366 161 372Q166 377 175 377H256Q265 377 271 372Q276 366 276 357V337H377V377Q377 394 365 406Q354 417 337 418H94Q77 417 66 406Q54 394 54 377V216Q54 198 66 187Q77 176 94 175ZM99 216Q90 216 89 226V236Q90 245 99 246H109Q119 245 119 236V226Q119 216 109 216H99ZM99 281Q90 282 89 291V302Q90 311 99 312H109Q119 311 119 302V291Q119 282 109 281H99ZM99 347Q90 348 89 357V367Q90 377 99 377H109Q119 377 119 367V357Q119 348 109 347H99ZM312 357V367V357V367Q312 377 322 377H332Q341 377 342 367V357Q341 348 332 347H322Q312 348 312 357Z'],
        games: [640, 'M175 135Q123 136 89 170Q55 204 54 256Q55 308 89 342Q123 376 175 377H337Q389 376 423 342Q457 308 458 256Q457 204 423 170Q389 136 337 135H175ZM367 200Q382 201 389 213Q396 226 389 238Q382 250 367 251Q353 250 345 238Q339 226 345 213Q353 201 367 200ZM302 286Q302 272 314 264Q327 258 339 264Q351 272 352 286Q351 301 339 308Q327 315 314 308Q302 301 302 286ZM160 221Q161 207 175 205Q189 207 190 221V241H210Q224 242 226 256Q224 270 210 271H190V291Q189 305 175 307Q161 305 160 291V271H140Q126 270 125 256Q126 242 140 241H160V221Z'],
        community: [640, 'M99 150Q100 130 117 119Q135 109 152 119Q169 130 170 150Q169 170 152 180Q135 190 117 180Q100 170 99 150ZM94 250Q85 260 84 276Q85 292 94 303V250ZM185 218Q156 245 155 286Q156 319 175 344V357Q175 366 169 372Q164 377 155 377H114Q106 377 100 372Q94 366 94 357V340Q76 331 65 315Q54 298 54 276Q54 246 75 226Q94 206 125 205H145Q168 206 185 218ZM337 357V344V357V344Q356 319 357 286Q356 245 327 218Q344 206 367 205H387Q418 206 437 226Q458 246 458 276Q458 298 447 315Q436 331 418 340V357Q418 366 412 372Q406 377 398 377H357Q348 377 343 372Q337 366 337 357ZM342 150Q343 130 360 119Q377 109 395 119Q412 130 413 150Q412 170 395 180Q377 190 360 180Q343 170 342 150ZM418 250V303V250V303Q428 292 428 276Q428 260 418 250ZM256 114Q279 115 291 135Q302 155 291 175Q279 195 256 195Q233 195 221 175Q210 155 221 135Q233 115 256 114ZM205 286Q206 302 216 313V260Q206 271 205 286ZM296 260V313V260V313Q307 302 307 286Q307 271 296 260ZM337 286Q337 308 326 325Q315 341 296 350V377Q296 386 291 392Q285 398 276 398H236Q227 398 221 392Q216 386 216 377V350Q197 341 186 325Q175 308 175 286Q176 256 196 236Q216 216 246 216H266Q296 216 316 236Q336 256 337 286Z'],
        chat: [640, 'M185 317Q241 315 278 284Q315 253 317 205Q315 158 278 127Q241 95 185 94Q130 95 92 127Q55 158 54 205Q54 243 79 271Q75 280 70 286Q65 292 61 295Q59 297 59 298Q58 298 58 298H58Q52 303 54 310Q57 316 64 317Q85 316 103 309Q112 305 119 302Q149 316 185 317ZM337 205Q335 260 296 295Q257 331 200 336Q212 372 247 394Q281 417 327 418Q363 417 393 403Q400 406 409 410Q427 417 448 418Q455 417 458 411Q460 404 454 399Q454 399 454 399Q453 399 453 399Q453 398 451 396Q447 393 442 387Q437 381 433 372Q458 344 458 307Q457 262 423 231Q389 200 336 195Q337 200 337 205Z'],
        codes: [640, 'M302 95Q294 93 286 97Q279 101 277 109L196 392Q194 400 198 408Q202 415 210 417Q218 419 226 415Q233 411 235 403L316 120Q318 112 314 104Q310 97 302 95ZM353 171Q347 177 347 185Q347 193 353 200L410 256L353 312Q347 319 347 327Q347 335 353 341Q359 347 367 347Q375 347 382 341L453 271Q458 264 458 256Q458 248 453 241L382 171Q375 165 367 165Q359 165 353 171ZM159 171Q153 165 145 165Q137 165 130 171L59 241Q54 248 54 256Q54 264 59 271L130 341Q137 347 145 347Q153 347 159 341Q165 335 165 327Q165 319 159 312L102 256L159 200Q165 193 165 185Q165 177 159 171Z'],
        code: [640, 'M302 95Q294 93 286 97Q279 101 277 109L196 392Q194 400 198 408Q202 415 210 417Q218 419 226 415Q233 411 235 403L316 120Q318 112 314 104Q310 97 302 95ZM353 171Q347 177 347 185Q347 193 353 200L410 256L353 312Q347 319 347 327Q347 335 353 341Q359 347 367 347Q375 347 382 341L453 271Q458 264 458 256Q458 248 453 241L382 171Q375 165 367 165Q359 165 353 171ZM159 171Q153 165 145 165Q137 165 130 171L59 241Q54 248 54 256Q54 264 59 271L130 341Q137 347 145 347Q153 347 159 341Q165 335 165 327Q165 319 159 312L102 256L159 200Q165 193 165 185Q165 177 159 171Z'],
        blog: [512, 'M345 67 301 111 345 67 301 111 401 211 445 167Q458 153 458 135Q458 117 445 103L409 67Q395 54 377 54Q359 54 345 67ZM281 128 274 129 281 128 274 129 160 164Q135 172 125 197L55 407Q50 422 61 433L183 311Q180 303 180 294Q180 278 191 267Q202 257 218 256Q234 257 245 267Q255 278 256 294Q255 310 245 321Q234 332 218 332Q209 332 201 329L79 451Q90 462 105 457L315 387Q340 377 348 352L383 238L384 231L281 128Z'],
        wiki: [448, 'M155 54Q122 55 101 76Q80 97 79 130V382Q80 415 101 436Q122 457 155 458H382H408Q419 458 426 451Q433 444 433 433Q433 422 426 415Q419 408 408 408V357Q419 357 426 350Q433 343 433 332V79Q433 68 426 61Q419 54 408 54H382ZM155 357H357H155H357V408H155Q144 408 137 401Q130 393 130 382Q130 371 137 364Q144 357 155 357ZM180 168Q181 156 193 155H344Q356 156 357 168Q356 179 344 180H193Q181 179 180 168ZM193 205H344H193H344Q356 206 357 218Q356 230 344 231H193Q181 230 180 218Q181 206 193 205Z'],
        news: [512, 'M130 130Q130 108 145 94Q159 80 180 79H408Q429 80 443 94Q457 108 458 130V382Q457 404 443 418Q429 432 408 433H117Q90 432 72 415Q55 397 54 370V155Q54 144 61 137Q68 130 79 130Q90 130 97 137Q104 144 104 155V370Q105 382 117 382Q129 382 130 370V130ZM180 149V212V149V212Q182 229 199 231H288Q305 229 307 212V149Q305 131 288 130H199Q182 131 180 149ZM344 142Q345 154 357 155H395Q407 154 408 142Q407 130 395 130H357Q345 130 344 142ZM344 218Q345 230 357 231H395Q407 230 408 218Q407 206 395 205H357Q345 206 344 218ZM180 294Q181 306 193 307H395Q407 306 408 294Q407 282 395 281H193Q181 282 180 294ZM180 370Q181 382 193 382H395Q407 382 408 370Q407 358 395 357H193Q181 358 180 370Z'],
        reviews: [576, 'M278 74Q271 61 256 60Q241 61 234 74L185 175L74 192Q60 194 55 208Q51 222 61 233L141 312L122 424Q120 438 132 447Q144 456 158 449L256 397L355 449Q368 456 380 447Q392 438 390 424L371 312L451 233Q461 222 457 208Q452 194 437 192L327 175L278 74Z'],
        tips: [512, 'M458 117Q457 138 428 155Q392 175 331 179Q327 177 322 175Q274 156 205 155Q196 155 186 156L185 155Q156 138 155 117Q156 90 199 72Q242 55 307 54Q371 55 414 72Q457 90 458 117ZM181 181Q193 180 205 180Q243 180 273 187Q305 194 326 205Q356 221 357 243Q357 248 356 253Q349 269 328 280Q328 280 328 280Q328 280 328 280Q328 280 328 280Q328 280 328 280Q327 281 327 281Q327 281 327 281Q306 293 274 299Q243 307 205 307Q133 306 89 284Q86 282 84 281Q55 265 54 243Q55 222 82 206Q110 190 155 184Q168 182 181 181ZM382 243Q381 217 363 201Q397 196 423 185Q443 177 458 165V193Q457 216 423 233Q406 242 382 247Q382 247 382 247Q382 246 382 243ZM357 319Q356 341 327 357Q326 358 324 359Q323 359 322 359Q278 382 205 382Q168 382 137 375Q105 369 84 357Q55 341 54 319V292Q69 303 89 311Q137 331 205 332Q274 331 322 311Q332 307 341 303Q348 299 354 294Q355 293 356 292Q356 292 357 292V294V299V319ZM382 319V294V319V294V273Q405 269 423 261Q443 253 458 241V269Q458 281 446 293Q426 313 382 323Q382 322 382 319ZM205 408Q274 407 322 387Q342 379 357 367V395Q356 422 313 440Q270 457 205 458Q141 457 98 440Q55 422 54 395V367Q69 379 89 387Q137 407 205 408Z'],
        vip: [576, 'M271 151Q283 142 284 127Q284 115 276 107Q268 99 256 99Q244 99 236 107Q228 115 228 127Q229 143 241 151L201 231Q196 241 186 243Q176 245 167 238L104 189Q110 182 110 172Q110 160 102 152Q94 144 82 144Q70 144 62 152Q54 160 54 172Q54 184 62 191Q70 200 82 200Q82 200 82 200Q83 200 83 200L114 376Q118 393 130 403Q142 413 158 413H354Q370 413 382 403Q394 393 398 376L429 200Q429 200 430 200Q430 200 430 200Q442 200 450 191Q458 184 458 172Q458 160 450 152Q442 144 430 144Q418 144 410 152Q402 160 402 172Q402 182 408 189L345 238Q336 245 326 243Q316 241 311 231L271 151Z'],
        trade: [512, 'M104 104Q104 93 97 86Q90 79 79 79Q68 79 61 86Q54 93 54 104V370Q55 397 72 415Q90 432 117 433H433Q444 433 451 426Q458 419 458 408Q458 397 451 390Q444 382 433 382H117Q105 382 104 370V104ZM426 173Q433 165 433 155Q433 145 426 137Q418 130 408 130Q397 130 390 137L307 220L262 175Q254 168 243 168Q233 168 225 175L137 263Q130 271 130 281Q130 292 137 299Q145 307 155 307Q165 307 173 299L243 228L288 274Q296 281 307 281Q317 281 325 274L426 173Z'],
        host: [512, 'M104 79Q83 80 69 94Q55 108 54 130V180Q55 201 69 216Q83 230 104 231H408Q429 230 443 216Q457 201 458 180V130Q457 108 443 94Q429 80 408 79H104ZM326 136Q343 138 344 155Q343 172 326 174Q308 172 307 155Q308 138 326 136ZM363 155Q365 138 382 136Q400 138 401 155Q400 172 382 174Q365 172 363 155ZM104 281Q83 282 69 296Q55 311 54 332V382Q55 404 69 418Q83 432 104 433H408Q429 432 443 418Q457 404 458 382V332Q457 311 443 296Q429 282 408 281H104ZM326 338Q343 340 344 357Q343 374 326 376Q308 374 307 357Q308 340 326 338ZM370 357Q371 340 389 338Q406 340 408 357Q406 374 389 376Q371 374 370 357Z'],
        deals: [448, 'M54 98V237V98V237Q54 261 72 278L234 441Q252 458 276 458Q299 458 317 441L441 317Q458 299 458 275Q458 252 441 234L279 71Q261 54 236 54H99Q80 55 67 67Q55 80 54 98ZM158 128Q171 128 179 136Q187 144 187 157Q187 170 179 178Q171 187 158 187Q145 187 136 178Q128 170 128 157Q128 144 136 136Q145 128 158 128Z'],
        coupons: [576, 'M99 121Q80 122 67 135Q54 147 54 166V211Q55 221 65 224Q86 232 87 256Q86 280 65 288Q55 291 54 301V346Q54 365 67 377Q80 390 99 391H413Q432 390 445 377Q458 365 458 346V301Q457 291 447 288Q426 280 425 256Q426 232 447 224Q457 221 458 211V166Q458 147 445 135Q432 122 413 121H99ZM144 200V312V200V312Q144 323 155 323H357Q368 323 368 312V200Q368 189 357 189H155Q144 189 144 200ZM121 189Q121 179 127 172Q134 166 144 166H368Q378 166 385 172Q391 179 391 189V323Q391 333 385 340Q378 346 368 346H144Q134 346 127 340Q121 333 121 323V189Z'],
        stream: [512, 'M205 79Q205 68 213 61Q220 54 231 54Q294 55 345 85Q397 115 427 167Q457 218 458 281Q458 292 451 299Q444 307 433 307Q422 307 415 299Q408 292 408 281Q407 232 383 192Q360 152 320 129Q280 105 231 104Q220 104 213 97Q205 90 205 79ZM102 228 184 311 102 228 184 311 206 288Q205 284 205 281Q205 270 213 263Q220 256 231 256Q242 256 249 263Q256 270 256 281Q256 292 249 299Q242 307 231 307Q228 307 224 306L201 328L284 410Q292 420 291 431Q289 442 278 447Q250 458 218 458Q149 457 102 410Q55 363 54 294Q54 262 65 234Q70 223 81 221Q92 220 102 228ZM231 130Q296 131 338 174Q381 216 382 281Q382 292 375 299Q368 307 357 307Q346 307 339 299Q332 292 332 281Q331 239 303 209Q273 181 231 180Q220 180 213 173Q205 166 205 155Q205 144 213 137Q220 130 231 130Z'],
        video: [576, 'M54 166Q54 147 67 135Q80 122 99 121H278Q297 122 310 135Q323 147 323 166V346Q323 365 310 377Q297 390 278 391H99Q80 390 67 377Q54 365 54 346V166ZM446 146Q458 153 458 166V346Q458 359 446 366Q434 372 423 365L356 320L346 313V301V211V199L356 192L423 147Q434 141 446 146Z'],
        download: [512, 'M281 79Q281 68 274 61Q267 54 256 54Q245 54 238 61Q231 68 231 79V271L173 213Q165 205 155 205Q145 205 137 213Q130 220 130 231Q130 241 137 249L238 350Q246 357 256 357Q266 357 274 350L375 249Q382 241 382 231Q382 220 375 213Q367 205 357 205Q347 205 339 213L281 271V79ZM104 332Q83 333 69 347Q55 361 54 382V408Q55 429 69 443Q83 457 104 458H408Q429 457 443 443Q457 429 458 408V382Q457 361 443 347Q429 333 408 332H328L292 367Q276 382 256 382Q235 382 220 367L185 332H104ZM395 376Q412 378 414 395Q412 412 395 414Q378 412 376 395Q378 378 395 376Z'],
        upload: [512, 'M281 140V332V140V332Q281 343 274 350Q267 357 256 357Q245 357 238 350Q231 343 231 332V140L173 198Q165 205 155 205Q145 205 137 198Q130 190 130 180Q130 170 137 162L238 61Q246 54 256 54Q266 54 274 61L375 162Q382 170 382 180Q382 190 375 198Q367 205 357 205Q347 205 339 198L281 140ZM104 332H205H104H205Q206 353 220 367Q235 382 256 382Q277 382 292 367Q306 353 307 332H408Q429 333 443 347Q457 361 458 382V408Q457 429 443 443Q429 457 408 458H104Q83 457 69 443Q55 429 54 408V382Q55 361 69 347Q83 333 104 332ZM395 414Q412 412 414 395Q412 378 395 376Q378 378 376 395Q378 412 395 414Z'],
        image: [512, 'M54 130Q55 108 69 94Q83 80 104 79H408Q429 80 443 94Q457 108 458 130V382Q457 404 443 418Q429 432 408 433H104Q83 432 69 418Q55 404 54 382V130ZM310 214Q303 205 294 205Q284 205 278 214L209 314L189 288Q183 281 174 281Q165 281 159 288L108 352Q102 361 106 371Q111 382 123 382H199H389Q400 382 405 372Q410 362 405 353L310 214ZM142 205Q164 205 175 186Q185 168 175 149Q164 130 142 130Q121 130 109 149Q100 168 109 186Q121 205 142 205Z'],
        audio: [512, 'M448 59Q458 67 458 79V136V345Q457 371 436 390Q415 407 382 408Q350 407 329 390Q307 371 307 345Q307 318 329 300Q350 282 382 281Q396 281 408 285V170L205 231V395Q205 422 183 440Q162 457 130 458Q97 457 76 440Q55 422 54 395Q55 368 76 350Q97 333 130 332Q143 332 155 336V212V155Q156 137 173 131L426 55Q438 52 448 59Z'],
        pdf: [512, 'M60 104Q61 83 75 69Q89 55 111 54H237V155Q237 166 244 173Q251 180 262 180H363V294H199Q178 295 164 309Q149 323 149 344V458H111Q89 457 75 443Q61 429 60 408V104ZM363 155H262H363H262V54L363 155ZM199 332H224H199H224Q243 333 256 344Q268 357 269 376Q268 395 256 408Q243 420 224 420H212V446Q211 457 199 458Q187 457 186 446V408V344Q187 333 199 332ZM224 395Q242 393 243 376Q242 359 224 357H212V395H224ZM300 332H326H300H326Q341 333 352 343Q363 354 363 370V420Q363 436 352 447Q341 457 326 458H300Q288 457 288 446V344Q288 333 300 332ZM326 433Q337 432 338 420V370Q337 358 326 357H313V433H326ZM389 344Q390 333 401 332H439Q451 333 452 344Q451 356 439 357H414V382H439Q451 383 452 395Q451 407 439 408H414V446Q413 457 401 458Q390 457 389 446V395V344Z'],
        docs: [384, 'M155 54Q134 55 119 69Q105 83 104 104V408Q105 429 119 443Q134 457 155 458H357Q378 457 393 443Q407 429 408 408V180H307Q296 180 288 173Q281 166 281 155V54H155ZM307 54V155V54V155H408L307 54ZM193 256H319H193H319Q331 257 332 269Q331 280 319 281H193Q181 280 180 269Q181 257 193 256ZM193 307H319H193H319Q331 307 332 319Q331 331 319 332H193Q181 331 180 319Q181 307 193 307ZM193 357H319H193H319Q331 358 332 370Q331 382 319 382H193Q181 382 180 370Q181 358 193 357Z'],
        text: [448, 'M283 73Q275 55 256 54Q237 55 229 73L106 400H83Q70 400 62 409Q54 417 54 429Q54 442 62 450Q70 458 83 458H169Q182 458 190 450Q198 442 198 429Q198 417 190 409Q182 400 169 400H168L184 357H328L344 400H343Q330 400 322 409Q314 417 314 429Q314 442 322 450Q330 458 343 458H429Q442 458 450 450Q458 442 458 429Q458 417 450 409Q442 400 429 400H406L283 73ZM307 299H205H307H205L256 165L307 299Z'],
        dns: [512, 'M332 256Q332 282 329 307H183Q180 282 180 256Q180 230 183 205H329Q332 230 332 256ZM355 205H452H355H452Q458 230 458 256Q458 282 452 307H355Q357 282 357 256Q357 230 355 205ZM443 180H352H443H352Q339 103 307 60Q355 74 390 104Q425 136 443 180ZM326 180H186H326H186Q194 137 208 105Q220 78 234 65Q247 53 256 54Q265 53 278 65Q292 78 304 105Q318 137 326 180ZM160 180H69H160H69Q87 136 122 104Q157 74 205 60Q173 103 160 180ZM60 205H157H60H157Q155 230 155 256Q155 282 157 307H60Q54 282 54 256Q54 230 60 205ZM208 407Q194 375 186 332H326Q318 375 304 407Q292 434 278 447Q265 459 256 458Q247 459 234 447Q220 434 208 407ZM160 332Q173 409 205 452Q157 438 122 408Q87 376 69 332H160ZM443 332Q425 376 390 408Q355 438 308 452Q339 409 352 332H443Z'],
        ip: [384, 'M275 449Q296 423 327 378Q358 335 383 288Q406 241 408 206Q406 141 364 98Q321 55 256 54Q191 55 148 98Q106 141 104 206Q106 241 129 288Q154 335 185 378Q216 423 237 449Q245 458 256 458Q267 458 275 449ZM256 155Q284 156 300 180Q314 206 300 231Q284 256 256 256Q228 256 212 231Q198 206 212 180Q228 156 256 155Z'],
        ssl: [448, 'M193 168V205V168V205H319V168Q318 141 301 122Q283 105 256 104Q229 105 211 122Q194 141 193 168ZM142 205V168V205V168Q144 119 175 87Q208 55 256 54Q304 55 337 87Q368 119 370 168V205H382Q404 206 418 220Q432 235 433 256V408Q432 429 418 443Q404 457 382 458H130Q108 457 94 443Q80 429 79 408V256Q80 235 94 220Q108 206 130 205H142Z'],
        ping: [640, 'M135 135Q135 126 140 120Q146 114 155 114H256Q265 114 271 120Q276 126 276 135V357H337V256Q337 247 343 241Q348 236 357 236H438Q447 236 453 241Q458 247 458 256Q458 265 453 271Q447 276 438 276H377V377Q377 386 372 392Q366 398 357 398H256Q247 398 241 392Q236 386 236 377V155H175V256Q175 265 169 271Q164 276 155 276H74Q65 276 59 271Q54 265 54 256Q54 247 59 241Q65 236 74 236H135V135Z'],
        whois: [512, 'M382 218Q382 273 351 315L451 415Q458 423 458 433Q458 443 451 451Q443 458 433 458Q423 458 415 451L315 351Q273 382 218 382Q149 381 102 334Q55 288 54 218Q55 149 102 102Q149 55 218 54Q288 55 334 102Q381 149 382 218ZM218 332Q249 332 275 317Q301 302 317 275Q332 248 332 218Q332 188 317 161Q301 134 275 119Q249 104 218 104Q187 104 161 119Q135 134 119 161Q104 188 104 218Q104 248 119 275Q135 302 161 317Q187 332 218 332Z'],
        search: [512, 'M382 218Q382 273 351 315L451 415Q458 423 458 433Q458 443 451 451Q443 458 433 458Q423 458 415 451L315 351Q273 382 218 382Q149 381 102 334Q55 288 54 218Q55 149 102 102Q149 55 218 54Q288 55 334 102Q381 149 382 218ZM218 332Q249 332 275 317Q301 302 317 275Q332 248 332 218Q332 188 317 161Q301 134 275 119Q249 104 218 104Q187 104 161 119Q135 134 119 161Q104 188 104 218Q104 248 119 275Q135 302 161 317Q187 332 218 332Z'],
        map: [576, 'M323 410 189 372 323 410 189 372V101L323 140V410ZM346 410V138V410V138L435 103Q444 99 451 104Q458 109 458 118V353Q458 364 448 369L346 410ZM64 143 166 102 64 143 166 102V374L77 410Q68 412 61 408Q54 403 54 394V158Q54 148 64 143Z'],
        food: [448, 'M408 54Q400 53 376 65Q352 76 330 106Q308 137 307 193V281Q307 303 322 317Q336 331 357 332H382V433Q382 444 389 451Q397 458 408 458Q419 458 426 451Q433 444 433 433V332V243V79Q433 68 426 61Q419 54 408 54ZM130 66Q129 56 119 54Q107 54 104 64L81 172Q79 179 79 187Q80 214 97 233Q115 253 142 256V433Q142 444 149 451Q156 458 168 458Q179 458 186 451Q193 444 193 433V256Q220 253 238 233Q255 214 256 187Q256 179 254 172L231 64Q228 54 217 54Q206 56 205 66V172Q205 179 198 180Q191 179 190 173L180 66Q179 55 168 54Q156 55 155 66L145 173Q144 179 138 180Q130 179 130 172V66ZM168 187V186V187Z'],
        paste: [512, 'M180 54Q151 55 137 79H92Q76 80 65 90Q55 101 54 117V370Q55 386 65 397Q76 407 92 408H205V193Q206 166 224 148Q242 130 269 130H307V117Q306 101 296 90Q284 80 269 79H224Q209 55 180 54ZM269 155Q253 156 242 166Q232 177 231 193V408V420Q232 436 242 447Q253 457 269 458H420Q436 457 447 447Q457 436 458 420V247Q458 231 447 220L393 166Q382 155 367 155H307ZM180 85Q198 87 199 104Q198 122 180 123Q163 122 161 104Q163 87 180 85Z'],
        account: [448, 'M256 256Q284 256 307 243Q329 229 344 205Q357 182 357 155Q357 128 344 104Q329 81 307 67Q284 54 256 54Q228 54 205 67Q183 81 168 104Q155 128 155 155Q155 182 168 205Q183 229 205 243Q228 256 256 256ZM220 294Q160 296 120 335Q81 375 79 435Q79 445 86 451Q92 458 103 458H409Q420 458 426 451Q433 445 433 435Q431 375 392 335Q352 296 292 294H220Z'],
        bell: [448, 'M256 54Q245 54 238 61Q231 68 231 79V94Q186 104 159 138Q130 171 130 218V233Q129 290 92 333L85 341Q75 352 81 367Q89 382 104 382H408Q423 382 431 367Q437 352 427 341L421 333Q383 291 382 233V218Q382 171 353 138Q326 104 281 94V79Q281 68 274 61Q267 54 256 54ZM292 443Q307 428 307 408H256H205Q205 428 220 443Q235 458 256 458Q277 458 292 443Z'],
        history: [512, 'M113 113 86 86 113 113 86 86Q77 77 66 82Q55 86 54 100V186Q55 204 73 205H160Q173 205 177 194Q182 183 173 173L149 149Q191 106 256 104Q321 106 363 149Q406 191 408 256Q406 321 363 363Q321 406 256 408Q207 407 169 381Q160 374 150 376Q141 378 134 387Q128 396 130 405Q132 416 141 422Q190 457 256 458Q313 457 358 431Q404 404 431 358Q457 313 458 256Q457 199 431 154Q404 108 358 81Q313 55 256 54Q214 54 177 70Q141 85 113 113ZM256 155Q239 156 237 174V256Q237 264 243 269L299 326Q313 337 326 326Q337 313 326 299L275 248V174Q273 156 256 155Z'],
        theme: [512, 'M458 256Q458 257 458 257Q458 258 458 258Q457 280 441 293Q425 307 403 307H326Q310 307 299 318Q288 329 288 344Q288 348 288 352Q291 363 296 374Q296 375 297 376Q305 392 307 409Q307 428 295 442Q284 457 265 458Q260 458 256 458Q199 457 154 431Q108 404 81 358Q55 313 54 256Q55 199 81 154Q108 108 154 81Q199 55 256 54Q313 55 358 81Q404 108 431 154Q457 199 458 256ZM155 281Q155 270 148 263Q141 256 130 256Q119 256 111 263Q104 270 104 281Q104 292 111 299Q119 307 130 307Q141 307 148 299Q155 292 155 281ZM155 205Q166 205 173 198Q180 191 180 180Q180 169 173 162Q166 155 155 155Q144 155 137 162Q130 169 130 180Q130 191 137 198Q144 205 155 205ZM281 130Q281 119 274 111Q267 104 256 104Q245 104 238 111Q231 119 231 130Q231 141 238 148Q245 155 256 155Q267 155 274 148Q281 141 281 130ZM357 205Q368 205 375 198Q382 191 382 180Q382 169 375 162Q368 155 357 155Q346 155 339 162Q332 169 332 180Q332 191 339 198Q346 205 357 205Z'],
        check: [448, 'M450 120Q458 129 458 140Q458 152 450 161L219 392Q210 400 198 400Q186 400 177 392L62 277Q54 268 54 256Q54 244 62 235Q71 227 83 227Q94 227 103 235L198 331L409 120Q418 112 429 112Q441 112 450 120Z'],
        error: [512, 'M256 79Q274 80 284 95L454 386Q462 401 454 417Q445 432 427 433H85Q67 432 58 417Q50 401 58 386L229 95Q239 80 256 79ZM256 180Q239 182 237 199V288Q239 305 256 307Q273 305 275 288V199Q273 182 256 180ZM281 357Q281 346 274 339Q267 332 256 332Q245 332 238 339Q231 346 231 357Q231 368 238 375Q245 382 256 382Q267 382 274 375Q281 368 281 357Z'],
        clip: [512, 'M259 205 228 175 259 205 228 175Q234 160 234 142Q233 104 208 80Q183 55 145 54Q107 55 83 80Q58 104 57 142Q58 180 83 205Q107 230 145 231Q163 231 178 225L208 256L178 288Q163 281 145 281Q107 282 83 307Q58 332 57 370Q58 408 83 432Q107 457 145 458Q183 457 208 432Q233 408 234 370Q234 352 228 338L451 115Q460 104 451 94Q434 77 411 77Q388 77 370 94L259 205ZM277 325 370 418 277 325 370 418Q388 435 411 435Q434 435 451 418Q460 408 451 397L328 274L277 325ZM107 142Q108 121 126 109Q145 100 164 109Q182 121 183 142Q182 164 164 175Q145 185 126 175Q108 164 107 142ZM145 332Q167 333 178 351Q188 370 178 389Q167 407 145 408Q124 407 112 389Q103 370 112 351Q124 333 145 332Z'],
        bot: [640, 'M256 94Q265 94 271 100Q276 106 276 114V155H352Q372 156 384 168Q397 181 398 200V372Q397 392 384 405Q372 417 352 418H160Q140 417 128 405Q115 392 114 372V200Q115 181 128 168Q140 156 160 155H236V114Q236 106 241 100Q247 94 256 94ZM185 337Q176 338 175 347Q176 356 185 357H205Q215 356 216 347Q215 338 205 337H185ZM246 337Q236 338 236 347Q236 356 246 357H266Q276 356 276 347Q276 338 266 337H246ZM307 337Q297 338 296 347Q297 356 307 357H327Q336 356 337 347Q336 338 327 337H307ZM221 256Q220 241 208 234Q195 228 183 234Q171 241 170 256Q171 271 183 278Q195 284 208 278Q220 271 221 256ZM317 281Q331 281 339 269Q345 256 339 243Q331 231 317 231Q302 231 295 243Q288 256 295 269Q302 281 317 281ZM84 236H94H84H94V357H84Q71 356 63 348Q54 339 54 327V266Q54 253 63 245Q71 236 84 236ZM428 236Q441 236 449 245Q458 253 458 266V327Q458 339 449 348Q441 356 428 357H418V236H428Z'],
        work: [512, 'M199 104H313H199H313Q318 105 319 111V142H193V111Q194 105 199 104ZM155 111V142V111V142H104Q83 143 69 157Q55 171 54 193V269H205H458V193Q457 171 443 157Q429 143 408 142H357V111Q356 92 344 79Q332 67 313 66H199Q180 67 168 79Q156 92 155 111ZM458 294H307H458H307V319Q307 330 299 337Q292 344 281 344H231Q220 344 213 337Q205 330 205 319V294H54V395Q55 416 69 431Q83 445 104 446H408Q429 445 443 431Q457 416 458 395V294Z'],
        rent: [512, 'M319 332Q378 330 417 291Q457 252 458 193Q457 134 417 95Q378 55 319 54Q260 55 221 95Q182 134 180 193Q180 215 186 235L59 363Q54 368 54 376V439Q55 457 73 458H136Q153 457 155 439V408H186Q204 406 205 389V357H237Q245 357 250 352L277 326Q297 332 319 332ZM351 130Q369 130 378 145Q386 161 378 177Q369 192 351 193Q333 192 323 177Q315 161 323 145Q333 130 351 130Z'],
        help: [512, 'M256 458Q311 457 357 431Q403 405 431 357Q458 309 458 256Q458 203 431 155Q403 107 357 81Q311 55 256 54Q201 55 155 81Q109 107 81 155Q54 203 54 256Q54 309 81 357Q109 405 155 431Q201 457 256 458ZM188 184Q193 171 204 163Q215 155 230 155H276Q297 156 311 170Q325 183 326 205Q325 233 300 248L275 262Q273 280 256 281Q239 280 237 262V252Q237 241 247 235L281 215Q288 212 288 205Q287 194 276 193H230Q225 193 224 197V198Q216 214 199 209Q183 202 188 186V184ZM231 332Q231 321 238 314Q245 307 256 307Q267 307 274 314Q281 321 281 332Q281 343 274 350Q267 357 256 357Q245 357 238 350Q231 343 231 332Z'],
        quest: [576, 'M335 76H177H335H177Q163 77 153 86Q144 96 144 110Q144 116 145 121H71Q55 123 54 138Q54 186 69 222Q85 256 109 279Q132 302 158 314Q184 327 206 333Q218 336 226 344Q234 354 234 364Q234 375 226 383Q218 391 207 391H189Q179 391 172 397Q166 403 166 413Q166 423 172 429Q179 436 189 436H323Q333 436 340 429Q346 423 346 413Q346 403 340 397Q333 391 323 391H305Q294 391 286 383Q278 375 278 364Q278 354 286 344Q294 336 306 333Q328 327 354 314Q380 302 403 279Q427 256 443 222Q458 186 458 138Q457 123 441 121H367Q368 116 368 110Q368 96 359 86Q349 77 335 76ZM88 155H147H88H147Q152 202 162 235Q172 268 184 289Q157 278 132 255Q116 238 103 214Q91 189 88 155ZM380 255Q355 278 328 289Q340 268 350 235Q360 202 365 155H424Q421 189 409 214Q397 238 380 255Z'],
        inventory: [640, 'M84 115Q87 109 94 109L256 129L418 109Q425 109 428 115L456 170Q460 180 456 188Q453 197 443 200L335 231Q320 234 311 221L256 129L201 221Q192 234 177 231L69 200Q59 197 56 188Q52 180 56 170L84 115ZM257 172 293 232 257 172 293 232Q301 244 313 250Q327 255 341 251L425 227V338Q425 348 419 357Q412 365 401 368L266 402Q256 404 245 402L111 368Q100 365 93 357Q87 348 87 338V227L171 251Q185 255 199 250Q211 244 219 232L255 172H257Z'],
        drive: [512, 'M54 130Q55 108 69 94Q83 80 104 79H408Q429 80 443 94Q457 108 458 130V275Q438 257 408 256H104Q74 257 54 275V130ZM104 281H408H104H408Q429 282 443 296Q457 311 458 332V382Q457 404 443 418Q429 432 408 433H104Q83 432 69 418Q55 404 54 382V332Q55 311 69 296Q83 282 104 281ZM307 382Q318 382 325 375Q332 368 332 357Q332 346 325 339Q318 332 307 332Q296 332 288 339Q281 346 281 357Q281 368 288 375Q296 382 307 382ZM408 357Q408 346 401 339Q393 332 382 332Q371 332 364 339Q357 346 357 357Q357 368 364 375Q371 382 382 382Q393 382 401 375Q408 368 408 357Z'],
        services: [576, 'M258 111 313 131 258 111 313 131 256 153 199 131 254 111Q256 110 258 111ZM149 142V220V142V220Q148 220 146 221L79 246Q55 257 54 283V367Q54 392 78 403L145 432Q160 439 177 432L256 398L336 432Q352 439 368 432L435 403Q458 392 458 367V283Q457 257 433 246L366 221Q364 220 363 220Q363 220 363 220V142Q361 115 337 104L270 79Q256 73 242 79L175 104Q151 115 149 142ZM329 224 271 246 329 224 271 246V184L329 161V224ZM163 252 217 274 163 252 217 274 160 295 104 274 158 252Q160 252 163 252ZM176 396V326V396V326L234 303V370L176 396ZM349 252Q352 252 354 252L408 274L352 295L295 274L349 252ZM421 372 367 396 421 372 367 396V326L425 303V367Q425 370 421 372Z'],
        space: [512, 'M178 358 153 333 178 358 153 333Q143 322 147 308Q151 297 156 281H73Q62 281 56 272Q51 262 56 253L98 182Q115 156 147 155H212Q215 150 217 146Q251 99 290 78Q330 58 368 54Q407 52 436 58Q450 62 454 76Q460 105 458 144Q454 182 434 222Q413 261 366 295Q362 297 357 300V365Q356 397 330 414L259 456Q250 461 240 456Q231 450 231 439V355Q214 360 202 364Q188 368 178 358ZM357 186Q375 186 385 171Q393 155 385 139Q375 124 357 123Q339 124 330 139Q322 155 330 171Q339 186 357 186Z'],
        watch: [576, 'M256 99Q213 99 179 116Q145 132 120 156Q96 179 79 203Q63 228 56 248Q52 256 56 264Q63 284 79 309Q96 333 120 356Q145 380 179 396Q213 413 256 413Q298 413 332 396Q366 380 391 356Q416 333 432 309Q448 284 456 264Q460 256 456 248Q448 228 432 203Q416 179 391 156Q366 132 332 116Q298 99 256 99ZM155 256Q155 229 168 205Q181 182 205 168Q229 155 256 155Q282 155 306 168Q330 182 343 205Q357 229 357 256Q357 283 343 307Q330 330 306 344Q282 357 256 357Q229 357 205 344Q181 330 168 307Q155 283 155 256ZM256 211Q255 230 242 243Q230 255 211 256Q203 256 197 254Q190 252 188 259Q188 266 190 274Q199 301 222 314Q245 328 273 321Q301 313 314 290Q327 267 321 238Q315 217 298 203Q280 190 258 189Q252 190 254 197Q256 203 256 211Z'],
        actor: [512, 'M199 54Q218 55 231 66Q243 79 243 98V414Q243 433 231 446Q218 457 199 458Q182 458 169 447Q157 436 155 419Q149 420 142 420Q121 420 107 405Q92 391 92 370Q92 361 95 353Q77 346 65 330Q54 314 54 294Q54 275 64 260Q74 245 90 237Q79 224 79 205Q79 187 90 174Q101 160 119 156Q117 149 117 142Q117 124 128 111Q138 98 155 93Q157 76 169 65Q182 54 199 54ZM313 54Q330 54 343 65Q355 76 357 93Q374 98 384 111Q395 124 395 142Q395 149 393 156Q411 160 422 174Q433 187 433 205Q433 224 422 237Q438 245 448 260Q458 275 458 294Q458 314 447 330Q435 346 417 353Q420 361 420 370Q420 391 405 405Q391 420 370 420Q363 420 357 419Q355 436 343 447Q330 458 313 458Q294 457 281 446Q269 433 269 414V98Q269 79 281 66Q294 55 313 54Z'],
        events: [448, 'M355 89Q362 71 347 59Q330 48 315 60L113 237Q100 249 106 265Q113 280 130 281H218L157 423Q150 441 165 453Q182 464 197 452L399 275Q412 263 406 247Q400 232 382 231H295L355 89Z'],
        ai: [512, 'M193 73Q191 55 174 54Q156 55 155 73V104Q134 105 119 119Q105 134 104 155H73Q55 156 54 174Q55 191 73 193H104V237H73Q55 239 54 256Q55 273 73 275H104V319H73Q55 321 54 338Q55 356 73 357H104Q105 378 119 393Q134 407 155 408V439Q156 457 174 458Q191 457 193 439V408H237V439Q239 457 256 458Q273 457 275 439V408H319V439Q321 457 338 458Q356 457 357 439V408Q378 407 393 393Q407 378 408 357H439Q457 356 458 338Q457 321 439 319H408V275H439Q457 273 458 256Q457 239 439 237H408V193H439Q457 191 458 174Q457 156 439 155H408Q407 134 393 119Q378 105 357 104V73Q356 55 338 54Q321 55 319 73V104H275V73Q273 55 256 54Q239 55 237 73V104H193V73ZM180 155H332H180H332Q343 155 350 162Q357 169 357 180V332Q357 343 350 350Q343 357 332 357H180Q169 357 162 350Q155 343 155 332V180Q155 169 162 162Q169 155 180 155ZM332 180H180H332H180V332H332V180Z'],
        run: [576, 'M60 137Q54 130 54 121Q54 112 60 105Q67 99 76 99Q85 99 92 105L227 240Q234 247 234 256Q234 265 227 272L92 407Q85 413 76 413Q67 413 60 407Q54 400 54 391Q54 382 60 375L179 256L60 137ZM234 368H436H234H436Q446 368 452 375Q458 381 458 391Q458 401 452 407Q446 413 436 413H234Q224 413 217 407Q211 401 211 391Q211 381 217 375Q224 368 234 368Z'],
        billing: [512, 'M104 79Q83 80 69 94Q55 108 54 130V382Q55 404 69 418Q83 432 104 433H408Q429 432 443 418Q457 404 458 382V205Q457 184 443 170Q429 156 408 155H117Q105 154 104 142Q105 130 117 130H408Q419 130 426 122Q433 115 433 104Q433 93 426 86Q419 79 408 79H104ZM382 269Q393 269 401 276Q408 283 408 294Q408 305 401 312Q393 319 382 319Q371 319 364 312Q357 305 357 294Q357 283 364 276Q371 269 382 269Z'],
        feeds: [448, 'M54 83Q54 70 62 62Q70 54 83 54Q187 55 272 105Q357 155 407 240Q457 325 458 429Q458 442 450 450Q442 458 429 458Q417 458 409 450Q400 442 400 429Q400 341 357 269Q315 197 243 155Q171 112 83 112Q70 112 62 103Q54 95 54 83ZM54 400Q55 368 83 351Q112 335 140 351Q168 368 169 400Q168 433 140 450Q112 466 83 450Q55 433 54 400ZM83 169Q155 170 214 205Q272 240 307 298Q342 357 343 429Q343 442 335 450Q326 458 314 458Q301 458 293 450Q285 442 285 429Q284 372 257 327Q231 281 185 255Q140 228 83 227Q70 227 62 219Q54 211 54 198Q54 186 62 177Q70 169 83 169Z'],
        pics: [576, 'M166 99Q147 99 135 112Q122 125 121 144V301Q122 320 135 333Q147 345 166 346H413Q432 345 445 333Q458 320 458 301V144Q458 125 445 112Q432 99 413 99H166ZM332 174 399 275 332 174 399 275Q404 283 400 292Q395 301 385 301H284H194Q184 300 179 291Q175 282 181 274L226 217Q231 211 239 211Q247 211 252 217L264 233L304 174Q309 166 318 166Q327 166 332 174ZM189 166Q189 156 195 150Q201 144 211 144Q221 144 227 150Q234 156 234 166Q234 176 227 182Q221 189 211 189Q201 189 195 182Q189 176 189 166ZM87 160Q86 145 71 144Q55 145 54 160V318Q54 359 82 385Q109 413 149 413H374Q389 412 391 396Q389 381 374 380H149Q123 379 106 361Q88 344 87 318V160Z'],
        homes: [576, 'M436 279Q445 278 451 271Q457 265 458 256Q459 246 450 239L413 206V121Q413 111 407 105Q401 99 391 99H368Q358 99 352 105Q346 111 346 121V147L271 81Q264 76 257 76Q249 76 241 82L61 239Q54 246 54 256Q54 265 60 271Q66 278 76 279H99V327Q99 328 99 329Q99 329 99 329V408Q99 420 107 427Q115 436 127 436H138Q139 436 141 436Q142 436 142 436Q143 436 144 436H166H183Q195 436 203 427Q211 420 211 408V391V346Q211 336 217 330Q224 323 234 323H278Q288 323 295 330Q301 336 301 346V391V408Q301 420 309 427Q317 436 329 436H346H369Q370 436 372 436Q373 436 374 436H385Q397 436 405 427Q413 420 413 408V396Q413 394 414 391L413 279H436Z'],
        website: [512, 'M395 104H218H395H218Q206 105 205 117V130H155V117Q156 90 173 72Q191 55 218 54H395Q422 55 440 72Q457 90 458 117V294Q457 321 440 339Q422 356 395 357H382V307H395Q407 306 408 294V117Q407 105 395 104ZM54 205Q55 184 69 170Q83 156 104 155H307Q328 156 342 170Q356 184 357 205V408Q356 429 342 443Q328 457 307 458H104Q83 457 69 443Q55 429 54 408V205ZM104 231Q104 242 111 249Q119 256 130 256H281Q292 256 299 249Q307 242 307 231Q307 220 299 213Q292 205 281 205H130Q119 205 111 213Q104 220 104 231Z'],
        zone: [448, 'M433 117V155V117V155Q431 182 381 200Q331 217 256 218Q181 217 131 200Q81 182 79 155V117Q81 90 131 72Q181 55 256 54Q331 55 381 72Q431 90 433 117ZM390 224Q415 215 433 201V281Q431 308 381 326Q331 344 256 344Q181 344 131 326Q81 308 79 281V201Q97 215 122 224Q178 243 256 243Q334 243 390 224ZM79 327Q97 341 122 350Q178 369 256 370Q334 369 390 350Q415 341 433 327V395Q431 422 381 440Q331 457 256 458Q181 457 131 440Q81 422 79 395V327Z'],
        fund: [576, 'M273 93V101V93V101Q280 102 285 104Q300 109 297 124Q292 139 277 136Q265 132 256 132Q247 132 242 136Q240 137 240 138Q239 138 239 139Q239 140 239 140Q239 140 239 140Q239 140 239 140Q239 141 241 142Q247 145 261 149H261Q274 152 287 160Q304 169 306 191Q305 215 287 226Q280 230 273 231V239Q271 255 256 256Q240 255 239 239V231Q229 229 222 226Q221 226 221 226Q220 225 219 225Q218 224 217 224Q203 218 206 203Q212 189 227 192Q229 193 230 193Q231 194 233 194Q246 199 257 200Q265 200 270 197Q272 196 272 195Q273 194 273 192Q273 191 270 189Q264 185 251 182L250 181Q237 178 224 171Q207 163 205 140Q207 116 225 107Q231 103 239 101V93Q240 78 256 76Q271 78 273 93ZM452 312Q459 322 458 333Q456 344 447 351L358 417Q332 436 301 436H189H76Q66 436 60 429Q54 423 54 413V368Q54 358 60 352Q66 346 76 346H102L134 321Q158 301 190 301H245H301Q311 301 317 307Q323 314 323 323Q323 333 317 340Q311 346 301 346H256H245Q234 347 233 357Q234 368 245 368H330L413 307Q423 300 434 301Q445 303 452 312ZM190 346H189Q189 346 189 346Q189 346 190 346Z'],
        play: [640, 'M277 128 262 98 277 128 262 98Q260 94 256 94Q252 94 250 98L235 128L202 133Q197 134 196 138Q195 142 198 145L222 169L216 202Q216 207 219 209Q222 212 226 210L256 194L286 209Q290 211 293 209Q296 206 296 202L291 169L315 145Q318 142 316 138Q315 134 310 133L277 128ZM216 256Q207 256 201 262Q195 267 195 276V398Q195 406 201 412Q207 418 216 418H296Q305 418 311 412Q317 406 317 398V276Q317 267 311 262Q305 256 296 256H216ZM74 296Q65 296 59 302Q54 308 54 317V398Q54 406 59 412Q65 418 74 418H155Q164 418 169 412Q175 406 175 398V317Q175 308 169 302Q164 296 155 296H74ZM337 357V398V357V398Q337 406 343 412Q348 418 357 418H438Q447 418 453 412Q458 406 458 398V357Q458 348 453 343Q447 337 438 337H357Q348 337 343 343Q337 348 337 357Z'],
        gauge: [512, 'M54 256Q55 201 81 155Q107 109 155 81Q203 54 256 54Q309 54 357 81Q405 109 431 155Q457 201 458 256Q457 311 431 357Q405 403 357 431Q309 458 256 458Q203 458 155 431Q107 403 81 357Q55 311 54 256ZM281 130Q281 119 274 111Q267 104 256 104Q245 104 238 111Q231 119 231 130Q231 141 238 148Q245 155 256 155Q267 155 274 148Q281 141 281 130ZM256 382Q277 382 292 367Q306 353 307 332Q306 311 292 296L343 182Q348 165 333 156Q317 151 308 166L258 281Q257 281 257 281Q256 281 256 281Q235 282 220 296Q206 311 205 332Q206 353 220 367Q235 382 256 382ZM193 168Q193 156 186 149Q179 142 168 142Q156 142 149 149Q142 156 142 168Q142 179 149 186Q156 193 168 193Q179 193 186 186Q193 179 193 168ZM130 281Q141 281 148 274Q155 267 155 256Q155 245 148 238Q141 231 130 231Q119 231 111 238Q104 245 104 256Q104 267 111 274Q119 281 130 281ZM408 256Q408 245 401 238Q393 231 382 231Q371 231 364 238Q357 245 357 256Q357 267 364 274Q371 281 382 281Q393 281 401 274Q408 267 408 256Z'],
        link: [640, 'M430 264Q458 234 458 195Q458 157 430 127Q404 102 369 99Q335 96 306 117L304 117Q297 123 296 131Q294 139 300 148Q305 154 313 156Q322 158 329 152L330 152Q347 140 366 141Q385 143 400 157Q415 174 415 195Q415 217 400 233L324 309Q308 324 286 324Q265 324 248 309Q234 294 233 275Q231 256 243 239L243 238Q248 231 247 223Q245 214 238 208Q231 203 223 204Q214 206 208 213L208 214Q187 244 190 279Q192 313 218 339Q248 367 286 367Q325 367 355 339L430 264ZM82 248Q54 278 54 317Q54 355 82 385Q108 410 143 413Q177 416 207 395L208 395Q215 389 216 381Q218 373 213 364Q207 358 199 356Q190 354 183 360L182 360Q165 372 146 371Q127 369 112 355Q97 338 97 317Q97 295 113 279L188 203Q204 188 226 188Q247 188 264 203Q278 218 279 237Q281 256 269 273L269 274Q264 281 265 290Q267 298 274 304Q281 309 289 308Q298 306 304 299L304 298Q325 268 322 233Q320 199 294 173Q264 145 226 145Q187 145 158 173L82 248Z'],
        shield: [512, 'M256 54Q262 54 266 56L417 120Q430 125 438 137Q447 149 447 165Q448 206 433 260Q419 315 382 367Q345 419 277 453Q256 463 235 453Q167 419 130 367Q93 315 79 260Q64 206 65 165Q65 149 74 137Q82 125 95 120L246 56Q250 54 256 54ZM256 107V407V107V407Q310 380 341 337Q371 294 384 248Q396 202 396 166L256 107Z'],
        plug: [384, 'M180 54Q169 54 162 61Q155 68 155 79V155H205V79Q205 68 198 61Q191 54 180 54ZM332 54Q321 54 314 61Q307 68 307 79V155H357V79Q357 68 350 61Q343 54 332 54ZM130 180Q119 180 111 187Q104 194 104 205Q104 216 111 224Q119 231 130 231V256Q130 303 159 337Q186 371 231 380V433Q231 444 238 451Q245 458 256 458Q267 458 274 451Q281 444 281 433V380Q326 371 353 337Q382 303 382 256V231Q393 231 401 224Q408 216 408 205Q408 194 401 187Q393 180 382 180H130Z'],
        cam: [512, 'M171 105 164 130 171 105 164 130H104Q83 130 69 145Q55 159 54 180V382Q55 404 69 418Q83 432 104 433H408Q429 432 443 418Q457 404 458 382V180Q457 159 443 145Q429 130 408 130H348L341 105Q331 81 304 79H208Q181 81 171 105ZM256 205Q277 205 294 216Q311 226 322 243Q332 262 332 281Q332 301 322 319Q311 337 294 347Q277 357 256 357Q235 357 218 347Q201 337 190 319Q180 301 180 281Q180 262 190 243Q201 226 218 216Q235 205 256 205Z'],
        casino: [640, 'M223 109Q209 95 190 95Q171 95 157 109L67 198Q54 212 54 231Q54 250 67 264L157 354Q171 367 190 367Q209 367 223 354L312 264Q326 250 326 231Q326 212 312 198L223 109ZM174 231Q176 217 190 216Q204 217 205 231Q204 245 190 247Q176 245 174 231ZM107 216Q121 217 123 231Q121 245 107 247Q93 245 92 231Q93 217 107 216ZM190 329Q176 328 174 314Q176 300 190 298Q204 300 205 314Q204 328 190 329ZM272 216Q287 217 288 231Q287 245 272 247Q258 245 257 231Q258 217 272 216ZM190 164Q176 163 174 149Q176 134 190 133Q204 134 205 149Q204 163 190 164ZM252 376Q252 393 264 405Q276 416 293 417H417Q434 416 446 405Q458 393 458 376V252Q458 234 446 223Q434 211 417 211H343Q349 229 345 247Q341 265 327 279L252 354V376ZM355 298Q369 300 371 314Q369 328 355 329Q341 328 340 314Q341 300 355 298Z'],
        surf: [576, 'M243 125Q256 117 269 125Q294 143 323 144Q353 142 378 125Q392 116 406 127Q421 139 441 144Q450 146 455 154Q460 162 458 171Q456 180 448 185Q440 190 431 188Q404 181 390 170Q359 188 323 189Q289 186 267 175Q261 172 256 170Q251 172 245 175Q223 186 189 189Q153 188 123 170Q108 181 81 188Q72 190 64 185Q56 180 54 171Q52 162 57 154Q62 146 71 144Q91 139 106 127Q120 116 134 125Q159 142 189 144Q219 143 243 125ZM269 328Q294 345 323 346Q353 345 378 328Q392 319 406 329Q421 342 441 347Q450 349 455 356Q460 364 458 373Q456 382 448 387Q440 392 431 390Q404 383 390 373Q359 390 323 391Q289 389 267 378Q261 375 256 372Q251 375 245 378Q223 389 189 391Q153 390 123 373Q108 383 81 390Q72 392 64 387Q56 382 54 373Q52 364 57 356Q62 349 71 347Q91 342 106 329Q120 319 134 328Q159 345 189 346Q219 345 243 328Q256 319 269 328ZM269 227Q294 244 323 245Q353 243 378 227Q392 217 406 228Q421 241 441 245Q450 248 455 255Q460 263 458 272Q456 281 448 286Q440 291 431 289Q404 282 390 271Q359 289 323 290Q289 288 267 276Q261 274 256 271Q251 274 245 276Q223 288 189 290Q153 289 123 271Q108 282 81 289Q72 291 64 286Q56 281 54 272Q52 263 57 255Q62 248 71 245Q91 241 106 228Q120 217 134 227Q159 243 189 245Q219 244 243 227Q256 218 269 227Z'],
        fun: [640, 'M101 330Q121 349 150 365Q178 380 206 377Q212 376 217 374Q209 363 202 352Q182 318 186 280Q166 284 151 296Q148 299 145 297Q141 296 142 292Q145 275 156 264Q168 253 185 250Q187 249 190 249L202 166Q203 151 218 138Q226 130 243 124Q259 117 283 115Q283 115 283 115Q283 114 282 114Q273 105 245 98Q217 91 165 98Q112 107 88 122Q63 137 57 148Q52 155 54 165L69 269Q75 306 101 330ZM156 192Q162 189 164 194Q164 194 164 194Q164 194 164 195Q165 205 159 213Q154 222 143 224Q133 225 124 219Q116 213 115 202Q115 202 115 202Q114 201 114 201Q115 196 121 197Q130 200 139 198Q148 197 156 192ZM219 341Q233 365 256 388Q278 411 306 417Q334 420 362 404Q391 389 411 370Q437 346 443 309L458 205Q460 195 455 188Q448 177 424 162Q400 146 347 138Q295 131 267 138Q239 145 230 153Q223 160 222 169L207 273Q201 310 219 341ZM310 243Q302 238 293 237Q283 235 274 238Q269 239 268 234Q268 234 268 233Q268 233 268 233Q270 222 278 216Q286 210 296 212Q307 213 312 222Q319 230 317 240Q317 241 317 241Q317 241 317 241Q315 246 310 243ZM396 253Q393 258 388 255Q381 250 371 248Q362 247 353 250Q347 251 346 246Q346 246 346 245Q346 245 346 244Q348 234 357 228Q364 222 375 224Q385 225 391 234Q397 241 396 252Q396 253 396 253Q396 253 396 253ZM389 316Q379 337 359 349Q339 360 315 357Q291 353 275 336Q259 320 256 296Q256 292 259 291Q262 289 265 292Q289 312 321 317Q353 322 381 309Q384 308 388 310Q390 312 389 316Z'],
        meme: [512, 'M391 65Q403 54 419 54Q435 54 446 66Q458 77 458 93Q458 109 447 121Q438 129 417 134Q397 140 381 141Q380 141 379 141Q378 142 378 142Q370 142 370 134Q371 119 377 97Q377 96 377 96Q378 95 378 94Q382 74 391 65ZM356 80Q354 85 352 92Q347 115 344 131Q343 148 354 158Q364 169 381 168Q397 165 420 160Q426 158 432 156Q465 216 457 282Q448 348 399 399Q348 448 282 457Q216 465 156 432Q158 427 160 421Q165 397 167 381Q169 364 158 354Q148 343 131 344Q115 347 91 352Q85 354 80 356Q47 296 55 230Q64 164 113 113Q164 64 230 55Q296 47 356 80ZM95 378Q119 372 134 370Q142 370 142 378Q140 393 134 418Q129 438 121 447Q109 458 93 458Q77 458 66 446Q54 435 54 419Q54 403 65 391Q74 383 95 378ZM382 213Q379 206 372 207Q366 207 362 214Q338 258 299 298Q258 338 214 361Q207 365 207 372Q207 379 214 382Q250 397 288 390Q325 382 355 354Q382 325 390 288Q397 250 382 213ZM122 279Q125 281 128 282L173 286L177 330Q177 333 179 336Q183 340 188 338Q193 337 195 332L219 255Q220 248 216 243Q211 239 204 240L126 263Q121 265 120 270Q119 275 122 279ZM263 126 240 203 263 126 240 203Q238 211 243 216Q247 220 255 218L332 195Q337 193 338 188Q340 183 336 179Q333 177 330 177L286 172L281 128Q281 125 279 122Q275 119 270 120Q265 121 263 126Z'],
        tours: [512, 'M256 458Q311 457 357 431Q403 405 431 357Q458 309 458 256Q458 203 431 155Q403 107 357 81Q311 55 256 54Q201 55 155 81Q109 107 81 155Q54 203 54 256Q54 309 81 357Q109 405 155 431Q201 457 256 458ZM296 311 182 355 296 311 182 355Q170 358 162 350Q154 342 157 330L201 216Q205 205 216 201L330 157Q342 154 350 162Q358 170 355 182L311 296Q307 307 296 311ZM281 256Q281 245 274 238Q267 231 256 231Q245 231 238 238Q231 245 231 256Q231 267 238 274Q245 281 256 281Q267 281 274 274Q281 267 281 256Z'],
        vision: [512, 'M155 79H180H155H180Q191 79 198 86Q205 93 205 104V130H130V104Q130 93 137 86Q144 79 155 79ZM205 155V408V155V408Q205 419 198 426Q191 433 180 433H79Q68 433 61 426Q54 419 54 408V361Q54 319 75 284Q92 256 96 224L102 177Q106 156 126 155H205ZM386 155Q406 156 411 177L416 224Q420 256 437 284Q458 319 458 361V408Q458 419 451 426Q444 433 433 433H332Q321 433 314 426Q307 419 307 408V155H386ZM307 104Q307 93 314 86Q321 79 332 79H357Q368 79 375 86Q382 93 382 104V130H307V104ZM281 155V281V155V281H231V155H281Z'],
        shoes: [640, 'M317 94Q296 95 272 99Q249 104 233 109Q216 114 216 114V195Q238 196 253 202Q269 208 281 216Q294 224 310 229Q325 236 347 236Q366 236 392 231Q418 226 437 213Q457 200 458 175Q458 150 435 131Q413 114 381 104Q348 94 317 94ZM135 155Q135 172 147 183Q158 195 175 195H195V114H175Q158 115 147 126Q135 138 135 155ZM236 418Q267 418 300 408Q332 398 354 381Q377 362 377 337Q376 312 356 299Q337 286 311 281Q285 276 266 276Q244 277 229 283Q213 289 200 296Q188 305 173 310Q157 317 135 317V398Q135 398 152 403Q168 408 192 413Q215 417 236 418ZM54 357Q54 374 66 386Q77 397 94 398H114V317H94Q77 317 66 329Q54 340 54 357Z'],
        today: [448, 'M180 54Q191 54 198 61Q205 68 205 79V104H307V79Q307 68 314 61Q321 54 332 54Q343 54 350 61Q357 68 357 79V104H395Q411 105 422 115Q432 126 433 142V180H79V142Q80 126 90 115Q101 105 117 104H155V79Q155 68 162 61Q169 54 180 54ZM79 205H433H79H433V420Q432 436 422 447Q411 457 395 458H117Q101 457 90 447Q80 436 79 420V205ZM142 256Q130 257 130 269V344Q130 356 142 357H218Q230 356 231 344V269Q230 257 218 256H142Z'],
        report: [448, 'M198 97Q199 79 211 66Q223 55 242 54H270Q289 55 301 66Q313 79 314 97V415Q313 433 301 446Q289 457 270 458H242Q223 457 211 446Q199 433 198 415V97ZM54 270Q55 252 66 240Q79 228 97 227H126Q144 228 157 240Q168 252 169 270V415Q168 433 157 446Q144 457 126 458H97Q79 457 66 446Q55 433 54 415V270ZM386 112H415H386H415Q433 112 446 124Q457 137 458 155V415Q457 433 446 446Q433 457 415 458H386Q368 457 355 446Q344 433 343 415V155Q344 137 355 124Q368 112 386 112Z'],
        design: [512, 'M425 68 444 87 425 68 444 87Q458 102 458 123Q458 142 444 158L399 203L309 113L354 68Q369 54 389 54Q409 54 425 68ZM89 333 291 131 89 333 291 131 381 221 179 423Q171 431 160 434L78 458Q67 460 59 453Q52 445 54 434L78 352Q81 340 89 333ZM251 135 135 250 251 135 135 250 66 181Q55 169 55 154Q55 139 66 127L128 66Q140 55 155 55Q170 55 182 66L198 81Q198 81 197 81Q197 81 197 82L146 133Q138 142 146 150Q155 158 164 150L214 100Q215 100 215 100Q215 100 215 99L251 135ZM377 261 413 297 377 261 413 297Q412 297 412 297Q412 297 412 298L362 348Q354 357 362 366Q370 373 379 366L430 315Q431 315 431 315Q431 314 431 314L446 330Q457 342 457 357Q457 372 446 384L385 446Q373 457 358 457Q343 457 331 446L262 377L377 261Z'],
        domains: [512, 'M100 206 107 219 100 206 107 219Q117 237 137 243L183 256Q204 263 205 286V318Q206 332 218 338Q230 344 231 359V390Q231 399 238 405Q245 409 254 408Q274 401 280 381L282 372Q288 351 307 341L313 337Q331 326 332 303V297Q332 281 321 270L318 267Q307 256 291 256H257Q243 256 232 250L205 234Q199 231 198 225Q194 213 205 205L210 203Q218 199 227 202L245 208Q256 211 262 202Q268 193 262 184L250 171Q239 155 250 139L263 124Q274 111 266 95L264 92Q260 92 256 92Q200 92 158 124Q116 156 100 206ZM420 256Q420 212 400 176L379 184Q370 188 366 197Q362 205 365 216L378 255Q382 269 396 272L419 278Q420 267 420 256ZM54 256Q55 201 81 155Q107 109 155 81Q203 54 256 54Q309 54 357 81Q405 109 431 155Q457 201 458 256Q457 311 431 357Q405 403 357 431Q309 458 256 458Q203 458 155 431Q107 403 81 357Q55 311 54 256Z'],
        exchange: [512, 'M79 130H332H79H332V79Q333 63 348 56Q363 50 375 61L451 137Q458 145 458 155Q458 165 451 173L375 249Q363 260 348 254Q333 247 332 231V180H79Q68 180 61 173Q54 166 54 155Q54 144 61 137Q68 130 79 130ZM433 332Q444 332 451 339Q458 346 458 357Q458 368 451 375Q444 382 433 382H180V433Q179 449 164 456Q149 462 137 451L61 375Q54 367 54 357Q54 347 61 340L137 264Q149 252 164 258Q179 265 180 281V332H433Z'],
        bench: [448, 'M104 54Q115 54 122 61Q130 68 130 79V92L184 78Q231 67 274 88Q302 102 332 102Q362 102 390 88L397 85Q411 78 421 85Q432 92 433 106V327Q432 344 416 351L390 361Q332 382 277 355Q231 333 180 344L130 357V433Q130 444 122 451Q115 458 104 458Q93 458 86 451Q79 444 79 433V370V318V104V79Q79 68 86 61Q93 54 104 54ZM130 201 180 190 130 201 180 190V243L130 254V305L168 296Q174 294 180 293V243L211 235Q220 234 231 234V183Q247 184 262 189L281 194V247L248 237Q239 235 231 234V290Q257 292 281 302V247L299 252Q315 257 332 258V207Q322 206 314 204L281 194V145Q265 141 251 134Q241 128 231 126V183Q215 183 200 186L180 190V131L130 144V201ZM332 319Q352 321 371 314L382 310V253L376 254Q354 259 332 258V319ZM382 201V145V201V145Q358 153 332 153V207Q348 209 365 205L382 201Z'],
    };
    // END generated solid glyphs
    // A glyph drawn as a solid Font Awesome path, fitted to the 24-box the stroke glyphs use.
    // Names without a solid twin keep their stroke glyph (the brand "V", YouTube, logo, ...).
    function glyphMarkup(key, def, forSprite) {
        const solid = SOLID[key];
        if (!solid) return forSprite ? def.glyph : `<g class="ovi-glyph">${def.glyph}</g>`;
        // The solids are all on one 512 square, normalised to one ink size (scripts/build-nav-icons.py),
        // so the whole-square map is the fit: a solid paints exactly what a line drawing paints.
        const d = solid[1]; const sc = 24 / 512;
        const paint = forSprite ? ' fill="currentColor" stroke="none" style="fill:var(--ovi-glyph,var(--text-primary,#e6edf7))"' : '';
        // The position/scale transform lives on a plain (unclassed) <g>, and no stylesheet rule sets a
        // CSS transform, transform-box or transform-origin on anything inside the SVG: browsers resolve a
        // "transform" *attribute* through the same CSS transform pipeline, so a styled origin once pivoted
        // every solid glyph off-centre, and transforms on SVG children left icons unpainted on phones.
        return `<g class="ovi-glyph ovi-glyph--solid"${paint}><g transform="scale(${sc.toFixed(5)})"><path d="${d}"/></g></g>`;
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
