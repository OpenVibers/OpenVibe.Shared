'use strict';
// soft.js: what it adds to a server-rendered page, and everything it must leave alone. The real script runs in a small
// fake browser (no linkedom in the package's dev dependencies): the speculation-rule JSON is parsed and every exclusion
// is checked, the view-transition styles are read, and the OpenVibeSoft on/off/exclude API is exercised.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'soft.js'), 'utf8');

function element(tag) {
    return {
        tagName: String(tag).toUpperCase(), id: '', type: '', nonce: '', textContent: '', parentNode: null,
        setAttribute(name, value) { this[name] = String(value); },
        getAttribute(name) { return this[name] == null ? null : this[name]; },
        remove() {
            const p = this.parentNode;
            if (!p) return;
            const at = p.children.indexOf(this);
            if (at >= 0) p.children.splice(at, 1);
            if (p.lastChild === this) p.lastChild = p.children[p.children.length - 1] || null;
            this.parentNode = null;
        },
    };
}

function browser({ rules = true, transitions = true, motion = 'full', externalRules = false } = {}) {
    const head = {
        children: [], lastChild: null,
        appendChild(el) {
            if (el.parentNode) el.remove();
            el.parentNode = head;
            head.children.push(el);
            head.lastChild = el;
            return el;
        },
    };
    let external = null;
    const doc = {
        head, readyState: 'complete', scripts: [], currentScript: null,
        documentElement: {
            attrs: { 'data-ov-motion': motion },
            getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
            setAttribute(name, value) { this.attrs[name] = String(value); },
        },
        createElement: (tag) => element(tag),
        getElementById(id) { return head.children.find((el) => el.id === id) || null; },
        querySelector(sel) {
            if (sel === 'script[type="speculationrules"]') return head.children.find((el) => el.type === 'speculationrules') || null;
            if (sel.startsWith('script[type="speculationrules"]')) return external ? external : null;
            if (sel === '[') throw new Error('invalid selector');
            return null;
        },
        addEventListener() {},
    };
    if (externalRules) {
        external = element('script');
        external.type = 'speculationrules';
        external.id = 'somebody-elses-rules';
        external.textContent = '{"prefetch":[{"urls":["/x"]}]}';
        head.appendChild(external);
    }
    const ctx = {
        console, JSON, Object, String, Array, Promise, Error, Math, Number, Date,
        document: doc,
        HTMLScriptElement: { supports: (kind) => kind === 'speculationrules' && rules },
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        addEventListener() {},
    };
    if (transitions) ctx.CSSViewTransitionRule = function CSSViewTransitionRule() {};
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return { ctx, doc, head };
}

const rulesIn = (doc) => {
    const src = doc.head.children.find((el) => el.type === 'speculationrules');
    return src ? JSON.parse(src.textContent) : null;
};
const conditions = (rules) => rules.prefetch[0].where.and;
const notHref = (rules) => conditions(rules).find((c) => c.not && c.not.href_matches).not.href_matches;
const notSelector = (rules) => conditions(rules).find((c) => c.not && c.not.selector_matches).not.selector_matches;
const styleText = (doc) => (doc.head.children.find((el) => el.id === 'ov-soft-css') || {}).textContent || '';

// ── The API and the rule set ─────────────────────────────────────────────────────────────────────
{
    const { ctx, doc } = browser();
    const api = ctx.OpenVibeSoft;
    assert.deepStrictEqual(Object.keys(api).sort(), ['exclude', 'off', 'on'], 'window.OpenVibeSoft = { on, off, exclude }');
    for (const fn of Object.values(api)) assert.strictEqual(typeof fn, 'function');

    const rules = rulesIn(doc);
    assert.ok(rules, 'a speculationrules script is in the page');
    assert.strictEqual(rules.prefetch.length, 2, 'two prefetch rules: same-origin pages and the navbar\'s cross-site links');
    assert.strictEqual(rules.prerender, undefined, 'no prerender rule: our beacons do not defer yet');
    assert.strictEqual(rules.prefetch[0].eagerness, 'moderate', 'prefetch at moderate eagerness');
    assert.deepStrictEqual(conditions(rules)[0], { href_matches: '/*' }, 'same-origin paths only');
    assert.strictEqual(rules.prefetch[1].where.and[0].selector_matches, '[data-ov-net-link]', 'the navbar\'s cross-site links are kept');

    const paths = notHref(rules);
    for (const p of ['/auth/*', '/api/*', '/logout*', '/*logout*', '/signin*', '/*signin*', '/login*', '/internal/*']) {
        assert.ok(paths.includes(p), `never prefetches ${p}`);
    }
    for (const p of ['/*.pdf', '/*.zip', '/*.mp4', '/*.png']) assert.ok(paths.includes(p), `never prefetches ${p} (a download)`);

    const selectors = notSelector(rules);
    for (const s of ['[data-ov-no-prefetch]', '[data-no-prefetch]', '[download]', '[rel~=nofollow]', '[target=_blank]', '[href*="?"]', '[href^="#"]']) {
        assert.ok(selectors.includes(s), `never prefetches ${s}`);
    }

    const rulesEl = doc.head.children.find((el) => el.id === 'ov-soft-rules');
    assert.strictEqual(rulesEl.nonce, '', 'no nonce in a page that has none');
}

// ── The view-transition styles, and the bar's one name ──────────────────────────────────────────
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

// ── Calm and Off ────────────────────────────────────────────────────────────────────────────────
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

// ── exclude(), off() and on() ───────────────────────────────────────────────────────────────────
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

// ── A page that already has speculation rules keeps them ───────────────────────────────────────
{
    const { ctx, doc } = browser({ externalRules: true });
    assert.strictEqual(doc.head.children.filter((el) => el.type === 'speculationrules').length, 1, 'no second rule set');
    assert.strictEqual(rulesIn(doc).prefetch[0].urls[0], '/x', 'the page\'s own rules are untouched');
    ctx.OpenVibeSoft.exclude('.no-soft');
    assert.strictEqual(doc.head.children.filter((el) => el.type === 'speculationrules').length, 1, 'exclude() does not add one beside it');
}

// ── A browser without the features does nothing and does not throw ─────────────────────────────
{
    const { ctx, doc } = browser({ rules: false, transitions: false });
    assert.strictEqual(doc.head.children.length, 0, 'no script and no style');
    assert.doesNotThrow(() => { ctx.OpenVibeSoft.on(); ctx.OpenVibeSoft.off(); ctx.OpenVibeSoft.exclude('.x'); });
    assert.strictEqual(doc.head.children.length, 0, 'still nothing');
}

console.log('soft: prefetch exclusions, the bar name, Calm/Off, and on/off/exclude all pass');
