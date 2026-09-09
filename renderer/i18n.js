(function (g) {
  "use strict";
  const data =
    typeof module === "object" && module.exports
      ? require("./locales")
      : g.SudariLocales;
  let language = "en";
  const api = {
    languages: data.languages,
    messages: data.messages,
    normalize: (value) => (data.messages[value] ? value : "en"),
    set(value) {
      language = api.normalize(value);
      return language;
    },
    get: () => language,
    t(key, values, locale) {
      const text =
        data.messages[api.normalize(locale || language)][key] ||
        data.messages.en[key] ||
        key;
      return text.replace(/\{(\w+)\}/g, (token, name) =>
        values && values[name] !== undefined ? String(values[name]) : token,
      );
    },
    apply(root = document) {
      const info = data.languages.find((l) => l.id === language);
      document.documentElement.lang = language;
      document.documentElement.dir = info.dir;
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = api.t(el.dataset.i18n);
      });
      root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.placeholder = api.t(el.dataset.i18nPlaceholder);
      });
      root.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.title = api.t(el.dataset.i18nTitle);
        el.setAttribute("aria-label", el.title);
      });
    },
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    g.Sudari = g.Sudari || {};
    g.Sudari.i18n = api;
  }
})(typeof window === "object" ? window : globalThis);
