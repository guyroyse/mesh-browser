#!/usr/bin/env python3
"""
SystemHandler - Handles basic system commands

Provides ping, test messages, and other system-level functionality.
"""

import datetime
import sys
import os
from typing import Dict, Any


class SystemHandler:
    def __init__(self):
        pass

    def get_commands(self) -> Dict[str, callable]:
        """Return dictionary of command names to handler methods"""
        return {
            'version': self.version
        }

    def version(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle version command"""
        request_id = message.get('id')
        return {
            'id': request_id,
            'data': {
                'python_version': sys.version,
                'working_directory': os.getcwd(),
                'timestamp': datetime.datetime.now().isoformat()
            }
        }