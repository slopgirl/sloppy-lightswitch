# NOTES (for future me)

## Decisions

- **MV2, not MV3**: Firefox supports both indefinitely; MV2 with a persistent
  background page + blocking `webRequest` is the simplest thing that works on
  Fenix (Android). MV3 in Firefox would also allow blocking webRequest (unlike
  Chrome), so a migration is possible but not urgent.
- **`system` = passthrough**, not "send the actual system value". Rationale:
  `system` should behave exactly as if the extension weren't installed, and
  Firefox doesn't natively send `Sec-CH-Prefers-Color-Scheme` at all (client
  hints are unsupported in Gecko as of writing).
- **Header value is quoted** (`"dark"`, not `dark`): client hints are HTTP
  structured-field strings; Chrome sends them quoted, spec agrees.
- **`invert` semantics**: flip the existing header value if the request already
  had one, else flip the OS scheme (read via `matchMedia` in the background
  page).
- Per-host key is the exact `URL.hostname` — no `www.` normalization, no
  eTLD+1 grouping. Predictable, if a bit sloppy.
- `data_collection_permissions: { required: ["none"] }` is in the manifest —
  required by AMO for new submissions since late 2025.
- Slopified from birth: identity `slopgirl <slopgirl@macroslop.dev>`, branch
  `slop`, no personal identifiers anywhere in the repo. Keep it that way
  (no `Claude-Session:` trailers in commits either).

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
- [ ] Options page listing all host overrides with delete buttons (popup only
      shows the current tab's host right now).
- [ ] Also set `Sec-CH-Prefers-Color-Scheme` on the response's `Critical-CH`
      dance? Probably overkill — we inject unconditionally anyway.
- [ ] Sign & publish on AMO for real Android installs.

## Testing

- Desktop: `about:debugging` → load temporary add-on → visit
  https://httpbin.org/headers (or any echo service) and flip modes.
- Android: `just run-android` needs `adb` and Fenix with USB debugging;
  web-ext docs: https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/
