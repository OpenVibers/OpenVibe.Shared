# Shared agent layer

Mount at the application root before public HTML routes and the 404 handler:

```js
const agent = require('openvibe-shared/agent-layer');
const descriptor = require('./agent-descriptor');
agent.mount(app, { descriptor, render: renderPublicPage });
```

`renderPublicPage(path, { query })` returns (or resolves to) `{ html, title?, updated? }`,
or `null` for an unknown/non-public page. `query` is a URLSearchParams with `format` removed.
Use the **existing server renderer** (e.g. `shell.page` and Kit builders) for `html`.
The mount serves both HTML and Markdown from that same renderer. Extract existing route
rendering into this function; do not fetch your own HTTP server, duplicate page content, or
return authenticated/personalised pages. Unhandled HTML requests continue to existing routes;
unknown twins return 404. Render failures pass to Express's error handler. GET and HEAD only.
Paths ending in `.md` are reserved for twins. A trailing-slash page should accept its
slashless path too, since `/guide/` advertises `/guide.md`.

## Descriptor and manifest

`agentManifest(descriptor, overrides?)` returns a JSON-serialisable object. Missing optional
fields are omitted, without placeholders or validation failures. Relative endpoint URLs resolve
against `home`. Supply a valid absolute `home` when mounting rendered pages.

| Descriptor | Manifest / rule |
| --- | --- |
| `id`, `name`, `purpose` | Service id, display name, one-line purpose |
| `home` (or `canonical`) | Canonical service URL, emitted as `home` |
| `site` | Hostname; defaults to the hostname of `home` |
| `api`, `openapi`, `docs` | API base, actual OpenAPI document path, actual documentation URL; omit unavailable endpoints |
| `mcp` | `{ url, transport: 'streamable-http', auth }`; omit if unavailable |
| `llms`, `llmsFull`, `sitemap` | Defaults: `/llms.txt`, `/llms-full.txt`, `/sitemap.xml` |
| `policy.robots` | Defaults to `https://openvibe.network/bot.json` |
| `policy.auth` | Site-provided schemes: `['none']`, `['Network OIDC']`, `['bearer']`, or a combination |
| `policy.rateLimit` | Actual rate-limit note or `{ requestsPerMinute, burst }` |
| `policy.crawlDelayMs`, `stableIds`, `pagination`, `errors` | Optional verified policy details; no invented service guarantees |

`network` is `OpenVibe`. `/.well-known/agent.json` returns JSON with a one-hour public cache.
The shape follows §3 of the network SEO/agents proposal: `home`, `llms`, `llmsFull`,
`sitemap`, `openapi`, `mcp`, and nested `policy`; identity, purpose, API base and docs extend it.

In each service's robots.txt builder, append this **comment** (not a made-up robots directive):

```text
# Agent manifest: https://YOUR-HOST/.well-known/agent.json
```

Keep the site's existing crawler, disallow and sitemap directives.

## Markdown twins and discovery

`/` has `/index.md`; `/guide` has `/guide.md`. `?format=markdown` and an Accept preference
for `text/markdown` also return `text/markdown; charset=utf-8`. Query parameters survive in
canonical and twin links. Public HTML and Markdown receive a five-minute public cache,
a `Vary: Accept` header, and a Link header naming the Markdown alternate and llms.txt.
HTML receives both discovery `<link>` tags inside the Frame's head. The mount works with
existing Frame layouts; standalone `shell.page({ agentLayer: true, canonical, ... })` also
adds the tags (only enable where twins are mounted).

`markdownTwin({ html, title?, canonical, updated? })` uses the existing LinkeDOM parser,
now a runtime dependency. It reads `<main>` (or the body), ignores scripts, styles, templates,
navigation, footers and explicitly hidden elements, and requires no client JavaScript.
It emits YAML `title`, `canonical`, `updated`, a title heading, and an HTML backlink.
Unknown update times are `null`, never the request time. Real headings remain in order
(including a page's own h1), links and image alt text come from the rendered page, missing
alt remains empty, lists retain ordering/nesting, and tables use pipe rows. The first table
row is the Markdown header. CSS-generated content and arbitrary browser layout are outside
this server-rendered conversion's scope.

`linkHeaderTags(canonical, llms?)` returns `{ head, header }`; `twinUrl(url)` constructs
an alternate URL. `seo` also exports `agentManifest`, `markdownTwin`, `linkHeaderTags`.
For AGT-5 use `seo.llmsTxt({ ..., markdown: true, optional: [...] })` **after** mounting
all linked twins. `optional` renders `## Optional`. A link with `html: true` stays HTML
and is explicitly labelled `(HTML)`; use this for external or unsupported pages. Existing
callers remain unchanged until their service adopts twins.

## Per-service descriptor rollout

Every service below needs its own descriptor. **Each** must supply `id`, `name`, `purpose`,
`home`, `policy.auth`, and `policy.rateLimit`; supply `docs`, `api`, `openapi`, and `mcp`
only when those endpoints exist. Override discovery paths and other policy fields where
needed. The research inventory is a rollout list, not proof that an API/OpenAPI/MCP endpoint
exists: verify each in its service before advertising it. Bench's reported MCP endpoint is
`/mcp`; Tools and Services have reported OpenAPI documents whose actual paths must be used.

- OpenVibe.Network
- OpenVibe.Live
- OpenVibe.Video
- OpenVibe.Chat
- OpenVibe.Games
- OpenVibe.Tools
- OpenVibe.Services
- OpenVibe.Help
- OpenVibe.Deals
- OpenVibe.Host
- OpenVibe.Wiki
- OpenVibe.News
- OpenVibe.Blog
- OpenVibe.Media
- OpenVibe.Community
- OpenVibe.Reviews
- OpenVibe.Coupons
- OpenVibe.Trade
- OpenVibe.Tips
- OpenVibe.VIP
- OpenVibe.Space
- OpenVibe.Work
- OpenVibe.Quest
- OpenVibe.Rent
- OpenVibe.Food
- OpenVibe.Events
- OpenVibe.Actor
- OpenVibe.Bot
- OpenVibe.Codes
- OpenVibe.Run
- OpenVibe.Zone
- OpenVibe.Play
- OpenVibe.Search
- OpenVibe.Inventory
- OpenVibe.AI
- OpenVibe.Cam
- OpenVibe.Bench
- OpenVibe.Design
- OpenVibe.Today
- OpenVibe.Surf
- OpenVibe.Meme
- OpenVibe.Vision
- OpenVibe.Exchange
- OpenVibe.Fun
- OpenVibe.Domains
- OpenVibe.Pics
- OpenVibe.Download
- OpenVibe.Homes
- OpenVibe.Publishing
- OpenRestream

No browser files or browser allowlist entries are added. `npm run size` measures the
existing browser assets; this module and parser run only on the server.
