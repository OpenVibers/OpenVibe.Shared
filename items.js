/**
 * openvibe-shared/items.js — what people wear, on any OpenVibe site (plan T21 "equip everywhere"). Browser global
 * `OpenVibeItems`; draw with /shared/items.css.
 *
 *   <a href="…" data-ov-subject="usr_01…">Ana</a>
 *   OpenVibeItems.decorate(document)            every [data-ov-subject] under the node, once per element
 *   OpenVibeItems.decorate(listEl)              again after new names are added (only the new ones are read)
 *
 * It reads OpenVibe.Inventory's public equipped sets (GET /api/v1/equipped?subjects=…, 100 people per request, no
 * credentials) and keeps each answer 60 s, so a page full of names costs one or two requests. Each name gets what its
 * items' renderers ask for:
 *   live.name_effect.css@1   `ov-fx` + the token (name-fx-rainbow, …) on the name: items.css draws it
 *   live.hat.glyph@1         the hat's emoji just before the name (`ov-hat`, with its float/pulse/warp animation)
 *   live.particle.css@1      a short burst of the item's characters when you point at or focus the name (`ov-px`)
 * Hats and particles need their definitions (emoji, animation, characters): one public read of Live's definitions per
 * page, only when someone on it wears one. Anything else is left alone. Inventory unreachable: names stay as they
 * are. Only tokens of the known shape become class names; emoji and characters are text, never markup. A burst never
 * runs by itself, and never under reduced motion or the network's Calm setting.
 */
