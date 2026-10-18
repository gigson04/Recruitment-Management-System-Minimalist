"""Start the RMS on loopback only and open the browser automatically.

Requires Python 3. No packages are installed and no network-facing interface is exposed.
"""
from __future__ import annotations

import os
import socket
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)


def available_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class QuietHandler(SimpleHTTPRequestHandler):
    """Serve project files without printing every asset request."""

    def log_message(self, format: str, *args: object) -> None:
        # Keep the console useful; only unexpected errors are printed below.
        pass


port = available_port()
server = ThreadingHTTPServer(("127.0.0.1", port), QuietHandler)
url = f"http://127.0.0.1:{port}/index.html"
print("=" * 64)
print(" Recruitment Management System — local server")
print("=" * 64)
print(f"Open: {url}")
print("This server is available only on this computer.")
print("Leave this window open while using RMS.")
print("Press Ctrl+C here to stop the server.")
print("-" * 64)
threading.Timer(0.8, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever(poll_interval=0.25)
except KeyboardInterrupt:
    print("\nStopping the local RMS server…")
finally:
    server.server_close()
