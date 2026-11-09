'use strict';
// The sheet follows a hosted checkout only to a host Billing names for the chosen provider, or to Billing itself.
// Anything else is refused before the browser navigates (a provider answer is never trusted to pick a host).
const assert = require('assert');
const { checkoutAllowed } = require('../ov-wallet');

const providers = [
    { name: 'stripe', hosts: ['checkout.stripe.com'] },
    { name: 'paypal', hosts: ['www.paypal.com', 'www.sandbox.paypal.com'] },
];

assert.strictEqual(checkoutAllowed('https://checkout.stripe.com/c/pay/cs_test_1', providers), true, "Stripe's own checkout host is followed");
assert.strictEqual(checkoutAllowed('https://www.paypal.com/checkoutnow?token=1', providers), true, 'PayPal live is followed');
assert.strictEqual(checkoutAllowed('https://www.sandbox.paypal.com/checkoutnow?token=1', providers), true, 'PayPal sandbox is followed');
assert.strictEqual(checkoutAllowed('https://billing.openvibe.network/checkout', providers), true, "Billing's own host is followed");
assert.strictEqual(checkoutAllowed('https://CHECKOUT.STRIPE.COM/c/pay/x', providers), true, 'the host compares case-insensitively');

assert.strictEqual(checkoutAllowed('https://evil.example.test/pay', providers), false, 'a foreign host is refused');
assert.strictEqual(checkoutAllowed('https://checkout.stripe.com.evil.test/pay', providers), false, 'a suffix lookalike is refused');
assert.strictEqual(checkoutAllowed('https://billing.openvibe.network.evil.test/', providers), false, 'a Billing lookalike is refused');
assert.strictEqual(checkoutAllowed('http://checkout.stripe.com/c/pay/x', providers), false, 'http is refused');
assert.strictEqual(checkoutAllowed('https://user:pass@checkout.stripe.com/c/pay/x', providers), false, 'credentials in the URL are refused');
assert.strictEqual(checkoutAllowed('javascript:alert(1)', providers), false, 'a non-URL is refused');
assert.strictEqual(checkoutAllowed(null, providers), false, 'no checkout URL is refused');

// An older Billing answer lists plain provider names and no hosts: the sheet fails closed rather than guessing.
assert.strictEqual(checkoutAllowed('https://checkout.stripe.com/c/pay/x', ['stripe']), false, 'a provider without hosts allows nothing');
assert.strictEqual(checkoutAllowed('https://checkout.stripe.com/c/pay/x', []), false, 'no providers allows only Billing');
assert.strictEqual(checkoutAllowed('https://billing.openvibe.network/checkout', []), true, "with no providers only Billing's host remains");

console.log('wallet checkout host: provider hosts followed, foreign/lookalike/http/credentialed URLs refused, old shape fails closed');
