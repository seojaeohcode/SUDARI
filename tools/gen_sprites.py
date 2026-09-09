# -*- coding: utf-8 -*-
"""
수다리(Sudari) 픽셀 수달 스프라이트 제너레이터
- 100% 오리지널: 외부 스프라이트를 쓰지 않고 파라메트릭 픽셀 드로잉으로 프레임을 굽는다.
- '귀여운 캐릭터' 규칙(카와이 비율 + 픽셀아트 관례)을 그대로 따른다:
    · 머리가 크고 둥글다, 눈은 얼굴 중간 '아래'에 멀리 떨어져 있다
    · 눈동자는 크고 하이라이트가 있다, 코는 작고 뭉툭, 입은 작고 눈 가까이(살짝 웃는 ω)
    · 따뜻한 색, 순검정 대신 채도 있는 어두운 갈색 외곽선, 디더링 없음, 톤은 재질당 3단계
- 출력: assets/sudari_<pattern>.png, assets/fx.png, assets/atlas.json/.js, palette.json, tray.png
"""
import json, os, math
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "assets"))
os.makedirs(OUT, exist_ok=True)

FW, FH = 88, 88        # 프레임 크기
K = 1.6                # 포즈 좌표계(48x40 기준) → 프레임 픽셀 배율
OX, OY = 5, 10         # 포즈 좌표계 원점 이동

# ---------------------------------------------------------------- 팔레트
# 런타임에서 정확한 RGB 치환으로 리컬러하므로 값이 서로 겹치면 안 된다.
P = {
    "OUT":      (0x30, 0x26, 0x25, 255),   # 외곽선: 순검정 대신 어두운 따뜻한 갈색
    "FUR_D":    (0x48, 0x39, 0x37, 255),
    "FUR":      (0x62, 0x50, 0x4c, 255),   # 따뜻한 중간 갈색 (눈이 묻히지 않는 밝기)
    "FUR_L":    (0x80, 0x6c, 0x64, 255),
    "BELLY_D":  (0xc9, 0xc3, 0xb7, 255),
    "BELLY":    (0xe8, 0xe5, 0xda, 255),   # 주둥이·목·배 크림색 (따뜻하게)
    "BELLY_L":  (0xfa, 0xf8, 0xef, 255),
    "NOSE":     (0x35, 0x21, 0x1a, 255),
    "EYE":      (0x2a, 0x1a, 0x14, 255),   # 눈: 순검정 아님
    "GLINT":    (0xff, 0xff, 0xff, 255),
    "BLUSH":    (0xe5, 0x9a, 0x8c, 255),
    "TONGUE":   (0xe2, 0x76, 0x86, 255),
    "ROCK":     (0x8d, 0x8f, 0x9a, 255),
    "ROCK_D":   (0x5c, 0x5f, 0x6b, 255),
    "SHELL_L":  (0xf1, 0xf4, 0xfb, 255),   # 조개: 연보라빛 하늘색 3톤
    "SHELL":    (0xcd, 0xd7, 0xed, 255),
    "SHELL_D":  (0x8e, 0x9d, 0xc9, 255),
    "WATER":    (0x6f, 0xc3, 0xe8, 255),
    "WATER_L":  (0xbf, 0xe9, 0xf7, 255),
    "STEAM":    (0xdd, 0xdd, 0xe4, 255),
    "HEART":    (0xff, 0x77, 0x94, 255),
    "SPARK":    (0xff, 0xe1, 0x7a, 255),
    "INK":      (0x2b, 0x2b, 0x33, 255),
    "SHRIMP":   (0xe8, 0x66, 0x3f, 255),
    "SHRIMP_L": (0xf5, 0x9a, 0x72, 255),
}
FUR_KEYS = ("FUR_D", "FUR", "FUR_L", "BELLY", "BELLY_L", "BELLY_D")
FUR_SET = set(P[k] for k in FUR_KEYS)
CREAM_SET = set(P[k] for k in ("BELLY", "BELLY_L", "BELLY_D"))
DARK_SET = set(P[k] for k in ("FUR_D", "FUR", "FUR_L"))


