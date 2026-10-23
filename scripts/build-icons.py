"""Render the code-native Design Shelf mark. Requires Pillow (development only)."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "extension" / "icons"
ROOT.mkdir(exist_ok=True)
# Stacked reference cards: collection, image and context. No text at toolbar sizes.
SHAPES = [
    ("rect", (4, 4, 124, 124), 29, "#24483c"),
    ("rect", (38, 25, 104, 84), 8, "#dca17e"),
    ("rect", (30, 35, 100, 94), 8, "#a5b5a0"),
    ("rect", (22, 45, 96, 104), 8, "#f7f2e8"),
    ("rect", (32, 56, 56, 92), 4, "#24483c"),
    ("rect", (64, 59, 85, 64), 2.5, "#24483c"),
    ("rect", (64, 70, 80, 75), 2.5, "#92a38e"),
    ("rect", (64, 81, 85, 86), 2.5, "#92a38e"),
]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Design Shelf reference cards">']
canvas = Image.new("RGBA", (1024, 1024))
draw = ImageDraw.Draw(canvas)
for _, (x1,y1,x2,y2), radius, color in SHAPES:
    svg.append(f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" rx="{radius}" fill="{color}"/>')
    draw.rounded_rectangle((x1*8,y1*8,x2*8,y2*8),radius=radius*8,fill=color)
svg.append('</svg>')
(ROOT / "shelf.svg").write_text("\n".join(svg)+"\n",encoding="utf-8")
for size in (16,32,48,128):
    canvas.resize((size,size),Image.Resampling.LANCZOS).save(ROOT/f"icon-{size}.png",optimize=True)
print("Built SVG source and 16/32/48/128px extension icons.")
