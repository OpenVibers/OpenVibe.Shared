'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/release — GET /release.json for a web surface (ADR-016, contract
// registry.release-manifest@1). Open tabs poll it (release-watch.js) and learn when the page
// they run is older than what the server now serves.
//
//   const release = require('openvibe-shared/release').createRelease({ service: 'community' });
//   app.get('/release.json', release.handler);
//   html += release.metaTag();        // <meta name="ov-release" …> — the page's own release
//
// The release is the deployed commit (git in `root`, or RELEASE_COMMIT), read once at boot.
// MIN_CLIENT_RELEASE (env) set to the running release tells every older tab it must reload
// (as soon as that is safe); otherwise older tabs are only prompted, and reload on their own once
// the new release is older than the mixed-version window (24 h by default).
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const { execFileSync } = require('child_process');

const SHA_RE = /^[0-9a-f]{7,40}$/;

function git(root, args) {
    try { return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString().trim(); } catch { return ''; }
}

function pkgVersion(name, root) {
    try { return JSON.parse(fs.readFileSync(require.resolve(`${name}/package.json`, { paths: [root] }), 'utf8')).version || null; } catch { return null; }
}

function createRelease({
    service, root = process.cwd(), windowHours = 24,
    minClientRelease = process.env.MIN_CLIENT_RELEASE || null,
    packages = ['openvibe-shared', 'openvibe-sdk'],
    env = process.env, now = () => new Date(),
} = {}) {
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(String(service || ''))) throw new TypeError('createRelease: service id required');
    const fromEnv = String(env.RELEASE_COMMIT || '').toLowerCase();
    const sha = SHA_RE.test(fromEnv) ? fromEnv.slice(0, 12) : git(root, ['rev-parse', '--short=12', 'HEAD']);
    const release = SHA_RE.test(sha) ? sha : '0000000';
    const committed = env.RELEASE_AT || git(root, ['log', '-1', '--format=%cI']);
    const bootedAt = now();
    const releasedAt = Number.isNaN(Date.parse(committed)) ? bootedAt : new Date(committed);
    const versions = {};
    for (const p of packages) { const v = pkgVersion(p, root); if (v) versions[p] = v; }
    const manifest = Object.freeze({
        service,
        release,
        released_at: releasedAt.toISOString(),
        booted_at: bootedAt.toISOString(),
        contracts_version: pkgVersion('openvibe-contracts', root),
        packages: Object.freeze(versions),
        min_client_release: minClientRelease && SHA_RE.test(minClientRelease) ? minClientRelease : null,
        mixed_version_window_hours: Math.max(0, Math.floor(Number(windowHours) || 0)),
    });
    const body = JSON.stringify(manifest);

    function handler(_req, res) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, max-age=0');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(body);
    }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const metaTag = (url = '/release.json') => `<meta name="ov-release" content="${esc(release)}" data-released-at="${esc(manifest.released_at)}" data-url="${esc(url)}">`;

    return { manifest: () => manifest, release, handler, metaTag };
}

module.exports = { createRelease };
