'use strict';
/**
 * openvibe-shared/minify — serve-time minification of the shared browser JS/CSS, cached by content
 * hash. Sites have no build step by choice (plain files, content-hashed at serve time), so
 * "minified" comes from the serve path (serve.js), not a bundler per site.
 *
 *   const { minifyJs, minifyCss } = require('openvibe-shared/minify');
 *   const js = await minifyJs(src);   // terser, names mangled, comments dropped
 *   const css = minifyCss(src);        // clean-css (sync)
 *
 * Both fail open: a file the minifier cannot handle is returned unchanged, and serve.js falls back
 * to the raw file on any error, so a minifier surprise can never 500 a page.
 */
const { minify: terserMinify } = require('terser');
const CleanCSS = require('clean-css');

// Level 1 only: it removes what is not needed inside each rule and never moves or merges rules, so the cascade's order
// (and a later rule winning) cannot change (the orchestrator's review, 2026-11-10: level 2 restructures).
const cleanCss = new CleanCSS({ level: { 1: { specialComments: 0 } } });

/** Minify browser JS (terser, async). Input/output are strings. Throws on a parse error. */
async function minifyJs(src) {
    const out = await terserMinify(String(src), { compress: true, mangle: true, format: { comments: false } });
    return out.code;
}

/** Minify browser CSS (clean-css, sync). Input/output are strings. */
function minifyCss(src) {
    return cleanCss.minify(String(src)).styles;
}

/** Minify by filename extension; anything else is returned unchanged. */
async function minifyFile(name, data) {
    const s = data.toString('utf8');
    if (name.endsWith('.js')) return Buffer.from(await minifyJs(s));
    if (name.endsWith('.css')) return Buffer.from(minifyCss(s));
    return data;
}

module.exports = { minifyJs, minifyCss, minifyFile };
