# -*- coding: utf-8 -*-
"""README 용 이미지 생성 — 스프라이트시트에서 직접 만든다 (런타임처럼 눈까지 그려서).
  docs/hero.png         조개 든 수달 크게
  docs/sudari.gif       숨쉬기 + 깜빡임 루프
  docs/reel.gif         주요 동작 릴
  docs/animations.png   17개 애니메이션 첫 프레임 표
  docs/palette.png      털 색 프리셋 8종
"""
import os, json, colorsys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
A = os.path.join(ROOT, "assets")
D = os.path.join(ROOT, "docs")
os.makedirs(D, exist_ok=True)

atlas = json.load(open(os.path.join(A, "atlas.json"), encoding="utf-8"))
palette = json.load(open(os.path.join(A, "palette.json"), encoding="utf-8"))
SHEET = Image.open(os.path.join(A, "sudari_plain.png")).convert("RGBA")
FW, FH = atlas["frameW"], atlas["frameH"]
BG = (255, 248, 236, 255)          # 말풍선과 같은 크림색 카드 배경
EYE = (0x2a, 0x1a, 0x14, 255)

KO = {
    "idle": "조개 쥐고 숨쉬기", "look": "두리번", "hunt": "마우스 사냥", "angry": "꼬리 잡히면 화남",
    "knead": "키보드 꾹꾹이", "overheat": "과열", "stretch": "스트레칭", "drink": "물 마시기",
    "shell": "조개 까기", "shell_open": "조개 깠다!", "jump": "완료 점프", "think": "함께 고민",
    "sleep": "잠", "squish": "모찌 드래그", "wave": "인사", "float": "배영", "hold": "새우 먹기",
}


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def frame(name, idx, sheet=SHEET):
    a = atlas["anims"][name]
    idx = idx % a["count"]
    return sheet.crop((idx * FW, a["row"] * FH, (idx + 1) * FW, (a["row"] + 1) * FH)).copy()


def draw_eyes(im, name, idx, lid=0.0, happy=False):
    """런타임 sprite.js 의 pxEye 를 그대로 재현: 3x4 타원 + 왼쪽 위 하이라이트."""
    m = atlas["anims"][name]["frames"][idx % atlas["anims"][name]["count"]]
    lid = max(lid, m["lid"])
    w = max(2, round(m["eyeR"] * 2)); h = w + 1
    px = im.load()
    for ex, ey in m["eyes"]:
        x0, y0 = round(ex - w / 2), round(ey - h / 2)
        cx, cy = round(ex), round(ey)
        if happy:
            for (dx, dy) in ((-2, 1), (-1, 0), (0, 0), (1, 1)):
                px[cx + dx, cy + dy] = EYE
            continue
        if lid >= 0.92:
            for dx in (-1, 0, 1):
                px[cx + dx, cy] = EYE
            px[cx - 2, cy - 1] = EYE; px[cx + 2, cy - 1] = EYE
            continue
        for yy in range(h):
            for xx in range(w):
                if (xx in (0, w - 1)) and (yy in (0, h - 1)) and w >= 3:
                    continue
                px[x0 + xx, y0 + yy] = EYE
        px[x0, y0 + 1] = (255, 255, 255, 255)
        if lid > 0.05:
            cover = round(lid * h)
            fur = hex_rgb(palette["FUR"]) + (255,)
            for yy in range(-1, cover):
                for xx in range(-1, w + 1):
                    px[x0 + xx, y0 + yy] = fur
            for xx in range(w):
                px[x0 + xx, y0 + cover] = EYE


def card(im, scale, pad=6, bg=BG):
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    out = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), bg)
    out.paste(im, (pad, pad), im)
    return out


def trim(im, margin=2):
    bb = im.getbbox()
    return im.crop((max(0, bb[0] - margin), max(0, bb[1] - margin),
                    min(im.width, bb[2] + margin), min(im.height, bb[3] + margin)))


