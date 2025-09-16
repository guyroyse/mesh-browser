#!/usr/bin/env python3
"""
MeshBrowser Python Backend - Main Entry Point

Sets up the backend service with command routing and handlers.
"""

from console_server import ConsoleServer
from command_router import CommandRouter
from handlers.system_handler import SystemHandler


def main():
    """Initialize and run the backend service"""

    # Create command router
    router = CommandRouter()

    # Create and register system handler
    system_handler = SystemHandler()
    router.register_commands(system_handler.get_commands())

    # TODO: Add ReticulariumHandler when ready
    # reticulum_handler = ReticulariumHandler()
    # router.register_commands(reticulum_handler.get_commands())

    # Create and run console server
    server = ConsoleServer(router)
    server.run()


if __name__ == '__main__':
    main()