#!/usr/bin/env python3
"""
Render Mechanical Enterprise Instagram Reels (1080x1920, 30 fps, H.264 + silent AAC).

Branded motion-text tips: a hook, 3-4 points that slide in one by one, and a
call to action. Copy follows the Nov 2026 owner rules: no rebates/incentives,
no 24/7 or same-day, no prices, no phone numbers in the video, no
licensed/EPA claims. Output: client/public/reels/<slug>.mp4 (served by Netlify
at https://mechanicalenterprise.com/reels/<slug>.mp4) plus a <slug>.jpg cover.

Usage:  python3 scripts/make-reels.py            # all reels
        python3 scripts/make-reels.py quote-checklist
Requires Pillow, ffmpeg and the Inter font.
"""
import math
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
NAVY_TOP, NAVY_BOT = (30, 58, 95), (12, 27, 46)
ORANGE = (255, 107, 53)
WHITE = (255, 255, 255)
MUTED = (190, 207, 228)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "client", "public", "reels")

FONT_DIRS = ["/usr/share/fonts", "/usr/local/share/fonts", os.path.expanduser("~/.fonts")]


def find_font(*names):
    for d in FONT_DIRS:
        for root, _, files in os.walk(d):
            for n in names:
                if n in files:
                    return os.path.join(root, n)
    raise SystemExit(f"font not found: {names}")


F_BLACK = find_font("Inter-Black.otf", "InterDisplay-Black.otf", "Inter-ExtraBold.otf", "Inter-Black.ttf")
F_BOLD = find_font("Inter-Bold.otf", "Inter-Bold.ttf")
F_MED = find_font("Inter-Medium.otf", "Inter-Medium.ttf")

