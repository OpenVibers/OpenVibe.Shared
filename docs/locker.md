# Locker in the browser (`ov-locker.js`, `ov-locker.css`)

Plan track Q2. The owner, 2026-11-06: "an encryption feature for everything … the person can encrypt it and set the
encryption password … completely encrypted on our end … decrypted on the client's end, so we don't have access to any
of the user data." The format and the cryptography are `openvibe-sdk/locker` (`locker.envelope.v1`).
`ov-locker-core.js` here is a generated copy of that module for the browser: WebCrypto only, with the same test
vectors.

## What a person sees

- **A locked item** shows a card instead of its content. The card fits the lock:
  - **With the link:** the key is after `#k=` in the link, and the item opens by itself. A link missing its key says
    so, and that OpenVibe never had the key.
  - **With a password:** the person types the password they were given, and the item opens on their device.
  - **For specific people:** "Unlock my locker", then it opens. A person who isn't on the list is told so.
- **Your locker** holds a person's own keys, made on their device the first time they need one:
  1. **A passphrase**: four or more words. A strength meter says how easy it is to guess.
  2. **A recovery kit**: 24 words, shown once. The person can copy them or save them as a file, then types two of
     them back so the kit was really kept.
  3. **Done**: the locker's fingerprint, eight words someone can compare with them in person.

  OpenVibe.Network keeps the public keys and two locked copies of the private keys: one opens with the passphrase,
  one with the recovery words. Nobody at OpenVibe can open either one or reset them.
- **Unlocking on a new device**: the passphrase, or "I forgot it: use my recovery kit".

## What it promises

- **Nothing readable leaves the device.**
  - Passwords, passphrases, recovery words, content keys and private keys stay in the tab's memory.
  - They are gone when the tab closes, or with `OVLocker.forget()`.
  - They are never in `localStorage`, a cookie or a request.
- **Text, never markup.** Every word is set as text.
- **Motion.** Nothing spins: a wait is words. Under `prefers-reduced-motion` nothing moves.
- **Phones.** A sheet from the bottom, 16 px fields, 44 px targets, and the recovery words in two columns.

## From a script

```js
OVLocker.open(el, { bytes | url, title, onOpen(bytes, info) });   // the card a locked item shows
OVLocker.setup({ onDone });                                       // make your locker
OVLocker.unlock({ onDone });                                      // unlock it on this device
OVLocker.state();          // { unlocked, fingerprint, subject }
OVLocker.forget();         // drop the unlocked keys
OVLocker.keyFromLink();    // the 32-byte key after #k=, or null
OVLocker.ensure();         // resolves once unlocked here, or opens the unlock sheet; rejects when declined
OVLocker.keys(subject|'@name');   // Network's public keys for one person, or null when they have no locker
OVLocker.publicKeys();     // my public keys (for a people lock that wraps for me too)
OVLocker.rewrap(bytes, { add, remove, keys });
                           // a people-locked envelope re-wrapped here: add [{ subject, publicKey }] wraps the
                           // content key for someone; remove [subject] seals the content under a fresh key for
                           // `keys` (the public keys of those who stay). → { bytes, header }
OVLocker.seal(content, { lock, keys, password });
                           // seal content here (a new locked item): the key is made and kept in this tab; a link
                           // lock comes back with linkKey, the 32 bytes that go in the link after #k=
OVLocker.inspect(bytes);   // the envelope's header, without a key
window.OpenVibeLockerConfig = { network: 'https://openvibe.network' };
```

Events on `document`: `ov-locker:change` (`state()`), and `ov-locker:opened` (`{ lock }`).

The key directory it talks to is Network's:
- `PUT /api/v1/me/keys`
- `GET /api/v1/me/keys/backup`
- `GET /api/v1/people/:subject/keys`

### Device passkeys and streaming (Locker v1)

Setup also offers a passkey on devices with WebAuthn PRF support. The PRF output is used only as the password to the
existing SDK password lock; cryptography stays in `ov-locker-core.js`. The credential ID and public PRF input are
stored on this origin under a subject-specific localStorage key. Neither the PRF output nor private keys are stored
there. This convenience unlock is specific to this device/origin; another device uses the recovery kit. If PRF is
unavailable, setup keeps the passphrase option enabled. The recovery kit can be saved or printed and is shown only
while it is being created. Keep it before leaving setup.

`OVLocker.openStream(readable, credentials?)` delegates to the SDK's streaming opener, using the unlocked person
keys for a people lock. Private keys remain in the Locker module. An explicit `{ key }` or `{ password }` opens a
link or password lock. The caller must consume the authenticated stream to completion before committing a saved
file; a cancelled prefix read is suitable only for a provisional, decrypted label.

Network's backup response is `{ subject, backups: { passphrase, recovery, passkey } }`. The browser accepts that
wrapper and the older unwrapped form. Configure `OpenVibeLockerConfig.subject` to scope the public passkey handle
to the signed-in person.

A service with an HTTP-only SSO session may set `network: ''` and proxy the three public-key / encrypted-backup
endpoints through its own authenticated backend. Set `reauthUrl` to its reauthentication entry point; this avoids
requiring third-party Network cookies and keeps access tokens out of JavaScript. No plaintext keys are proxied.
