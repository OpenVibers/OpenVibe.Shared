# One user card

Load `/shared/ov-user.js` with the site's existing kit stylesheet. Loading the script has no side effects. The owner must enable Network's `user_card_enabled` setting before sites opt in.

```js
const mounted = OVUser.card(document.getElementById('person'), { username: 'Example' });
await mounted.ready; // public summary, or null when unavailable
await mounted.refresh();
mounted.destroy();

// Opt-in delegation, including dynamically added mentions and avatars:
const unbind = OVUser.bind(document);
// unbind() removes these hooks and closes its card.
```

```html
<a href="https://openvibe.network/@Example">@Example</a>
<button type="button" data-ov-user="Example" aria-label="Open Example's user card"><img src="/picture.png" alt=""></button>
<a href="https://openvibe.network/@Example" data-ov-user="Example">Example</a>
```

The hook handles clicks, context menus and keyboard activation on marked elements (`data-ov-user`, or the existing `data-username`) and canonical `/@username` links on the current site, Network or Live. Use links/buttons for keyboard access; custom elements need `role="button"` and `tabindex="0"`. Modified clicks keep their native behavior. Links within the card keep navigating normally. Rebinding the same root replaces its old listeners. The default opening is a plain native dialog with Close/Escape and focus restoration; browsers without modal dialogs retain normal link navigation.

The main session can supply its own opening surface without changing the read:

```js
OVUser.bind(document, { onOpen({ username, trigger }) {
    // Open the designed surface, then mount OVUser.card(surfaceHost, { username }).
} });
```

`card` fetches only `GET https://openvibe.network/api/v1/people/:username/card`, without credentials or browser caching, with an eight-second deadline. Optional `networkUrl` and `fetchImpl` configure a deployment/test read. Network coalesces and caches the aggregate for 30 seconds while rechecking privacy on each call. The component adds no cache. Remount/refresh/destroy abort prior reads and ignore late results. Disabled/unavailable reads show a profile link; missing fields never become zero, offline, or placeholders. Text is text, links/pictures must be HTTPS, and only kit classes/plain markup are used.

The card shows the available name, handle, picture, live state, level, streak, badges count, followers, weekly sites and profile/channel links. Weekly sites are opt-in at Network. This hook does not automatically replace existing site menus or invoke relationship/moderation actions.

## Next for the design (For Fable)

Design the shared card surface and its placement, avatar/live treatment, hierarchy and responsive behavior; add the person's field-visibility controls and explicit weekly-sites opt-in. Adopt the hook in site mentions/avatars and compose site-specific actions using the existing menu registration API. This PR intentionally has no version bump or new CSS.
