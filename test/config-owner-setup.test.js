'use strict';
// The owner's Setup page and the clear admin panel (OWNER-SETUP-AND-ADMIN-CLARITY-DESIGN, 2026-11-07):
//   - the annotations x-owner-input, x-required-for, x-enum-labels, x-advanced and x-example pass through to the
//     summary's schema (a secret property loses x-example and x-enum-labels); a wrong one is left out with a warning,
//     never a refused store, and lintSchema names it; a group's display name is read as its id;
//   - lintSchema fails a field without a title, a description under 30 characters, and a choice without labels;
//   - POST <base>/:namespace/test/:key calls the service's tester with the stored value and answers { ok, message } in
//     one line, never echoing a secret, on Express and on a plain http server.
const assert = require('assert');
const crypto = require('crypto');
let createDb;
try { ({ createDb } = require('openvibe-sdk/db')); } catch { console.log('config-owner-setup: skipped (openvibe-sdk not installed)'); process.exit(0); }
const express = require('express');
const http = require('http');
const { configSchema } = require('../config-pg');
const config = require('../config');
const { createConfigStore, adminRoutes, lintSchema, OWNER_INPUT_GROUPS } = config;

const USER = { type: 'user', id: 'usr_01JAB2C3D4E5F6G7H8J9K0MNPQ' };
const SECRET = 'MADE-UP-BOT-TOKEN-5e1d9a7c3b';
const CLIENT_SECRET = 'MADE-UP-CLIENT-SECRET-8f2b6d4a';
const KEKS = { current: 'k1', keys: { k1: crypto.randomBytes(32) } };
const logs = [];
const log = (m, level) => logs.push(`${level} ${m}`);

const LONG = 'A sentence long enough to explain what it does and what the default means.';
const SCHEMA = {
    title: 'Chat apps', description: 'The bot tokens the agent uses to answer in chat apps.',
    type: 'object', additionalProperties: false,
    properties: {
        telegram_bot_token: {
            type: 'string', title: 'Telegram bot token', description: 'Lets agents answer in Telegram. Without it the Telegram option stays hidden.',
            'x-owner-input': { group: 'chat-apps', unlocks: 'Lets agents answer in Telegram.', get_it_at: 'https://core.telegram.org/bots#how-do-i-create-a-bot', get_it_how: 'Ask @BotFather for /newbot and copy the token it gives you.', test: true },
            'x-required-for': 'Agents in Telegram',
            'x-example': '123456:ABC-DEF',
        },
        slack_client_id: { type: 'string', title: 'Slack client id', description: LONG, 'x-owner-input': { group: 'chat-apps', unlocks: 'Lets agents answer in Slack.' }, 'x-example': '1234.5678' },
        slack_client_secret: { type: 'string', title: 'Slack client secret', description: LONG, 'x-owner-input': { group: 'chat-apps', unlocks: 'Lets agents answer in Slack.', test: true } },
        mode: {
            type: 'string', title: 'Answer mode', description: LONG, enum: ['quiet', 'chatty'], 'x-advanced': true,
            'x-enum-labels': { quiet: { label: 'Only when asked', description: 'Answers a message that names it.' }, chatty: { label: 'Joins in', description: 'Answers when it has something to add.' } },
        },
        unused: { type: 'string', title: 'Unused', description: LONG },
    },
};
const classify = (k) => (/_(token|secret)$/.test(k) ? 'secret' : undefined);

