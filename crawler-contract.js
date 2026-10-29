'use strict';
// Server-only: the network's crawler contract as one module.
//
// One rules object is the source of three things: robots.txt, /agent-policy.json and
// /crawlers.json. The policy half comes from the site's own agent descriptor — the same one
// /.well-known/agent.json is built from — so nothing here is a second, hand-kept copy.
//
//   const contract = require('openvibe-shared/crawler-contract');
//   const rules = contract.rules({ sitemaps: [sitemap], disallow: ['/admin'] });
//   app.get('/robots.txt', (req, res) => res.type('text/plain').send(contract.robotsTxt(rules)));
//   contract.mount(app, { descriptor, rules });

/** The crawlers the network welcomes by name, and what each one comes for. The names (and
 * their order) are the User-agent groups robots.txt writes; the kinds and purposes are what
 * /crawlers.json tells an agent. One table, so the two files cannot disagree. */
const CRAWLERS = [
    { name: 'Googlebot', kind: 'search', purpose: 'Search indexing' },
    { name: 'Bingbot', kind: 'search', purpose: 'Search indexing' },
    { name: 'DuckDuckBot', kind: 'search', purpose: 'Search indexing' },
    { name: 'Applebot', kind: 'search', purpose: 'Search indexing' },
    { name: 'GPTBot', kind: 'ai', purpose: 'AI training' },
    { name: 'OAI-SearchBot', kind: 'ai', purpose: 'AI search indexing' },
    { name: 'ChatGPT-User', kind: 'ai', purpose: 'User-triggered fetching' },
    { name: 'ClaudeBot', kind: 'ai', purpose: 'AI training' },
    { name: 'Claude-Web', kind: 'ai', purpose: 'User-triggered fetching' },
    { name: 'anthropic-ai', kind: 'ai', purpose: 'AI training' },
    { name: 'PerplexityBot', kind: 'ai', purpose: 'AI search indexing' },
    { name: 'CCBot', kind: 'ai', purpose: 'AI training' },
    { name: 'Google-Extended', kind: 'ai', purpose: 'AI training' },
    { name: 'Amazonbot', kind: 'ai', purpose: 'AI training' },
    { name: 'meta-externalagent', kind: 'ai', purpose: 'AI training' },
    { name: 'YouBot', kind: 'ai', purpose: 'AI search indexing' },
    { name: 'Bytespider', kind: 'ai', purpose: 'AI training' },
];

/** The names robots.txt greets, in the order it greets them. */
const AI_AND_SEARCH_BOTS = CRAWLERS.map(c => c.name);

const arr = value => (Array.isArray(value) ? value.slice() : []);

/**
 * The site's crawler rules — the one source for robots.txt, /crawlers.json and
 * /agent-policy.json. Normalising is idempotent: a rules object may be normalised again.
 */
function rules(options = {}) {
    const o = options || {};
    return {
        allow: o.allow === undefined ? ['/'] : arr(o.allow),
        disallow: arr(o.disallow),
        block: arr(o.block),
        sitemaps: arr(o.sitemaps),
        allowAI: o.allowAI === undefined ? true : Boolean(o.allowAI),
        crawlDelay: o.crawlDelay === undefined ? null : o.crawlDelay,
    };
}

/** robots.txt, from the site's crawler rules. Unchanged for every existing caller. */
function robotsTxt(options = {}) {
    const r = rules(options);
    const lines = [];
    // Content signals (contentsignals.org): with allowAI the network says yes to search, AI answers and training in so many
    // words (owner, 2026-10-25: "fully AI allowed and indexable"), so no crawler has to guess from silence.
    if (r.allowAI) lines.push('# Content signals: you may use this site\'s content for search, AI answers (ai-input) and AI training.', 'Content-Signal: search=yes, ai-input=yes, ai-train=yes', '');
    lines.push('User-agent: *');
    for (const a of r.allow) lines.push(`Allow: ${a}`);
    for (const d of r.disallow) lines.push(`Disallow: ${d}`);
    if (r.crawlDelay) lines.push(`Crawl-delay: ${r.crawlDelay}`);
    if (r.allowAI) {
        lines.push('');
        for (const bot of AI_AND_SEARCH_BOTS) lines.push(`User-agent: ${bot}`);
        lines.push('Allow: /');
        for (const d of r.disallow) lines.push(`Disallow: ${d}`);
    }
    for (const b of r.block) { lines.push('', `User-agent: ${b}`, 'Disallow: /'); }
    lines.push('');
    for (const s of r.sitemaps) lines.push(`Sitemap: ${s}`);
    return lines.join('\n') + '\n';
}

