"""Draw the README pixel duo: a chibi boy with glasses beside the orange Claude mascot.

The sprites are drawn pixel by pixel on a 90 x 52 grid and upscaled with
nearest-neighbour sampling, so no image service or source sheet is needed.
The boy follows the 3D portfolio avatar: short black hair with a fringe, thin
round glasses, navy polo, khaki trousers, white sneakers and a watch.
Requires Pillow, like build-terminal-banner.py.
"""

from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "assets/pixel-companions"
GRID = (90, 52)
SCALE = 4
DURATIONS = [1600, 340, 160, 1200, 500, 650, 250, 1400]

INK = "#1a2233"
HAIR, HAIR_HI = "#232a3a", "#3d4760"
SKIN, SKIN_SHADE = "#f6cfa6", "#e5ab82"
LENS, LENS_HI = "#cfe8f7", "#ffffff"
BLUSH, MOUTH, TONGUE = "#f2a28f", "#8c3d33", "#c75b52"
NAVY, NAVY_SHADE, COLLAR = "#2a3b78", "#1f2d5e", "#e9eef7"
KHAKI, KHAKI_SHADE = "#cdb592", "#b49d78"
SHOE, SHOE_SHADE = "#f6f6f2", "#d3d3cc"
ORANGE, ORANGE_SHADE, MASCOT_EYE = "#d97757", "#bf6144", "#16100e"
HEART = "#f06292"


