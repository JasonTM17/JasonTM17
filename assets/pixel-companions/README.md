# Pixel coding companions

A compact decorative strip for the personal README: a chibi boy with round glasses coding at a desk while an orange Claude/Clawd-inspired mascot cheers beside him. The mascot is fan art and does not indicate affiliation.

- `coding-duo.gif`: eight frames, 360 × 210, 4.5-second loop; displayed at 300px in the README.
- `coding-duo.png`: static transparent first frame for reduced motion.

The boy follows the 3D portfolio avatar: short black hair with a fringe, thin round glasses, navy polo, khaki trousers, white sneakers and a watch. He types on a laptop beside a coffee mug and a small succulent, blinks, and glances at the mascot. The mascot raises its arms, hops, and gets a small heart and sparkles.

Everything is drawn on a 90 × 52 pixel grid by `python scripts/build-pixel-companions.py` (Pillow) and upscaled with nearest-neighbour sampling. The script keeps true PNG alpha, reserves a transparent GIF palette entry, and adds no service or network dependency.