/** The site's agent descriptor, as the manifest /.well-known/agent.json serves it. */
function manifestOf(descriptor = {}) {
    return require('./agent-layer').agentManifest(descriptor);
}

/**
 * /agent-policy.json — what agents may do here: the API, the auth, the rate limits and what
 * must not be crawled. Every field is derived: the endpoints and the policy from the site's
 * own descriptor, the crawl rules from the same rules object robots.txt is written from.
 */
function agentPolicy({ descriptor = {}, rules: r = {}, manifest = null } = {}) {
    const m = manifest || manifestOf(descriptor);
    const c = rules(r);
    const home = m.home;
    const abs = value => (value && home ? new URL(value, home).href : value);
    const p = m.policy || {};
    return {
        ...m,
        policy: {
            ...p,
            crawl: {
                allow: c.allow,
                disallow: c.disallow,
                block: c.block,
                crawlDelay: c.crawlDelay,
                aiAllowed: c.allowAI,
                contentSignal: c.allowAI ? { search: true, aiInput: true, aiTrain: true } : null,
            },
        },
        links: {
            manifest: abs('/.well-known/agent.json'),
            policy: abs('/agent-policy.json'),
            crawlers: abs('/crawlers.json'),
            robots: abs('/robots.txt'),
        },
    };
}

/**
 * /crawlers.json — the crawlers this site welcomes or refuses, and why, next to robots.txt.
 * The same rules object decides it, so the two files cannot tell different stories.
 */
function crawlersJson({ descriptor = {}, rules: r = {}, manifest = null } = {}) {
    const c = rules(r);
    const m = manifest || (descriptor && (descriptor.home || descriptor.canonical) ? manifestOf(descriptor) : null);
    const blocked = new Set(c.block.map(String));
    const signal = c.allowAI ? { search: true, aiInput: true, aiTrain: true } : null;
    const crawlers = CRAWLERS.map(crawler => {
        if (blocked.has(crawler.name)) return { ...crawler, welcome: false, reason: 'Refused by this site: robots.txt disallows it entirely.' };
        if (c.allowAI) return { ...crawler, welcome: true, reason: `Named and welcomed by robots.txt; it comes for ${crawler.purpose}.` };
        return { ...crawler, welcome: true, reason: 'Covered by the default group in robots.txt; this site publishes no AI content signal.' };
    });
    const refused = c.block.filter(name => !CRAWLERS.some(crawler => crawler.name === name))
        .map(name => ({ name: String(name), kind: 'blocked', purpose: null, welcome: false, reason: 'Refused by this site: robots.txt disallows it entirely.' }));
    return {
        ...(m && m.site ? { site: m.site } : {}),
        ...(m && m.home ? { home: m.home } : {}),
        robots: '/robots.txt',
        policy: '/agent-policy.json',
        rules: { allow: c.allow, disallow: c.disallow, block: c.block, crawlDelay: c.crawlDelay },
        contentSignal: signal,
        default: {
            userAgent: '*',
            welcome: true,
            reason: 'The default group: anything not disallowed here may be crawled.',
        },
        crawlers: [...crawlers, ...refused],
    };
}

/** The paths the module serves. */
const PATHS = Object.freeze({ policy: '/agent-policy.json', crawlers: '/crawlers.json' });

/**
 * Mount before public HTML routes. Serves /agent-policy.json and /crawlers.json from the
 * descriptor and the crawler rules. GET and HEAD only; anything else falls through.
 */
function mount(app, { descriptor = {}, rules: r = {} } = {}) {
    const c = rules(r);
    const manifest = manifestOf(descriptor);
    const bodies = {
        [PATHS.policy]: JSON.stringify(agentPolicy({ descriptor, rules: c, manifest })),
        [PATHS.crawlers]: JSON.stringify(crawlersJson({ descriptor, rules: c, manifest })),
    };
    app.use((req, res, next) => {
        if (!['GET', 'HEAD'].includes(req.method)) return next();
        const url = new URL(req.url, 'https://agent.invalid');
        const body = bodies[url.pathname];
        if (body === undefined) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(req.method === 'HEAD' ? undefined : body);
    });
}

module.exports = { mount, rules, robotsTxt, agentPolicy, crawlersJson, manifestOf, CRAWLERS, AI_AND_SEARCH_BOTS, PATHS };
