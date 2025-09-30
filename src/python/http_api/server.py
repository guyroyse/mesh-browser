#!/usr/bin/env python3
"""
HTTP Server for MeshBrowser Backend

Manages the HTTP server lifecycle and coordinates with the HTTP request handler.
Uses only Python standard library - no external dependencies.
"""

import socket
from http.server import ThreadingHTTPServer
from threading import Thread

import console as Console
from .handler import HTTP_API_Handler


class HTTP_API_Server:
    """HTTP server that handles Reticulum proxy requests"""

    def __init__(self, reticulum_client):
        self.messenger = Console.MessageSender()
        self.reticulum_client = reticulum_client
        self.server = None
        self.server_thread = None
        self.port = None

    def start(self):
        """Start HTTP server on available port"""
        # Find available port
        self.port = self._find_available_port()

        # Create handler factory that passes shared client to each handler instance
        def handler_factory(*args, **kwargs):
            return HTTP_API_Handler(self.reticulum_client, *args, **kwargs)

        # Create server with HTTP handler factory
        self.server = ThreadingHTTPServer(('localhost', self.port), handler_factory)

        # Start server in background thread
        self.server_thread = Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()

        # Send startup message via structured messaging
        self.messenger.send_message('HTTP_STARTUP', {
            'port': self.port,
            'message': f'HTTP server started on port {self.port}'
        })


    def stop(self):
        """Stop the HTTP server"""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.messenger.send_message('HTTP_SHUTDOWN', {
                'port': self.port,
                'message': 'HTTP server stopped'
            })


    def _find_available_port(self) -> int:
        """Find an available port for the server"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind(('localhost', 0))
            port = sock.getsockname()[1]
            return port
        finally:
            sock.close()
