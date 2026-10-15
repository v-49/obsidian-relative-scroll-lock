# Validation

## Evidence and scope

The original local build was tested on Windows in an isolated Obsidian 1.13.7 profile and synthetic vault on 2026-10-15. The [recorded numeric results](validation-1.0.0.json) show separate starting scroll positions and matching displacement for:

- Live Preview / Live Preview;
- Reading view / Reading view;
- Live Preview / Reading view.

Those scenarios checked locking without jumping, bidirectional movement, unlock/reposition/relock, Alt-based independent movement, a real mouse-wheel event, and command invocation. No page runtime errors were recorded. The screenshot also comes from that isolated vault.

## Public release changes

The public release keeps the relative-scroll engine and adds Chinese/English UI. It removes the preset shortcut, removes native-link changes at plugin load, and releases the lock when side-by-side panes become an unsupported layout. A native link is removed only when the user clicks Lock.

The public source has 12 automated regression tests. `npm run check` runs them and verifies the generated release assets. The minified public build was also installed in the isolated test vault and passed the same three mode combinations, mouse-wheel test, Alt adjustment, relocking, and command invocation on Windows / Obsidian 1.14.4. See the [public-build smoke results](public-build-smoke-1.0.0.json). No page runtime errors were recorded. The screenshot in the README is from this public-build run.

## Limits

Automated DOM fixtures are not real Obsidian. Real-app tests cover Windows / Obsidian 1.13.7 for the local original and Windows / Obsidian 1.14.4 for the public build, using synthetic notes. macOS, Linux, physical keyboard shortcuts, source-mode-only real-app use, large image-heavy documents, and third-party editor modifications are not certified. No performance benchmark or general cross-version compatibility claim is made.

The optional harness is `tests/real-app.cjs`. It uses Playwright against a dedicated test Obsidian instance exposing CDP on `127.0.0.1:19235`, with two panes of the synthetic `对照测试.md` file and this plugin enabled. Never point this harness at a personal working vault: it changes the test panes and their scroll positions. It is not part of the default CI test suite.
