'use strict';
// panels.js: one open at a time, nested panels do not close their container, Escape closes all.
const assert = require('assert'); const vm = require('vm'); const fs = require('fs'); const path = require('path');
const observers = []; const listeners = {};
const mk = (name, parent) => { const cls = new Set(); const el = { name, parent, isConnected: true, scrollTop: 5,
    classList: { contains: c => cls.has(c), add: c => { cls.add(c); fire(el); }, remove: c => { cls.delete(c); fire(el); }, toggle: (c, f) => { (f === undefined ? !cls.has(c) : f) ? cls.add(c) : cls.delete(c); fire(el); } },
    contains: (o) => { for (let x = o; x; x = x.parent) if (x === el) return true; return false; } }; return el; };
const fire = (el) => observers.filter(o => o.el === el).forEach(o => o.cb());
const body = mk('body');
const ctx = vm.createContext({ console, MutationObserver: function (cb) { this.observe = (el) => observers.push({ el, cb, mo: this }); this.disconnect = () => { for (let i = observers.length - 1; i >= 0; i--) if (observers[i].mo === this) observers.splice(i, 1); }; },
    document: { body, addEventListener: (t, f) => { listeners[t] = f; } } });
ctx.window = ctx; ctx.globalThis = ctx; ctx.addEventListener = () => {};
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'panels.js'), 'utf8'), ctx);
const P = ctx.OpenVibePanels;
const menu = mk('menu'), drawer = mk('drawer'), sub = mk('sub', drawer);
P.register({ el: menu, openClass: 'show' }); P.register({ el: drawer, openClass: 'show' }); P.register({ el: sub, openClass: 'open' });
menu.classList.add('show'); assert.ok(body.classList.contains('ov-panel-open')); assert.equal(menu.scrollTop, 0, 'opens scrolled to the top');
drawer.classList.add('show'); assert.ok(!menu.classList.contains('show'), 'opening one closes the other');
sub.classList.add('open'); assert.ok(drawer.classList.contains('show'), 'a nested panel keeps its container open');
listeners.keydown({ key: 'Escape' }); assert.ok(!drawer.classList.contains('show') && !sub.classList.contains('open') && !body.classList.contains('ov-panel-open'), 'Escape closes everything');

// A registration ends with its signal (the navbar re-renders on every boost page move) or with unregister: the
// coordinator lets go of the element (holding it kept every old bar alive), stops watching it and never closes it again.
{
    const ac = new AbortController(); const old = mk('old-drawer'); let closedOld = 0;
    const off = P.register({ el: old, openClass: 'open', signal: ac.signal, close: () => { closedOld++; old.classList.remove('open'); } });
    assert.strictEqual(typeof off, 'function', 'register returns its unregister');
    assert.strictEqual(P.register({ el: old, openClass: 'open' }), off, 'registering the same element again: the same registration');
    assert.ok(observers.some(o => o.el === old), 'watched while registered');
    old.classList.add('open'); assert.ok(body.classList.contains('ov-panel-open'));
    ac.abort();
    assert.ok(!observers.some(o => o.el === old), 'the abort disconnected its observer');
    assert.ok(!P.anyOpen() && !body.classList.contains('ov-panel-open'), 'an unregistered panel no longer counts as open');
    menu.classList.add('show'); assert.strictEqual(closedOld, 0, 'opening another panel no longer closes it');
    menu.classList.remove('show');
    const late = mk('late'); P.register({ el: late, signal: ac.signal });
    assert.ok(!observers.some(o => o.el === late), 'an already-aborted signal registers nothing');
    const byEl = mk('by-el'); P.register({ el: byEl });
    P.unregister(byEl); assert.ok(!observers.some(o => o.el === byEl), 'unregister(el) lets go too');
    off(); P.unregister(mk('never-registered'));   // both are no-ops
}
console.log('panels: all checks passed');
