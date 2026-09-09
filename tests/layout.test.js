const { test } = require('node:test');
const assert = require('node:assert/strict');
const layout = require('../renderer/layout');

test('resizing preserves the feet and horizontal center on an offset monitor', () => {
  const area = { x: -1920, y: -200, width: 1920, height: 1080 };
  let previous = { x: -1100, y: 570, width: 320, height: 300 };
  for (const scale of [3, 4, 5, 2, 5, 2]) {
    const next = layout.bounds(previous, scale, area, false);
    assert.equal(next.y + next.height, previous.y + previous.height);
    assert.equal(next.x + next.width / 2, previous.x + previous.width / 2);
    previous = next;
  }
});

test('monitor changes bring the entire pet window back into the work area', () => {
  const area = { x: 100, y: 24, width: 1280, height: 720 };
  for (const scale of [2, 3, 4, 5]) {
    const b = layout.bounds({ x: -1900, y: 4000, width: 320, height: 300 }, scale, area);
    assert.ok(b.x >= area.x && b.x + b.width <= area.x + area.width);
    assert.ok(b.y >= area.y && b.y + b.height <= area.y + area.height + 2);
  }
});

test('peek keeps the same amount of otter beyond the screen at every size', () => {
  const area = { x: -1920, y: 0, width: 1920, height: 1080 };
  for (const scale of [2, 3, 4, 5]) {
    const b = layout.bounds({ x: -500, y: 300, width: 320, height: 300 }, scale, area, true);
    assert.equal(b.x + b.width / 2, 12 * scale);
  }
});

test('invalid saved scales cannot create NaN or unsupported window sizes', () => {
  for (const input of [undefined, 'oops', Infinity, NaN, -1, 0, 30, '4']) {
    const s = layout.scale(input);
    assert.ok(Number.isInteger(s) && s >= 2 && s <= 5);
    assert.ok(layout.size(input).height <= 912);
  }
});
