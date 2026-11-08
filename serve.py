"""Local preview server with clean URLs: python3 serve.py  →  http://localhost:8080
/services serves services.html, and /services.html redirects to /services (like the live site)."""
import http.server, os, socketserver, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        path = url.path
        if path.endswith(".html") and os.path.isfile(os.path.join(ROOT, path.lstrip("/"))):
            clean = "/" if path in ("/index.html",) else path[:-5]
            self.send_response(301); self.send_header("Location", clean + (f"?{url.query}" if url.query else "")); self.end_headers(); return
        if path != "/" and "." not in os.path.basename(path) and os.path.isfile(os.path.join(ROOT, path.strip("/") + ".html")):
            self.path = path.rstrip("/") + ".html" + (f"?{url.query}" if url.query else "")
        target = os.path.join(ROOT, urllib.parse.unquote(self.path.split("?")[0]).lstrip("/"))
        if self.path.split("?")[0] != "/" and not os.path.exists(target):
            # Unknown page: show the custom 404 page with a real 404 status (like the live site).
            body = open(os.path.join(ROOT, "404.html"), "rb").read()
            self.send_response(404); self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()

# Threaded, so one slow or stuck browser connection can't block every other request.
socketserver.ThreadingTCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer.daemon_threads = True
with socketserver.ThreadingTCPServer(("", 8080), Handler) as httpd:
    print("Serving http://localhost:8080 (clean URLs)")
    httpd.serve_forever()
