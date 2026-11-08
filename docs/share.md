# Sharing: one Share sheet on every site (`ov-share.js`, `ov-share.css`)

Plan track Q. In the owner's words (2026-11-06):
- share a thing with named accounts only, and give it away with the recipient's say-so;
- "for everything else too … a more universal system";
- "a unified share system … more platforms … easy copying of a link … the phone's own share thing … intuitive,
  user-friendly".

Press Share on any OpenVibe site and the same sheet opens. It is a sheet from the bottom on a phone and a dialog on a
computer. It has two parts and no tabs:

| Part | Who sees it | What is in it |
|---|---|---|
| **Send it** | everyone | the link and **Copy**; on a phone, **Send with your phone** (the phone's own share sheet: contacts, messages, every app); X, Bluesky, WhatsApp, Reddit, Discord, Telegram, Threads, Mastodon, Facebook, Email, Messages (phones), LinkedIn, Pinterest (with a picture), Tumblr, Hacker News, LINE; **QR code**; **Embed**; **Start at 1:23** for a video or a recording |
| **Who can open it** | the owner (and staff) of a thing with a share API | Everyone · Anyone with the link · Specific people · Only me; people by @name, each Can view or Can edit, with an end date; people who asked; **Transfer** |
| **Locked** | the owner of a locked item (one sealed with [Locker](locker.md)) | what the lock means in plain words; each person's eight-word fingerprint; add someone (their key wrapped on this device) or remove them (the content sealed again) |

The first eight places show at once, with the person's three most recent first. The rest are behind a counted fold
(**More (n)**), never hidden.

## On a page

```html
<!-- Send only: the page's address, or data-url -->
<button type="button" data-ov-share-sheet data-title="Building a robot that waves back"
        data-url="https://openvibe.video/v/abc123" data-time-from="#player"
        data-embed="https://openvibe.video/embed/abc123" data-image="https://openvibe.media/o/…">Share</button>

<!-- Also "Who can open it", for its owner: the service mounts openvibe-sdk/share's router -->
<button type="button" data-ov-share-sheet data-kind="paste" data-id="abc" data-title="LOOI bridge notes">Share</button>
```

The data attributes:
- **What to share.**
  - `data-url`: the link (else the page's address).
  - `data-title`: the title.
  - `data-text`: a line sent with it (email, the phone's sheet).
- **Extras.**
  - `data-image`: a picture (Pinterest).
  - `data-embed`: an embeddable player (the Embed tile).
  - `data-time-from`: a `<video>` or `<audio>` whose current time offers "Start at …". `data-time` gives a fixed
    time, and `data-time-param` names the parameter (default `t`).
- **Who can open it.**
  - `data-kind` and `data-id` add that part.
  - `data-base` and `data-path` say where the service's share API is, when it is not this page's
    `/api/v1/<kind>/<id>/share`.

**Loading.** The navbar loads `ov-share.js` and `ov-share.css` the first time someone presses a
`[data-ov-share-sheet]` button, so a site gets the sheet by putting the button on its page. Nothing loads before
that. The kit's `[data-ovk-share]` menu items open the same sheet.

## From a script

```js
OVShare.open({ url, title, text, image, embedUrl, time, kind, id, base, path, token, headers, onChange });
OVShare.offer(el, { kind, id, transfer_id, from, expires_at, keep_access, title, onDone });   // the recipient's banner
OVShare.gate(el, { kind, id, signedInAs, signInUrl, onDone });                                 // not on the list
OVShare.fromButton(button);                                                                    // a button's data-* as options
```

**Events on `document`:**
- `ov-share:sent` `{ target, url, kind, id }` when the link goes somewhere: copy, x, device, qr, embed and the rest.
  A site's analytics may count these.
- `ov-share:change` `{ kind, id, state }` after a save, a transfer or an answer.

## Locked items (Locker)

A locked item carries the lock's kind in the share API's answer (`lock: people | password | link`) and the sheet draws a
**Locked** part between the two above. It opens on the first press, and only then does the sheet load `ov-locker.js`: a
page that never touches a locked item never loads the crypto.

- **For the people on the list** — the sheet shows each person's eight-word fingerprint (the one Network publishes with
  their keys). It warns when their key changed since the slot was made, with **Use their new key**; nothing is wrapped
  for a key the person has not seen.
  - Adding someone asks Network for their public key first. Their content key is wrapped for it on this device, and the
    member row and the slot are saved together. Someone without a locker cannot be added, and the sheet says so in
    words.
  - Removing someone seals the content again under a fresh key for those who stay, then uploads the new envelope. The
    sheet says: "They had the key before you removed them: they may still have a copy of what they already opened."
- **With a link** — the key is the part of the link after `#`. The page's address has it, so **Copy** and every place
  the sheet sends keep the whole link; the sheet never invents a key, and says plainly when the link in front of it is
  missing one.
- **A transfer** to a person wraps the content key for their key first, saves the envelope with their slot (so they can
  look before they accept) and sends the offer with it. Someone without a locker cannot be offered one.
- **With a password** — nothing is stored: the password opens the envelope on the reader's device. Lose it and nobody
  can open the item, including OpenVibe (the sheet says this at the moment it matters).
- The envelope's URL comes from the service's `describe(ref)` as `envelope_url`; the sheet fetches it, re-wraps or
  re-seals it with `OVLocker.rewrap()`, and sends the base64 in the save's `envelope` field. The content key and the
  plaintext never leave the browser.
- The service must register the lock when the item is made (`register(ref, { lock })`), report it in the GET, store a
  re-seal through `onReseal(ref, bytes, tx)`, and keep the item out of public lists: a locked item can never be public.

## What it promises

- **The service decides.** The sheet only asks. Who may open a thing is enforced by the service that holds it
  (`openvibe-sdk/share`, `canView`).
  - A 401, 403 or 404 from the share API means "not the owner": the sheet shows only **Send it**, and says nothing
    failed.
  - Saves send `If-Match`. A change made meanwhile is shown, never overwritten.
- **Text, never markup.** Every name and title is set as text. Embed code escapes every attribute it writes.
- **No tracking.** Nothing is added to a shared link. "Start at" adds only the time.
- **The QR code is made on the device** (`ov-qr.js`). A link is never sent anywhere to draw it, and a Locker link's
  key, after `#`, stays on the device.
- **Phones.**
  - Targets are at least 44 px. The name field is 16 px, so iOS does not zoom.
  - The sheet clears the home bar (`env(safe-area-inset-bottom)`).
  - Messages is offered on touch devices only.
- **Motion.** The tiles come in with a short stagger, Copy turns into a tick with a ring, and a toast says what
  happened. Nothing spins. Under `prefers-reduced-motion` all of it is still.

## Native apps (Android, iOS)

The sheet is a component of OpenVibe Design. Its parts and words are platform-neutral, so native apps follow the same
design rather than a web view of it:

| | Web | Android | iOS |
|---|---|---|---|
| **Send with your phone** | `navigator.share()` (which opens the platform's own sheet on Android and iOS browsers) | `Intent.ACTION_SEND` through `Intent.createChooser`, with sharing shortcuts for Direct Share | `UIActivityViewController` (`ShareLink` in SwiftUI) |
| **Copy** | Clipboard API | `ClipboardManager`, with the system's own copy confirmation on Android 13+ | `UIPasteboard` |
| **The places** | intent URLs (X, Bluesky …) | the same intent URLs, or the app's package when installed | the same URLs (universal links open the app) |
| **QR code** | `ov-qr.js` | the same matrix, drawn natively | the same matrix, drawn natively |
| **Who can open it** | this sheet | a bottom sheet with the same sections and words | a sheet (`.presentationDetents`) with the same sections and words |

The calls the sheet makes are the same uniform API for every client: `openvibe-sdk/share`'s router,
`GET`/`PUT /api/v1/<kind>/<id>/share` and the rest. An agent uses `sdk.share({ base, token }).for(kind, id)`.

For large encrypted files, pass `prepareEnvelope({ keys, remove, add })` to `OVShare.open`. The callback receives
public recipient keys including the owner, streams a fresh envelope with the existing Locker SDK, and uploads it
to the service's authenticated staging endpoint. Return `{ envelope_ref, header }`; the sheet derives each
member's key slot from that header and submits the opaque receipt alongside the complete member list. The
service must implement the SDK's staged-reseal hooks and bind the receipt to the owner, item, current revision
and expiry, atomically replacing ciphertext and access. The callback never sends private keys or plaintext.
Without this option the existing inline `OVLocker.rewrap` path is unchanged.
