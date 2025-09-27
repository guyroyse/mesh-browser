#!/usr/bin/env python3
import json
import sys

from .message_sender import ConsoleMessageSender as MessageSender


class ConsoleManager:

    def __init__(self):
        self.running = True
        self.messenger = MessageSender()


    def run(self):
        """Main lifecycle loop - handle startup notification and shutdown commands"""
        self._send_startup_message()

        try:
            while self.running and self._wait_for_command():
                pass
        except Exception as e:
            self.messenger.send_error(f"Backend error: {e}")

        self._send_shutdown_message()


    def _wait_for_command(self) -> bool:
        """Wait for shutdown command or EOF. Returns False when shutdown requested."""
        line = sys.stdin.readline()

        # If EOF, stop running
        if not line:
            return False

        # If empty/whitespace, continue waiting
        if not line or line.isspace():
            return True
        
        return self._process_command(line)


    def _process_command(self, line: str) -> bool:
        """Process a single command line. Returns False if shutdown requested."""

        # Try to parse shutdown command
        try:
            message = json.loads(line)
            command = message.get('command')

            if command == 'shutdown': return self._process_shutdown(message)
            return self._process_unknown_command(message)

        except json.JSONDecodeError:
            return self._process_malformed_message(line)


    def _process_shutdown(self, message) -> bool:
        """Handle shutdown procedure"""

        self.running = False

        response = {
            'id': message.get('id'),
            'data': {'message': 'Python backend shutting down'}
        }

        self.messenger.send_message('MESHBROWSER_MSG', response)
        return False


    def _process_unknown_command(self, message) -> bool:
        """Handle unknown command"""

        self.messenger.send_warning(f"Ignoring unknown command '{message.get('command')}' - use HTTP API instead")
        return True


    def _process_malformed_message(self, line: str) -> bool:
        """Handle malformed command"""

        self.messenger.send_error(f"Ignoring malformed command: {line.strip()}")
        return True


    def _send_startup_message(self):
        """Send startup notification"""

        startup_message = {
            'type': 'startup',
            'message': 'Python backend initialized and ready'
        }

        self.messenger.send_message('STARTUP', startup_message)


    def _send_shutdown_message(self):
        """Send shutdown notification"""

        shutdown_message = {
            'type': 'shutdown',
            'message': 'Python backend terminated'
        }

        self.messenger.send_message('SHUTDOWN', shutdown_message)
