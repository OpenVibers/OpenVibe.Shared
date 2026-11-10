'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('surfaces-chrome: skipped (no Chrome)');
    process.exit(0);
}
const page = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{margin:0}dialog{width:min(350px,90vw);padding:0;max-height:70dvh}header{height:60px;background:#345;color:white}
.scroll{height:300px;overflow:auto;overscroll-behavior:contain}.spacer{height:1200px}
</style><button id="open">Open sheet</button><div id="behind" class="spacer"></div>
<dialog id="sheet"><header data-ov-sheet-head>Drag sheet</header><div class="scroll"><div class="spacer">Sheet content</div></div></dialog>
<button id="one">One</button><div id="pop1" hidden>First menu</div>
<button id="two">Two</button><div id="pop2" hidden>Second menu</div>
<script src="/surfaces.js"></script><script>
const sheet=document.querySelector('#sheet'); document.querySelector('#open').onclick=()=>sheet.showModal();
const a=document.querySelector('#pop1'), b=document.querySelector('#pop2');
const one=OVSurfaces.popover({el:a,trigger:document.querySelector('#one'),close:()=>a.hidden=true});
const two=OVSurfaces.popover({el:b,trigger:document.querySelector('#two'),close:()=>b.hidden=true});
document.querySelector('#one').onclick=()=>{a.hidden=false;one.open()};
document.querySelector('#two').onclick=()=>{b.hidden=false;two.open()};
</script>`;
const server = http.createServer((req, res) => {
    if (req.url === '/surfaces.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'surfaces.js'))); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(page);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-surfaces-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        await p.evaluate('scrollTo(0, 400); window.__before = scrollY; document.querySelector("#open").dispatchEvent(new PointerEvent("pointerdown", {bubbles:true})); document.querySelector("#open").click()');
        await new Promise((ok) => setTimeout(ok, 80));
        assert.strictEqual(await p.evaluate('document.body.style.position'), 'fixed', 'page is locked on a phone');
        assert.strictEqual(await p.evaluate('document.body.style.top'), await p.evaluate('`${-window.__before}px`'), 'lock retains scroll position');
        if (process.env.OV_SHEETS_SHOTS) {
            fs.mkdirSync(process.env.OV_SHEETS_SHOTS, { recursive: true });
            const shot = await p.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            fs.writeFileSync(path.join(process.env.OV_SHEETS_SHOTS, 'shared-sheet-390.png'), Buffer.from(shot.data, 'base64'));
        }
        await p.evaluate('document.querySelector(".scroll").scrollTop = 150');
        assert.strictEqual(await p.evaluate('document.querySelector(".scroll").scrollTop'), 150, 'sheet content scrolls');
        await p.evaluate('document.querySelector("#sheet").addEventListener("cancel", e => e.preventDefault(), {once:true})');
        await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        assert.strictEqual(await p.evaluate('document.querySelector("#sheet").open && document.body.style.position === "fixed"'), true, 'a canceled close keeps the sheet and lock');
        await p.evaluate('document.querySelector("#sheet").close()');
        await new Promise((ok) => setTimeout(ok, 50));
        assert.strictEqual(await p.evaluate('Math.round(scrollY)'), await p.evaluate('Math.round(window.__before)'), 'close restores page position');
        assert.strictEqual(await p.evaluate('document.activeElement.id'), 'open', 'focus returns to opener');
        await p.evaluate(`(() => { const btn=document.querySelector('#open');btn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));btn.click(); })()`);
        // The sheet takes the swipe only once the surfaces layer has adopted it (the page is locked): wait for that, not
        // for a fixed 40 ms (a slow macOS runner had not got there yet, twice on 2026-11-10).
        let adopted = false;
        for (let i = 0; i < 60 && !adopted; i++) { adopted = await p.evaluate('document.querySelector("#sheet").open && document.body.style.position === "fixed"'); if (!adopted) await new Promise((ok) => setTimeout(ok, 50)); }
        assert.strictEqual(adopted, true, 'the sheet opens again and locks the page');
        await new Promise((ok) => setTimeout(ok, 60));
        const head = await p.evaluate(`(() => { const r=document.querySelector('[data-ov-sheet-head]').getBoundingClientRect();
            return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
        await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [head] });
        await p.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: head.x, y: head.y + 130 }] });
        await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.strictEqual(await p.evaluate('document.querySelector("#sheet").open'), false, 'a downward header swipe closes the sheet');
        await p.evaluate('document.querySelector("#one").click()');
        await p.evaluate('document.querySelector("#two").click()');
        assert.deepStrictEqual(await p.evaluate('[document.querySelector("#pop1").hidden, document.querySelector("#pop2").hidden]'), [true, false], 'opening another closes the first');
        await p.evaluate('document.querySelector("#behind").dispatchEvent(new PointerEvent("pointerdown", {bubbles:true}))');
        assert.strictEqual(await p.evaluate('document.querySelector("#pop2").hidden'), true, 'outside pointerdown closes a pop-over');
        await p.close();
        if (process.env.OV_SHEETS_SHOTS) {
            const desktop = await h.openPage(browser, context, { width: 1280, height: 900 });
            await desktop.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
            await desktop.evaluate('document.querySelector("#open").click()');
            await new Promise((ok) => setTimeout(ok, 80));
            const shot = await desktop.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            fs.writeFileSync(path.join(process.env.OV_SHEETS_SHOTS, 'shared-sheet-1280.png'), Buffer.from(shot.data, 'base64'));
            await desktop.close();
        }
        console.log('surfaces-chrome: phone scroll lock, sheet scroll, focus, one pop-over and outside pointer ok');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
