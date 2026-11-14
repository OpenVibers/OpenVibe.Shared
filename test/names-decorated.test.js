'use strict';
// §Z.3 (11-13), the owner: "make sure user name decoration … applies everywhere". A person's name wears what their
// person wears (OpenVibe.Inventory through items.js; items.css) — their effect, their hat, their badge — wherever
// Shared draws the name: a card, a message, a comment, the menu, the account list, the share sheet.
//
// Two halves:
//   1. a sweep over every renderer that draws a person's name: each place that writes a display_name/username into
//      markup must set data-ov-subject on that same element, so the name can be found and dressed. The few places
//      that are not a name (an initial letter, an @handle, a comparison, a key) are in a skip list, one reason each.
//   2. the behaviour of the one call every renderer makes: OV.names(scope) loads items.js once a page and calls
//      OpenVibeItems.decorate(scope); with no subject under the scope it does nothing at all, and it never throws.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// ── 1. the sweep ────────────────────────────────────────────────────────────────────────────────────────────────────
// Every renderer that draws a person's name.
const FILES = [
    'navbar.js', 'ov-user.js', 'user-card.js', 'profile-panel.js', 'messages.js', 'thread.js', 'search.js',
    'dock.js', 'dock-share.js', 'ov-share.js', 'account-switcher.js', 'footer.js', 'ov-composer.js', 'ov-thread.js',
];
// A line that writes a person's name (or a handle) into markup.
const NAME = /display_name|\busername\b|\bname\(c\)|\bnameOf\(|\w*NameMarkup\(/;
const WRITES = /(textContent|innerHTML|outerHTML|appendChild|insertAdjacentHTML|\btext\(|\bel\(|\belement\(|\bh\(|\bhtml\(|\bsetSubject\(|\bovmSetSubject\(|\bsubjectAttr\(|\w*NameMarkup\()/;
// The same element carrying its person's subject.
const SUBJECT = /(data-ov-subject|\bsetSubject\(|\bovmSetSubject\(|\bsubjectAttr\(|\w*NameMarkup\()/;
// The places that write something of a person that is not the name: each with its reason.
const SKIP = [
    { file: 'ov-user.js', at: /person\.username\[0\]/, reason: 'the picture\'s initial letter — a letter, not the name' },
    { file: 'ov-user.js', at: /@\$\{person\.username\}/, reason: 'the @handle under the name — a handle, not the name' },
    { file: 'profile-panel.js', at: /@\$\{p\.username\}/, reason: 'the @handle under the name — a handle, not the name' },
    { file: 'messages.js', at: /message\.display_name \|\| message\.username \|\| '\?'/, reason: 'the picture\'s initial letter — a letter, not the name' },
    { file: 'dock.js', at: /prev\.username === m\.username/, reason: 'a comparison that picks a class, not a name in markup' },
    { file: 'dock.js', at: /input\.name = 'username'/, reason: 'a form field\'s name attribute, not a person\'s name' },
    { file: 'dock-share.js', at: /found\[0\]\.username/, reason: 'a sentence that names a handle to say nobody is called that' },
    { file: 'ov-share.js', at: /s\.owner\.username/, reason: 'the owner\'s handle in a line of the sheet' },
    { file: 'ov-share.js', at: /sugg-\$\{p\.username\}/, reason: 'a chip\'s key — the handle as a key' },
    { file: 'ov-share.js', at: /give-\$\{p\.username\}/, reason: 'a chip\'s key — the handle as a key' },
    { file: 'ov-share.js', at: /handle\(p\)|handle\(r\)/, reason: 'the @handle under the name — a handle, not the name' },
];

// A label is not a name people read: an aria-label, a title, an alt or a placeholder says the name to a machine.
const LABEL = (line) => line
    .replace(/'aria-label':\s*`[^`]*`/g, '')
    .replace(/setAttribute\(\s*'aria-label',\s*`[^`]*`\s*\)/g, '')
    .replace(/\baria-label="[^"]*"/g, '')
    .replace(/\btitle="[^"]*"/g, '')
    .replace(/\balt="[^"]*"/g, '')
    .replace(/\bplaceholder="[^"]*"/g, '');

for (const file of FILES) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const lines = src.split('\n');
    let names = 0;
    lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;      // a comment says nothing into markup
        const said = LABEL(line);                                                            // labels are not names people read
        if (!NAME.test(said) || !WRITES.test(said)) return;
        const where = `${file}:${i + 1}`;
        const skip = SKIP.find((s) => s.file === file && s.at.test(line));
        if (skip) {
            assert.ok(skip.reason && skip.reason.length > 10, `${where}: a skip without a reason`);
            return;
        }
        assert.ok(SUBJECT.test(line), `${where}: a person's name is written into markup without data-ov-subject — ${t.slice(0, 120)}`);
        names++;
    });
    // A renderer that draws people's names must actually dress them (never lose the tagging by accident).
    if (['search.js', 'dock-share.js', 'ov-thread.js'].includes(file)) continue;      // these draw no person's name
    assert.ok(names > 0, `${file}: no name carries a subject any more`);
}

// The sweep knows what it reads: a file that disappears is a failure, not a silent pass.
assert.ok(fs.existsSync(path.join(ROOT, 'items.js')), 'items.js is what dresses a name');
assert.ok(fs.existsSync(path.join(ROOT, 'items.css')), 'items.css is what draws the effect, the hat and the badge');

// ── 2. the behaviour: OV.names(scope) ─────────────────────────────────────────────────────────────────────────
// The stub style of test/viewer-model.test.js: a browser made of plain objects, no network.
function stubElement(tag) {
    return {
        tagName: tag || '', style: {}, dataset: {}, attrs: {}, children: [], className: '', id: '', innerHTML: '', textContent: '',
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
        appendChild(c) { this.children.push(c); return c; }, prepend(c) { this.children.unshift(c); }, remove() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
        querySelector() { return null; }, querySelectorAll() { return []; },
    };
}
function load() {
    const scripts = [];
    const links = [];
    global.location = { hostname: 'openvibe.games', href: 'https://openvibe.games/', pathname: '/', protocol: 'https:' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* */ }
    const html = stubElement('html');
    html.style = { setProperty() {}, removeProperty() {} };
    global.document = {
        cookie: '', title: 'T', readyState: 'complete', visibilityState: 'visible', documentElement: html, body: stubElement('body'),
        head: { appendChild(n) { if (String(n.tagName).toLowerCase() === 'script') scripts.push(n); else links.push(n); return n; } },
        getElementById: () => null,
        querySelector: (sel) => (sel === 'link[data-ov-items-css]' ? (links[0] || null) : null),
        querySelectorAll: () => [],
        createElement: (tag) => stubElement(tag),
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.matchMedia = (q) => ({ matches: false });
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    delete global.OV;
    delete global.OpenVibeItems;
    delete require.cache[require.resolve(path.join(ROOT, 'navbar.js'))];
    const navbar = require(path.join(ROOT, 'navbar.js'));
    return { navbar, scripts, links };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
// A scope: a part of a page. `withSubject` says whether a name with a subject is under it.
const scope = (withSubject) => ({
    querySelector: (sel) => (withSubject && sel === '[data-ov-subject]' ? {} : null),
    querySelectorAll: () => [],
});

(async () => {
    // A scope with no subject: nothing is dressed, and items.js is not even fetched.
    {
        const { navbar, scripts } = load();
        let dressed = 0;
        global.OpenVibeItems = { decorate: () => { dressed++; return 0; } };
        assert.strictEqual(navbar.names(scope(false)), 0, 'a scope with no subject dresses nothing');
        assert.strictEqual(dressed, 0, 'decorate is not called for a scope with no subject');
        assert.strictEqual(scripts.filter((s) => /items\.js/.test(s.src)).length, 0, 'items.js is not loaded for a scope with no subject');
    }

    // A scope with a subject: items.js is loaded once, and decorate is called with the scope.
    {
        const { navbar, scripts, links } = load();
        const seen = [];
        global.OpenVibeItems = undefined;                 // items.js has not arrived yet
        const one = scope(true), two = scope(true);
        assert.strictEqual(navbar.names(one), 0, 'the names wait for items.js');
        assert.strictEqual(navbar.names(two), 0, 'the names wait for items.js');
        const loaded = scripts.filter((s) => /items\.js/.test(s.src));
        assert.strictEqual(loaded.length, 1, 'items.js is loaded once a page, not once a name');
        assert.ok(links.some((l) => /items\.css/.test(l.href)), 'items.css is loaded beside it');
        global.OpenVibeItems = { decorate: (s) => { seen.push(s); return 1; } };
        loaded[0].onload();
        await tick();
        assert.deepStrictEqual(seen, [one, two], 'decorate is called with the scope that was asked for');
    }

    // items.js is already there: the names are dressed at once, with no second copy of the script.
    {
        const { navbar, scripts } = load();
        const seen = [];
        global.OpenVibeItems = { decorate: (s) => { seen.push(s); return 1; } };
        const one = scope(true);
        assert.strictEqual(navbar.names(one), 1, 'the names are dressed at once');
        assert.deepStrictEqual(seen, [one], 'decorate is called with the scope');
        assert.strictEqual(scripts.filter((s) => /items\.js/.test(s.src)).length, 0, 'items.js is not loaded again');
    }

    // The one call every renderer makes: OV.names(scope) — the same thing, under its short name.
    {
        const { navbar } = load();
        assert.strictEqual(typeof navbar.names, 'function', 'OpenVibeNavbar.names(scope) is the one call');
        assert.strictEqual(typeof global.OV.names, 'function', 'OV.names(scope) is the one call');
        const seen = [];
        global.OpenVibeItems = { decorate: (s) => { seen.push(s); return 1; } };
        const one = scope(true);
        global.OV.names(one);
        assert.deepStrictEqual(seen, [one], 'OV.names decorates the scope');
    }

    // It never throws: a name stays plain when anything fails.
    {
        const { navbar } = load();
        global.OpenVibeItems = { decorate: () => { throw new Error('the inventory is down'); } };
        assert.doesNotThrow(() => navbar.names(scope(true)), 'a failing inventory leaves the name plain');
        assert.doesNotThrow(() => navbar.names(null), 'no scope is no problem');
        assert.doesNotThrow(() => navbar.names({}), 'a scope without a query is no problem');
    }

    console.log('names-decorated: ok');
})().catch((e) => { console.error(e); process.exit(1); });
