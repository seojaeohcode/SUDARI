/* Integer pixel scales; the largest size fits inside the current display. */
(function (root) {
  "use strict";
  function scale(v) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.max(2, Math.min(5, Math.round(n))) : 2;
  }
  function desired(s) {
    return { width: Math.max(360, 120 * s), height: Math.max(s > 1 ? 500 : 0, 154 * s + 142) };
  }
  function effectiveScale(v, area) {
    var s = scale(v);
    while (
      s > 1 &&
      (desired(s).height > area.height + 1 || desired(s).width > area.width + 1)
    )
      s--;
    return s;
  }
  function size(v, area) {
    var d = desired(area ? effectiveScale(v, area) : scale(v));
    return area
      ? {
          width: Math.min(d.width, area.width),
          height: Math.min(d.height, area.height),
        }
      : d;
  }
  function bounds(previous, v, area, peek) {
    var d = size(v, area),
      s = effectiveScale(v, area);
    var x = previous.x + (previous.width - d.width) / 2,
      y = previous.y + previous.height - d.height;
    x = peek
      ? area.x + area.width - d.width / 2 + 12 * s
      : Math.max(area.x, Math.min(x, area.x + area.width - d.width));
    y = Math.max(area.y, Math.min(y, area.y + area.height - d.height));
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: d.width,
      height: d.height,
    };
  }
  // Bottom-up overlay stack. Shrink scrollable text first, then the editor;
  // the shell keeps its full size and every item keeps a separate hit rectangle.
  function stack(height, bottom, items) {
    var gap = 8, top = 12;
    var sizes = items.map(function(item) { return Math.ceil(item.height); });
    var available = Math.max(0, height - top - bottom - gap * Math.max(0, items.length - 1));
    var excess = Math.max(0, sizes.reduce(function(a,b) { return a+b; }, 0) - available);
    for (var i = items.length - 1; i >= 0 && excess > 0; i--) {
      var shrink = Math.min(excess, Math.max(0, sizes[i] - items[i].minHeight));
      sizes[i] -= shrink; excess -= shrink;
    }
    var positions = {}, cursor = bottom;
    items.forEach(function(item, index) {
      positions[item.id] = {bottom: cursor, height: sizes[index]};
      cursor += sizes[index] + gap;
    });
    return {positions: positions, overflow: excess};
  }
  var api = {
    scale: scale,
    stack: stack,
    effectiveScale: effectiveScale,
    size: size,
    bounds: bounds,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.Sudari = root.Sudari || {};
    root.Sudari.layout = api;
  }
})(typeof window === "object" ? window : globalThis);
