/*!
 * ov-face.js (openvibe-shared 4.318.0): an agent's face, drawn the same on every surface.
 * 4.325.0: its classes are `ovface…`; `ovf` is the shared footer's (its padding made faces 30x45 on every site with it).
 *
 * The owner, 11-18 (the menu's Vibe beside openvibe.chat/vibe): "These should share the same universal shared system so
 * they both have the faces". ov-run.js (Chat's Vibe, Codes) and ov-session.js (the menu's sessions and agent cards) drew
 * their own: blobs with eyes on one, a letter and glyph tiles on the other. Both draw with this now:
 *   - the agent's picture, when it has one;
 *   - Codes: a terminal, its prompt and cursor for eyes (the cursor blinks, faster at work);
 *   - any other agent: a soft blob of its own colour with two eyes. Its shape and hue follow from the agent, so the same
 *     agent is the same face everywhere; your Actor wears the shape and colour you chose for it.
 *
 *   OVFace.paint(el, spec)    draws into an element the caller sizes, rings and places; returns it
 *   OVFace.make(spec, cls)    a new <span class="cls ovface …"> with the face
 *   OVFace.forRun(run)        the spec for a session or run (its agent's picture, Codes, or its blob)
 *   OVFace.forActor(actor, name)  your Actor's spec: its picture, the face it chose, or its name's blob
 *   OVFace.codes()            Codes' spec
 *   OVFace.isCodes(run), OVFace.isYours(run, actorName), OVFace.hue(key), OVFace.SHAPES
 *
 *   spec: { pic?: https URL, codes?: true, key?: string, hue?: 0-359, shape?: one of SHAPES, working?, needs?,
 *           state?: 'resting' | 'working' | 'asks' | 'paused' }   (your Actor: its dot, green ready, blue at work, amber
 *                                                                 when it asks you something, grey and faded paused)
 *
 * The element gets `ovface` and one of `ovface-pic` / `ovface-coder` / `ovface-blob`, `--ovface-h`, `data-shape`, `data-state`, and
 * `ovface-working` / `ovface-needs`; what it draws carries `ovface-part`, so painting again replaces it and leaves the caller's badges alone.
 * Motion follows html[data-ov-motion]: Calm keeps the blink, Off stops the blink, the glance and the cursor.
 */
