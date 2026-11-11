'use strict';
// soft.js: what it adds to a server-rendered page, and everything it must leave alone. The real script runs in a small
// fake browser (no linkedom in the package's dev dependencies): the speculation-rule JSON is parsed and every exclusion
// is checked, the intent prefetcher is driven with presses and hovers, the view-transition styles are read, the mark's
// navStart/navEnd are counted, and the OpenVibeSoft on/off/exclude API is exercised.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'soft.js'), 'utf8');
const LOCATION = { href: 'https://openvibe.test/a', origin: 'https://openvibe.test', pathname: '/a', search: '' };
const MATCHERS = {
    '[data-ov-no-prefetch]': (el) => el.attrs['data-ov-no-prefetch'] != null,
    '[data-no-prefetch]': (el) => el.attrs['data-no-prefetch'] != null,
    '[download]': (el) => el.attrs.download != null,
    '[rel~=nofollow]': (el) => /\bnofollow\b/.test(el.attrs.rel || ''),
    '[target=_blank]': (el) => el.attrs.target === '_blank',
    '[href*="?"]': (el) => String(el.attrs.href || '').includes('?'),
    '[href^="#"]': (el) => String(el.attrs.href || '').startsWith('#'),
    '.no-soft': (el) => /\bno-soft\b/.test(el.className || ''),
    '#marked': (el) => el.id === 'marked',
};
function matches(el, selector) {
    if (selector === '[') throw new Error('invalid selector');
    return String(selector).split(',').map((s) => s.trim()).filter(Boolean).some((s) => {
        if (MATCHERS[s]) return MATCHERS[s](el);
        if (s.startsWith('.') && !s.includes(' ')) return new RegExp('(^|\\s)' + s.slice(1) + '(\\s|$)').test(el.className || '');
        if (s.startsWith('#')) return el.id === s.slice(1);
        if (s === 'a[href]') return el.tagName === 'A' && el.attrs.href != null;
        if (s === 'script[type="speculationrules"]') return el.tagName === 'SCRIPT' && el.attrs.type === 'speculationrules';
        return false;
    });
}

function element(tag) {
    const el = {
        tagName: String(tag).toUpperCase(), id: '', type: '', nonce: '', textContent: '', parentNode: null,
        children: [], attrs: {}, listeners: {}, className: '',
        setAttribute(name, value) {
            this.attrs[name] = String(value);
            if (name === 'id') this.id = String(value);
            if (name === 'type') this.type = String(value);
            if (name === 'class') this.className = String(value);
        },
        getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
        hasAttribute(name) { return this.attrs[name] != null; },
        removeAttribute(name) { delete this.attrs[name]; },
        matches(selector) { return matches(this, selector); },
        closest(selector) {
            let p = this;
            while (p) { if (p.matches && p.matches(selector)) return p; p = p.parentNode; }
            return null;
        },
        contains(other) {
            let p = other;
            while (p) { if (p === this) return true; p = p.parentNode; }
            return false;
        },
        addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
        dispatch(type, event = {}) {
            event.target = event.target || this;
            for (const fn of this.listeners[type] || []) fn(event);
        },
        remove() {
            const p = this.parentNode;
            if (!p) return;
            const at = p.children.indexOf(this);
            if (at >= 0) p.children.splice(at, 1);
            if (p.lastChild === this) p.lastChild = p.children[p.children.length - 1] || null;
            this.parentNode = null;
        },
    };
    return el;
}

