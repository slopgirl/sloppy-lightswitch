# sloppy lightswitch — recipes

# credentials for `just sign` live in .env (git-ignored), not in the shell
set dotenv-load := true
set dotenv-required := false

default:
    @just --list

version := `python3 -c "import json; print(json.load(open('manifest.json'))['version'])"`
addon_id := `python3 -c "import json; print(json.load(open('manifest.json'))['browser_specific_settings']['gecko']['id'])"`

# the extension sources sit at the repo root, so everything that is *not* the
# extension has to be kept out of the package explicitly. web-ext already skips
# dot-files, node_modules and the artifacts dir; the rest is this list, and it
# is shared by lint/run/build/sign so what gets signed is what gets tested.
ignore := "--ignore-files 'test' 'test/**' 'tools' 'tools/**' '*.md' 'justfile' 'amo-metadata.json' 'package*.json'"

# validate the extension against the AMO linter
lint:
    npx --yes web-ext@latest lint --source-dir=. {{ignore}}

# run in desktop Firefox with live reload
run:
    npx --yes web-ext@latest run --source-dir=. {{ignore}}

# picks the device itself when exactly one is attached, and the Firefox build
# itself unless told (org.mozilla.fenix = Nightly/Developer builds, preferred;
# org.mozilla.firefox_beta; org.mozilla.firefox = release, which web-ext
# currently fails to launch: "Activity class ... App does not exist")
# Run on a connected Android device via adb (usage: just run-android [device] [apk-id])
run-android device="" apk="":
    #!/usr/bin/env bash
    set -euo pipefail
    device="{{device}}"
    if [ -z "$device" ]; then
        devices=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')
        count=$(printf '%s\n' "$devices" | grep -c . || true)
        if [ "$count" -eq 1 ]; then
            device="$devices"
        elif [ "$count" -eq 0 ]; then
            echo "error: no android device in 'adb devices' (usb debugging on? authorized?)" >&2; exit 1
        else
            echo "error: several devices, pick one: just run-android <device>" >&2
            printf '  %s\n' $devices >&2; exit 1
        fi
    fi
    apk="{{apk}}"
    if [ -z "$apk" ]; then
        installed=$(adb -s "$device" shell pm list packages | tr -d '\r' | sed 's/^package://')
        for candidate in org.mozilla.fenix org.mozilla.firefox_beta org.mozilla.firefox; do
            if printf '%s\n' "$installed" | grep -qx "$candidate"; then apk="$candidate"; break; fi
        done
        if [ -z "$apk" ]; then echo "error: no Firefox build found on $device" >&2; exit 1; fi
    fi
    echo "device $device, firefox build $apk"
    npx --yes web-ext@latest run --source-dir=. --target firefox-android \
        --android-device="$device" --firefox-apk="$apk" --adb-remove-old-artifacts {{ignore}}

# run the unit tests (media-condition rewriting, settings model)
test:
    node test/rewrite.test.js
    node test/settings.test.js

# syntax-check the JS without any tooling
check: test
    node --check background.js
    node --check content.js
    node --check shared/rewrite.js
    node --check shared/settings.js
    node --check popup/popup.js
    node --check options/options.js
    python3 -m json.tool manifest.json > /dev/null
    python3 -m json.tool amo-metadata.json > /dev/null
    @echo "all good"

# re-render icons/icon-*.png from icons/icon.svg (needs rsvg-convert: brew install librsvg)
icons:
    #!/usr/bin/env bash
    set -euo pipefail
    for size in 16 32 48 64 96 128; do
        rsvg-convert -w "$size" -h "$size" icons/icon.svg -o "icons/icon-$size.png"
    done
    echo "icons/icon-{16,32,48,64,96,128}.png rendered"

# build a distributable package into dist/
build: lint test
    npx --yes web-ext@latest build --source-dir=. --artifacts-dir=dist --overwrite-dest {{ignore}}

# needs WEB_EXT_API_KEY / WEB_EXT_API_SECRET from addons.mozilla.org/developers/addon/api/key/
#   unlisted -> signed .xpi handed straight back, never published or reviewed;
#               installs on desktop, and on Firefox Nightly for Android via
#               the debug menu's "Install add-on from file"
#   listed   -> submits a new version for AMO review, i.e. publishes it; only
#               needed for the stable Firefox for Android channel. The listing
#               has to be created once by hand in the Developer Hub first
# Sign at AMO into dist/ (usage: just sign [unlisted|listed])
sign channel="unlisted": _amo-creds lint test
    #!/usr/bin/env bash
    set -euo pipefail
    args=(--source-dir=. --artifacts-dir=dist --channel={{channel}} {{ignore}})
    # listing metadata (categories, license, description) only applies to a
    # public listing; AMO ignores it for unlisted self-distribution
    if [ "{{channel}}" = "listed" ] && [ -f amo-metadata.json ]; then
        args+=(--amo-metadata=amo-metadata.json)
    fi
    npx --yes web-ext@latest sign "${args[@]}"

# Fail fast (before lint/test) when the AMO credentials are missing
[private]
_amo-creds:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "${WEB_EXT_API_KEY:-}" ] || [ -z "${WEB_EXT_API_SECRET:-}" ]; then
        echo "error: WEB_EXT_API_KEY / WEB_EXT_API_SECRET are not set." >&2
        echo "       Create a key at https://addons.mozilla.org/developers/addon/api/key/" >&2
        echo "       then copy .env.example to .env and fill it in:" >&2
        echo "         WEB_EXT_API_KEY=user:12345678:123" >&2
        echo "         WEB_EXT_API_SECRET=<64 hex chars>" >&2
        exit 1
    fi

# For when `just sign` uploaded fine but lost the connection while waiting for
# approval - the version exists server-side, so re-signing it would just fail
# with "version already exists"; this grabs the finished file instead
# Re-download an already-signed .xpi from AMO (usage: just fetch-signed [version])
fetch-signed version="": _amo-creds
    @python3 tools/amo-fetch-signed.py {{addon_id}} {{version}}

# Push summary/description from amo-metadata.json to the public AMO listing (no upload)
listing: _amo-creds
    @python3 tools/amo-update-listing.py {{addon_id}}

# Bump the version in manifest.json (usage: just bump 0.5.0)
bump version:
    @python3 -c "import json,collections; p='manifest.json'; m=json.load(open(p),object_pairs_hook=collections.OrderedDict); m['version']='{{version}}'; open(p,'w').write(json.dumps(m,indent=2)+chr(10))"
    @echo "manifest.json now at {{version}} - remember to update CHANGELOG.md"

clean:
    rm -rf dist web-ext-artifacts
