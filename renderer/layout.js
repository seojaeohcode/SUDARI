/* Shared logical-pixel layout for Electron and the browser demo. */
(function (root) {
  'use strict';
  function scale(value) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.max(2, Math.min(5, Math.round(n))) : 2;
  }
  function size(value) {
    var s = scale(value);
    // Sprite + FX, scaled shell, speech bubble and jumping headroom.
    return { width: Math.max(320, 104 * s), height: 110 * s + 80 };
  }
  function bounds(previous, value, area, peek) {
    var s = scale(value), next = size(s);
    var x = previous.x + (previous.width - next.width) / 2;
    var y = previous.y + previous.height - next.height;
    x = peek ? area.x + area.width - next.width / 2 + 12 * s
      : Math.max(area.x, Math.min(x, area.x + area.width - next.width));
    y = Math.max(area.y, Math.min(y, area.y + area.height - next.height + 2));
    return { x: Math.round(x), y: Math.round(y), width: next.width, height: next.height };
  }
  var layout = { scale: scale, size: size, bounds: bounds };
  if (typeof module === 'object' && module.exports) module.exports = layout;
  else { root.Sudari = root.Sudari || {}; root.Sudari.layout = layout; }
})(typeof window === 'object' ? window : globalThis);
