#!/usr/bin/env python3
"""Download an already-signed .xpi from AMO into dist/.

`web-ext sign` uploads, waits for approval, then downloads. If the connection
drops during the wait (WebExtError: fetch failed), the version still exists
server-side and is usually already signed - but re-running `sign` fails with
"version already exists". This fetches the finished file instead.

usage: amo-fetch-signed.py <addon-id> [version]   (default: manifest version)
"""
import base64, hashlib, hmac, json, os, re, sys, time, urllib.error, urllib.request

API = "https://addons.mozilla.org/api/v5"


def credentials():
    key, secret = os.environ.get("WEB_EXT_API_KEY"), os.environ.get("WEB_EXT_API_SECRET")
    if not (key and secret):
        sys.exit("WEB_EXT_API_KEY / WEB_EXT_API_SECRET are not set (see .env.example)")
    return key.strip(), secret.strip()


def token():
    key, secret = credentials()
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=")
    now = int(time.time())
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(json.dumps({"iss": key, "jti": str(now), "iat": now, "exp": now + 300}).encode())
    sig = b64(hmac.new(secret.encode(), head + b"." + body, hashlib.sha256).digest())
    return (head + b"." + body + b"." + sig).decode()


def fetch(url, jwt):
    req = urllib.request.Request(url, headers={"Authorization": f"JWT {jwt}"})
    try:
        return urllib.request.urlopen(req, timeout=60).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"AMO returned {e.code} for {url}\n{e.read()[:500].decode('utf8', 'replace')}")


def main():
    addon = sys.argv[1]
    want = sys.argv[2] if len(sys.argv) > 2 else json.load(open("manifest.json"))["version"]
    jwt = token()
    listing = json.loads(fetch(f"{API}/addons/addon/{addon}/versions/?filter=all_with_unlisted", jwt))
    match = next((v for v in listing.get("results", []) if v["version"] == want), None)
    if not match:
        have = ", ".join(v["version"] for v in listing.get("results", [])) or "none"
        sys.exit(f"no version {want} at AMO (found: {have})")
    file = match.get("file") or {}
    if file.get("status") != "public":
        sys.exit(f"version {want} is not signed yet (status={file.get('status')}) - wait and retry")
    os.makedirs("dist", exist_ok=True)
    # AMO serves the file under a hashed name; keep the local one readable
    out = os.path.join("dist", f"{addon.split('@')[0]}-{want}-signed.xpi")
    with open(out, "wb") as fh:
        fh.write(fetch(file["url"], jwt))
    print(f"{out} ({os.path.getsize(out)} bytes, channel={match.get('channel')})")


if __name__ == "__main__":
    main()