# ---------------------------------------------------------------- 래스터 헬퍼
class Buf(object):
    """RGBA 픽셀 버퍼. 드로잉 좌표는 포즈 좌표계, k/ox/oy로 프레임 픽셀에 매핑된다."""

    def __init__(s, w, h, k=1.0, ox=0, oy=0):
        s.w, s.h = w, h
        s.k, s.ox, s.oy = k, ox, oy
        s.d = [[(0, 0, 0, 0)] * w for _ in range(h)]

    def get(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h:
            return s.d[y][x]
        return (0, 0, 0, 0)

    def put(s, x, y, c, clip=None):
        """프레임 픽셀 좌표에 찍는다. clip이 있으면 그 색 위에만."""
        x, y = int(x), int(y)
        if not (0 <= x < s.w and 0 <= y < s.h):
            return
        if clip is not None and s.d[y][x] not in clip:
            return
        s.d[y][x] = c

    def X(s, x): return x * s.k + s.ox
    def Y(s, y): return y * s.k + s.oy
    def R(s, r): return r * s.k

    def set(s, x, y, c, clip=None):
        s.put(math.floor(s.X(x)), math.floor(s.Y(y)), c, clip)


def sq(b, cx, cy, rx, ry, c, n=2.0, clip=None, ymin=None, ymax=None):
    """초타원(|x|^n+|y|^n<=1). n=2 타원, n이 클수록 통통한 사각."""
    cx, cy, rx, ry = b.X(cx), b.Y(cy), max(b.R(rx), 0.5), max(b.R(ry), 0.5)
    for yy in range(int(cy - ry - 1), int(cy + ry + 2)):
        if ymin is not None and yy < b.Y(ymin):
            continue
        if ymax is not None and yy > b.Y(ymax):
            continue
        for xx in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = abs((xx + 0.5 - cx) / rx)
            dy = abs((yy + 0.5 - cy) / ry)
            if dx ** n + dy ** n <= 1.0:
                b.put(xx, yy, c, clip)


def ell(b, cx, cy, rx, ry, c, clip=None, ymin=None, ymax=None):
    sq(b, cx, cy, rx, ry, c, 2.0, clip, ymin, ymax)


def disc(b, cx, cy, r, c, clip=None):
    sq(b, cx, cy, r, r, c, 2.0, clip)


def rect(b, x, y, w, h, c, clip=None):
    x0, y0 = int(b.X(x)), int(b.Y(y))
    x1, y1 = int(math.ceil(b.X(x + w))), int(math.ceil(b.Y(y + h)))
    for yy in range(y0, max(y1, y0 + 1)):
        for xx in range(x0, max(x1, x0 + 1)):
            b.put(xx, yy, c, clip)


def taper(b, pts, w0, w1, c, clip=None):
    """포인트를 잇는 테이퍼 폴리라인 (꼬리/목/턱받이)."""
    segs = []
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) * 3))
        for j in range(n + 1):
            segs.append((x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n))
    for i, (x, y) in enumerate(segs):
        t = i / max(1, len(segs) - 1)
        disc(b, x, y, (w0 + (w1 - w0) * t) / 2.0, c, clip)


def outline(b, c):
    """실루엣 바깥 1px 외곽선 (4방향) — 어두운 갈색, 순검정 아님."""
    add = []
    for y in range(b.h):
        for x in range(b.w):
            if b.get(x, y)[3] != 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = b.get(x + dx, y + dy)
                if n[3] != 0 and n != c:
                    add.append((x, y))
                    break
    for x, y in add:
        b.d[y][x] = c


# ---------------------------------------------------------------- 손으로 찍은 비트맵
# 가리비 13x11 — 위쪽 세 개의 둥근 결(lobe), 아래 경첩으로 모이는 골 두 줄,
# 왼쪽 위 하이라이트·오른쪽 아래 그늘 (빛은 항상 왼쪽 위에서).
CLAM = [
    ".OOO.OOO.OOO.",
    "OLLMOLLMOLLMO",
    "OLMMDLMMDLMMO",
    "OMMMDMMMDMMMO",
    "OMMMDMMMDMMDO",
    ".OMMDMMMDMDO.",
    ".OMMMDMDMMDO.",
    "..OMMDMDMDO..",
    "...OMDMDDO...",
    "....ODDDO....",
    ".....OOO.....",
]
CLAM_COLORS = {"O": "OUT", "D": "SHELL_D", "M": "SHELL", "L": "SHELL_L"}


def blit_bitmap(b, rows, x0, y0, colors, flip_y=False, only_rows=None):
    """비트맵 문자열을 프레임 픽셀 (x0,y0)에 찍는다."""
    seq = list(enumerate(rows))
    if only_rows is not None:
        seq = [(i, r) for i, r in seq if only_rows[0] <= i <= only_rows[1]]
    for i, row in seq:
        yy = y0 + ((len(rows) - 1 - i) if flip_y else i)
        for j, ch in enumerate(row):
            if ch in colors:
                b.put(x0 + j, yy, P[colors[ch]])


# ---------------------------------------------------------------- 수달 리그
DEF = dict(
    headCx=24.0, headCy=15.5, headRx=11.7, headRy=8.0, headN=2.15,
    bodyCx=24.0, bodyCy=30.5, bodyRx=8.7, bodyRy=9.0, bodyN=2.1,
    bellyCx=24.0, bellyCy=31.0, bellyRx=6.6, bellyRy=6.4, bib=True,
    earR=1.9, earSpread=0.88, earLift=0.62,
    # 눈/주둥이는 머리 중심 기준 상대좌표. 눈은 얼굴 중간보다 '아래', 멀리.
    eyeSep=6.0, eyeDy=0.6, eyeR=2.0, pupilDx=0.0, pupilDy=0.0, lid=0.0,
    muzzleDy=4.3, muzzleRx=None, muzzleRy=None,
    mouth=0.0, tongue=0.0, blush=0.0, whisk=True, brow=0.0,
    angry=False,                     # 눈썹 치켜올림 + 삐죽 입 + 볼 부풀리기
    rock=False,                      # 배 위에 돌 (조개 까기 자세)
    # 기본 자세: 두 앞발을 가슴 앞에 모아 조개를 꼭 쥐고 있다 (held='clam')
    armLx=20.8, armLy=28.2, armRx=27.2, armRy=28.2, armR=2.3, arms=True, held="clam",
    footLx=19.0, footRx=29.0, footY=38.6, footW=5.4, footH=2.6, feet=True,
    tail=[(32, 35), (38.5, 37), (44.5, 38.2)], tailW=5.6, tailTip=1.0, tailOn=True,
    headTiltX=0.0, headTiltY=0.0, pattern="plain",
)


