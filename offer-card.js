'use strict';

/**
 * One offer from the network's shops (open.shoes, Deals, Coupons): what it is, where, the all-in price and how fresh
 * that price is. Unknown shipping and an unknown check time stay unknown; the card never invents them. Opus's design
 * (11-09): the title and the shop on the left, the price large on the right with what it includes under it, one quiet
 * freshness line; styles in kit-data.css (`.ov-offer`), so a site that loads the kit gets the look.
 *
 *   offerCard({ title, url, store, price | all_in, currency, shipping, size, condition, checked_at, stale })
 */
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function money(amount, currency) {
    const code = /^[A-Z]{3}$/.test(String(currency || '')) ? currency : 'USD';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount); } catch { return `${code} ${amount.toFixed(2)}`; }
}

function checkedText(iso, now = Date.now()) {
    const t = Date.parse(String(iso || ''));
    if (!Number.isFinite(t)) return 'Check time not known yet';
    const mins = Math.max(0, Math.round((now - t) / 60000));
    if (mins < 2) return 'Checked just now';
    if (mins < 60) return `Checked ${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `Checked ${hours} hour${hours === 1 ? '' : 's'} ago`;
    return `Checked ${new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

function offerCard(offer = {}, { now = Date.now() } = {}) {
    const href = typeof offer.url === 'string' && /^https?:\/\//i.test(offer.url) ? offer.url : '';
    const allIn = Number(offer.all_in ?? offer.price);
    const price = Number.isFinite(allIn) ? money(allIn, offer.currency) : '';
    const shipping = offer.shipping == null || offer.shipping === '' ? 'Shipping not stated'
        : Number(offer.shipping) === 0 ? 'Free shipping' : `+ ${money(Number(offer.shipping), offer.currency)} shipping`;
    const title = esc(offer.title || offer.store || 'Offer');
    const facts = [offer.store ? esc(offer.store) : 'Shop not known', offer.size ? `Size ${esc(offer.size)}` : '', offer.condition ? esc(offer.condition) : ''].filter(Boolean).join(' · ');
    return `<article class="ov-offer${offer.stale ? ' is-stale' : ''}" data-offer-card>`
        + `<div class="ov-offer-main"><h3 class="ov-offer-title">${href ? `<a href="${esc(href)}" rel="nofollow noopener">${title}</a>` : title}</h3><p class="ov-offer-facts">${facts}</p></div>`
        + `<div class="ov-offer-price">${price ? `<b>${esc(price)}</b>` : '<b class="is-unknown">Price not known yet</b>'}<small>${esc(shipping)}</small></div>`
        + `<p class="ov-offer-fresh">${esc(checkedText(offer.checked_at, now))}${offer.stale ? ' · <span class="ov-offer-stale">may have changed</span>' : ''}</p>`
        + '</article>';
}

module.exports = { offerCard };
