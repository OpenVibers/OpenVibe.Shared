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
fa-map fa-utensils fa-user-shield
fa-gauge fa-pen fa-earth-americas fa-hashtag fa-inbox fa-folder fa-puzzle-piece fa-shield fa-display fa-microphone
fa-infinity fa-list fa-flag-checkered fa-tv fa-compass""".split()
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
    # Products that had only the "V" (2026-10-10), and the ones opening next.
    'bot': 'fa-robot', 'work': 'fa-briefcase', 'rent': 'fa-key', 'help': 'fa-circle-question', 'quest': 'fa-trophy',
    'inventory': 'fa-box-open', 'drive': 'fa-hard-drive', 'services': 'fa-cubes', 'space': 'fa-rocket', 'watch': 'fa-eye',
    'actor': 'fa-brain', 'events': 'fa-bolt', 'ai': 'fa-microchip', 'run': 'fa-terminal', 'billing': 'fa-wallet',
    'feeds': 'fa-rss', 'pics': 'fa-images', 'homes': 'fa-house-chimney', 'website': 'fa-window-restore', 'zone': 'fa-database',
    'fund': 'fa-hand-holding-dollar', 'play': 'fa-ranking-star',
    # Page furniture the product homes name (2.21.1).
    'gauge': 'fa-gauge-high', 'link': 'fa-link', 'shield': 'fa-shield-halved', 'plug': 'fa-plug',
    # Sites that borrowed a neighbour's glyph until 2026-11-07 (Cam showed Video's, Casino and Surf the gamepad, Fun
    # Quest's trophy): each its own now, so the menu reads at a glance.
    'cam': 'fa-camera', 'casino': 'fa-dice', 'surf': 'fa-water', 'fun': 'fa-masks-theater', 'meme': 'fa-face-grin-squint-tears',
    'tours': 'fa-compass', 'vision': 'fa-binoculars', 'shoes': 'fa-shoe-prints', 'today': 'fa-calendar-day',
    'report': 'fa-chart-simple', 'design': 'fa-pen-ruler', 'domains': 'fa-earth-americas', 'exchange': 'fa-right-left',
    'bench': 'fa-flag-checkered',
}
OVICONS = HERE.parent / 'ov-icons.js'
OV_START, OV_END = '    // BEGIN generated solid glyphs (scripts/build-nav-icons.py)', '    // END generated solid glyphs'
# Every solid's larger ink side, as a fraction of the 512 square the Font Awesome path data is drawn in
# (scripts/icon-ink.js measures the same square and enforces the same target). The glyphs are all on
# ONE em square, so equal ink means equal painted size whatever the advance width is: the advance only
# says how much side bearing the glyph carries, and it sizes the slot, not the drawing.
INK_TARGET = 0.79


def _fmt(v):
    # A whole unit, like scripts/icon-ink.js: the Font Awesome glyphs are drawn in the 0..512 square,
    # where a unit is 0.2% of the box — far finer than the 4% the test allows — and it keeps
    # nav-icons.js (and the navbar's copy of it) small.
    r = round(v)
    return '0' if r == 0 else str(int(r))


def normalise_pen(glyphs, glyph, flip, adv512):
    """(matrix, w) drawing the glyph's ink centred on (256, 256) at INK_TARGET of the 512 square.

    BoundsPen measures the outline's box in flipped space; the matrix composes the y-flip with the
    centre-and-scale, so SVGPathPen draws the normalised path directly. scripts/icon-ink.js applies
    the same rule (there blended 70/30 with the raster centre of mass, which a pen cannot see) to the
    checked-in output; re-running this generator stays within the test's 3%/4% of that."""
    from fontTools.pens.boundsPen import BoundsPen
    bp = BoundsPen(glyphs)
    glyph.draw(TransformPen(bp, flip))
    if bp.bounds is None:
        return flip, adv512
    x0, y0, x1, y1 = bp.bounds
    s = INK_TARGET * 512 / max(x1 - x0, y1 - y0)
    tx = 256 - s * (x0 + x1) / 2
    ty = 256 - s * (y0 + y1) / 2
    # Normalise after the flip (x, -y+asc): x' = s·x + tx, y' = -s·y + s·asc + ty.
    return (s, 0, 0, -s, tx, s * flip[5] + ty), adv512

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
    # Outlines for the navbar's set and for the ring icons' twins; nav-icons.js (and so navbar.js's width table) gets
    # only ICONS: a glyph only the ring icons draw costs the navbar nothing.
    out, missing = {}, []
    for name in dict.fromkeys(ICONS + list(OV_SOLID.values())):
        cp = cps.get(name)
        gname = cmap.get(cp) if cp else None
        if not gname: missing.append(name); continue
        pen = SVGPathPen(glyphs, ntos=_fmt)
        adv = hmtx[gname][0]
        adv512 = adv * 512 / upm
        matrix, _ = normalise_pen(glyphs, glyphs[gname], (1, 0, 0, -1, 0, asc), adv512)
        glyphs[gname].draw(TransformPen(pen, matrix))
        out[name] = [round(adv512), pen.getCommands()]
    js = ["// ═══════════════════════════════════════════════════════════════",
          "// OpenVibe — navbar icon glyphs. Generated by scripts/build-nav-icons.py; do not edit by hand.",
          "// Font Awesome Free 6 solid glyphs (CC BY 4.0, fontawesome.com/license/free) as filled paths:",
          "// name -> [advance width, path] in a 0 0 512 512 viewBox. The glyphs are normalised to the same",
          "// ink size on that one square, so the advance says how much side bearing a glyph carries and",
          "// sizes its slot, not how big it draws. navbar.js ships the glyphs it draws itself and fetches",
          "// this file after first paint for the rest; a page that wants every glyph from the first frame",
          "// can load it before navbar.js instead.",
          "// ═══════════════════════════════════════════════════════════════",
          "",
          "(function (root) {",
          "    'use strict';",
          "",
          "    const NAV_ICONS = {"]
    for k, (w, d) in out.items():
        if k in ICONS: js.append(f"        '{k}': [{w}, '{d}'],")
    js += ["    };",
           "",
           "    if (typeof module !== 'undefined' && module.exports) module.exports = NAV_ICONS;",
           "    else root.OpenVibeNavIcons = NAV_ICONS;",
           "",
           "})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);",
           ""]
    NAV_ICONS.write_text('\n'.join(js), encoding='utf-8')
    subprocess.run(['node', str(HERE / 'build-navbar-icons.js')], check=True)
    print(f'wrote {sum(1 for k in out if k in ICONS)} icons; missing: {missing or "none"}')
    ov = [OV_START, "    // Font Awesome Free 6 solid glyphs (CC BY 4.0) for the ring icons; viewBox 0 0 512 512,", "    // normalised to one ink size (scripts/build-nav-icons.py).", "    const SOLID = {"]
    for name, fa in OV_SOLID.items():
        if fa in out: w, d = out[fa]; ov.append(f"        {name}: [{w}, '{d}'],")
    ov += ["    };", OV_END]
    src = OVICONS.read_text(encoding='utf-8')
    i, j = src.index(OV_START), src.index(OV_END) + len(OV_END)
    OVICONS.write_text(src[:i] + '\n'.join(ov) + src[j:], encoding='utf-8')
    print(f'ov-icons: {sum(1 for fa in OV_SOLID.values() if fa in out)} solid glyphs')

if __name__ == '__main__': main()
