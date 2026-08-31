# Changelog

All notable changes to this project will be documented in this file.
Versioning follows [SemVer](https://semver.org/).

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
