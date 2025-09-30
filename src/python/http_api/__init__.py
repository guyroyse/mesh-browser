"""
HTTP Server Package

Provides HTTP API endpoints for Reticulum proxy requests.
Handles HTTP request processing and Reticulum network communication.
"""

from .server import HTTP_API_Server
from .handler import HTTP_API_Handler

# Provide shorter aliases for cleaner usage
Server = HTTP_API_Server
Handler = HTTP_API_Handler

__all__ = ['HTTP_API_Server', 'Server', 'HTTP_API_Handler', 'Handler']