(function (root) {
    'use strict';
    if (!root || root.OVFace) return;
    const SHAPES = ['round', 'squircle', 'drop', 'leaf', 'pebble'];
    /** The colour an agent gets from its id or name: the same function ov-run.js and ov-session.js used. */
    const hue = (id) => { let x = 7; for (const c of String(id || 'ov')) x = (x * 31 + c.codePointAt(0)) % 360; return x; };
    const httpsUrl = (v) => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
    const STATES = ['resting', 'working', 'asks', 'paused'];
    const shapeOf = (key) => SHAPES[Math.abs(hue(String(key || 'agent')) * 7) % SHAPES.length];

    /** The agents every person has: a run of Codes, or any code run with no agent name, is Codes'. */
    function isCodes(run) {
        const a = (run && run.agent) || {};
        return a.id === 'codes' || a.product === 'codes' || (!!run && run.kind === 'code' && !a.name);
    }
    /** A run with no name, Vibe (the chatbot's old name), "My Actor" or your Actor's own name is your Actor's. */
    const OLD_NAMES = new Set(['vibe', 'my actor', 'actor', 'agent']);
    function isYours(run, name) {
        const a = (run && run.agent) || {};
        if (isCodes(run)) return false;
        const n = String(a.name || '').trim().toLowerCase();
        return !n || a.id === 'vibe' || a.id === 'actor' || a.id === 'me' || OLD_NAMES.has(n) || (!!name && n === String(name).toLowerCase());
    }

    function forRun(run) {
        const a = (run && run.agent) || {};
        const working = !!(run && run.doing && run.status === 'running');
        const pic = httpsUrl(a.avatar_url);
        if (isCodes(run) && !pic) return { codes: true, working };
        return { pic, key: a.id || a.name || (run && run.kind), hue: Number.isInteger(a.hue) ? a.hue : hue(a.id || (run && run.kind)), working };
    }
    function forActor(actor, name) {
        const n = String(name || (actor && actor.name) || 'Actor');
        const av = (actor && actor.avatar) || {};
        const pic = httpsUrl(actor && actor.avatar_url) || httpsUrl(av.url);
        const drawn = av.blob && Number.isInteger(av.blob.hue) && SHAPES.includes(av.blob.shape) ? av.blob : null;
        return { pic, key: `vibe:${n}`, hue: drawn ? drawn.hue : hue(n), shape: drawn ? drawn.shape : '' };
    }
    const codes = () => ({ codes: true });

    const NS = 'http://www.w3.org/2000/svg';
    function coderSvg() {
        const s = document.createElementNS(NS, 'svg');
        s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ovface-part ovface-coder-svg');
        const add = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); s.append(n); return n; };
        [13, 18, 23].forEach((cx, i) => add('circle', { cx: String(cx), cy: '12.5', r: '1.9', class: `ovface-coder-dot is-${i}` }));
        add('path', { d: 'M14.5 20.5l7 6.2-7 6.2', class: 'ovface-coder-prompt' });
        add('rect', { x: '25', y: '30.6', width: '10', height: '3.6', rx: '1.8', class: 'ovface-coder-cursor' });
        return s;
    }
    function part(tag, cls) { const n = document.createElement(tag); n.className = `ovface-part ${cls}`; return n; }

    function paint(f, spec) {
        const s = spec || {};
        css();
        f.querySelectorAll(':scope > .ovface-part').forEach((n) => n.remove());
        f.classList.remove('ovface-pic', 'ovface-coder', 'ovface-blob');
        f.classList.add('ovface');
        const pic = httpsUrl(s.pic);
        if (pic) {
            f.classList.add('ovface-pic');
            const i = part('img', 'ovface-img'); i.src = pic; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async';
            f.prepend(i);
        } else if (s.codes) {
            f.classList.add('ovface-coder');
            f.style.setProperty('--ovface-h', '262');
            f.prepend(coderSvg());
        } else {
            f.classList.add('ovface-blob');
            f.style.setProperty('--ovface-h', String(Number.isInteger(s.hue) ? ((s.hue % 360) + 360) % 360 : hue(s.key)));
            f.dataset.shape = SHAPES.includes(s.shape) ? s.shape : shapeOf(s.key);
            f.prepend(part('i', 'ovface-eye'), part('i', 'ovface-eye'));
        }
        f.classList.toggle('ovface-working', !!s.working);
        f.classList.toggle('ovface-needs', !!s.needs);
        if (STATES.includes(s.state)) f.dataset.state = s.state; else delete f.dataset.state;
        return f;
    }
    function make(spec, cls) { const f = document.createElement('span'); if (cls) f.className = cls; return paint(f, spec); }

    // Sizes, rings and places stay the caller's; this is what a face is made of. The shapes and the fills win over a
    // caller's tile (a rounded square with a glyph's gradient), so a face is the same shape in a row, a card or a head.
    const CSS = `
.ovface { position: relative; }
.ovface > .ovface-img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.ovface.ovface-blob { color: transparent; background: radial-gradient(circle at 32% 26%, hsl(var(--ovface-h, 215) 90% 74%), hsl(var(--ovface-h, 215) 78% 56%) 62%, hsl(var(--ovface-h, 215) 70% 46%)) !important; box-shadow: inset 0 -3px 6px hsl(var(--ovface-h, 215) 70% 30% / .35), 0 2px 8px hsl(var(--ovface-h, 215) 70% 30% / .25); }
.ovface.ovface-blob[data-shape="round"] { border-radius: 50% !important; }
.ovface.ovface-blob[data-shape="squircle"] { border-radius: 32% !important; }
.ovface.ovface-blob[data-shape="drop"] { border-radius: 50% 50% 50% 14% !important; }
.ovface.ovface-blob[data-shape="leaf"] { border-radius: 54% 16% 54% 16% !important; }
.ovface.ovface-blob[data-shape="pebble"] { border-radius: 58% 42% 52% 48% / 48% 56% 44% 52% !important; }
.ovface-blob > .ovface-eye { position: absolute; top: 36%; width: 9%; height: 19%; min-width: 3px; min-height: 5px; border-radius: 99px; background: rgba(255, 255, 255, .92); transform: rotate(12deg); animation: ovface-blink 6s infinite; }
.ovface-blob > .ovface-eye:first-of-type { left: 36%; } .ovface-blob > .ovface-eye:nth-of-type(2) { left: 55%; }
.ovface-blob.ovface-working > .ovface-eye { animation: ovface-look 1.6s ease-in-out infinite; }
.ovface.ovface-coder { border-radius: 27% !important; background: linear-gradient(155deg, hsl(262 88% 68%), hsl(248 78% 44%)) !important; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .28), inset 0 -6px 14px rgba(20, 8, 60, .28); }
.ovface > .ovface-coder-svg { width: 100% !important; height: 100% !important; overflow: visible; }
.ovface-coder-svg .ovface-coder-dot { fill: rgba(255, 255, 255, .5); stroke: none; } .ovface-coder-svg .ovface-coder-dot.is-0 { fill: rgba(255, 255, 255, .8); }
.ovface-coder-svg .ovface-coder-prompt { fill: none; stroke: rgba(255, 255, 255, .95); stroke-width: 3.6; stroke-linecap: round; stroke-linejoin: round; }
.ovface-coder-svg .ovface-coder-cursor { fill: rgba(255, 255, 255, .95); stroke: none; animation: ovface-cursor 1.1s steps(1, end) infinite; }
.ovface-coder.ovface-working .ovface-coder-cursor { animation-duration: .5s; }
.ovface-coder.ovface-working .ovface-coder-prompt { animation: ovface-type 1.2s ease-in-out infinite; }
.ovface[data-state] { overflow: visible !important; }
.ovface[data-state]::after { content: ""; position: absolute; right: -1px; bottom: -1px; width: clamp(7px, 23%, 11px); aspect-ratio: 1; border-radius: 50%; border: 2px solid var(--bg-secondary, #121826); background: #64748b; }
.ovface[data-state="resting"]::after { background: #22c55e; }
.ovface[data-state="working"]::after { background: var(--accent, #3b82f6); animation: ovface-pulse 1.2s ease-in-out infinite; }
.ovface[data-state="asks"]::after { background: #f59e0b; }
.ovface[data-state="paused"] { filter: saturate(.4); opacity: .8; }
@keyframes ovface-pulse { 50% { transform: scale(1.25); opacity: .7; } }
@keyframes ovface-blink { 0%, 94%, 100% { transform: rotate(12deg) scaleY(1); } 96% { transform: rotate(12deg) scaleY(.15); } }
@keyframes ovface-look { 0%, 100% { translate: 0 0; } 50% { translate: 2px 0; } }
@keyframes ovface-cursor { 0%, 55% { opacity: 1; } 56%, 100% { opacity: .08; } }
@keyframes ovface-type { 50% { transform: translateX(1.5px); } }
html[data-ov-motion="off"] .ovface-blob > .ovface-eye, html[data-ov-motion="off"] .ovface-coder-cursor, html[data-ov-motion="off"] .ovface-coder-prompt, html[data-ov-motion="off"] .ovface[data-state]::after { animation: none; }
`;
    function css() {
        if (typeof document === 'undefined' || document.getElementById('ov-face-css')) return;
        const st = document.createElement('style'); st.id = 'ov-face-css'; st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
    }

    root.OVFace = Object.freeze({ SHAPES, hue, paint, make, forRun, forActor, codes, isCodes, isYours, version: '4.318.0' });
})(typeof window !== 'undefined' ? window : globalThis);
