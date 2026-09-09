# v2 / v3 validation scope

The release workflow builds and tests Windows x64, macOS x64 and macOS arm64 independently. Publishing waits for all three jobs. Native Electron tests use temporary profiles and do not change the user's login settings.

- Preference normalization, 12 complete locales and matching interpolation tokens.
- Monitor offsets, feet/center preservation, requested scales 2–5 and automatic fitting on smaller screens.
- Native Electron rendering at standard and Retina density; additional local Windows checks at 125% and 150%. Windows can round native outer bounds by up to two logical pixels at fractional density; renderer geometry is checked separately.
- v2.0.1: measure simultaneous notes, long speech and timer/editor bounds with 8px gaps across all 12 locales and 17 poses. Check compact focus/break badges for overflow and overlap. Capture both timer and editor layouts at every requested size.
- Click the actual shell, edit timer values, move the native window and verify that the active timer deadline is preserved.
- Focus → break → completion transitions, hidden timer hit testing, all 12 languages in menus/settings, long labels and Arabic RTL.
- English first launch, selecting another language, persistence and reveal of the pet; Windows installer language-file handoff.
- Packaged artwork, locale files, renderer pages, native input-hook CPU prebuilds and bundled documentation.

Local visual review includes the actual Electron captures and the browser playground, language picker, context menu and settings. CI captures are retained as workflow artifacts. macOS automated coverage runs on macOS 15 Intel and Apple Silicon; this is not a manual test of every supported macOS version or a verification of an individual user's Accessibility permission. Windows binaries are unsigned; v3 Mac binaries are ad-hoc signed and not notarized.

## v3 distribution and input regression

- Reproduce the v2.0.1 Apple Silicon signature failure from the published ZIP.
- Verify strict bundle signatures in the new ZIP and the app copied from DMG; verify DMG checksums and matching CPU. Launch both installed apps and retain screenshots.
- Ad-hoc signing repairs bundle integrity, but does not provide Developer ID trust or notarization. Gatekeeper assessment remains rejected and is retained in the report. No test disables Gatekeeper globally.
- Exercise native Electron mouse events and the same typing/scroll IPC used by the input hooks across 17 poses and sizes 2–5, during dragging and after right-click menus/settings. Verify recovery from lost capture and missed pointer releases. These tests do not verify personal Accessibility permissions.
