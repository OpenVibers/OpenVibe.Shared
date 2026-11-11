/**
 * openvibe-shared/ov-arrange.js — the Arrange editor (make your own controls, stage 2, 2026-11-11).
 *
 * A product publishes a ui.surface@1 catalog and renders one element per part with data-ov-part="<id>".
 * A person's ui.layout@1 is applied to those real parts: a place on the surface's grid, or a dock edge for
 * an overlay; visible; a style (a theme token, a shape, an opacity and the label); and bindings. This file
 * is loaded only when someone presses Arrange (a product loads it then, by the shared serve URL, and this
 * file loads its own sibling ov-arrange-core.js — openvibe-sdk/ui-layout for the browser — by content hash).
 *
 *   OVArrange.open({
 *       surface, catalog, layout, device: 'phone'|'tablet'|'computer',
 *       validate(catalog, layout) -> { ok, reasons[] },   // optional: defaults to the sdk core
 *       defaults(catalog) -> layout,                      // optional: defaults to the sdk core
 *       onSave(layout) -> Promise<{ ok?, reasons? }>,     // PUT the person's layout (Network)
 *       onShare(layout) -> Promise<{ url?, reasons? }>,   // save, then a share link
 *       onAsk(words, request) -> Promise<ui.layout-suggestion@1>,
 *       onClose(), confirm() -> boolean, core
 *   }) -> { close, apply, layout, destroy }
 *
 * Edit mode: drag a part to move it, drag its corner to resize, arrow keys to move and Shift with the
 * arrows to resize (for a docked part: the arrows choose the edge, up/down its order). A part's sheet
 * (long press on a phone, the Style button, or Enter on a part) has visible, size, style and bindings.
 * Every move and resize is announced, and a refused move says why in plain words (Stop has to stay
 * visible; it is too small). Undo, Reset to default, Save and Share are in the bar, with Ask OpenVibe:
 * a suggestion is previewed on the real parts and kept only with Keep. Motion Off changes nothing;
 * Calm plays the short transition. Plain kit markup (ovk-*): the look is the page's.
 */
