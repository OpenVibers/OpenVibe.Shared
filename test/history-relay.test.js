'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

(async () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'history.js'), 'utf8');
    const originalFetch = global.fetch;
    let request;
    global.fetch = async (url, init) => { request = { url, init }; return { ok: true }; };
    try {
        delete global.OpenVibeHistory;
        delete require.cache[require.resolve('../history')];
        require('../history');
        const { record } = global.OpenVibeHistory;
        await record({ type: 'document', title: 'A page', url: 'https://openvibe.design/a', picture: 'https://openvibe.design/a.png', private: true, mature: false }, { token: 'fixture' });
        assert.ok(request.url.endsWith('/api/history'));
        const body = JSON.parse(request.init.body);
        assert.deepStrictEqual([body.image_url, body.private, body.mature], ['https://openvibe.design/a.png', true, false]);
        assert.ok(source.includes('entry.image_url || entry.picture'));

        const dockActor = fs.readFileSync(path.join(__dirname, '..', 'dock-actor.js'), 'utf8');
        assert.ok(dockActor.includes('/api/v1/history/agents/recent?limit=10'), 'the Dock reads only the opt-in agent endpoint');
        assert.ok(dockActor.includes('Your agent history setting is off'), 'the Dock handles an off switch');
    } finally { global.fetch = originalFetch; }
    console.log('history relay: local fixture passed');
})().catch((err) => { console.error(err); process.exit(1); });
