# NOTES (for future me)

## Decisions (0.5.0, settings page + sloppy UI)

- **`options_ui` with `open_in_tab: true` is the Android escape hatch.**
  Firefox for Android does support browser-action popups (menu → Extensions →
  the add-on; opens as an overlay), but in practice they are hit and miss and
  can't be inspected with devtools (bug 1637616). The options page is reachable
  from the add-ons manager on every platform (Android: Settings → Extensions →
  add-on → Settings), so it carries the *full* UI, not just extras. If the
  popup ever needs debugging on Android: temporarily point `default_popup` at
  a tab-opened page.
- **The sloppy list is the fallback of the fallback**: a textarea that
  survives any CSS/JS layout trouble on tiny screens. Parser is forgiving
  (`host mode`, `host: mode`, `host = mode`, pasted URLs, comments) and
  strict about the mode. Saving *replaces* the whole per-host list — simpler
  to reason about than merging. The textarea is only refreshed from storage
  while its content still matches what was last loaded, so edits are never
  eaten by a change made in the popup.
- **PNG icons in the manifest, SVG as the source.** The Android add-ons
  manager decodes icons with Android's own image stack, which has no SVG, and
  AMO's listing icon must be PNG/JPG as well — so the SVG alone showed nothing
  on the phone. `just icons` renders all sizes with `rsvg-convert`; the SVG
  stays in the package because the two HTML pages use it in their header.
  The AMO *listing* icon is uploaded separately in the Developer Hub (use
  `icons/icon-128.png`).
- **Tags track AMO, nothing else.** A `vX.Y.Z` tag exists only for versions
  that were uploaded to addons.mozilla.org (v0.4.0, v0.5.0 so far); the
  never-published 0.1.0–0.3.0 tags were deleted. Reference older states by
  commit hash.
- **`invert` is gone.** It was the one mode that had to keep tracking the OS
  (special cases in the rewriter, the observer loop guards, the UA pin), and
  nobody needs "the wrong theme, live". `sanitize()` in `shared/settings.js`
  maps old stored values back to `system`/dropped, and background writes the
  cleaned shape back once on startup.
- **`shared/settings.js` is loaded as a plain script** (background via the
  manifest's `scripts` array, pages via `<script>`), same IIFE-on-globalThis
  pattern as `rewrite.js`, so the node tests can `require()` it.
- **The UI pages follow the global mode.** All palette tokens in
  `sloppy.css` are `light-dark()` pairs, so the whole theme is switched by
  `color-scheme` on the root: `applyScheme()` sets `data-scheme` to
  light/dark (pinned) or removes it (`light dark`, i.e. the OS). No second
  copy of the palette, and form controls follow along. Per-host overrides
  deliberately don't affect the pages — global only. The accent is the sun's
  yellow (`--accent`), not the old salmon pink, and there is no red at all
  (user request): the remove button and error text are plain ink.
- **No emoji anywhere in the UI** (user request). Glyphs are inline SVG
  `<symbol>`s duplicated in both HTML files; the sloppy look is CSS only
  (uneven `border-radius` pairs, slight rotations, a marker-ish font stack
  that falls back to the system sans on Android). No webfonts.

## Decisions (0.4.0, AMO signing)

- **Add-on ID is per-add-on** (`sloppylightswitch@macroslop.dev`), not the
  account-wide `slopgirl@macroslop.dev` it started as. AMO binds an ID to one
  add-on forever, so a generic ID would have burned the name for every future
  slopgirl extension. Changed before the first upload; after that it is
  unchangeable.
- **Packaging is a deny-list, not an allow-list.** Sources live at the repo
  root (no `src/`, unlike sloppy redirect), and `web-ext sign` always packages
  the whole `--source-dir`. So `just build` had to stop hand-picking files with
  `zip` — otherwise the tested package and the signed package could drift. The
  `ignore` variable in the justfile is the one definition, shared by lint, run,
  build and sign. Verify with `unzip -l dist/*.zip` after adding a top-level
  file.
- **Unlisted is the default channel.** Signing ≠ publishing: unlisted hands
  back a signed `.xpi` with no review, which is all that Firefox Nightly for
  Android (debug menu → *Install add-on from file*) and desktop release need.
  `just sign listed` is the public submission, and only that gets the add-on
  onto stable Firefox for Android.
- **`amo-metadata.json` is listed-only.** AMO ignores it for unlisted uploads,
  so the justfile only passes `--amo-metadata` on the listed channel.
- **MIT, with a LICENSE file.** A listed submission has to declare a license
  and AMO's picker is narrower than SPDX; MIT is the closest supported thing
  to the README's "do whatever, sloppily", and matches sloppy redirect.
- **`tools/amo-fetch-signed.py` exists because `web-ext sign` is flaky at the
  "waiting for approval" step**: the upload lands, the connection drops, and a
  retry then fails with *version already exists*. The script mints its own JWT
  against AMO's v5 API and downloads the finished file instead.
- Credentials live in a git-ignored `.env` loaded by just, never in the shell
  profile. `_amo-creds` checks them *before* lint and tests so a missing key
  fails in a second, not a minute. `.amo-upload-uuid` (written by web-ext into
  the source dir) is git-ignored too.

## Decisions (0.3.0)

- **Header layer removed.** 0.1.0's whole point was rewriting
  `Sec-CH-Prefers-Color-Scheme` via blocking webRequest, but Firefox never
  sends that client hint and virtually no site consumes it — the 0.2.0
  client-side spoofing is what actually flips pages. Dropped it (with the
  `webRequest`/`webRequestBlocking` permissions) on request. If it's ever
  wanted again, `git show e6e75df:background.js` has the implementation;
  the header-specific 0.1.0 notes below are historical now.

## Decisions (0.1.0, still current)

- **MV2, not MV3**: Firefox supports both indefinitely; MV2 with a persistent
  background page is the simplest thing that works on Fenix (Android). A
  migration is possible but not urgent.
- **`system` = do nothing**: behave exactly as if the extension weren't
  installed (the content script bails out early).
- Per-host key is the exact `URL.hostname` — no `www.` normalization, no
  eTLD+1 grouping. Predictable, if a bit sloppy.
- `data_collection_permissions: { required: ["none"] }` is in the manifest —
  required by AMO for new submissions since late 2025.
- Slopified from birth: identity `slopgirl <slopgirl@macroslop.dev>`, branch
  `slop`, no personal identifiers anywhere in the repo. Keep it that way
  (no `Claude-Session:` trailers in commits either).

## Decisions (0.1.0, header layer — historical since 0.3.0)

- **Header value was quoted** (`"dark"`, not `dark`): client hints are HTTP
  structured-field strings; Chrome sends them quoted, spec agrees.
- **Header `invert` semantics**: flip the existing header value if the request
  already had one, else flip the OS scheme (read via `matchMedia` in the
  background page).

## Decisions (0.2.0, client-side spoofing)

- **Query/condition rewriting, not result faking**: pinned modes replace
  `(prefers-color-scheme: X)` with constant conditions
  (`(width >= 0px)` / `(width < 0px)` — always/never true, valid anywhere a
  media feature fits); `invert` swaps the light/dark tokens so the condition
  keeps tracking the OS, flipped. Same pure transform (`shared/rewrite.js`)
  drives matchMedia, CSSOM, media attributes, and refetched CSS text —
  and is unit-testable in node.
- **`contentScripts.register` with settings embedded as a code block**:
  the only way to get settings *synchronously* at `document_start`; an
  async `storage.get` in a static content script races the page's inline
  theme-sniffer scripts (exactly the scripts we most need to beat).
  Re-registered on every settings change; open pages keep the old mode
  until reload (popup says so).
- **`exportFunction` + `wrappedJSObject`** for the matchMedia patch — page
  CSP can't block it (unlike injecting `<script>` elements). The patched
  function calls the *page's* real matchMedia with the rewritten query, so
  pages get genuine MediaQueryList objects with working change events.
- **Cross-origin sheets**: `sheet.cssRules` throws → refetch via content
  script `fetch` (host permissions beat CORS), rewrite conditions in the
  raw text, absolutify `url()`/`@import` refs against the sheet URL,
  insert a `<style>` right after the `<link>`, then disable the link.

## Known gaps (client-side spoofing)

- Rules inserted later via CSSOM `insertRule` aren't caught (could patch
  `CSSStyleSheet.prototype.insertRule` in the page world some day).
