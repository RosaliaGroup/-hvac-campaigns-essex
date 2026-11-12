#!/usr/bin/env python3
"""
Warm & Safe awareness video (DRAFT for owner review, Nov 11 2026).

1080x1920, ~40 s, Piper TTS narration + the generated music bed from
make-reels.py, captions in the same style as the Reels. Facts: CDC (CO death
rate highest over 65; peaks fall/winter) and NFPA 2019-2023 (space heaters and
heating stoves ~29% of home heating fires). No rebates, incentives or assistance programs, no prices (owner, Nov 12).
Phone (862) 423-9396 (owner, Nov 12, for this campaign only). No individual beneficiary is named or described (owner, Nov 12).

Usage: python3 scripts/make-warm-safe-video.py <piper-model.onnx>
Output: client/public/videos/warm-and-safe.mp4 (+ .jpg poster)
"""
import importlib.util
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("reels", os.path.join(HERE, "make-reels.py"))
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)

W, H, FPS = R.W, R.H, R.FPS
OUT = os.path.join(HERE, "..", "client", "public", "videos")

# (narration, caption with *orange* words, photo, small source line)
SCENES = [
    ("Some of our senior neighbors are heading into winter without safe heat.",
     "Some seniors are heading into winter *without safe heat*", "oil-furnace", None),
    ("An old furnace or boiler can leak carbon monoxide. You can't see it, and you can't smell it.",
     "Old systems can leak *carbon monoxide*", "furnace-basement", None),
    ("The C D C has found the death rate from carbon monoxide is highest for people over sixty five.",
     "Highest risk: *people over 65*", "oil-furnace", "Source: CDC"),
    ("When the heat fails, many turn to space heaters. They're involved in about three in ten home heating fires.",
     "Space heaters: about *3 in 10* home heating fires", "furnace-basement", "Source: NFPA, 2019–2023"),
    ("Know a senior who needs safe heat? Nominate them.",
     "Know a senior who needs safe heat? *Nominate them.*", "rowhouse-window-ac", None),
    ("We'll give them a free in-home heating assessment, at no cost and no obligation.",
     "A *free in-home* heating assessment", "heat-pump-outdoor", None),
    ("This is Warm and Safe, from Mechanical Enterprise.",
     "CTA", "air-handler-attic", None),
]
PAD_BEFORE, PAD_AFTER = 0.3, 0.7


# ── v2 look (owner Nov 12: "a bit dark, people might not read it") ──────────
from PIL import ImageEnhance

BRIGHT = {}


def bright_photo(name):
    """Photos brightened instead of darkened; readability comes from caption boxes."""
    if name not in BRIGHT:
        im = R.photo_base(name)
        im = ImageEnhance.Brightness(im).enhance(1.18)
        im = ImageEnhance.Contrast(im).enhance(1.06)
        BRIGHT[name] = ImageEnhance.Color(im).enhance(1.1)
    return BRIGHT[name]


LIGHT = None


def light_scrim():
    """Only a soft band at the top (wordmark) and bottom (Instagram UI)."""
    global LIGHT
    if LIGHT is None:
        y = np.arange(H, dtype=np.float32)[:, None] * np.ones((1, W), np.float32)
        a = np.clip((440 - y) / 440, 0, 1) * 150 + np.clip((y - 1560) / 360, 0, 1) * 140
        LIGHT = Image.fromarray(np.clip(a, 0, 200).astype(np.uint8), "L")
    return LIGHT


def boxed_caption(d, s, f, cy, max_w, reveal=1.0, alpha=255):
    """Caption on a solid navy box with an orange edge — readable on any photo."""
    lines, space = R.layout(d, R.tokens(s), f, max_w)
    lh = int(f.size * 1.12)
    widest = max(sum(w for _, _, w in ln) + space * (len(ln) - 1) for ln in lines)
    pad_x, pad_y = 40, 34
    top = cy - (lh * len(lines)) // 2 - pad_y
    bottom = cy + (lh * len(lines)) // 2 + pad_y // 2
    a = int(alpha * 0.92)
    d.rounded_rectangle([(W - widest) / 2 - pad_x, top, (W + widest) / 2 + pad_x, bottom], radius=34,
                        fill=(14, 30, 52, a), outline=R.ORANGE + (alpha,), width=6)
    R.caption(d, s, f, cy, max_w, reveal=reveal, alpha=alpha)
    return top, bottom


