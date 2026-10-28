#!/usr/bin/env python3
"""
VOID//CTF web training target: "Staff Portal".

A deliberately vulnerable, self-contained practice app for the starter pack.
Lesson: robots.txt leaks a hidden path, and the app trusts a client-side cookie
for authorization (broken access control). It has no database, runs no shell
commands, reads no files and stores nothing.

Run locally only:
    FLAG='flag{example_trust_no_cookie}' python server.py   # listens on 127.0.0.1:8081
Docker Compose runs it with `--profile training` (see docker-compose.yml).
"""

import html
import os
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.get("FLAG") or "flag{example_trust_no_cookie}"
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8081"))

STYLE = """
body{background:#080B10;color:#E6EDF3;font-family:ui-monospace,Consolas,monospace;
max-width:640px;margin:10vh auto;padding:0 16px;line-height:1.6}
.box{border:1px solid #1F2B3A;background:#101720;border-radius:10px;padding:24px}
h1{font-size:20px;margin-top:0}.muted{color:#8B9BB4}.ok{color:#39FF88}.bad{color:#FF6B7A}
code{color:#39FF88}a{color:#00D9FF}
"""


def page(title, body):
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><style>{STYLE}</style></head>
<body><div class="box">{body}</div>
<p class="muted">VOID//CTF training target — local practice only.</p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    server_version = "StaffPortal/0.1"

    def _send(self, status, content, ctype="text/html; charset=utf-8", cookie=None):
        data = content.encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(data)

    def _role(self):
        jar = SimpleCookie(self.headers.get("Cookie", ""))
        return jar["role"].value if "role" in jar else None

    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0]

        if path == "/":
            body = (
                "<h1>Saltmere Harbor Authority — Staff Portal</h1>"
                "<p>Welcome, visitor. You are browsing as a <b>guest</b>.</p>"
                "<p class='muted'>Staff tools are not listed publicly. Search engines "
                "are asked not to index them.</p>"
            )
            cookie = None
            if self._role() is None:
                cookie = "role=guest; Path=/; SameSite=Lax"
            return self._send(200, page("Staff Portal", body), cookie=cookie)

        if path == "/robots.txt":
            return self._send(
                200,
                "User-agent: *\nDisallow: /staff-only/console\n",
                "text/plain; charset=utf-8",
            )

        if path == "/staff-only/console":
            role = self._role() or "guest"
            if role.strip().lower() == "admin":
                body = (
                    "<h1 class='ok'>Console unlocked</h1>"
                    f"<p>Maintenance token: <code>{html.escape(FLAG)}</code></p>"
                )
                return self._send(200, page("Console", body))
            body = (
                "<h1 class='bad'>403 — staff only</h1>"
                f"<p>Your session role is <code>{html.escape(role)}</code>. "
                "This console requires role <code>admin</code>.</p>"
            )
            return self._send(403, page("Forbidden", body))

        return self._send(404, page("Not found", "<h1>404</h1><p>Nothing here.</p>"))

    def log_message(self, fmt, *args):
        print("[web-training] " + fmt % args, flush=True)


if __name__ == "__main__":
    print(f"[web-training] listening on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
