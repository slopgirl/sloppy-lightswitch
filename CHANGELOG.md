# Changelog

All notable changes to this project will be documented in this file.
Versioning follows [SemVer](https://semver.org/).

## [0.4.0] - 2026-08-31

### Changed

- **Add-on ID is now `sloppylightswitch@macroslop.dev`** (was the generic
  `slopgirl@macroslop.dev`). AMO binds an ID to one add-on permanently, so it
  had to be per-add-on before the first upload. Anyone who loaded a pre-0.4.0
  unsigned build has a stale entry under the old ID.
- `just build` packages via `web-ext` instead of a hand-rolled `zip`, sharing
  one ignore list with `lint`/`run`/`sign` — so the tested package and the
  signed package are the same package. Output is `dist/*.zip`, not
  `dist/*.xpi`; the `.xpi` now comes from `just sign`.

### Added

- AMO signing and publishing: `just sign [unlisted|listed]`, credentials from
  a git-ignored `.env` (`.env.example` as template), `just fetch-signed` to
  recover an `.xpi` when signing loses the connection while waiting for
  approval, and `just bump` for the manifest version.
- `amo-metadata.json` with the public listing (slug `sloppy-lightswitch-uwu`,
  category `appearance`, MIT, description/summary), sent with listed uploads.
- `LICENSE` (MIT) — a listed AMO submission needs a declared license.

## [0.3.0] - 2026-08-31

### Removed

- The `Sec-CH-Prefers-Color-Scheme` header rewriting layer, and with it the
  `webRequest`/`webRequestBlocking` permissions. Firefox never sends the
  client hint natively and next to nothing consumes it; the client-side
  spoofing from 0.2.0 is what actually flips sites. Sites theming
  server-rendered HTML from that hint are out of scope now.

## [0.2.0] - 2026-08-31

### Added

- Client-side scheme spoofing, so sites that theme in the browser (not just
  server-side header readers) follow the chosen mode:
  - `window.matchMedia` patched in the page's world (via
    `exportFunction`), rewriting `prefers-color-scheme` queries before the
    real implementation sees them.
  - CSS `@media`/`@import` conditions rewritten in all reachable
    stylesheets; cross-origin sheets are refetched (host permissions beat
    CORS), URL-absolutified, and swapped in.
  - `media=""` attributes rewritten on `<source>`, `<link>`, `<style>`
    (initial sweep + MutationObserver).
  - UA `color-scheme` pinned on the root element when the page declares
    support for both schemes.
- Content script registered dynamically (`contentScripts.register`) with
  settings embedded, so it runs synchronously at `document_start` — no
  async storage race against the page's theme-sniffing scripts.
- Unit tests for the media-condition rewriting (`just test` / `just check`).
- Popup hint that open pages pick up mode changes on reload.

## [0.1.0] - 2026-08-31

### Added

- Initial release: rewrite `Sec-CH-Prefers-Color-Scheme` request header via
  blocking `webRequest`.
- Modes: `system` (passthrough), `light`, `dark`, `invert`.
- Global mode + per-host overrides, configured from the browser action popup.
- Cute day/night lightswitch icon (SVG).
- Android Firefox support (`gecko_android`, MV2, blocking webRequest).
