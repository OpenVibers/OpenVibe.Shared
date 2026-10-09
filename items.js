/**
 * openvibe-shared/items.js — what people wear, on any OpenVibe site (plan T21 "equip everywhere"). Browser global
 * `OpenVibeItems`; draw with /shared/items.css.
 *
 *   <a href="…" data-ov-subject="usr_01…">Ana</a>
 *   OpenVibeItems.decorate(document)            every [data-ov-subject] under the node, once per element
 *   OpenVibeItems.decorate(listEl)              again after new names are added (only the new ones are read)
 *
 * It reads OpenVibe.Inventory's public equipped sets (GET /api/v1/equipped?subjects=…, 100 people per request, no
 * credentials) and keeps each answer 60 s, so a page full of names costs one or two requests. Each name gets the
 * classes its items' renderers ask for:
 *   live.name_effect.css@1   `ov-fx` + the token (name-fx-rainbow, …): items.css draws it
 * Anything else is left alone. Inventory unreachable: names stay as they are. Only tokens of the known shape are ever
 * used as class names.
 */
(function (root) {
    'use strict';
    const SUBJECT = /^usr_[0-9A-HJKMNP-TV-Z]{26}$/;
    const NAME_FX = /^name-fx-[a-z]{2,24}$/;
    const BATCH = 100;
    const TTL_MS = 60 * 1000;
    const cache = new Map();      // subject → { at, slots }
    const waiting = new Map();    // subject → Promise
    const api = () => String((root.OpenVibeItemsConfig && root.OpenVibeItemsConfig.api) || 'https://inventory.openvibe.network').replace(/\/+$/, '');

    async function fetchSets(subjects) {
        const r = await fetch(`${api()}/api/v1/equipped?subjects=${subjects.map(encodeURIComponent).join(',')}`, { credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(`inventory answered ${r.status}`);
        const body = await r.json();
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

    /** Give one element the classes of a set of slots (removing an earlier name effect). */
    function apply(el, slots) {
        for (const c of [...el.classList]) if (c === 'ov-fx' || NAME_FX.test(c)) el.classList.remove(c);
        for (const [key, v] of Object.entries(slots || {})) {
            if (key.split(':')[0] === 'live.name_effect' && v && NAME_FX.test(String(v.token || ''))) el.classList.add('ov-fx', v.token);
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
        for (const el of els) apply(el, sets.get(el.dataset.ovSubject));
        return els.length;
    }

    root.OpenVibeItems = { decorate, equipped, apply, _cache: cache };
})(typeof window !== 'undefined' ? window : globalThis);
