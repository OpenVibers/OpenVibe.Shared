'use strict';

const assert = require('assert');
const { offerCard } = require('../offer-card');

const now = Date.parse('2026-11-09T12:00:00Z');
const html = offerCard({ title: '<Boot>', url: 'https://store.example/item', store: 'Shop', price: 90, shipping: null, currency: 'USD', size: '9', checked_at: '2026-11-09T09:00:00Z' }, { now });
assert.ok(html.includes('&lt;Boot&gt;'), 'the title is escaped');
assert.ok(html.includes('Shipping not stated'), 'unknown shipping stays unknown');
assert.ok(html.includes('$90.00'), 'the price is formatted as money');
assert.ok(html.includes('Size 9'));
assert.ok(html.includes('Checked 3 hours ago'));
assert.ok(offerCard({ price: 50, shipping: 0, currency: 'EUR' }).includes('€50.00') && offerCard({ price: 50, shipping: 0 }).includes('Free shipping'));
assert.ok(offerCard({ title: 'X' }).includes('Price not known yet') && offerCard({ title: 'X' }).includes('Check time not known yet'), 'nothing is invented');
assert.ok(offerCard({ title: 'X', price: 1, stale: true }).includes('may have changed'));
assert.ok(!offerCard({ url: 'javascript:alert(1)', title: 'Unsafe' }).includes('href="javascript:'), 'only http(s) links');
assert.ok(!offerCard({ title: 'X', price: 1, currency: '"><script>' }).includes('<script>'), 'a bad currency code falls back');
console.log('offer card: all checks passed');
