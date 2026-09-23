#!/usr/bin/env python3
"""Regenerate the solid inline icon set: nav-icons.js, the navbar's generated block, ov-icons.js.

Reads Font Awesome Free 6 (solid) glyph outlines — the same webfont every OpenVibe site already
ships — and writes them into nav-icons.js as filled SVG paths, so the navbar renders crisp solid
icons everywhere without the host page needing Font Awesome CSS. navbar.js carries only the glyphs
it draws itself (scripts/build-navbar-icons.js copies them over, with the widths of the rest) and
fetches nav-icons.js after first paint when a site names any other. Font Awesome Free icons are
CC BY 4.0 (https://fontawesome.com/license/free); attribution stays in the generated files.

    python3 scripts/build-nav-icons.py [--font path/to/fa-solid-900.woff2] [--css path/to/all.min.css]
"""
import argparse, json, re, sys, pathlib, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = pathlib.Path(__file__).resolve().parent
NAV_ICONS = HERE.parent / 'nav-icons.js'
DEFAULT_FONT = pathlib.Path('/home/workstation/orca/workspaces/OpenVibe.Live/seadragon/public/css/vendor/webfonts/fa-solid-900.woff2')
DEFAULT_CSS = pathlib.Path('/home/workstation/orca/workspaces/OpenVibe.Live/seadragon/public/css/vendor/fontawesome-6.5.1.min.css')

