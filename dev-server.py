#!/usr/bin/env python3
"""Lokaler Dev-Server mit Vercel-cleanUrls-Verhalten: /leistungen -> leistungen.html.
Nur fuer die lokale Vorschau; auf Vercel uebernimmt das cleanUrls in vercel.json."""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class CleanUrlHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = super().translate_path(path)
        if not os.path.exists(p):
            clean = p.rstrip("/") + ".html"
            if os.path.exists(clean):
                return clean
        return p


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("", PORT), CleanUrlHandler).serve_forever()