(function (root) {
    'use strict';
    const SUBJECT = /^usr_[0-9A-HJKMNP-TV-Z]{26}$/;
    const NAME_FX = /^name-fx-[a-z]{2,24}$/;
    const PX = /^px-[a-z]{2,24}$/;
    const HAT_MOTION = ['float', 'pulse', 'warp'];
    const BATCH = 100;
    const TTL_MS = 60 * 1000;
    const cache = new Map();      // subject → { at, slots }
    const waiting = new Map();    // subject → Promise
    let defsPromise = null;       // Map(definition id → { art, attributes })
    const api = () => String((root.OpenVibeItemsConfig && root.OpenVibeItemsConfig.api) || 'https://inventory.openvibe.network').replace(/\/+$/, '');
    const getJson = async (url) => {
        const r = await fetch(url, { credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(`inventory answered ${r.status}`);
        return r.json();
    };

    async function fetchSets(subjects) {
        const body = await getJson(`${api()}/api/v1/equipped?subjects=${subjects.map(encodeURIComponent).join(',')}`);
        const now = Date.now();
        const got = new Map();
        for (const set of (body && body.equipped) || []) if (set && SUBJECT.test(set.subject)) got.set(set.subject, set.slots || {});
        for (const s of subjects) cache.set(s, { at: now, slots: got.get(s) || {} });
    }

    /** Equipped slots for each subject: Map(subject → { 'kind:slot': { token, definition_id, … } }). */
    async function equipped(subjects) {
        const want = [...new Set(subjects)].filter((s) => SUBJECT.test(s));
        const now = Date.now();
        const missing = want.filter((s) => { const h = cache.get(s); return (!h || now - h.at > TTL_MS) && !waiting.has(s); });
        for (let i = 0; i < missing.length; i += BATCH) {
            const chunk = missing.slice(i, i + BATCH);
            const p = fetchSets(chunk).catch(() => { for (const s of chunk) if (!cache.has(s)) cache.set(s, { at: Date.now(), slots: {} }); });
            for (const s of chunk) waiting.set(s, p);
            p.then(() => { for (const s of chunk) waiting.delete(s); });
        }
        await Promise.all(want.map((s) => waiting.get(s)).filter(Boolean));
        return new Map(want.map((s) => [s, (cache.get(s) || { slots: {} }).slots]));
    }

    /** Live's item definitions (hats and particles carry their emoji, animation and characters there), once a page. */
    function definitions() {
        if (!defsPromise) {
            defsPromise = getJson(`${api()}/api/v1/definitions?issuer=${encodeURIComponent('service:live')}&limit=500`)
                .then((b) => new Map(((b && b.definitions) || []).map((d) => [d.id, { art: d.art || {}, attributes: d.attributes || {} }])))
                .catch(() => { defsPromise = null; return new Map(); });
        }
        return defsPromise;
    }

    const slotOf = (slots, kind) => { for (const [key, v] of Object.entries(slots || {})) if (key.split(':')[0] === kind && v) return v; return null; };
    const calm = () => {
        const d = root.document && root.document.documentElement;
        if (d && d.getAttribute && d.getAttribute('data-ov-motion') === 'reduced') return true;
        return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

    /** A short burst of characters out of the name (pointer or keyboard focus); never under reduced motion. */
    function burst(el) {
        if (calm() || !el.isConnected || el.dataset.ovPxBusy) return;
        const chars = Array.from(el.dataset.ovPxChars || '').slice(0, 6);
        if (!chars.length) return;
        el.dataset.ovPxBusy = '1';
        for (let i = 0; i < 6; i++) {
            const p = el.ownerDocument.createElement('span');
            p.className = 'ov-px-p';
            p.setAttribute('aria-hidden', 'true');
            p.textContent = chars[i % chars.length];
            const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.6;
            p.style.setProperty('--px-dx', `${Math.round(Math.cos(angle) * 22)}px`);
            p.style.setProperty('--px-dy', `${Math.round(Math.sin(angle) * 16 - 10)}px`);
            p.style.left = `${Math.round(30 + Math.random() * 40)}%`;
            el.appendChild(p);
            setTimeout(() => p.remove(), 1900);
        }
        setTimeout(() => { delete el.dataset.ovPxBusy; }, 1200);
    }
    function onBurst(e) { burst(e.currentTarget); }

    /** Give one element what a set of slots draws (removing what an earlier set drew). defs: Map from definitions(). */
    function apply(el, slots, defs) {
        for (const c of [...el.classList]) if (c === 'ov-fx' || NAME_FX.test(c) || c === 'ov-px' || PX.test(c)) el.classList.remove(c);
        const prev = el.previousElementSibling;
        if (prev && prev.classList && prev.classList.contains('ov-hat')) prev.remove();
        el.removeEventListener('mouseenter', onBurst);
        el.removeEventListener('focusin', onBurst);
        delete el.dataset.ovPxChars;

        const fx = slotOf(slots, 'live.name_effect');
        if (fx && NAME_FX.test(String(fx.token || ''))) el.classList.add('ov-fx', fx.token);

        const hat = slotOf(slots, 'live.hat');
        const hatDef = hat && defs && defs.get(hat.definition_id);
        const glyph = hatDef && String(hatDef.art.emoji || hatDef.attributes.hat_char || '').slice(0, 8);
        if (glyph && el.parentNode) {
            const h = el.ownerDocument.createElement('span');
            const motion = String(hatDef.attributes.animated || '');
            h.className = `ov-hat${HAT_MOTION.includes(motion) ? ` ov-hat-${motion}` : ''}`;
            h.setAttribute('aria-hidden', 'true');
            h.textContent = glyph;
            el.parentNode.insertBefore(h, el);
        }

        const px = slotOf(slots, 'live.particle');
        const pxDef = px && defs && defs.get(px.definition_id);
        const token = String((px && px.token) || (pxDef && pxDef.art.token) || '');
        const chars = pxDef && String(pxDef.attributes.chars || '').slice(0, 24);
        if (PX.test(token) && chars) {
            el.classList.add('ov-px', token);
            el.dataset.ovPxChars = chars;
            el.addEventListener('mouseenter', onBurst);
            el.addEventListener('focusin', onBurst);
        }
    }

    async function decorate(node) {
        const scope = node || (root.document && root.document);
        if (!scope || !scope.querySelectorAll) return 0;
        const els = [...scope.querySelectorAll('[data-ov-subject]')].filter((el) => !el.dataset.ovItems && SUBJECT.test(el.dataset.ovSubject || ''));
        if (!els.length) return 0;
        for (const el of els) el.dataset.ovItems = '1';
        let sets;
        try { sets = await equipped(els.map((el) => el.dataset.ovSubject)); } catch { return 0; }
        const needsDefs = [...sets.values()].some((slots) => slotOf(slots, 'live.hat') || slotOf(slots, 'live.particle'));
        const defs = needsDefs ? await definitions() : new Map();
        for (const el of els) apply(el, sets.get(el.dataset.ovSubject), defs);
        return els.length;
    }

    root.OpenVibeItems = { decorate, equipped, definitions, apply, burst, _cache: cache };
})(typeof window !== 'undefined' ? window : globalThis);
