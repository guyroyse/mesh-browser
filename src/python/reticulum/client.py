#!/usr/bin/env python3
"""
ReticulumClient - Reticulum networking abstraction layer

Provides a clean interface for Reticulum networking operations,
separating the networking logic from command handling.
"""

import RNS
from typing import Dict, Any
from .page_fetcher import PageFetcher
from .status_fetcher import StatusFetcher


class ReticulumClient:
    def __init__(self):
        self.reticulum = None
        self.identity = None
        self.initialized = False
        self.page_fetcher = None
        self.status_fetcher = None
        self._initialize()

    def _initialize(self):
        """Initialize Reticulum networking"""
        try:
            self.reticulum = RNS.Reticulum()
            self.identity = RNS.Identity()
            self.initialized = True

            # Initialize specialized fetchers
            self.page_fetcher = PageFetcher(self.reticulum, self.identity)
            self.status_fetcher = StatusFetcher(self.reticulum, self.identity)

            RNS.log("Reticulum initialized successfully", RNS.LOG_INFO)
        except Exception as e:
            RNS.log(f"Failed to initialize Reticulum: {e}", RNS.LOG_ERROR)
            self.reticulum = None
            self.identity = None
            self.initialized = False

    def is_initialized(self) -> bool:
        """Check if Reticulum is properly initialized"""
        return self.initialized

    def get_status(self) -> Dict[str, Any]:
        """Get current Reticulum status information"""
        if not self.initialized:
            return {'initialized': False, 'identity_hash': None, 'interfaces': []}

        return self.status_fetcher.get_status()

    def fetch_page(self, url: str, path_discovery_timeout: int = 10) -> Dict[str, Any]:
        """
        Fetch content from a Reticulum destination

        Args:
            url: Combined destination hash and path (e.g., "abc123def456.../index.html")
            path_discovery_timeout: Timeout for path discovery only (RNS handles other timeouts)

        Returns:
            Dict with 'content', 'content_type', 'status_code', 'encoding'

        Raises:
            RuntimeError: If Reticulum not initialized
            ValueError: For invalid URL format
            ConnectionError: For network/connection issues
            TimeoutError: For path discovery timeout only
        """
        if not self.initialized:
            raise RuntimeError('Reticulum not initialized')

        return self.page_fetcher.fetch(url, path_discovery_timeout)