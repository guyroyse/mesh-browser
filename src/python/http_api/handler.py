#!/usr/bin/env python3
"""
HTTP Request Handler for MeshBrowser Backend

Handles HTTP requests to the /proxy/reticulum endpoint and communicates
with the Reticulum network through the ReticulumHandler.
"""

import base64
import json
import sys
from http.server import BaseHTTPRequestHandler
from typing import Dict, Any

import reticulum as Reticulum



class HTTP_API_Handler(BaseHTTPRequestHandler):
    """HTTP request handler for Reticulum proxy requests"""

    def __init__(self, *args, **kwargs):
        self.reticulum_client = Reticulum.Client()
        super().__init__(*args, **kwargs)

    def do_POST(self):
        """Handle POST requests to /proxy/reticulum endpoint"""
        try:
            # Only handle /proxy/reticulum endpoint
            if self.path == '/proxy/reticulum':
                self._handle_reticulum_proxy()
            else:
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

        # For now, only support GET (until Reticulum supports other methods)
        if method != 'GET':
            self._send_error(501, f"Method {method} not yet supported over Reticulum")
            return

        try:
            # Call Reticulum client directly
            result = self.reticulum_client.fetch_page(url)
            self._send_reticulum_response(result)
        except (RuntimeError, ValueError, ConnectionError, TimeoutError) as e:
            self._send_error(500, str(e))
        except Exception as e:
            self._send_error(500, f'Unexpected error: {str(e)}')

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