- `@import`s *inside* refetched cross-origin sheets keep their original
  conditions (no recursive refetch).
- `MediaQueryList.media` / rewritten attributes show the rewritten text —
  detectable, and could confuse code that string-compares its queries.
- Strict `style-src` CSP may block the injected `<style>` replacing a
  cross-origin sheet (content-script DOM insertions are subject to page
  CSP; `document.adoptedStyleSheets` would dodge it but changes cascade
  order).
- Iframes use *their own* hostname for per-host lookup (consistent with
  how the header rewrite sees their requests), so an embedded widget can
  disagree with its embedder.
- UA `color-scheme` pin only kicks in when the page declares support for
  both schemes (meta or computed root style) — forcing dark UA colors on a
  light-only page would produce unreadable soup, that's Dark Reader's job.

## Ideas / possible next steps

- [ ] Patch page-world `CSSStyleSheet.prototype.insertRule` for the CSSOM gap.
- [ ] Badge / dynamic icon showing the effective mode for the current tab.
- [x] Options page listing all host overrides with delete buttons.
- [ ] Upload `icons/icon-128.png` as the AMO listing icon (Developer Hub, or
      the v5 API's addon `icon` field) — the manifest icon does not feed it.
- [ ] Also set `Sec-CH-Prefers-Color-Scheme` on the response's `Critical-CH`
      dance? Probably overkill — we inject unconditionally anyway.
- [x] Sign & publish on AMO for real Android installs — tooling is in
      place (`just sign`); the listed submission still has to be made.

## Testing

- Desktop: `about:debugging` → load temporary add-on → visit any site that
  follows the system theme (or a `prefers-color-scheme` demo page) and flip
  modes.
- UI without a browser: copy `popup/`, `options/`, `shared/`, `icons/` to a
  scratch dir, prepend a `<script>` that mocks `browser.storage`/`tabs`, and
  `firefox --headless --no-remote --profile <tmp> --screenshot out.png
  --window-size=380,560 file://.../popup.html`. A profile with
  `ui.systemUsesDarkTheme=1` in `user.js` renders the dark palette.
- Android: `just run-android` needs `adb` and Fenix with USB debugging;
  web-ext docs: https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/
