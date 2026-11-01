'use strict';
// theme-loader.js maps the status names some sites use (--error, --error-text, --ok, --warn) onto the theme's own
// readable status colours, at zero specificity so a site's own value still wins (4.86.0). Before, no theme set them
// and each site's fallback literal (#ef4444, #34d399, #fbbf24) showed, pale on light themes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'theme-loader.js'), 'utf8');
const alias = (SRC.match(/const ALIAS_CSS = '([^']*)';/) || [])[1] || '';
assert.ok(alias.startsWith(':where(html){'), 'zero specificity: a site that defines --error keeps its own');
const pairs = [['--error', '--danger'], ['--error-text', '--danger-text'], ['--ok', '--success-text'], ['--warn', '--warning-text']];
pairs.forEach(([name, token]) => {
    assert.ok(alias.includes(`${name}:var(${token})`), `${name} is the theme's ${token}`);
    assert.ok(SRC.includes(`'${token}'`), `${token} is one of the theme keys every theme sets`);
});
assert.match(SRC, /\+ ALIAS_CSS \+ COMFORT_CSS;/, 'injected with the display stylesheet, on every page');
console.log('status aliases: all checks passed');
