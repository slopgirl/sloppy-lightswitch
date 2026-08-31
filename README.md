# sloppy lightswitch 🌞🌚

A Firefox (desktop **and Android**) WebExtension that gives you control over the
request header that tells websites about your light/dark mode system setting:
`Sec-CH-Prefers-Color-Scheme` (the client hint for the CSS
`prefers-color-scheme` media query).

Flip it globally, or per host — sloppily.

## Modes

| mode | what gets sent |
|---|---|
| 🖥️ `system` | nothing is touched — the request goes out as Firefox built it |
| 🌞 `light` | `Sec-CH-Prefers-Color-Scheme: "light"` |
| 🌚 `dark` | `Sec-CH-Prefers-Color-Scheme: "dark"` |
| 🙃 `invert` | the opposite of what would have been indicated (the existing header value if the request had one, otherwise your OS setting) |

The popup lets you pick a **global** mode and, for the site in the current tab,
a **per-host** override (or `🌐 global` to follow the global mode again).
Per-host overrides win over the global mode.

## What this does and doesn't do

- ✅ Adds/overrides the `Sec-CH-Prefers-Color-Scheme` request header on every
  request (per host / globally). Sites that read the client hint server-side
  will see your chosen scheme.
- ❌ It does **not** change the CSS `prefers-color-scheme` media query inside
  the page — sites styling purely client-side won't notice. (See `NOTES.md`
  for ideas about a companion content-script mode.)
- Note: Firefox itself doesn't send this client hint natively; this extension
  injects it unconditionally for `light`/`dark`/`invert`, whether or not the
  server asked for it via `Accept-CH`.

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
just build      # zip an XPI into dist/
just lint       # web-ext lint (via npx)
just run        # run in desktop Firefox (via npx web-ext)
```

## License

Do whatever, sloppily.
