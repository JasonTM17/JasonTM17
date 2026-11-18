# Pixel coding companions

A compact decorative strip for the personal README: a chibi boy with round glasses beside an orange Claude/Clawd-inspired mascot. The mascot is fan art and does not indicate affiliation.

- `coding-duo.gif`: eight frames, 360 × 210, 6.1-second loop; displayed at 300px in the README.
- `coding-duo.png`: static transparent first frame for reduced motion.

The boy follows the 3D portfolio avatar: short black hair with a fringe, thin round glasses, navy polo, khaki trousers, white sneakers and a watch. He blinks and waves while the mascot shuffles its legs, blinks and waves back with a small heart.

Everything is drawn on a 90 × 52 pixel grid by `python scripts/build-pixel-companions.py` (Pillow) and upscaled with nearest-neighbour sampling. The script keeps true PNG alpha, reserves a transparent GIF palette entry, and adds no service or network dependency.
