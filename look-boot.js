'use strict';
/**
 * openvibe-shared/look-boot — the look before first paint, for a page whose theme-loader.js loads late (deferred, as on
 * Live). A tiny inline script: it paints the look this browser last painted on this site (theme-loader.js keeps it in
 * localStorage 'ov_paint'), or the one a link from another OpenVibe page just carried (?ov_look=, read only after an
 * OpenVibe page; theme-loader.js then keeps it and cleans the address). Colours only pass (no url(), no expression);
 * a season whose dates are over is left for the loader. Plan L42, 4.64.0.
 *
 *   const { BOOT, tag } = require('openvibe-shared/look-boot');
 *   `<head>${tag()}<link rel="stylesheet" …>`      first in <head>, before any stylesheet
 *
 * The token order is theme-loader.js's own (THEME_KEYS), read from it here so the two cannot drift.
 */
const fs = require('fs');
const path = require('path');

const LOADER = fs.readFileSync(path.join(__dirname, 'theme-loader.js'), 'utf8');
const KEYS = JSON.parse(LOADER.match(/const THEME_KEYS = (\[[^\]]+\]);/)[1].replace(/'/g, '"'));

const BOOT = `(function(){try{var d=document.documentElement,K=${JSON.stringify(KEYS)},P=null,ok=/^(#[0-9a-f]{3,8}|rgba?\\([0-9.,\\s%]+\\)|[0-9.,\\s]+|light|dark|(-?[0-9.]+(px)?\\s+){2,4}rgba?\\([0-9.,\\s%]+\\))$/i,m=/[?&]ov_look=([^&#]+)/.exec(location.search);`
    + `if(m&&document.referrer&&/(^|\\.)(openvibe\\.[a-z]{2,12}|openre\\.stream)$/i.test(new URL(document.referrer).hostname)&&m[1].length<4000){var L=JSON.parse(atob(decodeURIComponent(m[1]).replace(/-/g,'+').replace(/_/g,'/')));if(L&&L.v===1)P=L.p}`
    + `if(!P)P=JSON.parse(localStorage.getItem('ov_paint')||'null');if(!P||!P.k)return;var A=P.a||{};if(A['data-ov-season']&&P.u&&Date.now()>P.u)return;`
    + `for(var i=0;i<K.length;i++){var v=String(P.k[i]||'');if(v&&ok.test(v))d.style.setProperty(K[i],v)}`
    + `for(var n in A)if(/^data-(theme|theme-mode|ov-[a-z-]+)$/.test(n)&&/^[a-z0-9-]{1,40}$/.test(A[n]))d.setAttribute(n,A[n]);`
    + `if(/^[0-9.]{1,5}$/.test(P.ts||''))d.style.setProperty('--ov-text-scale',P.ts);if(P.k[0]&&ok.test(P.k[0]))d.style.background=P.k[0];if(P.k[6]&&ok.test(P.k[6]))d.style.color=P.k[6];`
    + `if(A['data-theme-mode']==='light'||A['data-theme-mode']==='dark')d.style.colorScheme=A['data-theme-mode']}catch(e){}})();`;

/** The inline <script> for the top of <head> (a nonce when the page's CSP uses one). */
function tag({ nonce = '' } = {}) {
    return `<script${nonce ? ` nonce="${String(nonce).replace(/[^A-Za-z0-9+/=_-]/g, '')}"` : ''}>${BOOT}</script>`;
}

module.exports = { BOOT, tag, KEYS };
