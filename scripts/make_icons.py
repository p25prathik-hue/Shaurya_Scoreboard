"""Generate web + Android icons for Shaurya Live (run once; outputs are committed)."""
import os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = (12, 10, 11, 255)
ACCENT = (255, 106, 43, 255)
LIVE = (255, 77, 94, 255)
FONT_CANDIDATES = [
    '/usr/share/texmf/fonts/opentype/public/tex-gyre/texgyreheroscn-bold.otf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',
]
FONT = next(p for p in FONT_CANDIDATES if os.path.exists(p))

def glyph(size, scale=0.62, bg=BG, radius=0.0, dot=True):
    """Orange condensed 'S' with a red live dot on a dark ground."""
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg is not None:
        if radius:
            d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=bg)
        else:
            d.rectangle([0, 0, S, S], fill=bg)
    font = ImageFont.truetype(FONT, int(S * scale * 1.18))
    box = d.textbbox((0, 0), 'S', font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    x = (S - w) / 2 - box[0] - S * 0.03
    y = (S - h) / 2 - box[1]
    d.text((x, y), 'S', font=font, fill=ACCENT)
    if dot:
        r = S * 0.065 * scale / 0.62
        cx, cy = x + box[0] + w + r * 1.25, y + box[1] + r * 1.1
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=LIVE)
    return im.resize((size, size), Image.LANCZOS)

def wordmark(width):
    """SHAURYA'26 / LIVE wordmark used on the Android splash."""
    S = width * 2
    im = Image.new('RGBA', (S, int(S * 0.62)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(FONT, int(S * 0.2))
    f2 = ImageFont.truetype(FONT, int(S * 0.2))
    t1, t2 = 'SHAURYA', "’26 LIVE"
    b1 = d.textbbox((0, 0), t1, font=f1)
    b2 = d.textbbox((0, 0), t2, font=f2)
    d.text(((S - (b1[2] - b1[0])) / 2 - b1[0], S * 0.04), t1, font=f1, fill=(245, 239, 234, 255))
    d.text(((S - (b2[2] - b2[0])) / 2 - b2[0], S * 0.04 + (b1[3] - b1[1]) * 1.18), t2, font=f2, fill=ACCENT)
    return im.resize((width, int(width * 0.62)), Image.LANCZOS)

def save(im, *parts):
    p = os.path.join(ROOT, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, optimize=True)
    return p

# ---- web ----
save(glyph(192, radius=0.22), 'www', 'icons', 'icon-192.png')
save(glyph(512, radius=0.22), 'www', 'icons', 'icon-512.png')
save(glyph(512, scale=0.46), 'www', 'icons', 'maskable-512.png')
save(glyph(180, scale=0.56), 'www', 'icons', 'apple-touch-icon.png')

# ---- Android launcher (copied into android/app/src/main/res by CI) ----
dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in dens.items():
    legacy = int(48 * k)
    save(glyph(legacy, radius=0.2), 'resources', 'android', 'res', f'mipmap-{name}', 'ic_launcher.png')
    round_im = glyph(legacy)
    big = Image.new('L', (legacy * 4, legacy * 4), 0)
    ImageDraw.Draw(big).ellipse([0, 0, legacy * 4 - 1, legacy * 4 - 1], fill=255)
    mask = big.resize((legacy, legacy), Image.LANCZOS)
    round_out = Image.new('RGBA', round_im.size, (0, 0, 0, 0))
    round_out.paste(round_im, (0, 0), mask)
    save(round_out, 'resources', 'android', 'res', f'mipmap-{name}', 'ic_launcher_round.png')
    fg = int(108 * k)
    save(glyph(fg, scale=0.40, bg=None), 'resources', 'android', 'res', f'mipmap-{name}', 'ic_launcher_foreground.png')

save(wordmark(900), 'resources', 'splash-wordmark.png')
print('icons written')
