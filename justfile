# sloppy lightswitch — recipes

default:
    @just --list

version := `python3 -c "import json; print(json.load(open('manifest.json'))['version'])"`

# zip an installable XPI into dist/
build:
    mkdir -p dist
    zip -r -FS "dist/sloppy-lightswitch-{{version}}.xpi" \
        manifest.json background.js content.js shared popup icons \
        -x "*.DS_Store"
    @echo "built dist/sloppy-lightswitch-{{version}}.xpi"

# validate the extension with web-ext
lint:
    npx --yes web-ext lint --source-dir .

# run in desktop Firefox with live reload
run:
    npx --yes web-ext run --source-dir .

# run on a connected Android device (needs adb + Firefox for Android)
run-android:
    npx --yes web-ext run --source-dir . --target firefox-android

# run the media-condition rewrite unit tests
test:
    node test/rewrite.test.js

# syntax-check the JS without any tooling
check: test
    node --check background.js
    node --check content.js
    node --check shared/rewrite.js
    node --check popup/popup.js
    python3 -m json.tool manifest.json > /dev/null
    @echo "all good ✨"

clean:
    rm -rf dist web-ext-artifacts
