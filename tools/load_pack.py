#!/usr/bin/env python3
"""
Load a VOID//CTF challenge pack into a running CTFd through its REST API.

Uses only CTFd's supported admin API (the same calls the admin panel makes),
never the database directly. Standard library only — no pip install needed.

    python tools/load_pack.py --url http://localhost:8000 --token <ADMIN_TOKEN>

Create the token in CTFd: Settings (as the admin user) → Access Tokens → Generate.
The token can also be passed via the CTFD_TOKEN environment variable.

The loader is idempotent: challenges whose name already exists are skipped,
so running it twice will not create duplicates. Organizer solutions
(SOLUTIONS.md) are never uploaded.
"""

import argparse
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PACK = ROOT / "challenges" / "starter-pack" / "pack.json"


class Api:
    def __init__(self, url, token):
        self.base = url.rstrip("/") + "/api/v1"
        self.token = token

    def _req(self, method, path, body=None, headers=None):
        # CTFd only honours token auth on JSON requests (and multipart file uploads),
        # so every call declares a JSON content type unless it overrides it.
        hdrs = {
            "Authorization": f"Token {self.token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        hdrs.update(headers or {})
        req = urllib.request.Request(self.base + path, data=body, method=method, headers=hdrs)
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                payload = res.read()
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:500]
            raise SystemExit(f"[!] {method} {path} failed: HTTP {e.code}\n    {detail}")
        except urllib.error.URLError as e:
            raise SystemExit(f"[!] Cannot reach CTFd at {self.base}: {e.reason}")
        try:
            data = json.loads(payload)
        except ValueError:
            raise SystemExit(f"[!] {method} {path} did not return JSON. Is the URL right and the token valid?")
        if not data.get("success", False):
            raise SystemExit(f"[!] {method} {path} rejected: {data}")
        return data.get("data")

    def get(self, path):
        return self._req("GET", path)

    def send(self, method, path, obj):
        return self._req(method, path, json.dumps(obj).encode(), {"Content-Type": "application/json"})

    def upload(self, challenge_id, file_path):
        boundary = uuid.uuid4().hex
        ctype = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        parts = []
        for name, value in (("challenge", str(challenge_id)), ("type", "challenge")):
            parts.append(
                f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
            )
        parts.append(
            (
                f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'
                f"Content-Type: {ctype}\r\n\r\n"
            ).encode()
            + file_path.read_bytes()
            + b"\r\n"
        )
        parts.append(f"--{boundary}--\r\n".encode())
        return self._req(
            "POST", "/files", b"".join(parts), {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        )


def load(api, pack_path, set_theme):
    pack_dir = pack_path.parent
    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    print(f"[*] Loading pack: {pack.get('name', pack_path.name)}")

    api.get("/configs")  # admin-only endpoint: fails fast if the token is not an admin token

    existing = {c["name"]: c["id"] for c in api.get("/challenges?view=admin")}
    ids = {}

    for ch in pack["challenges"]:
        if ch["name"] in existing:
            ids[ch["key"]] = existing[ch["name"]]
            print(f"    = {ch['name']} already exists (id {existing[ch['name']]}), skipped")
            continue

        created = api.send(
            "POST",
            "/challenges",
            {
                "name": ch["name"],
                "category": ch["category"],
                "description": ch["description"],
                "value": ch["value"],
                "type": "standard",
                "state": ch.get("state", "visible"),
                "max_attempts": ch.get("max_attempts", 0),
                "connection_info": ch.get("connection_info") or None,
            },
        )
        cid = created["id"]
        ids[ch["key"]] = cid

        for flag in ch.get("flags", []):
            api.send("POST", "/flags", {"challenge": cid, **flag})
        for tag in ch.get("tags", []):
            api.send("POST", "/tags", {"challenge": cid, "value": tag})
        for hint in ch.get("hints", []):
            api.send("POST", "/hints", {"challenge": cid, **hint})
        for rel in ch.get("files", []):
            api.upload(cid, pack_dir / rel)

        print(f"    + {ch['name']} [{ch['category']}, {ch['value']} pts] -> id {cid}")

    # Prerequisites need every challenge id, so they are applied in a second pass.
    for ch in pack["challenges"]:
        if not ch.get("requires"):
            continue
        prereqs = [ids[k] for k in ch["requires"]]
        api.send(
            "PATCH",
            f"/challenges/{ids[ch['key']]}",
            {"requirements": {"prerequisites": prereqs, "anonymize": ch.get("anonymize", False)}},
        )
        print(f"    ~ {ch['name']} now requires {', '.join(ch['requires'])}")

    pages = {p["route"]: p["id"] for p in api.get("/pages")}
    for page in pack.get("pages", []):
        content = (pack_dir / page["content_file"]).read_text(encoding="utf-8")
        if page["route"] in pages:
            print(f"    = page /{page['route']} already exists, skipped")
            continue
        api.send(
            "POST",
            "/pages",
            {
                "title": page["title"],
                "route": page["route"],
                "format": page.get("format", "markdown"),
                "content": content,
                "draft": False,
                "hidden": False,
                "auth_required": False,
            },
        )
        print(f"    + page /{page['route']}")

    if pack.get("index_page_file") and "index" in pages:
        index = api.get(f"/pages/{pages['index']}")
        if "A cool CTF platform from" in (index.get("content") or ""):
            api.send(
                "PATCH",
                f"/pages/{pages['index']}",
                {
                    "content": (pack_dir / pack["index_page_file"]).read_text(encoding="utf-8"),
                    "format": "markdown",
                },
            )
            print("    + replaced CTFd's placeholder home page with the VOID briefing")
        else:
            print("    = home page already customized, left unchanged")

    if set_theme:
        api.send("PATCH", "/configs", {"ctf_theme": "void"})
        print("    + active theme set to 'void'")

    print("[+] Done. Open the challenge board to see the pack.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=os.environ.get("CTFD_URL", "http://localhost:8000"))
    ap.add_argument("--token", default=os.environ.get("CTFD_TOKEN"))
    ap.add_argument("--pack", type=Path, default=DEFAULT_PACK)
    ap.add_argument("--no-theme", action="store_true", help="do not switch the active theme to 'void'")
    args = ap.parse_args()

    if not args.token:
        sys.exit("[!] Missing admin token. Pass --token or set CTFD_TOKEN (CTFd → Settings → Access Tokens).")
    if not args.pack.is_file():
        sys.exit(f"[!] Pack not found: {args.pack}")

    load(Api(args.url, args.token), args.pack, set_theme=not args.no_theme)


if __name__ == "__main__":
    main()
