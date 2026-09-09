# Help a little otter grow 🦦

한국어·English 모두 환영해요. Bug reports, translations, accessibility improvements, sprite ideas and code fixes are welcome.

## Report a problem

[Open an issue](https://github.com/seojaeohcode/SUDARI/issues/new/choose) with your OS/version, CPU (Intel / Apple Silicon / x64), Sudari version, display scaling and steps to reproduce. A screenshot helps with layout problems. Please remove private text from screenshots and logs.

## Work on the code

Use Node.js 22.12 or newer. Fork the repository, create a branch, then run:

```bash
npm ci
npm start
npm test
npm run test:smoke
```

The smoke test uses a temporary profile so it does not overwrite your Sudari settings. It launches actual Electron windows and captures results in `test-results/`. On macOS, native keyboard/scroll behavior also needs a manual check with OS permissions granted.

Keep changes focused. For visual changes, include before/after images at 2× and 5×. Mention which operating systems you tested. Do not claim an untested platform works. Pull requests run Windows x64, macOS Intel and macOS Apple Silicon tests and packaging.

## Where things live

| File | Job |
| :--- | :--- |
| `main.js`, `preload.js` | Desktop windows, tray, settings, input and IPC |
| `renderer/pet.js` | Behavior, reactions and Pomodoro state |
| `renderer/layout.js` | Shared window dimensions and scaling |
| `renderer/sprite.js` | Pixel rendering, recoloring and eyes |
| `tools/gen_sprites.py` | Original sprite generator; Python + Pillow |
| `web/demo.html` | Browser preview |

Please discuss large new features in an issue first. Keep the pet quiet, local and easy to dismiss. Use original or appropriately licensed assets, and keep attribution with them. Contributions are distributed under the repository's Apache-2.0 license.

## Translations

Edit the 12-column source in `tools/build_i18n.py`, then run `python tools/build_i18n.py`. Keep interpolation tokens such as `{name}` and `{round}` unchanged. `npm test` checks that all languages contain the same keys and tokens. Test long text and right-to-left layout in the actual settings and timer. `renderer/locales.js` is generated; do not edit it directly.

## Releases

Maintainers update `package.json`, the lockfile and release notes before tagging a version. A `v*` tag builds all three platform/CPU combinations, runs Electron smoke tests at 1× and 2× display density, checks packaged resources, and publishes all six binaries plus checksums only after every job succeeds.

Release builds are currently unsigned and not notarized. Do not describe them as signed, notarized or manually tested on every supported OS version.
