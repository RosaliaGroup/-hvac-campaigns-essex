#!/usr/bin/env python3
"""
Render Mechanical Enterprise Instagram Reels (1080x1920, 30 fps, H.264 + silent AAC).

Layout: a real equipment photo (slow zoom, cross-fading between photos) fills
the top of the frame; below it a hook, 3-4 points that slide in one by one,
and a call to action. Each photo carries a small on-screen credit.

Photos live in scripts/reel-photos/ with their licences in CREDITS.json
(CC BY / CC0 photos of real equipment, no people). They are stock photos,
not Mechanical Enterprise jobs — captions must never say otherwise. Swap in
the crew's own job photos by adding them to reel-photos/ + CREDITS.json
(license "own") and listing them in a reel's "photos".

Copy rules (owner, Nov 2026): no rebates/incentives, no 24/7 or same-day,
no prices, no phone numbers in the video, no licensed/EPA claims.
Output: client/public/reels/<slug>.mp4 (+ <slug>.jpg cover), served at
https://mechanicalenterprise.com/reels/<slug>.mp4.

Usage:  python3 scripts/make-reels.py            # all reels
        python3 scripts/make-reels.py quote-checklist
Requires Pillow, ffmpeg and the Inter font.
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
PHOTO_H = 1000  # photo band height (top of frame)
NAVY_TOP, NAVY_BOT = (22, 44, 74), (12, 27, 46)
ORANGE = (255, 107, 53)
WHITE = (255, 255, 255)
MUTED = (190, 207, 228)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "client", "public", "reels")
PHOTO_DIR = os.path.join(HERE, "reel-photos")
CREDITS = json.load(open(os.path.join(PHOTO_DIR, "CREDITS.json")))

FONT_DIRS = ["/usr/share/fonts", "/usr/local/share/fonts", os.path.expanduser("~/.fonts")]


def find_font(*names):
    for d in FONT_DIRS:
        for root, _, files in os.walk(d):
            for n in names:
                if n in files:
                    return os.path.join(root, n)
    raise SystemExit(f"font not found: {names}")


F_BLACK = find_font("Inter-Black.otf", "Inter-ExtraBold.otf", "Inter-Black.ttf")
F_BOLD = find_font("Inter-Bold.otf", "Inter-Bold.ttf")
F_MED = find_font("Inter-Medium.otf", "Inter-Medium.ttf")

REELS = [
    {
        "slug": "quote-checklist",
        "photos": ["air-handler-attic", "condensers", "furnace-basement"],
        "hook": ["What your HVAC", "quote should include"],
        "points": [
            "A sizing calculation for your home",
            "The exact equipment model",
            "Ductwork & line set work spelled out",
            "Warranty terms in writing",
        ],
        "cta": "Compare quotes the right way",
    },
    {
        "slug": "signs-to-replace",
        "photos": ["oil-furnace", "furnace-basement", "condensers"],
        "hook": ["3 signs your system", "is ready to retire"],
        "points": [
            "It's 15+ years old",
            "Repairs keep adding up",
            "Some rooms never feel right",
        ],
        "cta": "Replace it before it quits",
    },
    {
        "slug": "premium-honestly-priced",
        "photos": ["air-handler-attic", "heat-pump-outdoor", "condensers"],
        "hook": ["Premium HVAC,", "honestly priced"],
        "points": [
            "Right-sized for your home",
            "Clean, careful installation",
            "Optional 10-year parts & labor coverage",
        ],
        "cta": "Done right the first time",
    },
    {
        "slug": "window-units",
        "photos": ["rowhouse-window-ac", "heat-pump-outdoor"],
        "hook": ["Still running", "window units?"],
        "points": [
            "One system for heating and cooling",
            "Quiet, ductless mini-splits",
            "No more hauling units every season",
        ],
        "cta": "See what fits your home",
    },
    {
        "slug": "oil-to-heat-pump",
        "photos": ["oil-furnace", "home-oil-furnace", "heat-pump-outdoor"],
        "hook": ["Heating with oil?"],
        "points": [
            "A heat pump heats and cools",
            "No more oil deliveries",
            "We size it to your home",
        ],
        "cta": "Get a plan for your home",
    },
    {
        "slug": "done-right",
        "photos": ["air-handler-attic", "furnace-basement"],
        "hook": ["A low quote usually", "means a smaller job"],
        "points": [
            "Undersized equipment",
            "Old ductwork left as-is",
            "Shortcuts you can't see",
        ],
        "cta": "Premium work, fair price",
    },
]

# ── timing (seconds) ────────────────────────────────────────────────────────
HOOK_WORD_GAP = 0.35
HOOK_HOLD = 1.4
POINT_GAP = 1.6
CTA_HOLD = 3.4
XFADE = 0.6


def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def background():
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        k = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(int(NAVY_TOP[i] * (1 - k) + NAVY_BOT[i] * k) for i in range(3)))
    return bg


def cover(im, w, h):
    """Scale + center-crop to exactly w x h."""
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def credit_text(name):
    c = CREDITS[name]
    if c["license"] == "own":
        return ""
    who = c.get("creator") or "unknown"
    return f"Photo: {who} · {c['license']}" if c["license"] != "CC0" else f"Photo: {who} · public domain"


class PhotoBand:
    """Pre-sized photos with a slow zoom (Ken Burns) and cross-fades."""

    def __init__(self, names, total):
        self.names = names
        self.total = total
        self.seg = total / len(names)
        # pre-scale 15% larger than the band so the zoom never shows edges
        self.base = [cover(Image.open(os.path.join(PHOTO_DIR, f"{n}.jpg")).convert("RGB"), int(W * 1.15), int(PHOTO_H * 1.15)) for n in names]
        fade = Image.new("L", (W, PHOTO_H), 255)
        fd = ImageDraw.Draw(fade)
        for y in range(PHOTO_H - 260, PHOTO_H):
            fd.line([(0, y), (W, y)], fill=int(255 * (PHOTO_H - y) / 260))
        self.fade = fade

    def _shot(self, i, local_t):
        im = self.base[i]
        z = 1.0 + 0.13 * (local_t / (self.seg + XFADE))  # 1.0 → ~1.13
        cw, ch = int(im.width / z / 1.0), int(im.height / z / 1.0)
        cw, ch = max(cw, W), max(ch, PHOTO_H)
        x = (im.width - cw) // 2 + int((i % 2 * 2 - 1) * 20 * local_t / self.seg)  # gentle pan
        x = max(0, min(im.width - cw, x))
        y = (im.height - ch) // 2
        return im.crop((x, y, x + cw, y + ch)).resize((W, PHOTO_H), Image.BILINEAR)

    def frame(self, t):
        i = min(int(t // self.seg), len(self.names) - 1)
        local = t - i * self.seg
        shot = self._shot(i, local)
        # cross-fade into the next photo during the last XFADE seconds of a segment
        if i + 1 < len(self.names) and local > self.seg - XFADE:
            k = (local - (self.seg - XFADE)) / XFADE
            shot = Image.blend(shot, self._shot(i + 1, 0.0), ease_out(k))
            name = self.names[i + 1] if k > 0.5 else self.names[i]
        else:
            name = self.names[i]
        return shot, name


def text_w(draw, s, font):
    return draw.textbbox((0, 0), s, font=font)[2]


def wrap(draw, s, font, max_w):
    """Greedy wrap, then rebalance two-line results so no line is a lone short word."""
    words, lines, cur = s.split(), [], ""
    for w in words:
        nxt = (cur + " " + w).strip()
        if text_w(draw, nxt, font) <= max_w:
            cur = nxt
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) == 2:
        best = None
        for k in range(1, len(words)):
            a, b = " ".join(words[:k]), " ".join(words[k:])
            wa, wb = text_w(draw, a, font), text_w(draw, b, font)
            if wa <= max_w and wb <= max_w and (best is None or max(wa, wb) < best[0]):
                best = (max(wa, wb), [a, b])
        if best:
            lines = best[1]
    return lines


BG = None
FONTS = {}


def font(path, size):
    k = (path, size)
    if k not in FONTS:
        FONTS[k] = ImageFont.truetype(path, size)
    return FONTS[k]


def render_frame(reel, t, tl, band):
    img = BG.copy()
    photo, pname = band.frame(t)
    img.paste(photo, (0, 0), band.fade)
    img = img.convert("RGBA")

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # top scrim + wordmark (kept below Instagram's top bar)
    for y in range(0, 420):
        d.line([(0, y), (W, y)], fill=(8, 18, 32, int(150 * (1 - y / 420))))
    f1, f2 = font(F_BLACK, 40), font(F_BOLD, 28)
    d.text(((W - text_w(d, "MECHANICAL", f1)) // 2, 230), "MECHANICAL", font=f1, fill=WHITE + (255,))
    d.text(((W - text_w(d, "ENTERPRISE", f2)) // 2, 280), "ENTERPRISE", font=f2, fill=ORANGE + (255,))
    # photo credit, bottom-left of the photo band
    cr = credit_text(pname)
    if cr:
        cf = font(F_MED, 24)
        d.text((24, PHOTO_H - 300), cr, font=cf, fill=(255, 255, 255, 170))

    margin = 80
    in_cta = t >= tl["cta_at"]
    top = PHOTO_H - 130  # text starts where the photo fades out

    if not in_cta:
        # hook: big on its own, then shrinks to a header when the points start
        shrink = ease_out((t - tl["points_at"] + 0.3) / 0.5)
        big = 104
        while big > 60 and max(text_w(d, ln, font(F_BLACK, big)) for ln in reel["hook"]) > W - margin * 2:
            big -= 2
        size = int(big - (big - 68) * shrink)
        hf = font(F_BLACK, size)
        y = top
        for i, line in enumerate(reel["hook"]):
            p = ease_out((t - i * HOOK_WORD_GAP) / 0.35)
            if p > 0:
                d.text((margin, y + int((1 - p) * 50)), line, font=hf, fill=WHITE + (int(255 * p),))
            y += int(size * 1.1)
        ul = ease_out((t - len(reel["hook"]) * HOOK_WORD_GAP) / 0.5)
        if ul > 0:
            d.rectangle([margin, y + 10, margin + int(220 * ul), y + 22], fill=ORANGE + (255,))
        y += 70

        pf = font(F_BOLD, 54)
        for i, pt in enumerate(reel["points"]):
            p = ease_out((t - (tl["points_at"] + i * POINT_GAP)) / 0.45)
            if p <= 0:
                break
            x = margin + int((1 - p) * -120)
            a = int(255 * p)
            cy = y + 34
            d.ellipse([x, cy - 30, x + 60, cy + 30], fill=ORANGE + (a,))
            d.line([(x + 16, cy + 1), (x + 27, cy + 13), (x + 46, cy - 12)], fill=WHITE + (a,), width=7)
            lines = wrap(d, pt, pf, W - margin * 2 - 90)
            for j, ln in enumerate(lines):
                d.text((x + 88, y + j * 66), ln, font=pf, fill=WHITE + (a,))
            y += 66 * len(lines) + 46
    else:
        p = ease_out((t - tl["cta_at"]) / 0.5)
        cf = font(F_BLACK, 86)
        cy = top + 10
        for ln in wrap(d, reel["cta"], cf, W - margin * 2):
            d.text(((W - text_w(d, ln, cf)) // 2, cy + int((1 - p) * 50)), ln, font=cf, fill=WHITE + (int(255 * p),))
            cy += 104
        bp = ease_out((t - tl["cta_at"] - 0.35) / 0.45)
        if bp > 0:
            sf = font(F_BOLD, 46)
            label = "Book a free in-home assessment"
            bw = text_w(d, label, sf) + 110
            bx, by = (W - bw) // 2, cy + 50
            d.rounded_rectangle([bx, by, bx + bw, by + 120], radius=60, fill=ORANGE + (int(255 * bp),))
            d.text((bx + 55, by + 33), label, font=sf, fill=WHITE + (int(255 * bp),))
            site = "mechanicalenterprise.com"
            d.text(((W - text_w(d, site, sf)) // 2, by + 180), site, font=sf, fill=MUTED + (int(255 * bp),))

    img.alpha_composite(layer)
    return img.convert("RGB")


def build(reel):
    n_hook = len(reel["hook"])
    points_at = n_hook * HOOK_WORD_GAP + HOOK_HOLD
    cta_at = points_at + len(reel["points"]) * POINT_GAP + 1.0
    total = cta_at + CTA_HOLD
    tl = {"points_at": points_at, "cta_at": cta_at}
    band = PhotoBand(reel["photos"], total)
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{reel['slug']}.mp4")
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-shortest", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
        "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", out,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cover_frame = None
    for i in range(int(total * FPS)):
        t = i / FPS
        fr = render_frame(reel, t, tl, band)
        if cover_frame is None and t >= cta_at - 0.5:
            cover_frame = fr
        proc.stdin.write(fr.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit(f"ffmpeg failed for {reel['slug']}")
    (cover_frame or fr).save(os.path.join(OUT_DIR, f"{reel['slug']}.jpg"), quality=88)
    print(f"{out}  {total:.1f}s")


def photo_credits(slug):
    """Caption credit line for a reel (used by server/services/social/instagram.ts)."""
    reel = next(r for r in REELS if r["slug"] == slug)
    return "; ".join(credit_text(n).replace("Photo: ", "") for n in reel["photos"] if credit_text(n))


def main():
    global BG
    BG = background()
    want = set(a for a in sys.argv[1:] if not a.startswith("--"))
    if "--credits" in sys.argv:
        for r in REELS:
            print(r["slug"], "=>", photo_credits(r["slug"]))
        return
    for r in REELS:
        if not want or r["slug"] in want:
            build(r)


if __name__ == "__main__":
    main()
