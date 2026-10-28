# Home pages on the OpenVibe network

Every OpenVibe product builds its home page from the same sections, `openvibe-shared/showcase`. So do sites that
other people build on the network. The sections are rendered on the server as plain HTML: complete without
JavaScript, readable by search engines and AI crawlers, and styled from the network's theme tokens, so a page follows
the visitor's theme and light or dark mode.

```js
const sc = require('openvibe-shared/showcase');
const serve = require('openvibe-shared/serve');

const page = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My product: what it does</title>
<link rel="stylesheet" href="${serve.url('showcase.css')}">
<script src="${serve.url('theme-loader.js')}" defer></script>
${sc.faqJsonLd(FAQ)}
</head><body>
<div id="navbar-mount"></div>
<main>
${sc.hero({ eyebrow: 'My product', title: 'Do the thing.', accent: 'In seconds.', lede: 'One sentence a person understands.', actions: [{ label: 'Start', href: '/start', primary: true }] })}
${sc.stats({ items: [{ value: '1,284', label: 'things made this week' }] })}
${sc.cards({ title: 'New today', layout: 'rail', more: { label: 'See all', href: '/all' }, items })}
${sc.spotlight({ title: 'How it works', items: [{ title: 'Step one', text: '…', image: '/shot.png' }] })}
${sc.faq({ items: FAQ })}
${sc.network({ service: 'my-product' })}
${sc.cta({ title: 'Ready?', actions: [{ label: 'Start', href: '/start', primary: true }] })}
</main>
<script src="${serve.url('navbar.js')}"></script>
</body></html>`;
```

## Sections

| Section | What it shows | Notes |
| --- | --- | --- |
| `hero` | What the product is, in one line, and where to start | Has a soft glow from the theme's accent |
| `stats` | A strip of real numbers | Only values the page measured; a link per number is optional |
| `cards` | Rich content: streams, videos, posts, products, listings | `layout: 'rail'` is one swipeable row. Images are lazy and hold their space (`ratio`). `live: true` shows the LIVE badge |
| `spotlight` | Features shown with a picture or a short muted loop, alternating sides | Stacks on phones |
| `features`, `steps` | A grid of what it does; a numbered path to done | |
| `code`, `demo` | Copyable samples; the product in a frame | |
| `compare`, `pricing`, `limits` | Feature tables and plans | `limits` names the URL its numbers come from |
| `stories` | Real uses, in people's words | Never invented |
| `faq` | An accordion that works without JavaScript | Put `faqJsonLd(items)` in the head for FAQPage data |
| `network` | "Part of OpenVibe": up to four related products | Curated per product in `RELATED`. Links carry `ov_from=<service>` |
| `nextSteps` | What to do next on other products after finishing something | |
| `cta` | The closing call to action | |

## A room's front door: `sc.room()` (4.28.0)

```js
sc.room({ room: 'surf',
  hero: { title, lede, search: { action, name, placeholder, hints }, start: { href, label }, chips, motif },
  proof: [{ value, label, live: true } | { value, label, asOf }],
  rails: [{ id, title, more, items: [kit.card(…)], size }],
  scenes: [{ title, text, html, action }],
  explore, dev: { title, lede, samples, links }, faq, network, html })
```

It renders the parts in the order every room shares (plan 2026-10-28 §3.3), wrapped in the room's accent:

| # | Part | What it holds |
| --- | --- | --- |
| 1 | Hero | Eight words at most; one box (typed hints) or one Start; five chips at most; the motif beside it (faint in the corner on phones) |
| 2 | Live proof | Real numbers, each live or dated; a 0 is left out |
| 3 | Rails | Right now, For you |
| 4 | Feature scenes | The room's own components in a demo state, alternating sides, revealed as they scroll in |
| 5 | Explore | Where to go in the room |
| 6 | For developers | A snippet, with OpenAPI and MCP links |
| 7 | Questions, the rest of OpenVibe | |

The page loads:
- `kit.css`, `room.css` (cards, rails, the room's accent) and `showcase.css`;
- `kit-web.js` for rails, menus and share;
- `motion.js` for the ticker, the typed hints and the reveal.

The server always writes the finished state, so the page is whole without scripts.

## Rules the kit enforces

- **Escaping:** every string is escaped. Only a field named `html` passes markup through, and it must be the caller's own.
- **Safe links:** links must be `https://` or a path on the same site. `javascript:`, protocol-relative and
  backslash tricks are left out, and so are `http://` images.
- **No placeholders:** a section with nothing to show renders nothing, never an empty shell or "coming soon".
- **Motion:** the scroll reveal uses CSS scroll-driven animations and runs only for people who have not asked for
  reduced motion. Browsers without the feature show everything at once.

## Linking the network together

`network({ service })` gives each product a short, relevant set of neighbours (Live leads to OpenRestream, Video,
Chat and Tips; Tools to Codes, Services, Actor and Space). That way readers and search engines see how the sites fit
together, rather than every page linking every domain. Pass `items` to choose your own: `[[to, what, href]]`, where
`to` is a service id that picks the ring icon and the "OpenVibe.X" name.