class Layer:
    """A transparent pixel layer with automatic 1px outline."""

    def __init__(self):
        self.image = Image.new("RGBA", GRID)

    def px(self, x, y, color):
        if 0 <= x < GRID[0] and 0 <= y < GRID[1]:
            self.image.putpixel((x, y), color_rgba(color))

    def rect(self, x0, y0, x1, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, color)

    def outline(self, color=INK):
        source = self.image.copy()
        width, height = source.size
        for y in range(height):
            for x in range(width):
                if source.getpixel((x, y))[3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and source.getpixel((nx, ny))[3]:
                        self.px(x, y, color)
                        break


def color_rgba(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def boy(eyes="open", arm="down", mouth="smile"):
    layer = Layer()
    # Head: rounded block with cut corners.
    for y in range(11, 30):
        inset = 3 if y in (11, 29) else 2 if y in (12, 28) else 1 if y in (13, 27) else 0
        layer.rect(19 + inset, y, 41 - inset, y, SKIN)
    layer.rect(17, 20, 18, 22, SKIN)           # ears
    layer.rect(42, 20, 43, 22, SKIN)
    layer.rect(17, 22, 18, 22, SKIN_SHADE)
    layer.rect(42, 22, 43, 22, SKIN_SHADE)
    layer.rect(21, 28, 39, 29, SKIN_SHADE)     # soft chin shade
    # Hair: cap, fringe, sideburns.
    layer.rect(24, 9, 36, 9, HAIR)
    layer.rect(21, 10, 39, 10, HAIR)
    layer.rect(19, 11, 41, 14, HAIR)
    layer.rect(24, 10, 28, 10, HAIR_HI)
    layer.rect(21, 12, 24, 12, HAIR_HI)
    layer.rect(19, 15, 24, 15, HAIR)
    layer.rect(27, 15, 32, 15, HAIR)
    layer.rect(36, 15, 41, 15, HAIR)
    layer.rect(19, 16, 22, 16, HAIR)
    layer.rect(28, 16, 30, 16, HAIR)
    layer.rect(38, 16, 41, 16, HAIR)
    layer.rect(19, 17, 20, 19, HAIR)
    layer.rect(40, 17, 41, 19, HAIR)
    # Round thin glasses.
    for left in (22, 33):
        layer.rect(left, 19, left + 5, 23, INK)
        layer.rect(left + 1, 20, left + 4, 22, LENS)
        layer.px(left, 19, SKIN)
        layer.px(left + 5, 19, SKIN)
        layer.px(left, 23, SKIN)
        layer.px(left + 5, 23, SKIN)
        layer.px(left + 1, 20, LENS_HI)
        if eyes == "open":
            layer.rect(left + 2, 21, left + 3, 22, INK)
        elif eyes == "blink":
            layer.rect(left + 2, 22, left + 3, 22, INK)
        else:  # happy arcs
            layer.px(left + 1, 22, INK)
            layer.rect(left + 2, 21, left + 3, 21, INK)
            layer.px(left + 4, 22, INK)
    layer.rect(28, 20, 32, 20, INK)            # bridge
    layer.rect(21, 25, 22, 25, BLUSH)
    layer.rect(38, 25, 39, 25, BLUSH)
    if mouth == "smile":
        layer.px(28, 25, MOUTH)
        layer.rect(29, 26, 31, 26, MOUTH)
        layer.px(32, 25, MOUTH)
    else:
        layer.rect(28, 25, 32, 26, MOUTH)
        layer.rect(29, 27, 31, 27, TONGUE)
        layer.rect(29, 27, 31, 27, TONGUE)
    # Torso: navy polo with collar.
    layer.rect(25, 30, 35, 40, NAVY)
    layer.rect(25, 40, 35, 40, NAVY_SHADE)
    layer.rect(27, 30, 33, 30, COLLAR)
    layer.rect(29, 31, 31, 31, SKIN)
    layer.px(30, 33, NAVY_SHADE)
    layer.px(30, 35, NAVY_SHADE)
    layer.rect(24, 31, 24, 39, INK)
    layer.rect(36, 31, 36, 39, INK)
    # Left side of the picture: relaxed arm.
    layer.rect(21, 31, 23, 34, NAVY)
    layer.rect(21, 35, 23, 38, SKIN)
    layer.rect(22, 39, 23, 39, SKIN_SHADE)
    # Right side: watch arm, down or waving.
    if arm == "down":
        layer.rect(37, 31, 39, 34, NAVY)
        layer.rect(37, 35, 39, 38, SKIN)
        layer.rect(37, 36, 39, 36, INK)      # watch
        layer.rect(37, 39, 38, 39, SKIN_SHADE)
    else:
        shift = 0 if arm == "waveA" else 1
        layer.rect(37, 30, 39, 33, NAVY)                     # shoulder
        layer.rect(40, 29, 45, 31, NAVY)                     # elbow lifts the forearm clear of the head
        layer.rect(45 + shift, 27, 46 + shift, 30, SKIN)
        layer.rect(45 + shift, 29, 46 + shift, 29, INK)      # watch on the raised wrist
        layer.rect(44 + shift, 23, 47 + shift, 26, SKIN)
        layer.px(44 + shift, 23, SKIN_SHADE)
        layer.px(47 + shift, 23, SKIN_SHADE)
    # Khaki trousers and white sneakers.
    layer.rect(25, 41, 35, 46, KHAKI)
    layer.rect(31, 41, 35, 46, KHAKI_SHADE)
    layer.rect(30, 44, 30, 46, INK)
    layer.rect(24, 47, 29, 48, SHOE)
    layer.rect(31, 47, 36, 48, SHOE)
    layer.rect(24, 48, 29, 48, SHOE_SHADE)
    layer.rect(31, 48, 36, 48, SHOE_SHADE)
    layer.outline()
    return layer.image


def mascot(legs=0, eyes="open", raised=False):
    layer = Layer()
    layer.rect(50, 33, 76, 45, ORANGE)
    layer.rect(50, 45, 76, 45, ORANGE_SHADE)
    layer.rect(50, 33, 76, 33, "#e58a6a")       # soft top highlight
    layer.rect(47, 38, 49, 41, ORANGE)         # little arms
    if raised:                                 # right arm waves hello
        layer.rect(77, 32, 79, 36, ORANGE)
    else:
        layer.rect(77, 38, 79, 41, ORANGE)
    if eyes == "open":
        layer.rect(57, 36, 58, 40, MASCOT_EYE)
        layer.rect(68, 36, 69, 40, MASCOT_EYE)
    else:
        layer.rect(57, 38, 58, 38, MASCOT_EYE)
        layer.rect(68, 38, 69, 38, MASCOT_EYE)
    lift = [1, 0, 1, 0] if legs == 1 else [0, 0, 0, 0]
    for index, left in enumerate((52, 58, 66, 72)):
        top = 46 - lift[index]
        layer.rect(left, top, left + 2, 48 - lift[index], ORANGE_SHADE if index % 2 else ORANGE)
    layer.outline()
    return layer.image


def heart():
    layer = Layer()
    for y, row in enumerate((".X.X.", "XXXXX", ".XXX.", "..X..")):
        for x, cell in enumerate(row):
            if cell == "X":
                layer.px(62 + x, 25 + y, HEART)
    return layer.image


def compose(boy_args, mascot_args, with_heart=False):
    scene = Image.new("RGBA", GRID)
    scene.alpha_composite(boy(**boy_args))
    scene.alpha_composite(mascot(**mascot_args))
    if with_heart:
        scene.alpha_composite(heart())
    sized = scene.resize((GRID[0] * SCALE, GRID[1] * SCALE), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (360, 210))
    canvas.alpha_composite(sized, dest=(0, 210 - sized.height - 1))
    return canvas


def storyboard():
    rest = dict(eyes="open", arm="down", mouth="smile")
    return [
        compose(rest, dict()),
        compose(rest, dict(legs=1)),
        compose(dict(rest, eyes="blink"), dict()),
        compose(rest, dict()),
        compose(dict(eyes="open", arm="waveA", mouth="open"), dict(eyes="blink"), True),
        compose(dict(eyes="open", arm="waveB", mouth="open"), dict(raised=True), True),
        compose(rest, dict()),
        compose(rest, dict()),
    ]


def main():
    frames = storyboard()
    frames[0].save(DIRECTORY / "coding-duo.png", optimize=True)
    atlas = Image.new("RGB", (frames[0].width * len(frames), frames[0].height))
    for index, frame in enumerate(frames):
        atlas.paste(frame.convert("RGB"), (index * frame.width, 0))
    reference = atlas.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = reference.getpalette()[:765] + [0, 0, 0]
    encoded = []
    for frame in frames:
        indexed = frame.convert("RGB").quantize(palette=reference, dither=Image.Dither.NONE)
        indexed.putpalette(palette)
        # GIF has binary transparency; reserve index 255 and keep sprite colors unmatted.
        indexed.paste(255, mask=frame.getchannel("A").point(lambda a: 255 if a < 128 else 0))
        encoded.append(indexed)
    target = DIRECTORY / "coding-duo.gif"
    encoded[0].save(target, save_all=True, append_images=encoded[1:], duration=DURATIONS,
                    loop=0, transparency=255, background=255, disposal=2, optimize=False)
    assert target.stat().st_size < 200_000, "Animation exceeded its compact strip budget."
    assert any(ImageChops.difference(frames[0], frame).getbbox() for frame in frames[1:])
    print(f"Built transparent pixel duo: {frames[0].width}x{frames[0].height}, {sum(DURATIONS)/1000:.2f}s, {target.stat().st_size:,} bytes.")


if __name__ == "__main__":
    main()