SAFE = (90, 285, 990, 1635)  # x0, y0, x1, y1 — 4:5 feed crop with side margins


def fit(d, text, path, size, max_w):
    """Largest font size <= size whose text fits max_w."""
    while size > 18 and d.textlength(text, font=R.font(path, size)) > max_w:
        size -= 2
    return R.font(path, size)


def tts(model, text, path):
    subprocess.run([sys.executable, "-m", "piper", "-m", model, "--length-scale", "1.08", "-f", path],
                   input=text.encode(), check=True, capture_output=True)
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def read_mono(path, sr=44100):
    with wave.open(path) as w:
        src = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(1)
    if src != sr:
        x = np.interp(np.arange(0, len(x), src / sr), np.arange(len(x)), x).astype(np.float32)
    return x


def render(scene_list, total, t):
    sc = next((s for s in scene_list if s["start"] <= t < s["start"] + s["dur"]), scene_list[-1])
    lt = t - sc["start"]
    base = bright_photo(sc["photo"])
    z = 1.04 + 0.08 * (lt / sc["dur"]) + 0.05 * (1 - R.ease_out(lt / 0.25))
    cw, ch = max(int(base.width / z), W), max(int(base.height / z), H)
    dx = int(((sc["idx"] % 2) * 2 - 1) * 30 * lt / sc["dur"])
    x = max(0, min(base.width - cw, (base.width - cw) // 2 + dx))
    y = (base.height - ch) // 2
    img = base.crop((x, y, x + cw, y + ch)).resize((W, H), Image.BILINEAR)
    img.paste(Image.new("RGB", (W, H), R.NAVY), (0, 0), light_scrim())
    img = img.convert("RGBA")
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # Everything stays inside SAFE: the 4:5 area Facebook/Instagram feeds show
    # (y 285-1635) with side margins, so no word is ever cut off.
    sx0, sy0, sx1, sy1 = SAFE
    f1, f2 = R.font(R.F_BLACK, 38), R.font(R.F_BOLD, 26)
    d.text(((W - d.textlength("MECHANICAL", font=f1)) / 2, sy0 + 30), "MECHANICAL", font=f1, fill=R.WHITE + (235,))
    d.text(((W - d.textlength("ENTERPRISE", font=f2)) / 2, sy0 + 76), "ENTERPRISE", font=f2, fill=R.ORANGE + (235,))
    tag = "WARM & SAFE"
    tf = R.font(R.F_BLACK, 30)
    tw = d.textlength(tag, font=tf)
    d.rounded_rectangle([(W - tw) / 2 - 22, sy0 + 120, (W + tw) / 2 + 22, sy0 + 170], radius=25, fill=R.ORANGE + (230,))
    d.text(((W - tw) / 2, sy0 + 126), tag, font=tf, fill=R.WHITE + (255,))
    cr = R.credit_text(sc["photo"])
    if cr:
        cf = fit(d, cr, R.F_MED, 22, sx1 - sx0)
        d.text((sx0, sy1 - 40), cr, font=cf, fill=(255, 255, 255, 170), stroke_width=2, stroke_fill=(0, 0, 0, 140))
    max_w = (sx1 - sx0) - 100  # text width inside the caption box padding
    if sc["caption"] != "CTA":
        reveal = min(1.0, 0.3 + lt / 0.6) if sc["idx"] > 0 else 1.0
        boxed_caption(d, sc["caption"], R.font(R.F_BLACK, 88), 940, max_w, reveal=reveal)
        if sc["source"]:
            sf = R.font(R.F_BOLD, 34)
            d.text(((W - d.textlength(sc["source"], font=sf)) / 2, 1230), sc["source"], font=sf,
                   fill=(255, 255, 255, 210), stroke_width=3, stroke_fill=(0, 0, 0, 180))
    else:
        p = R.ease_out(lt / 0.4)
        top, bottom = boxed_caption(d, "Warm & *Safe*", R.font(R.F_BLACK, 116), 720, max_w, alpha=int(255 * p))
        bp = R.ease_out((lt - 0.35) / 0.4)
        if bp > 0:
            a = int(255 * bp)
            inner = (sx1 - sx0) - 80
            lines = [("Nominate a senior", fit(d, "Nominate a senior", R.F_BOLD, 48, inner), R.WHITE),
                     ("Book a free assessment", fit(d, "Book a free assessment", R.F_BOLD, 48, inner), R.WHITE),
                     ("mechanicalenterprise.com", fit(d, "mechanicalenterprise.com", R.F_BLACK, 54, inner), R.ORANGE),
                     ("/warm-and-safe", fit(d, "/warm-and-safe", R.F_BLACK, 54, inner), R.ORANGE),
                     ("(862) 423-9396", fit(d, "(862) 423-9396", R.F_BLACK, 72, inner), R.WHITE)]
            yy = bottom + 50
            d.rounded_rectangle([sx0, yy - 30, sx1, yy + sum(int(f.size * 1.4) for _, f, _ in lines)], radius=34,
                                fill=(14, 30, 52, int(a * 0.92)))
            for txt, f, col in lines:
                d.text(((W - d.textlength(txt, font=f)) / 2, yy), txt, font=f, fill=col + (a,),
                       stroke_width=3, stroke_fill=(0, 0, 0, int(a * 0.8)))
                yy += int(f.size * 1.4)
    d.rectangle([0, H - 10, int(W * t / total), H], fill=R.ORANGE + (230,))
    img.alpha_composite(layer)
    return img.convert("RGB")


def main():
    model = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        scene_list, t = [], 0.0
        for i, (narr, cap, photo, src) in enumerate(SCENES):
            wav = os.path.join(tmp, f"v{i}.wav")
            dur = tts(model, narr, wav) + PAD_BEFORE + PAD_AFTER
            scene_list.append({"idx": i, "start": t, "dur": dur, "caption": cap, "photo": photo, "source": src, "wav": wav})
            t += dur
        total = t + 0.8
        scene_list[-1]["dur"] += 0.8
        # audio: narration + music bed (ducked)
        sr = 44100
        n = int(total * sr)
        voice = np.zeros(n, np.float32)
        for s in scene_list:
            x = read_mono(s["wav"])
            a = int((s["start"] + PAD_BEFORE) * sr)
            voice[a:a + len(x)] += x[: max(0, n - a)]
        voice *= 0.92 / (np.abs(voice).max() + 1e-6)
        music_wav = os.path.join(tmp, "music.wav")
        R.music(total, music_wav)
        m = read_mono(music_wav)[:n]
        m = np.pad(m, (0, max(0, n - len(m))))
        env = np.convolve(np.abs(voice), np.ones(4410) / 4410, mode="same")
        mix = voice + 0.2 * m * (1 - 0.7 * np.clip(env * 12, 0, 1))
        mix = np.clip(np.tanh(mix * 1.05) * 0.95, -1, 1)
        mixwav = os.path.join(tmp, "mix.wav")
        with wave.open(mixwav, "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((np.stack([mix, mix], 1) * 32767).astype(np.int16).tobytes())
        out = os.path.join(OUT, "warm-and-safe.mp4")
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
               "-i", "-", "-i", mixwav, "-shortest", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
               "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", out]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        poster = None
        for i in range(int(total * FPS)):
            tt = i / FPS
            fr = render(scene_list, total, tt)
            if poster is None and tt >= 0.5:
                poster = fr
            proc.stdin.write(fr.tobytes())
        proc.stdin.close()
        if proc.wait() != 0:
            raise SystemExit("ffmpeg failed")
        poster.save(os.path.join(OUT, "warm-and-safe.jpg"), quality=88)
        print(out, f"{total:.1f}s")


if __name__ == "__main__":
    main()