REELS = [
    {
        "slug": "quote-checklist",
        "hook": ["What your", "HVAC quote", "should include"],
        "kicker": "Before you sign anything",
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
        "hook": ["3 signs your", "system is ready", "to retire"],
        "kicker": "Furnace, boiler or central AC",
        "points": [
            "It's 15+ years old",
            "Repairs keep adding up",
            "Some rooms never feel right",
        ],
        "cta": "Replace it before it quits",
    },
    {
        "slug": "premium-honestly-priced",
        "hook": ["Premium HVAC,", "honestly priced"],
        "kicker": "Not a race to the cheapest install",
        "points": [
            "Right-sized for your home",
            "Clean, careful installation",
            "Optional 10-year parts & labor coverage",
        ],
        "cta": "Done right the first time",
    },
    {
        "slug": "window-units",
        "hook": ["Still running", "window units?"],
        "kicker": "There's a quieter way",
        "points": [
            "One system for heating and cooling",
            "Quiet, ductless mini-splits",
            "No more hauling units every season",
        ],
        "cta": "See what fits your home",
    },
    {
        "slug": "oil-to-heat-pump",
        "hook": ["Heating", "with oil?"],
        "kicker": "Thinking about switching?",
        "points": [
            "A heat pump heats and cools",
            "No more oil deliveries",
            "We size it to your home",
        ],
        "cta": "Get a plan for your home",
    },
    {
        "slug": "done-right",
        "hook": ["A low quote", "usually means", "a smaller job"],
        "kicker": "What gets left out?",
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
HOOK_HOLD = 1.2
POINT_GAP = 1.6
CTA_HOLD = 3.4


def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def background():
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    for y in range(H):
        k = y / (H - 1)
        c = tuple(int(NAVY_TOP[i] * (1 - k) + NAVY_BOT[i] * k) for i in range(3))
        for x in range(W):
            px[x, y] = c
    return bg


BG = None


def frame_bg(t):
    """Gradient plus a slow diagonal light band and orange corner accent."""
    img = BG.copy()
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    off = int((t * 60) % (W + H)) - H
    for i in range(0, 260, 4):
        a = int(10 * math.sin(math.pi * i / 260))
        d.line([(off + i, 0), (off + i + H, H)], fill=(255, 255, 255, a), width=4)
    d.polygon([(W, 0), (W, 220), (W - 220, 0)], fill=ORANGE + (255,))
    img.paste(over, (0, 0), over)
    return img


def text_w(draw, s, font):
    return draw.textbbox((0, 0), s, font=font)[2]


def wrap(draw, s, font, max_w):
    """Greedy wrap, then rebalance so the last line is never a lone short word."""
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


def wordmark(draw, y, alpha=255):
    f1 = ImageFont.truetype(F_BLACK, 40)
    f2 = ImageFont.truetype(F_BOLD, 28)
    s1, s2 = "MECHANICAL", "ENTERPRISE"
    draw.text(((W - text_w(draw, s1, f1)) // 2, y), s1, font=f1, fill=WHITE + (alpha,))
    draw.text(((W - text_w(draw, s2, f2)) // 2, y + 50), s2, font=f2, fill=ORANGE + (alpha,))


def render_frame(reel, t, timeline):
    img = frame_bg(t).convert("RGBA")
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    margin = 80
    wordmark(d, 250)

    hook_f = ImageFont.truetype(F_BLACK, 112)
    kick_f = ImageFont.truetype(F_BOLD, 52)
    pt_f = ImageFont.truetype(F_BOLD, 60)
    cta_f = ImageFont.truetype(F_BLACK, 92)
    small_f = ImageFont.truetype(F_BOLD, 46)

    in_cta = t >= timeline["cta_at"]
    # Hook lines pop in one by one, then shrink up when the points start.
    shrink = ease_out((t - timeline["points_at"] + 0.3) / 0.5) if not in_cta else 1.0
    hook_size = int(128 - 34 * shrink)
    hook_f = ImageFont.truetype(F_BLACK, hook_size)
    y = int(780 - 220 * shrink)
    if not in_cta:
        for i, line in enumerate(reel["hook"]):
            p = ease_out((t - i * HOOK_WORD_GAP) / 0.35)
            if p <= 0:
                continue
            dy = int((1 - p) * 60)
            d.text((margin, y + dy), line, font=hook_f, fill=WHITE + (int(255 * p),))
            y += int(hook_size * 1.08)
        # orange underline grows under the hook
        ul = ease_out((t - len(reel["hook"]) * HOOK_WORD_GAP) / 0.5)
        if ul > 0:
            d.rectangle([margin, y + 14, margin + int(260 * ul), y + 26], fill=ORANGE + (255,))
        y += 60
        kp = ease_out((t - len(reel["hook"]) * HOOK_WORD_GAP - 0.2) / 0.4)
        if kp > 0:
            d.text((margin, y), reel["kicker"], font=kick_f, fill=MUTED + (int(255 * kp),))
        y += 130

        # points slide in from the left
        for i, pt in enumerate(reel["points"]):
            start = timeline["points_at"] + i * POINT_GAP
            p = ease_out((t - start) / 0.45)
            if p <= 0:
                break
            x = margin + int((1 - p) * -120)
            a = int(255 * p)
            cy = y + 40
            d.ellipse([x, cy - 34, x + 68, cy + 34], fill=ORANGE + (a,))
            d.line([(x + 18, cy + 1), (x + 31, cy + 15), (x + 52, cy - 13)], fill=WHITE + (a,), width=8)
            lines = wrap(d, pt, pt_f, W - margin * 2 - 100)
            for j, ln in enumerate(lines):
                d.text((x + 100, y + j * 74), ln, font=pt_f, fill=WHITE + (a,))
            y += 74 * len(lines) + 60
    else:
        p = ease_out((t - timeline["cta_at"]) / 0.5)
        lines = wrap(d, reel["cta"], cta_f, W - margin * 2)
        cy = 860
        for ln in lines:
            d.text(((W - text_w(d, ln, cta_f)) // 2, cy + int((1 - p) * 50)), ln, font=cta_f, fill=WHITE + (int(255 * p),))
            cy += 110
        bp = ease_out((t - timeline["cta_at"] - 0.35) / 0.45)
        if bp > 0:
            label = "Book a free in-home assessment"
            bw = text_w(d, label, small_f) + 110
            bx, by = (W - bw) // 2, cy + 70
            d.rounded_rectangle([bx, by, bx + bw, by + 120], radius=60, fill=ORANGE + (int(255 * bp),))
            d.text((bx + 55, by + 33), label, font=small_f, fill=WHITE + (int(255 * bp),))
            site = "mechanicalenterprise.com"
            d.text(((W - text_w(d, site, small_f)) // 2, by + 190), site, font=small_f, fill=MUTED + (int(255 * bp),))
    img.alpha_composite(layer)
    return img.convert("RGB")


def build(reel):
    n_hook = len(reel["hook"])
    points_at = n_hook * HOOK_WORD_GAP + HOOK_HOLD
    cta_at = points_at + len(reel["points"]) * POINT_GAP + 1.0
    total = cta_at + CTA_HOLD
    timeline = {"points_at": points_at, "cta_at": cta_at}
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
    frames = int(total * FPS)
    cover = None
    for i in range(frames):
        t = i / FPS
        fr = render_frame(reel, t, timeline)
        if cover is None and t >= points_at + len(reel["points"]) * POINT_GAP:
            cover = fr
        proc.stdin.write(fr.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit(f"ffmpeg failed for {reel['slug']}")
    (cover or fr).save(os.path.join(OUT_DIR, f"{reel['slug']}.jpg"), quality=88)
    print(f"{out}  {total:.1f}s")


def main():
    global BG
    BG = background()
    want = set(sys.argv[1:])
    for r in REELS:
        if not want or r["slug"] in want:
            build(r)


if __name__ == "__main__":
    main()
