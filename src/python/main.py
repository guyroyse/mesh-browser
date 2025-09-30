#!/usr/bin/env python3
"""
MeshBrowser Python Backend - Main Entry Point

Sets up the backend service with command routing and handlers.
"""

import json
import sys

import console as Console
import http_api as HTTP


def main():
    """Initialize and run the backend service"""

    # Initialize structured messaging
    messenger = Console.MessageSender()

    # Start the HTTP server
    http_server = HTTP.Server()
    try:
        http_server.start()
    except Exception as e:
        messenger.send_error(f"Failed to start HTTP server: {e}")
        return

    # Start the console manager
    console = Console.Manager()
    try:
        console.run()
    finally:
        # Clean up HTTP server when console manager exits
        http_server.stop()


if __name__ == '__main__':
    main()