(function (root) {
    'use strict';
    if (!root || root.OVArrange || typeof document === 'undefined') return;

    const VERSION = '1.0.0';
    const MOTION = () => {
        const m = document.documentElement.getAttribute('data-ov-motion');
        if (m === 'off') return 'off';
        return m === 'reduced' || (!m && root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'calm' : 'full';
    };

    const CSS = `
.ov-arrange-surface { position: relative; display: grid; grid-template-columns: repeat(var(--ov-cols, 12), minmax(0, 1fr)); grid-auto-rows: minmax(var(--ov-cell, 64px), auto); gap: var(--ov-gap, .75rem); }
.ov-arrange-surface > [data-ov-part] { min-width: 0; min-height: 0; opacity: var(--ov-part-opacity, 1); }
.ov-arrange-surface > [data-ov-part][data-ov-label="false"] .ov-arrange-label { display: none; }
.ov-arrange-editing [data-ov-part] { cursor: grab; outline: 1px dashed color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); outline-offset: 2px; touch-action: none; transition: box-shadow var(--ov-arrange-dur, .2s) ease, outline-color var(--ov-arrange-dur, .2s) ease; }
.ov-arrange-editing [data-ov-part]:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 3px; }
.ov-arrange-editing [data-ov-part][data-ov-selected] { outline: 2px solid var(--accent, #3b82f6); outline-offset: 3px; }
.ov-arrange-editing [data-ov-part] :is(button, input, select, textarea, a, [role="button"]) { pointer-events: none; }
.ov-arrange-editing [data-ov-part][data-ov-dragging] { cursor: grabbing; opacity: .8; }
.ov-arrange-editing [data-ov-part][data-ov-refused] { outline-color: var(--danger, #e5484d); }
.ov-arrange-sel { position: fixed; z-index: 2147482990; pointer-events: none; border: 2px solid var(--accent, #3b82f6); border-radius: 10px; box-shadow: 0 0 0 9999px color-mix(in srgb, #000 14%, transparent); }
.ov-arrange-handle, .ov-arrange-style { position: fixed; z-index: 2147482991; pointer-events: auto; width: 34px; height: 34px; min-width: 34px; min-height: 34px; padding: 0; display: grid; place-items: center; border-radius: 9px; border: 1px solid var(--line, rgba(255,255,255,.2)); background: var(--raised, #1b2230); color: var(--text, #eef); cursor: nwse-resize; }
.ov-arrange-handle { touch-action: none; }
.ov-arrange-style { cursor: pointer; font-size: 15px; }
.ov-arrange-handle::before { content: ""; width: 12px; height: 12px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: translate(-2px, -2px); }
.ov-arrange-bar { position: fixed; z-index: 2147483000; left: 50%; bottom: max(12px, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(56rem, calc(100vw - 24px)); display: grid; gap: 8px; padding: 10px 12px; border: 1px solid var(--line, rgba(255,255,255,.16)); border-radius: 16px; background: var(--surface, #151b26); color: var(--text, #eef); box-shadow: 0 18px 50px -16px rgba(0,0,0,.7); font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.ov-arrange-bar form { display: flex; gap: 8px; min-width: 0; }
.ov-arrange-bar input { flex: 1; min-width: 0; min-height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line, rgba(255,255,255,.18)); background: var(--bg, #0d1117); color: var(--text, #eef); font: inherit; }
.ov-arrange-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ov-arrange-actions .ovk-btn, .ov-arrange-bar form .ovk-btn { min-height: 38px; }
.ov-arrange-status { margin: 0; min-height: 1.2em; color: var(--muted, #9aa6b6); font-size: 12.5px; }
.ov-arrange-status[data-tone="bad"] { color: var(--danger, #e5484d); }
.ov-arrange-status[data-tone="ok"] { color: var(--ok, #3fb950); }
.ov-arrange-preview { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); }
.ov-arrange-preview p { margin: 0; flex: 1 1 14rem; }
.ov-arrange-sheet { position: fixed; z-index: 2147483001; inset: auto 0 0 0; max-height: min(82vh, 42rem); overflow: auto; padding: 14px; background: var(--surface, #151b26); color: var(--text, #eef); border-top: 1px solid var(--line, rgba(255,255,255,.18)); border-radius: 16px 16px 0 0; box-shadow: 0 -20px 50px -20px rgba(0,0,0,.7); font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; display: grid; gap: 12px; }
@media (min-width: 44rem) { .ov-arrange-sheet { left: 50%; right: auto; bottom: 50%; transform: translate(-50%, 50%); width: min(30rem, calc(100vw - 32px)); border-radius: 16px; border: 1px solid var(--line, rgba(255,255,255,.18)); } }
.ov-arrange-sheet h2 { margin: 0; font-size: 15px; }
.ov-arrange-sheet .ov-arrange-row { display: grid; gap: 5px; }
.ov-arrange-sheet .ov-arrange-row > span { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted, #9aa6b6); }
.ov-arrange-sheet .ov-arrange-opts { display: flex; flex-wrap: wrap; gap: 6px; }
.ov-arrange-sheet .ov-arrange-opts label { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; padding: 0 10px; border: 1px solid var(--line, rgba(255,255,255,.18)); border-radius: 9px; cursor: pointer; }
.ov-arrange-sheet .ov-arrange-opts input { margin: 0; }
.ov-arrange-sheet .ov-arrange-close { justify-self: end; }
.ov-arrange-sheet input[type="text"] { min-height: 38px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--line, rgba(255,255,255,.18)); background: var(--bg, #0d1117); color: var(--text, #eef); font: inherit; }
.ov-arrange-share { display: grid; gap: 8px; padding: 10px; border-radius: 10px; background: var(--bg, #0d1117); }
.ov-arrange-share input { width: 100%; min-height: 38px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--line, rgba(255,255,255,.18)); background: var(--surface, #151b26); color: var(--text, #eef); font: inherit; }
html[data-ov-motion="off"] .ov-arrange-surface [data-ov-part], html[data-ov-motion="off"] .ov-arrange-sel, html[data-ov-motion="off"] .ov-arrange-bar { transition: none !important; }
html[data-ov-motion="reduced"] { --ov-arrange-dur: .12s; }
`;

    const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
    const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    const esc = (s) => String(s == null ? '' : s);
    const partName = (catalog, id) => {
        const p = (catalog.parts || []).find((x) => x.id === id);
        return p ? p.name : id;
    };
    const catalogPart = (catalog, id) => (catalog.parts || []).find((x) => x.id === id) || null;
    const entryOf = (layout, id) => ((layout && layout.parts) || []).find((p) => p.id === id) || null;
    const docked = (place) => !!(place && place.dock);

    function styleOnce(doc) {
        if (doc.getElementById('ov-arrange-styles')) return;
        const st = doc.createElement('style');
        st.id = 'ov-arrange-styles';
        st.textContent = CSS;
        (doc.head || doc.documentElement).appendChild(st);
    }

    // ── The SDK's rules, as a browser sibling (scripts/build-arrange-core.js) ─────────────────────────
    const ARRANGE_CORE_REV = { 'ov-arrange-core.js': '6344916a04e9' };
    function loadCore(opts) {
        if (opts && opts.core) return Promise.resolve(opts.core);
        if (root.OVArrangeCore) return Promise.resolve(root.OVArrangeCore);
        if (!root.document || !document.currentScript) return Promise.resolve(null);
        const src = document.currentScript.src || '';
        if (!src) return Promise.resolve(null);
        const url = src.replace(/[^/]*$/, `ov-arrange-core.js${ARRANGE_CORE_REV['ov-arrange-core.js'] ? `?v=${ARRANGE_CORE_REV['ov-arrange-core.js']}` : ''}`);
        return new Promise((resolve) => {
            const sc = document.createElement('script');
            sc.src = url; sc.async = true;
            sc.onload = () => resolve(root.OVArrangeCore || null);
            sc.onerror = () => resolve(null);
            document.head.appendChild(sc);
        });
    }

    // The rules when the SDK core is not there (a product without the sibling): the same checks the contract
    // lists, in the same plain words. The SDK remains the one authority when it is loaded.
    function fallbackValidate(catalog, layout) {
        const reasons = [];
        const parts = catalog && catalog.parts || [];
        const byId = new Map(parts.map((p) => [p.id, p]));
        if (!isObj(layout)) return { ok: false, reasons: ['That is not a layout.'] };
        if (layout.surface !== catalog.id) reasons.push(`This layout is for ${esc(layout.surface)}, not ${esc(catalog.id)}.`);
        if (layout.surface_version !== catalog.version) reasons.push('This layout was made for another version of these controls.');
        if (!(catalog.devices || []).includes(layout.device)) reasons.push(`These controls do not work on a ${esc(layout.device)}.`);
        if (!Array.isArray(layout.parts) || !layout.parts.length) reasons.push('A layout needs at least one part.');
        const seen = new Set();
        const entries = Array.isArray(layout.parts) ? layout.parts : [];
        for (const e of entries) {
            if (!isObj(e) || typeof e.id !== 'string') { reasons.push('A layout has a part without an id.'); continue; }
            if (seen.has(e.id)) reasons.push(`${partName(catalog, e.id)} is in the layout twice.`);
            seen.add(e.id);
            if (!byId.has(e.id)) { reasons.push(`These controls have no part called ${esc(e.id)}.`); continue; }
            // No links or code anywhere in the data.
            for (const [k, v] of Object.entries(e)) {
                if (typeof v === 'string' && /(https?:\/\/|\/\/|javascript:|data:|<[a-z])/i.test(v)) reasons.push('A layout only carries data: no links or code.');
                if (k === 'style' && isObj(v)) for (const sv of Object.values(v)) if (typeof sv === 'string' && /(https?:\/\/|\/\/|javascript:|data:|<[a-z])/i.test(sv)) reasons.push('A layout only carries data: no links or code.');
            }
        }
        for (const p of parts) {
            const e = entries.find((x) => isObj(x) && x.id === p.id);
            if (p.required && !e) { reasons.push(`${p.name} has to be there.`); continue; }
            if (!e) continue;
            if (p.required && e.visible === false) { reasons.push(`${p.name} has to stay visible.`); continue; }
            if (!isObj(e.place)) { reasons.push(`${p.name} has no place.`); continue; }
            if (!docked(e.place)) {
                const { x, y, w, h } = e.place;
                const cols = (catalog.grid && catalog.grid.columns && catalog.grid.columns[layout.device]) || 12;
                if (![x, y, w, h].every((n) => Number.isInteger(n))) { reasons.push(`${p.name} needs a place on the grid.`); continue; }
                if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > cols) reasons.push(`${p.name} does not fit on this grid.`);
                if (w < p.min.w || h < p.min.h) reasons.push(`${p.name} is too small: it needs ${p.min.w} by ${p.min.h} cells.`);
                const cell = (catalog.grid && catalog.grid.cell_px && catalog.grid.cell_px[layout.device]) || 44;
                if (p.min.px && (w * cell < p.min.px || h * cell < p.min.px)) reasons.push(`${p.name} has to be at least ${p.min.px} px.`);
                if (p.pressed && (w * cell < 44 || h * cell < 44)) reasons.push(`${p.name} is pressed, so it has to be at least 44 px.`);
            } else {
                if (!['left', 'right', 'top', 'bottom'].includes(e.place.dock)) reasons.push(`${p.name} needs an edge to dock to.`);
                if (!Number.isInteger(e.place.order) || e.place.order < 0) reasons.push(`${p.name} needs an order on its edge.`);
                if (!Number.isInteger(e.place.w) || !Number.isInteger(e.place.h)) reasons.push(`${p.name} needs a size, in cells.`);
                else {
                    if (e.place.w < p.min.w || e.place.h < p.min.h) reasons.push(`${p.name} is too small: it needs ${p.min.w} by ${p.min.h} cells.`);
                    const cell = (catalog.grid && catalog.grid.cell_px && catalog.grid.cell_px[layout.device]) || 44;
                    if (p.min.px && (e.place.w * cell < p.min.px || e.place.h * cell < p.min.px)) reasons.push(`${p.name} has to be at least ${p.min.px} px.`);
                    if (p.pressed && (e.place.w * cell < 44 || e.place.h * cell < 44)) reasons.push(`${p.name} is pressed, so it has to be at least 44 px.`);
                }
            }
            const st = e.style || {};
            if (!(catalog.theme_tokens || []).includes(st.tint)) reasons.push(`${p.name} uses a colour this theme does not have.`);
            if (!((p.styles && p.styles.tints) || []).includes(st.tint)) reasons.push(`${partName(catalog, p.id)} cannot use that colour.`);
            if (!((p.styles && p.styles.shapes) || []).includes(st.shape)) reasons.push(`${p.name} cannot be that shape.`);
            if (typeof st.opacity === 'number' && (st.opacity < 0.4 || st.opacity > 1)) reasons.push(`${p.name} has to stay at least 40% visible.`);
            const b = e.bindings || {};
            for (const k of (b.keys || [])) if (!((p.bindings && p.bindings.keys) || []).includes(k)) reasons.push(`${p.name} cannot use the key ${esc(k)}.`);
            for (const g of (b.gamepad || [])) if (!((p.bindings && p.bindings.gamepad) || []).includes(g)) reasons.push(`${p.name} cannot use the gamepad control ${esc(g)}.`);
        }
        // Nothing covers a required part, and never_covers.
        const placed = entries.filter((e) => isObj(e.place) && !docked(e.place));
        const dockedEntries = entries.filter((e) => isObj(e.place) && docked(e.place));
        for (const a of dockedEntries) {
            if (!catalogPart(catalog, a.id)) continue;
            for (const b of dockedEntries) {
                if (a === b || !catalogPart(catalog, b.id)) continue;
                if (a.place.dock === b.place.dock && a.place.order === b.place.order) {
                    const bp = catalogPart(catalog, b.id);
                    if (bp.required) reasons.push(`${partName(catalog, a.id)} covers ${bp.name}.`);
                }
            }
        }
        for (const a of placed) {
            if (!catalogPart(catalog, a.id)) continue;
            for (const b of placed) {
                if (a === b || !catalogPart(catalog, b.id)) continue;
                const covers = a.place.x < b.place.x + b.place.w && a.place.x + a.place.w > b.place.x && a.place.y < b.place.y + b.place.h && a.place.y + a.place.h > b.place.y;
                if (!covers) continue;
                const bp = catalogPart(catalog, b.id);
                if (bp.required) reasons.push(`${partName(catalog, a.id)} covers ${bp.name}.`);
                if (((catalogPart(catalog, a.id).never_covers) || []).includes(b.id)) reasons.push(`${partName(catalog, a.id)} must never cover ${bp.name}.`);
            }
        }
        return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
    }

    // ── Defaults: one visible part after another on the grid; docked parts by their catalog order ─────
    function spanFor(p, device) {
        const cols = (p && p._cols) || 4;
        if (device === 'computer') return { w: Math.min(4, cols), h: 2 };
        if (device === 'tablet') return { w: Math.min(4, cols), h: 2 };
        return { w: cols, h: 2 };
    }
    function fallbackDefaults(catalog, device) {
        const cols = (catalog.grid && catalog.grid.columns && catalog.grid.columns[device]) || 12;
        const overlay = (catalog.id || '').split('.').pop() === 'overlay';
        const parts = (catalog.parts || []).map((p) => {
            const st = { tint: (p.styles && p.styles.tints && p.styles.tints[0]) || (catalog.theme_tokens || ['surface'])[0], shape: (p.styles && p.styles.shapes && p.styles.shapes[0]) || 'square', opacity: 1, label: true };
            const b = { keys: (p.bindings && p.bindings.keys || []).slice(0, 0), gamepad: [] };
            if (overlay) {
                const dock = p.id === 'pill' || p.id === 'stick' ? 'left' : p.id === 'slider' || p.id === 'estop' ? 'bottom' : 'right';
                return { id: p.id, visible: true, place: { dock, order: 0, w: Math.max(p.min.w, p.id === 'stick' ? 2 : p.id === 'estop' ? 2 : 1), h: Math.max(p.min.h, p.id === 'stick' ? 2 : p.id === 'estop' ? 2 : 1) }, style: st, bindings: b };
            }
            return { id: p.id, visible: true, place: { x: 0, y: 0, w: Math.min(spanFor({ ...p, _cols: cols }, device).w, cols), h: Math.max(p.min.h, 2) }, style: st, bindings: b };
        });
        if (!overlay) {
            // Flow them: full-width rows on a phone, two or three columns on larger surfaces.
            let y = 0;
            for (const p of parts) {
                const c = catalogPart(catalog, p.id);
                const w = Math.min(cols, Math.max(c.min.w, device === 'phone' ? cols : Math.min(cols, device === 'tablet' ? 4 : 4)));
                const h = Math.max(c.min.h, c.kind === 'video' ? 3 : c.kind === 'readout' ? 1 : 2);
                if (p.place.x + w > cols) { p.place.x = 0; y += 1; }
                p.place = { x: p.place.x, y, w, h };
                p.place.x += w;
                if (p.place.x >= cols) { p.place.x = 0; y += h; }
            }
        }
        return { surface: catalog.id, surface_version: catalog.version, device, name: 'My layout', author: { name: 'Me' }, sharing: 'private', parts };
    }

    function fitPlace(place, catalog, device, part) {
        if (!place) return null;
        const cols = (catalog.grid && catalog.grid.columns && catalog.grid.columns[device]) || 12;
        if (docked(place)) return { dock: place.dock, order: Math.max(0, Math.min(63, Number(place.order) || 0)), w: Math.max(1, Math.min(24, Math.round(place.w) || part.min.w)), h: Math.max(1, Math.min(24, Math.round(place.h) || part.min.h)) };
        const w = Math.max(1, Math.min(24, Math.round(place.w) || part.min.w));
        const h = Math.max(1, Math.min(24, Math.round(place.h) || part.min.h));
        return { x: Math.max(0, Math.min(Math.max(0, cols - w), Math.round(place.x) || 0)), y: Math.max(0, Math.min(100, Math.round(place.y) || 0)), w, h };
    }

    // ── The editor ──────────────────────────────────────────────────────────────────────────────────
    function open(opts) {
        const surface = opts && opts.surface;
        if (!surface || !isObj(opts.catalog)) throw new Error('OVArrange.open: a surface element and its ui.surface@1 catalog are needed');
        const catalog = opts.catalog;
        const doc = surface.ownerDocument || document;
        const device = ['phone', 'tablet', 'computer'].includes(opts.device) ? opts.device : 'computer';
        styleOnce(doc);
        const cols = (catalog.grid && catalog.grid.columns && catalog.grid.columns[device]) || 12;
        const cell = (catalog.grid && catalog.grid.cell_px && catalog.grid.cell_px[device]) || 64;
        const confirmFn = typeof opts.confirm === 'function' ? opts.confirm : (msg) => !root.confirm || root.confirm(msg);
        const announce = (text) => { if (live) live.textContent = text; if (opts.announce) try { opts.announce(text); } catch (_) { /* */ } };

        let core = opts.core || root.OVArrangeCore || null;
        loadCore(opts).then((c) => { if (c) core = c; }).catch(() => { /* the fallback rules stay */ });
        const validate = (lay) => {
            const fn = (opts.validate || (core && core.validate) || fallbackValidate);
            try {
                const v = fn(catalog, lay, device);
                return v && typeof v.ok === 'boolean' ? { ok: v.ok, reasons: Array.isArray(v.reasons) ? v.reasons : [] } : { ok: false, reasons: ['That layout could not be checked.'] };
            } catch (e) { return { ok: false, reasons: [String(e && e.message || e)] }; }
        };
        const defaults = () => {
            const fn = opts.defaults || (core && core.applyDefaults);
            try { const d = fn ? fn(catalog, device) : null; if (isObj(d)) return d; } catch (_) { /* fall through */ }
            return fallbackDefaults(catalog, device);
        };
        const normal = (lay) => {
            const d = defaults();
            const out = clone(d);
            const base = isObj(lay) ? lay : opts.layout;
            out.surface = catalog.id; out.surface_version = catalog.version; out.device = device;
            if (isObj(base)) {
                out.name = base.name || out.name; out.sharing = base.sharing || out.sharing; out.author = base.author || out.author;
                out.parts = (out.parts || []).map((p) => {
                    const got = entryOf(base, p.id);
                    return got ? { ...p, ...clone(got) } : p;
                });
            }
            out.parts = (out.parts || []).map((p) => {
                const cp = catalogPart(catalog, p.id) || { min: { w: 1, h: 1 }, styles: {} };
                return { ...p, visible: cp.required ? true : p.visible !== false, place: fitPlace(p.place, catalog, device, cp) || { x: 0, y: 0, w: cp.min.w, h: cp.min.h }, style: { tint: (p.style && p.style.tint) || (cp.styles.tints || catalog.theme_tokens || ['surface'])[0], shape: (p.style && p.style.shape) || (cp.styles.shapes || ['square'])[0], opacity: p.style && typeof p.style.opacity === 'number' ? p.style.opacity : 1, label: !p.style || p.style.label !== false }, bindings: { keys: (p.bindings && p.bindings.keys) || [], gamepad: (p.bindings && p.bindings.gamepad) || [] } };
            });
            return out;
        };

        const initial = normal(opts.layout);
        let working = clone(initial);
        let undoStack = [];
        let preview = null;           // { layout, summary, reasons, words }
        let selected = null;
        let dirty = false;
        let saving = false;
        let closed = false;
        let drag = null;

        const host = doc.createElement('div');
        host.className = 'ov-arrange-bar';
        host.setAttribute('role', 'toolbar');
        host.setAttribute('aria-label', 'Arrange the controls');
        host.innerHTML = `<form data-ask><label class="sr-only" for="ov-arrange-words">Ask OpenVibe</label><input id="ov-arrange-words" type="text" maxlength="500" autocomplete="off" placeholder="Describe how you want it…" aria-label="Ask OpenVibe"><button type="submit" class="ovk-btn ovk-btn--primary">Ask OpenVibe</button></form>
<div class="ov-arrange-actions"><button type="button" class="ovk-btn ovk-btn--quiet" data-undo>Undo</button><button type="button" class="ovk-btn ovk-btn--quiet" data-reset>Reset to default</button><button type="button" class="ovk-btn ovk-btn--quiet" data-share>Share</button><button type="button" class="ovk-btn ovk-btn--primary" data-save>Save</button><button type="button" class="ovk-btn ovk-btn--ghost" data-done>Done</button></div>
<p class="ov-arrange-status" data-status role="status" aria-live="polite"></p>`;
        doc.body.appendChild(host);
        const statusEl = host.querySelector('[data-status]');
        const setStatus = (text, tone) => { statusEl.textContent = text || ''; if (tone) statusEl.dataset.tone = tone; else delete statusEl.dataset.tone; if (text) announce(text); };
        const live = doc.createElement('div');
        live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
        live.className = 'sr-only';
        doc.body.appendChild(live);

        const sel = doc.createElement('div'); sel.className = 'ov-arrange-sel'; sel.hidden = true; doc.body.appendChild(sel);
        const handle = doc.createElement('button'); handle.type = 'button'; handle.className = 'ov-arrange-handle'; handle.setAttribute('aria-label', 'Resize'); handle.title = 'Resize'; handle.hidden = true; doc.body.appendChild(handle);
        const styleBtn = doc.createElement('button'); styleBtn.type = 'button'; styleBtn.className = 'ov-arrange-style'; styleBtn.textContent = 'Aa'; styleBtn.setAttribute('aria-label', 'Style this part'); styleBtn.title = 'Style this part'; styleBtn.hidden = true; doc.body.appendChild(styleBtn);

        const partEls = () => [...surface.querySelectorAll('[data-ov-part]')].filter((el) => catalogPart(catalog, el.dataset.ovPart));
        const originals = new Map();
        for (const el of partEls()) originals.set(el, { style: el.getAttribute('style'), hidden: el.hidden, tabindex: el.getAttribute('tabindex'), role: el.getAttribute('role'), label: el.getAttribute('aria-label'), cls: el.className });
        const surfaceStyle = surface.getAttribute('style');
        const surfaceClass = surface.className;
        const elOf = (id) => partEls().find((el) => el.dataset.ovPart === id) || null;
        const entry = (id) => entryOf(working, id);

        function snapshot() { return clone(working); }
        function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 40) undoStack.shift(); }
        function markDirty() { dirty = true; paintActions(); }

        function flatten(el) {
            for (let a = el.parentElement; a && a !== surface; a = a.parentElement) a.setAttribute('data-ov-flatten', 'true');
        }

        function paintPlace(el, e) {
            const p = e.place || {};
            el.style.gridColumn = ''; el.style.gridRow = ''; el.style.order = '';
            delete el.dataset.ovDock; delete el.dataset.ovOrder;
            if (docked(p)) {
                el.dataset.ovDock = p.dock;
                el.dataset.ovOrder = String(p.order || 0);
                el.style.order = String(p.order || 0);
            } else {
                el.style.gridColumn = `${p.x + 1} / span ${p.w}`;
                el.style.gridRow = `${p.y + 1} / span ${p.h}`;
            }
            el.hidden = e.visible === false;
            el.style.setProperty('--ov-part-opacity', String(e.style && typeof e.style.opacity === 'number' ? e.style.opacity : 1));
            el.dataset.ovTint = (e.style && e.style.tint) || '';
            el.dataset.ovShape = (e.style && e.style.shape) || '';
            el.dataset.ovLabel = e.style && e.style.label === false ? 'false' : 'true';
            el.dataset.ovKeys = ((e.bindings && e.bindings.keys) || []).join(' ');
            el.dataset.ovGamepad = ((e.bindings && e.bindings.gamepad) || []).join(' ');
            el.classList.toggle('ov-arrange-part', true);
        }

        function apply(lay, { focus = true } = {}) {
            surface.classList.add('ov-arrange-surface');
            surface.style.setProperty('--ov-cols', String(cols));
            surface.style.setProperty('--ov-cell', `${cell}px`);
            surface.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
            surface.style.gridAutoRows = `minmax(${cell}px, auto)`;
            const dockMode = (catalog.id || '').split('.').pop() === 'overlay';
            if (dockMode) { surface.style.display = surface.style.display || 'block'; surface.style.position = 'relative'; }
            for (const el of partEls()) flatten(el);
            for (const p of (catalog.parts || [])) {
                const el = elOf(p.id), e = entryOf(lay, p.id);
                if (!el || !e) continue;
                paintPlace(el, e);
                if (focus && !dockMode) {
                    el.tabIndex = 0;
                    el.setAttribute('role', 'group');
                    el.setAttribute('aria-label', `${p.name}${p.required ? ', required' : ''}. Arrow keys move it, Shift with the arrows resizes it, Enter opens its style.`);
                }
            }
            positionSelection();
        }

        function selectedEl() { return selected ? elOf(selected) : null; }
        function positionSelection() {
            const el = selectedEl();
            if (!el || el.hidden || closed) { sel.hidden = true; handle.hidden = true; styleBtn.hidden = true; return; }
            const r = el.getBoundingClientRect();
            sel.hidden = false; sel.style.left = `${r.left - 3}px`; sel.style.top = `${r.top - 3}px`; sel.style.width = `${r.width + 6}px`; sel.style.height = `${r.height + 6}px`;
            handle.hidden = false; handle.style.left = `${r.right - 20}px`; handle.style.top = `${r.bottom - 20}px`;
            styleBtn.hidden = false; styleBtn.style.left = `${r.left + 6}px`; styleBtn.style.top = `${r.top + 6}px`;
        }
        function select(id) {
            if (selected && elOf(selected)) elOf(selected).removeAttribute('data-ov-selected');
            selected = id;
            if (id && elOf(id)) elOf(id).setAttribute('data-ov-selected', 'true');
            positionSelection();
        }

        function labelOf(id) { return partName(catalog, id); }
        function where(d, place) {
            if (docked(place)) return `on the ${place.dock} edge, number ${Number(place.order) + 1}`;
            return `column ${place.x + 1}, row ${place.y + 1}, ${place.w} by ${place.h} cells`;
        }

        function paintActions() {
            const u = host.querySelector('[data-undo]'); if (u) u.disabled = !undoStack.length;
            const s = host.querySelector('[data-save]'); if (s) s.disabled = saving || !dirty;
            const sh = host.querySelector('[data-share]'); if (sh) sh.disabled = saving;
        }

        function refuse(reasons) {
            setStatus((reasons && reasons[0]) ? `Can't do that: ${reasons[0]}` : "Can't do that.", 'bad');
            const el = selectedEl(); if (el) el.setAttribute('data-ov-refused', 'true');
        }

        function commit(candidate, { announceText, push = true } = {}) {
            const v = validate(candidate);
            if (!v.ok) { refuse(v.reasons); return false; }
            if (push) pushUndo();
            working = candidate;
            const el = selectedEl(); if (el) el.removeAttribute('data-ov-refused');
            apply(working);
            markDirty();
            if (announceText) { const id = selected; setStatus(announceText, 'ok'); if (id) announce(`${labelOf(id)} is now ${where(device, entry(id).place)}.`); }
            return true;
        }

        function moveBy(id, dx, dy) {
            const e = clone(entry(id)); if (!e) return;
            const p = catalogPart(catalog, id) || { min: { w: 1, h: 1 } };
            if (docked(e.place)) {
                if (dx) e.place.dock = dx < 0 ? 'left' : 'right';
                else if (dy) e.place.dock = dy < 0 ? 'top' : 'bottom';
            } else {
                e.place.x = Math.max(0, Math.min(cols - e.place.w, e.place.x + dx));
                e.place.y = Math.max(0, e.place.y + dy);
                if (e.place.x === entry(id).place.x && e.place.y === entry(id).place.y) return;
            }
            const cand = snapshot();
            const at = cand.parts.findIndex((x) => x.id === id);
            cand.parts[at] = e;
            commit(cand, { announceText: `${labelOf(id)} moved to ${where(device, e.place)}.` });
        }

        function resizeBy(id, dw, dh) {
            const e = clone(entry(id)); if (!e) return;
            const p = catalogPart(catalog, id) || { min: { w: 1, h: 1 } };
            if (docked(e.place)) {
                e.place.w = Math.max(1, Math.min(24, e.place.w + dw));
                e.place.h = Math.max(1, Math.min(24, e.place.h + dh));
            } else {
                e.place.w = Math.max(1, Math.min(cols - e.place.x, e.place.w + dw));
                e.place.h = Math.max(1, e.place.h + dh);
            }
            if (e.place.w === entry(id).place.w && e.place.h === entry(id).place.h) return;
            const cand = snapshot();
            const at = cand.parts.findIndex((x) => x.id === id);
            cand.parts[at] = e;
            commit(cand, { announceText: `${labelOf(id)} is now ${where(device, e.place)}.` });
        }

        // Pointer drag: move, then the corner handle for resize. A refused cell keeps the last one that passed.
        function cellAt(clientX, clientY) {
            const r = surface.getBoundingClientRect();
            const col = Math.max(0, Math.min(cols - 1, Math.floor((clientX - r.left) / (r.width / cols))));
            const rows = (getComputedStyle(surface).gridTemplateRows || '').split(/\s+/).map(parseFloat).filter((n) => n > 0);
            let y = 0, top = r.top;
            for (let i = 0; i < rows.length; i++) { if (clientY < top + rows[i]) { y = i; break; } top += rows[i]; y = i + 1; }
            return { x: col, y };
        }
        function startDrag(e, id, mode) {
            if (e.button != null && e.button !== 0) return;
            const el = elOf(id); if (!el) return;
            if (preview) { setStatus('Keep or discard the suggestion first.'); return; }
            e.preventDefault();
            select(id);
            const p = clone(entry(id).place);
            drag = { id, mode, startX: e.clientX, startY: e.clientY, place: p, before: snapshot(), pushed: false, moved: false };
            el.setAttribute('data-ov-dragging', 'true');
            try { (mode === 'resize' ? handle : el).setPointerCapture(e.pointerId); } catch (_) { /* */ }
            onPointerMove = (ev) => {
                if (!drag) return;
                if (Math.abs(ev.clientX - drag.startX) + Math.abs(ev.clientY - drag.startY) < 3 && !drag.moved) return;
                drag.moved = true;
                const cand = snapshot();
                const at = cand.parts.findIndex((x) => x.id === drag.id);
                if (docked(drag.place)) {
                    if (drag.mode === 'resize') {
                        const colW = surface.getBoundingClientRect().width / cols;
                        const w = Math.max(1, Math.round((ev.clientX - drag.startX) / colW) + drag.place.w);
                        const h = Math.max(1, Math.round((ev.clientY - drag.startY) / cell) + drag.place.h);
                        if (w === cand.parts[at].place.w && h === cand.parts[at].place.h) return;
                        cand.parts[at].place.w = w; cand.parts[at].place.h = h;
                    } else {
                        const r = surface.getBoundingClientRect();
                        const dx = (ev.clientX - r.left) / Math.max(1, r.width);
                        const dy = (ev.clientY - r.top) / Math.max(1, r.height);
                        const dock = Math.abs(dx - 0.5) > Math.abs(dy - 0.5) ? (dx < 0.5 ? 'left' : 'right') : (dy < 0.5 ? 'top' : 'bottom');
                        const along = dock === 'left' || dock === 'right' ? dy : dx;
                        const order = Math.max(0, Math.min(63, Math.floor(along * 8)));
                        if (dock === cand.parts[at].place.dock && order === cand.parts[at].place.order) return;
                        cand.parts[at].place.dock = dock; cand.parts[at].place.order = order;
                    }
                    const v = validate(cand);
                    if (!v.ok) { refuse(v.reasons); return; }
                    if (!drag.pushed) { undoStack.push(drag.before); drag.pushed = true; }
                    working = cand; apply(working); markDirty();
                    return;
                }
                const c = cellAt(ev.clientX, ev.clientY);
                if (drag.mode === 'resize') {
                    const w = Math.max(1, c.x - drag.place.x + 1);
                    const h = Math.max(1, c.y - drag.place.y + 1);
                    if (w === cand.parts[at].place.w && h === cand.parts[at].place.h) return;
                    cand.parts[at].place.w = w; cand.parts[at].place.h = h;
                } else {
                    const colW = surface.getBoundingClientRect().width / cols;
                    const dx = Math.round((ev.clientX - drag.startX) / colW);
                    const x = Math.max(0, Math.min(cols - drag.place.w, drag.place.x + dx));
                    const y = Math.max(0, drag.place.y + (c.y - cellAt(drag.startX, drag.startY).y));
                    if (x === cand.parts[at].place.x && y === cand.parts[at].place.y) return;
                    cand.parts[at].place.x = x; cand.parts[at].place.y = y;
                }
                const v = validate(cand);
                if (!v.ok) { refuse(v.reasons); return; }
                if (!drag.pushed) { undoStack.push(drag.before); drag.pushed = true; }
                working = cand; apply(working); markDirty();
            };
            onPointerUp = () => {
                if (!drag) return;
                const done = drag; drag = null;
                const el2 = elOf(done.id);
                if (el2) { el2.removeAttribute('data-ov-dragging'); el2.removeAttribute('data-ov-refused'); }
                if (done.moved) {
                    const place = entry(done.id).place;
                    setStatus(`${labelOf(done.id)} is now ${where(device, place)}.`, 'ok');
                    announce(`${labelOf(done.id)} is now ${where(device, place)}.`);
                }
                positionSelection();
            };
            onPointerCancel = onPointerUp;
        }
        let onPointerMove = null, onPointerUp = null, onPointerCancel = null;
        const pointerMove = (e) => { if (onPointerMove) onPointerMove(e); };
        const pointerUp = (e) => { if (onPointerUp) { const f = onPointerUp; onPointerMove = null; onPointerUp = null; onPointerCancel = null; f(e); } };
        doc.addEventListener('pointermove', pointerMove, { passive: true });
        doc.addEventListener('pointerup', pointerUp);
        doc.addEventListener('pointercancel', pointerUp);

        // Long press (a phone) opens the sheet; a short press selects and focuses.
        let pressTimer = null;
        function onPartDown(e) {
            const el = e.target.closest && e.target.closest('[data-ov-part]');
            if (!el || !surface.contains(el)) return;
            if (e.target.closest('.ov-arrange-handle, .ov-arrange-style')) return;
            const id = el.dataset.ovPart;
            select(id);
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => { if (!drag) { openSheet(id); } }, 520);
            startDrag(e, id, 'move');
            if (e.pointerType === 'touch') try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ }
        }
        surface.addEventListener('pointerdown', onPartDown);
        const cancelPress = () => clearTimeout(pressTimer);
        surface.addEventListener('pointerup', cancelPress);
        surface.addEventListener('pointercancel', cancelPress);

        // Keyboard: arrows move, Shift+arrows resize, Enter opens the sheet.
        function onKey(e) {
            const el = e.target.closest && e.target.closest('[data-ov-part]');
            if (!el) return;
            const id = el.dataset.ovPart;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(id); return; }
            if (!/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return;
            e.preventDefault();
            const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
            const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
            if (e.shiftKey) resizeBy(id, dx, dy); else moveBy(id, dx, dy);
        }
        surface.addEventListener('keydown', onKey);

        handle.addEventListener('pointerdown', (e) => { if (selected) startDrag(e, selected, 'resize'); });
        styleBtn.addEventListener('click', () => { if (selected) openSheet(selected); });

        // ── The part's sheet ─────────────────────────────────────────────────────────────────────
        let sheet = null;
        function closeSheet() { if (sheet) { sheet.remove(); sheet = null; select(selected); } }
        function openSheet(id) {
            closeSheet();
            const p = catalogPart(catalog, id), e = entry(id);
            if (!p || !e) return;
            select(id);
            sheet = doc.createElement('section');
            sheet.className = 'ov-arrange-sheet';
            sheet.setAttribute('role', 'dialog');
            sheet.setAttribute('aria-modal', 'false');
            sheet.setAttribute('aria-label', `${p.name}`);
            const tints = (p.styles && p.styles.tints) || catalog.theme_tokens || ['surface'];
            const shapes = (p.styles && p.styles.shapes) || ['square'];
            const wp = clone(e.place);
            sheet.innerHTML = `<button type="button" class="ovk-btn ovk-btn--quiet ov-arrange-close" data-close>Close</button>
<h2>${esc(p.name)}</h2>
${p.required ? '<p>The Stop has to stay visible and at its size.</p>' : ''}
<label class="ov-arrange-row"><input type="checkbox" data-visible${e.visible === false ? '' : ' checked'}${p.required ? ' disabled' : ''}> <span>Visible</span></label>
<div class="ov-arrange-row"><span>Size</span><div class="ov-arrange-opts">
${(p.sizes || []).filter((s) => s.w >= p.min.w && s.h >= p.min.h).map((s) => `<label><input type="radio" name="ov-arrange-size" value="${s.w}x${s.h}"${docked(e.place) ? ' disabled' : (e.place.w === s.w && e.place.h === s.h ? ' checked' : '')}>${s.w} × ${s.h}</label>`).join('')}
<label>Width <input type="number" min="${p.min.w}" max="24" value="${e.place.w}" data-w style="width:4.5rem"></label>
<label>Height <input type="number" min="${p.min.h}" max="24" value="${e.place.h}" data-h style="width:4.5rem"></label>
</div></div>
<div class="ov-arrange-row"><span>Colour</span><div class="ov-arrange-opts">${(catalog.theme_tokens || tints).filter((t) => tints.includes(t)).map((t) => `<label><input type="radio" name="ov-arrange-tint" value="${esc(t)}"${e.style.tint === t ? ' checked' : ''}>${esc(t)}</label>`).join('')}</div></div>
<div class="ov-arrange-row"><span>Shape</span><div class="ov-arrange-opts">${shapes.map((s) => `<label><input type="radio" name="ov-arrange-shape" value="${esc(s)}"${e.style.shape === s ? ' checked' : ''}>${esc(s)}</label>`).join('')}</div></div>
<div class="ov-arrange-row"><span>Opacity</span><input type="range" min="0.4" max="1" step="0.05" value="${e.style.opacity}" data-opacity></div>
<label class="ov-arrange-row"><input type="checkbox" data-label${e.style.label === false ? '' : ' checked'}> <span>Show its label</span></label>
<div class="ov-arrange-row"><span>Keys</span><input type="text" data-keys value="${esc(((e.bindings && e.bindings.keys) || []).join(' '))}" placeholder="${esc(((p.bindings && p.bindings.keys) || []).join(' '))}" aria-label="Keys"></div>
<div class="ov-arrange-row"><span>Gamepad</span><input type="text" data-gamepad value="${esc(((e.bindings && e.bindings.gamepad) || []).join(' '))}" placeholder="${esc(((p.bindings && p.bindings.gamepad) || []).join(' '))}" aria-label="Gamepad controls"></div>
<p class="ov-arrange-status" data-sheet-status role="status" aria-live="polite"></p>`;
            doc.body.appendChild(sheet);
            const sheetStatus = sheet.querySelector('[data-sheet-status]');
            const setSheetStatus = (t, tone) => { sheetStatus.textContent = t; sheetStatus.dataset.tone = tone || ''; announce(t); };
            function change(fn) {
                const cand = snapshot();
                const at = cand.parts.findIndex((x) => x.id === id);
                fn(cand.parts[at], p);
                const v = validate(cand);
                if (!v.ok) { setSheetStatus(`Can't do that: ${v.reasons[0]}`, 'bad'); return false; }
                pushUndo(); working = cand; apply(working); markDirty(); setSheetStatus('', ''); return true;
            }
            sheet.querySelector('[data-close]').addEventListener('click', closeSheet);
            sheet.querySelector('[data-visible]').addEventListener('change', (ev) => {
                const on = ev.target.checked;
                const ok = change((x) => { x.visible = on; });
                if (!ok) ev.target.checked = !on;
                else announce(`${p.name} is ${on ? 'shown' : 'hidden'}.`);
            });
            sheet.querySelectorAll('input[name="ov-arrange-size"]').forEach((r) => r.addEventListener('change', () => {
                const [w, h] = r.value.split('x').map(Number);
                if (change((x) => { x.place.w = w; x.place.h = h; })) announce(`${p.name} is now ${w} by ${h} cells.`);
            }));
            const wIn = sheet.querySelector('[data-w]'), hIn = sheet.querySelector('[data-h]');
            for (const [inp, key] of [[wIn, 'w'], [hIn, 'h']]) inp.addEventListener('change', () => {
                const n = Number(inp.value);
                if (!Number.isInteger(n) || n < 1) { setSheetStatus(`Can't do that: ${p.name} needs at least ${key === 'w' ? p.min.w : p.min.h} cells.`, 'bad'); return; }
                change((x) => { x.place[key] = n; });
            });
            sheet.querySelectorAll('input[name="ov-arrange-tint"]').forEach((r) => r.addEventListener('change', () => { if (change((x) => { x.style.tint = r.value; })) announce(`${p.name} is ${r.value}.`); }));
            sheet.querySelectorAll('input[name="ov-arrange-shape"]').forEach((r) => r.addEventListener('change', () => { if (change((x) => { x.style.shape = r.value; })) announce(`${p.name} is ${r.value}.`); }));
            const op = sheet.querySelector('[data-opacity]');
            op.addEventListener('change', () => { if (change((x) => { x.style.opacity = Number(op.value); })) announce(`${p.name} is ${Math.round(op.value * 100)}% visible.`); });
            sheet.querySelector('[data-label]').addEventListener('change', (ev) => { const on = ev.target.checked; if (change((x) => { x.style.label = on; })) announce(`${p.name}'s label is ${on ? 'shown' : 'hidden'}.`); });
            const keys = sheet.querySelector('[data-keys]'), pad = sheet.querySelector('[data-gamepad]');
            const parse = (v) => String(v || '').trim().split(/\s+/).filter(Boolean);
            keys.addEventListener('change', () => { const v = parse(keys.value); if (change((x) => { x.bindings.keys = v; })) announce(`${p.name}'s keys: ${v.join(' ') || 'none'}.`); });
            pad.addEventListener('change', () => { const v = parse(pad.value); if (change((x) => { x.bindings.gamepad = v; })) announce(`${p.name}'s gamepad: ${v.join(' ') || 'none'}.`); });
            const first = sheet.querySelector('[data-close]'); if (first) first.focus();
        }
        function onDocKey(e) {
            if (e.key === 'Escape') { if (sheet) closeSheet(); else if (preview) discardPreview(); }
        }
        doc.addEventListener('keydown', onDocKey);

        // ── Ask OpenVibe, previewed ───────────────────────────────────────────────────────────────
        const ask = host.querySelector('form[data-ask]');
        const words = host.querySelector('#ov-arrange-words');
        let previewBar = null;
        function showPreview(sug, wordText) {
            preview = { layout: normal(sug.layout), summary: sug.summary || '', reasons: sug.reasons || [], words: wordText };
            apply(preview.layout);
            if (previewBar) previewBar.remove();
            previewBar = doc.createElement('div');
            previewBar.className = 'ov-arrange-preview';
            previewBar.setAttribute('role', 'group');
            previewBar.setAttribute('aria-label', 'OpenVibe\'s suggestion');
            previewBar.innerHTML = `<p><b>OpenVibe suggests:</b> ${esc(preview.summary)}</p><button type="button" class="ovk-btn ovk-btn--primary" data-keep>Keep</button><button type="button" class="ovk-btn ovk-btn--quiet" data-discard>Discard</button>`;
            host.querySelector('.ov-arrange-actions').before(previewBar);
            previewBar.querySelector('[data-keep]').addEventListener('click', keepPreview);
            previewBar.querySelector('[data-discard]').addEventListener('click', discardPreview);
            setStatus(preview.summary || 'Previewing OpenVibe\'s suggestion.', 'ok');
            announce(`OpenVibe suggests: ${preview.summary}. Keep or discard.`);
        }
        function keepPreview() {
            if (!preview) return;
            pushUndo(); working = preview.layout; preview = null;
            if (previewBar) { previewBar.remove(); previewBar = null; }
            apply(working); markDirty(); setStatus('Kept. Save it to keep it for next time.', 'ok');
            announce('Kept the suggestion. Save it to keep it.');
        }
        function discardPreview() {
            if (!preview) return;
            preview = null;
            if (previewBar) { previewBar.remove(); previewBar = null; }
            apply(working); setStatus('Discarded the suggestion.');
            announce('Discarded the suggestion.');
        }
        ask.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = words.value.trim();
            if (!text) return;
            if (typeof opts.onAsk !== 'function') { setStatus('Ask OpenVibe needs a signed-in person.', 'bad'); return; }
            if (preview) discardPreview();
            setStatus('Asking OpenVibe…');
            ask.querySelector('button').disabled = true;
            try {
                const request = { catalog, layout: clone(working), words: text, device };
                const sug = await opts.onAsk(text, request);
                if (!sug) { setStatus("OpenVibe couldn't answer. Try again.", 'bad'); return; }
                if (sug.ok === false || !isObj(sug.layout)) {
                    const why = (sug.reasons && sug.reasons[0]) || sug.summary || "OpenVibe couldn't do that.";
                    setStatus(`Can't do that: ${why}`, 'bad'); return;
                }
                const v = validate(sug.layout);
                if (!v.ok) { setStatus(`Can't do that: ${v.reasons[0]}`, 'bad'); return; }
                showPreview(sug, text);
            } catch (err) {
                setStatus(`OpenVibe could not answer: ${String(err && err.message || err)}`, 'bad');
            } finally { ask.querySelector('button').disabled = false; }
        });

        // ── Save, Share, Reset, Undo, Done ───────────────────────────────────────────────────────
        host.querySelector('[data-undo]').addEventListener('click', () => {
            if (!undoStack.length) return;
            working = undoStack.pop(); preview = null;
            if (previewBar) { previewBar.remove(); previewBar = null; }
            apply(working); markDirty(); setStatus('Undone.'); announce('Undone.');
        });
        host.querySelector('[data-reset]').addEventListener('click', () => {
            working = defaults(); preview = null;
            if (previewBar) { previewBar.remove(); previewBar = null; }
            pushUndo(); apply(working); markDirty(); setStatus('Reset to the default. Save it to keep it.', 'ok');
            announce('Reset to the default.');
        });
        host.querySelector('[data-save]').addEventListener('click', async () => {
            if (saving) return;
            const v = validate(working);
            if (!v.ok) { refuse(v.reasons); return; }
            if (typeof opts.onSave !== 'function') { setStatus('Sign in to save your layout.', 'bad'); return; }
            saving = true; paintActions(); setStatus('Saving…');
            try {
                const r = await opts.onSave(clone(working), { surface: catalog.id, device });
                if (r && r.ok === false) { setStatus(`Couldn't save: ${(r.reasons && r.reasons[0]) || r.message || 'try again.'}`, 'bad'); return; }
                dirty = false; setStatus('Saved. It follows you to your other devices.', 'ok');
                announce('Saved.');
            } catch (err) { setStatus(`Couldn't save: ${String(err && err.message || err)}`, 'bad'); }
            finally { saving = false; paintActions(); }
        });
        host.querySelector('[data-share]').addEventListener('click', async () => {
            if (typeof opts.onShare !== 'function') { setStatus('Sign in to share a layout.', 'bad'); return; }
            const v = validate(working);
            if (!v.ok) { refuse(v.reasons); return; }
            setStatus('Making a share link…');
            try {
                const r = await opts.onShare(clone(working), { surface: catalog.id, device });
                if (!r || !r.url) { setStatus(`Couldn't share: ${(r && r.reasons && r.reasons[0]) || 'try again.'}`, 'bad'); return; }
                shareBox(r.url);
                setStatus('Shared. Anyone with the link can use this arrangement.', 'ok');
            } catch (err) { setStatus(`Couldn't share: ${String(err && err.message || err)}`, 'bad'); }
        });
        function shareBox(url) {
            const box = doc.createElement('div');
            box.className = 'ov-arrange-share';
            box.innerHTML = `<label>Share this arrangement<input type="text" readonly value="${esc(url)}" aria-label="Share link"></label><button type="button" class="ovk-btn ovk-btn--quiet" data-copy>Copy link</button>`;
            host.querySelector('.ov-arrange-status').before(box);
            const input = box.querySelector('input');
            box.querySelector('[data-copy]').addEventListener('click', async () => {
                input.select();
                try { await navigator.clipboard.writeText(url); setStatus('Link copied.', 'ok'); }
                catch (_) { setStatus('Select the link and copy it.', 'ok'); }
            });
        }
        function close({ force = false } = {}) {
            if (closed) return;
            if (dirty && !force && !confirmFn('Leave without saving your arrangement?')) return;
            closed = true;
            if (previewBar) previewBar.remove();
            if (sheet) sheet.remove();
            host.remove(); live.remove(); sel.remove(); handle.remove(); styleBtn.remove();
            doc.removeEventListener('pointermove', pointerMove);
            doc.removeEventListener('pointerup', pointerUp);
            doc.removeEventListener('pointercancel', pointerUp);
            doc.removeEventListener('keydown', onDocKey);
            root.removeEventListener('resize', positionSelection);
            doc.removeEventListener('scroll', positionSelection, true);
            surface.removeEventListener('pointerdown', onPartDown);
            surface.removeEventListener('keydown', onKey);
            if (surfaceStyle == null) surface.removeAttribute('style'); else surface.setAttribute('style', surfaceStyle);
            surface.className = surfaceClass;
            for (const [el, o] of originals) {
                for (const a of ['data-ov-selected', 'data-ov-dragging', 'data-ov-refused', 'data-ov-flatten', 'data-ov-tint', 'data-ov-shape', 'data-ov-label', 'data-ov-keys', 'data-ov-gamepad', 'data-ov-dock', 'data-ov-order']) el.removeAttribute(a);
                if (o.style == null) el.removeAttribute('style'); else el.setAttribute('style', o.style);
                el.hidden = o.hidden;
                if (o.tabindex == null) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', o.tabindex);
                if (o.role == null) el.removeAttribute('role'); else el.setAttribute('role', o.role);
                if (o.label == null) el.removeAttribute('aria-label'); else el.setAttribute('aria-label', o.label);
                el.className = o.cls;
            }
            for (const a of surface.querySelectorAll('[data-ov-flatten]')) a.removeAttribute('data-ov-flatten');
            if (typeof opts.onApply === 'function') try { opts.onApply(clone(working)); } catch (_) { /* */ }
            if (typeof opts.onClose === 'function') try { opts.onClose(clone(working), { dirty }); } catch (_) { /* */ }
        }
        host.querySelector('[data-done]').addEventListener('click', () => close());

        surface.classList.add('ov-arrange-editing');
        apply(working);
        paintActions();
        positionSelection();
        root.addEventListener('resize', positionSelection, { passive: true });
        doc.addEventListener('scroll', positionSelection, { passive: true, capture: true });
        setStatus('Arrange: drag a part, or use the arrow keys. Shift with the arrows resizes.');
        return { close, apply: (lay) => { working = normal(lay); apply(working); }, layout: () => clone(working), destroy: () => close({ force: true }), get core() { return core; } };
    }

    root.OVArrange = { open, validate: fallbackValidate, defaults: fallbackDefaults, _fallback: { validate: fallbackValidate, defaults: fallbackDefaults }, VERSION };
    loadCore().then((c) => { if (c) { fallbackValidate.sdk = c; root.OVArrange.core = c; } }).catch(() => { /* the fallback rules stay */ });
})(typeof window !== 'undefined' ? window : globalThis);
