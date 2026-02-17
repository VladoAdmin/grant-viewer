#!/usr/bin/env python3
"""Simple SPA-aware HTTP server for grant-viewer with /grants/ prefix stripping."""
import http.server
import os

PORT = 5174
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
PREFIX = '/grants'

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        # Strip /grants prefix if present (Tailscale proxy may or may not strip it)
        if self.path.startswith(PREFIX + '/'):
            self.path = self.path[len(PREFIX):]
        elif self.path == PREFIX:
            self.path = '/'

        # If file exists, serve it; otherwise serve index.html (SPA fallback)
        path = self.translate_path(self.path)
        if os.path.exists(path) and not os.path.isdir(path):
            super().do_GET()
        elif os.path.isdir(path) and os.path.exists(os.path.join(path, 'index.html')):
            super().do_GET()
        else:
            self.path = '/index.html'
            super().do_GET()

if __name__ == '__main__':
    with http.server.HTTPServer(('127.0.0.1', PORT), SPAHandler) as httpd:
        print(f"Serving grant-viewer on http://127.0.0.1:{PORT}")
        httpd.serve_forever()
