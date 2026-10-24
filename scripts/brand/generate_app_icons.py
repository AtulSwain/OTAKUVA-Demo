"""
OTAKUVA brand assets from the logo artwork (silver brush-stroke "O" on black).

Source:  scripts/brand/otakuva-logo-source.png   (1254x1254, black background)
Writes:
  public/brand/otakuva-mark.png        transparent mark for the header/footer (512 wide)
  public/brand/otakuva-mark@2x.png     same, 1024 wide
  public/app-icons/192.png, 512.png    PWA icons (mark on the site background)
  public/app-icons/maskable-512.png    PWA maskable icon (mark inside the safe zone)
  src/app/icon.png                     favicon (Next.js file convention)
  src/app/apple-icon.png               iOS home-screen icon

Usage: python scripts/brand/generate_app_icons.py   (needs Pillow)
Re-run after changing the logo source. (next/og icon routes crash the Windows
dev worker — keep these as static PNGs.)
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'scripts' / 'brand' / 'otakuva-logo-source.png'
BG = (9, 9, 13)  # --bg-primary

# Brightness below LOW is background; above HIGH is fully opaque stroke.
LOW, HIGH = 34, 150


def transparent_mark() -> Image.Image:
    """Silver strokes kept, black background removed (alpha from brightness),
    trimmed to the artwork with a little breathing room."""
    src = Image.open(SOURCE).convert('RGB')
    lum = src.convert('L')
    alpha = lum.point(lambda v: 0 if v <= LOW else 255 if v >= HIGH else round((v - LOW) * 255 / (HIGH - LOW)))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    mark = src.copy()
    mark.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()
    mark = mark.crop(bbox)
    pad = round(max(mark.size) * 0.04)
    canvas = Image.new('RGBA', (mark.width + pad * 2, mark.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(mark, (pad, pad), mark)
    return canvas


def fit(mark: Image.Image, width: int) -> Image.Image:
    h = round(mark.height * width / mark.width)
    return mark.resize((width, h), Image.LANCZOS)


def icon(mark: Image.Image, size: int, coverage: float) -> Image.Image:
    """Square icon: mark centred on the site background, `coverage` of the width."""
    img = Image.new('RGB', (size, size), BG)
    m = fit(mark, round(size * coverage))
    if m.height > size * coverage:
        m = m.resize((round(m.width * size * coverage / m.height), round(size * coverage)), Image.LANCZOS)
    img.paste(m, ((size - m.width) // 2, (size - m.height) // 2), m)
    return img


def main():
    mark = transparent_mark()
    brand = ROOT / 'public' / 'brand'
    brand.mkdir(parents=True, exist_ok=True)
    fit(mark, 512).save(brand / 'otakuva-mark.png', optimize=True)
    fit(mark, 1024).save(brand / 'otakuva-mark@2x.png', optimize=True)

    icons = ROOT / 'public' / 'app-icons'
    icons.mkdir(parents=True, exist_ok=True)
    icon(mark, 192, 0.74).save(icons / '192.png', optimize=True)
    icon(mark, 512, 0.74).save(icons / '512.png', optimize=True)
    # Maskable: launchers may crop to a circle — keep the art inside the
    # central 80% safe zone.
    icon(mark, 512, 0.56).save(icons / 'maskable-512.png', optimize=True)
    icon(mark, 64, 0.86).save(ROOT / 'src' / 'app' / 'icon.png', optimize=True)
    icon(mark, 180, 0.72).save(ROOT / 'src' / 'app' / 'apple-icon.png', optimize=True)
    print('Wrote brand mark and app icons from', SOURCE.relative_to(ROOT))


if __name__ == '__main__':
    main()
