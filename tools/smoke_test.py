#!/usr/bin/env python3
"""
End-to-end smoke test for a running VOID//CTF instance, as a normal player.

It logs in through the real login form, lists challenges through the public API,
optionally submits a flag through CTFd's attempt endpoint, and checks that the
theme assets and the void_ctf plugin respond. Standard library only.

    python tools/smoke_test.py --user testplayer --password '...'
    python tools/smoke_test.py --user testplayer --password '...' \
        --attempt "Dial Tone" "flag{wrong}" --expect-hidden "My Draft Challenge"

Exit code 0 means every check passed.
"""

import argparse
import http.cookiejar
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

failures = 0


def check(ok, label, detail=""):
    global failures
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}{(' - ' + detail) if detail else ''}")
    if not ok:
        failures += 1


class Client:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.nonce = None

    def request(self, method, path, data=None, headers=None):
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers or {})
        try:
            with self.opener.open(req, timeout=20) as res:
                return res.status, res.read().decode("utf-8", "replace"), res.geturl()
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace"), e.geturl()

    def page_nonce(self, html):
        m = re.search(r"'csrfNonce': \"([0-9a-f]+)\"", html)
        return m.group(1) if m else None

    def login(self, user, password):
        status, html, _ = self.request("GET", "/login")
        form_nonce = re.search(r'name="nonce"[^>]*value="([0-9a-f]+)"', html) or re.search(
            r'value="([0-9a-f]+)"[^>]*name="nonce"', html
        )
        if status != 200 or not form_nonce:
            return False
        body = urllib.parse.urlencode({"name": user, "password": password, "nonce": form_nonce.group(1)}).encode()
        _, html, url = self.request(
            "POST", "/login", body, {"Content-Type": "application/x-www-form-urlencoded"}
        )
        self.nonce = self.page_nonce(html)
        return "/login" not in urllib.parse.urlparse(url).path

    def api(self, method, path, obj=None):
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.nonce:
            headers["CSRF-Token"] = self.nonce
        data = json.dumps(obj).encode() if obj is not None else None
        status, body, _ = self.request(method, "/api/v1" + path, data, headers)
        try:
            return status, json.loads(body)
        except ValueError:
            return status, {}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--user", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--attempt", nargs=2, metavar=("CHALLENGE_NAME", "FLAG"))
    ap.add_argument("--expect-hidden", action="append", default=[], metavar="CHALLENGE_NAME")
    args = ap.parse_args()

    c = Client(args.url)
    print(f"VOID//CTF smoke test against {args.url}")

    status, _, _ = c.request("GET", "/healthcheck")
    check(status == 200, "healthcheck", f"HTTP {status}")

    status, html, _ = c.request("GET", "/")
    check(status == 200 and "/themes/void/static/" in html, "home page served by the void theme")
    css = re.search(r'href="(/themes/void/static/assets/main\.[0-9a-f]+\.css)"', html)
    if css:
        s, _, _ = c.request("GET", css.group(1))
        check(s == 200, "theme stylesheet loads", css.group(1))
    else:
        check(False, "theme stylesheet link present")

    check(c.login(args.user, args.password), f"login as {args.user}")

    status, body = c.api("GET", "/challenges")
    names = [ch["name"] for ch in body.get("data", [])] if status == 200 else []
    check(status == 200, "challenge list visible to player", f"{len(names)} challenges")
    for hidden in args.expect_hidden:
        check(hidden not in names, f"hidden challenge '{hidden}' is not listed")

    status, _ = c.api("GET", "/flags")
    check(status in (401, 403), "flags API is admin-only", f"HTTP {status}")

    s2, sb, _ = c.request("GET", "/void/api/summary")
    try:
        plugin_ok = s2 == 200 and json.loads(sb).get("success") is True
    except ValueError:
        plugin_ok = False
    check(plugin_ok, "void_ctf plugin summary endpoint", f"HTTP {s2}")

    if args.attempt:
        name, flag = args.attempt
        match = [ch for ch in c.api("GET", "/challenges")[1].get("data", []) if ch["name"] == name]
        if not match:
            check(False, f"challenge '{name}' found for attempt")
        else:
            status, body = c.api("POST", "/challenges/attempt", {"challenge_id": match[0]["id"], "submission": flag})
            result = (body.get("data") or {}).get("status")
            check(status == 200 and result is not None, f"attempt on '{name}' processed by CTFd", f"status={result}")

    print("All checks passed." if not failures else f"{failures} check(s) failed.")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
