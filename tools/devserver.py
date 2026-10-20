"""Static dev server with caching disabled, so every reload runs the latest code.
Usage: python3 tools/devserver.py [port] [directory]"""
import functools, http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5318
directory = sys.argv[2] if len(sys.argv) > 2 else "."
handler = functools.partial(NoCache, directory=directory)
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