function browser({ rules = true, transitions = true, motion = 'full', externalRules = false, connection = null,
    marks = false, storage = null, hover = false, reduced = false } = {}) {
    const head = element('head');
    head.appendChild = function (el) {
        if (el.parentNode) el.remove();
        el.parentNode = head;
        head.children.push(el);
        head.lastChild = el;
        return el;
    };
    head.lastChild = null;
    const all = element('document');
    all.tagName = 'DOCUMENT';
    const doc = {
        head, readyState: 'complete', scripts: [], currentScript: null, documentElement: element('html'), body: element('body'),
        createElement: (tag) => element(tag),
        getElementById(id) { return head.children.find((el) => el.id === id) || null; },
        querySelector(sel) {
            if (sel === 'script[type="speculationrules"]') return head.children.find((el) => el.type === 'speculationrules') || null;
            if (sel.startsWith('script[type="speculationrules"]:not(')) return head.children.find((el) => el.type === 'speculationrules' && el.id !== 'ov-soft-rules') || null;
            if (sel === '[') throw new Error('invalid selector');
            return null;
        },
        querySelectorAll(sel) {
            if (String(sel).includes('.ov-mark')) return marks ? [element('span')] : [];
            return [];
        },
        addEventListener(type, fn) { (doc.listeners[type] = doc.listeners[type] || []).push(fn); },
        listeners: {},
        dispatch(type, event = {}) { for (const fn of doc.listeners[type] || []) fn(Object.assign({ button: 0 }, event)); },
    };
    doc.documentElement.attrs = { 'data-ov-motion': motion };
    if (externalRules) {
        const external = element('script');
        external.type = 'speculationrules';
        external.id = 'somebody-elses-rules';
        external.textContent = '{"prefetch":[{"urls":["/x"]}]}';
        head.appendChild(external);
    }
    const store = storage || new Map();
    const ctx = {
        console, JSON, Object, String, Array, Promise, Error, Math, Number, Date, RegExp, Set, Map, URL, WeakMap, WeakSet,
        document: doc, location: LOCATION,
        navigator: { connection },
        sessionStorage: {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
            removeItem: (k) => store.delete(k),
        },
        HTMLScriptElement: { supports: (kind) => kind === 'speculationrules' && rules },
        matchMedia: (q) => ({ matches: q.includes('prefers-reduced-motion') ? reduced : q.includes('hover: hover') ? hover : false, addEventListener() {} }),
        addEventListener(type, fn) { (ctx.listeners[type] = ctx.listeners[type] || []).push(fn); },
        listeners: {},
        dispatch(type, event = {}) { for (const fn of ctx.listeners[type] || []) fn(event); },
        setTimeout, clearTimeout,
    };
    if (transitions) ctx.CSSViewTransitionRule = function CSSViewTransitionRule() {};
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return { ctx, doc, head, storage: store };
}

const link = (href, attrs = {}) => { const a = element('a'); a.setAttribute('href', href); for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v); return a; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const press = (doc, a) => doc.dispatch('pointerdown', { target: a });
const hoverIn = (doc, a) => doc.dispatch('mouseover', { target: a });
const rulesIn = (doc) => {
    const src = doc.head.children.find((el) => el.type === 'speculationrules');
    return src ? JSON.parse(src.textContent) : null;
};
const conditions = (rules) => rules.prefetch[0].where.and;
const notHref = (rules) => conditions(rules).find((c) => c.not && c.not.href_matches).not.href_matches;
const notSelector = (rules) => conditions(rules).find((c) => c.not && c.not.selector_matches).not.selector_matches;
const styleText = (doc) => (doc.head.children.find((el) => el.id === 'ov-soft-css') || {}).textContent || '';
const prefetches = (doc) => doc.head.children.filter((el) => el.rel === 'prefetch');

