"""Encode the imagegen sprite sheet as a small transparent README animation.

The artwork stays in source-sheet.png. This script only extracts, aligns,
scales and encodes the supplied frames; it does not paint or redesign them.
Requires Pillow, like build-terminal-banner.py.
"""

from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "assets/pixel-companions"
SIZE = (360, 210)
DURATIONS = [1600, 340, 160, 1200, 500, 650, 250, 1400]


def frames_from_sheet(sheet):
    cells, bounds = [], []
    for row in range(2):
        for column in range(4):
            # Generated canvases need not have dimensions divisible by the grid.
            cell = sheet.crop((round(column*sheet.width/4), round(row*sheet.height/2),
                               round((column+1)*sheet.width/4), round((row+1)*sheet.height/2)))
            bbox = cell.getchannel("A").point(lambda a: 255 if a >= 128 else 0).getbbox()
            if bbox is None:
                raise ValueError("An animation cell is empty.")
            cells.append(cell)
            bounds.append(bbox)
    # Anchor the stationary furniture's left edge and floor, rather than a
    # changing hand/eye position. Shared geometry prevents center-based jitter.
    width = max(box[2]-box[0] for box in bounds) + 8
    height = max(box[3]-box[1] for box in bounds) + 8
    scale = min((SIZE[0]-48)/width, (SIZE[1]-20)/height)
    tile_size = (round(width*scale), round(height*scale))
    output = []
    for cell, box in zip(cells, bounds):
        aligned = Image.new("RGBA", (width, height))
        aligned.alpha_composite(cell, dest=(4-box[0], height-4-box[3]))
        scaled = aligned.resize(tile_size, Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", SIZE)
        canvas.alpha_composite(scaled, dest=((SIZE[0]-tile_size[0])//2, (SIZE[1]-tile_size[1])//2))
        output.append(canvas)
    return output


def main():
    sheet = Image.open(DIRECTORY / "source-sheet.png").convert("RGBA")
    if sheet.getchannel("A").getextrema()[0] != 0:
        raise ValueError("Source sheet must retain its transparent background.")
    frames = frames_from_sheet(sheet)
    frames[0].save(DIRECTORY / "coding-duo.png", optimize=True)
    atlas = Image.new("RGB", (SIZE[0]*len(frames), SIZE[1]))
    for index, frame in enumerate(frames):
        atlas.paste(frame.convert("RGB"), (index*SIZE[0], 0))
    reference = atlas.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = reference.getpalette()[:765] + [0, 0, 0]
    encoded = []
    for frame in frames:
        indexed = frame.convert("RGB").quantize(palette=reference, dither=Image.Dither.NONE)
        indexed.putpalette(palette)
        # GIF has binary transparency. Reserve index 255 without changing the
        # PNG's original alpha; never matte the sprite onto a theme color.
        indexed.paste(255, mask=frame.getchannel("A").point(lambda a: 255 if a < 128 else 0))
        encoded.append(indexed)
    target = DIRECTORY / "coding-duo.gif"
    encoded[0].save(target, save_all=True, append_images=encoded[1:], duration=DURATIONS,
                    loop=0, transparency=255, background=255, disposal=2, optimize=False)
    assert target.stat().st_size < 200_000, "Animation exceeded its compact strip budget."
    assert any(ImageChops.difference(frames[0], frame).getbbox() for frame in frames[1:])
    print(f"Built transparent pixel duo: {SIZE[0]}×{SIZE[1]}, {sum(DURATIONS)/1000:.2f}s, {target.stat().st_size:,} bytes.")


if __name__ == "__main__":
    main()
