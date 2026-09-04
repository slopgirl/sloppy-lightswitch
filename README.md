# sloppy lightswitch

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
| `system` | nothing is touched — pages behave as if the extension weren't there |
| `light` | the page is convinced your scheme is light |
| `dark` | the page is convinced your scheme is dark |

The popup lets you pick a **global** mode and, for the site in the current tab,
a **per-host** override (or *same as everywhere* to follow the global mode
again). Per-host overrides win over the global mode.

## Settings page

The popup only ever shows the current tab's host. The settings page shows all
of it: the global mode, every per-host switch (change or forget each one, add
new ones), and **the sloppy list** — a plain textarea with one `host mode` per
line that replaces the whole per-host list on save:

```
# lines starting with # are ignored; ":" or "=" work as separators too
blog.example.org dark
docs.example.com: light
old.example.net = system
```

Getting there:

- from the popup: *all sites, the sloppy list & more*
- desktop: `about:addons` → sloppy lightswitch → *Preferences* (opens a tab)
- Firefox for Android: *Settings → Extensions → sloppy lightswitch →
  Settings*. Firefox for Android does list browser actions under the menu's
  *Extensions* entry and opens the popup as an overlay, but the add-ons
  manager route always works — so the settings page is the fallback that
  keeps the extension configurable when the popup is out of reach.

## How it works / limitations

- The spoofing runs at `document_start`, before any page script (including
  anti-FOUC theme sniffers). `prefers-color-scheme` conditions are
  rewritten in `matchMedia` queries and in every reachable stylesheet;
  cross-origin stylesheets are refetched and swapped in.
- Everything happens in the page — network requests are untouched. The
  `Sec-CH-Prefers-Color-Scheme` client hint header (Chromium-only in
  practice; Firefox never sends it) is out of scope, so the rare site that
  themes its server-rendered HTML from that hint won't follow.
- Sloppy edges: mode changes apply to pages on their next (re)load; rules
  a page inserts later through CSSOM (`insertRule`) aren't caught;
  `MediaQueryList.media` shows the rewritten query text; `@import`s nested
  inside refetched cross-origin sheets keep their original conditions; on
  sites with a strict `style-src` CSP the cross-origin swap-in may be
  blocked. Details in `NOTES.md`.

## Install

### Desktop (temporary, for hacking)

1. `about:debugging#/runtime/this-firefox`
2. *Load Temporary Add-on…* → pick `manifest.json`. Or `just run`.

### Desktop (permanent)

Firefox release only installs signed add-ons, so sign the package at AMO with
`just sign` (unlisted self-distribution is fine) and open the resulting
`dist/*.xpi`. Alternatively use Firefox Developer Edition / Nightly with
`xpinstall.signatures.required` set to `false` and install the unsigned zip
from `just build`.

### Android (temporary, for testing)

```sh
just run-android   # needs adb + a connected device with Firefox (Fenix)
```

The Android equivalent of *Load Temporary Add-on*: the extension is pushed over
adb and loaded for that debugging session only, so it disappears when web-ext
exits or Firefox restarts. Enable *Settings → Advanced → Remote debugging via
USB* in Firefox first, and keep the `just run-android` process alive.

### Android (permanent)

Firefox for Android enforces add-on signatures and ignores
`xpinstall.signatures.required`, so a permanent install needs a signed `.xpi`.
Signing is not the same as publishing: `just sign` uses AMO's **unlisted**
channel, which hands the package to the signing service and gives it straight
back signed — no review, no listing, nothing anyone else can find. Then, on
Firefox **Nightly** for Android, enable the debug menu (*Settings → About
Firefox Nightly →* tap the logo five times) and use *Install add-on from file*
to pick the `.xpi` from `dist/`. The stable release channel refuses anything
that did not come from addons.mozilla.org, so it needs a **listed** submission
(see below). Android forks (Fennec F-Droid, IronFox) enforce signing too, so
they are not a way around this.

## Signing

`just sign` needs AMO API credentials. Create a key at
[addons.mozilla.org/developers/addon/api/key/](https://addons.mozilla.org/developers/addon/api/key/),
then `cp .env.example .env` and fill in `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET`
— the justfile loads `.env` automatically and `.env` is git-ignored. Exported
shell variables work too. Without them the recipe stops immediately, before
lint and tests run.

```sh
just sign            # unlisted: signed .xpi straight back into dist/
just sign listed     # listed: submits the version for AMO review
```

If `just sign` dies with `WebExtError: fetch failed` after *"Waiting for
approval"*, the upload already went through — AMO has the version and has very
likely signed it, and re-running `just sign` would only fail with *version
already exists*. Run `just fetch-signed` to download the finished `.xpi`
instead (`just fetch-signed 0.4.0` for a specific version).

### Publishing to AMO (listed)

Only needed to make the add-on **public** — that is what makes it installable
on the stable Firefox for Android channel, which refuses anything that did not
come from addons.mozilla.org.

`just sign listed` does the whole thing from the terminal, including creating
the add-on the first time — `--amo-metadata` exists so that a listed add-on can
be created through the API, and `amo-metadata.json` carries the fields the
listing needs. The [Developer Hub](https://addons.mozilla.org/developers/) is
where you watch the review afterwards and add the things the API cannot send
(screenshots, support links, a privacy policy).

1. `just bump 0.5.0` and update the CHANGELOG. Version numbers are unique per
   add-on across *both* channels, so a number already used for an unlisted
   signature cannot be reused for the listed submission.
2. Check `amo-metadata.json` — slug, category (`appearance`), license (`MIT`)
   and the public description. It is sent with the upload to fill in the
   listing, and is ignored for unlisted signatures.
3. `just sign listed`. This submits the version for Mozilla's review; it is a
   public submission, not a private signature.
4. Watch the review at the Developer Hub. An `<all_urls>` host permission plus
   a content script that rewrites stylesheets usually means a human reviewer
   rather than an automatic pass, so expect days rather than minutes.

Once approved the add-on is public at
`https://addons.mozilla.org/firefox/addon/sloppy-lightswitch-uwu/`, installable
on desktop and on stable Firefox for Android.

## Development

```sh
just            # list recipes
just check      # unit tests + syntax checks (no tooling needed)
just lint       # AMO linter (via npx web-ext)
just run        # temporary Firefox with the extension loaded
just icons      # re-render icons/icon-*.png from icons/icon.svg (needs librsvg)
just build      # lint + test + package into dist/
just sign       # lint + test + AMO-signed .xpi into dist/
```

Layout: `background.js` registers the content script (`content.js` +
`shared/rewrite.js`), `popup/` and `options/` are the two UI pages sharing
`shared/sloppy.css` and the settings model in `shared/settings.js`. The icon
is drawn once as `icons/icon.svg`; the manifest points at the rendered PNGs
because the Android add-ons manager (and AMO's listing) can't use SVG.

Sources live at the repo root, so the package is defined by an ignore list in
the justfile (`test/`, `tools/`, `*.md`, `justfile`, `amo-metadata.json`) that
`lint`, `run`, `build` and `sign` all share — what gets tested is what gets
signed.

## License

MIT — do whatever, sloppily. See [LICENSE](LICENSE).
