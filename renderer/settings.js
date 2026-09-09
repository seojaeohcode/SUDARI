/* All settings save immediately and share one translated, validated configuration. */
(function () {
  "use strict";
  const S = window.Sudari,
    I = S.i18n,
    api = window.sudariAPI,
    $ = (id) => document.getElementById(id);
  let cfg,
    sprite,
    epoch = 0,
    last = performance.now(),
    frame = 0,
    elapsed = 0;
  const PRESETS = [
    "#62504c",
    "#925f3f",
    "#4a3b36",
    "#c48a52",
    "#8d8a86",
    "#e6dccb",
    "#d9a3ad",
    "#7fa6a3",
  ];
  const bindings = {
    name: "name",
    pin: "pin",
    language: "language",
    baseColor: "baseColor",
    pattern: "pattern",
    scale: "scale",
    volume: "volume",
    muted: "muted",
    sleepAfterMin: "sleepAfterMin",
    launchAtLogin: "launchAtLogin",
    peek: "peek",
    "r-mouse": "reactions.mouse",
    "r-keyboard": "reactions.keyboard",
    "r-scroll": "reactions.scroll",
    "r-pet": "reactions.pet",
    "stretch-on": "stretch.on",
    "stretch-min": "stretch.everyMin",
    "water-on": "water.on",
    "water-min": "water.everyMin",
    "pomo-on": "pomodoro.on",
    "pomo-focus": "pomodoro.focusMin",
    "pomo-break": "pomodoro.breakMin",
    "pomo-rounds": "pomodoro.rounds",
    "meal-breakfast": "meals.breakfast",
    "meal-lunch": "meals.lunch",
    "meal-dinner": "meals.dinner",
    "aff-on": "affection.on",
    "aff-min": "affection.everyMin",
    "ambient-on": "ambient.on",
  };
  function get(path) {
    return path.split(".").reduce((o, k) => o[k], cfg);
  }
  function set(path, v) {
    let keys = path.split("."),
      key = keys.pop(),
      o = keys.reduce((o, k) => o[k], cfg);
    o[key] = v;
  }
  function save() {
    cfg = S.preferences.normalize(cfg);
    api.saveConfig(cfg);
  }
  async function load() {
    const e = ++epoch,
      s = await S.Sprite.load(
        "../assets",
        cfg.pattern,
        SUDARI_ATLAS,
        SUDARI_PALETTE,
      );
    if (e === epoch) {
      sprite = s;
      sprite.recolor(S.derivePalette(cfg.baseColor));
    }
  }
  function buildTabs() {
    const sections = [...document.querySelectorAll(".settings section")];
    sections[0].classList.add("language-bar");
    const nav = document.createElement("nav");
    nav.className = "settings-tabs";
    nav.setAttribute("role", "tablist");
    sections[0].after(nav);
    sections.slice(1).forEach((section, i) => {
      const heading = section.querySelector("h2");
      const key = heading.querySelector("[data-i18n]").dataset.i18n;
      section.id = "section-" + key;
      section.classList.add("settings-panel");
      section.setAttribute("role", "tabpanel");
      section.setAttribute("aria-labelledby", "tab-" + key);
      section.hidden = i !== 0;
      const button = document.createElement("button");
      button.id = "tab-" + key;
      button.className = "settings-tab";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", section.id);
      button.setAttribute("aria-selected", String(i === 0));
      button.innerHTML = heading.innerHTML;
      button.onclick = () => {
        nav
          .querySelectorAll("button")
          .forEach((b) =>
            b.setAttribute("aria-selected", String(b === button)),
          );
        sections.slice(1).forEach((s) => (s.hidden = s !== section));
      };
      nav.appendChild(button);
    });
  }
  function option(select, value, label) {
    let o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  }
  function translate() {
    I.set(cfg.language);
    I.apply();
    document.title = I.t("settings") + " · Sudari";
    $("pattern").replaceChildren();
    ["plain", "spots", "stripes", "blaze"].forEach((k) =>
      option($("pattern"), k, I.t(k)),
    );
    $("pattern").value = cfg.pattern;
    renderSwatches();
    renderReminders();
  }
  function sync() {
    Object.entries(bindings).forEach(([id, path]) => {
      const el = $(id);
      if (document.activeElement === el) return;
      if (el.type === "checkbox") el.checked = get(path);
      else el.value = get(path);
    });
  }
  function renderSwatches() {
    $("swatches").replaceChildren();
    PRESETS.forEach((color) => {
      let b = document.createElement("button");
      b.className = "sw" + (color === cfg.baseColor ? " on" : "");
      b.style.background = color;
      b.setAttribute("aria-label", I.t("color") + " " + color);
      b.setAttribute("aria-pressed", String(color === cfg.baseColor));
      b.onclick = () => {
        cfg.baseColor = color;
        save();
        sync();
        if (sprite) sprite.recolor(S.derivePalette(color));
        renderSwatches();
      };
      $("swatches").appendChild(b);
    });
  }
  function renderReminders() {
    $("reminders").replaceChildren();
    cfg.reminders.forEach((r, i) => {
      let row = document.createElement("div");
      row.className = "rem";
      let time = document.createElement("input");
      time.type = "time";
      time.value = r.time;
      time.setAttribute("aria-label", I.t("reminders"));
      let msg = document.createElement("input");
      msg.type = "text";
      msg.value = r.msg;
      msg.maxLength = 120;
      msg.setAttribute("aria-label", I.t("reminderText"));
      let del = document.createElement("button");
      del.className = "ui-button";
      del.textContent = "×";
      del.setAttribute("aria-label", I.t("remove"));
      time.onchange = () => {
        cfg.reminders[i].time = time.value;
        save();
      };
      msg.oninput = () => {
        cfg.reminders[i].msg = msg.value;
        save();
      };
      del.onclick = () => {
        cfg.reminders.splice(i, 1);
        save();
        renderReminders();
      };
      row.append(time, msg, del);
      $("reminders").appendChild(row);
    });
    $("rem-add").disabled = cfg.reminders.length >= 32;
  }
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (sprite) {
      let c = $("prev"),
        ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      elapsed += dt;
      let a = sprite.anim("idle");
      if (elapsed > 1 / a.fps) {
        elapsed = 0;
        frame = (frame + 1) % a.count;
      }
      sprite.begin();
      sprite.blitFrame("idle", frame);
      sprite.drawEyes("idle", frame, {
        gaze: [0, 0],
        lid: t % 4100 > 3950 ? 1 : 0,
      });
      sprite.present(ctx, 0, 0, 2, false);
    }
    requestAnimationFrame(loop);
  }
  api.getConfig().then((c) => {
    cfg = S.preferences.normalize(c);
    I.languages.forEach((l) => option($("language"), l.id, l.name));
    [2, 3, 4, 5].forEach((v) => option($("scale"), v, v + "×"));
    buildTabs();
    translate();
    sync();
    Object.entries(bindings).forEach(([id, path]) => {
      const el = $(id);
      el.addEventListener(
        ["text", "range", "color"].includes(el.type) ? "input" : "change",
        () => {
          const before = cfg.pattern;
          let v =
            el.type === "checkbox"
              ? el.checked
              : ["number", "range"].includes(el.type) || id === "scale"
                ? Number(el.value)
                : el.value;
          set(path, v);
          if (id === "language") {
            cfg.languageChosen = true;
            translate();
          }
          save();
          if (id === "baseColor") {
            if (sprite) sprite.recolor(S.derivePalette(cfg.baseColor));
            renderSwatches();
          }
          if (before !== cfg.pattern) load();
          sync();
        },
      );
    });
    $("rem-add").onclick = () => {
      if (!$("rem-time").value || cfg.reminders.length >= 32) return;
      cfg.reminders.push({
        time: $("rem-time").value,
        msg: $("rem-msg").value,
      });
      save();
      $("rem-msg").value = "";
      renderReminders();
    };
    $("close").onclick = () => api.closeSettings();
    $("hi").onclick = () => api.runCommand("wave");
    $("reset").onclick = async () => {
      if (!confirm(I.t("resetConfirm"))) return;
      cfg = await api.resetConfig();
      translate();
      sync();
      load();
    };
    api.onConfig((c) => {
      let old = cfg;
      cfg = S.preferences.normalize(c);
      if (cfg.language !== old.language) translate();
      sync();
      if (cfg.pattern !== old.pattern) load();
      else if (sprite) sprite.recolor(S.derivePalette(cfg.baseColor));
    });
    load();
    requestAnimationFrame(loop);
  });
})();
