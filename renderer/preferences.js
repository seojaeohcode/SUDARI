(function (g) {
  "use strict";
  const I =
    typeof module === "object" && module.exports
      ? require("./i18n")
      : g.Sudari.i18n;
  const defaults = {
    name: "",
    language: "en",
    languageChosen: false,
    scale: 2,
    pattern: "plain",
    baseColor: "#62504c",
    volume: 0.5,
    muted: false,
    sleepAfterMin: 5,
    peek: false,
    pin: "",
    launchAtLogin: false,
    reactions: { mouse: true, keyboard: true, scroll: true, pet: true },
    stretch: { on: true, everyMin: 50 },
    water: { on: true, everyMin: 60 },
    pomodoro: { on: false, focusMin: 25, breakMin: 5, rounds: 4 },
    reminders: [],
    meals: { breakfast: "", lunch: "12:30", dinner: "18:30" },
    affection: { on: true, everyMin: 40 },
    ambient: { on: true },
  };
  function normalize(value) {
    const input = value && typeof value === "object" ? value : {};
    const out = JSON.parse(JSON.stringify(defaults));
    Object.keys(defaults).forEach((k) => {
      if (input[k] !== undefined && input[k] !== null) {
        out[k] =
          typeof defaults[k] === "object" && !Array.isArray(defaults[k])
            ? Object.assign({}, defaults[k], input[k])
            : input[k];
      }
    });
    const num = (v, lo, hi, fallback) =>
      Number.isFinite(Number(v))
        ? Math.max(lo, Math.min(hi, Math.round(Number(v))))
        : fallback;
    out.language = I.normalize(out.language);
    out.languageChosen = out.languageChosen === true;
    out.scale = num(out.scale, 2, 5, 2);
    out.name = String(out.name).slice(0, 32);
    out.pin = String(out.pin).slice(0, 120);
    out.baseColor = /^#[0-9a-f]{6}$/i.test(out.baseColor)
      ? out.baseColor
      : defaults.baseColor;
    out.pattern = ["plain", "spots", "stripes", "blaze"].includes(out.pattern)
      ? out.pattern
      : "plain";
    out.volume = Number.isFinite(Number(out.volume))
      ? Math.max(0, Math.min(1, Number(out.volume)))
      : 0.5;
    ["muted", "peek", "launchAtLogin"].forEach(
      (k) => (out[k] = out[k] === true),
    );
    Object.keys(defaults.reactions).forEach(
      (k) => (out.reactions[k] = out.reactions[k] !== false),
    );
    ["stretch", "water", "affection"].forEach((k) => {
      out[k].on = out[k].on !== false;
      out[k].everyMin = num(out[k].everyMin, 5, 600, defaults[k].everyMin);
    });
    out.ambient.on = out.ambient.on !== false;
    out.sleepAfterMin = num(out.sleepAfterMin, 1, 120, 5);
    out.pomodoro.on = out.pomodoro.on === true;
    out.pomodoro.focusMin = num(out.pomodoro.focusMin, 5, 180, 25);
    out.pomodoro.breakMin = num(out.pomodoro.breakMin, 1, 60, 5);
    out.pomodoro.rounds = num(out.pomodoro.rounds, 1, 12, 4);
    const time = (v) =>
      typeof v === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v)
        ? v
        : "";
    Object.keys(defaults.meals).forEach(
      (k) => (out.meals[k] = time(out.meals[k])),
    );
    out.reminders = Array.isArray(out.reminders)
      ? out.reminders
          .filter((r) => r && time(r.time))
          .slice(0, 32)
          .map((r) => ({
            time: r.time,
            msg: String(r.msg || "").slice(0, 120),
          }))
      : [];
    return out;
  }
  const api = { defaults, normalize };
  if (typeof module === "object" && module.exports) module.exports = api;
  else g.Sudari.preferences = api;
})(typeof window === "object" ? window : globalThis);
