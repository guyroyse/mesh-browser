#!/usr/bin/env python3
"""
MeshBrowser Python Backend - Main Entry Point

Sets up the backend service with command routing and handlers.
"""

import console as Console

from command_router import CommandRouter
from reticulum.handler.handler import ReticulumHandler
from http_server import MeshBrowserHTTPServer
import json
import sys


def main():
    """Initialize and run the backend service"""

    # Create command router for HTTP server
    router = CommandRouter()

    # Create and register reticulum handler
    reticulum_handler = ReticulumHandler()
    router.register_commands(reticulum_handler.get_commands())

    # Start HTTP server
    http_server = MeshBrowserHTTPServer(router)
    try:
        port = http_server.start()

        # Report HTTP server ready via stdout for Electron
        startup_message = {
            'type': 'http_server_ready',
            'port': port,
            'message': f'HTTP server started on port {port}'
        }
        print(f"MESHBROWSER_MSG: {json.dumps(startup_message)}", flush=True)

    except Exception as e:
        print(f"ERROR: Failed to start HTTP server: {e}", file=sys.stderr, flush=True)
        return

    # Create and run console manager (this will block)
    # Console manager only handles lifecycle - no router needed
    try:
        console = Console.Manager()
        console.run()
    finally:
        # Clean up HTTP server when console manager exits
        http_server.stop()


if __name__ == '__main__':
    main()