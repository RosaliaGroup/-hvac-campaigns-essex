#!/usr/bin/env python3
"""
Render Mechanical Enterprise Instagram Reels (1080x1920, 30 fps, H.264 + AAC).

v2 (Nov 11, 2026), modelled on the NJ HVAC video ads with the most reach in
the Meta Ad Library (High Ground, Sam's Air Control, SM Heating, Garden State):
  - full-screen equipment footage/photos, cut every ~1.7 s with a punch-in zoom
  - one big centred caption per scene, key words in orange
  - a curiosity-question hook that is on screen from the very first frame
  - background music (original, generated here — no licensing), loop-friendly
  - 10–13 s total, ending on a clear call to action

Photos live in scripts/reel-photos/ with their licences in CREDITS.json
(CC BY / CC0 photos of real equipment, no people). They are stock photos,
not Mechanical Enterprise jobs — captions must never say otherwise. Add the
crew's own job photos with license "own" (no on-screen credit).

Copy rules (owner, Nov 2026): no rebates/incentives, no 24/7 or same-day,
no prices, no phone numbers in the video, no licensed/EPA claims.
Output: client/public/reels/<slug>.mp4 (+ <slug>.jpg cover), served at
https://mechanicalenterprise.com/reels/<slug>.mp4.

Usage:  python3 scripts/make-reels.py              # all reels
        python3 scripts/make-reels.py done-right   # one
        python3 scripts/make-reels.py --credits    # caption credit lines
Requires Pillow, numpy, ffmpeg and the Inter font.
"""
import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
ORANGE = (255, 107, 53)
WHITE = (255, 255, 255)
NAVY = (14, 30, 52)
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

# Scenes: hook (question) → points → CTA. *Asterisks* mark words shown in orange.
REELS = [
    {
        "slug": "signs-to-replace",
        "hook": "How old is your *furnace,* really?",
        "points": ["Older than *15 years?*", "Repairs keep *adding up?*", "Some rooms *never* feel right?"],
        "cta": "Replace it *before* it quits",
        "photos": ["oil-furnace", "furnace-basement", "oil-furnace", "condensers", "air-handler-attic"],
    },
    {
        "slug": "quote-checklist",
        "hook": "Comparing HVAC *quotes?* Check these 4",
        "points": [
            "Was your *house* actually sized?",
            "Is the exact *model* listed?",
            "*Ductwork & line set* spelled out?",
            "*Warranty* terms in writing?",
        ],
        "cta": "If it's not on paper, it's *not in the price*",
        "photos": ["air-handler-attic", "condensers", "furnace-basement", "heat-pump-outdoor", "oil-furnace", "air-handler-attic"],
    },
    {
        "slug": "premium-honestly-priced",
        "hook": "What *premium* HVAC actually means",
        "points": ["Sized for *your* house, not a guess", "*Clean, careful* installation", "Optional *10-year* parts & labor coverage"],
        "cta": "Premium HVAC, *honestly priced*",
        "photos": ["air-handler-attic", "heat-pump-outdoor", "condensers", "air-handler-attic", "heat-pump-outdoor"],
    },
    {
        "slug": "window-units",
        "hook": "Still hauling *window units* every year?",
        "points": ["One system that *heats AND cools*", "*Quiet* ductless mini-splits", "Nothing to carry up from the *basement*"],
        "cta": "See what *fits your home*",
        "photos": ["rowhouse-window-ac", "heat-pump-outdoor", "condensers", "heat-pump-outdoor", "rowhouse-window-ac"],
    },
    {
        "slug": "done-right",
        "hook": "Why is one quote *thousands cheaper?*",
        "points": ["*Undersized* equipment", "Old ductwork *left as-is*", "*Shortcuts* you can't see"],
        "cta": "Done right the *first time*",
        "photos": ["furnace-basement", "air-handler-attic", "condensers", "oil-furnace", "air-handler-attic"],
    },
    {
        "slug": "oil-to-heat-pump",
        "hook": "Still paying for *oil deliveries?*",
        "points": ["A heat pump *heats and cools*", "*No oil tank* to fill", "*Sized* to your home"],
        "cta": "Get a *plan* for your home",
        "photos": ["oil-furnace", "furnace-basement", "heat-pump-outdoor", "condensers", "heat-pump-outdoor"],
    },
]

