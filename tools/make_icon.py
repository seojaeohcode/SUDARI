# -*- coding: utf-8 -*-
"""앱 아이콘: idle 첫 프레임의 머리를 크게 확대해 build/icon.ico / icon.png 로 만든다."""
import json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
A = os.path.join(ROOT, "assets")
B = os.path.join(ROOT, "build")
os.makedirs(B, exist_ok=True)

atlas = json.load(open(os.path.join(A, "atlas.json"), encoding="utf-8"))
sheet = Image.open(os.path.join(A, "sudari_plain.png")).convert("RGBA")
fw, fh = atlas["frameW"], atlas["frameH"]
m = atlas["anims"]["idle"]["frames"][0]
hx, hy = m["head"]
rx, ry = m["headR"]

# 머리 + 어깨가 들어오는 정사각 영역 (눈은 런타임 렌더라 여기서 직접 찍는다)
frame = sheet.crop((0, atlas["anims"]["idle"]["row"] * fh, fw, (atlas["anims"]["idle"]["row"] + 1) * fh)).copy()
eye = (0x2a, 0x1a, 0x14, 255)
for ex, ey in m["eyes"]:
    x0, y0 = round(ex - 1.5), round(ey - 2)
    for dy in range(4):
        for dx in range(3):
            if (dx in (0, 2)) and (dy in (0, 3)):
                continue
            frame.putpixel((x0 + dx, y0 + dy), eye)
    frame.putpixel((x0, y0 + 1), (255, 255, 255, 255))

side = int(max(rx, ry) * 2 + 10)
cx, cy = int(hx), int(hy) + 3
box = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
head = frame.crop(box)

sizes = [256, 128, 64, 48, 32, 16]
imgs = []
for s in sizes:
    im = head.resize((s, s), Image.NEAREST)
    imgs.append(im)
imgs[0].save(os.path.join(B, "icon.png"))
imgs[0].save(os.path.join(B, "icon.ico"), format="ICO", sizes=[(s, s) for s in sizes])
print("build/icon.ico, build/icon.png  (%dx%d 소스 → %s)" % (side, side, sizes))
