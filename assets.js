'use strict';
/**
 * openvibe-shared/assets — content-addressed image/asset URLs and responsive <picture> markup, so a
 * page that shows an image gets an immutable URL, a srcset, the right format order and a fallback
 * without hand-writing any of it. The estate's convention is `?v=<first 12 hex of sha256(file)>`
 * (serve.js, and the product asset helpers); this module speaks the same URL shape, so
 * cache-policy.assetHeaders and every CDN already treat the result as immutable.
 *
 *   const assets = require('openvibe-shared/assets');
 *   const hash = assets.hash(fs.readFileSync('public/img/hero.png'));   // 12 hex
 *   assets.url('/img/hero.png', hash);                                  // /img/hero.png?v=<hash>
 *   assets.picture({
 *       src: '/img/hero.png', hash,
 *       alt: 'The dashboard', width: 1600, height: 900,
 *       sizes: '(max-width: 800px) 100vw, 800px',
 *       sources: [
 *           { type: 'image/webp', entries: [{ src: '/img/hero-800.webp', hash: h8, w: 800 }, { src: '/img/hero-1600.webp', hash: h16, w: 1600 }] },
 *           { type: 'image/avif', entries: [{ src: '/img/hero-800.avif', hash: a8, w: 800 }, { src: '/img/hero-1600.avif', hash: a16, w: 1600 }] },
 *       ],
 *   });
 *
 * Rules it keeps for the page:
 *   - No hash → the path is returned exactly as given, so a site that has no build step keeps its
 *     existing URLs; no `?v=` is invented.
 *   - <source> order is AVIF, then WebP, then anything else (first match wins in a browser), and the
 *     <img> is always last. The caller's order inside a format is kept.
 *   - No usable source → a plain <img>, never an empty <picture>.
 *   - Every value is escaped; attribute order is fixed, so the same input renders the same bytes.
 *
 * Formats are the caller's: this package does not transcode images. Pass the AVIF/WebP variants your
 * own build produced; when only the original exists, `sources` is left empty and you get the <img>.
 */

const crypto = require('crypto');

const HASH_LEN = 12;                 // ?v= length across the estate (serve.js, product asset helpers)
const FORMAT_RANK = { 'image/avif': 0, 'image/webp': 1 };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The content hash of bytes (Buffer|string|Uint8Array): sha256, first `HASH_LEN` hex. */
function hash(data) {
    if (data == null) return '';
    const buf = Buffer.isBuffer(data) || data instanceof Uint8Array ? data : Buffer.from(String(data));
    return crypto.createHash('sha256').update(buf).digest('hex').slice(0, HASH_LEN);
}

/** Drop an existing `?v=` (and a dangling `?`/`&`) from the path part, keeping its query and fragment. */
function versionless(src) {
    const at = src.indexOf('#');
    const head = at < 0 ? src : src.slice(0, at);
    const frag = at < 0 ? '' : src.slice(at);
    const clean = head.replace(/([?&])v=[^&#]*/g, '$1')
        .replace(/\?&/g, '?').replace(/&&+/g, '&').replace(/[?&]+$/, '');
    return clean + frag;
}

/**
 * The content-addressed URL of an asset. `hash` comes from assets.hash (or a build manifest). With no
 * hash the path is returned unchanged; a replaced `?v=` never stacks.
 */
function url(src, hashValue) {
    const s = String(src == null ? '' : src);
    if (!s) return '';
    const clean = versionless(s);
    const h = hashValue == null ? '' : String(hashValue).trim();
    if (!h) return clean;
    const at = clean.indexOf('#');
    const head = at < 0 ? clean : clean.slice(0, at);
    const frag = at < 0 ? '' : clean.slice(at);
    return `${head}${head.includes('?') ? '&' : '?'}v=${encodeURIComponent(h)}${frag}`;
}

/** ` 800w` for a width, ` 2x` for a density, nothing when neither is a finite number. */
function descriptor(e) {
    const w = e.w != null ? e.w : e.width;
    if (Number.isFinite(Number(w))) return ` ${Number(w)}w`;
    const x = e.x != null ? e.x : (e.d != null ? e.d : e.density);
    if (Number.isFinite(Number(x))) return ` ${Number(x)}x`;
    return '';
}

/** A srcset attribute value from [{ src, hash?, w? | x? }] (a bare string works too). '' when empty. */
function srcset(entries) {
    if (!Array.isArray(entries)) return '';
    return entries
        .map((e) => (typeof e === 'string' ? { src: e } : (e || {})))
        .filter((e) => e.src)
        .map((e) => `${url(e.src, e.hash)}${descriptor(e)}`)
        .join(', ');
}

const formatRank = (type) => (FORMAT_RANK[String(type).toLowerCase()] != null ? FORMAT_RANK[String(type).toLowerCase()] : 2);

/**
 * Responsive <picture> HTML (or a plain <img> when there is nothing to choose between).
 *
 * @param {object} o
 *   src, hash          the fallback image (?v= added when hash is given)
 *   alt                alt text (escaped; pass '' only for decorative images)
 *   width, height      intrinsic pixels, so the box is reserved before the image loads
 *   sizes              sizes attribute (given to the <img> only when it also has a srcset)
 *   srcset             fallback entries for the <img>: [{ src, hash?, w? | x? }]
 *   sources            [{ type, src? , hash?, entries? | srcset?, media?, sizes? }] — a source with
 *                      no srcset is dropped; AVIF sorts before WebP before the rest
 *   className, id, loading, decoding, fetchpriority   pass-through attributes
 * @returns {string} escaped HTML; '' when there is no src
 */
function picture(o = {}) {
    const { src, alt = '', width, height, sizes, className, id, loading = 'lazy', decoding = 'async', fetchpriority, srcset: fallbackEntries } = o;
    if (!src) return '';
    const built = (Array.isArray(o.sources) ? o.sources : [])
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s && s.type && (s.src || s.srcset || s.entries))
        .map(({ s, i }) => {
            const set = s.srcset != null ? (typeof s.srcset === 'string' ? s.srcset : srcset(s.srcset))
                : s.src ? url(s.src, s.hash) : srcset(s.entries);
            return { s, i, set };
        })
        .filter(({ set }) => set)
        .sort((a, b) => formatRank(a.s.type) - formatRank(b.s.type) || a.i - b.i)
        .map(({ s, set }) => `<source type="${esc(s.type)}"${s.media ? ` media="${esc(s.media)}"` : ''} srcset="${esc(set)}"${s.sizes || sizes ? ` sizes="${esc(s.sizes || sizes)}"` : ''}>`);
    const fallback = fallbackEntries ? srcset(fallbackEntries) : '';
    const attrs = [
        `src="${esc(url(src, o.hash))}"`,
        fallback ? `srcset="${esc(fallback)}"` : '',
        `alt="${esc(alt)}"`,
        width != null ? `width="${esc(width)}"` : '',
        height != null ? `height="${esc(height)}"` : '',
        id ? `id="${esc(id)}"` : '',
        className ? `class="${esc(className)}"` : '',
        sizes && fallback ? `sizes="${esc(sizes)}"` : '',
        loading ? `loading="${esc(loading)}"` : '',
        decoding ? `decoding="${esc(decoding)}"` : '',
        fetchpriority ? `fetchpriority="${esc(fetchpriority)}"` : '',
    ].filter(Boolean).join(' ');
    const img = `<img ${attrs}>`;
    return built.length ? `<picture>${built.join('')}${img}</picture>` : img;
}

module.exports = { hash, url, srcset, picture };
