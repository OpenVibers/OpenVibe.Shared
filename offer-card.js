'use strict';

/** Render a network offer with its all-in amount and provenance. Unknown shipping stays unknown. */
function offerCard(offer = {}) {
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const href = typeof offer.url === 'string' && /^https?:\/\//i.test(offer.url) ? offer.url : '';
    const price = Number(offer.all_in ?? offer.price);
    const amount = Number.isFinite(price) ? `${esc(offer.currency || 'USD')} ${price.toFixed(2)}` : 'Price not known yet';
    const checked = offer.checked_at ? `Checked ${esc(offer.checked_at)}` : 'Check time not known yet';
    const shipping = offer.shipping == null ? 'Shipping not stated' : `Shipping ${esc(offer.currency || 'USD')} ${Number(offer.shipping).toFixed(2)}`;
    const title = esc(offer.title || offer.store || 'Offer');
    return `<article class="ov-offer-card" data-offer-card><h3>${href ? `<a href="${esc(href)}" rel="nofollow noopener">${title}</a>` : title}</h3><p class="ov-offer-card-price">${amount}</p><p>${esc(offer.store || 'Store not known')}${offer.size ? ` · size ${esc(offer.size)}` : ''}${offer.condition ? ` · ${esc(offer.condition)}` : ''}</p><p>${shipping} · ${checked}${offer.stale ? ' · stale' : ''}</p></article>`;
}

module.exports = { offerCard };
