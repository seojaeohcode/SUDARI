const { test } = require("node:test");
const assert = require("node:assert/strict");
const I = require("../renderer/i18n");
const P = require("../renderer/preferences");
test("12 complete locales with matching placeholders", () => {
  assert.equal(I.languages.length, 12);
  let keys = Object.keys(I.messages.en).sort();
  for (const l of I.languages) {
    assert.deepEqual(Object.keys(I.messages[l.id]).sort(), keys);
    for (const k of keys) {
      let s = I.messages[l.id][k];
      assert.ok(s.length > 0, `${l.id}:${k}`);
      assert.deepEqual(
        (s.match(/\{\w+\}/g) || []).sort(),
        (I.messages.en[k].match(/\{\w+\}/g) || []).sort(),
        `${l.id}:${k}`,
      );
    }
  }
});
test("first launch defaults to English and choice persists", () => {
  assert.equal(P.normalize({}).language, "en");
  assert.equal(P.normalize({}).languageChosen, false);
  for (const l of I.languages) {
    let c = P.normalize({ language: l.id, languageChosen: true });
    assert.deepEqual(P.normalize(JSON.parse(JSON.stringify(c))), c);
  }
});
test("invalid preferences cannot break layout, timers or reminder rendering", () => {
  let c = P.normalize({
    scale: Infinity,
    language: "bad",
    volume: -4,
    pattern: "../../bad",
    baseColor: "red",
    pomodoro: { focusMin: 999, breakMin: -3, rounds: NaN },
    reminders: [null, { time: "25:80" }, { time: "12:30", msg: "hello" }],
    meals: { lunch: "bad" },
  });
  assert.equal(c.scale, 2);
  assert.equal(c.language, "en");
  assert.equal(c.volume, 0);
  assert.equal(c.pattern, "plain");
  assert.equal(c.pomodoro.focusMin, 180);
  assert.equal(c.pomodoro.breakMin, 1);
  assert.equal(c.pomodoro.rounds, 4);
  assert.equal(c.reminders.length, 1);
  assert.equal(c.meals.lunch, "");
});
