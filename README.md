# OpenVibe.Shared

> Versioned UI, chrome, SEO, legal and release-client packages every OpenVibe site renders.

**Status:** placeholder — planning only, no runnable code yet.  
**Plan:** OpenVibe End-to-End Realignment & Implementation Plan, revision 3 (20 Sep 2026), §3.3 and §16.6.  
**License:** AGPL-3.0 (same as every OpenVibe service).

## Purpose

The canonical home of what is today `OpenVibe.Network/packages/openvibe-shared` (navbar, footer, themes, icons, legal pages, SEO helpers, notifications UI, panels), published as immutable versioned artifacts with a CDN-compatible mirror instead of being vendored/rsynced from Network.

## Owns

- `@openvibe/tokens|ui|chrome|auth-ui|seo|legal|icons|release-client|web-runtime|server-web|testing-web`
- design tokens and theme rendering
- release manifest client (active-tab update coordinator)

## Does not own

- theme *authority* (OpenVibe.Network owns the theme API and preferences)
- identity

## Planned surfaces

- vanilla-JS-compatible build kept; no framework rewrite required
- pinned versions, selective entry points, content-addressed browser assets
- local/mirrored serving so a Network outage does not blank every page

## Data (authority tables / families)

- none (artifact repository)

## Capabilities and events

- package APIs only

Events: `release manifest notifications (client side)`

## Depends on

- OpenVibe.Contracts (release manifest contract)

## Acceptance (must be true before "done")

- Live, Community, Media, Tools and Sites consume pinned versions with no manual copies
- old `openvibe.network/shared/*` URLs keep serving version-pinned mirrors during migration

## Bootstrap / extraction source

Extract `packages/openvibe-shared` from OpenVibers/OpenVibe.Network; Network then consumes it like every other product.

## Launch rule

This repository does not make the product real, and the domain keeps its placeholder page on
[OpenVibers/OpenVibe.Sites](https://github.com/OpenVibers/OpenVibe.Sites) until all of the
following exist here (plan §12.12):

1. an owning runtime with health/readiness endpoints and observability;
2. canonical identity/auth integration (OpenVibe.Network subjects, scoped service principals);
3. server-rendered or static public routes that are useful without JavaScript;
4. real persistence and end-to-end workflows;
5. capability and event registration against `OpenVibe.Contracts`;
6. a migration/seed strategy, a security/threat review, and sitemap/robots/feed behaviour;
7. acceptance tests proving the advertised functionality.

The launch release removes the domain from `OpenVibe.Sites/sites.json`, switches routing and
registers maturity in the ecosystem registry atomically. A placeholder is never counted as an
implemented service.

---

Part of the [OpenVibe network](https://openvibe.network). Built in the open by [OpenVibers](https://github.com/OpenVibers).
