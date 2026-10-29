'use strict';
const assert = require('node:assert/strict');
const express = require('express');
const contract = require('../crawler-contract');
const seo = require('../seo');

const descriptor = {
    id: 'example', name: 'Example', purpose: 'Public examples', home: 'https://example.com/',
    docs: '/docs', api: '/api', openapi: '/openapi.json', mcp: { url: '/mcp', auth: 'bearer' },
    policy: { auth: ['none', 'Network OIDC', 'bearer'], rateLimit: '60 requests/minute', crawlDelayMs: 10000 },
};

// robots.txt is byte-for-byte what it was before the contract existed.
assert.equal(seo.robotsTxt({ sitemaps: ['https://example.com/sitemap.xml'], disallow: ['/admin', '/private'], allow: ['/'], allowAI: true, block: ['EvilBot'], crawlDelay: 10 }),
    "# Content signals: you may use this site's content for search, AI answers (ai-input) and AI training.\nContent-Signal: search=yes, ai-input=yes, ai-train=yes\n\nUser-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /private\nCrawl-delay: 10\n\nUser-agent: Googlebot\nUser-agent: Bingbot\nUser-agent: DuckDuckBot\nUser-agent: Applebot\nUser-agent: GPTBot\nUser-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nUser-agent: ClaudeBot\nUser-agent: Claude-Web\nUser-agent: anthropic-ai\nUser-agent: PerplexityBot\nUser-agent: CCBot\nUser-agent: Google-Extended\nUser-agent: Amazonbot\nUser-agent: meta-externalagent\nUser-agent: YouBot\nUser-agent: Bytespider\nAllow: /\nDisallow: /admin\nDisallow: /private\n\nUser-agent: EvilBot\nDisallow: /\n\nSitemap: https://example.com/sitemap.xml\n");
assert.equal(seo.robotsTxt({}), "# Content signals: you may use this site's content for search, AI answers (ai-input) and AI training.\nContent-Signal: search=yes, ai-input=yes, ai-train=yes\n\nUser-agent: *\nAllow: /\n\nUser-agent: Googlebot\nUser-agent: Bingbot\nUser-agent: DuckDuckBot\nUser-agent: Applebot\nUser-agent: GPTBot\nUser-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nUser-agent: ClaudeBot\nUser-agent: Claude-Web\nUser-agent: anthropic-ai\nUser-agent: PerplexityBot\nUser-agent: CCBot\nUser-agent: Google-Extended\nUser-agent: Amazonbot\nUser-agent: meta-externalagent\nUser-agent: YouBot\nUser-agent: Bytespider\nAllow: /\n\n");
assert.equal(seo.robotsTxt({ allowAI: false, block: ['BadBot'] }), 'User-agent: *\nAllow: /\n\nUser-agent: BadBot\nDisallow: /\n\n');
assert.equal(seo.robotsTxt({ crawlDelay: 0 }).includes('Crawl-delay'), false, 'a zero crawl delay stays out');
assert.equal(seo.robotsTxt({ allowAI: 0 }).includes('Content-Signal'), false, 'a falsy allowAI stays out');

// The rules object is the one source, and normalising it again changes nothing.
const rules = contract.rules({ sitemaps: ['https://example.com/sitemap.xml'], disallow: ['/admin'], block: ['EvilBot'], crawlDelay: 10 });
assert.deepEqual(contract.rules(rules), rules);
assert.deepEqual(contract.rules({}).allow, ['/'], 'the default group allows the site');
assert.deepEqual(contract.rules({ allow: [] }).allow, [], 'an explicit empty list is kept');
assert.equal(contract.rules({ allowAI: false }).allowAI, false);
assert.equal(contract.robotsTxt(rules), seo.robotsTxt(rules), 'robots.txt is the rules object, written out');

