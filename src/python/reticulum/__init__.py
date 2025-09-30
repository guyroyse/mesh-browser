"""
Reticulum Network Package

Provides Reticulum mesh network communication for MeshBrowser.
Handles page fetching, status queries, and network operations.

Structure:
- client.py: Main coordinator interface
- url.py: URL parsing utilities
- link.py: RNS link establishment (transport layer)
- fetch.py: Content fetching (application layer)
- response.py: HTTP response parsing
- status.py: Status information gathering
"""

from .client import ReticulumClient

# Provide shorter alias for cleaner usage
Client = ReticulumClient

__all__ = ['ReticulumClient', 'Client']