ICONS = """fa-bell fa-book fa-camera fa-clock-rotate-left fa-coins fa-comments fa-gamepad fa-gauge-high fa-hand-fist
fa-house fa-id-card fa-link fa-list-check fa-network-wired fa-palette fa-paste fa-people-arrows fa-people-group fa-plus
fa-right-from-bracket fa-scissors fa-screwdriver-wrench fa-shield-halved fa-shirt fa-text-height fa-tower-broadcast
fa-user fa-user-secret fa-video fa-wallet fa-wand-magic-sparkles
fa-arrow-up-right-from-square fa-chevron-down fa-chevron-right fa-bars fa-xmark fa-magnifying-glass fa-gear
fa-circle-half-stroke fa-moon fa-sun fa-file-pdf fa-arrow-down fa-arrow-right fa-clock fa-envelope fa-star
fa-heart fa-play fa-circle-info fa-triangle-exclamation fa-check fa-globe fa-code fa-robot fa-photo-film
fa-tower-cell fa-diagram-project fa-toolbox fa-comment-dots fa-money-bill-wave fa-crown fa-server fa-newspaper
fa-tag fa-ticket fa-chart-line fa-pen-nib fa-key fa-plug fa-bolt fa-satellite-dish fa-brain fa-microchip
fa-circle-nodes fa-download fa-upload fa-image fa-music fa-file-lines fa-font fa-location-dot fa-lock fa-wave-square
fa-map fa-utensils fa-user-shield""".split()
# ov-icons.js glyph name -> Font Awesome solid icon (names without a twin keep their stroke glyph)
OV_SOLID = {
    'network': 'fa-circle-nodes', 'live': 'fa-tower-broadcast', 'tools': 'fa-screwdriver-wrench', 'media': 'fa-photo-film',
    'games': 'fa-gamepad', 'community': 'fa-people-group', 'chat': 'fa-comments', 'codes': 'fa-code', 'code': 'fa-code',
    'blog': 'fa-pen-nib', 'wiki': 'fa-book', 'news': 'fa-newspaper', 'reviews': 'fa-star', 'tips': 'fa-coins', 'vip': 'fa-crown',
    'trade': 'fa-chart-line', 'host': 'fa-server', 'deals': 'fa-tag', 'coupons': 'fa-ticket', 'stream': 'fa-satellite-dish',
    'video': 'fa-video', 'download': 'fa-download', 'upload': 'fa-upload', 'image': 'fa-image', 'audio': 'fa-music',
    'pdf': 'fa-file-pdf', 'docs': 'fa-file-lines', 'text': 'fa-font', 'dns': 'fa-globe', 'ip': 'fa-location-dot',
    'ssl': 'fa-lock', 'ping': 'fa-wave-square', 'whois': 'fa-magnifying-glass', 'search': 'fa-magnifying-glass', 'map': 'fa-map',
    'food': 'fa-utensils', 'paste': 'fa-paste', 'account': 'fa-user', 'bell': 'fa-bell', 'history': 'fa-clock-rotate-left',
    'theme': 'fa-palette', 'check': 'fa-check', 'error': 'fa-triangle-exclamation', 'clip': 'fa-scissors',
}
OVICONS = HERE.parent / 'ov-icons.js'
OV_START, OV_END = '    // BEGIN generated solid glyphs (scripts/build-nav-icons.py)', '    // END generated solid glyphs'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--font', default=str(DEFAULT_FONT)); ap.add_argument('--css', default=str(DEFAULT_CSS))
    a = ap.parse_args()
    css = pathlib.Path(a.css).read_text(encoding='utf-8', errors='replace')
    cps = {}
    # Rules look like `.fa-clock-rotate-left:before,.fa-history:before{content:"\f1da"}` (1-6 hex digits).
    for m in re.finditer(r'([^{}]+)\{content:"\\([0-9a-fA-F]{1,6})"\}', css):
        for name in re.findall(r'\.(fa-[a-z0-9-]+):before', m.group(1)):
            cps.setdefault(name, int(m.group(2), 16))
    font = TTFont(a.font)
    cmap = font.getBestCmap(); glyphs = font.getGlyphSet(); hmtx = font['hmtx']
    upm = font['head'].unitsPerEm; asc = font['hhea'].ascent
    out, missing = {}, []
    for name in ICONS:
        cp = cps.get(name)
        gname = cmap.get(cp) if cp else None
        if not gname: missing.append(name); continue
        pen = SVGPathPen(glyphs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
        glyphs[gname].draw(TransformPen(pen, (1, 0, 0, -1, 0, asc)))
        adv = hmtx[gname][0]
        out[name] = [round(adv * 512 / upm), pen.getCommands()]
    js = ["// ═══════════════════════════════════════════════════════════════",
          "// OpenVibe — navbar icon glyphs. Generated by scripts/build-nav-icons.py; do not edit by hand.",
          "// Font Awesome Free 6 solid glyphs (CC BY 4.0, fontawesome.com/license/free) as filled paths:",
          "// name -> [advance width, path] in a 0 0 <w> 512 viewBox. navbar.js ships the glyphs it draws",
          "// itself and fetches this file after first paint for the rest; a page that wants every glyph",
          "// from the first frame can load it before navbar.js instead.",
          "// ═══════════════════════════════════════════════════════════════",
          "",
          "(function (root) {",
          "    'use strict';",
          "",
          "    const NAV_ICONS = {"]
    for k, (w, d) in out.items(): js.append(f"        '{k}': [{w}, '{d}'],")
    js += ["    };",
           "",
           "    if (typeof module !== 'undefined' && module.exports) module.exports = NAV_ICONS;",
           "    else root.OpenVibeNavIcons = NAV_ICONS;",
           "",
           "})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);",
           ""]
    NAV_ICONS.write_text('\n'.join(js), encoding='utf-8')
    subprocess.run(['node', str(HERE / 'build-navbar-icons.js')], check=True)
    print(f'wrote {len(out)} icons; missing: {missing or "none"}')
    ov = [OV_START, "    // Font Awesome Free 6 solid glyphs (CC BY 4.0) for the ring icons; viewBox 0 0 <w> 512.", "    const SOLID = {"]
    for name, fa in OV_SOLID.items():
        if fa in out: w, d = out[fa]; ov.append(f"        {name}: [{w}, '{d}'],")
    ov += ["    };", OV_END]
    src = OVICONS.read_text(encoding='utf-8')
    i, j = src.index(OV_START), src.index(OV_END) + len(OV_END)
    OVICONS.write_text(src[:i] + '\n'.join(ov) + src[j:], encoding='utf-8')
    print(f'ov-icons: {sum(1 for fa in OV_SOLID.values() if fa in out)} solid glyphs')

if __name__ == '__main__': main()
