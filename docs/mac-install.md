# 🍎 Install Sudari on a Mac

**Apple M-series: `Sudari-3.0.0-mac-arm64.dmg`. Intel: `Sudari-3.0.0-mac-x64.dmg`.** [Official downloads](https://github.com/seojaeohcode/SUDARI/releases/latest) · [한국어](mac-install.ko.md)

1. Quit any running Sudari from its menu-bar icon.
2. Open the DMG and drag **Sudari** into **Applications**, replacing the old app if present.
3. Open Sudari from Applications. Your preferences are stored separately and survive replacing the app.

## “Sudari is damaged and can't be opened”

The published v2.0.1 Mac bundle failed code-signature verification. **Replace it with v3.0.0 or later.** v3 applies an ad-hoc signature to the complete app and verifies both packaged formats.

**The app is not Developer ID-signed or Apple-notarized.** A valid ad-hoc signature checks bundle integrity; it does not establish Apple's trust or replace notarization. Gatekeeper can still block the download.

If you downloaded the app directly from this repository and trust it, first try **System Settings → Privacy & Security → Open Anyway** after attempting to launch it. [Apple's instructions](https://support.apple.com/en-gb/102445)

### If Open Anyway is unavailable or still blocks the app

Only use this exception for v3.0.0 or later downloaded directly from this repository that you trust. You can compare the downloaded file with the release's `SHA256SUMS.txt`; for an Apple Silicon DMG:

```bash
shasum -a 256 "$HOME/Downloads/Sudari-3.0.0-mac-arm64.dmg"
```

After copying the app into Applications, paste this into Terminal:

```bash
codesign --verify --deep --strict "/Applications/Sudari.app" && \
xattr -dr com.apple.quarantine "/Applications/Sudari.app" && \
open "/Applications/Sudari.app"
```

Only if signature verification succeeds, this removes the download quarantine attribute from **Sudari.app alone** and opens it. It does not disable Gatekeeper globally, affect other apps or notarize Sudari. You are explicitly choosing to trust this app.

If verification fails, subsequent commands do not run. Download the app again and [report](https://github.com/seojaeohcode/SUDARI/issues) the filename, macOS version and exact error. Managed Macs may restrict exceptions through administrator policy.

## Keyboard and scroll reactions

Use **Enable keyboard & scroll reactions** in the menu bar, grant Accessibility / Input Monitoring access, then restart. Dragging, right-click menus and the timer do not need this permission.

## What is tested

Intel and Apple Silicon CI checks DMG integrity, strict signatures after copying from DMG and extracting ZIP, and launches both packaged apps. Separate input tests cover dragging, right-click menus, typing/scroll IPC events, all 17 poses and requested sizes 2–5. These tests do not grant or verify a user's Accessibility permission.

Launching a local CI artifact does not prove that Gatekeeper allows an internet download. **Current builds are not notarized and do not pass Gatekeeper's default trust assessment.**
