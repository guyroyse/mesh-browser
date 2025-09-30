#!/usr/bin/env python3
import sys

from .message_sender import ConsoleMessageSender as MessageSender


class ConsoleManager:
    """Manages process lifecycle - sends startup signal and waits for termination"""

    def __init__(self):
        self.messenger = MessageSender()

    def run(self):
        """Send startup notification and wait for process termination (EOF)"""
        self._send_startup_message()

        try:
            # Wait for EOF (triggered by process.kill() closing stdin)
            while True:
                line = sys.stdin.readline()
                if not line:  # EOF detected
                    break
        except Exception as e:
            self.messenger.send_error(f"Backend error: {e}")

    def _send_startup_message(self):
        """Send startup notification to Electron"""
        startup_message = {
            'message': 'Python backend initialized and ready'
        }
        self.messenger.send_message('STARTUP', startup_message)
