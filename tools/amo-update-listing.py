#!/usr/bin/env python3
"""Push summary + description from amo-metadata.json to the AMO listing.

`web-ext sign --amo-metadata` only sends the metadata along with a new
version upload; this updates the public listing text on its own, no upload
and no review round-trip needed.

usage: amo-update-listing.py <addon-id>
"""
import importlib.util, json, os, sys, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("amo", os.path.join(HERE, "amo-fetch-signed.py"))
amo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(amo)


def main():
    addon = sys.argv[1]
    meta = json.load(open("amo-metadata.json"))
    body = json.dumps({"summary": meta["summary"], "description": meta["description"]}).encode()
    req = urllib.request.Request(
        f"{amo.API}/addons/addon/{addon}/",
        data=body,
        method="PATCH",
        headers={"Authorization": f"JWT {amo.token()}", "Content-Type": "application/json"},
    )
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e:
        sys.exit(f"AMO returned {e.code}\n{e.read()[:600].decode('utf8', 'replace')}")
    print(f"listing updated: {r['url']}")
    print(f"summary: {r['summary']['en-US']}")


if __name__ == "__main__":
    main()
