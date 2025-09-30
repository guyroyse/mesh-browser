#!/usr/bin/env python3
"""
Reticulum status information

Gathers network status and system information.
"""

import RNS
import datetime
import sys
import os
from typing import Dict, Any


def get_status() -> Dict[str, Any]:
    """Get current Reticulum status and system information"""

    interfaces = []
    for interface in RNS.Transport.interfaces:
        interfaces.append({
            'name': str(interface),
            'type': type(interface).__name__
        })

    return {
        'interfaces': interfaces,
        'python_version': sys.version,
        'working_directory': os.getcwd(),
        'timestamp': datetime.datetime.now().isoformat()
    }