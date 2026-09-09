/* New profiles and installer-language handoff; no writes to the user's profile. */
const { app, BrowserWindow } = require("electron"),
  fs = require("fs"),
  path = require("path"),
  os = require("os"),
  assert = require("assert/strict");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sudari-welcome-"));
app.setPath("userData", profile);
app.setLoginItemSettings = () => {};
if (process.argv.includes("--installer"))
  fs.writeFileSync(path.join(profile, "installer-language.txt"), "1042");
require("../main");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(f) {
  for (let n = 0; n < 150; n++) {
    if (await f()) return;
    await delay(40);
  }
  throw Error("onboarding timeout");
}
app
  .whenReady()
  .then(async () => {
    await until(() => BrowserWindow.getAllWindows().length > 0);
    let win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().endsWith("index.html"),
    );
    await until(() => {
      win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith("index.html"),
      );
      return !!win;
    });
    if (process.argv.includes("--installer")) {
      assert.equal(BrowserWindow.getAllWindows().length, 1);
      assert.equal(win.isVisible(), true);
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(profile, "config.json"), "utf8"))
          .language,
        "ko",
      );
    } else {
      let welcome;
      await until(() => {
        welcome = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith("welcome.html"),
        );
        return welcome && !welcome.webContents.isLoading();
      });
      assert.equal(win.isVisible(), false);
      const js = (c) => welcome.webContents.executeJavaScript(c);
      assert.equal(await js("document.documentElement.lang"), "en");
      assert.equal(
        await js('document.querySelectorAll(".language-option").length'),
        12,
      );
      await js('document.querySelector("[data-language=ja]").click()');
      assert.equal(await js("document.documentElement.lang"), "ja");
      await delay(100); // Let the language selection reach the compositor before capture.
    fs.mkdirSync(
        path.join(
          __dirname,
          "../test-results",
          `${process.platform}-${process.arch}`,
        ),
        { recursive: true },
      );
      fs.writeFileSync(
        path.join(
          __dirname,
          "../test-results",
          `${process.platform}-${process.arch}`,
          "welcome-ja.png",
        ),
        (await welcome.webContents.capturePage()).toPNG(),
      );
      await js('document.getElementById("meet").click()');
      await until(() => welcome.isDestroyed());
      assert.equal(win.isVisible(), true);
      let c = JSON.parse(
        fs.readFileSync(path.join(profile, "config.json"), "utf8"),
      );
      assert.equal(c.language, "ja");
      assert.equal(c.languageChosen, true);
    }
    console.log(
      "PASS: " +
        (process.argv.includes("--installer")
          ? "installer language persisted"
          : "English welcome, language selection, persisted preference, pet reveal"),
    );
    app.quit();
  })
  .catch((e) => {
    console.error(e);
    app.exit(1);
  });
setTimeout(() => app.exit(1), 30000).unref();
