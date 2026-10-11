#!/usr/bin/env python3
"""Generate the site's icon set and social share image from its palette.

There is no logo for Horse Legal Guide, so the icons are the site's initial
set in the page palette (scripts/lib/render_page.js :root tokens), and the
1200x630 share image is the site name and line on the same palette.

Outputs land in assets/brand/ and are committed; scripts/build/build_site.js
copies every file there to the dist/ root. Re-run only to change the design:
    python3 scripts/build/generate_brand_assets.py
Needs Pillow and a serif TTF (Georgia on macOS; DejaVu Serif elsewhere).
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'brand')
BG = '#f4efe7'
PANEL = '#fbf8f3'
TEXT = '#2f2a26'
MUTED = '#665f57'
ACCENT = '#5d4634'
LINE = '#d8cec0'

FONT_CANDIDATES = [
    ('/System/Library/Fonts/Supplemental/Georgia Bold.ttf', '/System/Library/Fonts/Supplemental/Georgia.ttf'),
    ('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'),
]


def fonts():
    for bold, regular in FONT_CANDIDATES:
        if os.path.exists(bold) and os.path.exists(regular):
            return bold, regular
    raise SystemExit('No serif TTF found; install Georgia or DejaVu Serif.')


BOLD, REGULAR = fonts()


def icon(size):
    scale = 4
    s = size * scale
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=ACCENT)
    font = ImageFont.truetype(BOLD, int(s * 0.62))
    d.text((s / 2, s / 2 + s * 0.02), 'H', font=font, fill=PANEL, anchor='mm')
    return img.resize((size, size), Image.LANCZOS)


def og_image():
    w, h = 1200, 630
    img = Image.new('RGB', (w, h), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 14], fill=ACCENT)
    d.rounded_rectangle([60, 70, w - 60, h - 70], radius=28, fill=PANEL, outline=LINE, width=2)
    mark = icon(120)
    img.paste(mark, (110, 120), mark)
    d.text((110, 290), 'Horse Legal Guide', font=ImageFont.truetype(BOLD, 88), fill=TEXT)
    d.text((112, 400), 'Plain-English answers to equine law questions', font=ImageFont.truetype(REGULAR, 38), fill=MUTED)
    d.text((112, 452), 'Sales, leases, boarding, liability and barn businesses', font=ImageFont.truetype(REGULAR, 30), fill=MUTED)
    d.text((112, 505), 'horselegalguide.com', font=ImageFont.truetype(BOLD, 30), fill=ACCENT)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    icon(48).save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    icon(32).save(os.path.join(OUT, 'favicon-32x32.png'))
    icon(180).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
    icon(192).save(os.path.join(OUT, 'icon-192.png'))
    icon(512).save(os.path.join(OUT, 'icon-512.png'))
    og_image().save(os.path.join(OUT, 'og.png'), optimize=True)
    manifest = {
        'name': 'Horse Legal Guide',
        'short_name': 'Horse Legal',
        'description': 'Plain-English answers to equine law questions.',
        'start_url': '/',
        'scope': '/',
        'display': 'browser',
        'background_color': BG,
        'theme_color': ACCENT,
        'icons': [
            {'src': '/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
            {'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        ],
    }
    with open(os.path.join(OUT, 'site.webmanifest'), 'w') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')


if __name__ == '__main__':
    main()
