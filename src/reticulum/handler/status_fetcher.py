#!/usr/bin/env python3
"""
StatusFetcher - Handles Reticulum status and system information

Provides network status, interface information, and system details.
"""

import RNS
import datetime
import sys
import os
from typing import Dict, Any


class StatusFetcher:
    def __init__(self, reticulum_instance, identity):
        self.reticulum = reticulum_instance
        self.identity = identity

    def get_status(self) -> Dict[str, Any]:
        """Get current Reticulum status and system information"""
        status = {
            # Reticulum network status
            'initialized': self.reticulum is not None,
            'identity_hash': self.identity.hash.hex() if self.identity else None,
            'interfaces': [],

            # System information
            'python_version': sys.version,
            'working_directory': os.getcwd(),
            'timestamp': datetime.datetime.now().isoformat()
        }

        if self.reticulum:
            status['interfaces'] = self._get_interface_info()

        return status

    def _get_interface_info(self) -> list:
        """Get information about active interfaces"""
        interfaces = []

        for interface in RNS.Transport.interfaces:
            interfaces.append({
                'name': str(interface),
                'type': type(interface).__name__
            })

        return interfaces