const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const [platform, arch] = process.argv.slice(2);
const resources = platform === 'win' ? 'dist/win-unpacked/resources'
  : `dist/mac${arch === 'arm64' ? '-arm64' : ''}/Sudari.app/Contents/Resources`;
const archive = path.join(resources, 'app.asar');
const pkg = JSON.parse(asar.extractFile(archive, 'package.json'));
assert.equal(pkg.version, require('../package.json').version);
for (const file of ['main.js', 'preload.js', 'renderer/layout.js', 'renderer/pet.js',
  'renderer/style.css', 'renderer/locales.js', 'renderer/i18n.js', 'renderer/preferences.js', 'renderer/menu.html', 'renderer/menu.js', 'renderer/welcome.html', 'renderer/settings.html', 'assets/timer-shell-focus.svg', 'assets/timer-shell-break.svg', 'assets/welcome.png', 'assets/atlas.js', 'assets/sudari_plain.png']) {
  assert.ok(asar.extractFile(archive, file).length, `Missing ${file}`);
}
const native = platform === 'mac' ? `darwin-${arch}` : `win32-${arch}`;
const prebuild = path.join(resources, 'app.asar.unpacked/node_modules/uiohook-napi/prebuilds', native);
assert.ok(fs.readdirSync(prebuild).some((name) => name.endsWith('.node')), `Missing ${native} input hook`);
if (platform === 'win') assert.ok(fs.existsSync(path.join(resources, 'app.asar.unpacked/tools/input_hook.ps1')));
for (const file of ['README.md', 'README.en.md', 'CONTRIBUTING.md', 'LICENSE',
  'docs/banner.svg', 'docs/guide.ko.md', 'docs/releases/2.0.0.md', 'docs/reel.gif']) {
  assert.ok(fs.existsSync(path.join(resources, file)), `Missing bundled documentation: ${file}`);
}
console.log(`PASS: packaged ${pkg.version}, ${platform}/${arch}, renderer, sprites, native input hook, README`);