def font(size):
    for name in ("malgunbd.ttf", "malgun.ttf", "NanumGothicBold.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()


# ------------------------------------------------------------ hero
f = frame("idle", 0); draw_eyes(f, "idle", 0)
hero = trim(f, 3)
hero = hero.resize((hero.width * 8, hero.height * 8), Image.NEAREST)
hero.save(os.path.join(D, "hero.png"))

# ------------------------------------------------------------ idle gif (숨쉬기 + 가끔 깜빡)
frames, durs = [], []
seq = [(0, 0), (1, 0), (2, 0), (3, 0)] * 2 + [(0, 0), (1, 1), (2, 0), (3, 0)]
for idx, blink in seq:
    f = frame("idle", idx); draw_eyes(f, "idle", idx, lid=1.0 if blink else 0.0)
    frames.append(card(trim(f, 4), 5).convert("RGB")); durs.append(90 if blink else 200)
frames[0].save(os.path.join(D, "sudari.gif"), save_all=True, append_images=frames[1:],
               duration=durs, loop=0, optimize=False)

# ------------------------------------------------------------ reel gif (주요 동작)
REEL = [("wave", 2, False), ("look", 2, False), ("knead", 2, False), ("stretch", 1, False),
        ("shell", 1, False), ("shell_open", 1, False), ("float", 1, False), ("jump", 2, True),
        ("angry", 2, False), ("hold", 2, True), ("sleep", 1, False)]
frames, durs = [], []
for name, loops, happy in REEL:
    a = atlas["anims"][name]
    for _ in range(loops):
        for i in range(a["count"]):
            f = frame(name, i); draw_eyes(f, name, i, lid=1.0 if name == "sleep" else 0.0, happy=happy)
            frames.append(card(trim(f, 4), 4).convert("RGB")); durs.append(int(1000 / a["fps"]))
# 카드 크기를 통일 (GIF 프레임은 같은 크기여야 한다)
W = max(im.width for im in frames); H = max(im.height for im in frames)
uni = []
for im in frames:
    c = Image.new("RGB", (W, H), BG[:3]); c.paste(im, ((W - im.width) // 2, H - im.height)); uni.append(c)
uni[0].save(os.path.join(D, "reel.gif"), save_all=True, append_images=uni[1:], duration=durs, loop=0)

# ------------------------------------------------------------ animations grid
names = list(atlas["anims"].keys())
cols, sc = 6, 3
cw, ch = FW * sc + 12, FH * sc + 34
rows = (len(names) + cols - 1) // cols
grid = Image.new("RGB", (cw * cols, ch * rows), BG[:3])
dr = ImageDraw.Draw(grid); ft = font(15)
for k, n in enumerate(names):
    f = frame(n, 0); draw_eyes(f, n, 0, lid=1.0 if n == "sleep" else 0.0, happy=(n in ("jump", "hold")))
    f = f.resize((FW * sc, FH * sc), Image.NEAREST)
    x, y = (k % cols) * cw + 6, (k // cols) * ch + 4
    grid.paste(f, (x, y), f)
    label = KO.get(n, n)
    tw = dr.textlength(label, font=ft)
    dr.text((x + (FW * sc - tw) / 2, y + FH * sc + 6), label, fill=(59, 36, 25), font=ft)
grid.save(os.path.join(D, "animations.png"))

# ------------------------------------------------------------ palette strip (sprite.js derivePalette 와 동일 규칙)
def derive(base_hex):
    r, g, b = [v / 255 for v in hex_rgb(base_hex)]
    h, l, s = colorsys.rgb_to_hls(r, g, b)

    def c(dl, ds, dh):
        rr, gg, bb = colorsys.hls_to_rgb(((h * 360 + dh) % 360) / 360, max(0.04, min(0.96, l + dl)), max(0.02, s + ds))
        return tuple(int(round(v * 255)) for v in (rr, gg, bb))

    def cream(light, sat):
        rr, gg, bb = colorsys.hls_to_rgb(((h * 360 + 6) % 360) / 360, light, min(sat, max(0.2, s * 0.9)))
        return tuple(int(round(v * 255)) for v in (rr, gg, bb))

    return {"OUT": c(-0.24, 0.02, -6), "FUR_D": c(-0.11, 0.0, -4), "FUR": c(0, 0, 0), "FUR_L": c(0.11, -0.02, 4),
            "BELLY_D": cream(0.75, 0.45), "BELLY": cream(0.87, 0.55), "BELLY_L": cream(0.95, 0.5)}


def recolor(im, colors):
    src = {hex_rgb(palette[k]): colors[k] for k in colors}
    out = im.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] and p[:3] in src:
                px[x, y] = src[p[:3]] + (255,)
    return out


PRESETS = [("#925f3f", "강수달"), ("#6b4a3c", "진갈색"), ("#4a3b36", "검은수달"), ("#c48a52", "금빛"),
           ("#8d8a86", "회색"), ("#e6dccb", "흰수달"), ("#d9a3ad", "분홍"), ("#7fa6a3", "민트")]
sc = 3
cells = []
for hexc, label in PRESETS:
    f = frame("idle", 0); draw_eyes(f, "idle", 0)
    f = recolor(f, derive(hexc))
    f = trim(f, 3)
    cells.append((f.resize((f.width * sc, f.height * sc), Image.NEAREST), label))
cw = max(c[0].width for c in cells) + 16; ch = max(c[0].height for c in cells) + 30
strip = Image.new("RGB", (cw * len(cells), ch), BG[:3]); dr = ImageDraw.Draw(strip); ft = font(14)
for i, (im, label) in enumerate(cells):
    x = i * cw + (cw - im.width) // 2
    strip.paste(im, (x, 6), im)
    tw = dr.textlength(label, font=ft)
    dr.text((i * cw + (cw - tw) / 2, ch - 22), label, fill=(59, 36, 25), font=ft)
strip.save(os.path.join(D, "palette.png"))

print("docs/: hero.png sudari.gif reel.gif animations.png palette.png")
