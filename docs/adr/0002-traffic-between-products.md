# Shared ADR 0002: traffic between products

**Status:** Proposed 2026-10-05 by the build plan (plan T11, decision D94), revisable by the owner. A
Shared-local decision: it fixes the shape of the presentation pieces Shared ships and the rules a
service follows when it links to another one. No contract changes; nothing here moves data between
services.

## Context

D94 asks the open sites to send people to each other on purpose: "next-step cards, shareable result
pages, embeds and badges, cross-product quests". Today each site's home ends where its own product
ends. A person who just finished something (cut a clip, converted a file, read a story) gets no
honest suggestion of the obvious next thing on another OpenVibe site, and nothing a person makes can
be shown elsewhere with proof that it is real.

Constraints from the rest of the network:

- **Every site works signed out.** A suggestion cannot depend on knowing who the person is.
- **No invented claims.** The showcase rule applies: a card names only what the target does today.
- **Privacy.** A link between sites must not carry a person's identity or activity (the
  analytics source of truth is each service's own events, ADR-021).
- **No build step, no shared runtime state.** Pieces are server-rendered strings, like the rest of
  `openvibe-shared/showcase`.

## Decision

### 1. Next-step cards

A next-step card is a server-rendered suggestion of one concrete thing to do on another product,
placed after a person finishes something (a result page, a finished upload, the end of a story) or
in a site's home. Shared ships the renderer, `showcase.nextSteps({ id, title, lede, items })`; each
site passes its own items and Shared holds no product data.

An item carries:

| field | required | meaning |
|---|---|---|
| `to` | yes | the target service id (`live`, `tools`, `media`, …): picks the ring icon and the "on OpenVibe.X" label |
| `what` | yes | the action, imperative, one line ("Clip the best minute") |
| `text` | no | one sentence on why it fits what the person just did |
| `href` | yes | an absolute `https://` URL on an OpenVibe zone, or a site-relative path for the same site |
| `from` | no | the service rendering the card; with `to` it forms the referral tag below |
| `embed` | no | the URL of an embeddable view of the target (section 3), shown as a secondary link |

Rules:

- **Real targets only.** `href` must open a page that exists and works signed out (sign-in may be
  asked for at the target, never before the click).
- **Referral without identity.** A card may append `ov_from=<from>` to `href` so the target counts
  arrivals by source. Nothing else rides in the URL: no user id, session, subject or result id the
  person did not choose to share.
- **At most four per placement.** A list of everything is not a next step.

### 2. Shareable result pages

A result page is shareable when a person explicitly shares it: the result gets a stable URL that
renders without the person's session (`/r/<id>` or the product's own path). Such a page:

- is created only by an explicit share action, never by producing the result;
- has an id that cannot be guessed from other ids (an opaque random or content-addressed id);
- states who shared it only if the person chose to show their name;
- carries its own Open Graph and canonical tags, and is `noindex` unless the owner publishes it;
- expires on the product's own retention, and says so on the page.

### 3. Embeds and badges

An **embed** is a framed, read-only view of a public thing on its own product (a robot's video and
readouts, a stream, a paste). Frame-ancestors lists are per product, as Bot's `BOT_EMBED_ORIGINS`
does; an embed never shows controls or anything the anonymous public could not see on the product
itself.

A **badge** is a small image that states one public fact ("live now", "member of <creator>'s plan",
"a robot on OpenVibe.Bot") and links to a page that proves it. Badges are issued and verified by the
service that owns the fact:

- **Image:** `GET https://<service>/badge/<kind>/<resource>.svg`, rendered from current state, cached
  briefly (`max-age` of a minute or less), never a static file that can go stale.
- **Proof:** the badge always links to `https://<service>/badge/<kind>/<resource>`, an HTML page that
  re-checks the fact at request time and shows what it found. A badge copied elsewhere is therefore
  only as good as its link: anyone can click through and see the truth.
- **No secrets, no personal data:** `<resource>` is a public handle or id the owner already shows
  publicly. A badge for a private fact is not issued.
- A signed form (an HMAC over service, kind, resource and issue time) is added only when a
  consumer needs to verify offline; until then the live proof page is the verification.

### 4. Cross-product quests

A quest is a short list of next steps across products with progress the person can see ("go live
once, clip a moment, share it"). Progress is computed by each owning service from its own events and
read by the quest page; Shared ships no quest state. Quests are out of scope for the first release of
the cards; when built they reuse the next-step item shape for each step.

## Consequences

- Shared gains `showcase.nextSteps` (presentation only) and this document; product data stays in
  each site.
- Sites adopt cards one placement at a time, starting where a result already exists (Tools results,
  finished Media clips, Live VODs).
- Badge and share endpoints are per service and follow sections 2 and 3 when each service builds
  them; nothing is centralised in Network.
- The referral tag gives each target a count of arrivals by source without any cross-site identity.
