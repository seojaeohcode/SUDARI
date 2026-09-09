<p align="center"><img src="docs/banner.svg" width="100%" alt="SUDARI — A little otter. A little better day."></p>

<p align="center"><b>A tiny pixel otter that lives on your desktop.</b><br>
It follows your cursor, kneads while you type, and keeps you company through one more focus session.</p>

<p align="center"><a href="README.md">한국어</a> · <b>English</b> · <a href="https://github.com/seojaeohcode/SUDARI/releases/latest">Download</a> · <a href="CONTRIBUTING.md">Contribute</a></p>

<p align="center">
<a href="https://github.com/seojaeohcode/SUDARI/releases/latest"><img src="https://img.shields.io/github/v/release/seojaeohcode/SUDARI?style=flat&amp;color=438778" alt="Latest release"></a>
<a href="https://github.com/seojaeohcode/SUDARI/actions/workflows/release.yml"><img src="https://github.com/seojaeohcode/SUDARI/actions/workflows/release.yml/badge.svg" alt="Build and tests"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-9c88bd" alt="Apache 2.0 license"></a>
</p>

<p align="center"><img src="docs/reel.gif" height="220" alt="Sudari waves, types, cracks shells, floats and falls asleep"></p>
<p align="center"><sub>No account. No subscription. Just a little otter with a shell to share.</sub></p>

## 🐚 Bring an otter home

| Your computer | Download v1.1.0 |
| :--- | :--- |
| Windows 10 / 11 · x64 | [Installer](https://github.com/seojaeohcode/SUDARI/releases/download/v1.1.0/Sudari-1.1.0-Setup.exe) · [Portable](https://github.com/seojaeohcode/SUDARI/releases/download/v1.1.0/Sudari-1.1.0-Portable.exe) |
| Mac · Apple Silicon (M series) | [DMG](https://github.com/seojaeohcode/SUDARI/releases/download/v1.1.0/Sudari-1.1.0-mac-arm64.dmg) |
| Mac · Intel | [DMG](https://github.com/seojaeohcode/SUDARI/releases/download/v1.1.0/Sudari-1.1.0-mac-x64.dmg) |

macOS 12 or later. ZIP alternatives and SHA-256 checksums are on the [release page](https://github.com/seojaeohcode/SUDARI/releases/latest). No Node.js or Python needed to use the app. In-app dialogue and settings are currently in Korean.

**Windows:** run the installer or portable EXE. Builds are unsigned, so SmartScreen may ask for confirmation. Check that your download comes from this repository before choosing **More info → Run anyway**.

**Mac:** open the DMG and drag Sudari into Applications. Builds are not Apple-notarized; if macOS blocks the first launch, use **System Settings → Privacy & Security → Open Anyway** after checking the source. Keyboard and scroll reactions need Accessibility / Input Monitoring permission. Choose **키보드·스크롤 반응 켜기** in the menu bar, grant access, then restart Sudari. The other features work without these permissions.

Right-click the otter or use its tray / menu-bar icon for settings, size, the timer and Quit.

## A small friend for your working day

| You… | Sudari… |
| :--- | :--- |
| Move the mouse | Follows it with its eyes. Rub its head for happy eyes and hearts. |
| Type or scroll | Kneads a tiny keyboard or cracks a shell on its belly. |
| Need a little focus | Offers a shell-shaped Pomodoro timer, breaks and a fireworks finish. |
| Forget to take a break | Reminds you to drink water, stretch and eat. |
| Finish an AI task | Celebrates when your tool sends a local completion signal. |
| Just want company | Waves, snacks, floats, naps and occasionally says something kind. |

<p align="center"><img src="docs/animations.png" width="900" alt="Seventeen original pixel otter animations"></p>

**Make it yours:** eight fur presets, a custom color picker, four patterns, sizes 2×–5×, your name in dialogue, a pinned note and optional reminders. Drag the otter to move it. Peek mode tucks it against the screen edge.

<p align="center"><img src="docs/palette.png" width="900" alt="Eight fur colors, from brown and gold to pink and mint"></p>

**New in 1.1.0:** the Pomodoro shell, its text and click target grow with the otter. The desktop window leaves room for the larger pet, timer and speech bubbles. Windows, Apple Silicon and Intel builds pass separate CI jobs. [Release notes](docs/releases/1.1.0.md).

## 🤖 Give your AI a tiny cheerleader

Call these local endpoints from your tool's start/finish hooks:

```bash
curl --max-time 1 http://127.0.0.1:37421/thinking
curl --max-time 1 http://127.0.0.1:37421/done
```

Use `curl.exe` in Windows PowerShell. Works with tools that can run a command at task start or completion. Integration is optional; no AI account is needed for Sudari itself. [Claude Code hook example](docs/guide.ko.md#-ai-에이전트-연동).

## 🔒 Your desktop stays yours

Sudari's input handler counts key presses and scroll events; it does not store typed text or key codes. The native hook receives OS input events, while the app uses only activity signals. Settings stay in a local JSON file. The app sends no analytics or telemetry and only listens on loopback (`127.0.0.1`) for optional AI signals.

| OS | Settings file |
| :--- | :--- |
| Windows | `%APPDATA%\sudari\config.json` |
| macOS | `~/Library/Application Support/sudari/config.json` |

## 🛠 Make something with Sudari

```bash
git clone https://github.com/seojaeohcode/SUDARI.git
cd SUDARI
npm ci
npm start
npm test
npm run test:smoke
```

Node.js 22.12+ required. Build on Windows with `npm run dist`; on macOS with `npm run dist:mac`. Python + Pillow are only needed to regenerate sprites. Open `web/demo.html` for a local browser preview using the same animation engine.

The sprite generator, artwork and code are all included under [Apache-2.0](LICENSE). [Contributions](CONTRIBUTING.md), [bug reports](https://github.com/seojaeohcode/SUDARI/issues/new/choose), translations and new otter ideas are welcome.

<p align="center"><b>If Sudari makes your day a little softer, leave a ⭐ and help another otter find a home.</b><br><sub>Inspired by the pixel cat at comnyang.com. Original otter artwork and implementation.</sub></p>
