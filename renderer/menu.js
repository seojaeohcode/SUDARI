(function () {
  "use strict";
  const api = sudariAPI,
    I = Sudari.i18n;
  let cfg;
  function action(k, v) {
    if (api.menuAction) api.menuAction(k, v);
    else if (k === "language" || k === "scale") {
      cfg[k] = v;
      api.saveConfig(cfg);
    } else if (k === "settings") location.href = "settings.html";
  }
  function button(icon, key, cmd) {
    let b = document.createElement("button");
    let i = document.createElement("span");
    i.className = "icon";
    i.textContent = icon;
    let text = document.createElement("span");
    text.dataset.i18n = key;
    b.append(i, text);
    b.onclick = () => action(cmd);
    return b;
  }
  [
    ["👋", "wave", "wave"],
    ["💗", "love", "love"],
    ["🦐", "snack", "snack"],
  ].forEach((a) => document.getElementById("quick").appendChild(button(...a)));
  [
    ["▶", "start", "pomodoro-toggle"],
    ["🐚", "timer", "timer-panel"],
    ["✨", "fireworks", "fireworks"],
    ["🫣", "peek", "peek-toggle"],
    ["🙆", "stretch", "stretch"],
    ["💧", "water", "water"],
    ["🐚", "crack", "crack"],
    ["🌊", "float", "float"],
  ].forEach((a) =>
    document.getElementById("actions").appendChild(button(...a)),
  );
  [2, 3, 4, 5].forEach((size) => {
    let b = document.createElement("button");
    b.textContent = size + "×";
    b.dataset.scale = size;
    b.onclick = () => action("scale", size);
    document.getElementById("sizes").appendChild(b);
  });
  I.languages.forEach((l) => {
    let o = document.createElement("option");
    o.value = l.id;
    o.textContent = l.name;
    document.getElementById("menu-language").appendChild(o);
  });
  document.getElementById("menu-language").onchange = (e) =>
    action("language", e.target.value);
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.onclick = () => action(b.dataset.action)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") action("close");
  });
  function render(c) {
    cfg = c;
    I.set(c.language);
    I.apply();
    document.getElementById("menu-language").value = c.language;
    document
      .querySelectorAll("[data-scale]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(Number(b.dataset.scale) === c.scale),
        ),
      );
    let b = document.querySelector("#actions button");
    b.querySelector(".icon").textContent = c.pomodoro.on ? "⏹" : "▶";
    b.querySelector("[data-i18n]").textContent = I.t(
      c.pomodoro.on ? "stop" : "start",
    );
  }
  api.getConfig().then(render);
  api.onConfig(render);
})();
