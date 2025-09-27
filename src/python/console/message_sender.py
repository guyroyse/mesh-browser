#!/usr/bin/env python3
"""
Message Sender - Structured communication with Electron

Provides consistent framed JSON messaging for all Python backend components.
Can be used by console server, HTTP server, protocol handlers, etc.
"""

import json
import sys
from typing import Dict, Any, TextIO


class ConsoleMessageSender:
    """Handles structured JSON messaging with frame prefixes"""

    def __init__(self, output_stream: TextIO = None):
        """Initialize with output stream (defaults to stdout)"""

        self.output_stream = output_stream or sys.stdout


    def send_error(self, error: str, **extra_data):
        """Send ERROR frame message"""

        error_data = {
            'type': 'error',
            'message': error,
            **extra_data
        }

        self.send_message('ERROR', error_data)


    def send_warning(self, warning: str, **extra_data):
        """Send WARNING frame message"""
        warning_data = {
            'type': 'warning',
            'message': warning,
            **extra_data
        }

        self.send_message('WARNING', warning_data)


    def send_info(self, info: str, **extra_data):
        """Send INFO frame message"""

        info_data = {
            'type': 'info',
            'message': info,
            **extra_data
        }

        self.send_message('INFO', info_data)


    def send_debug(self, debug: str, **extra_data):
        """Send DEBUG frame message"""

        debug_data = {
            'type': 'debug',
            'message': debug,
            **extra_data
        }

        self.send_message('DEBUG', debug_data)


    def send_message(self, frame: str, message: Dict[str, Any]):
        """Send framed JSON message to output stream"""

        json_str = json.dumps(message)
        framed_message = f"{frame}: {json_str}\n"
        self.output_stream.write(framed_message)
        self.output_stream.flush()