HOOK_S, POINT_S, CTA_S = 2.4, 1.75, 2.8
BPM = 104


def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


FONTS = {}


def font(path, size):
    k = (path, size)
    if k not in FONTS:
        FONTS[k] = ImageFont.truetype(path, size)
    return FONTS[k]


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def credit_text(name):
    c = CREDITS[name]
    if c["license"] == "own":
        return ""
    who = c.get("creator") or "unknown"
    return f"Photo: {who} · {'public domain' if c['license'] == 'CC0' else c['license']}"


# ── text with orange keywords ────────────────────────────────────────────────

def tokens(s):
    """'Was your *house* sized?' → [('Was', False), ('your', False), ('house', True), ('sized?', False)]"""
    out, hot = [], False
    for word in s.split():
        start = word.startswith("*")
        w = word.strip("*") if word.count("*") else word
        if start:
            hot = True
        out.append((w.replace("*", ""), hot))
        if word.rstrip(",.?!").endswith("*") or word.endswith("*"):
            hot = False
    return out


def layout(draw, toks, f, max_w):
    lines, cur, cur_w = [], [], 0
    space = draw.textlength(" ", font=f)
    for w, hot in toks:
        ww = draw.textlength(w, font=f)
        if cur and cur_w + space + ww > max_w:
            lines.append(cur)
            cur, cur_w = [], 0
        cur.append((w, hot, ww))
        cur_w += (space if len(cur) > 1 else 0) + ww
    if cur:
        lines.append(cur)
    # rebalance: avoid a lone short last line
    if len(lines) >= 2 and len(lines[-1]) == 1 and len(lines[-2]) > 2:
        lines[-1].insert(0, lines[-2].pop())
    return lines, space


