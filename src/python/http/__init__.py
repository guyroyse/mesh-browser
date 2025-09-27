"""
HTTP Server Package

Provides HTTP API endpoints for Reticulum proxy requests.
Handles HTTP request processing and Reticulum network communication.
"""

from .server import MeshBrowserHTTPServer
from .handler import MeshBrowserHTTPHandler

# Provide shorter aliases for cleaner usage
Server = MeshBrowserHTTPServer
Handler = MeshBrowserHTTPHandler

__all__ = ['MeshBrowserHTTPServer', 'Server', 'MeshBrowserHTTPHandler', 'Handler']