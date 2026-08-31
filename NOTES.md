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

## Ideas / possible next steps

- [ ] Companion content script that patches `window.matchMedia` +
      injects a `color-scheme` override so client-side-only sites react too
      (that's the bigger hammer; header-only is what was asked for).
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
