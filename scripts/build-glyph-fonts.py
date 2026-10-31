#!/usr/bin/env python3
"""
The OpenVibe glyphs as fonts (plan L32 I5, 4.62.0), built from glyphs.js (the one registry):

  ov-glyphs.woff2                 the web font, served at /shared/ov-glyphs.woff2
  glyph-fonts/ov-glyphs.ttf       TrueType, for desktop apps and design tools
  glyph-fonts/ov-glyphs.otf       OpenType (CFF)
  ov-glyphs-font.css              @font-face plus .ovi .ovi-<name> classes
  ov-glyphs-fa.css                Font Awesome's class names on the font, for a site that drops Font Awesome's own
  glyph-codepoints.json           each glyph's Private Use Area code point: given once, never changed or reused
  glyph-fonts/manifest.json       what the fonts were built from (test/glyph-fonts.test.js checks it is current)

A glyph is drawn in strokes; a font holds outlines. Each glyph's strokes (2 units, round caps and joins) are expanded
to outlines by picosvg and merged into one shape by skia-pathops, so the font draws exactly what the SVG does.

Needs Python 3 with picosvg, fonttools and brotli (picosvg brings skia-pathops):
  python3 -m venv .venv && .venv/bin/pip install picosvg fonttools brotli
  .venv/bin/python scripts/build-glyph-fonts.py
"""
import hashlib
import json
import os
import subprocess
import sys

import pathops
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont
from picosvg.svg import SVG

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# A fixed build date in the fonts' head table, so building twice gives the same bytes (fontTools reads it).
os.environ.setdefault('SOURCE_DATE_EPOCH', '1793404800')
FAMILY = 'OV Glyphs'
UPM = 1024
DESCENT = 128                      # the icon sits like Font Awesome's: an eighth below the baseline
SCALE = UPM / 24
FIRST = 0xE001                     # the Private Use Area, from U+E001
VERSION = json.load(open(os.path.join(ROOT, 'package.json')))['version']


def registry():
    """Every glyph's drawing, and the Font Awesome names each stands for, from glyphs.js."""
    js = ("const g=require('./glyphs');const fa={};for(const[k,v]of Object.entries(g.FA))(fa[v]=fa[v]||[]).push(k);"
          "console.log(JSON.stringify({names:g.NAMES,paths:Object.fromEntries(g.NAMES.map(n=>[n,g.path(n)])),fa}))")
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))


def codepoints(names):
    """glyph-codepoints.json: a new glyph gets the next free code point; a code point once given is never reused."""
    p = os.path.join(ROOT, 'glyph-codepoints.json')
    cps = json.load(open(p))['glyphs'] if os.path.exists(p) else {}
    nxt = max([int(v, 16) for v in cps.values()] + [FIRST - 1]) + 1
    for n in sorted(names):
        if n not in cps:
            cps[n] = '%04X' % nxt
            nxt += 1
    data = {'about': 'Each OpenVibe glyph\'s code point in the OV Glyphs font (U+E001 up). Given once, never changed or reused.',
            'glyphs': dict(sorted(cps.items(), key=lambda kv: int(kv[1], 16)))}
    with open(p, 'w') as f:
        f.write(json.dumps(data, indent=2) + '\n')
    return {n: int(v, 16) for n, v in cps.items()}


def outline(inner):
    """The glyph's strokes as one merged outline (a skia-pathops Path), in the 24-unit grid."""
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#000" stroke-width="2" '
           'stroke-linecap="round" stroke-linejoin="round">' + inner + '</g></svg>')
    shapes = []
    for shape in SVG.fromstring(svg).topicosvg().shapes():
        p = pathops.Path()
        parse_path(shape.d, p.getPen())
        shapes.append(p)
    out = pathops.Path()
    pathops.union(shapes, out.getPen())
    return out


def to_font(path, pen):
    """Draws a 24-unit outline into a font pen: y up, the em square, an eighth below the baseline."""
    path.draw(TransformPen(pen, (SCALE, 0, 0, -SCALE, 0, 24 * SCALE - DESCENT)))


