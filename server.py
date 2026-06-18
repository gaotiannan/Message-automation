#!/usr/bin/env python3
"""Local proxy server — serves the page AND forwards AI chat requests to Anthropic."""
import json, os, ssl, mimetypes, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(BaseHTTPRequestHandler):

    # ── static file serving ───────────────────────────────────────────
    def do_GET(self):
        path = self.path.split("?")[0].split("#")[0]
        if path == "/":
            path = "/index.html"
        filepath = os.path.join(ROOT, path.lstrip("/"))
        if os.path.isfile(filepath):
            mime, _ = mimetypes.guess_type(filepath)
            with open(filepath, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime or "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()

    # ── CORS preflight ────────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # ── AI proxy ──────────────────────────────────────────────────────
    def do_POST(self):
        if self.path != "/api/chat":
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))

            req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=json.dumps({
                    "model": "claude-haiku-4-5",
                    "max_tokens": 1024,
                    "system": body.get("system", ""),
                    "messages": body.get("messages", []),
                }).encode(),
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": body.get("api_key", ""),
                    "anthropic-version": "2023-06-01",
                },
                method="POST",
            )

            try:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                with urllib.request.urlopen(req, context=ctx) as res:
                    result = res.read()
                status = 200
            except urllib.error.HTTPError as e:
                result = e.read()
                status = e.code

            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(result)

        except Exception as exc:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": {"message": str(exc)}}).encode())

    def log_message(self, *_):
        pass


if __name__ == "__main__":
    import threading, webbrowser
    server = HTTPServer(("localhost", PORT), Handler)
    threading.Timer(0.8, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()
    print(f"✅  Running at http://localhost:{PORT}")
    print("   Keep this window open. Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
