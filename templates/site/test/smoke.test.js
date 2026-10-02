'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server/app');

function request(server, path) {
    return new Promise((resolve, reject) => {
        const req = http.get({ hostname: '127.0.0.1', port: server.address().port, path }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        });
        req.on('error', reject);
    });
}

(async () => {
    const homeUrl = new URL('/', process.env.SITE_URL || 'http://localhost:3000/').href;
    const sitemapUrl = new URL('/sitemap.xml', homeUrl).href;
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
        const home = await request(server, '/');
        assert.equal(home.status, 200);
        assert.ok(home.body.includes(`<link rel="canonical" href="${homeUrl}">`));
        assert.ok(home.body.includes(`<meta property="og:url" content="${homeUrl}">`));
        assert.match(home.body, /OpenVibeNavbar\.init\(/);
        assert.match(home.body, /OVWebRuntime\.create\(\{ features: \{\}, routes: \[\] \}\)\.boot\(\)/);
        assert.equal(home.headers['cache-control'], 'public, max-age=120, stale-while-revalidate=3600');

        const robots = await request(server, '/robots.txt');
        assert.equal(robots.status, 200);
        assert.match(robots.headers['content-type'], /^text\/plain/);
        assert.ok(robots.body.includes(`Sitemap: ${sitemapUrl}`));

        const sitemap = await request(server, '/sitemap.xml');
        assert.equal(sitemap.status, 200);
        assert.match(sitemap.headers['content-type'], /xml/);
        assert.ok(sitemap.body.includes(`<loc>${homeUrl}</loc>`));

        const llms = await request(server, '/llms.txt');
        assert.equal(llms.status, 200);
        assert.match(llms.headers['content-type'], /^text\/plain/);

        const script = await request(server, '/shared/web-runtime.js');
        assert.equal(script.status, 200);
        assert.equal(script.headers['cache-control'], 'public, max-age=300, stale-while-revalidate=60');
        console.log('site smoke: all checks passed');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
})().catch((err) => { console.error(err); process.exitCode = 1; });
