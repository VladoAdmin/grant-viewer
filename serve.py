#!/usr/bin/env python3
"""Simple SPA-aware HTTP server for grant-viewer."""
import http.server
import os

PORT = 5174
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)
    
    def do_GET(self):
        # If file exists, serve it; otherwise serve index.html (SPA fallback)
        path = self.translate_path(self.path)
        if os.path.exists(path) and not os.path.isdir(path):
            super().do_GET()
        elif os.path.exists(path) and os.path.isdir(path) and os.path.exists(os.path.join(path, 'index.html')):
            super().do_GET()
        else:
            self.path = '/'
            super().do_GET()

if __name__ == '__main__':
    with http.server.HTTPServer(('127.0.0.1', PORT), SPAHandler) as httpd:
        print(f"Serving grant-viewer on http://127.0.0.1:{PORT}")
        httpd.serve_forever()