def draw_otter(**kw):
    p = dict(DEF)
    p.update(kw)
    b = Buf(FW, FH, K, OX, OY)

    hcx = p["headCx"] + p["headTiltX"]
    hcy = p["headCy"] + p["headTiltY"]
    hrx, hry = p["headRx"], p["headRy"]
    mrx = p["muzzleRx"] if p["muzzleRx"] is not None else hrx * 0.69
    mry = p["muzzleRy"] if p["muzzleRy"] is not None else hry * 0.43
    mcy = hcy + p["muzzleDy"]

    # 꼬리 (몸 뒤) — 어두운 아래 + 밝은 윗면
    if p["tailOn"]:
        taper(b, p["tail"], p["tailW"], p["tailTip"], P["FUR_D"])
        hi = [(x, y - 0.9) for x, y in p["tail"]]
        taper(b, hi, p["tailW"] * 0.55, p["tailTip"] * 0.5, P["FUR"])

    # 뒷발 — 짧고 통통하게
    if p["feet"]:
        for fx in (p["footLx"], p["footRx"]):
            ell(b, fx, p["footY"], p["footW"] / 2.0, p["footH"] / 2.0 + 0.3, P["FUR_D"])

    # 목/몸통 커넥터 — 어떤 포즈에서도 머리와 몸이 분리되지 않게
    taper(b, [(hcx, hcy), (p["bodyCx"], p["bodyCy"])], hrx * 1.05, p["bodyRx"] * 1.1, P["FUR"])

    # 몸통: 윗면 하이라이트 → 본체 → 아랫배 그늘 (재질당 3톤, 디더링 없음)
    sq(b, p["bodyCx"], p["bodyCy"], p["bodyRx"], p["bodyRy"], P["FUR_L"], p["bodyN"])
    sq(b, p["bodyCx"], p["bodyCy"] + 0.9, p["bodyRx"] - 0.5, p["bodyRy"] - 0.5, P["FUR"], p["bodyN"])
    sq(b, p["bodyCx"], p["bodyCy"] + p["bodyRy"] * 0.66, p["bodyRx"] * 0.9, p["bodyRy"] * 0.4,
       P["FUR_D"], 2.0, clip=set([P["FUR"]]))

    # 배 (크림색 큰 타원)
    if p["bib"]:
        sq(b, p["bellyCx"], p["bellyCy"], p["bellyRx"], p["bellyRy"], P["BELLY"], 2.1, clip=DARK_SET)
        sq(b, p["bellyCx"], p["bellyCy"] + 0.8, p["bellyRx"] * 0.6, p["bellyRy"] * 0.55,
           P["BELLY_L"], 2.0, clip=CREAM_SET)

    # Small directional fur clusters model the smooth chest and haunch.
    for dx, dy, w in ((-4,-2,2),(3,1,2),(-2,4,2),(1,-4,1)):
        rect(b,p["bellyCx"]+dx,p["bellyCy"]+dy,w,.7,P["BELLY_D"],clip=CREAM_SET)
    rect(b,p["bodyCx"]+p["bodyRx"]*.55,p["bodyCy"]+3,1.8,1,P["FUR_D"],clip=DARK_SET)

    # 배 위의 돌 — 조개를 내려칠 받침. 앞발·조개보다 먼저 그려서 뒤에 깔린다
    if p["rock"]:
        rx_, ry_ = p["bellyCx"] + 0.8, p["bellyCy"] + 0.4
        ell(b, rx_, ry_, 3.6, 2.7, P["OUT"])
        ell(b, rx_, ry_, 3.0, 2.1, P["ROCK"])
        ell(b, rx_ + 0.9, ry_ + 0.9, 1.7, 1.0, P["ROCK_D"], clip=set([P["ROCK"]]))
        b.set(rx_ - 1.4, ry_ - 1.0, P["BELLY_L"])

    # 귀 (머리 뒤, 작고 동글)
    ex = hrx * p["earSpread"]
    ey = hry * p["earLift"]
    for s in (-1, 1):
        disc(b, hcx + s * ex, hcy - ey, p["earR"], P["FUR_D"])
        disc(b, hcx + s * ex, hcy - ey + 0.4, p["earR"] - 1.1, P["FUR_L"])

    # 머리 — 크고 둥글게. 윗면에 얇은 하이라이트
    sq(b, hcx, hcy, hrx, hry, P["FUR_L"], p["headN"])
    sq(b, hcx, hcy + 1.0, hrx - 0.5, hry - 0.7, P["FUR"], p["headN"])

    # 주둥이 — 작은 크림색 타원 (코 주변만)
    ell(b, hcx, mcy, mrx, mry, P["BELLY"], clip=DARK_SET)
    ell(b, hcx, mcy + 0.5, mrx * 0.6, mry * 0.55, P["BELLY_L"], clip=CREAM_SET)

    # 턱→배 크림색 연결 (목)
    if p["bib"]:
        taper(b, [(hcx, mcy + mry * 0.6), (p["bellyCx"], p["bellyCy"] - p["bellyRy"] * 0.5)],
              mrx * 1.1, p["bellyRx"] * 1.0, P["BELLY"], clip=DARK_SET)

    # Controlled cheek/chest clusters: smooth river-otter fur, no shaggy sea-otter ruff.
    for side in (-1, 1):
        rect(b, hcx + side * mrx * .74 - .6, mcy - 1, 1.7, 1, P["BELLY_L"], clip=CREAM_SET)
        rect(b, hcx + side * mrx * .66 - .6, mcy + 1.4, 1.2, .8, P["BELLY_D"], clip=CREAM_SET)
    rect(b, hcx - hrx * .55, hcy - hry * .55, 2, 1, P["FUR_L"], clip=DARK_SET)
    rect(b, hcx - hrx * .35, hcy - hry * .67, 1, .6, P["BELLY_D"], clip=DARK_SET)

    # 손에 든 것 + 그것을 감싸 쥔 앞발.
    # 겹치는 부분마다 어두운 외곽선을 넣어 '앞에 있는 것'이 분명히 읽히게 한다 (픽셀아트 관례).
    held = p["held"] if p["arms"] else None
    if held:
        cx_ = (p["armLx"] + p["armRx"]) / 2.0
        cy_ = min(p["armLy"], p["armRy"]) - 1.4
        if held == "clam":
            blit_bitmap(b, CLAM, int(b.X(cx_)) - 6, int(b.Y(cy_)) - 5, CLAM_COLORS)
        elif held == "clam_open":
            # 깐 조개: 위 껍데기가 들리고 사이로 속살, 아래 껍데기는 앞발 안에
            x0, y0 = int(b.X(cx_)) - 6, int(b.Y(cy_)) - 7
            blit_bitmap(b, CLAM, x0, y0, CLAM_COLORS, only_rows=(0, 5))
            for j in range(3, 10):
                b.put(x0 + j, y0 + 6, P["TONGUE"])
                b.put(x0 + j, y0 + 7, P["TONGUE"])
            b.put(x0 + 4, y0 + 6, P["HEART"])
            b.put(x0 + 2, y0 + 6, P["OUT"]); b.put(x0 + 10, y0 + 6, P["OUT"])
            b.put(x0 + 2, y0 + 7, P["OUT"]); b.put(x0 + 10, y0 + 7, P["OUT"])
            blit_bitmap(b, CLAM, x0, y0 + 8, CLAM_COLORS, flip_y=True, only_rows=(0, 5))
        elif held == "shrimp":
            # 머리는 앞발 사이에, 몸이 위로 솟아 왼쪽으로 말리는 새우 (앞발 위로 보이게)
            pts = [(cx_ + 0.6, cy_ + 0.6), (cx_ + 2.2, cy_ - 1.8), (cx_ + 0.6, cy_ - 4.0), (cx_ - 2.8, cy_ - 3.6)]
            taper(b, pts, 4.6, 3.4, P["OUT"])
            taper(b, pts, 3.3, 2.2, P["SHRIMP"])
            b.set(cx_ + 1.8, cy_ - 2.4, P["SHRIMP_L"])      # 마디 하이라이트
            b.set(cx_ + 0.2, cy_ - 4.0, P["SHRIMP_L"])
            b.set(cx_ - 1.6, cy_ - 3.8, P["SHRIMP_L"])
            b.set(cx_ - 3.8, cy_ - 4.6, P["SHRIMP_L"])      # 꼬리 지느러미
            b.set(cx_ - 4.0, cy_ - 2.8, P["SHRIMP_L"])
            b.set(cx_ + 1.6, cy_ - 0.6, P["INK"])           # 눈
        # 앞발: 든 것의 아래 양옆을 감싸는 외곽선 있는 작은 타원
        for s in (-1, 1):
            px_, py_ = cx_ + s * 3.1, cy_ + 2.3
            ell(b, px_, py_, 2.4, 1.9, P["OUT"])
            ell(b, px_, py_, 1.8, 1.3, P["FUR_L"])
    elif p["arms"]:
        # 빈손: 작은 동그라미 앞발
        for ax, ay in ((p["armLx"], p["armLy"]), (p["armRx"], p["armRy"])):
            disc(b, ax, ay, p["armR"], P["FUR_L"])
            disc(b, ax, ay + 0.6, p["armR"] * 0.55, P["FUR"])

    # 무늬
    apply_pattern(b, p, hcx, hcy)

    # 눈 위치 (렌더는 런타임) + 눈썹
    eyes = []
    for s in (-1, 1):
        ecx = hcx + s * p["eyeSep"] + p["pupilDx"]
        ecy = hcy + p["eyeDy"] + p["pupilDy"]
        eyes.append([round(b.X(ecx), 1), round(b.Y(ecy), 1)])
        if p["brow"] > 0:
            rect(b, ecx - 1.2, ecy - 2.6 - p["brow"] * 0.5, 2.4, 0.8, P["FUR_D"])
        if p["angry"]:
            # 안쪽으로 내려오는 눈썹 (바깥 높고 안쪽 낮게) — 화난 표정의 핵심
            ex_, ey_ = int(b.X(ecx)), int(b.Y(ecy))
            inward = -s                    # 왼눈(s=-1)은 오른쪽이 안쪽
            for i, dy in enumerate((-5, -4, -4, -3)):
                b.put(ex_ + inward * (i - 2), ey_ + dy, P["OUT"])

    # 화났을 때 볼 부풀리기
    if p["angry"]:
        for s in (-1, 1):
            ell(b, hcx + s * (mrx * 1.15 + 0.6), mcy + 0.4, 1.7, 1.3, P["FUR_L"], clip=set([P["FUR"]]))

    # 볼터치 — 눈 바깥 아래, 작게
    if p["blush"] > 0:
        for s in (-1, 1):
            ell(b, hcx + s * hrx * 0.70, hcy + p["eyeDy"] + 2.4, 1.5, 0.9, P["BLUSH"],
                clip=DARK_SET | CREAM_SET)

    # 코 — 작고 뭉툭 (3x2), 주둥이 윗부분
    nx, ny = int(b.X(hcx)), int(b.Y(mcy - mry * 0.45))
    for dx in range(-2, 3):
        b.put(nx + dx, ny, P["NOSE"])
        b.put(nx + dx, ny + 1, P["NOSE"])
    b.put(nx - 1, ny, P["FUR_L"])                         # 콧등 반사

    # 입 — 작은 ω, 코 바로 아래 (끝이 올라가서 웃는 인상)
    if p["mouth"] > 0.02:
        mo = p["mouth"]
        ell(b, hcx, mcy + mry * 0.35 + mo * 0.5, 1.1 + mo * 1.1, 0.6 + mo * 1.5, P["NOSE"])
        if p["tongue"] > 0:
            ell(b, hcx, mcy + mry * 0.35 + mo * 0.5 + 0.8 + p["tongue"] * 0.5, 0.9,
                0.5 + p["tongue"] * 0.7, P["TONGUE"])
    elif p["angry"]:                                            # 삐죽 ︿ 입
        b.put(nx - 1, ny + 4, P["NOSE"])
        b.put(nx, ny + 3, P["NOSE"])
        b.put(nx + 1, ny + 4, P["NOSE"])
    else:
        b.put(nx - 2, ny + 3, P["NOSE"])
        b.put(nx - 1, ny + 4, P["NOSE"])
        b.put(nx, ny + 3, P["NOSE"])
        b.put(nx + 1, ny + 4, P["NOSE"])
        b.put(nx + 2, ny + 3, P["NOSE"])

    outline(b, P["OUT"])

    # 수염 — 짧고 부드럽게 (크림색), 주둥이 옆에서 2개씩
    if p["whisk"]:
        bx = int(b.R(mrx)) + 1
        for s in (-1, 1):
            for dy in (0, 3, 6):
                for i in range(7):
                    b.put(nx + s * (bx + i), ny + dy + (1 if (i == 2 and dy == 3) else 0),
                          P["BELLY_L"])

    # A light one-pixel silhouette stays legible on both light and dark desktops.
    outline(b, P["GLINT"])

    meta = {
        "eyes": eyes,
        "eyeR": round(p["eyeR"] + 0.35, 2),
        "lid": round(p["lid"], 2),
        "head": [round(b.X(hcx), 1), round(b.Y(hcy), 1)],
        "headR": [round(b.R(hrx), 1), round(b.R(hry), 1)],
        "belly": [round(b.X(p["bellyCx"]), 1), round(b.Y(p["bellyCy"]), 1)],
        "hands": [round(b.X((p["armLx"] + p["armRx"]) / 2), 1),
                  round(b.Y(min(p["armLy"], p["armRy"])), 1)],
    }
    return b, meta


