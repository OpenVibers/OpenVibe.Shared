# Vibes Pay in the browser (`openvibe-shared/vibes-pay`)

The browser half of Vibes Pay (MONEY.md, D12). An app's server creates a charge with
`openvibe-sdk/vibes`; its page opens the pay sheet with this file.

```html
<script src="https://openvibe.network/shared/vibes-pay.js" defer></script>

<button data-ov-vibes-pay="https://openvibe.network/pay/vch_…">Pay with Vibes</button>
```

The button binds itself once: the Vibes green (`#4ade80`) with dark ink, the label "Pay with Vibes", a 44 px touch
target and a focus ring. It reads on light and dark themes and under every site theme's `data-theme`. While the sheet
is open the button is disabled; it is enabled again when the sheet resolves. `OpenVibe.vibes.bind(document)` binds
buttons added after load; a `MutationObserver` also catches them.

## The promise

```js
const result = await OpenVibe.vibes.pay(payUrl);
// { status: 'paid', charge_id: 'vch_…', pay_url: 'https://openvibe.network/pay/vch_…' }
```

`pay(payUrl)` opens `https://openvibe.network/pay/<id>`:

- **a computer:** a 520 × 720 popup named `ov-vibes-pay`;
- **a phone (max-width 640 px):** the full page in a new tab, so the shop stays behind it;
- **a blocked popup:** the page navigates to the sheet instead, and there is no promise result (the return page decides).

The sheet posts to its opener, and only from `https://openvibe.network`:

```js
{ type: 'ov-vibes-pay', status: 'paid', charge_id: 'vch_…' }
```

The origin is checked; a message of another type, another origin, or without a status is ignored. A popup the
person closes without paying resolves `{ status: 'closed' }`. Other statuses are the sheet's (`paid`, `cancelled`,
`refunded`, `expired`). The same result is dispatched on the document as the bubbling `ov-vibes-pay` event:

```js
document.addEventListener('ov-vibes-pay', (e) => {
    if (e.detail.status === 'paid') showThanks();
});
```

## Security

- A pay URL must be `https://openvibe.network/pay/…`; any other URL throws before a window opens.
- The app token stays on the server. The page only receives the charge's `pay_url` and id.
- Treat `postMessage` as a hint to refresh: the order is confirmed by the server, with the webhook's signature and
  `GET /api/v1/vibes/charges/:id`, never by the page alone.
- The sheet never shows a card form: the person pays Vibes they already bought.

## Styling

The button's CSS is injected once (`<style id="ov-vibes-pay-style">`). A page may override `.ov-vibes-pay`; keep the
44 px target and the contrast of the ink on the fill. The fill is fixed to the Vibes accent rather than a site's
`--accent`, because Vibes has one colour everywhere; the ink is dark, so it stays readable when a theme is light.

## Server side

Create the charge with `openvibe-sdk/vibes`; verify the webhook with the same client. The full flow, plain HTTP,
webhooks, sandbox, refunds and payouts are in openvibe.services `/docs/vibes`.

OpenVibe.Design's `/components` page is OpenVibe.Design's source, not this repository's; the button is described here
and in the README, and `openvibe-shared/components` remains the shared component contract for the kit.
