# sloppy lightswitch 🌞🌚

A Firefox (desktop **and Android**) WebExtension that gives you control over
what websites see as your light/dark mode system setting
(`prefers-color-scheme`): `window.matchMedia`, CSS
`@media (prefers-color-scheme: …)` rules, `media=""` attributes on
`<source>`/`<link>`/`<style>`, and the UA's own `color-scheme` pick (form
controls, scrollbars, `light-dark()`).

Flip it globally, or per host — sloppily.

## Modes

| mode | what happens |
|---|---|
| 🖥️ `system` | nothing is touched — pages behave as if the extension weren't there |
| 🌞 `light` | the page is convinced your scheme is light |
| 🌚 `dark` | the page is convinced your scheme is dark |
| 🙃 `invert` | the opposite of your OS setting, live — flipping the OS theme still flips the page, just the wrong way around |

The popup lets you pick a **global** mode and, for the site in the current tab,
a **per-host** override (or `🌐 global` to follow the global mode again).
Per-host overrides win over the global mode.

## How it works / limitations

- The spoofing runs at `document_start`, before any page script (including
  anti-FOUC theme sniffers). `prefers-color-scheme` conditions are
  rewritten in `matchMedia` queries and in every reachable stylesheet;
  cross-origin stylesheets are refetched and swapped in.
- Everything happens in the page — network requests are untouched. The
  `Sec-CH-Prefers-Color-Scheme` client hint header (Chromium-only in
  practice; Firefox never sends it) is out of scope, so the rare site that
  themes its server-rendered HTML from that hint won't follow.
- 🫠 Sloppy edges: mode changes apply to pages on their next (re)load; rules
  a page inserts later through CSSOM (`insertRule`) aren't caught;
  `MediaQueryList.media` shows the rewritten query text; `@import`s nested
  inside refetched cross-origin sheets keep their original conditions; on
  sites with a strict `style-src` CSP the cross-origin swap-in may be
  blocked. Details in `NOTES.md`.

## Install

### Desktop (temporary, for hacking)

1. `about:debugging#/runtime/this-firefox`
2. *Load Temporary Add-on…* → pick `manifest.json`

### Android

Firefox for Android installs extensions signed by AMO. For development:

```sh
just run-android   # needs adb + a connected device with Firefox (Fenix)
```

or build an XPI (`just build`) and sign/self-distribute it via
[addons.mozilla.org](https://addons.mozilla.org).

## Development

```sh
just            # list recipes
just check      # unit tests + syntax checks (no tooling needed)
just build      # zip an XPI into dist/
just lint       # web-ext lint (via npx)
just run        # run in desktop Firefox (via npx web-ext)
```

## License

Do whatever, sloppily.