def apply_pattern(b, p, hcx, hcy):
    name = p["pattern"]
    fur = set([P["FUR"], P["FUR_L"]])
    if name == "spots":
        for dx, dy, r in ((-5, -4, 1.5), (4, -5.5, 1.3), (0, -7, 1.2), (6.5, 0, 1.4), (-6.5, 1, 1.3)):
            disc(b, p["bodyCx"] + dx, p["bodyCy"] + dy, r, P["FUR_D"], clip=fur)
        disc(b, hcx - 4.5, hcy - 5, 1.3, P["FUR_D"], clip=fur)
    elif name == "stripes":
        for ty in range(-6, 6, 4):
            rect(b, p["bodyCx"] - 12, p["bodyCy"] + ty, 24, 1.6, P["FUR_D"], clip=fur)
        for tx, ty in p["tail"][1:]:
            rect(b, tx - 2.5, ty - 3, 1.6, 6, P["FUR_D"], clip=set([P["FUR"], P["FUR_D"]]))
    elif name == "blaze":
        sq(b, hcx, hcy - p["headRy"] * 0.5, 1.3, p["headRy"] * 0.38, P["BELLY_L"], 2.0, clip=fur)


# ---------------------------------------------------------------- 애니메이션 정의
def anims(pattern):
    A = {}

    def f(**kw):
        kw.setdefault("pattern", pattern)
        return draw_otter(**kw)

    # idle — 조개 꼭 쥐고 숨쉬기
    A["idle"] = [f(bodyCy=30.5 + o, bodyRy=9.0 - o * 0.5, headCy=15.5 + o, bellyCy=31 + o,
                   armLy=28.2 + o, armRy=28.2 + o) for o in (0, 0.5, 0.9, 0.5)]
    # look — 귀 쫑긋, 고개 들기 (조개는 그대로)
    A["look"] = [f(headCy=14.0, earR=2.8, bodyCy=30.9),
                 f(headCy=13.5, earR=2.9, bodyCy=30.9)]
    # hunt — 자세 낮추고 엉덩이 꿍실 (눈 크기는 런타임 wide로 +1px만)
    A["hunt"] = [f(headCy=18.5, bodyCy=32, bodyRy=7.8, bodyRx=10.8, bellyCy=32.5, bellyRy=5.4,
                   headTiltX=w, armLy=33.5, armRy=33.5, armLx=17, armRx=31, brow=1,
                   held=None, tail=[(32, 35), (38.5, 34 - w), (44.5, 35 - w * 2)])
                 for w in (0, 1.2, 0, -1.2)]
    # angry — 꼬리 잡혔을 때: 눈썹 내려오고 볼 부풀리고 꼬리를 홱 치켜든다 (조개는 안 놓음)
    A["angry"] = [f(angry=True, lid=0.2, blush=0.4, headTiltX=w * 0.6, earLift=0.62, earSpread=0.9,
                    bodyCy=30.7, tail=[(32, 34.5), (37.5, 31.5 + w), (41.5, 27.5 + w * 1.5)],
                    tailW=5.4, tailTip=1.2)
                  for w in (0, 0.9, 0, -0.9)]
    # knead — 키보드 꾹꾹이
    A["knead"] = [f(armLy=30.5 - a, armRy=30.5 - b, armLx=17, armRx=31, headCy=16.0, mouth=0.12,
                    bodyCy=30.9, blush=0.5, held=None)
                  for a, b in ((3, 0), (1.5, 1.5), (0, 3), (1.5, 1.5))]
    # overheat — 과열 (런타임에서 빨간 틴트 + 김)
    A["overheat"] = [f(armLy=30.5 - a, armRy=30.5 - b, armLx=17, armRx=31, headCy=16.0,
                       mouth=0.5, tongue=0.6, blush=1, brow=1, bodyCy=30.9, held=None)
                     for a, b in ((3, 0), (0, 3), (3, 0), (0, 3))]
    # stretch — 쭈욱
    A["stretch"] = []
    for k in (0, 0.25, 0.6, 1.0, 1.0, 0.5):
        A["stretch"].append(f(
            bodyCy=30.5 - 2.0 * k, bodyRy=9.0 + 2.0 * k, bodyRx=9.8 - 2.0 * k,
            bellyCy=31 - 2.4 * k, bellyRy=6.4 + 1.8 * k, bellyRx=6.6 - 1.6 * k,
            headCy=15.5 - 5.5 * k, headRy=9.2 - 0.6 * k, held=None,
            armLx=17.8 - 3.5 * k, armRx=30.2 + 3.5 * k, armLy=30.5 - 8 * k, armRy=30.5 - 8 * k,
            lid=0.75 * k, mouth=0.55 * k, tongue=0.4 * k,
            tail=[(32, 35), (38.5, 36 + 1.5 * k), (44.5, 37.5 + 2 * k)]))
    # drink — 물 마시기
    A["drink"] = [f(headCy=20 + d, bodyCy=31.5, bodyRy=8.4, lid=0.5, held=None,
                    mouth=0.5, tongue=0.5 + d * 0.4, muzzleDy=4.8,
                    armLx=17.8, armRx=30.2, armLy=33, armRy=33, pupilDy=0.6) for d in (0, 1.2, 2.0, 1.2)]
    # A seated river otter plays with a shell between its paws.
    def shell_frames(held_kind):
        return [f(headCy=16 + k*.4, mouth=.2, held=held_kind,
                  armLx=20.8, armRx=27.2, armLy=28-k*2, armRy=28-k*2,
                  tail=[(32,35),(40,37),(47,38)], rock=False)
                for k in (0,.4,1,.2,.7,0)]
    A["shell"] = shell_frames("clam")
    A["shell_open"] = shell_frames("clam_open")
    # jump — 완료 점프 (상승 궤적은 렌더러가 준다)
    A["jump"] = []
    for k in (0, 0.5, 1.0, 0.45):
        A["jump"].append(f(
            bodyCy=30.5 - 1.5 * k, bodyRy=9.0 - 0.8 * k, bellyCy=31 - 1.5 * k,
            headCy=15.5 - 2.5 * k, mouth=0.3 + 0.5 * k, tongue=0.35 * k, held=None,
            armLx=16.5 - 2.5 * k, armRx=31.5 + 2.5 * k, armLy=28.5 - 6 * k, armRy=28.5 - 6 * k,
            footY=38.6 - 3 * k, footLx=20, footRx=28, blush=0.6 * k,
            eyeR=1.5 + 0.3 * k, earLift=0.8,
            tail=[(32, 35 - 2 * k), (38.5, 34 - 4 * k), (44, 31 - 5 * k)]))
    # think — 함께 고민
    A["think"] = [f(headTiltX=1.2, headTiltY=-0.4, pupilDx=1.0, pupilDy=-0.8, lid=0.3 + s,
                    armLx=18.5, armLy=31.5, armRx=28, armRy=25.0, mouth=0.1, brow=1, held=None)
                  for s in (0, 0.12, 0.24, 0.12)]
    # sleep — 동그랗게 말고
    A["sleep"] = []
    for k in (0, 0.5, 1.0, 0.5):
        A["sleep"].append(f(
            bodyCy=32.5 - 0.4 * k, bodyRx=12.0, bodyRy=7.0 + 0.4 * k, bodyN=2.0,
            bellyCx=26, bellyCy=32.5, bellyRx=7.5, bellyRy=4.0,
            headCx=15.5, headCy=26.0 - 0.4 * k, headRx=8.8, headRy=7.6, muzzleDy=3.6,
            eyeDy=0.3, eyeSep=4.0, lid=1.0, earSpread=0.72, held=None,
            armLx=19.5, armLy=33, armRx=24.5, armRy=34, armR=2.1, feet=False,
            tail=[(36, 31), (28, 28), (20, 30.5)], tailW=4.6, tailTip=1.0))
    # squish — 모찌 드래그
    A["squish"] = []
    for k in (0.35, 0.7, 1.0):
        A["squish"].append(f(
            bodyCy=31 + 2 * k, bodyRx=9.8 - 2.8 * k, bodyRy=9.0 + 3.4 * k,
            bellyCy=31.5 + 2 * k, bellyRx=6.6 - 2.2 * k, bellyRy=6.4 + 2.4 * k,
            headCy=13.5 - 1.5 * k, headRx=10.8 - 1.2 * k, headRy=9.2 + 0.8 * k,
            eyeR=1.5 + 0.3 * k, mouth=0.3 + 0.4 * k, held=None,
            armLx=17, armRx=31, armLy=29 - 2 * k, armRy=29 - 2 * k,
            footY=39, footLx=21, footRx=27, footW=5,
            tail=[(32, 37 + 1.5 * k), (36.5, 38.5 + k), (40, 39)]))
    # (빼꼼 모드는 몸 잘린 포즈 대신 창을 화면 끝으로 옮겨서 표현한다 — 포즈 없음)
    # wave — 인사 (한 손엔 조개, 한 손은 흔들기)
    A["wave"] = [f(armLx=21.0, armLy=28.5, armRx=32 + dx, armRy=24 - dy, mouth=0.35, blush=0.5,
                   headTiltX=0.4, held=None) for dx, dy in ((0, 0), (1.5, 1.2), (0, 0), (-1.5, 1.2))]
    # Swimming on the belly: streamlined body and long tapered tail.
    A["float"] = []
    for k in (0, 0.5, 1.0, 0.5):
        A["float"].append(f(
            bodyCy=30.5 - 0.6 * k, bodyRx=12.2, bodyRy=7.0, bodyN=2.0,
            bellyCx=26, bellyCy=29.5, bellyRx=8.6, bellyRy=4.6, bib=False, held=None,
            headCx=12.5, headCy=21.5 - 0.6 * k, headRx=8.8, headRy=7.6, muzzleDy=3.6,
            eyeDy=0.3, eyeSep=4.0, lid=0.5, mouth=0.2, earSpread=0.7,
            armLx=21.5, armLy=27 - 0.5 * k, armRx=28.5, armRy=27 - 0.5 * k, armR=2.2,
            footLx=38, footRx=43, footY=31.5, footW=5, footH=2.6,
            # 꼬리는 물 위에 길게 뻗어 뒤로 (발 아래쪽으로)
            tail=[(33, 35), (41, 36.2 + 0.3 * k), (48.5, 36.6 + 0.6 * k)], tailW=5.4, tailTip=1.0))
    # hold — 서서 두 손으로 먹이 들기
    A["hold"] = []
    for k in (0, 1.0, 0.4, 0.8):
        A["hold"].append(f(
            bodyCy=27.5 + 0.3 * k, bodyRx=7.8, bodyRy=12.2, bodyN=2.3,
            bellyCx=24, bellyCy=25.0, bellyRx=4.8, bellyRy=6.8,
            headCy=11.0 + 0.3 * k, headRx=9.8, headRy=8.4,
            armLx=22.4, armLy=24.0 - 0.6 * k, armRx=25.6, armRy=24.0 - 0.6 * k, armR=2.3,
            mouth=0.1 + 0.25 * k, blush=0.5, held="shrimp",
            footLx=20.5, footRx=27.5, footY=39.0, footW=6, footH=2.6,
            tail=[(29, 36.5), (37, 38.4), (45.5, 38.8)], tailW=5.4, tailTip=1.0))
    return A