// /agent-policy.json comes from the site's own descriptor and the same rules.
const policy = contract.agentPolicy({ descriptor, rules });
assert.equal(policy.site, 'example.com');
assert.equal(policy.api, 'https://example.com/api');
assert.equal(policy.openapi, 'https://example.com/openapi.json');
assert.deepEqual(policy.policy.auth, descriptor.policy.auth, 'auth is the descriptor\'s, not a second copy');
assert.equal(policy.policy.rateLimit, '60 requests/minute');
assert.equal(policy.policy.crawlDelayMs, 10000);
assert.deepEqual(policy.policy.crawl.disallow, ['/admin']);
assert.deepEqual(policy.policy.crawl.block, ['EvilBot']);
assert.equal(policy.policy.crawl.crawlDelay, 10);
assert.equal(policy.policy.crawl.aiAllowed, true);
assert.deepEqual(policy.policy.crawl.contentSignal, { search: true, aiInput: true, aiTrain: true });
assert.deepEqual(contract.agentPolicy({ descriptor, rules: { allowAI: false } }).policy.crawl.contentSignal, null, 'no content signal where the site publishes none');
assert.equal(policy.links.manifest, 'https://example.com/.well-known/agent.json');
assert.equal(policy.links.crawlers, 'https://example.com/crawlers.json');
assert.equal(policy.links.robots, 'https://example.com/robots.txt');
assert.deepEqual(Object.keys(contract.agentPolicy({ descriptor: {}, rules: {} }).policy), ['robots', 'crawl'], 'no invented guarantees');

// /crawlers.json names the same crawlers robots.txt greets, and says why.
const crawlers = contract.crawlersJson({ descriptor, rules });
const named = seo.robotsTxt(rules).split('\n').filter(l => l.startsWith('User-agent: ') && l !== 'User-agent: *').map(l => l.slice('User-agent: '.length));
assert.deepEqual([...new Set(crawlers.crawlers.map(c => c.name))], [...new Set(named)], 'the same crawler list');
assert.deepEqual(contract.CRAWLERS.map(c => c.name), contract.AI_AND_SEARCH_BOTS);
assert.equal(crawlers.site, 'example.com');
assert.deepEqual(crawlers.rules.disallow, ['/admin']);
assert.equal(crawlers.contentSignal.search, true);
assert.equal(crawlers.default.userAgent, '*');
assert.equal(crawlers.crawlers.find(c => c.name === 'ClaudeBot').kind, 'ai');
assert.equal(crawlers.crawlers.find(c => c.name === 'ClaudeBot').purpose, 'AI training');
assert.equal(crawlers.crawlers.find(c => c.name === 'Googlebot').kind, 'search');
assert.equal(crawlers.crawlers.find(c => c.name === 'EvilBot').welcome, false, 'a blocked crawler is refused');
assert.match(crawlers.crawlers.find(c => c.name === 'EvilBot').reason, /Refused/);
assert.equal(crawlers.crawlers.find(c => c.name === 'ClaudeBot').welcome, true);

// The module mounts in one line and serves the two files.
const app = express();
contract.mount(app, { descriptor, rules });
app.get('/robots.txt', (req, res) => res.type('text/plain').send(seo.robotsTxt(rules)));
(async () => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const p = await fetch(base + '/agent-policy.json');
        assert.equal(p.status, 200);
        assert.match(p.headers.get('content-type'), /^application\/json/);
        assert.equal(p.headers.get('cache-control'), 'public, max-age=3600');
        assert.deepEqual(await p.json(), policy);
        const c = await fetch(base + '/crawlers.json');
        assert.equal(c.status, 200);
        assert.deepEqual(await c.json(), crawlers);
        const head = await fetch(base + '/crawlers.json', { method: 'HEAD' });
        assert.equal(await head.text(), '');
        assert.equal(head.headers.get('content-type'), 'application/json; charset=utf-8');
        assert.equal((await fetch(base + '/agent-policy.json', { method: 'POST' })).status, 404, 'other methods fall through');
        assert.equal((await fetch(base + '/robots.txt')).status, 200, 'robots.txt keeps working');
        assert.equal((await fetch(base + '/nowhere.json')).status, 404);
        console.log('crawler-contract: robots.txt unchanged, agent policy and crawlers served from one source');
    } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(err => { console.error(err); process.exitCode = 1; });
