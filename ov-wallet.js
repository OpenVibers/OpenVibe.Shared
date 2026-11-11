/* The universal Wallet. Loaded by the navbar on first tap; bearer requests never send cookies. */
(function (root) {
    'use strict';
    let active = null;
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    function amount(b) {
        const value = Number(b.amount) / Math.pow(10, b.scale || 0);
        return b.currency === 'USD' ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value) : value.toLocaleString();
    }
    function close() { if (active) active.close(); }
    /**
     * A hosted checkout is followed only to a host Billing names for the chosen provider (checkout.providers:
     * [{ name, hosts }]) or to Billing itself. Anything else — http, a URL with a username, a foreign host — is refused.
     */
    const maker = (issuer) => { const n = String(issuer || '').replace(/^(service|app):/, '').replace(/[-_]+/g, ' ').trim(); return n ? n.charAt(0).toUpperCase() + n.slice(1) : 'OpenVibe'; };
    function checkoutAllowed(value, providers) {
        let url;
        try { url = new URL(String(value)); } catch { return false; }
        if (url.protocol !== 'https:' || url.username || url.password) return false;
        const hosts = new Set(['billing.openvibe.network']);
        for (const provider of providers || []) for (const host of (provider && provider.hosts) || []) {
            if (typeof host === 'string' && host) hosts.add(host.toLowerCase());
        }
        return hosts.has(url.hostname.toLowerCase());
    }
    // What the sheet last showed in this tab (the wallet's own answer: the person's balances and recent lines, kept only
    // in their tab): the next opening starts from it,
    // so the cards are right from the first frame. Forgotten when the account changes.
    const KEEP = 'ov-wallet-last';
    const kept = () => { try { const j = JSON.parse(root.sessionStorage.getItem(KEEP) || 'null'); return j && j.balances && j.subject && j.subject.id ? j : null; } catch { return null; } };
    const keep = (d) => { try { root.sessionStorage.setItem(KEEP, JSON.stringify(d)); } catch { /* a closed store: it opens with placeholders */ } };
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('openvibe-auth-changed', () => { try { root.sessionStorage.removeItem(KEEP); } catch { /* */ } });

    // 4.202.0 (asks 304 and 318): the wallet sits in the one window (ov-window.js, loaded from beside this file): the
    // same motion, keys, phone sheet and window style as every other window; its own <dialog> where that is missing.
    const WALLET_REV = { 'ov-window.js': 'd3d8f9e3e6d2' };
    const selfSrc = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
    function needWindow() {
        return new Promise((ok) => {
            if (root.OVWindow) return ok(root.OVWindow);
            const m = /^(https?:\/\/[^?#]*\/)ov-wallet(?:\.[0-9a-f]{6,})?\.js(?:[?#]|$)/.exec(selfSrc);
            if (!m) return ok(null);
            const sc = document.createElement('script');
            sc.src = m[1] + 'ov-window.js' + (WALLET_REV['ov-window.js'] ? '?v=' + WALLET_REV['ov-window.js'] : '');
            sc.onload = () => ok(root.OVWindow || null); sc.onerror = () => ok(null);
            document.head.appendChild(sc);
        });
    }
    async function open(options) {
        close();
        const token = (options.getToken ? options.getToken() : options.token) || null;
        // cookieSession: no token for the page (httpOnlyAccess sites): ask with the person's Network cookie instead.
        const cookie = !token && options.cookieSession === true;
        if (!token && !cookie) throw new Error('Sign in to open your wallet');
        // Every site's connect-src allows openvibe.network and refuses billing./inventory.openvibe.network, so the
        // sheet asks Network's relays (/api/frame/wallet/…); Network forwards the bearer and never a cookie.
        const walletApi = `${(options.frameBase || 'https://openvibe.network/api/frame').replace(/\/+$/, '')}/wallet`;
        const controller = new AbortController();
        const W = await needWindow();
        let win = null;
        const dialog = W ? el('div', 'ov-wallet ov-wallet-in') : el('dialog', 'ov-wallet');
        dialog.setAttribute('aria-labelledby', 'ov-wallet-title');
        const header = el('header', 'ov-wallet-head'), heading = el('div');
        heading.append(el('h2', '', 'Wallet'));
        heading.lastChild.id = 'ov-wallet-title';
        const exit = el('button', 'ov-wallet-close', '×'); exit.type = 'button'; exit.setAttribute('aria-label', 'Close wallet');
        header.append(heading, exit);
        const body = el('div', 'ov-wallet-body is-first'), status = el('p', 'ov-wallet-status', '');
        status.setAttribute('role', 'status'); body.append(status); dialog.append(header, body); if (W) exit.remove();   // the window's own × closes it
        const previousFocus = document.activeElement, previousOverflow = document.documentElement.style.overflow;
        // A site's surfaces.js locks the page for any modal dialog and restores it on close; locking here as well would
        // make its saved state "hidden". Only a page without it needs the wallet's own lock.
        const ownLock = !!W || !root.OVSurfaces;   // in the window there is no <dialog> for surfaces.js to see
        let disposed = false, data = null, allItems = null, equipped = {}, kinds = [], storeItems = [];
        const here = { store: false, items: false };   // which parts have answered: until then a placeholder of their size stands in
        const wait = (n, cls) => { const w = el('div', 'ov-wallet-wait-set'); w.setAttribute('aria-hidden', 'true'); for (let i = 0; i < n; i += 1) w.append(el('div', `ov-wallet-wait ${cls || ''}`)); return w; };
        const shown = {};   // what each balance last showed, so a change counts from it
        const pending = new Map();
        const session = { close() {
            if (disposed) return; disposed = true; controller.abort();
            if (win) { const w = win; win = null; w.close(); } else if (dialog.close) dialog.close();
            dialog.remove();
            if (ownLock) document.documentElement.style.overflow = previousOverflow;
            document.removeEventListener('openvibe-auth-changed', session.close);
            if (active === session) active = null;
            if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        } };
        active = session;
        const identity = () => {
            if (disposed || (options.getToken && (options.getToken() || null) !== token)) { session.close(); throw new Error('Your account changed. Open Wallet again.'); }
        };
        async function request(path, method = 'GET', payload, publicRead = false) {
            identity();
            const r = await fetch(walletApi + path, { method, credentials: cookie && !publicRead ? 'include' : 'omit', signal: controller.signal,
                headers: { ...(publicRead || !token ? {} : { Authorization: `Bearer ${token}` }), ...(payload ? { 'Content-Type': 'application/json' } : {}) },
                ...(payload ? { body: JSON.stringify(payload) } : {}) });
            const value = await r.json(); identity();
            if (!r.ok) throw new Error(value.detail || 'This is temporarily unavailable. Please try again.');
            return value;
        }
        // What went wrong, in a person's words: a program's own error (a TypeError from a read that came back in another
        // shape, a failed fetch) is never shown as it is.
        function said(error) {
            if (error && error.name === 'TypeError' && /fetch|network|load/i.test(error.message || '')) return 'Your wallet could not be reached. Check your connection and try again.';
            if (!error || (error.name && error.name !== 'Error') || !error.message) return 'Part of your wallet could not be loaded. Close Wallet and open it again.';
            return error.message;
        }
        function message(error) { if (!disposed) { status.textContent = said(error); status.classList.add('is-error'); status.scrollIntoView({ block: 'nearest' }); } }
        function button(label, action, cls) {
            const b = el('button', cls || 'ov-wallet-button', label); b.type = 'button';
            b.addEventListener('click', async () => {
                if (b.disabled) return; b.disabled = true;
                try { identity(); await action(); } catch (e) { message(e); } finally { if (b.isConnected) b.disabled = false; }
            }); return b;
        }
        function section(title, description) {
            const s = el('section', 'ov-wallet-section'); s.append(el('h3', '', title));
            if (description) s.append(el('p', 'ov-wallet-muted', description)); body.append(s); return s;
        }
        function preview(art, name) {
            const p = el('div', 'ov-wallet-preview');
            if (art && /^med_[0-9A-HJKMNP-TV-Z]{26}$/.test(art.media_id || '')) {
                const img = el('img'); img.src = `https://openvibe.media/o/${art.media_id}`; img.alt = name; img.loading = 'lazy'; p.append(img);
            } else if (art && art.emoji) p.textContent = String(art.emoji).slice(0, 12);
            else { p.append(el('span', 'ov-wallet-sample', name)); if (art && /rainbow|neon|galaxy/.test(art.token || '')) p.classList.add('is-rainbow'); }
            return p;
        }
        async function refreshWallet() {
            data = await request('/api/v1/me/wallet');
            if (options.onWallet) options.onWallet(data);
        }
        async function refreshItems() {
            [allItems, equipped] = await Promise.all([
                request('/api/v1/me/items?limit=100'),
                request(`/api/v1/people/${encodeURIComponent(data.subject.id)}/equipped`, 'GET', null, true),
            ]);
        }
        function checkout(kind) {
            const old = body.querySelector('.ov-wallet-checkout'); if (old) old.remove();
            const form = el('form', 'ov-wallet-checkout');
            form.append(el('h3', '', kind === 'vibes' ? 'Buy Vibes' : 'Top up Balance'));
            const offers = data.checkout || {}, topup = offers.topup || {};
            // Billing names each provider and the hosts its hosted checkout may use; an older answer (plain names)
            // still lists the provider but allows no checkout host, so the sheet fails closed rather than guess.
            const providers = (offers.providers || []).map((p) => (typeof p === 'string' ? { name: p, hosts: [] } : p)).filter((p) => p && p.name);
            if (!providers.length || (kind === 'topup' && !topup.enabled)) {
                form.append(el('p', '', 'Checkout is not available right now. Please try again later.')); body.prepend(form); return;
            }
            const providerLabel = el('label', '', 'Pay with'), provider = el('select');
            for (const p of providers) { const option = el('option', '', p.name === 'stripe' ? 'Card' : p.name); option.value = p.name; provider.append(option); }
            providerLabel.append(provider);
            const amountLabel = el('label', '', kind === 'vibes' ? 'Vibes' : 'Amount to add');
            const input = el(kind === 'vibes' ? 'input' : 'select');
            if (kind === 'vibes') { input.type = 'number'; input.min = offers.vibes.minimum; input.max = offers.vibes.maximum; input.step = '1'; input.value = offers.vibes.minimum; input.required = true; }
            else for (const cents of topup.amounts_cents || []) { const opt = el('option', '', amount({ amount: cents, scale: 2, currency: 'USD' })); opt.value = cents; input.append(opt); }
            amountLabel.append(input);
            const cost = el('p', 'ov-wallet-muted');
            function quote() {
                const quantity = Number(input.value);
                const tier = kind === 'vibes' && [...offers.vibes.price_tiers].sort((a, b) => b.min - a.min).find((t) => quantity >= t.min);
                const cents = kind === 'vibes' ? (tier ? Math.round(quantity * tier.usd_per_bit * 100) : null) : quantity + Math.ceil(quantity * topup.fee_bps / 10000);
                cost.textContent = cents == null ? 'Choose a valid amount.' : `Total ${amount({ amount: cents, scale: 2, currency: 'USD' })}${kind === 'topup' && topup.fee_bps ? ' including the top-up fee' : ''}. Confirm the final total at checkout.`;
            }
            input.addEventListener('input', quote); quote();
            const submit = el('button', 'ov-wallet-button is-primary', 'Continue to checkout'); submit.type = 'submit';
            form.append(amountLabel, providerLabel, cost, submit, button('Cancel', () => form.remove(), 'ov-wallet-button'));
            let attempt = null;
            form.addEventListener('submit', async (event) => {
                event.preventDefault(); if (submit.disabled || !form.reportValidity()) return; submit.disabled = true;
                try {
                    if (!attempt) attempt = { idempotency_key: root.crypto.randomUUID(), provider: provider.value,
                        ...(kind === 'vibes' ? { vibes: Number(input.value) } : { amount_cents: Number(input.value) }) };
                    input.disabled = true; provider.disabled = true;
                    const result = await request(kind === 'vibes' ? '/api/v1/me/vibes/buy' : '/api/v1/me/wallet/topups', 'POST', attempt);
                    if (!checkoutAllowed(result.checkout_url, providers)) throw new Error('Checkout is unavailable.');
                    root.location.assign(result.checkout_url);
                } catch (e) { message(e); submit.disabled = false; }
            });
            body.prepend(form); form.scrollIntoView({ block: 'start' }); input.focus();
        }
        // Before anything is known (the first opening in a tab): three cards' worth of room, so nothing moves when they come.
        function hold() { body.replaceChildren(status, wait(3, 'is-card'), wait(2, 'is-row')); status.textContent = 'Opening your wallet…'; }
        function render() {
            body.replaceChildren(status); status.textContent = data.money_writes_frozen ? 'Purchases and top-ups are paused. Your balances and items are still here.' : '';
            status.classList.remove('is-error');
            const balances = el('div', 'ov-wallet-balances'); body.append(balances);
            for (const id of ['coins', 'vibes', 'balance']) {
                const b = data.balances[id], card = el('article', `ov-wallet-balance is-${id}`);
                const numeric = Number(b.amount) / Math.pow(10, b.scale || 0);
                const words = (n) => amount({ ...b, amount: String(Math.round(n * Math.pow(10, b.scale || 0))) });
                // The currency's own icon and colour (purse.js, the one the bar's pill has); the letter where that file is not on the page.
                const purse = root.OpenVibePurse || null;
                const symbol = el('span', 'ov-wallet-symbol', purse ? null : { coins: 'O', vibes: 'V', balance: '$' }[id]);
                if (purse) { symbol.innerHTML = purse.icon(id, 30); symbol.classList.add('is-drawn', 'ovp-play'); symbol.setAttribute('aria-hidden', 'true'); card.setAttribute('data-purse', id); }
                const title = el('div', 'ov-wallet-balance-title'); title.append(symbol, el('h3', '', b.label));
                const value = el('p', 'ov-wallet-value', amount(b));
                card.append(title, value, el('p', 'ov-wallet-purpose', b.purpose));
                if (id === 'coins') { const link = el('a', 'ov-wallet-button', b.action); link.href = 'https://openvibe.network/my#coins'; card.append(link); }
                else { const action = button(b.action, () => checkout(id === 'vibes' ? 'vibes' : 'topup')); action.disabled = data.money_writes_frozen; card.append(action); }
                balances.append(card);
                // The number counts in as the sheet opens; after a purchase it counts to the new amount and the currency's
                // pieces leave (or reach) its card. The full amount is what a screen reader hears, at once.
                if (purse && isFinite(numeric)) {
                    const was = shown[id]; shown[id] = numeric;
                    value.setAttribute('aria-label', amount(b));
                    if (was == null) purse.count(value, numeric * .82, numeric, words);
                    else if (was !== numeric) { purse.count(value, was, numeric, words); card.classList.add(numeric > was ? 'is-gain' : 'is-loss'); setTimeout(() => { if (card.isConnected) purse.burst(card, id, numeric - was); }, 60); }
                }
            }
            const store = section('Store', 'A little more you. Items travel with your OpenVibe account.');
            const grid = el('div', 'ov-wallet-grid'); store.append(grid);
            if (!here.store) grid.append(wait(2, 'is-tile'));
            else if (!storeItems.length) grid.append(el('p', 'ov-wallet-muted', 'New items will appear here after review.'));
            for (const item of storeItems) {
                const card = el('article', 'ov-wallet-item'); card.append(preview(item.preview, item.name), el('h4', '', item.name), el('p', 'ov-wallet-muted', `By ${maker(item.issuer)}`));
                const owned = item.owned || (allItems && allItems.instances.some((i) => i.definition_id === item.id && i.state === 'owned'));
                if (owned) card.append(el('span', 'ov-wallet-owned', '✓ Owned'));
                else for (const [currency, price] of Object.entries(item.prices)) {
                    const buy = button(`Buy · ${price.toLocaleString()} ${currency === 'vibes' ? 'Vibes' : 'OpenCoins'}`, async () => {
                        let attempt = pending.get(item.id);
                        if (!attempt) { attempt = { currency, idempotency_key: root.crypto.randomUUID() }; pending.set(item.id, attempt); }
                        if (attempt.currency !== currency) throw new Error('Retry this item in the currency you chose first.');
                        await request(`/api/v1/store/${encodeURIComponent(item.id)}/buy`, 'POST', attempt);
                        await Promise.all([refreshWallet(), refreshItems()]); render();
                    }); buy.disabled = data.money_writes_frozen || !item.available; card.append(buy);
                }
                grid.append(card);
            }
            const mine = section('Your items', 'Wear them wherever their kind is supported.');
            const owned = allItems ? allItems.instances.filter((i) => i.state === 'owned') : [];
            if (!here.items) mine.append(wait(2, 'is-row'));
            else if (!owned.length) mine.append(el('p', 'ov-wallet-muted', 'Your collection starts here.'));
            for (const item of owned) {
                const def = allItems.definitions[item.definition_id]; if (!def) continue;
                const kind = kinds.find((k) => k.id === def.kind), row = el('article', 'ov-wallet-owned-row'), copy = el('div');
                row.append(preview(def.art, def.name)); copy.append(el('h4', '', def.name));
                copy.append(el('p', 'ov-wallet-muted', `Across OpenVibe · ${(kind && kind.surfaces || []).map((s) => s.surface).join(', ') || 'supported sites'}`)); row.append(copy);
                for (const slot of kind && kind.slots || []) {
                    const worn = equipped.slots && equipped.slots[`${def.kind}:${slot}`];
                    const isWorn = worn && worn.instance_id === item.id;
                    row.append(button(isWorn ? 'Unequip' : 'Equip', async () => {
                        equipped = await request('/api/v1/me/equipped', 'PUT', { kind: def.kind, slot, instance_id: isWorn ? null : item.id });
                        document.dispatchEvent(new CustomEvent('openvibe-items-changed')); render();
                    }));
                }
                mine.append(row);
            }
            if (allItems && allItems.next_cursor) mine.append(button('More items', async () => {
                const page = await request('/api/v1/me/items?limit=100&cursor=' + encodeURIComponent(allItems.next_cursor));
                allItems = { ...page, instances: allItems.instances.concat(page.instances), definitions: { ...allItems.definitions, ...page.definitions } }; render();
            }));
            const recent = section('Recent activity', 'Your last five money events.');
            if (!data.recent_activity.length) recent.append(el('p', 'ov-wallet-muted', 'No activity yet.'));
            for (const event of data.recent_activity) {
                // The reason is a sentence made by billing.money-reason@1 (Billing or Network); when it names
                // something with a page, the sentence is the link to it. The raw ledger key is never drawn.
                const row = el('div', 'ov-wallet-event'), info = el('div');
                const url = event.subject && event.subject.url;
                if (url && /^https:\/\//.test(url)) {
                    const a = el('a', '', event.label);
                    a.href = url; a.target = '_blank'; a.rel = 'noopener';
                    info.append(a, el('small', '', `${event.site} · ${new Date(event.at).toLocaleDateString()}`));
                } else info.append(el('strong', '', event.label), el('small', '', `${event.site} · ${new Date(event.at).toLocaleDateString()}`));
                const units = event.kind === 'balance' ? { currency: 'USD', scale: 9 } : { currency: event.kind, scale: 0 };
                row.append(info, el('span', '', `${Number(event.amount) > 0 ? '+' : ''}${amount({ ...units, amount: event.amount })}${event.kind === 'balance' ? '' : event.kind === 'vibes' ? ' Vibes' : ' OpenCoins'}`)); recent.append(row);
            }
        }
        exit.addEventListener('click', session.close);
        if (!W) dialog.addEventListener('cancel', (e) => { e.preventDefault(); session.close(); });
        if (!W) dialog.addEventListener('click', (e) => { if (e.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) session.close(); });
        document.addEventListener('openvibe-auth-changed', session.close);
        if (W) win = W.open({ id: 'ov-wallet', title: 'Wallet', bare: true, body: dialog, kind: 'dialog', size: 'lg', width: 860, from: previousFocus, onClose: () => { win = null; session.close(); } });
        else { document.body.append(dialog); dialog.showModal(); exit.focus(); }
        if (ownLock) document.documentElement.style.overflow = 'hidden';
        // There at once: what this tab last showed, or room held for it. Then everything is asked side by side (the
        // store and the kinds need nothing; the items need to know whose they are, which a kept wallet already says).
        const seed = kept();
        if (seed) { data = seed; render(); } else hold();
        setTimeout(() => body.classList.remove('is-first'), 600);
        const settled = (pr) => pr.then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }));
        const storeAsked = settled(request('/api/v1/store')), kindsAsked = settled(request('/api/v1/kinds', 'GET', null, true));
        let itemsAsked = seed ? settled(refreshItems()) : null;
        try {
            await refreshWallet();
            identity(); keep(data); render();
            if (!itemsAsked || (seed && seed.subject.id !== data.subject.id)) itemsAsked = settled(refreshItems());
            const results = await Promise.all([storeAsked, itemsAsked, kindsAsked]);
            identity(); storeItems = results[0].status === 'fulfilled' ? results[0].value.items : [];
            kinds = results[2].status === 'fulfilled' ? results[2].value.kinds : [];
            here.store = here.items = true;
            render(); if (results.some((r) => r.status === 'rejected')) message(new Error('Your balances are ready. The store or your items could not load. Close and reopen Wallet to retry.'));
        } catch (error) { if (seed && !disposed) { here.store = here.items = true; } message(error); }
        return session;
    }
    const api = { open, close, amount, checkoutAllowed };
    root.OpenVibeWallet = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