# ---------------------------------------------------------------- FX 시트
FX = 16


def fx_sheet():
    rows = ["steam", "zzz", "heart", "spark", "prop", "drop", "mark", "ring", "food"]
    b = Buf(FX * 3, FX * len(rows))

    def cell(col, row):
        return col * FX, row * FX

    # steam
    for i in range(3):
        ox, oy = cell(i, 0)
        for j, (dx, dy, r) in enumerate(((0, 12, 2.9), (2 - i, 7.5, 2.5), (i - 1, 3.5, 2.0))):
            disc(b, ox + 8 + dx + math.sin(i * 1.3 + j) * 1.4, oy + dy, r, P["STEAM"])
    # zzz
    for i in range(3):
        ox, oy = cell(i, 1)
        for j in range(i + 1):
            s = 5 - j
            x, y = ox + 3 + j * 3, oy + 11 - j * 4
            rect(b, x, y, s, 1, P["INK"])
            rect(b, x, y + s - 1, s, 1, P["INK"])
            for k in range(s):
                b.set(x + s - 1 - k, y + k, P["INK"])
    # heart
    for i in range(3):
        ox, oy = cell(i, 2)
        sc = 1.0 + i * 0.18
        disc(b, ox + 6, oy + 6, 2.3 * sc, P["HEART"])
        disc(b, ox + 10, oy + 6, 2.3 * sc, P["HEART"])
        for k in range(int(6 * sc)):
            w = int(9 * sc) - k * 2
            if w < 1:
                break
            rect(b, ox + 8 - w // 2, oy + 7 + k, w, 1, P["HEART"])
        b.set(ox + 5, oy + 5, P["BELLY_L"])
    # spark
    for i in range(3):
        ox, oy = cell(i, 3)
        L = 3 + i
        rect(b, ox + 8, oy + 8 - L, 1, L * 2 + 1, P["SPARK"])
        rect(b, ox + 8 - L, oy + 8, L * 2 + 1, 1, P["SPARK"])
        for d in (-1, 1):
            b.set(ox + 8 + d, oy + 8 + d, P["SPARK"])
            b.set(ox + 8 + d, oy + 8 - d, P["SPARK"])
    # prop: 돌 / 닫힌 조개 / 열린 조개
    ox, oy = cell(0, 4)
    ell(b, ox + 8, oy + 9, 4.2, 3.4, P["ROCK"])
    ell(b, ox + 9, oy + 10.5, 2.6, 1.8, P["ROCK_D"])
    ox, oy = cell(1, 4)                                   # 닫힌 조개 = 손에 든 것과 같은 비트맵
    blit_bitmap(b, CLAM, ox + 1, oy + 2, CLAM_COLORS)
    ox, oy = cell(2, 4)                                   # 열린 조개: 위 껍데기 + 속살 + 아래 껍데기
    blit_bitmap(b, CLAM, ox + 1, oy, CLAM_COLORS, only_rows=(0, 5))
    ell(b, ox + 7.5, oy + 8, 4.0, 1.6, P["TONGUE"])
    b.set(ox + 6, oy + 7, P["HEART"])
    blit_bitmap(b, CLAM, ox + 1, oy + 5, CLAM_COLORS, flip_y=True, only_rows=(0, 5))
    # drop
    for i in range(3):
        ox, oy = cell(i, 5)
        r = 2.0 + i * 0.5
        disc(b, ox + 8, oy + 9, r, P["WATER"])
        for k in range(int(r * 2)):
            w = max(1, int(r * 2) - k)
            rect(b, ox + 8 - w // 2, oy + 9 - int(r) - k, w, 1, P["WATER"])
        b.set(ox + 7, oy + 8, P["WATER_L"])
    # mark: ? / ! / 음표
    ox, oy = cell(0, 6)
    rect(b, ox + 5, oy + 3, 5, 2, P["INK"])
    rect(b, ox + 9, oy + 5, 2, 3, P["INK"])
    rect(b, ox + 7, oy + 8, 3, 2, P["INK"])
    rect(b, ox + 7, oy + 12, 2, 2, P["INK"])
    ox, oy = cell(1, 6)
    rect(b, ox + 7, oy + 3, 2, 7, P["INK"])
    rect(b, ox + 7, oy + 12, 2, 2, P["INK"])
    ox, oy = cell(2, 6)
    rect(b, ox + 9, oy + 3, 2, 9, P["INK"])
    rect(b, ox + 11, oy + 3, 3, 2, P["INK"])
    disc(b, ox + 7, oy + 12, 2.4, P["INK"])
    # ring: 물결
    for i in range(3):
        ox, oy = cell(i, 7)
        rx = 4 + i * 2.5
        for xx in range(int(8 - rx), int(8 + rx + 1)):
            t = (xx - 8) / rx
            yy = oy + 9 + int(math.sin(t * math.pi) * -1.2)
            b.set(ox + xx, yy, P["WATER_L"])
            b.set(ox + xx, yy + 3, P["WATER"])
    # food: 새우 (통째 / 반쯤 먹은 것 / 꼬리만)
    for i in range(3):
        ox, oy = cell(i, 8)
        body = [(ox + 6, oy + 12), (ox + 5, oy + 8), (ox + 7, oy + 5), (ox + 10, oy + 4)]
        taper(b, body[: max(2, 4 - i)], 5.0, 3.0, P["SHRIMP"])
        for k in range(3 - i):
            b.set(ox + 5 + k, oy + 10 - k * 2, P["SHRIMP_L"])
        if i < 2:
            b.set(ox + 11, oy + 3, P["SHRIMP"])
            b.set(ox + 12, oy + 2, P["SHRIMP"])
        for k in (-1, 0, 1):
            b.set(ox + 5 + k, oy + 14, P["SHRIMP_L"])
        b.set(ox + 4, oy + 15, P["SHRIMP_L"])
        b.set(ox + 7, oy + 15, P["SHRIMP_L"])
        b.set(ox + 9, oy + 5, P["INK"])
    return b, rows


# ---------------------------------------------------------------- 출력
def to_img(b):
    im = Image.new("RGBA", (b.w, b.h))
    im.putdata([b.d[y][x] for y in range(b.h) for x in range(b.w)])
    return im


FPS = {"idle": 5, "look": 3, "hunt": 9, "knead": 11, "overheat": 16,
       "stretch": 5, "drink": 6, "shell": 7, "shell_open": 4, "jump": 12, "think": 4, "sleep": 2.2,
       "squish": 10, "wave": 8, "float": 2.6, "hold": 4, "angry": 9}
LOOP_ONCE = {"jump", "stretch"}
PATTERNS = ["plain", "spots", "stripes", "blaze"]


def main():
    base = anims("plain")
    order = list(base.keys())
    maxc = max(len(v) for v in base.values())
    atlas = {"frameW": FW, "frameH": FH, "cols": maxc, "patterns": PATTERNS, "anims": {}}

    for pi, pat in enumerate(PATTERNS):
        A = base if pat == "plain" else anims(pat)
        sheet = Image.new("RGBA", (FW * maxc, FH * len(order)))
        for r, name in enumerate(order):
            for c, (fb, meta) in enumerate(A[name]):
                sheet.paste(to_img(fb), (c * FW, r * FH))
            if pi == 0:
                atlas["anims"][name] = {"row": r, "count": len(A[name]),
                                        "fps": FPS.get(name, 6),
                                        "loop": name not in LOOP_ONCE,
                                        "frames": [m for _, m in A[name]]}
        sheet.save(os.path.join(OUT, "sudari_%s.png" % pat))
        if pi == 0:
            hx, hy = atlas["anims"]["idle"]["frames"][0]["head"]
            src = sheet.crop((int(hx) - 16, int(hy) - 14, int(hx) + 16, int(hy) + 18))
            src.save(os.path.join(OUT, "tray.png"))
        print("  sheet sudari_%s.png  %dx%d" % (pat, sheet.width, sheet.height))

    fb, rows = fx_sheet()
    to_img(fb).save(os.path.join(OUT, "fx.png"))
    atlas["fx"] = {"cell": FX, "rows": dict((n, i) for i, n in enumerate(rows))}

    pal = dict((k, "#%02x%02x%02x" % v[:3]) for k, v in P.items())
    with open(os.path.join(OUT, "atlas.json"), "w", encoding="utf-8") as f:
        json.dump(atlas, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "atlas.js"), "w", encoding="utf-8") as f:
        f.write("window.SUDARI_ATLAS = ")
        json.dump(atlas, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\nwindow.SUDARI_PALETTE = ")
        json.dump(pal, f, separators=(",", ":"))
        f.write(";\n")
    with open(os.path.join(OUT, "palette.json"), "w", encoding="utf-8") as f:
        json.dump(pal, f, indent=1)
    print("  fx.png, atlas.json (%d anims), palette.json" % len(order))


if __name__ == "__main__":
    main()
