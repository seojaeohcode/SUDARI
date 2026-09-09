/* Readable browser preview, with the same preferences and no desktop side effects. */
(function () {
  if (window.sudariAPI) return;
  const S = window.Sudari;
  let listeners = [];
  const read = () => {
    try {
      return S.preferences.normalize(
        JSON.parse(localStorage.getItem("sudari-v2") || "{}"),
      );
    } catch (_) {
      return S.preferences.normalize({});
    }
  };
  window.sudariAPI = {
    getConfig: async () => read(),
    saveConfig: (c) => {
      localStorage.setItem("sudari-v2", JSON.stringify(c));
      listeners.forEach((f) => f(c));
    },
    onConfig: (f) => listeners.push(f),
    resetConfig: async () => {
      let c = S.preferences.normalize({
        language: read().language,
        languageChosen: true,
      });
      window.sudariAPI.saveConfig(c);
      return c;
    },
    completeWelcome: async (language) => {
      let c = Object.assign(read(), { language, languageChosen: true });
      window.sudariAPI.saveConfig(c);
      location.href = "settings.html";
      return c;
    },
    closeSettings: () => {
      location.href = "../web/demo.html";
    },
    runCommand: () => {},
  };
})();
