/* 수다리 스프라이트 렌더러
 * - 스프라이트시트를 1x 오프스크린에 찍고, 눈/FX를 픽셀 단위로 덧그린 뒤
 *   정수 배율로 확대한다(imageSmoothing off) → 항상 또렷한 픽셀아트.
 * - 털 색은 팔레트 RGB 치환으로 런타임 리컬러.
 */
(function (global) {
  'use strict';

  var PAD = 16; // FX(김·하트·zzz)가 프레임 밖으로 나갈 여유

  function hexToRgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var h = 0, s = 0, l = (mx + mn) / 2;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    var t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(t[0] + m) * 255, (t[1] + m) * 255, (t[2] + m) * 255];
  }

  /** 베이스 색 하나에서 털 5단계 + 아웃라인을 파생시킨다. */
  function derivePalette(baseHex) {
    var rgb = hexToRgb(baseHex), hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var h = hsl[0], s = hsl[1], l = hsl[2];
    function c(dl, ds, dh) {
      var v = hslToRgb(h + (dh || 0), Math.max(0.02, s + (ds || 0)), Math.max(0.04, Math.min(0.96, l + dl)));
      return rgbToHex(v[0], v[1], v[2]);
    }
    // 크림색(주둥이·목·배)은 털 색조만 살짝 물들이고 밝기는 고정 → 어떤 털색이든 얼굴이 읽힌다.
    function cream(lightness, sat) {
      var v = hslToRgb(h + 6, Math.min(sat, Math.max(0.2, s * 0.9)), lightness);
      return rgbToHex(v[0], v[1], v[2]);
    }
    // 하이라이트는 따뜻하게(+hue), 그늘과 외곽선은 차갑게(-hue) — 픽셀아트 색상 관례
    return {
      OUT: c(-0.24, 0.02, -6),
      FUR_D: c(-0.11, 0.0, -4),
      FUR: c(0, 0, 0),
      FUR_L: c(0.11, -0.02, 4),
      BELLY_D: cream(0.75, 0.45),
      BELLY: cream(0.87, 0.55),
      BELLY_L: cream(0.95, 0.5)
    };
  }

  function Sprite(img, atlas, palette) {
    this.atlas = atlas;
    this.palette = palette;
    this.src = img;
    this.sheet = img;              // 리컬러된 결과가 들어간다
    this.fw = atlas.frameW;
    this.fh = atlas.frameH;
    this.W = this.fw + PAD * 2;
    this.H = this.fh + PAD * 2;
    this.pad = PAD;
    this.buf = document.createElement('canvas');
    this.buf.width = this.W;
    this.buf.height = this.H;
    this.bctx = this.buf.getContext('2d');
    this.bctx.imageSmoothingEnabled = false;
    this.fur = palette.FUR;
    this._recolorCache = {};
    var mask = document.createElement('canvas'); mask.width=img.width; mask.height=img.height;
    var mx=mask.getContext('2d'); mx.drawImage(img,0,0);
    this.alpha=mx.getImageData(0,0,img.width,img.height).data; this.sheetWidth=img.width;
  }

  /** 팔레트 RGB를 정확히 치환해 시트를 다시 만든다. */
  Sprite.prototype.recolor = function (colors) {
    var key = JSON.stringify(colors || {});
    if (this._recolorCache[key]) {
      this.sheet = this._recolorCache[key].sheet;
      this.fur = this._recolorCache[key].fur;
      return;
    }
    if (!colors) { this.sheet = this.src; this.fur = this.palette.FUR; return; }
    var c = document.createElement('canvas');
    c.width = this.src.width; c.height = this.src.height;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(this.src, 0, 0);
    var data = x.getImageData(0, 0, c.width, c.height), d = data.data;
    var map = [];
    for (var role in colors) {
      if (!this.palette[role]) continue;
      map.push([hexToRgb(this.palette[role]), hexToRgb(colors[role])]);
    }
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      for (var m = 0; m < map.length; m++) {
        var f = map[m][0];
        if (d[i] === f[0] && d[i + 1] === f[1] && d[i + 2] === f[2]) {
          var t = map[m][1];
          d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2];
          break;
        }
      }
    }
    x.putImageData(data, 0, 0);
    this.sheet = c;
    this.fur = colors.FUR || this.palette.FUR;
    this._recolorCache[key] = { sheet: c, fur: this.fur };
  };

  Sprite.prototype.contains = function(name, frame, x, y) {
    var a=this.anim(name); x=Math.floor(x); y=Math.floor(y);
    if(x<0||y<0||x>=this.fw||y>=this.fh)return false;
    return this.alpha[((a.row*this.fh+y)*this.sheetWidth+(frame%a.count)*this.fw+x)*4+3]>0;
  };

  Sprite.prototype.anim = function (name) {
    return this.atlas.anims[name] || this.atlas.anims.idle;
  };

  Sprite.prototype.frameCount = function (name) {
    return this.anim(name).count;
  };

  Sprite.prototype.meta = function (name, idx) {
    var a = this.anim(name);
    return a.frames[Math.min(idx, a.frames.length - 1)];
  };

  /** 오프스크린(1x)에 한 프레임을 찍는다. */
  Sprite.prototype.begin = function () {
    this.bctx.clearRect(0, 0, this.W, this.H);
    return this.bctx;
  };

  Sprite.prototype.blitFrame = function (name, idx) {
    var a = this.anim(name);
    var c = Math.min(idx, a.count - 1);
    this.bctx.drawImage(this.sheet, c * this.fw, a.row * this.fh, this.fw, this.fh,
      PAD, PAD, this.fw, this.fh);
  };

  /**
   * 귀여운 눈: 가로보다 세로가 1px 긴 타원 (3x4, 4x5 …), 네 모서리를 깎아 동글게.
   * 왼쪽 위에 흰 하이라이트 — 이게 있어야 '살아있는' 눈이 된다.
   */
  function pxEye(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    var w = Math.max(2, Math.round(r * 2));
    var h = w + 1;
    var x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        var corner = (xx === 0 || xx === w - 1) && (yy === 0 || yy === h - 1);
        if (corner && w >= 3) continue;
        ctx.fillRect(x0 + xx, y0 + yy, 1, 1);
      }
    }
    return { x: x0, y: y0, w: w, h: h };
  }

  /**
   * 눈을 런타임에 그린다 — 시선(gaze), 깜빡임(lid), 감정(happy/hurt).
   * @param opts {gaze:[dx,dy], lid:0..1, happy:bool, wide:number, eyeColor, glint}
   */
  Sprite.prototype.drawEyes = function (name, idx, opts) {
    var ctx = this.bctx, m = this.meta(name, idx);
    if (!m || !m.eyes) return;
    var gaze = opts.gaze || [0, 0];
    var lid = Math.max(m.lid, opts.lid || 0);
    var r = m.eyeR + (opts.wide || 0);
    var eye = opts.eyeColor || '#2a1a14';
    for (var i = 0; i < m.eyes.length; i++) {
      var ex = m.eyes[i][0] + PAD + gaze[0];
      var ey = m.eyes[i][1] + PAD + gaze[1];
      var cx = Math.round(ex), cy = Math.round(ey);
      if (opts.happy) {                       // ^^ 웃는 눈 (위로 볼록한 곡선)
        ctx.fillStyle = eye;
        ctx.fillRect(cx - 2, cy + 1, 1, 1);
        ctx.fillRect(cx - 1, cy, 1, 1);
        ctx.fillRect(cx, cy, 1, 1);
        ctx.fillRect(cx + 1, cy + 1, 1, 1);
        continue;
      }
      if (lid >= 0.92) {                      // 감은 눈: 아래로 볼록한 짧은 곡선 (편안함)
        ctx.fillStyle = eye;
        ctx.fillRect(cx - 1, cy, 3, 1);
        ctx.fillRect(cx - 2, cy - 1, 1, 1);
        ctx.fillRect(cx + 2, cy - 1, 1, 1);
        continue;
      }
      var d = pxEye(ctx, ex, ey, r, eye);
      if (opts.glint !== false) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(d.x, d.y + 1, Math.max(1, d.w - 2), 1);   // 왼쪽 위 반사광
      }
      if (lid > 0.05) {                       // 반쯤 감은 눈: 털색으로 위를 덮는다
        var h = Math.round(lid * d.h);
        ctx.fillStyle = this.fur;
        ctx.fillRect(d.x - 1, d.y - 1, d.w + 2, h + 1);
        ctx.fillStyle = eye;
        ctx.fillRect(d.x, d.y + h, d.w, 1);
      }
    }
  };

  /** FX 시트에서 한 칸을 오프스크린에 찍는다 (좌표는 프레임 기준). */
  Sprite.prototype.blitFx = function (fxImg, row, col, x, y) {
    var cell = this.atlas.fx.cell;
    var r = this.atlas.fx.rows[row];
    if (r === undefined) return;
    this.bctx.drawImage(fxImg, col * cell, r * cell, cell, cell,
      Math.round(x + PAD - cell / 2), Math.round(y + PAD - cell / 2), cell, cell);
  };

  /** 과열 등 색 틴트. 실루엣 안쪽에만 얹는다. */
  Sprite.prototype.tint = function (color, alpha) {
    var ctx = this.bctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  };

  /** 오프스크린을 정수 배율로 목표 캔버스에 확대 전사. */
  Sprite.prototype.present = function (ctx, x, y, scale, flip) {
    ctx.imageSmoothingEnabled = false;
    var w = this.W * scale, h = this.H * scale;
    if (flip) {
      ctx.save();
      ctx.translate(Math.round(x + w), Math.round(y));
      ctx.scale(-1, 1);
      ctx.drawImage(this.buf, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(this.buf, Math.round(x), Math.round(y), w, h);
    }
  };

  Sprite.load = function (baseDir, pattern, atlas, palette) {
    return new Promise(function (res, rej) {
      var img = new Image(), fx = new Image(), left = 2;
      function done() { if (--left === 0) { var s = new Sprite(img, atlas, palette); s.fx = fx; res(s); } }
      img.onload = done; fx.onload = done;
      img.onerror = rej; fx.onerror = rej;
      img.src = baseDir + '/sudari_' + (pattern || 'plain') + '.png';
      fx.src = baseDir + '/fx.png';
    });
  };

  global.Sudari = global.Sudari || {};
  global.Sudari.Sprite = Sprite;
  global.Sudari.derivePalette = derivePalette;
  global.Sudari.PAD = PAD;
})(window);
