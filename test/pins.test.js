'use strict';
// openvibe-shared/pins (4.287.0): one reader of a library pin, in GitHub's form and our forge's, whatever its case
// (the pin bot moved to the forge on 11-16 and the hand-written readers broke one by one: the archive path, the lower
// case, the .tar.gz).
const assert = require('assert');
const pins = require('openvibe-shared/pins');

assert.deepStrictEqual(pins.parsePin('https://git.openvibe.codes/api/v1/repos/openvibers/openvibe.sdk/archive/v0.175.0.tar.gz'),
    { library: 'openvibe-sdk', repo: 'OpenVibe.SDK', version: '0.175.0', form: 'forge' });
assert.deepStrictEqual(pins.parsePin('https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v4.286.0'),
    { library: 'openvibe-shared', repo: 'OpenVibe.Shared', version: '4.286.0', form: 'codeload' });
assert.strictEqual(pins.parsePin('https://git.openvibe.codes/api/v1/repos/OpenVibers/OpenVibe.Contracts/archive/v0.443.0.tar.gz').repo, 'OpenVibe.Contracts', 'any case');
const notPins = ['^1.2.3', 'https://codeload.github.com/OpenVibers/OpenVibe.SDK/tar.gz/main',
    'https://codeload.github.com/OpenVibers/OpenVibe.SDK/tar.gz/0123456789abcdef0123456789abcdef01234567',
    'https://git.openvibe.codes/api/v1/repos/openvibers/openvibe.nope/archive/v1.0.0.tar.gz',
    'https://evil.test/OpenVibers/OpenVibe.SDK/tar.gz/refs/tags/v1.0.0', null];
notPins.forEach((spec) => assert.strictEqual(pins.parsePin(spec), null, `not a release pin: ${spec}`));

const pkg = {
    dependencies: { 'openvibe-sdk': pins.pinUrl('openvibe-sdk', '0.175.0'), express: '^4' },
    devDependencies: { 'openvibe-contracts': pins.pinUrl('openvibe-contracts', 'v0.443.0', { form: 'codeload' }), 'openvibe-shared': pins.pinUrl('openvibe-sdk', '0.1.0') },
};
assert.deepStrictEqual(pins.pinsOf(pkg), { 'openvibe-sdk': '0.175.0', 'openvibe-contracts': '0.443.0' }, 'a name that does not match its pin is not a pin');
assert.strictEqual(pins.pinOf(pkg, 'openvibe-sdk'), '0.175.0');
assert.strictEqual(pins.pinOf(pkg, 'openvibe-publishing'), null);
assert.ok(pins.PIN.test(pins.pinUrl('openvibe-publishing', '1.2.3')) && pins.PIN.test(pins.pinUrl('openvibe-publishing', '1.2.3', { form: 'codeload' })));
assert.throws(() => pins.pinUrl('left-pad', '1.0.0'), TypeError);
assert.throws(() => pins.pinUrl('openvibe-sdk', 'latest'), TypeError);
console.log('pins: one reader for both pin forms');
