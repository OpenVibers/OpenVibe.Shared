'use strict';

const assert = require('assert');
const { offerCard } = require('../offer-card');

const html = offerCard({ title: '<Boot>', url: 'https://store.example/item', store: 'Shop', price: 90, shipping: null, currency: 'USD', size: '9', checked_at: '2026-11-09T00:00:00Z' });
assert.ok(html.includes('&lt;Boot&gt;'));
assert.ok(html.includes('Shipping not stated'));
assert.ok(html.includes('USD 90.00'));
assert.ok(html.includes('size 9'));
assert.ok(!offerCard({ url: 'javascript:alert(1)', title: 'Unsafe' }).includes('href="javascript:'));
console.log('offer card: all checks passed');
