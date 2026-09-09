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
imgs = [head.resize((s, s), Image.NEAREST) for s in sizes]
imgs[0].save(os.path.join(B, "icon.ico"), format="ICO", sizes=[(s, s) for s in sizes])
# macOS .icns 변환용으로 electron-builder 는 512px 이상의 PNG 를 요구한다
head.resize((1024, 1024), Image.NEAREST).save(os.path.join(B, "icon.png"))

# macOS 메뉴바 아이콘: 22pt. @2x 는 32px 원본을 44px 캔버스 가운데에 1:1로 (픽셀 또렷하게)
tray = Image.open(os.path.join(A, "tray.png")).convert("RGBA")
tray.resize((22, 22), Image.LANCZOS).save(os.path.join(A, "tray-mac.png"))
canvas = Image.new("RGBA", (44, 44), (0, 0, 0, 0))
canvas.paste(tray, (6, 6), tray)
canvas.save(os.path.join(A, "tray-mac@2x.png"))
print("build/icon.ico, build/icon.png(1024), assets/tray-mac.png(+@2x)  (%dx%d 소스)" % (side, side))
