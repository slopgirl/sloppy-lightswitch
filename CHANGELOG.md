# Changelog

All notable changes to this project will be documented in this file.
Versioning follows [SemVer](https://semver.org/).

## [0.1.0] - 2026-08-31

### Added

- Initial release: rewrite `Sec-CH-Prefers-Color-Scheme` request header via
  blocking `webRequest`.
- Modes: `system` (passthrough), `light`, `dark`, `invert`.
- Global mode + per-host overrides, configured from the browser action popup.
- Cute day/night lightswitch icon (SVG).
- Android Firefox support (`gecko_android`, MV2, blocking webRequest).
