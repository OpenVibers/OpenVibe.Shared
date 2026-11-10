'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { parseHTML } = require('linkedom');
const { window, document } = parseHTML('<html><body><a data-ov-player-hls="https://media.test/master.m3u8">Watch</a></body></html>');
const calls = [], connection = { effectiveType: '4g', addEventListener() {}, removeEventListener() {} };
const bodies = {
    'https://media.test/master.m3u8': '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\nhigh.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=300000\nlow.m3u8',
    'https://media.test/low.m3u8': '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4,\nfirst.m4s\n#EXTINF:4,\nsecond.m4s\n#EXT-X-ENDLIST',
    'https://media.test/init.mp4': 'init', 'https://media.test/first.m4s': 'segment',
};
const context = { window, document, navigator: { connection }, URL, TextDecoder, Uint8Array, AbortController,
    console, setTimeout, clearTimeout, fetch: async (url) => { calls.push(url); return new Response(bodies[url] || '', {status:bodies[url] ? 200 : 404}); } };
vm.runInNewContext(fs.readFileSync(require.resolve('../player.js'), 'utf8'), context);
const P = window.OpenVibePlayer;
(async () => {
    for (const [type, expected] of [['slow-2g','none'],['2g','none'],['3g','metadata'],['4g','auto'],[undefined,'auto']])
        assert.strictEqual(P.playbackPolicy({effectiveType:type}).preload, expected);
    assert.strictEqual(P.playbackPolicy({saveData:true,effectiveType:'4g'}).preload,'none');
    const low = P.playbackPolicy({}, {level:0.1,charging:false});
    assert.strictEqual(low.hls.maxBufferLength,15); assert.strictEqual(low.hls.backBufferLength,0); assert.strictEqual(low.warm,false);
    assert.strictEqual(P.playbackPolicy({}, {level:0.1,charging:true}).hls.maxBufferLength,60);
    const video = document.createElement('video'); video.paused=true;
    class Hls {
        static isSupported() { return true; }
        static Events = { DESTROYING: 'destroy' };
        constructor(config) { this.config=config; this.events={}; this.starts=0; }
        on(e, fn) { this.events[e]=fn; }
        startLoad() { this.starts++; }
        loadSource(url) { this.url=url; }
        attachMedia(v) { this.video=v; }
    }
    connection.effectiveType='3g';
    const hls=P.attachHls(video,Hls,'https://media.test/master.m3u8',{enableWorker:true});
    assert.strictEqual(hls.config.autoStartLoad,false); assert.strictEqual(hls.config.startLevel,0);
    assert.strictEqual(hls.config.enableWorker,true); assert.strictEqual(hls.starts,0);
    video.dispatchEvent(new window.Event('play')); assert.strictEqual(hls.starts,1);
    hls.events.destroy(); video.dispatchEvent(new window.Event('play')); assert.strictEqual(hls.starts,1,'destroy removes play listener');
    assert.strictEqual(await P.warmHls('https://media.test/master.m3u8'),false); assert.strictEqual(calls.length,0);
    connection.effectiveType='4g';
    assert.strictEqual(await P.warmHls('https://media.test/master.m3u8'),true);
    assert.deepStrictEqual(calls,Object.keys(bodies).filter(u=>!u.endsWith('high.m3u8')));
    assert.strictEqual(await P.warmHls('https://media.test/master.m3u8'),false,'deduplicated');
    assert.strictEqual(await P.warmHls('https://media.test/private.m3u8?sig=private'),false);
    assert.strictEqual(await P.warmHls('file:///x.m3u8'),false);
    bodies['https://media.test/live.m3u8']='#EXTM3U\n#EXTINF:4,\nfirst.m4s';
    assert.strictEqual(await P.warmHls('https://media.test/live.m3u8'),false,'live segments not prefetched');
    bodies['https://media.test/big.m3u8']='#EXTM3U\n#EXTINF:4,\nbig.m4s\n#EXT-X-ENDLIST';
    bodies['https://media.test/big.m4s']='x'.repeat(2*1024*1024+1);
    assert.strictEqual(await P.warmHls('https://media.test/big.m3u8'),false,'byte cap');
    const card = document.querySelector('[data-ov-player-hls]');
    card.setAttribute('data-ov-player-hls','https://media.test/focus.m3u8');
    bodies['https://media.test/focus.m3u8']=bodies['https://media.test/low.m3u8'];
    const beforeFocus=calls.length;
    card.dispatchEvent(new window.Event('focusin'));
    card.dispatchEvent(new window.Event('focusout'));
    await new Promise(resolve=>setTimeout(resolve,150));
    assert.strictEqual(calls.length,beforeFocus,'leaving before intent delay cancels warming');
    card.dispatchEvent(new window.Event('focusin'));
    await new Promise(resolve=>setTimeout(resolve,150));
    assert(calls.includes('https://media.test/focus.m3u8'),'keyboard focus warms a card');
    card.dispatchEvent(new window.Event('focusout'));
    console.log('player startup: preload, battery, deferred HLS, low rung, public bounded warming and teardown passed');
})().catch(e=>{console.error(e);process.exitCode=1});
