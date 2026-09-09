# -*- coding: utf-8 -*-
"""스프라이트시트 검수용 확대 프리뷰 — 런타임처럼 눈까지 그려서 본다.
사용: python tools/preview.py [배율] [무늬] [행이름,행이름,...]
"""
import os, sys, json
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.normpath(os.path.join(HERE, "..", "assets"))
scale = int(sys.argv[1]) if len(sys.argv) > 1 else 4
name = sys.argv[2] if len(sys.argv) > 2 else "plain"
only = sys.argv[3].split(",") if len(sys.argv) > 3 else None

atlas = json.load(open(os.path.join(A, "atlas.json"), encoding="utf-8"))
im = Image.open(os.path.join(A, "sudari_%s.png" % name)).convert("RGBA")
fw, fh = atlas["frameW"], atlas["frameH"]
rows = [n for n in atlas["anims"] if not only or n in only]

out = Image.new("RGBA", (fw * atlas["cols"], fh * len(rows)))
for i, n in enumerate(rows):
    a = atlas["anims"][n]
    strip = im.crop((0, a["row"] * fh, fw * atlas["cols"], (a["row"] + 1) * fh))
    out.paste(strip, (0, i * fh))
    # 런타임 눈: r*2 크기의 검은 정사각 + 왼쪽 위 흰 점 (감은 눈은 가로선)
    for c, m in enumerate(a["frames"]):
        size = max(2, round(m["eyeR"] * 2))
        for ex, ey in m["eyes"]:
            x0 = round(c * fw + ex - size / 2)
            y0 = round(i * fh + ey - size / 2)
            if m["lid"] >= 0.92:
                for dx in range(3):
                    out.putpixel((x0 + dx, y0 + size // 2), (20, 16, 15, 255))
                continue
            for dy in range(size):
                for dx in range(size):
                    out.putpixel((x0 + dx, y0 + dy), (20, 16, 15, 255))
            out.putpixel((x0, y0), (255, 255, 255, 255))

out = out.resize((out.width * scale, out.height * scale), Image.NEAREST)
bg = Image.new("RGB", out.size, (196, 176, 180))   # 레퍼런스와 같은 연보라 배경
bg.paste(out, (0, 0), out)
bg.save(os.path.join(A, "_preview.png"))
print(bg.size, "rows:", " ".join(rows))
