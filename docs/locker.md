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
window.OpenVibeLockerConfig = { network: 'https://openvibe.network' };
```

Events on `document`: `ov-locker:change` (`state()`), and `ov-locker:opened` (`{ lock }`).

The key directory it talks to is Network's:
- `PUT /api/v1/me/keys`
- `GET /api/v1/me/keys/backup`
- `GET /api/v1/people/:subject/keys`
