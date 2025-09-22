#!/usr/bin/env python3
"""
MeshBrowser Python Backend - Main Entry Point

Sets up the backend service with command routing and handlers.
"""

from console_server import ConsoleServer
from command_router import CommandRouter
from handler.handler import ReticulumHandler


def main():
    """Initialize and run the backend service"""

    # Create command router
    router = CommandRouter()

    # Create and register reticulum handler
    reticulum_handler = ReticulumHandler()
    router.register_commands(reticulum_handler.get_commands())

    # Create and run console server
    server = ConsoleServer(router)
    server.run()


if __name__ == '__main__':
    main()