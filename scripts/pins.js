'use strict';
/**
 * openvibe-shared/pins (4.287.0): the one reader of an OpenVibe library pin. A pin is a dependency on a released
 * library tarball, in either of its two forms:
 *
 *   https://codeload.github.com/OpenVibers/OpenVibe.SDK/tar.gz/refs/tags/v0.175.0                (GitHub)
 *   https://git.openvibe.codes/api/v1/repos/openvibers/openvibe.sdk/archive/v0.175.0.tar.gz      (our forge, 4.284.0 on)
 *
 * Every repository read pins with a regex of its own (Shared's scripts, Live's and Media's pin tests, Services' docs,
 * Design's pinOf, Wiki's status test …). When the pin bot moved to the forge on 11-16 they broke one by one, each on
 * its own detail: the archive path, the lower-case spelling, the .tar.gz. Read pins here instead:
 *
 *   const pins = require('openvibe-shared/pins');
 *   pins.parsePin(spec)          → { library: 'openvibe-sdk', repo: 'OpenVibe.SDK', version: '0.175.0', form: 'forge' } | null
 *   pins.pinsOf(pkg)             → { 'openvibe-sdk': '0.175.0', … }   every library pinned in a parsed package.json
 *   pins.pinOf(pkg, 'openvibe-sdk') → '0.175.0' | null
 *   pins.pinUrl('openvibe-sdk', '0.175.0', { form })   the pin, written the way the pin bot writes it (forge by default)
 *   pins.PIN                     a RegExp matching any pin, for a test that must say "this is a pin"
 */

/** The libraries that are pinned, by package name, with their repository's own spelling. */
const LIBRARIES = Object.freeze({
    'openvibe-contracts': 'OpenVibe.Contracts',
    'openvibe-shared': 'OpenVibe.Shared',
    'openvibe-sdk': 'OpenVibe.SDK',
    'openvibe-publishing': 'OpenVibe.Publishing',
});
const BY_REPO = new Map(Object.entries(LIBRARIES).map(([lib, repo]) => [repo.toLowerCase(), lib]));
const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

const PIN = /^https:\/\/(?:codeload\.github\.com\/OpenVibers\/(OpenVibe\.[A-Za-z]+)\/tar\.gz\/refs\/tags\/v(\d+\.\d+\.\d+)|git\.openvibe\.codes\/api\/v1\/repos\/openvibers\/(openvibe\.[A-Za-z]+)\/archive\/v(\d+\.\d+\.\d+)\.tar\.gz)$/i;

/** A pin's library, repository, version and form, or null when the spec is not a release pin. */
function parsePin(spec) {
    const m = PIN.exec(String(spec == null ? '' : spec).trim());
    if (!m) return null;
    const repoSeen = m[1] || m[3];
    const library = BY_REPO.get(repoSeen.toLowerCase());
    if (!library) return null;
    return { library, repo: LIBRARIES[library], version: m[2] || m[4], form: m[1] ? 'codeload' : 'forge' };
}

/** Every library pinned in a parsed package.json: { 'openvibe-sdk': '0.175.0', … }. A name that does not match its pin is not a pin. */
function pinsOf(pkg) {
    const out = {};
    for (const field of FIELDS) {
        for (const [name, spec] of Object.entries((pkg && pkg[field]) || {})) {
            const p = parsePin(spec);
            if (p && p.library === name) out[name] = p.version;
        }
    }
    return out;
}

const pinOf = (pkg, library) => pinsOf(pkg)[library] || null;

/** The pin for a library at a version, as the pin bot writes it: our forge (default), or GitHub's codeload. */
function pinUrl(library, version, { form = 'forge' } = {}) {
    const repo = LIBRARIES[library];
    if (!repo) throw new TypeError(`pinUrl: not a pinned library: ${library}`);
    const v = String(version).replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+$/.test(v)) throw new TypeError(`pinUrl: not a version: ${version}`);
    return form === 'codeload'
        ? `https://codeload.github.com/OpenVibers/${repo}/tar.gz/refs/tags/v${v}`
        : `https://git.openvibe.codes/api/v1/repos/openvibers/${repo.toLowerCase()}/archive/v${v}.tar.gz`;
}

module.exports = { LIBRARIES, FIELDS, PIN, parsePin, pinsOf, pinOf, pinUrl };
