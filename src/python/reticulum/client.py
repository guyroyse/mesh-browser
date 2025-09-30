#!/usr/bin/env python3
"""
ReticulumClient - Thin coordinator for Reticulum operations

Provides a simple interface that delegates to focused utility modules.
"""

import RNS
from typing import Dict, Any

from .url import parse_url
from .link import establish_link
from .fetch import fetch
from .response import parse_response
from .status import get_status


class ReticulumClient:
    """Coordinates Reticulum networking operations"""

    def __init__(self):
        """Initialize Reticulum networking"""
        self.reticulum = RNS.Reticulum()

    def fetch_page(self, url: str) -> Dict[str, Any]:
        """Fetch content from a Reticulum destination"""

        # Parse URL into destination hash and path
        dest_hash, path = parse_url(url)

        # Establish link to destination (rserver/web app)
        link = establish_link(dest_hash, "rserver", "web")

        try:
            # Fetch raw content over the link
            raw_content = fetch(link, dest_hash, path)

            # Parse the response
            return parse_response(raw_content, path)
        finally:
            # Always clean up the link
            link.teardown()

    def get_status(self) -> Dict[str, Any]:
        """Get current Reticulum status and system information"""

        return get_status()
