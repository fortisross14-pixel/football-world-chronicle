from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path('/mnt/data/fwc0297')
PLAYERS = ROOT / 'assets' / 'faces' / 'players'
COACHES = ROOT / 'assets' / 'faces' / 'coaches'
PREVIEW = Path('/mnt/data/v297_portrait_cards_preview.png')

CARD_SIZE = 128
RADIUS = 22


def gradient_background(kind='player'):
    W = H = CARD_SIZE
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)
    if kind == 'coach':
        top = (38, 49, 67)
        bottom = (19, 27, 39)
        glow = (106, 134, 171, 44)
    else:
        top = (58, 80, 116)
        bottom = (24, 39, 64)
        glow = (101, 147, 222, 54)
    for y in range(H):
        t = y / (H - 1)
        c = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        draw.line((0, y, W, y), fill=c)
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-18, -18, 112, 92), fill=glow)
    od.ellipse((48, 14, 154, 138), fill=(8, 17, 30, 48))
    overlay = overlay.filter(ImageFilter.GaussianBlur(16))
    img.alpha_composite(overlay)
    # subtle diagonal texture
    for x in range(-H, W, 16):
        draw.line((x, H, x + H, 0), fill=(255, 255, 255, 10), width=1)
    # top-left highlight
    hi = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hi)
    hd.ellipse((-26, -24, 64, 52), fill=(255, 255, 255, 20))
    hi = hi.filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(hi)
    return img


def rounded_mask(size=(CARD_SIZE, CARD_SIZE), radius=RADIUS):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0]-1, size[1]-1), radius, fill=255)
    return mask


def build_card(src_path: Path, kind='player'):
    src = Image.open(src_path).convert('RGBA')
    arr = np.array(src)
    alpha = arr[:, :, 3]
    alpha[alpha < 18] = 0
    arr[:, :, 3] = alpha
    src = Image.fromarray(arr, 'RGBA')
    bbox = src.getbbox()
    if not bbox:
        bg = gradient_background(kind)
        bg.putalpha(rounded_mask())
        return bg

    x0, y0, x1, y1 = bbox
    # Remove the most common top-edge junk by clipping a small fixed band.
    # This is preferable to leaving debris floating above the head.
    top_clip = min(y0 + 10, y1 - 44)
    crop = src.crop((x0, top_clip, x1, y1))

    bg = gradient_background(kind)
    max_w = 102 if kind == 'player' else 100
    max_h = 108 if kind == 'player' else 110
    ratio = min(max_w / crop.width, max_h / crop.height)
    new_size = (max(1, int(crop.width * ratio)), max(1, int(crop.height * ratio)))
    portrait = crop.resize(new_size, Image.Resampling.LANCZOS)

    px = (CARD_SIZE - portrait.width) // 2
    py = CARD_SIZE - portrait.height - 6

    shadow = portrait.copy()
    shadow.putalpha(shadow.getchannel('A').point(lambda p: int(p * 0.30)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(3))
    bg.alpha_composite(shadow, (px + 2, py + 3))
    bg.alpha_composite(portrait, (px, py))

    # Top fade to suppress any remaining crop debris without calling attention to it.
    fade = Image.new('RGBA', (CARD_SIZE, CARD_SIZE), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fade)
    fade_height = 24
    for y in range(fade_height):
        alpha = int(145 * (1 - y / max(1, fade_height - 1)))
        fd.line((0, y, CARD_SIZE, y), fill=(24, 39, 64, alpha) if kind == 'player' else (20, 27, 39, alpha))
    bg.alpha_composite(fade)

    # Bottom soft vignette for a more premium bust-shot feel.
    bot = Image.new('RGBA', (CARD_SIZE, CARD_SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bot)
    for i, y in enumerate(range(CARD_SIZE - 28, CARD_SIZE)):
        a = int(44 * (i / 27))
        bd.line((0, y, CARD_SIZE, y), fill=(8, 12, 18, a))
    bg.alpha_composite(bot)

    # Rounded frame + border
    mask = rounded_mask()
    out = Image.new('RGBA', (CARD_SIZE, CARD_SIZE), (0, 0, 0, 0))
    out.alpha_composite(bg)
    out.putalpha(mask)
    draw = ImageDraw.Draw(out)
    draw.rounded_rectangle((1, 1, CARD_SIZE - 2, CARD_SIZE - 2), RADIUS, outline=(205, 219, 235, 220), width=2)
    return out


def process_folder(folder: Path, kind='player'):
    files = sorted(folder.glob('*.webp'))
    for path in files:
        card = build_card(path, kind=kind)
        card.save(path, 'WEBP', quality=94, method=6)
    return files


def make_preview(sample_paths):
    if not sample_paths:
        return
    thumbs = [Image.open(p).convert('RGBA').resize((96, 96), Image.Resampling.LANCZOS) for p in sample_paths]
    cols = 6
    rows = (len(thumbs) + cols - 1) // cols
    canvas = Image.new('RGBA', (cols * 112 + 16, rows * 112 + 16), (240, 244, 249, 255))
    for i, img in enumerate(thumbs):
        x = 16 + (i % cols) * 112
        y = 16 + (i // cols) * 112
        canvas.alpha_composite(img, (x, y))
    canvas.save(PREVIEW)


players = process_folder(PLAYERS, 'player')
coaches = process_folder(COACHES, 'coach')
# sample a spread across the library
sample = players[:6] + players[40:46] + players[100:106] + coaches[:6]
make_preview(sample)
print(f'processed {len(players)} player portraits and {len(coaches)} coach portraits')
print(PREVIEW)
