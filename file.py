#!/usr/bin/env python3

import base64
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


HOST = os.getenv("PROXY_HOST", "127.0.0.1")
PORT = int(os.getenv("PROXY_PORT", "8080"))
USERNAME = os.getenv("PROXY_USERNAME", "admin")
PASSWORD = os.getenv("PROXY_PASSWORD", "change-me")


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def authenticate(self):
        header = self.headers.get("Proxy-Authorization", "")

        if not header.startswith("Basic "):
            return False

        try:
            encoded = header.split(" ", 1)[1]
            decoded = base64.b64decode(encoded).decode()
            username, password = decoded.split(":", 1)
            return username == USERNAME and password == PASSWORD
        except Exception:
            return False

    def require_authentication(self):
        self.send_response(407)
        self.send_header(
            "Proxy-Authenticate",
            'Basic realm="Simple HTTP Proxy"'
        )
        self.send_header("Content-Length", "0")
        self.end_headers()

    def proxy_request(self):
        if not self.authenticate():
            self.require_authentication()
            return

        target_url = self.path

        if not target_url.startswith(("http://", "https://")):
            host = self.headers.get("Host")

            if not host:
                self.send_error(400, "Missing destination host")
                return

            target_url = f"http://{host}{self.path}"

        headers = {}

        for key, value in self.headers.items():
            if key.lower() not in {
                "proxy-authorization",
                "proxy-connection",
                "connection",
            }:
                headers[key] = value

        request = Request(
            target_url,
            headers=headers,
            method=self.command,
        )

        try:
            with urlopen(request, timeout=15) as response:
                body = b"" if self.command == "HEAD" else response.read()

                self.send_response(response.status)

                for key, value in response.headers.items():
                    if key.lower() not in {
                        "connection",
                        "transfer-encoding",
                        "content-length",
                    }:
                        self.send_header(key, value)

                self.send_header("Content-Length", str(len(body)))
                self.end_headers()

                if body:
                    self.wfile.write(body)

        except HTTPError as error:
            self.send_error(error.code, str(error))

        except (URLError, TimeoutError) as error:
            self.send_error(502, f"Bad gateway: {error}")

    def do_GET(self):
        self.proxy_request()

    def do_HEAD(self):
        self.proxy_request()

    def do_CONNECT(self):
        self.send_error(
            501,
            "HTTPS CONNECT is not supported by this simple proxy"
        )


if __name__ == "__main__":
    print(f"Proxy running at {HOST}:{PORT}")
    print(f"Username: {USERNAME}")
    print("Set PROXY_PASSWORD before using it publicly.")

    server = ThreadingHTTPServer((HOST, PORT), ProxyHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nProxy stopped.")
        server.server_close()