def build(flavour, order, cmap, outlines):
    fb = FontBuilder(UPM, isTTF=(flavour == 'ttf'))
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    if flavour == 'ttf':
        glyfs = {'.notdef': TTGlyphPen(None).glyph(), 'space': TTGlyphPen(None).glyph()}
        for name, path in outlines.items():
            pen = TTGlyphPen(None)
            to_font(path, Cu2QuPen(pen, max_err=1, reverse_direction=True))
            glyfs[name] = pen.glyph()
        fb.setupGlyf(glyfs)
    else:
        charstrings = {}
        for name in order:
            pen = T2CharStringPen(UPM, None)
            if name in outlines:
                to_font(outlines[name], pen)
            charstrings[name] = pen.getCharString()
        fb.setupCFF(FAMILY.replace(' ', ''), {'FullName': FAMILY}, charstrings, {})
    fb.setupHorizontalMetrics({n: (UPM, 0) for n in order})
    fb.setupHorizontalHeader(ascent=UPM - DESCENT, descent=-DESCENT)
    fb.setupNameTable({'familyName': FAMILY, 'styleName': 'Regular', 'uniqueFontIdentifier': f'OpenVibe:{FAMILY}:{VERSION}',
                       'fullName': FAMILY, 'psName': FAMILY.replace(' ', '') + '-Regular', 'version': f'Version {VERSION}',
                       'copyright': 'OpenVibe glyphs, MIT licence. https://openvibe.design/icons',
                       'licenseDescription': 'MIT', 'licenseInfoURL': 'https://opensource.org/license/mit'})
    fb.setupOS2(sTypoAscender=UPM - DESCENT, sTypoDescender=-DESCENT, sTypoLineGap=0, usWinAscent=UPM - DESCENT,
                usWinDescent=DESCENT, achVendID='OVIB', fsType=0)
    fb.setupPost(keepGlyphNames=True)
    return fb.font


def main():
    reg = registry()
    names = reg['names']
    cps = codepoints(names)
    outlines = {n: outline(reg['paths'][n]) for n in names}
    order = ['.notdef', 'space'] + names
    cmap = {0x20: 'space', **{cps[n]: n for n in names}}

    os.makedirs(os.path.join(ROOT, 'glyph-fonts'), exist_ok=True)
    ttf = build('ttf', order, cmap, outlines)
    ttf.save(os.path.join(ROOT, 'glyph-fonts', 'ov-glyphs.ttf'))
    build('otf', order, cmap, outlines).save(os.path.join(ROOT, 'glyph-fonts', 'ov-glyphs.otf'))
    web = TTFont(os.path.join(ROOT, 'glyph-fonts', 'ov-glyphs.ttf'))
    web.flavor = 'woff2'
    web.save(os.path.join(ROOT, 'ov-glyphs.woff2'))

    esc = lambda n: '\\' + ('%04x' % cps[n])
    head = '/* Generated by scripts/build-glyph-fonts.py from glyphs.js (openvibe-shared, MIT): edit those, then run it. */\n'
    face = ("@font-face{font-family:'OV Glyphs';src:url(ov-glyphs.woff2) format('woff2');font-weight:400;font-style:normal;font-display:block}\n")
    base = ("{display:inline-block;font-family:'OV Glyphs';font-style:normal;font-weight:400;font-variant:normal;line-height:1;"
            "text-rendering:auto;text-transform:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;speak:never}\n")
    font_css = (head + '/* <i class="ovi ovi-eye"></i>: the OpenVibe glyphs as a font. Sizes follow the text. */\n' + face
                + '.ovi' + base + '.ovi-fw{width:1.25em;text-align:center}\n'
                + ''.join(f'.ovi-{n}::before{{content:"{esc(n)}"}}\n' for n in names))
    with open(os.path.join(ROOT, 'ov-glyphs-font.css'), 'w') as f:
        f.write(font_css)
    fa_rules = []
    for n in names:
        for fa in sorted(reg['fa'].get(n, [])):
            fa_rules.append(f'.fa-{fa}::before{{content:"{esc(n)}"}}')
    fa_css = (head + "/* Font Awesome's class names on the OV Glyphs font, for a site that drops Font Awesome's stylesheet and its\n"
              "   font. A name with no glyph shows nothing, so load it only where every name a page uses is covered\n"
              "   (openvibe.design/icons lists them); brand logos keep Font Awesome Brands. */\n" + face
              + '.fa,.fas,.far,.fal,.fat,.fa-solid,.fa-regular,.fa-light,.fa-thin,.fa-duotone' + base
              + '.fa-fw{width:1.25em;text-align:center}\n' + '\n'.join(fa_rules) + '\n')
    with open(os.path.join(ROOT, 'ov-glyphs-fa.css'), 'w') as f:
        f.write(fa_css)

    source = json.dumps([[n, reg['paths'][n], '%04X' % cps[n]] for n in names], separators=(',', ':'), ensure_ascii=False)
    manifest = {'family': FAMILY, 'glyphs': len(names), 'source_sha256': hashlib.sha256(source.encode('utf8')).hexdigest(),
                'files': {p: os.path.getsize(os.path.join(ROOT, p)) for p in
                          ['ov-glyphs.woff2', 'glyph-fonts/ov-glyphs.ttf', 'glyph-fonts/ov-glyphs.otf']}}
    with open(os.path.join(ROOT, 'glyph-fonts', 'manifest.json'), 'w') as f:
        f.write(json.dumps(manifest, indent=2) + '\n')
    print(f"{len(names)} glyphs: " + ', '.join(f'{k} {v / 1024:.1f} KB' for k, v in manifest['files'].items()))


if __name__ == '__main__':
    sys.exit(main())
