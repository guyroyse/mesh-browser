#!/usr/bin/env python3
"""
HTTP Server for MeshBrowser Backend

Provides HTTP API endpoints for protocol handlers to communicate with the backend.
Uses only Python standard library - no external dependencies.
"""

import base64
import json
import socket
import sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from threading import Thread
from typing import Dict, Any
from urllib.parse import urlparse, parse_qs


class MeshBrowserHTTPHandler(BaseHTTPRequestHandler):
    """HTTP request handler that routes API calls to command router"""

    def __init__(self, command_router, *args, **kwargs):
        self.command_router = command_router
        super().__init__(*args, **kwargs)

    def do_POST(self):
        """Handle POST requests to proxy endpoints"""
        try:
            # Parse URL path
            parsed_url = urlparse(self.path)
            path_parts = parsed_url.path.strip('/').split('/')

            # Handle /proxy/reticulum endpoint
            if len(path_parts) >= 2 and path_parts[0] == 'proxy' and path_parts[1] == 'reticulum':
                self._handle_reticulum_proxy()
                return

            # Handle legacy /api/ endpoints for backward compatibility during transition
            if parsed_url.path.startswith('/api/'):
                self._handle_legacy_api(parsed_url.path)
                return

            self._send_error(404, "Not Found")

        except Exception as e:
            self._send_error(500, f"Internal Server Error: {str(e)}")

    def _handle_reticulum_proxy(self):
        """Handle proxy requests to Reticulum network"""
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._send_error(400, "Request body required")
            return

        try:
            request_body = self.rfile.read(content_length).decode('utf-8')
            request_data = json.loads(request_body)
        except json.JSONDecodeError:
            self._send_error(400, "Invalid JSON")
            return

        # Extract and validate required fields
        url = request_data.get('url')
        if not url:
            self._send_error(400, "Missing 'url' field")
            return

        method = request_data.get('method', 'GET').upper()
        body = request_data.get('body')
        headers = request_data.get('headers', {})

        # For now, only support GET (until Reticulum supports other methods)
        if method != 'GET':
            self._send_error(501, f"Method {method} not yet supported over Reticulum")
            return

        # Create command message for existing fetch-page handler
        message = {
            'id': f"proxy-{id(self)}",
            'command': 'fetch-page',
            'url': url
        }

        # Route to command handler
        response = self.command_router.handle_command(message)

        # Convert command response to HTTP response
        if 'error' in response:
            self._send_error(500, response['error'])
        else:
            self._send_reticulum_response(response.get('data', {}))

    def _handle_legacy_api(self, path):
        """Handle legacy /api/ endpoints during transition"""
        command = path[5:]  # Remove '/api/' prefix

        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            request_body = self.rfile.read(content_length).decode('utf-8')
            try:
                request_data = json.loads(request_body)
            except json.JSONDecodeError:
                self._send_error(400, "Invalid JSON")
                return
        else:
            request_data = {}

        # Create command message for router
        message = {
            'id': f"api-{id(self)}",
            'command': command,
            **request_data
        }

        # Route to command handler
        response = self.command_router.handle_command(message)
        self._send_json_response(response)

    def do_GET(self):
        """Handle GET requests (for simple endpoints like ping)"""
        try:
            parsed_url = urlparse(self.path)

            if not parsed_url.path.startswith('/api/'):
                self._send_error(404, "Not Found")
                return

            command = parsed_url.path[5:]  # Remove '/api/' prefix

            # Create simple command message
            message = {
                'id': f"http-{id(self)}",
                'command': command
            }

            response = self.command_router.handle_command(message)
            self._send_json_response(response)

        except Exception as e:
            self._send_error(500, f"Internal Server Error: {str(e)}")

    def _send_json_response(self, data: Dict[str, Any]):
        """Send JSON response with proper headers"""
        response_json = json.dumps(data)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response_json)))
        self.send_header('Access-Control-Allow-Origin', '*')  # For potential CORS needs
        self.end_headers()

        self.wfile.write(response_json.encode('utf-8'))

    def _send_error(self, code: int, message: str):
        """Send error response"""
        error_data = {'error': message}
        error_json = json.dumps(error_data)

        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(error_json)))
        self.end_headers()

        self.wfile.write(error_json.encode('utf-8'))

    def _send_reticulum_response(self, data: Dict[str, Any]):
        """Send Reticulum content as native HTTP response"""
        # Extract response data
        content_b64 = data.get('content', '')
        content_type = data.get('content_type', 'text/html')
        status_code = data.get('status_code', 200)

        # Decode base64 content to raw bytes
        try:
            content_bytes = base64.b64decode(content_b64) if content_b64 else b''
        except Exception:
            self._send_error(500, "Invalid base64 content")
            return

        # Send HTTP response with proper headers
        self.send_response(status_code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(content_bytes)))
        self.end_headers()

        # Send raw content bytes
        self.wfile.write(content_bytes)

    def log_message(self, format, *args):
        """Override to send logs to stderr instead of stdout"""
        print(f"HTTP: {format % args}", file=sys.stderr, flush=True)


class MeshBrowserHTTPServer:
    """HTTP server that integrates with the existing command router"""

    def __init__(self, command_router):
        self.command_router = command_router
        self.server = None
        self.server_thread = None
        self.port = None

    def start(self) -> int:
        """Start HTTP server on available port, return the port number"""
        # Find available port
        self.port = self._find_available_port()

        # Create server with custom handler that has access to command_router
        def handler_factory(*args, **kwargs):
            return MeshBrowserHTTPHandler(self.command_router, *args, **kwargs)

        self.server = ThreadingHTTPServer(('localhost', self.port), handler_factory)

        # Start server in background thread
        self.server_thread = Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()

        print(f"INFO: HTTP server started on port {self.port}", file=sys.stderr, flush=True)
        return self.port

    def stop(self):
        """Stop the HTTP server"""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            print("INFO: HTTP server stopped", file=sys.stderr, flush=True)

    def _find_available_port(self) -> int:
        """Find an available port for the server"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind(('localhost', 0))
            port = sock.getsockname()[1]
            return port
        finally:
            sock.close()