def caption(draw, s, f, cy, max_w, reveal=1.0, alpha=255):
    """Centered multi-line caption with stroke; `reveal` (0..1) shows words progressively."""
    toks = tokens(s)
    lines, space = layout(draw, toks, f, max_w)
    lh = int(f.size * 1.12)
    total_h = lh * len(lines)
    y = cy - total_h // 2
    shown = max(1, int(round(reveal * len(toks)))) if reveal < 1 else len(toks)
    k = 0
    for ln in lines:
        lw = sum(w for _, _, w in ln) + space * (len(ln) - 1)
        x = (W - lw) / 2
        for w, hot, ww in ln:
            if k < shown:
                draw.text((x, y), w, font=f, fill=(ORANGE if hot else WHITE) + (alpha,),
                          stroke_width=max(4, f.size // 14), stroke_fill=(0, 0, 0, int(alpha * 0.85)))
            x += ww + space
            k += 1
        y += lh
    return cy - total_h // 2, cy + total_h // 2


# ── scenes ───────────────────────────────────────────────────────────────────

def plan(reel):
    scenes = [("hook", reel["hook"], HOOK_S)]
    scenes += [("point", p, POINT_S) for p in reel["points"]]
    scenes.append(("cta", reel["cta"], CTA_S))
    t = 0.0
    out = []
    for i, (kind, text, dur) in enumerate(scenes):
        photo = reel["photos"][i % len(reel["photos"])]
        out.append({"kind": kind, "text": text, "start": t, "dur": dur, "photo": photo, "idx": i})
        t += dur
    return out, t


PHOTOS = {}


def photo_base(name):
    if name not in PHOTOS:
        PHOTOS[name] = cover(Image.open(os.path.join(PHOTO_DIR, f"{name}.jpg")).convert("RGB"), int(W * 1.18), int(H * 1.18))
    return PHOTOS[name]


SCRIM = None


def scrim():
    """Darken top/bottom and slightly overall so captions read on any photo."""
    global SCRIM
    if SCRIM is None:
        a = np.zeros((H, W), dtype=np.float32)
        y = np.arange(H, dtype=np.float32)[:, None]
        a += 70
        a += np.clip((520 - y) / 520, 0, 1) * 150
        a += np.clip((y - 1150) / 770, 0, 1) * 170
        a += np.exp(-((y - 880) / 260) ** 2) * 70  # caption band
        SCRIM = Image.fromarray(np.clip(a, 0, 235).astype(np.uint8), "L")
    return SCRIM


def render_frame(reel, scenes, t):
    sc = next((s for s in scenes if s["start"] <= t < s["start"] + s["dur"]), scenes[-1])
    lt = t - sc["start"]
    # punch-in zoom: start slightly tighter on each cut, then slow push
    base = photo_base(sc["photo"])
    z = 1.04 + 0.10 * (lt / sc["dur"]) + 0.05 * (1 - ease_out(lt / 0.25))
    cw, ch = int(base.width / z), int(base.height / z)
    cw, ch = max(cw, W), max(ch, H)
    dx = int(((sc["idx"] % 2) * 2 - 1) * 30 * lt / sc["dur"])
    x = max(0, min(base.width - cw, (base.width - cw) // 2 + dx))
    y = (base.height - ch) // 2
    img = base.crop((x, y, x + cw, y + ch)).resize((W, H), Image.BILINEAR)
    img.paste(Image.new("RGB", (W, H), NAVY), (0, 0), scrim())
    # quick white flash on each cut after the first
    if sc["idx"] > 0 and lt < 0.08:
        img = Image.blend(img, Image.new("RGB", (W, H), WHITE), 0.35 * (1 - lt / 0.08))
    img = img.convert("RGBA")

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f1, f2 = font(F_BLACK, 38), font(F_BOLD, 26)
    d.text(((W - d.textlength("MECHANICAL", font=f1)) / 2, 210), "MECHANICAL", font=f1, fill=WHITE + (235,))
    d.text(((W - d.textlength("ENTERPRISE", font=f2)) / 2, 256), "ENTERPRISE", font=f2, fill=ORANGE + (235,))
    cr = credit_text(sc["photo"])
    if cr:
        d.text((40, 330), cr, font=font(F_MED, 24), fill=(255, 255, 255, 150))

    max_w = W - 140
    if sc["kind"] == "hook":
        # full text visible from frame 0 (hook must read instantly); words pop bigger
        caption(d, sc["text"], font(F_BLACK, 108), 900, max_w)
    elif sc["kind"] == "point":
        n = scenes.index(sc)  # 1-based point number
        badge = f"{n}"
        bp = ease_out(lt / 0.2)
        r = int(52 * bp)
        if r > 2:
            d.ellipse([W / 2 - r, 700 - r, W / 2 + r, 700 + r], fill=ORANGE + (255,))
            bf = font(F_BLACK, int(62 * bp) or 1)
            d.text((W / 2 - d.textlength(badge, font=bf) / 2, 700 - bf.size * 0.62), badge, font=bf, fill=WHITE + (255,))
        caption(d, sc["text"], font(F_BLACK, 100), 930, max_w, reveal=min(1.0, 0.25 + lt / 0.45))
    else:
        p = ease_out(lt / 0.35)
        top, bottom = caption(d, sc["text"], font(F_BLACK, 98), 820, max_w, alpha=int(255 * p))
        bp = ease_out((lt - 0.3) / 0.35)
        if bp > 0:
            sf = font(F_BLACK, 50)
            label = "Book a free in-home assessment"
            bw = d.textlength(label, font=sf) + 120
            bx, by = (W - bw) / 2, bottom + 60 + int((1 - bp) * 30)
            d.rounded_rectangle([bx, by, bx + bw, by + 128], radius=64, fill=ORANGE + (int(255 * bp),))
            d.text((bx + 60, by + 34), label, font=sf, fill=WHITE + (int(255 * bp),))
            site = "mechanicalenterprise.com"
            mf = font(F_BOLD, 48)
            d.text(((W - d.textlength(site, font=mf)) / 2, by + 170), site, font=mf, fill=WHITE + (int(235 * bp),),
                   stroke_width=3, stroke_fill=(0, 0, 0, int(200 * bp)))
    # thin progress bar (keeps viewers watching to the end)
    total = scenes[-1]["start"] + scenes[-1]["dur"]
    d.rectangle([0, H - 10, int(W * t / total), H], fill=ORANGE + (230,))
    img.alpha_composite(layer)
    return img.convert("RGB")


# ── original background music (generated, royalty-free) ─────────────────────

def music(seconds, path, sr=44100):
    """Warm 4-chord pad + soft kick/hat at BPM, faded in/out. Written to a WAV."""
    n = int(seconds * sr)
    t = np.arange(n) / sr
    beat = 60 / BPM
    bar = beat * 4
    chords = [  # Cmaj9, Am9, Fmaj9, G6/9 (Hz)
        [130.81, 196.00, 246.94, 293.66, 329.63],
        [110.00, 164.81, 196.00, 246.94, 261.63],
        [87.31, 174.61, 220.00, 261.63, 329.63],
        [98.00, 146.83, 196.00, 246.94, 293.66],
    ]
    pad = np.zeros(n)
    for i, ch in enumerate(chords * 4):
        s0, s1 = int(i * bar * sr), int((i + 1) * bar * sr)
        if s0 >= n:
            break
        s1 = min(s1, n)
        seg = t[s0:s1] - t[s0]
        env = np.minimum(1, seg / 0.35) * np.minimum(1, (bar - seg) / 0.35)
        for k, f in enumerate(ch):
            pad[s0:s1] += env * (np.sin(2 * np.pi * f * seg) + 0.35 * np.sin(2 * np.pi * f * 2.003 * seg)) / (k + 1.5)
    pad /= np.max(np.abs(pad)) + 1e-9
    drums = np.zeros(n)
    kick_len = int(0.25 * sr)
    kt = np.arange(kick_len) / sr
    kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-kt * 30)) * kt) * np.exp(-kt * 9)
    hat_len = int(0.05 * sr)
    rng = np.random.default_rng(7)
    hat = rng.standard_normal(hat_len) * np.exp(-np.arange(hat_len) / sr * 70)
    hat = np.diff(hat, prepend=0)  # crude high-pass
    for b in range(int(seconds / beat) + 1):
        s = int(b * beat * sr)
        if s < n:
            e = min(n, s + kick_len)
            drums[s:e] += kick[: e - s]
        s = int((b + 0.5) * beat * sr)
        if s < n:
            e = min(n, s + hat_len)
            drums[s:e] += 0.25 * hat[: e - s]
    mix = 0.55 * pad + 0.6 * drums
    fade = np.minimum(1, t / 0.4) * np.minimum(1, (seconds - t) / 0.8)
    mix = mix * fade
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.5  # about -6 dBFS peak
    stereo = np.stack([mix, mix], axis=1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((stereo * 32767).astype(np.int16).tobytes())


def build(reel):
    scenes, total = plan(reel)
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{reel['slug']}.mp4")
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "music.wav")
        music(total, wav)
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
            "-i", wav, "-shortest",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high",
            "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", out,
        ]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        cover_frame = None
        for i in range(int(total * FPS)):
            t = i / FPS
            fr = render_frame(reel, scenes, t)
            if cover_frame is None and t >= 0.6:  # hook frame = cover
                cover_frame = fr
            proc.stdin.write(fr.tobytes())
        proc.stdin.close()
        if proc.wait() != 0:
            raise SystemExit(f"ffmpeg failed for {reel['slug']}")
    cover_frame.save(os.path.join(OUT_DIR, f"{reel['slug']}.jpg"), quality=88)
    print(f"{out}  {total:.1f}s")


def photo_credits(slug):
    reel = next(r for r in REELS if r["slug"] == slug)
    names = []
    for n in reel["photos"]:
        if n not in names and credit_text(n):
            names.append(n)
    return "; ".join(credit_text(n).replace("Photo: ", "") for n in names)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--credits" in sys.argv:
        for r in REELS:
            print(r["slug"], "=>", photo_credits(r["slug"]))
        return
    for r in REELS:
        if not args or r["slug"] in args:
            build(r)


if __name__ == "__main__":
    main()
