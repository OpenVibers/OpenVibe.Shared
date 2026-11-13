'use strict';
const assert = require('assert');
const { eventually } = require('../browser-harness');   // a check retries until the page is there (5 s ceiling)
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');
const { fixture } = require('./helpers/wallet-fixture');
if (!h.findChrome()) { console.log('wallet-chrome: skipped (Chrome unavailable)'); process.exit(0); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    const f = fixture(), base = await f.start();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-wallet-test-'));
    const browser = await h.launch({ tmpDir });
    try {
        for (const width of [390, 1280]) for (const scheme of ['dark', 'light']) {
            const context = await browser.newContext(), p = await h.openPage(browser, context, { width, height: 900 });
            await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
            await p.goto(base, { maxMs: 5000 });
            assert(!p.state.urls.some((u) => u.includes('ov-wallet.js')), 'sheet is lazy');
            await p.evaluate(`document.querySelector('[data-chip-id]').click()`); await wait(500);
            // 4.202.0: the wallet opens in the one window, which grows in (.28 s): measure once it has settled.
            { const end = Date.now() + 4000; while (Date.now() < end && !(await p.evaluate(`(() => { const w = document.querySelector('.ovw'); return !w || (w.getAnimations ? w.getAnimations().every((a) => a.playState !== 'running') : true); })()`))) await wait(50); }
            // The wallet opens with a scale animation; sizes are read once it has settled (a measurement mid-animation read
            // 40 px buttons as smaller, about one run in four).
            await p.evaluate(`Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))).then(() => true)`);
            const metrics = await p.evaluate(`(() => { const d=document.querySelector('.ov-wallet'); return {open:!!(d&&(d.open||d.closest('.ovw'))), width:document.documentElement.scrollWidth, inner:d&&d.scrollWidth, box:d&&d.clientWidth, lock:document.documentElement.style.overflow, text:d&&d.innerText, buttons:[...d.querySelectorAll('button,a')].map(b=>b.getBoundingClientRect().height)} })()`);
            assert(metrics.open, 'first chip tap opens wallet'); assert.strictEqual(metrics.width, width); assert(metrics.inner <= metrics.box + 1);
            assert.strictEqual(metrics.lock, 'hidden'); assert(metrics.text.includes('$0.00')); assert(metrics.text.includes('Buy Vibes')); assert(metrics.text.includes('Top up'));
            assert(/for the quest Publish a video/i.test(metrics.text), 'a money reason is a sentence, not a key (4.221.0: drawn with its first letter up)');
            assert(!/quest:publish|Daily quest completed/.test(metrics.text));
            assert(await p.evaluate(`[...document.querySelectorAll('.ov-wallet-event a')].some(a=>a.getAttribute('href')==='https://openvibe.quest/quests/publish-a-video')`), 'the reason links to its subject');
            assert(metrics.buttons.every((height) => height >= 44), '44px controls');
            if (process.env.WALLET_SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.WALLET_SCREENSHOT_DIR, { recursive: true });
                const shot = await p.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                fs.writeFileSync(path.join(process.env.WALLET_SCREENSHOT_DIR, `wallet-${width}-${scheme}.png`), Buffer.from(shot.data, 'base64'));
            }
            const wasWorn = await p.evaluate(`document.querySelector('.ov-wallet').innerText.includes('Unequip')`);
            await p.evaluate(`[...document.querySelectorAll('.ov-wallet button')].find(b=>/^(Equip|Unequip)$/.test(b.textContent)).click()`); await wait(150);
            await eventually(async () => assert.strictEqual(await p.evaluate(`document.querySelector('.ov-wallet').innerText.includes('Unequip')`), !wasWorn));
            await p.evaluate(`[...document.querySelectorAll('.ov-wallet button')].find(b=>b.textContent==='Buy Vibes').click()`);
            assert(await p.evaluate(`document.querySelector('.ov-wallet-checkout').innerText.includes('Continue to checkout')`));
            await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await wait(50);
            await eventually(async () => assert.strictEqual(await p.evaluate(`!!document.querySelector('.ov-wallet')`), false));
            await eventually(async () => assert.strictEqual(await p.evaluate(`document.documentElement.style.overflow`), ''));
            await p.evaluate(`OpenVibeNavbar.openWallet()`); await wait(150);
            await p.evaluate(`OpenVibeNavbar.setUser(null,null)`);
            await eventually(async () => assert.strictEqual(await p.evaluate(`!!document.querySelector('.ov-wallet')`), false, 'signout closes private content'));
            const exceptions = p.state.errors || [];
            assert.strictEqual(exceptions.length, 0, JSON.stringify(exceptions));
            await p.close(); await context.dispose();
        }
        assert(f.calls.filter((c) => c.path.includes('/me/')).every((c) => c.authorization === 'Bearer wallet-fixture' && !c.cookie));
        console.log('wallet Chrome: phone/desktop, both themes, lazy loading, zeros, equip, checkout, Escape, account change and no overflow');
    } finally { await browser.close(); await f.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
