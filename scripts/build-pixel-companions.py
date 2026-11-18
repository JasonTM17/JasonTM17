"""Draw the README pixel scene: a chibi boy coding at a desk while the orange Claude mascot cheers.

Everything is drawn pixel by pixel on a 90 x 52 grid and upscaled with
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
DURATIONS = [1100, 300, 300, 350, 500, 500, 300, 1100]

INK = "#1a2233"
HAIR, HAIR_HI = "#232a3a", "#3d4760"
SKIN, SKIN_SHADE = "#f6cfa6", "#e5ab82"
LENS, LENS_HI = "#cfe8f7", "#ffffff"
BLUSH, MOUTH, TONGUE = "#f2a28f", "#8c3d33", "#c75b52"
NAVY, NAVY_SHADE, COLLAR = "#2a3b78", "#1f2d5e", "#e9eef7"
KHAKI, KHAKI_SHADE = "#cdb592", "#b49d78"
SHOE, SHOE_SHADE = "#f6f6f2", "#d3d3cc"
CHAIR, CHAIR_HI = "#4f6177", "#62768f"
LID, LID_HI, LID_BASE, LOGO = "#2b3550", "#3d4a70", "#202943", "#5eead4"
WOOD, WOOD_SHADE, WOOD_LEG = "#d4b48a", "#a98863", "#8a6f52"
MUG, COFFEE, STEAM = "#f1ece4", "#8a5a44", "#9fb2c4"
POT, LEAF, LEAF_DARK = "#e7dccb", "#4db89a", "#2f8f77"
ORANGE, ORANGE_SHADE, ORANGE_HI, MASCOT_EYE = "#d97757", "#bf6144", "#e58a6a", "#16100e"
HEART, SPARK = "#f06292", "#ffd166"


def color_rgba(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


class Layer:
    """A transparent pixel layer with an automatic 1px outline."""

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
        return self.image


def draw_head(layer, eyes, mouth):
    # Rounded head block with cut corners.
    for y in range(11, 30):
        inset = 3 if y in (11, 29) else 2 if y in (12, 28) else 1 if y in (13, 27) else 0
        layer.rect(19 + inset, y, 41 - inset, y, SKIN)
    layer.rect(17, 20, 18, 22, SKIN)
    layer.rect(42, 20, 43, 22, SKIN)
    layer.rect(17, 22, 18, 22, SKIN_SHADE)
    layer.rect(42, 22, 43, 22, SKIN_SHADE)
    layer.rect(21, 28, 39, 29, SKIN_SHADE)
    # Short black hair with a fringe and sideburns.
    layer.rect(24, 9, 36, 9, HAIR)
    layer.rect(21, 10, 39, 10, HAIR)
    layer.rect(19, 11, 41, 14, HAIR)
    layer.rect(24, 10, 28, 10, HAIR_HI)
    layer.rect(21, 12, 24, 12, HAIR_HI)
    for x0, x1 in ((19, 24), (27, 32), (36, 41)):
        layer.rect(x0, 15, x1, 15, HAIR)
    for x0, x1 in ((19, 22), (28, 30), (38, 41)):
        layer.rect(x0, 16, x1, 16, HAIR)
    layer.rect(19, 17, 20, 19, HAIR)
    layer.rect(40, 17, 41, 19, HAIR)
    # Thin round glasses.
    for left in (22, 33):
        layer.rect(left, 19, left + 5, 23, INK)
        layer.rect(left + 1, 20, left + 4, 22, LENS)
        for corner in ((left, 19), (left + 5, 19), (left, 23), (left + 5, 23)):
            layer.px(*corner, SKIN)
        layer.px(left + 1, 20, LENS_HI)
        if eyes == "open":
            layer.rect(left + 2, 21, left + 3, 22, INK)
        elif eyes == "look":   # glances toward the mascot
            layer.rect(left + 3, 21, left + 4, 22, INK)
        else:                  # blink
            layer.rect(left + 2, 22, left + 3, 22, INK)
    layer.rect(28, 20, 32, 20, INK)
    layer.rect(21, 25, 22, 25, BLUSH)
    layer.rect(38, 25, 39, 25, BLUSH)
    if mouth == "smile":
        layer.px(28, 25, MOUTH)
        layer.rect(29, 26, 31, 26, MOUTH)
        layer.px(32, 25, MOUTH)
    else:
        layer.rect(28, 25, 32, 26, MOUTH)
        layer.rect(29, 27, 31, 27, TONGUE)


def chair_layer():
    layer = Layer()
    layer.rect(18, 29, 42, 41, CHAIR)
    layer.rect(18, 29, 19, 41, CHAIR_HI)
    return layer.outline()


def legs_layer(tap):
    layer = Layer()
    layer.rect(25, 43, 28, 45, KHAKI)
    layer.rect(24, 46, 29, 48, SHOE)
    layer.rect(24, 48, 29, 48, SHOE_SHADE)
    lift = 1 if tap else 0
    layer.rect(34, 43, 37, 45 - lift, KHAKI)
    layer.rect(33, 46 - lift, 38, 48 - lift, SHOE)
    layer.rect(33, 48 - lift, 38, 48 - lift, SHOE_SHADE)
    return layer.outline()


def boy_layer(eyes, mouth, phase):
    layer = Layer()
    draw_head(layer, eyes, mouth)
    layer.rect(25, 30, 35, 31, NAVY)
    layer.rect(27, 30, 33, 30, COLLAR)
    layer.rect(29, 31, 31, 31, SKIN)
    layer.rect(24, 30, 24, 33, INK)
    layer.rect(36, 30, 36, 33, INK)
    layer.rect(21, 30, 23, 33, NAVY)
    layer.rect(37, 30, 39, 33, NAVY)
    # Hands tap the keys in turn: one hovers, the other presses.
    left_drop, right_drop = (1, 0) if phase == 0 else (0, 1)
    layer.rect(21, 34, 23, 35 + left_drop, SKIN)
    layer.rect(21, 36 + left_drop, 23, 37 + left_drop, SKIN)
    layer.rect(37, 34, 39, 35 + right_drop, SKIN)
    layer.rect(37, 36 + right_drop, 39, 37 + right_drop, SKIN)
    layer.rect(37, 34, 39, 34, INK)            # watch on the wrist
    return layer.outline()


def desk_layer(steam):
    layer = Layer()
    # Desktop and legs.
    layer.rect(9, 40, 52, 41, WOOD)
    layer.rect(9, 42, 52, 42, WOOD_SHADE)
    layer.rect(11, 43, 13, 48, WOOD_LEG)
    layer.rect(48, 43, 50, 48, WOOD_LEG)
    # Laptop seen from behind, with a glowing mint logo.
    layer.rect(23, 32, 37, 38, LID)
    layer.rect(23, 32, 37, 32, LID_HI)
    layer.rect(29, 35, 31, 36, LOGO)
    layer.rect(21, 39, 39, 39, LID_BASE)
    # Coffee mug with steam.
    layer.rect(14, 36, 17, 39, MUG)
    layer.rect(14, 36, 17, 36, COFFEE)
    layer.px(18, 37, MUG)
    layer.px(18, 38, MUG)
    if steam:
        layer.px(15, 34, STEAM)
        layer.px(16, 33, STEAM)
    else:
        layer.px(16, 34, STEAM)
        layer.px(15, 33, STEAM)
    # Tiny succulent.
    layer.rect(43, 37, 47, 39, POT)
    layer.rect(42, 34, 48, 36, LEAF)
    layer.rect(43, 32, 47, 33, LEAF)
    layer.rect(44, 31, 46, 31, LEAF_DARK)
    layer.rect(42, 36, 48, 36, LEAF_DARK)
    return layer.outline()


def mascot_layer(arms="low", hop=False, eyes="open"):
    layer = Layer()
    dy = -1 if hop else 0
    layer.rect(58, 34 + dy, 79, 45 + dy, ORANGE)
    layer.rect(58, 45 + dy, 79, 45 + dy, ORANGE_SHADE)
    layer.rect(58, 34 + dy, 79, 34 + dy, ORANGE_HI)
    if eyes == "open":
        layer.rect(63, 37 + dy, 64, 41 + dy, MASCOT_EYE)
        layer.rect(73, 37 + dy, 74, 41 + dy, MASCOT_EYE)
    else:
        layer.rect(63, 39 + dy, 64, 39 + dy, MASCOT_EYE)
        layer.rect(73, 39 + dy, 74, 39 + dy, MASCOT_EYE)
    left_up = arms in ("left", "both")
    right_up = arms in ("right", "both")
    layer.rect(55, 30 + dy, 57, 36 + dy, ORANGE) if left_up else layer.rect(55, 39 + dy, 57, 42 + dy, ORANGE)
    layer.rect(80, 30 + dy, 82, 36 + dy, ORANGE) if right_up else layer.rect(80, 39 + dy, 82, 42 + dy, ORANGE)
    for index, left in enumerate((60, 65, 70, 75)):
        layer.rect(left, 46 + dy, left + 2, 48 + dy, ORANGE_SHADE if index % 2 else ORANGE)
    return layer.outline()


def effect_layer(heart=False, sparkle=0):
    layer = Layer()
    if heart:
        for y, row in enumerate((".X.X.", "XXXXX", ".XXX.", "..X..")):
            for x, cell in enumerate(row):
                if cell == "X":
                    layer.px(65 + x, 24 + y, HEART)
    if sparkle:
        left, top = (54, 25) if sparkle == 1 else (80, 25)
        for dx, dy in ((1, 0), (0, 1), (1, 1), (2, 1), (1, 2)):
            layer.px(left + dx, top + dy, SPARK)
    return layer.image


def compose(boy, scene, mascot, effects):
    image = Image.new("RGBA", GRID)
    for layer in (chair_layer(), legs_layer(scene["tap"]), boy_layer(**boy),
                  desk_layer(scene["steam"]), mascot_layer(**mascot), effect_layer(**effects)):
        image.alpha_composite(layer)
    sized = image.resize((GRID[0] * SCALE, GRID[1] * SCALE), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (360, 210))
    canvas.alpha_composite(sized, dest=(0, 210 - sized.height - 1))
    return canvas


def storyboard():
    typing = dict(eyes="open", mouth="smile")
    return [
        compose(dict(typing, phase=0), dict(tap=False, steam=False), dict(arms="low"), {}),
        compose(dict(typing, phase=1), dict(tap=True, steam=True), dict(arms="left"), {}),
        compose(dict(eyes="blink", mouth="smile", phase=0), dict(tap=False, steam=False), dict(arms="both", hop=True), dict(sparkle=1)),
        compose(dict(typing, phase=1), dict(tap=False, steam=True), dict(arms="right"), {}),
        compose(dict(eyes="look", mouth="smile", phase=0), dict(tap=True, steam=False), dict(arms="both", hop=True), dict(heart=True, sparkle=2)),
        compose(dict(eyes="open", mouth="open", phase=1), dict(tap=False, steam=True), dict(arms="left", eyes="blink"), dict(heart=True)),
        compose(dict(typing, phase=0), dict(tap=False, steam=False), dict(arms="low"), {}),
        compose(dict(typing, phase=0), dict(tap=False, steam=False), dict(arms="low"), {}),
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
    print(f"Built transparent pixel scene: {frames[0].width}x{frames[0].height}, {sum(DURATIONS)/1000:.2f}s, {target.stat().st_size:,} bytes.")


if __name__ == "__main__":
    main()