(async () => {
    // ── The groups the Setup page shows, in order ──
    assert.deepStrictEqual(Object.keys(OWNER_INPUT_GROUPS), ['money', 'ai-providers', 'gpus', 'voices', 'chat-apps', 'sign-in-apps', 'data-sources', 'design-publishing', 'domains', 'legal']);
    assert.ok(Object.isFrozen(OWNER_INPUT_GROUPS));

    const db = createDb({ pglite: true, log: { log() {}, warn() {} } });
    await db.query(configSchema());

    // ── A wrong Setup annotation never refuses the store (a label must not take a service down at boot): the store
    //    starts, warns once, the summary leaves that annotation out, and lintSchema names the rule for the tests ──
    let n = 0;
    const warned = [];
    const realWarn = console.warn;
    const leftOut = async (prop, key, re) => {
        n += 1;
        const schema = { type: 'object', properties: { k: { type: 'string', title: 'K', description: 'A field used only to check one annotation rule.', ...prop } } };
        warned.length = 0;
        console.warn = (...a) => warned.push(a.join(' '));
        let st;
        try { st = await createConfigStore({ db, service: 'chat', namespace: `chat.bad${n}`, schema, log: false }); } finally { console.warn = realWarn; }
        assert.ok(warned.some((w) => re.test(w)), `the store warns about ${key}: ${warned.join(' | ')}`);
        const sum = await st.summary();
        assert.strictEqual(sum.schema.properties.k[key], undefined, `the summary leaves out the wrong ${key}`);
        assert.strictEqual(sum.schema.properties.k.title, 'K', 'the rest of the field is untouched');
        assert.ok(lintSchema(schema).some((e) => re.test(e.message)), `lintSchema names the rule for ${key}`);
    };
    await leftOut({ 'x-owner-input': 'yes' }, 'x-owner-input', /x-owner-input must be an object/);
    await leftOut({ 'x-owner-input': { group: 'snacks', unlocks: 'x' } }, 'x-owner-input', /x-owner-input\.group must be one of money/);
    await leftOut({ 'x-owner-input': { group: 'money' } }, 'x-owner-input', /x-owner-input\.unlocks/);
    await leftOut({ 'x-owner-input': { group: 'money', unlocks: 'x', get_it_at: 'http://example.com' } }, 'x-owner-input', /get_it_at must be an https URL/);
    await leftOut({ 'x-owner-input': { group: 'money', unlocks: 'x', get_it_at: 'https://user:pw@example.com' } }, 'x-owner-input', /get_it_at must be an https URL/);
    await leftOut({ 'x-owner-input': { group: 'money', unlocks: 'x', get_it_how: '  ' } }, 'x-owner-input', /get_it_how/);
    await leftOut({ 'x-owner-input': { group: 'money', unlocks: 'x', test: 'yes' } }, 'x-owner-input', /x-owner-input\.test must be true or false/);
    await leftOut({ 'x-owner-input': { group: 'money', unlocks: 'x', get_it_url: 'https://a.example' } }, 'x-owner-input', /unknown member "get_it_url"/);
    await leftOut({ 'x-required-for': '' }, 'x-required-for', /x-required-for/);
    await leftOut({ 'x-advanced': 'yes' }, 'x-advanced', /x-advanced must be true or false/);
    await leftOut({ 'x-example': { a: 1 } }, 'x-example', /x-example must be/);
    await leftOut({ enum: ['a'], 'x-enum-labels': ['a'] }, 'x-enum-labels', /x-enum-labels must be an object/);
    await leftOut({ enum: ['a'], 'x-enum-labels': { a: { description: 'no label' } } }, 'x-enum-labels', /x-enum-labels\["a"\] needs a label/);
    await leftOut({ enum: ['a'], 'x-enum-labels': { a: { label: 'A', note: 'x' } } }, 'x-enum-labels', /unknown member "note"/);
    await leftOut({ enum: ['a'], 'x-enum-labels': { b: { label: 'B' } } }, 'x-enum-labels', /names "b", which is not one of the enum values/);

    // A group given by its display name still groups (as its id), and lintSchema asks for the id.
    {
        const schema = { type: 'object', properties: { k: { type: 'string', title: 'K', description: 'A voice key the owner gives on the Setup page.', 'x-owner-input': { group: 'Voices', unlocks: 'Speech in chat' } } } };
        const st = await createConfigStore({ db, service: 'chat', namespace: 'chat.voicesname', schema, log: false });
        assert.strictEqual((await st.summary()).schema.properties.k['x-owner-input'].group, 'voices');
        assert.ok(lintSchema(schema).some((e) => /display name: use its id "voices"/.test(e.message)));
    }
    // The D11 annotations still refuse: they decide where a value comes from and how it is guarded.
    await assert.rejects(createConfigStore({ db, service: 'chat', namespace: 'chat.badenv', schema: { type: 'object', properties: { k: { type: 'string', 'x-env': 'lower-case' } } }, log: false }), /x-env must be an env name/);
    await assert.rejects(createConfigStore({ db, service: 'chat', namespace: 'chat.baddanger', schema: { type: 'object', properties: { k: { type: 'string', 'x-danger': 'yes' } } }, log: false }), /x-danger must be true or false/);

    // ── A good schema: the annotations reach the summary; a secret property loses its example and labels ──
    const store = await createConfigStore({ db, service: 'chat', namespace: 'chat.apps', schema: SCHEMA, classify, keks: KEKS, log });
    let summary = await store.summary();
    assert.strictEqual(summary.values.telegram_bot_token, undefined, 'nothing is set yet');
    assert.strictEqual(summary.classification.telegram_bot_token, 'secret', 'an unset secret is classified, so a form offers the write-only route');
    assert.strictEqual(summary.classification.slack_client_id, 'internal', 'every schema property is classified');
    const props = summary.schema.properties;
    assert.deepStrictEqual(props.telegram_bot_token['x-owner-input'], SCHEMA.properties.telegram_bot_token['x-owner-input'], 'x-owner-input passes through');
    assert.strictEqual(props.telegram_bot_token['x-required-for'], 'Agents in Telegram');
    assert.strictEqual(props.telegram_bot_token['x-example'], undefined, 'a secret property loses x-example');
    assert.strictEqual(props.slack_client_id['x-example'], '1234.5678', 'a plain property keeps x-example');
    assert.strictEqual(props.mode['x-advanced'], true);
    assert.deepStrictEqual(props.mode['x-enum-labels'], SCHEMA.properties.mode['x-enum-labels']);
    // A label set on a choice that is a secret goes with its enum.
    const secretChoice = await createConfigStore({ db, service: 'chat', namespace: 'chat.secretchoice', classify: () => 'secret', log: false,
        schema: { type: 'object', properties: { pick_secret: { type: 'string', enum: ['a', 'b'], 'x-enum-labels': { a: { label: 'A' }, b: { label: 'B' } } } } } });
    const scProps = (await secretChoice.summary()).schema.properties.pick_secret;
    assert.strictEqual(scProps.enum, undefined);
    assert.strictEqual(scProps['x-enum-labels'], undefined, 'a secret choice loses its labels with its enum');

    // ── lintSchema: clean, then each of the three failures ──
    assert.deepStrictEqual(lintSchema(SCHEMA), [], 'a clear schema has nothing to fix');
    assert.deepStrictEqual(lintSchema(summary), [], 'a summary is linted through its schema');
    const lint = lintSchema({
        type: 'object',
        properties: {
            no_title: { type: 'string', description: LONG },
            short: { type: 'string', title: 'Short', description: 'Too short to help.' },
            none: { type: 'integer', title: 'None' },
            pick: { type: 'string', title: 'Pick', description: LONG, enum: ['a', 'b'] },
            half: { type: 'string', title: 'Half', description: LONG, enum: ['a', 'b', null], 'x-enum-labels': { a: { label: 'A' } } },
            tags: { type: 'array', title: 'Tags', description: LONG, items: { type: 'string', enum: ['x'] } },
            limits: { type: 'object', title: 'Limits', description: LONG, properties: { max: { type: 'integer', description: LONG } } },
        },
    });
    const byKey = (key) => lint.filter((e) => e.key === key).map((e) => e.message);
    assert.deepStrictEqual(byKey('no_title'), ['has no title: give it a name in plain words']);
    assert.match(byKey('short')[0], /description of 18 characters; it needs at least 30/);
    assert.match(byKey('none')[0], /has no description/);
    assert.deepStrictEqual(byKey('pick'), ['is a choice without x-enum-labels: give every option words and a line']);
    assert.deepStrictEqual(byKey('half'), ['has no x-enum-labels label for "b", "null"']);
    assert.deepStrictEqual(byKey('tags'), ['is a choice without x-enum-labels: give every option words and a line'], 'a list of choices needs labels too');
    assert.deepStrictEqual(byKey('limits.max'), ['has no title: give it a name in plain words'], 'an object field\'s own fields are linted');
    assert.strictEqual(lint.find((e) => e.key === 'limits.max').path, '#/properties/limits/properties/max');
    assert.deepStrictEqual(lintSchema(null), [{ path: '#', key: null, message: 'is not a JSON Schema object' }]);

    // ── The test hook ──
    await store.setSecret('telegram_bot_token', SECRET, { actor: USER, reason: 'setup' });
    await store.setSecret('slack_client_secret', CLIENT_SECRET, { actor: USER, reason: 'setup' });
    await store.apply({ slack_client_id: '1234.5678' }, { merge: true, actor: USER, reason: 'setup' });
    const tried = [];
    let behaviour = 'ok';
    const tester = async ({ namespace, key, value, values, store: s, req }) => {
        tried.push({ namespace, key, value, hasValues: !!values, hasStore: typeof s.get === 'function', hasReq: !!req });
        if (key === 'unused') return null;
        if (behaviour === 'ok') return { ok: true, message: 'Telegram knows the bot\n@openvibe_bot.' };
        if (behaviour === 'echo') return { ok: false, message: `401 Unauthorized: token ${value} and ${CLIENT_SECRET} were refused` };
        if (behaviour === 'throw') throw new Error(`connect ECONNREFUSED with key=${value}`);
        if (behaviour === 'hang') return new Promise(() => {});
        if (behaviour === 'long') return { ok: false, message: 'x'.repeat(1000) };
        return { ok: true };
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = req.headers['x-test-user'] === 'owner' ? { role: 'admin', owner: true, subject_id: USER.id } : req.headers['x-test-user'] === 'admin' ? { role: 'admin', subject_id: USER.id } : null; next(); });
    const requireAdmin = (req, res, next) => (req.user ? next() : res.status(403).json({ error: 'Admin only' }));
    const actions = [];
    const authorize = (req, { action }) => { actions.push(action); return action === 'read' || !!req.user.owner; };
    adminRoutes([store], { requireAdmin, authorize, actor: (req) => ({ type: 'user', id: req.user.subject_id }), test: tester, testTimeoutMs: 300, log }).mount(app);
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}/api/admin/config`;
    const texts = [];
    const post = async (path, user = 'owner') => {
        const res = await fetch(base + path, { method: 'POST', headers: { 'x-test-user': user } });
        const text = await res.text();
        texts.push(text);
        return { status: res.status, body: text ? JSON.parse(text) : null };
    };
    try {
        let r = await post('/chat.apps/test/telegram_bot_token', 'nobody');
        assert.strictEqual(r.status, 403, 'requireAdmin guards the test route');
        r = await post('/chat.apps/test/telegram_bot_token', 'admin');
        assert.strictEqual(r.status, 403, 'authorize sees the test');
        assert.strictEqual(r.body.code, 'config.forbidden');
        assert.strictEqual(actions.at(-1), 'test', 'authorize is asked for the action "test"');
        assert.strictEqual(tried.length, 0, 'a refused test never reaches the tester');

        r = await post('/chat.apps/test/telegram_bot_token');
        assert.strictEqual(r.status, 200, JSON.stringify(r.body));
        assert.deepStrictEqual(r.body, { ok: true, message: 'Telegram knows the bot @openvibe_bot.' }, 'one line, nothing else');
        assert.deepStrictEqual(tried.at(-1), { namespace: 'chat.apps', key: 'telegram_bot_token', value: SECRET, hasValues: true, hasStore: true, hasReq: true }, 'the tester gets the opened value on the server');

        behaviour = 'echo';
        r = await post('/chat.apps/test/telegram_bot_token');
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.body.ok, false);
        assert.ok(!r.body.message.includes(SECRET) && !r.body.message.includes(CLIENT_SECRET), 'every secret of the namespace is scrubbed');
        assert.match(r.body.message, /^401 Unauthorized: token \[redacted\] and \[redacted\] were refused$/);

        behaviour = 'throw';
        r = await post('/chat.apps/test/slack_client_secret');
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.body.ok, false, 'a tester that throws is a failed test');
        assert.ok(!r.body.message.includes(CLIENT_SECRET));
        assert.match(r.body.message, /ECONNREFUSED/);

        behaviour = 'hang';
        r = await post('/chat.apps/test/telegram_bot_token');
        assert.deepStrictEqual(r.body, { ok: false, message: 'The test did not finish in 1 second.' }, 'a tester that hangs fails after testTimeoutMs');

        behaviour = 'long';
        r = await post('/chat.apps/test/telegram_bot_token');
        assert.strictEqual(r.body.message.length, 300, 'the answer is at most 300 characters');

        behaviour = 'bare';
        r = await post('/chat.apps/test/slack_client_id');
        assert.deepStrictEqual(r.body, { ok: true, message: 'It works.' }, 'a tester without a message gets words');

        r = await post('/chat.apps/test/unused');
        assert.strictEqual(r.status, 409, 'a key with no value is not tested');
        assert.strictEqual(r.body.code, 'config.not_set');
        await store.apply({ unused: 'x' }, { merge: true, actor: USER, reason: 'set' });
        r = await post('/chat.apps/test/unused');
        assert.strictEqual(r.status, 404, 'a key the tester does not test');
        assert.strictEqual(r.body.code, 'config.test_not_available');
        r = await post('/chat.nope/test/unused');
        assert.strictEqual(r.status, 404);
        assert.strictEqual(r.body.code, 'config.namespace_not_found');
    } finally {
        await new Promise((r) => server.close(r));
    }

    // ── Without a tester, on a plain http server through handle() ──
    const plain = adminRoutes([store], { requireAdmin: (_q, _s, nx) => nx(), actor: () => USER });
    const plainServer = http.createServer((req, res) => plain.handle(req, res));
    plainServer.listen(0);
    await new Promise((r) => plainServer.once('listening', r));
    try {
        const res = await fetch(`http://127.0.0.1:${plainServer.address().port}/api/admin/config/chat.apps/test/telegram_bot_token`, { method: 'POST' });
        const body = await res.json();
        texts.push(JSON.stringify(body));
        assert.strictEqual(res.status, 404);
        assert.strictEqual(body.code, 'config.test_not_available', 'a service without a tester says so');
    } finally {
        await new Promise((r) => plainServer.close(r));
    }
    // With a tester, through handle() too.
    const withTest = adminRoutes([store], { requireAdmin: (_q, _s, nx) => nx(), actor: () => USER, test: () => ({ ok: true, message: 'fine' }), log: false });
    const s2 = http.createServer((req, res) => withTest.handle(req, res));
    s2.listen(0);
    await new Promise((r) => s2.once('listening', r));
    try {
        const res = await fetch(`http://127.0.0.1:${s2.address().port}/api/admin/config/chat.apps/test/telegram_bot_token`, { method: 'POST' });
        assert.deepStrictEqual(await res.json(), { ok: true, message: 'fine' });
        const wrongMethod = await fetch(`http://127.0.0.1:${s2.address().port}/api/admin/config/chat.apps/test/telegram_bot_token`);
        assert.strictEqual(wrongMethod.status, 404, 'only POST tests');
    } finally {
        await new Promise((r) => s2.close(r));
    }
    assert.throws(() => adminRoutes([store], { requireAdmin: (_q, _s, nx) => nx(), test: 'yes' }), /test must be a function/);
    assert.ok(withTest.routes.some((r) => r.method === 'post' && r.path === '/api/admin/config/:namespace/test/:key'), 'the route is in the list mount() uses');

    // ── No secret anywhere: answers, the log, the summary ──
    for (const t of texts) assert.ok(!t.includes(SECRET) && !t.includes(CLIENT_SECRET), 'a route answer leaks a secret');
    const allLogs = logs.join('\n');
    assert.ok(!allLogs.includes(SECRET) && !allLogs.includes(CLIENT_SECRET), 'the log leaks a secret');
    assert.ok(logs.some((l) => /chat\.apps telegram_bot_token: test (passed|failed)/.test(l)), 'a test is logged by name');
    summary = await store.summary();
    assert.ok(!JSON.stringify(summary).includes(SECRET));

    console.log('config owner setup: annotations, lintSchema and the test hook ok');
})().catch((err) => { console.error(err); process.exit(1); });
