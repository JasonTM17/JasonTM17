"""Rebuild the profile's terminal artwork. Requires Pillow; no network calls."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from html import escape
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
COMMAND = 'git commit -m "keep learning"'
SCALE = 2
PALETTES = {
    "dark": {"bg": "#0d151c", "header": "#131e27", "line": "#2b3a45", "ink": "#ecf2f5", "muted": "#a5b5c1", "accent": "#80decb", "tag": "#182b32", "dot": "#526672"},
    "light": {"bg": "#f8faf9", "header": "#eef3f0", "line": "#ccd9d2", "ink": "#18302d", "muted": "#506963", "accent": "#146e60", "tag": "#e8f2ed", "dot": "#90a69c"},
}


def find_font(kind: str, override: str | None = None) -> Path:
    windir = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    candidates = {
        "regular": [windir / "segoeui.ttf", Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")],
        "bold": [windir / "seguisb.ttf", Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")],
        "mono": [windir / "consola.ttf", Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")],
    }[kind]
    for candidate in ([Path(override)] if override else candidates):
        if candidate.is_file():
            return candidate
    raise RuntimeError(f"No {kind} font found. Supply --{kind}-font.")


@dataclass
class Artwork:
    width: int
    height: int
    theme: str
    fonts: dict[str, Path]

    def __post_init__(self):
        self.colors = PALETTES[self.theme]
        self.image = Image.new("RGB", (self.width * SCALE, self.height * SCALE), self.colors["bg"])
        self.draw = ImageDraw.Draw(self.image)
        self.svg = []

    def rect(self, x, y, w, h, color, radius=0, stroke=None):
        box = (x * SCALE, y * SCALE, (x + w) * SCALE, (y + h) * SCALE)
        self.draw.rounded_rectangle(box, radius=radius * SCALE, fill=self.colors[color], outline=self.colors[stroke] if stroke else None, width=SCALE)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{self.colors[color]}"' + (f' stroke="{self.colors[stroke]}"' if stroke else "") + '/>')

    def circle(self, x, y, radius, color):
        self.draw.ellipse(((x-radius)*SCALE, (y-radius)*SCALE, (x+radius)*SCALE, (y+radius)*SCALE), fill=self.colors[color])
        self.svg.append(f'<circle cx="{x}" cy="{y}" r="{radius}" fill="{self.colors[color]}"/>')

    def text(self, x, y, value, size=20, color="ink", kind="regular", max_width=None):
        font = ImageFont.truetype(str(self.fonts[kind]), size * SCALE)
        bounds = self.draw.textbbox((x*SCALE, y*SCALE), value, font=font, anchor="ls")
        if max_width is not None and bounds[2] > (x + max_width) * SCALE:
            raise ValueError(f"Text exceeds its layout: {value!r}")
        self.draw.text((x*SCALE, y*SCALE), value, font=font, fill=self.colors[color], anchor="ls")
        family = "Consolas, DejaVu Sans Mono, monospace" if kind == "mono" else "Segoe UI, DejaVu Sans, sans-serif"
        weight = "600" if kind == "bold" else "400"
        self.svg.append(f'<text x="{x}" y="{y}" fill="{self.colors[color]}" font-family="{family}" font-size="{size}" font-weight="{weight}">{escape(value)}</text>')
        return self.draw.textlength(value, font=font) / SCALE

    def png(self):
        return self.image.resize((self.width, self.height), Image.Resampling.LANCZOS)

    def vector(self):
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.width} {self.height}" role="img" aria-labelledby="title desc">\n<title id="title">Nguyễn Tiến Sơn — Terminal Notes</title>\n<desc id="desc">Nguyễn Tiến Sơn. Learning software engineering by building. Exploring DevOps, one project at a time.</desc>\n' + "\n".join(self.svg) + "\n</svg>\n"


def compose(theme, mobile, fonts, command=COMMAND, cursor=False):
    w, h = (720, 740) if mobile else (1280, 460)
    a = Artwork(w, h, theme, fonts)
    a.rect(1, 1, w-2, h-2, "bg", 22, "line")
    a.rect(2, 2, w-4, 66, "header", 21)
    a.rect(2, 42, w-4, 26, "header")
    a.rect(1, 68, w-2, 1, "line")
    for x in (29, 49, 69):
        a.circle(x, 35, 5, "dot")
    a.text(99, 44 if mobile else 42, "nguyen-son / README", 28 if mobile else 20, "muted", "mono")
    if not mobile:
        a.text(1018, 42, "LEARNING IN PUBLIC", 15, "muted", "mono")
    x = 46 if mobile else 56
    a.text(x, 123, "~/nguyen-son", 28 if mobile else 21, "accent", "mono")
    a.text(x+(225 if mobile else 168), 123, "$ whoami", 28 if mobile else 21, "muted", "mono")
    a.text(x, 179, "HELLO, I'M", 28 if mobile else 22, "muted", "bold")
    if mobile:
        a.text(x, 258, "Nguyễn Tiến", 66, kind="bold", max_width=628)
        a.text(x, 337, "Sơn", 72, "ink", "bold", max_width=628)
        a.text(x, 398, "Learning software engineering by building.", 28, "muted", max_width=628)
        a.text(x, 435, "Exploring DevOps, one project at a time.", 28, "muted", max_width=628)
        tags = [(x, "SOFTWARE ENGINEERING", 360), (x+374, "DEVOPS", 160)]
        tag_y = 486
        rule_y = 573
        command_y = 622
        command_size = 28
        footer_y = 687
    else:
        end = a.text(x, 254, "Nguyễn Tiến", 66, kind="bold")
        a.text(x+end+21, 254, "Sơn", 66, "ink", "bold", max_width=1158-end-21)
        a.text(x, 305, "Learning software engineering by building. Exploring DevOps, one project at a time.", 24, "muted", max_width=1168)
        tags = [(x, "SOFTWARE ENGINEERING", 270), (x+284, "DEVOPS", 111)]
        tag_y = 333
        rule_y = 398
        command_y = 434
        command_size = 20
        footer_y = None
    for tx, label, width in tags:
        a.rect(tx, tag_y, width, 48 if mobile else 36, "tag", 7)
        a.text(tx+14, tag_y+(33 if mobile else 24), label, 28 if mobile else 18, "accent", "mono")
    if mobile:
        a.text(x, 563, "WEB / MOBILE / AI / PLATFORM", 28, "muted", "mono")
    else:
        a.text(795, tag_y+24, "WEB / MOBILE / AI / PLATFORM", 18, "muted", "mono", max_width=428)
    a.rect(x, rule_y, w-2*x, 1, "line")
    a.text(x, command_y, "$", command_size, "accent", "mono")
    command_width = a.text(x+28, command_y, command, command_size, "muted", "mono", max_width=w-2*x-32)
    if cursor:
        a.rect(round(x+30+command_width), command_y-command_size+3, 9, command_size+1, "accent", 1)
    if mobile:
        a.text(x, footer_y, "JASONTM17  ·  GITHUB", 28, "muted", "mono")
    else:
        a.text(1007, command_y, "JASONTM17 · GITHUB", 16, "muted", "mono")
    return a


def build(theme, mobile, fonts):
    name = f"nguyen-son-terminal-{theme}" + ("-mobile" if mobile else "")
    static = compose(theme, mobile, fonts)
    (ASSETS / f"{name}.svg").write_text(static.vector(), encoding="utf-8", newline="\n")
    # Only the command changes; all identity and headline text is visible from frame one.
    frames, durations = [], []
    states = [("", True, 450)]
    states += [(COMMAND[:n], True, 90) for n in range(1, len(COMMAND)+1)]
    states += [(COMMAND, cursor, 650) for cursor in (False, True, False, True)]
    states += [(COMMAND, False, 2600)]
    reference = static.png().quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    for text, cursor, duration in states:
        frame = compose(theme, mobile, fonts, text, cursor).png()
        frames.append(frame.quantize(palette=reference, dither=Image.Dither.NONE))
        durations.append(duration)
    gif_path = ASSETS / f"{name}.gif"
    frames[0].save(gif_path, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=True, disposal=1)
    assert gif_path.stat().st_size < 650_000, "Banner is larger than its byte budget."
    print(f"Generated {name}: {gif_path.stat().st_size:,} bytes, {sum(durations)/1000:.2f}s loop")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for kind in ("regular", "bold", "mono"):
        parser.add_argument(f"--{kind}-font")
    args = parser.parse_args()
    fonts = {kind: find_font(kind, getattr(args, f"{kind}_font")) for kind in ("regular", "bold", "mono")}
    ASSETS.mkdir(exist_ok=True)
    for theme in PALETTES:
        for mobile in (False, True):
            build(theme, mobile, fonts)


if __name__ == "__main__":
    main()
