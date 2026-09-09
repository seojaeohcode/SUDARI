(function () {
  "use strict";
  const I = Sudari.i18n;
  let selected = "en";
  const box = document.getElementById("languages");
  function update() {
    I.set(selected);
    I.apply();
    box
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.language === selected)),
      );
  }
  I.languages.forEach((l) => {
    let b = document.createElement("button");
    b.className = "language-option";
    b.textContent = l.name;
    b.lang = l.id;
    b.dir = l.dir;
    b.dataset.language = l.id;
    b.onclick = () => {
      selected = l.id;
      update();
    };
    box.appendChild(b);
  });
  document.getElementById("meet").onclick = async function () {
    this.disabled = true;
    try {
      await sudariAPI.completeWelcome(selected);
    } catch (e) {
      this.disabled = false;
      console.error(e);
    }
  };
  update();
})();