(async () => {
    // ── The API and the rule set ─────────────────────────────────────────────────────────────────
    {
        const { ctx, doc } = browser();
        const api = ctx.OpenVibeSoft;
        assert.deepStrictEqual(Object.keys(api).sort(), ['exclude', 'off', 'on'], 'window.OpenVibeSoft = { on, off, exclude }');
        for (const fn of Object.values(api)) assert.strictEqual(typeof fn, 'function');

        const rules = rulesIn(doc);
        assert.ok(rules, 'a speculationrules script is in the page');
        assert.strictEqual(rules.prefetch.length, 2, 'two prefetch rules: same-origin pages and the navbar\'s cross-site links');
        assert.strictEqual(rules.prerender, undefined, 'no prerender rule: our beacons do not defer yet');
        assert.strictEqual(rules.prefetch[0].eagerness, 'conservative', 'a same-origin prefetch starts at the press');
        assert.deepStrictEqual(conditions(rules)[0], { href_matches: '/*' }, 'same-origin paths only');
        assert.strictEqual(rules.prefetch[1].eagerness, 'moderate', 'the navbar\'s cross-site warm-up stays on hover');
        assert.strictEqual(rules.prefetch[1].where.and[0].selector_matches, '[data-ov-net-link]', 'the navbar\'s cross-site links are kept');

        const paths = notHref(rules);
        for (const p of ['/auth/*', '/api/*', '/logout*', '/*logout*', '/signin*', '/*signin*', '/login*', '/internal/*']) {
            assert.ok(paths.includes(p), `never prefetches ${p}`);
        }
        for (const p of ['/*.pdf', '/*.zip', '/*.mp4', '/*.png']) assert.ok(paths.includes(p), `never prefetches ${p} (a download)`);

        const selectors = notSelector(rules);
        for (const s of ['[data-ov-no-prefetch]', '[data-no-prefetch]', '[download]', '[rel~=nofollow]', '[target=_blank]', '[href*="?"]', '[href^="#"]', '[data-method]', '[data-turbo-method]']) {
            assert.ok(selectors.includes(s), `never prefetches ${s}`);
        }

        const rulesEl = doc.head.children.find((el) => el.id === 'ov-soft-rules');
        assert.strictEqual(rulesEl.nonce, '', 'no nonce in a page that has none');
    }

    // ── Prefetch on intent, never on what must not be fetched ────────────────────────────────────
    {
        const { doc } = browser({ rules: false, hover: true });
        const ok = link('/two');
        press(doc, ok);
        assert.strictEqual(prefetches(doc).length, 1, 'a press fetches the same-site page before the click');
        assert.strictEqual(prefetches(doc)[0].getAttribute('href'), 'https://openvibe.test/two', 'the absolute URL');
        assert.strictEqual(prefetches(doc)[0].getAttribute('as'), 'document', 'as a document');
        press(doc, ok);
        assert.strictEqual(prefetches(doc).length, 1, 'a second press does not fetch it again');

        for (const a of [link('/logout'), link('/login'), link('/api/x'), link('/file.zip'), link('/two?delete=1'), link('/two', { download: '' }),
            link('/two', { target: '_blank' }), link('/two', { 'data-ov-no-prefetch': '' }), link('/two', { 'data-method': 'post' }), link('#top'), link('https://elsewhere.test/two')]) {
            press(doc, a);
        }
        assert.strictEqual(prefetches(doc).length, 1, 'sign-in/out, the API, downloads, queries, marked links, anchors and other origins are out');

        const hovered = link('/three');
        hoverIn(doc, hovered);
        await wait(40);
        assert.strictEqual(prefetches(doc).length, 1, 'a hover shorter than 80 ms fetches nothing');
        await wait(80);
        assert.strictEqual(prefetches(doc).length, 2, '80 ms of hover fetches it');
        assert.strictEqual(prefetches(doc)[1].getAttribute('href'), 'https://openvibe.test/three', 'the hovered page');
    }

    // Hover is a computer's signal only, and a data saver or 2G/3G connection never gets a speculative fetch.
    {
        const { doc } = browser({ rules: false, hover: false });
        hoverIn(doc, link('/two'));
        await wait(120);
        assert.strictEqual(prefetches(doc).length, 0, 'no hover prefetch without a mouse');
    }
    for (const connection of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }, { effectiveType: '3g' }]) {
        const { doc } = browser({ rules: false, connection, hover: true });
        press(doc, link('/two'));
        hoverIn(doc, link('/three'));
        await wait(120);
        assert.strictEqual(prefetches(doc).length, 0, `no prefetch on ${JSON.stringify(connection)}`);
        assert.strictEqual(rulesIn(doc), null, 'and no speculation rule either');
    }
    {
        const { doc } = browser({ connection: { effectiveType: '4g' } });
        assert.ok(rulesIn(doc), 'a fast connection gets the rule set');
    }

    // At most four in flight; a finished fetch frees its slot.
    {
        const { doc } = browser({ rules: false });
        const links = ['/1', '/2', '/3', '/4', '/5', '/6'].map((h) => link(h));
        for (const a of links) press(doc, a);
        assert.strictEqual(prefetches(doc).length, 4, 'at most four prefetches at once');
        prefetches(doc)[0].dispatch('load');
        press(doc, links[4]);
        assert.strictEqual(prefetches(doc).length, 5, 'a finished one frees a slot');
        for (const a of links.slice(0, 4)) assert.ok(prefetches(doc).some((el) => el.getAttribute('href').endsWith(a.getAttribute('href'))), `still has ${a.getAttribute('href')}`);
    }

    // The conservative rule already covers a press in Chrome; soft.js does not add a second GET there.
    {
        const { doc } = browser();
        press(doc, link('/two'));
        assert.strictEqual(prefetches(doc).length, 0, 'no link beside the speculation rule for a press');
    }

    // ── The mark: navStart on the press, navEnd on the arriving page's first paint ───────────────
    {
        const { ctx, doc, storage } = browser({ rules: false, marks: true });
        const calls = [];
        ctx.OVMark = { navStart: (k) => calls.push(`start:${k}`), navEnd: (k) => calls.push(`end:${k}`) };
        press(doc, link('/two'));
        assert.deepStrictEqual(calls, ['start:page'], 'the ring starts on the press, not the click');
        assert.ok(Number(storage.get('ov-soft-press')) > 0, 'the next page is told a press started the move');
        assert.strictEqual(prefetches(doc).length, 1, 'and the press prefetched');
    }
    {
        const storage = new Map([['ov-soft-press', String(Date.now())], ['ov-nav-click', String(Date.now())]]);
        const { ctx, doc } = browser({ marks: true, storage });
        const calls = [];
        ctx.OVMark = { navStart: (k) => calls.push(`start:${k}`), navEnd: (k) => calls.push(`end:${k}`) };
        ctx.dispatch('pagereveal', {});
        await wait(60);
        assert.deepStrictEqual(calls, ['end:page'], 'the ring finishes once, on the next page');
        assert.strictEqual(storage.has('ov-soft-press'), false, 'the marker is consumed');
        assert.strictEqual(storage.has('ov-nav-click'), true, 'ov-mark keeps its marker so it can learn the pace');
        assert.strictEqual(ctx.__ovSoftNavEnded, true, 'ov-mark knows soft.js ended it');
    }
    {
        const { ctx } = browser({ marks: true });
        const calls = [];
        ctx.OVMark = { navStart: (k) => calls.push(`start:${k}`), navEnd: (k) => calls.push(`end:${k}`) };
        ctx.dispatch('pagereveal', {});
        await wait(30);
        assert.deepStrictEqual(calls, [], 'a page nobody arrived at from a press finishes nothing');
    }

    // ── The view-transition styles, and the bar's one name ──────────────────────────────────────
    {
        const { doc } = browser({ motion: 'full' });
        const css = styleText(doc);
        assert.ok(css.includes('@view-transition{navigation:auto}'), 'opts cross-document transitions in');
        assert.ok(css.includes('html #navbar-mount{view-transition-name:ov-soft-bar}'), 'the bar mount is the named element');
        assert.ok(css.includes('html #navbar-mount .openvibe-navbar{view-transition-name:none}'), 'the nested bar is not named twice');
        assert.ok(css.includes('::view-transition-group(ov-soft-bar)'), 'the bar group is styled');
        assert.ok(css.includes('animation:none'), 'and does not move');
        assert.ok(css.includes('--ov-soft-fade:.18s'), 'the page cross-fade is 180 ms');
        assert.ok(css.includes('html[data-ov-motion=reduced]{--ov-soft-fade:.12s}'), 'Calm is shorter');
    }
    {
        const { doc } = browser({ motion: 'reduced' });
        assert.ok(styleText(doc).includes('navigation:auto'), 'Calm keeps the transition');
    }
    {
        const { doc } = browser({ motion: 'off' });
        const css = styleText(doc);
        assert.ok(css.includes('@view-transition{navigation:none}'), 'Off has no transition');
        assert.ok(!css.includes('view-transition-name:ov-soft-bar'), 'and names nothing');
    }

    // ── exclude(), off() and on() ────────────────────────────────────────────────────────────────
    {
        const { ctx, doc } = browser();
        ctx.OpenVibeSoft.exclude('.no-soft');
        let rules = rulesIn(doc);
        assert.ok(conditions(rules).some((c) => c.not && c.not.selector_matches === '.no-soft'), 'exclude(selector) joins the rule');
        ctx.OpenVibeSoft.exclude('.no-soft');
        assert.strictEqual(conditions(rulesIn(doc)).filter((c) => c.not && c.not.selector_matches === '.no-soft').length, 1, 'once');

        ctx.OpenVibeSoft.exclude('[');   // invalid: must not break the whole rule set
        rules = rulesIn(doc);
        assert.ok(!conditions(rules).some((c) => c.not && c.not.selector_matches === '['), 'an invalid selector is ignored');

        ctx.OpenVibeSoft.off();
        assert.strictEqual(rulesIn(doc), null, 'off() removes the rules');
        assert.ok(styleText(doc).includes('navigation:none'), 'off() has no transition');

        ctx.OpenVibeSoft.on();
        rules = rulesIn(doc);
        assert.ok(rules && rules.prefetch && !rules.prerender, 'on() brings back prefetch only');
        assert.ok(styleText(doc).includes('navigation:auto'), 'on() brings back the transition');
        assert.ok(conditions(rules).some((c) => c.not && c.not.selector_matches === '.no-soft'), 'the exclusion survives on()');
    }
    {
        const { ctx, doc } = browser({ rules: false });
        ctx.OpenVibeSoft.exclude('#marked');
        press(doc, link('/two', { id: 'marked' }));
        assert.strictEqual(prefetches(doc).length, 0, 'exclude() keeps a link out of the prefetcher');
        ctx.OpenVibeSoft.off();
        press(doc, link('/four'));
        assert.strictEqual(prefetches(doc).length, 0, 'off() stops the prefetcher');
    }

    // ── A page that already has speculation rules keeps them ────────────────────────────────────
    {
        const { ctx, doc } = browser({ externalRules: true });
        assert.strictEqual(doc.head.children.filter((el) => el.type === 'speculationrules').length, 1, 'no second rule set');
        assert.strictEqual(rulesIn(doc).prefetch[0].urls[0], '/x', 'the page\'s own rules are untouched');
        ctx.OpenVibeSoft.exclude('.no-soft');
        assert.strictEqual(doc.head.children.filter((el) => el.type === 'speculationrules').length, 1, 'exclude() does not add one beside it');
        press(doc, link('/two'));
        assert.strictEqual(prefetches(doc).length, 1, 'a page\'s own rules may not cover a press, so the link is still made');
    }

    // ── A browser without the features does nothing and does not throw ──────────────────────────
    {
        const { ctx, doc } = browser({ rules: false, transitions: false });
        assert.strictEqual(doc.head.children.length, 0, 'no script and no style');
        press(doc, link('/two'));
        assert.strictEqual(doc.head.children.length, 1, 'the other browsers still get the intent prefetch');
        assert.doesNotThrow(() => { ctx.OpenVibeSoft.on(); ctx.OpenVibeSoft.off(); ctx.OpenVibeSoft.exclude('.x'); });
        assert.strictEqual(doc.head.children.length, 1, 'still no rule set and no transition');
    }

    console.log('soft: rules, intent prefetch, mark start/end, the bar name, Calm/Off, and on/off/exclude all pass');
})().catch((err) => { console.error(err); process.exit(1); });
